import { Application, Container, Graphics, Text } from "pixi.js";
import {
  PLAYER_RADIUS,
  TICK_RATE,
  WORLD_SIZE,
  type ClientMsg,
  type PlayerState,
  type ServerMsg,
} from "@mercenary/shared";

const params = new URLSearchParams(location.search);
const name = params.get("name") ?? `용병단${Math.floor(Math.random() * 100)}`;
const serverUrl = params.get("server") ?? `ws://${location.hostname}:8080`;
const statusEl = document.getElementById("status")!;

const COLORS = [0xe05d5d, 0x5da6e0, 0x6fd16f, 0xe0c05d, 0xb07be0, 0x5de0d0, 0xe08f5d, 0xd96fb0];

interface View {
  node: Container;
  x: number; // 화면에 그려지는(보간된) 위치
  y: number;
}

async function main() {
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x14161c, antialias: true });
  document.body.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  // 이동이 눈에 보이도록 바닥 격자와 월드 경계를 그린다
  const grid = new Graphics();
  const half = WORLD_SIZE / 2;
  for (let v = -half; v <= half; v += 200) {
    grid.moveTo(v, -half).lineTo(v, half).moveTo(-half, v).lineTo(half, v);
  }
  grid.stroke({ width: 1, color: 0x262a35 });
  grid.rect(-half, -half, WORLD_SIZE, WORLD_SIZE).stroke({ width: 4, color: 0x5a3b3b });
  world.addChild(grid);

  const views = new Map<number, View>();
  let targets: PlayerState[] = [];
  let myId = -1;

  const ws = new WebSocket(serverUrl);
  const send = (m: ClientMsg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));
  ws.onopen = () => send({ t: "join", name });
  ws.onclose = () => (statusEl.textContent = "서버와 연결이 끊겼습니다");
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data) as ServerMsg;
    if (msg.t === "welcome") {
      myId = msg.id;
    } else if (msg.t === "full") {
      statusEl.textContent = "방이 가득 찼습니다";
    } else if (msg.t === "state") {
      targets = msg.players;
      statusEl.textContent = `${name} · 접속 ${msg.players.length}명`;
    }
  };

  // WASD / 방향키 입력. 바뀔 때만 보내고, 끊김 대비로 주기적으로도 보낸다.
  const keys = new Set<string>();
  let last = "";
  const readInput = () => ({
    dx: (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
    dy: (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0),
  });
  const pushInput = (force = false) => {
    const { dx, dy } = readInput();
    const key = `${dx},${dy}`;
    if (force || key !== last) {
      last = key;
      send({ t: "input", dx, dy });
    }
  };
  window.addEventListener("keydown", (e) => (keys.add(e.key.toLowerCase()), pushInput()));
  window.addEventListener("keyup", (e) => (keys.delete(e.key.toLowerCase()), pushInput()));
  window.addEventListener("blur", () => (keys.clear(), pushInput()));
  setInterval(() => pushInput(true), 1000 / TICK_RATE);

  function makeView(p: PlayerState): View {
    const node = new Container();
    const body = new Graphics().circle(0, 0, PLAYER_RADIUS).fill(COLORS[(p.id - 1) % COLORS.length]!);
    const label = new Text({ text: p.name, style: { fill: 0xffffff, fontSize: 13 } });
    label.anchor.set(0.5, 1);
    label.y = -PLAYER_RADIUS - 4;
    node.addChild(body, label);
    world.addChild(node);
    return { node, x: p.x, y: p.y };
  }

  app.ticker.add((ticker) => {
    const seen = new Set<number>();
    // 서버 스냅샷(20Hz)을 부드럽게 따라가도록 보간한다
    const k = 1 - Math.exp(-ticker.deltaMS / 60);
    for (const p of targets) {
      seen.add(p.id);
      let v = views.get(p.id);
      if (!v) views.set(p.id, (v = makeView(p)));
      v.x += (p.x - v.x) * k;
      v.y += (p.y - v.y) * k;
      v.node.position.set(v.x, v.y);
    }
    for (const [id, v] of views) {
      if (!seen.has(id)) {
        v.node.destroy({ children: true });
        views.delete(id);
      }
    }
    const me = views.get(myId);
    if (me) world.position.set(app.screen.width / 2 - me.x, app.screen.height / 2 - me.y);
  });
}

main();
