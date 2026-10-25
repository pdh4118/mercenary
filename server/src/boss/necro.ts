import {
  BOSS_NECRO as C,
  BFX_CHAINBREAK,
  BFX_HEAL,
  BFX_IMPACT,
  BFX_RISE,
  BSK_CHAIN,
  BSK_DRAIN,
  BSK_FOG,
  BSK_ORB,
  BUL_ORB,
  EF_STUN,
  HZ_CHAIN,
  HZ_CORPSE,
  HZ_DRAINRING,
  HZ_FOG,
  HZ_LEECH,
  NO_TYPE,
  ST_ROOT,
  ST_STUN,
  TELE_CIRCLE,
  TELE_LINE,
  clampToWorld,
} from "@mercenary/shared";
import type { Enemy, Foe, Friendly } from "../game.js";
import type { BossSystem } from "./system.js";
import type { Ctx, Hazard, KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const r1 = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;
const lt = (k: { t: number; total: number }) => [Math.max(0, r1(k.t * 10)), Math.max(1, r1(k.total * 10))] as const;
const keyOf = (f: Friendly): number => (f.merc ? f.merc.id : -f.ownerId);

const fogs = (sys: BossSystem): Hazard[] => sys.hazards.filter((h) => h.kind === HZ_FOG && h.t > 0);
const corpses = (sys: BossSystem): Hazard[] => sys.hazards.filter((h) => h.kind === HZ_CORPSE && h.t > 0);
const inFog = (sys: BossSystem, x: number, y: number): boolean => fogs(sys).some((h) => Math.hypot(x - h.x, y - h.y) <= h.a);
const bossOf = (sys: BossSystem): Enemy | undefined => [...(sys.g.enemies.values() as Iterable<Enemy>)].find((e) => e.boss);

/** 보스 체력 회복(흡혈·생명 흡수). 최대 체력을 넘지 않고, 회복량을 초록 숫자로 띄운다. */
function heal(sys: BossSystem, e: Enemy, amount: number): void {
  if (amount <= 0 || e.hp <= 0) return;
  const before = e.hp;
  e.hp = Math.min(e.maxHp, e.hp + amount);
  const got = e.hp - before;
  if (got >= 1) sys.fx(e.x, e.y - 60, 0, BFX_HEAL, got);
}

/** 가장 가까운 아군 */
function nearest(c: Ctx, range: number): Foe | null {
  return c.sys.nearestFoe(c.foes, c.e, range);
}

// --- 암흑 안개 ---------------------------------------------------------------

const fog: SkillDef = {
  id: BSK_FOG,
  cd: C.fogCd,
  weight: 8,
  can: ({ sys }) => fogs(sys).length === 0,
  begin: ({ e, k }) => {
    k.x = e.x;
    k.y = e.y;
    k.t = k.total = C.fogTele;
    k.v.fogDone = 1;
  },
  run: (c) => {
    const { e, k, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      sys.addHazard({ kind: HZ_FOG, x: k.x, y: k.y, a: C.fogRadius, t: C.fogSec, total: C.fogSec, src: e.id, tick: C.fogTick });
      k.ph = 2;
      k.t = 0.6;
    } else if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ k }) => [[TELE_CIRCLE, r1(k.x), r1(k.y), 0, C.fogRadius, 0, ...lt(k), BSK_FOG]],
};

// --- 생명 흡수 ---------------------------------------------------------------

