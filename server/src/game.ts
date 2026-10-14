import {
  ARCHER,
  BLUNT,
  CARDS,
  ENEMY_XP,
  ARMY_AGGRO,
  ARMY_ENGAGE_DISTANCE,
  ARMY_LEASH,
  ARMY_MARCH_SPEED,
  ARMY_SPAWN_DISTANCE,
  BOSS_DMG_MULT,
  CRIT_BASE_MULT,
  KNOCK_BOSS_FACTOR,
  KNOCK_MAX,
  KNOCK_STUN_SEC,
  DEFENSE_MAX,
  DODGE_MAX,
  EVT_DODGE,
  CRIT_MAX_CHANCE,
  AREA_ARC_MAX,
  EVT_CRIT,
  EVT_BACKSTAB,
  EVT_KNOCK,
  EVT_DMG_ALLY,
  EVT_DMG_ENEMY,
  EVT_DMG_ENEMY_CRIT,
  EVT_DMG_SHIELD,
  BOSS_HP_BASE,
  BOSS_HP_PER_STAGE,
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
  REVIVE_SEC,
  REVIVE_DECAY_FACTOR,
  STAGE_BREAK_SEC,
  STAGE_CLEAR_GOLD,
  STAGE_CLEAR_XP,
  STAGE_COUNT,
  ARCHER_KITE_HOME_PULL,
  inSpearBox,
  ARCHER_KITE_MARGIN,
  ARCHER_KITE_SPEED_MULT,
  ENEMY_LEVEL_DMG_GROWTH,
  ENEMY_LEVEL_HP_GROWTH,
  ENEMY_TIME_DMG_GROWTH,
  ENEMY_TIME_HP_GROWTH,
  STAGE_ENEMY_DMG_GROWTH,
  STAGE_ENEMY_HP_GROWTH,
  STAGE_GROW_SEC,
  STAGE_SPAWN_GROWTH,
  OFFER_SIZE,
  XP_TEAM_SHARE,
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
  CAV_RAMP_SEC,
  CAV_FLANK_MAX_SEC,
  CAV_RETREAT_HP,
  CAV_SELF_DEFENSE,
  CAVALRY,
  CHARGE_DURATION_SEC,
  CHARGE_MAX_DISTANCE,
  CHARGE_TARGET_RADIUS,
  CAMP_LIFETIME_SEC,
  CAMP_MAX,
  CAMP_OFFERS,
  CAMP_SPAWN_INTERVAL_SEC,
  CAMP_USE_RADIUS,
  DISMISS_REFUND,
  HERO_SWORD_FRONT_BLOCK,
  SHIELD,
  SHIELD_REGEN_SEC,
  SPLASH_FACTOR,
  cavSpeed,
  chargeBonus,
  ENEMY_ARROW_SPEED,
  ENEMY_GOLD,
  ENEMY_MAX,
  ENEMY_SPAWN_BASE_PER_SEC,
  ENEMY_SPAWN_DISTANCE,
  ENEMY_SPAWN_GROWTH_PER_SEC,
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
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SPEAR,
  SPEAR_AVOID_RADIUS,
  START_GOLD,
  START_LEADERSHIP,
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
  type EnemyWire,
  type EventWire,
  type GameInfo,
  type GameStatus,
  type ResultPlayer,
  type StagePhase,
  type MercWire,
  type MercStat,
  CAMP_TIER_SEC,
  SHAKEN_DEATHS,
  SQUAD_CLEAR_GOLD,
  SQUAD_FIRST_SEC,
  SQUAD_INTERVAL_BASE,
  SQUAD_INTERVAL_MIN,
  SQUAD_INTERVAL_STAGE,
  SQUAD_MARCH_MULT,
  SQUAD_SPAWN_DISTANCE,
  SHAKEN_FRAC,
  SHAKEN_GRACE_SEC,
  SHAKEN_MIN_ARMY,
  SHAKEN_DMG,
  SHAKEN_SEC,
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
} from "@mercenary/shared";
import { resolveHit, type Hit } from "./combat.js";
import { SQUAD_KINDS, armyLayout, armySize, bossTypeOf, squadComposition, squadLayout, squadSize } from "./stage.js";

/** 이 대상(주인공 또는 병종)에게 전설 능력이 있는가 */
const hasLegend = (mods: Mods, id: LegendId, scope: LegendScope): boolean => mods.legends.has(legendKey(id, scope));

/** 용병 능력치 강화 묶음(전체용 하나, 병종별 다섯). 배율 계열은 1에서, 가산 계열은 0에서 시작한다. */
type MercMods = Record<MercStat, number>;
const MULT_STATS: readonly MercStat[] = ["hp", "dmg", "atkSpeed", "speed", "range", "area", "respawn", "xp"];
const newMercMods = (): MercMods => ({
  hp: 1, dmg: 1, atkSpeed: 1, speed: 1, range: 1, area: 1, respawn: 1,
  crit: 0, critMult: 0, defense: 0, dodge: 0, regen: 0, pierce: 0, knock: 0, xp: 1,
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
  heroCrit: number;
  heroCritMult: number;
  heroArea: number;
  heroKnock: number;
  heroFireRate: number;
  heroRegen: number;
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
  heroCrit: 0,
  heroCritMult: CRIT_BASE_MULT,
  heroArea: 1,
  heroKnock: 0,
  heroFireRate: 1,
  heroRegen: 0,
});

