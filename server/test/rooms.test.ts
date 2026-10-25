import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IDLE_KICK_SEC,
  JOIN_FAIL_BLOCK_SEC,
  JOIN_FAIL_LIMIT,
  MAX_PLAYERS,
  MAX_ROOMS,
  NAME_MAX_LENGTH,
  RECONNECT_GRACE_SEC,
  ROOM_CODE_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  SPEAR,
  TICK_RATE,
  type ServerMsg,
  TUNE,
} from "@mercenary/shared";
import { RoomManager, type Conn } from "../src/rooms.js";

class FakeConn implements Conn {
  ip?: string;
  msgs: ServerMsg[] = [];
  closed = false;
  send(msg: ServerMsg) {
    this.msgs.push(msg);
  }
  close() {
    this.closed = true;
  }
  last<T extends ServerMsg["t"]>(t: T): Extract<ServerMsg, { t: T }> | undefined {
    for (let i = this.msgs.length - 1; i >= 0; i--) if (this.msgs[i]!.t === t) return this.msgs[i] as Extract<ServerMsg, { t: T }>;
    return undefined;
  }
}

const setup = () => {
  const m = new RoomManager();
  const conn = (): FakeConn => {
    const c = new FakeConn();
    m.connect(c);
    return c;
  };
  return { m, conn };
};
const seconds = (m: RoomManager, s: number) => {
  for (let i = 0; i < Math.round(s * TICK_RATE); i++) m.step();
};

test("접속하면 로비에서 방 목록을 받는다", () => {
  const { m, conn } = setup();
  const a = conn();
  assert.deepEqual(a.last("rooms")!.rooms, []);
});

test("방 만들기: 4글자 코드를 받고 방장이 되며 방 목록에 나타난다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "철수", room: "우리 방" });
  const w = a.last("welcome")!;
  assert.equal(w.code.length, ROOM_CODE_LENGTH);
  assert.match(w.code, /^[A-Z2-9]+$/);
  assert.ok(w.token.length >= 16);
  const room = a.last("room")!;
  assert.equal(room.hostId, w.id);
  assert.equal(room.name, "우리 방");
  assert.deepEqual(room.players, [{ id: w.id, name: "철수", online: true, ready: false, difficulty: 3 }]);
  const b = conn();
  assert.deepEqual(b.last("rooms")!.rooms, [{ code: w.code, name: "우리 방", players: 1, max: MAX_PLAYERS, playing: false }]);
});

test("코드로 참가: 대소문자·공백을 가리지 않고, 기존 인원에게도 알려진다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  const code = a.last("welcome")!.code;
  const b = conn();
  m.handle(b, { t: "join", name: "B", code: ` ${code.toLowerCase()} ` });
  assert.ok(b.last("welcome"));
  assert.equal(a.last("room")!.players.length, 2);
  assert.equal(b.last("room")!.hostId, a.last("welcome")!.id, "방장은 처음 만든 사람");
});

test("참가 실패: 없는 코드, 가득 찬 방", () => {
  const { m, conn } = setup();
  const x = conn();
  m.handle(x, { t: "join", name: "X", code: "ZZZZ" });
  assert.ok(x.last("error")!.text.includes("찾을 수 없"));
  assert.equal(x.last("welcome"), undefined);

  const host = conn();
  m.handle(host, { t: "create", name: "H" });
  const code = host.last("welcome")!.code;
  for (let i = 1; i < MAX_PLAYERS; i++) m.handle(conn(), { t: "join", name: `p${i}`, code });
  const late = conn();
  m.handle(late, { t: "join", name: "late", code });
  assert.ok(late.last("error")!.text.includes("가득"));
  assert.equal(m.list()[0]!.players, MAX_PLAYERS);
});

