/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAVALRY, MERC_STATS, SPACING_BY_TYPE, TICK_RATE, TUNE, parseVoice, parseVoiceMulti, spacingBetween } from "@mercenary/shared";
import { Game } from "../src/game.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};
const quiet = () => {
  const g = new Game();
  g.autoSpawn = false;
  return g;
};
const dummy = (g: Game, x: number, y: number, type: number) => {
  const id = g.spawnEnemyAt(x, y, type);
  const e = (g as any).enemies.get(id);
  e.hp = e.maxHp = 5000;
  return e;
};

test("기병 충돌: 부딪히면 속도를 일부 잃고 잃은 속도만큼 피해를 주며, 같은 대상에게는 잠시 다시 부딪히지 않는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const id = g.addMerc(a, CAVALRY, p.x + 300, p.y);
  const m = (g as any).mercs.get(id);
  const e = dummy(g, m.x + 20, m.y, 3);
  m.momentum = 1;
  const st = MERC_STATS[CAVALRY]!;
  (g as any).cavBump(m, st, null, 10, 0);
  assert.ok(Math.abs(m.momentum - (1 - TUNE.CAV_COLLIDE_LOSS)) < 1e-9, `속도 ${m.momentum}`);
  const hp1 = e.hp;
  const sh1 = e.shield;
  (g as any).cavBump(m, st, null, 10, 0);
  assert.equal(e.hp, hp1, "쿨타임 안에는 다시 피해가 없다");
  assert.equal(e.shield, sh1);
  assert.ok(Math.abs(m.momentum - (1 - TUNE.CAV_COLLIDE_LOSS)) < 1e-9, "속도도 더 잃지 않는다");
});

test("기병 충돌: 방패 없는 대상에게 피해가 들어가고, 속도가 모자라면 아무 일도 없고, 창병도 똑같이 피해를 받는다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const id = g.addMerc(a, CAVALRY, p.x + 300, p.y);
  const m = (g as any).mercs.get(id);
  const st = MERC_STATS[CAVALRY]!;
  const e = dummy(g, m.x + 20, m.y, 0); // 적 기병(방패 없음)
  m.momentum = 0.2;
  (g as any).cavBump(m, st, null, 10, 0);
  assert.equal(e.hp, 5000, "속도가 모자라면 피해 없음");
  m.momentum = 1;
  (g as any).cavBump(m, st, null, 10, 0);
  assert.ok(e.hp < 5000, "피해가 들어갔다");
  assert.ok(5000 - e.hp > 5 && 5000 - e.hp < 60, `피해 ${5000 - e.hp}`);
  // 창병도 똑같이 피해를 받는다(카운터는 창병이 먼저 찔렀을 때만 일어난다)
  const g2 = quiet();
  const a2 = g2.addPlayer("a")!;
  const p2 = g2.getPlayer(a2)!;
  const id2 = g2.addMerc(a2, CAVALRY, p2.x + 300, p2.y);
  const m2 = (g2 as any).mercs.get(id2);
  const sp = dummy(g2, m2.x + 20, m2.y, 1);
  m2.momentum = 1;
  const hp0 = m2.hp;
  (g2 as any).cavBump(m2, st, null, 10, 0);
  assert.ok(sp.hp < 5000, "창병도 충돌 피해를 받는다");
  assert.ok(m2.momentum > 0, "속도를 일부만 잃는다");
  assert.equal(m2.hp, hp0, "되돌려받는 피해는 없다");
});

test("기병 진형 파괴: 적 진형의 옆을 길이 방향으로 지나가며 충돌 피해를 준다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const id = g.addMerc(a, CAVALRY, p.x + 400, p.y + 300);
  const foes = [0, 1, 2, 3, 4, 5].map((k) => dummy(g, p.x + 200 + k * 55, p.y, 0));
  for (const f of foes) f.speed = 0;
  (g as any).enemies.forEach((e: any) => (e.cd = 1e9));
  g.cavOrder(a, "sweep", p.x + 350, p.y);
  const s = (g as any).slots.get(a);
  assert.equal(s.orders[CAVALRY].kind, 2);
  run(g, 8);
  const dealt = foes.reduce((t, f) => t + (5000 - f.hp), 0);
  assert.ok(dealt > 20, `충돌 피해 합 ${dealt}`);
  assert.ok(foes.filter((f) => f.hp < 5000).length >= 2, "여럿에게 피해");
});

