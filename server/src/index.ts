import { createServer, type IncomingMessage } from "node:http";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { TICK_RATE, tuneOverrides, type ClientMsg, type ServerMsg } from "@mercenary/shared";
import { RoomManager, type Conn } from "./rooms.js";
import { serveStatic } from "./static.js";
import { handleTuningApi, loadTuning, TUNING_FILE } from "./tuning-store.js";
import { appendMatch, handleStatsApi, STATS_FILE } from "./stats-store.js";

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";
/** 빌드된 클라이언트 위치. 기본은 저장소의 client/dist */
const STATIC_DIR = process.env.STATIC_DIR ?? fileURLToPath(new URL("../../client/dist", import.meta.url));
/** 쉼표로 구분한 허용 출처(예: https://game.example.com). 비우면 모두 허용한다. */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS ?? 300);
/** 프록시/터널 뒤에서 실제 접속자 주소를 헤더에서 읽는다. 직접 인터넷에 열어 둘 때는 켜지 말 것(헤더를 속일 수 있다). */
const TRUST_PROXY = process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true";
const MAX_MESSAGE_BYTES = 2048; // 정상적인 메시지는 훨씬 작다
const MAX_MESSAGES_PER_SEC = 120; // 입력 20회/초 + 클릭 등을 넉넉히 허용
const PING_INTERVAL_MS = 15000;

const loadedTuning = loadTuning();
if (loadedTuning > 0) console.log(`[mercenary] 수치 조정 ${loadedTuning}개를 ${TUNING_FILE}에서 불러왔습니다`);
const manager = new RoomManager();
manager.onMatch = (rec) => appendMatch(rec); // 밸런스 통계: 한 판이 끝날 때마다 한 줄 기록한다(보기: /stats.html)
console.log(`[mercenary] 밸런스 통계 파일: ${STATS_FILE}`);
const hasClient = existsSync(STATIC_DIR);

const http = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, rooms: manager.roomCount(), connections: metas.size }));
    return;
  }
  if (req.url?.startsWith("/api/stats")) {
    handleStatsApi(req, res);
    return;
  }
  if (req.url?.startsWith("/api/tuning")) {
    void handleTuningApi(req, res, (values) => {
      for (const m of metas.values()) m.conn.send({ t: "tuning", values }); // 접속 중인 모두에게 바로 전달
    });
    return;
  }
  if (!hasClient) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("클라이언트가 빌드되지 않았습니다. `npm run build`를 먼저 실행하세요.");
    return;
  }
  serveStatic(STATIC_DIR, req, res);
});

const wss = new WebSocketServer({
  server: http,
  path: "/ws",
  maxPayload: MAX_MESSAGE_BYTES,
  // 상태 메시지는 반복되는 구조라 압축이 잘 된다(약 1/3). 낮은 압축 단계로 CPU 부담을 줄인다.
  perMessageDeflate: {
    threshold: 512,
    zlibDeflateOptions: { level: 1 },
    serverNoContextTakeover: true,
    clientNoContextTakeover: true,
    concurrencyLimit: 10,
  },
  verifyClient: ({ origin }: { origin: string }) => ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin),
});

interface Meta {
  conn: Conn;
  alive: boolean;
  windowStart: number;
  count: number;
}
const metas = new Map<WebSocket, Meta>();

/** 코드 무작위 대입 차단에 쓸 접속 주소 */
function clientIp(req: IncomingMessage): string | undefined {
  if (TRUST_PROXY) {
    const cf = req.headers["cf-connecting-ip"];
    if (typeof cf === "string" && cf) return cf.trim();
    const xff = req.headers["x-forwarded-for"];
    const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? undefined;
}

wss.on("connection", (ws, req) => {
  if (metas.size >= MAX_CONNECTIONS) {
    ws.close(1013, "서버가 가득 찼습니다");
    return;
  }
  const conn: Conn = {
    ip: clientIp(req),
    send: (msg: ServerMsg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg)),
    sendRaw: (json: string) => ws.readyState === ws.OPEN && ws.send(json),
    close: () => ws.close(),
  };
  const meta: Meta = { conn, alive: true, windowStart: Date.now(), count: 0 };
  metas.set(ws, meta);
  manager.connect(conn);
  const tuned = tuneOverrides();
  if (Object.keys(tuned).length > 0) conn.send({ t: "tuning", values: tuned }); // 조정된 수치가 있으면 클라이언트도 같은 값을 쓰게 한다

  ws.on("pong", () => (meta.alive = true));
  ws.on("message", (raw) => {
    // 너무 잦은 메시지는 무시한다
    const now = Date.now();
    if (now - meta.windowStart >= 1000) {
      meta.windowStart = now;
      meta.count = 0;
    }
    if (++meta.count > MAX_MESSAGES_PER_SEC) return;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object" || typeof (msg as { t?: unknown }).t !== "string") return;
    try {
      manager.handle(conn, msg);
    } catch (err) {
      console.error("[mercenary] 메시지 처리 오류", err);
    }
  });
  ws.on("close", () => {
    metas.delete(ws);
    manager.disconnect(conn);
  });
  ws.on("error", () => ws.terminate());
});

// 응답 없는 연결(전원이 꺼지거나 네트워크가 끊긴 경우)을 정리한다. 정리되면 재접속 대기 시간이 시작된다.
setInterval(() => {
  for (const [ws, meta] of metas) {
    if (!meta.alive) {
      ws.terminate();
      continue;
    }
    meta.alive = false;
    ws.ping();
  }
}, PING_INTERVAL_MS);

setInterval(() => manager.step(), 1000 / TICK_RATE);

http.listen(PORT, HOST, () => {
  console.log(`[mercenary] http://${HOST}:${PORT}  (게임 접속: /ws, 상태 확인: /healthz)`);
  console.log(`[mercenary] 수치 조정 화면: http://localhost:${PORT}/tuning.html  (이 컴퓨터에서, 파일을 직접 열지 말고 이 주소로 여세요)`);
  if (!hasClient) console.log(`[mercenary] 경고: ${STATIC_DIR} 가 없습니다. 클라이언트를 서비스하려면 'npm run build'를 실행하세요.`);
  if (ALLOWED_ORIGINS.length) console.log(`[mercenary] 허용 출처: ${ALLOWED_ORIGINS.join(", ")}`);
});
