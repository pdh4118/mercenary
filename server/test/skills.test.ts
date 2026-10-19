import { test } from "node:test";
import assert from "node:assert/strict";
import { EVT_INVULN, EVT_SKILL, SHIELD, TICK_RATE, TUNE, WEAPONS, WEAPON_SWITCH_DELAY_SEC } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};
const idle = { dx: 0, dy: 0, aim: 0, fire: false };
type E = { hp: number; maxHp: number; x: number; y: number };
const dummy = (g: Game, x: number, y: number, type = 1): number => {
  const id = g.spawnEnemyAt(x, y, type);
  const e = (g as unknown as { enemies: Map<number, E> }).enemies.get(id)!;
  e.hp = e.maxHp = 5000;
  return id;
};
const start = (weapon: number) => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  g.setWeapon(a, weapon);
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  return { g, a, p: g.getPlayer(a)! };
};

test("스킬 쿨타임은 무기를 바꿔도 공유된다", () => {
  const { g, a } = start(0);
  assert.equal(g.useSkill(a), true);
  assert.ok(g.getPlayer(a)!.sk > 5 && g.getPlayer(a)!.skMax === TUNE.SKILL_CD_BOW);
  g.setWeapon(a, 2);
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  assert.equal(g.useSkill(a), false, "다른 무기로 바꿔도 쿨타임이 남아 있다");
  run(g, TUNE.SKILL_CD_BOW);
  assert.equal(g.useSkill(a), true, "쿨타임이 끝나면 다른 무기의 스킬을 쓴다");
  assert.equal(g.getPlayer(a)!.skMax, TUNE.SKILL_CD_SWORD, "쓴 스킬의 쿨타임으로 바뀐다");
});

test("쓰러져 있으면 스킬을 쓸 수 없다", () => {
  const { g, a } = start(1);
  g.getPlayer(a)!.down = true;
  assert.equal(g.useSkill(a), false);
});

test("활 스킬: 조준 반대쪽으로 살짝 물러난다", () => {
  const { g, a, p } = start(0);
  const x0 = p.x;
  g.setInput(a, { ...idle, aim: 0 });
  g.useSkill(a);
  run(g, 0.4);
  assert.ok(Math.abs(x0 - g.getPlayer(a)!.x - TUNE.SKILL_BACKSTEP_DIST) < 3, `${x0 - g.getPlayer(a)!.x}`);
});

test("창 스킬: 조준 방향으로 일정 거리 돌진하고 끝에 찌른다", () => {
  const { g, a, p } = start(1);
  const x0 = p.x;
  const e = dummy(g, x0 + TUNE.SKILL_DASH_DIST + 60, p.y);
  g.setInput(a, { ...idle, aim: 0 });
  g.useSkill(a);
  run(g, 0.5);
  assert.ok(Math.abs(g.getPlayer(a)!.x - x0 - TUNE.SKILL_DASH_DIST) < 3);
  assert.ok(g.getEnemy(e)!.hp < 5000, "돌진이 끝나면 앞의 적을 찌른다");
});

test("검 스킬: 1초간 피해를 받지 않는다", () => {
  const { g, a } = start(2);
  g.useSkill(a);
  const hero = (g as unknown as { collectFriendlies(): { ownerId: number; hit(h: unknown): number }[] }).collectFriendlies().find((f) => f.ownerId === a)!;
  const hp0 = g.getPlayer(a)!.hp;
  hero.hit({ damage: 30, charge: 0, srcType: 1, fromAngle: 0 });
  assert.equal(g.getPlayer(a)!.hp, hp0, "무적 중에는 맞아도 피해가 없다");
  const pops = () => g.takeEvents().filter((e) => e[0] === EVT_INVULN && e[5] === a);
  assert.equal(pops().length, 1, "무적으로 막으면 \"무적!\" 표시 이벤트가 한 번 나간다");
  hero.hit({ damage: 30, charge: 0, srcType: 1, fromAngle: 0 });
  assert.equal(pops().length, 0, "연속 피격은 0.4초에 한 번만 표시한다");
  run(g, TUNE.SKILL_INVULN_SEC + 0.2);
  assert.equal(g.getPlayer(a)!.invuln, 0);
  const hero2 = (g as unknown as { collectFriendlies(): { ownerId: number; hit(h: unknown): number }[] }).collectFriendlies().find((f) => f.ownerId === a)!;
  hero2.hit({ damage: 30, charge: 0, srcType: 1, fromAngle: 3 });
  assert.ok(g.getPlayer(a)!.hp < hp0, "끝나면 다시 맞는다");
  assert.equal(WEAPONS[2]!.type, SHIELD);
});