test("기병 후방 공격: 진형을 돌아 뒤에서 가로지른다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const id = g.addMerc(a, CAVALRY, p.x + 100, p.y + 40);
  const foes = [0, 1, 2, 3].map((k) => dummy(g, p.x + 400, p.y - 60 + k * 40, 0));
  for (const f of foes) {
    f.face = Math.PI; // 서쪽(내 쪽)을 보고 있다
    f.speed = 0;
  }
  (g as any).enemies.forEach((e: any) => (e.cd = 1e9));
  g.cavOrder(a, "rear", p.x + 400, p.y);
  const m = (g as any).mercs.get(id);
  let maxX = -Infinity;
  for (let i = 0; i < 8 * TICK_RATE; i++) {
    g.step();
    maxX = Math.max(maxX, m.x);
  }
  assert.ok(maxX > p.x + 400 + 80, `진형 뒤(동쪽)까지 갔다 ${maxX - p.x}`);
  const dealt = foes.reduce((t, f) => t + (5000 - f.hp), 0);
  assert.ok(dealt > 0, "후방에서 피해를 줬다");
});

test("음성: 진형파괴·후방 공격은 기병 전술 명령이 되고 이어 말할 수 있다", () => {
  assert.deepEqual(parseVoice("기병 진형파괴")?.kind, "cav");
  assert.equal((parseVoice("진형 파괴해") as any)?.mode, "sweep");
  assert.equal((parseVoice("옆구리로 휩쓸어") as any)?.mode, "sweep");
  assert.equal((parseVoice("후방 공격") as any)?.mode, "rear");
  assert.equal((parseVoice("뒤를 쳐") as any)?.mode, "rear");
  const r = parseVoiceMulti(["궁병 산개하고 진형파괴"])!;
  assert.equal(r.steps.length, 2);
  assert.equal(r.steps[1]!.cmd.kind, "cav");
});

import { SHIELD, SPEAR, BLUNT, TOUR_MERCS } from "@mercenary/shared";

const tourStart = (stage: number) => {
  const g = new Game();
  g.autoSpawn = false;
  const ids = [g.addPlayer("p0")!, g.addPlayer("p1")!];
  g.jumpToStage(stage);
  (g as any).onBossDown({ x: 0, y: 0 });
  run(g, TUNE.TOURNAMENT_NOTICE_SEC + 0.2);
  g.step();
  return g;
};

test("토너먼트(용병전): 기병 진형 파괴·후방 공격이 상대 용병 진형에 충돌 피해를 준다", () => {
  for (const mode of ["sweep", "rear"] as const) {
    const g = tourStart(6);
    const t = g.info().tour!;
    assert.equal(t.mode, TOUR_MERCS);
    const mine = t.a;
    const foe = t.b;
    const cav = g.addMerc(mine, CAVALRY, -300, 0);
    const line = [0, 1, 2, 3, 4, 5].map((k) => g.addMerc(foe, k % 2 ? BLUNT : SHIELD, 150, -140 + k * 56));
    let n = 0;
    while (g.info().tour?.step !== "fight" && n++ < TICK_RATE * 30) g.step();
    assert.equal(g.info().tour?.step, "fight");
    const cm = (g as any).mercs.get(cav);
    cm.x = -300;
    cm.y = 0;
    for (const id of line) {
      const m = (g as any).mercs.get(id);
      m.x = 150;
      m.y = -140 + line.indexOf(id) * 56;
      m.face = Math.PI;
      m.cd = 1e9; // 가만히 서서 맞는다
    }
    g.cavOrder(mine, mode, 150, 0);
    assert.equal((g as any).slots.get(mine).orders[CAVALRY].kind, mode === "sweep" ? 2 : 3);
    const hp0 = line.map((id) => (g as any).mercs.get(id).hp + (g as any).mercs.get(id).shield);
    for (let i = 0; i < 6 * TICK_RATE; i++) {
      line.forEach((id, k) => {
        const m = (g as any).mercs.get(id);
        m.x = 150;
        m.y = -140 + k * 56;
        m.cd = 1e9;
      });
      g.step();
    }
    const lost = line.reduce((tt, id, i) => tt + (hp0[i]! - ((g as any).mercs.get(id).hp + (g as any).mercs.get(id).shield)), 0);
    assert.ok(lost > 10, `${mode}: 상대 진형이 입은 피해 ${lost}`);
  }
});

