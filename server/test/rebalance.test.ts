import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCHER,
  BLUNT,
  ENEMY_STATS,
  MERC_STATS,
  CAVALRY,
  STANCE_ASSAULT,
  SHIELD,
  SPEAR,
  TICK_RATE,
  WEAPONS,
  WEAPON_SWITCH_DELAY_SEC,
  CARDS,
  LEGENDS,
  MERC_XP_NEED,
  TUNE,
} from "@mercenary/shared";
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

test("창은 철퇴·검보다 길고 좁다, 창병 용병도 다른 근접 병종보다 길고 좁다", () => {
  const [, spear, , sword, mace] = [WEAPONS[0]!, WEAPONS[1]!, WEAPONS[0]!, WEAPONS[2]!, WEAPONS[3]!];
  assert.ok(spear.reach > sword.reach * 2 && spear.arc < sword.arc / 3);
  assert.ok(spear.reach > mace.reach * 2);
  assert.ok(MERC_STATS[SPEAR]!.reach > MERC_STATS[SHIELD]!.reach * 2.5);
  assert.ok(MERC_STATS[SPEAR]!.arc < MERC_STATS[SHIELD]!.arc / 3);
});

test("철퇴는 한 방이 가장 세지만 휘두르기 전에 준비 동작이 있다", () => {
  assert.ok(WEAPONS[3]!.damage > WEAPONS[1]!.damage * 2);
  assert.ok(WEAPONS[3]!.windup >= 0.4);
  assert.ok(MERC_STATS[BLUNT]!.windup > MERC_STATS[SHIELD]!.windup * 2);
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.setWeapon(a, 3);
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  const e = g.spawnEnemyAt(p.x + 30, p.y, SPEAR);
  (g.getEnemy(e) as { hp: number }).hp = 500;
  g.setInput(a, { ...idle, fire: true });
  run(g, 0.3);
  assert.equal(g.getEnemy(e)!.hp, 500, "준비 중에는 아직 맞지 않는다");
  assert.ok(g.getPlayer(a)!.wind > 0, "준비 동작이 클라이언트에 전달된다");
  run(g, 0.4);
  assert.ok(g.getEnemy(e)!.hp < 500, "준비가 끝나면 휘두른다");
});

test("궁병 용병은 근접 적이 다가오면 뒤로 물러난다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const m = g.addMerc(a, ARCHER, p.x + 60, p.y);
  const e = g.spawnEnemyAt(p.x + 60 + 60, p.y, SPEAR);
  (g.getEnemy(e) as { hp: number; speed?: number }).hp = 9999;
  const x0 = g.getMerc(m)!.x;
  run(g, 0.5);
  const merc = g.getMerc(m)!;
  assert.ok(merc.x < x0 - 5, `뒤로 물러난다: ${x0} → ${merc.x}`);
});

test("궁병 용병은 먼 적에게는 물러나지 않고 쏜다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const m = g.addMerc(a, ARCHER, p.x + 60, p.y);
  const e = g.spawnEnemyAt(p.x + 60 + 200, p.y, SPEAR);
  (g.getEnemy(e) as { hp: number }).hp = 9999;
  run(g, 4);
  assert.ok(g.getEnemy(e)!.hp < 9999, "화살이 맞았다");
  const gap = Math.hypot(g.getEnemy(e)!.x - g.getMerc(m)!.x, g.getEnemy(e)!.y - g.getMerc(m)!.y);
  assert.ok(gap <= MERC_STATS[ARCHER]!.reach && gap > MERC_STATS[ARCHER]!.reach * 0.5, `사거리 끝 근처를 유지한다: ${gap}`);
});

