import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  ARMY_MAX_UNITS,
  ARMY_AGGRO,
  BLUNT,
  BOSS_TYPES,
  EVT_ARROW_HIT,
  PLAYER_MAX_HP,
  REVIVE_HP_FRAC,
  REVIVE_INVULN_SEC,
  REVIVE_RADIUS,
  REVIVE_DECAY_FACTOR,
  REVIVE_SEC,
  STAGE_BREAK_SEC,
  STAGE_CLEAR_GOLD,
  STAGE_COUNT,
  STAGE_ENEMY_HP_GROWTH,
  STAGE_GROW_SEC,
  START_GOLD,
  ENEMY_STATS,
  SPEAR,
  TICK_RATE,
} from "@mercenary/shared";
import { Game } from "../src/game.js";
import { armyComposition, armyLayout, armySize } from "../src/stage.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const me = (g: Game, id: number) => g.snapshotPlayers().find((p) => p.id === id)!;
const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};
/** 주인공을 쓰러뜨린다(피해를 직접 주입) */
const knockDown = (g: Game, id: number) => {
  const p = g.getPlayer(id) as { hp: number; down: boolean };
  p.hp = 0;
  p.down = true;
};
/** 장군(또는 아무 적)에게 치명타를 준다. 방패를 먼저 없애 확실히 몸에 들어가게 한다. */
const slay = (g: Game, id: number, owner: number) => {
  const e = g.getEnemy(id) as unknown as { hp: number; shield: number };
  e.shield = 0;
  e.hp = 1;
  (g as unknown as { damageEnemy(e: unknown, h: unknown, o: number): number }).damageEnemy(e, { damage: 10, charge: 0, srcType: -1, fromAngle: 0 }, owner);
};
const generalOf = (g: Game) => g.snapshotEnemies().find((e) => e[11] === 1);

test("보스군 병력은 스테이지와 접속 인원에 비례하고 상한이 있다", () => {
  assert.ok(armySize(2, 1) > armySize(1, 1));
  assert.ok(armySize(1, 6) > armySize(1, 3));
  assert.ok(armySize(1, 6) > armySize(1, 1) * 3, "인원이 늘면 크게 늘어난다");
  assert.ok(armySize(STAGE_COUNT, 8) <= ARMY_MAX_UNITS);
});

test("군대 구성은 합이 맞고 여러 병종이 섞이며 장군 병종이 더 많다", () => {
  for (let stage = 1; stage <= STAGE_COUNT; stage++) {
    const comp = armyComposition(stage, 60);
    assert.equal(comp.reduce((a, b) => a + b, 0), 60);
    assert.ok(comp.every((n) => n > 0), `스테이지 ${stage}`);
  }
  const heavy = armyComposition(5, 100); // 장군이 궁병
  assert.ok(heavy[ARCHER]! > armyComposition(1, 100)[ARCHER]!);
});

test("진형 배치: 앞줄은 검방병, 뒤에 궁병, 기병은 양옆 날개, 장군은 가운데", () => {
  const layout = armyLayout(1, 40);
  assert.equal(layout.length, 41); // 병력 + 장군
  assert.equal(layout.filter((l) => l.general).length, 1);
  const front = Math.max(...layout.map((l) => l.forward));
  assert.ok(layout.filter((l) => l.forward === front && l.type !== 0).every((l) => l.type === 3), "맨 앞줄은 검방병");
  const archers = layout.filter((l) => l.type === ARCHER);
  const frontline = layout.filter((l) => l.type === 3);
  assert.ok(Math.max(...archers.map((l) => l.forward)) < Math.min(...frontline.map((l) => l.forward)));
  const cav = layout.filter((l) => l.type === 0);
  assert.ok(cav.some((l) => l.lateral > 0) && cav.some((l) => l.lateral < 0));
  const w = Math.max(...layout.filter((l) => l.type === 3).map((l) => Math.abs(l.lateral)));
  assert.ok(cav.every((l) => Math.abs(l.lateral) > w), "기병은 보병 줄 바깥");
  assert.equal(layout.find((l) => l.general)!.lateral, 0);
  assert.equal(layout.find((l) => l.general)!.type, BOSS_TYPES[0]);
});

test("성장 시간이 지나면 보스군이 진형을 갖추고 등장한다", () => {
  const g = new Game();
  g.autoSpawn = true;
  g.addPlayer("a");
  g.addPlayer("b");
  assert.equal(g.info().phase, "grow");
  assert.equal(g.info().timer, STAGE_GROW_SEC);
  g.forceBoss();
  const info = g.info();
  assert.equal(info.phase, "boss");
  assert.equal(info.armyTotal, armySize(1, 2) + 1);
  assert.equal(info.armyLeft, info.armyTotal);
  const types = new Set(g.snapshotEnemies().map((e) => e[4]));
  assert.ok(types.size >= 4, "병종이 섞여 있다");
  // 모두 플레이어에게서 멀리, 한 덩어리로 등장한다
  const ens = g.snapshotEnemies();
  const cx = ens.reduce((a, e) => a + e[1], 0) / ens.length;
  const cy = ens.reduce((a, e) => a + e[2], 0) / ens.length;
  assert.ok(Math.hypot(cx, cy) > 400);
  assert.ok(ens.every((e) => Math.hypot(e[1] - cx, e[2] - cy) < 600));
});

