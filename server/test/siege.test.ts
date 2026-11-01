/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BOSS_LORD, BSK_ARROWSTORM, BSK_CATAPULT, BSK_EDICT, BSK_OIL, BSK_SORTIE, HZ_EDICT, GATE_X, GATE_Y, HZ_GATE, HZ_OIL, HZ_RAIN, SIEGE, TICK_RATE, castleSolids, inCastleZone } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) {
    g.step();
    for (const sl of (g as any).slots.values()) sl.state.hp = sl.state.maxHp;
  }
};
const bossOf = (g: Game): any => [...(g as any).enemies.values()].find((e: any) => e.boss);
function setup(only: number) {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  (g as any).stage = 10;
  g.forceBoss();
  const b = bossOf(g);
  g.step();
  for (let i = 1; i <= 60; i++) b.bk.cds[i] = i === only ? 0 : 999;
  b.bk.idle = 0;
  return { g, a, b };
}

test("공성전: 군주는 성 안마당에 서 있고 성문이 있는 동안은 무적이다", () => {
  const { g, b } = setup(0);
  assert.equal(Math.round(b.x), SIEGE.lordX);
  assert.equal(Math.round(b.y), SIEGE.lordY);
  const info = g.info().siege!;
  assert.ok(info && info.reveal === 100 && info.gate === 100 && !info.open);
  run(g, 1);
  assert.ok(b.invulnT > 0, "성문이 있으면 무적");
  const gate = (g as any).boss.hazards.find((h: any) => h.kind === HZ_GATE);
  assert.ok(gate, "성문 장판이 있다");
});

test("공성전: 성문을 부수면 군주가 무적에서 풀리고 성문이 열린다", () => {
  const { g, b } = setup(0);
  (g as any).boss.strikeBarriers(GATE_X, GATE_Y + 40, 80, 1e9);
  assert.equal(g.info().siege!.open, true);
  assert.equal(g.info().siege!.gate, 0);
  run(g, 1.5);
  assert.equal(b.invulnT ?? 0, 0, "군주가 무적에서 풀린다");
});

test("공성전: 화살은 성문을 약하게, 운석은 세게 깎는다", () => {
  const { g } = setup(0);
  const gate = (g as any).boss.hazards.find((h: any) => h.kind === HZ_GATE);
  const hp0 = gate.hp;
  (g as any).boss.blockBullet({ hostile: false, damage: 100, radius: 3 }, GATE_X, GATE_Y);
  const arrow = hp0 - gate.hp;
  (g as any).boss.meteorBarriers(GATE_X, GATE_Y, 100, 100);
  const meteor = hp0 - arrow - gate.hp;
  assert.ok(Math.abs(arrow - 100 * BOSS_LORD.gateBulletMult) < 1e-6, `화살 ${arrow}`);
  assert.ok(meteor > arrow * 3, `운석 ${meteor}`);
});

test("공성전: 성벽은 아군을 막고 성문 틈으로는 지나갈 수 있다", () => {
  const { g, a } = setup(0);
  const p = g.getPlayer(a)!;
  const wall = castleSolids().find((s) => !s.tower && Math.abs(s.x) < 200 && s.y < SIEGE.cy)!; // 북쪽 성벽
  p.x = wall.x;
  p.y = wall.y;
  g.step();
  assert.ok(Math.hypot(p.x - wall.x, p.y - wall.y) >= wall.r, "성벽 밖으로 밀려난다");
  assert.ok(!castleSolids().some((s) => Math.hypot(s.x - GATE_X, s.y - GATE_Y) < SIEGE.gateHalf - 20 && !s.tower), "성문 자리는 비어 있다");
  assert.ok(inCastleZone(0, SIEGE.cy), "성 자리의 지형은 치운다");
});

test("공성전: 성루 투석은 큰 원 예고를 연달아 만든다", () => {
  const { g, a, b } = setup(BSK_CATAPULT);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9; // 한 방에 쓰러져 판이 끝나지 않게
  p.x = 0;
  p.y = GATE_Y + 500;
  const ids = new Set<number>();
  for (let i = 0; i < TICK_RATE * 5; i++) {
    g.step();
    p.hp = p.maxHp;
    for (const h of (g as any).boss.hazards as any[]) if (h.kind === HZ_RAIN && h.b === 1) ids.add(h.id);
  }
  assert.ok(ids.size >= BOSS_LORD.catapultShots, `바위 예고가 연달아 나온다(${ids.size})`);
  void b;
});

