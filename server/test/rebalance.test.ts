import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BLUNT,
  ENEMY_STATS,
  MERC_STATS,
  SHIELD,
  SPEAR,
  TICK_RATE,
  WEAPONS,
  WEAPON_SWITCH_DELAY_SEC,
  ENEMY_TIME_HP_GROWTH,
  CARDS,
  LEGENDS,
  MERC_XP_NEED,
} from "@mercenary/shared";
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

test("창은 철퇴·검보다 길고 좁다, 창병 용병도 다른 근접 병종보다 길고 좁다", () => {
  const [, spear, , sword, mace] = [WEAPONS[0]!, WEAPONS[1]!, WEAPONS[0]!, WEAPONS[2]!, WEAPONS[3]!];
  assert.ok(spear.reach > sword.reach * 2 && spear.arc < sword.arc / 3);
  assert.ok(spear.reach > mace.reach * 2);
  assert.ok(MERC_STATS[SPEAR]!.reach > MERC_STATS[SHIELD]!.reach * 2.5);
  assert.ok(MERC_STATS[SPEAR]!.arc < MERC_STATS[SHIELD]!.arc / 3);
});

test("철퇴는 한 방이 가장 세지만 휘두르기 전에 준비 동작이 있다", () => {
  assert.ok(WEAPONS[3]!.damage > WEAPONS[1]!.damage * 2);
  assert.ok(WEAPONS[3]!.windup >= 0.4);
  assert.ok(MERC_STATS[BLUNT]!.windup > MERC_STATS[SHIELD]!.windup * 2);
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.setWeapon(a, 3);
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  const e = g.spawnEnemyAt(p.x + 30, p.y, SPEAR);
  (g.getEnemy(e) as { hp: number }).hp = 500;
  g.setInput(a, { ...idle, fire: true });
  run(g, 0.3);
  assert.equal(g.getEnemy(e)!.hp, 500, "준비 중에는 아직 맞지 않는다");
  assert.ok(g.getPlayer(a)!.wind > 0, "준비 동작이 클라이언트에 전달된다");
  run(g, 0.4);
  assert.ok(g.getEnemy(e)!.hp < 500, "준비가 끝나면 휘두른다");
});

test("궁병 용병은 근접 적이 다가오면 뒤로 물러난다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const m = g.addMerc(a, ARCHER, p.x + 60, p.y);
  const e = g.spawnEnemyAt(p.x + 60 + 60, p.y, SPEAR);
  (g.getEnemy(e) as { hp: number; speed?: number }).hp = 9999;
  const x0 = g.getMerc(m)!.x;
  run(g, 0.5);
  const merc = g.getMerc(m)!;
  assert.ok(merc.x < x0 - 5, `뒤로 물러난다: ${x0} → ${merc.x}`);
});

test("궁병 용병은 먼 적에게는 물러나지 않고 쏜다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const m = g.addMerc(a, ARCHER, p.x + 60, p.y);
  const e = g.spawnEnemyAt(p.x + 60 + 200, p.y, SPEAR);
  (g.getEnemy(e) as { hp: number }).hp = 9999;
  run(g, 1.5);
  assert.ok(g.getEnemy(e)!.hp < 9999, "화살이 맞았다");
  assert.ok(Math.abs(g.getMerc(m)!.x - (p.x + 60)) < 40);
});

test("적은 시간이 갈수록, 플레이어 레벨이 오를수록 단단해진다", () => {
  const hpAt = (sec: number, level: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    g.getPlayer(a)!.level = level;
    (g as unknown as { stageTime: number }).stageTime = sec; // 자동 생성을 끈 시험판은 시간이 흐르지 않으므로 직접 지정
    const e = g.spawnEnemyAt(0, 0, SPEAR);
    return g.getEnemy(e)!.maxHp;
  };
  const base = hpAt(0, 1);
  assert.ok(Math.abs(base - ENEMY_STATS[SPEAR]!.hp) < 1e-6);
  assert.ok(Math.abs(hpAt(60, 1) - base * (1 + ENEMY_TIME_HP_GROWTH)) < 1e-3, "60초 뒤에는 +12%");
  assert.ok(hpAt(60, 10) > hpAt(60, 1) * 1.2, "레벨이 높으면 더 단단하다");
});

test("용병 경험치 요구량이 크게 늘었고, 통솔력 카드가 가장 흔하다", () => {
  assert.ok(MERC_XP_NEED[0]! >= 120);
  const lead = CARDS.filter((c) => c.effect.k === "leadership" && c.rarity === 0)[0]!;
  const others = CARDS.filter((c) => c.rarity === 0 && c.category !== 3 && c.effect.k !== "leadership");
  assert.ok(lead.weight > Math.max(...others.map((c) => c.weight)) * 1.5, "일반 등급에서 통솔력이 가장 자주 나온다");
  assert.ok(LEGENDS.bloodthirst.desc.includes("4%"));
});

test("통솔력이 거의 찼을 때는 통솔력 카드가 더 자주 나온다", () => {
  const count = (fillMercs: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    for (let i = 0; i < fillMercs; i++) g.addMerc(a, SHIELD, 0, 0);
    let n = 0;
    for (let k = 0; k < 300; k++) {
      g.getPlayer(a)!.level = 8;
      const offer = (g as unknown as { rollOffer(s: unknown): number[] }).rollOffer((g as unknown as { slots: Map<number, unknown> }).slots.get(a));
      if (offer.some((i) => CARDS[i]!.effect.k === "leadership")) n++;
    }
    return n;
  };
  const [low, high] = [count(0), count(4)];
  assert.ok(high > low, "거의 찼을 때 더 많이 나온다");
});

test("결과 기록에 준 피해·받은 피해·쓰러짐·금화·용병 수가 담긴다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.addMerc(a, SHIELD, p.x + 40, p.y);
  g.setWeapon(a, 2);
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  const e = g.spawnEnemyAt(p.x + 40, p.y, SPEAR);
  g.setInput(a, { ...idle, fire: true });
  run(g, 4);
  const r = g.result().players[0]!;
  assert.ok(r.dealt > 0, "준 피해");
  assert.ok(r.gold > 0 && r.kills >= 1, "금화와 처치");
  assert.equal(r.mercs, 1);
  assert.equal(r.downs, 0);
  void e;
});
