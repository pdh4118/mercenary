/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHER, CAVALRY, SPEAR, TICK_RATE } from "@mercenary/shared";
import { Game } from "../src/game.js";

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
const dist = (m: any, x: number, y: number) => Math.hypot(m.x - x, m.y - y);

test("연속 명령(Alt): 이동 지시를 줄 세우면 첫 지점에 도착한 뒤 다음 지점으로 간다", () => {
  const { g, id } = mk();
  const m = g.addMerc(id, SPEAR, 0, 0);
  g.order(id, 300, 0, 1 << SPEAR, "move");
  g.order(id, 300, 400, 1 << SPEAR, "move", true);
  g.order(id, -200, 400, 1 << SPEAR, "move", true);
  const mm = g.getMerc(m)! as any;
  run(g, 0.8);
  assert.ok(mm.y < 60 && mm.x > 60, `먼저 첫 지점 쪽으로 가야 한다(${Math.round(mm.x)}, ${Math.round(mm.y)})`);
  run(g, 12);
  assert.ok(dist(mm, -200, 400) < 110, `마지막 지점까지 도착해야 한다(${Math.round(mm.x)}, ${Math.round(mm.y)})`);
});

test("연속 명령이 아니면 새 지시가 이전 지시와 줄을 대체한다", () => {
  const { g, id } = mk();
  const m = g.addMerc(id, SPEAR, 0, 0);
  g.order(id, 300, 0, 1 << SPEAR, "move");
  g.order(id, 300, 400, 1 << SPEAR, "move", true);
  g.order(id, -300, -200, 1 << SPEAR, "move"); // Alt 없이: 줄을 비우고 바로 이 지시를 따른다
  run(g, 8);
  assert.ok(dist(g.getMerc(m)! as any, -300, -200) < 110);
  assert.equal(((g as any).slots.get(id).queue[SPEAR] as unknown[]).length, 0);
});

test("연속 명령: 지시가 없는 병종은 바로 실행하고, 있는 병종만 줄에 붙인다", () => {
  const { g, id } = mk();
  const a = g.addMerc(id, ARCHER, 0, 0);
  g.addMerc(id, SPEAR, 0, 0);
  g.order(id, 400, 0, 1 << SPEAR, "move"); // 창병만 진행 중
  g.order(id, 0, 400, (1 << SPEAR) | (1 << ARCHER), "move", true);
  run(g, 8);
  assert.ok(dist(g.getMerc(a)! as any, 0, 400) < 110, "궁병은 바로 두 번째 지점으로 간다");
  assert.equal(((g as any).slots.get(id).queue[SPEAR] as unknown[]).length, 0, "창병은 첫 지점 도착 뒤 줄이 풀렸다");
});

test("연속 명령: 지점 방어도 줄 끝에 붙는다(이동한 뒤 그 자리를 지킨다)", () => {
  const { g, id } = mk();
  const m = g.addMerc(id, SPEAR, 0, 0);
  g.order(id, 300, 0, 1 << SPEAR, "move");
  g.setHold(id, 300, 300, 1 << SPEAR, true);
  run(g, 14);
  const mm = g.getMerc(m)! as any;
  assert.equal((g as any).slots.get(id).stances[SPEAR], 2 /* STANCE_HOLD */);
  assert.ok(dist(mm, 300, 300) < 260, `지점 방어 지점 근처에 있어야 한다(${Math.round(mm.x)}, ${Math.round(mm.y)})`);
});

test("연속 명령: 기병도 이동 줄을 따른다", () => {
  const { g, id } = mk();
  const m = g.addMerc(id, CAVALRY, 0, 0);
  g.order(id, 400, 0, 1 << CAVALRY, "move");
  g.order(id, 400, 400, 1 << CAVALRY, "move", true);
  run(g, 10);
  assert.ok(dist(g.getMerc(m)! as any, 400, 400) < 130);
});