test("성장 시간이 흐르면 저절로 보스가 등장한다", () => {
  const g = new Game();
  g.addPlayer("a");
  g.autoSpawn = true;
  for (let i = 0; i < STAGE_GROW_SEC * TICK_RATE + 5 && g.info().phase === "grow"; i++) {
    g.getPlayer(1)!.hp = PLAYER_MAX_HP; // 일반 적에게 죽지 않게
    g.step();
  }
  assert.equal(g.info().phase, "boss");
});

test("보스군은 진형을 유지한 채 가장 가까운 주인공을 향해 행군한다", () => {
  const g = quiet();
  g.addPlayer("a");
  g.forceBoss();
  const dist = () => {
    const ens = g.snapshotEnemies();
    return Math.min(...ens.map((e) => Math.hypot(e[1] - me(g, 1).x, e[2] - me(g, 1).y)));
  };
  const before = dist();
  const spread = () => {
    const ens = g.snapshotEnemies();
    const xs = ens.map((e) => e[1]);
    const ys = ens.map((e) => e[2]);
    return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  };
  const s0 = spread();
  run(g, 5);
  assert.ok(dist() < before - 150, "다가온다");
  assert.ok(Math.abs(spread() - s0) < 60, "대열이 흐트러지지 않는다");
});

test("장군을 쓰러뜨리면 스테이지가 클리어되고 보상·휴식이 주어진다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.forceBoss();
  const gold0 = me(g, a).gold;
  const e = g.getEnemy(generalOf(g)![0])!;
  assert.ok(e.maxHp > ENEMY_STATS[e.type]!.hp * 5, "장군은 매우 튼튼하다");
  slay(g, e.id, a);
  const info = g.info();
  assert.equal(info.phase, "break");
  assert.equal(info.stage, 1);
  assert.ok(me(g, a).gold >= gold0 + STAGE_CLEAR_GOLD);
  assert.ok(g.snapshotEnemies().every((en) => en[11] === 0), "남은 병사는 더 이상 보스군이 아니다");
  assert.equal(g.status, "playing");
  run(g, STAGE_BREAK_SEC + 0.5);
  assert.equal(g.info().stage, 2);
  assert.equal(g.info().phase, "grow");
});

test("마지막 스테이지의 장군을 쓰러뜨리면 승리한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.jumpToStage(STAGE_COUNT);
  g.forceBoss();
  slay(g, generalOf(g)![0], a);
  assert.equal(g.status, "victory");
});

test("스테이지가 오를수록 적이 단단해진다", () => {
  const g = quiet();
  g.addPlayer("a");
  const id1 = g.spawnEnemyAt(100, 100, SPEAR);
  g.jumpToStage(4);
  const id2 = g.spawnEnemyAt(100, 100, SPEAR);
  assert.equal(g.getEnemy(id1)!.maxHp, ENEMY_STATS[SPEAR]!.hp);
  assert.ok(Math.abs(g.getEnemy(id2)!.maxHp - ENEMY_STATS[SPEAR]!.hp * (1 + 3 * STAGE_ENEMY_HP_GROWTH)) < 1e-6);
});

test("적 체력은 비율로 전송된다", () => {
  const g = quiet();
  g.addPlayer("a");
  g.jumpToStage(5);
  const id = g.spawnEnemyAt(300, 300, BLUNT);
  const en = g.getEnemy(id) as unknown as { hp: number; maxHp: number };
  en.hp = en.maxHp / 2;
  const w = g.snapshotEnemies().find((e) => e[0] === id)!;
  assert.equal(w[3], 50);
});

test("진형 소속 병사는 멀리 있는 주인공을 쫓아 대열을 벗어나지 않는다", () => {
  const g = quiet();
  g.addPlayer("a");
  g.forceBoss();
  const ens = g.snapshotEnemies();
  const unit = ens.find((e) => e[11] === 0)!;
  run(g, 2);
  const after = g.snapshotEnemies().find((e) => e[0] === unit[0])!;
  assert.ok(Math.hypot(after[1] - unit[1], after[2] - unit[2]) < 200, `행군 속도만큼만 이동 (${ARMY_AGGRO})`);
});

test("동료가 곁에서 부활 키를 누르고 있으면 일으켜 세운다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  knockDown(g, b);
  const pa = g.getPlayer(a)!;
  const pb = g.getPlayer(b)!;
  pa.x = pb.x + REVIVE_RADIUS - 5;
  pa.y = pb.y;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false, revive: true });
  run(g, REVIVE_SEC * 0.5);
  assert.ok(me(g, b).down);
  assert.ok(me(g, b).revive > 0.4 && me(g, b).revive < 0.6);
  run(g, REVIVE_SEC * 0.6);
  const rb = me(g, b);
  assert.equal(rb.down, false);
  assert.equal(rb.hp, Math.round(PLAYER_MAX_HP * REVIVE_HP_FRAC));
  assert.ok(rb.invuln > 0 && rb.invuln <= REVIVE_INVULN_SEC);
  assert.equal(g.status, "playing");
  assert.equal(g.result().players.find((p) => p.name === "a")!.revives, 1);
});

