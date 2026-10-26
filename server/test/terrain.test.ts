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
const PLATEAU = 61; // 길이 없는 산(418x413): 통째로 통과 불가
const RAMP_PLATEAU = 40; // 올라가는 길이 있는 고지대
const RAMP_SMALL = 49; // 작은 고지대(윗면 하나)
const rockAt = (x: number, y: number): TerrainWire => [ROCK, x, y, 1, 0];
const plateauAt = (x: number, y: number): TerrainWire => [RAMP_SMALL, x, y, 1.6, 0];

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

test("고지대: 윗면은 높음 판정, 올라가는 길만 오를 수 있고 나머지는 절벽이다", () => {
  const map = new TerrainMap([[RAMP_PLATEAU, 0, 0, 1.6, 0]]);
  assert.equal(map.elevated(0, 0), true, "윗면 중심");
  assert.equal(map.speedMult(0, 0), TUNE.PLATEAU_TOP_SPEED);
  assert.equal(map.elevated(1500, 0), false);
  assert.equal(map.speedMult(1500, 0), 1);
  const p = map.plateaus[0]!;
  // 올라가는 길 위는 막히지 않고 비탈보다 덜 느리다
  const [rx, ry] = p.ramp[1]!;
  assert.equal(map.onRamp(rx, ry), true);
  assert.equal(map.hitsSolid(rx, ry, 14), false, "길 위는 통과할 수 있다");
  assert.equal(map.speedMult(rx, ry), map.elevated(rx, ry) ? TUNE.PLATEAU_TOP_SPEED : TUNE.RAMP_SPEED);
  assert.ok(TUNE.RAMP_SPEED > TUNE.SLOPE_SPEED);
  // 절벽(길도 윗면도 아닌 곳)은 통과할 수 없지만 화살은 넘어간다
  const wall = map.solids[0]!;
  assert.equal(map.hitsSolid(wall.x, wall.y, 5), true);
  assert.equal(map.hitsSolid(wall.x, wall.y, 5, true), false, "절벽은 화살을 막지 않는다");
  const [ox, oy] = map.pushOut(wall.x, wall.y, 14);
  assert.ok(Math.hypot(ox - wall.x, oy - wall.y) > 5);
  // 길이 없는 산은 통째로 통과할 수 없고 화살도 막는다
  const mountain = new TerrainMap([[PLATEAU, 0, 0, 1.6, 0]]);
  assert.equal(mountain.plateaus.length, 0, "고지대 효과 없음");
  assert.equal(mountain.elevated(0, 0), false);
  assert.equal(mountain.hitsSolid(0, 0, 10), true, "산 한가운데는 막혀 있다");
  assert.equal(mountain.hitsSolid(0, 0, 10, true), true);
});

test("올라가는 길 위에서는 이동한 거리가 줄어든다", () => {
  const dist = (terrain: TerrainWire[] | null) => {
    const g = new Game();
    g.autoSpawn = false;
    g.setTerrain(terrain);
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    let dx = 1;
    let dy = 0;
    if (terrain) {
      const m = g.terrain!;
      const r = m.plateaus[0]!.ramp;
      p.x = r[1]![0]!;
      p.y = r[1]![1]!;
      dx = r[2]![0]! - r[1]![0]!;
      dy = r[2]![1]! - r[1]![1]!;
      const l = Math.hypot(dx, dy);
      dx /= l;
      dy /= l;
    } else {
      p.x = -300;
      p.y = -300;
    }
    const x0 = p.x;
    const y0 = p.y;
    g.setInput(a, { dx, dy, aim: 0, fire: false });
    run(g, 0.4);
    return Math.hypot(p.x - x0, p.y - y0);
  };
  const flat = dist(null);
  const ramp = dist([[RAMP_PLATEAU, 0, 0, 1.6, 0]]);
  assert.ok(flat > 60);
  assert.ok(ramp / flat > 0.6 && ramp / flat < 0.95, `${ramp} / ${flat}`);
});