test("빠른 시작: 자리 있는 방 중 사람이 많은 곳으로, 없으면 새로 만든다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "quick", name: "A" });
  assert.equal(m.roomCount(), 1);
  const b = conn();
  m.handle(b, { t: "quick", name: "B" });
  assert.equal(m.roomCount(), 1);
  assert.equal(a.last("welcome")!.code, b.last("welcome")!.code);
  // 방을 가득 채우면 다음 사람은 새 방으로
  for (let i = 2; i < MAX_PLAYERS; i++) m.handle(conn(), { t: "quick", name: `p${i}` });
  const next = conn();
  m.handle(next, { t: "quick", name: "next" });
  assert.equal(m.roomCount(), 2);
  assert.notEqual(next.last("welcome")!.code, a.last("welcome")!.code);
});

test("방마다 독립된 판이다: 한 방의 입력·적이 다른 방에 영향을 주지 않는다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(b, { t: "create", name: "B" });
  m.handle(a, { t: "start" });
  m.handle(b, { t: "start" });
  const ra = m.roomOf(a)!;
  const rb = m.roomOf(b)!;
  assert.notEqual(ra.code, rb.code);
  ra.game.autoSpawn = false;
  rb.game.autoSpawn = false;
  ra.game.spawnEnemyAt(300, 300, SPEAR);
  assert.equal(ra.game.enemyCount, 1);
  assert.equal(rb.game.enemyCount, 0);
  const x0 = rb.game.getPlayer(b.last("welcome")!.id)!.x;
  m.handle(a, { t: "input", dx: 1, dy: 0, aim: 0, fire: false });
  seconds(m, 1);
  assert.equal(rb.game.getPlayer(b.last("welcome")!.id)!.x, x0, "다른 방 플레이어는 움직이지 않는다");
  assert.ok(ra.game.getPlayer(a.last("welcome")!.id)!.x > x0 + 100);
});

test("상태는 같은 방 사람에게만, 매 틱 전달된다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  const c = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(b, { t: "join", name: "B", code: a.last("welcome")!.code });
  m.handle(c, { t: "create", name: "C" });
  m.handle(b, { t: "ready", ready: true });
  m.handle(a, { t: "start" });
  m.handle(c, { t: "start" });
  m.step();
  const sa = a.last("state")!;
  assert.equal(sa.players.length, 2);
  assert.equal(b.last("state")!.players.length, 2);
  assert.equal(c.last("state")!.players.length, 1);
});

test("방에서 나가면 로비로 돌아가고, 방장이 나가면 다음 사람이 방장이 된다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(b, { t: "join", name: "B", code: a.last("welcome")!.code });
  m.handle(a, { t: "leave" });
  assert.equal(a.last("left")!.reason, "방에서 나왔습니다");
  assert.ok(a.last("rooms"));
  assert.equal(b.last("room")!.hostId, b.last("welcome")!.id);
  assert.equal(b.last("room")!.players.length, 1);
  // 나간 사람은 다시 만들거나 참가할 수 있다
  m.handle(a, { t: "join", name: "A", code: b.last("welcome")!.code });
  assert.ok(a.last("welcome"));
});

test("마지막 사람이 나가면 방이 사라진다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(a, { t: "leave" });
  assert.equal(m.roomCount(), 0);
  assert.deepEqual(m.list(), []);
});

test("내보내기: 방장만 할 수 있고, 내보내진 사람은 로비로 간다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(b, { t: "join", name: "B", code: a.last("welcome")!.code });
  const bId = b.last("welcome")!.id;
  m.handle(b, { t: "kick", id: a.last("welcome")!.id });
  assert.ok(b.last("error")!.text.includes("방장"));
  assert.equal(m.roomOf(a)!.game.playerCount, 2);
  m.handle(a, { t: "kick", id: bId });
  assert.ok(b.last("left")!.reason.includes("내보내"));
  assert.equal(m.roomOf(a)!.game.playerCount, 1);
  assert.equal(m.roomOf(b), undefined);
  // 자기 자신이나 없는 번호는 무시
  m.handle(a, { t: "kick", id: a.last("welcome")!.id });
  m.handle(a, { t: "kick", id: 9999 });
  assert.equal(m.roomOf(a)!.game.playerCount, 1);
});