test("기병: 공격력 카드가 돌격 추가 피해와 충돌 피해에도 곱해진다", () => {
  const make = (atk: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    const id = g.addMerc(a, CAVALRY, p.x + 300, p.y);
    (g as any).slots.get(a).mods.mercDmg = undefined;
    const m = (g as any).mercs.get(id);
    const e = dummy(g, m.x + 20, m.y, 0);
    m.momentum = 1;
    if (atk > 1) (g as any).applyCard((g as any).slots.get(a), { k: "mercStat", stat: "dmg", v: atk - 1, type: CAVALRY });
    (g as any).cavBump(m, (g as any).mercStats(m), null, 10, 0);
    return 5000 - e.hp;
  };
  const base = make(1);
  const strong = make(2);
  assert.ok(Math.abs(strong / base - 2) < 0.05, `공격력 x2 → 충돌 피해 ${base.toFixed(1)} → ${strong.toFixed(1)}`);
});

test("기병: 치명타가 뜨면 돌격 추가 피해와 충돌 피해도 함께 커진다", () => {
  const dealt = (crit: boolean) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    const id = g.addMerc(a, CAVALRY, p.x + 300, p.y);
    const m = (g as any).mercs.get(id);
    const e = dummy(g, m.x + 20, m.y, 0);
    m.momentum = 1;
    (g as any).rollCrit = () => crit;
    (g as any).cavBump(m, (g as any).mercStats(m), null, 10, 0);
    return 5000 - e.hp;
  };
  const plain = dealt(false);
  const crit = dealt(true);
  assert.ok(crit > plain * 1.3, `치명타 충돌 ${plain.toFixed(1)} → ${crit.toFixed(1)}`);
});

test("창 카운터: 쌓아 둔 돌격 피해 x 카운터 배율 x 공격력, 찌른 창병의 단계 보너스가 붙는다", () => {
  const counter = (atk: number, srcTier: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    const id = g.addMerc(a, CAVALRY, p.x + 300, p.y);
    const m = (g as any).mercs.get(id);
    if (atk > 1) (g as any).applyCard((g as any).slots.get(a), { k: "mercStat", stat: "dmg", v: atk - 1, type: CAVALRY });
    (g as any).rollCrit = () => false;
    m.momentum = 1;
    const f = (g as any).collectFriendlies().find((x: any) => x.merc?.id === id);
    const hp0 = m.hp;
    f.hit({ damage: 0, charge: 0, srcType: SPEAR, srcTier, fromAngle: 0 });
    assert.equal(m.momentum, 0, "속도를 모두 잃는다");
    return hp0 - m.hp;
  };
  const base = counter(1, 0);
  assert.ok(Math.abs(base - TUNE.CAV_DAMAGE_PER_SPEED * MERC_STATS[CAVALRY]!.speed * TUNE.CAV_COUNTER_MULT) < 0.01, `기본 카운터 ${base.toFixed(2)}`);
  assert.ok(Math.abs(counter(1, 1) / base - 1.1) < 0.01, "창병 1단계 보너스 +10%");
  assert.ok(Math.abs(counter(2, 0) / base - 2) < 0.05, "공격력이 곱해진다");
});

