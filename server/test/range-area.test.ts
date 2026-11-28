/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHER, BLUNT, CAVALRY, MAGE, SHIELD, SPEAR, UNIT_TYPES, areaMultFor, rangeMultFor } from "@mercenary/shared";
import { Game } from "../src/game.js";

const stats = (type: number, mod: (m: any) => void) => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const id = g.addMerc(a, type, 0, 0)!;
  const m = (g as any).mercs.get(id);
  const before = (g as any).mercStats(m);
  mod((g as any).slots.get(a).mods.all);
  return { before, after: (g as any).mercStats(m) };
};

test("사거리 카드는 기병·창병·궁병에만, 범위 카드는 검방병·둔기병·마법사에만 듣는다(용병)", () => {
  const RANGE = [CAVALRY, SPEAR, ARCHER];
  const AREA = [SHIELD, BLUNT, MAGE];
  for (const t of UNIT_TYPES) {
    const r = stats(t, (all) => (all.range = 2));
    if (RANGE.includes(t)) assert.ok(r.after.reach > r.before.reach * 1.9, `${t}: 사거리 카드가 들어야 한다`);
    else assert.equal(r.after.reach, r.before.reach, `${t}: 사거리 카드가 들면 안 된다`);
    const a = stats(t, (all) => (all.area = 2));
    if (AREA.includes(t)) assert.ok(a.after.splash > a.before.splash || a.after.reach > a.before.reach, `${t}: 범위 카드가 들어야 한다`);
    else {
      assert.equal(a.after.reach, a.before.reach, `${t}: 범위 카드가 사거리를 바꾸면 안 된다`);
      assert.equal(a.after.arc, a.before.arc, `${t}: 범위 카드가 각도·폭을 바꾸면 안 된다`);
      assert.equal(a.after.splash, a.before.splash);
    }
  }
});

test("검·철퇴는 범위 카드로 사거리가 늘고, 사거리 카드는 듣지 않는다(철퇴는 폭발 반경도)", () => {
  const s = stats(SHIELD, (all) => (all.area = 1.5));
  assert.ok(Math.abs(s.after.reach - s.before.reach * 1.5) < 1e-6);
  const b = stats(BLUNT, (all) => (all.area = 1.5));
  assert.ok(Math.abs(b.after.reach - b.before.reach * 1.5) < 1e-6);
  assert.ok(Math.abs(b.after.splash - b.before.splash * 1.5) < 1e-6);
});

test("주인공 무기: 사거리는 활·창·기마, 범위는 검·철퇴·지팡이에만 적용된다", () => {
  assert.equal(rangeMultFor(ARCHER, 1.4), 1.4);
  assert.equal(rangeMultFor(SHIELD, 1.4), 1);
  assert.equal(areaMultFor(SHIELD, 1.4), 1.4);
  assert.equal(areaMultFor(ARCHER, 1.4), 1);
  assert.equal(areaMultFor(CAVALRY, 1.4), 1);
});

import { CARDS, HERO_STATS, CARD_TUNE } from "@mercenary/shared";
test("용병 공용 카드는 같은 능력치의 주인공 카드의 40%이다", () => {
  const hero: Record<string, string> = { hp: "heroMaxHp", dmg: "heroDmg", atkSpeed: "heroFireRate", speed: "heroSpeed", range: "heroRange", area: "heroArea", crit: "heroCrit", critMult: "heroCritMult", defense: "heroDefense", dodge: "heroDodge" };
  for (const c of CARDS) {
    if (c.effect.k !== "mercStat" || c.effect.type !== undefined || c.rarity !== 0) continue;
    const hk = hero[c.effect.stat];
    if (!hk) continue;
    const ref = HERO_STATS.find((h) => h.k === hk)!.base; // 일반 등급 주인공 카드
    assert.ok(Math.abs(c.effect.v - ref * CARD_TUNE.globalVsHero) < 2e-3, `${c.name}: ${c.effect.v} != 주인공 ${ref} x ${CARD_TUNE.globalVsHero}`);
  }
});