const drain: SkillDef = {
  id: BSK_DRAIN,
  cd: C.drainCd,
  weight: 4,
  phase: 2,
  can: (c) => !!c.k.v.fogDone && !!nearest(c, C.drainRadius + 200),
  begin: ({ e, k, sys }) => {
    k.x = e.x;
    k.y = e.y;
    k.t = k.total = C.drainTele;
    k.list = [];
    k.d.hz = sys.addHazard({ kind: HZ_DRAINRING, x: e.x, y: e.y, a: C.drainRadius, delay: C.drainTele, t: C.drainSec, total: C.drainSec, src: e.id }).id;
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    if (k.ph === 0) {
      if (k.t > 0) return;
      k.ph = 1;
      k.t = C.drainSec;
      k.d.next = 0;
    }
    if (k.ph === 1) {
      const links = k.list as { key: number; hz: Hazard }[];
      const inside = new Set<number>();
      for (const f of foes) {
        const d = sys.dist(f, e);
        if (d > C.drainRadius) continue;
        const key = sys.foeKey(f);
        inside.add(key);
        let ln = links.find((l) => l.key === key);
        if (!ln) {
          ln = { key, hz: sys.addHazard({ kind: HZ_LEECH, x: e.x, y: e.y, t: C.drainSec + 1, total: C.drainSec + 1, src: e.id }) };
          links.push(ln);
        }
        ln.hz.x = e.x;
        ln.hz.y = e.y - 24;
        ln.hz.ang = Math.atan2(f.y - ln.hz.y, f.x - ln.hz.x);
        ln.hz.a = Math.hypot(f.x - ln.hz.x, f.y - ln.hz.y);
        ln.hz.t = Math.max(ln.hz.t, 0.3);
      }
      for (let i = links.length - 1; i >= 0; i--) {
        if (inside.has(links[i]!.key)) continue;
        links[i]!.hz.t = 0; // 범위 밖으로 나가면 그 선만 끊긴다
        links.splice(i, 1);
      }
      k.d.next! -= dt;
      if (k.d.next! <= 0) {
        k.d.next = C.drainTick;
        let total = 0;
        for (const f of foes) {
          if (sys.dist(f, e) > C.drainRadius) continue;
          sys.hitFriendly(e, f.f, C.drainMult, 0, 0, Math.atan2(e.y - f.y, e.x - f.x));
          total += f.f.lastBody ?? 0;
        }
        heal(sys, e, total * C.drainHeal);
      }
      if (k.t <= 0) {
        for (const l of links) l.hz.t = 0;
        k.ph = 2;
        k.t = 0.7;
      }
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_CIRCLE, r1(e.x), r1(e.y), 0, C.drainRadius, 0, ...lt(k), BSK_DRAIN]],
};

// --- 영혼 사슬 ---------------------------------------------------------------

/** 사슬을 걸 대상: 사거리가 긴 아군(지팡이·활을 든 주인공, 궁병·마법사 용병)을 먼저, 없으면 가장 먼 아군 */
function chainTarget(c: Ctx): Foe | null {
  let best: Foe | null = null;
  let bs = -Infinity;
  for (const f of c.foes) {
    const d = c.sys.dist(f, c.e);
    if (d > C.chainRange || d < 160) continue;
    let rank = 0;
    if (f.type === NO_TYPE) {
      const w = c.sys.g.slots.get(f.f.ownerId)?.state.weapon;
      rank = w === 4 || w === 0 ? 2 : 0;
    } else if (f.ranged) rank = 2;
    const sc = rank * 10000 + d;
    if (sc > bs) {
      bs = sc;
      best = f;
    }
  }
  return best;
}

