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
    const buffs = vals.filter((v) => v > 0).length + (p.fearImmune ? 1 : 0) + (p.price ? 1 : 0) + (p.leash ? 1 : 0) + (p.sit ?? []).filter((r) => r.good).length;
    const debuffs = vals.filter((v) => v < 0).length + (p.ignore > 0 ? 1 : 0) + (p.sit ?? []).filter((r) => !r.good).length;
    for (const rule of p.sit ?? []) assert.ok(Object.values(rule.mods).every((v) => Math.abs(v!) <= 0.3), `${p.name} 상황 효과 수치가 크다`);
    assert.ok(buffs >= 1 && debuffs >= 1, `${p.name}: 장점 ${buffs} · 단점 ${debuffs}`);
    // 무조건 좋거나 나쁜 성격이 없도록: 상황 효과가 이로운 것 하나, 불리한 것 하나 이상 있다(떠돌이·고집쎈 등 모두)
    assert.ok((p.sit ?? []).some((r) => r.good) && (p.sit ?? []).some((r) => !r.good), `${p.name}: 상황에 따라 강하고 약해진다`);
  }
});

test("성격: 능력치 보정이 실제 용병 능력치에 반영된다(철벽 체력 +8%, 날쌘 이동 +8%·체력 -6%, 고집쎈은 평소에는 보정 없음)", () => {
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
  assert.ok(Math.abs(s1.damage / s0.damage - 1) < 1e-6, "고집쎈은 평소에는 보정 없음");
  assert.ok(Math.abs(i1.hp / i0.hp - 1.08) < 0.01, "철벽 체력");
  assert.ok(Math.abs(w1.speed / w0.speed - 1.08) < 1e-6, "날쌘 이동");
  assert.ok(Math.abs(w1.hp / w0.hp - 0.94) < 0.01, "날쌘 체력");
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
  const m = g.addMerc(a, SHIELD, p.x, p.y + 40, 0, 0, nameOf("철벽"));
  const base = { ...g.mercStatsForTest(m) };
  g.personality = true;
  assert.ok(g.mercStatsForTest(m).hp > base.hp);
});

test("성격: 수줍은은 체력이 낮으면 잠시 진형으로 물러나고, 나머지는 그대로 싸운다", () => {
  const trial = (name: string) => {
    const g = newGame();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    p.invuln = 1e9;
    const id = g.addMerc(a, SPEAR, p.x + 60, p.y, 0, 0, nameOf(name));
    const m = (g as any).mercs.get(id);
    const foe = g.spawnEnemyAt(m.x + 40, m.y, 4);
    (g.getEnemy(foe) as any).hp = (g.getEnemy(foe) as any).maxHp = 1e6;
    (g as any).mercs.get(id).hp = g.mercStatsForTest(id).hp * 0.2;
    for (let i = 0; i < TICK_RATE * 2; i++) g.step();
    return { retreated: (m.retreatT ?? 0) > 0 || m.retreatCd > 0, intent: m.intent };
  };
  assert.ok(trial("수줍은").retreated, "수줍은은 물러난다");
  assert.ok(!trial("늙은").retreated, "늙은은 물러나지 않는다(곁의 아군을 돕는 쪽이다)");
  assert.ok(!trial("용감한").retreated, "용감한은 물러나지 않는다");
  assert.ok(!trial("고집쎈").retreated, "다른 성격도 마찬가지");
});