test("멀리 있거나 키를 떼면 부활이 진행되지 않고 줄어든다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  knockDown(g, b);
  const pa = g.getPlayer(a)!;
  const pb = g.getPlayer(b)!;
  pa.x = pb.x + REVIVE_RADIUS + 40;
  pa.y = pb.y;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false, revive: true });
  run(g, REVIVE_SEC * 1.5);
  assert.ok(me(g, b).down);
  assert.ok(me(g, b).revive < 1e-9);
  pa.x = pb.x;
  run(g, REVIVE_SEC * 0.5);
  assert.ok(me(g, b).revive > 0);
  const held = me(g, b).revive;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false, revive: false });
  run(g, REVIVE_SEC * 0.5);
  const after = me(g, b).revive;
  assert.ok(after < held && after > held * 0.6, "멈춰도 한 번에 사라지지 않고 조금씩 줄어든다");
  assert.ok(Math.abs(held - after - (REVIVE_DECAY_FACTOR * 0.5)) < 0.02, "채울 때의 4분의 1 속도");
  run(g, REVIVE_SEC * 10);
  assert.ok(me(g, b).revive < 1e-9, "오래 두면 결국 0");
});

test("멈췄다가 다시 시작하면 남은 진행도에서 이어서 채운다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  knockDown(g, b);
  const pa = g.getPlayer(a)!;
  const pb = g.getPlayer(b)!;
  pa.x = pb.x;
  pa.y = pb.y;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false, revive: true });
  run(g, REVIVE_SEC * 0.6);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false, revive: false });
  run(g, 1);
  const resume = me(g, b).revive;
  assert.ok(resume > 0.5, `이어서 시작 (${resume})`);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false, revive: true });
  run(g, REVIVE_SEC * 0.5); // 처음부터라면 절반밖에 못 채우는 시간
  assert.equal(me(g, b).down, false);
});

test("쓰러진 주인공은 적의 목표가 되지 않고, 한 명이라도 서 있으면 게임이 계속된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  knockDown(g, b);
  const pb = g.getPlayer(b)!;
  const pa = g.getPlayer(a)!;
  pa.x = 1500;
  pa.y = 1500; // 멀리 떨어뜨려 둔다
  g.spawnEnemyAt(pb.x + 30, pb.y, BLUNT);
  run(g, 3);
  assert.equal(me(g, b).hp, 0);
  assert.equal(g.status, "playing");
});

test("모두 쓰러지면 게임오버, 부활 직후에는 잠깐 무적이다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  knockDown(g, a);
  run(g, 0.2);
  assert.equal(g.status, "playing");
  knockDown(g, b);
  run(g, 0.2);
  assert.equal(g.status, "defeat");
});

test("부활한 직후에는 공격을 받아도 체력이 줄지 않는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  knockDown(g, b);
  const pa = g.getPlayer(a)!;
  const pb = g.getPlayer(b)!;
  pa.x = pb.x;
  pa.y = pb.y;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false, revive: true });
  run(g, REVIVE_SEC + 0.3);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false, revive: false });
  const hp = me(g, b).hp;
  pa.x = 1500;
  pa.y = 1500;
  g.spawnEnemyAt(pb.x + 10, pb.y, BLUNT);
  run(g, 1.5);
  assert.equal(me(g, b).hp, hp);
});

test("스테이지를 깨면 쓰러져 있던 동료가 일어난다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  g.forceBoss();
  knockDown(g, b);
  slay(g, generalOf(g)![0], a);
  assert.equal(me(g, b).down, false);
  assert.ok(me(g, b).hp > 0);
});

test("화살이 맞으면 서버가 명중 이벤트를 알려 준다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = me(g, a);
  g.spawnEnemyAt(p.x + 120, p.y, 4); // 둔기병은 방패가 없고 느리다
  run(g, 0.6);
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true, revive: false });
  const kinds: number[] = [];
  for (let i = 0; i < 60; i++) {
    g.step();
    for (const ev of g.takeEvents()) kinds.push(ev[0]);
  }
  assert.ok(kinds.includes(EVT_ARROW_HIT));
  assert.deepEqual(g.takeEvents(), [], "가져가면 비워진다");
});

test("다시 하기: 같은 참가자로 처음 상태가 된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.jumpToStage(3);
  g.getPlayer(a)!.gold = 5;
  g.spawnEnemyAt(10, 10);
  knockDown(g, a);
  run(g, 0.2);
  assert.equal(g.status, "defeat");
  g.reset();
  assert.equal(g.status, "playing");
  assert.equal(g.info().stage, 1);
  assert.equal(g.enemyCount, 0);
  assert.equal(me(g, a).down, false);
  assert.equal(me(g, a).gold, START_GOLD);
  assert.equal(me(g, a).hp, PLAYER_MAX_HP);
});
