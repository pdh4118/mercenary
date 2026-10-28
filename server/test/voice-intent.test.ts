import { test } from "node:test";
import assert from "node:assert/strict";
import { TICK_RATE, TUNE, intentLine, eulReul, parseVoice, parseVoiceBest, koNumber, extractNumbers, toJamo, voiceTypes, CAVALRY, SPEAR, ARCHER, SHIELD, BLUNT, MAGE, INTENT, INTENT_NAMES } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const ALL = (1 << 6) - 1;

test("음성 지시: 병종 이름과 동의어를 알아듣고, 겹치는 말(둔기병·기병, 검방병)을 구분한다", () => {
  assert.equal(voiceTypes("기병 돌격"), 1 << CAVALRY);
  assert.equal(voiceTypes("둔기병 공격"), 1 << BLUNT, "둔기병의 '기병'을 기병으로 착각하지 않는다");
  assert.equal(voiceTypes("검방병 수비"), 1 << SHIELD);
  assert.equal(voiceTypes("궁수랑 마법사 호위"), (1 << ARCHER) | (1 << MAGE));
  assert.equal(voiceTypes("창 공격"), 1 << SPEAR);
  assert.equal(voiceTypes("전원 돌격"), ALL);
  assert.equal(voiceTypes("돌격"), null, "병종을 말하지 않으면 선택한 병종");
});

test("음성 지시: 진형·수비·공격·이동 명령으로 바뀐다", () => {
  assert.deepEqual(parseVoice("기병 돌격!")?.kind, "stance");
  assert.equal((parseVoice("기병 돌격") as { v: number }).v, 1);
  assert.equal((parseVoice("전원 호위") as { v: number }).v, 3);
  assert.equal((parseVoice("궁병 후퇴") as { v: number }).v, 3);
  assert.equal((parseVoice("산개해") as { v: number }).v, 4);
  assert.equal((parseVoice("기본 대형으로 모여") as { v: number }).v, 0);
  assert.equal((parseVoice("궁병 수비") as { at: string }).at, "hero");
  assert.equal((parseVoice("창병 여기 지켜") as { at: string }).at, "mouse");
  assert.equal(parseVoice("창병 공격")?.kind, "order");
  assert.equal(parseVoice("마법사 저기로 이동")?.kind, "order");
  assert.equal(parseVoice("돌격 공격")?.kind, "stance", "돌격이 공격보다 먼저");
  assert.equal(parseVoice("오늘 날씨 좋다"), null);
  assert.equal(parseVoice(""), null);
});

test("의도 표시: 이름표가 있고, 가만히 있는 용병은 대기·적에게 가면 추격·지시를 받으면 지시로 보인다", () => {
  assert.equal(INTENT_NAMES.length, 17);
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const m = g.addMerc(a, SHIELD, p.x + 40, p.y);
  run(g, 2);
  const wire = () => g.snapshotMercs().find((q) => q[0] === m)![20];
  assert.ok([INTENT.HOLD, INTENT.RETURN, INTENT.GUARD].includes(wire() as 1), `가만히 있을 때 ${INTENT_NAMES[wire()!]}`);
  g.order(a, p.x + 400, p.y + 300, 1 << SHIELD);
  run(g, 0.3);
  assert.equal(wire(), INTENT.ORDER_MOVE, "이동 지시를 받았다");
});

const roster = [
  { id: 11, name: "붉은 카일" },
  { id: 12, name: "푸른 카일" },
  { id: 13, name: "날쌘 레온" },
];

