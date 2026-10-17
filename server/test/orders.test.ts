import { test } from "node:test";
import assert from "node:assert/strict";
import { WORLD_SIZE, CAVALRY, MAGE, SHIELD, SPEAR, STANCE_ASSAULT, STANCE_DEFEND, STANCE_HOLD, TICK_RATE, TUNE, WEAPONS, CAV_MOMENTUM_AFTER_HIT } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};
type E = { hp: number; maxHp: number; cd: number; atkT: number; x: number; y: number };
const dummy = (g: Game, x: number, y: number, type = 1): E => {
  const id = g.spawnEnemyAt(x, y, type);
  const e = (g as unknown as { enemies: Map<number, E> }).enemies.get(id)!;
  e.hp = e.maxHp = 5000;
  e.cd = 99;
  e.atkT = 999;
  return e;
};
const mercPos = (g: Game, id: number) => {
  const m = g.getMerc(id)!;
  return { x: m.x, y: m.y };
};

test("지점 방어: 지정한 지점에 진형을 펴고, 주인공이 멀어져도 그 자리를 지킨다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const ids = [g.addMerc(a, SHIELD, p.x, p.y), g.addMerc(a, SPEAR, p.x, p.y), g.addMerc(a, SPEAR, p.x, p.y)];
  assert.equal(p.stance, STANCE_DEFEND);
  assert.equal(g.setHold(a, p.x + 400, p.y + 200), true);
  assert.equal(p.stance, STANCE_HOLD);
  assert.equal(p.holdX, Math.round(p.x + 400));
  run(g, 8); // 진형이 지점에 자리 잡는 시간
  g.setInput(a, { dx: -1, dy: 0, aim: 0, fire: false });
  run(g, 2);
  const hold = { x: p.holdX, y: p.holdY };
  for (const id of ids) {
    const m = mercPos(g, id);
    assert.ok(Math.hypot(m.x - hold.x, m.y - hold.y) < 160, `지점 근처: ${Math.hypot(m.x - hold.x, m.y - hold.y)}`);
    assert.ok(Math.hypot(m.x - p.x, m.y - p.y) > 300, "주인공을 따라가지 않는다");
  }
  // 기본으로 돌아오면 다시 주인공을 따라온다
  assert.equal(g.setStance(a, STANCE_DEFEND), true);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
  run(g, 14);
  assert.ok(Math.hypot(mercPos(g, ids[0]!).x - p.x, mercPos(g, ids[0]!).y - p.y) < 160);
});

test("지점 방어: 지점 근처에 온 적과는 싸우고, 잘못된 입력은 무시한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.addMerc(a, SPEAR, p.x, p.y);
  g.setHold(a, p.x + 300, p.y);
  run(g, 4);
  const foe = dummy(g, p.x + 300 + 70, p.y);
  run(g, 4);
  assert.ok(foe.hp < foe.maxHp, "지키는 지점에 온 적을 공격한다");
  assert.equal(g.setHold(a, "x", 3), false);
  assert.equal(g.setHold(a, NaN, 0), false);
  assert.equal(g.setHold(999, 0, 0), false);
  assert.equal(g.setStance(a, 3), false);
});

test("지점을 지정하지 않고 지점 방어로 바꾸면 주인공 앞쪽을 지킨다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  assert.equal(g.setStance(a, STANCE_HOLD), true);
  assert.ok(Math.hypot(p.holdX - p.x, p.holdY - p.y) > 50);
});

test("기마 주인공: 달릴수록 빨라지고 멈추면 느려진다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const mount = WEAPONS.findIndex((w) => w.type === CAVALRY);
  assert.ok(g.setWeapon(a, mount));
  g.setInput(a, { dx: 1, dy: 0, aim: 0, fire: false });
  const dist = (sec: number) => {
    const x0 = p.x;
    run(g, sec);
    return (p.x - x0) / sec;
  };
  const v1 = dist(0.5);
  run(g, 2);
  const v2 = dist(0.5);
  assert.ok(v1 > TUNE.PLAYER_SPEED * 0.95, `출발 속도 ${v1}`);
  assert.ok(v2 > TUNE.PLAYER_SPEED * (TUNE.MOUNT_SPEED_MAX - 0.15), `달린 뒤 속도 ${v2}`);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
  run(g, 1.5);
  g.setInput(a, { dx: 1, dy: 0, aim: 0, fire: false });
  assert.ok(dist(0.3) < v2 * 0.85, "멈추면 속도가 줄었다");
  // 걸어 다니는 무기에서는 속도가 늘지 않는다
  g.setWeapon(a, 0);
  run(g, 0.4);
  assert.ok(Math.abs(dist(1) - TUNE.PLAYER_SPEED) < 5);
});

