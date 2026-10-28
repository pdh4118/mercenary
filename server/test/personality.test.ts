/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PERSONALITIES, PERSONALITY_IGNORE_MAX, personalityOf, mercEpithet, mercName, MERC_NAME_COUNT, SPEAR, SHIELD, ARCHER, TICK_RATE, INTENT, mercPrice, TIER_BUY_MULT } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
/** 성격 이름으로 그 성격의 이름 번호 하나를 얻는다 */
const nameOf = (persona: string): number => {
  for (let i = 0; i < MERC_NAME_COUNT; i++) if (mercEpithet(i) === persona) return i;
  throw new Error(persona);
};
const newGame = () => {
  const g = new Game();
  g.autoSpawn = false;
  g.personality = true;
  return g;
};

test("성격: 10종이 이름 수식어와 1:1로 대응하고, 모두 장점과 단점이 있으며 수치는 20%를 넘지 않는다", () => {
  assert.equal(PERSONALITIES.length, 10);
  assert.equal(new Set(PERSONALITIES.map((p) => p.name)).size, 10);
  for (let i = 0; i < MERC_NAME_COUNT; i += 7) assert.ok(personalityOf(i).name.length > 0, `${mercName(i)}의 성격`);
  for (const p of PERSONALITIES) {
    assert.ok(p.short.length > 0 && p.ignore <= PERSONALITY_IGNORE_MAX, p.name);
    const vals = Object.values(p.mods) as number[];
    assert.ok(vals.every((v) => Math.abs(v) <= 0.3), `${p.name} 수치가 크다`);
    const buffs = vals.filter((v) => v > 0).length + (p.fearImmune ? 1 : 0) + (p.price ? 1 : 0) + (p.leash ? 1 : 0);
    const debuffs = vals.filter((v) => v < 0).length + (p.ignore > 0 ? 1 : 0) + (p.name === "말없는" ? 0 : 0);
    assert.ok(buffs >= 1 && debuffs >= 1, `${p.name}: 장점 ${buffs} · 단점 ${debuffs}`);
  }
});

test("성격: 능력치 보정이 실제 용병 능력치에 반영된다(고집쎈 공격력 +15%, 철벽 체력 +15%, 날쌘 이동 +12%·체력 -12%)", () => {
  const g = newGame();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const stub = g.addMerc(a, SHIELD, p.x, p.y + 40, 0, 0, nameOf("고집쎈"));
  const iron = g.addMerc(a, SHIELD, p.x, p.y + 80, 0, 0, nameOf("철벽"));
  const swift = g.addMerc(a, SHIELD, p.x, p.y + 120, 0, 0, nameOf("날쌘"));
  const on = (id: number) => ({ ...g.mercStatsForTest(id) });
  const [s1, i1, w1] = [on(stub), on(iron), on(swift)];
  g.personality = false;
  const [s0, i0, w0] = [on(stub), on(iron), on(swift)];
  assert.ok(Math.abs(s1.damage / s0.damage - 1.15) < 1e-6, "고집쎈 공격력");
  assert.ok(Math.abs(i1.hp / i0.hp - 1.15) < 0.01, "철벽 체력");
  assert.ok(Math.abs(w1.speed / w0.speed - 1.12) < 1e-6, "날쌘 이동");
  assert.ok(Math.abs(w1.hp / w0.hp - 0.88) < 0.01, "날쌘 체력");
});

test("성격: 고용 전에 캠프에서 성격을 알 수 있고, 고용하면 같은 성격이 된다(떠돌이는 20% 싸다)", () => {
  const g = newGame();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.gold = 10000;
  const camp = g.spawnCampAt(p.x + 10, p.y, [SPEAR, ARCHER, SHIELD]);
  const names = [nameOf("떠돌이"), nameOf("고집쎈"), nameOf("철벽")];
  (g as any).camps.get(camp).names = names;
  const wire = g.snapshotCamps()[0]!;
  assert.deepEqual([wire[7], wire[8], wire[9]], names, "캠프 정보에 이름(성격)이 실린다");
  const base = Math.round(mercPrice(SPEAR, 0) * TIER_BUY_MULT[0]! * p.priceMult);
  const gold0 = p.gold;
  assert.equal(g.buy(a, camp, 0).ok, true);
  assert.equal(gold0 - p.gold, Math.round(base * 0.8), "떠돌이 할인");
  const hired = g.snapshotMercs().find((w) => w[5] === a)!;
  assert.equal(mercEpithet(hired[16]), "떠돌이", "고용한 용병의 성격이 미리 본 것과 같다");
  assert.equal(g.buy(a, camp, 1).ok, true);
  assert.equal(g.buy(a, camp, 1).ok, true);
  const stubborn = g.snapshotMercs().filter((w) => w[5] === a && mercEpithet(w[16]) === "고집쎈");
  assert.equal(stubborn.length, 2);
  assert.equal(new Set(stubborn.map((w) => w[16])).size, 2, "같은 성격이라도 이름은 겹치지 않는다");
});

test("성격: 고집쎈은 새 지시를 가끔 무시하지만 상한(30%)을 넘지 않고 연속으로 무시하지 않는다", () => {
  const g = newGame();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const m = g.addMerc(a, SPEAR, p.x, p.y + 60, 0, 0, nameOf("고집쎈"));
  const merc = g.getMerc(m)! as any;
  let ignored = 0;
  let streak = 0;
  let maxStreak = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    g.order(a, p.x + 300 + (i % 5), p.y + 100, 1 << SPEAR, "move");
    g.step();
    if (merc.ignoring) {
      ignored++;
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else streak = 0;
  }
  assert.ok(ignored > 0, "가끔 무시한다");
  assert.ok(ignored / N <= PERSONALITY_IGNORE_MAX, `무시 ${ignored}/${N}`);
  assert.equal(maxStreak, 1, "연속으로 무시하지 않는다");
});

test("성격: 순종적인 성격(말없는)은 지시를 항상 따르고, 사기가 꺾여도 도망치지 않는다", () => {
  const g = newGame();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const quiet = g.addMerc(a, SPEAR, p.x, p.y + 60, 0, 0, nameOf("말없는"));
  const meek = g.addMerc(a, SPEAR, p.x + 30, p.y + 60, 0, 0, nameOf("수줍은"));
  for (let i = 0; i < 100; i++) {
    g.order(a, p.x + 300, p.y + 100, 1 << SPEAR, "move");
    g.step();
    assert.ok(!(g.getMerc(quiet)! as any).ignoring);
  }
  p.shaken = 5; // 사기가 꺾였다
  g.spawnEnemyAt(p.x + 200, p.y + 60, SHIELD);
  g.step();
  const intents = Object.fromEntries(g.snapshotMercs().map((w) => [w[0], w[20]]));
  assert.notEqual(intents[quiet], INTENT.FEAR, "말없는은 도망치지 않는다");
  assert.equal(intents[meek], INTENT.FEAR, "수줍은은 도망친다");
});

test("성격: 끄면(테스트·튜닝용) 모든 용병이 기본 능력치이고 지시를 항상 따른다", () => {
  const g = new Game();
  g.autoSpawn = false;
  g.personality = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const m = g.addMerc(a, SHIELD, p.x, p.y + 40, 0, 0, nameOf("고집쎈"));
  const base = { ...g.mercStatsForTest(m) };
  g.personality = true;
  assert.ok(g.mercStatsForTest(m).damage > base.damage);
});