const chain: SkillDef = {
  id: BSK_CHAIN,
  cd: C.chainCd,
  weight: 4,
  phase: 2,
  can: (c) => !!c.k.v.fogDone && !!chainTarget(c),
  begin: (c) => {
    const t = chainTarget(c)!;
    c.k.d.key = c.sys.foeKey(t);
    c.k.d.dist0 = c.sys.dist(t, c.e);
    c.k.t = c.k.total = C.chainTele;
    c.e.face = Math.atan2(t.y - c.e.y, t.x - c.e.x);
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    const g = sys.g as any;
    const tgt = foes.find((f) => sys.foeKey(f) === k.d.key);
    if (k.ph === 0) {
      if (!tgt) return sys.end(c);
      e.face = Math.atan2(tgt.y - e.y, tgt.x - e.x);
      if (k.t > 0) return;
      k.ph = 1;
      k.t = C.chainSec;
      k.d.hits = C.chainHits;
      k.d.hz = sys.addHazard({ kind: HZ_CHAIN, x: e.x, y: e.y, t: C.chainSec + 1, total: C.chainSec + 1, b: C.chainHits, src: e.id }).id;
    }
    const hz = sys.hazards.find((h) => h.id === k.d.hz);
    const done = (broken: boolean) => {
      if (hz) hz.t = 0;
      if (broken) {
        sys.fx(hz ? hz.x + Math.cos(hz.ang) * hz.a * 0.5 : e.x, hz ? hz.y + Math.sin(hz.ang) * hz.a * 0.5 : e.y, hz?.ang ?? 0, BFX_CHAINBREAK);
        e.stunT = Math.max(e.stunT ?? 0, C.chainRecoil); // 영혼 반동: 보스가 잠깐 굳는다
      }
      k.ph = 2;
      k.t = broken ? C.chainRecoil : 0.5;
    };
    if (k.ph === 1) {
      if (!tgt || !hz) return done(false);
      const heroState = tgt.type === NO_TYPE ? g.slots.get(tgt.f.ownerId)?.state : null;
      if (heroState && (heroState.down || heroState.invuln > 0)) return done(true); // 무적이나 돌진으로 몸을 빼면 풀린다
      if (!heroState && !tgt.f.merc) return done(false);
      // 대상을 보스 쪽으로 끌어당긴다(처음 거리를 chainSec 동안 좁힌다)
      const d = Math.hypot(e.x - tgt.x, e.y - tgt.y);
      if (d <= 90) {
        tgt.f.status(ST_STUN, C.chainStun); // 끌려가 닿으면 기절한다
        return done(false);
      }
      const step = Math.min(d - 60, ((k.d.dist0 ?? 600) / C.chainSec) * dt);
      const nx = tgt.x + ((e.x - tgt.x) / d) * step;
      const ny = tgt.y + ((e.y - tgt.y) / d) * step;
      if (heroState) {
        heroState.x = clampToWorld(nx, 14);
        heroState.y = clampToWorld(ny, 14);
        tgt.f.status(ST_ROOT, 0.25);
      } else if (tgt.f.merc) {
        tgt.f.merc.x = clampToWorld(nx, 14);
        tgt.f.merc.y = clampToWorld(ny, 14);
      }
      hz.x = e.x;
      hz.y = e.y - 24;
      hz.ang = Math.atan2(tgt.y - hz.y, tgt.x - hz.x);
      hz.a = Math.hypot(tgt.x - hz.x, tgt.y - hz.y);
      hz.t = Math.max(hz.t, 0.3);
      // 사슬 선을 가로지르는 아군·아군 투사체(한 번에 1회, 같은 대상은 0.5초에 한 번)·마법사 방벽
      const segDist = (px: number, py: number): number => {
        const ux = Math.cos(hz.ang);
        const uy = Math.sin(hz.ang);
        const t = Math.max(0, Math.min(hz.a, (px - hz.x) * ux + (py - hz.y) * uy));
        return Math.hypot(px - (hz.x + ux * t), py - (hz.y + uy * t));
      };
      const now = g.time as number;
      let hits = k.d.hits!;
      for (const f of foes) {
        if (f === tgt) continue;
        const key = sys.foeKey(f);
        if (segDist(f.x, f.y) > C.chainWidth / 2 + f.r) continue;
        if (now - (k.hitAt.get(key) ?? -9) < 0.5) continue;
        k.hitAt.set(key, now);
        hits--;
        sys.fx(f.x, f.y, 0, BFX_IMPACT);
      }
      g.bullets = (g.bullets as any[]).filter((b) => {
        if (b.hostile || segDist(b.x, b.y) > 14 + b.radius) return true;
        hits--;
        return false;
      });
      for (const w of g.walls as any[]) {
        const wx = Math.cos(w.ang);
        const wy = Math.sin(w.ang);
        // 방벽 선분과 사슬 선분이 만나는가
        const ax = hz.x;
        const ay = hz.y;
        const bx = hz.x + Math.cos(hz.ang) * hz.a;
        const by = hz.y + Math.sin(hz.ang) * hz.a;
        const cx = w.x - wx * w.hl;
        const cy = w.y - wy * w.hl;
        const dx = w.x + wx * w.hl;
        const dy = w.y + wy * w.hl;
        const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
        if (o(ax, ay, bx, by, cx, cy) * o(ax, ay, bx, by, dx, dy) < 0 && o(cx, cy, dx, dy, ax, ay) * o(cx, cy, dx, dy, bx, by) < 0) hits = 0;
      }
      k.d.hits = hits;
      hz.b = Math.max(0, hits);
      if (hits <= 0) return done(true);
      if (k.t <= 0) return done(false);
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ e, k, foes, sys }) => {
    const t = foes.find((f) => sys.foeKey(f) === k.d.key);
    if (!t) return [];
    const a = Math.atan2(t.y - e.y, t.x - e.x);
    return [[TELE_LINE, r1(e.x), r1(e.y), r2(a), r1(Math.hypot(t.x - e.x, t.y - e.y)), 8, ...lt(k), BSK_CHAIN]];
  },
};

// --- 시체·소생 ------------------------------------------------------------------

