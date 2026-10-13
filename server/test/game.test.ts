import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BLUNT,
  CAMP_FIRST_SPAWN_SEC,
  CAMP_USE_RADIUS,
  CARDS,
  ENEMY_XP,
  OFFER_SIZE,
  XP_TEAM_SHARE,
  xpNeeded,
  CAVALRY,
  CHARGE_DURATION_SEC,
  CHARGE_MAX_DISTANCE,
  DISMISS_REFUND,
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
  START_LEADERSHIP,
  UNIT_COST,
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
  // 통솔력: 시작 통솔력만큼만 보유할 수 있다
  live.gold = 100000;
  for (let i = 0; i < START_LEADERSHIP; i++) assert.equal(g.buy(a, near, 1).ok, true);
  const refused = g.buy(a, near, 1);
  assert.equal(refused.ok, false);
  // 통솔력을 늘리면 더 고용할 수 있고, 개체 수 안전 한도는 그대로 지킨다
  g.addLeadership(a, 100);
  for (let i = START_LEADERSHIP; i < MAX_MERCS_PER_PLAYER; i++) assert.equal(g.buy(a, near, 1).ok, true);
  assert.equal(g.buy(a, near, 1).ok, false);
});

test("통솔력 비용: 기병만 2, 나머지는 1", () => {
  assert.deepEqual([...UNIT_COST], [2, 1, 1, 1, 1]);
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const camp = g.spawnCampAt(p.x + 10, p.y, [CAVALRY, SPEAR, SHIELD]);
  g.getPlayer(a)!.gold = 100000;
  assert.equal(g.buy(a, camp, 0).ok, true); // 기병 → 2
  assert.equal(g.buy(a, camp, 0).ok, true); // 기병 → 4
  assert.equal(g.leadershipUsed(a), 4);
  const third = g.buy(a, camp, 0); // 6 > 5
  assert.equal(third.ok, false);
  assert.equal(g.buy(a, camp, 1).ok, true); // 창병 → 5
  assert.equal(g.leadershipUsed(a), 5);
  assert.equal(g.buy(a, camp, 1).ok, false);
});

test("해고: 캠프 근처에서만, 지불한 금화의 절반을 돌려받고, 쓰러지거나 약한 용병부터 나간다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  assert.equal(g.dismiss(a, SPEAR).ok, false); // 캠프 없음
  const camp = g.spawnCampAt(p.x + 10, p.y, [SPEAR, ARCHER, SHIELD]);
  const live = g.getPlayer(a)!;
  assert.equal(g.dismiss(a, SPEAR).ok, false); // 해당 병종 없음
  live.gold = 1000;
  assert.equal(g.buy(a, camp, 0).ok, true);
  assert.equal(live.gold, 1000 - mercPrice(SPEAR, 0));
  assert.equal(g.dismiss(a, SPEAR).ok, true);
  assert.equal(live.gold, 1000 - mercPrice(SPEAR, 0) + Math.floor(mercPrice(SPEAR, 0) * DISMISS_REFUND));
  assert.equal(g.leadershipUsed(a), 0);

  // 체력이 낮은 쪽이 먼저 나간다
  const strong = g.addMerc(a, SPEAR, p.x, p.y);
  const weak = g.addMerc(a, SPEAR, p.x, p.y);
  (g.getMerc(weak) as { hp: number }).hp = 5;
  assert.equal(g.dismiss(a, SPEAR).ok, true);
  assert.ok(g.getMerc(strong));
  assert.equal(g.getMerc(weak), undefined);
});

test("캠프에서 멀면 해고할 수 없다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.spawnCampAt(p.x + CAMP_USE_RADIUS + 100, p.y, [SPEAR, ARCHER, SHIELD]);
  g.addMerc(a, SPEAR, p.x, p.y);
  assert.equal(g.dismiss(a, SPEAR).ok, false);
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
  run(g, MERC_RESPAWN_SEC[ARCHER] + 0.5);
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

// --- 기병 ------------------------------------------------------------------

test("기병은 주인공 양옆 날개에 번갈아 선다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const c1 = g.addMerc(a, CAVALRY, p.x, p.y);
  const c2 = g.addMerc(a, CAVALRY, p.x, p.y);
  const slots = g.formationSlots(a);
  const s1 = slots.get(c1)!;
  const s2 = slots.get(c2)!;
  // 기본 방향은 +x. 옆(y)으로 서로 반대편에 150 떨어지고, 약간 앞에 선다.
  assert.ok(Math.abs(Math.abs(s1[1] - p.y) - 150) < 1e-6);
  assert.ok(Math.sign(s1[1] - p.y) !== Math.sign(s2[1] - p.y));
  assert.ok(s1[0] - p.x > 0);
});

