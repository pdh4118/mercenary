import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEAR, TENT, TICK_RATE, ST_BIT_REST } from "@mercenary/shared";
import { Game } from "../src/game.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
function setup() {
  const g = new Game();
  g.autoSpawn = false;
  const id = g.addPlayer("p")!;
  const p = g.getPlayer(id)!;
  p.x = 0;
  p.y = 0;
  const tid = g.spawnTentAt(40, 0, 0);
  const merc = g.addMerc(id, SPEAR, 60, 60);
  return { g, p, id, tid, merc };
}

test("텐트 곁에서 스페이스를 누르면 주인공과 용병이 들어가고, 다시 누르면 나온다", () => {
  const { g, p, id, merc } = setup();
  assert.equal(g.useSkill(id), true);
  assert.equal(p.rest, true);
  assert.equal(g.snapshotTents()![0]![5], 1);
  assert.ok((g.snapshotMercs().find((m) => m[0] === merc)![19]! & ST_BIT_REST) !== 0);
  assert.equal(g.useSkill(id), true, "쿨타임과 무관하게 나온다");
  assert.equal(p.rest, false);
  assert.equal(g.snapshotTents()![0]![5], 0);
});

test("멀리 있으면 들어가지 못한다(평소 스킬이 나간다)", () => {
  const { g, p, id } = setup();
  p.x = 1000;
  g.useSkill(id);
  assert.notEqual(p.rest, true);
});

test("쉬는 동안 체력이 차고, 적은 아무도 없는 것처럼 찾아오지도 공격하지도 않는다", () => {
  const { g, p, id } = setup();
  p.hp = 10;
  g.useSkill(id);
  const e = (g as any).makeEnemy(100, 0, SPEAR);
  e.hp = e.maxHp = 1e6;
  const x0 = e.x;
  run(g, 3);
  assert.ok(p.hp > 10 + p.maxHp * TENT.healPerSec * 2, `체력 ${p.hp}`);
  assert.ok(Math.abs(e.x - x0) < 5, "적이 다가오지도 떨지도 않는다");
  assert.ok(p.hp <= p.maxHp);
});

test("텐트가 사라지면 안에 있던 사람은 밖으로 나온다", () => {
  const { g, p, id } = setup();
  g.useSkill(id);
  run(g, TENT.lifeSec + 1);
  assert.equal(p.rest, false);
  assert.equal(g.snapshotTents(), undefined);
});

test("쉬는 동안 쓰러진 용병은 더 빨리 일어난다", () => {
  const { g, id, merc } = setup();
  const m = (g as any).mercs.get(merc);
  m.respawn = 10;
  g.useSkill(id);
  run(g, 3);
  assert.ok(m.respawn <= 10 - 3 * TENT.respawnBoost + 0.2, `${m.respawn}`);
});

test("텐트는 한 번에 하나만 생긴다", () => {
  assert.equal(TENT.max, 1);
});
