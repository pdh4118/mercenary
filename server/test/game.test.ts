import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BLUNT,
  CAMP_FIRST_SPAWN_SEC,
  CAMP_USE_RADIUS,
  CAVALRY,
  ENEMY_GOLD,
  ENEMY_MAX,
  ENEMY_SPAWN_DISTANCE,
  ENEMY_STATS,
  FIRE_COOLDOWN_SEC,
  MAX_MERCS_PER_PLAYER,
  MAX_PLAYERS,
  MERC_RESPAWN_SEC,
  MERC_STATS,
  PLAYER_MAX_HP,
  PLAYER_RESPAWN_SEC,
  PLAYER_SPEED,
  SHIELD,
  SPEAR,
  START_GOLD,
  TICK_RATE,
  WORLD_SIZE,
  mercPrice,
  typeMultiplier,
} from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const me = (g: Game, id: number) => g.snapshotPlayers().find((p) => p.id === id)!;
const idle = { dx: 0, dy: 0, aim: 0, fire: false };
/** 적·캠프가 저절로 생기지 않는 게임. 필요한 것만 직접 배치한다. */
const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};

// --- 상성 ------------------------------------------------------------------

test("상성: 기병<창병<궁병<검방병<둔기병, 기병은 창병 외 모두에게 강하다", () => {
  // 오른쪽이 왼쪽에게 강하다
  assert.ok(typeMultiplier(SPEAR, CAVALRY) > 1);
  assert.ok(typeMultiplier(ARCHER, SPEAR) > 1);
  assert.ok(typeMultiplier(SHIELD, ARCHER) > 1);
  assert.ok(typeMultiplier(BLUNT, SHIELD) > 1);
  // 기병은 창병에게만 약하고 나머지에게는 강하다
  assert.ok(typeMultiplier(CAVALRY, SPEAR) < 1);
  for (const t of [ARCHER, SHIELD, BLUNT]) assert.ok(typeMultiplier(CAVALRY, t) > 1);
  // 약한 쪽이 강한 쪽을 칠 때는 불리하다
  assert.ok(typeMultiplier(CAVALRY, SPEAR) < 1);
  assert.ok(typeMultiplier(SPEAR, ARCHER) < 1);
  assert.ok(typeMultiplier(ARCHER, SHIELD) < 1);
  assert.ok(typeMultiplier(SHIELD, BLUNT) < 1);
  // 병종이 없는 공격(주인공)은 배율이 1이다
  assert.equal(typeMultiplier(-1, SPEAR), 1);
});

test("용병 가격은 보유 수가 늘수록 오른다", () => {
  assert.ok(mercPrice(SPEAR, 3) > mercPrice(SPEAR, 0));
});

// --- 기본 ------------------------------------------------------------------

test("6명 이상 입장 가능하고 정원이 차면 거절한다", () => {
  const g = new Game();
  for (let i = 0; i < MAX_PLAYERS; i++) assert.notEqual(g.addPlayer(`p${i}`), null);
  assert.equal(g.addPlayer("overflow"), null);
});

test("입력대로 이동하고 대각선도 같은 속도다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  const a0 = { ...me(g, a) };
  const b0 = { ...me(g, b) };
  g.setInput(a, { ...idle, dx: 1 });
  g.setInput(b, { ...idle, dx: 1, dy: 1 });
  run(g, 1);
  assert.ok(Math.abs(me(g, a).x - a0.x - PLAYER_SPEED) < 1e-6);
  const b1 = me(g, b);
  assert.ok(Math.abs(Math.hypot(b1.x - b0.x, b1.y - b0.y) - PLAYER_SPEED) < 1e-6);
});

test("조작된 입력(범위 초과·NaN)은 보정된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const a0 = { ...me(g, a) };
  g.setInput(a, { dx: 999, dy: Number.NaN, aim: Infinity, fire: "yes" });
  run(g, 1);
  const a1 = me(g, a);
  assert.ok(a1.x - a0.x <= PLAYER_SPEED + 1e-6);
  assert.equal(a1.y, a0.y);
  assert.equal(g.snapshotBullets().length, 0); // fire는 true일 때만 인정
});

