/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHER, BLUNT, CAVALRY, MAGE, SHIELD, SPEAR, TICK_RATE, TUNE, UNIT_TYPES, MERC_XP_TYPE_MULT, type EventWire } from "@mercenary/shared";
import { Game } from "../src/game.js";

const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};
const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};

test("기여도: 준 피해가 기여도가 되고, 경험치는 기여도 x 비율로 오른다(받은 피해는 기여도가 아니다)", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const id = g.addMerc(a, SPEAR, p.x + 40, p.y);
  const m = (g as any).mercs.get(id);
  const e = g.spawnEnemyAt(p.x + 90, p.y, 4);
  (g.getEnemy(e) as any).hp = (g.getEnemy(e) as any).maxHp = 1e6; // 죽지 않게
  run(g, 6);
  assert.ok(m.career.dealt > 0, "준 피해가 기록된다");
  assert.ok(Math.abs(m.career.score - m.career.dealt) < 1e-6 || m.career.score >= m.career.dealt, "기여도는 준 피해를 바탕으로 한다");
  const xp0 = m.xp;
  (g as any).hurtMerc(m, 100); // 맞기만 한 만큼은 경험치만 오르고 기여도는 그대로다
  assert.ok(m.xp > xp0, "받은 피해로 경험치가 오른다");
  const sc = m.career.score;
  (g as any).hurtMerc(m, 100);
  assert.equal(m.career.score, sc, "받은 피해는 기여도가 아니다");
});

test("기여도: 검방병이 방패로 막은 피해, 창병이 되받아친 피해, 둔기병의 경직이 기여도로 센다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const shield = (g as any).mercs.get(g.addMerc(a, SHIELD, p.x + 30, p.y));
  // 검방병 앞에 선 창병 적이 방패를 때린다
  const foe = g.spawnEnemyAt(shield.x + 40, shield.y, SPEAR);
  (g.getEnemy(foe) as any).hp = (g.getEnemy(foe) as any).maxHp = 1e6;
  run(g, 8);
  assert.ok(shield.career.blocked > 0, `막은 피해가 기록된다(${shield.career.blocked})`);
  assert.ok(shield.career.score >= shield.career.blocked * TUNE.MXP_BLOCK * 0.99, "막은 피해가 기여도에 들어간다");
  const blunt = (g as any).mercs.get(g.addMerc(a, BLUNT, p.x + 60, p.y + 120));
  const foe2 = g.spawnEnemyAt(blunt.x + 30, blunt.y, 4);
  (g.getEnemy(foe2) as any).hp = (g.getEnemy(foe2) as any).maxHp = 1e6;
  run(g, 8);
  assert.ok(blunt.career.stagger > 0, `경직 횟수가 기록된다(${blunt.career.stagger})`);
});

test("기여도: 처치 보너스는 센 적을 잡을수록 크고, 어시스트는 피해를 많이 준 쪽이 더 가져간다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const m1 = (g as any).mercs.get(g.addMerc(a, SPEAR, p.x + 20, p.y));
  const m2 = (g as any).mercs.get(g.addMerc(a, SPEAR, p.x + 20, p.y + 30));
  const m3 = (g as any).mercs.get(g.addMerc(a, SPEAR, p.x + 20, p.y - 30));
  const e = g.spawnEnemyAt(p.x + 200, p.y, 2);
  const en = g.getEnemy(e) as any;
  en.maxHp = 400;
  en.hp = 400;
  // 직접 피해 기록(어시스트 재료)을 넣고 m1이 막타를 친다
  en.contrib = new Map([
    [m2.id, { d: 120, t: (g as any).time }],
    [m3.id, { d: 40, t: (g as any).time }],
  ]);
  const before = [m1, m2, m3].map((m) => m.career.score);
  (g as any).killEnemy(en, a, m1);
  const bonus = Math.min(400, TUNE.MXP_KILL_CAP) * TUNE.MXP_KILL_FRAC;
  assert.ok(Math.abs(m1.career.score - before[0]! - bonus) < 1e-6, "막타는 그 적 체력에 비례한 보너스");
  const a2 = m2.career.score - before[1]!;
  const a3 = m3.career.score - before[2]!;
  assert.ok(a2 > a3 * 5, `피해를 더 많이 준 쪽이 훨씬 더 가져간다(${a2.toFixed(1)} vs ${a3.toFixed(1)})`);
  assert.ok(Math.abs(a2 + a3 - bonus * TUNE.MXP_ASSIST_POOL) < 1e-6, "어시스트 몫의 합");
  assert.equal(m1.career.kills, 1);
  assert.equal(m2.career.assists, 1);
  // 센 적일수록 보너스가 크다
  const weak = g.spawnEnemyAt(p.x + 200, p.y + 100, 0);
  (g.getEnemy(weak) as any).maxHp = 50;
  const s0 = m1.career.score;
  (g as any).killEnemy(g.getEnemy(weak), a, m1);
  assert.ok(m1.career.score - s0 < bonus, "약한 적은 보너스가 작다");
});