test("음성 지시: 용병 이름으로 개인 명령(마크·공격·이동·해제)을 알아듣는다", () => {
  const mark = parseVoice("레온 기병 마크해", roster);
  assert.equal(mark?.kind, "merc");
  assert.deepEqual((mark as { ids: number[] }).ids, [13]);
  assert.equal((mark as { markType: number }).markType, CAVALRY);
  assert.deepEqual((parseVoice("카일 궁병 마크", roster) as { ids: number[] }).ids.sort(), [11, 12], "이름만 말하면 그 이름의 용병 모두");
  assert.deepEqual((parseVoice("붉은 카일 마법사 마크해", roster) as { ids: number[] }).ids, [11], "수식어까지 말하면 한 명");
  assert.equal((parseVoice("레온 공격", roster) as { action: string }).action, "attack");
  assert.equal((parseVoice("레온 저기 이동", roster) as { action: string }).action, "move");
  assert.equal((parseVoice("레온 제자리", roster) as { action: string }).action, "stay");
  assert.equal((parseVoice("레온 마크 해제", roster) as { action: string }).action, "clear");
  assert.equal(parseVoice("레온 마크해", roster), null, "마크할 병종을 말하지 않으면 모른다");
  assert.equal(parseVoice("기병 돌격", roster)?.kind, "stance", "이름이 없으면 병종 명령");
});

test("개인 명령: 마크를 받은 창병은 가까운 다른 적이 있어도 지정한 병종의 적 쪽으로 간다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const m = g.addMerc(a, SPEAR, p.x + 30, p.y + 100);
  g.spawnEnemyAt(p.x + 30, p.y + 260, SHIELD); // 더 가깝다(아래)
  const cav = g.spawnEnemyAt(p.x + 480, p.y + 100, CAVALRY); // 마크 대상(오른쪽 멀리)
  const e = g.getEnemy(cav)!;
  (e as { cd: number }).cd = 1e9; // 움직이지 않게 공격을 막아 둔다
  assert.equal(g.mercCmd(a, [m], "mark", CAVALRY), true);
  const x0 = g.getMerc(m)!.x;
  run(g, 0.3);
  assert.equal(g.snapshotMercs().find((q) => q[0] === m)![20], INTENT.MARK, "머리 위에 마크로 보인다");
  run(g, 1.2);
  assert.ok(g.getMerc(m)!.x - x0 > 40, "기병 쪽(오른쪽)으로 간다");
  assert.equal(g.mercCmd(a, [m], "clear"), true);
  assert.equal(g.getMerc(m)!.cmd, undefined);
});

test("개인 명령: 검증 — 남의 용병·잘못된 값은 무시하고, 병종 지시를 새로 주면 개인 명령이 풀린다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  const p = g.getPlayer(a)!;
  const m = g.addMerc(a, SPEAR, p.x, p.y + 50);
  assert.equal(g.mercCmd(b, [m], "move", 0, 100, 100), false, "남의 용병");
  assert.equal(g.mercCmd(a, [m], "mark", 99), false, "없는 병종");
  assert.equal(g.mercCmd(a, [m], "bad"), false);
  assert.equal(g.mercCmd(a, [], "clear"), false);
  assert.equal(g.mercCmd(a, [m], "move", 0, NaN, 1), false);
  assert.equal(g.mercCmd(a, [m], "move", 0, 100, 100), true);
  assert.ok(g.getMerc(m)!.cmd);
  g.order(a, p.x + 200, p.y, 1 << SPEAR);
  assert.equal(g.getMerc(m)!.cmd, undefined, "병종 지시가 우선(나중 명령이 이긴다)");
});

test("지정 위치 명령: kind가 이동이면 적 근처여도 이동, 공격이면 450px 안의 적까지 공격 지시", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.addMerc(a, SPEAR, p.x, p.y + 50);
  g.spawnEnemyAt(p.x + 300, p.y, SHIELD);
  const orders = () => (g as unknown as { slots: Map<number, { orders: ({ kind: number } | null)[] }> }).slots.get(a)!.orders[SPEAR];
  g.order(a, p.x + 300, p.y, 1 << SPEAR); // 자동: 적 바로 곁이라 공격
  assert.equal(orders()!.kind, 0);
  g.order(a, p.x + 300, p.y, 1 << SPEAR, "move");
  assert.equal(orders()!.kind, 1, "이동은 적 근처여도 이동");
  g.order(a, p.x + 300, p.y + 350, 1 << SPEAR); // 자동: 350px 떨어져 있어 이동
  assert.equal(orders()!.kind, 1);
  g.order(a, p.x + 300, p.y + 350, 1 << SPEAR, "attack");
  assert.equal(orders()!.kind, 0, "공격은 더 먼 적도 대상으로 삼는다");
});

