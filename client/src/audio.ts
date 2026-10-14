import {
  AUDIO_EXTENSIONS,
  DEFAULT_AUDIO_SETTINGS,
  MUSIC,
  SOUNDS,
  SoundLimiter,
  pickVariant,
  sanitizeAudioSettings,
  soundPath,
  spatialGain,
  spatialPan,
  type AudioSettings,
  type MusicName,
  type SoundDef,
  type SoundName,
} from "@mercenary/shared";

const SETTINGS_KEY = "mercenary.audio";

export interface PlayOptions {
  x?: number; // 소리가 난 월드 좌표(주면 듣는 위치와의 거리·좌우로 음량이 정해진다)
  y?: number;
  vol?: number; // 추가 음량 배율
}

export interface GameAudio {
  /** 브라우저는 사용자가 한 번 조작해야 소리를 허용한다. 첫 클릭·키 입력에서 부른다. */
  unlock(): void;
  /** 듣는 위치(내 주인공) */
  setListener(x: number, y: number): void;
  play(name: SoundName, opts?: PlayOptions): void;
  /** 반복 소리를 켜고 끈다(예: 부활 진행) */
  loop(name: SoundName, on: boolean): void;
  music(name: MusicName | null): void;
  settings(): AudioSettings;
  setSettings(patch: Partial<AudioSettings>): void;
  toggleMute(): void;
  /** 설정이 바뀌면(단축키 M 포함) 알려 준다 */
  onChange(cb: () => void): void;
  /** 시험·점검용 */
  stats(): { unlocked: boolean; played: Record<string, number>; loaded: string[]; missing: string[] };
}

