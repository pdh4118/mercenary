/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHER, CAVALRY, REVIVE_HOLD, SPEAR, TICK_RATE, TUNE, reviveCost } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const setup = (t: { after: (fn: () => void) => void }) => {
  TUNE.REVIVE_PAY = 1;
  t.after(() => {
    TUNE.REVIVE_PAY = 0;
  });
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  return { g, a, p };
};
test("금화 부활: 쓰러진 용병은 시간이 지나도 저절로 일어나지 않는다", (t) => {
  const { g, a } = setup(t);
  const id = g.addMerc(a, SPEAR, 0, 0)!;
  const m = (g as any).mercs.get(id);
  (g as any).hurtMerc(m, 1e9);
  assert.equal(m.respawn, REVIVE_HOLD);
  run(g, 200);
  assert.ok(m.respawn > 0, "시간이 지나도 부활하지 않아야 한다");
});

test("금화 부활: 금화를 내면 일어나고, 모자라면 일어나지 않는다. 비용은 병종·단계·레벨로 정해진다", (t) => {
  const { g, a, p } = setup(t);
  const id = g.addMerc(a, CAVALRY, 0, 0)!;
  const m = (g as any).mercs.get(id);
  (g as any).hurtMerc(m, 1e9);
  const cost = reviveCost(CAVALRY, m.tier, m.xp);
  assert.ok(cost > 0);
  p.x = p.y = 0;
  (g as any).slots.get(a).state.gold = cost - 1;
  assert.equal(g.revive(a, id).ok, false);
  assert.ok(m.respawn > 0);
  (g as any).slots.get(a).state.gold = cost + 5;
  assert.equal(g.revive(a, id).ok, true);
  assert.equal((g as any).slots.get(a).state.gold, 5);
  assert.equal(m.respawn, 0);
  assert.ok(m.hp > 0);
  assert.equal(g.revive(a, id).ok, false, "살아 있는 용병은 부활시킬 수 없다");
  assert.ok(reviveCost(ARCHER, 3, 1e6) > reviveCost(ARCHER, 0, 0), "높은 단계·레벨일수록 비싸다");
});

test("금화 부활: REVIVE_PAY가 0이면 옛 방식(시간이 지나면 자동 부활)", () => {
  TUNE.REVIVE_PAY = 0;
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  (g.getPlayer(a) as any).invuln = 1e9;
  const id = g.addMerc(a, SPEAR, 0, 0)!;
  const m = (g as any).mercs.get(id);
  (g as any).hurtMerc(m, 1e9);
  assert.ok(m.respawn > 0 && m.respawn < REVIVE_HOLD);
  run(g, 120);
  assert.equal(m.respawn, 0);
});

test("용병 이동 속도: 속도 카드와 일제 질주가 겹쳐도 상한(MERC_SPEED_CAP)을 넘지 않는다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const id = g.addMerc(a, CAVALRY, 0, 0)!;
  const m = (g as any).mercs.get(id);
  const slot = (g as any).slots.get(a);
  const base = (g as any).mercStats(m).speed;
  slot.mods.type[CAVALRY].speed = 3; // 속도 카드를 잔뜩 쌓은 상태
  m.dashT = 3; // 일제 질주 중
  const fast = (g as any).mercStats(m).speed;
  assert.ok(fast <= base * TUNE.MERC_SPEED_CAP * 1.0001 + 1e-6, `${Math.round(fast)} > ${Math.round(base * TUNE.MERC_SPEED_CAP)}`);
  assert.ok(fast > base, "그래도 빨라지긴 한다");
});

import { extraArrowDamage } from "@mercenary/shared";
test("발사 수: 화살이 많아질수록 한 발이 약해지지만 총 피해는 계속 는다", () => {
  const total = (n: number) => 1 + (n - 1) * extraArrowDamage(n);
  assert.equal(extraArrowDamage(1), 1);
  assert.equal(extraArrowDamage(2), TUNE.MULTISHOT_DAMAGE);
  for (let n = 3; n <= 12; n++) {
    assert.ok(extraArrowDamage(n) < extraArrowDamage(n - 1), `${n}발: 한 발이 약해져야 한다`);
    assert.ok(total(n) > total(n - 1), `${n}발: 총 피해는 늘어야 한다(메리트가 남는다)`);
  }
});
