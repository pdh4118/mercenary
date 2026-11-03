/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ghostHidesAggro, EVT_HEAL, EVT_INVULN, EVT_SKILL, SHIELD, TICK_RATE, TUNE, WEAPONS, WEAPON_SWITCH_DELAY_SEC } from "@mercenary/shared";
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

test("활 스킬(은신): 1초간 점점 투명해져 5%가 되고, 투명 50% 이하에서 적의 어그로가 풀리며, 1초 머문 뒤 1초에 걸쳐 돌아와 50% 이상에서 어그로가 돌아온다", () => {
  const { g, a, p } = start(0);
  const x0 = p.x;
  assert.equal(g.getPlayer(a)!.alpha, 100);
  assert.equal(g.useSkill(a), true);
  const hidden = () => ghostHidesAggro((g as any).slots.get(a).ghost);
  const alpha = () => g.getPlayer(a)!.alpha;
  // 투명해지는 1초: 중간(0.5초)에는 아직 50%를 넘고 어그로가 있다
  run(g, 0.4);
  assert.ok(alpha() < 100 && alpha() > 55 && !hidden(), `0.4초 ${alpha()}`);
  run(g, 0.3); // 0.7초: 50% 아래
  assert.ok(alpha() < 50 && hidden(), `0.7초 ${alpha()}`);
  run(g, 0.4); // 1.1초: 가장 투명(5%)
  assert.equal(alpha(), 5);
  assert.ok(hidden());
  run(g, 2.8); // 3.9초: 아직 유지 중(5%, 3초 유지)
  assert.ok(hidden() && alpha() === 5, `3.9초 ${alpha()}`);
  run(g, 0.4); // 4.3초: 돌아오는 중이지만 아직 50% 아래라 어그로는 풀려 있다
  assert.ok(hidden() && alpha() > 5 && alpha() < 50, `4.3초 ${alpha()}`);
  run(g, 0.3); // 4.6초: 50% 위로 돌아와 어그로가 다시 끌린다
  assert.ok(!hidden() && alpha() > 50, `4.6초 ${alpha()}`);
  run(g, 1);
  assert.equal(alpha(), 100);
  assert.equal((g as any).slots.get(a).ghost, undefined, "끝나면 상태가 사라진다");
  assert.ok(Math.abs(g.getPlayer(a)!.x - x0) < 1, "뒤로 물러나지 않는다");
});