test("기병은 오래 걸리는 부활 시간을 가진다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const c = g.addMerc(a, CAVALRY, p.x + 300, p.y);
  const spear = g.addMerc(a, SPEAR, p.x - 300, p.y);
  for (let i = 0; i < 400 && (g.getMerc(c)!.respawn === 0 || g.getMerc(spear)!.respawn === 0); i++) {
    if (i % 4 === 0) {
      g.spawnEnemyAt(g.getMerc(c)!.x, g.getMerc(c)!.y, BLUNT);
      g.spawnEnemyAt(g.getMerc(spear)!.x, g.getMerc(spear)!.y, BLUNT);
    }
    g.step();
  }
  assert.ok(g.getMerc(c)!.respawn > MERC_RESPAWN_SEC[SPEAR]);
  assert.ok(g.getMerc(spear)!.respawn <= MERC_RESPAWN_SEC[SPEAR]);
});

test("기병은 가까운 창병 적을 피해 다른 적을 노린다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const home = { x: p.x + 30, y: p.y + 150 }; // 첫 기병의 날개 자리
  const c = g.addMerc(a, CAVALRY, home.x, home.y);
  g.spawnEnemyAt(home.x + 130, home.y, SPEAR); // 가깝지만 창병(상성 불리)
  g.spawnEnemyAt(home.x, home.y + 200, SHIELD); // 더 멀지만 상성이 유리
  run(g, 0.25);
  const m = g.getMerc(c)!;
  assert.ok(m.y - home.y > 5, "검방병 쪽(아래)으로 움직인다");
  assert.ok(m.x - home.x <= 0.5, "창병 쪽(오른쪽)으로는 다가가지 않는다");
});

test("기병은 더 가까운 적이 있어도 궁병을 먼저 노린다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const home = { x: p.x + 30, y: p.y + 150 };
  const c = g.addMerc(a, CAVALRY, home.x, home.y);
  g.spawnEnemyAt(home.x + 80, home.y, SHIELD);
  g.spawnEnemyAt(home.x - 140, home.y, ARCHER);
  run(g, 0.25);
  assert.ok(g.getMerc(c)!.x - home.x < -2, "궁병(왼쪽) 쪽으로 움직인다");
});

test("기병은 공격한 뒤 잠깐 물러난다(치고 빠지기)", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const home = { x: p.x + 30, y: p.y + 150 };
  const c = g.addMerc(a, CAVALRY, home.x, home.y);
  const e = g.spawnEnemyAt(home.x + 30, home.y, SHIELD);
  for (let i = 0; i < 20 && g.getEnemy(e)!.hp === ENEMY_STATS[SHIELD]!.hp; i++) g.step(); // 공격이 들어갈 때까지
  assert.ok(g.getEnemy(e)!.hp < ENEMY_STATS[SHIELD]!.hp);
  const x0 = g.getMerc(c)!.x;
  run(g, 0.3);
  assert.ok(x0 - g.getMerc(c)!.x > 15, "공격 방향의 반대쪽으로 물러난다");
});

// --- 우클릭 돌격 지시 ---------------------------------------------------------

test("돌격 지시: 기병만 활동 범위를 넘어 지점으로 달려가고, 시간이 지나면 복귀한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = { ...me(g, a) };
  const cav = g.addMerc(a, CAVALRY, p.x, p.y);
  const shield = g.addMerc(a, SHIELD, p.x, p.y);
  g.charge(a, p.x + 700, p.y);
  assert.ok(me(g, a).chargeLeft > 0);
  run(g, 4);
  assert.ok(g.getMerc(cav)!.x - p.x > 500, "기병은 멀리 나간다");
  assert.ok(g.getMerc(shield)!.x - p.x < 200, "다른 병종은 진형을 지킨다");
  run(g, CHARGE_DURATION_SEC + 6);
  assert.equal(me(g, a).chargeLeft, 0);
  assert.ok(Math.hypot(g.getMerc(cav)!.x - p.x, g.getMerc(cav)!.y - p.y) < 300, "지시가 끝나면 복귀한다");
});

test("돌격 지점은 주인공 가까이로 제한되고 잘못된 값은 무시된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = { ...me(g, a) };
  g.charge(a, p.x + 99999, p.y);
  assert.ok(Math.abs(me(g, a).chargeX - p.x) <= CHARGE_MAX_DISTANCE + 1e-6);
  const g2 = quiet();
  const b = g2.addPlayer("b")!;
  g2.charge(b, Number.NaN, "x");
  assert.equal(me(g2, b).chargeLeft, 0);
});