test("접속이 끊겨도 제한 시간 안에는 자리를 지키고, 같은 캐릭터로 재접속한다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  const b = conn();
  m.handle(b, { t: "join", name: "B", code: a.last("welcome")!.code });
  m.handle(b, { t: "ready", ready: true });
  m.handle(a, { t: "start" });
  const { id, token } = b.last("welcome")!;
  const game = m.roomOf(b)!.game;
  game.getPlayer(id)!.gold = 777;

  m.disconnect(b);
  assert.deepEqual(a.last("room")!.players.find((p) => p.id === id), { id, name: "B", online: false, ready: true, difficulty: 3 });
  seconds(m, RECONNECT_GRACE_SEC - 5);
  assert.equal(game.playerCount, 2, "아직 자리가 남아 있다");

  const b2 = conn();
  m.handle(b2, { t: "rejoin", token });
  const w = b2.last("welcome")!;
  assert.equal(w.id, id);
  assert.equal(game.getPlayer(id)!.gold, 777, "금화 등 상태가 그대로");
  assert.equal(a.last("room")!.players.find((p) => p.id === id)!.online, true);
  seconds(m, RECONNECT_GRACE_SEC + 5);
  assert.equal(game.playerCount, 2, "재접속했으니 대기 시간이 지나도 남아 있다");
  assert.ok(b2.last("state"));
});

test("제한 시간 안에 돌아오지 않으면 방에서 빠지고, 이후 재접속은 거절된다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(b, { t: "join", name: "B", code: a.last("welcome")!.code });
  const { token } = b.last("welcome")!;
  m.disconnect(b);
  seconds(m, RECONNECT_GRACE_SEC + 1);
  assert.equal(m.roomOf(a)!.game.playerCount, 1);
  const late = conn();
  m.handle(late, { t: "rejoin", token });
  assert.ok(late.last("error"));
  assert.equal(late.last("welcome"), undefined);
});

test("모두 끊겨 시간이 지나면 방이 정리된다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  m.disconnect(a);
  assert.equal(m.roomCount(), 1);
  seconds(m, RECONNECT_GRACE_SEC + 1);
  assert.equal(m.roomCount(), 0);
});

test("끊긴 방장도 대기 중에는 방장 자리를 유지하다가, 제외되면 넘어간다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  m.handle(a, { t: "create", name: "A" });
  const aId = a.last("welcome")!.id;
  m.handle(b, { t: "join", name: "B", code: a.last("welcome")!.code });
  m.disconnect(a);
  assert.equal(b.last("room")!.hostId, aId);
  seconds(m, RECONNECT_GRACE_SEC + 1);
  assert.equal(b.last("room")!.hostId, b.last("welcome")!.id);
});

test("끊긴 동안 주인공은 적의 목표가 되지 않는다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  const { id } = a.last("welcome")!;
  const game = m.roomOf(a)!.game;
  game.autoSpawn = false;
  const p = game.getPlayer(id)!;
  for (let i = 0; i < 5; i++) game.spawnEnemyAt(p.x + 10, p.y, SPEAR);
  m.disconnect(a);
  seconds(m, 5);
  assert.equal(game.getPlayer(id)!.hp, TUNE.PLAYER_MAX_HP);
});

test("같은 토큰으로 다른 곳에서 다시 접속하면 이전 연결은 밀려난다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  const { id, token } = a.last("welcome")!;
  const a2 = conn();
  m.handle(a2, { t: "rejoin", token });
  assert.equal(a2.last("welcome")!.id, id);
  assert.ok(a.last("left")!.reason.includes("다른 곳"));
  assert.equal(a.closed, true);
  // 밀려난 이전 연결이 끊겨도 새 연결에는 영향이 없다
  m.disconnect(a);
  assert.equal(m.roomOf(a2)!.game.playerCount, 1);
  seconds(m, RECONNECT_GRACE_SEC + 1);
  assert.equal(m.roomOf(a2)!.game.playerCount, 1);
});

test("이미 방에 있는 연결의 중복 생성·참가는 거절된다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(a, { t: "create", name: "A" });
  assert.equal(m.roomCount(), 1);
  assert.ok(a.last("error"));
  m.handle(a, { t: "quick", name: "A" });
  assert.equal(m.roomOf(a)!.game.playerCount, 1);
});

