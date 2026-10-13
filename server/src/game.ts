import {
  BULLET_DAMAGE,
  BULLET_RADIUS,
  BULLET_RANGE,
  BULLET_SPEED,
  ENEMY_CONTACT_DAMAGE,
  ENEMY_HP,
  ENEMY_MAX,
  ENEMY_RADIUS,
  ENEMY_SPAWN_BASE_PER_SEC,
  ENEMY_SPAWN_DISTANCE,
  ENEMY_SPAWN_GROWTH_PER_SEC,
  ENEMY_SPEED,
  FIRE_COOLDOWN_SEC,
  MAX_PLAYERS,
  NAME_MAX_LENGTH,
  PLAYER_HIT_COOLDOWN_SEC,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  PLAYER_RESPAWN_SEC,
  PLAYER_SPEED,
  TICK_RATE,
  WORLD_SIZE,
  clampToWorld,
  sanitizeInput,
  type BulletWire,
  type EnemyWire,
  type PlayerInput,
  type PlayerState,
} from "@mercenary/shared";

interface Slot {
  state: PlayerState;
  input: PlayerInput;
  fireCd: number;
  hitCd: number;
}

interface Enemy {
  id: number;
  x: number;
  y: number;
  hp: number;
}

interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  left: number; // 남은 사거리
  ownerId: number;
}

const SEPARATION_CELL = ENEMY_RADIUS * 2;

/** 서버가 전투를 계산하는 권위 있는 게임 상태. 네트워크와 무관하게 테스트할 수 있다. */
export class Game {
  tick = 0;
  time = 0;
  private slots = new Map<number, Slot>();
  private enemies = new Map<number, Enemy>();
  private bullets: Bullet[] = [];
  private nextId = 1;
  private nextEntityId = 1;
  private spawnBudget = 0;

  constructor(private rng: () => number = Math.random) {}

  get isFull(): boolean {
    return this.slots.size >= MAX_PLAYERS;
  }

  addPlayer(name: string): number | null {
    if (this.isFull) return null;
    const id = this.nextId++;
    const clean = name.trim().slice(0, NAME_MAX_LENGTH) || `용병단${id}`;
    const slot: Slot = {
      state: { id, name: clean, x: 0, y: 0, hp: PLAYER_MAX_HP, aim: 0, kills: 0, respawn: 0 },
      input: { dx: 0, dy: 0, aim: 0, fire: false },
      fireCd: 0,
      hitCd: 0,
    };
    this.placeAtSpawn(slot.state, id);
    this.slots.set(id, slot);
    return id;
  }

  removePlayer(id: number): void {
    this.slots.delete(id);
  }

  setInput(id: number, raw: Parameters<typeof sanitizeInput>[0]): void {
    const slot = this.slots.get(id);
    if (slot) slot.input = sanitizeInput(raw);
  }

  step(): void {
    if (this.slots.size === 0) {
      // 아무도 없으면 판을 초기화해, 다음에 들어온 사람이 난이도가 올라간 판을 받지 않게 한다
      this.time = 0;
      this.spawnBudget = 0;
      this.enemies.clear();
      this.bullets = [];
      this.tick++;
      return;
    }
    const dt = 1 / TICK_RATE;
    this.time += dt;
    this.stepPlayers(dt);
    this.spawnEnemies(dt);
    this.stepEnemies(dt);
    this.stepBullets(dt);
    this.tick++;
  }

  snapshotPlayers(): PlayerState[] {
    return [...this.slots.values()].map((s) => ({ ...s.state }));
  }

  snapshotEnemies(): EnemyWire[] {
    return [...this.enemies.values()].map((e) => [e.id, round(e.x), round(e.y), e.hp]);
  }

  snapshotBullets(): BulletWire[] {
    return this.bullets.map((b) => [b.id, round(b.x), round(b.y), b.ownerId]);
  }

  // 테스트와 디버그용
  get enemyCount(): number {
    return this.enemies.size;
  }

  spawnEnemyAt(x: number, y: number): number {
    const id = this.nextEntityId++;
    this.enemies.set(id, { id, x, y, hp: ENEMY_HP });
    return id;
  }

  private placeAtSpawn(p: PlayerState, id: number): void {
    // 겹치지 않게 중앙 주변에 원형으로 배치
    const angle = (id * Math.PI * 2) / MAX_PLAYERS;
    p.x = Math.cos(angle) * 80;
    p.y = Math.sin(angle) * 80;
  }

  private isAlive(s: Slot): boolean {
    return s.state.respawn <= 0;
  }