interface Slot {
  away: boolean; // 접속이 끊겨 돌아오기를 기다리는 중. 주인공은 제자리에 서고 적에게 노려지지 않는다.
  switchCd: number; // 무기를 바꾼 직후 공격할 수 없는 남은 시간
  mods: Mods;
  state: PlayerState;
  input: PlayerInput;
  fireCd: number;
  windT: number; // 공격 준비 동작이 남은 시간(철퇴). 0이면 준비 중이 아니다
  deaths: number[]; // 최근 용병이 쓰러진 시각(사기 저하 판정)
  shakenGrace: number; // 사기 저하가 다시 걸리지 않는 남은 시간
  haste: Record<string, number>; // 전장의 함성 중첩(대상별: hero 또는 병종 번호)
  hasteT: Record<string, number>;
  zones: number[]; // 진형: 병종별 구역
  spacing: number; // 진형 간격 배율
  revives: number; // 동료를 일으켜 세운 횟수
  stats: { dealt: number; taken: number; downs: number; mercDeaths: number; gold: number }; // 기록용 누적
  facing: number; // 진형이 바라보는 방향. 조준 방향을 천천히 따라간다
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

interface Enemy extends Fighter {
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
  crit: boolean;
  hitIds: Set<number>; // 이미 맞힌 적(관통 중 중복 피해 방지)
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

/** 시험 플레이용: MERC_STAGE_GROW_SEC=20 처럼 지정하면 성장 시간이 짧아진다 */
const GROW_SEC = Number(process.env.MERC_STAGE_GROW_SEC) > 0 ? Number(process.env.MERC_STAGE_GROW_SEC) : STAGE_GROW_SEC;
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
  private phaseT = GROW_SEC; // grow: 보스군 도착까지, break: 다음 스테이지까지
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
  reset(): void {
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
    this.phaseT = GROW_SEC;
    this.stageTime = 0;
    this.status = "playing";
    this.spawnBudget = 0;
    this.campTimer = CAMP_FIRST_SPAWN_SEC;
    for (const o of old) {
      const slot = this.newSlot(o.state.id, o.state.name);
      slot.away = o.away;
      slot.zones = o.zones; // 고른 진형은 다시 시작해도 유지한다
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
        hp: PLAYER_MAX_HP,
        maxHp: PLAYER_MAX_HP,
        weapon: 0,
        swing: 0,
        wind: 0,
        aim: 0,
        kills: 0,
        gold: START_GOLD,
        level: 1,
        xp: 0,
        xpNeed: xpNeeded(1),
        pending: 0,
        rerolls: REROLL_START,
        legends: [],
        luck: 0,
        swarm: 0,
        shaken: 0,
        offer: [],
        priceMult: 1,
        leadership: START_LEADERSHIP,
        chargeLeft: 0,
        chargeX: 0,
        chargeY: 0,
        down: false,
        revive: 0,
        invuln: 0,
      },
      mods: newMods(),
      away: false,
      switchCd: 0,
      input: { dx: 0, dy: 0, aim: 0, fire: false, revive: false },
      fireCd: 0,
      windT: 0,
      deaths: [],
      shakenGrace: 0,
      haste: {},
      hasteT: {},
      zones: [...DEFAULT_PRESETS[0]!.zones],
      spacing: DEFAULT_PRESETS[0]!.spacing,
      revives: 0,
      stats: { dealt: 0, taken: 0, downs: 0, mercDeaths: 0, gold: 0 },
      facing: 0,
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
    s.state.gold += Math.floor(pick.paid * DISMISS_REFUND);
    return { ok: true };
  }

  /** 기병에게 돌격 지점을 지시한다. 주인공 가까운 곳으로 제한하고, 일정 시간 뒤 자동으로 해제된다. */
  charge(playerId: number, x: unknown, y: unknown): void {
    const s = this.slots.get(playerId);
    if (!s || s.state.down || typeof x !== "number" || typeof y !== "number") return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dx = x - s.state.x;
    const dy = y - s.state.y;
    const d = Math.hypot(dx, dy);
    const k = d > CHARGE_MAX_DISTANCE ? CHARGE_MAX_DISTANCE / d : 1;
    s.state.chargeX = clampToWorld(s.state.x + dx * k, 20);
    s.state.chargeY = clampToWorld(s.state.y + dy * k, 20);
    s.state.chargeLeft = CHARGE_DURATION_SEC;
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
      this.phaseT = GROW_SEC;
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
    this.stepPlayers(dt);
    this.stepStage(dt);
    this.stepCamps(dt);
    this.spawnEnemies(dt);
    this.stepSquads(dt);
    const friendlies = this.collectFriendlies();
    this.stepMercs(dt);
    this.stepEnemies(dt, friendlies);
    this.separateEnemies();
    this.stepBullets(dt, friendlies);
    // 모든 주인공이 쓰러져 있으면 게임오버(동료가 일으켜 세울 사람이 없다)
    if ([...this.slots.values()].every((s) => s.state.down)) this.status = "defeat";
    this.tick++;
  }

