import { BOSS_CAV as C, BSK_CHARGE, BSK_KICK, BSK_ROAR, BSK_SLASH, BSK_SPRINT, BFX_CRASH, BFX_IMPACT, BFX_ROAR, BFX_SLASH, EF_SPRINT, TELE_BAND, TELE_CONE, TELE_CIRCLE, TELE_LINE, chargeBonus, clampToWorld } from "@mercenary/shared";
import type { Enemy } from "../game.js";
import { angDiff } from "./system.js";
import type { Ctx, KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const r2 = (v: number) => Math.round(v * 100) / 100;
const radiusOf = (e: Enemy): number => (e as any).__r ?? 38;

const sprint: SkillDef = {
  id: BSK_SPRINT,
  cd: C.sprintCd,
  weight: 3,
  can: ({ e, foes, sys, k }) => (k.v.sprint ?? 0) <= 0 && foes.some((f) => sys.dist(f, e) > 240 && sys.dist(f, e) < 1100) && !foes.some((f) => sys.dist(f, e) <= 240),
  begin: ({ k }) => {
    k.t = k.total = C.sprintTele;
  },
  run: (c) => {
    if (c.k.t <= 0) {
      c.k.v.sprint = C.sprintSec;
      c.sys.end(c);
    }
  },
  tele: ({ e, k }) => [[TELE_CIRCLE, Math.round(e.x), Math.round(e.y), 0, 80, 0, Math.max(0, Math.round(k.t * 10)), Math.round(k.total * 10), BSK_SPRINT]],
};

const roar: SkillDef = {
  id: BSK_ROAR,
  cd: C.roarCd,
  weight: 2,
  can: ({ e, foes, sys }) => {
    if (!foes.some((f) => sys.dist(f, e) < 900)) return false;
    let army = 0;
    for (const o of sys.g.enemies.values() as Iterable<Enemy>) if (o.army && !o.boss) army++;
    return army >= 3;
  },
  begin: ({ k }) => {
    k.t = k.total = C.roarTele;
  },
  run: (c) => {
    if (c.k.t > 0) return;
    for (const o of c.sys.g.enemies.values() as Iterable<Enemy>) {
      if (!o.army || o.boss) continue;
      if (!(o.buffT && o.buffT > 0)) o.dmgMult *= C.roarDmg;
      o.buffT = C.roarSec;
    }
    c.sys.fx(c.e.x, c.e.y, 0, BFX_ROAR);
    c.sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_CIRCLE, Math.round(e.x), Math.round(e.y), 0, 80, 0, Math.max(0, Math.round(k.t * 10)), Math.round(k.total * 10), BSK_ROAR]],
};

const kick: SkillDef = {
  id: BSK_KICK,
  cd: C.kickCd,
  weight: 6,
  can: ({ e, foes }) => {
    const back = e.face + Math.PI;
    return foes.some((f) => Math.hypot(f.x - e.x, f.y - e.y) <= C.kickRange + f.r && Math.abs(angDiff(Math.atan2(f.y - e.y, f.x - e.x), back)) <= C.kickHalf);
  },
  begin: ({ e, k }) => {
    k.ang = e.face + Math.PI;
    k.t = k.total = C.kickTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      for (const f of foes) {
        if (!sys.inCone(f, e.x, e.y, k.ang, C.kickHalf, C.kickRange)) continue;
        sys.hitFoe(e, f, C.kickDmg, C.kickKnock);
        sys.fx(f.x, f.y, Math.atan2(f.y - e.y, f.x - e.x), BFX_IMPACT);
      }
      sys.fx(e.x, e.y, k.ang, BFX_IMPACT);
      k.ph = 2;
      k.t = C.kickRest;
    } else if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ k }) => [[TELE_CONE, Math.round(k.x), Math.round(k.y), r2(k.ang), r2(C.kickHalf), C.kickRange, Math.max(0, Math.round(k.t * 10)), Math.round(k.total * 10), BSK_KICK]],
};

