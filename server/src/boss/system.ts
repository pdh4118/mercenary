import {
  BFX_ICEBREAK,
  BFX_HEAL,
  BFX_IMPACT,
  HZ_CORPSE,
  BFX_THRUST,
  BFX_SHIELDBREAK,
  BOSS_SKILL_NAMES,
  ENEMY_STATS,
  EVT_BOSSFX,
  EVT_INVULN,
  EVT_KNOCK,
  HZ_FIRE,
  HZ_GHOST,
  HZ_ICE,
  HZ_RAIN,
  HZ_RING,
  HZ_SHIELD,
  NO_TYPE,
  PLAYER_RADIUS,
  ST_STUN,
  clampToWorld,
  type HazardWire,
  type TeleWire,
} from "@mercenary/shared";
import type { Enemy, Foe, Friendly, Merc } from "../game.js";
import type { Hit } from "../combat.js";
import { KITS } from "./kits.js";
import type { BossKitState, Ctx, Hazard, KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 방향 차이(−π~π) */
export const angDiff = (a: number, b: number): number => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const KNOCK_STUN_SEC = 0.25;

/**
 * 장군 스킬 시스템. 스테이지마다 장군의 스킬 목록(KITS)이 있고, 스킬을 고르고(쿨타임·조건·가중치) 단계(예고 → 시전 → 후딜)를 진행한다.
 * 게임(g)의 내부 상태에 직접 닿는 부분이 많아 g를 느슨하게 다룬다.
 */
export class BossSystem {
  hazards: Hazard[] = [];
  private nextHz = 1;
  /** 장군 중에서 가장 최근에 만든 예고(전송용) */
  constructor(readonly g: any) {}

  reset(): void {
    this.hazards = [];
  }

  def(): KitDef | undefined {
    return KITS[this.g.stage as number];
  }

  stateOf(e: Enemy, def: KitDef): BossKitState {
    if (!e.bk) {
      e.bk = { cds: {}, cur: null, show: 0, ph: 0, t: 0, total: 0, x: e.x, y: e.y, ang: 0, idle: def.firstDelay, hit: new Set(), hitAt: new Map(), d: {}, list: [], v: {} };
    }
    return e.bk;
  }

  ctx(e: Enemy, k: BossKitState, foes: Foe[], dt: number): Ctx {
    return { e, k, foes, dt, sys: this };
  }

  /** 지금 이 스테이지·단계에서 스킬을 쓰는 장군인가 */
  active(e: Enemy): KitDef | null {
    if (!e.boss || this.g.phase !== "boss") return null;
    return this.def() ?? null;
  }

  // --- 단계 진행 ----------------------------------------------------------------

  /** 장군 스킬이 이번 틱의 움직임을 맡으면 true */
  step(e: Enemy, dt: number, foes: Foe[]): boolean {
    const def = this.active(e);
    if (!def) return false;
    const k = this.stateOf(e, def);
    const c = this.ctx(e, k, foes, dt);
    for (const key of Object.keys(k.cds)) k.cds[+key] = Math.max(0, k.cds[+key]! - dt);
    def.tick?.(c);
    if (!k.cur) {
      k.idle -= dt;
      if (k.idle <= 0 && foes.length > 0) this.pick(c, def);
      if (!k.cur) {
        if (k.idle <= 0) k.idle = 0.35;
        return def.move ? def.move(c) : false;
      }
    }
    k.t -= dt;
    k.cur!.run(c);
    return true;
  }

  /** 스킬 끝: 잠깐 쉰 뒤 다음 스킬을 고른다 */
  end(c: Ctx): void {
    const def = this.def()!;
    c.k.cur = null;
    c.k.show = 0;
    c.k.ph = 0;
    c.k.idle = def.idleMin + Math.random() * (def.idleMax - def.idleMin);
  }

  /** 체력 단계: 1(100~50%) 2(50% 이하) 3(40% 이하) */
  hpPhase(e: Enemy): number {
    const f = e.hp / e.maxHp;
    return f <= 0.4 ? 3 : f <= 0.5 ? 2 : 1;
  }

  pick(c: Ctx, def: KitDef): void {
    const { e, k } = c;
    const hp = e.hp / e.maxHp;
    const cands: SkillDef[] = [];
    for (const s of def.skills) {
      if ((k.cds[s.id] ?? 0) > 0) continue;
      if (s.phase === 2 && hp > 0.5) continue;
      if (s.phase === 3 && hp > 0.4) continue;
      if (!s.can(c)) continue;
      cands.push(s);
    }
    if (cands.length === 0) return;
    let roll = Math.random() * cands.reduce((a, s) => a + s.weight, 0);
    let pick = cands[0]!;
    for (const s of cands) {
      roll -= s.weight;
      if (roll <= 0) {
        pick = s;
        break;
      }
    }
    k.cur = pick;
    k.show = pick.id;
    k.ph = 0;
    k.hit.clear();
    k.hitAt.clear();
    k.d = {};
    k.list = [];
    k.x = e.x;
    k.y = e.y;
    k.ang = e.face;
    k.cds[pick.id] = pick.cd;
    pick.begin(c);
  }

  // --- 대상 고르기 ---------------------------------------------------------------

  foeKey(f: Foe): number {
    return f.f.merc ? f.f.merc.id : -f.f.ownerId;
  }

  isHero(f: Foe): boolean {
    return f.type === NO_TYPE;
  }

  dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** 취약한 폼 우선: 지팡이를 든 주인공 → 활을 든 주인공 → 그 외(가장 가까운 아군) */
  weakFoe(foes: Foe[], e: Enemy, range: number): Foe | null {
    let best: Foe | null = null;
    let bs = Infinity;
    for (const f of foes) {
      const d = this.dist(f, e);
      if (d > range) continue;
      let rank = 2;
      if (f.type === NO_TYPE) {
        const w = this.g.slots.get(f.f.ownerId)?.state.weapon;
        rank = w === 4 ? 0 : w === 0 ? 1 : 2;
      }
      const sc = rank * 10000 + d;
      if (sc < bs) {
        bs = sc;
        best = f;
      }
    }
    return best;
  }

  nearestFoe(foes: Foe[], e: { x: number; y: number }, range = Infinity, heroOnly = false): Foe | null {
    let best: Foe | null = null;
    let bd = range;
    for (const f of foes) {
      if (heroOnly && f.type !== NO_TYPE) continue;
      const d = this.dist(f, e);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  farthestHero(foes: Foe[], e: { x: number; y: number }, range = Infinity): Foe | null {
    let best: Foe | null = null;
    let bd = 0;
    for (const f of foes) {
      if (f.type !== NO_TYPE) continue;
      const d = this.dist(f, e);
      if (d <= range && d > bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  // --- 피해·효과 -----------------------------------------------------------------

  /** 장군의 기본 공격 피해(스테이지 강화 반영) */
  base(e: Enemy): number {
    return ENEMY_STATS[e.type]!.damage * e.dmgMult;
  }

  /** 장군 효과 컷 이벤트. len은 찌르기 줄기 같은 길이가 있는 효과의 길이(px) */
  fx(x: number, y: number, ang: number, kind: number, len = 0): void {
    this.g.pushEvent(EVT_BOSSFX, x, y, ang, kind, Math.round(len));
  }

  /** 아군 한 명(또는 한 마리)을 친다: 피해(창 든 주인공·창병은 돌격을 되돌린다), 뒤로 밀어내기 */
  hitFriendly(e: Enemy, f: Friendly, mult: number, knock = 0, charge = 0, from?: number): void {
    const ang = from ?? Math.atan2(e.y - f.y, e.x - f.x); // 맞은 쪽에서 장군을 본 방향
    f.lastBody = 0;
    const back = f.hit({ damage: this.base(e) * mult, charge: charge * e.dmgMult, srcType: e.type, fromAngle: ang, src: e });
    if (back > 0) this.g.reflectToEnemy(e, back, f.ownerId, f.merc);
    if (knock > 0) this.knock(f, ang, knock);
  }

  hitFoe(e: Enemy, foe: Foe, mult: number, knock = 0, charge = 0): void {
    this.hitFriendly(e, foe.f, mult, knock, charge);
  }

  /** 밀어내기: 맞은 쪽 반대로 knock만큼 */
  knock(f: Friendly, fromAng: number, dist: number): void {
    if (f.merc) {
      const m: Merc = f.merc;
      m.x = clampToWorld(m.x - Math.cos(fromAng) * dist, 14);
      m.y = clampToWorld(m.y - Math.sin(fromAng) * dist, 14);
      m.atkT = 0;
      m.cd = Math.max(m.cd, KNOCK_STUN_SEC);
    } else {
      const p = this.g.slots.get(f.ownerId)?.state;
      if (p && !p.down) {
        p.x = clampToWorld(p.x - Math.cos(fromAng) * dist, PLAYER_RADIUS);
        p.y = clampToWorld(p.y - Math.sin(fromAng) * dist, PLAYER_RADIUS);
      }
    }
    this.g.pushEvent(EVT_KNOCK, f.x, f.y, fromAng + Math.PI);
  }

  /** 직사각형(시작점에서 방향으로 길이 len, 폭 width) 안에 있는 아군 */
  inLine(f: { x: number; y: number; r?: number; radius?: number }, x: number, y: number, ang: number, len: number, width: number): boolean {
    const dx = f.x - x;
    const dy = f.y - y;
    const u = dx * Math.cos(ang) + dy * Math.sin(ang);
    const v = -dx * Math.sin(ang) + dy * Math.cos(ang);
    const r = f.r ?? f.radius ?? 0;
    return u >= -r && u <= len + r && Math.abs(v) <= width / 2 + r;
  }

  /** 부채꼴(꼭짓점에서 방향 ±half, 반지름 range) 안에 있는 아군 */
  inCone(f: { x: number; y: number; r?: number; radius?: number }, x: number, y: number, ang: number, half: number, range: number): boolean {
    const r = f.r ?? f.radius ?? 0;
    const d = Math.hypot(f.x - x, f.y - y);
    if (d > range + r) return false;
    if (d <= r + 6) return true;
    return Math.abs(angDiff(Math.atan2(f.y - y, f.x - x), ang)) <= half + Math.asin(Math.min(1, r / d));
  }

  /**
   * 장군이 k.ang 방향으로 speed(px/s)로 달린다(진행 거리는 k.d.trav, 최대 len). 폭 width 안의 아군마다 onHit을 한 번씩 부른다.
   * 아군 방벽·바위·맵 끝에 부딪히면 'crash'(조금 물러난다), 다 달렸으면 'done', 아니면 'run'을 돌려준다.
   * breakWalls가 true면 방벽을 부수고 지나가며(방벽 하나당 한 번 호출) 속도 손실은 호출한 쪽이 처리한다.
   */
  dashStep(c: Ctx, speed: number, len: number, width: number, onHit: (f: Foe) => void, radius = 26, breakWall?: (wallId: number) => void): "run" | "done" | "crash" {
    const { e, k, foes, dt } = c;
    const g = this.g as any;
    const step = speed * dt;
    const sub = Math.max(1, Math.ceil(step / 12)); // 얇은 방벽을 뚫고 지나가지 않게 잘게 나눠 움직인다
    k.d.trav = k.d.trav ?? 0;
    for (let i = 0; i < sub; i++) {
      const dd = Math.min(step / sub, len - k.d.trav);
      const nx = clampToWorld(e.x + Math.cos(k.ang) * dd, 14);
      const ny = clampToWorld(e.y + Math.sin(k.ang) * dd, 14);
      const edge = Math.abs(nx - (e.x + Math.cos(k.ang) * dd)) > 0.5 || Math.abs(ny - (e.y + Math.sin(k.ang) * dd)) > 0.5; // 맵 끝에 닿았다
      e.x = nx;
      e.y = ny;
      k.d.trav += dd;
      e.face = k.ang;
      const wall = (g.walls as any[]).find((w) => g.wallLocal(w, e.x, e.y, radius) !== null);
      if (wall) {
        if (breakWall) {
          breakWall(wall.id);
          g.walls = (g.walls as any[]).filter((w) => w !== wall);
        } else {
          e.x = clampToWorld(e.x - Math.cos(k.ang) * 24, 14);
          e.y = clampToWorld(e.y - Math.sin(k.ang) * 24, 14);
          return "crash";
        }
      }
      if (g.terrain?.blocked(e.x, e.y, radius) || edge) {
        e.x = clampToWorld(e.x - Math.cos(k.ang) * 24, 14);
        e.y = clampToWorld(e.y - Math.sin(k.ang) * 24, 14);
        return "crash";
      }
      for (const f of foes) {
        const key = this.foeKey(f);
        if (k.hit.has(key) || Math.hypot(f.x - e.x, f.y - e.y) > width / 2 + f.r) continue;
        k.hit.add(key);
        onHit(f);
      }
      if (k.d.trav >= len - 0.5) return "done";
    }
    return "run";
  }

  /** 장군이 쏘는 탄: 맞은 아군에게 피해(와 상태이상). vis면 그림만 날아가고 피해는 서버가 따로 준다. */
  bullet(e: Enemy, o: { x?: number; y?: number; ang: number; speed: number; range: number; mult?: number; kind?: number; pierce?: number; radius?: number; fx?: number; fxSec?: number; fxMult?: number; vis?: boolean; steal?: number }): void {
    this.g.bullets.push({
      id: this.g.nextEntityId++,
      x: o.x ?? e.x,
      y: o.y ?? e.y,
      vx: Math.cos(o.ang) * o.speed,
      vy: Math.sin(o.ang) * o.speed,
      left: o.range,
      hostile: true,
      damage: o.vis ? 0 : this.base(e) * (o.mult ?? 1),
      srcType: e.type,
      owner: 0,
      radius: o.vis ? 0 : (o.radius ?? 6),
      pierce: o.pierce ?? 0,
      crit: false,
      hitIds: new Set<number>(),
      kind: o.kind,
      fx: o.fx,
      fxSec: o.fxSec,
      fxMult: o.fxMult,
      vis: o.vis,
      steal: o.steal,
      srcId: e.id,
    });
  }

  /** 영혼 구슬이 몸에 들어간 피해만큼 보스가 회복한다 */
  healFromBullet(srcId: number, amount: number): void {
    const e = this.g.enemies.get(srcId) as Enemy | undefined;
    if (!e || amount <= 0 || e.hp <= 0) return;
    const before = e.hp;
    e.hp = Math.min(e.maxHp, e.hp + amount);
    if (e.hp - before >= 1) this.g.pushEvent(EVT_BOSSFX, e.x, e.y - 60, 0, BFX_HEAL, Math.round(e.hp - before));
  }

  /** 적·용병이 죽었다(안개 속 시체) */
  onDeath(x: number, y: number, type: number, owner: number, skel: boolean): void {
    if (this.g.phase !== "boss") return;
    this.def()?.onDeath?.(this, x, y, type, owner, skel);
  }

  /** 장판·장애물을 만든다 */
  /** 무적인 대상을 때렸을 때 "무적!"을 마지막으로 띄운 시각(대상:때린 사람) */
  private readonly invulPing = new Map<string, number>();

  addHazard(h: Partial<Hazard> & { kind: number; x: number; y: number }): Hazard {
    const hz: Hazard = { id: this.nextHz++, ang: 0, a: 0, b: 0, t: 1, total: 1, delay: 0, vx: 0, vy: 0, hp: 0, hpMax: 0, hit: new Set(), tick: 0, src: 0, dmg: 0, solid: 0, d: {}, ...h };
    hz.total = h.total ?? hz.t;
    this.hazards.push(hz);
    return hz;
  }

  // --- 매 틱(모든 장판) ------------------------------------------------------------

  /** 무적 시간을 줄이고, 장판을 갱신하고, 아군이 장애물을 통과하지 못하게 민다 */
  stepGlobal(dt: number, friendlies: Friendly[]): void {
    for (const e of this.g.enemies.values() as Iterable<Enemy>) {
      if (e.invulnT && e.invulnT > 0) e.invulnT = Math.max(0, e.invulnT - dt);
    }
    this.def()?.global?.(this, friendlies, dt);
    if (this.hazards.length === 0) return;
    const src = (id: number): Enemy | undefined => this.g.enemies.get(id);
    for (const h of this.hazards) {
      if (h.delay > 0) {
        h.delay -= dt;
        if (h.delay <= 0) {
          h.delay = 0;
          if (h.kind === HZ_RAIN) {
            // 화살비: 예고가 끝나면 한꺼번에 떨어진다
            const boss = src(h.src);
            if (boss) {
              for (const f of friendlies) {
                if (Math.hypot(f.x - h.x, f.y - h.y) > h.a + f.radius) continue;
                this.hitFriendly(boss, f, h.dmg, h.d.knock ?? 0, 0, Math.atan2(h.y - f.y, h.x - f.x));
                if (h.d.stun) f.status(ST_STUN, h.d.stun);
              }
            }
            if (h.b === 1) this.g.pushEvent(EVT_BOSSFX, h.x, h.y, 0, BFX_IMPACT); // 철퇴 착탄만 충격 효과가 나온다(화살비는 땅에 박힌 화살만 남는다)
            h.t = 0.35;
            h.total = 0.35;
            h.d.fell = 1;
          }
        }
        continue;
      }
      h.t -= dt;
      switch (h.kind) {
        case HZ_FIRE: {
          // 불길 장판: 0.5초마다 안에 있는 아군에게 피해
          h.tick -= dt;
          if (h.tick <= 0) {
            h.tick += 0.5;
            const boss = src(h.src);
            if (boss) for (const f of friendlies) if (Math.hypot(f.x - h.x, f.y - h.y) <= h.a + f.radius * 0.5) this.hitFriendly(boss, f, h.dmg, 0);
          }
          break;
        }
        case HZ_GHOST: {
          // 분신: a=1 달리는 중, a=2 멈춰 서 있음, a=3 방금 찔렀음. 달려가며 지나친 대상을 치고, 멈춘 뒤 가까운 대상을 여러 번 찌르고 사라진다.
          const boss = src(h.src);
          if (!boss) {
            h.t = 0;
            break;
          }
          if (h.a === 1) {
            const step = h.t > 0 ? dt : dt + h.t; // 도착 시간을 넘긴 만큼은 덜 달린다
            const px = h.x;
            const py = h.y;
            h.x += h.vx * step;
            h.y += h.vy * step;
            // 분신이 한 틱에 수십~백 픽셀을 달리므로, 지난 위치에서 지금 위치까지 이은 선분과의 거리로 맞았는지 본다(대상을 건너뛰지 않게)
            const sx = h.x - px;
            const sy = h.y - py;
            const sl = sx * sx + sy * sy || 1;
            for (const f of friendlies) {
              const key = f.merc ? f.merc.id : -f.ownerId;
              const u = Math.max(0, Math.min(1, ((f.x - px) * sx + (f.y - py) * sy) / sl));
              if (h.hit.has(key) || Math.hypot(f.x - (px + sx * u), f.y - (py + sy * u)) > h.b / 2 + f.radius) continue;
              h.hit.add(key);
              this.hitFriendly(boss, f, h.dmg, h.d.knock ?? 90, 0, Math.atan2(-h.vy, -h.vx));
            }
            if (h.t <= 0) {
              h.a = 2;
              h.vx = h.vy = 0;
              h.t = h.total = h.d.strikes! * h.d.step! + 0.2 + h.d.fade!;
              h.d.n = 0;
              h.d.next = 0.2;
              h.d.flash = 0;
            }
            break;
          }
          h.d.flash! -= dt;
          if (h.a === 3 && h.d.flash! <= 0) h.a = 2;
          h.d.next! -= dt;
          if (h.d.next! <= 0 && h.d.n! < h.d.strikes!) {
            let tgt: Friendly | null = null;
            let bd = h.d.range!;
            for (const f of friendlies) {
              const d = Math.hypot(f.x - h.x, f.y - h.y);
              if (d < bd) {
                bd = d;
                tgt = f;
              }
            }
            if (tgt) h.ang = Math.atan2(tgt.y - h.y, tgt.x - h.x);
            for (const f of friendlies) {
              if (this.inLine(f, h.x, h.y, h.ang, h.d.len!, h.d.width!)) this.hitFriendly(boss, f, h.d.sdmg!, h.d.sknock ?? 0, 0, Math.atan2(h.y - f.y, h.x - f.x));
            }
            this.g.pushEvent(EVT_BOSSFX, h.x, h.y, h.ang, BFX_THRUST, Math.round(h.d.len!));
            h.a = 3;
            h.d.flash = 0.16;
            h.d.n!++;
            h.d.next = h.d.step!;
          }
          break;
        }
        case HZ_RING: {
          h.a += h.vx * dt; // vx = 퍼지는 속도, a = 현재 반지름
          const boss = src(h.src);
          if (boss) {
            for (const f of friendlies) {
              const key = f.merc ? f.merc.id : -f.ownerId;
              if (h.hit.has(key)) continue;
              const d = Math.hypot(f.x - h.x, f.y - h.y);
              if (Math.abs(d - h.a) > (h.d.w ?? 60) / 2 + f.radius) continue;
              if (Math.abs(angDiff(Math.atan2(f.y - h.y, f.x - h.x), h.ang)) <= h.b) continue; // 틈
              h.hit.add(key);
              this.hitFriendly(boss, f, h.dmg, 60, 0, Math.atan2(h.y - f.y, h.x - f.x));
            }
          }
          if (h.a >= (h.d.max ?? 600)) h.t = 0;
          break;
        }
        default:
      }
    }
    this.hazards = this.hazards.filter((h) => h.t > 0 || h.delay > 0);
    this.pushOut(friendlies);
  }

  /** 막는 장애물(거대 방패·얼음벽·박힌 창·철퇴)이 아군(주인공·용병)을 통과시키지 않게 밀어낸다 */
  private pushOut(friendlies: Friendly[]): void {
    const barriers = this.hazards.filter((h) => h.delay <= 0 && (h.solid > 0 || h.kind === HZ_SHIELD || h.kind === HZ_ICE));
    if (barriers.length === 0) return;
    for (const f of friendlies) {
      let moved = false;
      let x = f.x;
      let y = f.y;
      for (const h of barriers) {
        if (h.kind === HZ_SHIELD || h.kind === HZ_ICE) {
          const c = Math.cos(h.ang);
          const s = Math.sin(h.ang);
          const dx = x - h.x;
          const dy = y - h.y;
          const u = dx * c + dy * s;
          const v = -dx * s + dy * c;
          const ht = h.d.ht ?? 12;
          if (Math.abs(u) > h.a + f.radius || Math.abs(v) > ht + f.radius) continue;
          const penU = h.a + f.radius - Math.abs(u);
          const penV = ht + f.radius - Math.abs(v);
          let du = 0;
          let dv = 0;
          if (penV <= penU) dv = (v >= 0 ? 1 : -1) * (penV + 0.5);
          else du = (u >= 0 ? 1 : -1) * (penU + 0.5);
          x += du * c - dv * s;
          y += du * s + dv * c;
          moved = true;
        } else {
          const d = Math.hypot(x - h.x, y - h.y);
          const min = h.solid + f.radius;
          if (d >= min) continue;
          const nx = d > 0.001 ? (x - h.x) / d : 1;
          const ny = d > 0.001 ? (y - h.y) / d : 0;
          x = h.x + nx * (min + 0.5);
          y = h.y + ny * (min + 0.5);
          moved = true;
        }
      }
      if (!moved) continue;
      if (f.merc) {
        f.merc.x = x;
        f.merc.y = y;
      } else {
        const p = this.g.slots.get(f.ownerId)?.state;
        if (p) {
          p.x = x;
          p.y = y;
        }
      }
      f.x = x;
      f.y = y;
    }
  }

  // --- 아군의 공격이 장애물에 닿을 때 ------------------------------------------------

  /** 직사각형 장애물 안(여유 r)에 점이 있는가 */
  private inRect(h: Hazard, px: number, py: number, r: number): boolean {
    const dx = px - h.x;
    const dy = py - h.y;
    const u = dx * Math.cos(h.ang) + dy * Math.sin(h.ang);
    const v = -dx * Math.sin(h.ang) + dy * Math.cos(h.ang);
    return Math.abs(u) <= h.a + r && Math.abs(v) <= (h.d.ht ?? 12) + r;
  }

  /** 아군 투사체가 거대 방패·얼음벽에 막힌다. 막혔으면 true. (적 투사체는 거대 방패를 지나간다) */
  blockBullet(b: { hostile: boolean; damage: number; radius: number }, px: number, py: number): boolean {
    for (const h of this.hazards) {
      if (h.delay > 0 || (h.kind !== HZ_SHIELD && h.kind !== HZ_ICE)) continue;
      if (b.hostile && h.kind === HZ_SHIELD) continue;
      if (!this.inRect(h, px, py, b.radius)) continue;
      if (!b.hostile) this.damageBarrier(h, b.damage);
      return true;
    }
    return false;
  }

  /** 얼음벽은 공격 한 번이 1회, 거대 방패는 피해만큼 체력이 깎인다 */
  private damageBarrier(h: Hazard, dmg: number): void {
    if (h.kind === HZ_ICE) h.hp -= 1;
    else h.hp -= dmg;
    if (h.hp <= 0) {
      h.t = 0;
      this.g.pushEvent(EVT_BOSSFX, h.x, h.y, 0, h.kind === HZ_ICE ? BFX_ICEBREAK : BFX_SHIELDBREAK);
    }
  }

  private hitCorpse(h: Hazard, all = false): void {
    h.hp -= all ? h.hp + 1 : 1;
    h.b = Math.max(0, h.hp);
    if (h.hp <= 0) {
      h.t = 0;
      this.g.pushEvent(EVT_BOSSFX, h.x, h.y, 0, BFX_IMPACT);
    }
  }

  /** 아군의 근접 공격이 사거리 안의 장애물을 때린다 */
  strikeBarriers(x: number, y: number, reach: number, dmg: number): void {
    for (const h of this.hazards) {
      if (h.kind === HZ_CORPSE && h.t > 0) {
        // 시체는 근접 공격 3번이면 부서진다(소생할 수 없다)
        if (Math.hypot(x - h.x, y - h.y) <= reach + 18) this.hitCorpse(h);
        continue;
      }
      if (h.delay > 0 || (h.kind !== HZ_SHIELD && h.kind !== HZ_ICE)) continue;
      const dx = x - h.x;
      const dy = y - h.y;
      const u = Math.max(-h.a, Math.min(h.a, dx * Math.cos(h.ang) + dy * Math.sin(h.ang)));
      const cx = h.x + Math.cos(h.ang) * u;
      const cy = h.y + Math.sin(h.ang) * u;
      if (Math.hypot(x - cx, y - cy) > reach + (h.d.ht ?? 12) + 10) continue;
      this.damageBarrier(h, dmg);
    }
  }

  /** 아군 운석이 얼음벽을 때린다(범위 공격은 맞은 조각마다 1회) */
  meteorBarriers(x: number, y: number, radius: number): void {
    for (const h of this.hazards) {
      if (h.kind === HZ_CORPSE && h.t > 0 && Math.hypot(h.x - x, h.y - y) <= radius + 14) {
        h.hp = 0;
        this.hitCorpse(h, true); // 범위 공격은 시체를 한꺼번에 부순다
        continue;
      }
      if (h.delay > 0 || h.kind !== HZ_ICE) continue;
      if (Math.hypot(h.x - x, h.y - y) > radius + h.a) continue;
      this.damageBarrier(h, 0);
    }
  }

  // --- 맞을 때 --------------------------------------------------------------------

  /** 장군(또는 무적인 보스군)이 맞기 전에 피해를 바꾼다. null이면 피해 없음. */
  preHit(e: Enemy, hit: Hit, ownerId: number, src?: Merc): Hit | null {
    if (e.invulnT && e.invulnT > 0) {
      // 무적인 대상을 때리면 때린 사람에게 "무적!"을 띄운다(같은 사람에게는 0.4초에 한 번만)
      const key = `${e.id}:${ownerId}`;
      const now = (this.g as unknown as { time: number }).time;
      if (ownerId > 0 && now - (this.invulPing.get(key) ?? -9) >= 0.4) {
        this.invulPing.set(key, now);
        this.g.pushEvent(EVT_INVULN, e.x, e.y - 50, 0, 0, ownerId);
      }
      return null;
    }
    const def = this.active(e);
    if (!def?.preHit || !e.bk) return hit;
    return def.preHit(this.ctx(e, e.bk, [], 0), hit, ownerId, src);
  }

  onHit(e: Enemy, hit: Hit, ownerId: number, src?: Merc): void {
    const def = this.active(e);
    if (def?.onHit && e.bk) def.onHit(this.ctx(e, e.bk, [], 0), hit, ownerId, src);
  }

  /** 맞은 쪽에 되돌려주는 피해(몸에 그대로 들어간다) */
  reflectTo(ownerId: number, src: Merc | undefined, amount: number): void {
    const list: Friendly[] = this.g.collectFriendlies();
    const f = list.find((x) => (src ? x.merc === src : x.ownerId === ownerId && !x.merc));
    if (f && amount > 0) f.hit({ damage: amount, charge: 0, srcType: -1, fromAngle: 0, pierceGuard: true });
  }

  // --- 전송 -----------------------------------------------------------------------

  snapshotTele(): TeleWire[] {
    const out: TeleWire[] = [];
    const def = this.def();
    if (!def || this.g.phase !== "boss") return out;
    for (const e of this.g.enemies.values() as Iterable<Enemy>) {
      const k = e.bk;
      if (!e.boss || !k) continue;
      const c = this.ctx(e, k, [], 0);
      if (k.cur?.tele && (k.cur.telePhases ?? [0]).includes(k.ph)) out.push(...k.cur.tele(c));
      if (def.teleAlways) out.push(...def.teleAlways(c));
    }
    return out;
  }

  snapshotHazards(): HazardWire[] {
    const r = Math.round;
    return this.hazards.filter((h) => h.t > 0 || h.delay > 0).map((h): HazardWire => [h.id, h.kind, r(h.x), r(h.y), Math.round(h.ang * 100) / 100, r(h.a), h.kind === HZ_RING ? r(h.b * 100) : r(h.b), Math.max(0, r((h.delay > 0 ? h.delay : h.t) * 10)), Math.max(1, r(h.total * 10)), h.delay > 0 ? 0 : 1]);
  }

  /** 장군의 화면 표시 상태 비트 */
  flagsOf(e: Enemy): number {
    const def = this.def();
    if (!def?.flags || !e.bk) return (e.invulnT ?? 0) > 0 ? 8 : 0;
    return def.flags(this.ctx(e, e.bk, [], 0)) | ((e.invulnT ?? 0) > 0 ? 8 : 0);
  }

  /** 장군 이동 속도 배율(질주 등) */
  speedMult(e: Enemy): number {
    const def = this.def();
    if (!def?.speedMult || !e.bk) return 1;
    return def.speedMult(this.ctx(e, e.bk, [], 0));
  }

  skillName(id: number): string {
    return BOSS_SKILL_NAMES[id] ?? "";
  }
}

/** 장군 선택 도우미: 스킬 상태에서 화면용 번호 */
export const shownSkill = (e: Enemy): number => e.bk?.show ?? 0;
