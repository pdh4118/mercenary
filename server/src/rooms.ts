import { randomBytes } from "node:crypto";
import {
  DIFFICULTY_REDUCTION,
  IDLE_KICK_SEC,
  IDLE_WARN_SEC,
  JOIN_FAIL_BLOCK_SEC,
  JOIN_FAIL_LIMIT,
  MAX_PLAYERS,
  MAX_ROOMS,
  RANKED_DIFFICULTY,
  NAME_MAX_LENGTH,
  RECONNECT_GRACE_SEC,
  ROOM_CODE_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  TICK_RATE,
  type ClientMsg,
  type RoomInfo,
  type RoomPhase,
  type ServerMsg,
  type TerrainWire,
} from "@mercenary/shared";
type ServerMsgTerrain = TerrainWire[];
import { Game } from "./game.js";

/** 네트워크 연결을 추상화한 것. 실제로는 WebSocket을 감싸고, 테스트에서는 가짜를 쓴다. */
export interface Conn {
  /** 접속한 주소(코드 무작위 대입 차단에 쓴다). 알 수 없으면 비운다. */
  ip?: string;
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
  idleSec: number; // 게임 중 마지막 조작 이후 지난 시간(초)
  lastAim: number; // 직전 조준 방향(마우스를 움직였는지 알아보려고)
  ready: boolean; // 대기실에서 준비 여부
}

