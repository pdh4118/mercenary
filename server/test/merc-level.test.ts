import { test } from "node:test";
import assert from "node:assert/strict";
import { TUNE, SPEAR, levelXpCap, mercLevel, promoLevel, levelNeed } from "@mercenary/shared";
import { Game } from "../src/game.js";

test("레벨은 누적 경험치로 정해지고 최고 레벨에서 멈춘다", () => {
  assert.equal(mercLevel(0), 0);
  assert.equal(mercLevel(levelNeed(0) - 1), 0);
  assert.equal(mercLevel(levelNeed(0)), 1);
  assert.equal(mercLevel(levelXpCap()), TUNE.LV_MAX);
  assert.equal(mercLevel(levelXpCap() * 5), TUNE.LV_MAX);
  assert.equal(promoLevel(0), TUNE.LV_PROMO_EVERY);
});

test("레벨 모드: 레벨이 오르면 강해지고, 승급은 레벨+금화만 있으면 되며 경험치는 줄지 않는다", () => {
  const saved = { ...TUNE };
  TUNE.LV_MODE = 1;
  try {
    const g = new Game();
    const a = g.addPlayer("t")!;
    const p = g.getPlayer(a)!;
    p.gold = 1e6;
    p.leadership = 100;
    const id = g.addMerc(a, SPEAR, p.x + 40, p.y + 40, 0, 0)!;
    const m = (g as any).mercs.get(id);
    const hp0 = (g as any).mercStats(m).hp;
    g.grantMercXpForTest(id, 1e9); // 수정자가 1배라 최고 레벨까지 쌓인다
    assert.equal(mercLevel(m.xp), TUNE.LV_MAX);
    assert.ok((g as any).mercStats(m).hp > hp0 * 2);
    const xp = m.xp;
    for (let t = 0; t < 4; t++) assert.equal(g.upgrade(a, id).ok, true);
    assert.equal(m.tier, 4);
    assert.equal(m.xp, xp);
    // 레벨이 모자라면 승급 불가
    const id2 = g.addMerc(a, SPEAR, p.x + 80, p.y + 40, 0, 0)!;
    g.grantMercXpForTest(id2, levelNeed(0));
    assert.equal(g.upgrade(a, id2).ok, false);
  } finally {
    Object.assign(TUNE, saved);
  }
});

test("레벨 모드 급여: 레벨과 승급 단계가 오를수록 비싸다", () => {
  const saved = { ...TUNE };
  TUNE.LV_MODE = 1;
  try {
    const g = new Game();
    g.autoSpawn = false;
    const a = g.addPlayer("t")!;
    const p = g.getPlayer(a)!;
    const id = g.addMerc(a, SPEAR, p.x + 40, p.y + 40, 0, 0)!;
    const m = (g as any).mercs.get(id);
    const low = (g as any).mercPayrollNow(a);
    g.grantMercXpForTest(id, 1e9);
    m.tier = 2;
    const high = (g as any).mercPayrollNow(a);
    assert.ok(high > low * 3, `${low} → ${high}`);
  } finally {
    Object.assign(TUNE, saved);
  }
});

test("주인공 체력 카드: 기본+레벨 체력에 합산 %라서 레벨이 높을수록 한 장이 더 많이 늘린다", () => {
  const gain = (level: number) => {
    const g = new Game();
    g.autoSpawn = false;
    const a = g.addPlayer("t")!;
    const p = g.getPlayer(a)!;
    const s = (g as any).slots.get(a);
    for (let i = 1; i < level; i++) g.giveXp(a, p.xpNeed);
    const before = p.maxHp;
    s.mods.heroHp += 0.08;
    (g as any).recalcHeroHp(s);
    return p.maxHp - before;
  };
  assert.ok(gain(30) > gain(10) * 2, `${gain(10)} → ${gain(30)}`);
});

test("회전 속도 제한: 용병·적·주인공의 몸 방향은 병종별 최대 속도로만 돈다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("t")!;
  const p = g.getPlayer(a)!;
  const sh = (g as any).mercs.get(g.addMerc(a, 3, p.x + 300, p.y))!; // 검방병(느림)
  const cv = (g as any).mercs.get(g.addMerc(a, 0, p.x + 300, p.y + 100))!; // 기병(빠름)
  const dt = 1 / 20;
  sh.face = 0;
  cv.face = 0;
  (g as any).limitFaces(dt); // 기준 방향 기록
  sh.face = Math.PI; // AI가 정반대로 돌라고 해도
  cv.face = Math.PI;
  (g as any).limitFaces(dt);
  assert.ok(Math.abs(sh.face) <= TUNE.TURN_SLOW * dt + 1e-6, `검방병이 한 틱에 ${sh.face} 돌았다`);
  assert.ok(Math.abs(cv.face) > Math.abs(sh.face) * 1.5, "기병이 더 빨리 돈다");
  for (let i = 0; i < 40; i++) (g as any).limitFaces(dt); // AI가 더 바꾸지 않아도 목표를 향해 계속 돈다
  assert.ok(Math.abs(Math.abs(sh.face) - Math.PI) < 0.05, `시간이 지나면 목표를 본다(${sh.face})`);
  // 주인공 조준
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
  for (let i = 0; i < 40; i++) g.step();
  g.setInput(a, { dx: 0, dy: 0, aim: Math.PI, fire: false });
  g.step();
  assert.ok(Math.abs(p.aim) < 1, `주인공 조준이 한 틱에 정반대를 향했다(${p.aim})`);
});

test("공격 각도 제한: 목표가 몸 앞쪽 120도 안에 있을 때만 공격을 시작한다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("t")!;
  const p = g.getPlayer(a)!;
  const m = (g as any).mercs.get(g.addMerc(a, SPEAR, p.x + 300, p.y))!;
  const st = (g as any).mercStats(m);
  m.faceSet = 0;
  m.face = 0;
  (g as any).startAttack(m, st, Math.PI); // 정반대는 못 친다
  assert.equal(m.atkT, 0, "등 뒤 목표는 공격하지 않는다");
  assert.equal(m.face, Math.PI, "대신 그쪽으로 돌기 시작한다");
  m.faceSet = 0;
  m.face = 0;
  (g as any).startAttack(m, st, (Math.PI * 50) / 180); // 50도는 60도 안이라 친다
  assert.ok(m.atkT > 0, "앞쪽 120도 안이면 공격한다");
  m.atkT = 0;
  m.faceSet = 0;
  m.face = 0;
  (g as any).startAttack(m, st, (Math.PI * 70) / 180); // 70도는 밖
  assert.equal(m.atkT, 0);
});
