import {
  ARCHER,
  BLUNT,
  MAGE,
  EVT_METEOR,
  EVT_REFLECT,
  type MeteorWire,
  CARDS,
  ENEMY_XP,
  ARMY_AGGRO,
  ARMY_LATERAL_SPACING,
  ARMY_RANK_SPACING,
  ARMY_ENGAGE_DISTANCE,
  ARMY_LEASH,
  ARMY_MARCH_SPEED,
  ARMY_SPAWN_DISTANCE,
  KNOCK_BOSS_FACTOR,
  KNOCK_STUN_SEC,
  DEFENSE_MAX,
  DEFAULT_DIFFICULTY,
  DIFFICULTY_REDUCTION,
  DODGE_MAX,
  EVT_DODGE,
  CRIT_MAX_CHANCE,
  CAST_TIME_MIN_MULT,
  meleeArc,
  meleeReach,
  EVT_CRIT,
  EVT_BACKSTAB,
  EVT_KNOCK,
  EVT_DMG_ALLY,
  EVT_DMG_ENEMY,
  EVT_DMG_ENEMY_CRIT,
  EVT_DMG_SHIELD,
  BOSS_SIZE,
  BOSS_SPEED_MULT,
  EVT_ARROW_HIT,
  EVT_ENEMY_ARROW_HIT,
  EVT_REVIVE,
  EVT_SHIELD_BLOCK,
  EVT_SHIELD_BREAK,
  REVIVE_HP_FRAC,
  REVIVE_INVULN_SEC,
  REVIVE_RADIUS,
  REVIVE_DECAY_FACTOR,
  STAGE_COUNT,
  ARCHER_KITE_HOME_PULL,
  inSpearBox,
  inBox,
  usesBox,
  boxWidthMult,
  ARCHER_KITE_SPEED_MULT,
  OFFER_SIZE,
  xpNeeded,
  type CardEffect,
  BULLET_DAMAGE,
  LEVELUP_PUSH_DISTANCE,
  LEVELUP_PUSH_RADIUS,
  LEVELUP_STUN_SEC,
  SWING_VISUAL_SEC,
  WEAPONS,
  WEAPON_SWITCH_DELAY_SEC,
  BULLET_RADIUS,
  BULLET_RANGE,
  BULLET_SPEED,
  CAMP_FIRST_SPAWN_SEC,
  CAV_EVADE_SEC,
  CAV_EVADE_SPEED_FRAC,
  CAV_DECAY_SEC,
  CAV_MOMENTUM_AFTER_HIT,
  CAV_FLANK_MAX_SEC,
  CAV_RETREAT_HP,
  CAV_SELF_DEFENSE,
  CAVALRY,
  CHARGE_DURATION_SEC,
  CHARGE_MAX_DISTANCE,
  CHARGE_TARGET_RADIUS,
  CAMP_MAX,
  CAMP_OFFERS,
  CAMP_USE_RADIUS,
  HERO_SWORD_FRONT_BLOCK,
  SHIELD,
  cavSpeed,
  chargeBonus,
  ENEMY_ARROW_SPEED,
  ENEMY_GOLD,
  ENEMY_MAX,
  ENEMY_SPAWN_DISTANCE,
  ENEMY_SPAWN_WEIGHTS,
  ENEMY_STATS,
  FIRE_COOLDOWN_SEC,
  FORMATION_TURN_RATE,
  MAX_MERCS_PER_PLAYER,
  MAX_PLAYERS,
  MERC_ARROW_SPEED,
  MERC_RESPAWN_SEC,
  MERC_STATS,
  NAME_MAX_LENGTH,
  NO_TYPE,
  PLAYER_RADIUS,
  SPEAR,
  SPEAR_AVOID_RADIUS,
  TICK_RATE,
  UNIT_TYPES,
  WORLD_SIZE,
  angleDiff,
  clampToWorld,
  mercPrice,
  sanitizeInput,
  DEFAULT_PRESETS,
  layoutFormation,
  sanitizeFormation,
  type BulletWire,
  type CampWire,
  type ChestWire,
  type TourInfo,
  type TourMatchInfo,
  type EnemyWire,
  type EventWire,
  type GameInfo,
  type GameStatus,
  type ResultPlayer,
  type StagePhase,
  type MercWire,
  type MercStat,
  SHIELD_FRONT_ARC,
  ARCHER_STRAFE_SEC,
  ASSAULT_LEASH_MULT_CAVALRY,
  BLUNT_SHIELD_PREF,
  ENEMY_SURROUND_RANGE,
  CAV_TARGET_WEIGHT,
  GUARD_THREAT_RADIUS,
  HERO_WARD_WEIGHT,
  SPEAR_WATCH_RANGE,
  STANCE_ASSAULT,
  STANCE_DEFEND,
  STANCE_HOLD,
  WARD_WEIGHT,
  CHEST_OPEN_RADIUS,
  TOURNAMENT_ARENA_RADIUS,
  TerrainMap,
  generateTerrain,
  type TerrainWire,
  TOURNAMENT_END_SEC,
  TOURNAMENT_OUTRO_SEC,
  TOURNAMENT_START_DIST,
  isTournamentStage,
  tournamentRoundName,
  CAMP_TIER_SEC,
  SHAKEN_DEATHS,
  SQUAD_CLEAR_GOLD,
  SQUAD_FIRST_SEC,
  SQUAD_INTERVAL_MIN,
  SQUAD_INTERVAL_STAGE,
  SQUAD_MARCH_MULT,
  SQUAD_SPAWN_DISTANCE,
  SHAKEN_FRAC,
  SHAKEN_GRACE_SEC,
  SHAKEN_MIN_ARMY,
  SHAKEN_WINDOW_SEC,
  SWARM_MAX,
  SWARM_PER_MERC,
  TIER_BUY_MULT,
  TIER_RESPAWN_EXTRA,
  campMaxTier,
  decodeOffer,
  encodeOffer,
  unitCost,
  type LegendId,
  type LegendScope,
  legendKey,
  LEGEND_CONST,
  POISON_SEC,
  MERC_NAME_COUNT,
  MERC_XP_KILL,
  MERC_XP_OVERFLOW,
  MERC_XP_PER_DAMAGE,
  MERC_XP_PER_HURT,
  mercXpNeed,
  MAX_TIER,
  luckWeight,
  REROLL_MAX,
  REROLL_PER_PICK,
  REROLL_START,
  TIER_AREA,
  TIER_DMG,
  TIER_HP,
  TIER_REACH,
  TIER_SHIELD,
  TIER_SPEED,
  upgradeCost,
  type PlayerInput,
  type PlayerState,
  type UnitStats,
  TUNE,
} from "@mercenary/shared";
import { resolveHit, type Hit, type HitResult } from "./combat.js";
import { SQUAD_KINDS, armyComposition, armyLayout, armySize, bossTypeOf, squadComposition, squadLayout, squadSize } from "./stage.js";

/** 이 대상(주인공 또는 병종)에게 전설 능력이 있는가 */
/** 한 번에 n발을 쏠 때 i번째 화살의 각도 오프셋: 0번은 정면, 나머지는 좌우로 번갈아 퍼진다 */
const fanOffset = (i: number, n: number): number => {
  if (i === 0 || n <= 1) return 0;
  const k = Math.ceil(i / 2);
  return (i % 2 === 1 ? 1 : -1) * k * TUNE.MULTISHOT_SPREAD;
};

const POISON_PULSE_SEC = 0.5;
const DOT_RESULT = (damage: number): HitResult => ({ body: damage, shield: 0, reflected: 0, shieldBroke: false, backstab: false });

const hasLegend = (mods: Mods, id: LegendId, scope: LegendScope): boolean => mods.legends.has(legendKey(id, scope));

/** 용병 능력치 강화 묶음(전체용 하나, 병종별 다섯). 배율 계열은 1에서, 가산 계열은 0에서 시작한다. */
type MercMods = Record<MercStat, number>;
const MULT_STATS: readonly MercStat[] = ["hp", "dmg", "atkSpeed", "speed", "range", "area", "respawn", "xp", "cast"];
const newMercMods = (): MercMods => ({
  hp: 1, dmg: 1, atkSpeed: 1, speed: 1, range: 1, area: 1, respawn: 1, cast: 1,
  crit: 0, critMult: 0, defense: 0, dodge: 0, regen: 0, lifesteal: 0, pierce: 0, multi: 0, poison: 0, armor: 0, knock: 0, xp: 1,
});
/** 전체 강화와 병종 강화를 합친 값 */
const mstat = (mods: Mods, type: number, stat: MercStat): number =>
  MULT_STATS.includes(stat) ? mods.all[stat] * mods.type[type]![stat] : mods.all[stat] + mods.type[type]![stat];

/** 레벨업 카드로 쌓이는 강화 수치(배율은 1이 기본) */
interface Mods {
  legends: Set<string>; // 고른 전설 능력(legendKey: 능력@대상)
  goldMult: number;
  xpMult: number;
  bounty: number;
  all: MercMods;
  type: MercMods[];
  heroSpeed: number;
  heroDmg: number;
  heroDefense: number;
  heroDodge: number;
  heroRange: number;
  heroPierce: number;
  heroMulti: number;
  heroPoison: number;
  heroArmor: number;
  heroCrit: number;
  heroCritMult: number;
  heroArea: number;
  heroKnock: number;
  heroFireRate: number;
  heroRegen: number;
  heroLifesteal: number;
  heroShield: number; // 방패 체력 최대치 추가
  heroShieldRegen: number; // 방패 재생 속도 추가 비율
  heroCast: number; // 지팡이 시전 시간 배율
}

const newMods = (): Mods => ({
  legends: new Set(),
  goldMult: 1,
  xpMult: 1,
  bounty: 1,
  all: newMercMods(),
  type: UNIT_TYPES.map(() => newMercMods()),
  heroSpeed: 1,
  heroDmg: 1,
  heroDefense: 0,
  heroDodge: 0,
  heroRange: 1,
  heroPierce: 0,
  heroMulti: 0,
  heroPoison: 0,
  heroArmor: 0,
  heroCrit: 0,
  heroCritMult: TUNE.CRIT_BASE_MULT,
  heroArea: 1,
  heroKnock: 0,
  heroFireRate: 1,
  heroRegen: 0,
  heroLifesteal: 0,
  heroShield: 0,
  heroShieldRegen: 0,
  heroCast: 1,
});

interface Slot {
  away: boolean; // 접속이 끊겨 돌아오기를 기다리는 중. 주인공은 제자리에 서고 적에게 노려지지 않는다.
  switchCd: number; // 무기를 바꾼 직후 공격할 수 없는 남은 시간
  mods: Mods;
  state: PlayerState;
  input: PlayerInput;
  fireCd: number;
  windT: number; // 공격 준비 동작이 남은 시간(철퇴). 0이면 준비 중이 아니다
  mom: number; // 기마 주인공의 속도(0~1). 달리면 오르고 멈추면 줄어든다
  stances: number[]; // 병종별 진형 모드
  holdPts: [number, number][]; // 병종별 지점 방어 지점
  holdSets: boolean[]; // 병종별로 지점을 한 번이라도 지정했다
  holdFacings: number[]; // 병종별 지점 방어 진형이 바라보는 방향
  orders: ({ kind: number; x: number; y: number; left: number; targetId: number } | null)[]; // 병종별 이동(1)/공격(0) 지시
  deaths: number[]; // 최근 용병이 쓰러진 시각(사기 저하 판정)
  shakenGrace: number; // 사기 저하가 다시 걸리지 않는 남은 시간
  haste: Record<string, number>; // 전장의 함성 중첩(대상별: hero 또는 병종 번호)
  hasteT: Record<string, number>;
  zones: number[]; // 진형: 병종별 구역
  spacing: number; // 진형 간격 배율
  revives: number; // 동료를 일으켜 세운 횟수
  stats: { dealt: number; taken: number; downs: number; mercDeaths: number; gold: number; wins: number; champion: number }; // 기록용 누적
  facing: number; // 진형이 바라보는 방향. 조준 방향을 천천히 따라간다
  difficulty: number; // 이 플레이어의 난이도(DIFFICULTY_REDUCTION 인덱스). 방에서 판이 시작되기 전에만 바뀐다
  shieldIdle: number; // 마지막으로 방패 체력이 깎인 뒤 지난 시간(초). 차오르기 시작할 때를 잰다
  shieldDelay: number; // 차오르기 시작하기까지 필요한 시간(깨졌으면 더 길다)
}

interface Fighter {
  id: number;
  type: number;
  x: number;
  y: number;
  hp: number;
  atkT: number; // 공격 예비 동작 남은 시간(0이면 공격 중 아님)
  atkAng: number;
  face: number; // 바라보는 방향(마지막으로 이동·공격한 방향). 방패가 막는 방향이기도 하다
  cd: number;
  shield: number; // 방패 체력(검방병). 깨지면 0
  regenT: number; // 깨진 방패가 재생될 때까지 남은 시간(0이면 해당 없음)
  momentum: number; // 기병의 속도 0..1. 이동하면 오르고 멈추면 줄며, 공격하면 크게 준다
  chargeSnap: number; // 공격 예비 동작을 시작할 때 정해진 돌격 추가 피해
}

/** 적 AI가 보는 아군(주인공·용병) */
interface Foe {
  x: number;
  y: number;
  r: number;
  type: number; // 병종(주인공은 NO_TYPE)
  face: number;
  shield: number;
  ranged: boolean;
  vx: number; // 이동 속도(px/s). 움직이는 대상을 앞질러 가는 데 쓴다
  vy: number;
  f: Friendly;
}

interface Enemy extends Fighter {
  flankT: number; // 기병이 우회 접근에 쓴 시간
  evadeT: number; // 기병이 공격 뒤 물러나는 남은 시간
  rage?: number; // 보스군 격노 단계(이동 속도가 단계마다 조금씩 빨라진다)
  poisonT?: number; // 독이 남은 시간
  poisonDps?: number;
  poisonOwner?: number;
  poisonSrc?: Merc;
  poisonAcc?: number; // 아직 숫자로 띄우지 않은 독 피해
  stunT?: number; // 경직(움직이지도 공격하지도 못하는) 남은 시간
  maxHp: number;
  shieldMax: number;
  dmgMult: number;
  boss: boolean; // 보스군의 장군
  army: boolean; // 보스군 소속(진형 자리를 지킨다)
  squad: number; // 소대 번호(0이면 소속 없음). 소대도 진형 자리를 지킨다
  slotF: number; // 진형 자리(행군 방향 기준)
  slotL: number;
}
interface Merc extends Fighter {
  owner: number;
  respawn: number;
  paid: number; // 고용에 쓴 금화(해고 환급 기준)
  evadeT: number; // 기병이 공격 뒤 물러나는 남은 시간
  flankT: number; // 기병이 우회 접근에 쓴 시간
  runId?: number; // 기병이 마지막으로 친 대상(그 뒤로 돌아 들어간다)
  brawl?: boolean; // 기병이 마무리 싸움 중(대상 체력이 얼마 안 남아 치고 빠지지 않는다)
  tier: number; // 강화 단계 0~4
  nameId: number;
  xp: number; // 강화에 쓰는 경험치
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  left: number;
  hostile: boolean;
  damage: number;
  srcType: number;
  owner: number; // 처치 보상을 받을 플레이어(적 투사체는 0)
  radius: number;
  pierce: number; // 더 뚫고 지나갈 수 있는 적 수
  hi?: boolean; // 쏜 곳이 고지대인가(처음 움직일 때 정해진다)
  crit: boolean;
  hitIds: Set<number>; // 이미 맞힌 적(관통 중 중복 피해 방지)
  poison?: number; // 독 피해 비율(화살 피해 대비, 지속 POISON_SEC초)
  merc?: Merc; // 쏜 용병(경험치를 받는다)
}

interface Camp {
  id: number;
  x: number;
  y: number;
  left: number;
  offers: number[];
}

/** 공격·피격 대상이 되는 아군(주인공 또는 용병)을 한 형태로 다루기 위한 뷰 */
interface Friendly {
  x: number;
  y: number;
  radius: number;
  ownerId: number; // 반사 피해로 적을 처치했을 때 보상을 받을 플레이어
  merc?: Merc; // 용병이면 그 용병(경험치)
  /** 공격을 받는다. 되돌려줄 피해(창병의 돌격 반사)를 돌려준다. */
  hit: (h: Hit) => number;
}

/** 용병 AI가 보는 대상 */
interface Target {
  x: number;
  y: number;
  r: number;
  type: number; // 병종(주인공은 NO_TYPE)
  face: number;
  shield: number;
  ranged: boolean;
  id: number;
  hero: boolean;
  hpFrac: number; // 남은 체력 비율(0~1)
}
interface Ally {
  x: number;
  y: number;
  type: number;
  hero: boolean;
  id: number;
}
interface AiCtx {
  m: Merc;
  st: UnitStats;
  dt: number;
  targets: Target[];
  allies: Ally[];
  home: [number, number];
  homeDist: number;
  owner: Slot | undefined;
  leash: number;
  assault: boolean;
  guard: boolean; // 주인공 호위(기본) 명령 중
  widthMult: number; // 창병 범위 증가 배율
}

interface Chest {
  id: number;
  x: number;
  y: number;
  owner: number;
  left: number;
}

interface TourMatch {
  a: number; // 선수 번호(0이면 빈자리: 부전승)
  b: number;
  an: string;
  bn: string;
  w: 0 | 1 | 2;
}
interface Tournament {
  rounds: { title: string; matches: TourMatch[] }[];
  r: number; // 지금 라운드
  m: number; // 지금 경기
  step: "intro" | "fight" | "outro" | "end";
  t: number; // 이 단계에서 남은 초
  winner: string;
  champion: string;
}

/** 시험 플레이용: MERC_STAGE_GROW_SEC=20 처럼 지정하면 성장 시간이 짧아진다 */
const growSec = (): number => (Number(process.env.MERC_STAGE_GROW_SEC) > 0 ? Number(process.env.MERC_STAGE_GROW_SEC) : TUNE.STAGE_GROW_SEC);
/** 시험 플레이용: MERC_SQUAD_FIRST_SEC=3 처럼 지정하면 첫 소대가 빨리 온다 */
const SQUAD_FIRST = Number(process.env.MERC_SQUAD_FIRST_SEC) > 0 ? Number(process.env.MERC_SQUAD_FIRST_SEC) : SQUAD_FIRST_SEC;
const SEPARATION_CELL = 32;
const EVENT_CAP = 160;

interface Army {
  x: number; // 진형 기준점(장군 뒤 중앙이 아니라 진형 맨 앞 중앙)
  y: number;
  heading: number;
}
const ENEMY_ARROW_RANGE_FACTOR = 1.2;
const MERC_ARROW_RANGE_FACTOR = 1.1;

export type BuyResult = { ok: true } | { ok: false; reason: string };

/** 서버가 전투를 계산하는 권위 있는 게임 상태. 네트워크와 무관하게 테스트할 수 있다. */
export class Game {
  tick = 0;
  time = 0;
  /** 테스트에서 적·캠프 자동 생성을 끌 때 쓴다 */
  autoSpawn = true;
  private slots = new Map<number, Slot>();
  private enemies = new Map<number, Enemy>();
  private mercs = new Map<number, Merc>();
  private camps = new Map<number, Camp>();
  private chests = new Map<number, Chest>();
  private foePos = new Map<string, [number, number]>(); // 적 AI가 아군의 이동 속도를 구하려고 기억하는 지난 위치
  private tour: Tournament | null = null;
  private tourPending = false; // 보스를 잡은 직후, 다음 틱에 토너먼트를 연다
  private bossT = 0; // 보스 단계가 시작된 뒤 흐른 시간
  private rage = 0; // 보스군 격노 단계
  private rageT = 0; // 다음 격노 단계까지 흐른 시간
  private armyBase = 0; // 처음 보스군 병력(증원 수를 정하는 기준)
  private bullets: Bullet[] = [];
  private nextId = 1;
  private nextEntityId = 1;
  private spawnBudget = 0;
  private campTimer = CAMP_FIRST_SPAWN_SEC;
  private events: EventWire[] = [];
  private dmgIndex = new Map<string, number>(); // 이번 묶음에서 피해 숫자 이벤트의 위치
  private army: Army | null = null;
  stage = 1;
  phase: StagePhase = "grow";
  private phaseT = growSec(); // grow: 보스군 도착까지, break: 다음 스테이지까지
  private stageTime = 0; // 이번 스테이지에서 흐른 성장 시간(적 생성량 계산용)
  status: GameStatus = "playing";
  private armyTotal = 0;
  private squads = new Map<number, { a: Army; left: number; size: number }>();
  private nextSquadId = 1;
  private squadTimer = SQUAD_FIRST;

  constructor(private rng: () => number = Math.random) {}

  get isFull(): boolean {
    return this.slots.size >= MAX_PLAYERS;
  }

  addPlayer(name: string): number | null {
    if (this.isFull) return null;
    const id = this.nextId++;
    const clean = name.trim().slice(0, NAME_MAX_LENGTH) || `용병단${id}`;
    const slot = this.newSlot(id, clean);
    this.placeAtSpawn(slot.state, id);
    this.slots.set(id, slot);
    return id;
  }

  /** 테스트용: 카드 효과를 바로 적용한다 */
  applyCardForTest(playerId: number, effect: CardEffect): void {
    const s = this.slots.get(playerId);
    if (s) this.applyCard(s, effect);
  }

  /** 테스트용: 용병에게 경험치를 바로 준다 */
  grantMercXpForTest(mercId: number, amount: number): void {
    const m = this.mercs.get(mercId);
    if (m) this.gainMercXp(m, amount);
  }

  /** 테스트용: 카드가 반영된 용병 능력치 */
  mercStatsForTest(mercId: number): UnitStats {
    return this.mercStats(this.mercs.get(mercId)!);
  }

  /** 같은 참가자들로 판을 처음부터 다시 시작한다(다시 하기) */
  // --- 지형 ---------------------------------------------------------------
  /** 이번 판의 지형(없으면 평지). 방이 게임을 시작할 때 generateTerrain()으로 만든다. */
  terrain: TerrainMap | null = null;
  private terrainTrack: { o: { x: number; y: number }; px: number; py: number; r: number }[] = [];

  /** 이번 판의 지형을 새로 만든다(시작 지점 둘레는 비워 둔다) */
  generateTerrain(): TerrainWire[] {
    const items = generateTerrain(this.rng, WORLD_SIZE / 2, [[0, 0, 420]]);
    this.setTerrain(items);
    return items;
  }
  setTerrain(items: readonly TerrainWire[] | null): void {
    this.terrain = items && items.length > 0 ? new TerrainMap(items, TOURNAMENT_ARENA_RADIUS + 60) : null;
  }
  terrainItems(): readonly TerrainWire[] {
    return this.terrain?.items ?? [];
  }

  /** 이번 틱에 움직이기 전의 위치를 기억한다(끝난 뒤 지형 속도 보정·충돌에 쓴다) */
  private terrainBegin(): void {
    const t = this.terrain;
    this.terrainTrack.length = 0;
    if (!t) return;
    const tr = this.terrainTrack;
    for (const s of this.slots.values()) if (!s.state.down) tr.push({ o: s.state, px: s.state.x, py: s.state.y, r: PLAYER_RADIUS });
    for (const m of this.mercs.values()) if (m.respawn <= 0) tr.push({ o: m, px: m.x, py: m.y, r: MERC_STATS[m.type]!.radius });
    for (const e of this.enemies.values()) tr.push({ o: e, px: e.x, py: e.y, r: radiusOf(e) });
  }

