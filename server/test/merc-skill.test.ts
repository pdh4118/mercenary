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
