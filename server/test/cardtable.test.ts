import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS, summarizePicks, SUMMARY_COLUMNS, SPEAR, CAVALRY, MAGE, xpNeeded } from "@mercenary/shared";
import { Game } from "../src/game.js";

const find = (pred: (c: (typeof CARDS)[number]) => boolean): number => {
  const i = CARDS.findIndex(pred);
  assert.ok(i >= 0);
  return i;
};

test("카드 표: 고른 카드를 영웅·병종·공용 열로 묶고 같은 능력치는 합친다", () => {
  const heroDmg = find((c) => c.effect.k === "heroDmg" && c.rarity === 0);
  const spearHp = find((c) => c.effect.k === "mercStat" && c.effect.stat === "thorns" && c.effect.type === SPEAR); // 창병 전용(근접 반사)
  const allHp = find((c) => c.effect.k === "mercStat" && c.effect.stat === "hp" && c.effect.type === undefined && c.rarity === 0);
  const heroHp = find((c) => c.effect.k === "heroMaxHp" && c.rarity === 0);
  const lead = find((c) => c.effect.k === "leadership" && c.rarity === 0);
  const legend = find((c) => c.effect.k === "legend" && c.effect.scope === MAGE);
  const s = summarizePicks([heroDmg, heroDmg, spearHp, allHp, heroHp, lead, legend]);
  assert.equal(s.count, 7);
  assert.equal(SUMMARY_COLUMNS.length, 8);
  const dmg = s.rows.find((r) => r.label === "공격력")!;
  assert.ok(dmg.cells[0]!.startsWith("+") && dmg.cells.slice(1).every((c) => c === ""), "영웅 공격력만");
  const hp = s.rows.find((r) => r.label === "체력")!;
  assert.ok(hp.cells[0]!.length > 0, "영웅 최대 체력(+n)");
  assert.ok(hp.cells[7]!.endsWith("%") && hp.cells[SPEAR + 1] === "", "체력은 공용 열(병종 카드는 없다)");
  const th = s.rows.find((r) => r.label === "근접 반사")!;
  assert.ok(th.cells[SPEAR + 1]!.length > 0 && th.cells[CAVALRY + 1] === "", "창병 전용 근접 반사");
  assert.equal(s.legends[MAGE + 1]!.length, 1, "마법사 전설");
  assert.ok(s.extras.some((x) => x.label === "통솔력"));
  // 같은 카드 두 장은 합산된다
  const twice = summarizePicks([heroDmg, heroDmg]).rows[0]!.cells[0]!;
  const once = summarizePicks([heroDmg]).rows[0]!.cells[0]!;
  assert.notEqual(twice, once);
  assert.equal(summarizePicks([]).rows.length, 0);
  assert.equal(summarizePicks([99999]).count, 0, "없는 카드 번호는 무시");
});

test("카드 표: 서버는 고른 카드를 순서대로 기억하고 요청한 사람에게만 알려 준다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  assert.deepEqual(g.getPicks(a), []);
  g.giveXp(a, xpNeeded(1));
  const offer = [...g.getPlayer(a)!.offer];
  assert.ok(offer.length > 0);
  assert.equal(g.pick(a, 1), true);
  assert.deepEqual(g.getPicks(a), [offer[1]], "고른 카드 번호");
  assert.deepEqual(g.getPicks(b), [], "다른 사람의 선택은 섞이지 않는다");
});
