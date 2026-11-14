/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARCHER, BLUNT, CAVALRY, MAGE, SHIELD, SPEAR, TICK_RATE, TUNE, SK, skillOn } from "@mercenary/shared";
import { Game } from "../src/game.js";

const setup = (type: number, tier: number) => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e9;
  const id = g.addMerc(a, type, p.x + 40, p.y)!;
  const m = (g as any).mercs.get(id);
  m.tier = tier;
  return { g, a, p, m };
};
const withLevels = (fn: () => void) => {
  const saved = TUNE.LV_MODE;
  TUNE.LV_MODE = 1;
  try {
    fn();
  } finally {
    TUNE.LV_MODE = saved;
  }
};
const dummy = (g: Game, x: number, y: number, shield = 0) => {
  const id = g.spawnEnemyAt(x, y, 1);
  const e = g.getEnemy(id) as any;
  e.hp = e.maxHp = 1e6;
  e.shield = shield;
  return e;
};

test("스킬은 레벨 모드에서 승급 단계에 따라 열린다", () => {
  assert.equal(skillOn(ARCHER, 4, 1), false); // 레벨 모드가 꺼져 있으면 없다
  withLevels(() => {
    assert.equal(skillOn(ARCHER, 0, 1), false);
    assert.equal(skillOn(ARCHER, 1, 1), true);
    assert.equal(skillOn(ARCHER, 1, 2), false);
    assert.equal(skillOn(ARCHER, 3, 3), true);
  });
});

test("마력 집중·관통 찌르기: 승급하면 시전이 빨라지고 폭발이 넓어지고 창이 길어진다", () => {
  withLevels(() => {
    const { g, m } = setup(MAGE, 0);
    const base = (g as any).mercStats(m);
    m.tier = 1;
    const up = (g as any).mercStats(m);
    assert.ok(up.windup < base.windup);
    assert.ok(up.splash > base.splash);
    const s = setup(SPEAR, 0);
    const r0 = (s.g as any).mercStats(s.m).reach;
    s.m.tier = 1;
    assert.ok((s.g as any).mercStats(s.m).reach > r0);
  });
});

test("얼음 화살: 3단계 궁병의 화살에 맞은 적이 느려진다. 분쇄: 방패 있는 적에게 더 세다", () => {
  withLevels(() => {
    const { g, m } = setup(ARCHER, 3);
    const e = dummy(g, 500, 500);
    (g as any).damageEnemy(e, { damage: 10, charge: 0, srcType: ARCHER, fromAngle: 0 }, m.owner, m);
    assert.ok(e.slowT > 0 && e.slowMult === SK.iceMult);
    const early = setup(ARCHER, 2);
    const e2 = dummy(early.g, 500, 500);
    (early.g as any).damageEnemy(e2, { damage: 10, charge: 0, srcType: ARCHER, fromAngle: 0 }, early.m.owner, early.m);
    assert.ok(!e2.slowT);
    const hit = (tier: number) => {
      const s = setup(BLUNT, tier);
      const t = dummy(s.g, 500, 500, 100);
      const before = t.hp + t.shield;
      (s.g as any).damageEnemy(t, { damage: 20, charge: 0, srcType: BLUNT, fromAngle: 0 }, s.m.owner, s.m);
      return before - (t.hp + t.shield);
    };
    assert.ok(hit(1) > hit(0) * 1.1);
  });
});

test("불씨: 3단계 마법사 운석이 떨어진 자리에 불이 남아 시간이 지나면 더 맞는다", () => {
  withLevels(() => {
    const { g, m } = setup(MAGE, 3);
    const e = dummy(g, 600, 600);
    (g as any).landMeteor(e.x, e.y, 80, 100, m.owner, false, m);
    const hp0 = e.hp;
    for (let i = 0; i < TICK_RATE * 2; i++) g.step();
    assert.ok(e.hp < hp0, "불씨 피해");
  });
});

test("가시 방패: 막은 피해 일부가 되돌아간다", () => {
  withLevels(() => {
    const out = (tier: number) => {
      const { g, m } = setup(SHIELD, tier);
      const fr = (g as any).collectFriendlies().find((f: any) => f.merc === m);
      return fr.hit({ damage: 5, charge: 0, srcType: SPEAR, fromAngle: m.face }) as number;
    };
    assert.ok(out(1) > out(0), "막은 피해가 있어야 되돌아간다");
  });
});

test("수호: 곁 아군의 피해 일부를 3단계 검방병이 대신 받는다", () => {
  withLevels(() => {
    const { g, a, p, m } = setup(SPEAR, 0);
    const gid = g.addMerc(a, SHIELD, p.x + 60, p.y)!;
    const guard = (g as any).mercs.get(gid);
    guard.tier = 3;
    guard.x = m.x + 20;
    guard.y = m.y;
    const gh = guard.hp;
    const mh = m.hp;
    const fr = (g as any).collectFriendlies().find((f: any) => f.merc === m);
    fr.hit({ damage: 20, charge: 0, srcType: BLUNT, fromAngle: 0 });
    assert.ok(guard.hp < gh, "검방병이 대신 맞는다");
    assert.ok(mh - m.hp < 20 * 0.9, "본인은 덜 맞는다");
  });
});

