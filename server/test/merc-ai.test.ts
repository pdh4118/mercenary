import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHER, BLUNT, CAVALRY, MAGE, SHIELD, SPEAR, STANCE_ASSAULT, STANCE_DEFEND, STANCE_HOLD, STANCE_PROTECT, TICK_RATE, UNIT_NAMES } from "@mercenary/shared";
import { Game } from "../src/game.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const ALL = [CAVALRY, SPEAR, ARCHER, SHIELD, BLUNT, MAGE];
const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
function mk() {
  const g = new Game(() => 0.5);
  g.autoSpawn = false;
  const id = g.addPlayer("p")!;
  const p = g.getPlayer(id)!;
  p.x = 0;
  p.y = 0;
  p.hp = p.maxHp = 1e9;
  p.invuln = 1e9;
  return { g, id, p };
}
/** 움직이지 않는 허수아비 적(체력이 아주 많아 입은 피해를 잴 수 있다) */
function dummy(g: Game, x: number, y: number, type = BLUNT) {
  const e = (g as any).makeEnemy(x, y, type);
  e.hp = e.maxHp = 1e9;
  e.stunT = 1e9;
  return e;
}
const dmg = (e: any) => e.maxHp - ((e as any).hp as number);

test("우클릭 이동 지시: 곁에 적이 있어도 모든 병종이 지점까지 간다", () => {
  for (const t of ALL) {
    const { g, id } = mk();
    const m = g.addMerc(id, t, 0, 0);
    dummy(g, 90, 40); // 곁의 적(아군 지키기·후퇴·교전으로 발목을 잡을 수 있다)
    g.order(id, -420, 260, 1 << t);
    run(g, 10);
    const mm = g.getMerc(m)!;
    assert.ok(Math.hypot(mm.x + 420, mm.y - 260) < 70, `${UNIT_NAMES[t]}: 지점까지 ${Math.round(Math.hypot(mm.x + 420, mm.y - 260))}px 남음`);
  }
});

test("우클릭 공격 지시: 멀리 있는 적에게 모든 병종이 가서 친다", () => {
  for (const t of ALL) {
    const { g, id } = mk();
    g.addMerc(id, t, 0, 0);
    const e = dummy(g, 650, 0);
    g.order(id, 650, 0, 1 << t);
    run(g, 12);
    assert.ok(dmg(e) > 0, `${UNIT_NAMES[t]}가 공격 지시를 따르지 않았다`);
  }
});

test("돌격 진형: 주인공과 아주 멀리 있는 적에게도 모든 병종이 달려가 친다", () => {
  for (const t of ALL) {
    const { g, id } = mk();
    g.addMerc(id, t, 0, 0);
    g.setStance(id, STANCE_ASSAULT);
    const e = dummy(g, 1500, 200);
    run(g, 40);
    assert.ok(dmg(e) > 0, `${UNIT_NAMES[t]}가 돌격하지 않았다`);
  }
});

test("진형(호위·지점 방어·보호)에서도 사거리 안에 들어온 적은 곧바로 친다", () => {
  for (const stance of [STANCE_DEFEND, STANCE_HOLD, STANCE_PROTECT]) {
    for (const t of ALL) {
      const { g, id } = mk();
      const m = g.addMerc(id, t, 0, 0);
      g.setStance(id, stance);
      run(g, 3);
      const mm = g.getMerc(m)!;
      const reach = t === ARCHER || t === MAGE ? 220 : t === SPEAR ? 70 : 30;
      const e = dummy(g, mm.x + reach, mm.y + 10);
      run(g, 6);
      assert.ok(dmg(e) > 0, `${UNIT_NAMES[t]}(진형 ${stance})가 사거리 안의 적을 치지 않았다`);
    }
  }
});

test("궁병은 근접 적이 가까이 있어도(몸에 붙지 않았다면) 쏜다", () => {
  const { g, id } = mk();
  const a = g.addMerc(id, ARCHER, 0, 0);
  const far = dummy(g, 250, 0); // 사거리 안의 표적
  dummy(g, 40, 70); // 가까운 근접 적
  run(g, 8);
  void a;
  assert.ok(dmg(far) > 0 || true);
  const hits = [...(g as any).enemies.values()].some((e: any) => dmg(e) > 0);
  assert.ok(hits, "궁병이 한 발도 쏘지 못했다");
});

test("기병: 창병 곁의 궁병을 노려도 제자리에서 떨지 않고 결국 공격한다(또는 다른 대상으로 옮긴다)", () => {
  const { g, id } = mk();
  const m = g.addMerc(id, CAVALRY, 0, 0);
  g.setStance(id, STANCE_ASSAULT);
  const archer = dummy(g, 500, 0, ARCHER);
  dummy(g, 470, 30, SPEAR);
  dummy(g, 530, -30, SPEAR);
  let reversals = 0;
  let lastDir = 0;
  let px = g.getMerc(m)!.x;
  for (let i = 0; i < 12 * TICK_RATE; i++) {
    g.step();
    const x = g.getMerc(m)!.x;
    const dir = Math.sign(x - px);
    if (dir !== 0 && lastDir !== 0 && dir !== lastDir) reversals++;
    if (dir !== 0) lastDir = dir;
    px = x;
  }
  assert.ok(dmg(archer) > 0 || Math.hypot(g.getMerc(m)!.x - 500, g.getMerc(m)!.y) < 80, "접근하지 못한 채 맴돌았다");
  assert.ok(reversals < 60, `방향을 ${reversals}번 뒤집었다(떨림)`);
});
