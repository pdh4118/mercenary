import { test } from "node:test";
import assert from "node:assert/strict";
import { HERO_STATS, MERC_STAT_BASE } from "@mercenary/shared";

const heroBase = (k: string): number => HERO_STATS.find((h) => h.k === k)!.base;

test("생존 카드 순서: 체력 > 방어력 > 회피율(체력이 늘면 채우기 어려워지므로 체력이 가장 좋다)", () => {
  assert.ok(heroBase("heroMaxHp") > heroBase("heroDefense"), "주인공: 체력 > 방어력");
  assert.ok(heroBase("heroDefense") > heroBase("heroDodge"), "주인공: 방어력 > 회피율");
  assert.ok(MERC_STAT_BASE.hp > MERC_STAT_BASE.defense, "용병: 체력 > 방어력");
  assert.ok(MERC_STAT_BASE.defense > MERC_STAT_BASE.dodge, "용병: 방어력 > 회피율");
});
