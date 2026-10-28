import { test } from "node:test";
import assert from "node:assert/strict";
import { TICK_RATE, parseVoice, voiceTypes, CAVALRY, SPEAR, ARCHER, SHIELD, BLUNT, MAGE, INTENT, INTENT_NAMES } from "@mercenary/shared";
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
  assert.equal(INTENT_NAMES.length, 16);
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
