import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOSS_TIMEOUT_SEC,
  CHEST_OPEN_RADIUS,
  STAGE_GROW_SEC,
  TICK_RATE,
  TOURNAMENT_INTRO_SEC,
  TOURNAMENT_MATCH_SEC,
  TOURNAMENT_OUTRO_SEC,
  TOURNAMENT_END_SEC,
  TOURNAMENT_WIN_GOLD,
  isTournamentStage,
  tournamentRoundName,
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
type Priv = { onBossDown(at: { x: number; y: number }): void; phaseT: number; stageTime: number };
const bossDown = (g: Game, x = 0, y = 0) => (g as unknown as Priv).onBossDown({ x, y });

test("한 라운드(성장 시간)는 2분 30초다", () => {
  assert.equal(STAGE_GROW_SEC, 150);
  assert.deepEqual([3, 6, 9, 10].map(isTournamentStage), [true, true, true, true]);
  assert.ok(!isTournamentStage(1) && !isTournamentStage(5));
  assert.deepEqual([1, 2, 3, 4].map(tournamentRoundName), ["결승", "준결승", "8강", "16강"]);
});

test("보스를 못 잡아도 보스 단계가 시작되고 1분이 지나면 보스군이 물러나고 다음 스테이지로 넘어간다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  (g as unknown as Priv).phaseT = 0.01;
  run(g, 0.2);
  assert.equal(g.info().phase, "boss");
  assert.equal(g.info().timer, BOSS_TIMEOUT_SEC);
  g.getPlayer(a)!.invuln = 9999;
  run(g, BOSS_TIMEOUT_SEC - 2);
  assert.equal(g.info().phase, "boss", "아직 제한 시간 안");
  assert.ok(g.info().timer <= 3);
  run(g, 3);
  assert.equal(g.info().phase, "break");
  assert.equal(g.info().armyLeft, 0, "보스군이 물러났다");
  assert.equal(g.info().stage, 1);
  run(g, 11);
  assert.equal(g.info().phase, "grow");
  assert.equal(g.info().stage, 2, "보스를 못 잡아도 다음 라운드");
});

test("보스를 잡으면 접속 인원만큼 상자가 떨어지고, 주인이 다가가면 레벨업과 별개로 카드를 고른다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  bossDown(g, 100, 100);
  const base = { pending: g.getPlayer(a)!.pending, level: g.getPlayer(a)!.level }; // 보스 보상 경험치로 레벨업했을 수 있다
  g.getPlayer(b)!.x = -600; // 다른 사람이 우연히 자기 상자 곁에 있지 않게 멀리 둔다
  g.getPlayer(b)!.y = -600;
  const chests = g.snapshotChests();
  assert.equal(chests.length, 2);
  assert.deepEqual(chests.map((c) => c[3]).sort(), [a, b].sort(), "상자마다 주인이 다르다");
  const mine = chests.find((c) => c[3] === a)!;
  // 멀리 있으면 열리지 않는다
  g.getPlayer(a)!.x = mine[1] + CHEST_OPEN_RADIUS + 50;
  g.getPlayer(a)!.y = mine[2];
  g.step();
  assert.equal(g.getPlayer(a)!.pending, base.pending);
  // 남의 상자 곁에서는 열리지 않는다
  const theirs = chests.find((c) => c[3] === b)!;
  g.getPlayer(a)!.x = theirs[1];
  g.getPlayer(a)!.y = theirs[2];
  g.step();
  assert.equal(g.getPlayer(a)!.pending, base.pending);
  // 내 상자에 다가가면 열려 카드 선택이 생긴다(레벨은 그대로)
  g.getPlayer(a)!.x = mine[1];
  g.getPlayer(a)!.y = mine[2];
  g.step();
  const p = g.getPlayer(a)!;
  assert.equal(p.level, base.level, "레벨은 그대로");
  assert.equal(p.pending, base.pending + 1);
  assert.equal(p.box, 1);
  assert.equal(p.offer.length, 3);
  assert.equal(g.snapshotChests().length, 1, "내 상자만 사라진다");
  assert.ok(g.pick(a, 0));
  assert.equal(p.pending, base.pending);
  assert.equal(p.box, 0);
});

test("토너먼트 스테이지가 아니거나 혼자일 때는 토너먼트가 열리지 않는다", () => {
  const solo = quiet();
  solo.addPlayer("a");
  solo.jumpToStage(3);
  bossDown(solo);
  run(solo, 0.2);
  assert.equal(solo.info().phase, "break");
  const duo = quiet();
  duo.addPlayer("a");
  duo.addPlayer("b");
  duo.jumpToStage(2);
  bossDown(duo);
  run(duo, 0.2);
  assert.equal(duo.info().phase, "break", "2스테이지는 토너먼트가 없다");
});

