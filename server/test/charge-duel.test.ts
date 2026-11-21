/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHER, MAGE, SHIELD, TICK_RATE, TOUR_MERCS, TUNE, UNIT_NAMES } from "@mercenary/shared";
import { Game } from "../src/game.js";

const tourStart = (stage: number) => {
  const g = new Game();
  g.autoSpawn = false;
  const ids = [g.addPlayer("p0")!, g.addPlayer("p1")!];
  g.jumpToStage(stage);
  (g as any).onBossDown({ x: 0, y: 0 });
  for (let i = 0; i < Math.round((TUNE.TOURNAMENT_NOTICE_SEC + 0.2) * TICK_RATE); i++) g.step();
  g.step();
  void ids;
  return g;
};

test("용병전: 궁병·마법사도 멀리 있는 상대 용병에게 다가가 싸운다(주인공 옆에만 붙어 있지 않는다)", () => {
  for (const t of [ARCHER, MAGE]) {
    const g = tourStart(6);
    const tour = g.info().tour!;
    assert.equal(tour.mode, TOUR_MERCS);
    const mine = tour.a;
    const foe = tour.b;
    const me = g.addMerc(mine, t, -300, 0);
    const dummy = g.addMerc(foe, SHIELD, 420, 0);
    let n = 0;
    while (g.info().tour?.step !== "fight" && n++ < TICK_RATE * 30) g.step();
    assert.equal(g.info().tour?.step, "fight");
    const mm = (g as any).mercs.get(me);
    const dm = (g as any).mercs.get(dummy);
    mm.x = -300;
    mm.y = 0;
    dm.x = 420;
    dm.y = 0;
    dm.cd = 1e9;
    dm.stunT = 1e9; // 가만히 서서 맞는다
    const hp0 = dm.hp + dm.shield;
    for (let i = 0; i < 20 * TICK_RATE; i++) g.step();
    assert.ok(dm.hp + dm.shield < hp0, `${UNIT_NAMES[t]}가 상대 용병에게 다가가 싸우지 않았다(${Math.round(Math.hypot(mm.x - dm.x, mm.y - dm.y))}px 떨어져 있음)`);
  }
});