  // --- 스냅샷 -----------------------------------------------------------

  snapshotPlayers(): PlayerState[] {
    return [...this.slots.values()].map((s) => ({ ...s.state }));
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
    const minutes = Math.min(this.stageTime, GROW_SEC) / 60;
    const lv = this.averageLevel() - 1;
    const hpMult = (1 + STAGE_ENEMY_HP_GROWTH * (this.stage - 1) + ENEMY_TIME_HP_GROWTH * minutes + ENEMY_LEVEL_HP_GROWTH * lv) * (extra.boss ? BOSS_HP_BASE + BOSS_HP_PER_STAGE * (this.stage - 1) : 1);
    const e: Enemy = {
      id, type, x, y,
      hp: st.hp * hpMult,
      maxHp: st.hp * hpMult,
      shield: st.shield * hpMult,
      shieldMax: st.shield * hpMult,
      dmgMult: (1 + STAGE_ENEMY_DMG_GROWTH * (this.stage - 1) + ENEMY_TIME_DMG_GROWTH * minutes + ENEMY_LEVEL_DMG_GROWTH * lv) * (extra.boss ? BOSS_DMG_MULT : 1),
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
      timer: this.phase === "boss" ? 0 : Math.ceil(Math.max(0, this.phaseT)),
      status: this.status,
      bossType: bossTypeOf(this.stage),
      bossHp,
      armyLeft,
      armyTotal: this.armyTotal,
      squads: this.squads.size,
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
    this.phaseT = GROW_SEC;
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
    } else {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.stage++;
        this.squadTimer = SQUAD_FIRST;
        this.phase = "grow";
        this.phaseT = GROW_SEC;
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
    this.squadTimer = Math.max(SQUAD_INTERVAL_MIN, SQUAD_INTERVAL_BASE - SQUAD_INTERVAL_STAGE * this.stage);
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

  /** 장군이 쓰러지면 스테이지 클리어: 남은 병사는 흩어져 일반 적이 되고, 보상과 쓰러진 동료의 부활이 주어진다 */
  private onBossDown(): void {
    for (const e of this.enemies.values()) {
      e.army = false;
      e.boss = false;
    }
    this.army = null;
    for (const s of this.slots.values()) {
      const bonus = Math.round(STAGE_CLEAR_GOLD * this.stage * s.mods.bounty);
      s.state.gold += bonus;
      s.stats.gold += bonus;
      this.giveXp(s.state.id, STAGE_CLEAR_XP + 15 * this.stage);
      if (s.state.down) this.standUp(s);
    }
    this.phase = "break";
    this.phaseT = STAGE_BREAK_SEC;
    if (this.stage >= STAGE_COUNT) this.status = "victory";
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
    this.camps.set(id, { id, x, y, left: CAMP_LIFETIME_SEC, offers });
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

  /** 용병 진형 자리(테스트용). 주인공 기준으로 플레이어가 고른 진형(병종별 구역·간격)대로 배치된다. */
  formationSlots(owner: number): Map<number, [number, number]> {
    const s = this.slots.get(owner);
    const out = new Map<number, [number, number]>();
    if (!s) return out;
    const alive = [...this.mercs.values()].filter((m) => m.owner === owner && m.respawn <= 0);
    const rel = layoutFormation(alive, s.zones, s.spacing);
    const fx = Math.cos(s.facing);
    const fy = Math.sin(s.facing);
    for (const [id, [fwd, lat]] of rel) out.set(id, [s.state.x + fx * fwd - fy * lat, s.state.y + fy * fwd + fx * lat]);
    return out;
  }

  /** 진형을 바꾼다(병종별 구역과 간격). 잘못된 값은 무시한다. */
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
      const speed = PLAYER_SPEED * s.mods.heroSpeed;
      p.hp = Math.min(p.maxHp, p.hp + s.mods.heroRegen * dt);
      p.x = clampToWorld(p.x + s.input.dx * speed * dt, PLAYER_RADIUS);
      p.y = clampToWorld(p.y + s.input.dy * speed * dt, PLAYER_RADIUS);
      p.aim = s.input.aim;
      const turn = FORMATION_TURN_RATE * dt;
      s.facing += Math.max(-turn, Math.min(turn, angleDiff(p.aim, s.facing)));
      s.switchCd = Math.max(0, s.switchCd - dt);
      p.swing = Math.max(0, p.swing - dt);
      if (s.windT > 0) {
        s.windT -= dt;
        p.wind = Math.max(0, s.windT);
        if (s.windT <= 0) {
          s.windT = 0;
          p.wind = 0;
          this.strikeHero(s);
        }
      } else if (s.input.fire && s.fireCd <= 0 && s.switchCd <= 0) this.useWeapon(s);
    }
    this.stepRevive(dt);
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
        dp.revive = Math.max(0, dp.revive - (dt / REVIVE_SEC) * REVIVE_DECAY_FACTOR);
        continue;
      }
      dp.revive = Math.min(1, dp.revive + dt / REVIVE_SEC);
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
    this.pushEvent(EVT_REVIVE, p.x, p.y, 0);
  }

