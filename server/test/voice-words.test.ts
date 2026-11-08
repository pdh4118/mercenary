import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { applyVoiceWords, parseVoice, parseVoiceBest, voiceOverrides, voiceWords, VOICE_GROUPS, voiceTypes, ARCHER, MAGE } from "@mercenary/shared";

afterEach(() => applyVoiceWords(null, true));

test("음성 단어: 기본은 고친 것이 없고, 단어를 더하면 그 말도 알아듣는다", () => {
  assert.deepEqual(voiceOverrides(), {});
  assert.equal(parseVoice("궁수 사격 개시"), null);
  applyVoiceWords({ attack: [...voiceWords("attack"), "사격"] });
  assert.deepEqual(Object.keys(voiceOverrides()), ["attack"]);
  const c = parseVoice("궁수 사격 개시");
  assert.equal(c?.kind, "order");
  applyVoiceWords(null, true);
  assert.equal(parseVoice("궁수 사격 개시"), null);
});

test("음성 단어: 병종 별명과 별칭(들린말=맞는말)", () => {
  assert.equal(voiceTypes("활잡이 공격"), 1 << ARCHER);
  applyVoiceWords({ type5: [...voiceWords("type5"), "요술사"], alias: [...voiceWords("alias"), "돌겨억=돌격"] });
  assert.equal(voiceTypes("요술사 공격"), 1 << MAGE);
  assert.equal(parseVoice("기병 돌겨억")?.kind, "stance");
});

test("음성 단어: 묶음을 비우면 그 명령은 알아듣지 않고, 잘못된 값은 걸러낸다", () => {
  applyVoiceWords({ spread: [] });
  assert.equal(parseVoice("기병 산개"), null);
  applyVoiceWords({ attack: ["", "  ", 5, "공 격", "공격", "공격"], nope: ["x"], alias: ["가=나=다", "가나", "잘못=맞게"] });
  assert.deepEqual(voiceWords("attack"), ["공격"]);
  assert.deepEqual(voiceWords("alias"), ["잘못=맞게"]);
  assert.ok(VOICE_GROUPS.every((g) => g.words.length > 0));
});

test("음성 단어: 더 넓은 기본 말투도 알아듣는다", () => {
  for (const [text, kind] of [["궁병대 총공격", "stance"], ["기마대 전진", "order"], ["마도사들 철수", "stance"], ["모두 정렬", "stance"], ["다같이 흩어져", "stance"]] as const) {
    const r = parseVoiceBest([text]);
    assert.equal(r?.cmd.kind, kind, text);
  }
});

import { parseVoiceMulti, splitVoice } from "@mercenary/shared";

test("이어 말하기: 연결 말·쉼표에서 나누고 순서대로 여러 명령이 된다", () => {
  assert.deepEqual(splitVoice("기병 돌격하고 궁병 산개해"), ["기병돌격", "궁병산개해"]);
  assert.deepEqual(splitVoice("기병 돌격, 궁병 수비. 마법사 호위"), ["기병돌격", "궁병수비", "마법사호위"]);
  const r = parseVoiceMulti(["기병 돌격하고 궁병 산개해"])!;
  assert.equal(r.steps.length, 2);
  assert.equal(r.steps[0]!.cmd.kind, "stance");
  assert.equal((r.steps[0]!.cmd as { v: number }).v, 1);
  assert.equal((r.steps[1]!.cmd as { v: number }).v, 4);
  assert.equal((r.steps[1]!.cmd as { types: number }).types, 1 << ARCHER);
});

test("이어 말하기: 병종을 말하지 않은 조각은 앞 병종을 이어받고, 못 알아들은 조각은 건너뛴다", () => {
  const r = parseVoiceMulti(["기병 돌격 그리고 산개"])!;
  assert.equal(r.steps.length, 2);
  assert.equal((r.steps[1]!.cmd as { types: number }).types, 1 << 0, "기병을 이어받는다");
  const s = parseVoiceMulti(["궁병 수비하고 어쩌고저쩌고 그다음 창병 산개"])!;
  assert.equal(s.steps.length, 2);
  assert.equal(s.skipped, 1);
});

test("이어 말하기: 연결 말이 없으면 이전처럼 명령 하나, 5조각까지만, 연결 말은 고칠 수 있다", () => {
  assert.equal(parseVoiceMulti(["기병 돌격"])!.steps.length, 1);
  assert.equal(parseVoiceMulti(["엉뚱한 말"]), null);
  const long = parseVoiceMulti(["기병 돌격하고 창병 산개하고 궁병 수비하고 마법사 호위하고 둔기병 돌격하고 검방병 산개하고 기병 수비"])!;
  assert.equal(long.steps.length, 5);
  assert.equal(splitVoice("기병 돌격하다 궁병 산개").length, 1);
  applyVoiceWords({ link: [...voiceWords("link"), "하다"] });
  assert.equal(splitVoice("기병 돌격하다 궁병 산개").length, 2);
});

test("별칭 입력: 전각 등호·화살표·콜론도 '='로 받는다", () => {
  applyVoiceWords({ alias: ["귀병＝기병", "공병 -> 궁병", "참병→창병", "마법싸:마법사", "잘못"] });
  assert.deepEqual(voiceWords("alias"), ["귀병=기병", "공병=궁병", "참병=창병", "마법싸=마법사"]);
});
