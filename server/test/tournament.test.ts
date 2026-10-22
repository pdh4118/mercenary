import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHIELD,
  CHEST_OPEN_RADIUS,
  TICK_RATE,
  TOURNAMENT_OUTRO_SEC,
  TOURNAMENT_END_SEC,
  isTournamentStage,
  tournamentRoundName,
  TUNE,
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
/** 보스를 잡고 토너먼트 예고 시간이 지나 대진이 시작될 때까지 */
const bossDownAndWait = (g: Game) => {
  bossDown(g);
  for (let i = 0; i < Math.ceil((TUNE.TOURNAMENT_NOTICE_SEC + 0.2) * 20); i++) g.step();
};

test("한 라운드(성장 시간)는 1분 30초이다", () => {
  assert.equal(TUNE.STAGE_GROW_SEC, 90);
  assert.deepEqual([3, 6, 9, 10].map(isTournamentStage), [true, true, true, true]);
  assert.ok(!isTournamentStage(1) && !isTournamentStage(5));
  assert.deepEqual([1, 2, 3, 4].map(tournamentRoundName), ["결승", "준결승", "8강", "16강"]);
});

test("보스를 1분 안에 못 잡으면 보스군이 격노해 병력이 늘고 점점 강해지며, 끝내 못 잡으면 강제로 다음 스테이지로 넘어간다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  (g as unknown as Priv).phaseT = 0.01;
  run(g, 0.2);
  assert.equal(g.info().phase, "boss");
  assert.equal(g.info().timer, TUNE.BOSS_TIMEOUT_SEC, "격노까지 남은 시간");
  assert.equal(g.info().rage, 0);
  g.getPlayer(a)!.invuln = 9999;
  const army = () => [...(g as unknown as { enemies: Map<number, { army: boolean; maxHp: number; dmgMult: number; boss: boolean }> }).enemies.values()].filter((e) => e.army && !e.boss);
  const before = army().length;
  const hp0 = army()[0]!.maxHp;
  const dmg0 = army()[0]!.dmgMult;
  run(g, TUNE.BOSS_TIMEOUT_SEC - 2);
  assert.equal(g.info().rage, 0, "아직 제한 시간 안");
  assert.equal(army().length, before);
  run(g, 2 + TUNE.BOSS_RAGE_INTERVAL_SEC + 0.5);
  assert.equal(g.info().rage, 1, "제한 시간이 지나 격노 1단계");
  assert.ok(army().length >= before + 3 - 5, "증원이 합류한다(전투로 줄어든 것을 감안)");
  assert.ok(g.info().armyTotal >= before + 3, "병력 총수가 늘었다");
  const stronger = army().find((e) => e.maxHp > hp0 * 1.05);
  assert.ok(stronger, "보스군이 강해진다");
  assert.ok(army().every((e) => e.dmgMult >= dmg0 * 0.999), "공격력은 줄지 않는다");
  run(g, TUNE.BOSS_RAGE_INTERVAL_SEC * 2);
  assert.ok(g.info().rage >= 3, "시간이 갈수록 격노 단계가 오른다");
  assert.equal(g.info().phase, "boss", "격노 중에는 다음 스테이지로 넘어가지 않는다");
  // 끝내 못 잡으면 강제로 넘어간다
  for (let i = 0; i < TICK_RATE * TUNE.BOSS_HARD_TIMEOUT_SEC && g.info().phase === "boss"; i++) g.step();
  assert.equal(g.info().phase, "break");
  assert.equal(g.info().armyLeft, 0, "보스군이 물러났다");
  assert.equal(g.info().stage, 1);
  run(g, 11);
  assert.equal(g.info().phase, "grow");
  assert.equal(g.info().stage, 2);
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
  bossDownAndWait(g);
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
  run(g, TUNE.TOURNAMENT_INTRO_SEC - 0.5);
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
  assert.equal(g.getPlayer(tour.a)!.gold - gold0, TUNE.TOURNAMENT_WIN_GOLD * 3, "승리 보상 금화");
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
  bossDownAndWait(g);
  run(g, 0.2);
  assert.equal(g.info().status, "playing", "토너먼트가 끝나기 전에는 승리가 아니다");
  assert.equal(g.info().phase, "tournament");
  run(g, TUNE.TOURNAMENT_INTRO_SEC + TUNE.TOURNAMENT_MATCH_SEC + TOURNAMENT_OUTRO_SEC + TOURNAMENT_END_SEC + 1); // 아무도 안 싸우면 시간 초과 판정
  assert.equal(g.info().status, "victory");
});

test("선수가 아닌 사람은 공격할 수 없고, 3명이면 준결승 뒤 결승이 열린다(부전승 포함)", () => {
  const g = quiet();
  const ids = [g.addPlayer("a")!, g.addPlayer("b")!, g.addPlayer("c")!];
  g.jumpToStage(6);
  bossDownAndWait(g);
  g.step();
  let tour = g.info().tour!;
  assert.equal(tour.title, "준결승");
  assert.equal(tour.rounds.length, 2);
  assert.equal(tour.rounds[0]!.matches.length, 2);
  const byes = tour.rounds[0]!.matches.filter((m) => m.b === "" || m.a === "");
  assert.equal(byes.length, 1, "3명이면 한 명은 부전승");
  const spectator = ids.find((id) => id !== tour.a && id !== tour.b)!;
  g.setInput(spectator, { ...idle, fire: true });
  run(g, TUNE.TOURNAMENT_INTRO_SEC + 1);
  const fighters = [tour.a, tour.b];
  assert.ok(fighters.every((id) => g.getPlayer(id)!.hp === g.getPlayer(id)!.maxHp));
  // 시간 초과로 첫 경기를 끝내고 결승으로 넘어간다
  run(g, TUNE.TOURNAMENT_MATCH_SEC + TOURNAMENT_OUTRO_SEC + 1);
  tour = g.info().tour!;
  assert.equal(tour.title, "결승");
});