test("이름·방 이름은 제어 문자를 지우고 길이를 제한하며, 비면 기본값을 쓴다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "  \u0007" + "가".repeat(40) + "\n", room: "방".repeat(50) });
  const room = a.last("room")!;
  assert.equal(room.name.length, ROOM_NAME_MAX_LENGTH);
  assert.equal(room.players[0]!.name.length, NAME_MAX_LENGTH);
  assert.ok(!/[\u0000-\u001f]/.test(room.players[0]!.name));
  const b = conn();
  m.handle(b, { t: "create", name: "", room: "" });
  assert.ok(b.last("room")!.name.length > 0);
  assert.ok(b.last("room")!.players[0]!.name.length > 0);
});

test("방 수에는 상한이 있다", () => {
  const { m, conn } = setup();
  for (let i = 0; i < MAX_ROOMS; i++) m.handle(conn(), { t: "create", name: `p${i}` });
  assert.equal(m.roomCount(), MAX_ROOMS);
  const extra = conn();
  m.handle(extra, { t: "create", name: "extra" });
  assert.ok(extra.last("error"));
  assert.equal(m.roomCount(), MAX_ROOMS);
  const quick = conn();
  m.handle(quick, { t: "quick", name: "q" }); // 자리 있는 방에는 들어갈 수 있다
  assert.ok(quick.last("welcome"));
});

test("방에 없는 연결의 게임 메시지는 무시된다", () => {
  const { m, conn } = setup();
  const a = conn();
  assert.doesNotThrow(() => {
    m.handle(a, { t: "input", dx: 1, dy: 0, aim: 0, fire: true });
    m.handle(a, { t: "buy", camp: 1, slot: 0 });
    m.handle(a, { t: "pick", index: 0 });
    m.handle(a, { t: "kick", id: 1 });
    m.handle(a, { t: "leave" });
  });
});

test("로비에 있는 사람에게 방 목록 변화가 실시간으로 전해진다", () => {
  const { m, conn } = setup();
  const lobbyer = conn();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  assert.equal(lobbyer.last("rooms")!.rooms.length, 1);
  m.handle(a, { t: "leave" });
  assert.equal(lobbyer.last("rooms")!.rooms.length, 0);
});

// --- 비공개 방과 대기실 ----------------------------------------------------------



test("비공개 방: 목록과 빠른 시작에서 제외되고, 코드로만 들어올 수 있다", () => {
  const { m, conn } = setup();
  const host = conn();
  m.handle(host, { t: "create", name: "H", room: "비밀방", private: true });
  const code = host.last("welcome")!.code;
  assert.equal(host.last("room")!.private, true);
  assert.deepEqual(m.list(), []);
  // 로비 사람에게 방 목록 갱신으로도 새어 나가지 않는다
  const watcher = conn();
  assert.deepEqual(watcher.last("rooms")!.rooms, []);
  // 빠른 시작은 비공개 방에 들어가지 않고 새 공개 방을 만든다
  const q = conn();
  m.handle(q, { t: "quick", name: "Q" });
  assert.notEqual(q.last("welcome")!.code, code);
  assert.equal(m.roomOf(host)!.game.playerCount, 1);
  // 코드로는 들어올 수 있다
  const friend = conn();
  m.handle(friend, { t: "join", name: "F", code });
  assert.equal(friend.last("welcome")!.code, code);
  assert.equal(m.roomOf(host)!.game.playerCount, 2);
});

test("공개 방은 기본값이고 목록에 대기 중/진행 중이 표시된다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  assert.equal(a.last("room")!.private, false);
  assert.equal(m.list()[0]!.playing, false);
  m.handle(a, { t: "start" });
  assert.equal(m.list()[0]!.playing, true);
});