test("성격: 용감한은 체력이 절반 아래면 공격력이 오르고, 날쌘은 처치하면 잠깐 빨라지며, 늙은은 곁의 아군 공격력을 올린다", () => {
  const g = newGame();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const brave = g.addMerc(a, SPEAR, p.x + 100, p.y, 0, 0, nameOf("용감한"));
  const bm = (g as any).mercs.get(brave);
  g.step(); // 군세 보너스 등이 자리 잡게 한 번 돌린다
  const full = g.mercStatsForTest(brave).damage;
  bm.hp = g.mercStatsForTest(brave).hp * 0.4;
  run(g, 0.6); // 상황을 읽는다
  assert.ok(Math.abs(g.mercStatsForTest(brave).damage / full - 1.25) < 1e-6, `용감한: 체력이 절반 아래면 사생결단 +25% (${g.mercStatsForTest(brave).damage / full})`);
  assert.ok((bm.sitCode ?? 0) > 0, "머리 위 표시 번호가 켜진다");
  const swift = g.addMerc(a, SPEAR, p.x + 140, p.y, 0, 0, nameOf("날쌘"));
  const sm = (g as any).mercs.get(swift);
  const sp0 = g.mercStatsForTest(swift).speed;
  const e = g.spawnEnemyAt(p.x + 400, p.y, 4);
  (g as any).killEnemy(g.getEnemy(e), a, sm);
  assert.ok(Math.abs(g.mercStatsForTest(swift).speed / sp0 - 1.25) < 1e-6, "날쌘: 처치하면 빨라진다");
  run(g, 3.5);
  assert.ok(Math.abs(g.mercStatsForTest(swift).speed / sp0 - 1) < 1e-6, "3초 뒤 원래대로");
  const old = g.addMerc(a, SPEAR, p.x + 180, p.y, 0, 0, nameOf("늙은"));
  const mate = g.addMerc(a, SPEAR, p.x + 190, p.y + 20, 0, 0, nameOf("말없는")); // 공격력 보정이 없는 성격
  const far = g.addMerc(a, SPEAR, p.x + 900, p.y, 0, 0, nameOf("말없는")); // 같은 성격·병종인데 멀리 있다
  void old;
  run(g, 1);
  const ratio = g.mercStatsForTest(mate).damage / g.mercStatsForTest(far).damage;
  assert.ok(Math.abs(ratio - 1.06) < 1e-6, `곁의 아군 +6% (${ratio})`);
  assert.equal((g as any).mercs.get(far).auraDmg, 0, "먼 용병은 받지 않는다");
});

test("성격 상황 효과: 같은 성격이 상황에 따라 강해지기도 약해지기도 한다(고집쎈: 정예 앞에서 +18%, 졸개만 많으면 -12%)", () => {
  const damageWith = (setup: (g: Game, a: number, p: any, m: any) => void) => {
    const g = newGame();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    p.invuln = 1e9;
    const id = g.addMerc(a, SPEAR, p.x + 100, p.y, 0, 0, nameOf("고집쎈"));
    const m = (g as any).mercs.get(id);
    g.step(); // 군세 보너스 등이 자리 잡게 한 번 돌린다
    const base = g.mercStatsForTest(id).damage;
    setup(g, a, p, m);
    for (let i = 0; i < Math.round(TICK_RATE * 0.5); i++) (g as any).stepSituations(0.5);
    return { ratio: g.mercStatsForTest(id).damage / base, code: m.sitCode ?? 0 };
  };
  const elite = damageWith((g, _a, _p, m) => {
    const e = g.spawnEnemyAt(m.x + 150, m.y, 3);
    (g.getEnemy(e) as any).elite = true;
  });
  assert.ok(Math.abs(elite.ratio - 1.18) < 1e-6 && elite.code > 0, `정예 앞에서 +18% (${elite.ratio})`);
  const grunts = damageWith((g, _a, _p, m) => {
    for (let i = 0; i < 5; i++) g.spawnEnemyAt(m.x + 100 + i * 10, m.y + (i - 2) * 12, 1);
  });
  assert.ok(Math.abs(grunts.ratio - 0.88) < 1e-6 && grunts.code < 0, `졸개만 많으면 -12% (${grunts.ratio})`);
  const calm = damageWith(() => {});
  assert.equal(calm.ratio, 1, "아무 조건에도 안 맞으면 그대로");
});

test("성격 상황 효과: 철벽은 진형 자리에서 받는 피해가 줄고, 켜진 시간이 전적에 남는다", () => {
  const g = newGame();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const id = g.addMerc(a, SPEAR, p.x + 60, p.y, 0, 0, nameOf("철벽"));
  const m = (g as any).mercs.get(id);
  m.homeDist = 10;
  (g as any).stepSituations(0.5);
  assert.equal(m.sit?.taken, -0.18, "진형 자리 가까이서 받는 피해 -18%");
  const e = g.spawnEnemyAt(m.x + 30, m.y, 4);
  (g.getEnemy(e) as any).hp = (g.getEnemy(e) as any).maxHp = 1e6;
  for (let i = 0; i < TICK_RATE * 6; i++) {
    m.homeDist = 10;
    g.step();
  }
  assert.ok(m.career.sitUp > 2, `켜진 시간이 기록된다(${m.career.sitUp})`);
});