interface Room {
  code: string;
  name: string;
  game: Game;
  hostId: number;
  members: Map<number, Member>;
  phase: RoomPhase; // waiting: 대기실(게임 정지), playing: 진행 중
  ranked: boolean; // 랭크(ELO 등) 게임: 난이도가 RANKED_DIFFICULTY로 고정되고 바꿀 수 없다
  isPrivate: boolean; // 비공개: 목록·빠른 시작에서 제외, 코드로만 입장
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
  /** 코드 무작위 대입을 막기 위한 주소별 참가 실패 기록. 시각은 서버가 진행한 시간(초) 기준. */
  private failures = new Map<string, { count: number; blockedUntil: number }>();
  private clock = 0;

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
        this.create(conn, msg.name, msg.room, msg.private === true);
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
      case "ready":
        this.setReady(conn, msg.ready === true);
        return;
      case "start":
        this.start(conn);
        return;
      case "difficulty":
        this.setDifficulty(conn, msg.v);
        return;
      case "rematch":
        this.rematch(conn);
        return;
      default:
        this.gameMessage(conn, msg);
    }
  }

  private gameMessage(conn: Conn, msg: ClientMsg): void {
    const at = this.where.get(conn);
    if (!at) return;
    const { room, id } = at;
    if (room.phase !== "playing") return; // 대기실에서는 게임 조작을 받지 않는다
    const mem = room.members.get(id);
    if (mem) {
      // 가만히 있는 입력(같은 상태를 계속 보내는 것)은 조작으로 치지 않는다. 키·마우스·클릭·구매 등은 조작이다.
      if (msg.t !== "input") mem.idleSec = 0;
      else if (msg.dx !== 0 || msg.dy !== 0 || msg.fire || msg.revive || msg.aim !== mem.lastAim) {
        mem.idleSec = 0;
        mem.lastAim = msg.aim;
      }
    }
    switch (msg.t) {
      case "input":
        room.game.setInput(id, msg);
        return;
      case "stance":
        room.game.setStance(id, msg.v);
        return;
      case "hold":
        room.game.setHold(id, msg.x, msg.y);
        return;
      case "record":
        conn.send({ t: "result", ...room.game.result(), partial: true });
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
      case "reroll":
        room.game.reroll(id);
        return;
      case "upgrade": {
        const r = room.game.upgrade(id, msg.merc);
        if (!r.ok) conn.send({ t: "notice", text: r.reason });
        return;
      }
      case "weapon":
        room.game.setWeapon(id, msg.index);
        return;
      case "formation":
        room.game.setFormation(id, msg);
        return;
    }
  }

  private create(conn: Conn, playerName: unknown, roomName: unknown, isPrivate: boolean): void {
    if (this.where.has(conn)) return this.fail(conn, "이미 방에 들어가 있습니다");
    if (this.rooms.size >= MAX_ROOMS) return this.fail(conn, "지금은 방을 더 만들 수 없습니다");
    const name = clean(playerName, NAME_MAX_LENGTH);
    const room = this.makeRoom(clean(roomName, ROOM_NAME_MAX_LENGTH) || `${name || "용병단"}의 방`, isPrivate);
    this.enter(conn, room, name);
  }

  private join(conn: Conn, playerName: unknown, code: unknown): void {
    if (this.where.has(conn)) return this.fail(conn, "이미 방에 들어가 있습니다");
    const key = conn.ip ?? "unknown";
    const fail = this.failures.get(key);
    if (fail && fail.blockedUntil > this.clock) {
      return this.fail(conn, `코드를 너무 많이 틀렸습니다. ${Math.ceil(fail.blockedUntil - this.clock)}초 뒤에 다시 시도해 주세요`);
    }
    const room = this.rooms.get(clean(code, ROOM_CODE_LENGTH).toUpperCase());
    if (!room) {
      // 비공개 방 코드를 무작위로 대입하는 것을 막기 위해, 같은 주소에서 연속으로 틀리면 잠시 막는다
      const count = (fail && fail.blockedUntil <= this.clock ? fail.count : 0) + 1;
      this.failures.set(key, { count, blockedUntil: count >= JOIN_FAIL_LIMIT ? this.clock + JOIN_FAIL_BLOCK_SEC : 0 });
      return this.fail(conn, "방을 찾을 수 없습니다. 코드를 확인해 주세요");
    }
    if (room.phase === "ended") return this.fail(conn, "이미 끝난 게임입니다");
    if (room.game.isFull) return this.fail(conn, "방이 가득 찼습니다");
    this.failures.delete(key);
    this.enter(conn, room, clean(playerName, NAME_MAX_LENGTH));
  }

  /** 자리가 있는 방 중 사람이 가장 많은 곳에 넣고, 없으면 새로 만든다 */
  private quick(conn: Conn, playerName: unknown): void {
    if (this.where.has(conn)) return this.fail(conn, "이미 방에 들어가 있습니다");
    let best: Room | null = null;
    for (const r of this.rooms.values()) {
      if (r.isPrivate || r.game.isFull || r.phase === "ended") continue; // 비공개 방은 빠른 시작에 끼지 않는다
      if (!best || r.game.playerCount > best.game.playerCount) best = r;
    }
    if (!best) {
      if (this.rooms.size >= MAX_ROOMS) return this.fail(conn, "지금은 방을 더 만들 수 없습니다");
      const name = clean(playerName, NAME_MAX_LENGTH);
      best = this.makeRoom(`${name || "용병단"}의 방`, false);
      best.phase = "playing"; // 빠른 시작은 기다리지 않고 바로 시작한다
      best.game.generateTerrain();
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
    if (at.room.game.terrain) conn.send(this.terrainMsg(at.room));
    if (at.room.phase === "ended") conn.send({ t: "result", ...at.room.game.result() });
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

  private setReady(conn: Conn, ready: boolean): void {
    const at = this.where.get(conn);
    if (!at || at.room.phase !== "waiting") return;
    const m = at.room.members.get(at.id);
    if (!m) return;
    m.ready = ready;
    this.broadcastRoom(at.room);
  }

  /** 방장이 게임을 시작한다. 접속 중인 다른 참가자가 모두 준비해야 한다. */
  private start(conn: Conn): void {
    const at = this.where.get(conn);
    if (!at) return;
    const { room } = at;
    if (room.hostId !== at.id) return this.fail(conn, "방장만 시작할 수 있습니다");
    if (room.phase !== "waiting") return;
    const notReady = [...room.members.values()].filter((m) => m.id !== room.hostId && m.conn && !m.ready);
    if (notReady.length > 0) return this.fail(conn, `아직 준비하지 않은 사람이 있습니다 (${notReady.map((m) => m.name).join(", ")})`);
    if (room.ranked) for (const m of room.members.values()) room.game.setDifficulty(m.id, RANKED_DIFFICULTY); // 랭크는 난이도 고정
    room.phase = "playing";
    room.game.generateTerrain(); // 판마다 새 지형
    this.broadcastTerrain(room);
    this.broadcastRoom(room);
    this.broadcastLobby();
  }

  /** 자기 난이도를 고른다(개인별). 대기실에서만, 랭크 방에서는 바꿀 수 없다. */
  private setDifficulty(conn: Conn, v: number): void {
    const at = this.where.get(conn);
    if (!at) return;
    const { room } = at;
    if (room.ranked) return this.fail(conn, "랭크 게임에서는 난이도를 바꿀 수 없습니다");
    if (room.phase !== "waiting") return this.fail(conn, "게임 중에는 난이도를 바꿀 수 없습니다");
    if (!room.game.setDifficulty(at.id, v)) return;
    this.broadcastRoom(room);
  }

  /** 방장이 끝난 게임을 대기실로 되돌린다. 같은 참가자들로 처음부터 다시 시작할 수 있다. */
  private rematch(conn: Conn): void {
    const at = this.where.get(conn);
    if (!at) return;
    const { room } = at;
    if (room.hostId !== at.id) return this.fail(conn, "방장만 다시 시작할 수 있습니다");
    if (room.phase !== "ended") return;
    room.game.reset();
    this.broadcastTerrain(room); // 지형을 비운다
    for (const m of room.members.values()) m.ready = false;
    room.phase = "waiting";
    this.broadcastRoom(room);
    this.broadcastLobby();
  }

  // --- 방 -------------------------------------------------------------------

  list(): RoomInfo[] {
    return [...this.rooms.values()]
      .filter((r) => !r.isPrivate)
      .map((r) => ({ code: r.code, name: r.name, players: r.game.playerCount, max: MAX_PLAYERS, playing: r.phase !== "waiting" }))
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

  private makeRoom(name: string, isPrivate: boolean): Room {
    let code = "";
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => CODE_CHARS[Math.floor(this.rng() * CODE_CHARS.length)]).join("");
    } while (this.rooms.has(code));
    const room: Room = { code, name, game: new Game(this.rng), hostId: -1, members: new Map(), phase: "waiting", ranked: false, isPrivate };
    this.rooms.set(code, room);
    return room;
  }

  private enter(conn: Conn, room: Room, name: string): void {
    const id = room.game.addPlayer(name);
    if (id === null) {
      if (room.members.size === 0) this.rooms.delete(room.code);
      return this.fail(conn, "방이 가득 찼습니다");
    }
    if (room.ranked) room.game.setDifficulty(id, RANKED_DIFFICULTY);
    const token = randomBytes(12).toString("hex");
    room.members.set(id, { id, name: room.game.getPlayer(id)!.name, conn, token, offlineLeft: 0, idleSec: 0, lastAim: 0, ready: false });
    if (room.hostId < 0) room.hostId = id; // 처음 들어온 사람이 방장
    this.lobby.delete(conn);
    this.where.set(conn, { room, id });
    this.tokens.set(token, { room, id });
    conn.send({ t: "welcome", id, tick: room.game.tick, code: room.code, token });
    if (room.game.terrain) conn.send(this.terrainMsg(room));
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

  private terrainMsg(room: Room): ServerMsg {
    return { t: "terrain", items: room.game.terrainItems() as ServerMsgTerrain };
  }
  private broadcastTerrain(room: Room): void {
    const msg = this.terrainMsg(room);
    for (const m of room.members.values()) m.conn?.send(msg);
  }

  private broadcastRoom(room: Room): void {
    const msg: ServerMsg = {
      t: "room",
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      phase: room.phase,
      private: room.isPrivate,
      ranked: room.ranked,
      players: [...room.members.values()].map((m) => ({ id: m.id, name: m.name, online: !!m.conn, ready: m.ready, difficulty: room.game.getDifficulty(m.id) })),
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
    this.clock += 1 / TICK_RATE;
    if (this.failures.size > 0 && Math.round(this.clock * TICK_RATE) % (60 * TICK_RATE) === 0) {
      for (const [k, f] of this.failures) if (f.blockedUntil <= this.clock) this.failures.delete(k); // 차단이 풀렸거나 오래된 기록
    }
    for (const room of [...this.rooms.values()]) {
      if (room.phase === "playing") {
        room.game.step();
        // 오래 아무 조작이 없는 사람은 내보낸다(토너먼트 구경 중에는 조작할 일이 없어 세지 않는다)
        const watching = room.game.info().phase === "tournament";
        for (const m of [...room.members.values()]) {
          if (!m.conn || watching) {
            m.idleSec = 0;
            continue;
          }
          m.idleSec += 1 / TICK_RATE;
          if (Math.abs(m.idleSec - (IDLE_KICK_SEC - IDLE_WARN_SEC)) < 0.5 / TICK_RATE) m.conn.send({ t: "notice", text: `${IDLE_WARN_SEC}초 안에 움직이지 않으면 방에서 나가게 됩니다` });
          if (m.idleSec >= IDLE_KICK_SEC) this.removeMember(room, m.id, `${Math.round(IDLE_KICK_SEC / 60)}분 동안 아무 조작이 없어 방에서 나왔습니다`);
        }
        if (!this.rooms.has(room.code)) continue;
      }
      for (const m of [...room.members.values()]) {
        if (m.conn) continue;
        m.offlineLeft -= 1 / TICK_RATE;
        if (m.offlineLeft <= 0) this.removeMember(room, m.id, "접속이 끊겨 방에서 제외되었습니다");
      }
      if (!this.rooms.has(room.code) || room.phase !== "playing") continue;
      const state: ServerMsg = {
        t: "state",
        tick: room.game.tick,
        time: Math.round(room.game.time * 10) / 10,
        players: room.game.snapshotPlayers(),
        mercs: room.game.snapshotMercs(),
        camps: room.game.snapshotCamps(),
        chests: room.game.snapshotChests(),
        meteors: room.game.snapshotMeteors(),
        enemies: room.game.snapshotEnemies(),
        bullets: room.game.snapshotBullets(),
        g: room.game.info(),
        ev: room.game.takeEvents(),
      };
      let json: string | null = null;
      for (const m of room.members.values()) {
        if (!m.conn) continue;
        if (m.conn.sendRaw) m.conn.sendRaw((json ??= JSON.stringify(state)));
        else m.conn.send(state);
      }
      if (room.game.status !== "playing") {
        // 마지막 상태를 보낸 뒤 결과를 알리고, 방은 끝난 상태로 둔다
        room.phase = "ended";
        const result: ServerMsg = { t: "result", ...room.game.result() };
        for (const m of room.members.values()) m.conn?.send(result);
        this.broadcastRoom(room);
        this.broadcastLobby();
      }
    }
  }
}
