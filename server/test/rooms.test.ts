import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PLAYERS,
  MAX_ROOMS,
  NAME_MAX_LENGTH,
  PLAYER_MAX_HP,
  RECONNECT_GRACE_SEC,
  ROOM_CODE_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  SPEAR,
  TICK_RATE,
  type ServerMsg,
} from "@mercenary/shared";
import { RoomManager, type Conn } from "../src/rooms.js";

class FakeConn implements Conn {
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
  assert.deepEqual(room.players, [{ id: w.id, name: "철수", online: true }]);
  const b = conn();
  assert.deepEqual(b.last("rooms")!.rooms, [{ code: w.code, name: "우리 방", players: 1, max: MAX_PLAYERS }]);
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
  const { id, token } = b.last("welcome")!;
  const game = m.roomOf(b)!.game;
  game.getPlayer(id)!.gold = 777;

  m.disconnect(b);
  assert.deepEqual(a.last("room")!.players.find((p) => p.id === id), { id, name: "B", online: false });
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
  assert.equal(game.getPlayer(id)!.hp, PLAYER_MAX_HP);
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
