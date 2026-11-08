/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAVALRY, MERC_STATS, TICK_RATE, TUNE, parseVoice, parseVoiceMulti } from "@mercenary/shared";
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
