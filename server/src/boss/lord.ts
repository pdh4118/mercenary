import { BOSS_LORD as C, BSK_CATAPULT, BSK_OIL, EF_INVULN, GATE_X, GATE_Y, HZ_GATE, HZ_OIL, HZ_RAIN, SIEGE } from "@mercenary/shared";
import type { Foe } from "../game.js";
import type { Ctx, KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const gateAlive = (c: Ctx): boolean => c.sys.hazards.some((h) => h.kind === HZ_GATE && h.t > 0);
const jitter = (v: number, a: number) => v + (Math.random() - 0.5) * 2 * a;

/** 성루 투석: 성벽 위 투석기가 바위를 연달아 던진다. 큰 원이 예고된 뒤 떨어진다(가까운 대상과 밀집한 곳을 번갈아 노린다). */
const catapult: SkillDef = {
  id: BSK_CATAPULT,
  cd: C.catapultCd,
  weight: 5,
  can: ({ e, foes, sys }) => foes.some((f) => sys.dist(f, e) <= C.catapultRange),
  begin: ({ k }) => {
    k.t = k.total = 0.5;
    k.d.shot = 0;
    k.d.next = 0;
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    if (k.ph === 0) {
      if (k.t > 0) return;
      k.ph = 1;
      k.t = 99;
      k.d.next = 0;
    }
    if (k.ph === 1) {
      k.d.next! -= dt;
      if (k.d.next! > 0) return;
      const inR = foes.filter((f) => sys.dist(f, e) <= C.catapultRange);
      if (inR.length === 0 || k.d.shot! >= C.catapultShots) {
        k.ph = 2;
        k.t = 0.7;
        return;
      }
      let tgt: Foe;
      if (k.d.shot! % 2 === 0) {
        tgt = inR[Math.floor(Math.random() * inR.length)]!; // 아무나
      } else {
        // 가장 많이 모인 곳
        tgt = inR.reduce((best, f) => {
          const n = inR.filter((o) => Math.hypot(o.x - f.x, o.y - f.y) < 160).length;
          return n > best.n ? { f, n } : best;
        }, { f: inR[0]!, n: 0 }).f;
      }
      sys.addHazard({ kind: HZ_RAIN, x: jitter(tgt.x, 40), y: jitter(tgt.y, 40), a: C.catapultRadius, b: 1, delay: C.catapultTele, t: 0.35, total: 0.35, src: e.id, dmg: C.catapultDmg, d: { knock: C.catapultKnock } });
      k.d.shot!++;
      k.d.next = C.catapultGap;
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: () => [],
};

/** 끓는 기름: 성문 앞에서 싸우는 대상의 발밑에 기름 장판이 깔린다. 붉은 원으로 예고된 뒤 몇 초 동안 피해를 주고 느리게 만든다. */
const oil: SkillDef = {
  id: BSK_OIL,
  cd: C.oilCd,
  weight: 4,
  can: ({ foes }) => foes.some((f) => Math.hypot(f.x - GATE_X, f.y - GATE_Y) <= C.oilGateRange),
  begin: ({ k }) => {
    k.t = k.total = 0.5;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0) {
      if (k.t > 0) return;
      const near = foes.filter((f) => Math.hypot(f.x - GATE_X, f.y - GATE_Y) <= C.oilGateRange);
      const picks = near.sort(() => Math.random() - 0.5).slice(0, C.oilPatches);
      for (const f of picks) sys.addHazard({ kind: HZ_OIL, x: f.x, y: f.y, a: C.oilRadius, t: C.oilSec, total: C.oilSec, delay: C.oilTele, dmg: C.oilDmg, src: e.id });
      k.ph = 1;
      k.t = 0.9;
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: () => [],
};

/** 군주: 성 안마당에서 움직이지 않는다. 성문이 있는 동안은 무적이다. */
export const lordKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [catapult, oil],
  move: () => true,
  tick: (c) => {
    c.e.x = SIEGE.lordX;
    c.e.y = SIEGE.lordY;
    if (gateAlive(c)) c.e.invulnT = Math.max(c.e.invulnT ?? 0, 0.5);
  },
  flags: (c) => (gateAlive(c) ? EF_INVULN : 0),
};
