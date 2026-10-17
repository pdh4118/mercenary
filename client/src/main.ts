import { Application, Assets, Container, Graphics, Sprite, Text, TilingSprite, type Texture, type TextStyleOptions } from "pixi.js";
import { CAV8_RULE, UNIT_RULES, recolored } from "./recolor.js";
import { createLobby } from "./lobby.js";
import { createFormationUi } from "./formation.js";
import { bindAudioUi, createAudio } from "./audio.js";
import { createMercPanel, isReady } from "./mercpanel.js";
import {
  CARDS,
  CARD_CATEGORY_NAMES,
  RARITY_NAMES,
  CAMP_USE_RADIUS,
  SHIELD,
  SHIELD_FRONT_ARC,
  ARCHER as ARCHER_TYPE,
  MAGE as MAGE_TYPE,
  EVT_METEOR,
  BLUNT as BLUNT_TYPE,
  SPEAR as SPEAR_TYPE,
  LEVELUP_PUSH_RADIUS,
  SWING_VISUAL_SEC,
  WEAPONS,
  ENEMY_STATS,
  BOSS_SIZE,
  EVT_ARROW_HIT,
  EVT_ENEMY_ARROW_HIT,
  EVT_REVIVE,
  EVT_CRIT,
  EVT_DODGE,
  EVT_BACKSTAB,
  EVT_DMG_ALLY,
  EVT_DMG_ENEMY,
  EVT_DMG_ENEMY_CRIT,
  EVT_DMG_SHIELD,
  EVT_KNOCK,
  EVT_REFLECT,
  EVT_COUNTER,
  EVT_DMG_POISON,
  EVT_DMG_POISON_ALLY,
  EVT_SHIELD_BREAK,
  EVT_SHIELD_BLOCK,
  REVIVE_RADIUS,
  STAGE_COUNT,
  applyTuning,
  TOURNAMENT_ARENA_RADIUS,
  meleeArc,
  TerrainMap,
  SPRITE_BY_ID,
  anchorOf,
  TK_PLATEAU,
  TK_DECOR,
  type TerrainWire,
  CHEST_OPEN_RADIUS,
  MERC_STATS,
  mercName,
  PLAYER_RADIUS,
  TICK_RATE,
  spearHalfWidth,
  boxWidthMult,
  usesBox,
  unitCost,
  decodeOffer,
  TIER_BUY_MULT,
  tierName,
  UNIT_NAMES,
  UNIT_TYPES,
  WORLD_SIZE,
  mercPrice,
  type BulletWire,
  type CampWire,
  type ClientMsg,
  type EnemyWire,
  type MercWire,
  type PlayerState,
  type GameInfo,
  type ServerMsg,
  TUNE,
} from "@mercenary/shared";

const params = new URLSearchParams(location.search);
// 기본은 접속한 주소와 같은 곳의 /ws. HTTPS 페이지에서는 자동으로 wss가 된다. 개발 서버도 /ws를 게임 서버로 넘겨 준다.
const serverUrl = params.get("server") ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
const statusEl = document.getElementById("status")!;
const tourBannerEl = document.getElementById("tourBanner")!;
const tourBracketEl = document.getElementById("tourBracket")!;
const tourBigEl = document.getElementById("tourBig")!;
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** 아군 색은 적(붉은 계열)과 헷갈리지 않도록 빨강·주황을 뺀 밝은 색만 쓴다 */
const PLAYER_COLORS = [0x5da6e0, 0x6fd16f, 0xf2d24a, 0xb07be0, 0x5de0d0, 0xf0f0ff, 0xf08fd8, 0xb8e84f];
/** 토너먼트에서 선수 팀 색: 관전할 때는 빨강 대 파랑, 참전할 때는 나는 파랑·상대는 빨강 */
const TEAM_RED = 0xe84848;
const TEAM_BLUE = 0x3d8ff5;
const TEAM_CSS = { red: "#ff6b6b", blue: "#6db3ff" } as const;
/** 병종 색: 기병 주황, 창병 초록, 궁병 노랑, 검방병 파랑, 둔기병 보라, 마법사 청록 */
const TYPE_COLORS = [0xe8883a, 0x6fc46f, 0xe6d45d, 0x5da6e0, 0xb07be0, 0x4fd1d9];
/** 스프라이트 파일 이름(병종 번호 순서) */
const UNIT_FILES = ["cavalry", "spear", "archer", "sword", "mace", "mage"] as const;
/** 이미지는 화면 표시 크기의 약 2배로 만들어 두었다 */
const SPRITE_SCALE = 0.5;
/** 스프라이트 기준점: 가로 중앙, 세로는 몸통 쪽(발은 그 아래). 서버의 유닛 좌표가 몸통 중심이 된다. */
const SPRITE_ANCHOR_Y = 0.65;
/** 주인공 스프라이트 파일 이름(무기 순서: 활, 창, 검, 철퇴, 지팡이, 기마) */
const HERO_FILES = ["archer", "spear", "sword", "mace", "mage", "cavalry"] as const;
/** 주인공은 일반 병사보다 한눈에 띄게 조금 크게 그린다 */
const HERO_SCALE = 0.62;
const SMOOTH_MS = 60; // 서버 스냅샷(20Hz)을 따라가는 보간 시간 상수
const SNAP_DISTANCE = 200; // 이보다 멀리 떨어지면(부활·순간이동) 미끄러지지 않고 바로 이동

interface Tracked {
  node: Container;
  x: number; // 화면에 그려지는(보간된) 위치
  y: number;
}

/** id로 객체를 추적하며 서버 위치로 부드럽게 따라가게 하는 풀. 사라진 id의 노드는 제거한다. */
class Pool<T extends Tracked, W> {
  readonly views = new Map<number, T>();
  constructor(
    private make: (w: W) => T,
    private pos: (w: W) => [id: number, x: number, y: number],
    private smooth: boolean,
    private onRemove?: (v: T) => void,
  ) {}

  update(items: W[], k: number, onEach?: (v: T, w: W) => void): void {
    const seen = new Set<number>();
    for (const w of items) {
      const [id, x, y] = this.pos(w);
      seen.add(id);
      let v = this.views.get(id);
      if (!v) {
        v = this.make(w);
        v.x = x;
        v.y = y;
        this.views.set(id, v);
      }
      if (this.smooth && Math.abs(x - v.x) + Math.abs(y - v.y) < SNAP_DISTANCE) {
        v.x += (x - v.x) * k;
        v.y += (y - v.y) * k;
      } else {
        v.x = x;
        v.y = y;
      }
      v.node.position.set(v.x, v.y);
      onEach?.(v, w);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        this.onRemove?.(v);
        v.node.destroy({ children: true });
        this.views.delete(id);
      }
    }
  }
}

function darken(color: number, f: number): number {
  const r = Math.round(((color >> 16) & 255) * f);
  const g = Math.round(((color >> 8) & 255) * f);
  const b = Math.round((color & 255) * f);
  return (r << 16) | (g << 8) | b;
}

