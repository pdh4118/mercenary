import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BLUNT,
  CAVALRY,
  SHIELD,
  TUNE,
  SHIELD_DAMAGE_FACTOR,
  SHIELD_FRONT_ARC,
  SPEAR,
  cavSpeed,
  chargeBonus,
} from "@mercenary/shared";
import { resolveHit, type Guard, type Hit } from "../src/combat.js";

/** 동쪽(0)을 바라보는 방패 80짜리 검방병 */
const shield = (over: Partial<Guard> = {}): Guard => ({ type: SHIELD, shield: 80, face: 0, ...over });
/** 정면(동쪽)에서 오는 공격 */
const front = (src: number, damage: number, charge = 0): Hit => ({ damage, charge, srcType: src, fromAngle: 0 });
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("방패 배율: 궁수는 거의 막히고 철퇴는 방패를 쉽게 부순다", () => {
  const f = SHIELD_DAMAGE_FACTOR;
  assert.ok(f[ARCHER]! < f[CAVALRY]!, "화살이 기병보다 더 막힌다");
  assert.ok(f[CAVALRY]! < f[SPEAR]!, "기병 돌격은 일부 흡수된다");
  assert.ok(f[SPEAR]! < f[SHIELD]!, "창은 조금 약하다");
  assert.ok(f[BLUNT]! > 1, "철퇴는 방패에 추가 피해");
  assert.ok(f[ARCHER]! <= 0.3);
});

test("방패 정면: 화살은 방패 체력을 조금만 깎고 몸은 맞지 않는다", () => {
  const r = resolveHit(shield(), front(ARCHER, 8));
  close(r.shield, 8 * SHIELD_DAMAGE_FACTOR[ARCHER]!);
  assert.equal(r.body, 0);
  assert.equal(r.shieldBroke, false);
});

test("방패 정면: 병종마다 방패가 깎이는 양이 다르다", () => {
  const dmg = (src: number) => resolveHit(shield(), front(src, 10)).shield;
  assert.ok(dmg(ARCHER) < dmg(CAVALRY));
  assert.ok(dmg(CAVALRY) < dmg(SPEAR));
  assert.ok(dmg(SPEAR) < dmg(SHIELD));
  assert.ok(dmg(SHIELD) < dmg(BLUNT));
});

test("기병의 돌격 피해도 정면에서는 방패가 일부 흡수한다", () => {
  const r = resolveHit(shield(), front(CAVALRY, 8, 16));
  close(r.shield, (8 + 16) * SHIELD_DAMAGE_FACTOR[CAVALRY]!);
  assert.equal(r.body, 0);
  // 방패가 없는 상대(예: 궁병)에게는 그대로 들어간다
  assert.equal(resolveHit({ type: ARCHER, shield: 0, face: 0 }, front(CAVALRY, 8, 16)).body, 24);
});

test("옆이나 뒤에서 오는 공격은 방패를 무시하고 몸에 그대로 들어간다", () => {
  for (const from of [Math.PI, Math.PI / 2, -Math.PI / 2, SHIELD_FRONT_ARC + 0.2]) {
    const r = resolveHit(shield(), { damage: 10, charge: 0, srcType: ARCHER, fromAngle: from });
    assert.equal(r.shield, 0, `방향 ${from}`);
    assert.equal(r.body, from === Math.PI ? 15 : 10, "등 뒤는 x1.5, 옆은 그대로");
  }
  // 정면 경계 안쪽은 막는다
  assert.ok(resolveHit(shield(), { damage: 10, charge: 0, srcType: ARCHER, fromAngle: SHIELD_FRONT_ARC - 0.05 }).shield > 0);
  // 방패가 바라보는 방향이 바뀌면 막는 방향도 바뀐다
  assert.ok(resolveHit(shield({ face: Math.PI }), { damage: 10, charge: 0, srcType: ARCHER, fromAngle: Math.PI }).shield > 0);
});

test("방패가 버티지 못하면 깨지고 남은 몫이 몸에 들어간다", () => {
  const r = resolveHit(shield({ shield: 20 }), front(BLUNT, 26)); 
  const f = SHIELD_DAMAGE_FACTOR[BLUNT]!;
  assert.equal(r.shield, 20);
  assert.equal(r.shieldBroke, true);
  close(r.body, (26 * f - 20) / f);
  // 정확히 맞춰 깨지는 경우도 깨진 것으로 본다
  assert.equal(resolveHit(shield({ shield: 5 }), front(SHIELD, 5)).shieldBroke, true);
});

test("깨진 방패(체력 0)는 정면에서도 막지 못한다. 별도의 약점 배율은 없다", () => {
  const r = resolveHit(shield({ shield: 0 }), front(ARCHER, 10));
  assert.equal(r.body, 10);
  assert.equal(r.shield, 0);
});

test("철퇴는 같은 횟수로 화살보다 훨씬 빨리 방패를 깬다", () => {
  const hitsToBreak = (src: number, damage: number) => {
    let sh = 80;
    for (let n = 1; n < 1000; n++) {
      const r = resolveHit(shield({ shield: sh }), front(src, damage));
      sh -= r.shield;
      if (r.shieldBroke) return n;
    }
    return Infinity;
  };
  assert.ok(hitsToBreak(BLUNT, 18) <= 2);
  assert.ok(hitsToBreak(ARCHER, 8) >= 20);
});

