import {
  BOSS_CHARIOT as C,
  BSK_ACCEL,
  BSK_DRIFT,
  BSK_RAMPAGE,
  BSK_SCYTHE,
  BFX_CRASH,
  BFX_IMPACT,
  BFX_SCYTHE,
  BFX_DRIFT,
  EF_MAD,
  EF_SCYTHE,
  HZ_MACE,
  HZ_SPEAR,
  TELE_CIRCLE,
  TELE_CONE,
  TELE_LINE,
} from "@mercenary/shared";
import type { Enemy } from "../game.js";
import { angDiff } from "./system.js";
import type { Ctx, KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const r1 = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;
const lt = (k: { t: number; total: number }) => [Math.max(0, r1(k.t * 10)), Math.max(1, r1(k.total * 10))] as const;
const BODY = 40; // 전차 몸의 반지름(충돌 판정)
const LETHAL = 4000; // 한 방(체력 시험용 배율이 아니라 사실상 즉사)

/** 가속 돌진: 직선 예고 뒤 달리며 속도가 쌓인다. 일정 속도 이상으로 직격하면 한 방. 방벽·바위·맵 끝에 부딪히면 속도에 비례해 기절한다. */
const accel: SkillDef = {
  id: BSK_ACCEL,
  cd: C.accelCd,
  weight: 4,
  can: ({ e, foes, sys }) => {
    const t = sys.weakFoe(foes, e, 1000);
    return !!t && sys.dist(t, e) > 250;
  },
  begin: ({ e, k, foes, sys }) => {
    const t = sys.weakFoe(foes, e, 1000)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.accelTele;
  },
  run: (c) => {
    const { e, k, sys } = c;
    if (k.ph === 0) {
      e.face = k.ang;
      if (k.t > 0) return;
      k.ph = 1;
      k.d.trav = 0;
      k.d.el = 0;
    }
    if (k.ph === 1) {
      k.d.el! += c.dt;
      const v = Math.min(C.accelMax, C.accelStart + C.accelRate * k.d.el!);
      k.d.v = v;
      const res = sys.dashStep(c, v, C.accelLen, C.accelWidth, (f) => {
        const lethal = v >= C.accelMax * C.accelLethal;
        sys.hitFoe(e, f, lethal ? LETHAL : C.accelDmg * (v / C.accelMax), 140);
        sys.fx(f.x, f.y, k.ang, BFX_IMPACT);
      }, BODY);
      if (res === "crash") {
        e.stunT = 0.5 + C.accelStun * (v / C.accelMax); // 속도가 붙을수록 오래 기절
        sys.fx(e.x, e.y, k.ang, BFX_CRASH);
        sys.end(c);
      } else if (res === "done") {
        k.ph = 2;
        k.t = C.accelRest;
      }
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ k }) => [[TELE_LINE, r1(k.x), r1(k.y), r2(k.ang), C.accelLen, C.accelWidth, ...lt(k), BSK_ACCEL]],
};

/** 낫 바퀴: 4초 동안 움직이며 양 옆(측면)을 낫이 휩쓴다 */
const scythe: SkillDef = {
  id: BSK_SCYTHE,
  cd: C.scytheCd,
  weight: 3.5,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, 650),
  begin: ({ k }) => {
    k.t = k.total = C.scytheTele;
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    const g = sys.g as any;
    if (k.ph === 0) {
      if (k.t > 0) return;
      k.ph = 1;
      k.t = C.scytheSec;
      k.d.next = 0;
    }
    if (k.ph === 1) {
      const t = sys.nearestFoe(foes, e, 1500);
      if (t) {
        g.moveToward(e, t.x, t.y, g.enemySpeed(e) * 1.1, dt, 20);
        e.face = Math.atan2(t.y - e.y, t.x - e.x);
      }
      k.d.next! -= dt;
      if (k.d.next! <= 0) {
        k.d.next = C.scytheStep;
        // 낫이 양 옆을 휩쓰는 호(판정이 들어가는 순간마다 좌우로 하나씩)
        sys.fx(e.x, e.y, e.face + Math.PI / 2, BFX_SCYTHE, BODY + C.scytheRange);
        sys.fx(e.x, e.y, e.face - Math.PI / 2, BFX_SCYTHE, BODY + C.scytheRange);
        for (const f of foes) {
          const d = sys.dist(f, e);
          if (d > BODY + C.scytheRange + f.r) continue;
          const rel = Math.abs(angDiff(Math.atan2(f.y - e.y, f.x - e.x), e.face));
          if (rel < 0.8 || rel > 2.35) continue; // 정면·후면이 아니라 양 옆
          sys.hitFoe(e, f, C.scytheDmg, C.scytheKnock);
          sys.fx(f.x, f.y, e.face, BFX_IMPACT);
        }
      }
      if (k.t <= 0) sys.end(c);
    }
  },
  // 예고: 판정과 같은 양옆 부채꼴 두 개(정면·후면은 안전)
  tele: ({ e, k }) => [
    [TELE_CONE, r1(e.x), r1(e.y), r2(e.face + 1.575), 0.775, BODY + C.scytheRange, ...lt(k), BSK_SCYTHE],
    [TELE_CONE, r1(e.x), r1(e.y), r2(e.face - 1.575), 0.775, BODY + C.scytheRange, ...lt(k), BSK_SCYTHE],
  ],
};

