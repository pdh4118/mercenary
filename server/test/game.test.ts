import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BLUNT,
  CAMP_FIRST_SPAWN_SEC,
  CAMP_USE_RADIUS,
  LEVELUP_PUSH_DISTANCE,
  LEVELUP_PUSH_RADIUS,
  LEVELUP_STUN_SEC,
  WEAPONS,
  WEAPON_SWITCH_DELAY_SEC,
  CARDS,
  ENEMY_XP,
  OFFER_SIZE,
  xpNeeded,
  CAVALRY,
  CHARGE_DURATION_SEC,
  CHARGE_MAX_DISTANCE,
  ENEMY_GOLD,
  ENEMY_MAX,
  ENEMY_SPAWN_DISTANCE,
  ENEMY_STATS,
  FIRE_COOLDOWN_SEC,
  MAX_MERCS_PER_PLAYER,
  MAX_PLAYERS,
  MERC_RESPAWN_SEC,
  MERC_STATS,
  SHIELD,
  SPEAR,
  UNIT_COST,
  TICK_RATE,
  WORLD_SIZE,
  mercPrice,
  SHIELD_DAMAGE_FACTOR,
  HERO_SWORD_FRONT_BLOCK,
  chargeBonus,
  SWARM_PER_MERC,
  TUNE,
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

test("병종 규칙 상수: 기병만 통솔력 2, 방패는 검방병에만 있고 창병이 가장 길다", () => {
  assert.ok(MERC_STATS[SHIELD]!.shield > 0);
  assert.ok(ENEMY_STATS[SHIELD]!.shield > 0);
  for (const t of [CAVALRY, SPEAR, ARCHER, BLUNT]) {
    assert.equal(MERC_STATS[t]!.shield, 0);
    assert.equal(ENEMY_STATS[t]!.shield, 0);
  }
  // 근접 사거리: 창병 > 둔기병 > 검방병
  assert.ok(MERC_STATS[SPEAR]!.reach > MERC_STATS[BLUNT]!.reach);
  assert.ok(MERC_STATS[BLUNT]!.reach > MERC_STATS[SHIELD]!.reach);
  assert.ok(ENEMY_STATS[SPEAR]!.reach > ENEMY_STATS[BLUNT]!.reach);
  // 범위 공격은 둔기병만
  assert.ok(MERC_STATS[BLUNT]!.splash > 0 && ENEMY_STATS[BLUNT]!.splash > 0);
  for (const t of [CAVALRY, SPEAR, ARCHER, SHIELD]) assert.equal(MERC_STATS[t]!.splash, 0);
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
  assert.ok(Math.abs(me(g, a).x - a0.x - TUNE.PLAYER_SPEED) < 1e-6);
  const b1 = me(g, b);
  assert.ok(Math.abs(Math.hypot(b1.x - b0.x, b1.y - b0.y) - TUNE.PLAYER_SPEED) < 1e-6);
});

test("조작된 입력(범위 초과·NaN)은 보정된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const a0 = { ...me(g, a) };
  g.setInput(a, { dx: 999, dy: Number.NaN, aim: Infinity, fire: "yes" });
  run(g, 1);
  const a1 = me(g, a);
  assert.ok(a1.x - a0.x <= TUNE.PLAYER_SPEED + 1e-6);
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
  assert.equal(me(g, a).gold, TUNE.START_GOLD + ENEMY_GOLD[SPEAR]!);
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
  assert.equal(me(g, a).hp, TUNE.PLAYER_MAX_HP);
  run(g, ENEMY_STATS[SPEAR]!.windup + 0.1);
  assert.equal(me(g, a).hp, TUNE.PLAYER_MAX_HP - ENEMY_STATS[SPEAR]!.damage);
});

test("예비 동작 중에 피하면 맞지 않는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.spawnEnemyAt(p.x + 20, p.y, SPEAR);
  g.step();
  g.setInput(a, { ...idle, dx: -1 }); // 반대쪽으로 도망
  run(g, ENEMY_STATS[SPEAR]!.windup + 0.1);
  assert.equal(me(g, a).hp, TUNE.PLAYER_MAX_HP);
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
  assert.equal(me(g, a).hp, TUNE.PLAYER_MAX_HP);
});

test("적 기병의 돌격: 창병 용병은 돌격 피해를 받지 않고 되돌려주며, 다른 병종은 속도에 비례해 더 아프게 맞는다", () => {
  const run1 = (mercType: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = me(g, a);
    const mx = p.x + 60; // 진형 자리 가까이(너무 멀면 싸우지 않고 복귀한다). 적과 가장 가까운 아군이 이 용병이 되도록 적을 그 바로 옆에 둔다
    const merc = g.addMerc(a, mercType, mx, p.y);
    const e = g.spawnEnemyAt(mx + 15, p.y, CAVALRY);
    (g.getEnemy(e) as { momentum: number }).momentum = 1; // 달려온 상태
    run(g, 0.5);
    return { lost: MERC_STATS[mercType]!.hp - g.getMerc(merc)!.hp, enemyHp: g.getEnemy(e)?.hp ?? 0 };
  };
  const bonus = chargeBonus(ENEMY_STATS[CAVALRY]!.speed * TUNE.ENEMY_SPEED_MULT, 1); // 적은 이동 속도 배율이 붙는다
  const base = ENEMY_STATS[CAVALRY]!.damage;
  const blunt = run1(BLUNT); // 궁병은 근접 적이 오면 물러나 맞지 않으므로 제자리에서 맞는 병종으로 본다
  assert.ok(Math.abs(blunt.lost - (base + bonus)) < 1e-6, `둔기병은 기본+돌격: ${blunt.lost}`);
  const spear = run1(SPEAR);
  assert.ok(Math.abs(spear.lost - base) < 1e-6, `창병은 기본만: ${spear.lost}`);
  assert.ok(spear.enemyHp <= ENEMY_STATS[CAVALRY]!.hp - bonus + 1e-6, "돌격 피해가 기병에게 되돌아간다");
  // 속도가 없으면 돌격 피해도 적다
  assert.ok(chargeBonus(ENEMY_STATS[CAVALRY]!.speed, 0) < bonus);
});