  /** 주인공 공격. 활은 투사체를 쏘고, 나머지는 조준 방향 부채꼴을 즉시 휘두른다. 무기마다 방패·범위 규칙이 다르다. */
  private useWeapon(s: Slot): void {
    const p = s.state;
    const w = WEAPONS[p.weapon]!;
    const rate = s.mods.heroFireRate * (1 + LEGEND_CONST.warcryStep * (s.haste.hero ?? 0));
    if (!w.ranged && w.windup > 0) {
      // 준비 동작: 이 동안은 움직일 수 있지만 공격은 나가지 않고, 끝나는 순간 조준 방향으로 휘두른다
      s.windT = w.windup / rate;
      p.wind = s.windT;
      s.fireCd = s.windT + w.cooldown / rate;
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
    const reach = w.reach * s.mods.heroRange;
    if (w.windup <= 0 || w.ranged) s.fireCd = w.cooldown / (s.mods.heroFireRate * (1 + LEGEND_CONST.warcryStep * (s.haste.hero ?? 0)));
    if (crit && hasLegend(s.mods, "stormfire", "hero")) s.fireCd = 0; // 폭풍 연사: 치명타면 곧바로 다음 공격
    if (w.ranged) {
      this.bullets.push({
        id: this.nextEntityId++,
        x: p.x,
        y: p.y,
        vx: Math.cos(p.aim) * BULLET_SPEED,
        vy: Math.sin(p.aim) * BULLET_SPEED,
        left: reach,
        hostile: false,
        damage,
        srcType: w.type,
        owner: p.id,
        radius: BULLET_RADIUS,
        pierce: s.mods.heroPierce,
        crit,
        hitIds: new Set(),
      });
      return;
    }
    p.swing = SWING_VISUAL_SEC;
    const arc = Math.min(AREA_ARC_MAX, w.arc * s.mods.heroArea);
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
    for (const e of struck) this.damageEnemy(e, { damage, charge: 0, srcType: w.type, fromAngle: Math.atan2(p.y - e.y, p.x - e.x), crit }, p.id);
    if (w.splash > 0) this.splashEnemies(struck, w.splash * s.mods.heroArea, damage * this.splashFactor(s.mods, "hero"), w.type, p.x, p.y, p.id);
  }

  /** 회피 판정: 피했으면 true(효과 표시를 띄운다) */
  private dodged(chance: number, x: number, y: number, owner = 0): boolean {
    if (chance <= 0 || this.rng() >= Math.min(DODGE_MAX, chance)) return false;
    this.pushEvent(EVT_DODGE, x, y, 0, 0, owner);
    return true;
  }

  private splashFactor(mods: Mods, scope: LegendScope): number {
    return SPLASH_FACTOR * (hasLegend(mods, "splashBoost", scope) ? LEGEND_CONST.splashMult : 1);
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
    this.campTimer = CAMP_SPAWN_INTERVAL_SEC;
    if (this.camps.size >= Math.min(CAMP_MAX, Math.ceil(alive.length / 2) + 1)) return;
    for (let attempt = 0; attempt < 6; attempt++) {
      const around = alive[Math.floor(this.rng() * alive.length)]!.state;
      const angle = this.rng() * Math.PI * 2;
      const dist = 320 + this.rng() * 200;
      const x = clampToWorld(around.x + Math.cos(angle) * dist, 150);
      const y = clampToWorld(around.y + Math.sin(angle) * dist, 150);
      if ([...this.camps.values()].some((c) => Math.hypot(c.x - x, c.y - y) < 300)) continue;
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
    const stageMult = (1 + STAGE_SPAWN_GROWTH * (this.stage - 1)) * (this.phase === "boss" ? 0.25 : 1);
    const perPlayer = (ENEMY_SPAWN_BASE_PER_SEC + ENEMY_SPAWN_GROWTH_PER_SEC * this.stageTime) * stageMult;
    // 인원이 늘수록 적도 늘지만, 아군 전력도 함께 늘어나므로 인원 수에 정비례시키지는 않는다
    this.spawnBudget += perPlayer * Math.pow(alive.length, 0.75) * dt;
    const totalWeight = ENEMY_SPAWN_WEIGHTS.reduce((a, b) => a + b, 0);
    while (this.spawnBudget >= 1) {
      this.spawnBudget -= 1;
      if (this.enemies.size >= ENEMY_MAX) continue;
      const target = alive[Math.floor(this.rng() * alive.length)]!.state;
      const angle = this.rng() * Math.PI * 2;
      let roll = this.rng() * totalWeight;
      let type = 0;
      while (type < ENEMY_SPAWN_WEIGHTS.length - 1 && roll >= ENEMY_SPAWN_WEIGHTS[type]!) roll -= ENEMY_SPAWN_WEIGHTS[type++]!;
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
          if (this.dodged(s.mods.heroDodge, p.x, p.y, p.id)) return 0;
          // 창을 들면 창병처럼 돌격을 반사하고, 검을 들면 정면 피해를 절반으로 막는다
          const w = WEAPONS[p.weapon]!;
          const r = resolveHit(
            { type: NO_TYPE, spearStance: w.type === SPEAR, shield: 0, face: p.aim, frontBlock: w.type === SHIELD ? HERO_SWORD_FRONT_BLOCK : undefined },
            h,
          );
          const taken = r.body * (1 - Math.min(DEFENSE_MAX, s.mods.heroDefense));
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
          const mods = this.slots.get(m.owner)?.mods;
          if (this.dodged(mods ? mstat(mods, m.type, "dodge") : 0, m.x, m.y, m.owner)) return 0;
          const r = resolveHit({ type: m.type, shield: m.shield, face: m.face }, h);
          this.applyShield(m, r.shield, r.shieldBroke);
          const taken = r.body * (1 - Math.min(DEFENSE_MAX, mods ? mstat(mods, m.type, "defense") : 0));
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
      f.regenT = SHIELD_REGEN_SEC;
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

  /** 짧은 시간에 여럿이 쓰러지면 사기가 꺾여 한동안 약해진다 */
  private noteDeath(owner: Slot): void {
    owner.deaths.push(this.time);
    owner.deaths = owner.deaths.filter((t) => this.time - t <= SHAKEN_WINDOW_SEC);
    // 큰 부대가 짧은 시간에 크게 무너졌을 때만(작은 부대나 직후 재발 제외)
    const army = this.countMercs(owner.state.id);
    if (army >= SHAKEN_MIN_ARMY && owner.state.shaken <= 0 && owner.shakenGrace <= 0 && owner.deaths.length >= Math.max(SHAKEN_DEATHS, Math.ceil(army * SHAKEN_FRAC))) {
      owner.state.shaken = SHAKEN_SEC;
      owner.deaths = [];
    }
  }

  /** 기병의 속도: 움직이면 최대 속도를 향해 점점 오르고, 멈추면 줄어든다 */
  private updateMomentum(f: Fighter, moved: boolean, dt: number): void {
    f.momentum = moved ? Math.min(1, f.momentum + dt / CAV_RAMP_SEC) : Math.max(0, f.momentum - dt / CAV_DECAY_SEC);
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
    const slotsByOwner = new Map<number, Map<number, [number, number]>>();
    for (const owner of this.slots.keys()) slotsByOwner.set(owner, this.formationSlots(owner));
    const spears = [...this.enemies.values()].filter((e) => e.type === SPEAR);

    for (const m of this.mercs.values()) {
      const st = this.mercStats(m);
      const ownerSlot = this.slots.get(m.owner);
      if (m.respawn > 0) {
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
      this.regenShield(m, st.shield, dt);
      const regen = ownerSlot ? mstat(ownerSlot.mods, m.type, "regen") : 0;
      if (regen > 0) m.hp = Math.min(st.hp, m.hp + st.hp * regen * dt);
      m.cd = Math.max(0, m.cd - dt);

      if (m.atkT > 0) {
        m.atkT -= dt;
        if (m.atkT <= 0) {
          m.atkT = 0;
          m.cd = st.cooldown;
          this.resolveMercAttack(m, st);
        }
        continue; // 예비 동작 중에는 움직이지 못한다
      }

      const home = slotsByOwner.get(m.owner)?.get(m.id) ?? [m.x, m.y];
      const homeDist = Math.hypot(home[0] - m.x, home[1] - m.y);

      if (m.type === CAVALRY) {
        this.stepCavalry(m, st, dt, home, ownerSlot, spears);
        continue;
      }

      // 대상: 원거리는 사거리 안, 근접은 진형 자리에서 leash 안에 있는 가장 가까운 적
      let target: Enemy | null = null;
      let targetDist = Infinity;
      const search = st.ranged ? st.reach : st.leash + st.reach;
      for (const e of this.enemies.values()) {
        const d = Math.hypot(e.x - m.x, e.y - m.y);
        if (d > search || d >= targetDist) continue;
        if (!st.ranged && Math.hypot(e.x - home[0], e.y - home[1]) > search) continue;
        target = e;
        targetDist = d;
      }

      // 궁병 카이팅: 근접 적이 다가오면 근접 사거리 밖으로 물러나며 쏜다(진형 쪽으로 끌려 적진 반대편으로 달아나지 않는다)
      if (st.ranged) {
        let threat: Enemy | null = null;
        let threatGap = Infinity;
        for (const e of this.enemies.values()) {
          if (ENEMY_STATS[e.type]!.ranged) continue;
          const d = Math.hypot(e.x - m.x, e.y - m.y);
          const danger = ENEMY_STATS[e.type]!.reach + radiusOf(e) + st.radius + ARCHER_KITE_MARGIN;
          if (d >= danger || d - danger >= threatGap) continue;
          threat = e;
          threatGap = d - danger;
        }
        if (threat) {
          m.face = Math.atan2(threat.y - m.y, threat.x - m.x);
          if (target && m.cd <= 0 && threatGap > -ARCHER_KITE_MARGIN * 0.6) {
            m.atkT = st.windup; // 아주 가깝지 않을 때는 한 발 쏘고 다시 물러난다
            m.atkAng = Math.atan2(target.y - m.y, target.x - m.x);
            m.face = m.atkAng;
            continue;
          }
          let ax = m.x - threat.x;
          let ay = m.y - threat.y;
          const al = Math.hypot(ax, ay) || 1;
          ax /= al;
          ay /= al;
          const hl = homeDist || 1;
          ax += ((home[0] - m.x) / hl) * ARCHER_KITE_HOME_PULL;
          ay += ((home[1] - m.y) / hl) * ARCHER_KITE_HOME_PULL;
          const ll = Math.hypot(ax, ay) || 1;
          const step = st.speed * ARCHER_KITE_SPEED_MULT * dt;
          m.x += (ax / ll) * step;
          m.y += (ay / ll) * step;
          continue;
        }
      }

      if (target) {
        m.face = Math.atan2(target.y - m.y, target.x - m.x); // 방패는 상대를 향한다
        const reachNow = st.ranged ? st.reach : st.reach + radiusOf(target);
        if (targetDist <= reachNow) {
          if (m.cd <= 0) {
            m.atkT = st.windup;
            m.atkAng = m.face;
          }
          continue;
        }
        if (!st.ranged && homeDist <= st.leash) {
          this.moveToward(m, target.x, target.y, st.speed, dt, st.reach * 0.6);
          continue;
        }
      }
      // 진형 자리로 복귀. 멀리 떨어졌다면 따라붙도록 더 빨리 움직인다. 대열은 주인공이 바라보는 쪽을 향한다.
      const speed = homeDist > 150 ? st.speed * 1.5 : st.speed;
      this.moveToward(m, home[0], home[1], speed, dt, 4);
      if (ownerSlot) m.face = ownerSlot.facing;
    }
  }

  /** 기병이 노릴 가치: 후방의 궁병과 느린 둔기병을 먼저, 정면의 방패는 나중에. 창병은 아예 피한다. */
  private cavalryWeight(type: number): number {
    if (type === ARCHER) return 2;
    if (type === BLUNT) return 1.3;
    if (type === SHIELD) return 0.7;
    return 1;
  }

  /**
   * 기병: 진형 날개에서 대기하다가, 후방의 궁병이나 느린 둔기병을 노려 옆·뒤로 돌아 들어간다.
   * 창병 적은 피해 돌고(돌격이 반사된다), 방패의 정면도 피한다. 달릴수록 속도가 붙어 돌격 피해가 커지고,
   * 공격한 뒤에는 속도를 잃고 잠깐 물러난다. 우클릭 돌격 지시 중에는 활동 범위를 넘어 지점으로 나간다.
   */
  private stepCavalry(m: Merc, st: UnitStats, dt: number, home: [number, number], owner: Slot | undefined, spears: Enemy[]): void {
    if (m.evadeT > 0) {
      m.evadeT = Math.max(0, m.evadeT - dt);
      const back = st.speed * CAV_EVADE_SPEED_FRAC;
      m.x += Math.cos(m.atkAng + Math.PI) * back * dt;
      m.y += Math.sin(m.atkAng + Math.PI) * back * dt;
      return;
    }
    const healthy = m.hp > st.hp * CAV_RETREAT_HP; // 체력이 낮으면 모험을 멈추고 복귀한다
    const charging = healthy && !!owner && owner.state.chargeLeft > 0;
    const anchor: [number, number] = charging ? [owner!.state.chargeX, owner!.state.chargeY] : home;

    let target: Enemy | null = null;
    let best = Infinity;
    if (healthy) {
      const radius = charging ? CHARGE_TARGET_RADIUS : st.leash;
      for (const e of this.enemies.values()) {
        if (Math.hypot(e.x - anchor[0], e.y - anchor[1]) > radius) continue;
        const d = Math.hypot(e.x - m.x, e.y - m.y);
        if (e.type === SPEAR && d > CAV_SELF_DEFENSE) continue; // 창병은 상대하지 않는다
        const score = d / this.cavalryWeight(e.type);
        if (score < best) {
          best = score;
          target = e;
        }
      }
    }

    const speed = cavSpeed(st.speed, m.momentum);
    if (target) {
      const reachNow = st.reach + radiusOf(target);
      const d = Math.hypot(target.x - m.x, target.y - m.y);
      if (d <= reachNow) {
        if (m.cd <= 0) {
          m.atkT = st.windup;
          m.atkAng = Math.atan2(target.y - m.y, target.x - m.x);
          m.face = m.atkAng;
          m.chargeSnap = chargeBonus(st.speed, m.momentum); // 지금까지 붙은 속도가 돌격 피해가 된다
          m.flankT = 0;
        }
        return;
      }
      // 대상의 정면에서는 곧장 들어가지 않고, 대상 둘레를 돌아 옆·뒤로 접근한다(너무 오래 걸리면 돌격)
      let gx = target.x;
      let gy = target.y;
      const theta = angleDiff(Math.atan2(m.y - target.y, m.x - target.x), target.face);
      if (d > 70 && Math.abs(theta) < (Math.PI * 100) / 180 && m.flankT < CAV_FLANK_MAX_SEC) {
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
    const homeDist = Math.hypot(home[0] - m.x, home[1] - m.y);
    // 대열을 따라잡을 때는 최대 속도로 달린다
    const catchUp = homeDist > 150 ? st.speed : speed;
    this.updateMomentum(m, this.steer(m, home[0], home[1], catchUp, dt, spears, null, 4), dt);
  }

  /** 목표를 향해 움직이되, 창병 적 가까이로는 들어가지 않고 비껴 돌아간다. 움직였으면 true. */
  private steer(m: Merc, gx: number, gy: number, speed: number, dt: number, spears: Enemy[], ignore: Enemy | null, stop: number): boolean {
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
    const critMult = CRIT_BASE_MULT + mstat(mods, m.type, "critMult");
    const dmg = st.damage * (crit ? critMult : 1);
    if (crit && hasLegend(mods, "stormfire", m.type)) m.cd = 0;
    if (st.ranged) {
      this.bullets.push({
        id: this.nextEntityId++,
        x: m.x,
        y: m.y,
        vx: Math.cos(m.atkAng) * MERC_ARROW_SPEED,
        vy: Math.sin(m.atkAng) * MERC_ARROW_SPEED,
        left: st.reach * MERC_ARROW_RANGE_FACTOR,
        hostile: false,
        damage: dmg,
        srcType: m.type,
        owner: m.owner,
        radius: 4,
        pierce: Math.round(mstat(mods, m.type, "pierce")),
        crit,
        hitIds: new Set(),
        merc: m,
      });
      return;
    }
    const charge = m.type === CAVALRY ? m.chargeSnap * (hasLegend(mods, "chargeBoost", CAVALRY) ? LEGEND_CONST.chargeMult : 1) : 0;
    if (m.type === CAVALRY) {
      m.evadeT = CAV_EVADE_SEC; // 치고 빠지기
      m.momentum *= CAV_MOMENTUM_AFTER_HIT; // 부딪히면 속도를 잃는다
    }
    m.chargeSnap = 0;
    const struck: Enemy[] = [];
    for (const e of this.enemies.values()) {
      if (m.type === SPEAR) {
        // 창병도 직사각형 찌르기. 범위 증가 능력은 폭에 적용된다.
        if (!inSpearBox(m.x, m.y, m.atkAng, e.x, e.y, radiusOf(e), st.reach, st.arc / MERC_STATS[SPEAR]!.arc)) continue;
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
    if (reflected > 0) this.hurtMerc(m, reflected); // 창병에게 돌격하면 그 피해가 자신에게 돌아온다
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
    if (has("bloodthirst") && dealt > 0) this.lifesteal(owner!, src, dealt * LEGEND_CONST.bloodthirstFrac * (hit.crit ? 2 : 1));
    if (hit.crit) this.pushEvent(EVT_CRIT, e.x, e.y, 0);
    this.pushDamage(hit.crit ? EVT_DMG_ENEMY_CRIT : EVT_DMG_ENEMY, e.id, e.x, e.y, r.body, ownerId);
    this.pushDamage(EVT_DMG_SHIELD, e.id, e.x, e.y, r.shield, ownerId);
    if (r.backstab && r.body + r.shield > 0) this.pushEvent(EVT_BACKSTAB, e.x, e.y, hit.fromAngle + Math.PI);
    if (e.hp <= 0) this.killEnemy(e, ownerId, src);
    else if (owner && r.body + r.shield > 0) this.knockBack(e, hit.fromAngle, src ? mstat(owner.mods, src.type, "knock") : owner.mods.heroKnock);
    return r.reflected;
  }

  /** 넉백: 맞은 적이 공격해 온 쪽 반대로 밀려나고, 하던 공격 동작이 끊기며 잠깐 공격하지 못한다. 보스는 덜 밀린다. */
  private knockBack(e: Enemy, fromAngle: number, amount: number): void {
    if (amount <= 0) return;
    const dist = Math.min(KNOCK_MAX, amount * (e.boss ? KNOCK_BOSS_FACTOR : 1));
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
    const shared = (xp * XP_TEAM_SHARE) / this.slots.size;
    for (const s of this.slots.values()) this.giveXp(s.state.id, shared);
    if (owner) this.giveXp(owner.state.id, xp * (1 - XP_TEAM_SHARE));
    if (e.squad) this.onSquadMemberDown(e.squad);
    if (e.boss) this.onBossDown();
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
      (c.unitType === undefined ? c.weight : c.weight * Math.min(2, 1 + 0.25 * (count(c.unitType) - 1))) * luckWeight(c.rarity, s.state.luck) * (c.effect.k === "leadership" ? leadFull : 1); // 행운이 높을수록 높은 등급이 잘 뜬다
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
        if (e.stat === "respawn") target.respawn *= 1 + e.v;
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
      case "heroCrit": m.heroCrit += e.v; break;
      case "heroCritMult": m.heroCritMult += e.v; break;
      case "heroArea": m.heroArea += e.v; break;
      case "heroFireRate": m.heroFireRate += e.v; break;
      case "heroRegen": m.heroRegen += e.v; break;
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
      damage: base.damage * mstat(mods, t, "dmg") * TIER_DMG[tier]! * (1 + (slot?.state.swarm ?? 0)) * ((slot?.state.shaken ?? 0) > 0 ? SHAKEN_DMG : 1),
      cooldown: base.cooldown / (mstat(mods, t, "atkSpeed") * (1 + LEGEND_CONST.warcryStep * (this.slots.get(m.owner)?.haste[String(t)] ?? 0))),
      speed: base.speed * mstat(mods, t, "speed") * (1 + TIER_SPEED[t]! * tier),
      reach: base.reach * mstat(mods, t, "range") * (1 + TIER_REACH[t]! * tier),
      splash: base.splash * area * (1 + TIER_AREA[t]! * tier),
      arc: Math.min(AREA_ARC_MAX, base.arc * area),
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

  private stepEnemies(dt: number, friendlies: Friendly[]): void {
    for (const e of this.enemies.values()) {
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
      let target: Friendly | null = null;
      let targetDist = Infinity;
      if (!leashed) {
        for (const f of friendlies) {
          const d = Math.hypot(f.x - e.x, f.y - e.y);
          if (d < targetDist && (home === null || d <= aggro)) {
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
      const speed = st.speed * (e.boss ? BOSS_SPEED_MULT : 1);

      const attackRange = st.ranged ? st.reach : st.reach + target.radius * 0.5;
      if (targetDist <= attackRange) {
        if (e.cd <= 0) {
          e.atkT = st.windup;
          e.atkAng = Math.atan2(target.y - e.y, target.x - e.x);
          e.face = e.atkAng;
          e.chargeSnap = e.type === CAVALRY ? chargeBonus(speed, e.momentum) : 0;
          continue;
        }
        // 근접은 쿨다운 중에도 붙어서 압박하고, 원거리는 거리를 유지한다
        if (st.ranged) continue;
      }
      const stop = st.ranged ? st.reach * 0.8 : st.reach * 0.5 + target.radius;
      e.face = Math.atan2(target.y - e.y, target.x - e.x);
      if (e.type === CAVALRY) {
        this.updateMomentum(e, this.moveToward(e, target.x, target.y, cavSpeed(speed, e.momentum), dt, stop), dt);
      } else {
        this.moveToward(e, target.x, target.y, speed, dt, stop);
      }
    }
  }

  private resolveEnemyAttack(e: Enemy, st: UnitStats, friendlies: Friendly[]): void {
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
    if (e.type === CAVALRY) e.momentum *= CAV_MOMENTUM_AFTER_HIT;
    e.chargeSnap = 0;
    // 예비 동작이 끝난 시점에 부채꼴 안에 있는 아군만 맞는다. 그 사이 피하면 맞지 않는다.
    const struck: Friendly[] = [];
    for (const f of friendlies) {
      if (Math.hypot(f.x - e.x, f.y - e.y) > st.reach + f.radius) continue;
      if (Math.abs(angleDiff(Math.atan2(f.y - e.y, f.x - e.x), e.atkAng)) > st.arc) continue;
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
        f.hit({ damage: st.damage * e.dmgMult * SPLASH_FACTOR, charge: 0, srcType: e.type, fromAngle: Math.atan2(e.y - f.y, e.x - f.x), src: e });
      }
    }
  }

  /** 적끼리 한 점에 뭉치지 않도록 겹친 쌍을 서로 밀어낸다(격자로 이웃만 검사). */
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
      const mx = b.vx * dt;
      const my = b.vy * dt;
      // 빠른 투사체가 대상을 건너뛰지 않도록 이동 구간을 쪼개 검사한다
      const steps = Math.max(1, Math.ceil(Math.hypot(mx, my) / 10));
      let hit = false;
      for (let i = 1; i <= steps && !hit; i++) {
        const px = b.x + (mx * i) / steps;
        const py = b.y + (my * i) / steps;
        if (b.hostile) {
          for (const f of friendlies) {
            if (Math.hypot(f.x - px, f.y - py) > b.radius + f.radius) continue;
            f.hit({ damage: b.damage, charge: 0, srcType: b.srcType, fromAngle: Math.atan2(-b.vy, -b.vx) }); // 날아온 쪽이 정면인지 본다
            this.pushEvent(EVT_ENEMY_ARROW_HIT, px, py, Math.atan2(b.vy, b.vx));
            hit = true;
            break;
          }
        } else {
          for (const e of [...this.enemies.values()]) {
            if (b.hitIds.has(e.id) || Math.hypot(e.x - px, e.y - py) > b.radius + radiusOf(e)) continue;
            b.hitIds.add(e.id);
            this.damageEnemy(e, { damage: b.damage, charge: 0, srcType: b.srcType, fromAngle: Math.atan2(-b.vy, -b.vx), crit: b.crit }, b.owner, b.merc);
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
