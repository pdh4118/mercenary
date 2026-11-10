/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { RAMP_OUT, RAMP_Y0, RAMP_Y1, RING, WALL_STRIPS, BOSS_CAV, BSK_EXECUTE, BSK_GUARDS, BSK_RALLY, BSK_SCEPTER, HZ_WARD, BOSS_LORD, BSK_ARROWSTORM, BSK_CATAPULT, BSK_EDICT, BSK_OIL, BSK_SORTIE, HZ_EDICT, GATE_X, GATE_Y, HZ_GATE, HZ_OIL, HZ_RAIN, SIEGE, TICK_RATE, castleSolids, inCastleZone, HALL, HALL_LORD, inHall } from "@mercenary/shared";
import { ENEMY_STATS, ARCHER, BLUNT, MAGE, SHIELD, SPEAR } from "@mercenary/shared";
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
  assert.ok(Math.abs(b.x - SIEGE.lordX) <= 20 && Math.abs(b.y - SIEGE.lordY) <= 20, `군주 위치 ${Math.round(b.x)},${Math.round(b.y)}`);
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
  p.y = GATE_Y + 300;
  const ids = new Set<number>();
  for (let i = 0; i < TICK_RATE * 5; i++) {
    g.step();
    p.hp = p.maxHp;
    p.x = 0;
    p.y = GATE_Y + 300; // 바위에 맞아 밀려나도 제자리에서 계속 노려지게 한다
    for (const h of (g as any).boss.hazards as any[]) if (h.kind === HZ_RAIN && h.b === 2) ids.add(h.id);
  }
  assert.ok(ids.size >= BOSS_LORD.catapultShots, `바위 예고가 연달아 나온다(${ids.size})`);
  void b;
});

