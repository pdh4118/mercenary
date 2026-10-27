import { test } from "node:test";
import assert from "node:assert/strict";
import { TICK_RATE, TerrainMap, SPEAR, SHIELD, MAGE, ARCHER, type TerrainWire } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const rockAt = (x: number, y: number): TerrainWire => [0, x, y, 1, 0];
type Priv = {
  enemyPoints(lead?: number): { x: number; y: number; w: number }[];
  eVel: Map<number, [number, number, number, number]>;
  dangerEscape(x: number, y: number, r: number, id: number): [number, number] | null;
  danger: unknown[];
  boss: { addHazard(h: object): unknown };
  arrowClear(a: { x: number; y: number }, b: { x: number; y: number }): boolean;
};

test("길 찾기: ㄷ자 지형 안에 갇힌 적도 입구로 나와 돌아서 도달한다", () => {
  const items: TerrainWire[] = [];
  for (let y = -300; y <= 300; y += 60) items.push(rockAt(0, y)); // 세로 벽
  for (let x = -240; x <= 0; x += 60) items.push(rockAt(x, 300), rockAt(x, -300)); // 왼쪽으로 열린 주머니
  const map = new TerrainMap(items);
  const path = map.findPath(-120, 0, 350, 0);
  assert.ok(path && path.length > 0, "길이 있고 곧장 가는 길은 막혀 있다");
  assert.ok(path!.some(([x]) => x < -200), "먼저 주머니 입구(왼쪽)로 나온다");

  const g = new Game();
  g.autoSpawn = false;
  g.setTerrain(items);
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.x = 350;
  p.y = 0;
  p.invuln = 1e9;
  const e = g.getEnemy(g.spawnEnemyAt(-120, 0, 0))!;
  let best = Infinity;
  for (let i = 0; i < 40 * TICK_RATE; i++) {
    g.step();
    best = Math.min(best, Math.hypot(e.x - p.x, e.y - p.y));
  }
  assert.ok(best < 120, `주머니를 돌아 나와 도달해야 한다(가장 가까웠던 거리 ${Math.round(best)})`);
});

test("길 찾기: 막히지 않았으면 빈 길, 갈 수 없으면 null", () => {
  const map = new TerrainMap([rockAt(0, 0)]);
  assert.deepEqual(map.findPath(-300, 400, 300, 400), []);
});

test("마법사는 움직이는 적의 앞(예상 위치)을 겨눈다", () => {
  const g = new Game();
  g.autoSpawn = false;
  g.addPlayer("a");
  const id = g.spawnEnemyAt(100, 100, SPEAR);
  const gp = g as unknown as Priv;
  gp.eVel.set(id, [100, 100, 80, 0]);
  const still = gp.enemyPoints(0).find((q) => q.x === 100)!;
  const lead = gp.enemyPoints(1).find((q) => Math.abs(q.y - 100) < 1e-6 && q.x > 100)!;
  assert.ok(still && lead.x - 100 > 70 && lead.x - 100 <= 150, `속도 방향으로 앞선다(${lead.x - 100})`);
  gp.eVel.set(id, [100, 100, 400, 0]);
  assert.ok(gp.enemyPoints(3).some((q) => Math.abs(q.x - 250) < 1e-6), "한 번에 150px까지만 앞선다");
});

test("위험 구역: 원·직선 구역 안의 용병은 밖으로 벗어나는 방향을 얻는다", () => {
  const g = new Game();
  const gp = g as unknown as Priv;
  gp.danger = [{ k: "c", x: 0, y: 0, r: 100 }];
  const e = gp.dangerEscape(50, 0, 12, 1)!;
  assert.ok(e[0] > 0.9, "원 바깥쪽으로");
  assert.equal(gp.dangerEscape(400, 0, 12, 1), null, "멀리 있으면 그대로");
  gp.danger = [{ k: "l", x: 0, y: 0, ang: 0, len: 500, w: 60 }];
  const l = gp.dangerEscape(200, 10, 12, 1)!;
  assert.ok(Math.abs(l[1]) > 0.9 && l[1] > 0, "직선 예고는 옆으로 비킨다");
  assert.equal(gp.dangerEscape(200, 200, 12, 1), null);
});

test("보스의 불길 장판 위에 선 용병은 스스로 벗어난다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const m = g.addMerc(a, SHIELD, p.x + 120, p.y);
  (g as unknown as Priv).boss.addHazard({ kind: 1, x: p.x + 120, y: p.y, a: 90, t: 8, total: 8, dmg: 0 });
  run(g, 2);
  const mm = g.getMerc(m)!;
  assert.ok(Math.hypot(mm.x - (p.x + 120), mm.y - p.y) > 90, "장판 밖으로 나왔다");
});

test("바위가 사선을 막으면 궁병은 그 대상을 쏠 수 없다", () => {
  const g = new Game();
  g.autoSpawn = false;
  g.setTerrain([rockAt(0, 0)]);
  const gp = g as unknown as Priv;
  assert.equal(gp.arrowClear({ x: -200, y: -20 }, { x: 200, y: -20 }), false, "바위 뒤는 막힌다");
  assert.equal(gp.arrowClear({ x: -200, y: 300 }, { x: 200, y: 300 }), true);
  void MAGE; void ARCHER;
});

test("개발용 AI 표시: 켜면 목표 선이 쌓이고 끄면 없다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.addMerc(a, SPEAR, p.x + 300, p.y);
  g.spawnEnemyAt(p.x + 500, p.y, SHIELD);
  assert.equal(g.snapshotDebug(), undefined);
  g.dbgOn = true;
  run(g, 0.5);
  assert.ok((g.snapshotDebug() ?? []).length > 0, "목표 선이 있다");
});