test("창 스킬: 돌진하는 동안 무적이고 끝나면 다시 맞는다(무적 링용 invuln은 쓰지 않는다)", () => {
  const { g, a } = start(1);
  g.useSkill(a);
  const friendly = () => (g as unknown as { collectFriendlies(): { ownerId: number; hit(h: unknown): number }[] }).collectFriendlies().find((f) => f.ownerId === a)!;
  const hp0 = g.getPlayer(a)!.hp;
  friendly().hit({ damage: 30, charge: 0, srcType: 1, fromAngle: 0 });
  assert.equal(g.getPlayer(a)!.hp, hp0, "돌진 중에는 피해가 없다");
  assert.equal(g.getPlayer(a)!.invuln, 0, "무적 링 표시는 쓰지 않는다");
  run(g, TUNE.SKILL_DASH_SEC + 0.2);
  friendly().hit({ damage: 30, charge: 0, srcType: 1, fromAngle: 3 });
  assert.ok(g.getPlayer(a)!.hp < hp0, "돌진이 끝나면 다시 맞는다");
});

test("철퇴 스킬: 날아가다 적에게 닿으면 그 자리의 주변 적이 함께 광역 피해를 입는다", () => {
  const { g, a, p } = start(3);
  const near = dummy(g, p.x + 300, p.y);
  const near2 = dummy(g, p.x + 300, p.y + 50);
  const far = dummy(g, p.x + 300, p.y + 300);
  g.setInput(a, { ...idle, aim: 0, dist: 300 });
  g.useSkill(a);
  assert.equal(g.getEnemy(near)!.hp, 5000, "던진 직후에는 맞지 않았다");
  run(g, 1.2);
  const dealt = 5000 - g.getEnemy(near)!.hp;
  assert.ok(dealt >= WEAPONS[3]!.damage * TUNE.SKILL_MACE_DAMAGE * 0.9, `피해 ${dealt}`);
  assert.ok(g.getEnemy(near2)!.hp < 5000, "폭발 반경 안의 적도 맞는다");
  assert.equal(g.getEnemy(far)!.hp, 5000, "먼 적은 맞지 않는다");
  assert.ok(g.takeEvents().some((ev) => ev[0] === EVT_SKILL && ev[4] === 1), "적에게 닿은 이벤트");
});

test("철퇴 스킬: 커서까지의 거리와 상관없이 정해진 거리를 날아간다", () => {
  const { g, a, p } = start(3);
  const e = dummy(g, p.x + TUNE.SKILL_MACE_RANGE - 60, p.y);
  (g.getEnemy(e) as { stunT: number }).stunT = 5; // 가만히 서 있게(접근하며 옆으로 비켜 가지 않게)
  g.setInput(a, { ...idle, aim: 0, dist: 100 }); // 커서는 가까워도
  g.useSkill(a);
  run(g, 1.2);
  assert.ok(g.getEnemy(e)!.hp < 5000, "정해진 거리 안의 적에게 닿는다");
});