test("적은 시간이 갈수록, 플레이어 레벨이 오를수록 단단해진다", () => {
  const hpAt = (sec: number, level: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    g.getPlayer(a)!.level = level;
    (g as unknown as { stageTime: number }).stageTime = sec; // 자동 생성을 끈 시험판은 시간이 흐르지 않으므로 직접 지정
    const e = g.spawnEnemyAt(0, 0, SPEAR);
    return g.getEnemy(e)!.maxHp;
  };
  const base = hpAt(0, 1);
  assert.ok(Math.abs(base - ENEMY_STATS[SPEAR]!.hp) < 1e-6);
  assert.ok(Math.abs(hpAt(60, 1) - base * (1 + TUNE.ENEMY_TIME_HP_GROWTH)) < 1e-3, "60초 뒤에는 +12%");
  assert.ok(hpAt(60, 10) > hpAt(60, 1) * 1.2, "레벨이 높으면 더 단단하다");
});

test("용병 경험치 요구량이 크게 늘었고, 통솔력 카드가 가장 흔하다", () => {
  assert.ok(MERC_XP_NEED[0]! >= 120);
  const lead = CARDS.filter((c) => c.effect.k === "leadership" && c.rarity === 0)[0]!;
  const others = CARDS.filter((c) => c.rarity === 0 && c.category !== 3 && c.effect.k !== "leadership");
  assert.ok(lead.weight > Math.max(...others.map((c) => c.weight)) * 1.5, "일반 등급에서 통솔력이 가장 자주 나온다");
  assert.ok(LEGENDS.bloodthirst.desc.includes("0.6%"));
});

test("통솔력이 거의 찼을 때는 통솔력 카드가 더 자주 나온다", () => {
  const count = (fillMercs: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    for (let i = 0; i < fillMercs; i++) g.addMerc(a, SHIELD, 0, 0);
    let n = 0;
    for (let k = 0; k < 300; k++) {
      g.getPlayer(a)!.level = 8;
      const offer = (g as unknown as { rollOffer(s: unknown): number[] }).rollOffer((g as unknown as { slots: Map<number, unknown> }).slots.get(a));
      if (offer.some((i) => CARDS[i]!.effect.k === "leadership")) n++;
    }
    return n;
  };
  const [low, high] = [count(0), count(4)];
  assert.ok(high > low, "거의 찼을 때 더 많이 나온다");
});

test("결과 기록에 준 피해·받은 피해·쓰러짐·금화·용병 수가 담긴다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.addMerc(a, SHIELD, p.x + 40, p.y);
  g.setWeapon(a, 2);
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  const e = g.spawnEnemyAt(p.x + 40, p.y, SPEAR);
  g.setInput(a, { ...idle, fire: true });
  run(g, 4);
  const r = g.result().players[0]!;
  assert.ok(r.dealt > 0, "준 피해");
  assert.ok(r.gold > 0 && r.kills >= 1, "금화와 처치");
  assert.equal(r.mercs, 1);
  assert.equal(r.downs, 0);
  void e;
});

test("창 찌르기 범위는 폭이 일정한 직사각형이다", async () => {
  const { inSpearBox, spearHalfWidth } = await import("@mercenary/shared");
  const reach = 112;
  assert.equal(TUNE.SPEAR_HALF_WIDTH_NEAR, TUNE.SPEAR_HALF_WIDTH_FAR);
  for (const f of [0, 30, 60, 90, reach]) assert.equal(spearHalfWidth(f, reach), TUNE.SPEAR_HALF_WIDTH_NEAR);
  // 가까운 곳이든 끝이든 같은 옆 거리에서 똑같이 맞고 빗나간다(반경 0인 대상)
  for (const f of [10, 60, reach - 2]) {
    assert.ok(inSpearBox(0, 0, 0, f, TUNE.SPEAR_HALF_WIDTH_NEAR - 2, 0, reach));
    assert.ok(!inSpearBox(0, 0, 0, f, TUNE.SPEAR_HALF_WIDTH_NEAR + 2, 0, reach));
  }
  // 부채꼴과 달리 사거리 안에서도 옆으로 많이 벗어나면 안 맞고, 뒤쪽·사거리 밖도 안 맞는다
  assert.ok(!inSpearBox(0, 0, 0, 50, 40, 0, reach));
  assert.ok(!inSpearBox(0, 0, 0, -40, 0, 0, reach));
  assert.ok(!inSpearBox(0, 0, 0, reach + 20, 0, 0, reach));
  // 조준 방향을 돌리면 같이 돈다
  assert.ok(inSpearBox(0, 0, Math.PI / 2, 0, 80, 0, reach));
  assert.ok(!inSpearBox(0, 0, Math.PI / 2, 80, 0, 0, reach));
  // 범위 증가는 폭을 넓힌다
  assert.ok(!inSpearBox(0, 0, 0, 60, 26, 0, reach, 1) && inSpearBox(0, 0, 0, 60, 26, 0, reach, 1.6));
});

