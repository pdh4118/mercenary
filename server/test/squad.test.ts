import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BLUNT,
  CAVALRY,
  SHIELD,
  SPEAR,
  SQUAD_CLEAR_GOLD,
  SQUAD_FIRST_SEC,
  SQUAD_MAX_SIZE,
  TICK_RATE,
} from "@mercenary/shared";
import { Game } from "../src/game.js";
import { SQUAD_KINDS, squadComposition, squadLayout, squadSize } from "../src/stage.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};

test("소대 규모는 스테이지·인원에 따라 늘고 상한이 있다", () => {
  assert.ok(squadSize(5, 1) > squadSize(1, 1));
  assert.ok(squadSize(1, 6) > squadSize(1, 1));
  assert.equal(squadSize(10, 8), SQUAD_MAX_SIZE);
});

test("소대 구성: 합이 맞고, 병종끼리 서로의 약점을 가려 준다", () => {
  for (const kind of SQUAD_KINDS) {
    for (const size of [4, 6, 9, 14]) {
      const c = squadComposition(kind, size);
      assert.equal(c.reduce((a, b) => a + b, 0), size, `${kind.name} ${size}`);
      assert.ok(c.every((n) => n >= 0));
      // 비중이 20% 이상인 병종은 빠지지 않는다
      const needed = kind.mix.filter((m) => m >= 0.2).length;
      if (size >= needed) kind.mix.forEach((m, t) => m >= 0.2 && assert.ok(c[t]! >= 1, `${kind.name}의 ${t}`));
    }
  }
  const byName = (n: string) => SQUAD_KINDS.find((k) => k.name === n)!;
  const wall = squadComposition(byName("방패 벽"), 8);
  assert.ok(wall[SHIELD]! > 0 && wall[ARCHER]! > 0, "방패 벽: 방패가 궁병을 가린다");
  const charge = squadComposition(byName("기마 돌격"), 8);
  assert.ok(charge[CAVALRY]! > 0 && charge[ARCHER]! > 0 && charge[SHIELD]! > 0, "기마 돌격: 기병을 궁병·방패가 받친다");
  const smash = squadComposition(byName("파쇄조"), 8);
  assert.ok(smash[BLUNT]! > 0 && smash[SPEAR]! > 0, "파쇄조: 둔기병 옆을 창병이 지킨다");
  const pike = squadComposition(byName("창 방진"), 8);
  assert.ok(pike[SPEAR]! >= pike[SHIELD]!, "창 방진: 창병이 중심");
  // 기병이 없는 소대는 창병이 오는 기병을 막아 준다
  assert.equal(squadComposition(byName("방패 벽"), 8)[CAVALRY], 0);
});

test("소대 진형: 방패가 맨 앞, 궁병이 뒤, 기병은 양옆", () => {
  const layout = squadLayout(squadComposition(SQUAD_KINDS[2]!, 10)); // 기마 돌격
  assert.equal(layout.length, 10);
  assert.ok(layout.every((l) => !l.general));
  const front = Math.max(...layout.filter((l) => l.type !== CAVALRY).map((l) => l.forward));
  assert.ok(layout.filter((l) => l.forward === front && l.type !== CAVALRY).every((l) => l.type === SHIELD || l.type === SPEAR));
  const archers = layout.filter((l) => l.type === ARCHER);
  assert.ok(Math.max(...archers.map((l) => l.forward)) < front);
  const cav = layout.filter((l) => l.type === CAVALRY);
  assert.ok(cav.some((l) => l.lateral > 0) && cav.some((l) => l.lateral < 0));
});

test("소대가 먼 곳에서 진형을 갖추고 나타나 가까운 주인공을 향해 행군한다", () => {
  const g = quiet();
  g.addPlayer("a");
  const id = g.spawnSquad(0);
  assert.ok(id > 0);
  assert.equal(g.info().squads, 1);
  const ens = g.snapshotEnemies();
  assert.ok(ens.length >= 4 && ens.length <= SQUAD_MAX_SIZE);
  assert.ok(ens.every((e) => e[11] === 0), "장군은 없다");
  const me = g.getPlayer(1)!;
  const dist = () => Math.min(...g.snapshotEnemies().map((e) => Math.hypot(e[1] - me.x, e[2] - me.y)));
  const d0 = dist();
  assert.ok(d0 > 400);
  run(g, 6);
  assert.ok(dist() < d0 - 100, "다가온다");
});

test("소대를 전멸시키면 모두 금화를 받고 소대 수가 줄어든다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.spawnSquad(4);
  const total = g.snapshotEnemies().length;
  const gold = g.getPlayer(a)!.gold;
  for (const e of g.snapshotEnemies()) {
    const en = g.getEnemy(e[0]) as { hp: number; shield: number };
    en.shield = 0;
    en.hp = 0.1;
  }
  (g as unknown as { killAllForTest?: () => void }).killAllForTest?.();
  const dmg = g as unknown as { damageEnemy(e: unknown, h: unknown, o: number): number };
  for (const e of g.snapshotEnemies()) dmg.damageEnemy(g.getEnemy(e[0]), { damage: 5, charge: 0, srcType: -1, fromAngle: 0 }, a);
  assert.equal(g.info().squads, 0);
  assert.ok(g.getPlayer(a)!.gold >= gold + SQUAD_CLEAR_GOLD * total);
});

test("성장 단계에서 시간이 지나면 소대가 저절로 나타나고, 보스 단계에서는 새로 나오지 않는다", () => {
  const g = new Game();
  g.addPlayer("a");
  g.autoSpawn = true;
  let seen = 0;
  for (let i = 0; i < (SQUAD_FIRST_SEC + 3) * TICK_RATE; i++) {
    g.getPlayer(1)!.hp = 100;
    g.step();
    seen = Math.max(seen, g.info().squads);
  }
  assert.ok(seen >= 1, "첫 소대");
  const b = new Game();
  b.addPlayer("b");
  b.autoSpawn = true;
  b.forceBoss();
  for (let i = 0; i < 90 * TICK_RATE && b.status === "playing"; i++) {
    b.getPlayer(1)!.hp = 100;
    b.step();
  }
  assert.equal(b.info().squads, 0);
});

test("소대의 병사는 진형 자리를 지키며 멀리 있는 주인공을 쫓지 않는다", () => {
  const g = quiet();
  g.addPlayer("a");
  g.spawnSquad(1);
  const before = new Map(g.snapshotEnemies().map((e) => [e[0], [e[1], e[2]] as const]));
  run(g, 2);
  for (const e of g.snapshotEnemies()) {
    const b = before.get(e[0])!;
    assert.ok(Math.hypot(e[1] - b[0], e[2] - b[1]) < 250);
  }
  void SPEAR;
});
