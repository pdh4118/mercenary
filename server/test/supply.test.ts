import { test } from "node:test";
import assert from "node:assert/strict";
import { EF_SUPPLY, SUPPLY, TICK_RATE } from "@mercenary/shared";
import { Game } from "../src/game.js";

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
function setup() {
  const g = new Game();
  g.autoSpawn = false;
  const id = g.addPlayer("p")!;
  const p = g.getPlayer(id)!;
  p.x = 0;
  p.y = 0;
  p.invuln = 999;
  return { g, p, id };
}
const supplyOf = (g: Game): any => [...(g as any).enemies.values()].find((e: any) => e.supply);

test("군량병은 공격하지 않고 아군에게서 멀어진다", () => {
  const { g, p } = setup();
  (g as any).spawnSupply(p);
  const e = supplyOf(g);
  assert.ok(e);
  e.x = 150;
  e.y = 0;
  const before = Math.hypot(e.x - p.x, e.y - p.y);
  run(g, 2);
  assert.ok(Math.hypot(e.x - p.x, e.y - p.y) > before + 60, "멀어졌다");
  assert.equal(p.hp, p.maxHp, "피해를 주지 않는다");
  assert.ok(g.snapshotEnemies().find((w) => w[0] === e.id)![14]! & EF_SUPPLY);
});

test("군량병을 잡으면 쌀이 남고, 먹으면 최대 체력의 20%+15가 찬다", () => {
  const { g, p } = setup();
  (g as any).spawnSupply(p);
  const e = supplyOf(g);
  e.x = 300;
  e.y = 0;
  (g as any).killEnemy(e, p.id);
  assert.equal(g.snapshotRice()!.length, 1);
  p.hp = 10;
  p.x = 300;
  p.y = 0;
  run(g, 0.2);
  assert.equal(g.snapshotRice(), undefined, "먹어서 사라졌다");
  const want = Math.min(p.maxHp, 10 + p.maxHp * SUPPLY.healFrac + SUPPLY.healFlat);
  assert.ok(Math.abs(p.hp - want) < 1, `${p.hp} ≈ ${want}`);
});

test("쌀은 시간이 지나면 사라지고, 군량병은 드물게 나온다(최대 2명)", () => {
  const { g, p } = setup();
  (g as any).rice.set(1, { id: 1, x: 900, y: 900, left: SUPPLY.riceSec });
  run(g, SUPPLY.riceSec + 1);
  assert.equal(g.snapshotRice(), undefined);
  g.autoSpawn = true;
  let max = 0;
  for (let i = 0; i < 300 * TICK_RATE; i++) {
    g.step();
    p.hp = p.maxHp;
    let n = 0;
    for (const e of (g as any).enemies.values()) if (e.supply) n++;
    max = Math.max(max, n);
  }
  assert.ok(max >= 1 && max <= SUPPLY.max, `최대 ${max}`);
});

test("창 돌진은 지나가는 길의 적도 벤다(한 번씩)", async () => {
  const { SPEAR: SP, WEAPONS } = await import("@mercenary/shared");
  const { g, p, id } = setup();
  p.weapon = WEAPONS.findIndex((w) => w.type === SP);
  const slot = (g as any).slots.get(id);
  const e = (g as any).makeEnemy(120, 0, 1);
  e.hp = e.maxHp = 1e6;
  slot.input.aim = 0;
  p.aim = 0;
  assert.equal(g.useSkill(id), true);
  run(g, 0.4);
  assert.ok(e.hp < e.maxHp, "길목의 적이 맞았다");
  assert.ok(e.maxHp - e.hp < (WEAPONS[p.weapon]!.damage * slot.mods.heroDmg) * 6, "여러 번 맞지 않는다");
});

test("기마 가속 중에는 궁병의 화살을 맞아도 피해가 없다", async () => {
  const { ARCHER: AR, CAVALRY: CV, WEAPONS } = await import("@mercenary/shared");
  const { g, p, id } = setup();
  p.invuln = 0;
  p.weapon = WEAPONS.findIndex((w) => w.type === CV);
  const slot = (g as any).slots.get(id);
  const fr = (g as any).collectFriendlies().find((f: any) => f.ownerId === id);
  const hit = { damage: 20, charge: 0, srcType: AR, fromAngle: 0, crit: false };
  assert.ok(fr.hit(hit) === 0 && p.hp < p.maxHp, "가속 전에는 맞는다");
  p.hp = p.maxHp;
  slot.boostT = 2;
  fr.hit(hit);
  assert.equal(p.hp, p.maxHp);
});
