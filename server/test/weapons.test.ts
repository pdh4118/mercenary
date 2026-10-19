import { test } from "node:test";
import assert from "node:assert/strict";
import { BULLET_DAMAGE, BULLET_RANGE, FIRE_COOLDOWN_SEC, MERC_STATS, MAGE, SPEAR, TICK_RATE, TUNE, WEAPONS, WEAPON_SWITCH_DELAY_SEC } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};
const idle = { dx: 0, dy: 0, aim: 0, fire: false };
type E = { hp: number; maxHp: number };
/** 맞아도 죽지 않는 적(시험용) */
const dummy = (g: Game, x: number, y: number): number => {
  const id = g.spawnEnemyAt(x, y, SPEAR);
  const e = (g as unknown as { enemies: Map<number, E> }).enemies.get(id)!;
  e.hp = e.maxHp = 5000;
  return id;
};

test("무기 수치: 활 0.5초·8, 검 8, 철퇴 30·준비 1초, 지팡이 100, 기마 80·준비 없음, 용병 마법사 70", () => {
  assert.equal(FIRE_COOLDOWN_SEC, 0.5);
  assert.equal(BULLET_DAMAGE, 8);
  assert.equal(WEAPONS[0]!.cooldown, 0.5);
  assert.equal(WEAPONS[0]!.damage, 8);
  assert.equal(WEAPONS[2]!.damage, 8);
  assert.equal(WEAPONS[3]!.damage, 30);
  assert.equal(WEAPONS[3]!.windup, 1);
  assert.equal(WEAPONS[4]!.damage, 100);
  assert.equal(WEAPONS[5]!.reach, 80);
  assert.equal(WEAPONS[5]!.windup, 0);
  assert.equal(MERC_STATS[MAGE]!.damage, 70);
  assert.equal(BULLET_RANGE, 400);
});

test("활을 쏘는 동안은 이동 속도가 15% 줄어든다", () => {
  const dist = (fire: boolean) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    const x0 = p.x;
    g.setInput(a, { dx: 1, dy: 0, aim: Math.PI, fire });
    run(g, 0.5);
    return Math.abs(g.getPlayer(a)!.x - x0);
  };
  const walk = dist(false);
  const shoot = dist(true);
  assert.ok(walk > 0 && Math.abs(shoot / walk - (1 - TUNE.BOW_FIRE_SLOW)) < 0.03, `${shoot} / ${walk}`);
});

test("철퇴: 모은 시간에 비례해 피해가 들어가고 다 모으면 최대에서 멈춘다", () => {
  const hit = (hold: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    g.setWeapon(a, 3);
    run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
    const e = dummy(g, p.x + 30, p.y);
    g.setInput(a, { ...idle, fire: true });
    run(g, hold);
    g.setInput(a, { ...idle, fire: false });
    run(g, 0.1);
    return 5000 - g.getEnemy(e)!.hp;
  };
  const full = hit(1.2);
  const half = hit(0.5);
  const tap = hit(0.05);
  assert.ok(full >= WEAPONS[3]!.damage - 1e-6 && full <= WEAPONS[3]!.damage * 2, `최대 ${full}`);
  assert.ok(Math.abs(half / full - 0.5) < 0.08, `절반 ${half} / ${full}`);
  assert.ok(Math.abs(tap / full - TUNE.MACE_MIN_CHARGE) < 0.05, `바로 뗌 ${tap} / ${full}`);
  assert.ok(hit(2.5) <= full + 1e-6, "더 오래 눌러도 늘지 않는다");
});

test("철퇴: 쿨타임 중에는 모이지 않고, 무기를 바꾸면 모으던 것이 취소된다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.setWeapon(a, 3);
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  const e = dummy(g, p.x + 30, p.y);
  g.setInput(a, { ...idle, fire: true });
  run(g, 1.1);
  g.setInput(a, { ...idle, fire: false });
  run(g, 0.05);
  const afterFirst = g.getEnemy(e)!.hp;
  g.setInput(a, { ...idle, fire: true }); // 쿨타임(1.2초) 중에 누른다
  run(g, 0.5);
  assert.equal(g.getPlayer(a)!.wind, 0, "쿨타임 중에는 모이지 않는다");
  g.setWeapon(a, 1);
  g.setInput(a, { ...idle, fire: false });
  run(g, 0.3);
  assert.equal(g.getEnemy(e)!.hp, afterFirst, "쿨타임 중에 뗀 것은 공격이 아니다");
});
