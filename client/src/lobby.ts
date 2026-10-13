import type { ClientMsg, RoomInfo, RoomMember, ServerMsg } from "@mercenary/shared";

const NAME_KEY = "mercenary.name";
export const TOKEN_KEY = "mercenary.token";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const safe = {
  get: (k: string, storage: Storage = localStorage) => {
    try {
      return storage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string, storage: Storage = localStorage) => {
    try {
      storage.setItem(k, v);
    } catch {
      /* 저장소를 못 쓰는 환경(시크릿 모드 등)이어도 게임은 된다 */
    }
  },
  del: (k: string, storage: Storage = localStorage) => {
    try {
      storage.removeItem(k);
    } catch {
      /* 위와 같음 */
    }
  },
};

export interface Lobby {
  /** 서버 메시지 중 방 관련(rooms/welcome/room/left/error)을 처리한다. 처리했으면 true. */
  handle(msg: ServerMsg): boolean;
  playerName(): string;
  roomCode(): string;
  inRoom(): boolean;
  /** 로비나 방 메뉴가 열려 있어 게임 입력을 받으면 안 되는 상태 */
  blocksGameInput(): boolean;
  toggleRoomPanel(): void;
  /** 서버와 연결이 끊겼다(토큰은 남겨 두어 재접속에 쓴다) */
  markDisconnected(): void;
  showLobby(error?: string): void;
  clearToken(): void;
  token(): string | null;
}

interface Options {
  send(msg: ClientMsg): void;
  onEnter(id: number): void;
  onLeave(): void;
}

/** 로비(방 목록·만들기·참가)와 방 메뉴(코드·참가자·내보내기·나가기) 화면 */
export function createLobby(opts: Options): Lobby {
  const lobbyEl = $("lobby");
  const roomEl = $("roomPanel");
  const nameInput = $<HTMLInputElement>("lobbyName");
  const roomNameInput = $<HTMLInputElement>("lobbyRoomName");
  const codeInput = $<HTMLInputElement>("lobbyCode");
  const listEl = $("lobbyList");
  const errorEl = $("lobbyError");

  let code = "";
  let myId = -1;
  let inRoom = false;
  let hostId = -1;
  let rooms: RoomInfo[] = [];

  const params = new URLSearchParams(location.search);
  nameInput.value = (params.get("name") ?? safe.get(NAME_KEY) ?? "").slice(0, 12);

  const name = () => {
    const v = nameInput.value.trim();
    if (v) safe.set(NAME_KEY, v);
    return v || `용병단${Math.floor(Math.random() * 100)}`;
  };
  const setError = (text: string) => (errorEl.textContent = text);

  function renderRooms(): void {
    listEl.replaceChildren();
    if (rooms.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "열려 있는 방이 없습니다. 새로 만들어 보세요";
      listEl.append(empty);
      return;
    }
    for (const r of rooms) {
      const item = document.createElement("div");
      item.className = "item";
      const info = document.createElement("div");
      info.className = "grow";
      const nm = document.createElement("div");
      nm.textContent = r.name;
      const meta = document.createElement("div");
      meta.className = "meta";
      const c = document.createElement("span");
      c.className = "code";
      c.textContent = r.code;
      meta.append(c, ` · ${r.players}/${r.max}명`);
      info.append(nm, meta);
      const join = document.createElement("button");
      join.textContent = r.players >= r.max ? "가득 참" : "참가";
      join.disabled = r.players >= r.max;
      join.onclick = () => opts.send({ t: "join", name: name(), code: r.code });
      item.append(info, join);
      listEl.append(item);
    }
  }

  function renderMembers(players: RoomMember[]): void {
    const box = $("roomMembers");
    box.replaceChildren();
    const iAmHost = hostId === myId;
    for (const p of players) {
      const item = document.createElement("div");
      item.className = "item";
      const label = document.createElement("div");
      label.className = "grow";
      label.textContent = p.name + (p.id === myId ? " (나)" : "");
      item.append(label);
      if (p.id === hostId) {
        const t = document.createElement("span");
        t.className = "tag";
        t.textContent = "방장";
        item.append(t);
      }
      if (!p.online) {
        const t = document.createElement("span");
        t.className = "tag off";
        t.textContent = "연결 끊김";
        item.append(t);
      }
      if (iAmHost && p.id !== myId) {
        const kick = document.createElement("button");
        kick.className = "danger";
        kick.textContent = "내보내기";
        kick.onclick = () => opts.send({ t: "kick", id: p.id });
        item.append(kick);
      }
      box.append(item);
    }
  }

  const showLobby = (error = "") => {
    roomEl.classList.remove("open");
    lobbyEl.classList.add("open");
    setError(error);
  };
  const hideLobby = () => lobbyEl.classList.remove("open");

  $("lobbyQuick").onclick = () => opts.send({ t: "quick", name: name() });
  $("lobbyCreate").onclick = () => opts.send({ t: "create", name: name(), room: roomNameInput.value });
  const joinByCode = () => {
    const c = codeInput.value.trim();
    if (c.length < 4) return setError("방 코드 4글자를 입력해 주세요");
    opts.send({ t: "join", name: name(), code: c });
  };
  $("lobbyJoin").onclick = joinByCode;
  codeInput.onkeydown = (e) => e.key === "Enter" && joinByCode();
  $("roomLeave").onclick = () => opts.send({ t: "leave" });
  $("roomClose").onclick = () => roomEl.classList.remove("open");
  $("roomCopy").onclick = () => {
    void navigator.clipboard?.writeText(code).catch(() => undefined);
    $("roomCopy").textContent = "복사됨";
    setTimeout(() => ($("roomCopy").textContent = "복사"), 1200);
  };

  renderRooms();

  return {
    handle(msg) {
      switch (msg.t) {
        case "rooms":
          rooms = msg.rooms;
          renderRooms();
          return true;
        case "welcome":
          inRoom = true;
          code = msg.code;
          myId = msg.id;
          safe.set(TOKEN_KEY, msg.token, sessionStorage); // 같은 탭에서 새로고침해도 이어서 하도록
          hideLobby();
          opts.onEnter(msg.id);
          return true;
        case "room":
          code = msg.code;
          hostId = msg.hostId;
          $("roomTitle").textContent = msg.name;
          $("roomCode").textContent = msg.code;
          renderMembers(msg.players);
          return true;
        case "left":
          inRoom = false;
          safe.del(TOKEN_KEY, sessionStorage);
          opts.onLeave();
          showLobby(msg.reason);
          return true;
        case "error":
          // 이어하기에 실패했다면 낡은 토큰을 버리고 로비로 보낸다
          if (!inRoom) {
            safe.del(TOKEN_KEY, sessionStorage);
            showLobby(msg.text);
          } else {
            setError(msg.text);
          }
          return true;
        default:
          return false;
      }
    },
    playerName: () => nameInput.value.trim(),
    roomCode: () => code,
    inRoom: () => inRoom,
    blocksGameInput: () => lobbyEl.classList.contains("open") || roomEl.classList.contains("open"),
    toggleRoomPanel() {
      if (!inRoom || lobbyEl.classList.contains("open")) return;
      roomEl.classList.toggle("open");
    },
    markDisconnected: () => {
      inRoom = false;
    },
    showLobby,
    clearToken: () => safe.del(TOKEN_KEY, sessionStorage),
    token: () => safe.get(TOKEN_KEY, sessionStorage),
  };
}
