/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS, OFFER_SIZE, SPEAR, cardRow, xpNeeded } from "@mercenary/shared";
import { Game } from "../src/game.js";

const setup = () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.addMerc(a, SPEAR, 100, 100);
  g.giveXp(a, xpNeeded(1));
  return { g, a, p: g.getPlayer(a)! };
};

test("레벨업 카드: 주인공·운영 3장과 용병 3장이 한 번에 뜨고, 각 줄에서 하나씩 골라야 끝난다", () => {
  const { g, a, p } = setup();
  assert.equal(p.offer.length, OFFER_SIZE * 2);
  assert.ok(p.offer.slice(0, 3).every((i) => i >= 0 && cardRow(CARDS[i]!) === 0), "윗줄은 주인공·운영");
  assert.ok(p.offer.slice(3).every((i) => i >= 0 && cardRow(CARDS[i]!) === 1), "아랫줄은 용병");
  const pending = p.pending;
  const rr = p.rerolls;
  assert.equal(g.pick(a, 1), true);
  assert.equal(p.pending, pending, "한 줄만 골랐으면 아직 끝나지 않는다");
  assert.deepEqual(p.offer.slice(0, 3), [-1, -1, -1]);
  assert.equal(g.pick(a, 0), false, "이미 고른 줄은 다시 못 고른다");
  assert.equal(g.pick(a, 4), true);
  assert.equal(p.pending, pending - 1, "두 줄을 다 고르면 레벨업 한 번이 끝난다");
  assert.ok(p.rerolls >= rr, "새로고침은 레벨업 한 번에 1회씩 쌓인다");
  assert.equal(g.getPicks(a).length, 2);
});

test("레벨업 카드: 새로고침은 아직 안 고른 줄만 새로 뽑는다", () => {
  const { g, a, p } = setup();
  g.pick(a, 0);
  p.rerolls = 3;
  assert.equal(g.reroll(a), true);
  assert.deepEqual(p.offer.slice(0, 3), [-1, -1, -1], "고른 줄은 비어 있는 채");
  assert.ok(p.offer.slice(3).every((i) => i >= 0));
});

test("레벨업 필요 경험치는 두 줄 선택에 맞춰 천천히 늘어난다", () => {
  assert.ok(xpNeeded(30) > 500);
});

test("레벨업 카드: 주인공 줄에는 규모 카드만 세 장 나오지 않는다", () => {
  let bad = 0;
  for (let n = 0; n < 40; n++) {
    const { p } = setup();
    if (p.offer.slice(0, 3).every((i) => CARDS[i]!.category === 0)) bad++;
  }
  assert.ok(bad <= 1, `규모 카드만 나온 횟수 ${bad}`);
});