test("적 기병: 공격 대상을 정할 때 약 20%가 충돌을 택하고, 충돌을 택하면 창으로 찌르지 않고 몸으로 부딪혀 피해를 준다", () => {
  const g = quiet();
  g.addPlayer("a");
  // 공격 대상을 정할 때 약 20%가 충돌을 택한다(첫 틱에 대상을 정한다)
  TUNE.ENEMY_CAV_RAM_FRAC = 0.2;
  const gm = quiet();
  const am = gm.addPlayer("a")!;
  gm.addMerc(am, 3, 600, 0);
  const total = 600;
  const list: any[] = [];
  for (let i = 0; i < total; i++) list.push((gm as any).enemies.get(gm.spawnEnemyAt(900 + (i % 30) * 4, (Math.floor(i / 30) - 10) * 20, CAVALRY)));
  gm.step();
  const rams = list.filter((e) => e.ram).length;
  assert.ok(rams > total * 0.14 && rams < total * 0.26, `충돌을 택한 비율 ${(rams / total).toFixed(2)}`);

  TUNE.ENEMY_CAV_RAM_FRAC = 1; // 이제부터는 충돌을 택하게 한다
  const g2 = quiet();
  const a = g2.addPlayer("a")!;
  const p = g2.getPlayer(a)!;
  p.maxHp = p.hp = 1e9;
  const m = (g2 as any).mercs.get(g2.addMerc(a, 3, p.x + 900, p.y)); // 검방병 용병(제자리에서 맞는다)
  const hp0 = m.hp + m.shield;
  const e = (g2 as any).enemies.get(g2.spawnEnemyAt(m.x + 500, m.y, CAVALRY));
  let stabbed = false;
  let maxMom = 0;
  for (let i = 0; i < 6 * TICK_RATE; i++) {
    m.x = p.x + 900;
    m.y = p.y;
    g2.step();
    p.hp = p.maxHp;
    if (e.atkT > 0) stabbed = true;
    maxMom = Math.max(maxMom, e.momentum);
  }
  assert.ok(!stabbed, "충돌형은 창으로 찌르지 않는다");
  assert.ok(m.hp + m.shield < hp0, `몸으로 부딪혀 피해를 줬다(${(hp0 - m.hp - m.shield).toFixed(1)})`);
  assert.ok(maxMom > 0.5, "속도를 붙여 달렸다");
  TUNE.ENEMY_CAV_RAM_FRAC = 0;
});

test("충돌 감속 카드: 잃는 속도는 곱해서 줄고 충돌 피해는 그대로다(용병 기병)", () => {
  const run1 = (cards: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    const id = g.addMerc(a, CAVALRY, p.x + 300, p.y);
    const m = (g as any).mercs.get(id);
    const e = dummy(g, m.x + 20, m.y, 0);
    (g as any).rollCrit = () => false;
    for (let i = 0; i < cards; i++) (g as any).applyCard((g as any).slots.get(a), { k: "cavKeep", v: 0.5 });
    m.momentum = 1;
    (g as any).cavBump(m, (g as any).mercStats(m), null, 10, 0);
    return { mom: m.momentum, dmg: 5000 - e.hp };
  };
  const none = run1(0);
  const one = run1(1);
  const two = run1(2);
  assert.ok(Math.abs(none.mom - (1 - TUNE.CAV_COLLIDE_LOSS)) < 1e-9);
  assert.ok(Math.abs(one.mom - (1 - TUNE.CAV_COLLIDE_LOSS * 0.5)) < 1e-9, "카드 하나: 손실이 절반");
  assert.ok(Math.abs(two.mom - (1 - TUNE.CAV_COLLIDE_LOSS * 0.25)) < 1e-9, "카드 둘: 곱해서 4분의 1");
  assert.ok(Math.abs(one.dmg - none.dmg) < 1e-9 && Math.abs(two.dmg - none.dmg) < 1e-9, "충돌 피해는 그대로");
});