test("대기실: 방을 만들면 대기 상태이고, 시작 전에는 게임이 진행되지 않는다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  assert.equal(a.last("room")!.phase, "waiting");
  const room = m.roomOf(a)!;
  const id = a.last("welcome")!.id;
  const p0 = { ...room.game.getPlayer(id)! };
  m.handle(a, { t: "input", dx: 1, dy: 0, aim: 0, fire: false }); // 대기실에서는 조작 무시
  seconds(m, 30);
  assert.equal(room.game.time, 0, "시간이 흐르지 않는다");
  assert.equal(room.game.enemyCount, 0, "적이 나오지 않는다");
  assert.equal(room.game.getPlayer(id)!.x, p0.x);
  assert.equal(a.last("state"), undefined, "상태 메시지를 보내지 않는다");
});

test("준비와 시작: 방장만 시작하고, 접속 중인 다른 참가자가 모두 준비해야 한다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  const c = conn();
  m.handle(a, { t: "create", name: "A" });
  const code = a.last("welcome")!.code;
  m.handle(b, { t: "join", name: "B", code });
  m.handle(c, { t: "join", name: "C", code });
  assert.equal(a.last("room")!.players.every((p) => !p.ready), true);

  m.handle(b, { t: "start" });
  assert.ok(b.last("error")!.text.includes("방장"));
  m.handle(a, { t: "start" });
  assert.ok(a.last("error")!.text.includes("준비"), "아무도 준비하지 않았다");
  assert.ok(a.last("error")!.text.includes("B") && a.last("error")!.text.includes("C"));

  m.handle(b, { t: "ready", ready: true });
  assert.equal(a.last("room")!.players.find((p) => p.name === "B")!.ready, true);
  m.handle(a, { t: "start" });
  assert.ok(a.last("error")!.text.includes("C"), "C가 아직");
  assert.equal(a.last("room")!.phase, "waiting");

  m.handle(b, { t: "ready", ready: false }); // 준비 취소
  m.handle(b, { t: "ready", ready: true });
  m.handle(c, { t: "ready", ready: true });
  m.handle(a, { t: "start" });
  assert.equal(a.last("room")!.phase, "playing");
  assert.equal(c.last("room")!.phase, "playing");
  seconds(m, 1);
  assert.ok(b.last("state"), "시작하면 상태가 전달된다");
  assert.ok(m.roomOf(a)!.game.time > 0);
});

test("방장 혼자면 바로 시작할 수 있다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(a, { t: "start" });
  assert.equal(a.last("room")!.phase, "playing");
});

test("연결이 끊긴 참가자는 시작을 막지 않는다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(b, { t: "join", name: "B", code: a.last("welcome")!.code });
  m.disconnect(b);
  m.handle(a, { t: "start" });
  assert.equal(a.last("room")!.phase, "playing");
});

test("시작한 뒤에는 준비 없이 바로 합류하고, 그 사람의 게임 조작이 먹는다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(a, { t: "start" });
  const late = conn();
  m.handle(late, { t: "join", name: "L", code: a.last("welcome")!.code });
  assert.equal(late.last("room")!.phase, "playing");
  const game = m.roomOf(late)!.game;
  const id = late.last("welcome")!.id;
  const x0 = game.getPlayer(id)!.x;
  m.handle(late, { t: "input", dx: 1, dy: 0, aim: 0, fire: false });
  seconds(m, 1);
  assert.ok(game.getPlayer(id)!.x > x0 + 100);
});

test("빠른 시작으로 새로 만들어진 방은 기다리지 않고 바로 진행된다", () => {
  const { m, conn } = setup();
  const a = conn();
  m.handle(a, { t: "quick", name: "A" });
  assert.equal(a.last("room")!.phase, "playing");
  seconds(m, 1);
  assert.ok(a.last("state"));
});

test("대기실 상태에서도 나가기·내보내기·방장 넘김이 동작한다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  const c = conn();
  m.handle(a, { t: "create", name: "A", private: true });
  const code = a.last("welcome")!.code;
  m.handle(b, { t: "join", name: "B", code });
  m.handle(c, { t: "join", name: "C", code });
  m.handle(a, { t: "kick", id: c.last("welcome")!.id });
  assert.ok(c.last("left"));
  m.handle(a, { t: "leave" });
  assert.equal(b.last("room")!.hostId, b.last("welcome")!.id);
  assert.equal(b.last("room")!.phase, "waiting");
  assert.equal(b.last("room")!.private, true);
  // 새 방장이 시작할 수 있다
  m.handle(b, { t: "start" });
  assert.equal(b.last("room")!.phase, "playing");
});

