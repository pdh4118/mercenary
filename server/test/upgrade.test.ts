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
  assert.equal(g.upgrade(a, m).ok, false, "경험치가 없으면 강화할 수 없다");
  for (let tier = 0; tier < MAX_TIER; tier++) {
    const gold = p.gold;
    g.grantMercXpForTest(m, 100000);
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
  g.grantMercXpForTest(m, 1000);
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
  g.grantMercXpForTest(mace, 1000);
  g.grantMercXpForTest(sh, 1000);
  g.upgrade(a, mace);
  g.upgrade(a, sh);
  assert.ok(g.mercStatsForTest(mace).splash > s0);
  assert.ok(g.mercStatsForTest(sh).shield > sh0 * TIER_HP[1]!);
});

// --- 용병 이름·경험치·전설 -----------------------------------------------------

import {
  ARCHER as ARCHER_T,
  ENEMY_STATS,
  LEGENDS,
  LEGEND_CONST,
  MERC_NAME_COUNT,
  MERC_XP_KILL,
  MERC_XP_NEED,
  PLAYER_MAX_HP,
  mercName,
  type LegendId,
} from "@mercenary/shared";

const legendIdx = (id: LegendId) => CARDS.findIndex((c) => c.effect.k === "legend" && c.effect.id === id);
const mercWire = (g: Game, id: number) => g.snapshotMercs().find((w) => w[0] === id)!;
const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * 20); i++) g.step();
};

test("용병 이름: 이름이 붙고, 같은 주인의 용병끼리는 겹치지 않는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const ids = Array.from({ length: 16 }, () => g.addMerc(a, SPEAR, 0, 0));
  const names = ids.map((id) => mercName(mercWire(g, id)[16]));
  assert.equal(new Set(names).size, 16);
  assert.ok(names.every((n) => n.includes(" ") && n.length >= 3));
  assert.equal(mercName(0), mercName(MERC_NAME_COUNT), "번호는 순환한다");
});

test("용병 경험치: 피해를 주거나 받으면 조금, 막타를 치면 많이 오른다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const m = g.addMerc(a, SPEAR, p.x + 40, p.y);
  const e = g.spawnEnemyAt(p.x + 90, p.y, 4);
  (g.getEnemy(e) as { hp: number }).hp = 10_000; // 죽지 않게
  (g.getEnemy(e) as { maxHp: number }).maxHp = 10_000;
  run(g, 4);
  const xp = mercWire(g, m)[17];
  assert.ok(xp > 0 && xp < MERC_XP_KILL, `준·받은 피해 경험치만으로는 막타보다 적다 (${xp})`);
  // 막타
  const e2 = g.spawnEnemyAt(p.x + 80, p.y, 0);
  (g.getEnemy(e2) as { hp: number }).hp = 1;
  const before = g.getMerc(m)!.xp;
  run(g, 3);
  assert.ok(g.getMerc(m)!.xp - before >= MERC_XP_KILL * 0.9, "막타 경험치");
});

test("용병 강화는 경험치를 모아야 가능하고, 강화하면 경험치가 소모된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.getPlayer(a)!.gold = 10_000;
  const m = g.addMerc(a, ARCHER_T, 0, 0);
  const r = g.upgrade(a, m);
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.reason.includes("경험치"));
  g.grantMercXpForTest(m, MERC_XP_NEED[0] + 5);
  assert.equal(g.upgrade(a, m).ok, true);
  assert.ok(Math.abs(g.getMerc(m)!.xp - 5) < 1e-9, "남은 경험치는 이어진다");
  assert.equal(g.upgrade(a, m).ok, false, "다음 단계는 다시 모아야 한다");
});

test("레벨업이 잦다: 첫 레벨은 적 몇 마리로 오른다", () => {
  assert.ok(xpNeeded(1) <= 15);
  assert.ok(xpNeeded(10) <= 100);
});

test("전설 카드: 드물고 한 번만 나오며 다섯 이상의 레벨에서부터 등장한다", () => {
  const legends = CARDS.filter((c) => c.category === 3);
  assert.equal(legends.length, Object.keys(LEGENDS).length);
  assert.ok(legends.every((c) => c.unique && (c.minLevel ?? 1) >= 5 && c.weight <= 2));
  const g = new Game(() => 0.999);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.level = 8;
  g.giveXp(a, 1);
  p.pending = 1;
  p.offer = [legendIdx("thorns"), 0, 1];
  g.pick(a, 0);
  assert.deepEqual(p.legends, ["thorns"]);
  for (let n = 0; n < 60; n++) {
    g.giveXp(a, xpNeeded(p.level));
    assert.ok(!p.offer.includes(legendIdx("thorns")), "이미 고른 전설은 다시 나오지 않는다");
    g.pick(a, 0);
  }
});