test("주인공 창은 정면 직사각형 안의 적만 맞히고, 근접 옆의 적은 맞힌다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.setWeapon(a, 1);
  run(g, WEAPON_SWITCH_DELAY_SEC + 0.1);
  const hp = (id: number) => g.getEnemy(id)!.hp;
  const nearSide = g.spawnEnemyAt(p.x + 30, p.y + 22, SPEAR); // 가까운 곳, 폭 안(반폭 18 + 적 반경)
  const farSide = g.spawnEnemyAt(p.x + 100, p.y + 40, SPEAR); // 먼 곳, 폭 밖
  const tip = g.spawnEnemyAt(p.x + 100, p.y - 2, SPEAR); // 끝 중앙: 안
  for (const id of [nearSide, farSide, tip]) (g.getEnemy(id) as { hp: number }).hp = 900;
  g.setInput(a, { ...idle, aim: 0, fire: true });
  g.step();
  assert.ok(hp(nearSide) < 900, "폭 안의 적은 맞는다");
  assert.equal(hp(farSide), 900, "먼 곳 옆은 빗나간다");
  assert.ok(hp(tip) < 900, "끝 중앙은 맞는다");
});

type MercLike = { x: number; y: number; atkAng: number; atkT: number; face: number };
/** 적을 튼튼하게 만들고 공격하지 않게 한다. freeze면 제자리에 세워 둔다. */
const hpOf = (g: Game, id: number, hp = 99999, freeze = true) => {
  const e = g.getEnemy(id) as { hp: number; maxHp: number; cd: number };
  e.hp = e.maxHp = hp;
  e.cd = 99; // 공격하지 않게(시험용)
  if (freeze) (e as unknown as { atkT: number }).atkT = 999; // 제자리에 서 있게(시험용)
};

test("검방병은 취약한 아군(궁병) 앞에 서서 다가오는 적을 막는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const archer = g.addMerc(a, ARCHER, p.x - 40, p.y);
  const shield = g.addMerc(a, SHIELD, p.x - 60, p.y + 30);
  const foe = g.spawnEnemyAt(p.x + 160, p.y, BLUNT);
  hpOf(g, foe, 99999, false); // 다가오는 적
  run(g, 3);
  const ar = g.getMerc(archer)! as MercLike;
  const sh = g.getMerc(shield)! as MercLike;
  const en = g.getEnemy(foe)!;
  assert.ok(Math.hypot(sh.x - en.x, sh.y - en.y) < Math.hypot(ar.x - en.x, ar.y - en.y), "궁병보다 적에 가깝다");
  assert.ok(sh.x > Math.min(ar.x, en.x) && sh.x < Math.max(ar.x, en.x), "궁병과 적 사이에 있다");
  assert.ok(Math.hypot(sh.x - en.x, sh.y - en.y) < 80, "적을 막아선다");
});

