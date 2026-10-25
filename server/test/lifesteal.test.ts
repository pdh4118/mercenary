import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS, LEGENDS, LEGEND_CONST, TICK_RATE } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};

test("흡혈·체력 재생 카드: 효과는 낮추고 뽑힐 확률은 높였다", () => {
  const regen = CARDS.filter((c) => c.effect.k === "heroRegen");
  const steal = CARDS.filter((c) => c.effect.k === "heroLifesteal");
  assert.equal(regen.length, 3);
  assert.equal(steal.length, 3);
  const common = CARDS.filter((c) => c.effect.k === "heroSpeed" && c.rarity === 0)[0]!;
  assert.ok(regen[0]!.weight > common.weight, "체력 재생이 더 자주 나온다");
  assert.ok(steal[0]!.weight > common.weight, "흡혈이 더 자주 나온다");
  assert.ok(regen[0]!.effect.k === "heroRegen" && regen[0]!.effect.v <= 0.12 + 1e-9, "재생 한 장의 효과");
  assert.ok(steal[0]!.effect.k === "heroLifesteal" && steal[0]!.effect.v < 0.005);
  assert.equal(LEGEND_CONST.bloodthirstFrac, 0.00625);
  const otherLegend = CARDS.find((c) => c.effect.k === "legend" && c.effect.id !== "bloodthirst")!;
  const blood = CARDS.find((c) => c.effect.k === "legend" && c.effect.id === "bloodthirst")!;
  assert.ok(blood.weight > otherLegend.weight, "피의 갈증은 더 자주 나온다");
  assert.ok(LEGENDS.bloodthirst.desc.includes("0.6%"));
  // 용병 흡혈 카드는 공용만 있다(궁병은 절반, 마법사는 1/4만 적용된다)
  assert.ok(!CARDS.some((c) => c.effect.k === "mercStat" && c.effect.stat === "lifesteal" && c.effect.type !== undefined));
  assert.ok(CARDS.some((c) => c.effect.k === "mercStat" && c.effect.stat === "lifesteal" && c.effect.type === undefined));
});

test("흡혈 카드: 주인공이 준 피해의 일부만큼 체력을 회복한다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.applyCardForTest(a, { k: "heroLifesteal", v: 0.1 });
  p.hp = 50;
  const id = g.spawnEnemyAt(p.x + 120, p.y, 4);
  const e = (g as unknown as { enemies: Map<number, { hp: number; maxHp: number; cd: number; atkT: number }> }).enemies.get(id)!;
  e.hp = e.maxHp = 5000;
  e.cd = 99;
  e.atkT = 999;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  run(g, 0.5);
  const dealt = 5000 - e.hp;
  assert.ok(dealt > 0);
  assert.ok(Math.abs(p.hp - (50 + dealt * 0.1)) < 0.5, `회복 ${p.hp - 50} / 기대 ${dealt * 0.1}`);
});

test("용병 흡혈의 최종 효율: 궁병은 절반, 마법사는 1/4, 나머지는 그대로", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const heal = (type: number): number => {
    const id = g.addMerc(a, type, 0, 0);
    const m = (g as unknown as { mercs: Map<number, { hp: number }> }).mercs.get(id)!;
    m.hp = 1;
    (g as unknown as { lifesteal(o: unknown, s: unknown, n: number): void }).lifesteal((g as unknown as { slots: Map<number, unknown> }).slots.get(a), m, 10);
    return m.hp - 1;
  };
  assert.equal(heal(3), 10, "검방병은 그대로");
  assert.equal(heal(2), 5, "궁병은 절반");
  assert.equal(heal(5), 2.5, "마법사는 1/4");
});
