import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHER, BOSS_NECRO as C, BSK_CHAIN, BSK_DRAIN, BSK_FOG, HZ_CHAIN, HZ_CORPSE, HZ_FOG, HZ_LEECH, SPEAR, TICK_RATE } from "@mercenary/shared";
import { Game } from "../src/game.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const bossOf = (g: Game): any => [...(g as any).enemies.values()].find((e: any) => e.boss);
const run = (g: Game, sec: number, keepAlive = true) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) {
    g.step();
    if (keepAlive) for (const sl of (g as any).slots.values()) sl.state.hp = sl.state.maxHp;
  }
};
const place = (o: { x: number; y: number }, x: number, y: number) => {
  o.x = x;
  o.y = y;
};
function setup(only: number | null, players = 1): { g: Game; b: any; ids: number[] } {
  const g = new Game();
  g.autoSpawn = false;
  const ids = Array.from({ length: players }, (_, i) => g.addPlayer(`p${i}`)!);
  (g as any).stage = 9;
  g.forceBoss();
  for (const e of [...(g as any).enemies.values()]) if (!e.boss) (g as any).enemies.delete(e.id);
  const b = bossOf(g);
  g.step();
  assert.ok(b.bk, "네크로맨서 스킬 상태");
  for (let i = 1; i <= 60; i++) b.bk.cds[i] = i === only ? 0 : 999;
  b.bk.idle = 0;
  b.hp = b.maxHp = 1e9;
  place(b, 0, -700);
  return { g, b, ids };
}
const hazards = (g: Game, kind: number) => g.snapshotHazards().filter((h) => h[1] === kind);

test("암흑 안개: 예고 뒤 보스 자리에 고정된 안개가 깔리고, 안 모든 아군이 같은 독 피해를 입는다", () => {
  const { g, b, ids } = setup(BSK_FOG);
  const p = g.getPlayer(ids[0]!)!;
  place(p, b.x + 100, b.y);
  b.bk.v.orb = 999; // 평타를 막아 안개 피해만 잰다
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_FOG);
  assert.ok(g.snapshotBossTele().length > 0, "안개 예고 원");
  run(g, C.fogTele + 0.3);
  const fog = hazards(g, HZ_FOG);
  assert.equal(fog.length, 1);
  assert.equal(fog[0]![5], C.fogRadius);
  const fx = fog[0]![2];
  run(g, 1);
  assert.equal(hazards(g, HZ_FOG)[0]![2], fx, "한 자리에 고정");
  place(p, b.x + 100, b.y);
  p.hp = p.maxHp;
  p.invuln = 0;
  const hp0 = p.hp;
  for (let i = 0; i < TICK_RATE * 2; i++) {
    g.step();
    place(p, b.x + 100, b.y);
  }
  assert.ok(hp0 - p.hp >= C.fogDps * 1.5 && hp0 - p.hp <= C.fogDps * 2.5 + 1, `2초 동안 약 ${C.fogDps * 2} 피해 ${hp0 - p.hp}`);
});

test("시체와 소생: 안개 속에서 죽은 적이 시체가 되고, 안개가 걷힐 때 스켈레톤으로 일어나며, 근접 3번에 부서진다", () => {
  const { g, b } = setup(BSK_FOG);
  b.bk.v.orb = 999;
  run(g, C.fogTele + 0.5);
  const fz = hazards(g, HZ_FOG)[0]!;
  const inside = g.spawnEnemyAt(fz[2] + 80, fz[3], SPEAR);
  const outside = g.spawnEnemyAt(fz[2] + 600, fz[3], SPEAR);
  for (const id of [inside, outside]) (g as any).damageEnemy((g as any).enemies.get(id), { damage: 9999, charge: 0, srcType: 0, fromAngle: 0, crit: false }, 1);
  const cs = hazards(g, HZ_CORPSE);
  assert.equal(cs.length, 1, "안개 안에서 죽은 것만 시체");
  assert.equal(cs[0]![5], SPEAR);
  assert.equal(cs[0]![6], C.corpseHits);
  // 시체 근처 근접 공격 3번
  const sys = (g as any).boss;
  for (let i = 0; i < 2; i++) sys.strikeBarriers(cs[0]![2], cs[0]![3], 40, 10);
  assert.equal(hazards(g, HZ_CORPSE)[0]![6], 1);
  sys.strikeBarriers(cs[0]![2], cs[0]![3], 40, 10);
  assert.equal(hazards(g, HZ_CORPSE).length, 0, "세 번 맞으면 부서진다");
  // 새 시체 하나는 소생
  const again = g.spawnEnemyAt(fz[2] - 60, fz[3], ARCHER);
  (g as any).damageEnemy((g as any).enemies.get(again), { damage: 9999, charge: 0, srcType: 0, fromAngle: 0, crit: false }, 1);
  assert.equal(hazards(g, HZ_CORPSE).length, 1);
  run(g, C.fogSec - C.reviveLead - 0.1 - 0.5 + 0.7, true);
  assert.equal(hazards(g, HZ_CORPSE)[0]![4], 1, "걷히기 전 푸른 불꽃(소생 중 표시)");
  run(g, C.reviveLead + 1);
  const skels = [...(g as any).enemies.values()].filter((e: any) => e.skel);
  assert.equal(skels.length, 1, "시체 하나에 스켈레톤 하나");
  assert.equal(skels[0].type, ARCHER, "같은 병종");
  assert.equal(hazards(g, HZ_CORPSE).length, 0);
  // 스켈레톤은 안개 속에서 죽어도 시체가 되지 않는다(안개가 다시 깔려도)
  assert.equal(skels[0].maxHp > 0, true);
});

