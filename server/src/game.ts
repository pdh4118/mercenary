import {
  ARCHER,
  CARDS,
  ENEMY_XP,
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
  ENEMY_ARROW_SPEED,
  ENEMY_GOLD,
  ENEMY_MAX,
  ENEMY_SPAWN_BASE_PER_SEC,
  ENEMY_SPAWN_DISTANCE,
  ENEMY_SPAWN_GROWTH_PER_SEC,
  ENEMY_SPAWN_WEIGHTS,
  ENEMY_STATS,
  FIRE_COOLDOWN_SEC,
  FORMATION_LATERAL_SPACING,
  FORMATION_ROW_OF_TYPE,
  FORMATION_ROW_OFFSET,
  FORMATION_ROW_WRAP,
  FORMATION_WING_FORWARD,
  FORMATION_WING_LATERAL,
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
  PLAYER_RESPAWN_SEC,
  PLAYER_SPEED,
  SPEAR,
  SPEAR_AVOID_RADIUS,
  START_GOLD,
  START_LEADERSHIP,
  TICK_RATE,
  UNIT_COST,
  UNIT_TYPES,
  WORLD_SIZE,
  angleDiff,
  clampToWorld,
  mercPrice,
  sanitizeInput,
  typeMultiplier,
  type BulletWire,
  type CampWire,
  type EnemyWire,
  type MercWire,
  type PlayerInput,
  type PlayerState,
  type UnitStats,
} from "@mercenary/shared";

/** 레벨업 카드로 쌓이는 강화 수치(배율은 1이 기본) */
interface Mods {
  goldMult: number;
  mercHp: number;
  mercDmg: number;
  mercAtkSpeed: number;
  mercSpeed: number;
  mercRespawn: number;
  typeHp: number[];
  typeDmg: number[];
  heroSpeed: number;
  heroDmg: number;
  heroFireRate: number;
  heroRegen: number;
}