test("대기실에서 끊겼다가 재접속하면 대기실로 돌아오고 준비 상태가 유지된다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(b, { t: "join", name: "B", code: a.last("welcome")!.code });
  m.handle(b, { t: "ready", ready: true });
  const { token, id } = b.last("welcome")!;
  m.disconnect(b);
  seconds(m, 5);
  const b2 = conn();
  m.handle(b2, { t: "rejoin", token });
  assert.equal(b2.last("room")!.phase, "waiting");
  assert.equal(b2.last("room")!.players.find((p) => p.id === id)!.ready, true);
});

test("준비·시작 요청은 방 밖이나 진행 중에는 무시된다", () => {
  const { m, conn } = setup();
  const x = conn();
  assert.doesNotThrow(() => {
    m.handle(x, { t: "ready", ready: true });
    m.handle(x, { t: "start" });
  });
  const a = conn();
  m.handle(a, { t: "quick", name: "A" });
  m.handle(a, { t: "ready", ready: true }); // 진행 중에는 의미 없다
  m.handle(a, { t: "start" });
  assert.equal(a.last("room")!.phase, "playing");
});

test("코드 무작위 대입 방지: 같은 주소에서 연속으로 틀리면 잠시 차단된다", () => {
  const { m } = setup();
  const make = (ip: string) => {
    const c = new FakeConn();
    c.ip = ip;
    m.connect(c);
    return c;
  };
  const host = make("1.1.1.1");
  m.handle(host, { t: "create", name: "H", private: true });
  const code = host.last("welcome")!.code;
  const attacker = make("6.6.6.6");
  for (let i = 0; i < JOIN_FAIL_LIMIT; i++) m.handle(attacker, { t: "join", name: "X", code: "QQQQ" });
  // 이제는 맞는 코드를 넣어도 막힌다
  m.handle(attacker, { t: "join", name: "X", code });
  assert.ok(attacker.last("error")!.text.includes("너무 많이"));
  assert.equal(attacker.last("welcome"), undefined);
  // 다른 주소는 영향이 없다
  const other = make("2.2.2.2");
  m.handle(other, { t: "join", name: "O", code });
  assert.ok(other.last("welcome"));
  // 시간이 지나면 풀린다
  seconds(m, JOIN_FAIL_BLOCK_SEC + 1);
  m.handle(attacker, { t: "join", name: "X", code });
  assert.ok(attacker.last("welcome"));
});

test("코드를 가끔 틀리는 것은 괜찮고, 맞게 입력하면 실패 횟수가 초기화된다", () => {
  const { m } = setup();
  const host = new FakeConn();
  host.ip = "1.1.1.1";
  m.connect(host);
  m.handle(host, { t: "create", name: "H" });
  const code = host.last("welcome")!.code;
  for (let round = 0; round < 3; round++) {
    const c = new FakeConn();
    c.ip = "3.3.3.3";
    m.connect(c);
    for (let i = 0; i < JOIN_FAIL_LIMIT - 1; i++) m.handle(c, { t: "join", name: "X", code: "ZZZZ" });
    m.handle(c, { t: "join", name: "X", code });
    assert.ok(c.last("welcome"), `${round}번째 시도`);
    m.handle(c, { t: "leave" });
  }
});

