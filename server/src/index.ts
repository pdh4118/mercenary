import { WebSocketServer, type WebSocket } from "ws";
import { TICK_RATE, type ClientMsg, type ServerMsg } from "@mercenary/shared";
import { RoomManager, type Conn } from "./rooms.js";

const PORT = Number(process.env.PORT ?? 8080);
const MAX_CONNECTIONS = 300;
const MAX_MESSAGE_BYTES = 2048; // 정상적인 메시지는 훨씬 작다
const MAX_MESSAGES_PER_SEC = 120; // 입력 20회/초 + 클릭 등을 넉넉히 허용
const PING_INTERVAL_MS = 15000;

const manager = new RoomManager();
const wss = new WebSocketServer({ port: PORT, maxPayload: MAX_MESSAGE_BYTES });

interface Meta {
  conn: Conn;
  alive: boolean;
  windowStart: number;
  count: number;
}
const metas = new Map<WebSocket, Meta>();

wss.on("connection", (ws) => {
  if (metas.size >= MAX_CONNECTIONS) {
    ws.close(1013, "서버가 가득 찼습니다");
    return;
  }
  const conn: Conn = {
    send: (msg: ServerMsg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg)),
    sendRaw: (json: string) => ws.readyState === ws.OPEN && ws.send(json),
    close: () => ws.close(),
  };
  const meta: Meta = { conn, alive: true, windowStart: Date.now(), count: 0 };
  metas.set(ws, meta);
  manager.connect(conn);

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

console.log(`[mercenary] server listening on ws://localhost:${PORT}`);
