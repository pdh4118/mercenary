import { BOSS_SPEAR as C, BSK_CLONE, BSK_GUARD, BSK_THROW, BSK_TRIPLE, BFX_IMPACT, BUL_SPEAR, EF_GUARD, HZ_GHOST, HZ_SPEAR, TELE_CONE, TELE_LINE, NO_TYPE } from "@mercenary/shared";
import type { KitDef, SkillDef, Ctx } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const r1 = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;
const lt = (k: { t: number; total: number }) => [Math.max(0, r1(k.t * 10)), Math.max(1, r1(k.total * 10))] as const;

/** 분신 돌진: 범위 안 주인공(플레이어)마다 분신이 한 명씩 돌진한다(용병은 대상이 아니다) */
const clone: SkillDef = {
  id: BSK_CLONE,
  cd: C.cloneCd,
  weight: 3,
  can: ({ e, foes, sys }) => foes.some((f) => f.type === NO_TYPE && sys.dist(f, e) <= C.cloneRange),
  begin: ({ e, k, foes, sys }) => {
    for (const f of foes) {
      if (f.type !== NO_TYPE || sys.dist(f, e) > C.cloneRange) continue;
      const ang = Math.atan2(f.y - e.y, f.x - e.x);
      k.list.push({ ang, len: Math.min(900, sys.dist(f, e) + 160) });
    }
    k.t = k.total = C.cloneTele;
  },
  run: (c) => {
    const { e, k, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      for (const l of k.list as { ang: number; len: number }[]) {
        sys.addHazard({ kind: HZ_GHOST, x: k.x, y: k.y, ang: l.ang, a: 1, b: C.cloneWidth, vx: Math.cos(l.ang) * C.cloneSpeed, vy: Math.sin(l.ang) * C.cloneSpeed, t: l.len / C.cloneSpeed, src: e.id, dmg: C.cloneDmg, d: { knock: C.cloneKnock } });
      }
      k.ph = 2;
      k.t = 0.9;
    } else if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ k }) => (k.list as { ang: number; len: number }[]).map((l) => [TELE_LINE, r1(k.x), r1(k.y), r2(l.ang), r1(l.len), C.cloneWidth, ...lt(k), BSK_CLONE] as [number, number, number, number, number, number, number, number, number]),
};

/** 창 방어 태세: 정면 부채꼴로 들어오는 대상을 찌르고 날아오는 화살을 쓸어 낸다 */
const guard: SkillDef = {
  id: BSK_GUARD,
  cd: C.guardCd,
  weight: 2.5,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, 700),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.nearestFoe(foes, e, 700)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.guardTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    const g = sys.g as any;
    e.face = k.ang;
    if (k.ph === 0 && k.t <= 0) {
      k.ph = 1;
      k.t = C.guardSec;
    }
    if (k.ph === 1) {
      const now = g.time as number;
      for (const f of foes) {
        if (!sys.inCone(f, e.x, e.y, k.ang, C.guardHalf, C.guardRange)) continue;
        const key = sys.foeKey(f);
        if (now - (k.hitAt.get(key) ?? -9) < 0.7) continue;
        k.hitAt.set(key, now);
        sys.hitFoe(e, f, C.guardDmg, C.guardKnock);
        sys.fx(f.x, f.y, k.ang, BFX_IMPACT);
      }
      // 부채꼴 안으로 날아오는 아군 화살·투척류를 쓸어서 떨어뜨린다
      g.bullets = (g.bullets as any[]).filter((b) => b.hostile || !sys.inCone({ x: b.x, y: b.y, r: 0 }, e.x, e.y, k.ang, C.guardHalf, C.guardRange));
      if (k.t <= 0) {
        k.ph = 2;
        k.t = C.guardRest; // 딜 타임
      }
      return;
    }
    if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_CONE, r1(e.x), r1(e.y), r2(k.ang), r2(C.guardHalf), C.guardRange, ...lt(k), BSK_GUARD]],
};

/** 장창 3연 찌르기: 부채꼴로 나란한 직선 세 개를 0.3초 간격으로 차례로 찌른다 */
const triple: SkillDef = {
  id: BSK_TRIPLE,
  cd: C.tripleCd,
  weight: 4,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, 520),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.nearestFoe(foes, e, 520)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.tripleTele;
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    e.face = k.ang;
    if (k.ph === 0 && k.t <= 0) {
      k.ph = 1;
      k.d.n = 0;
      k.d.next = 0;
    }
    if (k.ph === 1) {
      k.d.next! -= dt;
      if (k.d.next! <= 0 && k.d.n! < 3) {
        const a = k.ang + (k.d.n! - 1) * C.tripleGap;
        for (const f of foes) {
          const key = sys.foeKey(f) + k.d.n! * 1e6;
          if (k.hit.has(key) || !sys.inLine(f, e.x, e.y, a, C.tripleLen, C.tripleWidth)) continue;
          k.hit.add(key);
          sys.hitFoe(e, f, C.tripleDmg, C.tripleKnock);
        }
        sys.fx(e.x + Math.cos(a) * C.tripleLen * 0.8, e.y + Math.sin(a) * C.tripleLen * 0.8, a, BFX_IMPACT);
        k.d.n!++;
        k.d.next = C.tripleStep;
        if (k.d.n! >= 3) {
          k.ph = 2;
          k.t = C.tripleRest;
        }
      }
      return;
    }
    if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [-1, 0, 1].map((i) => [TELE_LINE, r1(e.x), r1(e.y), r2(k.ang + i * C.tripleGap), C.tripleLen, C.tripleWidth, ...lt(k), BSK_TRIPLE] as [number, number, number, number, number, number, number, number, number]),
};

/** 창 던지기: 보스에게서 가장 먼 주인공에게 창을 던져 직선의 모든 대상을 꿰뚫고, 땅에 박힌 창은 잠깐 장애물이 된다 */
const spearThrow: SkillDef = {
  id: BSK_THROW,
  cd: C.throwCd,
  weight: 2.5,
  can: ({ e, foes, sys }) => !!sys.farthestHero(foes, e, C.throwLen),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.farthestHero(foes, e, C.throwLen)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.throwTele;
  },
  run: (c) => {
    const { e, k, sys } = c;
    e.face = k.ang;
    if (k.ph === 0 && k.t <= 0) {
      sys.bullet(e, { ang: k.ang, speed: C.throwSpeed, range: C.throwLen, mult: C.throwDmg, kind: BUL_SPEAR, pierce: 99, radius: 22 });
      const ex = e.x + Math.cos(k.ang) * C.throwLen;
      const ey = e.y + Math.sin(k.ang) * C.throwLen;
      sys.addHazard({ kind: HZ_SPEAR, x: ex, y: ey, ang: k.ang, solid: 20, delay: C.throwLen / C.throwSpeed, t: C.throwObstacleSec, total: C.throwObstacleSec });
      k.ph = 2;
      k.t = 0.6;
    } else if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_LINE, r1(e.x), r1(e.y), r2(k.ang), C.throwLen, C.throwWidth, ...lt(k), BSK_THROW]],
};

export const spearKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [clone, guard, triple, spearThrow],
  flags: ({ k }) => (k.cur?.id === BSK_GUARD && k.ph === 1 ? EF_GUARD : 0),
};

void ({} as Ctx);