  /** 고지대·비탈에서는 이번 틱에 움직인 만큼을 줄이고, 통과할 수 없는 지형 밖으로 밀어낸다 */
  private terrainEnd(): void {
    const t = this.terrain;
    if (!t) return;
    t.setDuel(this.phase === "tournament");
    for (const u of this.terrainTrack) {
      const o = u.o;
      let x = o.x;
      let y = o.y;
      const dx = x - u.px;
      const dy = y - u.py;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 120) {
        const f = t.speedMult(x, y);
        if (f < 1) {
          x = u.px + dx * f;
          y = u.py + dy * f;
        }
      }
      [x, y] = t.pushOut(x, y, u.r);
      o.x = x;
      o.y = y;
    }
  }

  /** 화살 피해 배율: 높은 곳에서 아래로 쏘면 강하고, 아래에서 위로 쏘면 약하다 */
  private arrowTerrainMult(b: Bullet, x: number, y: number): number {
    const t = this.terrain;
    if (!t || t.plateaus.length === 0) return 1;
    const targetHigh = t.elevated(x, y);
    if (b.hi && !targetHigh) return TUNE.HIGH_GROUND_ARROW_MULT;
    if (!b.hi && targetHigh) return TUNE.LOW_GROUND_ARROW_MULT;
    return 1;
  }

  /** 한 플레이어의 난이도를 바꾼다(범위 밖이면 무시). 개인별 설정이다. */
  setDifficulty(playerId: number, v: number): boolean {
    const s = this.slots.get(playerId);
    if (!s || !Number.isInteger(v) || v < 0 || v >= DIFFICULTY_REDUCTION.length) return false;
    s.difficulty = v;
    return true;
  }
  getDifficulty(playerId: number): number {
    return this.slots.get(playerId)?.difficulty ?? DEFAULT_DIFFICULTY;
  }

  /** 적에게 받는 피해에 곱한다(그 플레이어의 난이도). 토너먼트(플레이어끼리)에는 적용하지 않는다. */
  private damageTakenMult(ownerId: number): number {
    if (this.phase === "tournament") return 1;
    return 1 - (DIFFICULTY_REDUCTION[this.slots.get(ownerId)?.difficulty ?? DEFAULT_DIFFICULTY] ?? 0);
  }

  reset(): void {
    this.terrain = null;
    const old = [...this.slots.values()];
    this.slots.clear();
    this.enemies.clear();
    this.mercs.clear();
    this.camps.clear();
    this.bullets = [];
    this.events = [];
    this.army = null;
    this.armyTotal = 0;
    this.squads.clear();
    this.squadTimer = SQUAD_FIRST;
    this.time = 0;
    this.stage = 1;
    this.phase = "grow";
    this.phaseT = growSec();
    this.stageTime = 0;
    this.status = "playing";
    this.spawnBudget = 0;
    this.campTimer = CAMP_FIRST_SPAWN_SEC;
    for (const o of old) {
      const slot = this.newSlot(o.state.id, o.state.name);
      slot.away = o.away;
      slot.zones = o.zones; // 고른 진형은 다시 시작해도 유지한다
      slot.difficulty = o.difficulty; // 난이도도 유지한다
      slot.spacing = o.spacing;
      this.placeAtSpawn(slot.state, o.state.id);
      this.slots.set(o.state.id, slot);
    }
  }

  private newSlot(id: number, name: string): Slot {
    return {
      state: {
        id,
        name,
        x: 0,
        y: 0,
        hp: TUNE.PLAYER_MAX_HP,
        maxHp: TUNE.PLAYER_MAX_HP,
        weapon: 0,
        swing: 0,
        wind: 0,
        aim: 0,
        kills: 0,
        gold: TUNE.START_GOLD,
        level: 1,
        xp: 0,
        xpNeed: xpNeeded(1),
        pending: 0,
        hs: [],
        stance: STANCE_DEFEND,
        holdX: 0,
        holdY: 0,
        stances: UNIT_TYPES.map(() => STANCE_DEFEND),
        holds: UNIT_TYPES.flatMap(() => [0, 0]),
        box: 0,
        rerolls: REROLL_START,
        legends: [],
        luck: 0,
        swarm: 0,
        shaken: 0,
        offer: [],
        priceMult: 1,
        leadership: TUNE.START_LEADERSHIP,
        chargeLeft: 0,
        chargeKind: 0,
        chargeX: 0,
        chargeY: 0,
        down: false,
        revive: 0,
        invuln: 0,
        shield: TUNE.HERO_SHIELD_MAX,
        shieldMax: TUNE.HERO_SHIELD_MAX,
      },
      mods: newMods(),
      away: false,
      switchCd: 0,
      input: { dx: 0, dy: 0, aim: 0, fire: false, revive: false },
      fireCd: 0,
      windT: 0,
      mom: 0,
      stances: UNIT_TYPES.map(() => STANCE_DEFEND),
      holdPts: UNIT_TYPES.map(() => [0, 0] as [number, number]),
      holdSets: UNIT_TYPES.map(() => false),
      holdFacings: UNIT_TYPES.map(() => 0),
      orders: UNIT_TYPES.map(() => null),
      deaths: [],
      shakenGrace: 0,
      haste: {},
      hasteT: {},
      zones: [...DEFAULT_PRESETS[0]!.zones],
      spacing: DEFAULT_PRESETS[0]!.spacing,
      revives: 0,
      stats: { dealt: 0, taken: 0, downs: 0, mercDeaths: 0, gold: 0, wins: 0, champion: 0 },
      facing: 0,
      shieldIdle: 99,
      shieldDelay: 0,
      difficulty: DEFAULT_DIFFICULTY,
    };
  }

  removePlayer(id: number): void {
    this.slots.delete(id);
    for (const m of [...this.mercs.values()]) if (m.owner === id) this.mercs.delete(m.id);
  }

  setInput(id: number, raw: Parameters<typeof sanitizeInput>[0]): void {
    const slot = this.slots.get(id);
    if (slot && !slot.away) slot.input = sanitizeInput(raw);
  }

  /** 접속이 끊긴 플레이어를 기다리는 동안: 입력을 멈추고, 주인공이 적의 목표가 되지 않게 한다(용병은 계속 싸운다) */
  setAway(id: number, away: boolean): void {
    const slot = this.slots.get(id);
    if (!slot) return;
    slot.away = away;
    if (away) slot.input = { dx: 0, dy: 0, aim: slot.input.aim, fire: false, revive: false };
  }

  get playerCount(): number {
    return this.slots.size;
  }

  /** 캠프에서 용병을 고용한다. 거리·금화·보유 한도를 서버가 검증한다. */
  buy(playerId: number, campId: number, offerIndex: number): BuyResult {
    const s = this.slots.get(playerId);
    const camp = this.camps.get(campId);
    if (!s || s.state.down) return { ok: false, reason: "지금은 고용할 수 없습니다" };
    if (!camp) return { ok: false, reason: "캠프가 사라졌습니다" };
    if (Math.hypot(camp.x - s.state.x, camp.y - s.state.y) > CAMP_USE_RADIUS) {
      return { ok: false, reason: "캠프가 너무 멉니다" };
    }
    const code = Number.isInteger(offerIndex) ? camp.offers[offerIndex] : undefined;
    if (code === undefined) return { ok: false, reason: "잘못된 선택입니다" };
    const { type, tier } = decodeOffer(code);
    const owned = this.countMercs(playerId);
    if (owned >= MAX_MERCS_PER_PLAYER) return { ok: false, reason: `용병은 최대 ${MAX_MERCS_PER_PLAYER}명입니다` };
    const need = unitCost(type, tier);
    if (this.leadershipUsed(playerId) + need > s.state.leadership) {
      return { ok: false, reason: `통솔력이 부족합니다 (${need} 필요)` };
    }
    const price = Math.round(mercPrice(type, owned) * TIER_BUY_MULT[tier]! * s.state.priceMult);
    if (s.state.gold < price) return { ok: false, reason: `금화가 부족합니다 (${price}G 필요)` };
    s.state.gold -= price;
    this.addMerc(playerId, type, s.state.x, s.state.y, price, tier);
    return { ok: true };
  }

  /** 캠프 근처에서 용병 1명을 해고하고 지불한 금화의 일부를 돌려받는다. 쓰러진 용병, 체력이 낮은 용병 순으로 내보낸다. */
  dismiss(playerId: number, type: number): BuyResult {
    const s = this.slots.get(playerId);
    if (!s || s.state.down) return { ok: false, reason: "지금은 해고할 수 없습니다" };
    const nearCamp = [...this.camps.values()].some((c) => Math.hypot(c.x - s.state.x, c.y - s.state.y) <= CAMP_USE_RADIUS);
    if (!nearCamp) return { ok: false, reason: "캠프 근처에서만 해고할 수 있습니다" };
    let pick: Merc | null = null;
    for (const m of this.mercs.values()) {
      if (m.owner !== playerId || m.type !== type) continue;
      const rank = (x: Merc) => (x.respawn > 0 ? -1 : x.tier * 100000 + x.hp); // 쓰러진 용병, 낮은 단계, 체력 낮은 순
      if (!pick || rank(m) < rank(pick)) pick = m;
    }
    if (!pick) return { ok: false, reason: "해당 병종 용병이 없습니다" };
    this.mercs.delete(pick.id);
    s.state.gold += Math.floor(pick.paid * TUNE.DISMISS_REFUND);
    return { ok: true };
  }

  /**
   * 병종(types 비트마스크, 생략하면 전체)에 이동·공격을 지시한다. 주인공 가까운 곳으로 제한하고, 일정 시간 뒤 자동으로 해제된다.
   * 적 근처(ORDER_ATTACK_PICK, 넉넉하게)를 찍으면 가장 가까운 그 적을 쫓아 공격하고, 빈 땅을 찍으면 그곳으로 이동해 자리를 지킨다.
   */
  order(playerId: number, x: unknown, y: unknown, types?: unknown): void {
    const s = this.slots.get(playerId);
    if (!s || s.state.down || typeof x !== "number" || typeof y !== "number") return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dx = x - s.state.x;
    const dy = y - s.state.y;
    const d = Math.hypot(dx, dy);
    const k = d > CHARGE_MAX_DISTANCE ? CHARGE_MAX_DISTANCE / d : 1;
    const ox = clampToWorld(s.state.x + dx * k, 20);
    const oy = clampToWorld(s.state.y + dy * k, 20);
    const foes: { id: number; x: number; y: number; r: number }[] =
      this.phase === "tournament" ? this.duelFoes(playerId).map((f) => ({ id: 0, x: f.x, y: f.y, r: f.radius })) : [...this.enemies.values()].map((e) => ({ id: e.id, x: e.x, y: e.y, r: radiusOf(e) }));
    let pick: { id: number; x: number; y: number } | null = null;
    let best = Infinity;
    for (const f of foes) {
      const dd = Math.hypot(f.x - ox, f.y - oy);
      if (dd <= TUNE.ORDER_ATTACK_PICK + f.r && dd < best) {
        best = dd;
        pick = f;
      }
    }
    const left = pick ? CHARGE_DURATION_SEC : TUNE.MOVE_ORDER_SEC;
    const ax = pick ? pick.x : ox;
    const ay = pick ? pick.y : oy;
    const mask = this.typeMask(types);
    for (const t of UNIT_TYPES) if (mask & (1 << t)) s.orders[t] = { kind: pick ? 0 : 1, x: ax, y: ay, left, targetId: pick?.id ?? 0 };
    // 화면 표시용(마지막 지시 지점)
    s.state.chargeX = ax;
    s.state.chargeY = ay;
    s.state.chargeKind = pick ? 0 : 1;
    s.state.chargeLeft = left;
  }

  /** 기병에게 돌격 지점을 지시한다(order의 기병 전용 약식). */
  charge(playerId: number, x: unknown, y: unknown): void {
    this.order(playerId, x, y, 1 << CAVALRY);
  }

  leadershipUsed(owner: number): number {
    let n = 0;
    for (const m of this.mercs.values()) if (m.owner === owner) n += unitCost(m.type, m.tier);
    return n;
  }

  /** 통솔력 증가(레벨업 선택지 등에서 호출) */
  addLeadership(playerId: number, amount: number): void {
    const s = this.slots.get(playerId);
    if (s) s.state.leadership += amount;
  }

  step(): void {
    if (this.slots.size === 0) {
      // 아무도 없으면 판을 초기화해, 다음에 들어온 사람이 난이도가 올라간 판을 받지 않게 한다
      this.time = 0;
      this.stage = 1;
      this.phase = "grow";
      this.phaseT = growSec();
      this.stageTime = 0;
      this.status = "playing";
      this.army = null;
      this.armyTotal = 0;
      this.squads.clear();
      this.squadTimer = SQUAD_FIRST;
      this.events = [];
      this.spawnBudget = 0;
      this.campTimer = CAMP_FIRST_SPAWN_SEC;
      this.enemies.clear();
      this.mercs.clear();
      this.camps.clear();
      this.chests.clear();
      this.tour = null;
      this.tourPending = false;
      this.bossT = 0;
      this.bullets = [];
      this.tick++;
      return;
    }
    if (this.status !== "playing") {
      this.tick++;
      return;
    }
    const dt = 1 / TICK_RATE;
    this.time += dt;
    if (this.tourPending) {
      this.tourPending = false;
      this.beginTournament();
    }
    const duel = this.phase === "tournament";
    this.terrainBegin();
    this.stepPlayers(dt);
    this.stepStage(dt);
    this.stepChests(dt);
    if (!duel) {
      this.stepCamps(dt);
      this.spawnEnemies(dt);
      this.stepSquads(dt);
    }
    const friendlies = this.collectFriendlies();
    if (duel) this.tickDuelPoison(dt, friendlies);
    else if (this.duelPoison.size > 0) this.duelPoison.clear();
    this.stepMercs(dt);
    this.separateMercs(dt);
    if (!duel) {
      this.stepEnemies(dt, friendlies);
      this.separateEnemies();
    }
    this.terrainEnd();
    this.stepBullets(dt, friendlies);
    this.clampUnits();
    this.pruneCasts();
    // 모든 주인공이 쓰러져 있으면 게임오버(동료가 일으켜 세울 사람이 없다). 토너먼트 중에는 지는 것이 정상이라 제외한다.
    if (!duel && [...this.slots.values()].every((s) => s.state.down)) this.status = "defeat";
    this.tick++;
  }

  // --- 스냅샷 -----------------------------------------------------------

  snapshotPlayers(): PlayerState[] {
    return [...this.slots.values()].map((s) => ({ ...s.state, hs: this.heroStats(s) }));
  }

  /** 화면에 보여 줄 주인공 능력치(지금 든 무기와 카드가 반영된 값) */
  private heroStats(s: Slot): number[] {
    const w = WEAPONS[s.state.weapon]!;
    const m = s.mods;
    const rate = m.heroFireRate;
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return [
      r2(w.damage * m.heroDmg),
      r2(rate / (w.cooldown + w.windup)),
      Math.round(meleeReach(w.type, w.reach * m.heroRange, m.heroArea)),
      r2(Math.min(CRIT_MAX_CHANCE, m.heroCrit)),
      r2(m.heroCritMult),
      m.heroPierce,
      r2(m.heroArea),
      Math.round(m.heroKnock),
      r2(Math.min(DEFENSE_MAX, m.heroDefense)),
      r2(Math.min(DODGE_MAX, m.heroDodge)),
      r2(m.heroRegen),
      Math.round(TUNE.PLAYER_SPEED * m.heroSpeed * (WEAPONS[s.state.weapon]!.type === CAVALRY ? TUNE.MOUNT_SPEED_MAX : 1)),
      1 + m.heroMulti,
      r2(m.heroLifesteal),
    ];
  }

  snapshotEnemies(): EnemyWire[] {
    return [...this.enemies.values()].map((e) => [
      e.id,
      round(e.x),
      round(e.y),
      Math.max(1, Math.ceil((100 * e.hp) / e.maxHp)),
      e.type,
      progress(e, ENEMY_STATS),
      round(e.atkAng, 100),
      e.shieldMax > 0 ? Math.ceil((100 * e.shield) / e.shieldMax) : 0,
      round(e.face, 100),
      round(e.momentum, 100),
      round(e.regenT, 10),
      e.boss ? 1 : 0,
    ]);
  }

  snapshotMercs(): MercWire[] {
    return [...this.mercs.values()].map((m) => [
      m.id,
      round(m.x),
      round(m.y),
      Math.ceil(m.hp),
      m.type,
      m.owner,
      progress(m, MERC_STATS),
      round(m.atkAng, 100),
      round(m.respawn, 10),
      this.mercStats(m).hp,
      Math.ceil(m.shield),
      this.mercStats(m).shield,
      round(m.face, 100),
      round(m.momentum, 100),
      round(m.regenT, 10),
      m.tier,
      m.nameId,
      Math.floor(m.xp),
    ]);
  }

  snapshotBullets(): BulletWire[] {
    return this.bullets.map((b) => [b.id, round(b.x), round(b.y), b.hostile ? 1 : 0]);
  }

  snapshotCamps(): CampWire[] {
    return [...this.camps.values()].map((c) => [
      c.id,
      round(c.x),
      round(c.y),
      round(c.left, 10),
      c.offers[0] ?? 0,
      c.offers[1] ?? 0,
      c.offers[2] ?? 0,
    ]);
  }

  // --- 테스트·디버그용 ----------------------------------------------------

  get enemyCount(): number {
    return this.enemies.size;
  }

  countMercs(owner: number): number {
    let n = 0;
    for (const m of this.mercs.values()) if (m.owner === owner) n++;
    return n;
  }

  spawnEnemyAt(x: number, y: number, type = 1): number {
    return this.makeEnemy(x, y, type).id;
  }

  /** 접속한 플레이어의 평균 레벨(적 강화 기준) */
  private averageLevel(): number {
    let sum = 0;
    let n = 0;
    for (const sl of this.slots.values()) {
      if (sl.away) continue;
      sum += sl.state.level;
      n++;
    }
    return n > 0 ? sum / n : 1;
  }

  /** 지금 스테이지의 강화가 반영된 적을 만든다 */
  private makeEnemy(x: number, y: number, type: number, extra: Partial<Enemy> = {}): Enemy {
    const id = this.nextEntityId++;
    const st = ENEMY_STATS[type]!;
    const minutes = Math.min(this.stageTime, growSec()) / 60;
    const lv = this.averageLevel() - 1;
    const hpMult = (1 + TUNE.STAGE_ENEMY_HP_GROWTH * (this.stage - 1) + TUNE.ENEMY_TIME_HP_GROWTH * minutes + TUNE.ENEMY_LEVEL_HP_GROWTH * lv) * (extra.boss ? TUNE.BOSS_HP_BASE + TUNE.BOSS_HP_PER_STAGE * (this.stage - 1) : 1);
    const e: Enemy = {
      id, type, x, y,
      hp: st.hp * hpMult,
      maxHp: st.hp * hpMult,
      shield: st.shield * hpMult,
      shieldMax: st.shield * hpMult,
      dmgMult: (1 + TUNE.STAGE_ENEMY_DMG_GROWTH * (this.stage - 1) + TUNE.ENEMY_TIME_DMG_GROWTH * minutes + TUNE.ENEMY_LEVEL_DMG_GROWTH * lv) * (extra.boss ? TUNE.BOSS_DMG_MULT : 1),
      flankT: 0, evadeT: 0,
      atkT: 0, atkAng: 0, face: Math.atan2(-y, -x), cd: 0, regenT: 0, momentum: 0, chargeSnap: 0, // 처음에는 중앙(플레이어가 있는 쪽)을 본다
      boss: false, army: false, squad: 0, slotF: 0, slotL: 0,
      ...extra,
    };
    this.enemies.set(id, e);
    return e;
  }

  // --- 스테이지 ------------------------------------------------------------

  info(): GameInfo {
    let bossHp = 0;
    let armyLeft = 0;
    for (const e of this.enemies.values()) {
      if (e.army) armyLeft++;
      if (e.boss) bossHp = Math.max(1, Math.ceil((100 * e.hp) / e.maxHp));
    }
    return {
      stage: this.stage,
      phase: this.phase,
      timer: this.phase === "boss" ? this.bossTimer() : this.phase === "tournament" ? 0 : Math.ceil(Math.max(0, this.phaseT)),
      status: this.status,
      bossType: bossTypeOf(this.stage),
      bossHp,
      armyLeft,
      armyTotal: this.armyTotal,
      rage: this.phase === "boss" ? this.rage : 0,
      squads: this.squads.size,
      tour: this.phase === "tournament" ? this.tourInfo() : null,
    };
  }

  result(): { status: GameStatus; stage: number; time: number; players: ResultPlayer[] } {
    return {
      status: this.status,
      stage: this.stage,
      time: Math.round(this.time),
      players: [...this.slots.values()].map((s) => ({
        name: s.state.name,
        level: s.state.level,
        kills: s.state.kills,
        revives: s.revives,
        dealt: Math.round(s.stats.dealt),
        taken: Math.round(s.stats.taken),
        downs: s.stats.downs,
        mercDeaths: s.stats.mercDeaths,
        mercs: this.countMercs(s.state.id),
        gold: Math.round(s.stats.gold),
        wins: s.stats.wins,
        champion: s.stats.champion,
      })),
    };
  }

  /** 순간 효과를 가져가고 비운다 */
  takeEvents(): EventWire[] {
    const out = this.events;
    this.events = [];
    this.dmgIndex.clear();
    return out;
  }

  private pushEvent(kind: number, x: number, y: number, ang: number, val = 0, owner = 0): void {
    if (this.events.length < EVENT_CAP) this.events.push([kind, Math.round(x), Math.round(y), Math.round(ang * 100) / 100, val, owner]);
  }

  /** 피해 숫자 이벤트. 같은 대상에게 같은 종류로 한 틱에 여러 번 들어가면 합친다(전송량을 줄이고 숫자가 겹치지 않게). */
  private pushDamage(kind: number, targetId: number, x: number, y: number, amount: number, owner: number): void {
    if (amount <= 0.05 || owner <= 0) return;
    const key = `${kind}:${targetId}:${owner}`;
    const idx = this.dmgIndex.get(key);
    if (idx !== undefined) {
      this.events[idx]![4] = Math.round((this.events[idx]![4] + amount) * 10) / 10;
      return;
    }
    if (this.events.length >= EVENT_CAP) return;
    this.dmgIndex.set(key, this.events.length);
    this.pushEvent(kind, x, y, 0, Math.round(amount * 10) / 10, owner);
  }

  /** 테스트용: 성장 시간을 건너뛰고 곧바로 보스군을 부른다 */
  forceBoss(): void {
    if (this.phase === "grow") this.startArmy();
  }

  /** 테스트용: 해당 스테이지의 성장 단계 처음으로 이동한다 */
  jumpToStage(stage: number): void {
    this.stage = Math.max(1, Math.min(STAGE_COUNT, Math.floor(stage)));
    this.phase = "grow";
    this.phaseT = growSec();
    this.stageTime = 0;
    this.army = null;
    this.armyTotal = 0;
    this.squads.clear();
    this.squadTimer = SQUAD_FIRST;
  }

  private stepStage(dt: number): void {
    if (this.phase === "grow") {
      if (!this.autoSpawn) return;
      this.phaseT -= dt;
      this.stageTime += dt;
      if (this.phaseT <= 0) this.startArmy();
    } else if (this.phase === "boss") {
      this.stepArmy(dt);
      this.bossT += dt;
      if (this.autoSpawn && this.bossT >= TUNE.BOSS_TIMEOUT_SEC) {
        // 제한 시간 안에 장군을 못 잡으면 보스군이 격노한다: 간격마다 병력이 늘고 모두 강해진다
        this.rageT += dt;
        while (this.rageT >= TUNE.BOSS_RAGE_INTERVAL_SEC && this.rage < TUNE.BOSS_RAGE_MAX) {
          this.rageT -= TUNE.BOSS_RAGE_INTERVAL_SEC;
          this.enrageArmy();
        }
        // 격노해도 끝내 못 잡으면 강제로 다음 스테이지로(마지막 스테이지는 끝까지 잡아야 한다)
        if (TUNE.BOSS_HARD_TIMEOUT_SEC > 0 && this.bossT >= TUNE.BOSS_HARD_TIMEOUT_SEC && this.stage < STAGE_COUNT) this.skipBoss();
      }
    } else if (this.phase === "tournament") {
      this.stepTournament(dt);
    } else {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.stage++;
        this.squadTimer = SQUAD_FIRST;
        this.phase = "grow";
        this.phaseT = growSec();
        this.stageTime = 0;
      }
    }
  }

  /** 보스군 등장: 먼 곳에서 진형을 갖춘 채 병종별로 줄지어 행군해 온다 */
  private startArmy(): void {
    const alive = this.alivePlayers();
    if (alive.length === 0) return;
    this.phase = "boss";
    this.phaseT = 0;
    this.bossT = 0;
    this.rage = 0;
    this.rageT = 0;
    const cx = alive.reduce((a, s) => a + s.state.x, 0) / alive.length;
    const cy = alive.reduce((a, s) => a + s.state.y, 0) / alive.length;
    const layout = armyLayout(this.stage, armySize(this.stage, this.slots.size));
    const depth = Math.max(...layout.map((l) => -l.forward)) + 60;
    const reach = Math.max(...layout.map((l) => Math.abs(l.lateral))) + 60;
    const base = this.rng() * Math.PI * 2;
    // 진형 전체가 월드 안에 들어오는 방향을 고른다
    const half = WORLD_SIZE / 2 - 20;
    let chosen = { x: 0, y: 0, heading: 0 };
    let bestFit = -Infinity;
    for (let k = 0; k < 8; k++) {
      const ang = base + (k * Math.PI) / 4;
      const x = cx + Math.cos(ang) * ARMY_SPAWN_DISTANCE;
      const y = cy + Math.sin(ang) * ARMY_SPAWN_DISTANCE;
      const heading = ang + Math.PI;
      const hx = Math.cos(heading);
      const hy = Math.sin(heading);
      const corners = [
        [x - hx * depth + -hy * reach, y - hy * depth + hx * reach],
        [x - hx * depth - -hy * reach, y - hy * depth - hx * reach],
        [x + -hy * reach, y + hx * reach],
        [x - -hy * reach, y - hx * reach],
      ];
      const fit = -Math.max(...corners.map(([px, py]) => Math.max(Math.abs(px!) - half, Math.abs(py!) - half, 0)));
      if (fit > bestFit) {
        bestFit = fit;
        chosen = { x, y, heading };
      }
      if (fit === 0) break;
    }
    this.army = chosen;
    for (const slot of layout) {
      const [px, py] = this.armySlotPos(slot.forward, slot.lateral);
      this.makeEnemy(clampToWorld(px, 14), clampToWorld(py, 14), slot.type, {
        army: true,
        boss: slot.general,
        slotF: slot.forward,
        slotL: slot.lateral,
        face: chosen.heading,
      });
    }
    this.armyTotal = layout.length;
    this.armyBase = layout.length;
  }

  /** 보스 단계에서 화면에 보이는 시간: 격노 시작까지, 시작한 뒤에는 다음 격노 단계(또는 최대 단계면 강제 종료)까지 */
  private bossTimer(): number {
    if (this.bossT < TUNE.BOSS_TIMEOUT_SEC) return Math.ceil(TUNE.BOSS_TIMEOUT_SEC - this.bossT);
    if (this.rage < TUNE.BOSS_RAGE_MAX) return Math.max(0, Math.ceil(TUNE.BOSS_RAGE_INTERVAL_SEC - this.rageT));
    return 0;
  }

  /**
   * 보스군 격노: 증원이 합류하고(처음 병력의 일부, 병종은 보스군 비율대로) 살아 있는 보스군 전원이 강해진다.
   * 새로 합류한 병력도 지금 단계의 강화를 받는다.
   */
  private enrageArmy(): void {
    this.rage++;
    const p = 1 + TUNE.BOSS_RAGE_POWER;
    for (const e of this.enemies.values()) {
      if (!e.army) continue;
      e.maxHp *= p;
      e.hp *= p;
      e.shield *= p;
      e.shieldMax *= p;
      e.dmgMult *= p;
      e.rage = this.rage;
    }
    if (!this.army) return;
    const add = Math.max(3, Math.round(this.armyBase * TUNE.BOSS_RAGE_REINFORCE));
    const comp = armyComposition(this.stage, add);
    let minF = 0;
    for (const e of this.enemies.values()) if (e.army) minF = Math.min(minF, e.slotF);
    const types: number[] = [];
    comp.forEach((n, t) => { for (let k = 0; k < n; k++) types.push(t); });
    // 진형 맨 뒤에 새 줄을 만들어 합류한다
    const perRow = 8;
    types.forEach((type, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const inRow = Math.min(perRow, types.length - row * perRow);
      const f = minF - ARMY_RANK_SPACING * (row + 1);
      const l = (col - (inRow - 1) / 2) * ARMY_LATERAL_SPACING;
      const [px, py] = this.armySlotPos(f, l);
      const e = this.makeEnemy(clampToWorld(px, 14), clampToWorld(py, 14), type, { army: true, slotF: f, slotL: l, face: this.army!.heading });
      const k = Math.pow(p, this.rage);
      e.maxHp *= k;
      e.hp *= k;
      e.shield *= k;
      e.shieldMax *= k;
      e.dmgMult *= k;
      e.rage = this.rage;
    });
    this.armyTotal += types.length;
  }

  private armySlotPos(f: number, l: number, army: Army | null = this.army): [number, number] {
    const a = army!;
    const c = Math.cos(a.heading);
    const sn = Math.sin(a.heading);
    return [a.x + c * f - sn * l, a.y + sn * f + c * l];
  }

  /** 진형 기준점이 가장 가까운 살아 있는 주인공을 향해 천천히 행군한다 */
  private stepArmy(dt: number): void {
    if (this.army) this.marchArmy(this.army, dt, 1);
  }

  private marchArmy(a: Army, dt: number, speedMult: number): void {
    let near: PlayerState | null = null;
    let best = Infinity;
    for (const s of this.alivePlayers()) {
      const d = Math.hypot(s.state.x - a.x, s.state.y - a.y);
      if (d < best) {
        best = d;
        near = s.state;
      }
    }
    if (!near) return;
    const want = Math.atan2(near.y - a.y, near.x - a.x);
    const turn = 0.6 * dt;
    a.heading += Math.max(-turn, Math.min(turn, angleDiff(want, a.heading)));
    if (best > 60) {
      const speed = (best > ARMY_ENGAGE_DISTANCE ? ARMY_MARCH_SPEED : ARMY_MARCH_SPEED * 0.35) * speedMult;
      const step = Math.min(speed * dt, best - 60);
      a.x += Math.cos(a.heading) * step;
      a.y += Math.sin(a.heading) * step;
    }
  }

  /** 소대: 보스가 아닐 때도 가끔 진형을 갖춘 소규모 혼성 부대가 다가온다(성장 단계에서만) */
  private stepSquads(dt: number): void {
    for (const sq of this.squads.values()) this.marchArmy(sq.a, dt, SQUAD_MARCH_MULT);
    if (!this.autoSpawn || this.phase !== "grow") return;
    this.squadTimer -= dt;
    if (this.squadTimer > 0) return;
    this.squadTimer = Math.max(SQUAD_INTERVAL_MIN, TUNE.SQUAD_INTERVAL_BASE - SQUAD_INTERVAL_STAGE * this.stage);
    if (this.squads.size >= 2 + Math.floor(this.slots.size / 3)) return; // 한꺼번에 너무 많이 오지 않게
    this.spawnSquad();
  }

  /** 소대 한 개를 먼 곳에서 진형을 갖춘 채 등장시킨다. kind를 주면 그 구성(테스트용), 없으면 무작위. */
  spawnSquad(kindIndex?: number): number {
    const alive = this.alivePlayers();
    if (alive.length === 0) return 0;
    const kind = SQUAD_KINDS[kindIndex ?? Math.floor(this.rng() * SQUAD_KINDS.length)]!;
    const layout = squadLayout(squadComposition(kind, squadSize(this.stage, this.slots.size)));
    const target = alive[Math.floor(this.rng() * alive.length)]!.state;
    const half = WORLD_SIZE / 2 - 120;
    let ang = this.rng() * Math.PI * 2;
    let ax = 0;
    let ay = 0;
    for (let k = 0; k < 8; k++, ang += Math.PI / 4) {
      ax = target.x + Math.cos(ang) * SQUAD_SPAWN_DISTANCE;
      ay = target.y + Math.sin(ang) * SQUAD_SPAWN_DISTANCE;
      if (Math.abs(ax) < half && Math.abs(ay) < half) break;
    }
    ax = Math.max(-half, Math.min(half, ax));
    ay = Math.max(-half, Math.min(half, ay));
    const id = this.nextSquadId++;
    const a: Army = { x: ax, y: ay, heading: Math.atan2(target.y - ay, target.x - ax) };
    this.squads.set(id, { a, left: layout.length, size: layout.length });
    for (const slot of layout) {
      const [px, py] = this.armySlotPos(slot.forward, slot.lateral, a);
      this.makeEnemy(clampToWorld(px, 14), clampToWorld(py, 14), slot.type, { squad: id, slotF: slot.forward, slotL: slot.lateral, face: a.heading });
    }
    return id;
  }

  private onSquadMemberDown(id: number): void {
    const sq = this.squads.get(id);
    if (!sq) return;
    sq.left--;
    if (sq.left > 0) return;
    this.squads.delete(id);
    // 소대를 전멸시키면 모두에게 보상
    for (const sl of this.slots.values()) {
      const bonus = Math.round(SQUAD_CLEAR_GOLD * sq.size * sl.mods.bounty);
      sl.state.gold += bonus;
      sl.stats.gold += bonus;
    }
  }


  // --- 토너먼트 --------------------------------------------------------------------
  /** 지금 경기의 두 선수 번호(경기 중이 아니면 [0, 0]) */
  private tourPair(): [number, number] {
    const t = this.tour;
    const mt = t?.rounds[t.r]?.matches[t.m];
    return t && mt && t.step !== "end" ? [mt.a, mt.b] : [0, 0];
  }

  private opponentOf(owner: number): number {
    const [a, b] = this.tourPair();
    return owner === a ? b : owner === b ? a : 0;
  }

  /** 토너먼트 중 이 플레이어가 지금 경기의 선수인가 */
  private isFighter(id: number): boolean {
    const [a, b] = this.tourPair();
    return id !== 0 && (id === a || id === b);
  }

  /** 상대 선수의 주인공과 용병들(공격 대상) */
  private duelFoes(owner: number, all: Friendly[] = this.collectFriendlies()): Friendly[] {
    const opp = this.opponentOf(owner);
    return opp === 0 ? [] : all.filter((f) => f.ownerId === opp);
  }

  private tourName(id: number): string {
    return this.slots.get(id)?.state.name ?? "";
  }

  /** 보스를 잡은 직후: 남은 적과 상자를 뺀 모든 것을 정리하고 대진표를 짠 뒤 첫 경기를 연다 */
  private beginTournament(): void {
    const ids = [...this.slots.values()].filter((s) => !s.away).map((s) => s.state.id);
    if (ids.length < 2) {
      if (this.stage >= STAGE_COUNT) this.status = "victory";
      return;
    }
    this.enemies.clear();
    this.bullets = [];
    this.camps.clear();
    this.squads.clear();
    this.army = null;
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    let size = 2;
    while (size < ids.length) size *= 2;
    const list = [...ids, ...new Array<number>(size - ids.length).fill(0)];
    const rounds: Tournament["rounds"] = [];
    const count = Math.log2(size);
    for (let r = 0; r < count; r++) {
      const matches: TourMatch[] = [];
      for (let k = 0; k < size / 2 ** (r + 1); k++) matches.push({ a: 0, b: 0, an: "", bn: "", w: 0 });
      rounds.push({ title: tournamentRoundName(count - r), matches });
    }
    rounds[0]!.matches.forEach((mt, k) => {
      mt.a = list[k]!;
      mt.b = list[size - 1 - k]!;
      mt.an = this.tourName(mt.a);
      mt.bn = this.tourName(mt.b);
    });
    this.phase = "tournament";
    this.tour = { rounds, r: 0, m: 0, step: "intro", t: TUNE.TOURNAMENT_INTRO_SEC, winner: "", champion: "" };
    this.tourAdvance();
  }

  /** 다음 경기를 찾는다: 이미 끝났거나 부전승인 경기는 넘기고, 라운드가 끝나면 승자들로 다음 라운드를 채운다 */
  private tourAdvance(): void {
    const t = this.tour!;
    for (;;) {
      const round = t.rounds[t.r]!;
      if (t.m >= round.matches.length) {
        if (t.r >= t.rounds.length - 1) return this.tourFinalDone();
        const winners = round.matches.map((mt) => (mt.w === 1 ? mt.a : mt.w === 2 ? mt.b : 0));
        t.rounds[t.r + 1]!.matches.forEach((mt, i) => {
          mt.a = winners[2 * i]!;
          mt.b = winners[2 * i + 1]!;
          mt.an = this.tourName(mt.a);
          mt.bn = this.tourName(mt.b);
        });
        t.r++;
        t.m = 0;
        continue;
      }
      const mt = round.matches[t.m]!;
      const aHere = mt.a !== 0 && this.slots.has(mt.a);
      const bHere = mt.b !== 0 && this.slots.has(mt.b);
      if (mt.w !== 0 || !aHere || !bHere) {
        if (mt.w === 0) mt.w = bHere && !aHere ? 2 : 1; // 부전승(또는 나가 버린 쪽의 기권패)
        t.m++;
        continue;
      }
      this.tourSetup(mt);
      return;
    }
  }

  /** 경기 준비: 두 선수는 경기장 양끝에 서고 체력이 가득 찬다. 나머지는 경기장 가장자리에서 관전한다. */
  private tourSetup(mt: TourMatch): void {
    const t = this.tour!;
    t.step = "intro";
    t.t = TUNE.TOURNAMENT_INTRO_SEC;
    t.winner = "";
    let spectator = 0;
    const spectators = [...this.slots.values()].filter((s) => s.state.id !== mt.a && s.state.id !== mt.b);
    for (const s of this.slots.values()) {
      const p = s.state;
      let x: number;
      let y: number;
      if (p.id === mt.a || p.id === mt.b) {
        const west = p.id === mt.a;
        x = west ? -TOURNAMENT_START_DIST : TOURNAMENT_START_DIST;
        y = 0;
        s.facing = west ? 0 : Math.PI;
        p.aim = s.facing;
      } else {
        const ang = (spectator++ / Math.max(1, spectators.length)) * Math.PI + Math.PI * 1.1; // 경기장 아래쪽 가장자리를 따라
        x = Math.cos(ang) * (TOURNAMENT_ARENA_RADIUS + 90);
        y = Math.sin(ang) * (TOURNAMENT_ARENA_RADIUS + 90) * -1;
      }
      p.x = x;
      p.y = y;
      this.tourRestore(s);
    }
  }

  /** 주인공과 용병을 온전한 상태로 되돌리고 주인공 곁(진형 자리)에 세운다 */
  private tourRestore(s: Slot): void {
    const p = s.state;
    p.down = false;
    p.hp = p.maxHp;
    p.shield = p.shieldMax = TUNE.HERO_SHIELD_MAX + s.mods.heroShield;
    s.shieldIdle = 99;
    p.revive = 0;
    p.invuln = 0;
    p.swing = 0;
    p.wind = 0;
    p.chargeLeft = 0;
    p.shaken = 0;
    s.windT = 0;
    s.fireCd = 0;
    const slotsOf = this.formationSlots(p.id);
    for (const m of this.mercs.values()) {
      if (m.owner !== p.id) continue;
      const st = this.mercStats(m);
      m.hp = st.hp;
      m.shield = st.shield;
      m.regenT = 0;
      m.respawn = 0;
      m.atkT = 0;
      m.cd = 0;
      m.momentum = 0;
      m.evadeT = 0;
      m.chargeSnap = 0;
      const home = slotsOf.get(m.id);
      m.x = home?.[0] ?? p.x;
      m.y = home?.[1] ?? p.y;
      m.face = s.facing;
    }
  }

  /** 선수의 남은 전력(주인공 + 용병 체력 합 / 최대치 합) 0..1 */
  private tourPower(id: number): number {
    const s = this.slots.get(id);
    if (!s) return 0;
    let hp = s.state.down ? 0 : s.state.hp;
    let max = s.state.maxHp;
    for (const m of this.mercs.values()) {
      if (m.owner !== id) continue;
      hp += m.respawn > 0 ? 0 : Math.max(0, m.hp);
      max += this.mercStats(m).hp;
    }
    return max > 0 ? hp / max : 0;
  }

  private stepTournament(dt: number): void {
    const t = this.tour;
    if (!t) {
      this.phase = "break";
      this.phaseT = TUNE.STAGE_BREAK_SEC;
      return;
    }
    t.t -= dt;
    if (t.step === "intro") {
      if (t.t <= 0) {
        t.step = "fight";
        t.t = TUNE.TOURNAMENT_MATCH_SEC;
      }
      return;
    }
    if (t.step === "fight") {
      const mt = t.rounds[t.r]!.matches[t.m]!;
      const aOut = !this.slots.get(mt.a) || this.slots.get(mt.a)!.away || this.slots.get(mt.a)!.state.down;
      const bOut = !this.slots.get(mt.b) || this.slots.get(mt.b)!.away || this.slots.get(mt.b)!.state.down;
      if (aOut || bOut) {
        // 주인공이 쓰러진 쪽이 진다(동시에 쓰러지면 남은 용병이 많은 쪽)
        const aw = aOut && bOut ? this.tourPower(mt.a) >= this.tourPower(mt.b) : !aOut;
        return this.tourMatchDone(aw ? 1 : 2);
      }
      if (t.t <= 0) {
        const pa = this.tourPower(mt.a);
        const pb = this.tourPower(mt.b);
        this.tourMatchDone(pa === pb ? (this.rng() < 0.5 ? 1 : 2) : pa > pb ? 1 : 2); // 시간 초과: 남은 전력이 높은 쪽
      }
      return;
    }
    if (t.step === "outro") {
      if (t.t <= 0) {
        t.m++;
        this.tourAdvance();
      }
      return;
    }
    if (t.t <= 0) this.tourEnd();
  }

  private tourMatchDone(winner: 1 | 2): void {
    const t = this.tour!;
    const mt = t.rounds[t.r]!.matches[t.m]!;
    mt.w = winner;
    const id = winner === 1 ? mt.a : mt.b;
    const s = this.slots.get(id);
    t.winner = this.tourName(id);
    t.step = "outro";
    t.t = TOURNAMENT_OUTRO_SEC;
    if (s) {
      s.stats.wins++;
      const gold = TUNE.TOURNAMENT_WIN_GOLD * this.stage;
      s.state.gold += gold;
      s.stats.gold += gold;
    }
    this.bullets = [];
  }

  /** 결승이 끝났다: 우승·준우승 보상을 주고 우승자를 발표한다 */
  private tourFinalDone(): void {
    const t = this.tour!;
    const mt = t.rounds[t.rounds.length - 1]!.matches[0]!;
    const champ = mt.w === 2 ? mt.b : mt.a;
    const second = mt.w === 2 ? mt.a : mt.b;
    t.champion = this.tourName(champ);
    t.step = "end";
    t.t = TOURNAMENT_END_SEC;
    t.r = t.rounds.length - 1;
    t.m = 0;
    const cs = this.slots.get(champ);
    if (cs) {
      cs.stats.champion++;
      const gold = TUNE.TOURNAMENT_CHAMPION_GOLD * this.stage;
      cs.state.gold += gold;
      cs.stats.gold += gold;
      this.giveXp(champ, TUNE.TOURNAMENT_CHAMPION_XP * this.stage);
    }
    const ss = this.slots.get(second);
    if (ss) {
      const gold = TUNE.TOURNAMENT_RUNNERUP_GOLD * this.stage;
      ss.state.gold += gold;
      ss.stats.gold += gold;
    }
  }

  /** 토너먼트를 마치고 모두를 회복시킨 뒤 쉬는 시간으로 돌아간다. 마지막 스테이지라면 이것으로 승리한다. */
  private tourEnd(): void {
    for (const s of this.slots.values()) {
      this.tourRestore(s);
      s.state.invuln = 2;
    }
    this.tour = null;
    this.bullets = [];
    this.phase = "break";
    this.phaseT = TUNE.STAGE_BREAK_SEC;
    if (this.stage >= STAGE_COUNT) this.status = "victory";
  }

  tourInfo(): TourInfo | null {
    const t = this.tour;
    if (!t) return null;
    const mt = t.rounds[t.r]?.matches[t.m];
    const a = mt?.a ?? 0;
    const b = mt?.b ?? 0;
    return {
      title: t.rounds[t.r]?.title ?? "",
      step: t.step,
      t: Math.ceil(Math.max(0, t.t)),
      a,
      b,
      an: mt?.an ?? "",
      bn: mt?.bn ?? "",
      ha: Math.round(this.tourPower(a) * 100),
      hb: Math.round(this.tourPower(b) * 100),
      winner: t.winner,
      champion: t.champion,
      rounds: t.rounds.map((r) => ({ title: r.title, matches: r.matches.map((m): TourMatchInfo => ({ a: m.an, b: m.bn, w: m.w })) })),
      now: [t.r, t.m],
    };
  }


  /** 장군이 쓰러지면 스테이지 클리어: 남은 병사는 흩어져 일반 적이 되고, 보상과 쓰러진 동료의 부활이 주어진다 */
  private onBossDown(at: { x: number; y: number }): void {
    for (const e of this.enemies.values()) {
      e.army = false;
      e.boss = false;
    }
    this.army = null;
    this.dropChests(at.x, at.y);
    for (const s of this.slots.values()) {
      const bonus = Math.round(TUNE.STAGE_CLEAR_GOLD * this.stage * s.mods.bounty);
      s.state.gold += bonus;
      s.stats.gold += bonus;
      this.giveXp(s.state.id, TUNE.STAGE_CLEAR_XP + 15 * this.stage);
      if (s.state.down) this.standUp(s);
    }
    this.phase = "break";
    this.phaseT = TUNE.STAGE_BREAK_SEC;
    // 3·6·9·10 스테이지: 보스를 잡으면 남은 적을 모두 없애고 플레이어끼리 토너먼트를 연다(2명 이상일 때). 끝난 뒤에 승리 판정이 난다.
    if (isTournamentStage(this.stage) && this.slots.size >= 2) {
      this.tourPending = true;
      return;
    }
    if (this.stage >= STAGE_COUNT) this.status = "victory";
  }

  /** 보스를 못 잡고 제한 시간이 지났다: 보스군은 사라지고 보상 없이 다음 스테이지로 넘어간다 */
  private skipBoss(): void {
    for (const e of [...this.enemies.values()]) if (e.army) this.enemies.delete(e.id);
    this.army = null;
    for (const s of this.slots.values()) if (s.state.down) this.standUp(s);
    this.phase = "break";
    this.phaseT = TUNE.STAGE_BREAK_SEC;
  }

  /** 보스를 쓰러뜨린 자리 둘레에 접속한 인원 수만큼 상자를 떨어뜨린다. 상자마다 주인이 있다. */
  private dropChests(x: number, y: number): void {
    const owners = [...this.slots.values()].filter((s) => !s.away).map((s) => s.state.id);
    owners.forEach((owner, i) => {
      const ang = (i / owners.length) * Math.PI * 2 + 0.4;
      const id = this.nextEntityId++;
      const [cx, cy] = this.terrain?.pushOut(clampToWorld(x + Math.cos(ang) * 70, 20), clampToWorld(y + Math.sin(ang) * 70, 20), 24) ?? [clampToWorld(x + Math.cos(ang) * 70, 20), clampToWorld(y + Math.sin(ang) * 70, 20)]; // 바위 안에 묻히지 않게
      this.chests.set(id, {
        id,
        x: cx,
        y: cy,
        owner,
        left: TUNE.CHEST_LIFETIME_SEC,
      });
    });
  }

  /** 주인이 다가가면 상자가 열리고, 레벨업과 별개로 카드 한 장을 고른다(상자 카드는 높은 등급이 잘 나온다) */
  private stepChests(dt: number): void {
    for (const c of [...this.chests.values()]) {
      const s = this.slots.get(c.owner);
      if (!s) {
        this.chests.delete(c.id);
        continue;
      }
      if (this.phase !== "tournament") c.left -= dt;
      if (c.left <= 0) {
        this.chests.delete(c.id);
        continue;
      }
      const p = s.state;
      if (p.down || s.away || Math.hypot(p.x - c.x, p.y - c.y) > CHEST_OPEN_RADIUS) continue;
      this.chests.delete(c.id);
      p.pending++;
      p.box++;
      p.offer = this.rollOffer(s); // 지금 떠 있던 선택지가 있어도 상자 카드로 다시 뽑는다
      this.pushEvent(EVT_REVIVE, c.x, c.y, 0);
    }
  }

  /** 주문을 외우는 중인 운석(낙하 예고 표시용) */
  snapshotMeteors(): MeteorWire[] {
    const out: MeteorWire[] = [];
    for (const [key, c] of this.casts) {
      const remaining = key < 0 ? this.slots.get(-key)?.windT ?? 0 : this.mercs.get(key)?.atkT ?? this.enemies.get(key)?.atkT ?? 0;
      if (remaining <= 0) continue;
      const owner = key < 0 ? -key : this.mercs.get(key)?.owner ?? 0; // 0이면 적의 운석
      out.push([key, round(c.x), round(c.y), Math.round(100 * Math.max(0, Math.min(1, 1 - remaining / c.total))), Math.round(c.radius), owner, Math.round(c.total * 10)]);
    }
    return out;
  }

  snapshotChests(): ChestWire[] {
    return [...this.chests.values()].map((c) => [c.id, round(c.x), round(c.y), c.owner, Math.ceil(c.left)]);
  }

  addMerc(owner: number, type: number, x: number, y: number, paid = 0, tier = 0): number {
    const id = this.nextEntityId++;
    const merc: Merc = { id, type, owner, x, y, hp: MERC_STATS[type]!.hp, atkT: 0, atkAng: 0, face: 0, cd: 0, respawn: 0, paid, evadeT: 0, flankT: 0, tier, nameId: this.pickName(owner), xp: 0, shield: 0, regenT: 0, momentum: 0, chargeSnap: 0 };
    this.mercs.set(id, merc);
    merc.hp = this.mercStats(merc).hp; // 이미 받은 강화가 반영된 체력으로 시작한다
    merc.shield = this.mercStats(merc).shield;
    return id;
  }

  spawnCampAt(x: number, y: number, offers: number[]): number {
    const id = this.nextEntityId++;
    this.camps.set(id, { id, x, y, left: TUNE.CAMP_LIFETIME_SEC, offers });
    return id;
  }

  /** 같은 주인의 용병끼리 이름이 겹치지 않게 무작위로 짓는다 */
  private pickName(owner: number): number {
    const used = new Set<number>();
    for (const m of this.mercs.values()) if (m.owner === owner) used.add(m.nameId);
    let id = 0;
    for (let i = 0; i < 20; i++) {
      id = Math.floor(this.rng() * MERC_NAME_COUNT);
      if (!used.has(id)) break;
    }
    return id;
  }

  private gainMercXp(m: Merc, amount: number): void {
    if (amount <= 0 || m.tier >= MAX_TIER) return;
    const mods = this.slots.get(m.owner)?.mods;
    const gain = amount * (mods ? mstat(mods, m.type, "xp") : 1); // 경험치 획득 능력
    m.xp = Math.min(mercXpNeed(m.tier) * MERC_XP_OVERFLOW, m.xp + gain);
  }

  getMerc(id: number): Readonly<Merc> | undefined {
    return this.mercs.get(id);
  }

  getEnemy(id: number): Readonly<Enemy> | undefined {
    return this.enemies.get(id);
  }

  getPlayer(id: number): PlayerState | undefined {
    return this.slots.get(id)?.state;
  }

  /** 용병 진형 자리(테스트용). 주인공 기준으로 플레이어가 고른 진형(병종별 구역·간격)대로 배치되고, 병종마다 자기 진형 모드(기본·돌격·지점 방어)에 따라 기준점이 다르다. */
  formationSlots(owner: number): Map<number, [number, number]> {
    const s = this.slots.get(owner);
    const out = new Map<number, [number, number]>();
    if (!s) return out;
    const alive = [...this.mercs.values()].filter((m) => m.owner === owner && m.respawn <= 0);
    const typeOf = new Map(alive.map((m) => [m.id, m.type]));
    const rel = layoutFormation(alive, s.zones, s.spacing);
    for (const [id, [fwd, lat]] of rel) {
      const t = typeOf.get(id) ?? 0;
      const stance = s.stances[t] ?? STANCE_DEFEND;
      // 지점 방어: 진형을 주인공이 아니라 지정한 지점에 편다(토너먼트에서는 쓰지 않는다)
      const hold = stance === STANCE_HOLD && this.phase !== "tournament";
      const face = hold ? s.holdFacings[t]! : s.facing;
      const ox = hold ? s.holdPts[t]![0] : s.state.x;
      const oy = hold ? s.holdPts[t]![1] : s.state.y;
      const fx = Math.cos(face);
      const fy = Math.sin(face);
      const adv = stance === STANCE_ASSAULT ? TUNE.ASSAULT_ADVANCE : 0; // 돌격 진형은 대열이 앞으로 나간다
      out.set(id, [clampToWorld(ox + fx * (fwd + adv) - fy * lat, 24), clampToWorld(oy + fy * (fwd + adv) + fx * lat, 24)]); // 진형 자리가 맵 밖이면 가장자리로
    }
    return out;
  }

  /** 병종 비트마스크(UNIT_TYPES 번호별 1<<t)를 정리한다. 없거나 잘못되면 전체 */
  private typeMask(types: unknown): number {
    const all = (1 << UNIT_TYPES.length) - 1;
    return typeof types === "number" && Number.isInteger(types) && (types & all) !== 0 ? types & all : all;
  }

  /** 상태 표시용 요약 값을 갱신한다: 모든 병종의 진형이 같으면 그 값 */
  private syncStance(sl: Slot): void {
    if (sl.stances.every((v) => v === sl.stances[0])) sl.state.stance = sl.stances[0]!;
    sl.state.stances = [...sl.stances];
    sl.state.holds = sl.holdPts.flatMap((p) => [Math.round(p[0]), Math.round(p[1])]);
  }

  /** 용병 진형 모드(기본 / 돌격 / 지점 방어)를 바꾼다. types로 병종을 고를 수 있다(생략하면 전체). */
  setStance(playerId: number, v: unknown, types?: unknown): boolean {
    const sl = this.slots.get(playerId);
    if (!sl || (v !== STANCE_DEFEND && v !== STANCE_ASSAULT && v !== STANCE_HOLD)) return false;
    const mask = this.typeMask(types);
    if (v === STANCE_HOLD) {
      // 지점을 정한 적이 없는 병종은 주인공 앞쪽에 지점을 둔다
      const need = UNIT_TYPES.filter((t) => mask & (1 << t) && !sl.holdSets[t]).reduce<number>((m, t) => m | (1 << t), 0);
      if (need) this.setHold(playerId, sl.state.x + Math.cos(sl.facing) * 120, sl.state.y + Math.sin(sl.facing) * 120, need);
    }
    for (const t of UNIT_TYPES) if (mask & (1 << t)) sl.stances[t] = v;
    this.syncStance(sl);
    return true;
  }

  /** 지점 방어: 이 지점에 진형을 펴고 지키도록 지시한다(types로 병종을 고를 수 있다) */
  setHold(playerId: number, x: unknown, y: unknown, types?: unknown): boolean {
    const sl = this.slots.get(playerId);
    if (!sl || typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const mask = this.typeMask(types);
    const hx = clampToWorld(x, 60);
    const hy = clampToWorld(y, 60);
    const d = Math.hypot(hx - sl.state.x, hy - sl.state.y);
    const face = d > 40 ? Math.atan2(hy - sl.state.y, hx - sl.state.x) : sl.facing; // 주인공에서 바깥쪽을 보고 선다
    for (const t of UNIT_TYPES) {
      if (!(mask & (1 << t))) continue;
      sl.holdPts[t] = [Math.round(hx), Math.round(hy)];
      sl.holdFacings[t] = face;
      sl.holdSets[t] = true;
      sl.stances[t] = STANCE_HOLD;
    }
    if (mask === (1 << UNIT_TYPES.length) - 1) {
      sl.state.holdX = Math.round(hx);
      sl.state.holdY = Math.round(hy);
    }
    this.syncStance(sl);
    return true;
  }

  setFormation(playerId: number, raw: unknown): boolean {
    const s = this.slots.get(playerId);
    const f = sanitizeFormation(raw);
    if (!s || !f) return false;
    s.zones = f.zones;
    s.spacing = f.spacing;
    return true;
  }

  // --- 내부 ------------------------------------------------------------

  private placeAtSpawn(p: PlayerState, id: number): void {
    // 겹치지 않게 중앙 주변에 원형으로 배치
    const angle = (id * Math.PI * 2) / MAX_PLAYERS;
    p.x = Math.cos(angle) * 80;
    p.y = Math.sin(angle) * 80;
  }

  private alivePlayers(): Slot[] {
    return [...this.slots.values()].filter((s) => !s.state.down);
  }

  private stepPlayers(dt: number): void {
    for (const s of this.slots.values()) {
      const p = s.state;
      for (const key of Object.keys(s.hasteT)) {
        s.hasteT[key]! -= dt;
        if (s.hasteT[key]! <= 0) {
          delete s.hasteT[key];
          delete s.haste[key];
        }
      }
      if (p.down) {
        p.chargeLeft = 0;
        s.windT = 0;
        p.wind = 0;
        continue;
      }
      p.invuln = Math.max(0, p.invuln - dt);
      s.fireCd = Math.max(0, s.fireCd - dt);
      p.chargeLeft = Math.max(0, p.chargeLeft - dt);
      const mounted = WEAPONS[p.weapon]!.type === CAVALRY; // 기마: 달릴수록 빨라진다
      p.hp = Math.min(p.maxHp, p.hp + s.mods.heroRegen * dt);
      p.shieldMax = TUNE.HERO_SHIELD_MAX + s.mods.heroShield;
      s.shieldIdle += dt;
      if (s.shieldIdle >= s.shieldDelay) p.shield = Math.min(p.shieldMax, p.shield + p.shieldMax * TUNE.HERO_SHIELD_REGEN_PCT * (1 + s.mods.heroShieldRegen) * dt);
      const duel = this.phase === "tournament";
      const fighter = duel && this.isFighter(p.id);
      // 토너먼트: 선수는 경기 시작 전·후에는 움직일 수 없고, 경기장 밖으로 나갈 수 없다. 선수가 아니면 싸울 수 없다.
      const frozen = fighter && this.tour?.step !== "fight";
      const casting = s.windT > 0 && WEAPONS[p.weapon]!.type === MAGE; // 주문을 외우는 동안은 움직일 수 없다
      const moving = !frozen && !casting && (s.input.dx !== 0 || s.input.dy !== 0);
      s.mom = mounted && moving ? Math.min(1, s.mom + dt / TUNE.CAV_RAMP_SEC) : Math.max(0, s.mom - dt / CAV_DECAY_SEC);
      const speed = this.heroSpeedNow(s);
      if (!frozen && !casting) {
        p.x = clampToWorld(p.x + s.input.dx * speed * dt, PLAYER_RADIUS);
        p.y = clampToWorld(p.y + s.input.dy * speed * dt, PLAYER_RADIUS);
      }
      if (fighter) {
        const r = Math.hypot(p.x, p.y);
        if (r > TOURNAMENT_ARENA_RADIUS) {
          p.x *= TOURNAMENT_ARENA_RADIUS / r;
          p.y *= TOURNAMENT_ARENA_RADIUS / r;
        }
      }
      p.aim = s.input.aim;
      const turn = FORMATION_TURN_RATE * dt;
      s.facing += Math.max(-turn, Math.min(turn, angleDiff(p.aim, s.facing)));
      s.switchCd = Math.max(0, s.switchCd - dt);
      p.swing = Math.max(0, p.swing - dt);
      if (s.windT > 0) {
        const wc = this.casts.get(-p.id);
        if (wc && s.windT > TUNE.MAGE_LOCK_SEC) {
          // 주문을 외우는 동안은 마우스를 따라 낙하 지점이 움직이고, 마지막 순간에 고정된다
          const [tx, ty] = this.heroSpot(s, WEAPONS[p.weapon]!);
          const dx = tx - wc.x;
          const dy = ty - wc.y;
          const dl = Math.hypot(dx, dy);
          const stepLen = Math.min(dl, 900 * dt);
          if (dl > 0.001) {
            wc.x += (dx / dl) * stepLen;
            wc.y += (dy / dl) * stepLen;
          }
        }
        s.windT -= dt;
        p.wind = Math.max(0, s.windT);
        if (s.windT <= 0) {
          s.windT = 0;
          p.wind = 0;
          this.strikeHero(s);
        }
      } else if (s.input.fire && s.fireCd <= 0 && s.switchCd <= 0 && (!duel || (fighter && this.tour?.step === "fight"))) this.useWeapon(s);
    }
    if (this.phase !== "tournament") this.stepRevive(dt);
  }

  /** 지금 주인공의 이동 속도(기마면 달린 만큼 빨라진다) */
  private heroSpeedNow(s: Slot): number {
    const base = TUNE.PLAYER_SPEED * s.mods.heroSpeed;
    return WEAPONS[s.state.weapon]!.type === CAVALRY ? base * (1 + (TUNE.MOUNT_SPEED_MAX - 1) * s.mom) : base;
  }

  /** 되돌려받은 피해(창병에게 돌격하면 자신에게 돌아온다)를 주인공이 입는다 */
  private hurtHeroReflect(s: Slot, amount: number): void {
    if (amount <= 0 || s.state.down) return;
    this.pushDamage(EVT_REFLECT, 0, s.state.x, s.state.y, amount, s.state.id);
    const f = this.collectFriendlies().find((x) => x.ownerId === s.state.id && !x.merc);
    f?.hit({ damage: amount, charge: 0, srcType: SPEAR, fromAngle: 0, dot: true });
  }

  /** 쓰러진 동료 곁에서 부활 키를 누르고 있으면 진행도가 차오르고, 떼면 서서히 줄어든다 */
  private stepRevive(dt: number): void {
    for (const d of this.slots.values()) {
      const dp = d.state;
      if (!dp.down) continue;
      const helper = [...this.slots.values()].find(
        (r) => !r.state.down && !r.away && r.input.revive && Math.hypot(r.state.x - dp.x, r.state.y - dp.y) <= REVIVE_RADIUS,
      );
      if (!helper) {
        dp.revive = Math.max(0, dp.revive - (dt / TUNE.REVIVE_SEC) * REVIVE_DECAY_FACTOR);
        continue;
      }
      dp.revive = Math.min(1, dp.revive + dt / TUNE.REVIVE_SEC);
      if (dp.revive >= 1) {
        this.standUp(d);
        helper.revives++;
      }
    }
  }

  private standUp(s: Slot): void {
    const p = s.state;
    p.down = false;
    p.revive = 0;
    p.hp = Math.max(1, Math.round(p.maxHp * REVIVE_HP_FRAC));
    p.invuln = REVIVE_INVULN_SEC;
    p.shield = p.shieldMax = TUNE.HERO_SHIELD_MAX + s.mods.heroShield;
    s.shieldIdle = 99;
    this.pushEvent(EVT_REVIVE, p.x, p.y, 0);
  }

  /** 주인공 공격. 활은 투사체를 쏘고, 나머지는 조준 방향 부채꼴을 즉시 휘두른다. 무기마다 방패·범위 규칙이 다르다. */
  private useWeapon(s: Slot): void {
    const p = s.state;
    const w = WEAPONS[p.weapon]!;
    const rate = s.mods.heroFireRate * (1 + LEGEND_CONST.warcryStep * (s.haste.hero ?? 0));
    if (!w.ranged && w.windup > 0) {
      // 준비 동작: 이 동안은 움직일 수 있지만 공격은 나가지 않고, 끝나는 순간 조준 방향으로 휘두른다
      s.windT = (w.windup * (w.type === MAGE ? Math.max(CAST_TIME_MIN_MULT, s.mods.heroCast) : 1)) / rate;
      p.wind = s.windT;
      s.fireCd = s.windT + w.cooldown / rate;
      if (w.type === MAGE) {
        const [x, y] = this.heroSpot(s, w);
        this.casts.set(-p.id, { x, y, total: s.windT, radius: w.splash * s.mods.heroArea });
      }
      return;
    }
    this.strikeHero(s);
  }

  /** 주인공 공격이 실제로 나가는 순간 */
  private strikeHero(s: Slot): void {
    const p = s.state;
    const w = WEAPONS[p.weapon]!;
    const crit = this.rollCrit(s.mods.heroCrit);
    const damage = w.damage * s.mods.heroDmg * (crit ? s.mods.heroCritMult : 1);
    const reach = meleeReach(w.type, w.reach * s.mods.heroRange, s.mods.heroArea);
    if (w.windup <= 0 || w.ranged) s.fireCd = w.cooldown / (s.mods.heroFireRate * (1 + LEGEND_CONST.warcryStep * (s.haste.hero ?? 0)));
    if (crit && hasLegend(s.mods, "stormfire", "hero")) s.fireCd = 0; // 폭풍 연사: 치명타면 곧바로 다음 공격
    if (w.type === MAGE) {
      const cast = this.casts.get(-p.id);
      this.casts.delete(-p.id);
      if (cast) this.landMeteor(cast.x, cast.y, cast.radius, damage, p.id, crit);
      return;
    }
    if (w.ranged) {
      const n = 1 + Math.round(s.mods.heroMulti);
      for (let i = 0; i < n; i++) {
        const ang = p.aim + fanOffset(i, n);
        this.bullets.push({
          id: this.nextEntityId++,
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * BULLET_SPEED,
          vy: Math.sin(ang) * BULLET_SPEED,
          left: reach,
          hostile: false,
          damage: i === 0 ? damage : damage * TUNE.MULTISHOT_DAMAGE,
          srcType: w.type,
          owner: p.id,
          radius: BULLET_RADIUS,
          pierce: s.mods.heroPierce,
          crit,
          poison: s.mods.heroPoison,
          hitIds: new Set(),
        });
      }
      return;
    }
    p.swing = SWING_VISUAL_SEC;
    const arc = meleeArc(w.type, w.arc, s.mods.heroArea);
    // 기마: 지금 속도에 비례한 돌격 피해가 붙고, 공격하면 속도를 잃는다
    const charge = w.type === CAVALRY ? TUNE.CAV_DAMAGE_PER_SPEED * this.heroSpeedNow(s) : 0;
    if (w.type === CAVALRY) s.mom *= CAV_MOMENTUM_AFTER_HIT;
    let reflected = 0;
    if (this.phase === "tournament") {
      // 토너먼트: 상대 선수의 주인공과 용병이 대상이다
      const foes = this.duelFoes(p.id);
      const hitFoes: Friendly[] = [];
      for (const f of foes) {
        if (w.type === SPEAR) {
          if (!inSpearBox(p.x, p.y, p.aim, f.x, f.y, f.radius, reach, s.mods.heroArea)) continue;
        } else {
          if (Math.hypot(f.x - p.x, f.y - p.y) > reach + f.radius) continue;
          if (Math.abs(angleDiff(Math.atan2(f.y - p.y, f.x - p.x), p.aim)) > arc) continue;
        }
        hitFoes.push(f);
      }
      for (const f of hitFoes) reflected += f.hit({ damage, charge, srcType: w.type, fromAngle: Math.atan2(p.y - f.y, p.x - f.x), crit });
      if (w.splash > 0) {
        const radius = w.splash * s.mods.heroArea;
        for (const f of foes) {
          if (hitFoes.includes(f) || !hitFoes.some((h) => Math.hypot(f.x - h.x, f.y - h.y) <= radius + f.radius)) continue;
          f.hit({ damage: damage * this.splashFactor(s.mods, "hero"), charge: 0, srcType: w.type, fromAngle: Math.atan2(p.y - f.y, p.x - f.x), crit });
        }
      }
      this.hurtHeroReflect(s, reflected);
      return;
    }
    const struck: Enemy[] = [];
    for (const e of this.enemies.values()) {
      if (w.type === SPEAR) {
        // 창: 앞으로 뻗은 직사각형(가까운 쪽이 넓고 끝이 좁다)
        if (!inSpearBox(p.x, p.y, p.aim, e.x, e.y, radiusOf(e), reach, s.mods.heroArea)) continue;
      } else {
        if (Math.hypot(e.x - p.x, e.y - p.y) > reach + radiusOf(e)) continue;
        if (Math.abs(angleDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim)) > arc) continue;
      }
      struck.push(e);
    }
    for (const e of struck) reflected += this.damageEnemy(e, { damage, charge, srcType: w.type, fromAngle: Math.atan2(p.y - e.y, p.x - e.x), crit }, p.id);
    if (w.splash > 0) this.splashEnemies(struck, w.splash * s.mods.heroArea, damage * this.splashFactor(s.mods, "hero"), w.type, p.x, p.y, p.id);
    this.hurtHeroReflect(s, reflected);
  }

  /** 회피 판정: 피했으면 true(효과 표시를 띄운다) */
  private dodged(chance: number, x: number, y: number, owner = 0): boolean {
    if (chance <= 0 || this.rng() >= Math.min(DODGE_MAX, chance)) return false;
    this.pushEvent(EVT_DODGE, x, y, 0, 0, owner);
    return true;
  }

  private splashFactor(mods: Mods, scope: LegendScope): number {
    return TUNE.SPLASH_FACTOR * (hasLegend(mods, "splashBoost", scope) ? LEGEND_CONST.splashMult : 1);
  }

  /** 치명타 판정(공격 한 번에 한 번) */
  private rollCrit(chance: number): boolean {
    return chance > 0 && this.rng() < Math.min(CRIT_MAX_CHANCE, chance);
  }

  /** 무기를 바꾼다. 바꾼 직후에는 잠깐 공격할 수 없다. */
  setWeapon(playerId: number, index: unknown): boolean {
    const s = this.slots.get(playerId);
    if (!s || typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= WEAPONS.length) return false;
    if (s.state.weapon === index) return false;
    s.state.weapon = index;
    s.switchCd = WEAPON_SWITCH_DELAY_SEC;
    s.windT = 0;
    s.state.wind = 0;
    s.fireCd = Math.min(s.fireCd, WEAPON_SWITCH_DELAY_SEC);
    return true;
  }

  private stepCamps(dt: number): void {
    for (const c of [...this.camps.values()]) {
      c.left -= dt;
      if (c.left <= 0) this.camps.delete(c.id);
    }
    if (!this.autoSpawn) return;
    this.campTimer -= dt;
    const alive = this.alivePlayers();
    if (this.campTimer > 0 || alive.length === 0) return;
    this.campTimer = TUNE.CAMP_SPAWN_INTERVAL_SEC;
    if (this.camps.size >= Math.min(CAMP_MAX, Math.ceil(alive.length / 2) + 1)) return;
    for (let attempt = 0; attempt < 6; attempt++) {
      const around = alive[Math.floor(this.rng() * alive.length)]!.state;
      const angle = this.rng() * Math.PI * 2;
      const dist = 320 + this.rng() * 200;
      const x = clampToWorld(around.x + Math.cos(angle) * dist, 150);
      const y = clampToWorld(around.y + Math.sin(angle) * dist, 150);
      if ([...this.camps.values()].some((c) => Math.hypot(c.x - x, c.y - y) < 300)) continue;
      if (this.terrain?.blocked(x, y, 90)) continue; // 바위·고지대 위에는 캠프를 세우지 않는다
      this.spawnCampAt(x, y, this.pickOffers());
      return;
    }
  }

  /** 캠프 선택지: 시간이 지날수록 높은 단계 용병이 섞여 나온다(그만큼 비싸고 통솔력도 더 든다) */
  private pickOffers(): number[] {
    const pool: number[] = [...UNIT_TYPES];
    const cap = campMaxTier(this.time);
    const offers: number[] = [];
    while (offers.length < CAMP_OFFERS && pool.length > 0) {
      const type = pool.splice(Math.floor(this.rng() * pool.length), 1)[0]!;
      const tier = cap === 0 ? 0 : this.rng() < 0.45 ? cap : Math.floor(this.rng() * (cap + 1));
      offers.push(encodeOffer(type, tier));
    }
    return offers;
  }

  private spawnEnemies(dt: number): void {
    if (!this.autoSpawn) return;
    const alive = this.alivePlayers();
    if (alive.length === 0) return;
    if (this.phase === "break") return;
    const stageMult = (1 + TUNE.STAGE_SPAWN_GROWTH * (this.stage - 1)) * (this.phase === "boss" ? 0.25 : 1);
    const perPlayer = (TUNE.ENEMY_SPAWN_BASE_PER_SEC + TUNE.ENEMY_SPAWN_GROWTH_PER_SEC * this.stageTime) * stageMult;
    // 인원이 늘수록 적도 늘지만, 아군 전력도 함께 늘어나므로 인원 수에 정비례시키지는 않는다
    this.spawnBudget += perPlayer * Math.pow(alive.length, 0.75) * dt;
    // 적 마법사는 일정 스테이지부터 낮은 생성 비율로만 나온다(수 제한은 없다)
    const weights = [...(ENEMY_SPAWN_WEIGHTS as readonly number[])];
    if (this.stage < TUNE.ENEMY_MAGE_FROM_STAGE) weights[MAGE] = 0;
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    while (this.spawnBudget >= 1) {
      this.spawnBudget -= 1;
      if (this.enemies.size >= ENEMY_MAX) continue;
      const target = alive[Math.floor(this.rng() * alive.length)]!.state;
      const angle = this.rng() * Math.PI * 2;
      let roll = this.rng() * totalWeight;
      let type = 0;
      while (type < weights.length - 1 && roll >= weights[type]!) roll -= weights[type++]!;
      this.spawnEnemyAt(
        clampToWorld(target.x + Math.cos(angle) * ENEMY_SPAWN_DISTANCE, 14),
        clampToWorld(target.y + Math.sin(angle) * ENEMY_SPAWN_DISTANCE, 14),
        type,
      );
    }
  }

  private collectFriendlies(): Friendly[] {
    const list: Friendly[] = [];
    for (const s of this.slots.values()) {
      if (s.state.down || s.away) continue;
      const p = s.state;
      list.push({
        x: p.x,
        y: p.y,
        radius: PLAYER_RADIUS,
        ownerId: p.id,
        hit: (h) => {
          if (p.invuln > 0) return 0; // 부활 직후 잠깐 무적
          if (!h.dot && !h.pierceGuard && this.dodged(s.mods.heroDodge, p.x, p.y, p.id)) return 0;
          // 창을 들면 창병처럼 돌격을 반사하고, 검을 들면 정면 피해를 절반으로 막는다
          const w = WEAPONS[p.weapon]!;
          const r = h.dot || h.pierceGuard
            ? DOT_RESULT(h.damage)
            : resolveHit(
                { type: NO_TYPE, spearStance: w.type === SPEAR, shield: w.type === SHIELD ? p.shield : 0, face: p.aim, frontBlock: w.type === SHIELD ? HERO_SWORD_FRONT_BLOCK : undefined },
                h,
              );
          if (w.type === SHIELD && r.shield > 0) {
            // 방패가 받아 낸 만큼 깎인다
            p.shield = r.shieldBroke ? 0 : Math.max(0, p.shield - r.shield);
            this.pushEvent(r.shieldBroke ? EVT_SHIELD_BREAK : EVT_SHIELD_BLOCK, p.x, p.y, p.aim);
          }
          if (r.body > 0 || r.shield > 0) {
            // 맞으면(몸이든 방패든) 한동안 방패가 차오르지 않는다. 깨졌으면 더 오래 걸린다.
            s.shieldIdle = 0;
            s.shieldDelay = p.shield <= 0 ? TUNE.HERO_SHIELD_BROKEN_DELAY : TUNE.HERO_SHIELD_REGEN_DELAY;
          }
          if (h.poison && h.poison > 0 && r.body > 0) this.poisonFriendly(-p.id, h.poison); // 토너먼트: 몸에 맞은 독 화살
          const taken = this.armorCut(r.body, s.mods.heroArmor) * (1 - Math.min(DEFENSE_MAX, s.mods.heroDefense)) * this.damageTakenMult(p.id); // 고정 감소가 먼저, 방어력(%)은 그다음
          p.hp -= taken;
          s.stats.taken += taken;
          this.pushDamage(EVT_DMG_ALLY, -p.id, p.x, p.y, taken, p.id); // 주인공은 음수 번호(용병 번호와 겹치지 않게)
          this.thorns(s, h, taken);
          if (p.hp <= 0) {
            p.hp = 0;
            p.down = true;
            s.stats.downs++;
            p.revive = 0;
            p.chargeLeft = 0;
          }
          return r.reflected;
        },
      });
    }
    for (const m of this.mercs.values()) {
      if (m.respawn > 0) continue;
      list.push({
        x: m.x,
        y: m.y,
        radius: MERC_STATS[m.type]!.radius,
        ownerId: m.owner,
        merc: m,
        hit: (h) => {
          if (m.respawn > 0 || m.hp <= 0) return 0; // 이미 쓰러졌다
          const mods = this.slots.get(m.owner)?.mods;
          if (!h.dot && !h.pierceGuard && this.dodged(mods ? mstat(mods, m.type, "dodge") : 0, m.x, m.y, m.owner)) return 0;
          const r = h.dot || h.pierceGuard ? DOT_RESULT(h.damage) : resolveHit({ type: m.type, shield: m.shield, face: m.face }, h);
          this.applyShield(m, r.shield, r.shieldBroke);
          if (h.poison && h.poison > 0 && r.body > 0) this.poisonFriendly(m.id, h.poison);
          const taken = this.armorCut(r.body, mods ? mstat(mods, m.type, "armor") : 0) * (1 - Math.min(DEFENSE_MAX, mods ? mstat(mods, m.type, "defense") : 0)) * this.damageTakenMult(m.owner);
          this.hurtMerc(m, taken);
          if (mods) this.slots.get(m.owner)!.stats.taken += taken;
          this.pushDamage(EVT_DMG_ALLY, m.id, m.x, m.y, taken, m.owner);
          this.thorns(this.slots.get(m.owner), h, taken, m);
          return r.reflected;
        },
      });
    }
    return list;
  }

  /** 방패 체력을 깎는다. 다 깎이면 깨지고, 일정 시간 뒤 재생된다. */
  private applyShield(f: Fighter, amount: number, broke: boolean): void {
    if (amount <= 0) return;
    f.shield = Math.max(0, f.shield - amount);
    if (broke || f.shield <= 0) {
      f.shield = 0;
      f.regenT = TUNE.SHIELD_REGEN_SEC;
      this.pushEvent(EVT_SHIELD_BREAK, f.x, f.y, f.face);
    } else {
      this.pushEvent(EVT_SHIELD_BLOCK, f.x, f.y, f.face);
    }
  }

  private regenShield(f: Fighter, max: number, dt: number): void {
    if (f.regenT <= 0) return;
    f.regenT -= dt;
    if (f.regenT <= 0) {
      f.regenT = 0;
      f.shield = max;
    }
  }

  private hurtMerc(m: Merc, amount: number): void {
    if (amount <= 0) return;
    this.gainMercXp(m, amount * MERC_XP_PER_HURT); // 맞을 때도 조금씩
    m.hp -= amount;
    if (m.hp > 0) return;
    const owner = this.slots.get(m.owner);
    // 불사의 군단: 쓰러지는 순간 확률로 체력 절반으로 되살아난다
    if (owner && hasLegend(owner.mods, "undying", m.type) && this.rng() < LEGEND_CONST.undyingChance) {
      m.hp = Math.max(1, this.mercStats(m).hp * 0.5);
      this.pushEvent(EVT_REVIVE, m.x, m.y, 0);
      return;
    }
    m.hp = 0;
    m.respawn = MERC_RESPAWN_SEC[m.type]! * (1 + TIER_RESPAWN_EXTRA * m.tier) * (owner ? mstat(owner.mods, m.type, "respawn") : 1);
    if (owner) {
      owner.stats.mercDeaths++;
      this.noteDeath(owner);
    }
    m.atkT = 0;
  }

  /** 짧은 시간에 여럿이 쓰러지면 사기가 꺾여 모든 용병이 공포에 질려 잠깐 도망친다 */
  private noteDeath(owner: Slot): void {
    if (this.phase === "tournament") return; // 토너먼트에서는 사기가 꺾이지 않는다
    owner.deaths.push(this.time);
    owner.deaths = owner.deaths.filter((t) => this.time - t <= SHAKEN_WINDOW_SEC);
    // 큰 부대가 짧은 시간에 크게 무너졌을 때만(작은 부대나 직후 재발 제외)
    const army = this.countMercs(owner.state.id);
    if (army >= SHAKEN_MIN_ARMY && owner.state.shaken <= 0 && owner.shakenGrace <= 0 && owner.deaths.length >= Math.max(SHAKEN_DEATHS, Math.ceil(army * SHAKEN_FRAC))) {
      owner.state.shaken = TUNE.SHAKEN_SEC;
      owner.deaths = [];
    }
  }

  /** 기병의 속도: 움직이면 최대 속도를 향해 점점 오르고, 멈추면 줄어든다 */
  private updateMomentum(f: Fighter, moved: boolean, dt: number): void {
    f.momentum = moved ? Math.min(1, f.momentum + dt / TUNE.CAV_RAMP_SEC) : Math.max(0, f.momentum - dt / CAV_DECAY_SEC);
  }

  /** 용병 AI가 보는 대상: 일반 전투에서는 적, 토너먼트에서는 상대 선수의 주인공·용병 */
  private enemyTargets(): Target[] {
    const out: Target[] = [];
    for (const e of this.enemies.values()) {
      out.push({ x: e.x, y: e.y, r: radiusOf(e), type: e.type, face: e.face, shield: e.shield, ranged: ENEMY_STATS[e.type]!.ranged, id: e.id, hero: false, hpFrac: Math.max(0, e.hp) / e.maxHp });
    }
    return out;
  }

  private duelTargets(owner: number, all: Friendly[]): Target[] {
    const out: Target[] = [];
    for (const f of this.duelFoes(owner, all)) {
      if (f.merc) {
        out.push({ x: f.x, y: f.y, r: f.radius, type: f.merc.type, face: f.merc.face, shield: f.merc.shield, ranged: MERC_STATS[f.merc.type]!.ranged, id: f.merc.id, hero: false, hpFrac: Math.max(0, f.merc.hp) / this.mercStats(f.merc).hp });
      } else {
        const sl = this.slots.get(f.ownerId)!;
        out.push({ x: f.x, y: f.y, r: f.radius, type: NO_TYPE, face: sl.state.aim, shield: 0, ranged: WEAPONS[sl.state.weapon]!.ranged, id: -f.ownerId, hero: true, hpFrac: Math.max(0, sl.state.hp) / sl.state.maxHp });
      }
    }
    return out;
  }

  /** 같은 편(주인공 + 살아 있는 용병). 검방병·창병이 지킬 대상을 고를 때 쓴다 */
  private allyList(owner: number): Ally[] {
    const out: Ally[] = [];
    const sl = this.slots.get(owner);
    if (sl && !sl.state.down && !sl.away) out.push({ x: sl.state.x, y: sl.state.y, type: NO_TYPE, hero: true, id: -owner });
    for (const m of this.mercs.values()) if (m.owner === owner && m.respawn <= 0) out.push({ x: m.x, y: m.y, type: m.type, hero: false, id: m.id });
    return out;
  }

  /** 진형 자리에서 벗어나 적을 쫓을 수 있는 거리: 돌격 진형이면 훨씬 멀리까지 쫓는다 */
  private leashOf(st: UnitStats, type: number, owner: Slot | undefined): number {
    const assault = owner?.stances[type] === STANCE_ASSAULT;
    return st.leash * (assault ? (type === CAVALRY ? ASSAULT_LEASH_MULT_CAVALRY : TUNE.ASSAULT_LEASH_MULT) : type === CAVALRY ? 1 : TUNE.DEFEND_LEASH_MULT);
  }

  private stepMercs(dt: number): void {
    const alive = new Map<number, number>();
    for (const m of this.mercs.values()) if (m.respawn <= 0) alive.set(m.owner, (alive.get(m.owner) ?? 0) + 1);
    for (const sl of this.slots.values()) {
      sl.state.swarm = Math.min(SWARM_MAX, (alive.get(sl.state.id) ?? 0) * SWARM_PER_MERC);
      if (sl.state.shaken > 0) {
        sl.state.shaken = Math.max(0, sl.state.shaken - dt);
        if (sl.state.shaken === 0) sl.shakenGrace = SHAKEN_GRACE_SEC;
      } else sl.shakenGrace = Math.max(0, sl.shakenGrace - dt);
    }
    // 병종별 지시: 시간이 다하면 풀리고, 공격 지시는 쫓던 적이 있으면 그 적의 위치를 따라간다(죽었으면 곧 풀린다)
    for (const sl of this.slots.values()) {
      for (const t of UNIT_TYPES) {
        const o = sl.orders[t];
        if (!o) continue;
        o.left -= dt;
        if (o.left <= 0 || sl.state.down) {
          sl.orders[t] = null;
          continue;
        }
        if (o.targetId) {
          const e = this.enemies.get(o.targetId);
          if (e) {
            o.x = e.x;
            o.y = e.y;
          } else {
            o.targetId = 0;
            o.left = Math.min(o.left, 1.5);
          }
        }
      }
    }
    const slotsByOwner = new Map<number, Map<number, [number, number]>>();
    for (const owner of this.slots.keys()) slotsByOwner.set(owner, this.formationSlots(owner));
    // 토너먼트에서는 상대 선수의 주인공·용병이 대상이다(경기 중인 선수의 용병만 움직인다)
    const duel = this.phase === "tournament";
    const fighting = duel && this.tour?.step === "fight";
    const enemyT = duel ? [] : this.enemyTargets();
    const all = fighting ? this.collectFriendlies() : [];
    const foeCache = new Map<number, Target[]>();
    const allyCache = new Map<number, Ally[]>();

    for (const m of this.mercs.values()) {
      const st = this.mercStats(m);
      const ownerSlot = this.slots.get(m.owner);
      if (m.respawn > 0) {
        if (duel) continue; // 경기 중 쓰러진 용병은 경기가 끝날 때까지 돌아오지 않는다
        m.respawn = Math.max(0, m.respawn - dt);
        if (m.respawn === 0) {
          m.hp = st.hp;
          m.shield = st.shield;
          m.regenT = 0;
          m.momentum = 0;
          m.cd = 0;
          m.x = ownerSlot?.state.x ?? 0;
          m.y = ownerSlot?.state.y ?? 0;
        }
        continue;
      }
      if (duel && !(fighting && this.isFighter(m.owner))) continue;
      this.regenShield(m, st.shield, dt);
      const regen = ownerSlot ? mstat(ownerSlot.mods, m.type, "regen") : 0;
      if (regen > 0) m.hp = Math.min(st.hp, m.hp + st.hp * regen * dt);
      m.cd = Math.max(0, m.cd - dt);

      // 공포: 사기가 꺾인 동안 모든 용병이 싸우지 않고 적에게서 멀어지는 쪽으로 도망친다(주문·공격 준비도 끊긴다)
      if (!duel && ownerSlot && ownerSlot.state.shaken > 0) {
        m.atkT = 0;
        m.evadeT = 0;
        this.mercFlee(m, st, dt);
        continue;
      }

      if (m.atkT > 0) {
        if (m.type === MAGE && !duel) this.steerMeteor(m, st, dt); // 주문을 외우는 동안 가장 빽빽한 곳으로 낙하 지점을 옮긴다
        m.atkT -= dt;
        if (m.atkT <= 0) {
          m.atkT = 0;
          m.cd = st.cooldown;
          this.resolveMercAttack(m, st);
        }
        continue; // 예비 동작 중에는 움직이지 못한다
      }

      let targets = enemyT;
      if (duel) {
        targets = foeCache.get(m.owner) ?? this.duelTargets(m.owner, all);
        foeCache.set(m.owner, targets);
      }
      let allies = allyCache.get(m.owner);
      if (!allies) {
        allies = this.allyList(m.owner);
        allyCache.set(m.owner, allies);
      }
      let home = slotsByOwner.get(m.owner)?.get(m.id) ?? [m.x, m.y];
      let leash = this.leashOf(st, m.type, ownerSlot);
      let assault = ownerSlot?.stances[m.type] === STANCE_ASSAULT;
      let guard = ownerSlot?.stances[m.type] === STANCE_DEFEND;
      const ord = m.type === CAVALRY ? null : ownerSlot?.orders[m.type];
      if (ord) {
        // 지시를 받은 병종: 지시 지점이 새 "자리"가 된다(이동이면 그 둘레에 흩어져 서고 가까운 적과 싸우며, 공격이면 그 일대의 적을 쫓는다)
        if (ord.kind === 1) {
          const ang = m.id * 2.399;
          const rr = 20 + (m.id % 5) * 16;
          home = [clampToWorld(ord.x + Math.cos(ang) * rr, 24), clampToWorld(ord.y + Math.sin(ang) * rr, 24)];
          leash = TUNE.MOVE_ENGAGE_RADIUS;
          assault = false;
        } else {
          home = [ord.x, ord.y];
          leash = CHARGE_TARGET_RADIUS;
          assault = true;
        }
        guard = false;
      }
      const c: AiCtx = {
        m,
        st,
        dt,
        targets,
        allies,
        home,
        homeDist: Math.hypot(home[0] - m.x, home[1] - m.y),
        owner: ownerSlot,
        leash,
        assault,
        guard,
        widthMult: boxWidthMult(m.type, st.arc),
      };
      switch (m.type) {
        case CAVALRY: this.aiCavalry(c); break;
        case SHIELD: this.aiShield(c); break;
        case ARCHER: this.aiArcher(c); break;
        case BLUNT: this.aiBlunt(c); break;
        case MAGE: this.aiMage(c); break;
        default: this.aiSpear(c);
      }
      if (duel) {
        const r = Math.hypot(m.x, m.y);
        if (r > TOURNAMENT_ARENA_RADIUS) {
          m.x *= TOURNAMENT_ARENA_RADIUS / r;
          m.y *= TOURNAMENT_ARENA_RADIUS / r;
        }
      }
    }
  }

  // --- 병종별 역할 AI ---------------------------------------------------------------
  // 기본 진형: 주인공 곁 진형 자리를 지키며 그 둘레의 적과 싸운다. 돌격 진형: 대열이 앞으로 나가 더 멀리 쫓는다.
  // 검방병은 취약한 아군을 지키고, 궁병은 최대 사거리 근처에서 방패 정면을 피해 쏘고, 기병은 측면·후면에서 궁병·둔기병을 노리고,
  // 둔기병은 검방병을 먼저 노리고, 창병은 적 기병을 주시하며 아군을 덮는다.

  /** 지키는 아군(ward)과 위협(threat)을 잇는 선 위의 지점: 둘 사이의 중간쯤(GUARD_MID_FRAC)에 서되, 아군에 너무 붙지는 않는다. 위협이 다가올수록 그 지점도 앞으로 좁혀 온다. */
  private guardPoint(ward: { x: number; y: number }, tx: number, ty: number, minDist: number): [number, number] {
    const d = Math.hypot(tx - ward.x, ty - ward.y) || 1;
    const g = Math.min(d, Math.max(minDist, d * TUNE.GUARD_MID_FRAC));
    return [ward.x + ((tx - ward.x) / d) * g, ward.y + ((ty - ward.y) / d) * g];
  }

  /** 공포에 질린 용병: 가까운 적들(가까울수록 크게)에게서 멀어지는 방향으로 달아난다 */
  private mercFlee(m: Merc, st: UnitStats, dt: number): void {
    let vx = 0;
    let vy = 0;
    for (const e of this.enemies.values()) {
      const dx = m.x - e.x;
      const dy = m.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 500) continue;
      const w = 1 / (d + 40);
      vx += (dx / (d || 1)) * w;
      vy += (dy / (d || 1)) * w;
    }
    const l = Math.hypot(vx, vy);
    if (l < 1e-9) return; // 주위에 적이 없으면 그 자리에서 숨을 고른다
    const sp = st.speed * TUNE.SHAKEN_FLEE_SPEED;
    m.x = clampToWorld(m.x + (vx / l) * sp * dt, st.radius);
    m.y = clampToWorld(m.y + (vy / l) * sp * dt, st.radius);
    m.face = Math.atan2(vy, vx);
  }

  private startAttack(m: Merc, st: UnitStats, ang: number): void {
    m.atkT = st.windup;
    m.atkAng = ang;
    m.face = ang;
  }

  /** 진형 자리로 돌아간다. 멀리 떨어졌다면 따라붙도록 더 빨리 움직인다. 대열은 주인공이 바라보는 쪽을 향한다. */
  private aiGoHome(c: AiCtx): void {
    // 멀어질수록 빨리 따라붙는다(주인공이 달려도 대열이 뒤처지지 않게)
    const speed = c.homeDist > 120 ? c.st.speed * Math.min(TUNE.CATCHUP_MAX, 1 + c.homeDist / 160) : c.st.speed;
    this.moveToward(c.m, c.home[0], c.home[1], speed, c.dt, 4);
    if (c.owner) c.m.face = c.owner.facing;
  }

  /** 주인공 호위 중에 주인공 둘레의 위협인가(진형 자리에서 멀어도 막으러 나선다) */
  private threatensHero(c: AiCtx, t: { x: number; y: number }): boolean {
    return c.guard && !!c.owner && !c.owner.state.down && Math.hypot(t.x - c.owner.state.x, t.y - c.owner.state.y) <= TUNE.GUARD_HERO_RADIUS;
  }

  /** 지킬 만한 아군: 취약도(병종별 가중치) / (1 + 거리). exclude에 든 병종은 뺀다 */
  private pickWard(c: AiCtx, exclude: readonly number[]): Ally | null {
    let ward: Ally | null = null;
    let best = -1;
    for (const a of c.allies) {
      if (exclude.includes(a.type)) continue;
      const w = (a.hero ? HERO_WARD_WEIGHT : WARD_WEIGHT[a.type] ?? 1) / (1 + Math.hypot(a.x - c.m.x, a.y - c.m.y) / 260);
      if (w > best) {
        best = w;
        ward = a;
      }
    }
    return ward;
  }

  private nearestTarget(c: AiCtx, from: { x: number; y: number }, limit: number): { t: Target; d: number } | null {
    let best: { t: Target; d: number } | null = null;
    for (const t of c.targets) {
      const d = Math.hypot(t.x - from.x, t.y - from.y);
      if (d <= limit && (!best || d < best.d)) best = { t, d };
    }
    return best;
  }

  /** 검방병: 다른 병종에 붙어서 가장 취약한 아군(궁병·주인공 순)을 지킨다. 그 아군과 위협 사이에 서서 방패 정면으로 막는다. */
  private aiShield(c: AiCtx): void {
    const { m, st } = c;
    const ward = this.pickWard(c, [SHIELD]);
    const guardLimit = c.leash * 1.6 + 160; // 진형에서 너무 멀리 떨어진 곳까지 지키러 가지는 않는다
    const near = this.nearestTarget(c, m, st.reach + 14);
    if (ward) {
      const threat = this.nearestTarget(c, ward, GUARD_THREAT_RADIUS);
      if (threat) {
        const [gx, gy] = this.guardPoint(ward, threat.t.x, threat.t.y, TUNE.GUARD_DIST); // 궁병 옆이 아니라 궁병과 적 사이의 중간
        if (Math.hypot(gx - c.home[0], gy - c.home[1]) <= guardLimit) {
          m.face = Math.atan2(threat.t.y - m.y, threat.t.x - m.x); // 방패 정면을 위협 쪽으로
          if (near) {
            if (m.cd <= 0) this.startAttack(m, st, Math.atan2(near.t.y - m.y, near.t.x - m.x)); // 가까이 온 적은 막으며 친다
            return;
          }
          this.moveToward(m, gx, gy, st.speed * (c.homeDist > 150 ? 1.4 : 1), c.dt, 6);
          return;
        }
      }
    }
    if (near) {
      m.face = Math.atan2(near.t.y - m.y, near.t.x - m.x);
      if (m.cd <= 0) this.startAttack(m, st, m.face);
      return;
    }
    this.aiGoHome(c);
  }

  /** 방패가 정면을 막고 있는 적인가(that이 from에게 정면을 보이고 있는가) */
  private frontalShield(t: Target, from: { x: number; y: number }): boolean {
    return t.type === SHIELD && t.shield > 0 && Math.abs(angleDiff(Math.atan2(from.y - t.y, from.x - t.x), t.face)) < SHIELD_FRONT_ARC + 0.2;
  }

  /**
   * 궁병: 가능한 최대 사거리 근처에서 쏜다. 방패가 정면을 막는 적은 뒤로 미루고, 그 적을 쏴야 하면 옆으로 돌아 정면을 피한다.
   * 근접 적이 다가오면 근접 사거리 밖으로 물러나며 쏜다(진형 쪽으로 끌려 적진 반대편으로 달아나지 않는다).
   */
  private aiArcher(c: AiCtx): void {
    const { m, st, dt } = c;
    const roam = TUNE.ARCHER_ROAM * (c.assault ? 1.8 : 1);
    // 근접 위협 카이팅
    let threat: Target | null = null;
    let gapBest = Infinity;
    for (const t of c.targets) {
      if (t.ranged) continue;
      const d = Math.hypot(t.x - m.x, t.y - m.y);
      const danger = (t.hero ? 50 : ENEMY_STATS[t.type]?.reach ?? MERC_STATS[t.type]?.reach ?? 40) + t.r + st.radius + TUNE.ARCHER_KITE_MARGIN;
      if (d >= danger || d - danger >= gapBest) continue;
      threat = t;
      gapBest = d - danger;
    }
    // 대상 고르기: 사거리 안(또는 진형 근처)의 적 중 방패 정면이 아닌 쪽을 먼저, 먼 거리의 원거리 적을 약간 선호
    let target: Target | null = null;
    let score = Infinity;
    let frontal = false;
    for (const t of c.targets) {
      const d = Math.hypot(t.x - m.x, t.y - m.y);
      if (d > st.reach * 1.6 || (d > st.reach && Math.hypot(t.x - c.home[0], t.y - c.home[1]) > roam + st.reach)) continue;
      const f = this.frontalShield(t, m);
      const sc = d * (f ? 3 : 1) * (t.ranged ? 0.85 : 1);
      if (sc < score) {
        score = sc;
        target = t;
        frontal = f;
      }
    }
    if (threat) {
      m.face = Math.atan2(threat.y - m.y, threat.x - m.x);
      if (target && m.cd <= 0 && gapBest > -TUNE.ARCHER_KITE_MARGIN * 0.6 && !frontal) {
        this.startAttack(m, st, Math.atan2(target.y - m.y, target.x - m.x)); // 아주 가깝지 않을 때는 한 발 쏘고 다시 물러난다
        return;
      }
      let ax = m.x - threat.x;
      let ay = m.y - threat.y;
      const al = Math.hypot(ax, ay) || 1;
      ax /= al;
      ay /= al;
      const hl = c.homeDist || 1;
      ax += ((c.home[0] - m.x) / hl) * ARCHER_KITE_HOME_PULL;
      ay += ((c.home[1] - m.y) / hl) * ARCHER_KITE_HOME_PULL;
      const ll = Math.hypot(ax, ay) || 1;
      const step = st.speed * ARCHER_KITE_SPEED_MULT * dt;
      m.x += (ax / ll) * step;
      m.y += (ay / ll) * step;
      return;
    }
    if (!target) {
      m.flankT = 0;
      this.aiGoHome(c);
      return;
    }
    const d = Math.hypot(target.x - m.x, target.y - m.y);
    const ang = Math.atan2(target.y - m.y, target.x - m.x);
    const desired = st.reach * TUNE.ARCHER_REACH_FRAC;
    m.face = ang;
    if (frontal && m.flankT < ARCHER_STRAFE_SEC) {
      // 방패 정면을 피해 대상 둘레를 돌며 사거리 끝 거리를 유지한다
      m.flankT += dt;
      const away = Math.atan2(m.y - target.y, m.x - target.x);
      const side = angleDiff(away, target.face) >= 0 ? 1 : -1;
      const tan = away + side * (Math.PI / 2);
      const radial = Math.max(-1, Math.min(1, (desired - d) / 80));
      let vx = Math.cos(tan) + Math.cos(away) * radial * 0.8;
      let vy = Math.sin(tan) + Math.sin(away) * radial * 0.8;
      const vl = Math.hypot(vx, vy) || 1;
      vx /= vl;
      vy /= vl;
      const nx = m.x + vx * st.speed * 0.9 * dt;
      const ny = m.y + vy * st.speed * 0.9 * dt;
      if (Math.hypot(nx - c.home[0], ny - c.home[1]) <= roam + 80) {
        m.x = nx;
        m.y = ny;
      }
      return;
    }
    if (!frontal) m.flankT = 0;
    if (d > st.reach) {
      this.moveToward(m, target.x, target.y, st.speed, dt, desired); // 사거리 끝까지 다가간다
      return;
    }
    if (d < desired * 0.7 && !(m.cd <= 0 && d > desired * 0.5)) {
      m.x += Math.cos(ang + Math.PI) * st.speed * 1.05 * dt; // 너무 가까우면 사거리 끝 거리로 물러난다
      m.y += Math.sin(ang + Math.PI) * st.speed * 1.05 * dt;
      return;
    }
    if (m.cd <= 0) this.startAttack(m, st, ang);
  }

  /** 둔기병: 방패 든 검방병을 먼저 노린다(방패 특화). 준비 동작이 길어 가까이 붙은 뒤 한 방을 내리친다. */
  private aiBlunt(c: AiCtx): void {
    const { m, st } = c;
    let target: Target | null = null;
    let score = Infinity;
    for (const t of c.targets) {
      const d = Math.hypot(t.x - m.x, t.y - m.y);
      // 진형 자리에서 멀리 뒤처져 있어도 바로 곁(사거리 안)의 적은 가만히 맞고 있지 않고 맞서 싸운다
      if (d > st.reach + t.r + 14 && Math.hypot(t.x - c.home[0], t.y - c.home[1]) > c.leash + st.reach + 30 && !this.threatensHero(c, t)) continue;
      const sc = d / (t.type === SHIELD && t.shield > 0 ? BLUNT_SHIELD_PREF : 1);
      if (sc < score) {
        score = sc;
        target = t;
      }
    }
    if (target) {
      const d = Math.hypot(target.x - m.x, target.y - m.y);
      m.face = Math.atan2(target.y - m.y, target.x - m.x);
      if (d <= st.reach + target.r) {
        if (m.cd <= 0) this.startAttack(m, st, m.face);
        return;
      }
      if (c.homeDist <= c.leash || this.threatensHero(c, target)) {
        this.moveToward(m, target.x, target.y, st.speed, c.dt, st.reach * 0.6);
        return;
      }
    }
    this.aiGoHome(c);
  }

  /** 창병: 적 기병을 주시하다가, 기병이 노리는 취약한 아군(궁병·주인공) 앞에 서서 창으로 막는다. 기병이 없으면 가까운 적과 싸운다. */
  private aiSpear(c: AiCtx): void {
    const { m, st } = c;
    const canHit = (t: Target) => inSpearBox(m.x, m.y, Math.atan2(t.y - m.y, t.x - m.x), t.x, t.y, t.r, st.reach, c.widthMult);
    // 지킬 아군(궁병·주인공)이 있으면 그 아군과 위협(기병을 먼저) 사이의 중간에서 막는다. 아군 옆으로 가지 않는다.
    const wardFirst = this.pickWard(c, [SPEAR, CAVALRY]);
    if (wardFirst && !c.assault) {
      let threat: Target | null = null;
      let ts = Infinity;
      for (const t of c.targets) {
        const d = Math.hypot(t.x - wardFirst.x, t.y - wardFirst.y);
        if (d > GUARD_THREAT_RADIUS) continue;
        const sc = d / (t.type === CAVALRY ? 2 : 1);
        if (sc < ts) {
          ts = sc;
          threat = t;
        }
      }
      if (threat) {
        m.face = Math.atan2(threat.y - m.y, threat.x - m.x); // 창끝을 위협 쪽으로
        if (m.cd <= 0) {
          const hit = canHit(threat) ? threat : c.targets.find((t) => canHit(t));
          if (hit) return this.startAttack(m, st, Math.atan2(hit.y - m.y, hit.x - m.x));
        }
        const [gx, gy] = this.guardPoint(wardFirst, threat.x, threat.y, TUNE.SPEAR_COVER_DIST);
        if (Math.hypot(gx - c.home[0], gy - c.home[1]) <= c.leash * 1.6 + 160) {
          this.moveToward(m, gx, gy, st.speed * (c.homeDist > 150 ? 1.4 : 1), c.dt, 8);
          return;
        }
      }
    }
    const cavs = c.targets.filter((t) => t.type === CAVALRY && Math.hypot(t.x - m.x, t.y - m.y) <= SPEAR_WATCH_RANGE);
    if (cavs.length > 0) {
      const ward = null as Ally | null;
      const ref = ward ?? { x: c.home[0], y: c.home[1] };
      let cav = cavs[0]!;
      let cd = Infinity;
      for (const t of cavs) {
        const d = Math.hypot(t.x - ref.x, t.y - ref.y);
        if (d < cd) {
          cd = d;
          cav = t;
        }
      }
      const ang = Math.atan2(cav.y - m.y, cav.x - m.x);
      m.face = ang;
      if (m.cd <= 0) {
        if (canHit(cav)) return this.startAttack(m, st, ang);
        const other = c.targets.find((t) => canHit(t));
        if (other) return this.startAttack(m, st, Math.atan2(other.y - m.y, other.x - m.x));
      }
      // 기병과 지킬 아군 사이에 서서 창끝을 기병 쪽으로 겨눈다
      const [gx, gy] = this.guardPoint(ref, cav.x, cav.y, TUNE.SPEAR_COVER_DIST);
      if (Math.hypot(gx - c.home[0], gy - c.home[1]) <= c.leash * 1.6 + 160) {
        this.moveToward(m, gx, gy, st.speed * (c.homeDist > 150 ? 1.4 : 1), c.dt, 8);
        return;
      }
    }
    let target: Target | null = null;
    let score = Infinity;
    for (const t of c.targets) {
      const dm = Math.hypot(t.x - m.x, t.y - m.y);
      if (dm > st.reach + t.r + 14 && Math.hypot(t.x - c.home[0], t.y - c.home[1]) > c.leash + st.reach + 30 && !this.threatensHero(c, t)) continue; // 곁의 적과는 뒤처져 있어도 싸운다
      const sc = dm / (t.type === CAVALRY ? 2 : 1);
      if (sc < score) {
        score = sc;
        target = t;
      }
    }
    if (target) {
      const ang = Math.atan2(target.y - m.y, target.x - m.x);
      m.face = ang;
      if (canHit(target)) {
        if (m.cd <= 0) this.startAttack(m, st, ang);
        return;
      }
      if (c.homeDist <= c.leash || this.threatensHero(c, target)) {
        this.moveToward(m, target.x, target.y, st.speed, c.dt, st.reach * 0.8);
        return;
      }
    }
    this.aiGoHome(c);
  }

  /**
   * 기병: 진형 날개에서 대기하다가, 궁병·둔기병을 노려 옆·뒤로 돌아 들어간다(정면의 방패는 나중, 창병은 피한다).
   * 달릴수록 속도가 붙어 돌격 피해가 커지고, 공격한 뒤에는 속도를 잃고 잠깐 물러난다. 우클릭 돌격 지시 중에는 활동 범위를 넘어 지점으로 나간다.
   */
  private aiCavalry(c: AiCtx): void {
    const { m, st, dt } = c;
    const owner = c.owner;
    const spears = c.targets.filter((t) => t.type === SPEAR);
    if (m.evadeT > 0) {
      // 한 대 치고 빠진다: 대상에서 떨어져 후방으로 돌아 들어가며 속도를 다시 붙인다
      const prey = c.targets.find((t) => t.id === m.runId);
      const hurt = m.hp <= st.hp * CAV_RETREAT_HP;
      if (!prey || hurt) {
        m.evadeT = 0; // 대상이 사라졌거나 체력이 낮으면 달리기를 멈추고 아래 규칙대로
      } else {
        m.evadeT = Math.max(0, m.evadeT - dt);
        const d = Math.hypot(m.x - prey.x, m.y - prey.y);
        const a = Math.atan2(m.y - prey.y, m.x - prey.x);
        const diff = angleDiff(prey.face + Math.PI, a); // 대상 뒤쪽까지 남은 각도
        const radius = TUNE.CAV_RUNUP_DIST;
        let turn = Math.max(-0.6, Math.min(0.6, diff));
        if (Math.abs(turn) < 0.35) turn = (diff >= 0 ? 1 : -1) * 0.35; // 이미 뒤쪽이어도 멈추지 말고 원을 그리며 속도를 붙인다
        let gx = prey.x + Math.cos(a + turn) * radius;
        let gy = prey.y + Math.sin(a + turn) * radius;
        // 진형에서 너무 멀리 벗어나지 않게 한다
        const hx = gx - c.home[0];
        const hy = gy - c.home[1];
        const hd = Math.hypot(hx, hy);
        if (hd > c.leash) {
          gx = c.home[0] + (hx / hd) * c.leash;
          gy = c.home[1] + (hy / hd) * c.leash;
        }
        const sp = cavSpeed(st.speed, m.momentum);
        this.updateMomentum(m, this.steer(m, gx, gy, sp, dt, spears, prey, 4), dt);
        const ready = m.momentum >= TUNE.CAV_RUNUP_READY && Math.abs(diff) < 1.1 && d >= TUNE.CAV_RUNUP_DIST * 0.6;
        if (ready) m.evadeT = 0; // 충분히 달렸고 옆·뒤를 잡았으면 다시 돌격한다
        return;
      }
    }
    const healthy = m.hp > st.hp * CAV_RETREAT_HP; // 체력이 낮으면 모험을 멈추고 복귀한다
    const ord = owner?.orders[CAVALRY] ?? null;
    const charging = healthy && !!ord;
    const anchor: [number, number] = charging ? [ord!.x, ord!.y] : c.home;
    const moveOrder = charging && ord!.kind === 1; // 이동 지시: 그곳까지 싸우지 않고 가서 자리를 지킨다
    const arrived = moveOrder && Math.hypot(m.x - anchor[0], m.y - anchor[1]) <= TUNE.MOVE_ENGAGE_RADIUS + 60;
    let target: Target | null = null;
    let best = Infinity;
    if (healthy && (!moveOrder || arrived)) {
      const radius = charging ? (moveOrder ? TUNE.MOVE_ENGAGE_RADIUS : CHARGE_TARGET_RADIUS) : c.leash;
      for (const t of c.targets) {
        if (Math.hypot(t.x - anchor[0], t.y - anchor[1]) > radius) continue;
        const d = Math.hypot(t.x - m.x, t.y - m.y);
        if (t.type === SPEAR && d > CAV_SELF_DEFENSE) continue; // 창병은 상대하지 않는다
        const score = d / (t.hero ? 1.2 : CAV_TARGET_WEIGHT[t.type] ?? 1);
        if (score < best) {
          best = score;
          target = t;
        }
      }
    }
    const speed = cavSpeed(st.speed, m.momentum);
    if (target) {
      const reachNow = st.reach + target.r;
      const d = Math.hypot(target.x - m.x, target.y - m.y);
      if (d <= reachNow) {
        if (m.cd <= 0) {
          m.atkT = st.windup;
          m.atkAng = Math.atan2(target.y - m.y, target.x - m.x);
          m.face = m.atkAng;
          m.chargeSnap = chargeBonus(st.speed, m.momentum); // 지금까지 붙은 속도가 돌격 피해가 된다
          m.flankT = 0;
          m.runId = target.id;
          m.brawl = target.hpFrac <= TUNE.CAV_FINISH_HP || target.ranged; // 상대가 거의 죽었거나 궁병이면 빠지지 않고 끝까지 쫓아 싸운다
        }
        return;
      }
      // 대상의 정면에서는 곧장 들어가지 않고, 대상 둘레를 돌아 옆·뒤로 접근한다(너무 오래 걸리면 돌격)
      let gx = target.x;
      let gy = target.y;
      const theta = angleDiff(Math.atan2(m.y - target.y, m.x - target.x), target.face);
      if (d > 70 && target.hpFrac > TUNE.CAV_FINISH_HP && !target.ranged && Math.abs(theta) < (Math.PI * 100) / 180 && m.flankT < CAV_FLANK_MAX_SEC) {
        m.flankT += dt;
        const phi = target.face + (theta >= 0 ? 1 : -1) * Math.min(Math.PI, Math.abs(theta) + 0.7);
        const radius = Math.min(220, Math.max(reachNow + 40, d));
        gx = target.x + Math.cos(phi) * radius;
        gy = target.y + Math.sin(phi) * radius;
      }
      this.updateMomentum(m, this.steer(m, gx, gy, speed, dt, spears, target, 0), dt);
      return;
    }
    m.flankT = 0;
    if (charging) {
      this.updateMomentum(m, this.steer(m, anchor[0], anchor[1], speed, dt, spears, null, 20), dt);
      return;
    }
    // 대열을 따라잡을 때는 최대 속도로 달린다
    const catchUp = c.homeDist > 150 ? st.speed : speed;
    this.updateMomentum(m, this.steer(m, c.home[0], c.home[1], catchUp, dt, spears, null, 4), dt);
  }

  /** 목표를 향해 움직이되, 창병 적 가까이로는 들어가지 않고 비껴 돌아간다. 움직였으면 true. */
  private steer(m: Merc, gx: number, gy: number, speed: number, dt: number, spears: { x: number; y: number }[], ignore: { x: number; y: number } | null, stop: number): boolean {
    let dx = gx - m.x;
    let dy = gy - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= stop) return false;
    dx /= dist;
    dy /= dist;
    for (const sp of spears) {
      if (sp === ignore) continue;
      const sd = Math.hypot(m.x - sp.x, m.y - sp.y);
      if (sd >= SPEAR_AVOID_RADIUS || sd < 0.001) continue;
      const w = (1 - sd / SPEAR_AVOID_RADIUS) * 1.5;
      dx += ((m.x - sp.x) / sd) * w;
      dy += ((m.y - sp.y) / sd) * w;
    }
    const len = Math.hypot(dx, dy) || 1;
    const step = Math.min(speed * dt, dist - stop);
    m.x += (dx / len) * step;
    m.y += (dy / len) * step;
    return true;
  }

  /** 목표를 향해 한 걸음. 움직였으면 true. */
  private moveToward(f: { x: number; y: number }, tx: number, ty: number, speed: number, dt: number, stop: number): boolean {
    const way = this.terrain?.route(f.x, f.y, tx, ty); // 고지대는 올라가는 길로만 오르내린다
    if (way) {
      tx = way[0];
      ty = way[1];
      stop = Math.min(stop, 4);
    }
    const d = Math.hypot(tx - f.x, ty - f.y);
    if (d <= stop) return false;
    const step = Math.min(speed * dt, d - stop);
    f.x += ((tx - f.x) / d) * step;
    f.y += ((ty - f.y) / d) * step;
    return true;
  }

  private resolveMercAttack(m: Merc, st: UnitStats): void {
    const mods = this.slots.get(m.owner)?.mods ?? newMods();
    const crit = this.rollCrit(mstat(mods, m.type, "crit"));
    const critMult = TUNE.CRIT_BASE_MULT + mstat(mods, m.type, "critMult");
    const dmg = st.damage * (crit ? critMult : 1);
    if (crit && hasLegend(mods, "stormfire", m.type)) m.cd = 0;
    if (m.type === MAGE) {
      const cast = this.casts.get(m.id);
      this.casts.delete(m.id);
      if (cast) this.landMeteor(cast.x, cast.y, cast.radius, dmg, m.owner, crit, m);
      return;
    }
    if (st.ranged) {
      const n = 1 + Math.round(mstat(mods, m.type, "multi"));
      for (let i = 0; i < n; i++) {
        const ang = m.atkAng + fanOffset(i, n);
        this.bullets.push({
          id: this.nextEntityId++,
          x: m.x,
          y: m.y,
          vx: Math.cos(ang) * MERC_ARROW_SPEED,
          vy: Math.sin(ang) * MERC_ARROW_SPEED,
          left: st.reach * MERC_ARROW_RANGE_FACTOR,
          hostile: false,
          damage: i === 0 ? dmg : dmg * TUNE.MULTISHOT_DAMAGE,
          srcType: m.type,
          owner: m.owner,
          radius: 4,
          pierce: Math.round(mstat(mods, m.type, "pierce")),
          crit,
          poison: mstat(mods, m.type, "poison"),
          hitIds: new Set(),
          merc: m,
        });
      }
      return;
    }
    const charge = m.type === CAVALRY ? m.chargeSnap * (hasLegend(mods, "chargeBoost", CAVALRY) ? LEGEND_CONST.chargeMult : 1) : 0;
    if (m.type === CAVALRY) {
      m.evadeT = m.brawl ? 0 : TUNE.CAV_RUNUP_SEC; // 치고 빠지기(마무리 싸움 중에는 빠지지 않는다)
      m.momentum *= CAV_MOMENTUM_AFTER_HIT; // 부딪히면 속도를 잃는다
    }
    m.chargeSnap = 0;
    if (this.phase === "tournament") {
      const foes = this.duelFoes(m.owner);
      const hitFoes: Friendly[] = [];
      for (const f of foes) {
        if (usesBox(m.type)) {
          if (!inBox(m.type, m.x, m.y, m.atkAng, f.x, f.y, f.radius, st.reach, boxWidthMult(m.type, st.arc))) continue;
        } else {
          if (Math.hypot(f.x - m.x, f.y - m.y) > st.reach + f.radius) continue;
          if (Math.abs(angleDiff(Math.atan2(f.y - m.y, f.x - m.x), m.atkAng)) > st.arc) continue;
        }
        hitFoes.push(f);
      }
      let back = 0;
      for (const f of hitFoes) back += f.hit({ damage: dmg, charge, srcType: m.type, fromAngle: Math.atan2(m.y - f.y, m.x - f.x), crit });
      if (st.splash > 0) {
        for (const f of foes) {
          if (hitFoes.includes(f) || !hitFoes.some((h) => Math.hypot(f.x - h.x, f.y - h.y) <= st.splash + f.radius)) continue;
          f.hit({ damage: dmg * this.splashFactor(mods, m.type), charge: 0, srcType: m.type, fromAngle: Math.atan2(m.y - f.y, m.x - f.x), crit });
        }
      }
      if (back > 0) {
        this.pushDamage(EVT_REFLECT, m.id, m.x, m.y, back, m.owner);
        this.hurtMerc(m, back);
      }
      return;
    }
    const struck: Enemy[] = [];
    for (const e of this.enemies.values()) {
      if (usesBox(m.type)) {
        // 창병·기병은 직사각형 찌르기. 범위 증가 능력은 폭에 적용된다.
        if (!inBox(m.type, m.x, m.y, m.atkAng, e.x, e.y, radiusOf(e), st.reach, boxWidthMult(m.type, st.arc))) continue;
      } else {
        if (Math.hypot(e.x - m.x, e.y - m.y) > st.reach + radiusOf(e)) continue;
        if (Math.abs(angleDiff(Math.atan2(e.y - m.y, e.x - m.x), m.atkAng)) > st.arc) continue;
      }
      struck.push(e);
    }
    let reflected = 0;
    for (const e of struck) {
      reflected += this.damageEnemy(e, { damage: dmg, charge, srcType: m.type, fromAngle: Math.atan2(m.y - e.y, m.x - e.x), crit }, m.owner, m);
    }
    if (st.splash > 0) this.splashEnemies(struck, st.splash, dmg * this.splashFactor(mods, m.type), m.type, m.x, m.y, m.owner, m);
    if (reflected > 0) {
      this.pushDamage(EVT_REFLECT, m.id, m.x, m.y, reflected, m.owner);
      this.hurtMerc(m, reflected); // 창병에게 돌격하면 그 피해가 자신에게 돌아온다
    }
  }

  /** 범위 공격: 맞힌 대상들 주변의 다른 적에게 일부 피해를 준다 */
  private splashEnemies(struck: Enemy[], radius: number, damage: number, srcType: number, fromX: number, fromY: number, ownerId: number, src?: Merc): void {
    const hit = new Set(struck.map((e) => e.id));
    for (const e of [...this.enemies.values()]) {
      if (hit.has(e.id)) continue;
      if (!struck.some((s) => Math.hypot(s.x - e.x, s.y - e.y) <= radius)) continue;
      this.damageEnemy(e, { damage, charge: 0, srcType, fromAngle: Math.atan2(fromY - e.y, fromX - e.x) }, ownerId, src);
    }
  }

  /** 적이 공격을 받는다. 방패·창병 반사 규칙을 적용하고, 되돌려줄 피해를 돌려준다. src는 때린 용병(없으면 주인공). */
  private damageEnemy(e: Enemy, hit: Hit, ownerId: number, src?: Merc): number {
    const owner = this.slots.get(ownerId);
    const scope: LegendScope = src ? src.type : "hero"; // 때린 쪽(주인공 또는 그 병종)에게만 전설이 적용된다
    const has = (id: LegendId) => !!owner && hasLegend(owner.mods, id, scope);
    // 처형: 체력이 얼마 안 남은 적에게는 피해가 몇 배로 들어간다
    if (has("execute") && e.hp < e.maxHp * LEGEND_CONST.executeBelow) hit = { ...hit, damage: hit.damage * LEGEND_CONST.executeMult };
    const r = resolveHit({ type: e.type, shield: e.shield, face: e.face }, hit);
    this.applyShield(e, r.shield, r.shieldBroke);
    const dealt = Math.min(r.body, Math.max(0, e.hp));
    e.hp -= r.body;
    if (owner) owner.stats.dealt += dealt + r.shield;
    if (src) this.gainMercXp(src, (dealt + r.shield) * MERC_XP_PER_DAMAGE); // 피해를 줄 때마다 조금씩
    if (hit.poison && hit.poison > 0 && r.body > 0 && e.hp > 0) this.poisonEnemy(e, hit.poison, ownerId, src); // 방패에 막힌 화살은 독이 묻지 않는다
    // 흡혈: 카드로 쌓은 비율 + 전설 피의 갈증(치명타는 2배). 때린 쪽(주인공 또는 그 병종)만 회복한다.
    const steal = (owner ? (src ? mstat(owner.mods, src.type, "lifesteal") : owner.mods.heroLifesteal) : 0) + (has("bloodthirst") ? LEGEND_CONST.bloodthirstFrac : 0);
    if (steal > 0 && dealt > 0) this.lifesteal(owner!, src, dealt * steal * (hit.crit && has("bloodthirst") ? 2 : 1));
    if (hit.crit) this.pushEvent(EVT_CRIT, e.x, e.y, 0);
    this.pushDamage(hit.crit ? EVT_DMG_ENEMY_CRIT : EVT_DMG_ENEMY, e.id, e.x, e.y, r.body, ownerId);
    this.pushDamage(EVT_DMG_SHIELD, e.id, e.x, e.y, r.shield, ownerId);
    if (r.backstab && r.body + r.shield > 0) this.pushEvent(EVT_BACKSTAB, e.x, e.y, hit.fromAngle + Math.PI);
    if (e.hp > 0 && src?.type === BLUNT && r.body + r.shield > 0) {
      // 둔기병의 타격은 맞은 적을 잠깐 경직시킨다(단계가 오를수록 길다, 보스는 덜 걸린다)
      const sec = (TUNE.BLUNT_STAGGER_SEC + TUNE.BLUNT_STAGGER_PER_TIER * src.tier) * (e.boss ? TUNE.BLUNT_STAGGER_BOSS_FRAC : 1);
      if (sec > (e.stunT ?? 0)) e.stunT = sec;
      e.atkT = 0;
    }
    if (e.hp <= 0) this.killEnemy(e, ownerId, src);
    else if (owner && r.body + r.shield > 0) this.knockBack(e, hit.fromAngle, src ? mstat(owner.mods, src.type, "knock") : owner.mods.heroKnock);
    return r.reflected;
  }

  /** 독: total만큼의 피해를 POISON_SEC초에 걸쳐 준다. 다시 맞으면 시간이 새로 시작하고 더 센 쪽을 따른다. */
  private poisonEnemy(e: Enemy, total: number, ownerId: number, src?: Merc): void {
    const dps = total / POISON_SEC;
    e.poisonDps = Math.max(dps, e.poisonT && e.poisonT > 0 ? (e.poisonDps ?? 0) : 0);
    e.poisonT = POISON_SEC;
    e.poisonOwner = ownerId;
    e.poisonSrc = src;
  }

  // --- 마법사: 운석 -------------------------------------------------------------
  /** 주문을 외우는 중인 운석. 키는 시전자(용병 번호, 주인공은 -번호). 진행도는 시전자의 준비 시간에서 구한다. */
  private casts = new Map<number, { x: number; y: number; total: number; radius: number; scanT?: number }>();

  /** 맵 바깥으로 나간 유닛(밀려남·도망·추격·진형 자리가 맵 밖일 때 등)을 안으로 되돌린다 */
  private clampUnits(): void {
    for (const m of this.mercs.values()) {
      const r = MERC_STATS[m.type]!.radius;
      m.x = clampToWorld(m.x, r);
      m.y = clampToWorld(m.y, r);
    }
    for (const e of this.enemies.values()) {
      const r = radiusOf(e);
      e.x = clampToWorld(e.x, r);
      e.y = clampToWorld(e.y, r);
    }
    for (const s of this.slots.values()) {
      s.state.x = clampToWorld(s.state.x, PLAYER_RADIUS);
      s.state.y = clampToWorld(s.state.y, PLAYER_RADIUS);
    }
  }

  /** 시전이 끊긴 운석(시전자가 쓰러졌거나 무기를 바꿨거나 부활한 경우)을 치운다 */
  private pruneCasts(): void {
    for (const key of [...this.casts.keys()]) {
      const active = key < 0 ? (this.slots.get(-key)?.windT ?? 0) > 0 && !this.slots.get(-key)!.state.down : (() => {
        const m = this.mercs.get(key);
        if (m) return m.respawn <= 0 && m.atkT > 0;
        const en = this.enemies.get(key); // 적 마법사
        return !!en && en.atkT > 0;
      })();
      if (!active) this.casts.delete(key);
    }
  }

  /** 주인공이 마우스로 가리킨 낙하 지점(사거리 안으로 제한) */
  private heroSpot(s: Slot, w: { reach: number }): [number, number] {
    const p = s.state;
    const maxD = w.reach * s.mods.heroRange;
    const d = Math.max(40, Math.min(maxD, s.input.dist && s.input.dist > 0 ? s.input.dist : maxD * 0.7));
    return [clampToWorld(p.x + Math.cos(p.aim) * d, 10), clampToWorld(p.y + Math.sin(p.aim) * d, 10)];
  }

  /** 점들 가운데 반경 안에 가장 많이(가중치 합) 모이는 곳을 찾는다. 모인 점들의 무게중심을 돌려준다. */
  private meteorSpot(from: { x: number; y: number }, reach: number, radius: number, pts: { x: number; y: number; w: number }[]): [number, number] | null {
    const cand = pts.filter((t) => Math.hypot(t.x - from.x, t.y - from.y) <= reach).sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y)).slice(0, 60);
    let best = -1;
    let bx = 0;
    let by = 0;
    for (const c of cand) {
      let sum = 0;
      let cx = 0;
      let cy = 0;
      for (const t of pts) {
        if (Math.hypot(t.x - c.x, t.y - c.y) > radius * 0.85) continue;
        sum += t.w;
        cx += t.x * t.w;
        cy += t.y * t.w;
      }
      if (sum > best) {
        best = sum;
        bx = cx / sum;
        by = cy / sum;
      }
    }
    if (best <= 0) return null;
    // 사거리 끝을 넘지 않게
    const d = Math.hypot(bx - from.x, by - from.y);
    if (d > reach) {
      bx = from.x + ((bx - from.x) / d) * reach;
      by = from.y + ((by - from.y) / d) * reach;
    }
    return [bx, by];
  }

  private enemyPoints(): { x: number; y: number; w: number }[] {
    return [...this.enemies.values()].map((e) => ({ x: e.x, y: e.y, w: e.boss ? 6 : e.type === ARCHER ? 1.4 : 1 }));
  }

  /** 용병 마법사가 주문을 외우는 동안(낙하 직전까지) 가장 빽빽한 곳으로 낙하 지점을 천천히 옮긴다 */
  private steerMeteor(m: Merc, st: UnitStats, dt: number): void {
    const cast = this.casts.get(m.id);
    if (!cast || m.atkT <= TUNE.MAGE_LOCK_SEC) return;
    cast.scanT = (cast.scanT ?? 0) - dt;
    if (cast.scanT > 0) return;
    cast.scanT = 0.3;
    const spot = this.meteorSpot(m, st.reach, cast.radius, this.enemyPoints());
    if (!spot) return;
    const dx = spot[0] - cast.x;
    const dy = spot[1] - cast.y;
    const dl = Math.hypot(dx, dy);
    const k = dl > 150 ? 150 / dl : 1; // 한 번에 너무 멀리 튀지 않게
    cast.x += dx * k;
    cast.y += dy * k;
  }

  /** 운석이 떨어져 폭발한다: 반경 안의 적(토너먼트에서는 상대 선수)에게 방패를 무시한 큰 피해. 중심이 가장 세고 가장자리는 약하다. */
  private landMeteor(x: number, y: number, radius: number, damage: number, ownerId: number, crit: boolean, src?: Merc): void {
    this.pushEvent(EVT_METEOR, x, y, 0, radius);
    const scale = (d: number) => 1 - TUNE.MAGE_FALLOFF * Math.min(1, d / radius);
    if (this.phase === "tournament") {
      for (const f of this.duelFoes(ownerId)) {
        const d = Math.hypot(f.x - x, f.y - y);
        if (d > radius + f.radius) continue;
        f.hit({ damage: damage * scale(d), charge: 0, srcType: MAGE, fromAngle: Math.atan2(y - f.y, x - f.x), crit, pierceGuard: true });
      }
      return;
    }
    for (const e of [...this.enemies.values()]) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > radius + radiusOf(e)) continue;
      this.damageEnemy(e, { damage: damage * scale(d), charge: 0, srcType: MAGE, fromAngle: Math.atan2(y - e.y, x - e.x), crit, pierceGuard: true }, ownerId, src);
    }
  }

  /** 마법사: 궁병처럼 근접한 적에게서 거리를 벌리고, 사거리 안에서 적이 가장 많이 모인 곳에 운석을 떨어뜨린다. 주문을 외우는(3초) 동안은 움직이지 못한다. */
  private aiMage(c: AiCtx): void {
    const { m, st, dt } = c;
    // 가까이 온 근접 위협에서 물러난다(주문을 시작하지 않는다)
    let threat: Target | null = null;
    let gapBest = Infinity;
    for (const t of c.targets) {
      if (t.ranged) continue;
      const d = Math.hypot(t.x - m.x, t.y - m.y);
      const danger = (t.hero ? 50 : ENEMY_STATS[t.type]?.reach ?? MERC_STATS[t.type]?.reach ?? 40) + t.r + st.radius + TUNE.ARCHER_KITE_MARGIN + 30;
      if (d >= danger || d - danger >= gapBest) continue;
      threat = t;
      gapBest = d - danger;
    }
    if (threat) {
      m.face = Math.atan2(threat.y - m.y, threat.x - m.x);
      let ax = m.x - threat.x;
      let ay = m.y - threat.y;
      const al = Math.hypot(ax, ay) || 1;
      ax /= al;
      ay /= al;
      const hl = c.homeDist || 1;
      ax += ((c.home[0] - m.x) / hl) * ARCHER_KITE_HOME_PULL;
      ay += ((c.home[1] - m.y) / hl) * ARCHER_KITE_HOME_PULL;
      const ll = Math.hypot(ax, ay) || 1;
      const step = st.speed * ARCHER_KITE_SPEED_MULT * dt;
      m.x += (ax / ll) * step;
      m.y += (ay / ll) * step;
      return;
    }
    if (m.cd <= 0 && c.targets.length > 0) {
      const spot = this.meteorSpot(m, st.reach, st.splash, c.targets.map((t) => ({ x: t.x, y: t.y, w: t.hero ? 3 : 1 })));
      if (spot) {
        m.atkT = st.windup;
        m.atkAng = Math.atan2(spot[1] - m.y, spot[0] - m.x);
        m.face = m.atkAng;
        this.casts.set(m.id, { x: spot[0], y: spot[1], total: st.windup, radius: st.splash });
        return;
      }
    }
    // 사거리 밖에 적이 있으면 진형에서 조금(마법사의 활동 범위) 앞으로 나가 사거리 끝 근처에 선다
    const near = m.cd <= 0 ? this.nearestTarget(c, m, st.reach + 170) : null;
    if (near && c.homeDist < 200) {
      m.face = Math.atan2(near.t.y - m.y, near.t.x - m.x);
      this.moveToward(m, near.t.x, near.t.y, st.speed, dt, st.reach * TUNE.ARCHER_REACH_FRAC);
      return;
    }
    this.aiGoHome(c);
  }

  /** 토너먼트: 독에 걸린 선수(주인공은 -번호, 용병은 용병 번호) */
  private duelPoison = new Map<number, { t: number; dps: number; pulse: number }>();

  private poisonFriendly(key: number, total: number): void {
    const dps = total / POISON_SEC;
    const cur = this.duelPoison.get(key);
    this.duelPoison.set(key, { t: POISON_SEC, dps: Math.max(dps, cur && cur.t > 0 ? cur.dps : 0), pulse: cur?.pulse ?? POISON_PULSE_SEC });
  }

  /** 토너먼트 독: 0.5초마다 한 번씩 지속 피해로 들어간다(피해 감소 카드가 매번 적용되어 잔 피해에 강하다) */
  private tickDuelPoison(dt: number, friendlies: Friendly[]): void {
    for (const [key, p] of [...this.duelPoison]) {
      const f = friendlies.find((x) => (x.merc ? x.merc.id : -x.ownerId) === key);
      p.t -= dt;
      if (!f || p.t <= 0) {
        this.duelPoison.delete(key);
        continue;
      }
      p.pulse -= dt;
      if (p.pulse <= 0) {
        p.pulse += POISON_PULSE_SEC;
        f.hit({ damage: p.dps * POISON_PULSE_SEC, charge: 0, srcType: -1, fromAngle: 0, dot: true });
      }
    }
  }

  /** 독 피해를 한 틱 입힌다. 숫자는 0.5초마다 모아서 띄운다. 죽으면 true */
  private tickPoison(e: Enemy, dt: number): boolean {
    if (!e.poisonT || e.poisonT <= 0) return false;
    const step = Math.min(dt, e.poisonT);
    e.poisonT -= dt;
    const dmg = (e.poisonDps ?? 0) * step;
    const owner = this.slots.get(e.poisonOwner ?? 0);
    const dealt = Math.min(dmg, Math.max(0, e.hp));
    e.hp -= dmg;
    e.poisonAcc = (e.poisonAcc ?? 0) + dmg;
    if (owner) owner.stats.dealt += dealt;
    if (e.poisonSrc) this.gainMercXp(e.poisonSrc, dealt * MERC_XP_PER_DAMAGE);
    if (e.poisonAcc >= 1 || (e.poisonT <= 0 && e.poisonAcc > 0.05)) {
      this.pushDamage(EVT_DMG_ENEMY, e.id, e.x, e.y, e.poisonAcc, e.poisonOwner ?? 0);
      e.poisonAcc = 0;
    }
    if (e.hp <= 0) {
      this.killEnemy(e, e.poisonOwner ?? 0, e.poisonSrc);
      return true;
    }
    return false;
  }

  /** 고정 피해 감소: 한 번에 받는 피해에서 flat을 빼되, 최대 ARMOR_MAX_FRAC까지만 줄어든다 */
  private armorCut(body: number, flat: number): number {
    if (body <= 0 || flat <= 0) return body;
    return Math.max(body * (1 - TUNE.ARMOR_MAX_FRAC), body - flat);
  }

  /** 넉백: 맞은 적이 공격해 온 쪽 반대로 밀려나고, 하던 공격 동작이 끊기며 잠깐 공격하지 못한다. 보스는 덜 밀린다. */
  private knockBack(e: Enemy, fromAngle: number, amount: number): void {
    if (amount <= 0) return;
    const dist = Math.min(TUNE.KNOCK_MAX, amount * (e.boss ? KNOCK_BOSS_FACTOR : 1));
    e.x = clampToWorld(e.x - Math.cos(fromAngle) * dist, 14);
    e.y = clampToWorld(e.y - Math.sin(fromAngle) * dist, 14);
    e.atkT = 0;
    e.cd = Math.max(e.cd, KNOCK_STUN_SEC);
    this.pushEvent(EVT_KNOCK, e.x, e.y, fromAngle + Math.PI);
  }

  /** 피의 갈증: 때린 쪽(용병 또는 주인공)이 체력을 회복한다 */
  private lifesteal(owner: Slot, src: Merc | undefined, amount: number): void {
    if (src) {
      if (src.respawn <= 0) src.hp = Math.min(this.mercStats(src).hp, src.hp + amount);
    } else if (!owner.state.down) {
      owner.state.hp = Math.min(owner.state.maxHp, owner.state.hp + amount);
    }
  }

  /** 되돌려받은 피해(방패·방어와 무관하게 몸에 직접 들어간다) */
  private reflectToEnemy(e: Enemy, amount: number, ownerId: number, src?: Merc): void {
    this.pushDamage(EVT_REFLECT, e.id, e.x, e.y, amount, ownerId);
    if (src) this.gainMercXp(src, amount * MERC_XP_PER_DAMAGE);
    e.hp -= amount;
    if (e.hp <= 0) this.killEnemy(e, ownerId, src);
  }

  /** 가시 갑옷: 받은 피해의 일부를 공격자에게 돌려준다 */
  private thorns(owner: Slot | undefined, h: Hit, taken: number, src?: Merc): void {
    if (!owner || !hasLegend(owner.mods, "thorns", src ? src.type : "hero") || taken <= 0 || !h.src) return;
    const attacker = h.src as Enemy;
    if (this.enemies.has(attacker.id)) this.reflectToEnemy(attacker, taken * LEGEND_CONST.thornsFrac, owner.state.id, src);
  }

  private killEnemy(e: Enemy, ownerId: number, src?: Merc): void {
    if (!this.enemies.delete(e.id)) return; // 이미 쓰러짐
    const owner = this.slots.get(ownerId);
    if (src) this.gainMercXp(src, MERC_XP_KILL * (e.boss ? 4 : 1)); // 막타는 경험치를 크게 준다
    const wscope = String(src ? src.type : "hero");
    if (owner && hasLegend(owner.mods, "warcry", src ? src.type : "hero")) {
      owner.haste[wscope] = Math.min(LEGEND_CONST.warcryMax, (owner.haste[wscope] ?? 0) + 1);
      owner.hasteT[wscope] = LEGEND_CONST.warcrySec;
    }
    if (owner) {
      owner.state.kills++;
      const loot = Math.round((ENEMY_GOLD[e.type] ?? 0) * owner.mods.goldMult * (e.boss ? 5 : 1));
      owner.state.gold += loot;
      owner.stats.gold += loot;
    }
    // 경험치: 일부는 처치한 사람에게, 나머지는 모든 플레이어에게 똑같이 나눈다
    const xp = (ENEMY_XP[e.type] ?? 0) * (e.boss ? 5 : 1);
    const shared = (xp * TUNE.XP_TEAM_SHARE) / this.slots.size;
    for (const s of this.slots.values()) this.giveXp(s.state.id, shared);
    if (owner) this.giveXp(owner.state.id, xp * (1 - TUNE.XP_TEAM_SHARE));
    if (e.squad) this.onSquadMemberDown(e.squad);
    if (e.boss) this.onBossDown(e);
  }

  /** 경험치를 주고, 레벨업하면 선택 횟수를 쌓는다. 선택지는 한 번에 하나씩 뜬다. */
  giveXp(playerId: number, amount: number): void {
    const s = this.slots.get(playerId);
    if (!s || amount <= 0) return;
    const p = s.state;
    p.xp += amount * s.mods.xpMult; // 경험치 획득 능력
    let leveled = false;
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed;
      p.level++;
      p.xpNeed = xpNeeded(p.level);
      p.pending++;
      leveled = true;
    }
    if (leveled && !p.down) this.levelUpPush(p);
    if (p.pending > 0 && p.offer.length === 0) p.offer = this.rollOffer(s);
  }

  /** 레벨업 순간 주변 적을 밀어내고 잠깐 공격하지 못하게 한다(카드를 고를 숨 돌릴 틈) */
  private levelUpPush(p: PlayerState): void {
    for (const e of this.enemies.values()) {
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > LEVELUP_PUSH_RADIUS) continue;
      const nx = d > 0.001 ? dx / d : Math.cos(e.id);
      const ny = d > 0.001 ? dy / d : Math.sin(e.id);
      e.x = clampToWorld(e.x + nx * LEVELUP_PUSH_DISTANCE, 14);
      e.y = clampToWorld(e.y + ny * LEVELUP_PUSH_DISTANCE, 14);
      e.atkT = 0; // 하던 공격 동작을 끊는다
      e.cd = Math.max(e.cd, LEVELUP_STUN_SEC);
    }
  }

  /** 레벨업 카드를 고른다. 선택은 각자 하며 게임은 멈추지 않는다. */
  pick(playerId: number, index: number): boolean {
    const s = this.slots.get(playerId);
    if (!s || s.state.pending <= 0 || !Number.isInteger(index)) return false;
    const card = s.state.offer[index] !== undefined ? CARDS[s.state.offer[index]!] : undefined;
    if (!card) return false;
    this.applyCard(s, card.effect);
    s.state.rerolls = Math.min(REROLL_MAX, s.state.rerolls + REROLL_PER_PICK); // 고를 때마다 새로고침 1회 적립
    s.state.pending--;
    if (s.state.box > 0) s.state.box--; // 상자 카드가 먼저 나온다
    s.state.offer = s.state.pending > 0 ? this.rollOffer(s) : [];
    return true;
  }

  /** 지금 제시된 카드를 새로 뽑는다(새로고침 1회 소모). 가능하면 지금 나온 카드는 제외한다. */
  reroll(playerId: number): boolean {
    const s = this.slots.get(playerId);
    if (!s || s.state.offer.length === 0 || s.state.rerolls <= 0) return false;
    s.state.rerolls--;
    s.state.offer = this.rollOffer(s, s.state.offer);
    return true;
  }

  /** 서로 다른 카드 3장. 가중치로 뽑되, 가진 병종만 해당 카드가 나오고 세 장이 모두 같은 종류가 되지는 않게 한다. */
  private rollOffer(s: Slot, exclude: readonly number[] = []): number[] {
    const owned = new Set<number>();
    for (const m of this.mercs.values()) if (m.owner === s.state.id) owned.add(m.type);
    const count = (t: number) => [...this.mercs.values()].filter((m) => m.owner === s.state.id && m.type === t).length;
    let eligible = CARDS.map((c, i) => ({ c, i })).filter(
      ({ c }) =>
        (c.minLevel ?? 1) <= s.state.level &&
        (c.unitType === undefined || owned.has(c.unitType)) &&
        !(c.unique && c.effect.k === "legend" && s.state.legends.includes(legendKey(c.effect.id, c.effect.scope))),
    );
    // 새로고침은 방금 본 카드를 빼고 뽑는다(남는 카드가 모자라면 그대로 둔다)
    const fresh = eligible.filter(({ i }) => !exclude.includes(i));
    if (fresh.length >= OFFER_SIZE) eligible = fresh;
    // 한 병종을 많이 거느릴수록 그 병종 카드가 더 자주 나온다(최대 2배)
    // 통솔력이 거의 다 찼으면 통솔력 카드가 더 자주 나온다(자리가 없어 용병을 못 사는 일이 없도록)
    const leadFull = this.leadershipUsed(s.state.id) >= s.state.leadership - 1 ? 2.5 : 1;
    const weightOf = (c: (typeof CARDS)[number]) =>
      (c.unitType === undefined ? c.weight : c.weight * Math.min(2, 1 + 0.25 * (count(c.unitType) - 1))) * luckWeight(c.rarity, s.state.luck + (s.state.box > 0 ? TUNE.CHEST_LUCK_BONUS : 0)) * (c.effect.k === "leadership" ? leadFull : 1); // 행운이 높을수록 높은 등급이 잘 뜬다
    let best: number[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      const pool = [...eligible];
      const picked: number[] = [];
      while (picked.length < OFFER_SIZE && pool.length > 0) {
        let roll = this.rng() * pool.reduce((sum, { c }) => sum + weightOf(c), 0);
        let k = 0;
        while (k < pool.length - 1 && roll >= weightOf(pool[k]!.c)) roll -= weightOf(pool[k++]!.c);
        picked.push(pool.splice(k, 1)[0]!.i);
      }
      best = picked;
      if (new Set(picked.map((i) => CARDS[i]!.category)).size > 1) break;
    }
    return best;
  }

  private applyCard(s: Slot, e: CardEffect): void {
    const m = s.mods;
    const p = s.state;
    // 용병 최대 체력이 바뀌면 지금 체력도 늘어난 만큼 함께 올려 준다
    const before = new Map<number, number>();
    for (const merc of this.mercs.values()) if (merc.owner === p.id) before.set(merc.id, this.mercStats(merc).hp);
    switch (e.k) {
      case "leadership": p.leadership += e.v; break;
      case "priceMult": p.priceMult *= e.v; break;
      case "goldMult": m.goldMult += e.v; break;
      case "xpMult": m.xpMult += e.v; break;
      case "bounty": m.bounty += e.v; break;
      case "luck": p.luck += e.v; break;
      case "mercStat": {
        const target = e.type === undefined ? m.all : m.type[e.type]!;
        if (e.stat === "respawn" || e.stat === "cast") target[e.stat] *= 1 + e.v;
        else target[e.stat] += e.v;
        break;
      }
      case "legend":
        if (!m.legends.has(legendKey(e.id, e.scope))) {
          m.legends.add(legendKey(e.id, e.scope));
          p.legends.push(legendKey(e.id, e.scope));
        }
        break;
      case "heroMaxHp":
        p.maxHp += e.v;
        p.hp += e.v;
        break;
      case "heroSpeed": m.heroSpeed += e.v; break;
      case "heroDmg": m.heroDmg += e.v; break;
      case "heroKnock": m.heroKnock += e.v; break;
      case "heroDefense": m.heroDefense += e.v; break;
      case "heroDodge": m.heroDodge += e.v; break;
      case "heroRange": m.heroRange += e.v; break;
      case "heroPierce": m.heroPierce += e.v; break;
      case "heroMulti": m.heroMulti += e.v; break;
      case "heroPoison": m.heroPoison += e.v; break;
      case "heroArmor": m.heroArmor += e.v; break;
      case "heroCrit": m.heroCrit += e.v; break;
      case "heroCritMult": m.heroCritMult += e.v; break;
      case "heroArea": m.heroArea += e.v; break;
      case "heroFireRate": m.heroFireRate += e.v; break;
      case "heroRegen": m.heroRegen += e.v; break;
      case "heroShield": m.heroShield += e.v; p.shield += e.v; p.shieldMax += e.v; break;
      case "heroShieldRegen": m.heroShieldRegen += e.v; break;
      case "heroCast": m.heroCast *= 1 + e.v; break;
      case "heroLifesteal": m.heroLifesteal += e.v; break;
    }
    for (const merc of this.mercs.values()) {
      const old = before.get(merc.id);
      if (old === undefined || merc.respawn > 0) continue;
      merc.hp += this.mercStats(merc).hp - old;
    }
  }

  /** 레벨업 카드와 강화 단계가 반영된 용병 능력치 */
  private mercStats(m: Merc): UnitStats {
    const base = MERC_STATS[m.type]!;
    const slot = this.slots.get(m.owner);
    const mods = slot?.mods;
    if (!mods) return base;
    const t = m.type;
    const tier = m.tier;
    const hpMult = mstat(mods, t, "hp") * TIER_HP[tier]!;
    const area = mstat(mods, t, "area");
    return {
      ...base,
      hp: Math.round(base.hp * hpMult),
      shield: Math.round(base.shield * hpMult * (1 + TIER_SHIELD[t]! * tier)),
      damage: base.damage * mstat(mods, t, "dmg") * TIER_DMG[tier]! * (1 + (slot?.state.swarm ?? 0)),
      windup: base.windup * Math.max(CAST_TIME_MIN_MULT, mstat(mods, t, "cast")),
      cooldown: base.cooldown / (mstat(mods, t, "atkSpeed") * (1 + LEGEND_CONST.warcryStep * (this.slots.get(m.owner)?.haste[String(t)] ?? 0))),
      speed: base.speed * mstat(mods, t, "speed") * (1 + TIER_SPEED[t]! * tier),
      reach: meleeReach(t, base.reach * mstat(mods, t, "range") * (1 + TIER_REACH[t]! * tier), area * (1 + TIER_AREA[t]! * tier)),
      splash: base.splash * area * (1 + TIER_AREA[t]! * tier),
      arc: meleeArc(t, base.arc, area),
    };
  }

  /** 용병 한 명을 다음 단계로 강화한다. 금화를 내고, 늘어난 체력만큼 바로 회복한다. */
  upgrade(playerId: number, mercId: unknown): BuyResult {
    const s = this.slots.get(playerId);
    const m = typeof mercId === "number" ? this.mercs.get(mercId) : undefined;
    if (!s || s.state.down) return { ok: false, reason: "지금은 강화할 수 없습니다" };
    if (!m || m.owner !== playerId) return { ok: false, reason: "그 용병을 찾을 수 없습니다" };
    if (m.tier >= MAX_TIER) return { ok: false, reason: "이미 최고 단계입니다" };
    const need = mercXpNeed(m.tier);
    if (m.xp < need) return { ok: false, reason: `경험치가 부족합니다 (${Math.floor(m.xp)}/${need})` };
    if (this.leadershipUsed(playerId) + 1 > s.state.leadership) return { ok: false, reason: "통솔력이 부족합니다 (강화하면 통솔력 +1 필요)" };
    const cost = upgradeCost(m.type, m.tier)!;
    if (s.state.gold < cost) return { ok: false, reason: `금화가 부족합니다 (${cost}G 필요)` };
    const before = this.mercStats(m);
    s.state.gold -= cost;
    m.paid += cost;
    m.xp = Math.max(0, m.xp - need);
    m.tier++;
    const after = this.mercStats(m);
    if (m.respawn <= 0) {
      m.hp += after.hp - before.hp;
      m.shield += after.shield - before.shield;
    }
    return { ok: true };
  }

  /** 적 AI가 보는 아군(주인공·용병): 병종·방향·방패와 이동 속도(예측에 쓴다) */
  private buildFoes(friendlies: Friendly[], dt: number): Foe[] {
    const out: Foe[] = [];
    const seen = new Set<string>();
    for (const f of friendlies) {
      const key = f.merc ? `m${f.merc.id}` : `h${f.ownerId}`;
      seen.add(key);
      const prev = this.foePos.get(key);
      let vx = prev ? (f.x - prev[0]) / dt : 0;
      let vy = prev ? (f.y - prev[1]) / dt : 0;
      const sp = Math.hypot(vx, vy);
      if (sp > 320) {
        vx = (vx / sp) * 320; // 순간이동(부활·경기 시작) 같은 큰 변화는 속도로 보지 않는다
        vy = (vy / sp) * 320;
      }
      this.foePos.set(key, [f.x, f.y]);
      if (f.merc) {
        out.push({ x: f.x, y: f.y, r: f.radius, type: f.merc.type, face: f.merc.face, shield: f.merc.shield, ranged: MERC_STATS[f.merc.type]!.ranged, vx, vy, f });
      } else {
        const sl = this.slots.get(f.ownerId)!;
        out.push({ x: f.x, y: f.y, r: f.radius, type: NO_TYPE, face: sl.state.aim, shield: 0, ranged: WEAPONS[sl.state.weapon]!.ranged, vx, vy, f });
      }
    }
    for (const k of [...this.foePos.keys()]) if (!seen.has(k)) this.foePos.delete(k);
    return out;
  }

  /** 적이 노릴 가치(병종별 성향). 값이 클수록 먼저 노린다 */
  private enemyTargetWeight(e: Enemy, t: Foe, d: number): number {
    switch (e.type) {
      case CAVALRY:
        if (t.type === SPEAR && d > CAV_SELF_DEFENSE) return 0.05; // 창병은 돌격이 반사되므로 피한다
        return t.type === NO_TYPE ? 1.2 : (CAV_TARGET_WEIGHT[t.type] ?? 1);
      case SPEAR:
        return t.type === CAVALRY ? 2.2 : 1; // 기병을 주시한다
      case BLUNT:
        return t.type === SHIELD && t.shield > 0 ? BLUNT_SHIELD_PREF : 1; // 방패를 부순다
      case ARCHER:
        return this.frontalShield({ x: t.x, y: t.y, r: t.r, type: t.type, shield: t.shield, face: t.face } as Target, e) ? 0.33 : t.ranged ? 1.15 : 1; // 방패 정면은 피한다
      default:
        return 1;
    }
  }

  private stepEnemies(dt: number, friendlies: Friendly[]): void {
    const foes = this.buildFoes(friendlies, dt);
    const archers: Enemy[] = [];
    for (const o of this.enemies.values()) if (o.type === ARCHER) archers.push(o);
    for (const e of [...this.enemies.values()]) {
      if (this.tickPoison(e, dt)) continue;
      if (e.stunT && e.stunT > 0) {
        e.stunT -= dt;
        continue; // 경직: 움직이지도 공격하지도 못한다
      }
      const st = ENEMY_STATS[e.type]!;
      this.regenShield(e, e.shieldMax, dt);
      e.cd = Math.max(0, e.cd - dt);

      if (e.atkT > 0) {
        e.atkT -= dt;
        if (e.atkT <= 0) {
          e.atkT = 0;
          e.cd = st.cooldown;
          this.resolveEnemyAttack(e, st, friendlies);
        }
        continue; // 예비 동작 중에는 멈춰 선다
      }

      const group = e.army ? this.army : e.squad ? (this.squads.get(e.squad)?.a ?? null) : null;
      const home = group ? this.armySlotPos(e.slotF, e.slotL, group) : null;
      const leashed = home !== null && Math.hypot(home[0] - e.x, home[1] - e.y) > ARMY_LEASH;
      const aggro = Math.max(ARMY_AGGRO, st.reach + 20);
      // 대상: 병종별 성향(기병은 궁병·둔기병, 둔기병은 방패 든 검방병, 창병은 기병, 궁병은 방패 정면이 아닌 쪽)을 거리에 반영해 고른다
      let target: Foe | null = null;
      let targetDist = Infinity;
      let best = Infinity;
      if (!leashed) {
        for (const f of foes) {
          const d = Math.hypot(f.x - e.x, f.y - e.y);
          if (home !== null && d > aggro) continue;
          const sc = d / this.enemyTargetWeight(e, f, d);
          if (sc < best) {
            best = sc;
            targetDist = d;
            target = f;
          }
        }
      }
      if (!target) {
        // 진형 소속은 자리를 지키며 대열과 함께 움직인다
        if (home) {
          this.moveToward(e, home[0], home[1], st.speed * 1.2, dt, 4);
          e.face = group!.heading;
        }
        continue;
      }
      // 이동 속도가 곧 위협이다: 적은 조금 더 빠르고, 움직이는 대상을 앞질러 막아선다
      const speed = st.speed * (e.boss ? BOSS_SPEED_MULT : 1) * TUNE.ENEMY_SPEED_MULT * (1 + TUNE.BOSS_RAGE_SPEED * (e.rage ?? 0));

      if (e.type === MAGE) {
        // 적 마법사: 쿨다운이 끝나면 사거리 안에서 아군이 가장 많이 모인 곳에 운석을 겨눈다(외우는 동안 멈춰 선다). 그 외에는 궁병처럼 거리를 유지한다.
        if (e.cd <= 0) {
          const spot = this.meteorSpot(e, st.reach, st.splash, foes.map((f) => ({ x: f.x, y: f.y, w: f.type === NO_TYPE ? 3 : 1 })));
          if (spot) {
            e.atkT = st.windup;
            e.atkAng = Math.atan2(spot[1] - e.y, spot[0] - e.x);
            e.face = e.atkAng;
            this.casts.set(e.id, { x: spot[0], y: spot[1], total: st.windup, radius: st.splash });
            continue;
          }
        }
        this.enemyArcherMove(e, st, dt, foes, target, targetDist, speed);
        continue;
      }
      const attackRange = st.ranged ? st.reach : st.reach + target.r * 0.5;
      if (targetDist <= attackRange) {
        if (e.cd <= 0 && !(e.type === CAVALRY && e.evadeT > 0)) {
          e.atkT = st.windup;
          e.atkAng = Math.atan2(target.y - e.y, target.x - e.x);
          e.face = e.atkAng;
          e.chargeSnap = e.type === CAVALRY ? chargeBonus(speed, e.momentum) : 0;
          continue;
        }
        // 근접은 쿨다운 중에도 붙어서 압박하고(기병은 빠졌다 돌아온다), 원거리는 거리를 유지한다
        if (st.ranged) {
          this.enemyArcherMove(e, st, dt, foes, target, targetDist, speed);
          continue;
        }
      }
      this.enemyMove(e, st, dt, foes, archers, target, targetDist, speed);
    }
  }

  /** 대상 둘레를 돌아 들어가는 접근: 처음에는 옆으로 크게 돌고(포위), 가까워질수록 곧장 붙는다. 대상의 움직임을 예측해 앞질러 간다. */
  private enemySurround(e: Enemy, dt: number, target: Foe, td: number, speed: number, stopR: number, spread: number): void {
    const lead = Math.min(1, td / Math.max(60, speed)) * 0.7;
    const px = target.x + target.vx * lead;
    const py = target.y + target.vy * lead;
    const dd = Math.hypot(px - e.x, py - e.y);
    const a0 = Math.atan2(e.y - py, e.x - px); // 대상에서 나를 본 방향
    // 개체마다 정해진 쪽(±약 110도)으로 비껴서 접근한다. 가까워질수록 비김이 줄어 곧장 붙는다.
    const side = ((e.id * 0.6180339887) % 1 - 0.5) * 2 * (Math.PI * 0.62) * spread;
    const k = Math.max(0, Math.min(1, (dd - stopR) / ENEMY_SURROUND_RANGE));
    const rr = Math.max(stopR, dd * 0.85);
    const ang = a0 + side * k;
    const gx = px + Math.cos(ang) * rr;
    const gy = py + Math.sin(ang) * rr;
    this.moveToward(e, gx, gy, speed, dt, 3);
    e.face = Math.atan2(target.y - e.y, target.x - e.x);
  }

  private enemyMove(e: Enemy, st: UnitStats, dt: number, foes: Foe[], archers: Enemy[], target: Foe, td: number, speed: number): void {
    const stopR = st.reach * 0.5 + target.r;
    e.face = Math.atan2(target.y - e.y, target.x - e.x);
    switch (e.type) {
      case CAVALRY:
        this.enemyCavalryMove(e, st, dt, foes, target, td, speed);
        return;
      case ARCHER:
        this.enemyArcherMove(e, st, dt, foes, target, td, speed);
        return;
      case SHIELD: {
        // 검방병: 가까운 궁병(취약한 아군)에 붙어, 그 궁병과 위협 사이에 서서 방패로 막는다. 지킬 아군이 없으면 앞장서 밀고 들어간다.
        const ward = this.nearestEnemy(archers, e, 520);
        if (ward) {
          let threat: Foe | null = null;
          let tdw = GUARD_THREAT_RADIUS;
          for (const f of foes) {
            const d = Math.hypot(f.x - ward.x, f.y - ward.y);
            if (d < tdw) {
              tdw = d;
              threat = f;
            }
          }
          if (threat) {
            const [gx, gy] = this.guardPoint(ward, threat.x, threat.y, TUNE.GUARD_DIST); // 궁병과 위협 사이의 중간에서 포위망을 좁혀 온다
            this.moveToward(e, gx, gy, speed, dt, 6);
            e.face = Math.atan2(threat.y - e.y, threat.x - e.x); // 방패 정면을 위협 쪽으로
            return;
          }
        }
        this.enemySurround(e, dt, target, td, speed, stopR, 0.25);
        return;
      }
      case SPEAR: {
        // 창병: 아군 기병을 주시한다. 기병이 오면 지킬 궁병 앞에 서서 창끝을 기병 쪽으로 겨눈다.
        // 가까운 궁병이 있으면 그 궁병과 위협(내 기병을 먼저) 사이의 중간에서 막는다. 궁병 옆으로 가지 않는다.
        const ward = this.nearestEnemy(archers, e, 520);
        if (ward) {
          let threat: Foe | null = null;
          let ts = Infinity;
          for (const f of foes) {
            const d = Math.hypot(f.x - ward.x, f.y - ward.y);
            if (d > GUARD_THREAT_RADIUS && !(f.type === CAVALRY && d <= SPEAR_WATCH_RANGE)) continue;
            const sc = d / (f.type === CAVALRY ? 2 : 1);
            if (sc < ts) {
              ts = sc;
              threat = f;
            }
          }
          if (threat) {
            const [gx, gy] = this.guardPoint(ward, threat.x, threat.y, TUNE.SPEAR_COVER_DIST);
            this.moveToward(e, gx, gy, speed, dt, 8);
            e.face = Math.atan2(threat.y - e.y, threat.x - e.x);
            return;
          }
        }
        this.enemySurround(e, dt, target, td, speed, stopR, 0.5);
        return;
      }
      default:
        // 둔기병: 느리지만 크게 돌아 포위에 가담한다
        this.enemySurround(e, dt, target, td, speed, stopR, 1);
    }
  }

  private nearestEnemy(list: Enemy[], from: Enemy, limit: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = limit;
    for (const o of list) {
      if (o === from) continue;
      const d = Math.hypot(o.x - from.x, o.y - from.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  /** 궁병: 사거리 끝 근처에서 둘레를 돌아 에워싸며 쏘고, 근접한 상대가 오면 물러난다. 방패 정면이면 옆으로 돈다. */
  private enemyArcherMove(e: Enemy, st: UnitStats, dt: number, foes: Foe[], target: Foe, td: number, speed: number): void {
    const desired = st.reach * TUNE.ARCHER_REACH_FRAC;
    let threat: Foe | null = null;
    let gapBest = Infinity;
    for (const f of foes) {
      if (f.ranged) continue;
      const d = Math.hypot(f.x - e.x, f.y - e.y);
      const danger = (f.type === NO_TYPE ? 50 : MERC_STATS[f.type]!.reach) + f.r + st.radius + TUNE.ARCHER_KITE_MARGIN;
      if (d < danger && d - danger < gapBest) {
        threat = f;
        gapBest = d - danger;
      }
    }
    if (threat) {
      const away = Math.atan2(e.y - threat.y, e.x - threat.x);
      e.x += Math.cos(away) * speed * 1.1 * dt;
      e.y += Math.sin(away) * speed * 1.1 * dt;
      e.face = Math.atan2(threat.y - e.y, threat.x - e.x);
      return;
    }
    e.face = Math.atan2(target.y - e.y, target.x - e.x);
    if (td > st.reach) {
      this.enemySurround(e, dt, target, td, speed, desired, 0.8);
      return;
    }
    if (this.frontalShield({ x: target.x, y: target.y, r: target.r, type: target.type, shield: target.shield, face: target.face } as Target, e)) {
      // 방패 정면: 대상 둘레를 돌며 사거리 끝 거리를 유지해 옆으로 빠진다
      const away = Math.atan2(e.y - target.y, e.x - target.x);
      const side = (e.id & 1 ? 1 : -1) * (angleDiff(away, target.face) >= 0 ? 1 : -1);
      const tan = away + side * (Math.PI / 2);
      const radial = Math.max(-1, Math.min(1, (desired - td) / 80));
      let vx = Math.cos(tan) + Math.cos(away) * radial * 0.8;
      let vy = Math.sin(tan) + Math.sin(away) * radial * 0.8;
      const vl = Math.hypot(vx, vy) || 1;
      vx /= vl;
      vy /= vl;
      e.x += vx * speed * 0.9 * dt;
      e.y += vy * speed * 0.9 * dt;
    } else if (td < desired * 0.7) {
      const away = Math.atan2(e.y - target.y, e.x - target.x);
      e.x += Math.cos(away) * speed * 0.8 * dt;
      e.y += Math.sin(away) * speed * 0.8 * dt;
    }
  }

  /** 기병: 대상의 옆·뒤로 돌아 배후를 치고, 공격 뒤에는 빠졌다가 다시 달려든다. 창병은 피해 돈다. */
  private enemyCavalryMove(e: Enemy, st: UnitStats, dt: number, foes: Foe[], target: Foe, td: number, speed: number): void {
    const spears: { x: number; y: number }[] = [];
    for (const f of foes) if (f.type === SPEAR) spears.push(f);
    if (e.evadeT > 0) {
      e.evadeT = Math.max(0, e.evadeT - dt);
      const back = Math.atan2(e.y - target.y, e.x - target.x);
      e.x += Math.cos(back) * speed * CAV_EVADE_SPEED_FRAC * dt;
      e.y += Math.sin(back) * speed * CAV_EVADE_SPEED_FRAC * dt;
      this.updateMomentum(e, false, dt);
      return;
    }
    const lead = Math.min(0.8, td / Math.max(80, speed));
    let gx = target.x + target.vx * lead;
    let gy = target.y + target.vy * lead;
    const reachNow = st.reach + target.r;
    const theta = angleDiff(Math.atan2(e.y - target.y, e.x - target.x), target.face);
    if (td > 70 && Math.abs(theta) < (Math.PI * 100) / 180 && e.flankT < CAV_FLANK_MAX_SEC) {
      // 정면에서는 곧장 들어가지 않고 둘레를 돌아 옆·뒤로 접근한다
      e.flankT += dt;
      const phi = target.face + (theta >= 0 ? 1 : -1) * Math.min(Math.PI, Math.abs(theta) + 1.1);
      const radius = Math.min(260, Math.max(reachNow + 40, td * 0.9));
      gx = target.x + Math.cos(phi) * radius;
      gy = target.y + Math.sin(phi) * radius;
    } else if (td <= 70) e.flankT = 0;
    const cavSpd = cavSpeed(speed, e.momentum);
    // 창병 가까이로는 들어가지 않고 비껴 돌아간다
    let dx = gx - e.x;
    let dy = gy - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 4) return;
    dx /= dist;
    dy /= dist;
    for (const sp of spears) {
      if (Math.hypot(sp.x - target.x, sp.y - target.y) < 1) continue; // 노리는 대상이 창병이면(근접 방어) 그대로 들어간다
      const sd = Math.hypot(e.x - sp.x, e.y - sp.y);
      if (sd >= SPEAR_AVOID_RADIUS || sd < 0.001) continue;
      const w = (1 - sd / SPEAR_AVOID_RADIUS) * 1.5;
      dx += ((e.x - sp.x) / sd) * w;
      dy += ((e.y - sp.y) / sd) * w;
    }
    const len = Math.hypot(dx, dy) || 1;
    const step = Math.min(cavSpd * dt, dist);
    e.x += (dx / len) * step;
    e.y += (dy / len) * step;
    this.updateMomentum(e, true, dt);
  }

  private resolveEnemyAttack(e: Enemy, st: UnitStats, friendlies: Friendly[]): void {
    if (e.type === MAGE) {
      const cast = this.casts.get(e.id);
      this.casts.delete(e.id);
      if (!cast) return;
      this.pushEvent(EVT_METEOR, cast.x, cast.y, 0, cast.radius);
      for (const f of friendlies) {
        const d = Math.hypot(f.x - cast.x, f.y - cast.y);
        if (d > cast.radius + f.radius) continue;
        const dmg = st.damage * e.dmgMult * (1 - TUNE.MAGE_FALLOFF * Math.min(1, d / cast.radius));
        f.hit({ damage: dmg, charge: 0, srcType: MAGE, fromAngle: Math.atan2(cast.y - f.y, cast.x - f.x), pierceGuard: true, src: e });
      }
      return;
    }
    if (st.ranged) {
      this.bullets.push({
        id: this.nextEntityId++,
        x: e.x,
        y: e.y,
        vx: Math.cos(e.atkAng) * ENEMY_ARROW_SPEED,
        vy: Math.sin(e.atkAng) * ENEMY_ARROW_SPEED,
        left: st.reach * ENEMY_ARROW_RANGE_FACTOR,
        hostile: true,
        damage: st.damage * e.dmgMult,
        srcType: e.type,
        owner: 0,
        radius: 4,
        pierce: 0,
        crit: false,
        hitIds: new Set(),
      });
      return;
    }
    const charge = e.type === CAVALRY ? e.chargeSnap : 0;
    if (e.type === CAVALRY) {
      e.momentum *= CAV_MOMENTUM_AFTER_HIT;
      e.evadeT = CAV_EVADE_SEC; // 치고 빠지기
    }
    e.chargeSnap = 0;
    // 예비 동작이 끝난 시점에 부채꼴 안에 있는 아군만 맞는다. 그 사이 피하면 맞지 않는다.
    const struck: Friendly[] = [];
    for (const f of friendlies) {
      if (e.type === CAVALRY) {
        // 기병은 아군 기병처럼 짧은 직사각형으로 찌른다
        if (!inBox(CAVALRY, e.x, e.y, e.atkAng, f.x, f.y, f.radius, st.reach)) continue;
      } else {
        if (Math.hypot(f.x - e.x, f.y - e.y) > st.reach + f.radius) continue;
        if (Math.abs(angleDiff(Math.atan2(f.y - e.y, f.x - e.x), e.atkAng)) > st.arc) continue;
      }
      struck.push(f);
    }
    for (const f of struck) {
      const back = f.hit({ damage: st.damage * e.dmgMult, charge: charge * e.dmgMult, srcType: e.type, fromAngle: Math.atan2(e.y - f.y, e.x - f.x), src: e });
      if (back > 0) this.reflectToEnemy(e, back, f.ownerId, f.merc); // 창병이 돌격을 되돌려준다
    }
    if (st.splash > 0) {
      for (const f of friendlies) {
        if (struck.includes(f)) continue;
        if (!struck.some((s) => Math.hypot(s.x - f.x, s.y - f.y) <= st.splash)) continue;
        f.hit({ damage: st.damage * e.dmgMult * TUNE.SPLASH_FACTOR, charge: 0, srcType: e.type, fromAngle: Math.atan2(e.y - f.y, e.x - f.x), src: e });
      }
    }
  }

  /** 적끼리 한 점에 뭉치지 않도록 겹친 쌍을 서로 밀어낸다(격자로 이웃만 검사). */
  /**
   * 아군 용병이 한곳에 뭉치지 않도록 서로 조금씩 밀어낸다. 진형 자리·추격이 같은 곳을 가리켜도 겹쳐서 쌓이지 않는다.
   * 준비 동작 중(마법사 시전 등)인 용병은 제자리를 지키고, 대신 상대가 더 많이 밀려난다. 속도 제한이 있어 갑자기 튀지 않는다.
   */
  private separateMercs(dt: number): void {
    const CELL = 96;
    const grid = new Map<number, Merc[]>();
    const key = (cx: number, cy: number) => cx * 100003 + cy;
    const list: Merc[] = [];
    for (const m of this.mercs.values()) {
      if (m.respawn > 0) continue;
      list.push(m);
      const k = key(Math.floor(m.x / CELL), Math.floor(m.y / CELL));
      const cell = grid.get(k);
      if (cell) cell.push(m);
      else grid.set(k, [m]);
    }
    const dx = new Map<Merc, number>();
    const dy = new Map<Merc, number>();
    const add = (m: Merc, x: number, y: number) => {
      dx.set(m, (dx.get(m) ?? 0) + x);
      dy.set(m, (dy.get(m) ?? 0) + y);
    };
    const maxStep = TUNE.MERC_SEPARATION_SPEED * dt;
    for (const m of list) {
      const cx = Math.floor(m.x / CELL);
      const cy = Math.floor(m.y / CELL);
      const rm = MERC_STATS[m.type]!.radius;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (const o of grid.get(key(cx + ox, cy + oy)) ?? []) {
            if (o.id <= m.id) continue;
            const min = (rm + MERC_STATS[o.type]!.radius) * TUNE.MERC_SPACING;
            const ex = o.x - m.x;
            const ey = o.y - m.y;
            const d = Math.hypot(ex, ey);
            if (d >= min) continue;
            const push = Math.min(maxStep, (min - d) * 0.5);
            const nx = d > 0.001 ? ex / d : Math.cos(m.id * 2.4);
            const ny = d > 0.001 ? ey / d : Math.sin(m.id * 2.4);
            const mFixed = m.atkT > 0;
            const oFixed = o.atkT > 0;
            const wm = mFixed ? 0 : oFixed ? 2 : 1;
            const wo = oFixed ? 0 : mFixed ? 2 : 1;
            // 마주 보고 서로 지나가려는 둘이 막혀 서 있지 않도록, 밀어내는 힘에 옆으로 비껴 가는 성분을 조금 섞는다(둘이 서로 반대쪽으로 돈다)
            const tx = -ny * 0.8;
            const ty = nx * 0.8;
            add(m, (-nx + tx) * push * wm, (-ny + ty) * push * wm);
            add(o, (nx - tx) * push * wo, (ny - ty) * push * wo);
          }
        }
      }
    }
    for (const m of list) {
      const x = dx.get(m);
      if (x === undefined) continue;
      const y = dy.get(m)!;
      const l = Math.hypot(x, y);
      const k = l > maxStep ? maxStep / l : 1; // 여럿에게 둘러싸여도 한 틱에 maxStep 이상은 밀리지 않는다
      const r = MERC_STATS[m.type]!.radius;
      m.x = clampToWorld(m.x + x * k, r);
      m.y = clampToWorld(m.y + y * k, r);
    }
  }

  private separateEnemies(): void {
    const grid = new Map<number, Enemy[]>();
    const key = (cx: number, cy: number) => cx * 100003 + cy;
    for (const e of this.enemies.values()) {
      const k = key(Math.floor(e.x / SEPARATION_CELL), Math.floor(e.y / SEPARATION_CELL));
      const cell = grid.get(k);
      if (cell) cell.push(e);
      else grid.set(k, [e]);
    }
    for (const e of this.enemies.values()) {
      const cx = Math.floor(e.x / SEPARATION_CELL);
      const cy = Math.floor(e.y / SEPARATION_CELL);
      const er = radiusOf(e);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (const o of grid.get(key(cx + ox, cy + oy)) ?? []) {
            if (o.id <= e.id) continue; // 쌍마다 한 번만
            const min = er + radiusOf(o);
            const dx = o.x - e.x;
            const dy = o.y - e.y;
            const d = Math.hypot(dx, dy);
            if (d >= min) continue;
            const push = (min - d) / 2;
            // 완전히 겹친 경우에도 갈라지도록 id로 방향을 정한다
            const nx = d > 0.001 ? dx / d : Math.cos(e.id);
            const ny = d > 0.001 ? dy / d : Math.sin(e.id);
            e.x -= nx * push;
            e.y -= ny * push;
            o.x += nx * push;
            o.y += ny * push;
          }
        }
      }
    }
  }

  private stepBullets(dt: number, friendlies: Friendly[]): void {
    const remaining: Bullet[] = [];
    const half = WORLD_SIZE / 2;
    for (const b of this.bullets) {
      if (b.hi === undefined) b.hi = this.terrain?.elevated(b.x, b.y) ?? false;
      const mx = b.vx * dt;
      const my = b.vy * dt;
      // 빠른 투사체가 대상을 건너뛰지 않도록 이동 구간을 쪼개 검사한다
      const steps = Math.max(1, Math.ceil(Math.hypot(mx, my) / 10));
      let hit = false;
      for (let i = 1; i <= steps && !hit; i++) {
        const px = b.x + (mx * i) / steps;
        const py = b.y + (my * i) / steps;
        if (this.terrain?.hitsSolid(px, py, 2, true)) {
          hit = true; // 바위·폐허에 막힌다
          break;
        }
        if (b.hostile) {
          for (const f of friendlies) {
            if (Math.hypot(f.x - px, f.y - py) > b.radius + f.radius) continue;
            f.hit({ damage: b.damage * this.arrowTerrainMult(b, f.x, f.y), charge: 0, srcType: b.srcType, fromAngle: Math.atan2(-b.vy, -b.vx) }); // 날아온 쪽이 정면인지 본다
            this.pushEvent(EVT_ENEMY_ARROW_HIT, px, py, Math.atan2(b.vy, b.vx));
            hit = true;
            break;
          }
        } else if (this.phase === "tournament") {
          // 토너먼트: 상대 선수의 주인공·용병을 맞힌다
          const opp = this.opponentOf(b.owner);
          for (const f of friendlies) {
            if (f.ownerId !== opp) continue;
            const key = f.merc ? f.merc.id : -f.ownerId;
            if (b.hitIds.has(key) || Math.hypot(f.x - px, f.y - py) > b.radius + f.radius) continue;
            b.hitIds.add(key);
            f.hit({ damage: b.damage, charge: 0, srcType: b.srcType, fromAngle: Math.atan2(-b.vy, -b.vx), crit: b.crit, poison: b.poison ? b.damage * b.poison : 0 });
            this.pushEvent(EVT_ARROW_HIT, px, py, Math.atan2(b.vy, b.vx));
            if (b.pierce > 0) {
              b.pierce--;
              continue;
            }
            hit = true;
            break;
          }
        } else {
          for (const e of [...this.enemies.values()]) {
            if (b.hitIds.has(e.id) || Math.hypot(e.x - px, e.y - py) > b.radius + radiusOf(e)) continue;
            b.hitIds.add(e.id);
            this.damageEnemy(e, { damage: b.damage * this.arrowTerrainMult(b, e.x, e.y), charge: 0, srcType: b.srcType, fromAngle: Math.atan2(-b.vy, -b.vx), crit: b.crit, poison: b.poison ? b.damage * b.poison : 0 }, b.owner, b.merc);
            this.pushEvent(EVT_ARROW_HIT, px, py, Math.atan2(b.vy, b.vx));
            if (b.pierce > 0) {
              b.pierce--; // 뚫고 지나가 다음 적을 노린다
              const ow = this.slots.get(b.owner);
              if (ow && hasLegend(ow.mods, "pierceRamp", b.merc ? b.merc.type : "hero")) b.damage *= LEGEND_CONST.pierceRamp;
              continue;
            }
            hit = true;
            break;
          }
        }
      }
      b.x += mx;
      b.y += my;
      b.left -= Math.hypot(mx, my);
      if (!hit && b.left > 0 && Math.abs(b.x) < half && Math.abs(b.y) < half) remaining.push(b);
    }
    this.bullets = remaining;
  }
}

function radiusOf(e: Enemy): number {
  return ENEMY_STATS[e.type]!.radius * (e.boss ? BOSS_SIZE : 1);
}

function round(v: number, scale = 10): number {
  return Math.round(v * scale) / scale;
}

/** 공격 예비 동작 진행도: 0=공격 중 아님, (0..1]=진행 중 */
function progress(f: Fighter, stats: readonly UnitStats[]): number {
  if (f.atkT <= 0) return 0;
  return Math.max(0.01, round(1 - f.atkT / stats[f.type]!.windup, 100));
}
