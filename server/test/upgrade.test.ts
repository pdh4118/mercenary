import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UNIT_NAMES as UNIT_NAMES_T,
  ARCHER,
  BLUNT,
  CARDS,
  CAVALRY,
  GLOBAL_CARD_FACTOR,
  MAX_TIER,
  MERC_STATS,
  MERC_TYPE_FOCUS,
  RARITY,
  RARITY_NAMES,
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
  TUNE,
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
  assert.ok(globals.length >= 30 && types.length >= 60);
  for (const c of globals) {
    if (c.effect.k !== "mercStat") continue;
    const stat = c.effect.stat;
    const typed = types.find((t) => t.effect.k === "mercStat" && t.effect.stat === stat && t.rarity === c.rarity)!;
    if (typed.effect.k !== "mercStat") continue;
    assert.ok(Math.abs(c.effect.v - typed.effect.v * GLOBAL_CARD_FACTOR) < 1e-3, c.name);
  }
  // 병종마다 전용 능력치마다 일반/희귀/영웅 세 등급이 있고, 모두 그 병종을 가진 사람에게만 나온다
  for (const t of UNIT_TYPES) assert.equal(types.filter((c) => c.unitType === t).length, MERC_TYPE_FOCUS[t]!.reduce((n, st) => n + (st === "armor" ? 2 : 3), 0));
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
  KNOCK_BOSS_FACTOR,
  MERC_NAME_COUNT,
  MERC_XP_KILL,
  MERC_XP_NEED,
  mercName,
  type LegendId,
} from "@mercenary/shared";

const legendIdx = (id: LegendId, scope: "hero" | number = "hero") => CARDS.findIndex((c) => c.effect.k === "legend" && c.effect.id === id && c.effect.scope === scope);
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
  assert.equal(legends.length, Object.values(LEGENDS).reduce((n, l) => n + l.scopes.length, 0));
  assert.ok(legends.every((c) => c.unique && (c.minLevel ?? 1) >= 5 && c.weight <= 1));
  assert.ok(legends.every((c) => c.effect.k === "legend" && (c.effect.scope === "hero") === (c.unitType === undefined)), "주인공 전용이 아니면 병종 전용");
  const g = new Game(() => 0.999);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.level = 8;
  g.giveXp(a, 1);
  p.pending = 1;
  p.offer = [legendIdx("thorns"), 0, 1];
  g.pick(a, 0);
  assert.deepEqual(p.legends, ["thorns@hero"]);
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
    if (legend) g.applyCardForTest(a, { k: "legend", id: "execute", scope: "hero" });
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
  g.applyCardForTest(a, { k: "legend", id: "thorns", scope: "hero" });
  const p = g.getPlayer(a)!;
  const e = g.spawnEnemyAt(p.x + 20, p.y, 4);
  const hp0 = g.getEnemy(e)!.hp;
  run(g, 2);
  const taken = TUNE.PLAYER_MAX_HP - g.getPlayer(a)!.hp;
  assert.ok(taken > 0);
  assert.ok(Math.abs(hp0 - g.getEnemy(e)!.hp - taken * LEGEND_CONST.thornsFrac) < 1e-6 || g.getEnemy(e)!.hp < hp0);
});

test("전설 효과: 피의 갈증은 준 피해만큼 체력을 회복한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "legend", id: "bloodthirst", scope: "hero" });
  const p = g.getPlayer(a)!;
  p.hp = 50;
  g.jumpToStage(10);
  const e = g.spawnEnemyAt(p.x + 40, p.y, 4);
  g.setWeapon(a, 2);
  run(g, 0.3);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.step();
  assert.ok(p.hp > 50);
  void e;
});

test("전설 효과: 전장의 함성은 적용 대상(병종)이 처치할 때만 쌓이고 시간이 지나면 풀린다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "legend", id: "warcry", scope: SPEAR });
  const sp = g.addMerc(a, SPEAR, 0, 0);
  const sh = g.addMerc(a, SHIELD, 0, 0);
  const base = g.mercStatsForTest(sp).cooldown;
  const p = g.getPlayer(a)!;
  // 주인공이 처치해도 창병에게는 쌓이지 않는다
  const e0 = g.spawnEnemyAt(p.x + 30, p.y, 0);
  (g.getEnemy(e0) as { hp: number }).hp = 0.1;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  run(g, 0.5);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
  assert.equal(g.mercStatsForTest(sp).cooldown, base);
  // 창병이 처치하면 쌓인다(다른 병종에는 영향 없음)
  const shBase = g.mercStatsForTest(sh).cooldown;
  for (let i = 0; i < 3; i++) {
    const m = g.getMerc(sp)!;
    const e = g.spawnEnemyAt(m.x + 30, m.y, 0);
    (g.getEnemy(e) as { hp: number }).hp = 0.1;
    run(g, 1.2);
  }
  assert.ok(g.mercStatsForTest(sp).cooldown < base * 0.9, "창병 공격 대기시간이 줄었다");
  assert.equal(g.mercStatsForTest(sh).cooldown, shBase);
  run(g, LEGEND_CONST.warcrySec + 1);
  assert.ok(Math.abs(g.mercStatsForTest(sp).cooldown - base) < 1e-9);
});

