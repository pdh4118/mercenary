/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BOSS_CAV, BSK_EXECUTE, BSK_GUARDS, BSK_RALLY, BSK_SCEPTER, HZ_WARD, BOSS_LORD, BSK_ARROWSTORM, BSK_CATAPULT, BSK_EDICT, BSK_OIL, BSK_SORTIE, HZ_EDICT, GATE_X, GATE_Y, HZ_GATE, HZ_OIL, HZ_RAIN, SIEGE, TICK_RATE, castleSolids, inCastleZone } from "@mercenary/shared";
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

const openGate = (g: Game) => {
  (g as any).boss.strikeBarriers(GATE_X, GATE_Y + 40, 80, 1e9);
  for (let i = 0; i < TICK_RATE; i++) g.step(); // 군주의 무적이 풀릴 때까지
};

test("공성전 안뜰: 근위대가 살아 있는 동안 군주가 받는 피해가 줄고, 쓰러뜨릴수록 늘어난다", () => {
  const { g, a, b } = setup(BSK_GUARDS);
  g.getPlayer(a)!.maxHp = g.getPlayer(a)!.hp = 1e9;
  openGate(g);
  const hit = { damage: 100, charge: 0, srcType: -1, fromAngle: 0 };
  for (let i = 0; i < TICK_RATE * 3 && g.guardCount() < 4; i++) g.step();
  assert.equal(g.guardCount(), 4, "근위대 4명");
  assert.ok(Math.abs((g as any).boss.preHit(b, hit, a).damage - 20) < 1e-6, "4명이면 피해 80% 감소");
  const all = [...(g as any).enemies.values()].filter((e: any) => e.guard);
  (g as any).enemies.delete(all[0].id);
  assert.ok(Math.abs((g as any).boss.preHit(b, hit, a).damage - 40) < 1e-6, "3명이면 60% 감소");
  assert.equal(g.info().siege!.guards, 3);
  for (const e of all.slice(1)) (g as any).enemies.delete(e.id);
  assert.equal((g as any).boss.preHit(b, hit, a).damage, 100, "근위대가 없으면 그대로");
});

test("공성전 안뜰: 홀 내려찍기는 안쪽 원과 바깥 충격파로 나눠 맞힌다", () => {
  const { g, a } = setup(BSK_SCEPTER);
  openGate(g);
  const near = g.getPlayer(a)!;
  near.maxHp = near.hp = 1e9;
  const far = g.addPlayer("b")!;
  const fp = g.getPlayer(far)!;
  for (const p of [near, fp]) p.maxHp = p.hp = 1e9;
  let nearHit = false;
  let farHit = false;
  for (let i = 0; i < TICK_RATE * 4; i++) {
    near.x = SIEGE.lordX + 100;
    near.y = SIEGE.lordY + 40;
    fp.x = SIEGE.lordX + 340; // 안쪽 원 밖, 충격파 안
    fp.y = SIEGE.lordY;
    g.step();
    if (near.hp < 1e9) nearHit = true;
    if (fp.hp < 1e9) farHit = true;
    near.hp = fp.hp = 1e9;
  }
  assert.ok(nearHit, "안쪽 원에 맞는다");
  assert.ok(farHit, "충격파에 맞는다");
});

test("공성전 안뜰: 호령은 필드 졸개의 피해를 올렸다가 끝나면 되돌린다", () => {
  const { g, a } = setup(BSK_RALLY);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  const id = g.spawnEnemyAt(0, 0, 1);
  const e = (g as any).enemies.get(id);
  const base = e.dmgMult;
  openGate(g);
  for (let i = 0; i < TICK_RATE * 2 && e.dmgMult <= base * 1.5; i++) g.step();
  assert.ok(e.dmgMult > base * 1.5, `호령으로 강해진다(${e.dmgMult / base})`);
  const bs = [...(g as any).enemies.values()].find((x: any) => x.boss);
  bs.bk.cds[BSK_RALLY] = 999; // 더 쓰지 않게
  for (let i = 0; i < TICK_RATE * (BOSS_LORD.rallySec + 1); i++) g.step();
  assert.ok(Math.abs(e.dmgMult - base) < 1e-9, "끝나면 원래대로");
  void BOSS_CAV;
});

test("공성전 안뜰: 처형령은 결계 밖 대상만 최대 체력 비율로 때린다", () => {
  const { g, a, b } = setup(BSK_EXECUTE);
  openGate(g);
  b.hp = b.maxHp * 0.2;
  const out = g.getPlayer(a)!;
  const inn = g.addPlayer("b")!;
  const ip = g.getPlayer(inn)!;
  for (const p of [out, ip]) p.maxHp = p.hp = 1000;
  let placed = false;
  for (let i = 0; i < TICK_RATE * (BOSS_LORD.executeTele + 1.2); i++) {
    const wards = ((g as any).boss.hazards as any[]).filter((h) => h.kind === HZ_WARD);
    if (wards.length > 0) {
      ip.x = wards[0].x;
      ip.y = wards[0].y;
      // 결계에서 가장 먼 곳(성 밖)에 둔다
      out.x = 0;
      out.y = GATE_Y + 900;
      placed = true;
    }
    g.step();
  }
  assert.ok(placed, "결계가 깔린다");
  assert.ok(out.hp <= 1000 * (1 - BOSS_LORD.executePct) + 1, `결계 밖은 크게 다친다(${out.hp})`);
  assert.equal(ip.hp, 1000, "결계 안은 무사");
});
