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

test("창병 장군 분신: 달려와 멈춘 뒤 창을 여러 번 찌르고(찌르기 효과 이벤트) 사라진다", () => {
  const { g, b, ids } = setup(2, BSK_CLONE);
  const p = hero(g, ids[0]!);
  place(p, b.x, b.y + 300);
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_CLONE);
  const thrusts: number[] = [];
  const takeEvents = (g as any).takeEvents.bind(g) as () => number[][];
  const stateOf = () => g.snapshotHazards().find((h) => h[1] === HZ_GHOST);
  const seen = new Set<number>();
  let gone = false;
  const maxHp = p.maxHp;
  for (let i = 0; i < TICK_RATE * 6; i++) {
    g.step();
    p.hp = maxHp;
    for (const ev of takeEvents()) if (ev[0] === 22 && ev[4] === 10) thrusts.push(ev[5]!);
    const gh = stateOf();
    if (gh) seen.add(gh[5]!); // a: 1 달림 / 2 서 있음 / 3 찌름
    else if (seen.size > 0) gone = true;
  }
  assert.ok(seen.has(1) && seen.has(3), `달리고 찌른다 ${[...seen]}`);
  assert.equal(thrusts.length, BOSS_SPEAR.cloneStrikes, "정해진 횟수만 찌른다");
  assert.ok(thrusts.every((len) => len === BOSS_SPEAR.cloneStrikeLen), "찌르기 길이가 이벤트로 전해진다");
  assert.ok(gone, "다 찌른 뒤 사라진다");
});

test("창병 장군 창 던지기: 월드 가장자리 가까이서 바깥으로 던져도 창은 월드 안에서 멈추고 장애물도 월드 안에 박힌다", () => {
  const { g, b, ids } = setup(2, BSK_THROW);
  const p = hero(g, ids[0]!);
  place(b, 1500, 0);
  b.bk.cds[BSK_THROW] = 0;
  place(p, 1900, 0); // 보스보다 바깥쪽(월드 가장자리 쪽)
  b.face = 0;
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_THROW);
  const tele = g.snapshotBossTele().find((t) => t[0] === TELE_LINE)!;
  assert.ok(tele[4]! <= 2000 - 1500, `예고 길이가 월드 안쪽까지만(${tele[4]})`);
  run(g, BOSS_SPEAR.throwTele + 0.3);
  const sp = g.snapshotHazards().find((h) => h[1] === HZ_SPEAR);
  assert.ok(sp, "박힌 창이 만들어진다");
  assert.ok(Math.abs(sp![2]!) <= 2000 && Math.abs(sp![3]!) <= 2000, "월드 안");
});

test("창병 장군 3연 찌르기: 터지는 효과 대신 찌르기 줄기 이벤트가 세 번 나간다", () => {
  const { g, b, ids } = setup(2, BSK_TRIPLE);
  const p = hero(g, ids[0]!);
  place(p, b.x, b.y + 300);
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_TRIPLE);
  const takeEvents = (g as any).takeEvents.bind(g) as () => number[][];
  let thrusts = 0;
  let impacts = 0;
  for (let i = 0; i < TICK_RATE * (BOSS_SPEAR.tripleTele + 1.2); i++) {
    g.step();
    p.hp = p.maxHp;
    for (const ev of takeEvents()) if (ev[0] === 22) ev[4] === 10 ? thrusts++ : ev[4] === 1 && impacts++;
  }
  assert.equal(thrusts, 3);
  assert.equal(impacts, 0, "펑 터지는 효과는 더 쓰지 않는다");
});

test("창병 장군 창 방어 태세: 부채꼴 안의 대상을 쉬지 않고 아주 빠르게 연달아 찌른다(찌르기 줄기 이벤트가 초당 10번 안팎)", () => {
  const { g, b, ids } = setup(2, BSK_GUARD);
  const p = hero(g, ids[0]!);
  place(p, b.x, b.y + 250);
  run(g, 0.1);
  assert.equal(b.bk.cur?.id, BSK_GUARD);
  run(g, BOSS_SPEAR.guardTele + 0.1);
  const takeEvents = (g as any).takeEvents.bind(g) as () => number[][];
  takeEvents();
  let thrusts = 0;
  const sec = 2;
  for (let i = 0; i < TICK_RATE * sec; i++) {
    place(p, b.x, b.y + 140); // 밀려나도 부채꼴 안에 다시 서 있게 한다
    g.step();
    p.hp = p.maxHp;
    for (const ev of takeEvents()) if (ev[0] === 22 && ev[4] === 10) thrusts++;
  }
  assert.ok(thrusts >= sec / BOSS_SPEAR.guardStep - 2, `${sec}초 동안 ${thrusts}번 찔렀다`);
});

import { BFX_BACKSTEP, BOSS_ARCHER, BSK_ICEARROW } from "@mercenary/shared";