test("의도 표시: 대상 병종이 함께 실린다(마크·공격)", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const m = g.addMerc(a, ARCHER, p.x, p.y + 60);
  const cav = g.spawnEnemyAt(p.x + 200, p.y + 60, CAVALRY);
  (g.getEnemy(cav) as { cd: number }).cd = 1e9;
  g.mercCmd(a, [m], "mark", CAVALRY);
  run(g, 0.3);
  const w = g.snapshotMercs().find((q) => q[0] === m)!;
  assert.ok(w[20] === INTENT.MARK || w[20] === INTENT.ATTACK);
  assert.equal(w[21], CAVALRY, "대상 병종이 기병");
});

test("의도 표시: 토너먼트 경기 중에도 싸우는 선수의 용병 의도가 나간다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  g.addMerc(a, SPEAR, 0, 50);
  g.addMerc(b, SPEAR, 0, 50);
  g.jumpToStage(3);
  (g as unknown as { onBossDown(at: { x: number; y: number }): void }).onBossDown({ x: 0, y: 0 });
  for (let i = 0; i < Math.ceil((TUNE.TOURNAMENT_NOTICE_SEC + 0.2) * 20); i++) g.step(); // 예고
  g.step();
  assert.equal(g.info().phase, "tournament");
  let tries = 0;
  while (g.info().tour?.step !== "fight" && tries++ < 20 * 30) g.step();
  assert.equal(g.info().tour?.step, "fight");
  run(g, 1);
  const mine = g.snapshotMercs().filter((w) => w[5] === a);
  assert.ok(mine.length > 0 && mine.every((w) => (w[20] as number) > 0), "의도가 있다");
});


const roster2 = [
  { id: 11, name: "붉은 카일", num: 1 },
  { id: 12, name: "푸른 카일", num: 2 },
  { id: 13, name: "날쌘 레온", num: 3 },
  { id: 14, name: "늙은 볼프", num: 12 },
];

test("음성: 우리말 숫자를 번호로 읽는다(3번·삼번·세번·십이번·열두번)", () => {
  assert.equal(koNumber("삼"), 3);
  assert.equal(koNumber("십이"), 12);
  assert.equal(koNumber("이십삼"), 23);
  assert.equal(koNumber("열두"), 12);
  assert.equal(koNumber("스물셋"), 23);
  assert.equal(koNumber("세"), 3);
  assert.deepEqual(extractNumbers("3번 기병 마크해").nums, [3]);
  assert.deepEqual(extractNumbers("삼번이랑 십이번 공격").nums, [3, 12]);
  assert.deepEqual(extractNumbers("세 번 마크").nums, [3]);
});

test("음성: 번호로 용병을 불러 개인 명령을 내린다", () => {
  const mark = parseVoice("3번 기병 마크해", roster2) as { ids: number[]; action: string; markType: number };
  assert.deepEqual(mark.ids, [13]);
  assert.equal(mark.action, "mark");
  assert.equal(mark.markType, CAVALRY);
  assert.deepEqual((parseVoice("삼번이랑 십이번 공격", roster2) as { ids: number[] }).ids.sort(), [13, 14]);
  assert.deepEqual((parseVoice("이번 제자리", roster2) as { ids: number[] }).ids, [12], "이번 = 2번");
  assert.equal(parseVoice("9번 공격", roster2), null, "없는 번호는 모른다");
});

