import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROTECT_HERO_GAP,
  ARCHER,
  BLUNT,
  CAVALRY,
  DEFAULT_PRESETS,
  FORMATION_SPACING_MAX,
  FORMATION_SPACING_MIN,
  MAGE,
  SHIELD,
  STANCE_PROTECT,
  SPEAR,
  ZONE_BACK,
  ZONE_FRONT,
  ZONE_GUARD,
  ZONE_LEFT,
  layoutFormation,
  layoutProtective,
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

test("보호 진형 도형: 2명은 양쪽, 3명은 정삼각형, 4명은 정사각형", () => {
  const sw = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, type: SHIELD }));
  const two = layoutProtective(sw(2));
  const a = two.get(1)!;
  const b = two.get(2)!;
  assert.ok(Math.abs(a[0]) < 1e-6 && Math.abs(b[0]) < 1e-6, "앞뒤는 같은 위치");
  assert.ok(a[1] > 0 && b[1] < 0 && Math.abs(a[1] + b[1]) < 1e-6, "왼쪽 오른쪽 양쪽");
  const tri = [...layoutProtective(sw(3)).values()];
  const d = (p: number[], q: number[]) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!);
  const sides = [d(tri[0]!, tri[1]!), d(tri[1]!, tri[2]!), d(tri[2]!, tri[0]!)];
  assert.ok(Math.max(...sides) - Math.min(...sides) < 1e-6, "정삼각형");
  assert.ok(tri[0]![0] > 0 && Math.abs(tri[0]![1]) < 1e-6, "꼭짓점이 앞쪽");
  const sq = [...layoutProtective(sw(4)).values()];
  const s4 = [d(sq[0]!, sq[1]!), d(sq[1]!, sq[2]!), d(sq[2]!, sq[3]!), d(sq[3]!, sq[0]!)];
  const diag = [d(sq[0]!, sq[2]!), d(sq[1]!, sq[3]!)];
  assert.ok(Math.max(...s4) - Math.min(...s4) < 1e-6 && Math.abs(diag[0]! - diag[1]!) < 1e-6, "정사각형");
});

test("보호 진형: 안에 들어오는 궁병·마법사가 많을수록 도형이 커지고, 창병·궁병·마법사는 도형 안에 선다", () => {
  const mk = (ranged: number) => [
    ...[1, 2, 3].map((id) => ({ id, type: SHIELD })),
    { id: 10, type: SPEAR },
    ...Array.from({ length: ranged }, (_, i) => ({ id: 20 + i, type: i % 2 ? MAGE : ARCHER })),
  ];
  const radiusOf = (units: { id: number; type: number }[]) => {
    const l = layoutProtective(units);
    return Math.hypot(...l.get(1)!);
  };
  assert.ok(radiusOf(mk(6)) > radiusOf(mk(0)), "궁병·마법사가 많으면 더 큰 도형");
  const units = mk(6);
  const l = layoutProtective(units);
  const R = Math.hypot(...l.get(1)!);
  for (const u of units) if (u.type !== SHIELD) {
    const d = Math.hypot(...l.get(u.id)!);
    assert.ok(d < R * 0.8, "도형 안쪽");
    assert.ok(d >= PROTECT_HERO_GAP - 1e-9, "주인공에게서 조금 떨어져 선다");
  }
});

test("서버: 보호 진형을 고르면 검방병이 주인공 둘레 도형에 서고 기병·둔기병은 자유롭게 싸운다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const sw = [g.addMerc(a, SHIELD, 0, 0), g.addMerc(a, SHIELD, 0, 0), g.addMerc(a, SHIELD, 0, 0)];
  const ar = g.addMerc(a, ARCHER, 0, 0);
  const cav = g.addMerc(a, CAVALRY, 0, 0);
  const before = g.formationSlots(a).get(cav)!;
  assert.equal(g.setStance(a, STANCE_PROTECT), true);
  const p = g.getPlayer(a)!;
  const slots = g.formationSlots(a);
  const dist = (id: number) => Math.hypot(slots.get(id)![0] - p.x, slots.get(id)![1] - p.y);
  const rs = sw.map(dist);
  assert.ok(Math.max(...rs) - Math.min(...rs) < 1, "세 검방병은 같은 거리(정삼각형)");
  assert.ok(dist(ar) < rs[0]!, "궁병은 도형 안");
  assert.deepEqual(slots.get(cav), before, "기병은 기본 자리 그대로");
  assert.equal(g.setStance(a, 99), false);
});

test("산개 진형: 용병 자리가 기본 진형보다 넓게 흩어진다", async () => {
  const { Game } = await import("../src/game.js");
  const { STANCE_SPREAD, STANCE_DEFEND, SPEAR, ARCHER, SHIELD } = await import("@mercenary/shared");
  const g = new Game();
  g.autoSpawn = false;
  const id = g.addPlayer("p")!;
  const ids = [SPEAR, SPEAR, ARCHER, ARCHER, SHIELD, SHIELD].map((t) => g.addMerc(id, t, 0, 0));
  const spread = (): number => {
    const slots = g.formationSlots(id);
    const p = g.getPlayer(id)!;
    return ids.reduce((s, i) => s + Math.hypot(slots.get(i)![0] - p.x, slots.get(i)![1] - p.y), 0) / ids.length;
  };
  g.setStance(id, STANCE_DEFEND);
  const normal = spread();
  assert.equal(g.setStance(id, STANCE_SPREAD), true);
  assert.equal(g.getPlayer(id)!.stance, STANCE_SPREAD);
  assert.ok(spread() > normal * 1.4, `${spread()} vs ${normal}`);
  // 같은 자리에 겹치지 않는다
  const slots = [...g.formationSlots(id).values()];
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) assert.ok(Math.hypot(slots[i]![0] - slots[j]![0], slots[i]![1] - slots[j]![1]) > 30);
});
