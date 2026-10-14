import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMP_TIER_SEC,
  MAX_TIER,
  MERC_RESPAWN_SEC,
  MERC_STATS,
  SHAKEN_DEATHS,
  SHAKEN_DMG,
  SHAKEN_SEC,
  SPEAR,
  SWARM_MAX,
  SWARM_PER_MERC,
  TIER_BUY_MULT,
  TIER_RESPAWN_EXTRA,
  campMaxTier,
  decodeOffer,
  encodeOffer,
  mercPrice,
  unitCost,
} from "@mercenary/shared";
import { Game } from "../src/game.js";

const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};
const hurt = (g: Game, id: number, n: number) => (g as unknown as { hurtMerc(m: unknown, n: number): void }).hurtMerc(g.getMerc(id), n);

test("통솔력: 단계가 오를수록 +1씩 더 든다", () => {
  assert.equal(unitCost(SPEAR, 0), 1);
  assert.equal(unitCost(SPEAR, 4), 5);
  assert.equal(unitCost(0, 2), 4, "기병은 기본 2");
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.addMerc(a, SPEAR, 0, 0, 0, 3);
  g.addMerc(a, SPEAR, 0, 0);
  assert.equal(g.leadershipUsed(a), 4 + 1);
});

test("강화에는 통솔력 +1이 필요하다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.gold = 100000;
  p.leadership = 1;
  const m = g.addMerc(a, SPEAR, 0, 0);
  g.grantMercXpForTest(m, 1000);
  const r = g.upgrade(a, m);
  assert.ok(!r.ok && r.reason.includes("통솔력"));
  p.leadership = 2;
  assert.equal(g.upgrade(a, m).ok, true);
});

test("캠프는 시간이 지날수록 높은 단계 용병을 내놓는다", () => {
  assert.equal(campMaxTier(0), 0);
  assert.equal(campMaxTier(CAMP_TIER_SEC * 2 + 1), 2);
  assert.equal(campMaxTier(1e9), MAX_TIER);
  assert.deepEqual(decodeOffer(encodeOffer(3, 2)), { type: 3, tier: 2 });
  const tiersAt = (time: number) => {
    const g = new Game(() => Math.random());
    g.time = time; // 시간이 흐른 판
    g.autoSpawn = true;
    g.addPlayer("a");
    const seen = new Set<number>();
    for (let n = 0; n < 40; n++) {
      const id = g.spawnCampAt(0, 0, (g as unknown as { pickOffers(): number[] }).pickOffers());
      void id;
    }
    for (const w of g.snapshotCamps()) for (const code of [w[4], w[5], w[6]]) seen.add(decodeOffer(code).tier);
    return Math.max(...seen);
  };
  assert.equal(tiersAt(10), 0);
  assert.ok(tiersAt(CAMP_TIER_SEC * 4 + 1) === MAX_TIER);
});

test("높은 단계 용병은 비싸게 사고, 단계 그대로 합류한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.gold = 100000;
  p.leadership = 20;
  const camp = g.spawnCampAt(p.x, p.y, [encodeOffer(SPEAR, 3), SPEAR, 0]);
  const gold = p.gold;
  assert.equal(g.buy(a, camp, 0).ok, true);
  assert.equal(p.gold, gold - Math.round(mercPrice(SPEAR, 0) * TIER_BUY_MULT[3]!));
  const merc = g.snapshotMercs()[0]!;
  assert.equal(merc[15], 3, "3단계로 합류");
  assert.equal(g.leadershipUsed(a), unitCost(SPEAR, 3));
  // 통솔력이 모자라면 못 산다
  p.leadership = 3;
  assert.equal(g.buy(a, camp, 0).ok, false);
});

test("군세: 살아 있는 용병이 많을수록 공격력이 오르고 상한이 있다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.getPlayer(a)!.leadership = 99;
  const ids = Array.from({ length: 4 }, () => g.addMerc(a, SPEAR, 0, 0));
  g.step();
  assert.ok(Math.abs(g.getPlayer(a)!.swarm - 4 * SWARM_PER_MERC) < 1e-9);
  assert.ok(Math.abs(g.mercStatsForTest(ids[0]!).damage - MERC_STATS[SPEAR]!.damage * (1 + 4 * SWARM_PER_MERC)) < 1e-9);
  for (let i = 0; i < 20; i++) g.addMerc(a, SPEAR, 0, 0);
  g.step();
  assert.equal(g.getPlayer(a)!.swarm, SWARM_MAX);
});

test("사기 저하: 짧은 시간에 여럿이 쓰러지면 한동안 공격력이 떨어지고, 시간이 지나면 풀린다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const ids = Array.from({ length: SHAKEN_DEATHS + 2 }, () => g.addMerc(a, SPEAR, 0, 0));
  g.step();
  const before = g.mercStatsForTest(ids[SHAKEN_DEATHS]!).damage;
  for (let i = 0; i < SHAKEN_DEATHS; i++) hurt(g, ids[i]!, 10_000);
  assert.ok(g.getPlayer(a)!.shaken > 0);
  g.step();
  const during = g.mercStatsForTest(ids[SHAKEN_DEATHS]!).damage;
  // 쓰러진 만큼 군세도 줄어 있다
  const swarmNow = g.getPlayer(a)!.swarm;
  assert.ok(Math.abs(during - MERC_STATS[SPEAR]!.damage * (1 + swarmNow) * SHAKEN_DMG) < 1e-9);
  assert.ok(during < before * 0.85);
  for (let i = 0; i < (SHAKEN_SEC + 1) * 20; i++) g.step();
  assert.equal(g.getPlayer(a)!.shaken, 0);
});

test("느리게 하나씩 쓰러지는 것은 사기 저하가 아니다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const ids = Array.from({ length: 6 }, () => g.addMerc(a, SPEAR, 0, 0));
  for (let i = 0; i < SHAKEN_DEATHS + 1; i++) {
    hurt(g, ids[i]!, 10_000);
    for (let k = 0; k < 7 * 20; k++) g.step(); // 판정 시간 밖
  }
  assert.equal(g.getPlayer(a)!.shaken, 0);
});

test("부활 시간: 병종 기본값에 단계마다 15%가 더해진다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const lo = g.addMerc(a, SPEAR, 0, 0);
  const hi = g.addMerc(a, SPEAR, 0, 0, 0, 4);
  hurt(g, lo, 10_000);
  hurt(g, hi, 10_000);
  assert.ok(Math.abs(g.getMerc(lo)!.respawn - MERC_RESPAWN_SEC[SPEAR]) < 1e-9);
  assert.ok(Math.abs(g.getMerc(hi)!.respawn - MERC_RESPAWN_SEC[SPEAR] * (1 + 4 * TIER_RESPAWN_EXTRA)) < 1e-9);
});
