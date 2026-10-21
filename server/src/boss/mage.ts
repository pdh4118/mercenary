import {
  BOSS_MAGE as C,
  BSK_BLINK,
  BSK_FIRERING,
  BSK_ICEPRISON,
  BSK_MAGICSHIELD,
  BFX_BLINK,
  BFX_ICEBREAK,
  EF_BUBBLE,
  ENEMY_STATS,
  EVT_METEOR,
  HZ_ICE,
  HZ_RING,
  MAGE,
  MAGE_FALLOFF_FALLBACK,
  TELE_BAND,
  TELE_CIRCLE,
  TELE_RING,
  clampToWorld,
} from "@mercenary/shared";
import type { Ctx, KitDef, SkillDef } from "./types.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const r1 = (v: number) => Math.round(v);
const r2 = (v: number) => Math.round(v * 100) / 100;
const lt = (k: { t: number; total: number }) => [Math.max(0, r1(k.t * 10)), Math.max(1, r1(k.total * 10))] as const;

/** 메테오를 (x, y)에 떨어뜨린다: 반경 안의 아군에게 중심 100%·가장자리 60%의 피해(방패 무시) */
function meteor(c: Ctx, x: number, y: number, radius: number, mult: number): void {
  const { e, sys } = c;
  const g = sys.g as any;
  g.pushEvent(EVT_METEOR, x, y, 1, radius, 0); // owner 0 = 적, ang 1 = 보스의 마법
  for (const f of g.collectFriendlies() as any[]) {
    const d = Math.hypot(f.x - x, f.y - y);
    if (d > radius + f.radius) continue;
    const scale = 1 - MAGE_FALLOFF_FALLBACK * Math.min(1, d / radius);
    f.hit({ damage: sys.base(e) * mult * scale, charge: 0, srcType: MAGE, fromAngle: Math.atan2(y - f.y, x - f.x), pierceGuard: true, src: e });
  }
}

/** 얼음 감옥 + 메테오: 위협적인 대상을 얼음벽(공격 5번에 부서진다)으로 가두고 안쪽에 메테오를 떨어뜨린다. 메테오와 함께 벽도 사라진다. */
const prison: SkillDef = {
  id: BSK_ICEPRISON,
  cd: C.prisonCd,
  weight: 4,
  telePhases: [0, 1],
  can: ({ e, foes, sys }) => !!sys.weakFoe(foes, e, C.prisonRange),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.weakFoe(foes, e, C.prisonRange)!;
    k.x = t.x;
    k.y = t.y;
    e.face = Math.atan2(t.y - e.y, t.x - e.x);
    k.t = k.total = C.prisonTele;
  },
  run: (c) => {
    const { e, k, sys } = c;
    if (k.ph === 0) {
      if (k.t > 0) return;
      // 얼음벽이 솟아 가둔다: 벽 안쪽 크기가 메테오 범위와 같다
      const R = C.meteorRadius;
      const hl = R * Math.tan(Math.PI / C.prisonPieces) + 10;
      for (let i = 0; i < C.prisonPieces; i++) {
        const th = (i / C.prisonPieces) * Math.PI * 2;
        const cx = k.x + Math.cos(th) * (R + 12);
        const cy = k.y + Math.sin(th) * (R + 12);
        sys.addHazard({ kind: HZ_ICE, x: cx, y: cy, ang: th + Math.PI / 2, a: hl, b: C.prisonHits, hp: C.prisonHits, hpMax: C.prisonHits, t: C.meteorSec + 1, total: C.meteorSec + 1, src: e.id, d: { ht: 12 } });
      }
      k.ph = 1;
      k.t = k.total = C.meteorSec;
      return;
    }
    if (k.ph === 1) {
      // 벽을 모두 잃어도(탈출해도) 메테오는 예정대로 떨어진다. 벽 하나만 뚫리면 나올 수 있다.
      if (k.t > 0) return;
      meteor(c, k.x, k.y, C.meteorRadius, C.meteorDmg);
      for (const h of sys.hazards) {
        if (h.kind === HZ_ICE && h.src === e.id) {
          h.t = 0;
          sys.fx(h.x, h.y, 0, BFX_ICEBREAK);
        }
      }
      k.ph = 2;
      k.t = 0.8;
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ k }) =>
    k.ph === 0
      ? [[TELE_BAND, r1(k.x), r1(k.y), 0, C.meteorRadius, C.meteorRadius + 28, ...lt(k), BSK_ICEPRISON]]
      : [[TELE_CIRCLE, r1(k.x), r1(k.y), 0, C.meteorRadius, 0, ...lt(k), BSK_ICEPRISON]],
};

/** 매직 쉴드: 받는 피해의 70%를 쉴드가 흡수한다. 쉴드 체력이 다하면 깨지고 보스가 잠깐 기절한다. 6초 뒤에도 풀린다. */
const shield: SkillDef = {
  id: BSK_MAGICSHIELD,
  cd: C.shieldCd,
  weight: 2.5,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, 900),
  begin: ({ k }) => {
    k.t = k.total = C.shieldTele;
  },
  run: (c) => {
    const { e, k, sys } = c;
    if (k.t > 0) return;
    k.v.shield = C.shieldSec;
    k.v.shieldHp = e.maxHp * C.shieldHpFrac;
    sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_CIRCLE, r1(e.x), r1(e.y), 0, 70, 0, ...lt(k), BSK_MAGICSHIELD]],
};

