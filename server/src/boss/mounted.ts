import {
  BOSS_MOUNT as C,
  BSK_BLINDARROW,
  BUL_BLIND,
  ST_BLIND,
  BSK_HITRUN,
  BSK_LASSO,
  BSK_ORBITSHOT,
  BUL_BOSSARROW,
  BUL_LASSO,
  BFX_BLINK,
  BFX_IMPACT,
  EF_CORNERED,
  NO_TYPE,
  ST_ROOT,
  TELE_BAND,
  TELE_LINE,
  clampToWorld,
  WORLD_SIZE,
} from "@mercenary/shared";
import type { Foe } from "../game.js";
import { angDiff } from "./system.js";
import type { Ctx, KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const r1 = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;
const lt = (k: { t: number; total: number }) => [Math.max(0, r1(k.t * 10)), Math.max(1, r1(k.total * 10))] as const;
const HALF = WORLD_SIZE / 2;

/** 그 방향으로 d만큼 가도 맵 안이고 바위·방벽이 없는가 */
function clearAhead(c: Ctx, ang: number, d: number): boolean {
  const g = c.sys.g as any;
  const x = c.e.x + Math.cos(ang) * d;
  const y = c.e.y + Math.sin(ang) * d;
  if (Math.abs(x) > HALF - 60 || Math.abs(y) > HALF - 60) return false;
  if (g.terrain?.blocked(x, y, 30)) return false;
  if ((g.walls as any[]).some((w) => g.wallLocal(w, x, y, 30) !== null)) return false;
  return !c.sys.hazards.some((h) => (h.solid > 0 || h.kind === 4 || h.kind === 5) && Math.hypot(h.x - x, h.y - y) < (h.solid || h.a) + 30);
}

/** 둘러싸였는가: 가까운 아군이 여럿이고 서로 사이의 빈 각도가 모두 작다 */
function surrounded(c: Ctx): boolean {
  const near = c.foes.filter((f) => c.sys.dist(f, c.e) <= C.corneredRadius);
  if (near.length < C.corneredMin) return false;
  const angs = near.map((f) => Math.atan2(f.y - c.e.y, f.x - c.e.x)).sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < angs.length; i++) {
    const nx = i + 1 < angs.length ? angs[i + 1]! : angs[0]! + Math.PI * 2;
    maxGap = Math.max(maxGap, nx - angs[i]!);
  }
  return maxGap < C.corneredGap;
}