test("전설은 지정한 대상에게만 적용된다: 창병 불사는 검방병에게 효과가 없다", () => {
  const g = new Game(() => 0);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "legend", id: "undying", scope: SPEAR });
  const sh = g.addMerc(a, SHIELD, 0, 0);
  (g as unknown as { hurtMerc(m: unknown, n: number): void }).hurtMerc(g.getMerc(sh), 10_000);
  assert.ok(g.getMerc(sh)!.respawn > 0, "검방병은 그냥 쓰러진다");
});

test("주인공 전설은 용병에게 적용되지 않는다: 주인공 처형은 용병 피해를 늘리지 않는다", () => {
  const dealt = (legend: boolean) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    if (legend) g.applyCardForTest(a, { k: "legend", id: "execute", scope: "hero" });
    const p = g.getPlayer(a)!;
    const m = g.addMerc(a, SPEAR, p.x + 40, p.y);
    const e = g.spawnEnemyAt(p.x + 90, p.y, 4);
    const en = g.getEnemy(e) as { hp: number; maxHp: number };
    en.maxHp = 10_000;
    en.hp = 2_000;
    run(g, 1.5);
    void m;
    return 2_000 - g.getEnemy(e)!.hp;
  };
  assert.ok(Math.abs(dealt(true) - dealt(false)) < 1e-6);
});

test("전설 효과: 불사의 군단은 확률로 쓰러지지 않고 되살아난다", () => {
  const g = new Game(() => 0); // rng 0 → 확률 판정은 항상 통과
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "legend", id: "undying", scope: SPEAR });
  const m = g.addMerc(a, SPEAR, 0, 0);
  (g as unknown as { hurtMerc(m: unknown, n: number): void }).hurtMerc(g.getMerc(m), 10_000);
  assert.equal(g.getMerc(m)!.respawn, 0);
  assert.ok(g.getMerc(m)!.hp > 0);
});

test("전설 효과: 관통 증폭·돌격 가속·광역 증폭·폭풍 연사가 능력치에 반영된다", () => {
  const g = new Game(() => 0);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "legend", id: "pierceRamp", scope: "hero" });
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
  g2.applyCardForTest(b, { k: "legend", id: "stormfire", scope: "hero" });
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

test("모든 병종은 공격 속도 카드를 가진다(화살이 범위가 없는 궁병은 범위 제외)", () => {
  const has = (t: number, stat: string) => CARDS.some((c) => c.effect.k === "mercStat" && c.effect.type === t && c.effect.stat === stat);
  for (const t of UNIT_TYPES) assert.ok(has(t, "atkSpeed"), UNIT_NAMES_T[t]);
  for (const t of UNIT_TYPES) if (t !== ARCHER_T) assert.ok(has(t, "area"));
  assert.ok(CARDS.some((c) => c.effect.k === "heroFireRate") && CARDS.some((c) => c.effect.k === "heroArea"));
});

test("수치 카드 등급: 같은 능력치라도 희귀·영웅은 효과가 크고 드물며 늦게 나온다", () => {
  const byRarity = (stat: string, r: number) => CARDS.find((c) => c.effect.k === "mercStat" && c.effect.type === SPEAR && c.effect.stat === stat && c.rarity === r)!;
  const [c0, c1, c2] = [0, 1, 2].map((r) => byRarity("hp", r));
  const v = (c: (typeof CARDS)[number]) => (c.effect.k === "mercStat" ? c.effect.v : 0);
  assert.ok(v(c0!) < v(c1!) && v(c1!) < v(c2!));
  assert.ok(Math.abs(v(c1!) / v(c0!) - RARITY[1].mult) < 0.01 && Math.abs(v(c2!) / v(c0!) - RARITY[2].mult) < 0.01);
  assert.ok(c0!.weight > c1!.weight && c1!.weight > c2!.weight);
  assert.ok((c0!.minLevel ?? 1) < (c1!.minLevel ?? 1) && (c1!.minLevel ?? 1) < (c2!.minLevel ?? 1));
  assert.deepEqual([c0!.stars, c1!.stars, c2!.stars], [1, 2, 3]);
  assert.deepEqual(RARITY_NAMES.slice(0, 3), ["일반", "희귀", "영웅"]);
  // 관통은 1/2/3, 통솔력도 1/2/3
  const pierce = [0, 1, 2].map((r) => CARDS.find((c) => c.effect.k === "heroPierce" && c.rarity === r)!.effect);
  assert.deepEqual(pierce.map((e) => (e.k === "heroPierce" ? e.v : 0)), [1, 2, 3]);
  const lead = [0, 1, 2].map((r) => CARDS.find((c) => c.effect.k === "leadership" && c.rarity === r)!.effect);
  assert.deepEqual(lead.map((e) => (e.k === "leadership" ? e.v : 0)), [1, 2, 3]);
});