/** 위협 순간이동: 근접한 대상을 피해 멀리 사라졌다가 나타나며 바로 메테오를 겨눈다 */
const blink: SkillDef = {
  id: BSK_BLINK,
  cd: C.blinkCd,
  weight: 6,
  telePhases: [0, 1],
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, C.blinkThreat),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.nearestFoe(foes, e, C.blinkThreat)!;
    const away = Math.atan2(e.y - t.y, e.x - t.x) + (Math.random() - 0.5) * 1.2;
    const d = C.blinkMin + Math.random() * (C.blinkMax - C.blinkMin);
    k.d.tx = clampToWorld(e.x + Math.cos(away) * d, 60);
    k.d.ty = clampToWorld(e.y + Math.sin(away) * d, 60);
    k.t = k.total = C.blinkTele;
  },
  run: (c) => {
    const { e, k, foes, sys } = c;
    if (k.ph === 0) {
      if (k.t > 0) return;
      sys.fx(e.x, e.y, 0, BFX_BLINK);
      e.x = k.d.tx!;
      e.y = k.d.ty!;
      sys.fx(e.x, e.y, 0, BFX_BLINK);
      const t = sys.weakFoe(foes, e, 1500);
      if (!t) {
        sys.end(c);
        return;
      }
      k.x = t.x;
      k.y = t.y;
      k.ph = 1;
      k.t = k.total = C.blinkMeteorSec;
      return;
    }
    if (k.ph === 1) {
      if (k.t > 0) return;
      meteor(c, k.x, k.y, C.meteorRadius, C.meteorDmg);
      k.ph = 2;
      k.t = 0.5;
      return;
    }
    if (k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => (k.ph === 0 ? [[TELE_CIRCLE, r1(e.x), r1(e.y), 0, 70, 0, ...lt(k), BSK_BLINK]] : [[TELE_CIRCLE, r1(k.x), r1(k.y), 0, C.meteorRadius, 0, ...lt(k), BSK_BLINK]]),
};

/** 확산 불꽃(체력 50% 이하): 보스에게서 원형으로 퍼지는 불꽃 고리. 틈으로 빠지면 맞지 않는다. */
const fireRing: SkillDef = {
  id: BSK_FIRERING,
  cd: C.ringCd,
  weight: 3,
  phase: 2,
  can: ({ e, foes, sys }) => !!sys.nearestFoe(foes, e, 900),
  begin: ({ e, k, foes, sys }) => {
    const t = sys.nearestFoe(foes, e, 900)!;
    k.ang = Math.atan2(t.y - e.y, t.x - e.x) + (Math.random() - 0.5) * 1.4; // 틈의 방향(예고에 표시된다)
    e.face = k.ang;
    k.t = k.total = C.ringTele;
  },
  run: (c) => {
    const { e, k, sys } = c;
    if (k.ph === 0 && k.t <= 0) {
      sys.addHazard({ kind: HZ_RING, x: e.x, y: e.y, ang: k.ang, a: 0, b: C.ringGap / 2, vx: C.ringSpeed, t: 5, total: 5, src: e.id, dmg: C.ringDmg, d: { w: C.ringWidth, max: C.ringMax } });
      k.ph = 2;
      k.t = 0.6;
    } else if (k.ph === 2 && k.t <= 0) sys.end(c);
  },
  tele: ({ e, k }) => [[TELE_RING, r1(e.x), r1(e.y), r2(k.ang), r2(C.ringGap / 2), C.ringMax, ...lt(k), BSK_FIRERING]],
};

export const mageKit: KitDef = {
  firstDelay: C.firstDelay,
  idleMin: C.idleMin,
  idleMax: C.idleMax,
  skills: [blink, prison, shield, fireRing],
  tick: ({ k, dt }) => {
    if ((k.v.shield ?? 0) > 0) {
      k.v.shield = Math.max(0, k.v.shield! - dt);
      if (k.v.shield === 0) k.v.shieldHp = 0;
    }
  },
  /** 매직 쉴드: 피해의 70%를 쉴드가 흡수한다 */
  preHit: ({ e, k, sys }, hit) => {
    if ((k.v.shield ?? 0) <= 0 || (k.v.shieldHp ?? 0) <= 0 || hit.dot) return hit;
    const raw = hit.damage + hit.charge;
    const soak = raw * C.shieldAbsorb;
    k.v.shieldHp = k.v.shieldHp! - soak;
    if (k.v.shieldHp <= 0) {
      k.v.shield = 0;
      k.v.shieldHp = 0;
      e.stunT = C.shieldStun; // 쉴드가 깨지면 잠깐 기절
      sys.fx(e.x, e.y, 0, BFX_ICEBREAK);
    }
    return { ...hit, damage: hit.damage * (1 - C.shieldAbsorb), charge: hit.charge * (1 - C.shieldAbsorb) };
  },
  flags: ({ k }) => ((k.v.shield ?? 0) > 0 && (k.v.shieldHp ?? 0) > 0 ? EF_BUBBLE : 0),
};

void ENEMY_STATS;