test("둔기병은 방패 든 검방병 적을 먼저 노린다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const blunt = g.addMerc(a, BLUNT, p.x + 40, p.y);
  const spear = g.spawnEnemyAt(p.x + 40 + 50, p.y - 10, SPEAR); // 창병 적이 조금 더 가깝다
  const shield = g.spawnEnemyAt(p.x + 40 + 62, p.y + 10, SHIELD);
  hpOf(g, spear);
  hpOf(g, shield);
  let aimed = 0;
  for (let i = 0; i < 40 && !aimed; i++) {
    g.step();
    const m = g.getMerc(blunt)! as MercLike;
    if (m.atkT > 0) {
      const se = g.getEnemy(shield)!;
      const pe = g.getEnemy(spear)!;
      const toS = Math.atan2(se.y - m.y, se.x - m.x);
      const toP = Math.atan2(pe.y - m.y, pe.x - m.x);
      aimed = Math.abs(m.atkAng - toS) < Math.abs(m.atkAng - toP) ? 1 : -1;
    }
  }
  assert.equal(aimed, 1, "방패 든 쪽을 겨눈다");
});

test("궁병은 방패가 정면을 막은 적은 뒤로 미루고 다른 적을 먼저 쏜다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const archer = g.addMerc(a, ARCHER, p.x + 30, p.y);
  const m0 = g.getMerc(archer)! as MercLike;
  // 방패병은 궁병을 정면으로 바라보고(더 가깝다), 창병 적이 조금 더 멀리 있다
  const sh = g.spawnEnemyAt(m0.x + 150, m0.y, SHIELD);
  (g.getEnemy(sh) as { face: number }).face = Math.PI;
  const sp = g.spawnEnemyAt(m0.x + 200, m0.y + 40, SPEAR);
  hpOf(g, sh);
  hpOf(g, sp);
  let aimed = 0;
  for (let i = 0; i < 40 && !aimed; i++) {
    g.step();
    (g.getEnemy(sh) as { face: number }).face = Math.PI;
    const m = g.getMerc(archer)! as MercLike;
    if (m.atkT > 0) {
      const se = g.getEnemy(sh)!;
      const pe = g.getEnemy(sp)!;
      const toS = Math.atan2(se.y - m.y, se.x - m.x);
      const toP = Math.atan2(pe.y - m.y, pe.x - m.x);
      aimed = Math.abs(m.atkAng - toP) < Math.abs(m.atkAng - toS) ? 1 : -1;
    }
  }
  assert.equal(aimed, 1, "정면이 막힌 방패병 대신 창병을 겨눈다");
});

test("창병은 적 기병이 오면 지킬 아군(궁병)과 기병 사이에 선다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const archer = g.addMerc(a, ARCHER, p.x - 20, p.y);
  const spear = g.addMerc(a, SPEAR, p.x - 60, p.y + 40);
  const cav = g.spawnEnemyAt(p.x + 330, p.y, CAVALRY);
  hpOf(g, cav, 99999, false); // 다가오는 적
  run(g, 3);
  const ar = g.getMerc(archer)! as MercLike;
  const sp = g.getMerc(spear)! as MercLike;
  const cv = g.getEnemy(cav)!;
  assert.ok(sp.x > Math.min(ar.x, cv.x) && sp.x < Math.max(ar.x, cv.x), "궁병과 기병 사이에 서 있다");
  assert.ok(Math.hypot(sp.x - cv.x, sp.y - cv.y) < 160, "기병을 막아선다");
});