/** 이동(스킬이 없을 때): 가까운 아군에게서 가장 열린 방향으로 달아나고, 거리를 두고 돌며 활을 쏜다. 막히면 궁지에 몰린다. */
function move(c: Ctx): boolean {
  const { e, k, foes, sys, dt } = c;
  const g = sys.g as any;
  k.v.shotCd = Math.max(0, (k.v.shotCd ?? 0) - dt);
  k.v.corneredCd = Math.max(0, (k.v.corneredCd ?? 0) - dt);
  k.v.fleeT = Math.max(0, (k.v.fleeT ?? 0) - dt);
  const nearest = sys.nearestFoe(foes, e);
  // 돌파: 궁지가 끝나면 가장 빈 쪽으로 돌진해 부딪힌 대상에게 피해
  if ((k.v.breaking ?? 0) > 0) {
    const step = Math.min(C.breakSpeed * dt, k.v.breaking!);
    e.x = clampToWorld(e.x + Math.cos(k.v.bang!) * step, 14);
    e.y = clampToWorld(e.y + Math.sin(k.v.bang!) * step, 14);
    e.face = k.v.bang!;
    k.v.breaking! -= step;
    for (const f of foes) {
      const key = sys.foeKey(f);
      if (k.hit.has(key) || Math.hypot(f.x - e.x, f.y - e.y) > 40 + f.r) continue;
      k.hit.add(key);
      sys.hitFoe(e, f, C.breakDmg, 120);
      sys.fx(f.x, f.y, k.v.bang!, BFX_IMPACT);
    }
    if (g.terrain?.blocked(e.x, e.y, 26)) k.v.breaking = 0;
    return true;
  }
  // 궁지: 속도가 크게 줄고 받는 피해가 늘어난다
  if ((k.v.cornered ?? 0) > 0) {
    k.v.cornered = Math.max(0, k.v.cornered! - dt);
    if (k.v.cornered === 0) {
      // 가장 빈 방향(둘러싼 아군에게서 가장 먼 쪽)으로 돌파한다
      let best = 0;
      let bs = -1;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const room = Math.min(...foes.map((f) => Math.abs(angDiff(a, Math.atan2(f.y - e.y, f.x - e.x)))).concat([Math.PI]));
        const sc = room + (clearAhead(c, a, 400) ? 1 : -2);
        if (sc > bs) {
          bs = sc;
          best = a;
        }
      }
      k.v.bang = best;
      k.v.breaking = C.breakDist;
      k.hit.clear();
      k.v.corneredCd = 7;
      sys.fx(e.x, e.y, 0, BFX_BLINK);
    }
  }
  const slow = (k.v.cornered ?? 0) > 0 ? C.corneredSpeed : 1;
  // 아군에게서 달아나는 방향: 가까운 아군들의 반대 방향 합(가까울수록 강하다)
  let vx = 0;
  let vy = 0;
  let nearCount = 0;
  for (const f of foes) {
    const d = sys.dist(f, e);
    if (d > C.fleeRadius) continue;
    nearCount++;
    const w = (C.fleeRadius - d) / C.fleeRadius + 0.2;
    vx += ((e.x - f.x) / Math.max(1, d)) * w;
    vy += ((e.y - f.y) / Math.max(1, d)) * w;
  }
  let ang = 0;
  let moving = false;
  if (nearCount > 0) {
    ang = Math.atan2(vy, vx);
    moving = true;
  } else if (nearest) {
    // 거리를 유지하며 돈다: 멀면 접근, 적당하면 옆으로 돈다
    const d = sys.dist(nearest, e);
    const toward = Math.atan2(nearest.y - e.y, nearest.x - e.x);
    ang = d > C.keepDist + 120 ? toward : toward + (Math.PI / 2) * (e.id % 2 ? 1 : -1);
    moving = true;
  }
  if (moving) {
    // 막힌 방향이면 열린 방향으로 비켜 간다(맵 끝·바위·방벽·장애물)
    let chosen = ang;
    let ok = clearAhead(c, ang, 160);
    if (!ok) {
      for (const off of [0.5, -0.5, 1, -1, 1.5, -1.5, 2.2, -2.2]) {
        if (clearAhead(c, ang + off, 160)) {
          chosen = ang + off;
          ok = true;
          break;
        }
      }
    }
    // 둘러싸였거나 갈 곳이 없으면 궁지(쿨타임 중에는 들지 않는다)
    if ((!ok || (nearCount >= C.corneredMin && surrounded(c))) && (k.v.cornered ?? 0) <= 0 && (k.v.corneredCd ?? 0) <= 0) {
      k.v.cornered = C.corneredSec;
      sys.fx(e.x, e.y, 0, BFX_BLINK);
    }
    const sp = C.speed * slow * ((k.v.fleeT ?? 0) > 0 ? C.fleeBoost : 1) * (nearCount > 0 ? 1 : 0.65);
    e.x = clampToWorld(e.x + Math.cos(chosen) * sp * dt, 14);
    e.y = clampToWorld(e.y + Math.sin(chosen) * sp * dt, 14);
    e.face = nearest ? Math.atan2(nearest.y - e.y, nearest.x - e.x) : chosen;
  }
  // 지속적으로 쏜다
  if (nearest && (k.v.shotCd ?? 0) <= 0 && sys.dist(nearest, e) <= C.shotRange) {
    const lead = Math.min(0.6, sys.dist(nearest, e) / C.shotSpeed);
    const a = Math.atan2(nearest.y + nearest.vy * lead - e.y, nearest.x + nearest.vx * lead - e.x);
    sys.bullet(e, { ang: a, speed: C.shotSpeed, range: C.shotRange, mult: C.shotDmg, kind: BUL_BOSSARROW });
    k.v.shotCd = C.shotCd;
  }
  return true;
}