test("기마 주인공 충돌: 달리다 적과 부딪히면 속도를 잃고 피해를 주며, 충돌 감속 카드로 손실이 줄어도 피해는 그대로다", () => {
  const go = (cards: number) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    g.setWeapon(a, 5); // 기마
    for (let i = 0; i < TICK_RATE; i++) g.step();
    const s = (g as any).slots.get(a);
    (g as any).rollCrit = () => false;
    for (let i = 0; i < cards; i++) (g as any).applyCard(s, { k: "cavKeep", v: 0.5 });
    const e = dummy(g, p.x + 20, p.y, 0);
    s.mom = 1;
    (g as any).heroBump(s, 10, 0);
    return { mom: s.mom, dmg: 5000 - e.hp };
  };
  const a0 = go(0);
  const a1 = go(1);
  assert.ok(a0.dmg > 5, `충돌 피해 ${a0.dmg.toFixed(1)}`);
  assert.ok(Math.abs(a0.mom - (1 - TUNE.CAV_COLLIDE_LOSS)) < 1e-9);
  assert.ok(Math.abs(a1.mom - (1 - TUNE.CAV_COLLIDE_LOSS * 0.5)) < 1e-9);
  assert.ok(Math.abs(a1.dmg - a0.dmg) < 1e-9, "피해는 그대로");
});

test("기마 가속 중 충돌: 속도를 절반만 잃고 곧 다시 붙으며, 피해는 줄지 않는다", () => {
  const go = (boost: boolean) => {
    const g = quiet();
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    g.setWeapon(a, 5);
    for (let i = 0; i < TICK_RATE; i++) g.step();
    const s = (g as any).slots.get(a);
    (g as any).rollCrit = () => false;
    const e = dummy(g, p.x + 20, p.y, 0);
    s.mom = 1;
    s.boostT = boost ? 2 : 0;
    (g as any).heroBump(s, 10, 0);
    const right = s.mom;
    if (boost) {
      for (let i = 0; i < TICK_RATE / 2; i++) g.step();
    }
    return { right, later: s.mom, dmg: 5000 - e.hp };
  };
  const plain = go(false);
  const boosted = go(true);
  assert.ok(Math.abs(plain.right - (1 - TUNE.CAV_COLLIDE_LOSS)) < 1e-9);
  assert.ok(Math.abs(boosted.right - (1 - TUNE.CAV_COLLIDE_LOSS * TUNE.CAV_BOOST_LOSS_MULT)) < 1e-9, "가속 중에는 손실이 절반");
  assert.ok(boosted.later > boosted.right, "가속 중에는 속도가 빨리 다시 붙는다");
  assert.ok(Math.abs(boosted.dmg / plain.dmg - TUNE.SKILL_BOOST_MULT) < 1e-6, "피해는 가속으로 빨라진 속도에 비례해 오히려 커진다(손실을 줄여도 줄지 않는다)");
});

test("적끼리 간격: 병종 표(검방병 1.2)만큼 벌어지고, 서로 밀려나는 속도는 제한된다", () => {
  const g = quiet();
  g.addPlayer("a");
  const mk = (x: number, y: number) => (g as any).enemies.get(g.spawnEnemyAt(x, y, 3)); // 검방병
  const a = mk(1500, 1500);
  const b = mk(1510, 1500);
  const c = mk(1505, 1512);
  for (const e of [a, b, c]) {
    e.hold = true; // 제자리에서 버티는 수비병은 안 밀리므로 쓰지 않고, 이동만 막는다
    e.hold = false;
    e.stunT = 1e9; // 움직이지 못하게 해 간격만 본다
  }
  const dist = (p: any, q: any) => Math.hypot(p.x - q.x, p.y - q.y);
  const r = 14 * 2;
  const x0 = a.x;
  g.step();
  assert.ok(Math.abs(a.x - x0) <= TUNE.ENEMY_SEPARATION_SPEED / TICK_RATE + 1e-6, "한 틱에 밀리는 거리가 제한된다");
  run(g, 3);
  const need = 14 * 2 * spacingBetween(3, false, 3, false);
  assert.ok(dist(a, b) >= need * 0.95 && dist(b, c) >= need * 0.95 && dist(a, c) >= need * 0.95, `간격 ${dist(a, b).toFixed(1)}, ${dist(b, c).toFixed(1)}, ${dist(a, c).toFixed(1)} (목표 ${need.toFixed(1)})`);
  void r;
});