/** 안개 속에서 죽은 것이 시체가 된다(스켈레톤은 다시 시체가 되지 않는다) */
function onDeath(sys: BossSystem, x: number, y: number, type: number, owner: number, skel: boolean): void {
  if (skel || !inFog(sys, x, y) || corpses(sys).length >= C.fogMax) return;
  sys.addHazard({ kind: HZ_CORPSE, x, y, a: type, b: C.corpseHits, hp: C.corpseHits, t: C.corpseSec, total: C.corpseSec, d: { owner } });
}

/** 매 틱(보스가 있는 동안): 안개의 독 피해, 안개가 걷힐 때쯤 시체 위의 푸른 불꽃과 소생 */
function global(sys: BossSystem, friendlies: Friendly[], dt: number): void {
  const boss = bossOf(sys);
  if (!boss) return;
  const g = sys.g as any;
  for (const h of fogs(sys)) {
    h.tick -= dt;
    if (h.tick <= 0) {
      h.tick += C.fogTick;
      for (const f of friendlies) {
        if (Math.hypot(f.x - h.x, f.y - h.y) > h.a + f.radius * 0.4) continue;
        f.hit({ damage: C.fogDps * C.fogTick, charge: 0, srcType: -1, fromAngle: 0, dot: true });
      }
    }
    // 걷히기 전: 안개 속 시체 위로 푸른 불꽃이 켜진다
    if (h.t <= C.reviveLead) for (const c of corpses(sys)) if (Math.hypot(c.x - h.x, c.y - h.y) <= h.a) c.ang = 1;
    // 걷히는 순간: 켜진 시체가 모두 같은 병종의 스켈레톤으로 일어난다
    if (h.t - dt <= 0) {
      let skels = [...g.enemies.values()].filter((e: Enemy & { skel?: boolean }) => e.skel).length;
      for (const c of corpses(sys)) {
        if (c.ang !== 1 || skels >= C.skelMax) continue;
        const sk = g.makeEnemy(c.x, c.y, c.a, { skel: true }) as Enemy & { skel?: boolean };
        sk.hp = sk.maxHp *= C.skelHp;
        sk.dmgMult *= C.skelDmg;
        sk.cd = 0.8;
        sys.fx(c.x, c.y, 0, BFX_RISE);
        c.t = 0;
        skels++;
      }
    }
  }
  // 시체는 안개가 없어도 남아 있고, 다음 안개가 걷힐 때 안에 있으면 되살아난다. 안개 밖이 된 시체의 불꽃은 꺼진다.
  const live = fogs(sys);
  for (const c of corpses(sys)) if (c.ang === 1 && !live.some((h) => Math.hypot(c.x - h.x, c.y - h.y) <= h.a)) c.ang = 0;
}

// --- 키트 ----------------------------------------------------------------------

export const necroKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [fog, drain, chain],
  // 안개가 한 번 뿌려지기 전에는 다른 스킬을 쓰지 않는다(등장할 때 안개를 뿌리며 나타난다)
  global,
  onDeath,
  flags: ({ e }) => ((e.stunT ?? 0) > 0 ? EF_STUN : 0),
  /** 스킬을 쓰지 않을 때: 대상과 거리를 두고 영혼 구슬(흡혈 평타)을 쏜다 */
  move: (c) => {
    const { e, k, sys, dt } = c;
    const g = sys.g as any;
    k.v.orb = Math.max(0, (k.v.orb ?? 0) - dt);
    k.v.shown = Math.max(0, (k.v.shown ?? 0) - dt);
    k.show = k.v.shown > 0 ? BSK_ORB : 0;
    const t = nearest(c, C.orbRange);
    if (!t) return true;
    const d = sys.dist(t, e);
    e.face = Math.atan2(t.y - e.y, t.x - e.x);
    const sp = g.enemySpeed(e) as number;
    if (d < C.keepMin) g.moveToward(e, e.x - Math.cos(e.face) * 200, e.y - Math.sin(e.face) * 200, sp, dt, 1);
    else if (d > C.keepMax) g.moveToward(e, t.x, t.y, sp, dt, C.keepMax * 0.8);
    if (k.v.orb <= 0) {
      k.v.orb = C.orbCd;
      k.v.shown = 0.45;
      sys.bullet(e, { ang: e.face, speed: C.orbSpeed, range: C.orbRange, mult: C.orbMult, kind: BUL_ORB, radius: 14, steal: C.orbSteal });
    }
    return true;
  },
};