test("월드 밖으로 나가지 못한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.setInput(a, { ...idle, dx: 1 });
  run(g, 60);
  assert.ok(me(g, a).x <= WORLD_SIZE / 2);
});

test("접속자가 없으면 판이 초기화된다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  run(g, 8);
  assert.ok(g.enemyCount > 0);
  assert.ok(g.snapshotCamps().length > 0);
  g.removePlayer(a);
  run(g, 1);
  assert.equal(g.enemyCount, 0);
  assert.equal(g.snapshotCamps().length, 0);
  assert.equal(g.time, 0);
});

// --- 적 생성 ---------------------------------------------------------------

test("적은 플레이어 둘레 화면 밖에서 생성되고 상한을 넘지 않는다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  g.setInput(a, idle);
  run(g, 2);
  assert.ok(g.enemyCount > 0);
  const p = me(g, a);
  for (const [, x, y] of g.snapshotEnemies()) {
    assert.ok(Math.hypot(x - p.x, y - p.y) <= ENEMY_SPAWN_DISTANCE + 20);
  }
  run(g, 600);
  assert.ok(g.enemyCount <= ENEMY_MAX);
});

test("적은 여러 병종으로 생성된다", () => {
  const g = new Game(() => Math.random());
  g.addPlayer("a");
  run(g, 60);
  const types = new Set(g.snapshotEnemies().map((e) => e[4]));
  assert.ok(types.size >= 4);
});

// --- 주인공 공격과 골드 -------------------------------------------------------

test("주인공 투사체로 적을 처치하면 처치 수와 금화가 오른다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.spawnEnemyAt(p.x + 200, p.y, SPEAR);
  g.setInput(a, { ...idle, fire: true });
  run(g, 3);
  assert.ok(me(g, a).kills >= 1);
  assert.equal(me(g, a).gold, START_GOLD + ENEMY_GOLD[SPEAR]!);
});

test("연사 속도(쿨다운)가 지켜진다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.setInput(a, { ...idle, fire: true });
  run(g, 1);
  assert.ok(g.snapshotBullets().length <= Math.ceil(1 / FIRE_COOLDOWN_SEC));
});

// --- 적의 공격 동작 ----------------------------------------------------------

test("닿는다고 바로 피해를 입지 않고, 공격 예비 동작이 끝난 뒤 맞는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.spawnEnemyAt(p.x + 20, p.y, SPEAR);
  g.step();
  const e = g.snapshotEnemies()[0]!;
  assert.ok(e[5] > 0, "공격 예비 동작이 시작되어야 한다");
  assert.equal(me(g, a).hp, PLAYER_MAX_HP);
  run(g, ENEMY_STATS[SPEAR]!.windup + 0.1);
  assert.equal(me(g, a).hp, PLAYER_MAX_HP - ENEMY_STATS[SPEAR]!.damage);
});

test("예비 동작 중에 피하면 맞지 않는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.spawnEnemyAt(p.x + 20, p.y, SPEAR);
  g.step();
  g.setInput(a, { ...idle, dx: -1 }); // 반대쪽으로 도망
  run(g, ENEMY_STATS[SPEAR]!.windup + 0.1);
  assert.equal(me(g, a).hp, PLAYER_MAX_HP);
});

test("공격 부채꼴 바깥에 있으면 맞지 않는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = { ...me(g, a) };
  g.spawnEnemyAt(p.x + 20, p.y, SPEAR);
  g.step();
  // 창병의 부채꼴은 좁다(약 22도). 예비 동작 동안 옆으로 비켜 서면 빗나간다.
  g.setInput(a, { ...idle, dy: 1 });
  run(g, ENEMY_STATS[SPEAR]!.windup);
  assert.equal(me(g, a).hp, PLAYER_MAX_HP);
});