test("경험치: 단계가 높을수록 더 받고, 토너먼트에서는 절반 비율이며, 병종 보정이 곱해진다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const low = (g as any).mercs.get(g.addMerc(a, SPEAR, p.x + 20, p.y, 0, 0));
  const high = (g as any).mercs.get(g.addMerc(a, SPEAR, p.x + 20, p.y + 30, 0, 2));
  (g as any).meritMerc(low, 100);
  (g as any).meritMerc(high, 100);
  assert.ok(Math.abs(low.xp - 100 * TUNE.MXP_RATE * MERC_XP_TYPE_MULT[SPEAR]!) < 1e-6, `0단계 경험치(${low.xp})`);
  assert.ok(Math.abs(high.xp / low.xp - (1 + TUNE.MXP_TIER_BONUS * 2)) < 1e-6, "단계 보너스");
  (g as any).phase = "tournament";
  const x0 = low.xp;
  (g as any).meritMerc(low, 100);
  assert.ok(Math.abs(low.xp - x0 - (100 * TUNE.MXP_RATE * MERC_XP_TYPE_MULT[SPEAR]!) * TUNE.MXP_TOURNAMENT) < 1e-6, "토너먼트 절반");
});

test("결과: 용병별 전적(떠난 용병 포함)과 주인공 무기별 전적이 담긴다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const id = g.addMerc(a, ARCHER, p.x + 20, p.y);
  g.addMerc(a, MAGE, p.x + 40, p.y);
  (g as any).mercs.get(id).career.dealt = 500;
  (g as any).mercs.get(id).career.score = 500;
  (g as any).retireMerc((g as any).mercs.get(id)); // 해고·이탈과 같은 경로
  run(g, 2);
  const r = (g as any).result().players[0];
  assert.equal(r.mercList.length, 2, "해고한 용병도 전적에 남는다");
  const left = r.mercList.find((m: any) => m.type === ARCHER);
  assert.equal(left.active, false);
  assert.equal(left.dealt, 500);
  assert.ok(r.weapons.length >= 1 && r.weapons[0].sec > 0, "무기별 사용 시간");
});

test("토너먼트: 이번 판에서 가장 많이 기여한 용병이 MVP가 되고 보너스 경험치를 받는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  const ma = (g as any).mercs.get(g.addMerc(a, SHIELD, 0, 0));
  const mb = (g as any).mercs.get(g.addMerc(b, MAGE, 0, 0));
  ma.matchBase = 0;
  mb.matchBase = 0;
  ma.career.score = 300;
  mb.career.score = 900;
  const xp0 = mb.xp;
  const mvp = (g as any).tourPickMvp(a, b);
  assert.equal(mvp.owner, b);
  assert.equal(mvp.type, MAGE);
  assert.equal(mvp.score, 900);
  assert.ok(mb.xp - xp0 >= TUNE.MXP_MVP - 1e-6, "MVP 보너스 경험치");
  // 와이어: 토너먼트 중에는 이번 판에서 쌓은 만큼만 보인다
  ma.matchBase = 100;
  (g as any).phase = "tournament";
  const w = g.snapshotMercs().find((x) => x[0] === ma.id)!;
  assert.equal(w[23], 200);
});

