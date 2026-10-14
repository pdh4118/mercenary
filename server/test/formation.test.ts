import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BLUNT,
  CAVALRY,
  DEFAULT_PRESETS,
  FORMATION_SPACING_MAX,
  FORMATION_SPACING_MIN,
  SHIELD,
  SPEAR,
  ZONE_BACK,
  ZONE_FRONT,
  ZONE_GUARD,
  ZONE_LEFT,
  layoutFormation,
  sanitizeFormation,
} from "@mercenary/shared";
import { Game } from "../src/game.js";

const units = [
  { id: 1, type: CAVALRY },
  { id: 2, type: SPEAR },
  { id: 3, type: ARCHER },
  { id: 4, type: SHIELD },
  { id: 5, type: BLUNT },
];

test("기본 진형: 검방·둔기 앞줄, 창 중간, 궁 뒤, 기병은 양옆 바깥", () => {
  const l = layoutFormation(units, DEFAULT_PRESETS[0]!.zones, 1);
  assert.ok(l.get(4)![0] > l.get(2)![0] && l.get(2)![0] > l.get(3)![0]);
  assert.equal(l.get(4)![0], l.get(5)![0]);
  assert.ok(Math.abs(l.get(1)![1]) > 100);
});

test("구역을 바꾸면 자리가 바뀐다: 기병을 후위 호위로, 좌익으로", () => {
  const zones = [...DEFAULT_PRESETS[0]!.zones];
  zones[CAVALRY] = ZONE_GUARD;
  const guard = layoutFormation(units, zones, 1).get(1)!;
  assert.ok(guard[0] < layoutFormation(units, zones, 1).get(3)![0], "궁병보다 뒤");
  zones[CAVALRY] = ZONE_LEFT;
  assert.ok(layoutFormation(units, zones, 1).get(1)![1] > 100, "왼쪽");
});

test("간격 배율이 넓을수록 같은 줄의 간격이 커진다", () => {
  const many = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, type: SHIELD }));
  const gap = (sp: number) => {
    const l = layoutFormation(many, [0, 0, 0, ZONE_FRONT, 0], sp);
    return Math.abs(l.get(1)![1] - l.get(2)![1]);
  };
  assert.ok(Math.abs(gap(1.8) - gap(1) * 1.8) < 1e-9);
  assert.ok(gap(1.5) > gap(1));
});

test("진형 입력 검증: 잘못된 길이·구역은 거부하고 간격은 범위로 맞춘다", () => {
  assert.equal(sanitizeFormation(null), null);
  assert.equal(sanitizeFormation({ zones: [0, 1], spacing: 1 }), null);
  assert.equal(sanitizeFormation({ zones: [0, 1, 2, 3, 9], spacing: 1 }), null);
  assert.equal(sanitizeFormation({ zones: [0, 1, 2, 3, 1.5], spacing: 1 }), null);
  assert.equal(sanitizeFormation({ zones: [0, 0, 0, 0, 0], spacing: 99 })!.spacing, FORMATION_SPACING_MAX);
  assert.equal(sanitizeFormation({ zones: [0, 0, 0, 0, 0], spacing: -3 })!.spacing, FORMATION_SPACING_MIN);
  assert.equal(sanitizeFormation({ zones: [0, 0, 0, 0, 0], spacing: "x" })!.spacing, 1);
});

test("서버: 진형을 바꾸면 용병의 자리가 바뀌고, 잘못된 요청은 무시된다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const sp = g.addMerc(a, ARCHER, 0, 0);
  const front = () => g.formationSlots(a).get(sp)!;
  const before = front();
  assert.equal(g.setFormation(a, { zones: [0, 0, ZONE_FRONT, 0, 0], spacing: 1 }), true);
  const after = front();
  assert.notDeepEqual(after, before);
  assert.equal(g.setFormation(a, { zones: [0, 0, 99, 0, 0], spacing: 1 }), false);
  assert.deepEqual(front(), after);
  assert.equal(g.setFormation(999, { zones: [0, 0, 0, 0, 0], spacing: 1 }), false);
  void ZONE_BACK;
});

test("다시 하기를 해도 고른 진형은 유지된다", () => {
  const g = new Game();
  const a = g.addPlayer("a")!;
  g.setFormation(a, { zones: [6, 6, 6, 6, 6], spacing: 1.5 });
  g.reset();
  const m = g.addMerc(a, SHIELD, 0, 0);
  const p = g.getPlayer(a)!;
  const slot = g.formationSlots(a).get(m)!;
  assert.ok(Math.hypot(slot[0] - p.x, slot[1] - p.y) > 120, "호위 구역(뒤쪽 멀리)에 선다");
});