test("적 궁병의 화살은 날아가서 맞는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.spawnEnemyAt(p.x + 200, p.y, ARCHER);
  run(g, 2);
  assert.ok(me(g, a).hp < TUNE.PLAYER_MAX_HP);
});

test("체력이 0이 되면 쓰러지고, 혼자뿐이면 게임오버가 된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  for (let i = 0; i < 400 && !me(g, a).down; i++) {
    if (i % 5 === 0) {
      const p = me(g, a);
      g.spawnEnemyAt(p.x, p.y, BLUNT);
    }
    g.step();
  }
  assert.ok(me(g, a).down);
  assert.equal(me(g, a).hp, 0);
  assert.equal(g.status, "defeat");
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
  assert.equal(me(g, a).gold, TUNE.START_GOLD - mercPrice(ARCHER, 0));
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
  for (let i = 0; i < TUNE.START_LEADERSHIP; i++) assert.equal(g.buy(a, near, 1).ok, true);
  const refused = g.buy(a, near, 1);
  assert.equal(refused.ok, false);
  // 통솔력을 늘리면 더 고용할 수 있고, 개체 수 안전 한도는 그대로 지킨다
  g.addLeadership(a, 100);
  for (let i = TUNE.START_LEADERSHIP; i < MAX_MERCS_PER_PLAYER; i++) assert.equal(g.buy(a, near, 1).ok, true);
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
  assert.equal(live.gold, 1000 - mercPrice(SPEAR, 0) + Math.floor(mercPrice(SPEAR, 0) * TUNE.DISMISS_REFUND));
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

test("용병의 공격: 방패 정면은 창이 60%만 들어가고, 방패 없는 적에게는 그대로 들어간다", () => {
  const after = (enemyType: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = me(g, a);
    g.addMerc(a, SPEAR, p.x + 100, p.y);
    const e = g.spawnEnemyAt(p.x + 100 + 45, p.y, enemyType);
    run(g, 0.2);
    const early = g.getEnemy(e)!;
    assert.equal(early.hp + early.shield, ENEMY_STATS[enemyType]!.hp + ENEMY_STATS[enemyType]!.shield, "예비 동작이 끝나기 전에는 피해가 없다");
    run(g, 0.2);
    const e2 = g.getEnemy(e)!;
    return { hp: e2.hp, shield: e2.shield };
  };
  const vsArcher = after(ARCHER);
  assert.ok(Math.abs(vsArcher.hp - (ENEMY_STATS[ARCHER]!.hp - MERC_STATS[SPEAR]!.damage * (1 + SWARM_PER_MERC))) < 1e-9); // 용병 1명의 군세 보너스 포함
  const vsShield = after(SHIELD);
  assert.equal(vsShield.hp, ENEMY_STATS[SHIELD]!.hp, "몸은 맞지 않는다");
  assert.ok(Math.abs(vsShield.shield - (ENEMY_STATS[SHIELD]!.shield - MERC_STATS[SPEAR]!.damage * (1 + SWARM_PER_MERC) * SHIELD_DAMAGE_FACTOR[SPEAR]!)) < 1e-6);
});

test("용병이 처치하면 주인이 금화를 얻는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.addMerc(a, BLUNT, p.x + 60, p.y);
  g.spawnEnemyAt(p.x + 60 + 30, p.y, SPEAR); // 둔기병 피해 36 ≥ 창병 체력 28(적 궁병은 물러나며 쏘므로 다른 병종으로)
  run(g, 1.5);
  assert.equal(g.enemyCount, 0);
  assert.equal(me(g, a).gold, TUNE.START_GOLD + ENEMY_GOLD[SPEAR]!);
  assert.equal(me(g, a).kills, 1);
});

