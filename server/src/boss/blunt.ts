import {
  BOSS_BLUNT as C,
  BSK_FLURRY,
  BSK_JUMP,
  BSK_MACETHROW,
  BSK_WHIRL,
  BFX_IMPACT,
  BFX_MACEBOOM,
  BUL_MACE,
  BUL_SHARD,
  HZ_MACE,
  HZ_RAIN,
  ST_STUN,
  TELE_CIRCLE,
  TELE_CONE,
  TELE_LINE,
  clampToWorld,
} from "@mercenary/shared";
import type { KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const r1 = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;
const lt = (k: { t: number; total: number }) => [Math.max(0, r1(k.t * 10)), Math.max(1, r1(k.total * 10))] as const;

/** 점프 쿵: 취약한 폼(지팡이 → 활 → 그 외)에게 뛰어올라 예고한 자리에 내려찍는다. 착지 지점은 예고 시작 때 고정된다. */
const jump: SkillDef = {
  id: BSK_JUMP,
  cd: C.jumpCd,
  weight: 4,
  can: ({ e, foes, sys }) => {
    const t = sys.weakFoe(foes, e, C.jumpRange);
    return !!t && sys.dist(t, e) > 120;
  },
  begin: ({ e, k, foes, sys }) => {
    const t = sys.weakFoe(foes, e, C.jumpRange)!;
    k.x = t.x;
    k.y = t.y;
    e.face = Math.atan2(t.y - e.y, t.x - e.x);
    k.t = k.total = C.jumpTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      e.x = clampToWorld(k.x, 20);
      e.y = clampToWorld(k.y, 20);
      for (const f of foes) {
        if (sys.dist(f, e) > C.jumpRadius + f.r) continue;
        sys.hitFoe(e, f, C.jumpDmg, 80);
        f.f.status(ST_STUN, C.jumpStun);
      }
      sys.fx(e.x, e.y, C.jumpRadius / 100, BFX_MACEBOOM);
      k.ph = 2;
      k.t = 0.9;
    } else if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ k }) => [[TELE_CIRCLE, r1(k.x), r1(k.y), 0, C.jumpRadius, 0, ...lt(k), BSK_JUMP]],
};

/** 거대 철퇴 투척: 가까운 대상 쪽으로 던져 착탄 지점에 광역 피해. 철퇴는 땅에 박혀 장애물로 남는다(최대 2개). */
const maceThrow: SkillDef = {
  id: BSK_MACETHROW,
  cd: C.throwCd,
  weight: 3.5,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, C.throwRange + 120),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.nearestFoe(foes, e, C.throwRange + 120)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    const d = Math.min(C.throwRange, Math.max(140, sys.dist(t, e)));
    k.d.dist = d;
    k.x = clampToWorld(e.x + Math.cos(k.ang) * d, 20); // 착탄 지점
    k.y = clampToWorld(e.y + Math.sin(k.ang) * d, 20);
    k.t = k.total = C.throwTele;
  },
  run: (c) => {
    const { e, k, sys } = c;
    e.face = k.ang;
    if (k.ph === 0 && k.t <= 0) {
      const d = k.d.dist!;
      const flight = d / C.throwSpeed;
      sys.bullet(e, { ang: k.ang, speed: C.throwSpeed, range: d, kind: BUL_MACE, vis: true });
      sys.addHazard({ kind: HZ_RAIN, x: k.x, y: k.y, a: C.throwRadius, b: 1, delay: flight, t: 0.35, total: 0.35, src: e.id, dmg: C.throwDmg, d: { knock: C.throwKnock } });
      // 박힌 철퇴(최대 C.maceMax개, 오래된 것부터 사라진다)
      const maces = sys.hazards.filter((h) => h.kind === HZ_MACE);
      for (let i = 0; i <= maces.length - C.maceMax; i++) maces[i]!.t = 0;
      sys.addHazard({ kind: HZ_MACE, x: k.x, y: k.y, ang: k.ang, solid: 28, delay: flight + 0.05, t: 600, total: 600 });
      k.ph = 2;
      k.t = 0.7;
    } else if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [
    [TELE_LINE, r1(e.x), r1(e.y), r2(k.ang), r1(k.d.dist ?? 400), 70, ...lt(k), BSK_MACETHROW],
    [TELE_CIRCLE, r1(k.x), r1(k.y), 0, C.throwRadius, 0, ...lt(k), BSK_MACETHROW],
  ],
};