test("철퇴 스킬: 아무것도 못 맞히면 폭발 없이 사라진다", () => {
  const { g, a, p } = start(3);
  const far = dummy(g, p.x + TUNE.SKILL_MACE_RANGE + 200, p.y); // 날아가는 거리 밖
  g.setInput(a, { ...idle, aim: 0, dist: 200 });
  g.useSkill(a);
  g.takeEvents();
  assert.equal(g.snapshotBullets().length, 1);
  assert.equal(g.snapshotBullets()[0]![4], 1, "던진 철퇴로 구분된다");
  run(g, 1.5);
  assert.equal(g.snapshotBullets().length, 0, "다 날아가면 사라진다");
  assert.equal(g.getEnemy(far)!.hp, 5000, "아무 피해도 없다");
  assert.ok(!g.takeEvents().some((ev) => ev[0] === EVT_SKILL && ev[4] === 1), "폭발 이벤트가 없다");
});

test("기마 스킬: 2초간 최고 속도로 달리고, 공격하면 그 속도를 잃는다", () => {
  const dist = (skill: boolean) => {
    const { g, a, p } = start(5);
    const x0 = p.x;
    if (skill) g.useSkill(a);
    g.setInput(a, { ...idle, dx: 1 });
    run(g, 0.6);
    return g.getPlayer(a)!.x - x0;
  };
  assert.ok(dist(true) > dist(false) * 1.3, "가속하지 않을 때보다 훨씬 멀리 간다");
  const { g, a } = start(5);
  g.useSkill(a);
  g.setInput(a, { ...idle, dx: 1 });
  run(g, TUNE.SKILL_BOOST_SEC + 0.3);
  const slot = (g as unknown as { slots: Map<number, { boostT: number }> }).slots.get(a)!;
  assert.equal(slot.boostT, 0, "2초가 지나면 끝난다");
});

test("기마 스킬: 공격하면 가속(최고 속도)이 끝나고 속도를 잃는다", () => {
  const { g, a, p } = start(5);
  g.useSkill(a);
  const slot = (g as unknown as { slots: Map<number, { boostT: number; mom: number }> }).slots.get(a)!;
  assert.ok(slot.boostT > 1.9 && slot.mom === 1);
  dummy(g, p.x + 50, p.y);
  g.setInput(a, { ...idle, aim: 0, fire: true });
  run(g, 0.3);
  assert.equal(slot.boostT, 0, "공격으로 가속이 끝났다");
  assert.ok(slot.mom < 1, "속도를 잃었다");
});

test("스킬 쿨타임은 모두 10초로 같다", () => {
  assert.deepEqual([TUNE.SKILL_CD_BOW, TUNE.SKILL_CD_SPEAR, TUNE.SKILL_CD_SWORD, TUNE.SKILL_CD_MACE, TUNE.SKILL_CD_STAFF, TUNE.SKILL_CD_MOUNT], [10, 10, 10, 10, 10, 10]);
  assert.ok(TUNE.SKILL_WALL_SEC < 10, "방벽은 쿨타임보다 짧게 남는다");
});

test("지팡이 스킬: 커서 위치에 수직으로 벽이 서고, 적을 막고 시간이 지나면 사라진다", () => {
  const { g, a, p } = start(4);
  g.setInput(a, { ...idle, aim: 0, dist: 200 });
  g.useSkill(a);
  const w = g.snapshotWalls();
  assert.equal(w.length, 1);
  assert.ok(Math.abs(w[0]![1] - (p.x + 200)) < 1 && Math.abs(w[0]![3] - Math.PI / 2) < 0.02, "커서 위치, 조준선에 수직");
  // 벽 너머 적이 주인공을 향해 와도 통과하지 못한다
  const e = g.spawnEnemyAt(p.x + 330, p.y, SHIELD);
  (g.getEnemy(e) as { stunT?: number }).stunT = 0;
  let inside = 0;
  let blocked = 0;
  for (let i = 0; i < 3 * TICK_RATE; i++) {
    g.step();
    const en = g.getEnemy(e)!;
    if (Math.abs(en.x - (p.x + 200)) < w[0]![5] && Math.abs(en.y - p.y) < w[0]![4]) inside++; // 몸 중심이 벽 안에 들어갔다
    if (Math.abs(en.x - (p.x + 200)) < w[0]![5] + 20 && Math.abs(en.y - p.y) < w[0]![4]) blocked++; // 벽에 바짝 붙어 있었다
  }
  assert.equal(inside, 0, "벽을 통과하지 못한다(옆으로 돌아간다)");
  assert.ok(blocked > 0, "벽에 막혀 붙어 있던 때가 있다");
  run(g, TUNE.SKILL_WALL_SEC);
  assert.equal(g.snapshotWalls().length, 0, "시간이 지나면 사라진다");
});