test("적의 공격은 병종 상성에 따라 용병에게 들어가는 피해가 달라진다", () => {
  const dmgTo = (mercType: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = me(g, a);
    const mx = p.x + 60; // 진형 자리 가까이(너무 멀면 복귀하느라 공격 범위를 벗어난다)
    const merc = g.addMerc(a, mercType, mx, p.y);
    g.spawnEnemyAt(mx + 15, p.y, CAVALRY);
    run(g, 0.5);
    return MERC_STATS[mercType]!.hp - g.getMerc(merc)!.hp;
  };
  // 기병은 창병에게 약하다(방어 쪽 창병이 기병의 공격을 덜 받는 게 아니라, 기병→창병 배율 0.6)
  assert.equal(dmgTo(SPEAR), ENEMY_STATS[CAVALRY]!.damage * typeMultiplier(CAVALRY, SPEAR));
  assert.equal(dmgTo(ARCHER), ENEMY_STATS[CAVALRY]!.damage * typeMultiplier(CAVALRY, ARCHER));
  assert.ok(dmgTo(ARCHER) > dmgTo(SPEAR));
});

test("적 궁병의 화살은 날아가서 맞는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.spawnEnemyAt(p.x + 200, p.y, ARCHER);
  run(g, 2);
  assert.ok(me(g, a).hp < PLAYER_MAX_HP);
});

test("체력이 0이 되면 사망하고 일정 시간 뒤 전체 체력으로 부활한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  for (let i = 0; i < 400 && me(g, a).respawn === 0; i++) {
    if (i % 5 === 0) {
      const p = me(g, a);
      g.spawnEnemyAt(p.x, p.y, BLUNT);
    }
    g.step();
  }
  assert.ok(me(g, a).respawn > 0);
  assert.equal(me(g, a).hp, 0);
  run(g, PLAYER_RESPAWN_SEC + 0.2);
  assert.equal(me(g, a).respawn, 0);
  assert.equal(me(g, a).hp, PLAYER_MAX_HP);
});

test("겹친 적들은 서로 밀려나 한 점에 뭉치지 않는다", () => {
  const g = quiet();
  g.addPlayer("a");
  for (let i = 0; i < 5; i++) g.spawnEnemyAt(500, 500, SHIELD);
  run(g, 1);
  const spots = new Set(g.snapshotEnemies().map(([, x, y]) => `${x},${y}`));
  assert.ok(spots.size >= 5);
});

// --- 캠프와 고용 -------------------------------------------------------------

test("캠프는 일정 시간 뒤 플레이어 근처에 서로 다른 3종 제안과 함께 생긴다", () => {
  const g = new Game();
  g.addPlayer("a");
  run(g, CAMP_FIRST_SPAWN_SEC + 1);
  const camps = g.snapshotCamps();
  assert.ok(camps.length >= 1);
  const [, , , , o0, o1, o2] = camps[0]!;
  assert.equal(new Set([o0, o1, o2]).size, 3);
});

test("캠프 근처에서 금화로 용병을 고용한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const camp = g.spawnCampAt(p.x + 30, p.y, [ARCHER, SPEAR, SHIELD]);
  assert.deepEqual(g.buy(a, camp, 0), { ok: true });
  assert.equal(g.countMercs(a), 1);
  assert.equal(me(g, a).gold, START_GOLD - mercPrice(ARCHER, 0));
  // 두 번째는 더 비싸다
  const before = me(g, a).gold;
  const second = g.buy(a, camp, 1);
  if (before >= mercPrice(SPEAR, 1)) {
    assert.equal(second.ok, true);
    assert.equal(me(g, a).gold, before - mercPrice(SPEAR, 1));
  } else {
    assert.equal(second.ok, false);
  }
});

test("고용 검증: 금화 부족·거리·잘못된 선택·보유 한도", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const far = g.spawnCampAt(p.x + CAMP_USE_RADIUS + 50, p.y, [ARCHER, SPEAR, SHIELD]);
  assert.equal(g.buy(a, far, 0).ok, false);
  const near = g.spawnCampAt(p.x + 10, p.y, [CAVALRY, SPEAR, SHIELD]);
  assert.equal(g.buy(a, near, 7).ok, false);
  assert.equal(g.buy(a, near, -1).ok, false);
  assert.equal(g.buy(a, 9999, 0).ok, false);
  const live = g.getPlayer(a)!;
  live.gold = 0;
  assert.equal(g.buy(a, near, 0).ok, false);
  assert.equal(g.countMercs(a), 0);
  // 한도
  live.gold = 100000;
  for (let i = 0; i < MAX_MERCS_PER_PLAYER; i++) assert.equal(g.buy(a, near, 1).ok, true);
  assert.equal(g.buy(a, near, 1).ok, false);
});

