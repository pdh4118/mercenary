import { COURT, HALL, BFX_BOLT, BFX_IMPACT, BFX_MACEBOOM, BFX_RALLY, BFX_SLAM, BFX_SUMMON, BOSS_CAV, BOSS_LORD as C, BSK_ARROWSTORM, BSK_EXECUTE, BSK_GUARDS, BSK_RALLY, BSK_SCEPTER, HZ_EXECUTE, HZ_WARD, TELE_BAND, BSK_CATAPULT, BSK_EDICT, BSK_OIL, BSK_SORTIE, EF_INVULN, GATE_X, GATE_Y, HZ_EDICT, HZ_GATE, HZ_OIL, HZ_RAIN, SIEGE, TELE_CIRCLE } from "@mercenary/shared";
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
const isOpen = (sys: Ctx["sys"]): boolean => !!(sys.g as any).siege?.open;
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
      sys.addHazard({ kind: HZ_RAIN, x: jitter(tgt.x, 40), y: jitter(tgt.y, 40), a: C.catapultRadius, b: 2, delay: C.catapultTele, t: 0.35, total: 0.35, src: e.id, dmg: C.catapultDmg, d: { knock: C.catapultKnock } });
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
  can: ({ foes, sys }) => !isOpen(sys) && foes.some((f) => Math.hypot(f.x - GATE_X, f.y - GATE_Y) <= C.oilGateRange),
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
  can: ({ foes, sys }) => !isOpen(sys) && foes.some((f) => Math.hypot(f.x - GATE_X, f.y - (GATE_Y + 250)) <= C.arrowArea + 200),
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
  can: ({ foes, sys }) => !isOpen(sys) && foes.some((f) => Math.hypot(f.x - GATE_X, f.y - GATE_Y) <= 700),
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

/**
 * 칙령: 군주가 필드의 졸개에게 명령을 내린다. 명령을 받은 졸개는 군주의 깃발 아래 대열을 이루고, 대열 안에서는 받는 피해가 줄고 공격이 강해진다.
 * 대열마다 깃발병이 있고, 깃발병을 쓰러뜨리면 그 대열이 무너진다.
 *  - 진군령: 졸개가 가까운 것끼리 대열을 갖춰 플레이어를 향해 행군한다.
 *  - 포위령: 졸개가 플레이어 둘레로 퍼져 포위한 뒤 한꺼번에 조여 온다.
 *  - 집결령: 졸개가 성문 앞으로 물러나 방어선(방패벽)을 치고 성문을 지킨다(성문이 있을 때만).
 */
const edictSecOf = (kind: number): number => (kind === 2 ? C.cmdSiegeSec : kind === 3 ? C.cmdRallySec : C.edictSec);
const edict: SkillDef = {
  id: BSK_EDICT,
  cd: C.edictCd,
  weight: 4,
  can: ({ sys }) => (sys.g as any).commandableCount() >= C.cmdMin,
  begin: (c) => {
    // 명령 고르기: 성문이 아직 있으면 집결령도 후보다(성문을 노리는 플레이어가 가까울수록 자주)
    const opts: [number, number][] = [[1, 1], [2, 1]];
    if (gateAlive(c)) {
      const near = c.foes.some((f) => Math.hypot(f.x - GATE_X, f.y - GATE_Y) <= 900);
      opts.push([3, C.cmdWeightRally * (near ? 2 : 1)]);
    }
    let r = Math.random() * opts.reduce((t, o) => t + o[1], 0);
    let kind = 1;
    for (const [k, w] of opts) {
      if ((r -= w) <= 0) {
        kind = k;
        break;
      }
    }
    const sec = edictSecOf(kind);
    c.k.d.kind = kind;
    c.k.t = c.k.total = C.edictGrace + sec;
    c.k.d.issued = 0;
    c.sys.addHazard({ kind: HZ_EDICT, x: c.e.x, y: c.e.y, a: kind, delay: C.edictGrace, t: sec, total: sec, src: c.e.id });
    c.sys.fx(c.e.x, c.e.y, 0, BFX_RALLY);
  },
  run: (c) => {
    const { e, k, sys } = c;
    const g = sys.g as any;
    const grace = k.total - k.t < C.edictGrace;
    if (!grace && !k.d.issued) {
      k.d.issued = 1;
      const n = g.commandTroops(k.d.kind);
      if (n === 0) {
        sys.hazards = sys.hazards.filter((h) => h.kind !== HZ_EDICT);
        sys.end(c);
        return;
      }
      sys.fx(e.x, e.y, 0, BFX_RALLY);
    }
    if (k.t <= 0 || (k.d.issued && g.commandSquadCount() === 0)) {
      g.endCommand();
      sys.hazards = sys.hazards.filter((h) => h.kind !== HZ_EDICT);
      sys.end(c);
    }
  },
  tele: () => [],
};

