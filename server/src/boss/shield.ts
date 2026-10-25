import {
  BOSS_SHIELD as C,
  BSK_AREAINV,
  BSK_REFLECT,
  BSK_SHIELDRUSH,
  BSK_SUMMON,
  BFX_CRASH,
  BFX_IMPACT,
  ARCHER,
  MAGE,
  EF_GUARD,
  EVT_REFLECT,
  HZ_SHIELD,
  ST_STUN,
  TELE_CIRCLE,
  TELE_LINE,
  clampToWorld,
} from "@mercenary/shared";
import type { Enemy } from "../game.js";
import type { Ctx, KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const r1 = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;
const lt = (k: { t: number; total: number }) => [Math.max(0, r1(k.t * 10)), Math.max(1, r1(k.total * 10))] as const;

/** 반사 태세: 3초 동안 받는 피해가 크게 줄고, 맞은 피해의 2배가 때린 쪽에게 돌아간다 */
const reflect: SkillDef = {
  id: BSK_REFLECT,
  cd: C.reflectCd,
  weight: 3,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, 500),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.nearestFoe(foes, e, 500)!;
    e.face = Math.atan2(t.y - e.y, t.x - e.x);
    k.t = k.total = C.reflectTele;
  },
  run: (c) => {
    const { k, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      k.ph = 1;
      k.t = C.reflectSec;
      k.v.reflect = C.reflectSec;
    } else if (k.ph === 1 && k.t <= 0) {
      k.v.reflect = 0;
      sys.end(c);
    }
  },
  tele: ({ e, k }) => [[TELE_CIRCLE, r1(e.x), r1(e.y), 0, 90, 0, ...lt(k), BSK_REFLECT]],
};

/** 방패 돌진: 직선 예고 뒤 방패를 앞세워 달려 부딪힌 대상을 크게 밀고 기절시킨다. 방벽·바위에 막히면 보스가 기절한다. */
const rush: SkillDef = {
  id: BSK_SHIELDRUSH,
  cd: C.rushCd,
  weight: 4,
  can: ({ e, foes, sys }) => {
    const t = sys.weakFoe(foes, e, 800);
    return !!t && sys.dist(t, e) > 140;
  },
  begin: ({ e, k, foes, sys }) => {
    const t = sys.weakFoe(foes, e, 800)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.rushTele;
  },
  run: (c) => {
    const { e, k, sys } = c;
    if (k.ph === 0) {
      e.face = k.ang;
      if (k.t <= 0) {
        k.ph = 1;
        k.d.trav = 0;
      }
      return;
    }
    if (k.ph === 1) {
      const res = sys.dashStep(c, C.rushSpeed, C.rushLen, C.rushWidth, (f) => {
        sys.hitFoe(e, f, C.rushDmg, C.rushKnock);
        f.f.status(ST_STUN, C.rushStun);
        sys.fx(f.x, f.y, k.ang, BFX_IMPACT);
      }, 34);
      if (res === "crash") {
        e.stunT = C.rushCrash;
        sys.fx(e.x, e.y, k.ang, BFX_CRASH);
        sys.end(c);
      } else if (res === "done") {
        k.ph = 2;
        k.t = 0.6;
      }
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ k }) => [[TELE_LINE, r1(k.x), r1(k.y), r2(k.ang), C.rushLen, C.rushWidth, ...lt(k), BSK_SHIELDRUSH]],
};