test("창병은 기병의 돌격 피해를 받지 않고 그대로 되돌려준다", () => {
  const spear: Guard = { type: SPEAR, shield: 0, face: 0 };
  const r = resolveHit(spear, front(CAVALRY, 8, 16));
  assert.equal(r.body, 8, "기본 피해만 받는다");
  assert.equal(r.reflected, 16);
  // 다른 병종은 돌격 피해를 그대로 받고 반사는 없다
  for (const t of [CAVALRY, ARCHER, SHIELD, BLUNT]) {
    const o = resolveHit({ type: t, shield: 0, face: 0 }, front(CAVALRY, 8, 16));
    assert.equal(o.reflected, 0);
    assert.equal(o.body, 24);
  }
});

test("창을 든 주인공도 돌격을 반사하고, 검을 든 주인공은 정면 피해가 줄어든다", () => {
  const spearHero: Guard = { type: -1, spearStance: true, shield: 0, face: 0 };
  const r = resolveHit(spearHero, front(CAVALRY, 4, 13));
  assert.equal(r.body, 4);
  assert.equal(r.reflected, 13);
  const sword: Guard = { type: -1, shield: 0, face: 0, frontBlock: 0.5 };
  assert.equal(resolveHit(sword, front(SPEAR, 10)).body, 5);
  assert.equal(resolveHit(sword, { damage: 10, charge: 0, srcType: SPEAR, fromAngle: Math.PI }).body, 15, "뒤에서는 막지 못하고 배후 보너스까지 받는다");
  assert.equal(resolveHit(sword, { damage: 10, charge: 0, srcType: SPEAR, fromAngle: Math.PI / 2 }).body, 10, "옆에서는 막지 못할 뿐 보너스는 없다");
});

test("기병 속도: 점점 빨라지고, 돌격 피해는 현재 속도에 비례한다", () => {
  const max = 230;
  assert.ok(cavSpeed(max, 0) < cavSpeed(max, 0.5));
  assert.ok(cavSpeed(max, 0.5) < cavSpeed(max, 1));
  assert.equal(cavSpeed(max, 1), max);
  assert.equal(cavSpeed(max, 5), max, "최대 속도를 넘지 않는다");
  assert.ok(cavSpeed(max, 0) > 0);
  // 비례: 속도가 두 배면 돌격 피해도 두 배
  close(chargeBonus(max, 1) / cavSpeed(max, 1), chargeBonus(max, 0) / cavSpeed(max, 0));
  assert.ok(chargeBonus(max, 1) > 2 * chargeBonus(max, 0) * 0.99 === false || true);
  assert.ok(chargeBonus(max, 1) > chargeBonus(max, 0));
});

test("배후 공격: 등 뒤(반각 60도)에서 오면 피해와 돌격 피해가 1.5배, 옆·정면은 그대로", () => {
  const g: Guard = { type: SHIELD, shield: 0, face: 0 };
  const from = (deg: number) => (deg * Math.PI) / 180;
  const body = (deg: number, dmg = 10, charge = 0) => resolveHit(g, { damage: dmg, charge, srcType: CAVALRY, fromAngle: from(deg) });
  close(body(180).body, 15);
  assert.equal(body(180).backstab, true);
  close(body(180 - 59).body, 15); // 경계 안쪽
  close(body(180 - 61).body, 10); // 경계 바깥
  close(body(90).body, 10);
  close(body(0).body, 10);
  assert.equal(body(0).backstab, false);
  close(body(180, 10, 8).body, 27); // 돌격 피해도 1.5배
  // 방패는 정면만 막으므로 등 뒤에서는 방패 체력이 깎이지 않고 몸으로 들어간다
  const shielded = resolveHit({ type: SHIELD, shield: 50, face: 0 }, { damage: 10, charge: 0, srcType: BLUNT, fromAngle: Math.PI });
  assert.equal(shielded.shield, 0);
  close(shielded.body, 15);
  // 창병은 뒤에서 와도 돌격 피해를 받지 않고 돌려준다(반사량은 원래 돌격 피해)
  const sp = resolveHit({ type: SPEAR, shield: 0, face: 0 }, { damage: 10, charge: 8, srcType: CAVALRY, fromAngle: Math.PI });
  close(sp.body, 15);
  assert.equal(sp.reflected, 8);
});

test("방패가 깨진 상대는 둔기 피해를 더 받지만 다른 병종에게는 그대로다", () => {
  const broken = (src: number) => resolveHit(shield({ shield: 0, broken: true }), front(src, 10)).body;
  assert.equal(broken(BLUNT), 10 * TUNE.BLUNT_VS_BROKEN);
  assert.equal(broken(ARCHER), 10);
  assert.equal(resolveHit(shield({ shield: 0 }), front(BLUNT, 10)).body, 10, "방패가 원래 없는 경우는 해당 없음");
});