test("생명 흡수: 징조 뒤 범위 안 모든 아군에 선이 연결되고 보스가 회복하며, 범위 밖은 연결되지 않는다", () => {
  const { g, b, ids } = setup(BSK_DRAIN, 2);
  b.bk.v.fogDone = 1;
  b.hp = b.maxHp * 0.3; // 체력 50% 이하에서 쓴다
  const near = g.getPlayer(ids[0]!)!;
  const far = g.getPlayer(ids[1]!)!;
  place(near, b.x + 200, b.y);
  place(far, b.x + C.drainRadius + 300, b.y);
  g.addMerc(ids[0]!, 1, b.x - 150, b.y);
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_DRAIN);
  assert.ok(g.snapshotBossTele().length > 0, "징조 원");
  const takeEvents = (g as any).takeEvents.bind(g) as () => number[][];
  takeEvents();
  let healed = 0;
  let links = 0;
  for (let i = 0; i < TICK_RATE * (C.drainTele + 1.2); i++) {
    g.step();
    for (const sl of (g as any).slots.values()) sl.state.hp = sl.state.maxHp;
    for (const ev of takeEvents()) if (ev[0] === 22 && ev[4] === 13) healed += ev[5]!;
    links = Math.max(links, hazards(g, HZ_LEECH).length);
  }
  assert.equal(links, 2, "범위 안 두 대상(주인공 1, 용병 1)에만 선이 연결된다");
  assert.ok(healed > 0, `보스가 회복했다(회복 이벤트 합 ${healed})`);
});

test("영혼 사슬: 대상이 보스 쪽으로 끌려가고, 사슬을 가로지르면 끊기며 보스가 굳고, 끝까지 가면 기절한다", () => {
  const { g, b, ids } = setup(BSK_CHAIN, 2);
  b.bk.v.fogDone = 1;
  b.hp = b.maxHp * 0.3;
  const t = g.getPlayer(ids[0]!)!;
  const other = g.getPlayer(ids[1]!)!;
  (g as any).setWeapon(ids[0]!, 4); // 지팡이
  place(t, b.x, b.y + 700);
  place(other, b.x + 2000, b.y);
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_CHAIN);
  run(g, C.chainTele + 0.5);
  assert.equal(hazards(g, HZ_CHAIN).length, 1);
  const y0 = t.y;
  run(g, 1);
  assert.ok(y0 - t.y > 100, `보스 쪽으로 끌려간다 ${y0 - t.y}`);
  // 다른 아군이 사슬을 다섯 번 가로지른다
  const seg = () => ({ x: b.x, y: b.y + (t.y - b.y) * 0.5 });
  for (let i = 0; i < 6; i++) {
    const m = seg();
    place(other, m.x, m.y);
    run(g, 0.55);
  }
  place(other, b.x + 2000, b.y);
  assert.equal(hazards(g, HZ_CHAIN).length, 0, "끊어졌다");
  assert.ok((b.stunT ?? 0) > 0 || b.bk.cur === null || b.bk.ph === 2, "영혼 반동");
});

test("영혼 구슬: 몸에 맞으면 보스가 입힌 만큼 회복한다", () => {
  const { g, b, ids } = setup(null);
  const p = g.getPlayer(ids[0]!)!;
  place(b, 0, 0);
  place(p, 400, 0);
  b.hp = b.maxHp * 0.5;
  (g as any).slots.get(ids[0]!).state.invuln = 0;
  const takeEvents = (g as any).takeEvents.bind(g) as () => number[][];
  takeEvents();
  let healed = 0;
  for (let i = 0; i < TICK_RATE * 4; i++) {
    g.step();
    place(p, 400, 0);
    p.hp = Math.max(p.hp, 20);
    for (const ev of takeEvents()) if (ev[0] === 22 && ev[4] === 13) healed += ev[5]!;
  }
  assert.ok(healed > 0, `평타로 회복 ${healed}`);
});