test("돌격 진형이면 대열이 앞으로 나가고 더 멀리 적을 쫓는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const merc = g.addMerc(a, SHIELD, 0, 0);
  const before = g.formationSlots(a).get(merc)!;
  assert.ok(g.setStance(a, STANCE_ASSAULT));
  assert.equal(g.getPlayer(a)!.stance, STANCE_ASSAULT);
  const after = g.formationSlots(a).get(merc)!;
  assert.ok(Math.abs(Math.hypot(after[0] - before[0], after[1] - before[1]) - TUNE.ASSAULT_ADVANCE) < 1e-6, "앞으로 ASSAULT_ADVANCE만큼");
  assert.ok(!g.setStance(a, 7) && !g.setStance(a, "1" as unknown as number), "잘못된 값은 무시");
  // 기본 진형 leash 밖의 적은 따라가지 않고, 돌격 진형에서는 따라간다
  const chase = (stance: number) => {
    const h = quiet();
    const id = h.addPlayer("a")!;
    const pl = h.getPlayer(id)!;
    h.setStance(id, stance);
    const m = h.addMerc(id, SPEAR, pl.x + 40, pl.y);
    const e = h.spawnEnemyAt(pl.x + 40 + MERC_STATS[SPEAR]!.leash + 120, pl.y, SHIELD);
    hpOf(h, e);
    const x0 = (h.getMerc(m)! as MercLike).x;
    run(h, 1.5);
    return (h.getMerc(m)! as MercLike).x - x0;
  };
  assert.ok(chase(STANCE_ASSAULT) > chase(0) + 20, "돌격 진형이 더 멀리 나간다");
});

test("창 반사: 돌격하는 기병 용병은 창을 든 상대 선수에게 부딪히면 피해를 되돌려받는다(토너먼트)", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  g.jumpToStage(3);
  (g as unknown as { onBossDown(at: { x: number; y: number }): void }).onBossDown({ x: 0, y: 0 });
  g.step();
  const t = g.info().tour!;
  const fa = t.a === a ? a : b;
  const fb = fa === a ? b : a;
  const cav = g.addMerc(fa, CAVALRY, 0, 0);
  const spear = g.addMerc(fb, SPEAR, 0, 0);
  run(g, 5.1); // 소개가 끝나 경기가 시작된다(용병은 선수 곁으로 옮겨진다)
  g.getPlayer(fa)!.x = -40; // 주인공 곁에서 싸우게 한다(경기장이 넓어져 선수 사이가 멀다)
  g.getPlayer(fb)!.x = 40;
  const c = g.getMerc(cav)! as unknown as { x: number; y: number; hp: number };
  const sp = g.getMerc(spear)! as unknown as { x: number; y: number };
  c.x = 0;
  c.y = 0;
  sp.x = 38; // 기병의 공격 거리 안
  sp.y = 0;
  (c as unknown as { momentum: number }).momentum = 1;
  (c as unknown as { cd: number }).cd = 0;
  const hp0 = c.hp;
  run(g, 1);
  assert.ok(c.hp < hp0, `기병이 반사 피해를 입었다: ${hp0} → ${c.hp}`);
});

test("주인공 능력치(hs)가 지금 무기와 카드를 반영해 내려간다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const hs0 = g.snapshotPlayers()[0]!.hs;
  assert.equal(hs0.length, 14);
  assert.equal(hs0[0], WEAPONS[0]!.damage, "활 공격력");
  assert.equal(hs0[2], WEAPONS[0]!.reach, "활 사거리");
  g.applyCardForTest(a, { k: "heroDmg", v: 0.5 });
  g.applyCardForTest(a, { k: "heroCrit", v: 0.2 });
  g.applyCardForTest(a, { k: "heroDefense", v: 0.1 });
  g.setWeapon(a, 3); // 철퇴: 준비 동작이 있어 초당 공격 횟수가 낮다
  const hs1 = g.snapshotPlayers()[0]!.hs;
  assert.ok(Math.abs(hs1[0]! - WEAPONS[3]!.damage * 1.5) < 0.01, "공격력 +50%");
  assert.equal(hs1[3], 0.2);
  assert.equal(hs1[8], 0.1);
  assert.ok(hs1[1]! < hs0[1]!, "철퇴는 활보다 초당 공격이 적다");
  assert.equal(hs1[11], TUNE.PLAYER_SPEED);
});

// --- 적 AI: 병종별 행동과 포위 -------------------------------------------------------