test("돌격 중인 기병은 지점 근처의 적을 공격한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = { ...me(g, a) };
  g.addMerc(a, CAVALRY, p.x, p.y);
  const e = g.spawnEnemyAt(p.x + 600, p.y, ARCHER);
  g.charge(a, p.x + 600, p.y);
  run(g, 6);
  assert.equal(g.getEnemy(e), undefined, "궁병이 처치되어야 한다");
});

// --- 경험치와 레벨업 ------------------------------------------------------------

/** 한 명이 적 하나를 직접 처치하는 장면을 만든다 */
const killOne = (g: Game, killer: number, type = SPEAR) => {
  const p = me(g, killer);
  g.spawnEnemyAt(p.x + 100, p.y, type);
  g.setInput(killer, { ...idle, fire: true });
  for (let i = 0; i < 80 && g.enemyCount > 0; i++) g.step();
  g.setInput(killer, idle);
};

test("경험치: 혼자일 때는 처치 경험치를 전부 받는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  killOne(g, a);
  assert.ok(Math.abs(g.getPlayer(a)!.xp - ENEMY_XP[SPEAR]!) < 1e-9);
});

test("경험치: 처치한 사람 50%, 나머지 50%는 모두에게 똑같이 나뉜다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  const c = g.addPlayer("c")!;
  g.getPlayer(b)!.x = -1500; // 멀리 떨어져 있어도 팀 몫은 받는다
  killOne(g, a);
  const xp = ENEMY_XP[SPEAR]!;
  const share = (xp * XP_TEAM_SHARE) / 3;
  assert.ok(Math.abs(g.getPlayer(a)!.xp - (xp * (1 - XP_TEAM_SHARE) + share)) < 1e-9);
  assert.ok(Math.abs(g.getPlayer(b)!.xp - share) < 1e-9);
  assert.ok(Math.abs(g.getPlayer(c)!.xp - share) < 1e-9);
});

test("경험치: 용병이 처치해도 주인에게 개인 몫이 간다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  const p = me(g, a);
  g.addMerc(a, BLUNT, p.x + 60, p.y);
  g.spawnEnemyAt(p.x + 90, p.y, ARCHER);
  run(g, 1.5);
  assert.equal(g.enemyCount, 0);
  assert.ok(g.getPlayer(a)!.xp > g.getPlayer(b)!.xp);
});

test("레벨업: 경험치가 차면 레벨이 오르고 서로 다른 선택지 3장이 생긴다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.giveXp(a, xpNeeded(1) + 1);
  const p = g.getPlayer(a)!;
  assert.equal(p.level, 2);
  assert.equal(p.pending, 1);
  assert.equal(p.offer.length, OFFER_SIZE);
  assert.equal(new Set(p.offer).size, OFFER_SIZE);
  assert.ok(p.offer.every((i) => CARDS[i] !== undefined));
  assert.equal(p.xpNeed, xpNeeded(2));
});

test("레벨업 선택지는 가진 병종의 카드만 나오고 한 종류로만 채워지지 않는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.addMerc(a, SPEAR, 0, 0); // 창병만 보유
  for (let n = 0; n < 60; n++) {
    g.giveXp(a, 1e6); // 한꺼번에 여러 번 레벨업
    const p = g.getPlayer(a)!;
    for (const i of p.offer) {
      const t = CARDS[i]!.unitType;
      assert.ok(t === undefined || t === SPEAR, "보유하지 않은 병종 카드가 나왔다");
    }
    assert.ok(new Set(p.offer.map((i) => CARDS[i]!.category)).size > 1);
    p.pending = 0;
    p.offer = [];
  }
});

test("레벨업 선택: 효과가 적용되고 쌓인 선택이 이어서 뜬다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.giveXp(a, xpNeeded(1) + xpNeeded(2) + 1); // 두 번 레벨업
  const p = g.getPlayer(a)!;
  assert.equal(p.pending, 2);
  // 통솔력 카드를 강제로 제시해 효과를 확인한다
  const leadershipCard = CARDS.findIndex((c) => c.effect.k === "leadership" && c.effect.v === 1);
  p.offer = [leadershipCard, p.offer[1]!, p.offer[2]!];
  assert.equal(g.pick(a, 0), true);
  assert.equal(p.leadership, START_LEADERSHIP + 1);
  assert.equal(p.pending, 1);
  assert.equal(p.offer.length, OFFER_SIZE, "남은 선택이 이어서 뜬다");
  assert.equal(g.pick(a, 1), true);
  assert.equal(p.pending, 0);
  assert.deepEqual(p.offer, []);
  assert.equal(g.pick(a, 0), false, "고를 게 없으면 무시");
});