  private stepPlayers(dt: number): void {
    for (const s of this.slots.values()) {
      const p = s.state;
      if (!this.isAlive(s)) {
        p.respawn = Math.max(0, p.respawn - dt);
        if (p.respawn === 0) {
          p.hp = PLAYER_MAX_HP;
          this.placeAtSpawn(p, p.id);
        }
        continue;
      }
      s.hitCd = Math.max(0, s.hitCd - dt);
      s.fireCd = Math.max(0, s.fireCd - dt);
      p.x = clampToWorld(p.x + s.input.dx * PLAYER_SPEED * dt, PLAYER_RADIUS);
      p.y = clampToWorld(p.y + s.input.dy * PLAYER_SPEED * dt, PLAYER_RADIUS);
      p.aim = s.input.aim;
      if (s.input.fire && s.fireCd <= 0) {
        s.fireCd = FIRE_COOLDOWN_SEC;
        this.bullets.push({
          id: this.nextEntityId++,
          x: p.x,
          y: p.y,
          vx: Math.cos(p.aim) * BULLET_SPEED,
          vy: Math.sin(p.aim) * BULLET_SPEED,
          left: BULLET_RANGE,
          ownerId: p.id,
        });
      }
    }
  }

  private spawnEnemies(dt: number): void {
    const alive = [...this.slots.values()].filter((s) => this.isAlive(s));
    if (alive.length === 0) return;
    const perPlayer = ENEMY_SPAWN_BASE_PER_SEC + ENEMY_SPAWN_GROWTH_PER_SEC * this.time;
    this.spawnBudget += perPlayer * alive.length * dt;
    while (this.spawnBudget >= 1) {
      this.spawnBudget -= 1;
      if (this.enemies.size >= ENEMY_MAX) continue;
      const target = alive[Math.floor(this.rng() * alive.length)]!.state;
      const angle = this.rng() * Math.PI * 2;
      this.spawnEnemyAt(
        clampToWorld(target.x + Math.cos(angle) * ENEMY_SPAWN_DISTANCE, ENEMY_RADIUS),
        clampToWorld(target.y + Math.sin(angle) * ENEMY_SPAWN_DISTANCE, ENEMY_RADIUS),
      );
    }
  }

  private stepEnemies(dt: number): void {
    const alive = [...this.slots.values()].filter((s) => this.isAlive(s));
    const touch = ENEMY_RADIUS + PLAYER_RADIUS;

    for (const e of this.enemies.values()) {
      let best: Slot | null = null;
      let bestD = Infinity;
      for (const s of alive) {
        const d = Math.hypot(s.state.x - e.x, s.state.y - e.y);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      if (!best) continue;
      if (bestD > 0.001) {
        e.x += ((best.state.x - e.x) / bestD) * ENEMY_SPEED * dt;
        e.y += ((best.state.y - e.y) / bestD) * ENEMY_SPEED * dt;
      }
      if (bestD < touch && best.hitCd <= 0 && this.isAlive(best)) {
        best.hitCd = PLAYER_HIT_COOLDOWN_SEC;
        best.state.hp -= ENEMY_CONTACT_DAMAGE;
        if (best.state.hp <= 0) {
          best.state.hp = 0;
          best.state.respawn = PLAYER_RESPAWN_SEC;
        }
      }
    }
    this.separateEnemies();
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
    const min = ENEMY_RADIUS * 2;
    for (const e of this.enemies.values()) {
      const cx = Math.floor(e.x / SEPARATION_CELL);
      const cy = Math.floor(e.y / SEPARATION_CELL);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (const o of grid.get(key(cx + ox, cy + oy)) ?? []) {
            if (o.id <= e.id) continue; // 쌍마다 한 번만
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

  private stepBullets(dt: number): void {
    const hitDist = BULLET_RADIUS + ENEMY_RADIUS;
    const remaining: Bullet[] = [];
    for (const b of this.bullets) {
      const mx = b.vx * dt;
      const my = b.vy * dt;
      // 빠른 투사체가 적을 건너뛰지 않도록 이동 구간을 쪼개 검사한다
      const steps = Math.ceil(Math.hypot(mx, my) / ENEMY_RADIUS);
      let hit = false;
      for (let i = 1; i <= steps && !hit; i++) {
        const px = b.x + (mx * i) / steps;
        const py = b.y + (my * i) / steps;
        for (const e of this.enemies.values()) {
          if (Math.hypot(e.x - px, e.y - py) > hitDist) continue;
          e.hp -= BULLET_DAMAGE;
          if (e.hp <= 0) {
            this.enemies.delete(e.id);
            const owner = this.slots.get(b.ownerId);
            if (owner) owner.state.kills++;
          }
          hit = true;
          break;
        }
      }
      b.x += mx;
      b.y += my;
      b.left -= Math.hypot(mx, my);
      const half = WORLD_SIZE / 2;
      if (!hit && b.left > 0 && Math.abs(b.x) < half && Math.abs(b.y) < half) remaining.push(b);
    }
    this.bullets = remaining;
  }
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