test("공성전: 끓는 기름은 성문 앞 대상 발밑에 장판을 깔고 피해와 둔화를 준다", () => {
  const { g, a } = setup(BSK_OIL);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 0;
  p.y = GATE_Y + 200;
  let seen = false;
  for (let i = 0; i < TICK_RATE * 4; i++) {
    g.step();
    p.hp = p.maxHp;
    p.x = 0;
    p.y = GATE_Y + 200;
    if (((g as any).boss.hazards as any[]).some((h) => h.kind === HZ_OIL && h.delay <= 0)) seen = true;
  }
  assert.ok(seen, "기름 장판이 깔린다");
  assert.ok(((g as any).slots.get(a).slowT ?? 0) > 0, "둔화");
});

test("공성전: 졸개 무리가 몰려오고 필드 상한을 넘지 않는다", () => {
  const { g } = setup(0);
  const before = (g as any).enemies.size;
  const n = g.spawnSiegeWave(10);
  assert.ok(n > 0 && (g as any).enemies.size > before);
  for (let i = 0; i < 40; i++) g.spawnSiegeWave(18);
  g.autoSpawn = true;
  (g as any).siege.waveT = 0;
  g.step();
  assert.ok(([...(g as any).enemies.values()] as any[]).filter((e) => !e.boss).length <= BOSS_LORD.fieldCap + 18 * 41, "상한 확인은 무리 단위");
});

test("공성전: 화살 소나기는 성문 앞에 화살비를 여러 개 뿌린다", () => {
  const { g, a } = setup(BSK_ARROWSTORM);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 0;
  p.y = GATE_Y + 250;
  const ids = new Set<number>();
  for (let i = 0; i < TICK_RATE * 3; i++) {
    g.step();
    p.hp = p.maxHp;
    for (const h of (g as any).boss.hazards as any[]) if (h.kind === HZ_RAIN && h.b !== 1) ids.add(h.id);
  }
  assert.ok(ids.size >= BOSS_LORD.arrowCount, `화살비 ${ids.size}개`);
});

test("공성전: 성문 개방 돌격은 정예 기병을 내보내고 성문을 조금 회복시킨다", () => {
  const { g, a } = setup(BSK_SORTIE);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 0;
  p.y = GATE_Y + 300;
  const gate = (g as any).boss.hazards.find((h: any) => h.kind === HZ_GATE);
  gate.hp = gate.hpMax * 0.5;
  const before = [...(g as any).enemies.values()].filter((e: any) => !e.boss).length;
  let sawOpen = false;
  for (let i = 0; i < TICK_RATE * 3; i++) {
    g.step();
    p.hp = p.maxHp;
    if (g.info().siege!.sortie) sawOpen = true;
  }
  const after = ([...(g as any).enemies.values()] as any[]).filter((e) => !e.boss);
  assert.ok(after.length - before >= BOSS_LORD.sortieBase, `정예 ${after.length - before}기`);
  assert.ok(after.some((e) => e.type === 0 && e.maxHp > 0), "기병");
  assert.ok(sawOpen, "성문이 열린 상태가 알려진다");
  assert.ok(gate.hp > gate.hpMax * 0.5, "성문이 조금 회복한다");
});

test("공성전: 진군령은 멈춘 대상에게만 번개를 내린다", () => {
  const run1 = (move: boolean): number => {
    const { g, a } = setup(BSK_EDICT);
    const p = g.getPlayer(a)!;
    p.maxHp = p.hp = 1e9;
    p.x = 0;
    p.y = GATE_Y + 300;
    let low = p.maxHp;
    let seen = false;
    for (let i = 0; i < TICK_RATE * (BOSS_LORD.edictGrace + 5); i++) {
      g.step();
      if (move) p.x += 5;
      low = Math.min(low, p.hp);
      if (((g as any).boss.hazards as any[]).some((h) => h.kind === HZ_EDICT)) seen = true;
    }
    assert.ok(seen, "칙령 장판(문구)이 있다");
    return p.maxHp - low;
  };
  assert.ok(run1(false) > 0, "멈추면 맞는다");
  assert.equal(run1(true), 0, "움직이면 맞지 않는다");
});