test("레벨업 선택: 잘못된 번호는 무시된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.giveXp(a, xpNeeded(1));
  for (const bad of [-1, 3, 99, 1.5, Number.NaN]) assert.equal(g.pick(a, bad), false);
  assert.equal(g.getPlayer(a)!.pending, 1);
});

const forceCard = (g: Game, id: number, k: string, extra?: (e: Record<string, unknown>) => boolean) => {
  g.giveXp(id, g.getPlayer(id)!.xpNeed); // 정확히 한 번 레벨업
  const p = g.getPlayer(id)!;
  const idx = CARDS.findIndex((c) => c.effect.k === k && (!extra || extra(c.effect as unknown as Record<string, unknown>)));
  assert.ok(idx >= 0, k);
  p.offer = [idx, p.offer[1]!, p.offer[2]!];
  assert.equal(g.pick(id, 0), true);
};

test("카드 효과: 용병 체력 강화는 이미 있는 용병의 체력도 함께 올린다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const m = g.addMerc(a, SHIELD, 0, 0);
  const before = MERC_STATS[SHIELD]!.hp;
  forceCard(g, a, "mercHp");
  assert.equal(g.getMerc(m)!.hp, Math.round(before * 1.15));
  const wire = g.snapshotMercs().find((w) => w[0] === m)!;
  assert.equal(wire[9], Math.round(before * 1.15)); // 최대 체력
  const m2 = g.addMerc(a, SHIELD, 0, 0); // 새로 고용한 용병도 강화된 체력으로 시작
  assert.equal(g.getMerc(m2)!.hp, Math.round(before * 1.15));
});

test("카드 효과: 병종 단련은 그 병종만 강화한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const spear = g.addMerc(a, SPEAR, 0, 0);
  const shield = g.addMerc(a, SHIELD, 0, 0);
  forceCard(g, a, "typeBoost", (e) => e.type === SPEAR);
  assert.equal(g.getMerc(spear)!.hp, Math.round(MERC_STATS[SPEAR]!.hp * 1.25));
  assert.equal(g.getMerc(shield)!.hp, MERC_STATS[SHIELD]!.hp);
});

test("카드 효과: 주인공 최대 체력·고용 할인·전리품", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  forceCard(g, a, "heroMaxHp");
  assert.equal(g.getPlayer(a)!.maxHp, PLAYER_MAX_HP + 25);
  assert.equal(g.getPlayer(a)!.hp, PLAYER_MAX_HP + 25);
  forceCard(g, a, "priceMult");
  assert.ok(Math.abs(g.getPlayer(a)!.priceMult - 0.85) < 1e-9);
  const p = me(g, a);
  const camp = g.spawnCampAt(p.x + 10, p.y, [SPEAR, ARCHER, SHIELD]);
  const gold = g.getPlayer(a)!.gold;
  assert.equal(g.buy(a, camp, 0).ok, true);
  assert.equal(g.getPlayer(a)!.gold, gold - Math.round(mercPrice(SPEAR, 0) * 0.85));
  forceCard(g, a, "goldMult");
  const g0 = g.getPlayer(a)!.gold;
  killOne(g, a, SPEAR);
  assert.equal(g.getPlayer(a)!.gold, g0 + Math.round(ENEMY_GOLD[SPEAR]! * 1.25));
});

test("카드 효과: 주인공 이동 속도와 체력 재생", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  forceCard(g, a, "heroSpeed");
  const x0 = me(g, a).x;
  g.setInput(a, { ...idle, dx: 1 });
  run(g, 1);
  assert.ok(Math.abs(me(g, a).x - x0 - PLAYER_SPEED * 1.08) < 1e-6);
  g.setInput(a, idle);
  forceCard(g, a, "heroRegen");
  g.getPlayer(a)!.hp = 50;
  run(g, 10);
  assert.ok(Math.abs(g.getPlayer(a)!.hp - 58) < 0.01);
});

test("카드 효과: 용병 부활 시간 단축", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const m = g.addMerc(a, SPEAR, p.x + 300, p.y);
  forceCard(g, a, "mercRespawn");
  for (let i = 0; i < 400 && g.getMerc(m)!.respawn === 0; i++) {
    if (i % 4 === 0) g.spawnEnemyAt(g.getMerc(m)!.x, g.getMerc(m)!.y, BLUNT);
    g.step();
  }
  assert.ok(g.getMerc(m)!.respawn > 0);
  assert.ok(g.getMerc(m)!.respawn <= MERC_RESPAWN_SEC[SPEAR] * 0.8 + 1e-9);
});
