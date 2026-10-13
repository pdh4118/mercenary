import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENEMY_CONTACT_DAMAGE,
  ENEMY_MAX,
  ENEMY_SPAWN_DISTANCE,
  FIRE_COOLDOWN_SEC,
  MAX_PLAYERS,
  PLAYER_MAX_HP,
  PLAYER_RESPAWN_SEC,
  PLAYER_SPEED,
  TICK_RATE,
  WORLD_SIZE,
} from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const me = (g: Game, id: number) => g.snapshotPlayers().find((p) => p.id === id)!;
/** 적이 없는 테스트용 게임: 스폰을 막기 위해 시간을 쓰지 않고 직접 배치한다. */
const idle = { dx: 0, dy: 0, aim: 0, fire: false };

test("6명 이상 입장 가능하고 정원이 차면 거절한다", () => {
  const g = new Game();
  for (let i = 0; i < MAX_PLAYERS; i++) assert.notEqual(g.addPlayer(`p${i}`), null);
  assert.equal(g.addPlayer("overflow"), null);
});

test("입력대로 이동하고 대각선도 같은 속도다", () => {
  const g = new Game(() => 0.5);
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  const a0 = me(g, a);
  const b0 = me(g, b);
  g.setInput(a, { ...idle, dx: 1 });
  g.setInput(b, { ...idle, dx: 1, dy: 1 });
  run(g, 1);
  assert.ok(Math.abs(me(g, a).x - a0.x - PLAYER_SPEED) < 1e-6);
  const b1 = me(g, b);
  assert.ok(Math.abs(Math.hypot(b1.x - b0.x, b1.y - b0.y) - PLAYER_SPEED) < 1e-6);
});

test("조작된 입력(범위 초과·NaN)은 보정된다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  const a0 = me(g, a);
  g.setInput(a, { dx: 999, dy: Number.NaN, aim: Infinity, fire: "yes" });
  run(g, 1);
  const a1 = me(g, a);
  assert.ok(a1.x - a0.x <= PLAYER_SPEED + 1e-6);
  assert.equal(a1.y, a0.y);
  assert.equal(g.snapshotBullets().length, 0); // fire는 true일 때만 인정
});

test("월드 밖으로 나가지 못한다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  g.setInput(a, { ...idle, dx: 1 });
  run(g, 60);
  assert.ok(me(g, a).x <= WORLD_SIZE / 2);
});

test("적은 플레이어 둘레 화면 밖에서 생성되고 상한을 넘지 않는다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  run(g, 3);
  assert.ok(g.enemyCount > 0);
  const p = me(g, a);
  for (const [, x, y] of g.snapshotEnemies()) {
    assert.ok(Math.hypot(x - p.x, y - p.y) <= ENEMY_SPAWN_DISTANCE + 20);
  }
  run(g, 600);
  assert.ok(g.enemyCount <= ENEMY_MAX);
});

test("발사한 투사체가 적을 맞히고 처치하면 처치 수가 오른다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.spawnEnemyAt(p.x + 200, p.y); // aim=0(오른쪽) 정면
  g.setInput(a, { ...idle, fire: true });
  run(g, 1.5);
  assert.equal(me(g, a).kills >= 1, true);
});

test("연사 속도(쿨다운)가 지켜진다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  g.setInput(a, { ...idle, fire: true });
  run(g, 1);
  const expected = Math.ceil(1 / FIRE_COOLDOWN_SEC);
  assert.ok(g.snapshotBullets().length <= expected);
});

test("적과 닿으면 피해를 입고 쿨다운 동안은 연속 피해가 없다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.spawnEnemyAt(p.x, p.y);
  g.step();
  assert.equal(me(g, a).hp, PLAYER_MAX_HP - ENEMY_CONTACT_DAMAGE);
  g.step();
  assert.equal(me(g, a).hp, PLAYER_MAX_HP - ENEMY_CONTACT_DAMAGE);
});

test("체력이 0이 되면 사망하고 일정 시간 뒤 전체 체력으로 부활한다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  for (let i = 0; i < 400 && me(g, a).respawn === 0; i++) {
    const p = me(g, a);
    g.spawnEnemyAt(p.x, p.y);
    g.step();
  }
  assert.ok(me(g, a).respawn > 0);
  assert.equal(me(g, a).hp, 0);
  run(g, PLAYER_RESPAWN_SEC + 0.2);
  assert.equal(me(g, a).respawn, 0);
  assert.equal(me(g, a).hp, PLAYER_MAX_HP);
});

test("겹친 적들은 서로 밀려나 한 점에 뭉치지 않는다", () => {
  const g = new Game();
  g.addPlayer("a");
  for (let i = 0; i < 5; i++) g.spawnEnemyAt(500, 500);
  run(g, 1);
  const xs = new Set(g.snapshotEnemies().filter(([, x]) => x > 400).map(([, x, y]) => `${x},${y}`));
  assert.ok(xs.size >= 5);
});

test("접속자가 없으면 판이 초기화된다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  run(g, 5);
  assert.ok(g.enemyCount > 0);
  g.removePlayer(a);
  run(g, 1);
  assert.equal(g.enemyCount, 0);
  assert.equal(g.time, 0);
});