async function main() {
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x14161c, antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true }); // 고해상도 화면에서도 선명하게(최대 2배)
  document.body.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  // 소리: 파일이 없으면 조용히 건너뛴다. 브라우저 정책상 첫 클릭·키 입력 뒤부터 난다.
  const audio = createAudio();
  bindAudioUi(audio);
  Object.defineProperty(window, "__audio", { get: () => audio.stats() });
  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement | null)?.closest("button")) audio.play("ui_click");
  });

  const half = WORLD_SIZE / 2;
  // 병종 스프라이트(기병, 창병, 궁병, 검방병, 둔기병 순). 적은 수백 마리가 되므로 텍스처 하나를 모두가 공유한다.
  const loadUnits = (side: "ally" | "enemy") => Promise.all(UNIT_FILES.map((f) => Assets.load<Texture>(`assets/units/${side}_${f}.png`)));
  const [allyTex, enemyTex] = await Promise.all([loadUnits("ally"), loadUnits("enemy")]);
  // 기병은 8방위(0=북,1=북동,2=동,…) 기본 자세·찌르기 자세 그림을 쓴다. 아군은 주인 색, 적은 어두운 붉은색으로 칠한다.
  const cavRaw = await Promise.all((["idle", "thrust"] as const).map((pose) => Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map((d) => Assets.load<Texture>(`assets/units/cav_${pose}_${d}.png`)))));
  const cavTex = (key: string, pose: number, dir: number, color: number) => recolored(`cav/${key}/${pose}/${dir}`, cavRaw[pose]![dir]!, CAV8_RULE, color);
  const ENEMY_CAV_COLOR = 0x45101a;
  const enemyCav = cavRaw.map((_, pose) => cavRaw[pose]!.map((_t, d) => cavTex("e", pose, d, ENEMY_CAV_COLOR)));
  /** 8방위 그림은 크기가 달라 별도 배율·기준점을 쓴다 */
  const CAV_SCALE = 0.72 * SPRITE_SCALE * 2 * 0.5;
  const CAV_ANCHOR: [number, number] = [0.483, 0.72];
  // 주인공(무기별), 캠프, 바닥, 화살(기본·속도선 3단계·명중 순)
  const [heroTex, campTex, groundTex, allyArrow, enemyArrow] = await Promise.all([
    Promise.all(HERO_FILES.map((f) => Assets.load<Texture>(`assets/hero/hero_${f}.png`))),
    Assets.load<Texture>("assets/camp/camp.png"),
    Assets.load<Texture>("assets/tiles/ground_a.png"),
    Promise.all([0, 1, 2, 3, 4].map((i) => Assets.load<Texture>(`assets/fx/arrow_ally_${i}.png`))),
    Promise.all([0, 1, 2, 3, 4].map((i) => Assets.load<Texture>(`assets/fx/arrow_enemy_${i}.png`))),
  ]);

  // 운석 이펙트: 낙하(작은 것부터 큰 것 6컷), 폭발 5컷, 바닥에 남는 그을음 5컷
  const [meteorTex, boomTex, scorchTex] = await Promise.all([
    Promise.all([0, 1, 2, 3, 4, 5].map((i) => Assets.load<Texture>(`assets/fx/meteor_${i}.png`))),
    Promise.all([0, 1, 2, 3, 4].map((i) => Assets.load<Texture>(`assets/fx/boom_${i}.png`))),
    Promise.all([0, 1, 2, 3, 4].map((i) => Assets.load<Texture>(`assets/fx/scorch_${i}.png`))),
  ]);

  // 바닥은 타일을 반복해서 깔고, 월드 경계를 선으로 표시한다
  const ground = new TilingSprite({ texture: groundTex, width: WORLD_SIZE, height: WORLD_SIZE });
  ground.position.set(-half, -half);
  ground.tint = 0xa6a6a6; // 전투가 잘 보이도록 바닥을 한 단계 어둡게 눌러 둔다
  const border = new Graphics().rect(-half, -half, WORLD_SIZE, WORLD_SIZE).stroke({ width: 4, color: 0x5a3b3b });
  const terrainFlat = new Container(); // 고지대·장식: 모든 유닛 아래
  const terrainLow = new Container(); // 바위·나무·폐허: 유닛 뒤에 있을 때
  terrainLow.sortableChildren = true;
  world.addChild(ground, border, terrainFlat, terrainLow);

  const campLayer = new Container();
  const enemyLayer = new Container();
  const fxLayer = new Graphics(); // 공격 예고 부채꼴
  const bulletLayer = new Container();
  const mercLayer = new Container();
  const playerLayer = new Container();
  const groundFx = new Container(); // 바닥에 남는 그을음(유닛 아래)
  const skyLayer = new Container(); // 떨어지는 운석과 폭발(유닛 위)
  enemyLayer.sortableChildren = true; // 아래쪽에 있는 유닛이 위에 그려지게(깊이 정렬)
  mercLayer.sortableChildren = true;
  const chargeMark = new Graphics();
  const chargeLabel = new Text({ text: "돌격", style: { fill: 0xffc27a, fontSize: 13 } });
  chargeLabel.anchor.set(0.5, 1);
  chargeMark.visible = chargeLabel.visible = false;
  const dmgLayer = new Container(); // 피해 숫자는 모든 그림 위에
  const terrainHigh = new Container(); // 유닛이 뒤에 서 있는 바위·나무: 유닛을 가린다
  terrainHigh.sortableChildren = true;
  world.addChild(campLayer, groundFx, enemyLayer, fxLayer, bulletLayer, mercLayer, playerLayer, terrainHigh, skyLayer, chargeMark, chargeLabel, dmgLayer);

  // --- 지형: 서버가 판마다 보내 준다 ---
  const terrainTex = new Map<number, Texture>();
  const terrainFile = (id: number) => `assets/terrain/t${String(id).padStart(2, "0")}.png`;
  // 지형 그림을 전부 미리 불러온다(게임이 시작된 뒤 지형이 늦게 뜨지 않게)
  await Promise.all([...SPRITE_BY_ID.keys()].map(async (id) => terrainTex.set(id, await Assets.load<Texture>(terrainFile(id)))));
  interface TView {
    sp: Sprite;
    obj: number;
    solid: boolean;
    x: number;
    footY: number;
    halfW: number;
    top: number;
    high: boolean;
  }
  let terrain: TerrainMap | null = null;
  let tviews: TView[] = [];
  let terrainSeq = 0;
  const setTerrain = async (items: TerrainWire[]) => {
    const seq = ++terrainSeq;
    const ids = [...new Set(items.map((i) => i[0]))].filter((id) => !terrainTex.has(id));
    await Promise.all(ids.map(async (id) => terrainTex.set(id, await Assets.load<Texture>(terrainFile(id)))));
    if (seq !== terrainSeq) return; // 더 새 지형이 왔다
    for (const v of tviews) v.sp.destroy();
    tviews = [];
    terrain = items.length > 0 ? new TerrainMap(items, TOURNAMENT_ARENA_RADIUS + 60) : null;
    items.forEach((it, n) => {
      const s = SPRITE_BY_ID.get(it[0]);
      const tex = terrainTex.get(it[0]);
      if (!s || !tex) return;
      const [ax, ay] = anchorOf(s);
      const sp = new Sprite(tex);
      sp.anchor.set(ax / s.w, ay / s.h);
      sp.position.set(it[1], it[2]);
      sp.scale.set(it[4] ? -it[3] : it[3], it[3]);
      const solid = s.kind !== TK_PLATEAU && s.kind !== TK_DECOR;
      sp.zIndex = it[2];
      (solid ? terrainLow : terrainFlat).addChild(sp);
      tviews.push({ sp, obj: n, solid, x: it[1], footY: it[2], halfW: (s.w / 2) * it[3], top: it[2] - ay * it[3], high: false });
    });
  };

  /** 스프라이트는 오른쪽을 보고 그려져 있어, 왼쪽으로 움직이거나 공격할 때는 좌우 반전한다 */
  interface Facing {
    lastX: number;
    lastY: number;
    dir: number; // 8방위 그림용 방향(0=북, 시계 방향)
    spd: number; // 부드럽게 만든 이동 속도(px/초) - 기병 달리기 모션용
    phase: number; // 달리기 박자(라디안)
    face: 1 | -1;
  }
  const faceFrom = (v: Facing, x: number, attackAng: number | null) => {
    if (attackAng !== null) v.face = Math.cos(attackAng) >= 0 ? 1 : -1;
    else if (Math.abs(x - v.lastX) > 0.15) v.face = x > v.lastX ? 1 : -1;
    v.lastX = x;
  };
  /** 기병 달리기 모션: 속도에 비례해 말이 위아래로 출렁이고 몸이 앞뒤로 기운다. 찌르는 동안과 멈춰 있을 때는 가만히. */
  const cavGait = (v: Facing & { x: number; y: number; sprite: Sprite }, dtMs: number, thrusting: boolean, scale: number) => {
    const dt = Math.max(dtMs, 1) / 1000;
    const inst = Math.hypot(v.x - v.lastX, v.y - v.lastY) / dt;
    v.spd += (Math.min(inst, 400) - v.spd) * Math.min(1, dt * 8);
    const run = thrusting ? 0 : Math.min(1, Math.max(0, (v.spd - 25) / 130));
    v.phase += dt * (8 + v.spd * 0.022);
    const s = Math.sin(v.phase);
    v.sprite.pivot.y = (Math.abs(s) * 3.2 * run) / scale; // 화면에서 최대 약 3px 튀어 오른다
    v.sprite.rotation = s * 0.045 * run;
  };
  /** 8방위 방향: 공격 중이면 공격 방향, 아니면 움직인 방향. 경계 근처에서 깜빡이지 않게 충분히 넘어갔을 때만 바꾼다. */
  const cavDir = (v: Facing, x: number, y: number, attackAng: number | null) => {
    let ang: number | null = null;
    if (attackAng !== null) ang = attackAng;
    else if (Math.hypot(x - v.lastX, y - v.lastY) > 0.3) ang = Math.atan2(y - v.lastY, x - v.lastX);
    if (ang !== null) {
      const f = ((Math.atan2(Math.sin(ang), Math.cos(ang)) / (Math.PI / 4) + 2 + 8) % 8); // 0=북이 되도록 동(0°)을 2로 옮긴다
      let diff = Math.abs(f - v.dir);
      diff = Math.min(diff, 8 - diff);
      if (diff > 0.65 || attackAng !== null) v.dir = Math.round(f) % 8;
    }
  };

  const enemies = new Pool<Tracked & Facing & { sprite: Sprite }, EnemyWire>(
    (w) => {
      const sprite = new Sprite(w[4] === 0 ? enemyCav[0]![2]! : enemyTex[w[4]]!);
      if (w[4] === 0) sprite.anchor.set(...CAV_ANCHOR);
      else sprite.anchor.set(0.5, SPRITE_ANCHOR_Y);
      enemyLayer.addChild(sprite);
      return { node: sprite, sprite, x: 0, y: 0, lastX: w[1], lastY: w[2], dir: 2, spd: 0, phase: 0, face: 1 };
    },
    (w) => [w[0], w[1], w[2]],
    true,
    (v) => {
      // 사라졌다 = 쓰러졌다. 갑옷 소리는 늘 깔고, 비명은 가끔만 섞는다(많이 죽을 때 시끄럽지 않게).
      audio.play("armor_fall", { x: v.x, y: v.y });
      if (Math.random() < 0.4) audio.play("enemy_die", { x: v.x, y: v.y });
    },
  );
  /** 화살은 날아가는 방향으로 돌려 그린다. 서버가 방향을 보내지 않으므로 이전 위치와의 차이로 구한다. */
  interface BulletView extends Tracked {
    hostile: boolean;
    angle: number;
    ready: boolean;
    x0: number; // 이전 프레임 위치(방향 계산용)
    y0: number;
  }
  // 같은 순간에 나간 화살이 많으면 하나씩 소리 내는 대신 '화살 연사' 소리 하나로 낸다
  const shotBuf: { x: number; y: number; hostile: boolean }[] = [];
  let shotWindowStart = 0;
  const hitFx: { node: Container; age: number; grow?: number; life?: number }[] = [];
  // 운석 폭발(폭발 컷 → 바닥 그을음 컷)과 떨어지는 운석 스프라이트
  const blasts: { x: number; y: number; r: number; age: number; boom: Sprite | null; scorch: Sprite | null }[] = [];
  const falling = new Map<number, Sprite>();
  const BOOM_SEC = 0.6;
  const SCORCH_SEC = 2.8;
  const METEOR_DIR = { x: 0.5, y: -0.87 }; // 꼬리 쪽(오른쪽 위)에서 날아온다
  const HIT_FX_SEC = 0.22;
  const ARROW_SCALE = 0.5;
  const bullets = new Pool<BulletView, BulletWire>(
    (w) => {
      const hostile = w[3] === 1;
      const sprite = new Sprite((hostile ? enemyArrow : allyArrow)[2]!); // 속도선이 중간 정도인 컷
      sprite.anchor.set(0.82, 0.5); // 화살촉이 위치에 오도록
      sprite.scale.set(ARROW_SCALE);
      sprite.visible = false; // 첫 프레임에는 방향을 모른다
      bulletLayer.addChild(sprite);
      // 첫 발은 바로 소리 내(반응이 늦지 않게), 같은 순간에 이어서 나간 화살만 모아서 처리한다
      if (shotWindowStart === 0) {
        shotWindowStart = performance.now();
        audio.play("bow_shot", { x: w[1], y: w[2], vol: hostile ? 0.6 : 1 });
      } else {
        shotBuf.push({ x: w[1], y: w[2], hostile });
      }
      return { node: sprite, x: 0, y: 0, hostile, angle: 0, ready: false, x0: w[1], y0: w[2] };
    },
    (w) => [w[0], w[1], w[2]],
    false, // 빠르게 움직이는 투사체는 서버 위치를 그대로 그린다
  );

  const drawBar = (g: Graphics, hp: number, max: number, width: number, y: number) => {
    g.clear()
      .rect(-width / 2, y, width, 4)
      .fill(0x2a2d36)
      .rect(-width / 2, y, (width * Math.max(0, hp)) / max, 4)
      .fill(hp / max > 0.3 ? 0x6fd16f : 0xe05d5d);
  };

  /** 토너먼트 팀: 내가 선수면 나는 파랑·상대는 빨강, 관전이면 먼저 호명된 선수가 빨강·다른 선수가 파랑. 선수가 아니면 null. */
  function teamSide(owner: number): "red" | "blue" | null {
    const gi = latest?.g;
    const tour = gi?.phase === "tournament" ? gi.tour : null;
    if (!tour || !tour.a || !tour.b || (owner !== tour.a && owner !== tour.b)) return null;
    if (myId === tour.a || myId === tour.b) return owner === myId ? "blue" : "red";
    return owner === tour.a ? "red" : "blue";
  }
  function ownerColor(owner: number): number {
    const t = teamSide(owner);
    return t === "red" ? TEAM_RED : t === "blue" ? TEAM_BLUE : PLAYER_COLORS[(owner - 1) % PLAYER_COLORS.length]!;
  }

  interface MercView extends Tracked, Facing {
    bar: Graphics;
    sprite: Sprite;
    lastKey: string;
    label: Text;
    wasDown: boolean;
    ring: Graphics;
    ringColor: number;
    ringTeam: boolean;
    ringShape: [number, number, number, number]; // 중심 x, 중심 y, 가로 반지름, 세로 반지름
  }
  const mercs = new Pool<MercView, MercWire>(
    (w) => {
      const node = new Container();
      const st = MERC_STATS[w[4]]!;
      const t = allyTex[w[4]]!;
      // 어느 플레이어의 용병인지 발밑 고리 색으로 구분한다
      const footY = t.height * SPRITE_SCALE * (1 - SPRITE_ANCHOR_Y) * 0.85;
      const ring = new Graphics();
      const sprite = new Sprite(t);
      if (w[4] === 0) sprite.anchor.set(...CAV_ANCHOR);
      else sprite.anchor.set(0.5, SPRITE_ANCHOR_Y);
      const bar = new Graphics();
      const label = new Text({ text: mercName(w[16]), style: { fill: 0xffffff, fontSize: 11, stroke: { color: 0x000000, width: 3 } } });
      label.anchor.set(0.5, 1);
      label.y = -t.height * SPRITE_SCALE * SPRITE_ANCHOR_Y - 18;
      label.visible = false;
      node.addChild(ring, sprite, bar, label);
      mercLayer.addChild(node);
      return { node, bar, sprite, label, ring, ringColor: -1, ringTeam: false, ringShape: [0, footY, st.radius * 1.25, st.radius * 0.6], x: 0, y: 0, lastKey: "", lastX: w[1], lastY: w[2], dir: 2, spd: 0, phase: 0, face: 1, wasDown: w[8] > 0 };
    },
    (w) => [w[0], w[1], w[2]],
    true,
  );

  interface PlayerView extends Tracked {
    bar: Graphics;
    aimMark: Graphics;
    sprite: Sprite;
    lastSwing: number;
    wasDown: boolean;
    ring: Graphics;
    ringColor: number;
    ringTeam: boolean;
    ringShape: [number, number, number, number];
    label: Text;
  }
  /** 발밑 고리를 주인 색(토너먼트에서는 팀 색)으로 그린다. 색이 바뀌었을 때만 다시 그린다. */
  const paintRing = (v: { ring: Graphics; ringColor: number; ringTeam: boolean; ringShape: [number, number, number, number] }, color: number, team: boolean) => {
    if (v.ringColor === color && v.ringTeam === team) return;
    v.ringColor = color;
    v.ringTeam = team;
    const [cx, cy, rx, ry] = v.ringShape;
    v.ring
      .clear()
      .ellipse(cx, cy, rx * (team ? 1.25 : 1), ry * (team ? 1.25 : 1))
      .fill({ color, alpha: team ? 0.5 : 0.28 })
      .stroke({ width: team ? 4.5 : 3, color });
  };
  const HERO_TOP = -Math.max(...heroTex.map((t) => t.height)) * HERO_SCALE * SPRITE_ANCHOR_Y; // 가장 큰 포즈의 머리 위쪽
  const players = new Pool<PlayerView, PlayerState>(
    (p) => {
      const node = new Container();
      // 어느 플레이어인지 발밑 고리 색으로 구분한다(용병과 같은 방식)
      const footY = Math.max(...heroTex.map((t) => t.height)) * HERO_SCALE * (1 - SPRITE_ANCHOR_Y) * 0.85;
      const ring = new Graphics();
      const sprite = new Sprite(heroTex[0]!);
      sprite.anchor.set(0.5, SPRITE_ANCHOR_Y);
      const aimMark = new Graphics(); // 조준 방향 표시(몸 바깥에)
      const bar = new Graphics();
      const label = new Text({ text: p.name, style: { fill: 0xffffff, fontSize: 13, stroke: { color: 0x000000, width: 3 } } });
      label.anchor.set(0.5, 1);
      label.y = HERO_TOP - 12;
      node.addChild(ring, sprite, aimMark, bar, label);
      playerLayer.addChild(node);
      return { node, aimMark, bar, sprite, label, ring, ringColor: -1, ringTeam: false, ringShape: [0, footY, PLAYER_RADIUS * 1.5, PLAYER_RADIUS * 0.7], x: 0, y: 0, lastSwing: 0, wasDown: false };
    },
    (p) => [p.id, p.x, p.y],
    true,
  );

  interface CampView extends Tracked {
    label: Text;
  }
  const camps = new Pool<CampView, CampWire>(
    () => {
      const node = new Container();
      const ring = new Graphics().circle(0, 0, CAMP_USE_RADIUS).fill({ color: 0xe0c05d, alpha: 0.06 }).stroke({ width: 2, color: 0xe0c05d, alpha: 0.5 });
      const tent = new Sprite(campTex);
      tent.anchor.set(0.5, 0.6); // 모닥불 쪽이 원 가운데에 오도록
      tent.scale.set(0.5);
      const label = new Text({ text: "", style: { fill: 0xf2dfa0, fontSize: 13, stroke: { color: 0x000000, width: 3 } } });
      label.anchor.set(0.5, 0);
      label.y = campTex.height * 0.5 * 0.4 + 4;
      node.addChild(ring, tent, label);
      campLayer.addChild(node);
      return { node, label, x: 0, y: 0 };
    },
    (w) => [w[0], w[1], w[2]],
    false,
  );

  // --- HUD (화면 고정) -----------------------------------------------------
  const hud = new Container();
  app.stage.addChild(hud);
  // 왼쪽 위 상태 상자: 레벨·경험치·체력 막대와 금화·통솔력 등을 한 상자에 모아 큼직하게 보여 준다
  const HUD_W = 320;
  const hudPanel = new Container();
  hudPanel.position.set(10, 30);
  const hudBg = new Graphics();
  const hudBars = new Graphics();
  const hudTxt = (size: number, fill = 0xe6e9f0, bold = false) => new Text({ text: "", style: { fill, fontSize: size, fontWeight: bold ? "bold" : "normal" } });
  const hudLv = hudTxt(24, 0xffe08a, true);
  hudLv.position.set(14, 8);
  const hudTime = hudTxt(20, 0xcfd3dc, true);
  hudTime.anchor.set(1, 0);
  hudTime.position.set(HUD_W - 14, 12);
  const hudHp = hudTxt(15, 0xffffff, true);
  hudHp.anchor.set(0.5);
  hudHp.position.set(HUD_W / 2, 62);
  const hudGold = hudTxt(19, 0xffd45d, true);
  hudGold.position.set(14, 86);
  const hudKills = hudTxt(19, 0xe6e9f0, true);
  hudKills.anchor.set(1, 0);
  hudKills.position.set(HUD_W - 14, 86);
  const hudLead = hudTxt(19, 0x9fd0ff, true);
  hudLead.position.set(14, 114);
  const hudMercs = hudTxt(19, 0xe6e9f0, true);
  hudMercs.anchor.set(1, 0);
  hudMercs.position.set(HUD_W - 14, 114);
  const hudExtra = hudTxt(16, 0xffb4a8, true);
  hudExtra.position.set(14, 144);
  hudPanel.addChild(hudBg, hudBars, hudLv, hudTime, hudHp, hudGold, hudKills, hudLead, hudMercs, hudExtra);
  let hudH = 0;
  const drawHudBg = (h: number) => {
    if (h === hudH) return;
    hudH = h;
    hudBg
      .clear()
      .roundRect(0, 0, HUD_W, h, 12)
      .fill({ color: 0x0b0d12, alpha: 0.78 })
      .stroke({ width: 2, color: 0x59627a })
      .roundRect(3, 3, HUD_W - 6, h - 6, 10)
      .stroke({ width: 1, color: 0xe0c05d, alpha: 0.35 });
  };
  drawHudBg(142);
  const deadText = new Text({ text: "", style: { fill: 0xffffff, fontSize: 28, stroke: { color: 0x000000, width: 4 } } });
  deadText.anchor.set(0.5);
  // 캠프 고용 창: 한 줄에 용병 하나(그림·이름·가격·통솔력)를 크게 보여 준다
  const CAMP_W = 520;
  const CAMP_ROW_H = 64;
  const campPanel = new Container();
  const campPanelBg = new Graphics();
  const campTitle = new Text({ text: "캠프 - 용병 고용", style: { fill: 0xffe08a, fontSize: 22, fontWeight: "bold" } });
  campTitle.position.set(20, 14);
  const campHint = new Text({ text: "", style: { fill: 0xb8bdc9, fontSize: 15 } });
  campHint.anchor.set(1, 0);
  campHint.position.set(CAMP_W - 20, 20);
  campPanel.addChild(campPanelBg, campTitle, campHint);
  const campRows = [0, 1, 2].map((i) => {
    const node = new Container();
    node.position.set(14, 52 + i * (CAMP_ROW_H + 8));
    const bg = new Graphics();
    const icon = new Sprite();
    icon.anchor.set(0.5);
    icon.position.set(34, CAMP_ROW_H / 2);
    const key = new Text({ text: String(i + 1), style: { fill: 0xffffff, fontSize: 18, fontWeight: "bold" } });
    key.anchor.set(0.5);
    key.position.set(26, 14);
    const name = new Text({ text: "", style: { fill: 0xffffff, fontSize: 22, fontWeight: "bold" } });
    name.position.set(68, 8);
    const sub = new Text({ text: "", style: { fill: 0xb8bdc9, fontSize: 15 } });
    sub.position.set(68, 38);
    const price = new Text({ text: "", style: { fill: 0xffd45d, fontSize: 24, fontWeight: "bold" } });
    price.anchor.set(1, 0);
    price.position.set(CAMP_W - 28 - 20, 6);
    const lead = new Text({ text: "", style: { fill: 0x9fd0ff, fontSize: 16 } });
    lead.anchor.set(1, 0);
    lead.position.set(CAMP_W - 28 - 20, 38);
    node.addChild(bg, icon, key, name, sub, price, lead);
    campPanel.addChild(node);
    return { bg, icon, key, name, sub, price, lead };
  });
  const campDismiss = new Text({ text: "", style: { fill: 0xe6e9f0, fontSize: 16, lineHeight: 22 } });
  campPanel.addChild(campDismiss);
  campPanel.visible = false;
  const toast = new Text({ text: "", style: { fill: 0xffb4a8, fontSize: 16, stroke: { color: 0x000000, width: 3 } } });
  toast.anchor.set(0.5, 0);

  // 도움말: 병종 모양·색과 상성
  const legend = new Container();
  const legendBg = new Graphics();
  legend.addChild(legendBg);
  let lx = 12;
  // 병종 선택 키: 1 = 모든 병종, 2~7 = 병종마다 고정(캠프에서 고용 키이기도 하다). 선택한 것은 노랗게 표시한다.
  const legendLabels: { label: Text; mask: number }[] = [];
  {
    const all = new Text({ text: "1 전체", style: { fill: 0xcfd3dc, fontSize: 12 } });
    all.position.set(lx, 6);
    legend.addChild(all);
    legendLabels.push({ label: all, mask: (1 << UNIT_TYPES.length) - 1 });
    lx += all.width + 14;
  }
  for (const t of UNIT_TYPES) {
    const icon = new Sprite(allyTex[t]!);
    icon.anchor.set(0.5);
    icon.scale.set(22 / icon.texture.height);
    icon.position.set(lx + 14, 14);
    const label = new Text({ text: `${t + 2} ${UNIT_NAMES[t]}`, style: { fill: 0xcfd3dc, fontSize: 12 } });
    label.position.set(lx + 32, 6);
    legend.addChild(icon, label);
    legendLabels.push({ label, mask: 1 << t });
    lx += 32 + label.width + 12;
  }
  const legendText = new Text({
    text: "검방병: 정면만 방패 방어(화살 25%·창 60%) · 둔기병: 방패 파괴 · 기병: 속도 비례 돌격, 창에 먼저 맞으면 속도를 잃고 카운터 · 마법사: 2초 주문 후 운석(방패 무시)",
    style: { fill: 0x9aa1b0, fontSize: 12 },
  });
  legendText.position.set(12, 26);
  legend.addChild(legendText);
  const helpText = new Text({
    text: "WASD 이동 · 좌클릭 사격 · 1 전체·2~7 병종 선택(캠프 곁에서는 그 병종 고용, Shift+번호 해고) · 우클릭 선택 병종에 이동/공격 지시 · F1 주인공 호위 · F2 위치 고수 · F3 돌격(선택한 병종에) · U 용병 강화 · V 명령 순환 · T 마우스 위치 지키기 · G 미니맵 · N 이름 · R 카드 새로고침",
    style: { fill: 0x9aa1b0, fontSize: 12 },
  });
  helpText.position.set(12, 44);
  legend.addChild(helpText);
  const LEGEND_H = 64;
  legendBg.rect(0, 0, Math.max(lx, legendText.width + 24, helpText.width + 24), LEGEND_H).fill({ color: 0x000000, alpha: 0.35 });
  // 미니맵: 월드 전체를 작게 보여 준다. 아군(주인공·용병)은 주인 색 점, 쓰러진 아군은 X(부활 대기), 방금 쓰러진 곳은 잠깐 붉은 고리로 깜빡인다.
  const MINI_W = 320; // 왼쪽 위 상태 상자와 같은 폭
  const STATS_H = 172; // 왼쪽 아래 주인공 능력치 상자 높이
  const mini = new Container();
  const miniG = new Graphics();
  const miniLabel = new Text({ text: "미니맵 (G)", style: { fill: 0x9aa1b0, fontSize: 11 } });
  miniLabel.position.set(8, 4);
  const miniNames = Array.from({ length: 8 }, () => {
    const t = new Text({ text: "", style: { fill: 0xffd0c8, fontSize: 11, fontWeight: "bold", stroke: { color: 0x000000, width: 3 } } });
    t.anchor.set(0.5, 1);
    t.visible = false;
    return t;
  });
  mini.addChild(miniG, miniLabel, ...miniNames);
  let miniOn = (() => {
    try {
      return localStorage.getItem("mercenary.minimap") !== "0";
    } catch {
      return true;
    }
  })();
  /** 쓰러진 곳 표시: 5초 동안 퍼지는 붉은 고리 */
  const deathFlashes: { x: number; y: number; age: number; hero: boolean }[] = [];
  const wasDown = new Map<string, boolean>();
  const MINI_FLASH_SEC = 5;
  // 주인공 능력치 상자(왼쪽 아래): 지금 든 무기와 카드가 반영된 실제 값
  const statsPanel = new Container();
  const statsBg = new Graphics()
    .roundRect(0, 0, MINI_W, STATS_H, 12)
    .fill({ color: 0x0b0d12, alpha: 0.78 })
    .stroke({ width: 2, color: 0x59627a })
    .roundRect(3, 3, MINI_W - 6, STATS_H - 6, 10)
    .stroke({ width: 1, color: 0xe0c05d, alpha: 0.35 });
  const statsTitle = new Text({ text: "주인공 능력치", style: { fill: 0xffe08a, fontSize: 15, fontWeight: "bold" } });
  statsTitle.position.set(14, 7);
  const statsWeapon = new Text({ text: "", style: { fill: 0x9aa1b0, fontSize: 13 } });
  statsWeapon.anchor.set(1, 0);
  statsWeapon.position.set(MINI_W - 14, 9);
  statsPanel.addChild(statsBg, statsTitle, statsWeapon);
  const statLabels: Text[] = [];
  const statValues: Text[] = [];
  for (let i = 0; i < 14; i++) {
    const col = Math.floor(i / 7);
    const row = i % 7;
    const lx = 14 + col * (MINI_W / 2);
    const y = 32 + row * 20;
    const label = new Text({ text: "", style: { fill: 0xb8bdc9, fontSize: 13 } });
    label.position.set(lx, y + 1);
    const value = new Text({ text: "", style: { fill: 0xffffff, fontSize: 15, fontWeight: "bold" } });
    value.anchor.set(1, 0);
    value.position.set(lx + MINI_W / 2 - 24, y - 1);
    statLabels.push(label);
    statValues.push(value);
    statsPanel.addChild(label, value);
  }
  const stageText = new Text({ text: "", style: { fill: 0xffffff, fontSize: 18, fontWeight: "bold", stroke: { color: 0x000000, width: 4 } } });
  stageText.anchor.set(0.5, 0);
  const bossBar = new Graphics();
  const levelToast = new Text({ text: "", style: { fill: 0xffe08a, fontSize: 20, stroke: { color: 0x000000, width: 3 } } });
  levelToast.anchor.set(0.5, 0);

  // 레벨업 카드: 게임을 멈추지 않는 작은 카드. Z/X/C 한 번으로 고른다. 시안(강철 테두리·일러스트 창·별)을 따라 그린다.
  const CARD_W = 350;
  const CARD_H = 142;
  const CARD_GAP = 10;
  const ART = 94;
  const CATEGORY_COLORS = [0xe0c05d, 0x6fd16f, 0x5da6e0, 0xff7a2e];
  const RARITY_COLORS = [0x8d96a8, 0x4d9dff, 0xc27bff, 0xff7a2e];
  const cardArt = await Promise.all(UNIT_FILES.map((f) => Assets.load<Texture>(`assets/cards/art_${f}.png`)));
  /** 카드 일러스트: 병종 단련은 그 병종, 그 밖은 비슷한 성격의 그림을 빌려 쓴다. 없으면 글자 아이콘(-1). */
  const artOf = (c: (typeof CARDS)[number]): number => {
    const e = c.effect;
    if (e.k === "mercStat") {
      if (e.type !== undefined) return e.type; // 병종 전용 카드는 그 병종 그림
      switch (e.stat) {
        case "hp":
        case "defense": return SHIELD;
        case "dmg":
        case "area":
        case "knock": return BLUNT_TYPE;
        case "atkSpeed":
        case "range": return SPEAR_TYPE;
        case "speed":
        case "dodge": return 0;
        default: return -1;
      }
    }
    if (e.k === "legend") return e.scope === "hero" ? -1 : e.scope;
    switch (e.k) {
      case "heroDefense":
      case "heroShield":
      case "heroShieldRegen":
      case "heroThorns":
      case "heroArmor": return SHIELD;
      case "heroDodge": return 0;
      case "heroArea":
      case "heroKnock": return BLUNT_TYPE;
      case "heroDmg":
      case "heroFireRate":
      case "heroRange":
      case "heroPierce":
      case "heroMulti":
      case "heroPoison": return ARCHER_TYPE;
      default: return -1;
    }
  };
  const GLYPHS: Record<string, string> = { leadership: "+", priceMult: "%", goldMult: "G", xpMult: "XP", luck: "LUCK", bounty: "G+", heroMaxHp: "HP", heroSpeed: "»", heroRegen: "♥", heroCrit: "CRIT", heroCritMult: "x1.5+" };
  /** 뽑힐 확률이 낮을수록 별이 많다 */
  const starsOf = (weight: number) => (weight >= 8 ? 1 : weight >= 5 ? 2 : 3);
  const cardPanel = new Container();
  const cardHeader = new Text({ text: "", style: { fill: 0xffe08a, fontSize: 18, fontWeight: "bold", stroke: { color: 0x000000, width: 3 } } });
  cardPanel.addChild(cardHeader);
  const cardViews = [0, 1, 2].map((i) => {
    const node = new Container();
    node.position.set(0, 32 + i * (CARD_H + CARD_GAP));
    const bg = new Graphics();
    const artSprite = new Sprite();
    artSprite.position.set(12, 12);
    const artMask = new Graphics().roundRect(12, 12, ART, ART, 8).fill(0xffffff);
    artSprite.mask = artMask;
    const artFrame = new Graphics();
    const glyph = new Text({ text: "", style: { fill: 0xffffff, fontSize: 34, fontWeight: "bold", stroke: { color: 0x000000, width: 4 } } });
    glyph.anchor.set(0.5);
    glyph.position.set(12 + ART / 2, 12 + ART / 2);
    const keyBg = new Graphics().circle(0, 0, 14).fill(0x11141b).stroke({ width: 2, color: 0xffd45d });
    keyBg.position.set(12, 12 + ART);
    const key = new Text({ text: "ZXC"[i]!, style: { fill: 0xffffff, fontSize: 17, fontWeight: "bold" } });
    key.anchor.set(0.5);
    key.position.set(12, 12 + ART);
    const tag = new Text({ text: "", style: { fill: 0xffffff, fontSize: 14, fontWeight: "bold" } });
    tag.position.set(ART + 26, 8);
    const rar = new Text({ text: "", style: { fill: 0xffffff, fontSize: 14, fontWeight: "bold" } });
    rar.position.set(ART + 26, 8);
    const title = new Text({ text: "", style: { fill: 0xffffff, fontSize: 20, fontWeight: "bold", lineHeight: 22, wordWrap: true, wordWrapWidth: CARD_W - ART - 38 } });
    title.position.set(ART + 26, 28);
    const desc = new Text({ text: "", style: { fill: 0xd2d6e0, fontSize: 14, lineHeight: 18, wordWrap: true, wordWrapWidth: CARD_W - ART - 38 } });
    desc.position.set(ART + 26, 58);
    const starOn = new Text({ text: "", style: { fill: 0xffd45d, fontSize: 17 } });
    const starOff = new Text({ text: "", style: { fill: 0x3b4152, fontSize: 17 } });
    starOn.position.set(CARD_W - 78, 6);
    starOff.position.set(CARD_W - 78, 6);
    node.addChild(bg, artSprite, artMask, artFrame, glyph, keyBg, key, tag, rar, title, desc, starOff, starOn);
    cardPanel.addChild(node);
    return { node, bg, artSprite, artFrame, glyph, tag, rar, title, desc, starOn, starOff };
  });
  cardPanel.visible = false;
  let shownOffer = "";
  const showOffer = (offer: number[], pending: number, rerolls: number, box: number) => {
    const key = `${offer.join(",")}|${pending}|${rerolls}|${box}`;
    if (key === shownOffer) return;
    shownOffer = key;
    cardPanel.visible = offer.length > 0;
    cardHeader.text = offer.length > 0 ? `${box > 0 ? "보상 상자 카드!" : "LEVEL UP!"}${pending > 1 ? ` x${pending}` : ""}  ·  [R] 새로고침 ${rerolls}` : "";
    cardViews.forEach((v, i) => {
      const card = offer[i] !== undefined ? CARDS[offer[i]!] : undefined;
      v.node.visible = !!card;
      if (!card) return;
      const color = CATEGORY_COLORS[card.category]!;
      const art = artOf(card);
      v.artSprite.visible = art >= 0;
      if (art >= 0) {
        const tex = cardArt[art]!;
        v.artSprite.texture = tex;
        v.artSprite.scale.set(ART / tex.width, ART / tex.height);
      }
      v.glyph.visible = art < 0;
      v.glyph.style.fontSize = 26;
      const ef = card.effect;
      v.glyph.text =
        ef.k === "leadership" ? `+${ef.v}` : ef.k === "mercStat" ? ({ crit: "CRIT", critMult: "x1.5+", regen: "♥", respawn: "↺", pierce: "»", multi: "⇶", poison: "☠", armor: "▣", thorns: "↩", xp: "XP" } as Record<string, string>)[ef.stat] ?? "★" : (GLYPHS[ef.k] ?? "★");
      v.tag.text = CARD_CATEGORY_NAMES[card.category];
      v.tag.style.fill = color;
      v.rar.text = card.rarity < 3 ? `· ${RARITY_NAMES[card.rarity]}` : ""; // 전설은 분류 이름이 곧 등급
      v.rar.style.fill = RARITY_COLORS[card.rarity]!;
      v.rar.x = ART + 26 + v.tag.width + 6;
      v.starOn.style.fill = RARITY_COLORS[card.rarity]!;
      v.title.text = card.name;
      v.title.style.fontSize = 20;
      v.title.style.wordWrapWidth = CARD_W - ART - 38;
      v.desc.text = card.desc;
      // 이름이 두 줄이 되면 설명을 그만큼 아래로 민다(긴 이름은 글자를 한 단계 줄여 두 줄 안에 넣는다)
      while (v.title.height > 46 && (v.title.style.fontSize as number) > 15) v.title.style.fontSize = (v.title.style.fontSize as number) - 1;
      v.desc.y = 30 + v.title.height + 4;
      const n = card.stars ?? starsOf(card.weight);
      v.starOn.text = "★".repeat(n);
      v.starOff.text = "★".repeat(3);
      v.bg
        .clear()
        .roundRect(0, 0, CARD_W, CARD_H, 10)
        .fill({ color: 0x1b1f2a, alpha: 0.94 })
        .stroke({ width: 3, color: 0x050608 })
        .roundRect(2.5, 2.5, CARD_W - 5, CARD_H - 5, 8)
        .stroke({ width: card.rarity > 0 ? 2.5 : 1.5, color: card.rarity > 0 ? RARITY_COLORS[card.rarity]! : 0x59627a })
        .roundRect(8, 8, ART + 8, ART + 8, 10) // 일러스트 창 바탕
        .fill({ color: darken(color, 0.35) })
        .poly([CARD_W - 12, 3, CARD_W - 5, 10, CARD_W - 12, 17, CARD_W - 19, 10]) // 모서리 보석
        .fill(0x6fb8ff);
      v.artFrame
        .clear()
        .roundRect(12, 12, ART, ART, 8)
        .stroke({ width: 2, color: 0x0a0c11 })
        .roundRect(12, 12, ART, ART, 8)
        .stroke({ width: 1, color, alpha: 0.7 });
    });
  };
  // 무기 바: 현재 무기와 그 특징(방패·돌격 규칙 등)을 보여 준다
  const SLOT_W = 76;
  const weaponBar = new Container();
  const weaponSlots = WEAPONS.map((w, i) => {
    const node = new Container();
    node.position.set(i * (SLOT_W + 4), 16);
    const bg = new Graphics();
    const label = new Text({ text: w.name, style: { fill: 0xffffff, fontSize: 15, fontWeight: "bold" } });
    label.anchor.set(0.5, 0);
    label.position.set(SLOT_W / 2, 8);
    const sub = new Text({ text: `${UNIT_NAMES[w.type]}계`, style: { fill: 0xb8bdc9, fontSize: 11 } });
    sub.anchor.set(0.5, 0);
    sub.position.set(SLOT_W / 2, 30);
    node.addChild(bg, label, sub);
    weaponBar.addChild(node);
    return { bg };
  });
  const weaponHint = new Text({ text: "", style: { fill: 0xcfd3dc, fontSize: 12 } });
  weaponHint.position.set(0, 70);
  const weaponTitle = new Text({ text: "무기 전환: Q / 마우스 휠", style: { fill: 0x9aa1b0, fontSize: 11 } });
  weaponBar.addChild(weaponTitle, weaponHint);
  let shownWeapon = -1;
  const drawWeaponBar = (active: number) => {
    if (active === shownWeapon) return;
    shownWeapon = active;
    weaponSlots.forEach((slot, i) => {
      const color = TYPE_COLORS[WEAPONS[i]!.type]!;
      slot.bg
        .clear()
        .roundRect(0, 0, SLOT_W, 50, 6)
        .fill({ color: i === active ? darken(color, 0.55) : 0x000000, alpha: i === active ? 0.9 : 0.5 })
        .stroke({ width: i === active ? 3 : 1, color });
    });
    weaponHint.text = WEAPONS[active]!.note;
  };
  weaponBar.visible = false;
  hud.addChild(hudPanel, mini, statsPanel, stageText, bossBar, weaponBar, deadText, campPanel, toast, levelToast, cardPanel, legend);

  const levelOf = new Map<number, number>();
  const rings: { x: number; y: number; age: number }[] = [];
  /** 떠오르는 피해 숫자. 내가 준 피해(흰색, 치명타는 굵은 금색), 방패가 막은 피해(하늘색), 내가 입은 피해(빨강)를 구분한다. */
  interface FloatText {
    node: Text;
    x: number;
    y: number;
    vx: number;
    age: number;
    life: number;
    pop: number; // 처음에 커졌다가 줄어드는 정도
  }
  const floats: FloatText[] = [];
  const FLOAT_MAX = 90;
  const spawnFloat = (text: string, x: number, y: number, style: TextStyleOptions, life: number, pop: number) => {
    if (floats.length >= FLOAT_MAX) floats.shift()!.node.destroy();
    const node = new Text({ text, style });
    node.anchor.set(0.5, 1);
    dmgLayer.addChild(node);
    floats.push({ node, x: x + (Math.random() - 0.5) * 16, y: y - 18, vx: (Math.random() - 0.5) * 18, age: 0, life, pop });
  };
  const numFmt = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Math.max(0.1, Math.round(v * 10) / 10)));
  const bursts: { kind: number; x: number; y: number; ang: number; age: number }[] = [];
  const BURST_SEC = 0.35;
  const RING_SEC = 0.5;
  let latest: Extract<ServerMsg, { t: "state" }> | null = null;
  let myId = -1;
  let toastLeft = 0;
  let lastSquads = 0;
  // 소리용: 이전 프레임 값을 기억해 변화 순간에 소리를 낸다
  const snd = { gold: -1, down: false, shaken: 0, rage: 0, near: -1, phase: "", status: "playing", mercTier: new Map<number, number>(), mercSeen: false, downPlayers: new Set<number>() };
  let levelToastLeft = 0;
  let lastLevel = 0;
  let nearCampId = -1;
  let nearCampOffers: number[] = []; // 가까운 캠프가 파는 용병(병종·단계 코드)
  // 병종 선택: 1 = 모든 병종, 2~7 = 기병·창병·궁병·검방병·둔기병·마법사. 우클릭 지시와 F1~F3 진형이 선택한 병종에 적용된다.
  const ALL_MASK = (1 << UNIT_TYPES.length) - 1;
  let selMask = ALL_MASK;
  const typesField = () => (selMask === ALL_MASK ? undefined : selMask);
  /** 선택한 병종들의 진형이 모두 같으면 그 값, 다르면 -1 */
  const selectedStance = (p: PlayerState | undefined): number => {
    const st = p?.stances;
    if (!st) return p?.stance ?? 0;
    let v = -2;
    for (const t of UNIT_TYPES) {
      if (!(selMask & (1 << t))) continue;
      if (v === -2) v = st[t] ?? 0;
      else if (v !== (st[t] ?? 0)) return -1;
    }
    return v === -2 ? 0 : v;
  };
  /** 지점 방어 지점들(같은 지점은 한 번만) */
  const holdPoints = (p: PlayerState): [number, number][] => {
    const out: [number, number][] = [];
    const st = p.stances;
    if (!st) return p.stance === 2 ? [[p.holdX, p.holdY]] : out;
    for (const t of UNIT_TYPES) {
      if (st[t] !== 2) continue;
      const x = p.holds[t * 2]!;
      const y = p.holds[t * 2 + 1]!;
      if (!out.some((q) => q[0] === x && q[1] === y)) out.push([x, y]);
    }
    return out;
  };
  // 자동 화면 검증용: 최신 서버 상태를 읽을 수 있게 노출한다
  Object.defineProperty(window, "__game", { get: () => ({ latest, myId }) });

  // --- 접속: 로비(방 목록·만들기·참가)를 거쳐 방에 들어가고, 끊기면 같은 캐릭터로 이어서 접속한다 ---
  let ws!: WebSocket;
  const send = (m: ClientMsg) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
  const formations = createFormationUi({
    send,
    colors: TYPE_COLORS,
    notify: (text) => {
      toast.text = text;
      toastLeft = 2;
    },
  });
  let showNames = false;
  const mercPanel = createMercPanel({
    send,
    colors: TYPE_COLORS,
    notify: (text) => {
      toast.text = text;
      toastLeft = 2.5;
      audio.play("upgrade_ready");
    },
  });
  const lobby = createLobby({
    send,
    onEnter: (id) => {
      myId = id;
      formations.show(true);
      mercPanel.show(true);
      formations.resend();
    },
    onLeave: () => {
      myId = -1;
      formations.show(false);
      mercPanel.show(false);
      formations.close();
      latest = null;
      levelOf.clear();
      lastLevel = 0;
      statusEl.textContent = "";
    },
  });
  let retries = 0;
  let idleKicked = false;
  let autoStarted = false;
  const connect = () => {
    ws = new WebSocket(serverUrl);
    ws.onopen = () => {
      retries = 0;
      const token = lobby.token();
      if (token) {
        statusEl.textContent = "이어서 접속하는 중...";
        send({ t: "rejoin", token });
        return;
      }
      statusEl.textContent = "";
      // ?name=이름 으로 열면 로비를 건너뛰고 바로 시작한다(테스트·링크 공유용). ?room=코드 를 같이 주면 그 방에 참가한다.
      const autoName = params.get("name");
      if (!autoStarted && autoName) {
        autoStarted = true;
        const room = params.get("room");
        send(room ? { t: "join", name: autoName, code: room } : { t: "quick", name: autoName });
      }
    };
    ws.onclose = () => {
      lobby.markDisconnected();
      if (idleKicked) {
        // 자리를 비워 서버가 끊었다: 자동으로 다시 접속하지 않는다(그래야 서버가 업데이트될 수 있다)
        lobby.clearToken();
        statusEl.textContent = "";
        lobby.showLobby("오래 아무 조작이 없어 연결이 끊겼습니다. 다시 하려면 페이지를 새로 고쳐 주세요");
        return;
      }
      if (lobby.token() && retries < 15) {
        retries++;
        statusEl.textContent = `연결이 끊겼습니다. 다시 접속하는 중... (${retries}/15)`;
        setTimeout(connect, 2000);
        return;
      }
      lobby.clearToken();
      statusEl.textContent = "";
      lobby.showLobby("서버와 연결이 끊겼습니다. 서버가 켜져 있는지 확인하고 페이지를 새로 고쳐 주세요");
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerMsg;
      if (msg.t === "tuning") {
        applyTuning(msg.values, true); // 서버에서 조정한 수치를 같이 쓴다(화면의 사거리·범위 표시 등)
        return;
      }
      if (msg.t === "terrain") {
        void setTerrain(msg.items);
        return;
      }
      if (msg.t === "left" && msg.reason.includes("아무 조작이 없어")) idleKicked = true;
      if (lobby.handle(msg)) return;
      if (msg.t === "notice") {
        toast.text = msg.text;
        toastLeft = 2.5;
      } else if (msg.t === "state") {
        latest = msg;
        const arrowSpots = (msg.ev ?? []).filter((q) => q[0] === EVT_ARROW_HIT || q[0] === EVT_ENEMY_ARROW_HIT);
        for (const [kind, x, y, ang, val, owner] of msg.ev ?? []) {
          // 서버가 알려 준 순간에 맞춰 소리를 낸다
          if (kind === EVT_ARROW_HIT) audio.play("arrow_hit", { x, y });
          else if (kind === EVT_ENEMY_ARROW_HIT) audio.play("arrow_hit", { x, y, vol: 0.7 });
          else if (kind === EVT_SHIELD_BLOCK) audio.play("shield_block", { x, y });
          else if (kind === EVT_SHIELD_BREAK) audio.play("shield_break", { x, y });
          else if (kind === EVT_CRIT) audio.play("crit_hit", { x, y });
          else if (kind === EVT_BACKSTAB) audio.play("backstab", { x, y });
          else if (kind === EVT_KNOCK) audio.play("knockback", { x, y });
          else if (kind === EVT_METEOR) {
            blasts.push({ x, y, r: val || 140, age: 0, boom: null, scorch: null });
          }
          else if (kind === EVT_REFLECT || kind === EVT_COUNTER) {
            // 가시 갑옷의 반사(주황)와 창병의 카운터(붉은 주황, 더 크게): 맞은 자리에 충격 고리와 금속음. 내 유닛과 관련되면 피해 숫자도 띄운다.
            const counter = kind === EVT_COUNTER;
            audio.play("shield_block", { x, y });
            const ring = new Graphics().circle(0, 0, 14).stroke({ width: counter ? 4 : 3, color: counter ? 0xff6a3a : 0xffa23a }).circle(0, 0, 7).fill({ color: 0xfff0b0, alpha: 0.7 });
            ring.position.set(x, y);
            bulletLayer.addChild(ring);
            hitFx.push({ node: ring, age: 0, grow: 2.2, life: 0.45 });
            if (owner === myId) spawnFloat(`${counter ? "카운터!" : "반사"} ${numFmt(val)}`, x, y - 16, { fill: counter ? 0xff7a3a : 0xffa23a, fontSize: counter ? 24 : 20, fontWeight: "900", stroke: { color: 0x3a1000, width: 5 } }, counter ? 1.4 : 1.2, 0.5);
          }
          else if (kind === EVT_DODGE) audio.play("dodge", { x, y });
          else if (kind === EVT_REVIVE) audio.play("revive_done", { x, y });
          else if ((kind === EVT_DMG_ENEMY || kind === EVT_DMG_ENEMY_CRIT) && !arrowSpots.some((q) => Math.abs(q[1] - x) < 14 && Math.abs(q[2] - y) < 14)) audio.play("melee_hit", { x, y }); // 화살이 아닌 근접 타격
          else if (kind === EVT_DMG_ALLY && owner === myId) audio.play("ally_hurt", { x, y });
          // 피해 숫자는 내 유닛(주인공·용병)이 관련된 것만 띄운다
          if (owner === myId && kind === EVT_DMG_ENEMY) spawnFloat(numFmt(val), x, y, { fill: 0xffffff, fontSize: 15, fontWeight: "600", stroke: { color: 0x000000, width: 3 } }, 0.8, 0);
          else if (owner === myId && kind === EVT_DMG_ENEMY_CRIT) spawnFloat(`${numFmt(val)}!`, x, y, { fill: 0xffd45d, fontSize: 25, fontWeight: "900", stroke: { color: 0x7a2e00, width: 5 } }, 1.1, 0.5);
          else if (owner === myId && kind === EVT_DMG_POISON) spawnFloat(numFmt(val), x, y, { fill: 0xc77dff, fontSize: 14, fontWeight: "700", stroke: { color: 0x2a0a40, width: 3 } }, 0.8, 0);
          else if (owner === myId && kind === EVT_DMG_POISON_ALLY) spawnFloat(`-${numFmt(val)}`, x, y, { fill: 0xc77dff, fontSize: 16, fontWeight: "700", stroke: { color: 0x2a0a40, width: 4 } }, 0.9, 0.15);
          else if (owner === myId && kind === EVT_DMG_SHIELD) spawnFloat(numFmt(val), x, y, { fill: 0x9fdcff, fontSize: 13, fontWeight: "600", stroke: { color: 0x0a1a2a, width: 3 } }, 0.6, 0);
          else if (owner === myId && kind === EVT_DMG_ALLY) spawnFloat(`-${numFmt(val)}`, x, y, { fill: 0xff5a5a, fontSize: 17, fontWeight: "700", stroke: { color: 0x2a0000, width: 4 } }, 0.9, 0.15);
          else if (owner === myId && kind === EVT_DODGE) spawnFloat("회피", x, y, { fill: 0xd8e0ee, fontSize: 14, fontStyle: "italic", stroke: { color: 0x000000, width: 3 } }, 0.8, 0);
          if (kind === EVT_ARROW_HIT || kind === EVT_ENEMY_ARROW_HIT) {
            const fx = new Sprite((kind === EVT_ENEMY_ARROW_HIT ? enemyArrow : allyArrow)[4]!);
            fx.anchor.set(0.85, 0.5);
            fx.scale.set(ARROW_SCALE);
            fx.position.set(x, y);
            fx.rotation = ang;
            bulletLayer.addChild(fx);
            hitFx.push({ node: fx, age: 0 });
          } else if (bursts.length < 60 && kind < EVT_DMG_ENEMY) {
            bursts.push({ kind, x, y, ang, age: 0 });
          }
        }
        statusEl.textContent = `방 ${lobby.roomCode()} · 접속 ${msg.players.length}명 · Esc: 방 메뉴`;
      }
    };
  };
  // 키·마우스·터치 입력이 있으면 가끔 서버에 알린다(로비·대기실에서 자리를 비웠는지 판단하는 데 쓴다)
  let lastActive = 0;
  const reportActive = () => {
    const now = performance.now();
    if (now - lastActive < 20000) return;
    lastActive = now;
    if (ws && ws.readyState === WebSocket.OPEN) send({ t: "active" });
  };
  for (const ev of ["keydown", "mousedown", "mousemove", "touchstart", "wheel"]) window.addEventListener(ev, reportActive, { passive: true });
  connect();

  // 입력: WASD/방향키 이동, 마우스 조준, 마우스 버튼(또는 스페이스) 누르고 있으면 발사, 캠프 근처에서 1~3 키로 고용
  const cycleWeapon = (dir: number) => {
    const cur = latest?.players.find((p) => p.id === myId)?.weapon;
    if (cur === undefined) return;
    send({ t: "weapon", index: (cur + dir + WEAPONS.length) % WEAPONS.length });
  };
  const keys = new Set<string>();
  let firing = false;
  let mouseX = app.screen.width / 2 + 1;
  let mouseY = app.screen.height / 2;
  let last = "";
  const readAim = () => Math.atan2(mouseY - app.screen.height / 2, mouseX - app.screen.width / 2);
  const pushInput = (force = false) => {
    const dx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    const dy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
    const fire = firing || keys.has(" ");
    const aim = Math.round(readAim() * 100) / 100;
    const revive = keys.has("e");
    const dist = Math.round(Math.hypot(mouseX - app.screen.width / 2, mouseY - app.screen.height / 2) / 8) * 8; // 마법사 지팡이가 운석을 떨어뜨릴 거리
    const key = `${dx},${dy},${aim},${fire},${revive},${dist}`;
    if (force || key !== last) {
      last = key;
      send({ t: "input", dx, dy, aim, fire, revive, dist });
    }
  };
  // 용병 진형 모드: 기본 진형(주인공 주변을 지킨다) / 돌격 진형(대열이 앞으로 나가 더 멀리 쫓는다). V 키로 바꾼다.
  const stanceBtns = [document.getElementById("stance0")!, document.getElementById("stance1")!, document.getElementById("stance2")!];
  const setStance = (v: number) => send({ t: "stance", v, types: typesField() });
  // 지점 방어: 버튼을 누르면 지점 지정 모드(다음 클릭한 곳을 지킨다), T 키는 마우스 위치를 바로 지킨다
  let pickingHold = false;
  const endPickHold = () => {
    pickingHold = false;
    app.canvas.style.cursor = "";
  };
  const holdAtMouse = () => {
    const me = latest?.players.find((p) => p.id === myId);
    if (me) send({ t: "hold", x: me.x + mouseX - app.screen.width / 2, y: me.y + mouseY - app.screen.height / 2, types: typesField() });
  };
  stanceBtns.forEach(
    (b, i) =>
      (b.onclick = () => {
        if (i !== 2) return setStance(i);
        pickingHold = true;
        app.canvas.style.cursor = "crosshair";
        toast.text = "지킬 지점을 클릭하세요 (Esc 취소)";
        toastLeft = 4;
      }),
  );
  let spectating = false; // 쓰러진 동안 동료를 따라가며 구경한다
  let specIndex = 0;
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (pickingHold) endPickHold();
      else if (formations.isOpen()) formations.close();
      else lobby.toggleRoomPanel();
      return;
    }
    if (lobby.blocksGameInput()) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "SELECT") return; // 이름·간격 입력 중에는 게임 키로 쓰지 않는다
    const k = e.key.toLowerCase();
    // F1 주인공 호위 · F2 위치 고수(지금 주인공이 서 있는 곳에 깃발을 꽂는다) · F3 돌격 · F4는 비워 둔다
    if (/^F[1-4]$/.test(e.key) && !e.repeat) {
      e.preventDefault();
      const me = latest?.players.find((p) => p.id === myId);
      if (e.key === "F1") setStance(0);
      else if (e.key === "F2") {
        if (me) send({ t: "hold", x: me.x, y: me.y, types: typesField() });
      } else if (e.key === "F3") setStance(1);
      return;
    }
    // 쓰러져 있을 때 스페이스: 관전 시작/끝, 관전 중 Tab(또는 ←/→): 다음 동료 보기
    if (!e.repeat && latest?.players.find((p) => p.id === myId)?.down) {
      if (e.key === " ") {
        spectating = !spectating;
        e.preventDefault();
      } else if (spectating && (e.key === "Tab" || e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        specIndex += e.key === "ArrowLeft" ? -1 : 1;
        e.preventDefault();
      }
    }
    if (k === "n" && !e.repeat) {
      showNames = !showNames;
      return;
    }
    if (k === "u" && !e.repeat) {
      mercPanel.toggle();
      return;
    }
    if (k === "g" && !e.repeat) {
      miniOn = !miniOn;
      try {
        localStorage.setItem("mercenary.minimap", miniOn ? "1" : "0");
      } catch {
        /* 저장소를 못 써도 켜고 끌 수는 있다 */
      }
      return;
    }
    if (k === "v" && !e.repeat) {
      const cur = selectedStance(latest?.players.find((p) => p.id === myId));
      setStance(cur === 0 ? 2 : cur === 2 ? 1 : 0); // 주인공 호위 → 위치 고수(마지막으로 정한 지점) → 돌격 → 주인공 호위
      return;
    }
    if (k === "t" && !e.repeat) {
      holdAtMouse(); // 마우스가 가리키는 지점을 지키게 한다
      return;
    }
    if (k === "r" && !e.repeat) {
      const mine = latest?.players.find((p) => p.id === myId);
      if (mine && mine.offer.length > 0 && mine.rerolls > 0) audio.play("card_reroll");
      send({ t: "reroll" });
      return;
    }
    if (k === "b" && !e.repeat) {
      formations.toggle();
      return;
    }
    if (formations.isOpen()) return; // 편성 화면에서는 게임 조작을 받지 않는다
    if (!e.repeat && k === "q") cycleWeapon(1);
    if (!e.repeat && (k === "z" || k === "x" || k === "c")) {
      const idx = "zxc".indexOf(k);
      const offered = latest?.players.find((p) => p.id === myId)?.offer[idx];
      if (offered !== undefined) audio.play(CARDS[offered]?.category === 3 ? "legend_card" : "card_pick");
      send({ t: "pick", index: idx });
    }
    if (k === "m" && !e.repeat) audio.toggleMute();
    // 숫자 키: 병종마다 고정 번호(2 기병·3 창병·4 궁병·5 검방병·6 둔기병·7 마법사). 캠프 곁에서는 그 병종을 고용하고, 아니면 그 병종을 선택한다. 1은 모든 병종.
    const dig = /^Digit([1-7])$/.exec(e.code);
    if (dig && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const d = Number(dig[1]);
      if (e.shiftKey) {
        if (nearCampId >= 0 && d >= 2) send({ t: "dismiss", type: d - 2 });
      } else {
        const slot = nearCampId >= 0 && d >= 2 ? nearCampOffers.findIndex((code) => decodeOffer(code).type === d - 2) : -1;
        if (slot >= 0) send({ t: "buy", camp: nearCampId, slot });
        else {
          selMask = d === 1 ? ALL_MASK : 1 << (d - 2);
          toast.text = `선택: ${d === 1 ? "모든 병종" : UNIT_NAMES[d - 2]} (우클릭 지시 · F1~F3 진형)`;
          toastLeft = 1.6;
        }
      }
    }
    keys.add(k);
    pushInput();
  });
  window.addEventListener("keyup", (e) => (keys.delete(e.key.toLowerCase()), pushInput()));
  window.addEventListener("blur", () => ((keys.clear(), (firing = false)), pushInput()));
  app.canvas.addEventListener("pointermove", (e) => ((mouseX = e.offsetX), (mouseY = e.offsetY), pushInput()));
  app.canvas.addEventListener("pointerdown", (e) => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;
    if (e.button === 2) {
      // 우클릭: 선택한 병종에게 이동(빈 땅) 또는 공격(적 근처, 넉넉하게) 지시
      const me = latest?.players.find((p) => p.id === myId);
      if (me && (selMask & 1) !== 0) audio.play("cavalry_charge");
      if (me) send({ t: "order", x: me.x + mouseX - app.screen.width / 2, y: me.y + mouseY - app.screen.height / 2, types: typesField() });
      return;
    }
    if (pickingHold) {
      holdAtMouse();
      endPickHold();
      return;
    }
    firing = true;
    pushInput();
  });
  window.addEventListener("pointerup", () => ((firing = false), pushInput()));
  app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  app.canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.deltaY !== 0) cycleWeapon(e.deltaY > 0 ? 1 : -1);
    },
    { passive: false },
  );
  setInterval(() => pushInput(true), 1000 / TICK_RATE);

  /** 공격 예고(부채꼴 또는 직선). 진행될수록 진해지고, 끝나는 순간 판정이 일어난다. */
  /** 창 찌르기 범위(앞으로 뻗은 직사각형. 폭 상수가 다르면 사다리꼴) */
  const drawSpearBox = (x: number, y: number, ang: number, reach: number, widthMult: number, color: number, alpha: number, cav = false) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const nearW = cav ? TUNE.CAV_HALF_WIDTH * widthMult : spearHalfWidth(0, reach, widthMult);
    const farW = cav ? nearW : spearHalfWidth(reach, reach, widthMult);
    fxLayer
      .poly([x - s * nearW, y + c * nearW, x + c * reach - s * farW, y + s * reach + c * farW, x + c * reach + s * farW, y + s * reach - c * farW, x + s * nearW, y - c * nearW])
      .fill({ color, alpha });
  };
  const drawTelegraph = (x: number, y: number, ang: number, reach: number, arc: number, ranged: boolean, prog: number, color: number, boxType = -1) => {
    if (boxType >= 0) {
      drawSpearBox(x, y, ang, reach, boxWidthMult(boxType, arc), color, 0.1 + 0.35 * prog, boxType === 0);
      return;
    }
    if (ranged) {
      fxLayer
        .moveTo(x, y)
        .lineTo(x + Math.cos(ang) * 110, y + Math.sin(ang) * 110)
        .stroke({ width: 2 + prog * 2, color, alpha: 0.25 + 0.45 * prog });
      return;
    }
    fxLayer
      .moveTo(x, y)
      .arc(x, y, reach, ang - arc, ang + arc)
      .closePath()
      .fill({ color, alpha: 0.1 + 0.35 * prog });
  };

  /** 토너먼트 화면(HTML): 위쪽 대진 배너, 오른쪽 대진표, 가운데 큰 안내 */
  const renderTournament = (gi: GameInfo | undefined, me: number) => {
    const tour = gi?.phase === "tournament" ? gi.tour : null;
    if (!tour) {
      tourBannerEl.style.display = tourBracketEl.style.display = tourBigEl.style.display = "none";
      return;
    }
    const fighter = me === tour.a || me === tour.b;
    const sa = teamSide(tour.a) ?? "red";
    const sb = teamSide(tour.b) ?? "blue";
    const tag = (side: "red" | "blue", id: number) => (id === me ? `${side === "blue" ? "파랑" : "빨강"} · 나` : side === "red" ? "빨강" : "파랑");
    const nm = (name: string, side: "red" | "blue", id: number) => `<span style="color:${TEAM_CSS[side]}">${esc(name)}</span> <small style="color:${TEAM_CSS[side]}">(${tag(side, id)})</small>`;
    tourBannerEl.style.display = tourBracketEl.style.display = "block";
    tourBannerEl.innerHTML =
      `<div class="tt">토너먼트 · ${esc(tour.title)}</div>` +
      `<div class="vs"><div class="side"><div class="nm">${nm(tour.an, sa, tour.a)}</div><div class="bar"><div style="width:${tour.ha}%;background:${TEAM_CSS[sa]}"></div></div></div>` +
      `<span>VS</span><div class="side"><div class="nm">${nm(tour.bn, sb, tour.b)}</div><div class="bar b"><div style="width:${tour.hb}%;background:${TEAM_CSS[sb]}"></div></div></div></div>` +
      `<div class="tm">${tour.step === "fight" ? `남은 시간 ${tour.t}초 · 주인공이 쓰러지면 패배` : tour.step === "outro" ? "경기 종료" : tour.step === "end" ? "토너먼트 종료" : fighter ? "선수 입장" : "관전 중"}</div>`;
    let html = "<h3>대진표</h3>";
    tour.rounds.forEach((r, ri) => {
      html += `<div class="rt">${esc(r.title)}</div>`;
      r.matches.forEach((m, mi) => {
        const now = tour.now[0] === ri && tour.now[1] === mi && tour.step !== "end";
        const cls = (side: 1 | 2) => (m.w === 0 ? "" : m.w === side ? "w" : "l");
        html += `<div class="mt${now ? " now" : ""}"><span class="${cls(1)}">${esc(m.a || "-")}</span><span class="${cls(2)}">${esc(m.b || (m.a ? "부전승" : "-"))}</span></div>`;
      });
    });
    tourBracketEl.innerHTML = html;
    let big = "";
    if (tour.step === "intro") {
      big = `<div class="a">${esc(tour.title)}</div><div class="b"><span style="color:${TEAM_CSS[sa]}">${esc(tour.an)}</span> vs <span style="color:${TEAM_CSS[sb]}">${esc(tour.bn)}</span></div><div class="c">${fighter ? "준비하세요! 당신은 파랑, 상대는 빨강입니다" : "관전 중입니다 · 빨강 대 파랑"} ${tour.t}</div>`;
    } else if (tour.step === "fight" && tour.t >= TUNE.TOURNAMENT_MATCH_SEC - 1.5) {
      big = `<div class="b">시작!</div>`;
    } else if (tour.step === "outro") {
      big = `<div class="a">${esc(tour.title)}</div><div class="b">승자: ${esc(tour.winner)}</div>`;
    } else if (tour.step === "end") {
      big = `<div class="a">토너먼트 우승</div><div class="b">${esc(tour.champion)}</div><div class="c">상금과 경험치를 받았습니다</div>`;
    }
    tourBigEl.innerHTML = big;
    tourBigEl.style.display = big ? "block" : "none";
  };

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const updateStats = (p: { hs?: number[]; weapon: number; luck: number }) => {
    const h = p.hs ?? [];
    if (h.length < 12) return;
    statsWeapon.text = `${WEAPONS[p.weapon]?.name ?? ""} 기준`;
    const items: [string, string][] = [
      ["공격력", String(h[0])],
      ["공격 속도", `${h[1]}/초`],
      ["사거리", String(h[2])],
      ["치명타", `${pct(h[3]!)} ×${h[4]}`],
      ["관통", String(h[5])],
      ["발사 수", String(h[12] ?? 1)],
      ["범위", `+${pct((h[6] ?? 1) - 1)}`],
      ["방어력", pct(h[8]!)],
      ["회피", pct(h[9]!)],
      ["재생", `${h[10]}/초`],
      ["이동 속도", String(h[11])],
      ["넉백", String(h[7])],
      ["행운", `+${pct(p.luck)}`],
      ["흡혈", pct(h[13] ?? 0)],
    ];
    items.forEach(([label, value], i) => {
      statLabels[i]!.text = label;
      statValues[i]!.text = value;
    });
  };
  const miniColor = (owner: number) => ownerColor(owner);
  const drawMinimap = (dt: number) => {
    const st = latest;
    mini.visible = miniOn && !!st;
    if (!st) return;
    const ox = 10;
    const oy = 30 + hudH + 8; // 왼쪽 위 상태 상자 바로 아래, 폭은 같게
    // 아래쪽 능력치 상자와 조작 막대를 뺀 남은 높이만큼(최대 폭과 같은 정사각형)
    const avail = app.screen.height - oy - 8 - STATS_H - 112;
    const S = Math.min(MINI_W, avail);
    mini.visible = miniOn && !!st && S >= 110;
    if (!mini.visible) return;
    const offX = (MINI_W - S) / 2;
    mini.position.set(ox, oy);
    const sx = (x: number) => offX + ((x + WORLD_SIZE / 2) / WORLD_SIZE) * S;
    const sy = (y: number) => ((y + WORLD_SIZE / 2) / WORLD_SIZE) * S;
    // 방금 쓰러진 아군을 찾아 깜빡임을 만든다(토너먼트에서는 쓰러지는 것이 정상이라 제외)
    const duel = st.g?.phase === "tournament";
    const seen = new Set<string>();
    for (const p of st.players) {
      const key = `p${p.id}`;
      seen.add(key);
      if (p.down && wasDown.get(key) === false && !duel) deathFlashes.push({ x: p.x, y: p.y, age: 0, hero: true });
      wasDown.set(key, p.down);
    }
    for (const w of st.mercs) {
      const key = `m${w[0]}`;
      seen.add(key);
      const down = w[8] > 0;
      if (down && wasDown.get(key) === false && !duel) deathFlashes.push({ x: w[1], y: w[2], age: 0, hero: false });
      wasDown.set(key, down);
    }
    for (const k of [...wasDown.keys()]) if (!seen.has(k)) wasDown.delete(k);
    for (let i = deathFlashes.length - 1; i >= 0; i--) {
      deathFlashes[i]!.age += dt;
      if (deathFlashes[i]!.age > MINI_FLASH_SEC) deathFlashes.splice(i, 1);
    }

    const g = miniG;
    g.clear();
    g.roundRect(0, 0, MINI_W, S, 12).fill({ color: 0x0b0d12, alpha: 0.78 }).stroke({ width: 2, color: 0x59627a });
    g.rect(offX, 1, S, S - 2).stroke({ width: 1, color: 0xffffff, alpha: 0.1 });
    // 격자(위치 감각용)
    for (let i = 1; i < 4; i++) {
      g.moveTo(offX + (S * i) / 4, 2).lineTo(offX + (S * i) / 4, S - 2).stroke({ width: 1, color: 0xffffff, alpha: 0.06 });
      g.moveTo(offX + 2, (S * i) / 4).lineTo(offX + S - 2, (S * i) / 4).stroke({ width: 1, color: 0xffffff, alpha: 0.06 });
    }
    if (duel) g.circle(sx(0), sy(0), (TOURNAMENT_ARENA_RADIUS / WORLD_SIZE) * S).stroke({ width: 1.5, color: 0xe0c05d, alpha: 0.8 });
    // 지형: 고지대는 갈색 타원, 바위·폐허는 회색 점
    if (terrain) {
      for (const p of terrain.plateaus) if (terrain.liveObj(p.obj)) for (const t of p.tops) g.ellipse(sx(t.x), sy(t.y), Math.max(1.5, (t.rx / WORLD_SIZE) * S), Math.max(1, (t.ry / WORLD_SIZE) * S)).fill({ color: 0x8a6b3a, alpha: 0.55 });
      for (const c of terrain.solids) if (terrain.liveObj(c.obj)) g.circle(sx(c.x), sy(c.y), Math.max(0.8, (c.r / WORLD_SIZE) * S)).fill({ color: c.arrow ? 0x9aa0a8 : 0x3f6b38, alpha: 0.8 });
    }
    // 지점 방어 깃발
    for (const hp of st.players) {
      for (const [px, py] of holdPoints(hp)) {
      const hx = sx(px);
      const hy = sy(py);
      g.moveTo(hx, hy + 3).lineTo(hx, hy - 6).stroke({ width: 1.2, color: 0xffffff }).poly([hx, hy - 6, hx + 6, hy - 4, hx, hy - 2]).fill(miniColor(hp.id));
      }
    }
    // 캠프와 상자
    for (const c of st.camps) g.rect(sx(c[1]) - 3, sy(c[2]) - 3, 6, 6).fill(0xe0c05d);
    for (const c of st.chests ?? []) {
      const mine = c[3] === myId;
      g.rect(sx(c[1]) - 3, sy(c[2]) - 2.5, 6, 5).fill(mine ? 0xffd45d : 0x7a6a4a).stroke({ width: 1, color: 0x1a1208 });
    }
    // 적(작은 붉은 점, 보스는 크게)
    for (const w of st.enemies) {
      if (w[11] === 1) g.circle(sx(w[1]), sy(w[2]), 4.2).fill(0xff8a2a).stroke({ width: 1, color: 0xffffff });
      else g.rect(sx(w[1]) - 0.9, sy(w[2]) - 0.9, 1.8, 1.8).fill({ color: 0xe0504a, alpha: 0.9 });
    }
    // 아군 용병: 주인 색 점. 쓰러진 용병은 X
    for (const w of st.mercs) {
      const color = miniColor(w[5]);
      const x = sx(w[1]);
      const y = sy(w[2]);
      const mine = w[5] === myId;
      if (w[8] > 0) {
        const r = mine ? 3.8 : 3;
        g.moveTo(x - r, y - r).lineTo(x + r, y + r).moveTo(x + r, y - r).lineTo(x - r, y + r).stroke({ width: 1.6, color: 0xff6a5a });
      } else g.circle(x, y, mine ? 2.8 : 2.2).fill(color);
    }
    // 방금 쓰러진 곳
    for (const f of deathFlashes) {
      const k = f.age / MINI_FLASH_SEC;
      g.circle(sx(f.x), sy(f.y), 3 + 11 * ((f.age * 1.6) % 1) + (f.hero ? 2 : 0)).stroke({ width: 1.5, color: 0xff4a3a, alpha: 0.9 * (1 - k) });
    }
    // 시야(카메라가 보는 범위)
    const me = st.players.find((p) => p.id === myId);
    if (me) {
      const vw = (app.screen.width / WORLD_SIZE) * S;
      const vh = (app.screen.height / WORLD_SIZE) * S;
      g.rect(sx(me.x) - vw / 2, sy(me.y) - vh / 2, vw, vh).stroke({ width: 1, color: 0xffffff, alpha: 0.4 });
    }
    // 주인공들: 큰 점(나는 흰 테두리 삼각형). 쓰러진 주인공은 큰 X와 이름, 부활 진행률
    let nameIdx = 0;
    for (const p of st.players) {
      const color = miniColor(p.id);
      const x = sx(p.x);
      const y = sy(p.y);
      if (p.down) {
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 180);
        g.circle(x, y, 7).stroke({ width: 1.5, color: 0xff4a3a, alpha: pulse });
        g.moveTo(x - 4.5, y - 4.5).lineTo(x + 4.5, y + 4.5).moveTo(x + 4.5, y - 4.5).lineTo(x - 4.5, y + 4.5).stroke({ width: 2.4, color: 0xff6a5a });
        if (p.revive > 0) g.arc(x, y, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.revive).stroke({ width: 2, color: 0x7be08f });
        const t = miniNames[nameIdx++];
        if (t) {
          t.visible = true;
          t.text = p.name;
          t.position.set(Math.max(offX + 24, Math.min(offX + S - 24, x)), Math.max(14, y - 8));
        }
      } else if (p.id === myId) {
        const a = p.aim;
        g.poly([x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a + 2.5) * 4.5, y + Math.sin(a + 2.5) * 4.5, x + Math.cos(a - 2.5) * 4.5, y + Math.sin(a - 2.5) * 4.5])
          .fill(color)
          .stroke({ width: 1.5, color: 0xffffff });
      } else {
        g.circle(x, y, 3.6).fill(color).stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
      }
    }
    for (let i = nameIdx; i < miniNames.length; i++) miniNames[i]!.visible = false;
  };

  app.ticker.add((ticker) => {
    // 배경 음악: 로비/대기실, 성장 단계, 보스 단계(끝난 뒤에는 멈춘다)
    audio.music(!latest ? "bgm_lobby" : latest.g && latest.g.status !== "playing" ? null : latest.g?.phase === "boss" || latest.g?.phase === "tournament" ? "bgm_boss" : "bgm_grow");
    if (!latest) return;
    const k = 1 - Math.exp(-ticker.deltaMS / SMOOTH_MS);

    enemies.update(latest.enemies, k, (v, w) => {
      const size = w[11] === 1 ? BOSS_SIZE : 1;
      if (w[4] === 0) {
        cavDir(v, v.x, v.y, w[5] > 0 ? w[6] : null);
        cavGait(v, ticker.deltaMS, w[5] > 0, CAV_SCALE * size);
        v.sprite.texture = enemyCav[w[5] > 0 ? 1 : 0]![v.dir]!;
        v.sprite.scale.set(CAV_SCALE * size);
        v.lastX = v.x;
        v.lastY = v.y;
      } else {
        faceFrom(v, v.x, w[5] > 0 ? w[6] : null);
        v.sprite.scale.set(SPRITE_SCALE * size * v.face, SPRITE_SCALE * size);
      }
      v.sprite.zIndex = v.y;
      v.sprite.alpha = 0.7 + 0.3 * Math.min(1, w[3] / 100);
    });
    bullets.update(latest.bullets, k, (v, w) => {
      // 이동한 방향으로 화살을 돌린다
      const dx = w[1] - v.x0;
      const dy = w[2] - v.y0;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) {
        v.angle = Math.atan2(dy, dx);
        v.node.rotation = v.angle;
        v.node.visible = true;
        v.ready = true;
      }
      v.x0 = w[1];
      v.y0 = w[2];
    });
    if (shotWindowStart !== 0 && performance.now() - shotWindowStart >= 120) {
      const n = shotBuf.length + 1; // 첫 발 포함
      if (shotBuf.length > 0) {
        const hostileShare = shotBuf.filter((q) => q.hostile).length / shotBuf.length;
        if (n >= 4) {
          audio.play("arrow_volley", { x: shotBuf.reduce((a, q) => a + q.x, 0) / shotBuf.length, y: shotBuf.reduce((a, q) => a + q.y, 0) / shotBuf.length, vol: hostileShare > 0.5 ? 0.7 : 1 });
        } else {
          for (const q of shotBuf) audio.play("bow_shot", { x: q.x, y: q.y, vol: q.hostile ? 0.6 : 1 });
        }
      }
      shotBuf.length = 0;
      shotWindowStart = 0;
    }
    // 피해 숫자: 위로 떠오르며 사라진다(치명타는 처음에 크게 튀어 오른다)
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]!;
      f.age += ticker.deltaMS / 1000;
      if (f.age >= f.life) {
        f.node.destroy();
        floats.splice(i, 1);
        continue;
      }
      const t = f.age / f.life;
      f.x += f.vx * (ticker.deltaMS / 1000);
      f.node.position.set(f.x, f.y - 46 * t);
      f.node.alpha = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
      f.node.scale.set(1 + f.pop * Math.max(0, 1 - t * 4));
    }
    // 명중 이펙트: 잠깐 보였다가 사라진다
    for (let i = hitFx.length - 1; i >= 0; i--) {
      const fx = hitFx[i]!;
      fx.age += ticker.deltaMS / 1000;
      const life = fx.life ?? HIT_FX_SEC;
      fx.node.alpha = Math.max(0, 1 - fx.age / life);
      if (fx.grow) fx.node.scale.set(1 + (fx.grow - 1) * Math.min(1, fx.age / life));
      if (fx.age >= life) {
        fx.node.destroy();
        hitFx.splice(i, 1);
      }
    }
    mercs.update(latest.mercs, k, (v, w) => {
      v.node.visible = w[8] <= 0; // 쓰러진 용병은 부활할 때까지 숨긴다
      paintRing(v, ownerColor(w[5]), teamSide(w[5]) !== null);
      if (v.wasDown && w[8] <= 0 && w[5] === myId) audio.play("merc_respawn", { x: v.x, y: v.y });
      v.wasDown = w[8] > 0;
      const grow = 1 + 0.05 * w[15]; // 강화할수록 조금 커진다
      const col = ownerColor(w[5]);
      if (w[4] === 0) {
        cavDir(v, v.x, v.y, w[6] > 0 ? w[7] : null);
        cavGait(v, ticker.deltaMS, w[6] > 0, CAV_SCALE * grow);
        v.sprite.texture = cavTex(`a${col}`, w[6] > 0 ? 1 : 0, v.dir, col);
        v.sprite.scale.set(CAV_SCALE * grow);
        v.lastX = v.x;
        v.lastY = v.y;
      } else {
        faceFrom(v, v.x, w[6] > 0 ? w[7] : null);
        v.sprite.texture = recolored(`u${w[4]}`, allyTex[w[4]]!, UNIT_RULES[w[4]]!, col);
        v.sprite.scale.set(SPRITE_SCALE * grow * v.face, SPRITE_SCALE * grow);
      }
      v.node.zIndex = v.y;
      v.label.visible = showNames || mercPanel.hovered() === w[0];
      const key = `${w[3]}/${w[9]}/${w[10]}/${w[11]}/${w[15]}/${isReady(w) ? 1 : 0}`;
      if (v.lastKey !== key) {
        v.lastKey = key;
        const top = -allyTex[w[4]]!.height * SPRITE_SCALE * SPRITE_ANCHOR_Y - 6;
        drawBar(v.bar, w[3], w[9], 26, top);
        if (isReady(w)) v.bar.poly([0, top - 20, -5, top - 13, 5, top - 13]).fill(0xffd45d).stroke({ width: 1, color: 0x000000 }); // 강화 가능 표시
        for (let i = 0; i < w[15]; i++) v.bar.circle(-10 + i * 6, top - (w[11] > 0 ? 12 : 7), 2.2).fill(0xffd45d); // 강화 단계 점
        if (w[11] > 0) {
          // 방패 체력: 몸 체력 막대 위에 파란색으로. 깨졌으면 비어 보인다.
          v.bar
            .rect(-13, top - 5, 26, 3)
            .fill(0x2a2d36)
            .rect(-13, top - 5, (26 * Math.max(0, w[10])) / w[11], 3)
            .fill(0x6fb8ff);
        }
      }
    });
    players.update(latest.players, k, (v, p) => {
      const dead = p.down;
      paintRing(v, ownerColor(p.id), teamSide(p.id) !== null);
      const side = teamSide(p.id);
      v.label.style.fill = side === "red" ? TEAM_RED : side === "blue" ? 0x8fc3ff : 0xffffff; // 토너먼트 선수는 이름도 팀 색
      // 근접 무기를 휘두르는 순간과 쓰러지는 순간의 소리(위치는 그 주인공 자리)
      if (p.swing > 0 && v.lastSwing <= 0 && !WEAPONS[p.weapon]!.ranged) audio.play((["", "spear_thrust", "sword_swing", "mace_smash"] as const)[p.weapon] || "sword_swing", { x: v.x, y: v.y });
      v.lastSwing = p.swing;
      if (dead && !v.wasDown && p.id !== myId) audio.play("hero_down", { x: v.x, y: v.y });
      v.wasDown = dead;
      // 쓰러지면 흐리게, 부활 직후 무적일 때는 깜빡인다
      v.node.alpha = dead ? 0.4 : p.invuln > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 90)) : 1;
      // 들고 있는 무기에 맞는 모습으로 바꾸고, 조준한 쪽을 바라보게 좌우 반전한다
      const tex = heroTex[p.weapon] ?? heroTex[0]!;
      if (v.sprite.texture !== tex) v.sprite.texture = tex;
      v.sprite.scale.set(HERO_SCALE * (Math.cos(p.aim) >= 0 ? 1 : -1), HERO_SCALE);
      drawBar(v.bar, p.hp, p.maxHp, 36, HERO_TOP - 6);
      if (dead) {
        // 부활 진행도
        v.bar
          .rect(-22, HERO_TOP - 14, 44, 6)
          .fill(0x2a2d36)
          .rect(-22, HERO_TOP - 14, 44 * p.revive, 6)
          .fill(0x7be08f);
      }
      v.aimMark.clear();
      if (!dead) {
        // 조준 방향 표시: 몸 바깥의 작은 화살촉(무기 색)
        const ca = Math.cos(p.aim);
        const sa = Math.sin(p.aim);
        const tip = 50;
        const base = 40;
        v.aimMark
          .poly([ca * tip, sa * tip, ca * base - sa * 6, sa * base + ca * 6, ca * base + sa * 6, sa * base - ca * 6])
          .fill({ color: TYPE_COLORS[WEAPONS[p.weapon]!.type]!, alpha: 0.95 })
          .stroke({ width: 1.5, color: 0x000000, alpha: 0.7 });
      }
      // 레벨업을 감지해 밀어내기 고리를 띄운다(처음 접속 시에는 제외)
      const seenLevel = levelOf.get(p.id);
      if (seenLevel !== undefined && p.level > seenLevel) rings.push({ x: v.x, y: v.y, age: 0 });
      levelOf.set(p.id, p.level);
    });
    camps.update(latest.camps, k, (v, w) => {
      v.label.text = `캠프 ${Math.ceil(w[3])}초`;
    });

    // 공격 예고
    fxLayer.clear();
    // 토너먼트 경기장
    if (latest.g?.phase === "tournament") {
      fxLayer
        .circle(0, 0, TOURNAMENT_ARENA_RADIUS)
        .fill({ color: 0xe0c05d, alpha: 0.05 })
        .circle(0, 0, TOURNAMENT_ARENA_RADIUS)
        .stroke({ width: 6, color: 0xe0c05d, alpha: 0.75 })
        .circle(0, 0, TOURNAMENT_ARENA_RADIUS - 10)
        .stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
    }
    // 보스 보상 상자: 주인이 다가가면 열린다. 내 상자는 반짝이고 반경이 보인다.
    for (const c of latest.chests ?? []) {
      const mine = c[3] === myId;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      if (mine) {
        fxLayer.circle(c[1], c[2], CHEST_OPEN_RADIUS).stroke({ width: 2, color: 0xffd45d, alpha: 0.25 + 0.35 * pulse });
        fxLayer.circle(c[1], c[2], 34).fill({ color: 0xffd45d, alpha: 0.12 + 0.12 * pulse });
      }
      const body = mine ? 0x9a6a2b : 0x4a3a28;
      const band = mine ? 0xffd45d : 0x7a6a4a;
      fxLayer
        .roundRect(c[1] - 17, c[2] - 12, 34, 24, 4)
        .fill(body)
        .stroke({ width: 2, color: 0x1a1208 })
        .rect(c[1] - 17, c[2] - 4, 34, 6)
        .fill(band)
        .rect(c[1] - 3, c[2] - 6, 6, 10)
        .fill(mine ? 0xfff0b0 : 0xb8a888);
    }
    for (const w of latest.enemies) {
      if (w[5] <= 0) continue;
      const v = enemies.views.get(w[0]);
      const st = ENEMY_STATS[w[4]]!;
      if (v && w[4] !== MAGE_TYPE) drawTelegraph(v.x, v.y, w[6], st.reach, st.arc, st.ranged, w[5], 0xff3b3b, w[4] === 0 ? 0 : -1); // 적 마법사의 예고는 낙하 지점 표시가 대신한다
    }
    for (const w of latest.mercs) {
      if (w[5] === undefined || w[6] <= 0) continue;
      const v = mercs.views.get(w[0]);
      const st = MERC_STATS[w[4]]!;
      if (v && w[4] !== MAGE_TYPE) drawTelegraph(v.x, v.y, w[7], st.reach, st.arc, st.ranged, w[6], ownerColor(w[5]), usesBox(w[4]) ? w[4] : -1); // 마법사의 예고는 낙하 지점 표시가 대신한다
    }

    // 방패(검방병): 정면을 막는 호. 깨지면 회색으로 비고, 재생되면 다시 파랗게 돌아온다.
    const shieldArc = (x: number, y: number, face: number, ratio: number, regen: number, radius: number, color: number) => {
      if (ratio <= 0 && regen <= 0) return;
      const a0 = face - SHIELD_FRONT_ARC;
      fxLayer
        .moveTo(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius)
        .arc(x, y, radius, a0, face + SHIELD_FRONT_ARC)
        .stroke(ratio > 0 ? { width: 3 + 3 * ratio, color, alpha: 0.45 + 0.4 * ratio } : { width: 2, color: 0x7a8294, alpha: 0.45 });
    };
    for (const w of latest.enemies) {
      if (w[4] !== SHIELD) continue;
      const v = enemies.views.get(w[0]);
      if (v) shieldArc(v.x, v.y, w[8], w[7] / 100, w[10], (ENEMY_STATS[SHIELD]!.radius + 12) * (w[11] === 1 ? BOSS_SIZE : 1), 0xffa89a);
    }
    for (const w of latest.mercs) {
      if (w[4] !== SHIELD || w[8] > 0) continue;
      const v = mercs.views.get(w[0]);
      if (v) shieldArc(v.x, v.y, w[12], w[11] > 0 ? w[10] / w[11] : 0, w[14], MERC_STATS[SHIELD]!.radius + 12, 0x8fd0ff);
    }
    // 공포에 질려 도망치는 용병: 머리 위에 느낌표
    const scared = new Set(latest.players.filter((q) => q.shaken > 0).map((q) => q.id));
    if (scared.size > 0) {
      for (const w of latest.mercs) {
        if (w[8] > 0 || !scared.has(w[5])) continue;
        const v = mercs.views.get(w[0]);
        if (!v) continue;
        const ty = v.y - allyTex[w[4]]!.height * SPRITE_SCALE * SPRITE_ANCHOR_Y - 22;
        fxLayer
          .roundRect(v.x - 3, ty, 6, 11, 2)
          .fill(0xffd45d)
          .stroke({ width: 1.2, color: 0x6a1a00 })
          .circle(v.x, ty + 16, 3)
          .fill(0xffd45d)
          .stroke({ width: 1.2, color: 0x6a1a00 });
      }
    }
    // 장군: 발밑에 금빛 고리
    for (const w of latest.enemies) {
      if (w[11] !== 1) continue;
      const v = enemies.views.get(w[0]);
      if (v) fxLayer.ellipse(v.x, v.y + 22, 34, 15).stroke({ width: 3, color: 0xffd45d, alpha: 0.85 });
    }
    // 서버가 알려 준 순간 효과(명중·방패·부활)
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]!;
      b.age += ticker.deltaMS / 1000;
      const t = b.age / BURST_SEC;
      if (t >= 1) {
        bursts.splice(i, 1);
        continue;
      }
      if (b.kind === EVT_SHIELD_BLOCK) {
        const r = 22 + 8 * t;
        fxLayer
          .moveTo(b.x + Math.cos(b.ang - 0.7) * r, b.y + Math.sin(b.ang - 0.7) * r)
          .arc(b.x, b.y, r, b.ang - 0.7, b.ang + 0.7)
          .stroke({ width: 4 * (1 - t) + 1, color: 0xbfe6ff, alpha: 0.9 * (1 - t) });
      } else if (b.kind === EVT_SHIELD_BREAK) {
        fxLayer.circle(b.x, b.y, 14 + 34 * t).stroke({ width: 5 * (1 - t) + 1, color: 0x8fd0ff, alpha: 0.9 * (1 - t) });
      } else if (b.kind === EVT_BACKSTAB) {
        // 등 뒤에서 베는 주황 사선
        const dx = Math.cos(b.ang);
        const dy = Math.sin(b.ang);
        fxLayer
          .moveTo(b.x - dx * 4 - dy * 16, b.y - dy * 4 + dx * 16)
          .lineTo(b.x + dx * 4 + dy * 16, b.y + dy * 4 - dx * 16)
          .stroke({ width: 4 * (1 - t) + 1, color: 0xff8a3b, alpha: 0.95 * (1 - t) });
      } else if (b.kind === EVT_DODGE) {
        fxLayer.circle(b.x, b.y, 10 + 22 * t).stroke({ width: 2, color: 0xffffff, alpha: 0.8 * (1 - t) });
      } else if (b.kind === EVT_CRIT) {
        fxLayer.star(b.x, b.y - 10 * t, 5, 12 + 10 * t, 5).fill({ color: 0xffd45d, alpha: 0.95 * (1 - t) }).stroke({ width: 1.5, color: 0xff8a3b, alpha: 1 - t });
      } else if (b.kind === EVT_REVIVE) {
        fxLayer.circle(b.x, b.y, 10 + 60 * t).stroke({ width: 6 * (1 - t) + 1, color: 0x7be08f, alpha: 0.9 * (1 - t) });
      }
    }

    // 기병이 속도를 낼수록 뒤에 속도선이 길어진다
    const streak = (x: number, y: number, face: number, mom: number) => {
      if (mom < 0.4) return;
      for (const dy of [-8, 0, 8]) {
        fxLayer
          .moveTo(x - face * 16, y + dy)
          .lineTo(x - face * (16 + 34 * mom), y + dy)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.12 + 0.3 * mom });
      }
    };
    for (const w of latest.enemies) {
      if (w[4] !== 0) continue;
      const v = enemies.views.get(w[0]);
      if (v) streak(v.x, v.y, v.face, w[9]);
    }
    for (const w of latest.mercs) {
      if (w[4] !== 0 || w[8] > 0) continue;
      const v = mercs.views.get(w[0]);
      if (v) streak(v.x, v.y, v.face, w[13]);
    }

    // 병종 선택 표시: 범례를 노랗게, 일부만 선택했을 때는 그 병종 용병 발밑에 고리를 그린다
    for (const it of legendLabels) it.label.style.fill = it.mask === selMask ? 0xffe08a : 0xcfd3dc;
    if (selMask !== ALL_MASK) {
      for (const w of latest.mercs) {
        if (w[5] !== myId || w[8] > 0 || !(selMask & (1 << w[4]))) continue;
        fxLayer.circle(w[1], w[2], 20).stroke({ width: 2, color: 0xffe08a, alpha: 0.75 });
      }
    }
    // 지점 방어: 지키는 지점에 깃발과 구역을 표시한다
    for (const hp of latest.players) {
      for (const [hpx, hpy] of holdPoints(hp)) {
      const hc = ownerColor(hp.id);
      const own = hp.id === myId;
      fxLayer
        .circle(hpx, hpy, 130)
        .fill({ color: hc, alpha: own ? 0.06 : 0.03 })
        .stroke({ width: own ? 2 : 1, color: hc, alpha: own ? 0.55 : 0.3 })
        .moveTo(hpx, hpy + 8)
        .lineTo(hpx, hpy - 36)
        .stroke({ width: 3, color: 0xe8e8e8, alpha: own ? 0.95 : 0.6 })
        .poly([hpx, hpy - 36, hpx + 24, hpy - 28, hpx, hpy - 20])
        .fill({ color: hc, alpha: own ? 0.95 : 0.6 });
      }
    }

    // 마법사 운석: 낙하 지점 예고(진해지는 원과 줄어드는 고리), 마지막에 하늘에서 떨어지는 운석, 폭발과 그을음
    const now = performance.now();
    const liveKeys = new Set<number>();
    for (const [key, mx, my, prog, radius, owner, total] of latest.meteors ?? []) {
      const fallFrom = Math.max(0.3, Math.min(0.95, 1 - 0.6 / Math.max(0.6, (total ?? 30) / 10))); // 폭발 약 0.6초 전부터 낙하(소리의 충돌 시점과 맞춘다)
      const p = prog / 100;
      const pulse = 0.5 + 0.5 * Math.sin(now / 130);
      const mine = owner === myId;
      const hostile = owner === 0; // 적 마법사의 운석: 아군이 맞는다. 피하라고 붉고 진하게 표시한다
      // 낙하 예고: 원 안의 음영이 시계처럼(위에서 시계 방향) 차올라, 한 바퀴를 다 돌면 운석이 떨어진다
      const a0 = -Math.PI / 2;
      const a1 = a0 + Math.PI * 2 * p;
      fxLayer
        .circle(mx, my, radius)
        .fill({ color: hostile ? 0xff1a1a : 0xff9a2a, alpha: hostile ? 0.1 : 0.06 })
        .stroke({ width: (hostile ? 3 : 2) + 2 * p, color: hostile ? 0xff3030 : mine ? 0xffc04a : 0xff8a3a, alpha: 0.4 + 0.3 * p + 0.15 * pulse });
      if (p > 0.005) {
        fxLayer
          .moveTo(mx, my)
          .arc(mx, my, radius, a0, a1)
          .closePath()
          .fill({ color: hostile ? 0xd01010 : 0xff8a1a, alpha: (hostile ? 0.36 : 0.26) + 0.1 * pulse * p })
          .moveTo(mx, my)
          .lineTo(mx + Math.cos(a1) * radius, my + Math.sin(a1) * radius)
          .stroke({ width: 3, color: 0xffe0a0, alpha: 0.8 });
      }
      if (p >= fallFrom) {
        liveKeys.add(key);
        let sp = falling.get(key);
        if (!sp) {
          sp = new Sprite(meteorTex[0]!);
          audio.play("meteor_fall", { x: mx, y: my }); // 떨어지기 시작할 때 한 덩어리(낙하음 → 폭발음)로 낸다
          sp.anchor.set(0.2, 0.8);
          skyLayer.addChild(sp);
          falling.set(key, sp);
        }
        const t = Math.min(1, (p - fallFrom) / (1 - fallFrom));
        const dist = 680 * (1 - t) ** 1.5;
        sp.texture = meteorTex[Math.min(5, Math.floor(t * 6))]!;
        sp.scale.set(radius / 130);
        sp.position.set(mx + METEOR_DIR.x * dist, my + METEOR_DIR.y * dist);
      }
    }
    for (const [key, sp] of falling) {
      if (liveKeys.has(key)) continue;
      sp.destroy();
      falling.delete(key);
    }
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i]!;
      b.age += ticker.deltaMS / 1000;
      if (b.age >= SCORCH_SEC) {
        b.boom?.destroy();
        b.scorch?.destroy();
        blasts.splice(i, 1);
        continue;
      }
      if (!b.scorch) {
        b.scorch = new Sprite(scorchTex[0]!);
        b.scorch.anchor.set(0.5, 0.5);
        b.scorch.position.set(b.x, b.y);
        b.scorch.scale.set(b.r / 62);
        groundFx.addChild(b.scorch);
      }
      if (!b.boom) {
        b.boom = new Sprite(boomTex[0]!);
        b.boom.anchor.set(0.5, 0.82);
        b.boom.position.set(b.x, b.y);
        b.boom.scale.set(b.r / 70);
        skyLayer.addChild(b.boom);
      }
      const st = b.age / SCORCH_SEC;
      b.scorch.texture = scorchTex[Math.min(4, Math.floor(st * 5))]!;
      b.scorch.alpha = st < 0.7 ? 0.95 : 0.95 * (1 - (st - 0.7) / 0.3);
      if (b.age < BOOM_SEC) {
        const bt = b.age / BOOM_SEC;
        b.boom.visible = true;
        b.boom.texture = boomTex[Math.min(4, Math.floor(bt * 5))]!;
        b.boom.alpha = bt < 0.8 ? 1 : 1 - (bt - 0.8) / 0.2;
      } else b.boom.visible = false;
    }

    // 근접 무기 휘두르기 이펙트와 레벨업 밀어내기 고리
    for (const p of latest.players) {
      const w = WEAPONS[p.weapon]!;
      const v = players.views.get(p.id);
      const reachNow = p.hs?.[2] || w.reach; // 사거리·범위 카드가 반영된 값(철퇴는 범위가 사거리로 간다)
      const arcNow = meleeArc(w.type, w.arc, p.hs?.[6] || 1);
      if (v && p.wind > 0 && !w.ranged && w.type !== MAGE_TYPE) {
        // 철퇴 준비 동작: 범위가 점점 진하게 차오른다(맞기 직전까지 피하라는 신호가 아니라 휘두르는 타이밍 표시)
        const prog = Math.max(0, Math.min(1, 1 - p.wind / w.windup));
        fxLayer
          .moveTo(v.x, v.y)
          .arc(v.x, v.y, reachNow * (0.4 + 0.6 * prog), p.aim - arcNow, p.aim + arcNow)
          .closePath()
          .fill({ color: 0xffc27a, alpha: 0.12 + 0.3 * prog });
      }
      if (!v || p.swing <= 0 || w.ranged || w.type === MAGE_TYPE) continue;
      if (w.type === SPEAR_TYPE) {
        drawSpearBox(v.x, v.y, p.aim, reachNow, p.hs?.[6] || 1, TYPE_COLORS[w.type]!, 0.55 * Math.min(1, p.swing / SWING_VISUAL_SEC));
        continue;
      }
      fxLayer
        .moveTo(v.x, v.y)
        .arc(v.x, v.y, reachNow, p.aim - arcNow, p.aim + arcNow)
        .closePath()
        .fill({ color: TYPE_COLORS[w.type]!, alpha: 0.55 * Math.min(1, p.swing / SWING_VISUAL_SEC) });
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]!;
      r.age += ticker.deltaMS / 1000;
      if (r.age >= RING_SEC) {
        rings.splice(i, 1);
        continue;
      }
      const k2 = r.age / RING_SEC;
      fxLayer.circle(r.x, r.y, LEVELUP_PUSH_RADIUS * (0.25 + 0.75 * k2)).stroke({ width: 5 * (1 - k2) + 1, color: 0xffe08a, alpha: 0.8 * (1 - k2) });
    }

    // 지형: 유닛이 바위·나무 뒤에 서 있으면 그것을 유닛 위에 그린다
    if (terrain) {
      terrain.setDuel(latest.g?.phase === "tournament");
      const cx = -world.x + app.screen.width / 2;
      const cy = -world.y + app.screen.height / 2;
      for (const tv of tviews) {
        const vis = Math.abs(tv.x - cx) < app.screen.width / 2 + tv.halfW + 80 && Math.abs(tv.footY - cy) < app.screen.height / 2 + 400 && terrain.liveObj(tv.obj);
        tv.sp.visible = vis;
        if (!vis || !tv.solid) continue;
        let behind = false;
        const check = (v: { x: number; y: number }) => {
          if (!behind && Math.abs(v.x - tv.x) < tv.halfW && v.y < tv.footY && v.y > tv.top) behind = true;
        };
        for (const v of players.views.values()) check(v);
        if (!behind) for (const v of mercs.views.values()) check(v);
        if (!behind) for (const v of enemies.views.values()) check(v);
        if (behind !== tv.high) {
          tv.high = behind;
          (behind ? terrainHigh : terrainLow).addChild(tv.sp);
        }
      }
    }
    // 카메라와 HUD
    const me = players.views.get(myId);
    const meState = latest.players.find((p) => p.id === myId);
    if (meState) audio.setListener(meState.x, meState.y);
    const charging = !!meState && meState.chargeLeft > 0;
    chargeMark.visible = chargeLabel.visible = charging;
    if (charging && meState) {
      const pulse = 1 + 0.12 * Math.sin(performance.now() / 120);
      const attack = (meState.chargeKind ?? 0) === 0;
      const col = attack ? 0xffa043 : 0x6fc4ff; // 공격 지시는 주황, 이동 지시는 하늘색
      chargeLabel.text = attack ? "공격" : "이동";
      chargeLabel.style.fill = attack ? 0xffc27a : 0xa8dcff;
      chargeMark
        .clear()
        .circle(0, 0, 26 * pulse)
        .stroke({ width: 3, color: col, alpha: 0.4 + 0.5 * Math.min(1, meState.chargeLeft / 2) })
        .circle(0, 0, 4)
        .fill(col);
      chargeMark.position.set(meState.chargeX, meState.chargeY);
      chargeLabel.position.set(meState.chargeX, meState.chargeY - 32);
    }
    if (!meState?.down) spectating = false; // 일어나면 관전 끝
    let camTarget = me;
    let specName = "";
    if (spectating) {
      const alive = latest.players.filter((q) => q.id !== myId && !q.down);
      if (alive.length === 0) spectating = false;
      else {
        specIndex = ((specIndex % alive.length) + alive.length) % alive.length;
        const t = alive[specIndex]!;
        camTarget = players.views.get(t.id) ?? me;
        specName = t.name;
      }
    }
    if (camTarget) world.position.set(app.screen.width / 2 - camTarget.x, app.screen.height / 2 - camTarget.y);
    nearCampId = -1;
    if (meState) {
      const m = Math.floor(latest.time / 60);
      const s = Math.floor(latest.time % 60).toString().padStart(2, "0");
      const mine = latest.mercs.filter((w) => w[5] === myId);
      const down = mine.filter((w) => w[8] > 0).length;
      const used = mine.reduce((sum, w) => sum + unitCost(w[4], w[15]), 0);
      const curSt = selectedStance(meState);
      stanceBtns.forEach((b, i) => b.classList.toggle("active", curSt === i));
      updateStats(meState);
      hudLv.text = `Lv ${meState.level}`;
      hudTime.text = `${m}:${s}`;
      hudHp.text = `HP ${Math.ceil(meState.hp)} / ${meState.maxHp}`;
      hudHp.text += (WEAPONS[meState.weapon]?.type ?? -1) === SHIELD && meState.shieldMax > 0 ? `  ·  방패 ${Math.ceil(meState.shield)}` : "";
      hudGold.text = `금화 ${meState.gold}`;
      hudKills.text = `처치 ${meState.kills}`;
      hudLead.text = `통솔력 ${used}/${meState.leadership}`;
      hudMercs.text = `용병 ${mine.length}명`;
      const extra: string[] = [];
      if (meState.shaken > 0) extra.push(`공포! 용병이 도망칩니다 (${Math.ceil(meState.shaken)}초)`);
      else if (meState.swarm > 0) extra.push(`군세: 공격력 +${Math.round(meState.swarm * 100)}%`);
      if (meState.luck > 0) extra.push(`행운 +${Math.round(meState.luck * 100)}%`);
      if (terrain) {
        if (terrain.elevated(meState.x, meState.y)) extra.push(`고지대: 화살 피해 +${Math.round((TUNE.HIGH_GROUND_ARROW_MULT - 1) * 100)}%`);
        else if (terrain.onRamp(meState.x, meState.y)) extra.push("올라가는 길: 비탈보다 덜 느립니다");
        else if (terrain.speedMult(meState.x, meState.y) < 1) extra.push("비탈: 이동 속도가 크게 느려집니다");
      }
      if (down > 0) extra.push(`용병 ${down}명 쓰러짐 (부활 대기)`);
      hudExtra.text = extra.join("\n");
      hudExtra.style.fill = meState.shaken > 0 ? 0xff9b8f : 0xffe08a;
      drawHudBg(hudExtra.text ? 148 + hudExtra.height + 10 : 148);
      const hpFrac = Math.max(0, Math.min(1, meState.hp / meState.maxHp));
      hudBars
        .clear()
        .roundRect(14, 42, HUD_W - 28, 9, 4) // 경험치
        .fill(0x2a2d36)
        .roundRect(14, 42, (HUD_W - 28) * Math.min(1, meState.xp / meState.xpNeed), 9, 4)
        .fill(0xffe08a)
        .roundRect(14, 53, HUD_W - 28, 20, 6) // 체력
        .fill(0x3a1a1a)
        .roundRect(14, 53, (HUD_W - 28) * hpFrac, 20, 6)
        .fill(hpFrac > 0.5 ? 0x4caf50 : hpFrac > 0.25 ? 0xe0a43a : 0xd9453b);
      // 검을 들면 체력 막대 아래에 방패 체력(파랑)을 보여 준다
      if ((WEAPONS[meState.weapon]?.type ?? -1) === SHIELD && meState.shieldMax > 0) {
        const sf = Math.max(0, Math.min(1, meState.shield / meState.shieldMax));
        hudBars
          .roundRect(14, 75, HUD_W - 28, 7, 3)
          .fill(0x1b2433)
          .roundRect(14, 75, (HUD_W - 28) * sf, 7, 3)
          .fill(sf > 0 ? 0x5aa9ff : 0x1b2433);
      }
      mercPanel.update(latest.mercs, myId, meState.gold, meState.leadership - used);
      const hv = mercs.views.get(mercPanel.hovered());
      if (hv) fxLayer.circle(hv.x, hv.y, 26).stroke({ width: 3, color: 0xffe08a, alpha: 0.9 });
      showOffer(meState.offer, meState.pending, meState.rerolls, meState.box ?? 0);
      weaponBar.visible = true;
      drawWeaponBar(meState.weapon);
      if (lastLevel > 0 && meState.level > lastLevel) {
        levelToast.text = `레벨 ${meState.level}!`;
        levelToastLeft = 2;
        audio.play("level_up");
      }
      // 소리: 값이 바뀐 순간(금화 획득, 쓰러짐, 사기 저하, 용병 고용·강화)
      if (snd.gold >= 0 && meState.gold > snd.gold) audio.play("coin_gain");
      snd.gold = meState.gold;
      if (meState.down && !snd.down) audio.play("hero_down");
      snd.down = meState.down;
      if (meState.shaken > 0 && snd.shaken <= 0) audio.play("morale_break");
      const rageNow = latest.g?.rage ?? 0;
      if (rageNow > snd.rage) {
        audio.play("boss_warning");
        toast.text = `보스군이 격노했다! 증원이 합류하고 모두 강해진다 (Lv.${rageNow})`;
        toastLeft = 3;
      }
      snd.rage = rageNow;
      snd.shaken = meState.shaken;
      const nowTiers = new Map(mine.map((w) => [w[0], w[15]] as const));
      if (snd.mercSeen) {
        for (const [id, tier] of nowTiers) {
          const before = snd.mercTier.get(id);
          if (before === undefined) audio.play("hire");
          else if (tier > before) audio.play("upgrade_done");
        }
      }
      snd.mercTier = nowTiers;
      snd.mercSeen = true;
      // 다른 플레이어가 쓰러지면 멀리서도 알린다(가까우면 위의 위치 소리가 난다)
      // 동료를 일으키는 동안 이어지는 소리와 기병이 달릴 때의 말발굽 소리
      audio.loop("revive_loop", keys.has("e") && latest.players.some((q) => q.id !== myId && q.down && Math.hypot(q.x - meState.x, q.y - meState.y) <= REVIVE_RADIUS * 1.5));
      audio.loop("hoof_gallop", mine.some((w) => w[4] === 0 && w[13] > 0.6 && w[8] <= 0));
      lastLevel = meState.level;
      const fallen = latest.players.find((q) => q.id !== myId && q.down && Math.hypot(q.x - meState.x, q.y - meState.y) <= REVIVE_RADIUS * 1.5);
      deadText.text = latest.g?.phase === "tournament"
        ? "" // 토너먼트 안내는 위쪽 배너가 한다
        : meState.down
        ? meState.revive > 0
          ? `동료가 일으켜 세우는 중... ${Math.round(meState.revive * 100)}%`
          : spectating
            ? `${specName} 관전 중 · Tab/←→ 다음 동료 · 스페이스 끝내기`
            : "쓰러졌습니다 - 동료가 일으켜 주기를 기다리는 중 (스페이스: 관전)"
        : fallen
          ? `${fallen.name} 부활: E 누르고 있기${fallen.revive > 0 ? ` (${Math.round(fallen.revive * 100)}%)` : ""}`
          : (latest.chests ?? []).some((c) => c[3] === myId)
            ? "보상 상자가 떨어졌습니다! 반짝이는 내 상자 곁으로 가세요"
            : "";

      // 가까운 캠프의 고용 목록
      let best: CampWire | null = null;
      let bestD = CAMP_USE_RADIUS;
      for (const c of latest.camps) {
        const d = Math.hypot(c[1] - meState.x, c[2] - meState.y);
        if (d <= bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best && !meState.down) {
        if (snd.near < 0) audio.play("camp_open"); // 방금 범위에 들어왔다
        nearCampId = best[0];
        nearCampOffers = [best[4], best[5], best[6]];
        const owned = mine.length;
        campHint.text = `보유 금화 ${meState.gold}G · 통솔력 ${used}/${meState.leadership}`;
        [best[4], best[5], best[6]].forEach((code, i) => {
          const { type: t, tier } = decodeOffer(code);
          const price = Math.round(mercPrice(t, owned) * TIER_BUY_MULT[tier]! * meState.priceMult);
          const need = unitCost(t, tier);
          const noLeader = used + need > meState.leadership;
          const noGold = meState.gold < price;
          const ok = !noLeader && !noGold;
          const row = campRows[i]!;
          row.icon.texture = allyTex[t]!;
          row.icon.scale.set(44 / row.icon.texture.height);
          row.icon.alpha = ok ? 1 : 0.45;
          row.key.text = String(t + 2); // 병종마다 고정 번호
          row.name.text = `${tierName(t, tier)}${tier > 0 ? " " + "★".repeat(tier) : ""}`;
          row.name.style.fill = ok ? 0xffffff : 0x8d96a8;
          row.sub.text = noLeader ? "통솔력이 부족합니다" : noGold ? `금화가 ${price - meState.gold}G 부족합니다` : `${UNIT_NAMES[t]} · ${t + 2}번 키로 고용`;
          row.sub.style.fill = ok ? 0xb8bdc9 : 0xff9b8f;
          row.price.text = `${price}G`;
          row.price.style.fill = noGold ? 0xff9b8f : 0xffd45d;
          row.lead.text = `통솔 ${need}`;
          row.lead.style.fill = noLeader ? 0xff9b8f : 0x9fd0ff;
          row.bg
            .clear()
            .roundRect(0, 0, CAMP_W - 28, CAMP_ROW_H, 10)
            .fill({ color: ok ? 0x2a2517 : 0x1a1d26, alpha: 0.95 })
            .stroke({ width: ok ? 2 : 1, color: ok ? 0xe0c05d : 0x3a4052 });
        });
        const counts = UNIT_TYPES.map((t) => mine.filter((w) => w[4] === t).length);
        const dismiss = counts.some((c) => c > 0)
          ? ["해고 (Shift+숫자, 낸 금화의 절반 환급)", ...UNIT_TYPES.filter((t) => counts[t]! > 0).map((t) => `[Shift+${t + 2}] ${UNIT_NAMES[t]} x${counts[t]}`)]
          : [];
        campDismiss.text = dismiss.join("   ").replace("   [", "\n[");
        const rowsEnd = 52 + 3 * (CAMP_ROW_H + 8);
        campDismiss.position.set(20, rowsEnd + 2);
        const campH = rowsEnd + (dismiss.length > 0 ? campDismiss.height + 16 : 8);
        campPanelBg.clear().roundRect(0, 0, CAMP_W, campH, 14).fill({ color: 0x0b0d12, alpha: 0.88 }).stroke({ width: 2, color: 0xe0c05d });
        campPanel.visible = true;
      } else {
        campPanel.visible = false;
        nearCampOffers = [];
      }
    }
    const gi = latest.g;
    if (gi && gi.status !== "playing") deadText.text = ""; // 결과 화면이 뜨면 안내 문구는 숨긴다
    if (gi) {
      const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
      if (snd.phase) {
        if (gi.phase === "boss" && snd.phase !== "boss") audio.play("boss_warning");
        if (gi.phase === "break" && snd.phase === "boss") audio.play(gi.status === "victory" ? "victory" : "stage_clear");
        if (gi.status === "defeat" && snd.status !== "defeat") audio.play("defeat");
      }
      snd.phase = gi.phase;
      snd.status = gi.status;
      if (gi.squads > lastSquads) audio.play("squad_warning");
      const squadText = gi.squads > 0 ? ` · 적 소대 ${gi.squads}` : "";
      if (gi.squads > lastSquads) {
        toast.text = "적 소대가 진형을 갖추고 다가옵니다!";
        toastLeft = 2.5;
      }
      lastSquads = gi.squads;
      if (gi.phase === "grow") stageText.text = `스테이지 ${gi.stage}/${STAGE_COUNT} · 보스군 도착까지 ${mmss(gi.timer)}${squadText}`;
      else if (gi.phase === "boss") stageText.text = `스테이지 ${gi.stage}/${STAGE_COUNT} · ${UNIT_NAMES[gi.bossType]} 장군의 군대 ${gi.armyLeft}/${gi.armyTotal}${gi.rage > 0 ? ` · 격노 Lv.${gi.rage}${gi.timer > 0 ? ` (다음 ${gi.timer}초)` : " (최대)"}` : gi.timer > 0 ? ` · 격노까지 ${gi.timer}초` : ""}`;
      else if (gi.phase === "tournament") stageText.text = ""; // 위쪽 대진 배너가 대신한다
      else stageText.text = `스테이지 ${gi.stage} 클리어! 다음 스테이지까지 ${gi.timer}초`;
      stageText.position.set(app.screen.width / 2, 8);
      bossBar.clear();
      if (gi.phase === "boss" && gi.bossHp > 0) {
        const bw = 320;
        const bx = app.screen.width / 2 - bw / 2;
        bossBar.roundRect(bx, 36, bw, 10, 4).fill({ color: 0x000000, alpha: 0.6 }).roundRect(bx, 36, (bw * gi.bossHp) / 100, 10, 4).fill(0xe8883a);
      }
    }
    statsPanel.position.set(10, app.screen.height - 112 - STATS_H);
    statsPanel.visible = !!meState;
    drawMinimap(ticker.deltaMS / 1000);
    renderTournament(gi, myId);
    snd.near = nearCampId;
    levelToastLeft = Math.max(0, levelToastLeft - ticker.deltaMS / 1000);
    levelToast.visible = levelToastLeft > 0;
    levelToast.position.set(app.screen.width / 2, 100);
    weaponBar.position.set(app.screen.width - (WEAPONS.length * (SLOT_W + 4) - 4) - 12, app.screen.height - 100);
    // 캠프 고용창은 오른쪽 위에 뜨고, 레벨업 카드가 함께 떠 있으면 카드를 그 아래로 내린다
    const campBottom = campPanel.visible ? 52 + campPanel.height + 10 : 0;
    cardPanel.position.set(app.screen.width - CARD_W - 12, Math.max(90, campBottom, app.screen.height / 2 - 230));
    toastLeft = Math.max(0, toastLeft - ticker.deltaMS / 1000);
    toast.visible = toastLeft > 0;
    deadText.position.set(app.screen.width / 2, app.screen.height / 2 - 120);
    campPanel.position.set(app.screen.width - CAMP_W - 12, 52); // 오른쪽 위(소리 버튼 아래)
    toast.position.set(app.screen.width / 2, 74);
    legend.position.set(0, app.screen.height - LEGEND_H);
  });
}

main();
