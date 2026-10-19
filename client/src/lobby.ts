import { DIFFICULTY_NAMES, DIFFICULTY_REDUCTION, STAGE_COUNT, type ClientMsg, type ResultPlayer, type RoomInfo, type RoomMember, type RoomPhase, type ServerMsg } from "@mercenary/shared";

type ResultMsg = Extract<ServerMsg, { t: "result" }>;

const NAME_KEY = "mercenary.name";
const LOOK_KEY = "mercenary.look";
const RECORDS_KEY = "mercenary.records";
const RECORDS_MAX = 20;

interface SavedRecord {
  at: number;
  status: "victory" | "defeat" | "quit";
  stage: number;
  time: number;
  players: ResultPlayer[];
  me: string;
  room: string;
}
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
  /** 고른 주인공 모습(0 기본 · 1 여성) */
  look(): number;
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
  // 주인공 모습 고르기: 여성 그림이 있을 때만 보인다(없으면 선택지 자체를 숨긴다)
  let lookValue = safe.get(LOOK_KEY) === "1" ? 1 : 0;
  const look = () => lookValue;
  const lookBox = $("lookBox");
  const paintLook = () => lookBox.querySelectorAll<HTMLElement>(".lookBtn").forEach((b) => b.classList.toggle("sel", Number(b.dataset.look) === lookValue));
  lookBox.querySelectorAll<HTMLElement>(".lookBtn").forEach((b) =>
    b.addEventListener("click", () => {
      lookValue = Number(b.dataset.look) === 1 ? 1 : 0;
      safe.set(LOOK_KEY, String(lookValue));
      paintLook();
    }),
  );
  const probe = new Image();
  probe.onload = () => {
    lookBox.style.display = "";
    paintLook();
  };
  probe.onerror = () => {
    lookValue = 0; // 그림이 없으면 기본 모습만
  };
  probe.src = "assets/hero/hero_f_sword.png";
  const roomNameInput = $<HTMLInputElement>("lobbyRoomName");
  const codeInput = $<HTMLInputElement>("lobbyCode");
  const privateInput = $<HTMLInputElement>("lobbyPrivate");
  const listEl = $("lobbyList");
  const errorEl = $("lobbyError");
  const waitEl = $("waitRoom");
  const waitErrorEl = $("waitError");
  const resultEl = $("resultPanel");
  const recordEl = $("recordPanel");
  let lastResult: ResultMsg | null = null;
  /** 결과 화면을 어떤 용도로 열었나: 끝난 게임 / 진행 중 중간 기록(나가기 전 확인) / 저장된 기록 보기 */
  type ResultMode = "final" | "partial" | "view";
  let resultMode: ResultMode = "final";
  let leaveAfterRecord = false; // 나가기를 눌러 중간 기록을 기다리는 중
  let viewing: SavedRecord | null = null;

  let code = "";
  let myId = -1;
  let inRoom = false;
  let hostId = -1;
  let ranked = false;
  let phase: RoomPhase = "playing";
  let rooms: RoomInfo[] = [];
  let members: RoomMember[] = [];

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
      const state = document.createElement("span");
      state.className = r.playing ? "tag live" : "tag";
      state.textContent = r.playing ? "진행 중" : "대기 중";
      meta.append(c, ` · ${r.players}/${r.max}명 `, state);
      info.append(nm, meta);
      const join = document.createElement("button");
      join.textContent = r.players >= r.max ? "가득 참" : "참가";
      join.disabled = r.players >= r.max;
      join.onclick = () => opts.send({ t: "join", name: name(), code: r.code });
      item.append(info, join);
      listEl.append(item);
    }
  }

  /** 참가자 목록을 그린다. 대기실에서는 준비 표시를, 방 메뉴에서는 생략한다. */
  function renderMembers(box: HTMLElement, players: RoomMember[], showReady: boolean): void {
    box.replaceChildren();
    const iAmHost = hostId === myId;
    for (const p of players) {
      const item = document.createElement("div");
      item.className = "item";
      const label = document.createElement("div");
      label.className = "grow";
      label.textContent = p.name + (p.id === myId ? " (나)" : "");
      item.append(label);
      if (showReady) {
        const d = document.createElement("span");
        d.className = "tag";
        const red = Math.round((DIFFICULTY_REDUCTION[p.difficulty] ?? 0) * 100);
        d.textContent = red > 0 ? `피해 -${red}%` : "피해 감소 없음";
        item.append(d);
      }
      if (p.id === hostId) {
        const t = document.createElement("span");
        t.className = "tag";
        t.textContent = "방장";
        item.append(t);
      } else if (showReady && p.online) {
        const t = document.createElement("span");
        t.className = p.ready ? "tag ready" : "tag off";
        t.textContent = p.ready ? "준비 완료" : "준비 안 함";
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

  /** 대기실 화면(참가자·준비·시작 버튼)을 현재 상태로 갱신한다 */
  function renderWaitRoom(roomName: string, isPrivate: boolean): void {
    $("waitTitle").textContent = roomName;
    $("waitPrivate").style.display = isPrivate ? "inline-block" : "none";
    $("waitCode").textContent = code;
    $("waitCount").textContent = `(${members.length}명)`;
    renderMembers($("waitMembers"), members, true);
    $("waitDiffNote").textContent = ranked ? "(랭크 게임: 난이도 고정, 바꿀 수 없습니다)" : "(내가 받는 피해 감소 · 사람마다 따로 정합니다)";
    const diffBox = $("waitDiff");
    diffBox.replaceChildren();
    DIFFICULTY_REDUCTION.forEach((r, i) => {
      const b = document.createElement("button");
      b.textContent = `${DIFFICULTY_NAMES[i]} ${Math.round(r * 100)}%`;
      b.className = i === (members.find((m) => m.id === myId)?.difficulty ?? 3) ? "primary" : "";
      b.disabled = ranked;
      b.onclick = () => opts.send({ t: "difficulty", v: i });
      diffBox.append(b);
    });
    const iAmHost = hostId === myId;
    const me = members.find((m) => m.id === myId);
    const waiting = members.filter((m) => m.id !== hostId && m.online && !m.ready);
    const readyBtn = $<HTMLButtonElement>("waitReady");
    const startBtn = $<HTMLButtonElement>("waitStart");
    readyBtn.style.display = iAmHost ? "none" : "";
    readyBtn.textContent = me?.ready ? "준비 취소" : "준비";
    readyBtn.className = me?.ready ? "" : "primary";
    startBtn.style.display = iAmHost ? "" : "none";
    startBtn.disabled = waiting.length > 0;
    $("waitHint").textContent = iAmHost
      ? waiting.length > 0
        ? `준비하지 않은 사람: ${waiting.map((m) => m.name).join(", ")}`
        : members.length > 1
          ? "모두 준비했습니다. 시작할 수 있습니다."
          : "혼자서도 시작할 수 있습니다. 친구가 오면 기다려 보세요."
      : "방장이 시작하면 게임이 열립니다. 준비를 눌러 주세요.";
  }

  // --- 기록: 끝난 판·중도 종료한 판을 브라우저에 최근 20개까지 저장한다 ---
  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  const statusText = (r: { status: string; stage: number }, quit: boolean) =>
    quit ? `중도 종료 (스테이지 ${r.stage}/${STAGE_COUNT})` : r.status === "victory" ? `승리 (${STAGE_COUNT}스테이지 돌파)` : `전멸 (스테이지 ${r.stage}/${STAGE_COUNT})`;
  const loadRecords = (): SavedRecord[] => {
    try {
      const v = JSON.parse(safe.get(RECORDS_KEY) ?? "[]") as unknown;
      return Array.isArray(v) ? (v as SavedRecord[]) : [];
    } catch {
      return [];
    }
  };
  const saveRecord = (r: ResultMsg, quit: boolean): void => {
    const rec: SavedRecord = { at: Date.now(), status: quit || r.status === "playing" ? "quit" : r.status, stage: r.stage, time: r.time, players: r.players, me: nameInput.value.trim(), room: code };
    const list = loadRecords();
    const prev = list[0];
    // 같은 판의 결과가 재접속 등으로 다시 오면 중복해서 저장하지 않는다
    if (prev && prev.status === rec.status && prev.stage === rec.stage && prev.time === rec.time && prev.room === rec.room && rec.at - prev.at < 3_600_000) return;
    safe.set(RECORDS_KEY, JSON.stringify([rec, ...list].slice(0, RECORDS_MAX)));
  };

  /** 한 사람의 활약 줄: 이름과 레벨·처치, 그 아래 피해·쓰러짐·금화 */
  function playerRow(p: ResultPlayer, mine: boolean): HTMLElement {
    const item = document.createElement("div");
    item.className = "item wrap";
    const nm = document.createElement("div");
    nm.className = "grow";
    nm.textContent = p.name + (mine ? " (나)" : "");
    if (mine) nm.style.color = "#ffe08a";
    const st = document.createElement("div");
    st.className = "stat";
    st.textContent = `Lv ${p.level} · 처치 ${p.kills}`;
    const more = document.createElement("div");
    more.className = "pstats";
    more.textContent =
      `준 피해 ${(p.dealt ?? 0).toLocaleString()} · 받은 피해 ${(p.taken ?? 0).toLocaleString()} · 쓰러짐 ${p.downs ?? 0}회 · 부활시킴 ${p.revives}회\n` +
      `번 금화 ${(p.gold ?? 0).toLocaleString()} · 용병 ${p.mercs ?? 0}명 (쓰러진 횟수 ${p.mercDeaths ?? 0})` +
      ((p.wins ?? 0) > 0 || (p.champion ?? 0) > 0 ? `\n토너먼트 ${p.wins ?? 0}승${(p.champion ?? 0) > 0 ? ` · 우승 ${p.champion}회` : ""}` : "");
    more.style.whiteSpace = "pre-line";
    item.append(nm, st, more);
    return item;
  }

  /** 결과 화면. 끝난 게임이면 방장만 다시 시작할 수 있고, 진행 중 기록이면 계속하거나 나갈 수 있고, 저장된 기록은 보기만 한다. */
  function renderResult(r: ResultMsg | null = lastResult, mode: ResultMode = resultMode, quit = false, me = nameInput.value.trim()): void {
    if (!r) return;
    resultMode = mode;
    const win = r.status === "victory" && !quit && !r.partial;
    const title = $("resultTitle");
    title.textContent = quit || r.partial ? "진행 기록" : win ? "승리!" : "전멸...";
    title.className = win ? "victory" : r.partial || quit ? "" : "defeat";
    $("resultSub").textContent = `${r.partial || quit ? `스테이지 ${r.stage}/${STAGE_COUNT} 진행 중` : statusText(r, false)} · ${mmss(r.time)}`;
    const list = $("resultList");
    list.replaceChildren();
    for (const p of r.players) list.append(playerRow(p, p.name === me));
    const iAmHost = hostId === myId;
    $("resultClose").style.display = mode === "final" ? "none" : "";
    $("resultClose").textContent = mode === "view" ? "닫기" : "계속하기";
    $("resultLeave").style.display = mode === "view" ? "none" : "";
    $("resultRematch").style.display = mode === "final" && iAmHost ? "" : "none";
    $("resultHint").textContent =
      mode === "partial"
        ? "나가면 이 기록이 최근 기록에 저장됩니다."
        : mode === "view"
          ? ""
          : iAmHost
            ? "다시 하기를 누르면 대기실로 돌아갑니다."
            : "방장이 다시 시작하기를 기다리는 중입니다.";
  }

  /** 업데이트 내역: changelog.json(최신이 위)을 불러와 로비에 버전을 표시하고 내역 창을 채운다 */
  interface ChangelogItem { c: string; t: string; k?: string; f?: number | string; to?: number | string; u?: string }
  interface ChangelogVersion { version: string; date: string; title: string; changes: ChangelogItem[] }
  function initChangelog(): void {
    fetch("changelog.json")
      .then((r) => r.json())
      .then((d: { versions: ChangelogVersion[] }) => {
        const vs = d.versions;
        if (vs.length === 0) return;
        $("verTag").textContent = vs[0]!.version;
        $("clVer").textContent = vs[0]!.version;
        const box = $("clList");
        box.replaceChildren();
        const fmtV = (v: number | string | undefined, u: string): string => (typeof v === "number" ? `${Math.round(v * 1000) / 1000}${u}` : String(v ?? ""));
        for (const v of vs) {
          const el = document.createElement("div");
          el.className = "ver";
          const head = document.createElement("div");
          head.className = "vh";
          const b = document.createElement("b");
          b.textContent = v.version;
          const date = document.createElement("span");
          date.className = "date";
          date.textContent = v.date;
          head.append(b, date);
          const title = document.createElement("div");
          title.className = "vt";
          title.textContent = v.title;
          const ul = document.createElement("ul");
          for (const ch of v.changes) {
            const li = document.createElement("li");
            const cat = document.createElement("span");
            cat.className = `cat c${ch.c}`;
            cat.textContent = ch.c;
            const text = document.createElement("span");
            if (ch.k !== undefined) {
              text.append(`${ch.k} `);
              const num = document.createElement("span");
              num.className = "num";
              num.textContent = `${fmtV(ch.f, ch.u ?? "")} → ${fmtV(ch.to, ch.u ?? "")}`;
              text.append(num);
            } else text.textContent = ch.t;
            li.append(cat, text);
            ul.append(li);
          }
          el.append(head, title, ul);
          box.append(el);
        }
      })
      .catch(() => {
        $("verTag").textContent = "";
      });
  }

  function renderRecords(): void {
    const box = $("recordList");
    box.replaceChildren();
    const list = loadRecords();
    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "아직 기록이 없습니다. 게임이 끝나거나 중간에 나가면 저장됩니다";
      box.append(empty);
      return;
    }
    for (const rec of list) {
      const item = document.createElement("div");
      item.className = "item click";
      const info = document.createElement("div");
      info.className = "grow";
      const d = new Date(rec.at);
      const when = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const top = document.createElement("div");
      const tag = document.createElement("span");
      tag.className = rec.status === "victory" ? "tag win" : rec.status === "defeat" ? "tag lose" : "tag quit";
      tag.textContent = rec.status === "victory" ? "승리" : rec.status === "defeat" ? "전멸" : "중도 종료";
      top.append(tag, ` 스테이지 ${rec.stage}/${STAGE_COUNT} · ${mmss(rec.time)}`);
      const meta = document.createElement("div");
      meta.className = "meta";
      const mine = rec.players.find((p) => p.name === rec.me) ?? rec.players[0];
      meta.textContent = `${when} · ${rec.players.length}명${mine ? ` · Lv ${mine.level} · 처치 ${mine.kills}` : ""}`;
      info.append(top, meta);
      item.append(info);
      item.onclick = () => {
        viewing = rec;
        renderResult({ t: "result", status: rec.status === "victory" ? "victory" : "defeat", stage: rec.stage, time: rec.time, players: rec.players, partial: rec.status === "quit" }, "view", rec.status === "quit", rec.me);
        $("resultTitle").textContent = rec.status === "victory" ? "승리!" : rec.status === "defeat" ? "전멸..." : "중도 종료";
        $("resultTitle").className = rec.status === "victory" ? "victory" : rec.status === "defeat" ? "defeat" : "";
        $("resultSub").textContent = `${statusText(rec, rec.status === "quit")} · ${mmss(rec.time)}`;
        resultEl.classList.add("open");
      };
      box.append(item);
    }
  }
  const openRecords = () => {
    renderRecords();
    recordEl.classList.add("open");
  };

  const showLobby = (error = "") => {
    resultEl.classList.remove("open");
    roomEl.classList.remove("open");
    waitEl.classList.remove("open");
    lobbyEl.classList.add("open");
    setError(error);
  };
  const hideLobby = () => lobbyEl.classList.remove("open");

  $("lobbyQuick").onclick = () => opts.send({ t: "quick", name: name() });
  $("lobbyCreate").onclick = () => opts.send({ t: "create", name: name(), room: roomNameInput.value, private: privateInput.checked });
  const joinByCode = () => {
    const c = codeInput.value.trim();
    if (c.length < 4) return setError("방 코드 4글자를 입력해 주세요");
    opts.send({ t: "join", name: name(), code: c });
  };
  $("lobbyJoin").onclick = joinByCode;
  codeInput.onkeydown = (e) => e.key === "Enter" && joinByCode();
  // 진행 중에 나가려면 먼저 지금까지의 기록을 보여 주고 확인을 받는다
  $("roomLeave").onclick = () => {
    if (phase === "playing" && inRoom) {
      leaveAfterRecord = true;
      opts.send({ t: "record" });
    } else opts.send({ t: "leave" });
  };
  $("roomRecords").onclick = () => {
    leaveAfterRecord = false;
    if (phase === "playing" && inRoom) opts.send({ t: "record" });
    else openRecords();
  };
  $("lobbyRecords").onclick = openRecords;
  initChangelog();
  $("lobbyChangelog").onclick = () => $("changelogPanel").classList.add("open");
  $("clClose").onclick = () => $("changelogPanel").classList.remove("open");
  $("recordClose").onclick = () => recordEl.classList.remove("open");
  $("recordClear").onclick = () => {
    if (confirm("저장된 기록을 모두 지울까요?")) {
      safe.del(RECORDS_KEY);
      renderRecords();
    }
  };
  $("resultClose").onclick = () => {
    resultEl.classList.remove("open");
    leaveAfterRecord = false;
    viewing = null;
  };
  $("waitLeave").onclick = () => opts.send({ t: "leave" });
  $("resultLeave").onclick = () => {
    if (resultMode === "partial" && lastResult) saveRecord(lastResult, true); // 중도 종료도 기록으로 남긴다
    resultEl.classList.remove("open");
    opts.send({ t: "leave" });
  };
  $("resultRematch").onclick = () => opts.send({ t: "rematch" });
  $("waitReady").onclick = () => opts.send({ t: "ready", ready: !members.find((m) => m.id === myId)?.ready });
  $("waitStart").onclick = () => {
    waitErrorEl.textContent = "";
    opts.send({ t: "start" });
  };
  $("waitCopy").onclick = () => {
    void navigator.clipboard?.writeText(code).catch(() => undefined);
    $("waitCopy").textContent = "복사됨";
    setTimeout(() => ($("waitCopy").textContent = "복사"), 1200);
  };
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
          opts.send({ t: "look", look: look() });
          opts.onEnter(msg.id);
          return true;
        case "room":
          code = msg.code;
          hostId = msg.hostId;
          phase = msg.phase;
          ranked = msg.ranked;
          members = msg.players;
          $("roomTitle").textContent = msg.name;
          $("roomCode").textContent = msg.code;
          renderMembers($("roomMembers"), members, false);
          if (phase === "ended") renderResult();
          else resultEl.classList.remove("open");
          if (phase === "waiting") {
            lastResult = null;
            // 대기실: 게임 화면 대신 대기실을 보여 준다
            roomEl.classList.remove("open");
            renderWaitRoom(msg.name, msg.private);
            if (inRoom) waitEl.classList.add("open");
          } else {
            waitEl.classList.remove("open"); // 시작되었다
            waitErrorEl.textContent = "";
          }
          return true;
        case "result":
          lastResult = msg;
          if (msg.partial) {
            // 진행 중 요청한 중간 기록: 나가려던 중이면 확인 화면, 아니면 기록만 보여 준다
            roomEl.classList.remove("open"); // 방 메뉴가 기록 화면을 가리지 않게
            renderResult(msg, "partial", true);
            $("resultTitle").textContent = "진행 기록";
            $("resultLeave").style.display = leaveAfterRecord ? "" : "none";
            $("resultHint").textContent = leaveAfterRecord ? "나가면 이 기록이 최근 기록에 저장됩니다." : "";
            resultEl.classList.add("open");
            return true;
          }
          saveRecord(msg, false);
          renderResult(msg, "final");
          resultEl.classList.add("open");
          return true;
        case "left":
          inRoom = false;
          lastResult = null;
          members = [];
          waitEl.classList.remove("open");
          safe.del(TOKEN_KEY, sessionStorage);
          opts.onLeave();
          showLobby(msg.reason);
          return true;
        case "error":
          // 이어하기에 실패했다면 낡은 토큰을 버리고 로비로 보낸다
          if (!inRoom) {
            safe.del(TOKEN_KEY, sessionStorage);
            showLobby(msg.text);
          } else if (waitEl.classList.contains("open")) {
            waitErrorEl.textContent = msg.text; // 시작 실패 등
          } else {
            setError(msg.text);
          }
          return true;
        default:
          return false;
      }
    },
    playerName: () => nameInput.value.trim(),
    look,
    roomCode: () => code,
    inRoom: () => inRoom,
    blocksGameInput: () => lobbyEl.classList.contains("open") || roomEl.classList.contains("open") || waitEl.classList.contains("open") || resultEl.classList.contains("open"),
    toggleRoomPanel() {
      if (!inRoom || phase !== "playing" || resultEl.classList.contains("open") || lobbyEl.classList.contains("open") || waitEl.classList.contains("open")) return;
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