// --- 용병 ------------------------------------------------------------------

test("용병은 진형 자리를 따라다니고, 궁병은 뒤·방패병은 앞에 선다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const archer = g.addMerc(a, ARCHER, p.x, p.y);
  const shield = g.addMerc(a, SHIELD, p.x, p.y);
  const spear = g.addMerc(a, SPEAR, p.x, p.y);
  g.setInput(a, { ...idle, aim: 0 }); // 오른쪽을 바라본다
  run(g, 4);
  const q = me(g, a);
  const ax = g.getMerc(archer)!.x - q.x;
  const sx = g.getMerc(shield)!.x - q.x;
  const px = g.getMerc(spear)!.x - q.x;
  assert.ok(ax < 0, "궁병은 주인공 뒤");
  assert.ok(sx > px && px > ax, "앞줄(검방병) > 중간줄(창병) > 뒷줄(궁병)");
});

test("용병이 적을 공격하고, 상성에 따라 들어가는 피해가 다르다", () => {
  const dmg = (enemyType: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = me(g, a);
    g.addMerc(a, SPEAR, p.x + 100, p.y);
    const e = g.spawnEnemyAt(p.x + 100 + 45, p.y, enemyType);
    // 적의 반격이 끼지 않게 적의 공격 쿨다운을 길게 둔다
    run(g, 0.2); // 창병 예비 동작(0.3초) 도중
    assert.equal(g.getEnemy(e)!.hp, ENEMY_STATS[enemyType]!.hp, "예비 동작이 끝나기 전에는 피해가 없다");
    run(g, 0.2);
    return ENEMY_STATS[enemyType]!.hp - g.getEnemy(e)!.hp;
  };
  const vsCav = dmg(CAVALRY);
  const vsArcher = dmg(ARCHER);
  assert.equal(vsCav, MERC_STATS[SPEAR]!.damage * typeMultiplier(SPEAR, CAVALRY));
  assert.equal(vsArcher, MERC_STATS[SPEAR]!.damage * typeMultiplier(SPEAR, ARCHER));
  assert.ok(vsCav > vsArcher);
});

test("용병이 처치하면 주인이 금화를 얻는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.addMerc(a, BLUNT, p.x + 60, p.y);
  g.spawnEnemyAt(p.x + 60 + 30, p.y, ARCHER); // 둔기병은 궁병에게 배율 1, 피해 18 ≥ 체력 18
  run(g, 1.5);
  assert.equal(g.enemyCount, 0);
  assert.equal(me(g, a).gold, START_GOLD + ENEMY_GOLD[ARCHER]!);
  assert.equal(me(g, a).kills, 1);
});

test("용병도 체력이 0이면 쓰러졌다가 일정 시간 뒤 부활한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const merc = g.addMerc(a, ARCHER, p.x + 300, p.y);
  for (let i = 0; i < 400 && g.getMerc(merc)!.respawn === 0; i++) {
    if (i % 4 === 0) g.spawnEnemyAt(p.x + 300, p.y, BLUNT);
    g.step();
  }
  assert.ok(g.getMerc(merc)!.respawn > 0, "쓰러져야 한다");
  assert.ok(g.snapshotMercs().some((m) => m[0] === merc && m[8] > 0), "쓰러진 상태가 전달된다");
  // 남은 적을 치워 다시 쓰러지지 않게 한다
  const q = me(g, a);
  (g as unknown as { enemies: Map<number, unknown> }).enemies.clear();
  run(g, MERC_RESPAWN_SEC + 0.5);
  const m = g.getMerc(merc)!;
  assert.equal(m.respawn, 0);
  assert.equal(m.hp, MERC_STATS[ARCHER]!.hp);
  assert.ok(Math.hypot(m.x - q.x, m.y - q.y) < 200, "주인공 근처에서 부활한다");
});

test("주인공이 나가면 그 용병도 사라진다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  g.addMerc(a, SPEAR, 0, 0);
  g.addMerc(b, SPEAR, 0, 0);
  g.removePlayer(a);
  assert.equal(g.countMercs(a), 0);
  assert.equal(g.countMercs(b), 1);
});