test("용병도 체력이 0이면 쓰러졌다가 일정 시간 뒤 부활한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const merc = g.addMerc(a, SHIELD, p.x + 300, p.y);
  for (let i = 0; i < 400 && g.getMerc(merc)!.respawn === 0; i++) {
    if (i % 4 === 0) g.spawnEnemyAt(p.x + 300, p.y, BLUNT);
    g.step();
  }
  assert.ok(g.getMerc(merc)!.respawn > 0, "쓰러져야 한다");
  assert.ok(g.snapshotMercs().some((m) => m[0] === merc && m[8] > 0), "쓰러진 상태가 전달된다");
  // 남은 적을 치워 다시 쓰러지지 않게 한다
  const q = me(g, a);
  (g as unknown as { enemies: Map<number, unknown> }).enemies.clear();
  run(g, MERC_RESPAWN_SEC[SHIELD] + 0.5);
  const m = g.getMerc(merc)!;
  assert.equal(m.respawn, 0);
  assert.equal(m.hp, MERC_STATS[SHIELD]!.hp);
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
    g.getPlayer(a)!.hp = TUNE.PLAYER_MAX_HP; // 주인공이 먼저 쓰러져 게임이 끝나지 않게
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
  const far = g.spawnEnemyAt(home.x, home.y + 200, SHIELD); // 더 멀지만 상성이 유리
  (g.getEnemy(far) as { face: number }).face = 0; // 우회하지 않고 곧장 가도록 방향을 고정
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
  const e = g.spawnEnemyAt(home.x + 30, home.y, ARCHER);
  (g.getEnemy(e) as { hp: number; maxHp: number }).hp = (g.getEnemy(e) as { maxHp: number }).maxHp = 500; // 한 방에 죽지 않게
  for (let i = 0; i < 20 && g.getEnemy(e)!.hp === 500; i++) g.step(); // 공격이 들어갈 때까지
  assert.ok(g.getEnemy(e)!.hp < 500);
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
  (g.getEnemy(e) as { atkT: number }).atkT = 999; // 제자리에 서 있게(적 궁병은 원래 물러나며 쏜다)
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
  const share = (xp * TUNE.XP_TEAM_SHARE) / 3;
  assert.ok(Math.abs(g.getPlayer(a)!.xp - (xp * (1 - TUNE.XP_TEAM_SHARE) + share)) < 1e-9);
  assert.ok(Math.abs(g.getPlayer(b)!.xp - share) < 1e-9);
  assert.ok(Math.abs(g.getPlayer(c)!.xp - share) < 1e-9);
});

test("경험치: 용병이 처치해도 주인에게 개인 몫이 간다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  const p = me(g, a);
  g.addMerc(a, BLUNT, p.x + 60, p.y);
  g.spawnEnemyAt(p.x + 90, p.y, SPEAR);
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
  assert.equal(p.leadership, TUNE.START_LEADERSHIP + 1);
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
  forceCard(g, a, "mercStat", (e) => e.stat === "hp" && e.type === undefined);
  assert.equal(g.getMerc(m)!.hp, Math.round(before * 1.05));
  const wire = g.snapshotMercs().find((w) => w[0] === m)!;
  assert.equal(wire[9], Math.round(before * 1.05)); // 최대 체력
  const m2 = g.addMerc(a, SHIELD, 0, 0); // 새로 고용한 용병도 강화된 체력으로 시작
  assert.equal(g.getMerc(m2)!.hp, Math.round(before * 1.05));
});

test("카드 효과: 병종 단련은 그 병종만 강화한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const spear = g.addMerc(a, SPEAR, 0, 0);
  const shield = g.addMerc(a, SHIELD, 0, 0);
  forceCard(g, a, "mercStat", (e) => e.stat === "hp" && e.type === SPEAR);
  assert.equal(g.getMerc(spear)!.hp, Math.round(MERC_STATS[SPEAR]!.hp * 1.25));
  assert.equal(g.getMerc(shield)!.hp, MERC_STATS[SHIELD]!.hp);
});

test("카드 효과: 주인공 최대 체력·고용 할인·전리품", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  forceCard(g, a, "heroMaxHp");
  assert.equal(g.getPlayer(a)!.maxHp, TUNE.PLAYER_MAX_HP + 25);
  assert.equal(g.getPlayer(a)!.hp, TUNE.PLAYER_MAX_HP + 25);
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
  assert.ok(Math.abs(me(g, a).x - x0 - TUNE.PLAYER_SPEED * 1.12) < 1e-6);
  g.setInput(a, idle);
  forceCard(g, a, "heroRegen");
  g.getPlayer(a)!.hp = 50;
  run(g, 10);
  assert.ok(Math.abs(g.getPlayer(a)!.hp - 52) < 0.01);
});

test("카드 효과: 용병 부활 시간 단축", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const m = g.addMerc(a, BLUNT, p.x + 300, p.y); // (창병·검방병은 주인공 곁을 지키러 물러나므로 제자리에서 싸우는 병종으로)
  forceCard(g, a, "mercStat", (e) => e.stat === "respawn" && e.type === undefined);
  for (let i = 0; i < 400 && g.getMerc(m)!.respawn === 0; i++) {
    if (i % 4 === 0) g.spawnEnemyAt(g.getMerc(m)!.x, g.getMerc(m)!.y, BLUNT);
    g.step();
  }
  assert.ok(g.getMerc(m)!.respawn > 0);
  assert.ok(g.getMerc(m)!.respawn <= MERC_RESPAWN_SEC[BLUNT] * 0.95 + 1e-9);
});

// --- 주인공 무기 ------------------------------------------------------------

/** 무기를 들고 정면(동쪽)으로 공격하며, 대상이 처음 피해를 입는 순간까지 진행한다 */
const swingUntilHit = (g: Game, id: number, enemy: number) => {
  const full = g.getEnemy(enemy)!.hp;
  g.setInput(id, { ...idle, fire: true });
  for (let i = 0; i < 40 && g.getEnemy(enemy) && g.getEnemy(enemy)!.hp === full; i++) g.step();
  return g.getEnemy(enemy)?.hp;
};