/** 치고 빠지기: 조준 예고 뒤 3연발을 쏘고 곧바로 반대로 달아난다 */
const hitRun: SkillDef = {
  id: BSK_HITRUN,
  cd: C.hitRunCd,
  weight: 4,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, 600),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.nearestFoe(foes, e, 600)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.hitRunTele;
  },
  run: (c) => {
    const { e, k, dt, sys } = c;
    e.face = k.ang;
    if (k.ph === 0) {
      if (k.t > 0) return;
      k.ph = 1;
      k.d.n = 0;
      k.d.next = 0;
    }
    if (k.ph === 1) {
      k.d.next! -= dt;
      if (k.d.next! <= 0 && k.d.n! < C.hitRunShots) {
        sys.bullet(e, { ang: k.ang, speed: C.shotSpeed * 1.2, range: 800, mult: C.shotDmg * 1.4, kind: BUL_BOSSARROW });
        k.d.n!++;
        k.d.next = C.hitRunGap;
        if (k.d.n! >= C.hitRunShots) {
          k.v.fleeT = C.hitRunFlee;
          sys.end(c);
        }
      }
    }
  },
  tele: ({ e, k }) => [[TELE_LINE, r1(e.x), r1(e.y), r2(k.ang), 700, 40, ...lt(k), BSK_HITRUN]],
};

/** 선회 사격: 대상 둘레의 원 궤도를 돌며 1초마다 선행 조준 3발 부채꼴 사격 */
const orbitShot: SkillDef = {
  id: BSK_ORBITSHOT,
  cd: C.orbitCd,
  weight: 3,
  can: ({ e, foes, sys }) => !!sys.weakFoe(foes, e, 800),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.weakFoe(foes, e, 800)!;
    k.d.tid = sys.foeKey(t);
    k.x = t.x;
    k.y = t.y;
    k.t = k.total = C.orbitTele;
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    const t = foes.find((f) => sys.foeKey(f) === k.d.tid);
    if (!t) {
      sys.end(c);
      return;
    }
    if (k.ph === 0) {
      k.x = t.x;
      k.y = t.y;
      if (k.t > 0) return;
      k.ph = 1;
      k.t = C.orbitSec;
      k.d.th = Math.atan2(e.y - t.y, e.x - t.x);
      k.d.dir = e.id % 2 ? 1 : -1;
      k.d.next = 0.3;
    }
    if (k.ph === 1) {
      const el = C.orbitSec - Math.max(0, k.t);
      k.d.th! += (k.d.dir! * (C.speed * 1.1)) / C.orbitRadius * dt;
      const rad = Math.min(C.orbitRadius, Math.hypot(e.x - t.x, e.y - t.y) + 400 * dt * (el < 0.6 ? 1 : 0));
      e.x = clampToWorld(t.x + Math.cos(k.d.th!) * (el < 0.6 ? rad : C.orbitRadius), 14);
      e.y = clampToWorld(t.y + Math.sin(k.d.th!) * (el < 0.6 ? rad : C.orbitRadius), 14);
      e.face = Math.atan2(t.y - e.y, t.x - e.x);
      k.d.next! -= dt;
      if (k.d.next! <= 0) {
        k.d.next = C.orbitShotStep;
        const lead = Math.min(0.8, sys.dist(t, e) / C.shotSpeed);
        const a = Math.atan2(t.y + t.vy * lead - e.y, t.x + t.vx * lead - e.x);
        for (const off of [-0.18, 0, 0.18]) sys.bullet(e, { ang: a + off, speed: C.shotSpeed, range: 900, mult: C.shotDmg, kind: BUL_BOSSARROW });
      }
      if (k.t <= 0) sys.end(c);
    }
  },
  tele: ({ k }) => [[TELE_BAND, r1(k.x), r1(k.y), 0, C.orbitRadius - 28, C.orbitRadius + 28, ...lt(k), BSK_ORBITSHOT]],
};

