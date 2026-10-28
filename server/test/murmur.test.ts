import { test } from "node:test";
import assert from "node:assert/strict";
import { INTENT } from "@mercenary/shared";
import { createMurmur, type MurmurIn } from "../../client/src/murmur.js";

const base = (over: Partial<MurmurIn> = {}): MurmurIn => ({ id: 1, type: 2, nameId: 0, x: 0, y: 0, hp: 100, maxHp: 100, down: false, intent: INTENT.HOLD, arg: -1, ready: false, ...over });
const cam = { x: 0, y: 0, r: 900 };

test("혼잣말: 의도가 바뀌면 가끔 한마디 하고, 용병마다 쿨타임이 있다", () => {
  const orig = Math.random;
  Math.random = () => 0.01; // 항상 말하게
  try {
    const mm = createMurmur();
    let now = 100000;
    mm.update([base()], now, cam); // 초기 등록(쿨타임 4~16초)
    now += 20000;
    mm.update([base({ intent: INTENT.CHASE, arg: 0 })], now, cam);
    const out = mm.update([base({ intent: INTENT.CHASE, arg: 0 })], now + 50, cam);
    assert.ok(out.get(1)?.text, "추격으로 바뀌면 말한다");
    // 쿨타임 안에서는 다시 말하지 않는다
    now += 4000;
    mm.update([base({ intent: INTENT.CHASE, arg: 0 })], now, cam);
    const again = mm.update([base({ intent: INTENT.KITE })], now + 100, cam);
    assert.equal(again.get(1), undefined, "말풍선이 사라진 뒤 쿨타임 중에는 조용하다");
  } finally {
    Math.random = orig;
  }
});

test("혼잣말: 체력이 낮아지면 한마디, 화면 밖이거나 쓰러져 있으면 조용하다", () => {
  const orig = Math.random;
  Math.random = () => 0.01;
  try {
    const mm = createMurmur();
    mm.update([base()], 100000, cam);
    const low = mm.update([base({ hp: 20 })], 130000, cam);
    assert.ok(low.get(1)?.text, "체력이 30% 아래면 말한다");
    const mm2 = createMurmur();
    mm2.update([base()], 100000, cam);
    assert.equal(mm2.update([base({ hp: 20, x: 5000 })], 130000, cam).size, 0, "화면 밖");
    assert.equal(mm2.update([base({ hp: 0, down: true })], 130100, cam).size, 0, "쓰러져 있다");
  } finally {
    Math.random = orig;
  }
});

test("혼잣말: 문구의 자리표시자가 남지 않는다", () => {
  const orig = Math.random;
  const mm = createMurmur();
  let now = 100000;
  mm.update([base({ nameId: 7 })], now, cam);
  try {
    for (let i = 0; i < 200; i++) {
      Math.random = () => (i % 97) / 97;
      now += 40000;
      mm.update([base({ nameId: 7, intent: INTENT.HOLD })], now, cam);
      const o = mm.update([base({ nameId: 7, intent: i % 2 ? INTENT.MARK : INTENT.CHASE, arg: i % 3 === 0 ? -1 : 0 })], now + 10, cam).get(1);
      if (o) assert.ok(!/[{}]/.test(o.text), o.text);
    }
  } finally {
    Math.random = orig;
  }
});