test("전설 효과: 처형은 체력이 낮은 적에게 피해가 2배", () => {
  const dmg = (legend: boolean) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    if (legend) g.applyCardForTest(a, { k: "legend", id: "execute" });
    const p = g.getPlayer(a)!;
    g.jumpToStage(10);
    const e = g.spawnEnemyAt(p.x + 40, p.y, 4);
    const en = g.getEnemy(e) as { hp: number; maxHp: number };
    en.maxHp = 10_000;
    en.hp = 2_000;
    const before = en.hp;
    g.setWeapon(a, 3);
    run(g, 0.3);
    g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
    g.step();
    return before - g.getEnemy(e)!.hp;
  };
  assert.ok(Math.abs(dmg(true) - dmg(false) * LEGEND_CONST.executeMult) < 1e-6);
});

test("전설 효과: 가시 갑옷은 받은 피해의 일부를 공격자에게 되돌린다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "legend", id: "thorns" });
  const p = g.getPlayer(a)!;
  const e = g.spawnEnemyAt(p.x + 20, p.y, 4);
  const hp0 = g.getEnemy(e)!.hp;
  run(g, 2);
  const taken = PLAYER_MAX_HP - g.getPlayer(a)!.hp;
  assert.ok(taken > 0);
  assert.ok(Math.abs(hp0 - g.getEnemy(e)!.hp - taken * LEGEND_CONST.thornsFrac) < 1e-6 || g.getEnemy(e)!.hp < hp0);
});

test("전설 효과: 피의 갈증은 준 피해만큼 체력을 회복한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "legend", id: "bloodthirst" });
  const p = g.getPlayer(a)!;
  p.hp = 50;
  g.jumpToStage(10);
  const e = g.spawnEnemyAt(p.x + 40, p.y, 4);
  g.setWeapon(a, 3);
  run(g, 0.3);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.step();
  assert.ok(p.hp > 50);
  void e;
});

test("전설 효과: 전장의 함성은 처치할수록 용병 공격 속도가 오르고 시간이 지나면 풀린다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "legend", id: "warcry" });
  const m = g.addMerc(a, SPEAR, 0, 0);
  const base = g.mercStatsForTest(m).cooldown;
  const p = g.getPlayer(a)!;
  for (let i = 0; i < 3; i++) {
    const e = g.spawnEnemyAt(p.x + 30, p.y, 0);
    (g.getEnemy(e) as { hp: number }).hp = 0.1;
    g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
    run(g, 0.5);
  }
  assert.ok(g.mercStatsForTest(m).cooldown < base * 0.9, "공격 대기시간이 줄었다");
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
  run(g, LEGEND_CONST.warcrySec + 1);
  assert.ok(Math.abs(g.mercStatsForTest(m).cooldown - base) < 1e-9);
});

test("전설 효과: 불사의 군단은 확률로 쓰러지지 않고 되살아난다", () => {
  const g = new Game(() => 0); // rng 0 → 확률 판정은 항상 통과
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "legend", id: "undying" });
  const m = g.addMerc(a, SPEAR, 0, 0);
  (g as unknown as { hurtMerc(m: unknown, n: number): void }).hurtMerc(g.getMerc(m), 10_000);
  assert.equal(g.getMerc(m)!.respawn, 0);
  assert.ok(g.getMerc(m)!.hp > 0);
});

test("전설 효과: 관통 증폭·돌격 가속·광역 증폭·폭풍 연사가 능력치에 반영된다", () => {
  const g = new Game(() => 0);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "legend", id: "pierceRamp" });
  g.applyCardForTest(a, { k: "heroPierce", v: 2 });
  const p = g.getPlayer(a)!;
  const ids = [90, 140, 190].map((d) => g.spawnEnemyAt(p.x + d, p.y, 4));
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.step();
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
  run(g, 1);
  const dealt = ids.map((id) => ENEMY_STATS[4]!.hp - g.getEnemy(id)!.hp);
  assert.ok(dealt[1]! > dealt[0]! * 1.3 && dealt[2]! > dealt[1]! * 1.3, `${dealt}`);
  // 폭풍 연사: 치명타(rng 0이면 항상)면 쿨다운이 사라져 다음 틱에도 공격한다
  const g2 = new Game(() => 0);
  g2.autoSpawn = false;
  const b = g2.addPlayer("b")!;
  g2.applyCardForTest(b, { k: "legend", id: "stormfire" });
  g2.applyCardForTest(b, { k: "heroCrit", v: 1 });
  const hits: number[] = [];
  const bp = g2.getPlayer(b)!;
  const target = g2.spawnEnemyAt(bp.x + 10, bp.y, 4);
  (g2.getEnemy(target) as { hp: number; maxHp: number }).hp = 100000;
  (g2.getEnemy(target) as { hp: number; maxHp: number }).maxHp = 100000;
  g2.setWeapon(b, 2); // 검
  run(g2, 0.3);
  g2.setInput(b, { dx: 0, dy: 0, aim: 0, fire: true });
  for (let i = 0; i < 4; i++) {
    const before = g2.getEnemy(target)!.hp;
    g2.step();
    hits.push(before - g2.getEnemy(target)!.hp);
  }
  assert.ok(hits.every((h) => h > 0), `매 틱 공격 ${hits}`);
});