/** 근위대 소집(성문이 부서진 뒤): 병종별 정예 4명이 군주를 감싼다. 살아 있는 동안 군주가 받는 피해가 크게 줄어든다(한 명 쓰러뜨릴 때마다 20%p). */
const guards: SkillDef = {
  id: BSK_GUARDS,
  cd: C.guardsCd,
  weight: 3,
  can: ({ sys }) => isOpen(sys) && (sys.g as any).guardCount() === 0,
  begin: ({ k }) => {
    k.t = k.total = 0.9;
  },
  run: (c) => {
    const { e, k, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      (sys.g as any).spawnGuards();
      sys.fx(e.x, e.y + 90, 0, BFX_SUMMON);
      k.ph = 1;
      k.t = 0.8;
    } else if (k.ph === 1 && k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_CIRCLE, r1(e.x), r1(e.y + 80), 0, 200, 0, ...lt(k), BSK_GUARDS]],
};

/** 홀 내려찍기: 군주 둘레 큰 원이 예고된 뒤 내려찍고, 곧이어 충격파가 바깥 띠로 퍼진다. */
const scepter: SkillDef = {
  id: BSK_SCEPTER,
  cd: C.scepterCd,
  weight: 5,
  can: ({ e, foes, sys }) => isOpen(sys) && foes.some((f) => sys.dist(f, e) <= C.scepterWave + 120),
  begin: ({ k }) => {
    k.t = k.total = C.scepterTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      for (const f of foes) if (sys.dist(f, e) <= C.scepterRadius + f.r) sys.hitFoe(e, f, C.scepterDmg, C.scepterKnock);
      sys.fx(e.x, e.y, C.scepterRadius / 100, BFX_MACEBOOM);
      sys.fx(e.x, e.y, 0, BFX_SLAM, C.scepterRadius);
      k.ph = 1;
      k.t = C.scepterWaveDelay;
      k.total = C.scepterWaveDelay;
    } else if (k.ph === 1 && k.t <= 0) {
      for (const f of foes) {
        const d = sys.dist(f, e);
        if (d > C.scepterRadius - f.r && d <= C.scepterWave + f.r) sys.hitFoe(e, f, C.scepterWaveDmg, 120);
      }
      sys.fx(e.x, e.y, C.scepterWave / 100, BFX_MACEBOOM);
      sys.fx(e.x, e.y, 0, BFX_SLAM, C.scepterWave);
      k.ph = 2;
      k.t = 0.7;
    } else if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  telePhases: [0, 1],
  tele: ({ e, k }) => (k.ph === 0 ? [[TELE_CIRCLE, r1(e.x), r1(e.y), 0, C.scepterRadius, 0, ...lt(k), BSK_SCEPTER]] : [[TELE_BAND, r1(e.x), r1(e.y), 0, C.scepterRadius, C.scepterWave, ...lt(k), BSK_SCEPTER]]),
};

/** 호령: 필드의 졸개 전체가 잠깐 강해진다(성을 빨리 무너뜨리라는 압박). */
const rally: SkillDef = {
  id: BSK_RALLY,
  cd: C.rallyCd,
  weight: 3,
  can: ({ sys }) => isOpen(sys),
  begin: ({ k }) => {
    k.t = k.total = 0.8;
  },
  run: (c) => {
    const { e, k, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      for (const m of (sys.g as any).enemies.values()) {
        if (m.boss || (m.buffT ?? 0) > 0) continue;
        m.buffT = C.rallySec;
        m.buffMult = C.rallyMult;
        m.dmgMult *= C.rallyMult;
      }
      sys.fx(e.x, e.y, 0, BFX_RALLY);
      k.ph = 1;
      k.t = 0.8;
    } else if (k.ph === 1 && k.t <= 0) sys.end(c);
  },
  tele: () => [],
};