test("레벨이 낮으면 희귀·영웅 카드는 나오지 않는다", () => {
  const g = new Game(() => 0.5);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.addMerc(a, ARCHER_T, 0, 0);
  for (let n = 0; n < 1; n++) {
    g.giveXp(a, xpNeeded(g.getPlayer(a)!.level));
    const p = g.getPlayer(a)!;
    for (const i of p.offer) assert.equal(CARDS[i]!.rarity, 0, `${p.level}레벨에서 ${CARDS[i]!.name}`);
    g.pick(a, 0);
  }
});

test("넉백: 맞은 적이 공격해 온 반대쪽으로 밀려나고 공격 동작이 끊긴다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "heroKnock", v: 60 });
  const p = g.getPlayer(a)!;
  g.jumpToStage(10); // 한 방에 죽지 않게
  const e = g.spawnEnemyAt(p.x + 40, p.y, 4);
  g.setWeapon(a, 2);
  run(g, 0.3);
  const x0 = g.getEnemy(e)!.x;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.step();
  const en = g.getEnemy(e)!;
  assert.ok(en.x - x0 > 50 && en.x - x0 <= 60, `${en.x - x0}`); // 같은 틱에 조금 되돌아온 몫을 뺀다
  assert.equal(en.atkT, 0);
  assert.ok(en.cd >= 0.3, "잠깐 공격하지 못한다");
});

test("넉백: 보스는 덜 밀리고, 용병 병종 카드는 그 병종에만 적용된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "mercStat", stat: "knock", v: 40, type: SPEAR });
  g.jumpToStage(10);
  const sp = g.addMerc(a, SPEAR, 0, 0);
  const sh = g.addMerc(a, SHIELD, 0, 0);
  const dmg = g as unknown as { damageEnemy(e: unknown, h: unknown, o: number, src?: unknown): number };
  const hit = { damage: 1, charge: 0, srcType: SPEAR, fromAngle: Math.PI }; // 서쪽에서 맞음 → 동쪽으로 밀린다
  const strike = (type: number, src: number, boss = false) => {
    const e = g.spawnEnemyAt(1000, 1000, type);
    const en = g.getEnemy(e) as { hp: number; maxHp: number; shield: number; boss: boolean };
    en.hp = en.maxHp = 1e6;
    en.shield = 0;
    en.boss = boss;
    dmg.damageEnemy(en, hit, a, g.getMerc(src));
    return g.getEnemy(e)!.x - 1000;
  };
  assert.ok(Math.abs(strike(0, sp) - 40) < 1e-6, "창병 카드는 창병의 공격에 적용");
  assert.equal(strike(0, sh), 0, "검방병의 공격에는 적용되지 않는다");
  assert.ok(Math.abs(strike(0, sp, true) - 40 * KNOCK_BOSS_FACTOR) < 1e-6, "보스는 덜 밀린다");
});

test("넉백 카드: 주인공과 병종 전용이 있고 등급이 오를수록 많이 밀어낸다", () => {
  const hero = [0, 1, 2].map((r) => CARDS.find((c) => c.effect.k === "heroKnock" && c.rarity === r)!);
  const v = (c: (typeof CARDS)[number]) => (c.effect.k === "heroKnock" ? c.effect.v : 0);
  assert.ok(v(hero[0]!) < v(hero[1]!) && v(hero[1]!) < v(hero[2]!));
  for (const t of [0, 1, 3, 4]) assert.ok(CARDS.some((c) => c.effect.k === "mercStat" && c.effect.stat === "knock" && c.effect.type === t), `${t}`);
  assert.ok(!CARDS.some((c) => c.effect.k === "mercStat" && c.effect.stat === "knock" && c.effect.type === ARCHER_T), "궁병은 넉백 카드 없음");
  assert.ok(CARDS.some((c) => c.effect.k === "mercStat" && c.effect.stat === "knock" && c.effect.type === undefined), "전체 용병용도 있다");
});