/** 철퇴 난타: 전방 부채꼴을 좌우로 번갈아 5연타하며 조금씩 전진한다 */
const flurry: SkillDef = {
  id: BSK_FLURRY,
  cd: C.flurryCd,
  weight: 4,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, 240),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.nearestFoe(foes, e, 240)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.flurryTele;
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    const g = sys.g as any;
    e.face = k.ang;
    if (k.ph === 0 && k.t <= 0) {
      k.ph = 1;
      k.d.n = 0;
      k.d.next = 0;
    }
    if (k.ph === 1) {
      // 조금씩 전진
      g.moveToward(e, e.x + Math.cos(k.ang) * 200, e.y + Math.sin(k.ang) * 200, C.flurryAdvance / (C.flurryHits * C.flurryStep), dt, 1);
      k.d.next! -= dt;
      if (k.d.next! <= 0 && k.d.n! < C.flurryHits) {
        for (const f of foes) {
          const key = sys.foeKey(f) + k.d.n! * 1e6;
          if (k.hit.has(key) || !sys.inCone(f, e.x, e.y, k.ang, C.flurryHalf, C.flurryRange)) continue;
          k.hit.add(key);
          sys.hitFoe(e, f, C.flurryDmg, C.flurryKnock);
        }
        sys.fx(e.x + Math.cos(k.ang) * 90, e.y + Math.sin(k.ang) * 90, k.ang + (k.d.n! % 2 ? 0.5 : -0.5), BFX_IMPACT);
        k.d.n!++;
        k.d.next = C.flurryStep;
        if (k.d.n! >= C.flurryHits) {
          k.ph = 2;
          k.t = C.flurryRest; // 딜 타임
        }
      }
      return;
    }
    if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_CONE, r1(e.x), r1(e.y), r2(k.ang), r2(C.flurryHalf), C.flurryRange, ...lt(k), BSK_FLURRY]],
};

/** 휠윈드(체력 50% 이하): 철퇴를 휘두르며 도는 동안 주변을 분쇄한다. 박힌 철퇴를 부수고 파편이 튄다. 끝나면 어지러워 멈춘다. */
const whirl: SkillDef = {
  id: BSK_WHIRL,
  cd: C.whirlCd,
  weight: 4,
  phase: 2,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, 520),
  begin: ({ k }) => {
    k.t = k.total = C.whirlTele;
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    const g = sys.g as any;
    if (k.ph === 0) {
      if (k.t > 0) return;
      k.ph = 1;
      k.t = C.whirlSec;
      k.d.next = 0;
    }
    if (k.ph === 1) {
      const t = sys.nearestFoe(foes, e, 1200);
      if (t) g.moveToward(e, t.x, t.y, g.enemySpeed(e) * C.whirlSpeedMult, dt, 30);
      k.d.next! -= dt;
      if (k.d.next! <= 0) {
        k.d.next = C.whirlStep;
        for (const f of foes) {
          if (sys.dist(f, e) > C.whirlRadius + f.r) continue;
          sys.hitFoe(e, f, C.whirlDmg, C.whirlKnock);
        }
        sys.fx(e.x, e.y, Math.random() * 6.28, BFX_IMPACT);
        // 박힌 철퇴를 부수고 파편이 튄다
        for (const h of sys.hazards) {
          if (h.kind !== HZ_MACE || h.delay > 0 || Math.hypot(h.x - e.x, h.y - e.y) > C.whirlRadius + h.solid) continue;
          h.t = 0;
          for (let i = 0; i < C.shardCount; i++) {
            const a = Math.random() * Math.PI * 2;
            sys.bullet(e, { x: h.x, y: h.y, ang: a, speed: 480, range: 460, mult: C.shardDmg, kind: BUL_SHARD, radius: 8 });
          }
          sys.fx(h.x, h.y, 0, BFX_IMPACT);
        }
      }
      if (k.t <= 0) {
        e.stunT = C.whirlDizzy; // 어지러워 멈춘다(딜 타임)
        sys.end(c);
      }
    }
  },
  tele: ({ e, k }) => [[TELE_CIRCLE, r1(e.x), r1(e.y), 0, C.whirlRadius, 0, ...lt(k), BSK_WHIRL]],
};

export const bluntKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [jump, maceThrow, flurry, whirl],
};