function loadSettings(): AudioSettings {
  try {
    return sanitizeAudioSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

/**
 * 소리 재생기. 파일이 없으면 조용히 건너뛰므로(요청 목록은 docs/asset-prompts.md 10장), 파일이 없는 지금도 안전하다.
 * 같은 소리가 너무 자주·많이 겹치지 않게 제한하고, 화면 속 위치에 따라 음량과 좌우 위치를 정한다.
 */
export function createAudio(): GameAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let sfxBus: GainNode;
  let musicBus: GainNode;
  let cfg = loadSettings();
  let listener = { x: 0, y: 0 };
  const limiter = new SoundLimiter();
  const buffers = new Map<string, AudioBuffer[]>(); // 이름 → 변형 버퍼(없는 소리는 빈 배열)
  const missing = new Set<string>();
  const loading = new Map<string, Promise<void>>();
  const active = new Map<string, number>();
  let activeTotal = 0;
  const lastVariant = new Map<string, number>();
  const played: Record<string, number> = {};
  const loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  let currentMusic: { name: MusicName; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  let wantMusic: MusicName | null = null;

  const apply = () => {
    if (!ctx) return;
    master.gain.value = cfg.muted ? 0 : 1;
    sfxBus.gain.value = cfg.sfx;
    musicBus.gain.value = cfg.music * 0.6; // 음악은 효과음보다 확실히 낮게 깔린다
  };
  const listeners: (() => void)[] = [];
  const save = () => {
    for (const cb of listeners) cb();
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg));
    } catch {
      /* 저장소를 못 써도 이번 접속에서는 동작한다 */
    }
  };

  /** 한 파일을 받아 해독한다. 없거나 소리 파일이 아니면 null. */
  async function fetchBuffer(path: string): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(path);
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || type.includes("text/html")) return null; // 없는 파일에 화면(HTML)을 돌려주는 서버도 있다
      return await ctx!.decodeAudioData(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  /** 소리 하나의 변형들을 받아 둔다. 첫 변형으로 확장자(ogg → wav → mp3)를 찾고, 없으면 그 소리는 없는 것으로 본다. */
  function ensure(name: string, variants: number): Promise<void> {
    let p = loading.get(name);
    if (p) return p;
    p = (async () => {
      let ext: string | null = null;
      let first: AudioBuffer | null = null;
      for (const e of AUDIO_EXTENSIONS) {
        first = await fetchBuffer(soundPath(name, 1, e));
        if (first) {
          ext = e;
          break;
        }
      }
      if (!first || !ext) {
        missing.add(name);
        buffers.set(name, []);
        return;
      }
      const list = [first];
      for (let i = 2; i <= variants; i++) {
        const b = await fetchBuffer(soundPath(name, i, ext));
        if (b) list.push(b);
      }
      buffers.set(name, list);
    })();
    loading.set(name, p);
    return p;
  }

  function unlock(): void {
    if (ctx) {
      if (ctx.state === "suspended") void ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(ctx.destination);
    apply();
    void ctx.resume();
    // 효과음을 미리 받아 둔다(없는 파일은 한 번만 확인하고 건너뛴다)
    for (const [name, def] of Object.entries(SOUNDS)) void ensure(name, (def as SoundDef).variants);
    if (wantMusic) startMusic(wantMusic);
  }

  function startSource(name: string, def: SoundDef, opts: PlayOptions, forceLoop = false): { src: AudioBufferSourceNode; gain: GainNode } | null {
    if (!ctx || cfg.muted) return null;
    const list = buffers.get(name);
    if (!list || list.length === 0) {
      if (!loading.has(name)) void ensure(name, def.variants); // 첫 호출 때 아직 안 받았다면 받아 두고 이번 것은 건너뛴다
      return null;
    }
    let vol = def.volume * (opts.vol ?? 1);
    let pan = 0;
    if (def.spatial && opts.x !== undefined && opts.y !== undefined) {
      vol *= spatialGain(Math.hypot(opts.x - listener.x, opts.y - listener.y));
      pan = spatialPan(opts.x - listener.x);
    }
    if (vol < 0.01) return null;
    const v = pickVariant(list.length, lastVariant.get(name) ?? 0);
    lastVariant.set(name, v);
    const src = ctx.createBufferSource();
    src.buffer = list[v - 1]!;
    src.loop = forceLoop;
    if (def.pitchVar > 0) src.playbackRate.value = 1 + (Math.random() - 0.5) * 2 * def.pitchVar;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain);
    if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      gain.connect(p);
      p.connect(sfxBus);
    } else {
      gain.connect(sfxBus);
    }
    src.start();
    return { src, gain };
  }

  function play(name: SoundName, opts: PlayOptions = {}): void {
    const def = SOUNDS[name] as SoundDef;
    if (!ctx || cfg.muted) return;
    const now = performance.now();
    const n = active.get(name) ?? 0;
    if (!limiter.allow(name, def, now, n, activeTotal)) return;
    const s = startSource(name, def, opts);
    if (!s) return;
    played[name] = (played[name] ?? 0) + 1;
    active.set(name, n + 1);
    activeTotal++;
    s.src.onended = () => {
      active.set(name, Math.max(0, (active.get(name) ?? 1) - 1));
      activeTotal = Math.max(0, activeTotal - 1);
    };
  }

  function loop(name: SoundName, on: boolean): void {
    const cur = loops.get(name);
    if (!on) {
      if (cur) {
        loops.delete(name);
        cur.gain.gain.setTargetAtTime(0, ctx!.currentTime, 0.12);
        setTimeout(() => cur.src.stop(), 600);
      }
      return;
    }
    if (cur || !ctx) return;
    const s = startSource(name, SOUNDS[name] as SoundDef, {}, true);
    if (s) loops.set(name, s);
  }

  async function startMusic(name: MusicName): Promise<void> {
    if (!ctx) return;
    await ensure(name, 1);
    if (wantMusic !== name) return; // 기다리는 사이 다른 곡으로 바뀌었다
    const list = buffers.get(name);
    if (!list || list.length === 0 || !ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = list[0]!;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(musicBus);
    src.start();
    gain.gain.setTargetAtTime(1, ctx.currentTime, 0.6); // 서서히 커진다
    const old = currentMusic;
    currentMusic = { name, src, gain };
    if (old) {
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
      setTimeout(() => old.src.stop(), 3000);
    }
  }

  function music(name: MusicName | null): void {
    if (wantMusic === name) return;
    wantMusic = name;
    if (!ctx) return; // 소리가 허용되면 unlock에서 시작한다
    if (name === null) {
      if (currentMusic) {
        const old = currentMusic;
        currentMusic = null;
        old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
        setTimeout(() => old.src.stop(), 3000);
      }
      return;
    }
    void startMusic(name);
  }

  const gestureEvents = ["pointerdown", "keydown", "touchstart"] as const;
  const onGesture = () => {
    unlock();
    if (ctx) for (const e of gestureEvents) window.removeEventListener(e, onGesture);
  };
  for (const e of gestureEvents) window.addEventListener(e, onGesture);

  return {
    unlock,
    setListener: (x, y) => (listener = { x, y }),
    play,
    loop,
    music,
    settings: () => ({ ...cfg }),
    setSettings(patch) {
      cfg = sanitizeAudioSettings({ ...cfg, ...patch });
      apply();
      save();
    },
    onChange: (cb) => void listeners.push(cb),
    toggleMute() {
      cfg = { ...cfg, muted: !cfg.muted };
      apply();
      save();
    },
    stats: () => ({ unlocked: ctx !== null, played: { ...played }, loaded: [...buffers.entries()].filter(([, v]) => v.length > 0).map(([k]) => k), missing: [...missing] }),
  };
}

/** 소리 설정 화면(방 메뉴의 슬라이더, 오른쪽 위 스피커 버튼)을 연결한다 */
export function bindAudioUi(audio: GameAudio): void {
  const btn = document.getElementById("soundBtn");
  const sfx = document.getElementById("sfxVol") as HTMLInputElement | null;
  const music = document.getElementById("musicVol") as HTMLInputElement | null;
  const mute = document.getElementById("soundMute") as HTMLInputElement | null;
  const refresh = () => {
    const c = audio.settings();
    if (btn) btn.textContent = c.muted ? "🔇" : "🔊";
    if (sfx) sfx.value = String(Math.round(c.sfx * 100));
    if (music) music.value = String(Math.round(c.music * 100));
    if (mute) mute.checked = c.muted;
  };
  btn?.addEventListener("click", () => {
    audio.toggleMute();
    refresh();
  });
  sfx?.addEventListener("input", () => (audio.setSettings({ sfx: Number(sfx.value) / 100 }), refresh()));
  music?.addEventListener("input", () => (audio.setSettings({ music: Number(music.value) / 100 }), refresh()));
  mute?.addEventListener("change", () => (audio.setSettings({ muted: mute.checked }), refresh()));
  audio.onChange(refresh); // M 키로 바꿔도 버튼·체크 표시가 따라온다
  refresh();
}
export { MUSIC };