test("궁수 장군 얼음 화살: 쏘기 시작할 때 먼지를 일으키며 뒤로 빠르게 물러난다", () => {
  const { g, b, ids } = setup(3, BSK_ICEARROW);
  const p = hero(g, ids[0]!);
  place(b, 0, 0);
  place(p, 0, 400);
  const takeEvents = (g as any).takeEvents.bind(g) as () => number[][];
  const y0 = b.y;
  let back = 0;
  let began = false;
  for (let i = 0; i < TICK_RATE * (BOSS_ARCHER.iceTele + 1.2); i++) {
    // 위협: 아군 기병이 바싹 붙은 상태를 만든다
    if (!began) g.addMerc(ids[0]!, 0, b.x, b.y + 100);
    began = true;
    g.step();
    p.hp = p.maxHp;
    for (const ev of takeEvents()) if (ev[0] === 22 && ev[4] === BFX_BACKSTEP) back++;
  }
  assert.ok(back >= 1, "물러나는 먼지 효과 이벤트");
  assert.ok(y0 - b.y > 120, `뒤로(대상 반대쪽) 물러났다 ${y0 - b.y}`);
});

import { EVT_INVULN, EVT_REFLECT } from "@mercenary/shared";

test("무적인 장군을 때리면 때린 사람에게 \"무적!\" 이벤트가 나가고(0.4초에 한 번), 피해는 들어가지 않는다", () => {
  const { g, b, ids } = setup(4, 0);
  b.invulnT = 2;
  const hp0 = b.hp;
  const takeEvents = (g as any).takeEvents.bind(g) as () => number[][];
  takeEvents();
  const hit = () => (g as any).damageEnemy(b, { damage: 50, charge: 0, srcType: 0, fromAngle: 0, crit: false }, ids[0]!);
  hit();
  hit(); // 같은 순간에 또 맞아도 한 번만 띄운다
  const pings = takeEvents().filter((ev) => ev[0] === EVT_INVULN && ev[5] === ids[0]);
  assert.equal(pings.length, 1);
  assert.equal(b.hp, hp0, "피해 없음");
  for (let i = 0; i < 12; i++) g.step();
  b.invulnT = 2;
  hit();
  assert.ok(takeEvents().some((ev) => ev[0] === EVT_INVULN), "시간이 지나면 다시 띄운다");
});

test("검방병 장군 반사 태세: 궁병·마법사(활·지팡이)의 공격은 되돌려받지 않고, 근접 공격은 되돌려받는다", () => {
  const { g, b, ids } = setup(4, 14);
  const p = hero(g, ids[0]!);
  place(p, b.x, b.y + 200);
  run(g, 0.1);
  b.bk.v.reflect = 3;
  const takeEvents = (g as any).takeEvents.bind(g) as () => number[][];
  takeEvents();
  const hit = (srcType: number) => (g as any).damageEnemy(b, { damage: 10, charge: 0, srcType, fromAngle: 0, crit: false }, ids[0]!);
  hit(0); // 근접(기병)
  const reflected = (k: number) => takeEvents().filter((ev) => ev[0] === 16 || ev[0] === EVT_REFLECT).length >= k;
  assert.ok(reflected(1), "근접은 되돌려받는다");
  takeEvents();
  hit(2); // 궁병
  hit(5); // 마법사
  assert.equal(takeEvents().filter((ev) => ev[0] === EVT_REFLECT).length, 0, "궁병·마법사는 반사 없음");
});

import { BSK_STEALTH, BOSS_ARCHER as ARC, ghostAlpha, ghostHidesAggro, EF_STEALTH } from "@mercenary/shared";

test("궁수 장군 은신 저격: 1초에 걸쳐 5%까지 투명해져 저격 전까지 유지하고, 저격하면 1초에 걸쳐 돌아온다(50% 이상에서 어그로 복귀)", () => {
  const { g, b, ids } = setup(3, BSK_STEALTH);
  const p = hero(g, ids[0]!);
  place(b, 0, 0);
  place(p, 0, 1300);
  b.bk.v.threat = 5; // 위협을 받은 상태
  let began = -1;
  let alphaAtOne = -1;
  let aimSeenInvisible = false;
  let fired = -1;
  let hiddenWhileAiming = false;
  for (let i = 0; i < TICK_RATE * 12; i++) {
    g.step();
    p.hp = p.maxHp;
    const k = b.bk;
    if (began < 0 && k.cur?.id === BSK_STEALTH) began = i;
    if (began >= 0 && alphaAtOne < 0 && i - began >= TICK_RATE) alphaAtOne = ghostAlpha(b.ghost);
    if (k.cur?.id === BSK_STEALTH && k.ph === 2 && b.ghost) {
      aimSeenInvisible = true;
      if (ghostHidesAggro(b.ghost)) hiddenWhileAiming = true;
    }
    if (fired < 0 && b.ghost?.phase === 2 && aimSeenInvisible) fired = i;
    if (fired >= 0 && i - fired >= TICK_RATE * 1.2) break;
  }
  assert.ok(began >= 0, "은신 스킬을 썼다");
  assert.ok(alphaAtOne <= ARC_MIN + 0.011 && alphaAtOne >= ARC_MIN - 0.001, `1초 뒤 5% ${alphaAtOne}`);
  assert.ok(aimSeenInvisible && hiddenWhileAiming, "저격을 겨누는 동안에도 투명하다");
  assert.ok(fired >= 0, "저격한 뒤에 돌아오기 시작한다");
  const snap = g.snapshotEnemies().find((w) => w[0] === b.id)!;
  assert.ok(typeof snap[15] === "number");
  void EF_STEALTH;
  void ARC;
});
const ARC_MIN = 0.05;
