import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS, defenseTakenMult, dodgeChanceOf, respawnTimeMult } from "@mercenary/shared";

test("방어력·회피율·부활 속도: 몇 장을 쌓아도 체력으로 환산한 효율이 같다(상한 없음)", () => {
  for (const x of [0.04, 0.5, 2, 10, 100]) {
    const ehpDef = 1 / defenseTakenMult(x); // 방어력으로 늘어난 유효 체력 배율
    const ehpDodge = 1 / (1 - dodgeChanceOf(x)); // 회피로 늘어난 유효 체력 배율
    assert.ok(Math.abs(ehpDef - (1 + x)) < 1e-9, `방어력 x=${x}`);
    assert.ok(Math.abs(ehpDodge - (1 + x)) < 1e-9, `회피 x=${x}`);
    assert.ok(Math.abs(1 / respawnTimeMult(x) - (1 + x)) < 1e-9, `부활 x=${x}`);
  }
  // 한 장 더 얹을 때의 이득이 쌓인 양과 무관하다: (1+x+c)/(1+x) 가 아니라 유효 체력이 +c만큼 선형으로 늘어난다
  const gain = (x: number, c: number) => 1 / defenseTakenMult(x + c) - 1 / defenseTakenMult(x);
  assert.ok(Math.abs(gain(0, 0.1) - gain(5, 0.1)) < 1e-9);
  assert.ok(defenseTakenMult(1000) > 0 && dodgeChanceOf(1000) < 1, "상한이 없어도 완전 무적은 되지 않는다");
});

test("부활 속도 카드는 부활 시간이 아니라 속도로 표기된다", () => {
  const c = CARDS.find((x) => x.effect.k === "mercStat" && x.effect.stat === "respawn" && x.effect.type === undefined && x.rarity === 0)!;
  assert.ok(c.name.includes("부활 속도"));
  assert.ok(c.effect.k === "mercStat" && c.effect.v > 0);
});
