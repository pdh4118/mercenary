// 소리 설정과 순수 계산(거리 감쇠, 겹침 제한). 실제 재생은 클라이언트(client/src/audio.ts)가 한다.

export interface SoundDef {
  variants: number; // 파일 변형 수(<이름>_1 ... <이름>_N)
  volume: number; // 기본 음량 0..1
  cooldownMs: number; // 같은 소리를 다시 낼 수 있기까지의 최소 간격
  maxVoices: number; // 이 소리가 동시에 울릴 수 있는 최대 개수
  pitchVar: number; // 매번 음높이를 이만큼(비율) 흔들어 반복감을 줄인다
  spatial: boolean; // 화면 속 위치에 따라 멀면 작게, 좌우로 치우치게
  important?: boolean; // 겹침·간격 제한을 받지 않는 알림 소리
  loop?: boolean;
}

const d = (variants: number, volume: number, cooldownMs: number, maxVoices: number, pitchVar = 0.06, spatial = true, extra: Partial<SoundDef> = {}): SoundDef => ({
  variants,
  volume,
  cooldownMs,
  maxVoices,
  pitchVar,
  spatial,
  ...extra,
});

/** docs/asset-prompts.md 10장의 파일 이름과 같다. 파일이 없으면 조용히 건너뛴다. */
export const SOUNDS = {
  // 1순위
  bow_shot: d(3, 0.5, 70, 4),
  arrow_volley: d(1, 0.6, 350, 2, 0.04), // 여러 명이 한꺼번에 쏠 때(화살 연사)
  arrow_hit: d(4, 0.45, 60, 5),
  melee_hit: d(7, 0.55, 60, 5),
  shield_block: d(3, 0.55, 70, 4),
  shield_break: d(2, 0.7, 150, 2),
  crit_hit: d(8, 0.7, 90, 3, 0.05), // 충격음 8종을 번갈아
  enemy_die: d(4, 0.4, 80, 4),
  ally_hurt: d(3, 0.6, 120, 3, 0.05, false),
  level_up: d(1, 0.8, 0, 1, 0, false, { important: true }),
  boss_warning: d(1, 0.9, 0, 1, 0, false, { important: true }),
  // 2순위
  spear_thrust: d(2, 0.5, 120, 3),
  sword_swing: d(2, 0.5, 100, 3),
  mace_smash: d(2, 0.6, 200, 2),
  backstab: d(2, 0.6, 100, 3),
  knockback: d(2, 0.45, 100, 3),
  dodge: d(2, 0.4, 100, 2),
  cavalry_charge: d(1, 0.8, 800, 1, 0, false),
  hoof_gallop: d(1, 0.3, 0, 1, 0, false, { loop: true }),
  coin_gain: d(3, 0.3, 120, 2, 0.1, false),
  hire: d(1, 0.7, 200, 1, 0, false, { important: true }),
  upgrade_ready: d(1, 0.6, 400, 1, 0, false, { important: true }),
  upgrade_done: d(1, 0.7, 200, 1, 0, false, { important: true }),
  card_pick: d(2, 0.55, 80, 1, 0.03, false, { important: true }),
  card_reroll: d(1, 0.5, 80, 1, 0, false, { important: true }),
  legend_card: d(1, 0.85, 0, 1, 0, false, { important: true }),
  hero_down: d(1, 0.8, 500, 1, 0, true),
  // 3순위
  revive_loop: d(1, 0.4, 0, 1, 0, true, { loop: true }),
  revive_done: d(1, 0.7, 300, 1, 0, true),
  morale_break: d(1, 0.7, 2000, 1, 0, false, { important: true }),
  squad_warning: d(1, 0.7, 1000, 1, 0, false, { important: true }),
  stage_clear: d(1, 0.85, 0, 1, 0, false, { important: true }),
  victory: d(1, 0.9, 0, 1, 0, false, { important: true }),
  defeat: d(1, 0.9, 0, 1, 0, false, { important: true }),
  camp_open: d(1, 0.4, 600, 1, 0, false),
  ui_click: d(2, 0.4, 40, 2, 0.03, false, { important: true }),
  merc_respawn: d(2, 0.45, 150, 3, 0.05, true),
} as const satisfies Record<string, SoundDef>;
export type SoundName = keyof typeof SOUNDS;

