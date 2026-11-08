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
