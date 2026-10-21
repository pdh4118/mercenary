import { test } from "node:test";
import assert from "node:assert/strict";
import { TICK_RATE } from "@mercenary/shared";
import { Game } from "../src/game.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const boss = (g: Game): any => [...(g as any).enemies.values()].find((e: any) => e.boss);
const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) {
    g.step();
    for (const sl of (g as any).slots.values()) sl.state.invuln = 1e6;
  }
};

test("보스 연습: 고른 스테이지의 보스전이 곧바로 열리고, 장군을 잡으면 잠시 뒤 다음 보스가 나온다", () => {
  const g = new Game();
  g.addPlayer("a");
  g.startRush(3);
  g.step();
  assert.equal((g as any).stage, 3);
  assert.equal((g as any).phase, "boss");
  const b = boss(g);
  assert.ok(b, "장군이 있다");
  b.hp = 1;
  (g as any).damageEnemy(b, { damage: 999, charge: 0, srcType: 0, fromAngle: 0, crit: false }, 1);
  run(g, 5);
  assert.equal((g as any).stage, 4, "다음 스테이지");
  assert.equal((g as any).phase, "boss");
  assert.ok(boss(g), "새 장군");
  assert.equal(g.status, "playing");
});

test("보스 연습: 모두 쓰러지면 게임오버 없이 같은 보스를 처음부터 다시 연다", () => {
  const g = new Game();
  const id = g.addPlayer("a")!;
  g.startRush(2);
  g.step();
  const first = boss(g).id;
  const s = (g as any).slots.get(id);
  s.state.down = true;
  s.state.hp = 0;
  g.step();
  assert.equal(g.status, "playing");
  assert.equal((g as any).stage, 2);
  assert.equal((g as any).phase, "boss");
  assert.notEqual(boss(g).id, first, "새 장군");
  assert.equal(s.state.down, false);
});