test("3스테이지 보스를 잡으면 적이 모두 사라지고 두 사람이 결승을 치른다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  g.jumpToStage(3);
  g.spawnEnemyAt(50, 50, 1);
  g.spawnEnemyAt(-50, 50, 2);
  bossDown(g);
  g.step();
  assert.equal(g.info().phase, "tournament");
  assert.equal(g.enemyCount, 0, "남은 적이 모두 사라진다");
  let tour = g.info().tour!;
  assert.equal(tour.title, "결승");
  assert.equal(tour.step, "intro");
  assert.deepEqual([tour.a, tour.b].sort(), [a, b].sort());
  // 경기 전에는 움직일 수도 공격할 수도 없다
  const pa = g.getPlayer(tour.a)!;
  const pb = g.getPlayer(tour.b)!;
  const x0 = pa.x;
  assert.ok(pa.x < 0 && pb.x > 0, "양끝에 선다");
  g.setInput(tour.a, { dx: 1, dy: 0, aim: 0, fire: true });
  run(g, TOURNAMENT_INTRO_SEC - 0.5);
  assert.equal(pa.x, x0, "소개 중에는 움직일 수 없다");
  assert.equal(pb.hp, pb.maxHp);
  run(g, 1);
  tour = g.info().tour!;
  assert.equal(tour.step, "fight");
  // 서로 맞닿게 세우고 한쪽이 검을 휘두르면 상대가 쓰러지고 경기가 끝난다
  pa.x = -20;
  pa.y = 0;
  pb.x = 20;
  pb.y = 0;
  g.setWeapon(tour.a, 2);
  g.setInput(tour.a, idle);
  run(g, 0.4);
  g.setInput(tour.a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.setInput(tour.b, idle);
  const gold0 = g.getPlayer(tour.a)!.gold;
  for (let i = 0; i < TICK_RATE * 40 && g.info().tour?.step === "fight"; i++) g.step();
  tour = g.info().tour!;
  assert.equal(tour.step, "outro");
  assert.equal(tour.winner, g.getPlayer(tour.a)!.name);
  assert.ok(pb.down && !pa.down);
  assert.equal(g.getPlayer(tour.a)!.gold - gold0, TOURNAMENT_WIN_GOLD * 3, "승리 보상 금화");
  g.setInput(tour.a, idle);
  run(g, TOURNAMENT_OUTRO_SEC + 0.2);
  assert.equal(g.info().tour!.step, "end");
  assert.equal(g.info().tour!.champion, pa.name);
  run(g, TOURNAMENT_END_SEC + 0.2);
  assert.equal(g.info().phase, "break");
  assert.ok(!pb.down && pb.hp === pb.maxHp, "끝나면 모두 회복한다");
  assert.equal(g.info().status, "playing");
});

test("10스테이지 토너먼트가 끝나야 승리가 된다", () => {
  const g = quiet();
  g.addPlayer("a");
  g.addPlayer("b");
  g.jumpToStage(10);
  bossDown(g);
  run(g, 0.2);
  assert.equal(g.info().status, "playing", "토너먼트가 끝나기 전에는 승리가 아니다");
  assert.equal(g.info().phase, "tournament");
  run(g, TOURNAMENT_INTRO_SEC + TOURNAMENT_MATCH_SEC + TOURNAMENT_OUTRO_SEC + TOURNAMENT_END_SEC + 1); // 아무도 안 싸우면 시간 초과 판정
  assert.equal(g.info().status, "victory");
});

test("선수가 아닌 사람은 공격할 수 없고, 3명이면 준결승 뒤 결승이 열린다(부전승 포함)", () => {
  const g = quiet();
  const ids = [g.addPlayer("a")!, g.addPlayer("b")!, g.addPlayer("c")!];
  g.jumpToStage(6);
  bossDown(g);
  g.step();
  let tour = g.info().tour!;
  assert.equal(tour.title, "준결승");
  assert.equal(tour.rounds.length, 2);
  assert.equal(tour.rounds[0]!.matches.length, 2);
  const byes = tour.rounds[0]!.matches.filter((m) => m.b === "" || m.a === "");
  assert.equal(byes.length, 1, "3명이면 한 명은 부전승");
  const spectator = ids.find((id) => id !== tour.a && id !== tour.b)!;
  g.setInput(spectator, { ...idle, fire: true });
  run(g, TOURNAMENT_INTRO_SEC + 1);
  const fighters = [tour.a, tour.b];
  assert.ok(fighters.every((id) => g.getPlayer(id)!.hp === g.getPlayer(id)!.maxHp));
  // 시간 초과로 첫 경기를 끝내고 결승으로 넘어간다
  run(g, TOURNAMENT_MATCH_SEC + TOURNAMENT_OUTRO_SEC + 1);
  tour = g.info().tour!;
  assert.equal(tour.title, "결승");
});
