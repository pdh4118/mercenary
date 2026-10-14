import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BLUNT,
  CARDS,
  CAVALRY,
  GLOBAL_CARD_FACTOR,
  MAX_TIER,
  MERC_STATS,
  MERC_STAT_BASE,
  OFFER_SIZE,
  REROLL_MAX,
  REROLL_START,
  SHIELD,
  SPEAR,
  TIER_HP,
  TIER_NAMES,
  UNIT_TYPES,
  upgradeCost,
  xpNeeded,
} from "@mercenary/shared";
import { Game } from "../src/game.js";

const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};

test("전체 용병 카드는 병종 전용 카드의 20% 효과다", () => {
  const globals = CARDS.filter((c) => c.effect.k === "mercStat" && c.effect.type === undefined);
  const types = CARDS.filter((c) => c.effect.k === "mercStat" && c.effect.type !== undefined);
  assert.ok(globals.length >= 10 && types.length >= 25);
  for (const c of globals) {
    if (c.effect.k !== "mercStat") continue;
    assert.ok(Math.abs(c.effect.v - MERC_STAT_BASE[c.effect.stat] * GLOBAL_CARD_FACTOR) < 1e-3, c.name);
  }
  // 병종마다 5가지 전용 카드가 있고, 모두 그 병종을 가진 사람에게만 나온다
  for (const t of UNIT_TYPES) assert.equal(types.filter((c) => c.unitType === t).length, 5);
});

test("카드를 고를 때마다 새로고침이 1회씩 쌓이고 상한이 있다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  assert.equal(g.getPlayer(a)!.rerolls, REROLL_START);
  for (let i = 0; i < REROLL_MAX + 2; i++) {
    g.giveXp(a, xpNeeded(g.getPlayer(a)!.level));
    assert.equal(g.pick(a, 0), true);
  }
  assert.equal(g.getPlayer(a)!.rerolls, REROLL_MAX);
});

test("새로고침: 제시된 카드를 다시 뽑고(겹치지 않게) 횟수를 쓴다. 없으면 실패", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  assert.equal(g.reroll(a), false, "제시된 카드가 없으면 못 한다");
  g.giveXp(a, xpNeeded(1));
  const p = g.getPlayer(a)!;
  const first = [...p.offer];
  assert.equal(g.reroll(a), true);
  assert.equal(p.rerolls, REROLL_START - 1);
  assert.equal(p.offer.length, OFFER_SIZE);
  assert.ok(p.offer.every((i) => !first.includes(i)), "방금 본 카드는 빠진다");
  assert.equal(g.reroll(a), false, "횟수가 없다");
  assert.equal(p.pending, 1, "선택 횟수는 그대로");
});

test("병종 전용 카드는 그 병종을 가진 사람에게만 나온다", () => {
  const g = new Game(() => 0.5);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.addMerc(a, ARCHER, 0, 0);
  for (let n = 0; n < 40; n++) {
    g.giveXp(a, xpNeeded(g.getPlayer(a)!.level));
    for (const i of g.getPlayer(a)!.offer) {
      const t = CARDS[i]!.unitType;
      assert.ok(t === undefined || t === ARCHER, CARDS[i]!.name);
    }
    g.pick(a, 0);
  }
});

test("병종 카드: 기병 속도 카드는 기병만 빠르게 한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const cav = g.addMerc(a, CAVALRY, 0, 0);
  const sp = g.addMerc(a, SPEAR, 0, 0);
  g.applyCardForTest(a, { k: "mercStat", stat: "speed", v: 0.12, type: CAVALRY });
  assert.ok(Math.abs(g.mercStatsForTest(cav).speed - MERC_STATS[CAVALRY]!.speed * 1.12) < 1e-9);
  assert.equal(g.mercStatsForTest(sp).speed, MERC_STATS[SPEAR]!.speed);
  // 전체 카드와 병종 카드는 함께 적용된다
  g.applyCardForTest(a, { k: "mercStat", stat: "speed", v: 0.024 });
  assert.ok(Math.abs(g.mercStatsForTest(cav).speed - MERC_STATS[CAVALRY]!.speed * 1.12 * 1.024) < 1e-9);
});

test("용병 강화: 단계가 오를 때마다 금화를 내고 능력치가 오르며 최고 단계에서 멈춘다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const m = g.addMerc(a, SPEAR, 0, 0);
  const base = MERC_STATS[SPEAR]!;
  assert.equal(TIER_NAMES[SPEAR]![0], "창병");
  assert.equal(TIER_NAMES[SPEAR]![1], "장창병");
  assert.equal(TIER_NAMES[SPEAR]![2], "중갑 장창병");
  p.gold = 0;
  assert.equal(g.upgrade(a, m).ok, false, "금화 부족");
  p.gold = 100000;
  for (let tier = 0; tier < MAX_TIER; tier++) {
    const gold = p.gold;
    assert.equal(g.upgrade(a, m).ok, true);
    assert.equal(p.gold, gold - upgradeCost(SPEAR, tier)!);
    assert.equal(g.getMerc(m)!.tier, tier + 1);
    assert.equal(g.getMerc(m)!.hp, Math.round(base.hp * TIER_HP[tier + 1]!), "강화하면 늘어난 체력만큼 회복");
  }
  assert.equal(g.upgrade(a, m).ok, false, "최고 단계");
  const stats = g.mercStatsForTest(m);
  assert.ok(stats.reach > base.reach && stats.damage > base.damage * 2, "창병은 사거리도 늘어난다");
  assert.equal(g.snapshotMercs().find((w) => w[0] === m)![15], MAX_TIER, "전송에 단계가 실린다");
});

test("용병 강화: 남의 용병이나 없는 용병은 강화할 수 없고, 해고 환급에는 강화 비용도 포함된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  const m = g.addMerc(a, SHIELD, 0, 0, 50);
  g.getPlayer(b)!.gold = 10000;
  assert.equal(g.upgrade(b, m).ok, false);
  assert.equal(g.upgrade(a, 99999).ok, false);
  assert.equal(g.upgrade(a, "x").ok, false);
  g.getPlayer(a)!.gold = 1000;
  g.upgrade(a, m);
  const cost = upgradeCost(SHIELD, 0)!;
  const camp = g.spawnCampAt(g.getPlayer(a)!.x, g.getPlayer(a)!.y, [0, 1, 2]);
  const gold = g.getPlayer(a)!.gold;
  assert.equal(g.dismiss(a, SHIELD).ok, true);
  assert.equal(g.getPlayer(a)!.gold, gold + Math.floor((50 + cost) * 0.5));
  void camp;
});

test("둔기병 강화는 범위가, 검방병 강화는 방패가 커진다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.getPlayer(a)!.gold = 100000;
  const mace = g.addMerc(a, BLUNT, 0, 0);
  const sh = g.addMerc(a, SHIELD, 0, 0);
  const s0 = g.mercStatsForTest(mace).splash;
  const sh0 = g.mercStatsForTest(sh).shield;
  g.upgrade(a, mace);
  g.upgrade(a, sh);
  assert.ok(g.mercStatsForTest(mace).splash > s0);
  assert.ok(g.mercStatsForTest(sh).shield > sh0 * TIER_HP[1]!);
});
