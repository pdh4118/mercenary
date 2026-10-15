import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BLUNT,
  MAGE,
  MERC_STATS,
  SHIELD,
  TICK_RATE,
  TUNE,
  CAV_TARGET_WEIGHT,
  UNIT_NAMES,
  UNIT_TYPES,
  WEAPONS,
  EVT_METEOR,
  sanitizeFormation,
  sanitizeInput,
  ZONE_GUARD,
} from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};
type E = { hp: number; maxHp: number; cd: number; atkT: number; shield: number; shieldMax: number; x: number; y: number };
/** 맞아도 죽지 않고 제자리에 서 있는 적(시험용) */
const dummy = (g: Game, x: number, y: number, type = 1): E => {
  const id = g.spawnEnemyAt(x, y, type);
  const e = (g as unknown as { enemies: Map<number, E> }).enemies.get(id)!;
  e.hp = e.maxHp = 5000;
  e.cd = 99;
  e.atkT = 999;
  return e;
};

test("마법사: 병종 목록에 있고 느리고 약하지만 준비 3초·한 방이 크고 범위가 넓다", () => {
  assert.equal(UNIT_TYPES.length, 6);
  assert.equal(UNIT_NAMES[MAGE], "마법사");
  const m = MERC_STATS[MAGE]!;
  const others = MERC_STATS.filter((_, i) => i !== MAGE);
  assert.equal(m.windup, 3);
  assert.ok(m.hp < Math.min(...others.map((s) => s.hp)), "체력이 가장 낮다");
  assert.ok(m.speed < Math.min(...others.map((s) => s.speed)), "가장 느리다");
  assert.ok(m.damage > Math.max(...others.map((s) => s.damage)) * 3, "한 방이 훨씬 세다");
  assert.ok(m.splash > MERC_STATS[BLUNT]!.splash * 2.5, "범위가 굉장히 넓다");
  assert.equal(m.reach, MERC_STATS[ARCHER]!.reach, "사정거리는 궁수 정도");
  assert.equal(WEAPONS[4]!.type, MAGE);
  assert.equal(WEAPONS[4]!.windup, 3);
  assert.ok(CAV_TARGET_WEIGHT[MAGE]! > CAV_TARGET_WEIGHT[ARCHER]!, "기병은 마법사를 궁병보다 먼저 노린다");
});

test("용병 마법사: 3초 주문을 외운 뒤 낙하 지점 주변의 적에게 방패를 무시한 피해를 주고, 가장자리는 약하다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  (p as { invuln: number }).invuln = 1e9;
  g.addMerc(a, MAGE, p.x - 40, p.y);
  const center = dummy(g, p.x + 200, p.y);
  const edge = dummy(g, p.x + 200 + 110, p.y);
  const far = dummy(g, p.x + 200 + 400, p.y);
  const shielded = dummy(g, p.x + 200, p.y + 20, SHIELD);
  shielded.shield = shielded.shieldMax = 500; // 방패가 정면을 막고 있다
  run(g, 2.5);
  assert.equal(center.hp, 5000, "주문을 외우는 동안은 피해가 없다");
  assert.equal(g.snapshotMeteors().length, 1, "낙하 예고가 보인다");
  run(g, 1);
  const hitCenter = 5000 - center.hp;
  const hitEdge = 5000 - edge.hp;
  assert.ok(hitCenter > MERC_STATS[MAGE]!.damage * 0.8, `중심 ${hitCenter}`);
  assert.ok(hitEdge > 0 && hitEdge < hitCenter, `가장자리 ${hitEdge}`);
  assert.equal(far.hp, 5000, "범위 밖은 맞지 않는다");
  assert.ok(5000 - shielded.hp > 0 && shielded.shield === 500, "방패에 막히지 않고 몸에 들어간다");
  assert.ok(g.takeEvents().some((e) => e[0] === EVT_METEOR), "폭발 이벤트");
  assert.equal(g.snapshotMeteors().length, 0);
});

test("용병 마법사가 주문 도중 쓰러지면 운석은 떨어지지 않는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  (p as { invuln: number }).invuln = 1e9;
  const mid = g.addMerc(a, MAGE, p.x - 40, p.y);
  const e = dummy(g, p.x + 200, p.y);
  run(g, 2);
  assert.equal(g.snapshotMeteors().length, 1);
  (g as unknown as { hurtMerc(m: unknown, v: number): void }).hurtMerc((g as unknown as { mercs: Map<number, unknown> }).mercs.get(mid), 9999);
  run(g, 5);
  assert.equal(g.snapshotMeteors().length, 0);
  assert.equal(e.hp, 5000, "쓰러졌으니 폭발이 없다");
});

test("주인공 지팡이: 마우스 거리에 운석을 떨어뜨리고 3초 뒤에 폭발하며, 그동안 움직일 수 없다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  assert.ok(g.setWeapon(a, 4));
  run(g, 0.4);
  const near = dummy(g, p.x + 180, p.y);
  const other = dummy(g, p.x + 180, p.y + 600);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true, dist: 180 });
  run(g, 0.2);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false, dist: 180 });
  const m = g.snapshotMeteors();
  assert.equal(m.length, 1);
  assert.equal(m[0]![0], -a);
  assert.ok(Math.abs(m[0]![1] - (p.x + 180)) < 3, `x ${m[0]![1]}`);
  g.setInput(a, { dx: 1, dy: 0, aim: 0, fire: false, dist: 180 });
  const x0 = p.x;
  run(g, 2.4);
  assert.equal(p.x, x0, "주문을 외우는 동안은 움직일 수 없다");
  assert.equal(near.hp, 5000, "아직 폭발 전");
  run(g, 0.6);
  assert.ok(5000 - near.hp > WEAPONS[4]!.damage * 0.8);
  assert.equal(other.hp, 5000);
});