test("무기 목록: 활·창·검·철퇴가 각각 궁병·창병·검방병·둔기병 속성이다", () => {
  assert.deepEqual(WEAPONS.map((w) => w.name), ["활", "창", "검", "철퇴"]);
  assert.deepEqual(WEAPONS.map((w) => w.type), [ARCHER, SPEAR, SHIELD, BLUNT]);
  assert.equal(WEAPONS[0]!.ranged, true);
});

test("창: 정면 부채꼴의 적만 맞힌다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.setWeapon(a, 1);
  const front = g.spawnEnemyAt(p.x + 60, p.y, SPEAR);
  const behind = g.spawnEnemyAt(p.x - 40, p.y, SPEAR);
  const after = swingUntilHit(g, a, front);
  assert.equal(after, ENEMY_STATS[SPEAR]!.hp - WEAPONS[1]!.damage);
  assert.equal(g.getEnemy(behind)!.hp, ENEMY_STATS[SPEAR]!.hp, "뒤에 있는 적은 맞지 않는다");
  assert.ok(me(g, a).swing > 0, "휘두르는 이펙트 정보가 전달된다");
});

test("창은 사거리 밖의 적을 맞히지 못한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.setWeapon(a, 1);
  const far = g.spawnEnemyAt(p.x + WEAPONS[1]!.reach + 80, p.y, SPEAR);
  g.setInput(a, { ...idle, fire: true });
  run(g, 0.3);
  assert.equal(g.getEnemy(far)!.hp, ENEMY_STATS[SPEAR]!.hp);
});

test("무기와 방패: 철퇴는 방패를 단번에 깨고, 창은 60%·활은 25%만 들어간다", () => {
  const shieldAfter = (weapon: number, dist: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = me(g, a);
    g.setWeapon(a, weapon);
    const e = g.spawnEnemyAt(p.x + dist, p.y, SHIELD); // 방패는 주인공을 향해 있다(정면)
    g.setInput(a, { ...idle, fire: true });
    for (let i = 0; i < 40; i++) {
      g.step();
      const cur = g.getEnemy(e)!;
      if (cur.shield < ENEMY_STATS[SHIELD]!.shield) return { shield: cur.shield, hp: cur.hp, regen: cur.regenT };
    }
    return null;
  };
  const mace = shieldAfter(3, 40)!;
  assert.equal(mace.shield, 0, "철퇴 한 번에 방패가 깨진다");
  assert.ok(mace.regen > 0, "깨진 방패는 재생을 기다린다");
  assert.ok(mace.hp < ENEMY_STATS[SHIELD]!.hp, "넘친 몫은 몸에 들어간다");
  const spear = shieldAfter(1, 60)!;
  assert.ok(Math.abs(spear.shield - (ENEMY_STATS[SHIELD]!.shield - WEAPONS[1]!.damage * SHIELD_DAMAGE_FACTOR[SPEAR]!)) < 1e-6);
  assert.equal(spear.hp, ENEMY_STATS[SHIELD]!.hp);
  const bow = shieldAfter(0, 200)!;
  assert.ok(Math.abs(bow.shield - (ENEMY_STATS[SHIELD]!.shield - WEAPONS[0]!.damage * SHIELD_DAMAGE_FACTOR[ARCHER]!)) < 1e-6);
});

test("방패가 없는 적에게는 무기 피해가 그대로 들어간다(검·활)", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.setWeapon(a, 2);
  const archer = g.spawnEnemyAt(p.x + 40, p.y, ARCHER);
  assert.equal(swingUntilHit(g, a, archer), ENEMY_STATS[ARCHER]!.hp - WEAPONS[2]!.damage);
  const bow = quiet();
  const b = bow.addPlayer("b")!;
  const pb = me(bow, b);
  const spear = bow.spawnEnemyAt(pb.x + 200, pb.y, SPEAR);
  assert.equal(swingUntilHit(bow, b, spear), ENEMY_STATS[SPEAR]!.hp - WEAPONS[0]!.damage);
});

test("무기를 바꾼 직후에는 잠깐 공격할 수 없다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const e = g.spawnEnemyAt(p.x + 40, p.y, SPEAR);
  g.setWeapon(a, 2); // 검(준비 동작 없음). 방패가 없는 적으로 본다
  g.setInput(a, { ...idle, fire: true });
  run(g, WEAPON_SWITCH_DELAY_SEC - 0.1);
  assert.equal(g.getEnemy(e)!.hp, ENEMY_STATS[SPEAR]!.hp);
  run(g, 0.3);
  assert.ok(g.getEnemy(e)!.hp < ENEMY_STATS[SPEAR]!.hp);
});

test("무기 변경 검증: 범위 밖·소수·같은 무기는 무시된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  for (const bad of [-1, WEAPONS.length, 1.5, Number.NaN, "2", null]) assert.equal(g.setWeapon(a, bad), false);
  assert.equal(g.setWeapon(a, 0), false);
  assert.equal(g.getPlayer(a)!.weapon, 0);
  assert.equal(g.setWeapon(a, 2), true);
  assert.equal(g.getPlayer(a)!.weapon, 2);
});

// --- 레벨업 밀어내기 -----------------------------------------------------------