/** 실명 화살(체력 50% 이하): 주인공을 겨눠 쏘면, 맞은 주인공은 한동안 시야가 크게 좁아진다(용병은 피해만 입는다) */
const blindArrow: SkillDef = {
  id: BSK_BLINDARROW,
  cd: C.blindCd,
  weight: 3,
  phase: 2,
  can: ({ e, foes, sys }) => foes.some((f) => !f.f.merc && sys.dist(f, e) <= C.blindRange),
  begin: ({ e, k, foes, sys }) => {
    let t: Foe | null = null;
    for (const f of foes) if (!f.f.merc && sys.dist(f, e) <= C.blindRange && (!t || sys.dist(f, e) < sys.dist(t, e))) t = f;
    t = t ?? sys.nearestFoe(foes, e)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.blindTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0) {
      e.face = k.ang;
      if (k.t > 0) return;
      // 선 위에서 가장 가까운 대상 한 명이 맞는다(용병이 가로막으면 용병이 맞는다)
      let hit: Foe | null = null;
      let bd = Infinity;
      for (const f of foes) {
        if (!sys.inLine(f, e.x, e.y, k.ang, C.blindRange, C.blindWidth)) continue;
        const d = sys.dist(f, e);
        if (d < bd) {
          bd = d;
          hit = f;
        }
      }
      sys.bullet(e, { ang: k.ang, speed: 1500, range: hit ? bd : C.blindRange, kind: BUL_BLIND, vis: true });
      if (hit) {
        sys.hitFoe(e, hit, C.blindDmg, 0);
        if (!hit.f.merc) hit.f.status(ST_BLIND, C.blindSec);
        sys.fx(hit.x, hit.y, k.ang, BFX_IMPACT);
      }
      k.ph = 1;
      k.t = 0.5;
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_LINE, r1(e.x), r1(e.y), r2(k.ang), C.blindRange, C.blindWidth, ...lt(k), BSK_BLINDARROW]],
};

/** 올가미 화살(체력 50% 이하): 맞은 대상을 속박하고 곧바로 그쪽으로 달려 부딪힌다 */
const lasso: SkillDef = {
  id: BSK_LASSO,
  cd: C.lassoCd,
  weight: 3,
  phase: 2,
  can: ({ e, foes, sys }) => !!sys.weakFoe(foes, e, 800),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.weakFoe(foes, e, 800)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x);
    e.face = k.ang;
    k.t = k.total = C.lassoTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0) {
      e.face = k.ang;
      if (k.t > 0) return;
      // 선 위에서 가장 가까운 대상 한 명을 묶는다
      let hit: Foe | null = null;
      let bd = Infinity;
      for (const f of foes) {
        if (!sys.inLine(f, e.x, e.y, k.ang, 900, 44)) continue;
        const d = sys.dist(f, e);
        if (d < bd) {
          bd = d;
          hit = f;
        }
      }
      sys.bullet(e, { ang: k.ang, speed: 1400, range: hit ? bd : 900, kind: BUL_LASSO, vis: true });
      if (!hit) {
        k.ph = 2;
        k.t = 0.5;
        return;
      }
      sys.hitFoe(e, hit, C.lassoDmg, 0);
      hit.f.status(ST_ROOT, C.lassoRoot);
      k.ang = Math.atan2(hit.y - e.y, hit.x - e.x);
      k.d.len = bd + 120;
      k.d.trav = 0;
      k.hit.clear();
      k.ph = 1;
      return;
    }
    if (k.ph === 1) {
      const res = sys.dashStep(c, C.lassoCharge, k.d.len!, 60, (f) => {
        sys.hitFoe(e, f, C.lassoChargeDmg, 120);
        sys.fx(f.x, f.y, k.ang, BFX_IMPACT);
      }, 26);
      if (res !== "run") {
        k.ph = 2;
        k.t = 0.5;
      }
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_LINE, r1(e.x), r1(e.y), r2(k.ang), 900, 44, ...lt(k), BSK_LASSO]],
};

export const mountedKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [hitRun, orbitShot, blindArrow, lasso],
  move,
  tick: ({ k, dt }) => {
    if ((k.v.cornered ?? 0) > 0 && k.cur) k.v.cornered = Math.max(0, k.v.cornered! - dt);
  },
  /** 궁지에 몰리면 받는 피해가 늘어난다 */
  preHit: ({ k }, hit) => ((k.v.cornered ?? 0) > 0 ? { ...hit, damage: hit.damage * C.corneredTaken, charge: hit.charge * C.corneredTaken } : hit),
  flags: ({ k }) => ((k.v.cornered ?? 0) > 0 ? EF_CORNERED : 0),
};

void NO_TYPE;