test("간격 표: 용병과 적이 같은 병종 표를 쓰고, 진영 보정과 평균 규칙이 적용된다", () => {
  assert.deepEqual([...SPACING_BY_TYPE], [1.0, 1.2, 1.5, 1.2, 1.6, 2.0]);
  assert.ok(Math.abs(spacingBetween(5, false, 5, false) - 2.0) < 1e-9, "적 마법사끼리 2.0");
  assert.ok(Math.abs(spacingBetween(1, false, 5, false) - 1.6) < 1e-9, "창병(1.2)과 마법사(2.0)는 평균 1.6");
  assert.ok(Math.abs(spacingBetween(0, true, 0, true) - 1.0 * TUNE.SPACING_SIDE_MERC) < 1e-9, "용병은 진영 보정이 곱해진다");
  assert.ok(Math.abs(spacingBetween(1, true, 3, true) - 1.2 * TUNE.SPACING_SIDE_MERC) < 1e-9);
  assert.ok(spacingBetween(0, false, 0, false) >= 1, "1보다 작아지지 않는다");
});

test("돌격 진형의 궁병 용병은 사거리 안에 적이 있어도 재사용 대기 중에 계속 다가간다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const id = g.addMerc(a, 2, p.x + 100, p.y);
  g.setStance(a, 1, 1 << 2); // 궁병만 돌격 진형
  const e = dummy(g, p.x + 400, p.y, 3);
  e.speed = 0;
  (g as any).enemies.forEach((x: any) => (x.cd = 1e9));
  const m = (g as any).mercs.get(id);
  m.cd = 5; // 쏠 수 없는 동안
  const d0 = Math.hypot(e.x - m.x, e.y - m.y);
  run(g, 1.5);
  const d1 = Math.hypot(e.x - m.x, e.y - m.y);
  assert.ok(d1 < d0 - 20, `다가갔다 ${d0.toFixed(0)} → ${d1.toFixed(0)}`);
});

test("궁병 용병 전통: 30발을 쏘면 장전(2.5초)하고, 장전 중에는 쏘지 못하며, 가득 차서 다시 쏜다", () => {
  const g = quiet();
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const id = g.addMerc(a, 2, p.x + 100, p.y);
  const m = (g as any).mercs.get(id);
  const e = dummy(g, p.x + 250, p.y, 3);
  e.speed = 0;
  (g as any).enemies.forEach((x: any) => (x.cd = 1e9));
  assert.equal(m.ammo ?? TUNE.MERC_QUIVER_SIZE, TUNE.MERC_QUIVER_SIZE);
  let minAmmo = 99;
  let reloads = 0;
  let wasReloading = false;
  let shotWhileReloading = 0;
  let lastAmmo = TUNE.MERC_QUIVER_SIZE;
  for (let i = 0; i < 40 * TICK_RATE; i++) {
    g.step();
    const r = (m.reloadT ?? 0) > 0;
    if (r && !wasReloading) reloads++;
    wasReloading = r;
    if (r && (m.ammo ?? 0) < lastAmmo - 0 && lastAmmo !== 0 && (m.ammo ?? 0) !== 0) shotWhileReloading++;
    lastAmmo = m.ammo ?? TUNE.MERC_QUIVER_SIZE;
    minAmmo = Math.min(minAmmo, lastAmmo);
  }
  assert.ok(minAmmo === 0, "전통을 다 비운다");
  assert.ok(reloads >= 1, "장전한다");
  assert.equal(shotWhileReloading, 0, "장전 중에는 쏘지 않는다");
});