test("레벨업하면 주변 적이 밀려나고 하던 공격이 끊기며 잠깐 공격하지 못한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = { ...me(g, a) };
  const near = g.spawnEnemyAt(p.x + 30, p.y, SPEAR);
  const far = g.spawnEnemyAt(p.x + LEVELUP_PUSH_RADIUS + 120, p.y, SPEAR);
  g.step();
  assert.ok(g.getEnemy(near)!.atkT > 0, "공격 준비 중");
  const farX = g.getEnemy(far)!.x;
  g.giveXp(a, xpNeeded(1));
  const e = g.getEnemy(near)!;
  assert.ok(Math.hypot(e.x - p.x, e.y - p.y) > 30 + LEVELUP_PUSH_DISTANCE * 0.9, "멀리 밀려난다");
  assert.equal(e.atkT, 0);
  assert.ok(e.cd >= LEVELUP_STUN_SEC - 1e-9);
  assert.equal(g.getEnemy(far)!.x, farX, "범위 밖의 적은 그대로");
  run(g, 0.5);
  assert.equal(me(g, a).hp, TUNE.PLAYER_MAX_HP, "그 사이 피해를 입지 않는다");
});

// --- 새 병종 규칙(방패·돌격·반사·범위) ---------------------------------------------

test("철퇴는 맞힌 대상 주변의 다른 적에게 절반 피해(범위 공격)를 준다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.setWeapon(a, 3);
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1); // 무기 교체 대기가 끝난 뒤에 적을 놓아 위치가 흐트러지지 않게 한다
  const main = g.spawnEnemyAt(p.x + 30, p.y, SPEAR);
  const near = g.spawnEnemyAt(p.x - 10, p.y + 20, SPEAR); // 부채꼴(반각 100도) 밖이지만 대상 가까이
  const far = g.spawnEnemyAt(p.x + 30, p.y + 160, SPEAR); // 멀리 떨어진 적은 안 맞는다
  g.setInput(a, { ...idle, fire: true });
  run(g, WEAPONS[3]!.windup + 0.2); // 준비 동작이 끝나야 휘두른다
  const dmg = WEAPONS[3]!.damage;
  assert.equal(g.getEnemy(main)?.hp ?? 0, Math.max(0, ENEMY_STATS[SPEAR]!.hp - dmg), "정면의 대상은 전부 맞는다");
  assert.ok(Math.abs(g.getEnemy(near)!.hp - (ENEMY_STATS[SPEAR]!.hp - dmg * TUNE.SPLASH_FACTOR)) < 1e-6, "주변 적은 절반만 맞는다");
  assert.equal(g.getEnemy(far)!.hp, ENEMY_STATS[SPEAR]!.hp);
});

test("검을 들면 정면 피해가 절반이고, 창을 들면 기병의 돌격이 반사된다", () => {
  const hpLost = (weapon: number, enemyType: number, momentum = 0) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = me(g, a);
    g.setWeapon(a, weapon);
    g.setInput(a, { ...idle, aim: 0 }); // 동쪽을 본다
    const e = g.spawnEnemyAt(p.x + 25, p.y, enemyType); // 정면
    if (momentum) (g.getEnemy(e) as { momentum: number }).momentum = momentum;
    run(g, 0.9);
    return { lost: TUNE.PLAYER_MAX_HP - me(g, a).hp, enemyHp: g.getEnemy(e)?.hp ?? 0 };
  };
  const bow = hpLost(0, SPEAR).lost;
  const sword = hpLost(2, SPEAR).lost;
  assert.equal(bow, ENEMY_STATS[SPEAR]!.damage);
  assert.ok(Math.abs(sword - bow * HERO_SWORD_FRONT_BLOCK) < 1e-6);
  // 기병의 돌격
  const bonus = chargeBonus(ENEMY_STATS[CAVALRY]!.speed * TUNE.ENEMY_SPEED_MULT, 1); // 적은 이동 속도 배율이 붙는다
  const vsBow = hpLost(0, CAVALRY, 1);
  assert.ok(Math.abs(vsBow.lost - (ENEMY_STATS[CAVALRY]!.damage + bonus)) < 1e-6);
  const vsSpear = hpLost(1, CAVALRY, 1);
  assert.ok(Math.abs(vsSpear.lost - ENEMY_STATS[CAVALRY]!.damage) < 1e-6, "창을 들면 돌격 피해가 없다");
  assert.ok(vsSpear.enemyHp <= ENEMY_STATS[CAVALRY]!.hp - bonus + 1e-6, "그 피해가 기병에게 돌아간다");
});

test("기병은 달릴수록 속도가 붙고, 공격하면 속도를 잃으며, 돌격 피해는 속도에 비례한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const c = g.addMerc(a, CAVALRY, p.x, p.y + 150);
  g.spawnEnemyAt(p.x + 400, p.y + 150, ARCHER); // 멀리 있는 궁병을 향해 달린다
  g.step();
  const m0 = g.getMerc(c)!.momentum;
  run(g, 1);
  const m1 = g.getMerc(c)!.momentum;
  assert.ok(m1 > m0, "달리면 속도가 오른다");
  assert.ok(m1 <= 1);
  const wire = g.snapshotMercs().find((w) => w[0] === c)!;
  assert.ok(wire[13] > 0, "속도가 클라이언트에 전달된다");
  // 목표에 닿아 공격하면 속도가 크게 준다
  let before = 0;
  for (let i = 0; i < 200; i++) {
    before = Math.max(before, g.getMerc(c)!.momentum);
    g.step();
    if (g.enemyCount === 0) break;
  }
  assert.ok(before > 0.5, "충분히 가속했다");
  assert.equal(g.enemyCount, 0, "궁병이 처치되었다");
  assert.ok(g.getMerc(c)!.momentum < before * 0.9, "공격하면 속도가 줄어든다");
});