test("음성: 소리가 비슷하게 잘못 인식된 말도 알아듣는다(귀병·공병·수빈·공걱)", () => {
  assert.equal((parseVoice("귀병 돌격", [], false) as { types: number }).types, 1 << CAVALRY, "별칭 사전");
  assert.equal(parseVoice("공병 호위", [], false)?.kind, "stance");
  assert.equal((parseVoice("궁병 수빈", [], false) as { at: string }).at, "hero");
  assert.equal(parseVoice("창병 공곡", [], false), null, "정확 해석은 모른다");
  const fz = parseVoice("창병 공곡", [], true);
  assert.equal(fz?.kind, "order", "퍼지 해석으로 공격");
  assert.equal(parseVoice("오늘 점심 뭐 먹지", [], true), null, "관계없는 말은 퍼지로도 모른다");
  assert.ok(toJamo("귀병").length > 0);
});

test("음성: 후보 여러 개 중 알아듣는 것을 고른다(정확한 후보가 먼저, 없으면 비슷한 소리)", () => {
  const r = parseVoiceBest(["날씨 좋다", "기병 돌격", "귀병 돌진"], roster2)!;
  assert.equal(r.text, "기병 돌격");
  assert.equal(r.fuzzy, false);
  const f = parseVoiceBest(["기병 돌겹", "기병 도력"], roster2);
  assert.ok(f && f.fuzzy && f.cmd.kind === "stance", "퍼지로 돌격");
  assert.equal(parseVoiceBest(["음 어 그"], roster2), null);
});

test("용병 번호: 1부터 비어 있는 가장 작은 번호를 받고, 해고하면 그 번호를 다음 용병이 쓴다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const m1 = g.addMerc(a, SPEAR, p.x, p.y + 40);
  const m2 = g.addMerc(a, ARCHER, p.x, p.y + 80);
  const m3 = g.addMerc(a, SHIELD, p.x, p.y + 120);
  const nums = () => Object.fromEntries(g.snapshotMercs().map((w) => [w[0], w[22]]));
  assert.deepEqual([nums()[m1], nums()[m2], nums()[m3]], [1, 2, 3]);
  (g as unknown as { mercs: Map<number, unknown> }).mercs.delete(m2);
  const m4 = g.addMerc(a, BLUNT, p.x, p.y + 160);
  assert.equal(nums()[m4], 2, "비어 있던 2번을 쓴다");
});


test("의도 문장: 혼잣말처럼 읽히고 조사가 맞는다", () => {
  assert.equal(eulReul("기병"), "을");
  assert.equal(eulReul("마법사"), "를");
  assert.equal(intentLine(INTENT.ATTACK, "기병"), "기병을 공격해야 해!");
  assert.equal(intentLine(INTENT.ATTACK, "마법사"), "마법사를 공격해야 해!");
  assert.equal(intentLine(INTENT.ATTACK), "공격해야 해!");
  assert.equal(intentLine(INTENT.CHASE, "궁병"), "궁병을 쫓아가야 해");
  assert.equal(intentLine(INTENT.CHASE), "적을 쫓아가야 해");
  assert.equal(intentLine(INTENT.MARK, "기병"), "기병을 계속 따라붙어야 해");
  assert.equal(intentLine(INTENT.KITE), "거리를 벌려야 해");
  assert.equal(intentLine(INTENT.FEAR), "이길 수 없어…!");
  for (let c = 1; c < INTENT_NAMES.length; c++) assert.ok(intentLine(c, "창병").length > 0 && intentLine(c, "창병", 1).length > 0, `의도 ${c}`);
  assert.equal(intentLine(INTENT.ATTACK, "기병", 1), "기병을 공격해야겠어!");
  assert.equal(intentLine(INTENT.GUARD, undefined, 1), "이 자리를 지켜야겠어");
  const mixed = new Set([0, 1].map((v) => intentLine(INTENT.CHASE, "기병", v)));
  assert.equal(mixed.size, 2, "말투가 두 가지로 섞인다");
});
