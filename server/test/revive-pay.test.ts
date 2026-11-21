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