const newMods = (): Mods => ({
  goldMult: 1,
  mercHp: 1,
  mercDmg: 1,
  mercAtkSpeed: 1,
  mercSpeed: 1,
  mercRespawn: 1,
  typeHp: UNIT_TYPES.map(() => 1),
  typeDmg: UNIT_TYPES.map(() => 1),
  heroSpeed: 1,
  heroDmg: 1,
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
  face: number; // 바라보는 방향(마지막으로 이동·공격한 방향)
  cd: number;
}

type Enemy = Fighter;
interface Merc extends Fighter {
  owner: number;
  respawn: number;
  paid: number; // 고용에 쓴 금화(해고 환급 기준)
  evadeT: number; // 기병이 공격 뒤 물러나는 남은 시간
  flankT: number; // 기병이 우회 접근에 쓴 시간
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
  defType: number;
  hurt: (amount: number) => void;
}

const SEPARATION_CELL = 32;
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

  constructor(private rng: () => number = Math.random) {}

  get isFull(): boolean {
    return this.slots.size >= MAX_PLAYERS;
  }

  addPlayer(name: string): number | null {
    if (this.isFull) return null;
    const id = this.nextId++;
    const clean = name.trim().slice(0, NAME_MAX_LENGTH) || `용병단${id}`;
    const slot: Slot = {
      state: {
        id,
        name: clean,
        x: 0,
        y: 0,
        hp: PLAYER_MAX_HP,
        maxHp: PLAYER_MAX_HP,
        weapon: 0,
        swing: 0,
        aim: 0,
        kills: 0,
        gold: START_GOLD,
        level: 1,
        xp: 0,
        xpNeed: xpNeeded(1),
        pending: 0,
        offer: [],
        priceMult: 1,
        leadership: START_LEADERSHIP,
        chargeLeft: 0,
        chargeX: 0,
        chargeY: 0,
        respawn: 0,
      },
      mods: newMods(),
      away: false,
      switchCd: 0,
      input: { dx: 0, dy: 0, aim: 0, fire: false },
      fireCd: 0,
      facing: 0,
    };
    this.placeAtSpawn(slot.state, id);
    this.slots.set(id, slot);
    return id;
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
    if (away) slot.input = { dx: 0, dy: 0, aim: slot.input.aim, fire: false };
  }

  get playerCount(): number {
    return this.slots.size;
  }

  /** 캠프에서 용병을 고용한다. 거리·금화·보유 한도를 서버가 검증한다. */
  buy(playerId: number, campId: number, offerIndex: number): BuyResult {
    const s = this.slots.get(playerId);
    const camp = this.camps.get(campId);
    if (!s || s.state.respawn > 0) return { ok: false, reason: "지금은 고용할 수 없습니다" };
    if (!camp) return { ok: false, reason: "캠프가 사라졌습니다" };
    if (Math.hypot(camp.x - s.state.x, camp.y - s.state.y) > CAMP_USE_RADIUS) {
      return { ok: false, reason: "캠프가 너무 멉니다" };
    }
    const type = Number.isInteger(offerIndex) ? camp.offers[offerIndex] : undefined;
    if (type === undefined) return { ok: false, reason: "잘못된 선택입니다" };
    const owned = this.countMercs(playerId);
    if (owned >= MAX_MERCS_PER_PLAYER) return { ok: false, reason: `용병은 최대 ${MAX_MERCS_PER_PLAYER}명입니다` };
    if (this.leadershipUsed(playerId) + UNIT_COST[type]! > s.state.leadership) {
      return { ok: false, reason: `통솔력이 부족합니다 (${UNIT_COST[type]} 필요)` };
    }
    const price = Math.round(mercPrice(type, owned) * s.state.priceMult);
    if (s.state.gold < price) return { ok: false, reason: `금화가 부족합니다 (${price}G 필요)` };
    s.state.gold -= price;
    this.addMerc(playerId, type, s.state.x, s.state.y, price);
    return { ok: true };
  }

  /** 캠프 근처에서 용병 1명을 해고하고 지불한 금화의 일부를 돌려받는다. 쓰러진 용병, 체력이 낮은 용병 순으로 내보낸다. */
  dismiss(playerId: number, type: number): BuyResult {
    const s = this.slots.get(playerId);
    if (!s || s.state.respawn > 0) return { ok: false, reason: "지금은 해고할 수 없습니다" };
    const nearCamp = [...this.camps.values()].some((c) => Math.hypot(c.x - s.state.x, c.y - s.state.y) <= CAMP_USE_RADIUS);
    if (!nearCamp) return { ok: false, reason: "캠프 근처에서만 해고할 수 있습니다" };
    let pick: Merc | null = null;
    for (const m of this.mercs.values()) {
      if (m.owner !== playerId || m.type !== type) continue;
      const rank = (x: Merc) => (x.respawn > 0 ? -1 : x.hp);
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
    if (!s || s.state.respawn > 0 || typeof x !== "number" || typeof y !== "number") return;
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
    for (const m of this.mercs.values()) if (m.owner === owner) n += UNIT_COST[m.type]!;
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
      this.spawnBudget = 0;
      this.campTimer = CAMP_FIRST_SPAWN_SEC;
      this.enemies.clear();
      this.mercs.clear();
      this.camps.clear();
      this.bullets = [];
      this.tick++;
      return;
    }
    const dt = 1 / TICK_RATE;
    this.time += dt;
    this.stepPlayers(dt);
    this.stepCamps(dt);
    this.spawnEnemies(dt);
    const friendlies = this.collectFriendlies();
    this.stepMercs(dt);
    this.stepEnemies(dt, friendlies);
    this.separateEnemies();
    this.stepBullets(dt, friendlies);
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
      Math.ceil(e.hp),
      e.type,
      progress(e, ENEMY_STATS),
      round(e.atkAng, 100),
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
    const id = this.nextEntityId++;
    this.enemies.set(id, { id, type, x, y, hp: ENEMY_STATS[type]!.hp, atkT: 0, atkAng: 0, face: 0, cd: 0 });
    return id;
  }

  addMerc(owner: number, type: number, x: number, y: number, paid = 0): number {
    const id = this.nextEntityId++;
    const merc: Merc = { id, type, owner, x, y, hp: MERC_STATS[type]!.hp, atkT: 0, atkAng: 0, face: 0, cd: 0, respawn: 0, paid, evadeT: 0, flankT: 0 };
    this.mercs.set(id, merc);
    merc.hp = this.mercStats(merc).hp; // 이미 받은 강화가 반영된 체력으로 시작한다
    return id;
  }

  spawnCampAt(x: number, y: number, offers: number[]): number {
    const id = this.nextEntityId++;
    this.camps.set(id, { id, x, y, left: CAMP_LIFETIME_SEC, offers });
    return id;
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

  /** 용병 진형 자리(테스트용). 주인공 기준 앞/옆/뒤 줄에 병종별로 배치된다. */
  formationSlots(owner: number): Map<number, [number, number]> {
    const s = this.slots.get(owner);
    const out = new Map<number, [number, number]>();
    if (!s) return out;
    const rows: Merc[][] = [[], [], []];
    const wing: Merc[] = [];
    for (const m of this.mercs.values()) {
      if (m.owner !== owner || m.respawn > 0) continue;
      const row = FORMATION_ROW_OF_TYPE[m.type]!;
      if (row < 0) wing.push(m);
      else rows[row]!.push(m);
    }
    const fx = Math.cos(s.facing);
    const fy = Math.sin(s.facing);
    const lx = -fy;
    const ly = fx;
    // 기병은 양옆 바깥 날개에 번갈아 선다
    wing.sort((a, b) => a.id - b.id);
    wing.forEach((m, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const lateral = side * (FORMATION_WING_LATERAL + Math.floor(i / 2) * FORMATION_LATERAL_SPACING);
      out.set(m.id, [s.state.x + fx * FORMATION_WING_FORWARD + lx * lateral, s.state.y + fy * FORMATION_WING_FORWARD + ly * lateral]);
    });
    rows.forEach((row, r) => {
      row.sort((a, b) => a.id - b.id);
      row.forEach((m, i) => {
        const col = i % FORMATION_ROW_WRAP;
        const wrap = Math.floor(i / FORMATION_ROW_WRAP);
        const inThisLine = Math.min(FORMATION_ROW_WRAP, row.length - wrap * FORMATION_ROW_WRAP);
        const lateral = (col - (inThisLine - 1) / 2) * FORMATION_LATERAL_SPACING;
        const forward = FORMATION_ROW_OFFSET[r]! - wrap * 30;
        out.set(m.id, [s.state.x + fx * forward + lx * lateral, s.state.y + fy * forward + ly * lateral]);
      });
    });
    return out;
  }

  // --- 내부 ------------------------------------------------------------

  private placeAtSpawn(p: PlayerState, id: number): void {
    // 겹치지 않게 중앙 주변에 원형으로 배치
    const angle = (id * Math.PI * 2) / MAX_PLAYERS;
    p.x = Math.cos(angle) * 80;
    p.y = Math.sin(angle) * 80;
  }

  private alivePlayers(): Slot[] {
    return [...this.slots.values()].filter((s) => s.state.respawn <= 0);
  }

  private stepPlayers(dt: number): void {
    for (const s of this.slots.values()) {
      const p = s.state;
      if (p.respawn > 0) {
        p.chargeLeft = 0;
        p.respawn = Math.max(0, p.respawn - dt);
        if (p.respawn === 0) {
          p.hp = p.maxHp;
          this.placeAtSpawn(p, p.id);
        }
        continue;
      }
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
      if (s.input.fire && s.fireCd <= 0 && s.switchCd <= 0) this.useWeapon(s);
    }
  }

  /** 주인공 공격. 활은 투사체를 쏘고, 나머지는 조준 방향 부채꼴을 즉시 휘두른다. 모두 무기의 병종 상성을 받는다. */
  private useWeapon(s: Slot): void {
    const p = s.state;
    const w = WEAPONS[p.weapon]!;
    const damage = w.damage * s.mods.heroDmg;
    s.fireCd = w.cooldown / s.mods.heroFireRate;
    if (w.ranged) {
      this.bullets.push({
        id: this.nextEntityId++,
        x: p.x,
        y: p.y,
        vx: Math.cos(p.aim) * BULLET_SPEED,
        vy: Math.sin(p.aim) * BULLET_SPEED,
        left: w.reach,
        hostile: false,
        damage,
        srcType: w.type,
        owner: p.id,
        radius: BULLET_RADIUS,
      });
      return;
    }
    p.swing = SWING_VISUAL_SEC;
    for (const e of [...this.enemies.values()]) {
      if (Math.hypot(e.x - p.x, e.y - p.y) > w.reach + ENEMY_STATS[e.type]!.radius) continue;
      if (Math.abs(angleDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim)) > w.arc) continue;
      this.damageEnemy(e, damage * typeMultiplier(w.type, e.type), p.id);
    }
  }

  /** 무기를 바꾼다. 바꾼 직후에는 잠깐 공격할 수 없다. */
  setWeapon(playerId: number, index: unknown): boolean {
    const s = this.slots.get(playerId);
    if (!s || typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= WEAPONS.length) return false;
    if (s.state.weapon === index) return false;
    s.state.weapon = index;
    s.switchCd = WEAPON_SWITCH_DELAY_SEC;
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

  private pickOffers(): number[] {
    const pool: number[] = [...UNIT_TYPES];
    const offers: number[] = [];
    while (offers.length < CAMP_OFFERS && pool.length > 0) {
      offers.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]!);
    }
    return offers;
  }

  private spawnEnemies(dt: number): void {
    if (!this.autoSpawn) return;
    const alive = this.alivePlayers();
    if (alive.length === 0) return;
    const perPlayer = ENEMY_SPAWN_BASE_PER_SEC + ENEMY_SPAWN_GROWTH_PER_SEC * this.time;
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
      if (s.state.respawn > 0 || s.away) continue;
      const p = s.state;
      list.push({
        x: p.x,
        y: p.y,
        radius: PLAYER_RADIUS,
        defType: NO_TYPE,
        hurt: (amount) => {
          p.hp -= amount;
          if (p.hp <= 0) {
            p.hp = 0;
            p.respawn = PLAYER_RESPAWN_SEC;
          }
        },
      });
    }
    for (const m of this.mercs.values()) {
      if (m.respawn > 0) continue;
      list.push({
        x: m.x,
        y: m.y,
        radius: MERC_STATS[m.type]!.radius,
        defType: m.type,
        hurt: (amount) => {
          m.hp -= amount;
          if (m.hp <= 0) {
            m.hp = 0;
            m.respawn = MERC_RESPAWN_SEC[m.type]! * (this.slots.get(m.owner)?.mods.mercRespawn ?? 1);
            m.atkT = 0;
          }
        },
      });
    }
    return list;
  }

  private stepMercs(dt: number): void {
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
          m.cd = 0;
          m.x = ownerSlot?.state.x ?? 0;
          m.y = ownerSlot?.state.y ?? 0;
        }
        continue;
      }
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

      if (target) {
        const reachNow = st.ranged ? st.reach : st.reach + ENEMY_STATS[target.type]!.radius;
        if (targetDist <= reachNow) {
          if (m.cd <= 0) {
            m.atkT = st.windup;
            m.atkAng = Math.atan2(target.y - m.y, target.x - m.x);
          }
          continue;
        }
        if (!st.ranged && homeDist <= st.leash) {
          this.moveToward(m, target.x, target.y, st.speed, dt, st.reach * 0.6);
          continue;
        }
      }
      // 진형 자리로 복귀. 멀리 떨어졌다면 따라붙도록 더 빨리 움직인다
      const speed = homeDist > 150 ? st.speed * 1.5 : st.speed;
      this.moveToward(m, home[0], home[1], speed, dt, 4);
    }
  }

  /**
   * 기병: 진형 날개에서 대기하다가, 자신이 강한 적(특히 후방의 궁병)을 노려 옆·뒤로 돌아 들어간다.
   * 창병 적은 피해 돌고, 공격한 뒤에는 잠깐 물러난다. 우클릭 돌격 지시 중에는 활동 범위를 넘어 지점으로 나간다.
   */
  private stepCavalry(m: Merc, st: UnitStats, dt: number, home: [number, number], owner: Slot | undefined, spears: Enemy[]): void {
    if (m.evadeT > 0) {
      m.evadeT = Math.max(0, m.evadeT - dt);
      m.x += Math.cos(m.atkAng + Math.PI) * st.speed * dt;
      m.y += Math.sin(m.atkAng + Math.PI) * st.speed * dt;
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
        // 강한 상대일수록, 특히 궁병일수록 먼저 노린다
        const score = d / (typeMultiplier(CAVALRY, e.type) * (e.type === ARCHER ? 2 : 1));
        if (score < best) {
          best = score;
          target = e;
        }
      }
    }

    if (target) {
      const reachNow = st.reach + ENEMY_STATS[target.type]!.radius;
      const d = Math.hypot(target.x - m.x, target.y - m.y);
      if (d <= reachNow) {
        if (m.cd <= 0) {
          m.atkT = st.windup;
          m.atkAng = Math.atan2(target.y - m.y, target.x - m.x);
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
      this.steer(m, gx, gy, st.speed, dt, spears, target, 0);
      return;
    }
    m.flankT = 0;
    if (charging) {
      this.steer(m, anchor[0], anchor[1], st.speed, dt, spears, null, 20);
      return;
    }
    const homeDist = Math.hypot(home[0] - m.x, home[1] - m.y);
    this.steer(m, home[0], home[1], homeDist > 150 ? st.speed * 1.5 : st.speed, dt, spears, null, 4);
  }

  /** 목표를 향해 움직이되, 창병 적 가까이로는 들어가지 않고 비껴 돌아간다 */
  private steer(m: Merc, gx: number, gy: number, speed: number, dt: number, spears: Enemy[], ignore: Enemy | null, stop: number): void {
    let dx = gx - m.x;
    let dy = gy - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= stop) return;
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
  }

  private moveToward(f: { x: number; y: number }, tx: number, ty: number, speed: number, dt: number, stop: number): void {
    const d = Math.hypot(tx - f.x, ty - f.y);
    if (d <= stop) return;
    const step = Math.min(speed * dt, d - stop);
    f.x += ((tx - f.x) / d) * step;
    f.y += ((ty - f.y) / d) * step;
  }

  private resolveMercAttack(m: Merc, st: UnitStats): void {
    if (st.ranged) {
      this.bullets.push({
        id: this.nextEntityId++,
        x: m.x,
        y: m.y,
        vx: Math.cos(m.atkAng) * MERC_ARROW_SPEED,
        vy: Math.sin(m.atkAng) * MERC_ARROW_SPEED,
        left: st.reach * MERC_ARROW_RANGE_FACTOR,
        hostile: false,
        damage: st.damage,
        srcType: m.type,
        owner: m.owner,
        radius: 4,
      });
      return;
    }
    if (m.type === CAVALRY) m.evadeT = CAV_EVADE_SEC; // 치고 빠지기
    for (const e of [...this.enemies.values()]) {
      const es = ENEMY_STATS[e.type]!;
      const d = Math.hypot(e.x - m.x, e.y - m.y);
      if (d > st.reach + es.radius) continue;
      if (Math.abs(angleDiff(Math.atan2(e.y - m.y, e.x - m.x), m.atkAng)) > st.arc) continue;
      this.damageEnemy(e, st.damage * typeMultiplier(m.type, e.type), m.owner);
    }
  }

  private damageEnemy(e: Enemy, amount: number, ownerId: number): void {
    e.hp -= amount;
    if (e.hp > 0) return;
    this.enemies.delete(e.id);
    const owner = this.slots.get(ownerId);
    if (owner) {
      owner.state.kills++;
      owner.state.gold += Math.round((ENEMY_GOLD[e.type] ?? 0) * owner.mods.goldMult);
    }
    // 경험치: 일부는 처치한 사람에게, 나머지는 모든 플레이어에게 똑같이 나눈다
    const xp = ENEMY_XP[e.type] ?? 0;
    const shared = (xp * XP_TEAM_SHARE) / this.slots.size;
    for (const s of this.slots.values()) this.giveXp(s.state.id, shared);
    if (owner) this.giveXp(owner.state.id, xp * (1 - XP_TEAM_SHARE));
  }

  /** 경험치를 주고, 레벨업하면 선택 횟수를 쌓는다. 선택지는 한 번에 하나씩 뜬다. */
  giveXp(playerId: number, amount: number): void {
    const s = this.slots.get(playerId);
    if (!s || amount <= 0) return;
    const p = s.state;
    p.xp += amount;
    let leveled = false;
    while (p.xp >= p.xpNeed) {
      p.xp -= p.xpNeed;
      p.level++;
      p.xpNeed = xpNeeded(p.level);
      p.pending++;
      leveled = true;
    }
    if (leveled && p.respawn <= 0) this.levelUpPush(p);
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
    s.state.pending--;
    s.state.offer = s.state.pending > 0 ? this.rollOffer(s) : [];
    return true;
  }

  /** 서로 다른 카드 3장. 가중치로 뽑되, 가진 병종만 해당 카드가 나오고 세 장이 모두 같은 종류가 되지는 않게 한다. */
  private rollOffer(s: Slot): number[] {
    const owned = new Set<number>();
    for (const m of this.mercs.values()) if (m.owner === s.state.id) owned.add(m.type);
    const eligible = CARDS.map((c, i) => ({ c, i })).filter(
      ({ c }) => (c.minLevel ?? 1) <= s.state.level && (c.unitType === undefined || owned.has(c.unitType)),
    );
    let best: number[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      const pool = [...eligible];
      const picked: number[] = [];
      while (picked.length < OFFER_SIZE && pool.length > 0) {
        let roll = this.rng() * pool.reduce((sum, { c }) => sum + c.weight, 0);
        let k = 0;
        while (k < pool.length - 1 && roll >= pool[k]!.c.weight) roll -= pool[k++]!.c.weight;
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
      case "mercHp": m.mercHp += e.v; break;
      case "mercDmg": m.mercDmg += e.v; break;
      case "mercAtkSpeed": m.mercAtkSpeed += e.v; break;
      case "mercSpeed": m.mercSpeed += e.v; break;
      case "mercRespawn": m.mercRespawn *= e.v; break;
      case "typeBoost":
        m.typeHp[e.type]! += e.hp;
        m.typeDmg[e.type]! += e.dmg;
        break;
      case "heroMaxHp":
        p.maxHp += e.v;
        p.hp += e.v;
        break;
      case "heroSpeed": m.heroSpeed += e.v; break;
      case "heroDmg": m.heroDmg += e.v; break;
      case "heroFireRate": m.heroFireRate += e.v; break;
      case "heroRegen": m.heroRegen += e.v; break;
    }
    for (const merc of this.mercs.values()) {
      const old = before.get(merc.id);
      if (old === undefined || merc.respawn > 0) continue;
      merc.hp += this.mercStats(merc).hp - old;
    }
  }

  /** 레벨업 카드가 반영된 용병 능력치 */
  private mercStats(m: Merc): UnitStats {
    const base = MERC_STATS[m.type]!;
    const mods = this.slots.get(m.owner)?.mods;
    if (!mods) return base;
    return {
      ...base,
      hp: Math.round(base.hp * mods.mercHp * mods.typeHp[m.type]!),
      damage: base.damage * mods.mercDmg * mods.typeDmg[m.type]!,
      cooldown: base.cooldown / mods.mercAtkSpeed,
      speed: base.speed * mods.mercSpeed,
    };
  }

  private stepEnemies(dt: number, friendlies: Friendly[]): void {
    for (const e of this.enemies.values()) {
      const st = ENEMY_STATS[e.type]!;
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

      let target: Friendly | null = null;
      let targetDist = Infinity;
      for (const f of friendlies) {
        const d = Math.hypot(f.x - e.x, f.y - e.y);
        if (d < targetDist) {
          targetDist = d;
          target = f;
        }
      }
      if (!target) continue;

      const attackRange = st.ranged ? st.reach : st.reach + target.radius * 0.5;
      if (targetDist <= attackRange) {
        if (e.cd <= 0) {
          e.atkT = st.windup;
          e.atkAng = Math.atan2(target.y - e.y, target.x - e.x);
          e.face = e.atkAng;
          continue;
        }
        // 근접은 쿨다운 중에도 붙어서 압박하고, 원거리는 거리를 유지한다
        if (st.ranged) continue;
      }
      const stop = st.ranged ? st.reach * 0.8 : st.reach * 0.5 + target.radius;
      e.face = Math.atan2(target.y - e.y, target.x - e.x);
      this.moveToward(e, target.x, target.y, st.speed, dt, stop);
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
        damage: st.damage,
        srcType: e.type,
        owner: 0,
        radius: 4,
      });
      return;
    }
    // 예비 동작이 끝난 시점에 부채꼴 안에 있는 아군만 맞는다. 그 사이 피하면 맞지 않는다.
    for (const f of friendlies) {
      if (Math.hypot(f.x - e.x, f.y - e.y) > st.reach + f.radius) continue;
      if (Math.abs(angleDiff(Math.atan2(f.y - e.y, f.x - e.x), e.atkAng)) > st.arc) continue;
      f.hurt(st.damage * typeMultiplier(e.type, f.defType));
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
      const er = ENEMY_STATS[e.type]!.radius;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (const o of grid.get(key(cx + ox, cy + oy)) ?? []) {
            if (o.id <= e.id) continue; // 쌍마다 한 번만
            const min = er + ENEMY_STATS[o.type]!.radius;
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
            f.hurt(b.damage * typeMultiplier(b.srcType, f.defType));
            hit = true;
            break;
          }
        } else {
          for (const e of this.enemies.values()) {
            if (Math.hypot(e.x - px, e.y - py) > b.radius + ENEMY_STATS[e.type]!.radius) continue;
            this.damageEnemy(e, b.damage * typeMultiplier(b.srcType, e.type), b.owner);
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

function round(v: number, scale = 10): number {
  return Math.round(v * scale) / scale;
}

/** 공격 예비 동작 진행도: 0=공격 중 아님, (0..1]=진행 중 */
function progress(f: Fighter, stats: readonly UnitStats[]): number {
  if (f.atkT <= 0) return 0;
  return Math.max(0.01, round(1 - f.atkT / stats[f.type]!.windup, 100));
}
