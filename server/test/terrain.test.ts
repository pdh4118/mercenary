import { test } from "node:test";
import assert from "node:assert/strict";
import { TICK_RATE, TUNE, WORLD_SIZE, TerrainMap, generateTerrain, SPRITE_BY_ID, anchorOf, type TerrainWire } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const seeded = (seed: number) => {
  let r = seed;
  return () => (r = (r * 16807) % 2147483647) / 2147483647;
};
const ROCK = 0; // 큰 바위(발밑 원 3개)
const PLATEAU = 30;
const rockAt = (x: number, y: number): TerrainWire => [ROCK, x, y, 1, 0];
const plateauAt = (x: number, y: number): TerrainWire => [PLATEAU, x, y, 3, 0];

test("지형 생성: 판마다 다르고, 시작 지점은 비어 있으며, 고지대·바위·나무가 섞인다", () => {
  const a = generateTerrain(seeded(1), WORLD_SIZE / 2, [[0, 0, 420]]);
  const b = generateTerrain(seeded(2), WORLD_SIZE / 2, [[0, 0, 420]]);
  assert.notDeepEqual(a, b, "판마다 새로운 지형");
  assert.deepEqual(a, generateTerrain(seeded(1), WORLD_SIZE / 2, [[0, 0, 420]]), "같은 시드는 같은 지형");
  const kinds = new Set(a.map((it) => SPRITE_BY_ID.get(it[0])!.kind));
  for (const k of [0, 1, 2, 3]) assert.ok(kinds.has(k), `종류 ${k}`);
  assert.ok(a.filter((it) => SPRITE_BY_ID.get(it[0])!.kind === 3).length >= 5, "고지대 여러 곳");
  const map = new TerrainMap(a);
  assert.equal(map.hitsSolid(0, 0, 30), false);
  assert.equal(map.blocked(0, 0, 30), false, "시작 지점은 평지");
  for (const it of a) {
    const s = SPRITE_BY_ID.get(it[0])!;
    const [ax] = anchorOf(s);
    assert.ok(Math.abs(it[1]) < WORLD_SIZE / 2 && Math.abs(it[2]) < WORLD_SIZE / 2 && ax > 0);
  }
});

test("바위는 통과할 수 없다: 주인공과 용병이 부딪혀 밀려난다", () => {
  const g = new Game();
  g.autoSpawn = false;
  g.setTerrain([rockAt(300, 0)]);
  assert.ok(true);
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.x = 100;
  p.y = -40; // 바위의 발밑 원이 이 높이에 있다
  g.setInput(a, { dx: 1, dy: 0, aim: 0, fire: false });
  run(g, 4);
  assert.ok(p.x < 300 - 20, `바위를 뚫고 지나가면 안 된다: x=${p.x}`);
  assert.ok(p.x > 150, "바위 앞까지는 갔다");
  const map = g.terrain!;
  assert.equal(map.hitsSolid(300, -20, 5), true);
});

test("고지대: 올라가는 길은 크게, 윗면은 조금 느리고 고지대에서는 높음 판정", () => {
  const map = new TerrainMap([plateauAt(0, 0)]);
  assert.equal(map.elevated(0, 0), true);
  assert.equal(map.speedMult(0, 0), TUNE.PLATEAU_TOP_SPEED);
  assert.equal(map.elevated(1500, 0), false);
  assert.equal(map.speedMult(1500, 0), 1);
  // 윗면 바로 아래 절벽 쪽은 비탈
  const s = SPRITE_BY_ID.get(PLATEAU)!;
  const slopeY = s.h * 0.62 * 3 - s.tops[0]![1]! * 3;
  assert.equal(map.elevated(0, slopeY), false);
  assert.equal(map.speedMult(0, slopeY), TUNE.SLOPE_SPEED);
});

test("비탈에서는 이동한 거리가 줄어든다", () => {
  const dist = (terrain: TerrainWire[] | null) => {
    const g = new Game();
    g.autoSpawn = false;
    g.setTerrain(terrain);
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    const s = SPRITE_BY_ID.get(PLATEAU)!;
    p.x = -100;
    p.y = s.h * 0.62 * 3 - s.tops[0]![1]! * 3; // 비탈 위
    const x0 = p.x;
    g.setInput(a, { dx: 1, dy: 0, aim: 0, fire: false });
    run(g, 1);
    return p.x - x0;
  };
  const flat = dist(null);
  const slope = dist([plateauAt(0, 0)]);
  assert.ok(flat > 150);
  assert.ok(Math.abs(slope / flat - TUNE.SLOPE_SPEED) < 0.08, `${slope} / ${flat}`);
});

test("바위·폐허는 화살을 막는다", () => {
  const g = new Game();
  g.autoSpawn = false;
  g.setTerrain([rockAt(250, 0)]);
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.x = 0;
  p.y = -40;
  const id = g.spawnEnemyAt(400, -40, 1);
  const e = (g as unknown as { enemies: Map<number, { hp: number; maxHp: number; cd: number; atkT: number }> }).enemies.get(id)!;
  e.hp = e.maxHp = 1e6;
  e.cd = 999;
  e.atkT = 999;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  run(g, 2);
  assert.equal(e.hp, 1e6, "바위 뒤의 적은 화살을 맞지 않는다");
});

test("고지대에서 쏜 화살은 더 세고, 아래에서 고지대를 쏘면 약하다", () => {
  const dmg = (shooter: [number, number], target: [number, number]) => {
    const g = new Game(() => 0.99);
    g.autoSpawn = false;
    g.setTerrain([plateauAt(0, 0)]); // 윗면 중심 (0,0)
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    p.x = shooter[0];
    p.y = shooter[1];
    const id = g.spawnEnemyAt(target[0], target[1], 1);
    const e = (g as unknown as { enemies: Map<number, { x: number; y: number; hp: number; maxHp: number; cd: number; atkT: number; face: number }> }).enemies.get(id)!;
    e.face = Math.atan2(p.y - e.y, p.x - e.x); // 쏜 사람을 마주 본다(등 뒤 피해 보너스 없이)
    e.hp = e.maxHp = 1e6;
    e.cd = 999;
    e.atkT = 999;
    const aim = Math.atan2(e.y - p.y, e.x - p.x);
    g.setInput(a, { dx: 0, dy: 0, aim, fire: true });
    run(g, 0.05); // 한 발만 쏜다
    g.setInput(a, { dx: 0, dy: 0, aim, fire: false });
    run(g, 1.2);
    return 1e6 - e.hp;
  };
  const flat = dmg([1500, 0], [1850, 0]);
  assert.ok(flat > 0);
  const high = dmg([0, 0], [420, 0]); // 고지대 → 평지
  assert.ok(Math.abs(high / flat - TUNE.HIGH_GROUND_ARROW_MULT) < 0.02, `높은 곳 ${high} vs ${flat}`);
  const up = dmg([480, 0], [60, 0]); // 평지 → 고지대
  assert.ok(Math.abs(up / flat - TUNE.LOW_GROUND_ARROW_MULT) < 0.02, `아래에서 ${up} vs ${flat}`);
});

test("토너먼트 중에는 경기장에 걸친 지형이 사라진다", () => {
  const map = new TerrainMap([rockAt(100, 0), rockAt(1500, 0)], 860);
  assert.equal(map.hitsSolid(100, -20, 5), true);
  map.setDuel(true);
  assert.equal(map.hitsSolid(100, -20, 5), false, "경기장 안의 바위는 없는 셈");
  assert.equal(map.hitsSolid(1500, -20, 5), true, "바깥 바위는 그대로");
});