test("주인공 지팡이 낙하 지점은 사거리를 넘지 않고, 무기를 바꾸면 주문이 취소된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.setWeapon(a, 4);
  run(g, 0.4);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true, dist: 2500 });
  run(g, 0.2);
  const m = g.snapshotMeteors()[0]!;
  assert.ok(m[1] - p.x <= WEAPONS[4]!.reach + 1, "사거리 끝까지만");
  g.setWeapon(a, 0);
  run(g, 0.1);
  assert.equal(g.snapshotMeteors().length, 0);
});

test("입력의 마우스 거리는 범위로 잘린다", () => {
  assert.equal(sanitizeInput({ dist: 99999 }).dist, 3000);
  assert.equal(sanitizeInput({ dist: -5 }).dist, 0);
});

test("병종이 늘기 전에 저장된 진형(5개)도 받고, 마법사는 가장 뒤에서 호위한다", () => {
  const old = sanitizeFormation({ zones: [5, 1, 2, 0, 0], spacing: 1 });
  assert.ok(old);
  assert.equal(old!.zones.length, 6);
  assert.equal(old!.zones[MAGE], ZONE_GUARD);
  assert.equal(sanitizeFormation({ zones: [0, 0, 0, 0], spacing: 1 }), null);
});

test("캠프에 마법사가 나오고 고용하면 통솔력 2를 쓴다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const camp = g.spawnCampAt(p.x + 10, p.y, [MAGE, MAGE, MAGE]);
  g.getPlayer(a)!.gold = 1000;
  assert.equal(g.buy(a, camp, 0).ok, true);
  assert.equal(g.getPlayer(a)!.leadership, 5);
  assert.equal([...(g as unknown as { mercs: Map<number, { type: number }> }).mercs.values()].filter((m) => m.type === MAGE).length, 1);
  void TUNE;
});

test("마법사는 궁병처럼 가까이 온 근접 적에게서 물러나고, 그동안은 주문을 시작하지 않는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  (p as { invuln: number }).invuln = 1e9;
  const mid = g.addMerc(a, MAGE, p.x - 60, p.y);
  const mage = () => (g as unknown as { mercs: Map<number, { x: number; atkT: number }> }).mercs.get(mid)!;
  dummy(g, p.x + 200, p.y, 1); // 사거리 안의 먼 적
  const near = dummy(g, mage().x + 60, p.y, 1); // 바로 곁의 근접 적
  near.atkT = 999;
  const x0 = mage().x;
  run(g, 0.5);
  assert.ok(mage().x < x0 - 5, "멀어지는 쪽으로 움직인다");
  assert.equal(mage().atkT, 0, "위협이 있으면 주문을 시작하지 않는다");
  assert.equal(g.snapshotMeteors().length, 0);
});

test("적 마법사: 1스테이지에는 나오지 않고, 2스테이지부터 드물게(수 제한 없이 낮은 비율로) 나온다", () => {
  const countMages = (stage: number) => {
    const g = new Game(() => Math.random());
    g.addPlayer("a");
    g.jumpToStage(stage);
    const priv = g as unknown as { spawnBudget: number; spawnEnemies(dt: number): void; enemies: Map<number, { type: number }> };
    for (let i = 0; i < 3; i++) {
      priv.spawnBudget = 100;
      priv.spawnEnemies(0);
    }
    const all = [...priv.enemies.values()];
    return { mages: all.filter((e) => e.type === MAGE).length, total: all.length };
  };
  assert.equal(countMages(1).mages, 0);
  const s2 = countMages(2);
  assert.ok(s2.mages >= 1, `mages=${s2.mages}`);
  assert.ok(s2.mages / s2.total < 0.08, "빈도가 높지 않다");
});

test("적 마법사: 모인 아군 위에 운석을 겨누고(낙하 지점이 보인다), 그 사이에 벗어나면 맞지 않는다", () => {
  const run2 = (move: boolean) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    p.invuln = 0;
    const id = g.spawnEnemyAt(p.x + 220, p.y, MAGE);
    const mage = (g as unknown as { enemies: Map<number, { x: number; atkT: number }> }).enemies.get(id)!;
    run(g, 0.4);
    assert.ok(mage.atkT > 0, "주문을 외우기 시작한다");
    const m = g.snapshotMeteors();
    assert.equal(m.length, 1);
    assert.equal(m[0]![5], 0, "적의 운석(주인 0)");
    assert.ok(Math.hypot(m[0]![1] - p.x, m[0]![2] - p.y) < 60, "아군이 있는 곳을 겨눈다");
    if (move) g.setInput(a, { dx: -1, dy: 0, aim: 0, fire: false });
    run(g, 3.6);
    return { hp: g.getPlayer(a)!.hp, max: g.getPlayer(a)!.maxHp };
  };
  const still = run2(false);
  assert.ok(still.hp < still.max - 20, `서 있으면 맞는다: ${still.hp}`);
  const dodged = run2(true);
  assert.equal(dodged.hp, dodged.max, "벗어나면 맞지 않는다");
});
