import { test } from "node:test";
import assert from "node:assert/strict";
import { DIFFICULTY_REDUCTION, SPEAR, TICK_RATE } from "@mercenary/shared";
import { Game } from "../src/game.js";
import { RoomManager } from "../src/rooms.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};

function lostHp(difficulty: number): number {
  const g = new Game(() => 0.99); // 회피가 나지 않게
  g.autoSpawn = false;
  g.difficulty = difficulty;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.hp = p.maxHp = 100000;
  for (let i = 0; i < 4; i++) g.spawnEnemyAt(p.x + 30 + i * 8, p.y, 1);
  run(g, 12);
  return p.maxHp - p.hp;
}

test("난이도: 받는 피해가 감소율만큼 줄어든다", () => {
  const base = lostHp(3);
  assert.ok(base > 40, "기준 피해가 있어야 한다");
  DIFFICULTY_REDUCTION.forEach((r, i) => {
    const lost = lostHp(i);
    assert.ok(Math.abs(lost - base * (1 - r)) <= base * 0.25, `난이도 ${i}: ${lost} vs ${base * (1 - r)}`);
  });
});

test("난이도: 방장만 대기실에서 바꿀 수 있고 방 정보로 알려 준다", () => {
  const sent: { t: string; difficulty?: number }[][] = [[], []];
  const mk = (i: number) => ({ send: (m: { t: string; difficulty?: number }) => sent[i]!.push(m), close() {} }) as never;
  const rm = new RoomManager();
  const host = mk(0);
  const guest = mk(1);
  rm.handle(host, { t: "create", name: "h" });
  const code = rm.roomOf(host)!.code;
  rm.handle(guest, { t: "join", name: "g", code });
  rm.handle(guest, { t: "difficulty", v: 0 });
  assert.equal(rm.roomOf(host)!.game.difficulty, 3, "방장이 아니면 무시");
  rm.handle(host, { t: "difficulty", v: 1 });
  assert.equal(rm.roomOf(host)!.game.difficulty, 1);
  rm.handle(host, { t: "difficulty", v: 9 });
  assert.equal(rm.roomOf(host)!.game.difficulty, 1, "범위 밖은 무시");
  const last = sent[1]!.filter((m) => m.t === "room").pop()!;
  assert.equal(last.difficulty, 1);
});

test("용병은 한 자리에 뭉쳐 쌓이지 않는다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const ids: number[] = [];
  for (let i = 0; i < 14; i++) ids.push(g.addMerc(a, SPEAR, p.x, p.y));
  run(g, 6);
  let minD = Infinity;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const m = g.getMerc(ids[i]!)!;
      const o = g.getMerc(ids[j]!)!;
      minD = Math.min(minD, Math.hypot(m.x - o.x, m.y - o.y));
    }
  assert.ok(minD > 18, `가장 가까운 두 용병 간격 ${minD.toFixed(1)}`);
});
