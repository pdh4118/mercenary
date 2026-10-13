import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PLAYERS, PLAYER_SPEED, TICK_RATE, WORLD_SIZE } from "@mercenary/shared";
import { Game } from "../src/game.js";

test("6명 이상 입장 가능하고 정원이 차면 거절한다", () => {
  const g = new Game();
  for (let i = 0; i < MAX_PLAYERS; i++) assert.notEqual(g.addPlayer(`p${i}`), null);
  assert.equal(g.addPlayer("overflow"), null);
});

test("입력대로 이동하고 대각선도 같은 속도다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  const a0 = g.snapshot().find((p) => p.id === a)!;
  const b0 = g.snapshot().find((p) => p.id === b)!;
  g.setInput(a, 1, 0);
  g.setInput(b, 1, 1);
  for (let i = 0; i < TICK_RATE; i++) g.step(); // 1초
  const a1 = g.snapshot().find((p) => p.id === a)!;
  const b1 = g.snapshot().find((p) => p.id === b)!;
  assert.ok(Math.abs(a1.x - a0.x - PLAYER_SPEED) < 1e-6);
  assert.ok(Math.abs(Math.hypot(b1.x - b0.x, b1.y - b0.y) - PLAYER_SPEED) < 1e-6);
});

test("조작된 입력(범위 초과·NaN)은 무시·보정된다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  const a0 = g.snapshot()[0]!;
  g.setInput(a, 999, Number.NaN);
  for (let i = 0; i < TICK_RATE; i++) g.step();
  const a1 = g.snapshot()[0]!;
  assert.ok(a1.x - a0.x <= PLAYER_SPEED + 1e-6);
  assert.equal(a1.y, a0.y);
});

test("월드 밖으로 나가지 못한다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  g.setInput(a, 1, 0);
  for (let i = 0; i < TICK_RATE * 60; i++) g.step();
  assert.ok(g.snapshot()[0]!.x <= WORLD_SIZE / 2);
});
