import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BOSS_SPEAR,
  BSK_CLONE,
  BSK_GUARD,
  BSK_THROW,
  BSK_TRIPLE,
  BUL_SPEAR,
  HZ_GHOST,
  HZ_SPEAR,
  TELE_CONE,
  TELE_LINE,
  TICK_RATE,
} from "@mercenary/shared";
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
/** n스테이지 보스 단계를 열고 고른 스킬만 쓰게 한다. 보스는 죽지 않고, 보스군은 치워 둔다. */
function setup(stage: number, only: number, players = 1): { g: Game; b: any; ids: number[] } {
  const g = new Game();
  g.autoSpawn = false;
  const ids = Array.from({ length: players }, (_, i) => g.addPlayer(`p${i}`)!);
  (g as any).stage = stage;
  g.forceBoss();
  for (const e of [...(g as any).enemies.values()]) if (!e.boss) (g as any).enemies.delete(e.id);
  const b = bossOf(g);
  g.step();
  assert.ok(b.bk, `스테이지 ${stage} 장군에게 스킬 상태가 붙는다`);
  for (let i = 1; i <= 60; i++) b.bk.cds[i] = i === only ? 0 : 999;
  b.bk.idle = 0;
  b.hp = b.maxHp = 1e9;
  place(b, 0, -700);
  b.face = Math.PI / 2;
  return { g, b, ids };
}
const hero = (g: Game, id: number): any => g.getPlayer(id)!;

test("창병 장군 분신 돌진: 범위 안 주인공마다 직선 예고, 분신이 돌진해 맞은 대상에게 피해", () => {
  const { g, b, ids } = setup(2, BSK_CLONE, 2);
  place(hero(g, ids[0]!), b.x, b.y + 300);
  place(hero(g, ids[1]!), b.x + 200, b.y + 250);
  const m = g.addMerc(ids[0]!, ARCHER, b.x - 100, b.y + 260);
  void m;
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_CLONE);
  const lines = g.snapshotBossTele().filter((t) => t[0] === TELE_LINE);
  assert.equal(lines.length, 2, "범위 안 주인공 수만큼(용병은 제외)");
  const hp0 = hero(g, ids[0]!).hp;
  let hit = false;
  for (let i = 0; i < TICK_RATE * 3 && !hit; i++) {
    g.step();
    hit = hero(g, ids[0]!).hp < hp0 || hero(g, ids[1]!).hp < hero(g, ids[1]!).maxHp;
    for (const id of ids) hero(g, id).hp = Math.max(hero(g, id).hp, 1); // 죽지 않게
  }
  assert.ok(g.snapshotHazards().some((h) => h[1] === HZ_GHOST) || hit, "분신이 나타났다");
});

test("창병 장군 창 방어 태세: 정면 부채꼴에 들어온 대상을 찌르고 날아오는 아군 화살을 떨어뜨린다", () => {
  const { g, b, ids } = setup(2, BSK_GUARD);
  const p = hero(g, ids[0]!);
  place(p, b.x, b.y + 250);
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_GUARD);
  assert.ok(g.snapshotBossTele().some((t) => t[0] === TELE_CONE));
  // 예고 뒤 태세 중에 부채꼴 안에 서 있으면 찔린다
  place(p, b.x, b.y + 120);
  const hp0 = p.hp;
  run(g, BOSS_SPEAR.guardTele + 0.5, false);
  assert.ok(p.hp < hp0, "찔린다");
  // 아군 화살이 부채꼴 안으로 들어오면 사라진다
  (g as any).bullets.push({ id: 7777, x: b.x, y: b.y + 150, vx: 0, vy: 0, left: 500, hostile: false, damage: 5, srcType: ARCHER, owner: ids[0], radius: 4, pierce: 0, crit: false, hitIds: new Set() });
  g.step();
  assert.ok(!(g as any).bullets.some((x: any) => x.id === 7777), "화살이 쓸려 나간다");
});

test("창병 장군 장창 3연 찌르기: 직선 3개를 예고하고 0.3초 간격으로 차례로 찌른다", () => {
  const { g, b, ids } = setup(2, BSK_TRIPLE);
  const p = hero(g, ids[0]!);
  place(p, b.x, b.y + 200);
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_TRIPLE);
  assert.equal(g.snapshotBossTele().filter((t) => t[0] === TELE_LINE).length, 3);
  const hp0 = p.hp;
  run(g, BOSS_SPEAR.tripleTele + 1, false);
  assert.ok(p.hp < hp0, "가운데 줄에 서 있으면 맞는다");
});

test("창병 장군 창 던지기: 가장 먼 주인공에게 관통하는 창을 던지고 박힌 창이 장애물로 남는다", () => {
  const { g, b, ids } = setup(2, BSK_THROW, 2);
  place(hero(g, ids[0]!), b.x, b.y + 200);
  place(hero(g, ids[1]!), b.x, b.y + 900);
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_THROW);
  const tele = g.snapshotBossTele().find((t) => t[0] === TELE_LINE)!;
  assert.ok(Math.abs(tele[3] - Math.PI / 2) < 0.05, "가장 먼 쪽으로 겨눈다");
  run(g, BOSS_SPEAR.throwTele + 0.1);
  assert.ok((g as any).bullets.some((x: any) => x.kind === BUL_SPEAR && x.pierce > 0), "관통하는 창");
  const hp1 = hero(g, ids[0]!).hp;
  run(g, 1.5, false);
  assert.ok(g.snapshotHazards().some((h) => h[1] === HZ_SPEAR), "박힌 창 장애물");
  void hp1;
});