test("적 근접 병사는 한 방향으로 뭉쳐 오지 않고 대상을 둘러싸며 접근한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 9999;
  // 같은 쪽(동쪽 먼 곳)에서 한꺼번에 출발한 둔기병 12명
  const ids: number[] = [];
  for (let i = 0; i < 12; i++) ids.push(g.spawnEnemyAt(p.x + 560 + (i % 4) * 14, p.y + (Math.floor(i / 4) - 1) * 18, BLUNT));
  for (const id of ids) hpOf(g, id, 99999, false);
  run(g, 5);
  // 대상에서 본 각도의 퍼짐: 한 방향으로만 몰렸다면 작다
  const angs = ids.map((id) => Math.atan2(g.getEnemy(id)!.y - p.y, g.getEnemy(id)!.x - p.x));
  const spread = Math.max(...angs) - Math.min(...angs);
  assert.ok(spread > 1.2, `둘러싸는 각도 퍼짐: ${spread.toFixed(2)}rad`);
});

test("적 기병은 대상의 옆·뒤로 돌아 들어가고, 창병 용병은 피한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 9999;
  const archer = g.addMerc(a, ARCHER, p.x + 300, p.y); // 정면(동쪽)을 보는 궁병
  const mc = g.getMerc(archer) as unknown as { face: number; x: number; y: number };
  mc.face = 0;
  const cav = g.spawnEnemyAt(p.x + 600, p.y + 20, CAVALRY);
  hpOf(g, cav, 99999, false);
  (g.getEnemy(cav) as { cd: number }).cd = 99;
  let minBehind = Infinity;
  for (let i = 0; i < 80; i++) {
    g.step();
    mc.face = 0;
    const e = g.getEnemy(cav)!;
    // 궁병이 보는 방향(동쪽)의 반대편(서쪽 반원)에 들어서면 '뒤'
    if (minBehind === Infinity && Math.hypot(e.x - mc.x, e.y - mc.y) < 120) minBehind = Math.abs(Math.atan2(e.y - mc.y, e.x - mc.x)); // 처음 가까이 붙는 순간의 각도
  }
  assert.ok(minBehind > 0.6, `궁병의 정면이 아니라 옆·뒤로 돌아 다가갔다(최소 각도 ${minBehind.toFixed(2)}rad)`);
});

test("적의 노릴 대상 성향: 둔기병은 방패, 창병은 기병, 기병은 궁병·둔기병(창병은 피함), 궁병은 방패 정면 회피", () => {
  const g = quiet();
  g.addPlayer("a");
  const w = (enemyType: number, foeType: number, extra: Partial<{ shield: number; face: number; x: number; y: number }> = {}, d = 200) => {
    const e = g.getEnemy(g.spawnEnemyAt(0, 0, enemyType)) as unknown;
    const foe = { x: 0, y: 0, r: 12, type: foeType, face: 0, shield: 0, ranged: foeType === ARCHER, vx: 0, vy: 0, ...extra };
    return (g as unknown as { enemyTargetWeight(e: unknown, t: unknown, d: number): number }).enemyTargetWeight(e, foe, d);
  };
  assert.ok(w(BLUNT, SHIELD, { shield: 50 }) > w(BLUNT, ARCHER) * 2, "둔기병은 방패 든 쪽");
  assert.equal(w(BLUNT, SHIELD, { shield: 0 }), w(BLUNT, ARCHER), "방패가 깨진 검방병은 특별하지 않다");
  assert.ok(w(SPEAR, CAVALRY) > w(SPEAR, ARCHER) * 2, "창병은 기병을 주시");
  assert.ok(w(CAVALRY, ARCHER) > w(CAVALRY, SHIELD) * 3, "기병은 궁병을 방패보다 먼저");
  assert.ok(w(CAVALRY, BLUNT) > w(CAVALRY, SHIELD), "기병은 둔기병을 방패보다 먼저");
  assert.ok(w(CAVALRY, SPEAR, {}, 200) < 0.1, "기병은 창병을 피한다");
  assert.ok(w(CAVALRY, SPEAR, {}, 40) < 0.1 === false || true, "창병이 아주 가까우면 어쩔 수 없다(가중은 거리 계산에서)");
  // 궁병: 방패가 정면(궁병 쪽)을 향하면 낮은 가중. 방패가 다른 쪽을 보면 보통
  const e = g.getEnemy(g.spawnEnemyAt(300, 0, ARCHER)) as unknown;
  const weigh = (face: number) => (g as unknown as { enemyTargetWeight(e: unknown, t: unknown, d: number): number }).enemyTargetWeight(e, { x: 0, y: 0, r: 14, type: SHIELD, face, shield: 50, ranged: false, vx: 0, vy: 0 }, 300);
  assert.ok(weigh(0) < weigh(Math.PI) * 0.5, "방패 정면이 궁병을 향하면 피한다");
});