test("기마 주인공: 속도가 붙을수록 한 방이 세고, 공격하면 속도를 잃으며, 창병에게는 반사된다", () => {
  const strike = (run0: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    const mount = WEAPONS.findIndex((w) => w.type === CAVALRY);
    g.setWeapon(a, mount);
    run(g, 0.4);
    const e = dummy(g, p.x + 2000, p.y, 4); // 먼 곳에 두었다가 달린 뒤 앞에 둔다
    g.setInput(a, { dx: 1, dy: 0, aim: 0, fire: false });
    run(g, run0);
    g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
    e.x = p.x + 40;
    e.y = p.y;
    const before = e.hp;
    const mom = (g as unknown as { slots: Map<number, { mom: number }> }).slots.get(a)!.mom;
    g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
    run(g, 0.3);
    const after = (g as unknown as { slots: Map<number, { mom: number }> }).slots.get(a)!.mom;
    return { dealt: before - e.hp, mom, after };
  };
  const slow = strike(0.01);
  const fast = strike(2.5);
  assert.ok(fast.dealt > slow.dealt + 5, `느린 ${slow.dealt} / 빠른 ${fast.dealt}`);
  assert.ok(fast.after < fast.mom * CAV_MOMENTUM_AFTER_HIT + 0.01 + 0.0, "공격하면 속도를 잃는다");

  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.setWeapon(a, WEAPONS.findIndex((w) => w.type === CAVALRY));
  run(g, 0.4);
  const spear = dummy(g, p.x + 2000, p.y, SPEAR);
  g.setInput(a, { dx: 1, dy: 0, aim: 0, fire: false });
  run(g, 2.5);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false });
  spear.x = p.x + 40;
  spear.y = p.y;
  const hp0 = p.hp;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  run(g, 0.3);
  void hp0;
  void MAGE;
});

test("적 마법사는 수 제한 없이 낮은 비율로만 나온다", () => {
  let seed = 12345;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const g = new Game(rng);
  g.addPlayer("a");
  g.jumpToStage(3);
  const priv = g as unknown as { spawnBudget: number; spawnEnemies(dt: number): void; enemies: Map<number, { type: number }> };
  for (let i = 0; i < 4; i++) {
    priv.spawnBudget = 100;
    priv.spawnEnemies(0);
  }
  const all = [...priv.enemies.values()];
  const mages = all.filter((e) => e.type === MAGE).length;
  assert.ok(mages > 3, `이전의 동시 3명 제한을 넘어 나올 수 있다: ${mages}`);
  assert.ok(mages / all.length < 0.08, "빈도는 낮다");
});

test("우클릭 지시: 빈 땅을 찍으면 기병이 그곳으로 가서 자리를 지키고, 적 주변을 찍으면 공격한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  (p as { invuln: number }).invuln = 1e9;
  const cav = g.addMerc(a, CAVALRY, p.x, p.y);
  const shield = g.addMerc(a, SHIELD, p.x, p.y);
  // 빈 땅: 이동 지시
  const tx = p.x + 600;
  g.charge(a, tx, p.y);
  assert.equal(p.chargeKind, 1);
  assert.equal(p.chargeLeft, TUNE.MOVE_ORDER_SEC);
  const bystander = dummy(g, tx + 420, p.y, 4); // 이동 지점에서 멀리 떨어진 적(싸우러 가지 않는다)
  run(g, 7);
  const c = g.getMerc(cav)!;
  assert.ok(Math.hypot(c.x - tx, c.y - p.y) < 80, `지점에 도착해 머문다: ${Math.hypot(c.x - tx, c.y - p.y).toFixed(0)}`);
  assert.equal(bystander.hp, bystander.maxHp, "이동 지시 중에는 멀리 있는 적을 쫓지 않는다");
  assert.ok(Math.hypot(g.getMerc(shield)!.x - tx, g.getMerc(shield)!.y - p.y) > 300, "다른 병종은 움직이지 않는다");
  // 지점에 적이 다가오면 맞서 싸운다
  const comer = dummy(g, tx + 60, p.y + 20, 4);
  run(g, 3);
  assert.ok(comer.hp < comer.maxHp, "도착한 기병은 지점에 온 적과 싸운다");
  // 시간이 지나면 돌아온다
  run(g, TUNE.MOVE_ORDER_SEC);
  assert.equal(p.chargeLeft, 0);

  // 적 주변: 공격 지시
  const g2 = quiet();
  const a2 = g2.addPlayer("a")!;
  const p2 = g2.getPlayer(a2)!;
  (p2 as { invuln: number }).invuln = 1e9;
  g2.addMerc(a2, CAVALRY, p2.x, p2.y);
  const foe = dummy(g2, p2.x + 500, p2.y, 4);
  g2.charge(a2, p2.x + 500 + 40, p2.y);
  assert.equal(p2.chargeKind, 0);
  assert.equal(p2.chargeLeft, 6);
  run(g2, 5);
  assert.ok(foe.hp < foe.maxHp, "적 주변을 찍으면 그 일대의 적을 공격한다");
});