/** 급선회 파쇄: 급선회하며 꼬리가 후방 부채꼴을 휩쓴다. 끝나면 멈춰 후방 약점이 드러난다. */
const drift: SkillDef = {
  id: BSK_DRIFT,
  cd: C.driftCd,
  weight: 4,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, C.driftRange + 150),
  begin: ({ e, k }) => {
    k.ang = e.face + Math.PI; // 후방
    k.t = k.total = C.driftTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      for (const f of foes) {
        if (!sys.inCone(f, e.x, e.y, k.ang, C.driftHalf, C.driftRange)) continue;
        sys.hitFoe(e, f, C.driftDmg, C.driftKnock);
        sys.fx(f.x, f.y, k.ang, BFX_IMPACT);
      }
      sys.fx(e.x + Math.cos(k.ang) * 80, e.y + Math.sin(k.ang) * 80, k.ang, BFX_IMPACT);
      sys.fx(e.x, e.y, k.ang, BFX_DRIFT, C.driftRange);
      k.ph = 2;
      k.t = C.driftRest; // 멈춘다: 약점이 드러난다
    } else if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_CONE, r1(e.x), r1(e.y), r2(k.ang), r2(C.driftHalf), C.driftRange, ...lt(k), BSK_DRIFT]],
};

/** 폭주(체력 40% 이하): 말이 광분해 바퀴가 붉게 달아오른다. 7초 동안 사방팔방으로 방향을 바꿔 가며 마구 날뛰고, 몸에 닿으면 피해를 준다. 장애물은 부수고 벽·바위·맵 끝에 부딪히면 튕겨 나간다. 다 날뛰면 지쳐 멈춘다(약점 노출). */
const rampage: SkillDef = {
  id: BSK_RAMPAGE,
  cd: C.rampageCd,
  weight: 6,
  phase: 3,
  can: ({ e, foes, sys }) => !!sys.weakFoe(foes, e, 1100),
  begin: ({ k }) => {
    k.t = k.total = C.rampageTele;
  },
  run: (c) => {
    const { e, k, sys, dt } = c;
    if (k.ph === 0) {
      if (k.t > 0) return;
      k.ph = 1;
      k.t = C.rampageSec; // 날뛰는 남은 시간
      k.d.el = 0; // 날뛴 시간
      k.d.seg = 0; // 지금 방향으로 달릴 남은 시간
      k.d.gap = 0; // 맞은 대상 목록을 비우기까지 남은 시간
    }
    if (k.ph === 1) {
      k.d.el! += dt;
      k.d.seg! -= dt;
      k.d.gap! -= dt;
      if (k.d.seg! <= 0) {
        k.ang = Math.random() * Math.PI * 2; // 사방팔방 아무 쪽으로나
        k.d.seg = C.rampageSegMin + Math.random() * (C.rampageSegMax - C.rampageSegMin);
      }
      if (k.d.gap! <= 0) {
        k.hit.clear(); // 같은 대상도 간격을 두고 다시 친다
        k.d.gap = C.rampageHitGap;
      }
      // 박힌 철퇴·창 장애물은 부수고 지나간다
      for (const h of sys.hazards) {
        if ((h.kind !== HZ_MACE && h.kind !== HZ_SPEAR) || h.delay > 0 || Math.hypot(h.x - e.x, h.y - e.y) > BODY + h.solid) continue;
        h.t = 0;
        sys.fx(h.x, h.y, 0, BFX_IMPACT);
      }
      k.d.trav = 0;
      const res = sys.dashStep(
        c,
        C.rampageSpeed,
        1e9,
        C.rampageHitW,
        (f) => {
          sys.hitFoe(e, f, C.rampageDmg, C.rampageKnock);
          sys.fx(f.x, f.y, k.ang, BFX_IMPACT);
        },
        BODY,
        () => sys.fx(e.x, e.y, k.ang, BFX_IMPACT), // 방벽은 부수고 지나간다
      );
        if (res === "crash") {
        // 벽·바위·맵 끝에 부딪히면 반대쪽으로 튕겨 나간다
        k.ang += Math.PI + (Math.random() - 0.5) * 1.6;
        k.d.seg = C.rampageSegMin;
        sys.fx(e.x, e.y, k.ang, BFX_IMPACT);
      }
      if (k.t <= 0) {
        e.stunT = C.rampageStun; // 지쳐 멈춘다(그로기)
        sys.fx(e.x, e.y, k.ang, BFX_CRASH);
        sys.end(c);
      }
    }
  },
  tele: ({ e, k }) => [[TELE_CIRCLE, r1(e.x), r1(e.y), 0, BODY + 90, 0, ...lt(k), BSK_RAMPAGE]],
};

export const chariotKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [accel, scythe, drift, rampage],
  /** 정면은 단단하고 측면·후면이 약점이다 */
  preHit: ({ e }, hit) => {
    if (hit.dot) return hit;
    const rel = Math.abs(angDiff(hit.fromAngle, e.face)); // 맞은 쪽에서 공격자를 본 방향과 장군이 바라보는 방향
    const mult = rel <= C.frontHalf ? C.frontMult : C.weakMult;
    return { ...hit, damage: hit.damage * mult };
  },
  flags: ({ k }) => (k.cur?.id === BSK_RAMPAGE ? EF_MAD : 0) | (k.cur?.id === BSK_SCYTHE && k.ph === 1 ? EF_SCYTHE : 0),
};

void ({} as Enemy | Ctx);