test("용병은 올라가는 길을 따라 고지대 위의 주인공에게 간다", () => {
  const g = new Game();
  g.autoSpawn = false;
  g.setTerrain([[RAMP_PLATEAU, 0, 0, 1.6, 0]]);
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.x = 0;
  p.y = 0; // 윗면 중심
  const map = g.terrain!;
  const start = map.plateaus[0]!.ramp[0]!;
  const id = g.addMerc(a, 1, start[0]! + 150, start[1]! + 150);
  run(g, 40);
  const m = g.getMerc(id)!;
  assert.ok(map.elevated(m.x, m.y) || map.onRamp(m.x, m.y), `용병이 길을 못 찾았다: (${Math.round(m.x)}, ${Math.round(m.y)})`);
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

test("올라가는 길이 있는 고지대는 길 밖에서(특히 뒤쪽에서) 윗면으로 걸어 올라갈 수 없다", () => {
  const ramps = [40, 41, 43, 44, 45, 47, 49, 50, 51, 52, 70, 71];
  for (const id of ramps) {
    const s = SPRITE_BY_ID.get(id)!;
    const sc = s.w >= 280 ? 1.5 : 2.2;
    const m = new TerrainMap([[id, 0, 0, sc, 0]]);
    const p = m.plateaus[0]!;
    const step = 12;
    const R = 14;
    const lim = Math.max(s.w, s.h) * sc;
    const nearRamp = (x: number, y: number) => {
      for (let i = 0; i + 1 < p.ramp.length; i++) {
        const a = p.ramp[i]!;
        const b = p.ramp[i + 1]!;
        const dx = b[0]! - a[0]!;
        const dy = b[1]! - a[1]!;
        const l2 = dx * dx + dy * dy;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]!) * dx + (y - a[1]!) * dy) / l2)) : 0;
        if (Math.hypot(x - a[0]! - dx * t, y - a[1]! - dy * t) < p.rampHalf + 40) return true;
      }
      return false;
    };
    const top = p.tops[0]!;
    let start: [number, number] | null = null;
    for (let y = Math.round((top.y - top.ry - s.h * sc) / step) * step; y < top.y && !start; y += step) if (!m.hitsSolid(top.x, y, R) && !nearRamp(top.x, y)) start = [Math.round(top.x / step) * step, y];
    assert.ok(start, `${id}: 뒤쪽 시작점`);
    const seen = new Set<string>([`${start![0]},${start![1]}`]);
    const q: [number, number][] = [start!];
    let leak = 0;
    while (q.length) {
      const [x, y] = q.pop()!;
      if (m.elevated(x, y)) leak++;
      for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const k = `${nx},${ny}`;
        if (Math.abs(nx) > lim || Math.abs(ny) > lim || seen.has(k) || m.hitsSolid(nx, ny, R) || nearRamp(nx, ny)) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    assert.equal(leak, 0, `${id}: 길 밖에서 윗면에 닿는 칸 ${leak}`);
  }
});

test("적은 산·바위에 정면으로 막혀도 비껴 돌아서 주인공에게 도달한다", () => {
  for (const [name, wall] of [["산", [[PLATEAU, 0, 0, 1.6, 0]]], ["바위 줄", [-120, -60, 0, 60, 120].map((y) => rockAt(0, y))]] as [string, TerrainWire[]][]) {
    const g = new Game();
    g.autoSpawn = false;
    g.setTerrain(wall);
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    p.x = 420;
    p.y = 0;
    p.invuln = 1e9;
    const e = g.getEnemy(g.spawnEnemyAt(-420, 0, 0))!; // 기병: 사이에 지형이 있어도 정면으로 달려든다
    let best = Infinity;
    for (let i = 0; i < 20 * TICK_RATE; i++) {
      g.step();
      best = Math.min(best, Math.hypot(e.x - p.x, e.y - p.y));
    }
    assert.ok(best < 120, `${name}: 돌아가서 다가가야 한다(가장 가까웠던 거리 ${Math.round(best)})`);
  }
});

test("토너먼트가 끝나면 선수가 지형 위·안이 아니라 설 수 있는 자리로 옮겨진다", () => {
  const g = new Game();
  g.autoSpawn = false;
  g.setTerrain([[PLATEAU, 0, 0, 1.6, 0]]);
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.x = 0;
  p.y = 0; // 산 한가운데(경기 중에는 지형이 사라져 있어서 설 수 있었다)
  const spot = (g as unknown as { freeSpot(x: number, y: number, r: number): [number, number] }).freeSpot(p.x, p.y, 14);
  assert.equal(g.terrain!.blocked(spot[0], spot[1], 14), false);
  assert.ok(Math.hypot(spot[0], spot[1]) > 100, "산 밖으로 나왔다");
});