test("방벽은 적의 화살을 막고, 아무리 맞아도 부서지지 않는다(시간이 되면 사라진다)", () => {
  const { g, a, p } = start(4);
  g.setInput(a, { ...idle, aim: 0, dist: 200 });
  g.useSkill(a);
  // 적 화살을 벽 뒤에서 쏜다
  (g as unknown as { bullets: unknown[] }).bullets.push({
    id: 9999, x: p.x + 300, y: p.y, vx: -400, vy: 0, left: 600, hostile: true, damage: 10, srcType: 2, owner: 0, radius: 5, pierce: 0, crit: false, hitIds: new Set(),
  });
  const hp0 = g.getPlayer(a)!.hp;
  run(g, 1);
  assert.equal(g.getPlayer(a)!.hp, hp0, "주인공은 맞지 않는다");
  assert.equal(g.snapshotWalls().length, 1, "화살을 맞아도 벽은 그대로 서 있다");
  assert.ok(g.snapshotWalls()[0]![6] > 70, "남은 시간 비율은 시간만 따라 줄어든다");
});

test("스킬 회복 속도 카드: 일반 +4%, 쌓을수록 쿨타임이 1/(1+합)배로 줄고 효율은 같다", async () => {
  const { CARDS } = await import("@mercenary/shared");
  const cards = CARDS.filter((c) => c.effect.k === "heroSkill");
  assert.equal(cards.length, 3, "일반·희귀·영웅");
  assert.ok(cards[0]!.effect.k === "heroSkill" && Math.abs(cards[0]!.effect.v - 0.04) < 1e-9, "일반 +4%");
  assert.equal(cards[0]!.minLevel, 1, "1레벨부터 나온다");
  assert.ok(cards[0]!.effect.k === "heroSkill" && cards[1]!.effect.k === "heroSkill" && Math.abs(cards[1]!.effect.v / cards[0]!.effect.v - 1.6) < 1e-6, "희귀는 x1.6");
  const cooldownAfter = (n: number) => {
    const { g, a } = start(0);
    for (let i = 0; i < n; i++) g.applyCardForTest(a, { k: "heroSkill", v: 0.04 });
    g.useSkill(a);
    return g.getPlayer(a)!.skMax;
  };
  assert.ok(Math.abs(cooldownAfter(0) - 10) < 1e-9);
  assert.ok(Math.abs(cooldownAfter(1) - 10 / 1.04) < 1e-9);
  assert.ok(Math.abs(cooldownAfter(25) - 5) < 1e-9, "합이 1이면 쿨타임이 절반");
  // 한 장 더 얹을 때 늘어나는 '스킬 사용 횟수(초당)'는 쌓인 양과 상관없이 같다
  const rate = (n: number) => 1 / cooldownAfter(n);
  assert.ok(Math.abs(rate(1) - rate(0) - (rate(26) - rate(25))) < 1e-9);
});

test("기마 가속 중에는 상태에 남은 시간(bst)이 실려 속도 이펙트를 그릴 수 있다", () => {
  const { g, a, p } = start(5);
  assert.equal(p.bst, 0);
  g.useSkill(a);
  assert.ok(g.getPlayer(a)!.bst > 1.9);
  run(g, TUNE.SKILL_BOOST_SEC + 0.2);
  assert.equal(g.getPlayer(a)!.bst, 0, "끝나면 0");
  // 공격으로 풀릴 때도 0
  const s2 = start(5);
  s2.g.useSkill(s2.a);
  dummy(s2.g, s2.p.x + 50, s2.p.y);
  s2.g.setInput(s2.a, { ...idle, aim: 0, fire: true });
  run(s2.g, 0.3);
  assert.equal(s2.g.getPlayer(s2.a)!.bst, 0);
});
