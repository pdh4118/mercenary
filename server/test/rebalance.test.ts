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
  run(g, 2);
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
  assert.ok(LEGENDS.bloodthirst.desc.includes("4%"));
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
const hpOf = (g: Game, id: number, hp = 99999) => {
  const e = g.getEnemy(id) as { hp: number; maxHp: number; cd: number };
  e.hp = e.maxHp = hp;
  e.cd = 99; // 가만히 서 있게(시험용)
};

test("검방병은 취약한 아군(궁병) 앞에 서서 다가오는 적을 막는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const archer = g.addMerc(a, ARCHER, p.x - 40, p.y);
  const shield = g.addMerc(a, SHIELD, p.x - 60, p.y + 30);
  const foe = g.spawnEnemyAt(p.x + 160, p.y, BLUNT);
  hpOf(g, foe);
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
  hpOf(g, cav);
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