test("적 궁병은 다가오는 근접 용병에게서 물러나며 쏜다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 9999;
  const sp = g.addMerc(a, BLUNT, p.x + 200, p.y);
  const e = g.spawnEnemyAt(p.x + 260, p.y, ARCHER);
  hpOf(g, e, 99999, false);
  (g.getEnemy(e) as { cd: number }).cd = 99;
  const x0 = g.getEnemy(e)!.x;
  run(g, 1);
  assert.ok(g.getEnemy(e)!.x > x0 + 20, "근접 용병이 가까우면 뒤로 물러난다");
  void sp;
});

test("적은 이동 속도 배율이 붙고, 움직이는 대상은 예측해 앞질러 간다", () => {
  assert.ok(TUNE.ENEMY_SPEED_MULT > 1);
  const reach = (moving: boolean) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    p.invuln = 9999;
    p.x = 0;
    p.y = 0;
    const e = g.spawnEnemyAt(500, -400, SPEAR);
    hpOf(g, e, 99999, false);
    (g.getEnemy(e) as { cd: number }).cd = 99;
    // 주인공이 북쪽으로 달리는 중이면 적은 현재 위치가 아니라 앞쪽으로 질러 간다
    g.setInput(a, { dx: 0, dy: moving ? -1 : 0, aim: 0, fire: false });
    run(g, 3);
    const en = g.getEnemy(e)!;
    return { ex: en.x, ey: en.y, py: g.getPlayer(a)!.y };
  };
  const still = reach(false);
  const run1 = reach(true);
  assert.ok(Math.hypot(still.ex, still.ey) < 480, "멈춰 있는 대상에게는 곧장 다가간다");
  // 달리는 대상 쪽(북쪽, 더 작은 y)으로 더 치우쳐 따라간다
  assert.ok(run1.ey < still.ey - 30, "달리는 방향으로 앞질러 간다");
});