/** 사수 소환과 거대 방패: 보스는 제자리에서 방패 벽을 세우고 뒤에서 사수를 부른다. 방패가 부서지면 끝난다. 체력이 절반이 되면 가까운 대상에게 돌진해 광역 기절. */
const summon: SkillDef = {
  id: BSK_SUMMON,
  cd: C.summonCd,
  weight: 2.5,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, 900),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.nearestFoe(foes, e, 900)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.summonTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    const g = sys.g as any;
    if (k.ph === 0) {
      e.face = k.ang;
      if (k.t > 0) return;
      const sx = e.x + Math.cos(k.ang) * C.shieldFront;
      const sy = e.y + Math.sin(k.ang) * C.shieldFront;
      const hz = sys.addHazard({ kind: HZ_SHIELD, x: sx, y: sy, ang: k.ang + Math.PI / 2, a: C.shieldHalf, b: 100, hp: e.maxHp * C.shieldHpFrac, hpMax: e.maxHp * C.shieldHpFrac, t: C.shieldMaxSec, total: C.shieldMaxSec, src: e.id, d: { ht: C.shieldThick / 2 } });
      k.d.hz = hz.id;
      // 방패 뒤에서 사수를 부른다
      for (let i = 0; i < C.summonCount; i++) {
        const lat = (i - (C.summonCount - 1) / 2) * 56;
        const back = 70 + (i % 2) * 40;
        const a = k.ang + Math.PI;
        const x = clampToWorld(e.x + Math.cos(a) * back + Math.cos(k.ang + Math.PI / 2) * lat, 30);
        const y = clampToWorld(e.y + Math.sin(a) * back + Math.sin(k.ang + Math.PI / 2) * lat, 30);
        g.makeEnemy(x, y, ARCHER, { face: k.ang });
      }
      k.ph = 1;
      return;
    }
    if (k.ph === 1) {
      e.face = k.ang;
      const hz = sys.hazards.find((h) => h.id === k.d.hz);
      if (!hz || hz.t <= 0) {
        sys.end(c);
        return;
      }
      b100(hz, e);
      if (!k.d.rushed && e.hp / e.maxHp <= 0.5) {
        const t = sys.nearestFoe(foes, e, 900);
        if (t) {
          k.d.rushed = 1;
          k.ang = Math.atan2(t.y - e.y, t.x - e.x);
          k.d.goal = Math.min(700, sys.dist(t, e));
          k.d.trav = 0;
          k.hit.clear();
          k.ph = 3;
        }
      }
      return;
    }
    if (k.ph === 3) {
      // 체력이 절반일 때: 가까운 대상에게 돌진해 광역 기절(방벽에 막히면 보스가 기절)
      const res = sys.dashStep(c, C.rushSpeed, k.d.goal!, 40, () => undefined, 34);
      if (res === "crash") {
        e.stunT = C.rushCrash;
        sys.fx(e.x, e.y, k.ang, BFX_CRASH);
        k.ph = 1;
      } else if (res === "done") {
        for (const f of foes) {
          if (sys.dist(f, e) > C.halfRushRadius + f.r) continue;
          sys.hitFoe(e, f, C.rushDmg * 0.8, 100);
          f.f.status(ST_STUN, C.halfRushStun);
        }
        sys.fx(e.x, e.y, k.ang, BFX_IMPACT);
        k.ph = 1;
      }
      return;
    }
  },
  tele: ({ e, k }) => {
    const sx = e.x + Math.cos(k.ang) * C.shieldFront;
    const sy = e.y + Math.sin(k.ang) * C.shieldFront;
    const p = k.ang + Math.PI / 2;
    return [[TELE_LINE, r1(sx - Math.cos(p) * C.shieldHalf), r1(sy - Math.sin(p) * C.shieldHalf), r2(p), C.shieldHalf * 2, C.shieldThick, ...lt(k), BSK_SUMMON]];
  },
};

/** 거대 방패 체력 비율을 전송값(b)에 반영한다 */
function b100(hz: { hp: number; hpMax: number; b: number }, _e: Enemy): void {
  hz.b = Math.max(1, Math.round((100 * hz.hp) / Math.max(1, hz.hpMax)));
}

export const shieldKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [reflect, rush, summon],
  tick: (c: Ctx) => {
    const { e, k, dt, sys } = c;
    const g = sys.g as any;
    if ((k.v.reflect ?? 0) > 0) k.v.reflect = Math.max(0, k.v.reflect! - dt);
    // 운석 맞춤 무적: 날아드는 아군 운석이 장군 근처에 떨어지는 순간 앞뒤 0.75초 동안, 장군과 가까운 보스군이 모두 무적이 된다
    for (const [key, cast] of g.casts as Map<number, { x: number; y: number; radius: number }>) {
      const merc = key > 0 ? g.mercs.get(key) : undefined;
      if (key > 0 && !merc) continue; // 적 마법사의 시전이다
      const left = key < 0 ? (g.slots.get(-key)?.windT ?? 0) : (merc?.atkT ?? 0);
      if (left > C.invHalf || left <= 0) continue;
      if (Math.hypot(cast.x - e.x, cast.y - e.y) > cast.radius + 60 + C.invRadius * 0.4) continue;
      for (const o of g.enemies.values() as Iterable<Enemy>) {
        if (Math.hypot(o.x - e.x, o.y - e.y) > C.invRadius) continue;
        o.invulnT = Math.max(o.invulnT ?? 0, left + C.invHalf);
      }
    }
  },
  /** 반사 태세: 받는 피해가 줄고 맞은 피해의 몇 배가 때린 쪽에게 돌아간다 */
  preHit: ({ e, k, sys }, hit, ownerId, src) => {
    if ((k.v.reflect ?? 0) <= 0 || hit.dot) return hit;
    if (hit.srcType === ARCHER || hit.srcType === MAGE) return { ...hit, damage: hit.damage * C.reflectTaken, charge: hit.charge * C.reflectTaken }; // 궁병·마법사(활·지팡이 포함)의 공격은 되돌려받지 않는다(받는 피해 감소만 적용)
    const raw = hit.damage + hit.charge;
    const back = raw * C.reflectMult;
    sys.reflectTo(ownerId, src, back);
    sys.g.pushEvent(EVT_REFLECT, e.x, e.y, 0, back, ownerId);
    return { ...hit, damage: hit.damage * C.reflectTaken, charge: hit.charge * C.reflectTaken };
  },
  flags: ({ k }) => ((k.v.reflect ?? 0) > 0 ? EF_GUARD : 0),
};

void BSK_AREAINV;