// --- 경험치·행운·보상금 ---------------------------------------------------------

import { LUCK_MAX, luckWeight } from "@mercenary/shared";

test("경험치 획득 카드: 주인공 경험치가 늘어난다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "xpMult", v: 0.5 });
  const p = g.getPlayer(a)!;
  g.giveXp(a, 4);
  assert.ok(Math.abs(p.xp - 6) < 1e-9);
});

test("용병 경험치 카드: 병종 전용은 그 병종만, 전체는 모두(약하게) 더 빨리 쌓인다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const sp = g.addMerc(a, SPEAR, 0, 0);
  const sh = g.addMerc(a, SHIELD, 0, 0);
  g.applyCardForTest(a, { k: "mercStat", stat: "xp", v: 0.3, type: SPEAR });
  g.grantMercXpForTest(sp, 10);
  g.grantMercXpForTest(sh, 10);
  assert.ok(Math.abs(g.getMerc(sp)!.xp - 13) < 1e-9);
  assert.ok(Math.abs(g.getMerc(sh)!.xp - 10) < 1e-9);
  g.applyCardForTest(a, { k: "mercStat", stat: "xp", v: 0.06 });
  g.grantMercXpForTest(sh, 10);
  assert.ok(Math.abs(g.getMerc(sh)!.xp - 20.6) < 1e-9);
  assert.ok(CARDS.some((c) => c.effect.k === "mercStat" && c.effect.stat === "xp" && c.effect.type === undefined));
  for (const t of UNIT_TYPES) assert.ok(CARDS.some((c) => c.effect.k === "mercStat" && c.effect.stat === "xp" && c.effect.type === t));
});

test("보상금 카드: 소대·스테이지 클리어 금화가 늘어난다", () => {
  const goldAfterSquad = (bounty: boolean) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    if (bounty) g.applyCardForTest(a, { k: "bounty", v: 0.5 });
    g.spawnSquad(4);
    const gold = g.getPlayer(a)!.gold;
    const dmg = g as unknown as { damageEnemy(e: unknown, h: unknown, o: number): number };
    for (const e of g.snapshotEnemies()) {
      const en = g.getEnemy(e[0]) as { hp: number; shield: number };
      en.shield = 0;
      en.hp = 0.1;
    }
    for (const e of g.snapshotEnemies()) dmg.damageEnemy(g.getEnemy(e[0]), { damage: 5, charge: 0, srcType: -1, fromAngle: 0 }, a);
    // 처치 금화를 뺀 소대 보상만 비교하기 위해 총액 차이를 본다
    return g.getPlayer(a)!.gold - gold;
  };
  assert.ok(goldAfterSquad(true) > goldAfterSquad(false));
});

test("행운: 높을수록 높은 등급 카드의 확률 배율이 커지고 일반은 그대로다", () => {
  assert.equal(luckWeight(0, 1), 1);
  assert.ok(luckWeight(1, 0.5) > luckWeight(1, 0));
  assert.ok(luckWeight(2, 0.5) > luckWeight(1, 0.5));
  assert.ok(luckWeight(3, 0.5) > luckWeight(2, 0.5));
  assert.equal(luckWeight(1, 99), luckWeight(1, LUCK_MAX), "상한");
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.applyCardForTest(a, { k: "luck", v: 0.4 });
  assert.ok(Math.abs(g.getPlayer(a)!.luck - 0.4) < 1e-9);
  // 3종 카드 모두 등급별로 있다
  for (const k of ["xpMult", "luck", "bounty"] as const) {
    for (const r of [0, 1, 2]) assert.ok(CARDS.some((c) => c.effect.k === k && c.rarity === r), `${k} ${r}`);
  }
});

test("행운이 높으면 제시되는 카드의 평균 등급이 실제로 올라간다", () => {
  const meanRarity = (luck: number) => {
    let seed = 12345;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const g = new Game(rng);
    g.autoSpawn = false;
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    p.level = 12; // 모든 등급이 나올 수 있는 레벨
    p.luck = luck;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 300; i++) {
      p.offer = [];
      p.pending = 0;
      p.level = 12;
      p.xp = 0;
      p.xpNeed = xpNeeded(12);
      g.giveXp(a, xpNeeded(12)); // 레벨업 한 번 → 카드 3장이 제시된다
      for (const idx of p.offer) {
        sum += CARDS[idx]!.rarity;
        n++;
      }
    }
    return sum / Math.max(1, n);
  };
  assert.ok(meanRarity(2) > meanRarity(0) + 0.1, `${meanRarity(0)} -> ${meanRarity(2)}`);
});
