import {
  BOSS_ARCHER as C,
  BSK_ICEARROW,
  BSK_RAIN,
  BSK_SNIPE,
  BSK_STEALTH,
  BUL_ICE,
  BUL_SNIPE,
  BFX_IMPACT,
  CAVALRY,
  EF_STEALTH,
  HZ_RAIN,
  NO_TYPE,
  ST_SLOW,
  TELE_CONE,
  TELE_LINE,
  clampToWorld,
} from "@mercenary/shared";
import type { Ctx, KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const r1 = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;
const lt = (k: { t: number; total: number }) => [Math.max(0, r1(k.t * 10)), Math.max(1, r1(k.total * 10))] as const;

/** 위협: 주인공이 근접 공격으로 때렸거나(잠시 동안), 아군 기병이 가까이 온다 */
const threatened = (c: Ctx): boolean => (c.k.v.threat ?? 0) > 0 || c.foes.some((f) => f.type === CAVALRY && c.sys.dist(f, c.e) <= C.threatCav);

/** 은신 질주 → 은신 저격(연계): 위협을 받으면 은신해 빠르게 이동하고, 먼 곳에서 은신을 풀며 취약한 폼을 저격한다 */
const stealth: SkillDef = {
  id: BSK_STEALTH,
  cd: C.reactCd,
  weight: 5,
  telePhases: [0, 2],
  can: (c) => threatened(c) && !!c.sys.weakFoe(c.foes, c.e, 1400),
  begin: (c) => {
    const { e, k, foes, sys } = c;
    const t = sys.weakFoe(foes, e, 1400)!;
    // 대상에서 보스 쪽으로 stealthDist만큼 떨어진 곳(맵 안)으로 달려간다
    const a = Math.atan2(e.y - t.y, e.x - t.x);
    k.d.tx = clampToWorld(t.x + Math.cos(a) * C.stealthDist, 40);
    k.d.ty = clampToWorld(t.y + Math.sin(a) * C.stealthDist, 40);
    k.t = k.total = C.stealthTele;
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    const g = sys.g as any;
    if (k.ph === 0) {
      if (k.t > 0) return;
      k.ph = 1;
      k.t = C.stealthSec;
    }
    if (k.ph === 1) {
      k.v.stealth = 1;
      const sp = g.enemySpeed(e) * C.stealthMult;
      g.moveToward(e, k.d.tx!, k.d.ty!, sp, dt, 12);
      e.face = Math.atan2(k.d.ty! - e.y, k.d.tx! - e.x);
      if (k.t <= 0 || Math.hypot(k.d.tx! - e.x, k.d.ty! - e.y) <= 14) {
        // 은신을 풀며 저격 조준선을 켠다(예고 시작 때 방향 고정)
        k.v.stealth = 0;
        const t = sys.weakFoe(foes, e, 3000);
        if (!t) {
          sys.end(c);
          return;
        }
        k.ang = Math.atan2(t.y - e.y, t.x - e.x);
        e.face = k.ang;
        k.ph = 2;
        k.show = BSK_SNIPE;
        k.t = k.total = C.snipeTele;
      }
      return;
    }
    if (k.ph === 2) {
      e.face = k.ang;
      if (k.t > 0) return;
      for (const f of foes) {
        if (!sys.inLine(f, e.x, e.y, k.ang, C.snipeLen, C.snipeWidth)) continue;
        sys.hitFoe(e, f, C.snipeDmg, 40);
        sys.fx(f.x, f.y, k.ang, BFX_IMPACT);
      }
      sys.bullet(e, { ang: k.ang, speed: 3200, range: C.snipeLen, kind: BUL_SNIPE, vis: true });
      k.ph = 3;
      k.t = C.snipeRest;
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) =>
    k.ph === 0
      ? []
      : [[TELE_LINE, r1(e.x), r1(e.y), r2(k.ang), C.snipeLen, C.snipeWidth, ...lt(k), BSK_SNIPE]],
};

/** 얼음 화살 난사: 위협을 받으면 뒤로 빠지며 전방 부채꼴로 얼음 화살을 뿌린다(맞으면 둔화, 방패·방벽에 막힌다) */
const iceArrow: SkillDef = {
  id: BSK_ICEARROW,
  cd: C.reactCd,
  weight: 4,
  can: (c) => threatened(c) && !!c.sys.nearestFoe(c.foes, c.e, 900),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.nearestFoe(foes, e, 900)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.iceTele;
  },
  run: (c) => {
    const { e, k, sys, dt } = c;
    const g = sys.g as any;
    e.face = k.ang;
    if (k.ph === 0) {
      if (k.t > 0) return;
      k.ph = 1;
      k.d.n = 0;
      k.d.next = 0;
      k.t = 0.9;
    }
    if (k.ph === 1) {
      // 뒤로 빠지면서
      const back = k.ang + Math.PI;
      g.moveToward(e, e.x + Math.cos(back) * 300, e.y + Math.sin(back) * 300, g.enemySpeed(e) * 1.2, dt, 1);
      k.d.next! -= dt;
      while (k.d.next! <= 0 && k.d.n! < C.iceCount) {
        const a = k.ang + (-C.iceFan / 2 + (C.iceFan * k.d.n!) / (C.iceCount - 1));
        sys.bullet(e, { ang: a, speed: C.iceSpeed, range: C.iceRange, mult: C.iceDmg, kind: BUL_ICE, fx: ST_SLOW, fxSec: C.iceSlowSec, fxMult: C.iceSlowMult });
        k.d.n!++;
        k.d.next! += 0.07;
      }
      if (k.t <= 0 && k.d.n! >= C.iceCount) {
        k.ph = 2;
        k.t = 0.4;
      }
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_CONE, r1(e.x), r1(e.y), r2(k.ang), r2(C.iceFan / 2), C.iceRange * 0.5, ...lt(k), BSK_ICEARROW]],
};

/** 화살비: 하늘로 쏜 화살이 넓은 범위에 작은 원 여러 개로 차례로 떨어진다 */
const rain: SkillDef = {
  id: BSK_RAIN,
  cd: C.rainCd,
  weight: 3,
  can: ({ e, foes, sys }) => !!sys.weakFoe(foes, e, 1100),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.weakFoe(foes, e, 1100)!;
    k.x = t.x;
    k.y = t.y;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.rainTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    e.face = k.ang;
    if (k.ph === 0 && k.t <= 0) {
      const heroes = foes.filter((f) => f.type === NO_TYPE).length;
      const n = Math.max(C.rainMin, Math.min(C.rainMax, heroes * C.rainPerPlayer + Math.floor((foes.length - heroes) / 3)));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = C.rainArea * Math.sqrt(Math.random());
        sys.addHazard({ kind: HZ_RAIN, x: clampToWorld(k.x + Math.cos(a) * r, 20), y: clampToWorld(k.y + Math.sin(a) * r, 20), a: C.rainR, delay: 0.9 + i * 0.07, t: 0.35, total: 0.35, src: e.id, dmg: C.rainDmg });
      }
      k.ph = 2;
      k.t = 0.4;
    } else if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_CONE, r1(e.x), r1(e.y), r2(k.ang), 0.12, 160, ...lt(k), BSK_RAIN]],
};

export const archerKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [stealth, iceArrow, rain],
  tick: ({ k, dt }) => {
    if ((k.v.threat ?? 0) > 0) k.v.threat = Math.max(0, k.v.threat! - dt);
    if (k.cur?.id !== BSK_STEALTH) k.v.stealth = 0; // 은신 질주 밖에서는 항상 드러난다
  },
  onHit: ({ k }, hit, _owner, src) => {
    // 주인공이 근접 공격으로 때렸다 → 잠시 위협
    if (!src && !hit.dot && hit.srcType !== 2 && hit.srcType !== 5) k.v.threat = C.threatSec;
  },
  flags: ({ k }) => ((k.v.stealth ?? 0) > 0 ? EF_STEALTH : 0),
};
