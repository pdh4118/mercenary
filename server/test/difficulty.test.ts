import { test } from "node:test";
import assert from "node:assert/strict";
import { BLUNT, CAVALRY, CAST_TIME_MIN_MULT, DIFFICULTY_REDUCTION, MAGE, SHIELD, SPEAR, TICK_RATE, meleeArc, meleeReach } from "@mercenary/shared";
import { Game } from "../src/game.js";
import { RoomManager } from "../src/rooms.js";

const run = (g: Game, sec: number) => {
  for (let i = 0; i < Math.round(sec * TICK_RATE); i++) g.step();
};

function lostHp(difficulty: number): number {
  const g = new Game(() => 0.99); // 회피가 나지 않게
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  g.setDifficulty(a, difficulty);
  const p = g.getPlayer(a)!;
  p.hp = p.maxHp = 100000;
  for (let i = 0; i < 4; i++) g.spawnEnemyAt(p.x + 30 + i * 8, p.y, 1);
  run(g, 12);
  return p.maxHp - p.hp;
}

test("난이도: 받는 피해가 감소율만큼 줄어든다", () => {
  const base = lostHp(3);
  assert.ok(base > 40, "기준 피해가 있어야 한다");
  DIFFICULTY_REDUCTION.forEach((r, i) => {
    const lost = lostHp(i);
    assert.ok(Math.abs(lost - base * (1 - r)) <= base * 0.25, `난이도 ${i}: ${lost} vs ${base * (1 - r)}`);
  });
});

test("난이도: 사람마다 따로 고르고(대기실에서만) 방 정보로 모두에게 알려 준다", () => {
  type Msg = { t: string; players?: { id: number; difficulty: number }[] };
  const sent: Msg[][] = [[], []];
  const mk = (i: number) => ({ send: (m: Msg) => sent[i]!.push(m), close() {} }) as never;
  const rm = new RoomManager();
  const host = mk(0);
  const guest = mk(1);
  rm.handle(host, { t: "create", name: "h" });
  const code = rm.roomOf(host)!.code;
  rm.handle(guest, { t: "join", name: "g", code });
  const game = rm.roomOf(host)!.game;
  const hostId = rm.roomOf(host)!.hostId;
  const guestId = [...(sent[1]!.filter((m) => m.t === "room").pop()!.players ?? [])].find((p) => p.id !== hostId)!.id;
  rm.handle(guest, { t: "difficulty", v: 0 });
  assert.equal(game.getDifficulty(guestId), 0, "손님도 자기 난이도를 바꾼다");
  assert.equal(game.getDifficulty(hostId), 3, "다른 사람에게는 영향이 없다");
  rm.handle(host, { t: "difficulty", v: 1 });
  assert.equal(game.getDifficulty(hostId), 1);
  assert.equal(game.getDifficulty(guestId), 0);
  rm.handle(host, { t: "difficulty", v: 9 });
  assert.equal(game.getDifficulty(hostId), 1, "범위 밖은 무시");
  const last = sent[1]!.filter((m) => m.t === "room").pop()!;
  assert.deepEqual(last.players!.map((p) => p.difficulty).sort(), [0, 1]);
  // 게임이 시작되면 바꿀 수 없다
  rm.handle(guest, { t: "ready", ready: true });
  rm.handle(host, { t: "start" });
  rm.handle(guest, { t: "difficulty", v: 2 });
  assert.equal(game.getDifficulty(guestId), 0, "시작한 뒤에는 바꿀 수 없다");
});

test("랭크 방: 난이도가 고정되고 바꿀 수 없다", () => {
  const rm = new RoomManager();
  const conn = { send() {}, close() {} } as never;
  rm.handle(conn, { t: "create", name: "r" });
  const room = (rm as unknown as { rooms: Map<string, { ranked: boolean; game: Game }> }).rooms.values().next().value!;
  room.ranked = true;
  const id = rm.roomOf(conn)!.hostId;
  rm.handle(conn, { t: "difficulty", v: 0 });
  assert.equal(room.game.getDifficulty(id), 3, "랭크에서는 난이도를 바꿀 수 없다");
  const guest = { send() {}, close() {} } as never;
  rm.handle(guest, { t: "join", name: "g", code: rm.roomOf(conn)!.code });
  const gid = [...new Set([1, 2, 3, 4])].map((n) => n).find((n) => n !== id && room.game.getPlayer(n))!;
  assert.equal(room.game.getDifficulty(gid), 3, "랭크 방에 들어온 사람은 고정 난이도");
});

test("난이도는 사람마다 적용된다: 한 명이 쉬움이어도 다른 사람의 피해는 그대로", () => {
  const g = new Game(() => 0.99);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const b = g.addPlayer("b")!;
  g.setDifficulty(a, 0); // 피해 -75%
  const pa = g.getPlayer(a)!;
  const pb = g.getPlayer(b)!;
  for (const p of [pa, pb]) p.hp = p.maxHp = 100000;
  pa.x = -1000;
  pb.x = 1000;
  for (const p of [pa, pb]) for (let i = 0; i < 4; i++) g.spawnEnemyAt(p.x + 30 + i * 8, p.y, 1);
  run(g, 12);
  const la = 100000 - pa.hp;
  const lb = 100000 - pb.hp;
  assert.ok(lb > 40);
  assert.ok(Math.abs(la / lb - 0.25) < 0.1, `${la} vs ${lb}`);
});