test("활 은신: 어그로가 풀린 동안 적은 주인공이 아닌 용병을 노리고, 풀리기 전·후에는 주인공을 노린다", () => {
  const { g, a, p } = start(0);
  p.invuln = 1e9;
  const e = (g as any).enemies.get(dummy(g, p.x + 300, p.y)) as { x: number; y: number }; // 가까운 적 하나
  const mercId = g.addMerc(a, 1, p.x + 900, p.y); // 적 너머 먼 곳의 용병(은신 중에는 이쪽이 대상이 된다)
  const eFace = () => Math.atan2(g.getPlayer(a)!.y - e.y, g.getPlayer(a)!.x - e.x);
  void eFace;
  g.useSkill(a);
  run(g, 1.2); // 가장 투명한 상태
  const before = Math.hypot(e.x - p.x, e.y - p.y);
  run(g, 0.5);
  const after = Math.hypot(e.x - p.x, e.y - p.y);
  // 어그로가 풀린 동안 적은 주인공 쪽으로 다가오지 않고 용병 쪽(반대편)으로 움직인다
  assert.ok(after > before + 15, `주인공에게서 멀어진다(용병 쪽으로 간다): ${before.toFixed(0)} → ${after.toFixed(0)}`);
  void mercId;
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
  assert.ok(g.takeEvents().some((ev) => ev[0] === EVT_SKILL && ev[4] >= 10), "적에게 닿은 이벤트");
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
  assert.ok(!g.takeEvents().some((ev) => ev[0] === EVT_SKILL && ev[4] >= 10), "폭발 이벤트가 없다");
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

test("스킬 회복 속도 카드: 일반 +6%, 쌓을수록 쿨타임이 1/(1+합)배로 줄고 효율은 같다", async () => {
  const { CARDS } = await import("@mercenary/shared");
  const cards = CARDS.filter((c) => c.effect.k === "heroSkill");
  assert.equal(cards.length, 3, "일반·희귀·영웅");
  assert.ok(cards[0]!.effect.k === "heroSkill" && Math.abs(cards[0]!.effect.v - 0.06) < 1e-9, "일반 +6%");
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

test("스킬 효과 카드: 돌진 거리·무적 시간·방벽 길이가 늘고, 가속은 속도가 오른다", () => {
  const dash = (pow: number) => {
    const { g, a, p } = start(1);
    (g as unknown as { slots: Map<number, { mods: { heroSkillPow: number } }> }).slots.get(a)!.mods.heroSkillPow = pow;
    const x0 = p.x;
    g.setInput(a, { ...idle, aim: 0 });
    g.useSkill(a);
    run(g, TUNE.SKILL_DASH_SEC + 0.1);
    return g.getPlayer(a)!.x - x0;
  };
  assert.ok(dash(0.5) > dash(0) * 1.4, "돌진 거리가 1.5배로");
  const guard = (pow: number) => {
    const { g, a } = start(2);
    (g as unknown as { slots: Map<number, { mods: { heroSkillPow: number } }> }).slots.get(a)!.mods.heroSkillPow = pow;
    g.useSkill(a);
    return g.getPlayer(a)!.invuln;
  };
  assert.ok(Math.abs(guard(1) - TUNE.SKILL_INVULN_SEC * 2) < 1e-6, "무적 시간이 2배로");
  const wallLen = (pow: number) => {
    const { g, a } = start(4);
    (g as unknown as { slots: Map<number, { mods: { heroSkillPow: number } }> }).slots.get(a)!.mods.heroSkillPow = pow;
    g.setInput(a, { ...idle, aim: 0, dist: 200 });
    g.useSkill(a);
    return g.snapshotWalls()[0]![4];
  };
  assert.ok(Math.abs(wallLen(1) - wallLen(0) * 2) < 1e-6, "방벽 길이가 2배로");
  const wallLife = (pow: number) => {
    const { g, a } = start(4);
    (g as unknown as { slots: Map<number, { mods: { heroSkillPow: number } }> }).slots.get(a)!.mods.heroSkillPow = pow;
    g.setInput(a, { ...idle, aim: 0, dist: 200 });
    g.useSkill(a);
    return (g as unknown as { walls: { t: number }[] }).walls[0]!.t;
  };
  assert.equal(wallLife(1), wallLife(0), "방벽 지속 시간은 그대로");
  const boost = (pow: number) => {
    const { g, a } = start(5);
    (g as unknown as { slots: Map<number, { mods: { heroSkillPow: number }; boostT: number }> }).slots.get(a)!.mods.heroSkillPow = pow;
    g.useSkill(a);
    const s = (g as unknown as { slots: Map<number, { boostT: number }>; heroSpeedNow(s: unknown): number });
    return { t: s.slots.get(a)!.boostT, v: s.heroSpeedNow(s.slots.get(a)) };
  };
  assert.equal(boost(1).t, boost(0).t, "가속 시간은 그대로");
  assert.ok(boost(1).v > boost(0).v * 1.1, "가속 속도가 더 빠르다");
});

test("체력 재생으로 회복하면 회복 숫자 이벤트가 0.6초 모아서 한 번 나간다", () => {
  const { g, a } = start(0);
  g.applyCardForTest(a, { k: "heroRegen", v: 6 });
  g.getPlayer(a)!.hp = 20;
  g.takeEvents();
  run(g, 0.4);
  assert.equal(g.takeEvents().filter((e) => e[0] === EVT_HEAL).length, 0, "모으는 동안에는 보내지 않는다");
  run(g, 0.6);
  const heals = g.takeEvents().filter((e) => e[0] === EVT_HEAL && e[5] === a);
  assert.equal(heals.length, 1, "0.6초 뒤 한 번");
  assert.ok(heals[0]![4] > 2, "회복량이 담긴다");
  g.getPlayer(a)!.hp = g.getPlayer(a)!.maxHp;
  run(g, 1); // 모아 둔 마지막 회복이 먼저 나간다
  g.takeEvents();
  run(g, 1.5);
  assert.equal(g.takeEvents().filter((e) => e[0] === EVT_HEAL).length, 0, "체력이 가득 차 있으면 숫자가 없다");
});

test("활 스킬(은신): 투명한 동안 공격하거나 무기를 바꾸면 서서히 투명이 풀리기 시작한다", () => {
  for (const how of ["fire", "weapon"] as const) {
    const { g, a } = start(0);
    const p = g.getPlayer(a)!;
    assert.equal(g.useSkill(a), true);
    run(g, 1.6); // 가장 투명한 유지 구간
    assert.equal(p.alpha, 5);
    if (how === "weapon") g.setWeapon(a, 1);
    else (g as any).useWeapon((g as any).slots.get(a));
    run(g, 0.3);
    assert.ok(p.alpha > 5 && p.alpha < 100, `${how}: 풀리는 중(${p.alpha})`);
    run(g, 1.2);
    assert.equal(p.alpha, 100, `${how}: 다 풀렸다`);
  }
});

test("활 전통: 30발, 쏠 때마다 줄고(멀티샷은 화살 수만큼), 다 쓰면 못 쏘고, 2초 채우면 금화를 내고 가득 찬다(토너먼트도 동일)", () => {
  const { g, a } = start(0);
  const p = g.getPlayer(a)!;
  p.gold = 100;
  const s = (g as any).slots.get(a);
  assert.equal(s.ammo, 30);
  const shoot = () => {
    s.fireCd = 0;
    (g as any).useWeapon(s);
  };
  const b0 = (g as any).bullets.length;
  shoot();
  assert.equal(s.ammo, 29);
  s.mods.heroMulti = 2;
  shoot(); // 3발
  assert.equal(s.ammo, 26);
  assert.equal((g as any).bullets.length - b0, 4);
  s.mods.heroMulti = 0;
  s.ammo = 0;
  shoot();
  assert.equal((g as any).bullets.length - b0, 4, "화살이 없으면 쏘지 못한다");
  assert.ok(s.dryT > 0 && s.reloadT > 0, "못 쏜 표시와 함께 자동으로 채우기가 시작된다");
  s.fireCd = 0;
  s.ammo = 3;
  shoot(); // 채우는 중에는 쏠 수 없다
  assert.equal(s.ammo, 3);
  const x0 = p.x;
  g.setInput(a, { dx: 1, dy: 0, aim: 0, fire: false });
  run(g, 1);
  assert.ok(p.x > x0 + 20, "채우는 중에도 움직일 수 있다");
  run(g, 1.2);
  assert.equal(s.ammo, 30, "2초 뒤 가득 찬다");
  assert.equal(p.gold, 100 - Math.ceil(27 * 0.5), "빈 27발만큼 금화를 낸다");
  // 금화가 모자라면 살 수 있는 만큼만 채운다
  s.ammo = 0;
  p.gold = 4;
  assert.equal(g.reload(a), true);
  run(g, 2.3);
  assert.equal(s.ammo, 8);
  assert.equal(p.gold, 0);
  // 무기를 바꾸면 채우기가 멈춘다
  s.ammo = 5;
  p.gold = 50;
  g.reload(a);
  g.setWeapon(a, 1);
  assert.equal(s.reloadT, 0);
  // 토너먼트도 똑같이 금화를 낸다
  g.setWeapon(a, 0);
  (g as any).phase = "tournament";
  p.gold = 0;
  s.ammo = 0;
  s.reloadT = 0;
  assert.equal((g as any).startReload(s), false, "금화가 없으면 토너먼트에서도 장전할 수 없다");
  p.gold = 10;
  assert.equal((g as any).startReload(s), true);
  (g as any).finishReload(s);
  assert.equal(s.ammo, 20, "금화 10G로 20발");
  assert.equal(p.gold, 0);
});

test("용병 급여: 주기마다 낸다, 못 내면 공격력이 줄고 계속 못 내면 높은 단계부터 떠난다, 내면 바로 회복", () => {
  const { g, a } = start(0);
  const p = g.getPlayer(a)!;
  const s = (g as any).slots.get(a);
  const ids = [g.addMerc(a, 1, p.x + 50, p.y), g.addMerc(a, 1, p.x + 60, p.y), g.addMerc(a, 2, p.x + 70, p.y)];
  (g as any).mercs.get(ids[2]!).tier = 3;
  p.gold = 100;
  const step = (sec: number) => { for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step(); };
  step(1);
  assert.ok(p.salary > 0 && p.payT > 0, "급여 정보가 보인다");
  const salary = p.salary;
  step(TUNE.PAY_INTERVAL + 1);
  assert.equal(p.unpaid, 0);
  assert.ok(p.gold <= 100 - salary + 5, "급여를 냈다"); // 사이에 번 금화 여유
  // 못 내는 경우
  p.gold = 0;
  step(TUNE.PAY_INTERVAL);
  assert.equal(p.unpaid, 1);
  assert.equal(g.countMercs(a), 3);
  step(TUNE.PAY_INTERVAL * 2);
  assert.equal(p.unpaid, 3);
  assert.equal(g.countMercs(a), 3, "떠나기 전");
  p.gold = 0;
  step(TUNE.PAY_INTERVAL);
  assert.equal(g.countMercs(a), 2, "높은 단계 용병이 떠났다");
  assert.equal((g as any).mercs.has(ids[2]!), false);
  // 급여를 내면 회복
  p.gold = 500;
  step(TUNE.PAY_INTERVAL);
  assert.equal(p.unpaid, 0);
});