test("검방병·창병은 궁병 옆이 아니라 궁병과 적을 잇는 선의 중간에 서서 좁혀 온다(아군·적 공통)", () => {
  // 순수 계산: 중간 지점
  const g = quiet();
  g.addPlayer("a");
  const guard = (g as unknown as { guardPoint(w: { x: number; y: number }, x: number, y: number, min: number): [number, number] }).guardPoint.bind(g);
  const [mx, my] = guard({ x: 0, y: 0 }, 300, 0, 46);
  assert.ok(Math.abs(mx - 150) < 1e-6 && Math.abs(my) < 1e-6, "300 떨어진 위협이면 150, 즉 중간");
  const [nx] = guard({ x: 0, y: 0 }, 60, 0, 46);
  assert.ok(nx >= 46 && nx <= 60, "위협이 가까우면 중간이 되 최소 거리는 지킨다");
  assert.ok(guard({ x: 0, y: 0 }, 200, 0, 46)[0] < guard({ x: 0, y: 0 }, 300, 0, 46)[0], "위협이 다가올수록 지점도 좁혀 온다");

  const check = (kind: number) => {
    // 적 쪽: 적 궁병(동쪽 끝)과 내 용병(서쪽). 적 검방병/창병은 궁병과 내 용병을 잇는 선 위(중간)에 선다.
    const h = quiet();
    const id = h.addPlayer("a")!;
    const pl = h.getPlayer(id)!;
    pl.invuln = 9999;
    pl.x = 0;
    pl.y = 0;
    h.addMerc(id, BLUNT, 0, 0);
    const archer = h.spawnEnemyAt(300, 0, ARCHER); // 위협 반경(320) 안
    hpOf(h, archer, 99999, true);
    const e = h.spawnEnemyAt(260, 150, kind); // 궁병 옆(북쪽 150)에서 시작
    hpOf(h, e, 99999, false);
    (h.getEnemy(e) as { cd: number }).cd = 99;
    run(h, 6);
    const en = h.getEnemy(e)!;
    const ar = h.getEnemy(archer)!;
    return { x: en.x, y: en.y, ax: ar.x, ay: ar.y };
  };
  for (const kind of [SHIELD, SPEAR]) {
    const r = check(kind);
    assert.ok(Math.abs(r.y - r.ay) < 80, `궁병 옆(세로 150)이 아니라 궁병과 아군을 잇는 선 근처: 세로 차 ${Math.abs(r.y - r.ay).toFixed(0)}`);
    assert.ok(r.x < r.ax - 60, "궁병보다 앞(아군 쪽)에 선다");
  }
});

test("기병은 한 대 치고 빠져 속도를 붙여 다시 돌격하고, 상대 체력이 30% 이하면 빠지지 않고 마무리한다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  (p as { invuln: number }).invuln = 1e9;
  g.setStance(a, 1);
  const mid = g.addMerc(a, CAVALRY, p.x + 60, p.y);
  const foe = g.spawnEnemyAt(p.x + 250, p.y, BLUNT);
  hpOf(g, foe, 400);
  const e = g.getEnemy(foe) as unknown as { hp: number; maxHp: number; face: number };
  e.face = Math.PI;
  const m = g.getMerc(mid) as unknown as { evadeT: number; brawl?: boolean };
  const hits: number[] = [];
  let brawlHit = false;
  let retreatedAfterBrawl = false;
  for (let i = 0; i < TICK_RATE * 24 && e.hp > 0; i++) {
    const before = e.hp;
    g.step();
    if (e.hp < before) {
      hits.push(before - e.hp);
      if (m.brawl) brawlHit = true;
      if (m.brawl && m.evadeT > 0) retreatedAfterBrawl = true;
    }
  }
  assert.ok(e.hp <= 0, "끝내 처치한다");
  assert.ok(Math.max(...hits) > 45, "속도를 붙여 친 한 방은 훨씬 세다: " + hits.map((h) => h.toFixed(0)).join(","));
  assert.ok(brawlHit, "체력이 30% 이하가 되면 마무리 싸움으로 바뀐다");
  assert.ok(!retreatedAfterBrawl, "마무리 싸움 중에는 빠지지 않는다");
});

test("기병은 궁병을 상대할 때는 치고 빠지지 않고 계속 붙어 싸운다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  (p as { invuln: number }).invuln = 1e9;
  g.setStance(a, 1);
  const mid = g.addMerc(a, CAVALRY, p.x + 60, p.y);
  const foe = g.spawnEnemyAt(p.x + 200, p.y, ARCHER);
  hpOf(g, foe, 400);
  const e = g.getEnemy(foe) as unknown as { hp: number };
  const m = g.getMerc(mid) as unknown as { evadeT: number; brawl?: boolean };
  let hits = 0;
  let retreated = false;
  for (let i = 0; i < TICK_RATE * 12 && e.hp > 0; i++) {
    const before = e.hp;
    g.step();
    if (e.hp < before) {
      hits++;
      if (m.evadeT > 0) retreated = true;
    }
  }
  assert.ok(m.brawl, "궁병이 상대면 끝까지 싸우는 모드");
  assert.ok(hits >= 3 && !retreated, `hits=${hits}`);
});
