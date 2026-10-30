/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { TICK_RATE, TUNE, TOURNAMENT_OUTRO_SEC, TOUR_DUEL, TOUR_MERCS, TOUR_ALL, TOUR_POINTS, tourGames, SPEAR, SHIELD } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const start = (stage: number, players = 2) => {
  const g = new Game();
  g.autoSpawn = false;
  const ids = Array.from({ length: players }, (_, i) => g.addPlayer(`p${i}`)!);
  g.jumpToStage(stage);
  (g as any).onBossDown({ x: 0, y: 0 });
  run(g, TUNE.TOURNAMENT_NOTICE_SEC + 0.2);
  g.step();
  return { g, ids };
};
const toFight = (g: Game) => {
  let n = 0;
  while (g.info().tour?.step !== "fight" && n++ < TICK_RATE * 30) g.step();
  assert.equal(g.info().tour?.step, "fight");
};

test("토너먼트 구성: 3스테이지 일기토, 6스테이지 용병전, 9스테이지 단체전, 10스테이지 세 판(3:3:4)", () => {
  assert.deepEqual([...tourGames(3)], [TOUR_DUEL]);
  assert.deepEqual([...tourGames(6)], [TOUR_MERCS]);
  assert.deepEqual([...tourGames(9)], [TOUR_ALL]);
  assert.deepEqual([...tourGames(10)], [TOUR_DUEL, TOUR_MERCS, TOUR_ALL]);
  assert.deepEqual([...TOUR_POINTS], [3, 3, 4]);
  assert.equal(TOUR_POINTS.reduce((a, b) => a + b, 0), 10);
  for (const [stage, mode, games] of [[3, TOUR_DUEL, 1], [6, TOUR_MERCS, 1], [9, TOUR_ALL, 1], [10, TOUR_DUEL, 3]] as const) {
    const { g } = start(stage);
    const t = g.info().tour!;
    assert.equal(t.mode, mode, `${stage}스테이지 방식`);
    assert.equal(t.games, games);
    assert.equal(t.game, 0);
  }
});

test("일기토: 용병은 싸우지도 맞지도 않고 주인공만 겨룬다", () => {
  const { g, ids } = start(3);
  const t = g.info().tour!;
  const mA = g.addMerc(t.a, SPEAR, 0, 0);
  const mB = g.addMerc(t.b, SPEAR, 0, 0);
  toFight(g);
  const A = g.getPlayer(t.a)!;
  const B = g.getPlayer(t.b)!;
  // 두 용병을 맞붙여 놓아도 싸우지 않는다
  const ma = g.getMerc(mA)! as any;
  const mb = g.getMerc(mB)! as any;
  ma.x = -30; ma.y = 0; mb.x = 30; mb.y = 0;
  const hp0 = [ma.hp, mb.hp];
  run(g, 3);
  assert.deepEqual([ma.hp, mb.hp], hp0, "용병은 서로 맞지 않는다");
  assert.ok(Math.abs(ma.x + 30) < 1 && Math.abs(mb.x - 30) < 1, "용병은 움직이지 않는다");
  // 주인공이 쓰러지면 진다
  void ids;
  A.hp = 0;
  A.down = true;
  run(g, 0.2);
  assert.equal(g.info().tour!.step, "outro");
  assert.equal(g.info().tour!.winner, B.name);
});

test("용병전: 주인공은 싸우지 못하고, 용병이 모두 쓰러진 쪽이 진다", () => {
  const { g } = start(6);
  const t = g.info().tour!;
  g.addMerc(t.a, SHIELD, 0, 0);
  const mb = g.addMerc(t.b, SHIELD, 0, 0);
  toFight(g);
  const A = g.getPlayer(t.a)!;
  g.setInput(t.a, { dx: 1, dy: 0, aim: 0, fire: true });
  const x0 = A.x;
  run(g, 1);
  assert.equal(A.x, x0, "주인공은 움직이지 못한다");
  assert.equal(g.getPlayer(t.b)!.hp, g.getPlayer(t.b)!.maxHp, "주인공은 맞지 않는다");
  // b의 용병을 모두 쓰러뜨린다
  (g as any).hurtMerc(g.getMerc(mb), 1e9);
  run(g, 0.2);
  const info = g.info().tour!;
  assert.equal(info.step, "outro");
  assert.equal(info.winner, g.getPlayer(t.a)!.name, "용병이 남은 a가 이긴다");
});

test("10스테이지: 세 판을 3·3·4점으로 겨루고 점수가 높은 쪽이 이기며, 보상은 경기가 끝날 때 한 번만 준다", () => {
  const { g } = start(10);
  const t0 = g.info().tour!;
  const a = t0.a;
  const b = t0.b;
  const wins = () => (g.getPlayer(a) ? (g as any).slots.get(a).stats.wins + (g as any).slots.get(b).stats.wins : 0);
  const finish = (winner: 1 | 2) => {
    toFight(g);
    (g as any).tourMatchDone(winner, "down");
    assert.equal(g.info().tour!.step, "outro");
    run(g, TOURNAMENT_OUTRO_SEC + 0.1);
  };
  // 1판 일기토: a 승(3점)
  assert.equal(g.info().tour!.mode, TOUR_DUEL);
  finish(1);
  let info = g.info().tour!;
  assert.equal(info.game, 1, "다음 판으로");
  assert.equal(info.mode, TOUR_MERCS);
  assert.deepEqual(info.pts, [3, 0]);
  assert.equal(wins(), 0, "아직 경기 승리 보상이 없다");
  // 2판 용병전: b 승(3점)
  finish(2);
  info = g.info().tour!;
  assert.equal(info.mode, TOUR_ALL);
  assert.deepEqual(info.pts, [3, 3]);
  // 3판 단체전: b 승(4점) → b 7 : 3 a 로 b 승
  finish(2);
  assert.equal(wins(), 1, "경기가 끝나 승자가 보상을 한 번 받는다");
  assert.equal(g.info().tour!.step === "end" || g.info().phase !== "tournament", true, "결승이었으므로 토너먼트가 끝난다");
  const champ = (g as any).slots.get(b).stats.champion;
  assert.equal(champ, 1, "점수 7점을 얻은 b가 우승");
});
