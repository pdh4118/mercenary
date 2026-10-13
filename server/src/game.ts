import {
  BULLET_DAMAGE,
  BULLET_RADIUS,
  BULLET_RANGE,
  BULLET_SPEED,
  CAMP_FIRST_SPAWN_SEC,
  CAMP_LIFETIME_SEC,
  CAMP_MAX,
  CAMP_OFFERS,
  CAMP_SPAWN_INTERVAL_SEC,
  CAMP_USE_RADIUS,
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
  START_GOLD,
  TICK_RATE,
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

interface Slot {
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
  cd: number;
}

type Enemy = Fighter;
interface Merc extends Fighter {
  owner: number;
  respawn: number;
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
      state: { id, name: clean, x: 0, y: 0, hp: PLAYER_MAX_HP, aim: 0, kills: 0, gold: START_GOLD, respawn: 0 },
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
    if (slot) slot.input = sanitizeInput(raw);
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
    const price = mercPrice(type, owned);
    if (s.state.gold < price) return { ok: false, reason: `금화가 부족합니다 (${price}G 필요)` };
    s.state.gold -= price;
    this.addMerc(playerId, type, s.state.x, s.state.y);
    return { ok: true };
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
    this.enemies.set(id, { id, type, x, y, hp: ENEMY_STATS[type]!.hp, atkT: 0, atkAng: 0, cd: 0 });
    return id;
  }

  addMerc(owner: number, type: number, x: number, y: number): number {
    const id = this.nextEntityId++;
    this.mercs.set(id, { id, type, owner, x, y, hp: MERC_STATS[type]!.hp, atkT: 0, atkAng: 0, cd: 0, respawn: 0 });
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
    for (const m of this.mercs.values()) {
      if (m.owner === owner && m.respawn <= 0) rows[FORMATION_ROW_OF_TYPE[m.type]!]!.push(m);
    }
    const fx = Math.cos(s.facing);
    const fy = Math.sin(s.facing);
    const lx = -fy;
    const ly = fx;
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
        p.respawn = Math.max(0, p.respawn - dt);
        if (p.respawn === 0) {
          p.hp = PLAYER_MAX_HP;
          this.placeAtSpawn(p, p.id);
        }
        continue;
      }
      s.fireCd = Math.max(0, s.fireCd - dt);
      p.x = clampToWorld(p.x + s.input.dx * PLAYER_SPEED * dt, PLAYER_RADIUS);
      p.y = clampToWorld(p.y + s.input.dy * PLAYER_SPEED * dt, PLAYER_RADIUS);
      p.aim = s.input.aim;
      const turn = FORMATION_TURN_RATE * dt;
      s.facing += Math.max(-turn, Math.min(turn, angleDiff(p.aim, s.facing)));
      if (s.input.fire && s.fireCd <= 0) {
        s.fireCd = FIRE_COOLDOWN_SEC;
        this.bullets.push({
          id: this.nextEntityId++,
          x: p.x,
          y: p.y,
          vx: Math.cos(p.aim) * BULLET_SPEED,
          vy: Math.sin(p.aim) * BULLET_SPEED,
          left: BULLET_RANGE,
          hostile: false,
          damage: BULLET_DAMAGE,
          srcType: NO_TYPE,
          owner: p.id,
          radius: BULLET_RADIUS,
        });
      }
    }
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
    this.spawnBudget += perPlayer * alive.length * dt;
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
      if (s.state.respawn > 0) continue;
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
            m.respawn = MERC_RESPAWN_SEC;
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

    for (const m of this.mercs.values()) {
      const st = MERC_STATS[m.type]!;
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
      owner.state.gold += ENEMY_GOLD[e.type] ?? 0;
    }
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
          continue;
        }
        // 근접은 쿨다운 중에도 붙어서 압박하고, 원거리는 거리를 유지한다
        if (st.ranged) continue;
      }
      const stop = st.ranged ? st.reach * 0.8 : st.reach * 0.5 + target.radius;
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