test("병종 균형: 같은 조건에서 싸운 병종별 경험치 속도가 크게 치우치지 않는다(측정은 server/bench/calib.ts)", () => {
  const per = 3;
  const secs = 90;
  const sums = UNIT_TYPES.map(() => 0);
  for (const stage of [3, 6]) {
    const g = quiet();
    g.autoSpawn = true;
    (g as any).stage = stage;
    const a = g.addPlayer("bal")!;
    const p = g.getPlayer(a)!;
    for (const t of UNIT_TYPES) for (let i = 0; i < per; i++) g.addMerc(a, t, p.x + 40 * (t - 2) + i * 15, p.y + 40 + 20 * i);
    for (let i = 0; i < secs * TICK_RATE; i++) {
      g.step();
      p.hp = p.maxHp = 1e9;
      p.invuln = 1e9;
    }
    for (const m of (g as any).mercs.values()) sums[m.type] += m.xp + m.tier * 1e6; // 강화된 용병이 있으면 크게 틀어지므로 경험치만 본다
  }
  const mean = sums.reduce((x, y) => x + y, 0) / sums.length;
  const ratios = sums.map((x) => x / mean);
  for (const t of UNIT_TYPES) assert.ok(ratios[t]! > 0.4 && ratios[t]! < 1.9, `병종 ${t} 경험치 비율 ${ratios[t]!.toFixed(2)}`);
  void CAVALRY;
  void ({} as EventWire);
});

test("연속 생존: 싸우는 동안만 시간이 쌓여 경험치 배율이 오르고, 쓰러지면 끊긴다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const idle = (g as any).mercs.get(g.addMerc(a, SPEAR, p.x + 20, p.y, 0, 0));
  const fighter = (g as any).mercs.get(g.addMerc(a, SPEAR, p.x + 20, p.y + 30, 0, 0));
  // 가만히 있으면(싸우지 않으면) 아무리 시간이 지나도 쌓이지 않는다
  run(g, 20);
  assert.equal(idle.streak ?? 0, 0, "싸우지 않으면 연속 생존이 쌓이지 않는다");
  // 싸우는 중으로 표시되는 동안만 쌓인다
  fighter.combatT = TUNE.MXP_COMBAT_SEC;
  run(g, 3);
  assert.ok(fighter.streak > 2.5 && fighter.streak < 3.5, `싸운 만큼만(${fighter.streak})`);
  // 배율: 0 → 1, 최대 시간 → 1 + MXP_STREAK_MAX
  const gain = (m: any) => { const x0 = m.xp; (g as any).meritMerc(m, 100); return m.xp - x0; };
  idle.streak = 0;
  const base = gain(idle);
  idle.streak = TUNE.MXP_STREAK_SEC;
  assert.ok(Math.abs(gain(idle) / base - (1 + TUNE.MXP_STREAK_MAX)) < 1e-6, "최대 배율");
  idle.streak = TUNE.MXP_STREAK_SEC * 5;
  assert.ok(Math.abs(gain(idle) / base - (1 + TUNE.MXP_STREAK_MAX)) < 1e-6, "배율은 최대를 넘지 않는다");
  // 쓰러지면 처음부터, 최장 기록은 남는다
  fighter.streak = 120;
  fighter.career.bestStreak = 120;
  (g as any).hurtMerc(fighter, 99999);
  assert.equal(fighter.streak, 0, "쓰러지면 연속 생존이 끊긴다");
  assert.equal(fighter.career.bestStreak, 120, "최장 기록은 남는다");
});
