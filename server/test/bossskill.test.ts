import { test } from "node:test";
import assert from "node:assert/strict";
import { BOSS_CAV, BSK_CHARGE, BSK_KICK, BSK_ROAR, BSK_SLASH, BSK_SPRINT, CAVALRY, TELE_CONE, TELE_LINE, TICK_RATE } from "@mercenary/shared";
import { Game } from "../src/game.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const boss = (g: Game): any => [...(g as any).enemies.values()].find((e: any) => e.boss);
const run = (g: Game, sec: number, keepAlive = false) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) {
    g.step();
    if (keepAlive) for (const sl of (g as any).slots.values()) sl.state.hp = sl.state.maxHp; // 보스군에게 맞아 쓰러져 판이 끝나지 않게
  }
};
/** 스테이지 1 보스 단계를 열고, 고른 스킬만 쓸 수 있게 다른 스킬의 쿨타임을 막아 둔다 */
function setup(only: number): { g: Game; b: any; a: number } {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.forceBoss();
  const b = boss(g);
  g.step(); // 스킬 상태가 붙는다
  assert.ok(b.bk, "스테이지 1 기병 장군에게 스킬 상태가 붙는다");
  for (let i = 1; i <= 40; i++) b.bk.cds[i] = i === only ? 0 : 999;
  b.bk.idle = 0;
  b.hp = b.maxHp = 1e9; // 시험 중에는 죽지 않게
  return { g, b, a };
}
const place = (e: { x: number; y: number }, x: number, y: number) => {
  e.x = x;
  e.y = y;
};

test("장군 스킬: 스테이지 1 기병 장군만 스킬 상태를 가진다", () => {
  const g = new Game();
  g.autoSpawn = false;
  g.addPlayer("a");
  g.forceBoss();
  g.step();
  const b = boss(g);
  assert.equal(b.type, CAVALRY);
  assert.ok(b.bk);
  const other = [...(g as any).enemies.values()].find((e: any) => !e.boss);
  assert.ok(!other.bk);
});

test("뒷발차기: 뒤에 붙은 대상에게 예고(부채꼴) 뒤 피해와 넉백", () => {
  const { g, b, a } = setup(BSK_KICK);
  const p = g.getPlayer(a)!;
  place(b, p.x + 900, p.y + 900);
  b.face = 0; // 오른쪽을 보고 있다 → 뒤는 왼쪽
  place(p, b.x - 70, b.y); // 주인공이 보스 바로 뒤
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_KICK, "뒤에 붙은 대상이 있으면 뒷발차기를 고른다");
  assert.ok(g.snapshotBossTele().some((t) => t[0] === TELE_CONE), "부채꼴 예고");
  const hp0 = p.hp;
  const x0 = p.x;
  run(g, BOSS_CAV.kickTele + 0.3);
  assert.ok(p.hp < hp0, "맞으면 피해");
  assert.ok(p.x < x0, "뒤로 밀려난다");
});

test("돌진: 취약한 폼을 향해 직선 예고 뒤 달려 지나가며 맞은 대상은 피해와 넉백, 방벽에 부딪히면 기절", () => {
  const { g, b, a } = setup(BSK_CHARGE);
  const p = g.getPlayer(a)!;
  place(b, p.x - 500, p.y);
  b.face = 0;
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_CHARGE);
  const tele = g.snapshotBossTele().find((t) => t[0] === TELE_LINE);
  assert.ok(tele, "직선 예고");
  const ang0 = b.bk.ang;
  const hp0 = p.hp;
  // 예고 동안 주인공이 가만히 서 있으면 맞는다. 방향은 예고 시작 때 고정이다.
  run(g, BOSS_CAV.chargeTele - 0.2);
  assert.equal(b.bk.ang, ang0, "방향이 고정된다");
  run(g, 1.5);
  assert.ok(p.hp < hp0, "달려 지나가며 친다");
  assert.ok((g as any).enemies.get(b.id) !== undefined);
  assert.ok(b.x > p.x - 200, "대상 쪽으로 달려 지나갔다");
});

test("돌진: 진로의 방벽에 부딪히면 기절한다", () => {
  const { g, b, a } = setup(BSK_CHARGE);
  const p = g.getPlayer(a)!;
  place(b, p.x - 500, p.y);
  b.face = 0;
  run(g, 0.1);
  (g as any).walls.push({ id: 9999, owner: a, x: p.x - 250, y: p.y, ang: Math.PI / 2, hl: 120, ht: 12, t: 30, life: 30 });
  run(g, BOSS_CAV.chargeTele + 1);
  assert.ok(b.stunT > 0 || b.x < p.x - 200, "방벽에 막혀 기절하거나 방벽 앞에 멈춘다");
  assert.ok(b.x < p.x - 200, "방벽을 넘지 못한다");
});

test("돌격 함성: 보스군이 5초 동안 강해졌다가 돌아온다", () => {
  const { g, b, a } = setup(BSK_ROAR);
  const hero = g.getPlayer(a)!;
  place(hero, b.x, b.y + 300); // 보스 가까이(함성은 가까운 아군이 있을 때 쓴다)
  const before = [...(g as any).enemies.values()].filter((e: any) => e.army && !e.boss).map((e: any) => ({ e, dmg: e.dmgMult }));
  assert.ok(before.length >= 3);
  run(g, BOSS_CAV.roarTele + 0.2, true);
  assert.ok(before.every(({ e, dmg }) => e.buffT > 0 && Math.abs(e.dmgMult - dmg * BOSS_CAV.roarDmg) < 1e-9), "피해가 올라간다");
  run(g, BOSS_CAV.roarSec + 0.5, true);
  assert.ok(before.every(({ e, dmg }) => !(e.buffT > 0) && Math.abs(e.dmgMult - dmg) < 1e-9), "끝나면 돌아온다");
  void b;
});

test("질주: 일정 시간 이동 속도가 오르고 쿨타임이 돈다", () => {
  const { g, b } = setup(BSK_SPRINT);
  const p = [...(g as any).slots.values()][0].state;
  place(p, 0, 0);
  run(g, BOSS_CAV.sprintTele + 0.2);
  assert.ok(b.bk.v.sprint > 0, "질주 중");
  assert.ok(b.bk.cds[BSK_SPRINT] > 0, "쿨타임");
  run(g, BOSS_CAV.sprintSec + 0.5);
  assert.ok(!(b.bk.v.sprint > 0));
});

test("선회 베기: 대상 둘레 고리 띠를 예고하고 보스가 그 궤도를 돈다", () => {
  const { g, b, a } = setup(BSK_SLASH);
  const p = g.getPlayer(a)!;
  place(b, p.x + 400, p.y);
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_SLASH);
  const tele = g.snapshotBossTele()[0]!;
  assert.equal(tele[8], BSK_SLASH);
  const cx = b.bk.x;
  const cy = b.bk.y;
  run(g, BOSS_CAV.slashTele + 0.8);
  const r = Math.hypot(b.x - cx, b.y - cy);
  assert.ok(Math.abs(r - BOSS_CAV.slashRadius) < 60, `궤도 반지름 ${r}`);
});
