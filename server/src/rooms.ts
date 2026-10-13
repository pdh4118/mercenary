import { randomBytes } from "node:crypto";
import {
  MAX_PLAYERS,
  MAX_ROOMS,
  NAME_MAX_LENGTH,
  RECONNECT_GRACE_SEC,
  ROOM_CODE_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  TICK_RATE,
  type ClientMsg,
  type RoomInfo,
  type ServerMsg,
} from "@mercenary/shared";
import { Game } from "./game.js";

/** 네트워크 연결을 추상화한 것. 실제로는 WebSocket을 감싸고, 테스트에서는 가짜를 쓴다. */
export interface Conn {
  send(msg: ServerMsg): void;
  /** 같은 내용을 여러 명에게 보낼 때 직렬화를 한 번만 하려고 쓴다(없으면 send로 대신한다) */
  sendRaw?(json: string): void;
  close(): void;
}

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 헷갈리는 글자(0/O, 1/I/L)는 뺀다

interface Member {
  id: number;
  name: string;
  conn: Conn | null; // null이면 접속이 끊겨 돌아오기를 기다리는 중
  token: string;
  offlineLeft: number;
}

interface Room {
  code: string;
  name: string;
  game: Game;
  hostId: number;
  members: Map<number, Member>;
}

/** 이름·방 이름에서 제어 문자를 지우고 길이를 자른다 */
function clean(text: unknown, max: number): string {
  if (typeof text !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

/**
 * 방 관리: 로비(방 목록·만들기·참가·빠른 시작), 방장, 내보내기, 접속 끊김 후 재접속.
 * 방마다 독립된 판(Game)을 가지고, 비면 사라진다.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  private where = new Map<Conn, { room: Room; id: number }>();
  private tokens = new Map<string, { room: Room; id: number }>();
  private lobby = new Set<Conn>();

  constructor(private rng: () => number = Math.random) {}

  // --- 연결 -------------------------------------------------------------

  connect(conn: Conn): void {
    this.lobby.add(conn);
    conn.send({ t: "rooms", rooms: this.list() });
  }

  /** 연결이 끊겼다. 방에 있었다면 바로 지우지 않고 일정 시간 자리를 지켜 준다. */
  disconnect(conn: Conn): void {
    this.lobby.delete(conn);
    const at = this.where.get(conn);
    if (!at) return;
    this.where.delete(conn);
    const m = at.room.members.get(at.id);
    if (!m || m.conn !== conn) return; // 이미 다른 연결로 교체됨
    m.conn = null;
    m.offlineLeft = RECONNECT_GRACE_SEC;
    at.room.game.setAway(m.id, true);
    this.broadcastRoom(at.room);
  }

  // --- 요청 처리 ---------------------------------------------------------

  handle(conn: Conn, msg: ClientMsg): void {
    switch (msg.t) {
      case "list":
        conn.send({ t: "rooms", rooms: this.list() });
        return;
      case "create":
        this.create(conn, msg.name, msg.room);
        return;
      case "join":
        this.join(conn, msg.name, msg.code);
        return;
      case "quick":
        this.quick(conn, msg.name);
        return;
      case "rejoin":
        this.rejoin(conn, msg.token);
        return;
      case "leave":
        this.leave(conn, "방에서 나왔습니다");
        return;
      case "kick":
        this.kick(conn, msg.id);
        return;
      default:
        this.gameMessage(conn, msg);
    }
  }

  private gameMessage(conn: Conn, msg: ClientMsg): void {
    const at = this.where.get(conn);
    if (!at) return;
    const { room, id } = at;
    switch (msg.t) {
      case "input":
        room.game.setInput(id, msg);
        return;
      case "buy": {
        const r = room.game.buy(id, Number(msg.camp), Number(msg.slot));
        if (!r.ok) conn.send({ t: "notice", text: r.reason });
        return;
      }
      case "dismiss": {
        const r = room.game.dismiss(id, Number(msg.type));
        if (!r.ok) conn.send({ t: "notice", text: r.reason });
        return;
      }
      case "charge":
        room.game.charge(id, msg.x, msg.y);
        return;
      case "pick":
        room.game.pick(id, Number(msg.index));
        return;
      case "weapon":
        room.game.setWeapon(id, msg.index);
        return;
    }
  }

  private create(conn: Conn, playerName: unknown, roomName: unknown): void {
    if (this.where.has(conn)) return this.fail(conn, "이미 방에 들어가 있습니다");
    if (this.rooms.size >= MAX_ROOMS) return this.fail(conn, "지금은 방을 더 만들 수 없습니다");
    const name = clean(playerName, NAME_MAX_LENGTH);
    const room = this.makeRoom(clean(roomName, ROOM_NAME_MAX_LENGTH) || `${name || "용병단"}의 방`);
    this.enter(conn, room, name);
  }

  private join(conn: Conn, playerName: unknown, code: unknown): void {
    if (this.where.has(conn)) return this.fail(conn, "이미 방에 들어가 있습니다");
    const room = this.rooms.get(clean(code, ROOM_CODE_LENGTH).toUpperCase());
    if (!room) return this.fail(conn, "방을 찾을 수 없습니다. 코드를 확인해 주세요");
    if (room.game.isFull) return this.fail(conn, "방이 가득 찼습니다");
    this.enter(conn, room, clean(playerName, NAME_MAX_LENGTH));
  }

  /** 자리가 있는 방 중 사람이 가장 많은 곳에 넣고, 없으면 새로 만든다 */
  private quick(conn: Conn, playerName: unknown): void {
    if (this.where.has(conn)) return this.fail(conn, "이미 방에 들어가 있습니다");
    let best: Room | null = null;
    for (const r of this.rooms.values()) {
      if (!r.game.isFull && (!best || r.game.playerCount > best.game.playerCount)) best = r;
    }
    if (!best) {
      if (this.rooms.size >= MAX_ROOMS) return this.fail(conn, "지금은 방을 더 만들 수 없습니다");
      const name = clean(playerName, NAME_MAX_LENGTH);
      best = this.makeRoom(`${name || "용병단"}의 방`);
    }
    this.enter(conn, best, clean(playerName, NAME_MAX_LENGTH));
  }

  private rejoin(conn: Conn, token: unknown): void {
    const at = typeof token === "string" ? this.tokens.get(token) : undefined;
    const m = at?.room.members.get(at.id);
    if (!at || !m || at.room.members.get(at.id)?.token !== token) {
      return this.fail(conn, "이어서 할 수 있는 게임이 없습니다");
    }
    if (this.where.has(conn)) return;
    // 같은 사람이 이미 다른 연결로 들어와 있다면 새 연결로 교체한다
    if (m.conn && m.conn !== conn) {
      this.where.delete(m.conn);
      m.conn.send({ t: "left", reason: "다른 곳에서 접속했습니다" });
      m.conn.close();
    }
    m.conn = conn;
    m.offlineLeft = 0;
    this.lobby.delete(conn);
    this.where.set(conn, { room: at.room, id: m.id });
    at.room.game.setAway(m.id, false);
    conn.send({ t: "welcome", id: m.id, tick: at.room.game.tick, code: at.room.code, token: m.token });
    this.broadcastRoom(at.room);
  }

  private leave(conn: Conn, reason: string): void {
    const at = this.where.get(conn);
    if (!at) return;
    this.removeMember(at.room, at.id, reason);
  }

  private kick(conn: Conn, targetId: unknown): void {
    const at = this.where.get(conn);
    if (!at) return;
    if (at.room.hostId !== at.id) return this.fail(conn, "방장만 내보낼 수 있습니다");
    if (typeof targetId !== "number" || targetId === at.id || !at.room.members.has(targetId)) return;
    this.removeMember(at.room, targetId, "방장에게 내보내졌습니다");
  }

  // --- 방 -------------------------------------------------------------------

  list(): RoomInfo[] {
    return [...this.rooms.values()]
      .map((r) => ({ code: r.code, name: r.name, players: r.game.playerCount, max: MAX_PLAYERS }))
      .sort((a, b) => b.players - a.players || a.code.localeCompare(b.code));
  }

  roomCount(): number {
    return this.rooms.size;
  }

  /** 테스트·디버그용 */
  roomOf(conn: Conn): { code: string; game: Game; hostId: number } | undefined {
    const at = this.where.get(conn);
    return at && { code: at.room.code, game: at.room.game, hostId: at.room.hostId };
  }

  private makeRoom(name: string): Room {
    let code = "";
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => CODE_CHARS[Math.floor(this.rng() * CODE_CHARS.length)]).join("");
    } while (this.rooms.has(code));
    const room: Room = { code, name, game: new Game(this.rng), hostId: -1, members: new Map() };
    this.rooms.set(code, room);
    return room;
  }

  private enter(conn: Conn, room: Room, name: string): void {
    const id = room.game.addPlayer(name);
    if (id === null) {
      if (room.members.size === 0) this.rooms.delete(room.code);
      return this.fail(conn, "방이 가득 찼습니다");
    }
    const token = randomBytes(12).toString("hex");
    room.members.set(id, { id, name: room.game.getPlayer(id)!.name, conn, token, offlineLeft: 0 });
    if (room.hostId < 0) room.hostId = id; // 처음 들어온 사람이 방장
    this.lobby.delete(conn);
    this.where.set(conn, { room, id });
    this.tokens.set(token, { room, id });
    conn.send({ t: "welcome", id, tick: room.game.tick, code: room.code, token });
    this.broadcastRoom(room);
    this.broadcastLobby();
  }

  /** 방에서 한 명을 뺀다. 방장이면 다른 사람에게 넘기고, 아무도 안 남으면 방을 없앤다. */
  private removeMember(room: Room, id: number, reason: string): void {
    const m = room.members.get(id);
    if (!m) return;
    room.game.removePlayer(id);
    room.members.delete(id);
    this.tokens.delete(m.token);
    if (m.conn) {
      this.where.delete(m.conn);
      this.lobby.add(m.conn);
      m.conn.send({ t: "left", reason });
      m.conn.send({ t: "rooms", rooms: this.list() });
    }
    if (room.members.size === 0) {
      this.rooms.delete(room.code);
    } else if (room.hostId === id) {
      const next = [...room.members.values()].sort((a, b) => Number(!!b.conn) - Number(!!a.conn) || a.id - b.id)[0]!;
      room.hostId = next.id;
    }
    if (this.rooms.has(room.code)) this.broadcastRoom(room);
    this.broadcastLobby();
  }

  private broadcastRoom(room: Room): void {
    const msg: ServerMsg = {
      t: "room",
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      players: [...room.members.values()].map((m) => ({ id: m.id, name: m.name, online: !!m.conn })),
    };
    for (const m of room.members.values()) m.conn?.send(msg);
  }

  private broadcastLobby(): void {
    if (this.lobby.size === 0) return;
    const msg: ServerMsg = { t: "rooms", rooms: this.list() };
    for (const c of this.lobby) c.send(msg);
  }

  private fail(conn: Conn, text: string): void {
    conn.send({ t: "error", text });
  }

  // --- 진행 -----------------------------------------------------------------

  /** 한 틱: 모든 방의 판을 진행하고, 끊긴 사람의 대기 시간을 줄이고, 상태를 보낸다 */
  step(): void {
    for (const room of [...this.rooms.values()]) {
      room.game.step();
      for (const m of [...room.members.values()]) {
        if (m.conn) continue;
        m.offlineLeft -= 1 / TICK_RATE;
        if (m.offlineLeft <= 0) this.removeMember(room, m.id, "접속이 끊겨 방에서 제외되었습니다");
      }
      if (!this.rooms.has(room.code)) continue;
      const state: ServerMsg = {
        t: "state",
        tick: room.game.tick,
        time: Math.round(room.game.time * 10) / 10,
        players: room.game.snapshotPlayers(),
        mercs: room.game.snapshotMercs(),
        camps: room.game.snapshotCamps(),
        enemies: room.game.snapshotEnemies(),
        bullets: room.game.snapshotBullets(),
      };
      let json: string | null = null;
      for (const m of room.members.values()) {
        if (!m.conn) continue;
        if (m.conn.sendRaw) m.conn.sendRaw((json ??= JSON.stringify(state)));
        else m.conn.send(state);
      }
    }
  }
}