test("토너먼트에서도 독 화살이 상대 주인공에게 걸려 시간에 걸쳐 피해를 준다", () => {
  const g = quiet();
  g.addPlayer("a");
  g.addPlayer("b");
  g.jumpToStage(3);
  bossDownAndWait(g);
  g.step();
  const tour = g.info().tour!;
  run(g, TUNE.TOURNAMENT_INTRO_SEC + 0.5);
  assert.equal(g.info().tour!.step, "fight");
  const pa = g.getPlayer(tour.a)!;
  const pb = g.getPlayer(tour.b)!;
  pa.x = -150;
  pa.y = 0;
  pb.x = 50;
  pb.y = 0;
  g.setWeapon(tour.a, 0);
  g.applyCardForTest(tour.a, { k: "heroPoison", v: 3 });
  g.setInput(tour.b, idle);
  g.setInput(tour.a, { dx: 0, dy: 0, aim: 0, fire: true });
  g.step();
  g.setInput(tour.a, idle);
  run(g, 0.7);
  const afterHit = pb.hp;
  assert.ok(afterHit < pb.maxHp, "화살이 맞았다");
  run(g, 1.5);
  assert.ok(pb.hp < afterHit - 3, "독으로 계속 줄어든다");
  const done = (() => { run(g, 4); return pb.hp; })();
  run(g, 1);
  assert.equal(pb.hp, done, "독이 끝나면 멈춘다");
});

test("토너먼트 예고: 보스를 잡아도 바로 시작하지 않고 예고 시간 동안 알리며, 그동안 휴식 시간이 끝나도 넘어가지 않는다", () => {
  const g = quiet();
  g.addPlayer("a");
  g.addPlayer("b");
  g.jumpToStage(3);
  bossDown(g);
  g.step();
  assert.equal(g.info().phase, "break", "아직 토너먼트가 아니다");
  assert.ok((g.info().tourIn ?? 0) > 0, "남은 초가 알려진다");
  for (let i = 0; i < Math.floor((TUNE.TOURNAMENT_NOTICE_SEC - 1) * 20); i++) g.step();
  assert.equal(g.info().phase, "break", "예고 중에는 휴식 시간이 지나도 다음 스테이지로 넘어가지 않는다");
  assert.equal(g.info().stage, 3);
  for (let i = 0; i < 2 * 20; i++) g.step();
  assert.equal(g.info().phase, "tournament", "예고가 끝나면 시작한다");
  assert.equal(g.info().tourIn, 0);
});

test("토너먼트 경기 중 쓰러진 용병도 되살아난다(부활 시간 절반)", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.addPlayer("b");
  const m = g.addMerc(a, 4, 0, 0);
  g.jumpToStage(3);
  bossDownAndWait(g);
  run(g, TUNE.TOURNAMENT_INTRO_SEC + 0.5);
  assert.equal(g.info().tour!.step, "fight");
  (g as unknown as { hurtMerc(m: unknown, n: number): void }).hurtMerc(g.getMerc(m), 1e6);
  const live = g.getMerc(m)!;
  assert.ok(live.respawn > 0, "쓰러졌다");
  assert.ok(live.respawn < 20, `경기 중 부활 시간이 짧다: ${live.respawn}`);
  run(g, live.respawn + 0.5);
  assert.ok(g.getMerc(m)!.respawn === 0 && g.getMerc(m)!.hp > 0, "경기 중에 돌아왔다");
});

test("시간 초과 판정은 마지막 순간이 아니라 경기 내내의 평균 남은 전력으로 한다(막판 부활로 뒤집히지 않는다)", () => {
  const g = quiet();
  g.addPlayer("a");
  g.addPlayer("b");
  g.jumpToStage(3);
  bossDownAndWait(g);
  g.step();
  const tour = g.info().tour!;
  const ma = g.addMerc(tour.a, SHIELD, 0, 0);
  const mb = g.addMerc(tour.b, SHIELD, 0, 0);
  void ma;
  run(g, TUNE.TOURNAMENT_INTRO_SEC + 0.5);
  assert.equal(g.info().tour!.step, "fight");
  const down = (m: number) => {
    const x = g.getMerc(m)! as unknown as { hp: number; respawn: number };
    x.hp = 0;
    x.respawn = 999;
  };
  const dummyDown = TICK_RATE * 40;
  for (let i = 0; i < dummyDown; i++) {
    down(mb); // 상대 용병은 경기 앞 40초 동안 쓰러져 있다
    g.step();
  }
  (g.getMerc(mb)! as unknown as { respawn: number }).respawn = 0.01; // 막판에 부활해 체력이 가득 찬 채 돌아온다
  run(g, TUNE.TOURNAMENT_MATCH_SEC - 40 - 0.2);
  const t = g.info().tour!;
  assert.ok(t.sa > t.sb, `평균 전력이 앞선다(${t.sa} : ${t.sb})`);
  run(g, 1);
  const done = g.info().tour!;
  assert.equal(done.step, "outro");
  assert.equal(done.winner, done.an, "경기 내내 앞선 선수가 이긴다");
});