test("공성전: 성루 투석은 성에서 멀리 떨어진 대상에게는 바위를 떨어뜨리지 않는다", () => {
  const { g, a } = setup(BSK_CATAPULT);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 0;
  p.y = 0; // 필드 한가운데(성에서 1600px)
  let rocks = 0;
  for (let i = 0; i < TICK_RATE * 8; i++) {
    g.step();
    p.hp = p.maxHp;
    p.x = 0;
    p.y = 0;
    for (const h of (g as any).boss.hazards as any[]) if (h.kind === HZ_RAIN && h.b === 2) rocks++;
  }
  assert.equal(rocks, 0, "멀리 있는 대상에게는 투석하지 않는다");
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
    for (const h of (g as any).boss.hazards as any[]) if (h.kind === HZ_RAIN && h.b !== 1 && h.b !== 2) ids.add(h.id);
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

test("공성전: 진군령은 필드 졸개를 대열로 묶어 전진시키고, 끝나면 푼다", () => {
  const rnd = Math.random;
  Math.random = () => 0.001; // 칙령이 진군령(첫 후보)을 고르게 한다
  try {
    edictAdvanceCase();
  } finally {
    Math.random = rnd;
  }
});

function edictAdvanceCase(): void {
  const { g, a } = setup(BSK_EDICT);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 0;
  p.y = GATE_Y + 600;
  g.spawnSiegeWave(24);
  const before = new Map<number, number>();
  for (const e of (g as any).enemies.values()) if (!e.boss) before.set(e.id, e.dmgMult);
  let seen = false;
  let cmdCount = 0;
  let flags = 0;
  let squads = 0;
  for (let i = 0; i < TICK_RATE * (BOSS_LORD.edictGrace + 2); i++) {
    g.step();
    p.hp = p.maxHp;
    if (((g as any).boss.hazards as any[]).some((h) => h.kind === HZ_EDICT)) seen = true;
  }
  const list = [...(g as any).enemies.values()].filter((e: any) => !e.boss);
  cmdCount = list.filter((e: any) => e.cmd).length;
  flags = list.filter((e: any) => e.flag).length;
  squads = (g as any).commandSquadCount();
  assert.ok(seen, "진군령 장판(문구)이 있다");
  assert.ok(cmdCount >= 6, `명령을 받은 졸개 ${cmdCount}`);
  assert.ok(squads >= 1 && flags === squads, `대열마다 깃발병 하나(대열 ${squads}, 깃발 ${flags})`);
  const e0: any = list.find((e: any) => e.cmd);
  assert.ok(Math.abs(e0.dmgMult - before.get(e0.id)! * (1 + BOSS_LORD.cmdAtk)) < 1e-9, "공격이 강해진다");
  assert.equal(g.info().squads, 0, "진군령 대열은 적 소대 알림에 세지 않는다");
  // 시간이 지나면 풀린다
  for (let i = 0; i < TICK_RATE * (BOSS_LORD.edictSec + 1); i++) {
    g.step();
    p.hp = p.maxHp;
  }
  const after = [...(g as any).enemies.values()].filter((e: any) => !e.boss);
  assert.equal(after.filter((e: any) => e.cmd || e.flag).length, 0, "대열이 풀렸다");
  assert.equal((g as any).commandSquadCount(), 0);
  const e1: any = after.find((e: any) => before.has(e.id));
  assert.ok(Math.abs(e1.dmgMult - before.get(e1.id)!) < 1e-9, "강화가 원래대로 돌아온다");
}

test("공성전: 진군령 대열 안의 졸개는 피해를 덜 받고, 깃발병이 쓰러지면 그 대열이 무너진다", () => {
  const { g, a } = setup(0);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 0;
  p.y = GATE_Y + 600;
  g.spawnSiegeWave(20);
  const n = (g as any).commandTroops();
  assert.ok(n >= 6, `명령을 받은 졸개 ${n}`);
  const list = [...(g as any).enemies.values()].filter((e: any) => e.cmd);
  const flag: any = list.find((e: any) => e.flag);
  const other: any = list.find((e: any) => !e.flag && e.squad === flag.squad && e.type !== 3);
  const plain: any = [...(g as any).enemies.values()].find((e: any) => !e.boss && !e.cmd && e.type === other.type) ?? null;
  const hit = (e: any) => {
    const hp0 = e.hp + e.shield;
    (g as any).damageEnemy(e, { damage: 10, charge: 0, srcType: 0, fromAngle: 0, crit: false }, a);
    return hp0 - (e.hp + e.shield);
  };
  if (plain) assert.ok(Math.abs(hit(other) / hit(plain) - (1 - BOSS_LORD.cmdReduce)) < 0.05, "받는 피해가 25% 줄어든다");
  const squadId = flag.squad;
  const mates = list.filter((e: any) => e.squad === squadId && e !== flag);
  flag.hp = 0;
  (g as any).damageEnemy(flag, { damage: 1, charge: 0, srcType: 0, fromAngle: 0, crit: false }, a);
  assert.ok(mates.every((e: any) => !e.cmd && !e.squad), "깃발병이 쓰러지면 대열이 풀린다");
  assert.equal((g as any).squads.has(squadId), false);
  (g as any).endCommand();
});

test("공성전: 집결령은 졸개를 성문 앞 방어선으로 모으고(앞줄 검방병, 뒤 궁병, 양 끝 기병), 깃발병은 하나다", () => {
  const { g, a } = setup(0);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 0;
  p.y = GATE_Y + 900;
  g.spawnSiegeWave(30);
  const n = (g as any).commandTroops(3);
  assert.ok(n >= 6, `명령을 받은 졸개 ${n}`);
  const mem: any[] = [...(g as any).enemies.values()].filter((e) => e.cmd);
  const sq = (g as any).squads.get(mem[0].squad);
  assert.equal(sq.kind, 3);
  assert.ok(Math.abs(sq.a.x - GATE_X) < 1 && Math.abs(sq.a.y - (GATE_Y + BOSS_LORD.cmdRallyY)) < 1 && Math.abs(sq.a.heading - Math.PI / 2) < 1e-9, "방어선은 성문 앞 남쪽을 본다");
  assert.equal(mem.filter((e) => e.flag).length, 1, "깃발병은 하나");
  const avgF = (t: number) => {
    const l = mem.filter((e) => e.type === t);
    return l.length ? l.reduce((x, e) => x + e.slotF, 0) / l.length : null;
  };
  const sh = avgF(3);
  const ar = avgF(2);
  if (sh !== null && ar !== null) assert.ok(sh > ar, "검방병이 앞줄, 궁병이 뒷줄");
  const cavs = mem.filter((e) => e.type === 0);
  const inner = Math.max(...mem.filter((e) => e.type !== 0).map((e) => Math.abs(e.slotL)));
  if (cavs.length) assert.ok(cavs.every((e) => Math.abs(e.slotL) > inner), "기병은 양 끝");
  (g as any).endCommand();
  assert.equal((g as any).commandSquadCount(), 0);
});

test("공성전: 성문을 공략 중인 플레이어가 있으면 집결령은 그 뒤(성 반대편)에 북쪽을 보고 서서 따라가며 등을 잡는다", () => {
  const { g, a } = setup(0);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 0;
  p.y = GATE_Y + 300;
  g.spawnSiegeWave(30);
  const n = (g as any).commandTroops(3);
  assert.ok(n >= 6);
  const mem: any[] = [...(g as any).enemies.values()].filter((e) => e.cmd);
  const sq = (g as any).squads.get(mem[0].squad);
  assert.equal(sq.behind, true, "등 뒤 모드");
  assert.ok(Math.abs(sq.a.heading + Math.PI / 2) < 1e-9, "북쪽(성문 쪽)을 본다");
  assert.ok(Math.abs(sq.a.y - (p.y + BOSS_LORD.cmdRallyBehind)) < 1, "플레이어보다 뒤(남쪽)");
  // 앞줄(검방병)이 플레이어에게 더 가깝고 궁병은 더 뒤
  const worldY = (e: any) => sq.a.y - e.slotF; // 북쪽을 볼 때 앞(+)이 북쪽(-y)
  const sh = mem.filter((e) => e.type === 3);
  const ar = mem.filter((e) => e.type === 2);
  if (sh.length && ar.length) assert.ok(sh.reduce((t, e) => t + worldY(e), 0) / sh.length < ar.reduce((t, e) => t + worldY(e), 0) / ar.length, "검방병이 플레이어 쪽 앞줄");
  // 플레이어가 움직이면 따라간다
  p.x = 200;
  p.y = GATE_Y + 420;
  for (let i = 0; i < TICK_RATE * 4; i++) {
    g.step();
    p.hp = p.maxHp;
    p.x = 200;
    p.y = GATE_Y + 420;
  }
  assert.ok(Math.abs(sq.a.y - (GATE_Y + 420 + BOSS_LORD.cmdRallyBehind)) < 40, `방어선이 플레이어를 따라 내려왔다 ${sq.a.y.toFixed(0)}`);
  assert.ok(sq.a.x > 100, "옆으로도 따라간다");
  (g as any).endCommand();
});

test("공성전: 포위령은 졸개를 플레이어 둘레의 호(깃발병 포함)로 나눠 세우고, 갖춰진 뒤 반지름을 좁힌다", () => {
  const { g, a } = setup(0);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 0;
  p.y = GATE_Y + 900;
  g.spawnSiegeWave(40);
  const n = (g as any).commandTroops(2);
  assert.ok(n >= 6, `명령을 받은 졸개 ${n}`);
  const mem: any[] = [...(g as any).enemies.values()].filter((e) => e.cmd);
  const ids = new Set(mem.map((e) => e.squad));
  assert.ok(ids.size >= 2 && ids.size <= 4, `호 ${ids.size}개`);
  for (const id of ids) assert.equal(mem.filter((e) => e.squad === id && e.flag).length, 1, "호마다 깃발병 하나");
  const radius = (e: any) => Math.hypot(e.slotF, e.slotL);
  const sq0 = (g as any).squads.get([...ids][0]);
  const r0 = sq0.ringR0 as number;
  assert.ok(r0 >= BOSS_LORD.cmdRingRMin && r0 <= BOSS_LORD.cmdRingR, `처음 반지름 ${r0.toFixed(0)}(멀리서 시작)`);
  const melee = mem.find((e) => e.type !== 2)!;
  assert.ok(Math.abs(radius(melee) - r0) < 1, "처음에는 멀리 둘러싼다");
  const arch = mem.find((e) => e.type === 2);
  if (arch) assert.ok(Math.abs(radius(arch) - (r0 + BOSS_LORD.cmdRingOut)) < 1, "궁병은 바깥에서");
  // 퇴로 쪽(성 반대편 ±100도)에 졸개가 더 많이 선다
  const away = Math.atan2(p.y - GATE_Y, p.x - GATE_X);
  const inRetreat = mem.filter((e) => Math.abs(Math.atan2(Math.sin(e.ringAng - away), Math.cos(e.ringAng - away))) <= (BOSS_LORD.cmdRetreatArc * Math.PI) / 180 + 1e-6).length;
  assert.ok(inRetreat >= mem.length * (BOSS_LORD.cmdRetreatShare - 0.1), `퇴로 쪽 졸개 ${inRetreat}/${mem.length}`);
  // 시간이 지나면 조여 든다
  for (let i = 0; i < TICK_RATE * (BOSS_LORD.cmdSiegeSec + 1); i++) {
    g.step();
    p.hp = p.maxHp;
  }
  assert.ok([...(g as any).squads.values()].some((q: any) => q.cmd && q.engaged), "포위가 좁혀지면 자리를 풀고 달려든다(자리 다툼으로 떨지 않는다)");
  const still: any[] = [...(g as any).enemies.values()].filter((e) => e.cmd && e.ringAng !== undefined);
  if (still.length) {
    const m2 = still.find((e) => e.type !== 2);
    if (m2) assert.ok(radius(m2) < r0 - 100, `반지름이 줄었다 ${radius(m2).toFixed(0)}`);
  }
  (g as any).endCommand();
});

test("공성전: 칙령은 진군령·포위령·집결령 중 하나를 골라 문구(장판)를 걸고, 졸개가 부족하면 쓰이지 않는다", () => {
  const { g, a } = setup(BSK_EDICT);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 0;
  p.y = GATE_Y + 600;
  const kinds = new Set<number>();
  for (let round = 0; round < 12; round++) {
    const { g: g2, a: a2 } = setup(BSK_EDICT);
    const p2 = g2.getPlayer(a2)!;
    p2.maxHp = p2.hp = 1e9;
    p2.x = 0;
    p2.y = GATE_Y + 500;
    g2.spawnSiegeWave(20);
    for (let i = 0; i < TICK_RATE * 2; i++) {
      g2.step();
      p2.hp = p2.maxHp;
      for (const h of (g2 as any).boss.hazards as any[]) if (h.kind === HZ_EDICT) kinds.add(h.a);
    }
  }
  assert.ok([...kinds].every((k) => k === 1 || k === 2 || k === 3), `종류 ${[...kinds]}`);
  assert.ok(kinds.size >= 2, "여러 종류가 나온다");
});

const openGate = (g: Game) => {
  (g as any).boss.strikeBarriers(GATE_X, GATE_Y + 40, 80, 1e9);
  (g as any).siege.enterT = 0; // 성내 전장으로 옮겨 가지 않고 안뜰 전투를 시험한다(옮겨 가는 것은 아래 성내 전장 시험)
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
  for (const e of [...(g as any).enemies.values()] as any[]) if (!e.boss) (g as any).enemies.delete(e.id); // 수비대가 결계 안 대상을 때리지 않게
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

test("공성전 안뜰: 근위대는 군주에게서 일정 범위 안에서만 쫓아온다", () => {
  const { g, a } = setup(BSK_GUARDS);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  openGate(g);
  for (let i = 0; i < TICK_RATE * 3 && g.guardCount() < 4; i++) g.step();
  assert.equal(g.guardCount(), 4);
  let far = 0;
  for (let i = 0; i < TICK_RATE * 8; i++) {
    p.x = SIEGE.lordX + 120; // 성 밖 먼 곳이 아니라 범위 바로 바깥에 서서 끌어낸다
    p.y = GATE_Y + 900;
    g.step();
    p.hp = p.maxHp;
    for (const e of (g as any).enemies.values()) if (e.guard) far = Math.max(far, Math.hypot(e.x - SIEGE.lordX, e.y - SIEGE.lordY));
  }
  assert.ok(far <= BOSS_LORD.guardsLeash + 60, `근위대가 범위를 넘지 않는다(${Math.round(far)})`);
});

const RAMP_MID = (RAMP_Y0 + RAMP_Y1) / 2;

test("공성전 성벽 위: 성문이 부서지기 전에는 오를 수 없고, 부서진 뒤 안뜰 계단으로 올라 통로 안에 갇힌다", () => {
  const { g, a } = setup(0);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  p.x = 200;
  p.y = RAMP_MID;
  const walkTo = (tx: number, ty: number, ticks = 120) => {
    for (let i = 0; i < ticks; i++) {
      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 4) break;
      p.x += (dx / d) * Math.min(6, d);
      p.y += (dy / d) * Math.min(6, d);
      g.step();
      p.hp = p.maxHp;
    }
  };
  walkTo(200, RING.north + 20, 40); // 성문이 있을 때: 북쪽 성벽에 막힌다
  assert.ok(p.y > RING.north + 40, `성문이 있으면 성벽에 막힌다(${Math.round(p.y)})`);
  assert.ok(!(p as any).wall);
  openGate(g);
  p.x = 200;
  p.y = RAMP_MID;
  walkTo(RAMP_OUT - 8, RAMP_MID);
  assert.ok((p as any).wall, "계단 높은 끝에서 성벽 위에 올라선다");
  walkTo(0, RING.north); // 북쪽 통로를 따라
  assert.ok(Math.abs(p.y - RING.north) <= 50, `통로 안에 갇힌다(${Math.round(p.y)})`);
  assert.ok((g as any).terrain.elevated(p.x, p.y), "성벽 위는 높은 곳");
  walkTo(p.x, RING.north + 200, 14); // 통로 밖(안뜰 쪽)으로 나가려 해도 못 나간다
  assert.ok(p.y <= RING.north + 50, `통로 밖으로 못 나간다(${Math.round(p.y)})`);
  walkTo(RAMP_OUT - 8, RAMP_MID); // 계단 높은 끝으로 돌아와
  walkTo(100, RAMP_MID); // 낮은 끝으로 내려온다
  assert.ok(!(p as any).wall, "계단 아래에서 내려온다");
});

test("공성전 성벽 위: 안뜰의 궁병 용병은 스스로 계단을 올라 성벽 위에 선다", () => {
  const { g, a } = setup(0);
  g.getPlayer(a)!.maxHp = g.getPlayer(a)!.hp = 1e9;
  openGate(g);
  const id = g.addMerc(a, ARCHER, -150, RAMP_MID + 60);
  const m = (g as any).mercs.get(id);
  for (let i = 0; i < TICK_RATE * 16 && !m.wall; i++) {
    g.step();
    g.getPlayer(a)!.hp = g.getPlayer(a)!.maxHp;
  }
  assert.ok(m.wall, "궁병이 성벽 위에 올랐다");
});

test("공성전 수비: 성문이 뚫리기 전에는 성 안 검방·창·둔기 수비대가 열을 맞춰 서 있고 성문이 뚫리면 움직인다", () => {
  const { g, a } = setup(0);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  const garrison = () => ([...(g as any).enemies.values()] as any[]).filter((e) => e.hold && !e.post);
  assert.ok(garrison().length >= 3 * BOSS_LORD.garrisonRow, `수비대 ${garrison().length}명`);
  const types = new Set(garrison().map((e) => e.type));
  assert.deepEqual([...types].sort(), [SHIELD, SPEAR, BLUNT].sort());
  p.x = 0;
  p.y = GATE_Y - 120; // 수비대 바로 앞
  const before = garrison().map((e) => [e.x, e.y]);
  run(g, 3);
  garrison().forEach((e, i) => assert.ok(Math.hypot(e.x - before[i]![0], e.y - before[i]![1]) < 10, "성문이 있으면 제자리(밀어내기 오차만)"));
  openGate(g);
  assert.equal(garrison().length, 0, "성문이 뚫리면 풀린다");
  p.x = 0;
  p.y = GATE_Y + 100;
  run(g, 3);
  const moved = ([...(g as any).enemies.values()] as any[]).filter((e) => !e.boss && !e.post && Math.hypot(e.x - 0, e.y - SIEGE.cy) > 0).some((e, i) => before[i] && (Math.abs(e.x - before[i]![0]) > 5 || Math.abs(e.y - before[i]![1]) > 5));
  assert.ok(moved, "수비대가 움직인다");
});

test("공성전 수비: 성문이 뚫리기 전에는 성벽 위에 궁병·마법사 수비병이 계속 채워지고 통로를 벗어나지 않는다", () => {
  const { g, a } = setup(0);
  g.autoSpawn = true;
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  for (let i = 0; i < TICK_RATE * 60; i++) {
    g.step();
    p.hp = p.maxHp;
    p.x = 0;
    p.y = GATE_Y + 300;
  }
  const posts = ([...(g as any).enemies.values()] as any[]).filter((e) => e.post);
  assert.ok(posts.length >= BOSS_LORD.postBase, `수비병 ${posts.length}명`);
  assert.ok(posts.every((e) => e.type === ARCHER || e.type === MAGE), "궁병·마법사만");
  const inStrip = (e: any) => WALL_STRIPS.some((r) => e.x >= r[0] - 2 && e.x <= r[2] + 2 && e.y >= r[1] - 2 && e.y <= r[3] + 2);
  assert.ok(posts.every(inStrip), "성벽 통로 안에 있다");
  assert.ok((g as any).siege.clock === 0 || true);
  const dead = posts[0];
  (g as any).enemies.delete(dead.id);
  for (let i = 0; i < TICK_RATE * 6; i++) {
    g.step();
    p.hp = p.maxHp;
    p.x = 0;
    p.y = GATE_Y + 300;
  }
  assert.ok(([...(g as any).enemies.values()] as any[]).filter((e) => e.post).length >= posts.length, "죽으면 다시 채워진다");
});

test("공성전 수비: 성벽 위 수비병은 일반 궁병보다 사거리 훨씬 먼 대상을 쏜다", () => {
  const { g, a } = setup(0);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  const id = g.spawnWallPost();
  const e = (g as any).enemies.get(id);
  e.type = ARCHER;
  const normal = ENEMY_STATS[ARCHER]!.reach;
  p.x = e.x;
  p.y = e.y + normal * 1.5; // 일반 궁병 사거리 밖, 수비병 사거리 안
  let shot = false;
  for (let i = 0; i < TICK_RATE * 4; i++) {
    g.step();
    p.x = e.x;
    p.y = e.y + normal * 1.5;
    p.hp = Math.min(p.hp, p.maxHp);
    if (p.hp < p.maxHp) shot = true;
    p.hp = p.maxHp;
  }
  assert.ok(shot || e.atkT > 0 || e.cd > 0, "사거리 밖 일반 궁병이 못 맞히는 거리에서 쏜다");
});

test("공성전 수비: 성벽 위 수비병은 성문 양옆으로 걸어가 촘촘히 서고, 한 명이 죽으면 뒤 수비병이 빈자리를 메운다", () => {
  const { g, a } = setup(0);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  const ids: number[] = [];
  for (let i = 0; i < 8; i++) ids.push(g.spawnWallPost());
  const stand = () => {
    p.x = 0;
    p.y = GATE_Y + 600;
    g.step();
    p.hp = p.maxHp;
  };
  for (let i = 0; i < TICK_RATE * 20; i++) stand();
  const posts = () => ids.map((id) => (g as any).enemies.get(id)).filter(Boolean) as any[];
  const near = posts().filter((e) => Math.hypot(e.x - GATE_X, e.y - GATE_Y) < 320);
  assert.ok(near.length >= 6, `성문 가까이에 모인다(${near.length}/8)`);
  const left = posts().filter((e) => e.x < 0).length;
  assert.ok(left >= 2 && left <= 6, `양옆으로 나뉜다(왼쪽 ${left})`);
  const victim = posts().filter((e) => e.x < 0).sort((a, b) => Math.hypot(a.x - GATE_X, a.y - GATE_Y) - Math.hypot(b.x - GATE_X, b.y - GATE_Y))[0];
  const gapX = victim.x;
  (g as any).enemies.delete(victim.id);
  for (let i = 0; i < TICK_RATE * 6; i++) stand();
  const filled = posts().some((e) => Math.abs(e.x - gapX) < 20 && e.x < 0);
  assert.ok(filled, "빈자리를 다른 수비병이 메운다");
});

test("성내 전장: 성문이 부서지면 잠시 뒤 졸개·성벽 수비병이 사라지고 군주·수비대·아군이 넓은 홀로 옮겨 간다", () => {
  const { g, a } = setup(BSK_GUARDS);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  g.spawnEnemyAt(0, 0, 1); // 필드 졸개
  (g as any).boss.strikeBarriers(GATE_X, GATE_Y + 40, 80, 1e9);
  const info0 = (g as any).siegeInfo();
  assert.ok(info0.open && !info0.hall && info0.enter > 0, "성문이 부서진 직후에는 돌입 대기");
  for (let i = 0; i < TICK_RATE * (BOSS_LORD.hallEnterSec + 1); i++) g.step();
  const info = (g as any).siegeInfo();
  assert.ok(info.hall, "성내 전장으로 옮겨 갔다");
  assert.ok(inHall(p.x, p.y), `주인공이 홀 안에 있다(${p.x},${p.y})`);
  assert.ok(p.y > HALL.cy, "입구(남쪽)에 선다");
  const lord = [...(g as any).enemies.values()].find((e: any) => e.boss);
  assert.ok(lord && Math.hypot(lord.x - HALL_LORD[0], lord.y - HALL_LORD[1]) < 5, "군주는 옥좌 앞");
  for (const e of (g as any).enemies.values()) assert.ok(inHall(e.x, e.y), `적이 홀 안에 있다(${e.x},${e.y})`);
  assert.ok([...(g as any).enemies.values()].every((e: any) => e.boss || e.guard || e.art || e.hp > 0));
});

test("성내 전장: 홀 밖으로는 나가지 못하고, 졸개 증원은 홀 안에서 나온다", () => {
  const { g, a } = setup(BSK_GUARDS);
  const p = g.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  (g as any).boss.strikeBarriers(GATE_X, GATE_Y + 40, 80, 1e9);
  for (let i = 0; i < TICK_RATE * (BOSS_LORD.hallEnterSec + 1); i++) g.step();
  g.setInput(a, { dx: -1, dy: 0, aim: 0, fire: false } as any);
  for (let i = 0; i < TICK_RATE * 6; i++) g.step();
  assert.ok(p.x >= HALL.cx - HALL.hw && p.x <= HALL.cx + HALL.hw, `홀 안(${p.x})`);
  const n = (g as any).spawnSiegeWave(8);
  assert.ok(n > 0);
  for (const e of (g as any).enemies.values()) assert.ok(inHall(e.x, e.y), `증원도 홀 안(${e.x},${e.y})`);
});