test("모두 쓰러지면 결과가 전달되고 방은 끝난 상태가 되며, 방장이 다시 하기를 누르면 대기실로 돌아간다", () => {
  const { m, conn } = setup();
  const host = conn();
  m.handle(host, { t: "quick", name: "A" });
  const guest = conn();
  m.handle(guest, { t: "join", name: "B", code: host.last("welcome")!.code });
  const game = m.roomOf(host)!.game;
  game.autoSpawn = false;
  const hp = game.getPlayer(host.last("welcome")!.id) as { down: boolean };
  hp.down = true;
  (game.getPlayer(guest.last("welcome")!.id) as { down: boolean }).down = true;
  seconds(m, 0.2);
  const result = host.last("result")!;
  assert.equal(result.status, "defeat");
  assert.equal(result.players.length, 2);
  assert.ok(guest.last("result"));
  assert.equal(host.last("room")!.phase, "ended");
  // 끝난 방에는 새로 들어올 수 없다
  const late = conn();
  m.handle(late, { t: "join", name: "C", code: host.last("welcome")!.code });
  assert.ok(late.last("error"));
  // 방장이 아니면 다시 하기를 할 수 없다
  m.handle(guest, { t: "rematch" });
  assert.equal(host.last("room")!.phase, "ended");
  m.handle(host, { t: "rematch" });
  assert.equal(host.last("room")!.phase, "waiting");
  assert.equal(game.status, "playing");
  assert.equal(game.getPlayer(host.last("welcome")!.id)!.down, false);
});

test("로비·대기실에서 5분 동안 아무 조작이 없으면 연결을 끊는다(조작하면 시간이 다시 시작되고, 게임 중에는 끊지 않는다)", () => {
  const { m, conn } = setup();
  const idleLobby = conn();
  const activeLobby = conn();
  const idleWait = conn();
  m.handle(idleWait, { t: "create", name: "대기" });
  assert.ok(idleWait.last("welcome"));
  for (let s = 0; s < IDLE_KICK_SEC - 30; s += 10) {
    m.handle(activeLobby, { t: "active" });
    seconds(m, 10);
  }
  m.handle(activeLobby, { t: "active" });
  seconds(m, 40);
  assert.equal(idleLobby.closed, true, "로비에서 가만히 있던 접속은 끊긴다");
  assert.ok(idleLobby.last("left"), "이유를 알려 준다");
  assert.equal(activeLobby.closed, false, "조작한 접속은 유지된다");
  assert.equal(idleWait.closed, true, "대기실에서 가만히 있던 접속도 끊긴다");
  assert.equal(m.roomCount(), 0, "방도 정리된다");

  // 게임이 진행 중인 방의 접속은 아무리 가만히 있어도 끊지 않는다
  const player = conn();
  m.handle(player, { t: "quick", name: "게임중" });
  m.roomOf(player)!.game.autoSpawn = false;
  seconds(m, IDLE_KICK_SEC + 60);
  assert.equal(player.closed, false);
  assert.equal(player.last("left"), undefined);
});

test("접속한 사람이 없는 방(재접속 대기 중)은 방 목록에서 빠진다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  m.handle(a, { t: "create", name: "A" });
  assert.equal(m.list().length, 1);
  m.disconnect(a);
  assert.equal(m.roomCount(), 1, "자리는 잠깐 지켜 준다");
  assert.equal(m.list().length, 0, "하지만 목록에는 보이지 않는다");
  m.handle(b, { t: "list" });
  assert.equal(b.last("rooms")!.rooms.length, 0);
});

test("채팅은 같은 방 사람에게만 가고, 길이·연타가 제한된다", () => {
  const { m, conn } = setup();
  const a = conn();
  const b = conn();
  const c = conn();
  m.handle(a, { t: "create", name: "A" });
  m.handle(b, { t: "join", name: "B", code: a.last("welcome")!.code });
  m.handle(c, { t: "create", name: "C" });
  m.handle(a, { t: "chat", text: "  안녕\n하세요  " });
  assert.equal(b.last("chat")!.text, "안녕 하세요");
  assert.equal(b.last("chat")!.name, "A");
  assert.equal(a.last("chat")!.id, a.last("welcome")!.id);
  assert.equal(c.last("chat"), undefined, "다른 방에는 가지 않는다");
  const n = b.msgs.filter((s) => s.t === "chat").length;
  m.handle(a, { t: "chat", text: "연타" });
  assert.equal(b.msgs.filter((s) => s.t === "chat").length, n, "너무 빠른 연타는 무시");
  seconds(m, 1);
  m.handle(a, { t: "chat", text: "x".repeat(200) });
  assert.equal(b.last("chat")!.text.length, 60);
});
