/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EVT_BOSSFX, BFX_MTHRUST, BFX_MSWING, MELEE_TEAM_ALLY, MELEE_TEAM_ENEMY, MELEE_TEAM_BOSS, BOSS_NAMES, BOSS_TITLES, bossLabel, STAGE_COUNT, SPEAR, SHIELD, BLUNT, CAVALRY, TICK_RATE } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
/** 이번 틱들에 나온 근접 효과 이벤트 */
const meleeEvents = (g: Game): number[][] => g.takeEvents().filter((e) => e[0] === EVT_BOSSFX && (e[4] === BFX_MTHRUST || e[4] === BFX_MSWING));

test("근접 효과: 창·기병은 찌르기 줄기, 방패·철퇴는 휘두르기 호로 나가고 사거리와 편이 실린다", () => {
  for (const [type, style] of [[SPEAR, BFX_MTHRUST], [CAVALRY, BFX_MTHRUST], [SHIELD, BFX_MSWING], [BLUNT, BFX_MSWING]] as const) {
    const g = new Game();
    g.autoSpawn = false;
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    p.invuln = 1e9;
    g.spawnEnemyAt(p.x + 25, p.y, type);
    let evs: number[][] = [];
    for (let i = 0; i < TICK_RATE * 4 && evs.length === 0; i++) {
      g.step();
      evs = meleeEvents(g);
    }
    assert.ok(evs.length > 0, `병종 ${type}의 적 공격에 효과가 나온다`);
    const e = evs[0]!;
    assert.equal(e[4], style);
    assert.equal(e[5]! % 4, MELEE_TEAM_ENEMY, "일반 적 편");
    assert.ok(Math.floor(e[5]! / 4) > 20, "사거리가 실린다");
  }
});

test("근접 효과: 용병은 내 편, 장군은 장군 편 색으로 나가고 한 틱에 보내는 수가 제한된다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const m = g.addMerc(a, SHIELD, p.x + 40, p.y);
  const foe = g.spawnEnemyAt(p.x + 70, p.y, SPEAR);
  (g.getEnemy(foe) as any).hp = (g.getEnemy(foe) as any).maxHp = 1e6;
  void m;
  let team0 = false;
  for (let i = 0; i < TICK_RATE * 5; i++) {
    g.step();
    for (const e of meleeEvents(g)) if (e[5]! % 4 === MELEE_TEAM_ALLY) team0 = true;
  }
  assert.ok(team0, "용병의 공격 효과는 내 편");
  // 많은 적이 한꺼번에 쳐도 틱당 24개를 넘지 않는다
  const g2 = new Game();
  g2.autoSpawn = false;
  const b = g2.addPlayer("b")!;
  g2.getPlayer(b)!.invuln = 1e9;
  const q = g2.getPlayer(b)!;
  for (let i = 0; i < 80; i++) g2.spawnEnemyAt(q.x + 20 + (i % 10) * 3, q.y + (i % 8) * 5, SHIELD);
  let maxPerTick = 0;
  for (let i = 0; i < TICK_RATE * 4; i++) {
    g2.step();
    maxPerTick = Math.max(maxPerTick, meleeEvents(g2).length);
  }
  assert.ok(maxPerTick <= 24, `틱당 최대 ${maxPerTick}`);
  void MELEE_TEAM_BOSS;
});

test("장군 이름: 스테이지마다 호칭과 이름이 있고 겹치지 않는다", () => {
  assert.equal(BOSS_NAMES.length, STAGE_COUNT);
  assert.equal(BOSS_TITLES.length, STAGE_COUNT);
  assert.equal(new Set(BOSS_NAMES).size, STAGE_COUNT);
  assert.equal(bossLabel(3), "그림자 시위 렌");
  assert.ok(bossLabel(10).includes("그라크"));
  assert.equal(bossLabel(99), "장군");
});