test("철갑마: 돌격 중인 3단계 기병은 덜 맞는다", () => {
  withLevels(() => {
    const dmg = (tier: number) => {
      const { g, m } = setup(CAVALRY, tier);
      m.momentum = 1;
      const hp = m.hp;
      const fr = (g as any).collectFriendlies().find((f: any) => f.merc === m);
      fr.hit({ damage: 20, charge: 0, srcType: BLUNT, fromAngle: 0 });
      return hp - m.hp;
    };
    assert.ok(dmg(3) < dmg(2));
  });
});

test("액티브 스킬: 승급 단계가 모자라면 못 쓰고, 쿨다운이 돌아야 다시 쓴다", () => {
  withLevels(() => {
    const { g, m } = setup(ARCHER, 1);
    const e = dummy(g, m.x + 60, m.y);
    assert.equal((g as any).tryActive(m, 2), true); // 직접 호출은 단계를 보지 않는다
    for (let i = 0; i < TICK_RATE; i++) g.step();
    assert.equal(m.skCd[0], 0); // 1단계는 액티브가 없어 쿨다운이 차지 않는다
    m.tier = 2;
    m.x = e.x - 60;
    m.y = e.y;
    for (let i = 0; i < TICK_RATE; i++) g.step();
    assert.ok(m.skCd[0] > 0, "2단계 궁병은 뒤로 점프를 쓴다");
  });
});

test("궁병: 뒤로 점프는 멀어지고, 은신은 3초 뒤 풀리며 첫 화살이 강해진다", () => {
  withLevels(() => {
    const { g, m } = setup(ARCHER, 4);
    const e = dummy(g, m.x + 50, m.y);
    const x0 = m.x;
    assert.equal((g as any).tryActive(m, 2), true);
    assert.ok(Math.abs(m.x - x0) > 150 && Math.hypot(m.x - e.x, m.y - e.y) > 200);
    const s = setup(ARCHER, 4);
    dummy(s.g, s.m.x + 100, s.m.y);
    assert.equal((s.g as any).tryActive(s.m, 4), true);
    assert.ok(s.m.stealthT > 0);
    assert.ok(!(s.g as any).buildFoes((s.g as any).collectFriendlies(), 0.05).some((f: any) => f.f.merc === s.m), "은신 중에는 적이 노리지 못한다");
    for (let i = 0; i < TICK_RATE * 3.2; i++) s.g.step();
    assert.ok(s.m.stealthShot === true || s.m.stealthT === 0);
  });
});

test("기병·창병·검방병·둔기병 액티브가 적에게 피해·경직을 준다", () => {
  withLevels(() => {
    const run = (type: number, n: 2 | 4, ex: number, spawn = 1) => {
      const { g, m } = setup(type, 4);
      const es = Array.from({ length: spawn }, (_, i) => dummy(g, m.x + ex + i * 20, m.y + i * 15));
      const ok = (g as any).tryActive(m, n);
      return { ok, es, m };
    };
    let r = run(CAVALRY, 4, 200);
    assert.ok(r.ok && r.es[0].hp < r.es[0].maxHp, "환영 기병대");
    r = run(CAVALRY, 2, 300);
    assert.ok(r.ok && r.m.dashT > 0, "일제 질주");
    r = run(SPEAR, 2, 300);
    assert.ok(r.ok && r.es[0].hp < r.es[0].maxHp, "창 던지기");
    r = run(SPEAR, 4, 300);
    assert.ok(r.ok && r.es[0].stunT > 0, "돌진 찌르기");
    r = run(SHIELD, 2, 20);
    assert.ok(r.ok && r.es[0].stunT > 0, "방패 밀치기");
    r = run(SHIELD, 4, 100, 3);
    assert.ok(r.ok && r.m.tauntT > 0, "도발 결계");
    r = run(BLUNT, 2, 300, 3);
    assert.ok(r.ok && r.es[0].stunT > 0, "도약 내려찍기");
    r = run(BLUNT, 4, 100, 3);
    assert.ok(r.ok && r.es.every((e: any) => e.stunT > 0), "지진");
  });
});

test("마법사: 점멸은 멀어지고 연쇄 운석은 시간차로 떨어진다", () => {
  withLevels(() => {
    const { g, m } = setup(MAGE, 4);
    const e = dummy(g, m.x + 60, m.y);
    assert.equal((g as any).tryActive(m, 2), true);
    assert.ok(Math.hypot(m.x - e.x, m.y - e.y) > 250);
    const s = setup(MAGE, 4);
    const es = [[150, 0], [-100, 170], [-100, -170]].map(([dx, dy]) => dummy(s.g, s.m.x + dx!, s.m.y + dy!));
    assert.equal((s.g as any).tryActive(s.m, 4), true);
    assert.ok((s.g as any).pendingMeteors.length >= 2);
    for (let i = 0; i < TICK_RATE * 2.5; i++) s.g.step();
    assert.ok(es.some((x: any) => x.hp < x.maxHp));
  });
});