test("기병 용병이 창병 적에게 돌격하면 돌격 피해가 자신에게 돌아온다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const c = g.addMerc(a, CAVALRY, p.x + 30, p.y + 150);
  const mx = g.getMerc(c)!.x;
  const my = g.getMerc(c)!.y;
  const e = g.spawnEnemyAt(mx + 25, my, SPEAR); // 어쩔 수 없이 맞서야 하는 거리
  (g.getMerc(c) as { momentum: number }).momentum = 1;
  const full = g.getMerc(c)!.hp;
  run(g, 0.4);
  const bonus = chargeBonus(MERC_STATS[CAVALRY]!.speed, 1);
  assert.ok(g.getMerc(c)!.hp <= full - bonus + 1e-6, "자신이 입힌 만큼의 돌격 피해를 되돌려받는다");
  assert.ok(g.getEnemy(e)!.hp > ENEMY_STATS[SPEAR]!.hp - MERC_STATS[CAVALRY]!.damage * (1 + SWARM_PER_MERC) - 1e-6, "창병은 돌격 피해를 받지 않는다");
});

test("방패는 깨져도 일정 시간 뒤 다시 생기고, 재생 중에는 정면에서도 막지 못한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const m = g.addMerc(a, SHIELD, p.x + 60, p.y);
  const live = g.getMerc(m) as { shield: number; regenT: number };
  const max = MERC_STATS[SHIELD]!.shield;
  assert.equal(live.shield, max);
  live.shield = 0;
  live.regenT = TUNE.SHIELD_REGEN_SEC;
  const wire = g.snapshotMercs().find((w) => w[0] === m)!;
  assert.equal(wire[10], 0);
  assert.equal(wire[11], max);
  assert.ok(wire[14] > 0, "재생 대기 시간이 전달된다");
  run(g, TUNE.SHIELD_REGEN_SEC - 1);
  assert.equal(g.getMerc(m)!.shield, 0);
  run(g, 1.2);
  assert.equal(g.getMerc(m)!.shield, max);
  assert.equal(g.getMerc(m)!.regenT, 0);
});

test("검방병 용병의 방패는 정면의 화살을 막는다(화살은 방패에 25%만 들어간다)", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  const m = g.addMerc(a, SHIELD, p.x + 60, p.y);
  const mm = g.getMerc(m)!;
  g.spawnEnemyAt(mm.x + 140, mm.y, ARCHER); // 정면에서 쏜다
  const hp0 = mm.hp;
  run(g, 4);
  const cur = g.getMerc(m)!;
  assert.equal(cur.hp, hp0, "몸은 맞지 않는다");
  assert.ok(cur.shield < MERC_STATS[SHIELD]!.shield, "방패가 조금 깎였다");
  assert.ok(cur.shield > MERC_STATS[SHIELD]!.shield - ENEMY_STATS[ARCHER]!.damage * 4, "화살 피해의 일부만 들어갔다");
});

test("치명타: 확률이 100%면 기본 피해의 1.5배가 들어가고 이벤트가 나온다", () => {
  const g = new Game(() => 0); // rng가 항상 0이면 치명타가 반드시 난다
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.jumpToStage(10); // 체력이 높은 적(한 방에 죽지 않게)
  g.applyCardForTest(a, { k: "heroCrit", v: 1 });
  g.setWeapon(a, 2); // 검
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  const id = g.spawnEnemyAt(p.x + 40, p.y, 4);
  const base = g.getEnemy(id)!.hp;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.step();
  const dealt = base - g.getEnemy(id)!.hp;
  assert.ok(Math.abs(dealt - WEAPONS[2]!.damage * 1.5) < 1e-6, `${dealt}`);
  assert.ok(g.takeEvents().some((e) => e[0] === 5));
});

test("관통: 화살이 지정한 수만큼 더 많은 적을 맞힌다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.applyCardForTest(a, { k: "heroPierce", v: 1 });
  const ids = [100, 160, 220].map((d) => g.spawnEnemyAt(p.x + d, p.y, 4));
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.step();
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
  run(g, 1);
  const hurt = ids.filter((id) => g.getEnemy(id)!.hp < ENEMY_STATS[4]!.hp).length;
  assert.equal(hurt, 2, "관통 1이면 2명");
});

test("발사 수 카드: 화살이 부채꼴로 더 나가고 늘어난 화살은 약하다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.applyCardForTest(a, { k: "heroMulti", v: 2 });
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.step();
  const snap = g.snapshotPlayers().find((x) => x.id === a)!;
  assert.equal(snap.hs[12], 3, "발사 수 3");
  const bullets = [...(g as any).bullets] as { vy: number; damage: number }[];
  assert.equal(bullets.length, 3);
  const ys = bullets.map((b) => Math.sign(b.vy)).sort();
  assert.deepEqual(ys, [-1, 0, 1]);
  const dmgs = bullets.map((b) => b.damage).sort((x, y) => x - y);
  assert.ok(dmgs[0]! < dmgs[2]!, "늘어난 화살은 피해가 낮다");
  assert.equal(p.id, a);
});

