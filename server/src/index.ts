import { WebSocketServer, type WebSocket } from "ws";
import { TICK_RATE, type ClientMsg, type ServerMsg } from "@mercenary/shared";
import { Game } from "./game.js";

const PORT = Number(process.env.PORT ?? 8080);
const game = new Game();
const wss = new WebSocketServer({ port: PORT });
const ids = new Map<WebSocket, number>();

function send(ws: WebSocket, msg: ServerMsg): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.t === "join" && !ids.has(ws)) {
      const id = game.addPlayer(String(msg.name ?? ""));
      if (id === null) {
        send(ws, { t: "full" });
        ws.close();
        return;
      }
      ids.set(ws, id);
      send(ws, { t: "welcome", id, tick: game.tick });
    } else if (msg.t === "input") {
      const id = ids.get(ws);
      if (id !== undefined) game.setInput(id, msg);
    } else if (msg.t === "buy") {
      const id = ids.get(ws);
      if (id === undefined) return;
      const result = game.buy(id, Number(msg.camp), Number(msg.slot));
      if (!result.ok) send(ws, { t: "notice", text: result.reason });
    } else if (msg.t === "weapon") {
      const id = ids.get(ws);
      if (id !== undefined) game.setWeapon(id, msg.index);
    } else if (msg.t === "pick") {
      const id = ids.get(ws);
      if (id !== undefined) game.pick(id, Number(msg.index));
    } else if (msg.t === "dismiss") {
      const id = ids.get(ws);
      if (id === undefined) return;
      const result = game.dismiss(id, Number(msg.type));
      if (!result.ok) send(ws, { t: "notice", text: result.reason });
    } else if (msg.t === "charge") {
      const id = ids.get(ws);
      if (id !== undefined) game.charge(id, msg.x, msg.y);
    }
  });
  ws.on("close", () => {
    const id = ids.get(ws);
    if (id !== undefined) game.removePlayer(id);
    ids.delete(ws);
  });
});

setInterval(() => {
  game.step();
  const payload = JSON.stringify({
    t: "state",
    tick: game.tick,
    time: Math.round(game.time * 10) / 10,
    players: game.snapshotPlayers(),
    mercs: game.snapshotMercs(),
    camps: game.snapshotCamps(),
    enemies: game.snapshotEnemies(),
    bullets: game.snapshotBullets(),
  } satisfies ServerMsg);
  for (const ws of ids.keys()) if (ws.readyState === ws.OPEN) ws.send(payload);
}, 1000 / TICK_RATE);

console.log(`[mercenary] server listening on ws://localhost:${PORT}`);
