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
  assert.equal(INTENT_NAMES.length, 15);
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