test("독 화살: 몸에 맞으면 시간에 걸쳐 피해가 들어가고, 방패에 막히면 걸리지 않는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.applyCardForTest(a, { k: "heroPoison", v: 3 });
  const id = g.spawnEnemyAt(p.x + 120, p.y, 4);
  const e = (g as any).enemies.get(id);
  e.hp = e.maxHp = 99999;
  e.atkT = 999;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.step();
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
  run(g, 0.6);
  const afterHit = e.hp;
  run(g, 1.5);
  assert.ok(e.hp < afterHit - 3, "독으로 계속 줄어든다");
  run(g, 4);
  const done = e.hp;
  run(g, 2);
  assert.equal(e.hp, done, "독은 끝난다");
  // 방패 정면에 맞으면 독이 없다
  const sh = g.spawnEnemyAt(p.x + 200, p.y + 300, 4);
  const s2 = (g as any).enemies.get(sh);
  s2.hp = s2.maxHp = 99999;
  s2.atkT = 999;
  s2.shield = s2.shieldMax = 99999;
  s2.face = Math.PI / 2 + Math.PI; // 위쪽을 보고 있음(화살이 정면에서 온다)
  g.setInput(a, { dx: 0, dy: 0, aim: Math.atan2(300, 200), fire: true });
  g.step();
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
  run(g, 1);
  assert.ok(!s2.poisonT || s2.poisonT <= 0, "방패에 맞으면 독 없음");
});

test("피해 감소 카드: 고정 수치로 줄고 최소 30%는 들어온다", () => {
  const cards = CARDS.filter((c) => c.effect.k === "heroArmor");
  assert.deepEqual(cards.map((c) => c.rarity), [1, 2], "희귀 이상만");
  const mercArmor = CARDS.filter((c) => c.effect.k === "mercStat" && c.effect.stat === "armor");
  assert.ok(mercArmor.length > 0 && mercArmor.every((c) => c.rarity >= 1));
  const g = quiet();
  const a = g.addPlayer("a")!;
  const armorCut = (x: number, f: number) => (g as any).armorCut(x, f);
  assert.equal(armorCut(10, 4), 6);
  assert.ok(Math.abs(armorCut(10, 50) - 3) < 1e-9);
  assert.equal(armorCut(10, 0), 10);
  g.applyCardForTest(a, { k: "heroArmor", v: 4 });
  assert.equal((g as any).slots.get(a).mods.heroArmor, 4);
});

test("사거리·범위 카드: 주인공 창의 사거리가 늘고 철퇴 범위 공격 반경이 커진다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.setWeapon(a, 1); // 창
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  const far = g.spawnEnemyAt(p.x + WEAPONS[1]!.reach + 22, p.y, 4); // 기본 사거리 밖
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.step();
  assert.equal(g.getEnemy(far)!.hp, ENEMY_STATS[4]!.hp);
  g.applyCardForTest(a, { k: "heroRange", v: 0.5 });
  run(g, 1);
  assert.ok(g.getEnemy(far)!.hp < ENEMY_STATS[4]!.hp);
});

test("용병 능력치 카드: 사거리·범위가 용병 능력치에 반영된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const sp = g.addMerc(a, SPEAR, 0, 0);
  const before = g.mercStatsForTest(sp).reach;
  g.applyCardForTest(a, { k: "mercStat", stat: "range", v: 0.5 });
  assert.ok(Math.abs(g.mercStatsForTest(sp).reach - before * 1.5) < 1e-9);
  const mace = g.addMerc(a, BLUNT, 0, 0);
  const sp0 = g.mercStatsForTest(mace).splash;
  g.applyCardForTest(a, { k: "mercStat", stat: "area", v: 0.5 });
  assert.ok(Math.abs(g.mercStatsForTest(mace).splash - sp0 * 1.5) < 1e-9);
});

test("방어력: 받는 피해가 비율만큼 줄어든다", () => {
  const dealt = (def: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    if (def > 0) g.applyCardForTest(a, { k: "heroDefense", v: def });
    const p = g.getPlayer(a)!;
    g.spawnEnemyAt(p.x + 20, p.y, 4);
    run(g, 1.5);
    return TUNE.PLAYER_MAX_HP - g.getPlayer(a)!.hp;
  };
  const base = dealt(0);
  assert.ok(base > 0);
  assert.ok(Math.abs(dealt(0.5) - base * 0.5) < 1e-6);
});

test("회피율: 확률 100%(상한 50%)에 rng가 0이면 공격을 완전히 피하고 이벤트가 나온다", () => {
  const g = new Game(() => 0);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "heroDodge", v: 1 });
  const p = g.getPlayer(a)!;
  g.spawnEnemyAt(p.x + 20, p.y, 4);
  run(g, 2);
  assert.equal(g.getPlayer(a)!.hp, TUNE.PLAYER_MAX_HP);
  assert.ok(g.takeEvents().some((e) => e[0] === 6));
});