/** 배경 음악(파일 이름은 같은 규칙, 변형 없이 <이름>_1) */
export const MUSIC = ["bgm_lobby", "bgm_grow", "bgm_boss"] as const;
export type MusicName = (typeof MUSIC)[number];

/** 지원하는 파일 확장자(앞에서부터 시도) */
export const AUDIO_EXTENSIONS = ["ogg", "wav", "mp3"] as const;
export const soundPath = (name: string, variant: number, ext: string): string => `assets/audio/${name}_${variant}.${ext}`;

// --- 위치에 따른 소리 ---------------------------------------------------------
export const SPATIAL_NEAR = 220; // 이 거리 안이면 100%
export const SPATIAL_FAR = 950; // 이 거리 밖이면 들리지 않는다
export const SPATIAL_PAN_RANGE = 700;

/** 듣는 위치에서 소리가 난 곳까지의 거리(px)에 따른 음량 배율 0..1 */
export function spatialGain(dist: number): number {
  if (dist <= SPATIAL_NEAR) return 1;
  if (dist >= SPATIAL_FAR) return 0;
  const t = (dist - SPATIAL_NEAR) / (SPATIAL_FAR - SPATIAL_NEAR);
  return (1 - t) * (1 - t); // 가까울수록 천천히 줄고 멀수록 빨리 사라진다
}

/** 좌우 위치(-1..1). 화면 가장자리라도 한쪽으로 완전히 쏠리지는 않게 0.8까지만 */
export function spatialPan(dx: number): number {
  return Math.max(-1, Math.min(1, dx / SPATIAL_PAN_RANGE)) * 0.8;
}

/** 직전과 다른 변형을 고른다(변형이 하나뿐이면 그것) */
export function pickVariant(count: number, last: number, rnd: () => number = Math.random): number {
  if (count <= 1) return 1;
  let v = 1 + Math.floor(rnd() * count);
  if (v === last) v = (v % count) + 1;
  return v;
}

// --- 겹침 제한 ----------------------------------------------------------------
export const GLOBAL_MAX_VOICES = 28;

/** 같은 소리의 최소 간격·동시 개수와 전체 동시 개수를 지키게 한다. 알림 소리(important)는 제한하지 않는다. */
export class SoundLimiter {
  private last = new Map<string, number>();
  allow(name: string, def: SoundDef, nowMs: number, activeOfName: number, activeTotal: number): boolean {
    if (def.important) return true;
    if (activeTotal >= GLOBAL_MAX_VOICES) return false;
    if (activeOfName >= def.maxVoices) return false;
    const prev = this.last.get(name);
    if (prev !== undefined && nowMs - prev < def.cooldownMs) return false;
    this.last.set(name, nowMs);
    return true;
  }
  /** 중요 소리도 기록해 두면 간격 판정에 쓸 수 있다 */
  mark(name: string, nowMs: number): void {
    this.last.set(name, nowMs);
  }
}

/** 저장되는 소리 설정 */
export interface AudioSettings {
  muted: boolean;
  sfx: number; // 0..1
  music: number; // 0..1
}
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { muted: false, sfx: 0.8, music: 0.5 };
export function sanitizeAudioSettings(raw: unknown): AudioSettings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<Record<keyof AudioSettings, unknown>>;
  const vol = (v: unknown, def: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : def);
  return { muted: r.muted === true, sfx: vol(r.sfx, DEFAULT_AUDIO_SETTINGS.sfx), music: vol(r.music, DEFAULT_AUDIO_SETTINGS.music) };
}
