import { BFX_IMPACT, BOSS_LORD as C, BSK_ARROWSTORM, BSK_CATAPULT, BSK_EDICT, BSK_OIL, BSK_SORTIE, EF_INVULN, GATE_X, GATE_Y, HZ_EDICT, HZ_GATE, HZ_OIL, HZ_RAIN, SIEGE, TELE_CIRCLE } from "@mercenary/shared";
import type { Foe } from "../game.js";
import type { Ctx, KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const gateAlive = (c: Ctx): boolean => c.sys.hazards.some((h) => h.kind === HZ_GATE && h.t > 0);
const r1 = (v: number) => Math.round(v);
const lt = (k: { t: number; total: number }) => [Math.max(0, r1(k.t * 10)), Math.max(1, r1(k.total * 10))] as const;
const gatePct = (c: Ctx): number => {
  const h = c.sys.hazards.find((x) => x.kind === HZ_GATE && x.t > 0);
  return h ? (100 * h.hp) / h.hpMax : 0;
};
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

/** 화살 소나기: 성문 앞 넓은 구역에 화살비가 여러 곳 내린다(절반은 성문 앞 대상 발밑, 절반은 흩뿌린다). */
const arrowStorm: SkillDef = {
  id: BSK_ARROWSTORM,
  cd: C.arrowCd,
  weight: 4,
  can: ({ foes }) => foes.some((f) => Math.hypot(f.x - GATE_X, f.y - (GATE_Y + 250)) <= C.arrowArea + 200),
  begin: ({ k }) => {
    k.t = k.total = 0.6;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      const heroes = foes.filter((f) => !f.f.merc).length;
      const n = C.arrowCount + C.arrowPerPlayer * Math.max(0, heroes - 1);
      const near = foes.filter((f) => Math.hypot(f.x - GATE_X, f.y - (GATE_Y + 250)) <= C.arrowArea + 200);
      for (let i = 0; i < n; i++) {
        let x: number;
        let y: number;
        if (i % 2 === 0 && near.length > 0) {
          const f = near[Math.floor(Math.random() * near.length)]!;
          x = jitter(f.x, 30);
          y = jitter(f.y, 30);
        } else {
          const a = Math.random() * Math.PI * 2;
          const r = C.arrowArea * Math.sqrt(Math.random());
          x = GATE_X + Math.cos(a) * r;
          y = GATE_Y + 250 + Math.sin(a) * r * 0.8;
        }
        sys.addHazard({ kind: HZ_RAIN, x, y, a: C.arrowRadius, delay: C.arrowFall + i * C.arrowGap, t: 0.35, total: 0.35, src: e.id, dmg: C.arrowDmg });
      }
      k.ph = 1;
      k.t = 0.8;
    } else if (k.ph === 1 && k.t <= 0) sys.end(c);
  },
  tele: () => [],
};

/** 성문 개방 돌격: 성문 앞에 원이 예고된 뒤 성문이 열리고 정예 기병이 쏟아져 나온다. 성문 앞에서 오래 버티는 쪽을 쓸어낸다. */
const sortie: SkillDef = {
  id: BSK_SORTIE,
  cd: C.sortieCd,
  weight: 3,
  can: ({ foes }) => foes.some((f) => Math.hypot(f.x - GATE_X, f.y - GATE_Y) <= 700),
  begin: ({ k }) => {
    k.t = k.total = C.sortieTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      const heroes = foes.filter((f) => !f.f.merc).length;
      (sys.g as any).spawnSortie(C.sortieBase + C.sortiePerPlayer * Math.max(0, heroes - 1));
      sys.fx(GATE_X, GATE_Y + 60, Math.PI / 2, BFX_IMPACT);
      void e;
      k.ph = 1;
      k.t = 1.2;
    } else if (k.ph === 1 && k.t <= 0) sys.end(c);
  },
  tele: ({ k }) => [[TELE_CIRCLE, r1(GATE_X), r1(GATE_Y + 20), 0, 170, 0, ...lt(k), BSK_SORTIE]],
};

/** 칙령: 문구를 읽고 규칙대로 움직여야 한다(어기면 번개). 진군령 = 멈추면 번개, 분산령 = 아군끼리 뭉치면 번개(성문이 많이 상한 뒤부터). */
const edict: SkillDef = {
  id: BSK_EDICT,
  cd: C.edictCd,
  weight: 4,
  can: ({ foes }) => foes.length > 0,
  begin: (c) => {
    const spread = gatePct(c) <= C.edictSpreadGate && Math.random() < 0.5;
    c.k.d.rule = spread ? 2 : 1;
    c.k.t = c.k.total = C.edictGrace + C.edictSec;
    c.k.d.chk = C.edictCheck;
    c.k.list = [new Map<number, { x: number; y: number }>()];
    c.sys.addHazard({ kind: HZ_EDICT, x: c.e.x, y: c.e.y, a: c.k.d.rule, delay: C.edictGrace, t: C.edictSec, total: C.edictSec, src: c.e.id });
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    const grace = k.total - k.t < C.edictGrace;
    const pos: Map<number, { x: number; y: number }> = k.list[0];
    if (!grace) {
      k.d.chk! -= dt;
      if (k.d.chk! <= 0) {
        k.d.chk = C.edictCheck;
        for (const f of foes) {
          const key = sys.foeKey(f);
          const prev = pos.get(key);
          let bad = false;
          if (k.d.rule === 1) bad = !!prev && Math.hypot(f.x - prev.x, f.y - prev.y) < C.edictStill;
          else bad = foes.some((o) => o !== f && Math.hypot(o.x - f.x, o.y - f.y) < C.edictSpread);
          pos.set(key, { x: f.x, y: f.y });
          if (bad) {
            sys.hitFoe(e, f, C.edictDmg, 0);
            sys.fx(f.x, f.y, 0, BFX_IMPACT);
          }
        }
      }
    } else for (const f of foes) pos.set(sys.foeKey(f), { x: f.x, y: f.y });
    if (k.t <= 0) {
      sys.hazards = sys.hazards.filter((h) => h.kind !== HZ_EDICT);
      sys.end(c);
    }
  },
  tele: () => [],
};

/** 군주: 성 안마당에서 움직이지 않는다. 성문이 있는 동안은 무적이다. */
export const lordKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [catapult, oil, arrowStorm, sortie, edict],
  move: () => true,
  tick: (c) => {
    c.e.x = SIEGE.lordX;
    c.e.y = SIEGE.lordY;
    if (gateAlive(c)) c.e.invulnT = Math.max(c.e.invulnT ?? 0, 0.5);
  },
  flags: (c) => (gateAlive(c) ? EF_INVULN : 0),
};