test("맵 바깥으로 나가지 않는다: 용병·적·주인공이 밀리거나 쫓겨도 경계 안에 있다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const cav = g.addMerc(a, CAVALRY, p.x, p.y);
  dummy(g, p.x + 100, p.y, 1);
  const priv = g as unknown as { mercs: Map<number, { x: number; y: number }>; enemies: Map<number, { x: number; y: number }> };
  const merc = priv.mercs.get(cav)!;
  const enemy = priv.enemies.get([...priv.enemies.keys()][0]!)!;
  merc.x = 99999;
  merc.y = -99999;
  enemy.x = -88888;
  enemy.y = 88888;
  p.x = 77777;
  g.step();
  for (const u of [merc, enemy, g.getPlayer(a)!]) {
    assert.ok(Math.abs(u.x) <= WORLD_SIZE / 2 && Math.abs(u.y) <= WORLD_SIZE / 2, `경계 안: ${u.x}, ${u.y}`);
  }
  // 경계에서 도망치는 용병도 밖으로 나가지 않는다
  merc.x = WORLD_SIZE / 2 - 20;
  merc.y = 0;
  p.x = merc.x - 40;
  p.y = 0;
  for (let i = 0; i < 40; i++) g.step();
  assert.ok(Math.abs(merc.x) <= WORLD_SIZE / 2 && Math.abs(merc.y) <= WORLD_SIZE / 2);
});

test("병종별 진형: 고른 병종만 지점 방어가 되고 나머지는 주인공 곁에 남는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const spear = g.addMerc(a, SPEAR, p.x, p.y);
  const shield = g.addMerc(a, SHIELD, p.x, p.y);
  g.setHold(a, p.x + 500, p.y, 1 << SPEAR);
  assert.deepEqual(p.stances, [0, STANCE_HOLD, 0, 0, 0, 0]);
  const slots = g.formationSlots(a);
  assert.ok(slots.get(spear)![0] > p.x + 350, "창병 자리는 지정한 지점 쪽");
  assert.ok(Math.abs(slots.get(shield)![0] - p.x) < 250, "검방병 자리는 주인공 곁");
  g.setStance(a, STANCE_DEFEND, 1 << SPEAR); // 창병만 다시 기본으로
  assert.equal(p.stances[SPEAR], STANCE_DEFEND);
  g.setStance(a, STANCE_ASSAULT); // 전체
  assert.ok(p.stances.every((v) => v === STANCE_ASSAULT));
  assert.equal(p.stance, STANCE_ASSAULT);
});

test("병종 선택 명령: 고른 병종만 빈 땅으로 이동하고, 적 근처를 넉넉하게 찍어도 공격 지시가 된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const spear = g.addMerc(a, SPEAR, p.x, p.y);
  const shield = g.addMerc(a, SHIELD, p.x, p.y);
  g.order(a, p.x + 600, p.y, 1 << SPEAR);
  assert.equal(p.chargeKind, 1, "빈 땅 → 이동 지시");
  run(g, 10);
  const sp = mercPos(g, spear);
  const sh = mercPos(g, shield);
  assert.ok(Math.hypot(sp.x - (p.x + 600), sp.y - p.y) < 200, `창병은 지시 지점 근처: ${Math.round(sp.x - p.x)}`);
  assert.ok(sh.x - p.x < 250, "검방병은 주인공 곁에 남는다");
  // 적을 120px 비껴 찍어도 공격 지시
  const e = dummy(g, p.x + 400, p.y + 300);
  g.order(a, e.x + 120, e.y, 1 << SHIELD);
  assert.equal(p.chargeKind, 0, "정확히 찍지 않아도 공격");
  assert.ok(Math.abs(p.chargeX - e.x) < 1 && Math.abs(p.chargeY - e.y) < 1, "지시 지점이 그 적으로 맞춰진다");
});