const charge: SkillDef = {
  id: BSK_CHARGE,
  cd: C.chargeCd,
  weight: 4,
  can: ({ e, foes, sys }) => {
    const w = sys.weakFoe(foes, e, C.chargeRange);
    return !!w && sys.dist(w, e) > 150;
  },
  begin: ({ e, k, foes, sys }) => {
    const w = sys.weakFoe(foes, e, C.chargeRange)!;
    k.ang = Math.atan2(w.y - e.y, w.x - e.x); // 예고 시작 때 방향을 고정한다
    e.face = k.ang;
    k.t = k.total = C.chargeTele;
  },
  run: (c) => {
    const { e, k, foes, sys, dt } = c;
    const g = sys.g as any;
    if (k.ph === 0) {
      e.face = k.ang;
      if (k.t <= 0) {
        k.ph = 1;
        k.d.trav = 0;
      }
      return;
    }
    if (k.ph === 1) {
      const step = C.chargeSpeed * dt;
      const sub = Math.max(1, Math.ceil(step / 12)); // 얇은 방벽을 뚫고 지나가지 않게 잘게 나눠 움직인다
      const rr = 38 * 0.7;
      for (let i = 0; i < sub && k.ph === 1; i++) {
        const dd = Math.min(step / sub, C.chargeLen - k.d.trav!);
        e.x = clampToWorld(e.x + Math.cos(k.ang) * dd, 14);
        e.y = clampToWorld(e.y + Math.sin(k.ang) * dd, 14);
        k.d.trav! += dd;
        e.face = k.ang;
        if ((g.walls as any[]).some((w) => g.wallLocal(w, e.x, e.y, rr) !== null) || g.terrain?.blocked(e.x, e.y, rr)) {
          e.x = clampToWorld(e.x - Math.cos(k.ang) * 24, 14);
          e.y = clampToWorld(e.y - Math.sin(k.ang) * 24, 14);
          e.stunT = C.chargeStun;
          sys.fx(e.x, e.y, k.ang, BFX_CRASH);
          sys.end(c);
          return;
        }
        for (const f of foes) {
          const key = sys.foeKey(f);
          if (k.hit.has(key) || Math.hypot(f.x - e.x, f.y - e.y) > C.chargeWidth / 2 + f.r) continue;
          k.hit.add(key);
          sys.hitFoe(e, f, C.chargeDmg, C.chargeKnock, chargeBonus(200, 1));
          sys.fx(f.x, f.y, k.ang, BFX_IMPACT);
        }
        if (k.d.trav! >= C.chargeLen - 0.5) {
          k.ph = 2;
          k.t = C.chargeRest; // 딜 타임
        }
      }
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ k }) => [[TELE_LINE, Math.round(k.x), Math.round(k.y), r2(k.ang), C.chargeLen, C.chargeWidth, Math.max(0, Math.round(k.t * 10)), Math.round(k.total * 10), BSK_CHARGE]],
};

const slash: SkillDef = {
  id: BSK_SLASH,
  cd: C.slashCd,
  weight: 2.5,
  can: ({ e, foes, sys }) => !!sys.weakFoe(foes, e, C.slashRange),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.weakFoe(foes, e, C.slashRange)!;
    k.x = t.x; // 궤도 중심도 고정한다
    k.y = t.y;
    k.t = k.total = C.slashTele;
  },
  run: (c) => {
    // 선회 베기: 예고한 원 궤도를 보스가 크고 빠르게 돌며 지나간 곳을 벤다
    const { e, k, foes, sys, dt } = c;
    const R = C.slashRadius;
    if (k.ph === 0) {
      if (k.t > 0) return;
      k.ph = 1;
      k.t = C.slashSec;
      k.d.start = Math.atan2(e.y - k.y, e.x - k.x);
      k.d.r0 = Math.hypot(e.x - k.x, e.y - k.y);
    }
    if (k.ph === 1) {
      const elapsed = C.slashSec - Math.max(0, k.t);
      const th = k.d.start! - (elapsed / C.slashSec) * Math.PI * 2;
      const rad = k.d.r0! + (R - k.d.r0!) * Math.min(1, elapsed / 0.35);
      e.x = clampToWorld(k.x + Math.cos(th) * rad, 14);
      e.y = clampToWorld(k.y + Math.sin(th) * rad, 14);
      e.face = th - Math.PI / 2;
      const now = sys.g.time as number;
      let slashed = false;
      for (const f of foes) {
        if (Math.hypot(f.x - e.x, f.y - e.y) > C.slashBand + f.r) continue;
        const key = sys.foeKey(f);
        if (now - (k.hitAt.get(key) ?? -9) < 0.45) continue;
        k.hitAt.set(key, now);
        sys.hitFoe(e, f, C.slashDmg, C.slashKnock);
        slashed = true;
      }
      if (slashed || Math.floor(elapsed * 5) !== Math.floor((elapsed - dt) * 5)) sys.fx(e.x, e.y, e.face, BFX_SLASH);
      if (k.t <= 0) {
        k.ph = 2;
        k.t = C.slashRest;
      }
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ k }) => [[TELE_BAND, Math.round(k.x), Math.round(k.y), 0, C.slashRadius - C.slashBand, C.slashRadius + C.slashBand, Math.max(0, Math.round(k.t * 10)), Math.round(k.total * 10), BSK_SLASH]],
};

void radiusOf;

export const cavalryKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [kick, charge, slash, sprint, roar],
  tick: ({ k, dt }) => {
    if ((k.v.sprint ?? 0) > 0) k.v.sprint = k.v.sprint! - dt;
  },
  speedMult: ({ k }) => ((k.v.sprint ?? 0) > 0 ? C.sprintMult : 1),
  flags: ({ k }) => ((k.v.sprint ?? 0) > 0 ? EF_SPRINT : 0),
};
