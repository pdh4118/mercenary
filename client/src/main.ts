import { Application, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import {
  BULLET_RADIUS,
  ENEMY_HP,
  ENEMY_RADIUS,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  TICK_RATE,
  WORLD_SIZE,
  type BulletWire,
  type ClientMsg,
  type EnemyWire,
  type PlayerState,
  type ServerMsg,
} from "@mercenary/shared";

const params = new URLSearchParams(location.search);
const name = params.get("name") ?? `용병단${Math.floor(Math.random() * 100)}`;
const serverUrl = params.get("server") ?? `ws://${location.hostname}:8080`;
const statusEl = document.getElementById("status")!;

const COLORS = [0xe05d5d, 0x5da6e0, 0x6fd16f, 0xe0c05d, 0xb07be0, 0x5de0d0, 0xe08f5d, 0xd96fb0];
const SMOOTH_MS = 60; // 서버 스냅샷(20Hz)을 따라가는 보간 시간 상수

interface Tracked {
  node: Container;
  x: number; // 화면에 그려지는(보간된) 위치
  y: number;
}

interface PlayerView extends Tracked {
  bar: Graphics;
  aimLine: Graphics;
  body: Graphics;
}

/** id로 객체를 추적하며 서버 위치로 부드럽게 따라가게 하는 풀. 사라진 id의 노드는 제거한다. */
class Pool<T extends Tracked, W> {
  readonly views = new Map<number, T>();
  constructor(
    private make: (w: W) => T,
    private pos: (w: W) => [id: number, x: number, y: number],
    private smooth: boolean,
  ) {}

  update(items: W[], k: number, onEach?: (v: T, w: W) => void): void {
    const seen = new Set<number>();
    for (const w of items) {
      const [id, x, y] = this.pos(w);
      seen.add(id);
      let v = this.views.get(id);
      if (!v) {
        v = this.make(w);
        v.x = x;
        v.y = y;
        this.views.set(id, v);
      }
      if (this.smooth) {
        v.x += (x - v.x) * k;
        v.y += (y - v.y) * k;
      } else {
        v.x = x;
        v.y = y;
      }
      v.node.position.set(v.x, v.y);
      onEach?.(v, w);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        v.node.destroy({ children: true });
        this.views.delete(id);
      }
    }
  }
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

  // 적·투사체는 수백 개가 되므로 텍스처를 한 번 만들어 스프라이트로 재사용한다
  const tex = (g: Graphics): Texture => app.renderer.generateTexture(g);
  const enemyTex = tex(
    new Graphics().circle(0, 0, ENEMY_RADIUS).fill(0x8a3fb0).stroke({ width: 2, color: 0x4b1f66 }),
  );
  const bulletTex = tex(new Graphics().circle(0, 0, BULLET_RADIUS).fill(0xfff1a8));

  const enemyLayer = new Container();
  const bulletLayer = new Container();
  const playerLayer = new Container();
  world.addChild(enemyLayer, bulletLayer, playerLayer);

  const enemies = new Pool<Tracked & { sprite: Sprite }, EnemyWire>(
    (w) => {
      const sprite = new Sprite(enemyTex);
      sprite.anchor.set(0.5);
      enemyLayer.addChild(sprite);
      void w;
      return { node: sprite, sprite, x: 0, y: 0 };
    },
    (w) => [w[0], w[1], w[2]],
    true,
  );
  const bullets = new Pool<Tracked, BulletWire>(
    () => {
      const sprite = new Sprite(bulletTex);
      sprite.anchor.set(0.5);
      bulletLayer.addChild(sprite);
      return { node: sprite, x: 0, y: 0 };
    },
    (w) => [w[0], w[1], w[2]],
    false, // 빠르게 움직이는 투사체는 서버 위치를 그대로 그린다
  );
  const players = new Pool<PlayerView, PlayerState>(
    (p) => {
      const node = new Container();
      const aimLine = new Graphics();
      const body = new Graphics().circle(0, 0, PLAYER_RADIUS).fill(COLORS[(p.id - 1) % COLORS.length]!);
      const bar = new Graphics();
      const label = new Text({ text: p.name, style: { fill: 0xffffff, fontSize: 13 } });
      label.anchor.set(0.5, 1);
      label.y = -PLAYER_RADIUS - 10;
      node.addChild(aimLine, body, bar, label);
      playerLayer.addChild(node);
      return { node, aimLine, body, bar, x: 0, y: 0 };
    },
    (p) => [p.id, p.x, p.y],
    true,
  );

  // HUD (화면 고정)
  const hud = new Container();
  app.stage.addChild(hud);
  const hudText = new Text({ text: "", style: { fill: 0xe6e9f0, fontSize: 15 } });
  hudText.position.set(12, 34);
  const deadText = new Text({
    text: "",
    style: { fill: 0xffffff, fontSize: 28, stroke: { color: 0x000000, width: 4 } },
  });
  deadText.anchor.set(0.5);
  hud.addChild(hudText, deadText);

  let latest: Extract<ServerMsg, { t: "state" }> | null = null;
  let myId = -1;

  const ws = new WebSocket(serverUrl);
  const send = (m: ClientMsg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));
  ws.onopen = () => send({ t: "join", name });
  ws.onclose = () => (statusEl.textContent = "서버와 연결이 끊겼습니다");
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data) as ServerMsg;
    if (msg.t === "welcome") myId = msg.id;
    else if (msg.t === "full") statusEl.textContent = "방이 가득 찼습니다";
    else if (msg.t === "state") {
      latest = msg;
      statusEl.textContent = `${name} · 접속 ${msg.players.length}명`;
    }
  };

  // 입력: WASD/방향키 이동, 마우스 조준, 마우스 버튼(또는 스페이스) 누르고 있으면 발사
  const keys = new Set<string>();
  let firing = false;
  let mouseX = app.screen.width / 2 + 1;
  let mouseY = app.screen.height / 2;
  let last = "";
  const readAim = () => Math.atan2(mouseY - app.screen.height / 2, mouseX - app.screen.width / 2);
  const pushInput = (force = false) => {
    const dx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
    const dy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
    const fire = firing || keys.has(" ");
    const aim = Math.round(readAim() * 100) / 100;
    const key = `${dx},${dy},${aim},${fire}`;
    if (force || key !== last) {
      last = key;
      send({ t: "input", dx, dy, aim, fire });
    }
  };
  window.addEventListener("keydown", (e) => (keys.add(e.key.toLowerCase()), pushInput()));
  window.addEventListener("keyup", (e) => (keys.delete(e.key.toLowerCase()), pushInput()));
  window.addEventListener("blur", () => ((keys.clear(), (firing = false)), pushInput()));
  app.canvas.addEventListener("pointermove", (e) => ((mouseX = e.offsetX), (mouseY = e.offsetY), pushInput()));
  app.canvas.addEventListener("pointerdown", (e) => ((mouseX = e.offsetX), (mouseY = e.offsetY), (firing = true), pushInput()));
  window.addEventListener("pointerup", () => ((firing = false), pushInput()));
  app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  setInterval(() => pushInput(true), 1000 / TICK_RATE);

  function drawHpBar(g: Graphics, hp: number): void {
    const w = 36;
    const y = -PLAYER_RADIUS - 6;
    g.clear().rect(-w / 2, y, w, 4).fill(0x2a2d36).rect(-w / 2, y, (w * hp) / PLAYER_MAX_HP, 4).fill(hp > 30 ? 0x6fd16f : 0xe05d5d);
  }

  app.ticker.add((ticker) => {
    if (!latest) return;
    const k = 1 - Math.exp(-ticker.deltaMS / SMOOTH_MS);
    enemies.update(latest.enemies, k, (v, w) => {
      // 맞은 적은 체력 비율만큼 어둡게
      v.sprite.alpha = 0.55 + 0.45 * (w[3] / ENEMY_HP);
    });
    bullets.update(latest.bullets, k);
    players.update(latest.players, k, (v, p) => {
      const dead = p.respawn > 0;
      v.node.alpha = dead ? 0.25 : 1;
      drawHpBar(v.bar, p.hp);
      v.aimLine.clear();
      if (!dead) {
        v.aimLine
          .moveTo(Math.cos(p.aim) * PLAYER_RADIUS, Math.sin(p.aim) * PLAYER_RADIUS)
          .lineTo(Math.cos(p.aim) * (PLAYER_RADIUS + 14), Math.sin(p.aim) * (PLAYER_RADIUS + 14))
          .stroke({ width: 4, color: 0xffffff });
      }
    });

    const me = players.views.get(myId);
    const meState = latest.players.find((p) => p.id === myId);
    if (me) world.position.set(app.screen.width / 2 - me.x, app.screen.height / 2 - me.y);
    if (meState) {
      const m = Math.floor(latest.time / 60);
      const s = Math.floor(latest.time % 60).toString().padStart(2, "0");
      hudText.text = `HP ${Math.ceil(meState.hp)}/${PLAYER_MAX_HP}   처치 ${meState.kills}   ${m}:${s}`;
      deadText.text = meState.respawn > 0 ? `쓰러졌습니다 - ${Math.ceil(meState.respawn)}초 뒤 부활` : "";
    }
    deadText.position.set(app.screen.width / 2, app.screen.height / 2 - 80);
  });
}

main();