test("용병은 한 자리에 뭉쳐 쌓이지 않는다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const ids: number[] = [];
  for (let i = 0; i < 14; i++) ids.push(g.addMerc(a, SPEAR, p.x, p.y));
  run(g, 6);
  let minD = Infinity;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const m = g.getMerc(ids[i]!)!;
      const o = g.getMerc(ids[j]!)!;
      minD = Math.min(minD, Math.hypot(m.x - o.x, m.y - o.y));
    }
  assert.ok(minD > 18, `가장 가까운 두 용병 간격 ${minD.toFixed(1)}`);
});

test("검을 든 주인공은 방패 체력이 정면 피해를 받아 내고, 맞지 않으면 차오른다", () => {
  const g = new Game(() => 0.99);
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  g.setWeapon(a, 2); // 검
  p.aim = 0;
  const max = p.shieldMax;
  assert.ok(max >= 200, "방패가 튼튼해야 한다");
  g.spawnEnemyAt(p.x + 30, p.y, 1); // 정면
  run(g, 2.5);
  assert.ok(p.shield < max, "정면 공격에 방패가 깎인다");
  assert.ok(p.hp === p.maxHp, "방패가 막는 동안 몸은 안 다친다");
  // 적을 치우고 가만히 두면 차오른다
  const low = p.shield;
  (g as unknown as { enemies: Map<number, unknown> }).enemies.clear();
  run(g, 3 + 3);
  assert.ok(p.shield > low, `차오름 ${low} -> ${p.shield}`);
  run(g, 20);
  assert.equal(p.shield, max);
});

test("방패 카드: 방패 체력 최대치가 늘고, 재생 카드는 더 빨리 차오르게 한다", () => {
  const regenAfter = (card: boolean) => {
    const g = new Game(() => 0.99);
    g.autoSpawn = false;
    const a = g.addPlayer("a")!;
    const p = g.getPlayer(a)!;
    if (card) g.applyCardForTest(a, { k: "heroShieldRegen", v: 0.5 });
    p.shield = 0;
    run(g, 5);
    return p.shield;
  };
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const before = p.shieldMax;
  g.applyCardForTest(a, { k: "heroShield", v: 100 });
  assert.equal(p.shieldMax, before + 100);
  assert.equal(p.shield, before + 100);
  run(g, 0.2);
  assert.equal(p.shieldMax, before + 100, "최대치가 유지된다");
  const base = regenAfter(false);
  const fast = regenAfter(true);
  assert.ok(base > 0 && Math.abs(fast / base - 1.5) < 0.05, `${base} -> ${fast}`);
});

test("철퇴·검 범위 증가는 부채꼴을 넓히지 않고 앞으로 길게 늘린다(기마는 각도가 넓어진다)", () => {
  assert.equal(meleeArc(BLUNT, 1.7, 2), 1.7);
  assert.equal(meleeReach(BLUNT, 50, 1.5), 75);
  assert.equal(meleeArc(SHIELD, 1.2, 1.5), 1.2);
  assert.equal(meleeReach(SHIELD, 50, 1.5), 75);
  assert.ok(meleeArc(CAVALRY, 1.2, 1.5) > 1.2);
  assert.equal(meleeReach(CAVALRY, 50, 1.5), 50);
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const id = g.addMerc(a, BLUNT, p.x, p.y);
  type Stats = { reach: number; arc: number; windup: number };
  const st = () => (g as unknown as { mercStats(m: unknown): Stats }).mercStats(g.getMerc(id)!);
  const before = st();
  g.applyCardForTest(a, { k: "mercStat", stat: "area", v: 0.5, type: BLUNT });
  const after = st();
  assert.equal(after.arc, before.arc);
  assert.ok(Math.abs(after.reach / before.reach - 1.5) < 1e-9);
});

test("시전 시간 카드: 마법사 용병과 주인공 지팡이의 주문이 빨라지고, 한계가 있다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  const id = g.addMerc(a, MAGE, p.x, p.y);
  const windup = () => (g as unknown as { mercStats(m: unknown): { windup: number } }).mercStats(g.getMerc(id)!).windup;
  const w0 = windup();
  g.applyCardForTest(a, { k: "mercStat", stat: "cast", v: -0.25, type: MAGE });
  assert.ok(Math.abs(windup() - w0 * 0.75) < 1e-9);
  for (let i = 0; i < 20; i++) g.applyCardForTest(a, { k: "mercStat", stat: "cast", v: -0.25, type: MAGE });
  assert.ok(Math.abs(windup() - w0 * CAST_TIME_MIN_MULT) < 1e-9, "아무리 모아도 한계 밑으로는 줄지 않는다");
  // 주인공 지팡이
  const castTime = (card: boolean) => {
    const h = new Game();
    h.autoSpawn = false;
    const b = h.addPlayer("b")!;
    if (card) h.applyCardForTest(b, { k: "heroCast", v: -0.3 });
    h.setWeapon(b, 4);
    run(h, 1);
    h.setInput(b, { dx: 0, dy: 0, aim: 0, fire: true });
    h.step();
    return h.getPlayer(b)!.wind;
  };
  const t0 = castTime(false);
  const t1 = castTime(true);
  assert.ok(t0 > 1.5 && Math.abs(t1 / t0 - 0.7) < 0.03, `${t0} -> ${t1}`);
});