test("용병 체력 재생: 상처 입은 용병이 시간이 지나면 회복한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const m = g.addMerc(a, SHIELD, 0, 0);
  g.applyCardForTest(a, { k: "mercStat", stat: "regen", v: 0.1 });
  (g.getMerc(m) as { hp: number }).hp = 10;
  run(g, 2);
  assert.ok(g.getMerc(m)!.hp > 10 + MERC_STATS[SHIELD]!.hp * 0.15);
});

test("배후 공격: 등 뒤에서 용병이 찌르면 같은 공격이 1.5배 들어간다", () => {
  const dealt = (heroSide: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    p.x = 0;
    p.y = 0;
    // 적(둔기병)은 가장 가까운 아군(주인공)을 바라본다. 주인공이 반대편에 있으면 용병에게 등을 보인 셈이다.
    const e = g.spawnEnemyAt(300 + 0, 0, BLUNT);
    const en = g.getEnemy(e)!;
    p.x = en.x + heroSide * 20;
    const m = g.addMerc(a, SPEAR, en.x - 45, 0);
    void m;
    run(g, 0.4);
    return ENEMY_STATS[BLUNT]!.hp - g.getEnemy(e)!.hp;
  };
  const back = dealt(+1); // 주인공은 동쪽, 용병은 서쪽 → 용병이 등 뒤
  const front = dealt(-1); // 주인공도 서쪽 → 적이 서쪽을 보고 있다
  assert.ok(back > 0 && front > 0, `${back} ${front}`);
  assert.ok(Math.abs(back / front - 1.5) < 0.01, `${back / front}`);
});

// --- 피해 숫자 이벤트 ---------------------------------------------------------

import { EVT_DMG_ALLY, EVT_DMG_ENEMY, EVT_DMG_ENEMY_CRIT, EVT_DMG_SHIELD } from "@mercenary/shared";

test("피해 숫자: 내가 적에게 준 피해와 적이 방패로 막은 피해, 내가 입은 피해가 따로 나온다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.jumpToStage(10);
  g.setWeapon(a, 2); // 검
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  const e = g.spawnEnemyAt(p.x + 40, p.y, BLUNT);
  (g.getEnemy(e) as { hp: number; maxHp: number }).hp = (g.getEnemy(e) as { maxHp: number }).maxHp = 99999;
  g.setInput(a, { ...idle, fire: true });
  g.step();
  const ev = g.takeEvents().filter((x) => x[0] === EVT_DMG_ENEMY);
  assert.equal(ev.length, 1);
  assert.equal(ev[0]![5], a, "때린 사람 번호");
  assert.ok(Math.abs(ev[0]![4] - WEAPONS[2]!.damage) < 0.11, `${ev[0]![4]}`);
  // 적이 때리면 입은 피해(받은 사람 번호)
  g.setInput(a, idle);
  run(g, 2);
  const taken = g.takeEvents().filter((x) => x[0] === EVT_DMG_ALLY);
  assert.ok(taken.length > 0 && taken.every((x) => x[5] === a));
});

test("피해 숫자: 치명타는 따로 표시되고, 방패에 막힌 피해는 방패 종류로 나온다", () => {
  const g = new Game(() => 0);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "heroCrit", v: 1 });
  const p = g.getPlayer(a)!;
  g.jumpToStage(10);
  const e = g.spawnEnemyAt(p.x + 40, p.y, SHIELD);
  const en = g.getEnemy(e) as { face: number; hp: number; maxHp: number };
  en.face = Math.PI; // 주인공을 바라본다(정면에서 맞는다)
  g.setWeapon(a, 2);
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  g.takeEvents();
  g.setInput(a, { ...idle, fire: true });
  g.step();
  const ev = g.takeEvents();
  assert.ok(ev.some((x) => x[0] === EVT_DMG_SHIELD && x[4] > 0), "방패가 막은 피해");
  const g2 = new Game(() => 0);
  g2.autoSpawn = false;
  const b = g2.addPlayer("b")!;
  g2.applyCardForTest(b, { k: "heroCrit", v: 1 });
  const pb = g2.getPlayer(b)!;
  g2.jumpToStage(10);
  g2.spawnEnemyAt(pb.x + 40, pb.y, ARCHER);
  g2.setWeapon(b, 2);
  run(g2, WEAPON_SWITCH_DELAY_SEC + 0.1);
  g2.takeEvents();
  g2.setInput(b, { ...idle, fire: true });
  g2.step();
  assert.ok(g2.takeEvents().some((x) => x[0] === EVT_DMG_ENEMY_CRIT));
});

test("피해 숫자: 같은 대상에게 한 틱에 여러 번 들어간 피해는 하나로 합쳐진다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.jumpToStage(10);
  const e = g.spawnEnemyAt(500, 500, BLUNT);
  const en = g.getEnemy(e) as { hp: number; maxHp: number; shield: number };
  en.hp = en.maxHp = 99999;
  const dmg = g as unknown as { damageEnemy(e: unknown, h: unknown, o: number): number };
  for (let i = 0; i < 3; i++) dmg.damageEnemy(en, { damage: 10, charge: 0, srcType: -1, fromAngle: Math.atan2(-500, -500) }, a); // 적이 바라보는 쪽(정면)에서
  const ev = g.takeEvents().filter((x) => x[0] === EVT_DMG_ENEMY);
  assert.equal(ev.length, 1);
  assert.ok(Math.abs(ev[0]![4] - 30) < 0.5, `${ev[0]![4]}`);
});