/** 처형령(군주 체력 30% 이하): 화면이 어두워지고 카운트다운 뒤 전장 전체에 벼락이 친다. 결계 원 안은 안전하다. */
const execute: SkillDef = {
  id: BSK_EXECUTE,
  cd: C.executeCd,
  weight: 6,
  can: ({ e, sys }) => isOpen(sys) && e.hp / e.maxHp <= C.executeHp,
  begin: ({ k, e, sys }) => {
    k.t = k.total = C.executeTele;
    // 결계: 안마당 안 아무 곳(서로 겹치지 않게)
    const spots: [number, number][] = [];
    for (let tries = 0; tries < 60 && spots.length < C.executeWards; tries++) {
      const hall = !!(sys.g as any).siege?.hall;
      const x = hall ? HALL.cx + (Math.random() - 0.5) * 2 * (HALL.hw - 120) : COURT.cx + (Math.random() - 0.5) * 2 * (COURT.hw - 40);
      const y = hall ? HALL.cy + (Math.random() - 0.5) * 2 * (HALL.hh - 120) : COURT.cy + (Math.random() - 0.5) * 2 * (COURT.hh - 30);
      if (spots.every(([sx, sy]) => Math.hypot(sx - x, sy - y) > C.executeWardRadius * 1.7)) spots.push([x, y]);
    }
    for (const [x, y] of spots) sys.addHazard({ kind: HZ_WARD, x, y, a: C.executeWardRadius, t: C.executeTele + 1.1, total: C.executeTele + 1.1, src: e.id });
    sys.addHazard({ kind: HZ_EXECUTE, x: e.x, y: e.y, a: 0, delay: C.executeTele, t: 0.8, total: 0.8, src: e.id });
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      const wards = sys.hazards.filter((h) => h.kind === HZ_WARD);
      for (const f of foes) {
        if (wards.some((w) => Math.hypot(f.x - w.x, f.y - w.y) <= w.a)) continue; // 결계 안은 안전
        sys.pctHit(e, f, C.executePct);
        sys.fx(f.x, f.y, 0, BFX_BOLT);
      }
      // 볼거리: 결계 밖 빈 땅에도 벼락이 내리꽂힌다
      for (let i = 0, made = 0; i < 40 && made < 6; i++) {
        const hall = !!(sys.g as any).siege?.hall;
        const x = hall ? HALL.cx + (Math.random() - 0.5) * 2 * (HALL.hw - 60) : COURT.cx + (Math.random() - 0.5) * 2 * (COURT.hw + 40);
        const y = hall ? HALL.cy + (Math.random() - 0.5) * 2 * (HALL.hh - 60) : COURT.cy + (Math.random() - 0.5) * 2 * (COURT.hh + 20);
        if (wards.some((w) => Math.hypot(x - w.x, y - w.y) <= w.a + 30)) continue;
        sys.fx(x, y, 0, BFX_BOLT);
        made++;
      }
      k.ph = 1;
      k.t = 1;
    } else if (k.ph === 1 && k.t <= 0) sys.end(c);
  },
  tele: () => [],
};

/** 군주: 성 안마당에서 움직이지 않는다. 성문이 있는 동안은 무적이다. */
export const lordKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [catapult, oil, arrowStorm, sortie, edict, guards, scepter, rally, execute],
  move: () => true,
  tick: (c) => {
    const [hx, hy] = (c.sys.g as any).lordHome() as readonly [number, number];
    c.e.x = hx;
    c.e.y = hy;
    if (gateAlive(c)) c.e.invulnT = Math.max(c.e.invulnT ?? 0, 0.5);
  },
  /** 근위대가 살아 있는 동안 군주가 받는 피해가 줄어든다 */
  preHit: (c, hit) => {
    const n = (c.sys.g as any).guardCount() as number;
    if (n <= 0) return hit;
    return { ...hit, damage: hit.damage * Math.max(0, 1 - C.guardsReduce * n) };
  },
  flags: (c) => (gateAlive(c) ? EF_INVULN : 0),
};
