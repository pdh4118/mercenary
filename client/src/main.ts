import { Application, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import {
  BULLET_RADIUS,
  CAMP_USE_RADIUS,
  ENEMY_STATS,
  MERC_STATS,
  PLAYER_MAX_HP,
  PLAYER_RADIUS,
  TICK_RATE,
  UNIT_COST,
  UNIT_NAMES,
  UNIT_TYPES,
  WORLD_SIZE,
  mercPrice,
  type BulletWire,
  type CampWire,
  type ClientMsg,
  type EnemyWire,
  type MercWire,
  type PlayerState,
  type ServerMsg,
} from "@mercenary/shared";

const params = new URLSearchParams(location.search);
const name = params.get("name") ?? `용병단${Math.floor(Math.random() * 100)}`;
const serverUrl = params.get("server") ?? `ws://${location.hostname}:8080`;
const statusEl = document.getElementById("status")!;

const PLAYER_COLORS = [0xe05d5d, 0x5da6e0, 0x6fd16f, 0xe0c05d, 0xb07be0, 0x5de0d0, 0xe08f5d, 0xd96fb0];
/** 병종 색: 기병 주황, 창병 초록, 궁병 노랑, 검방병 파랑, 둔기병 보라 */
const TYPE_COLORS = [0xe8883a, 0x6fc46f, 0xe6d45d, 0x5da6e0, 0xb07be0];
const SMOOTH_MS = 60; // 서버 스냅샷(20Hz)을 따라가는 보간 시간 상수
const SNAP_DISTANCE = 200; // 이보다 멀리 떨어지면(부활·순간이동) 미끄러지지 않고 바로 이동

interface Tracked {
  node: Container;
  x: number; // 화면에 그려지는(보간된) 위치
  y: number;
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
      if (this.smooth && Math.abs(x - v.x) + Math.abs(y - v.y) < SNAP_DISTANCE) {
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

/** 병종별 모양: 기병 마름모, 창병 삼각형, 궁병 원, 검방병 사각형, 둔기병 육각형 */
function drawShape(g: Graphics, type: number, r: number): Graphics {
  switch (type) {
    case 0:
      return g.poly([0, -r * 1.2, r * 0.95, 0, 0, r * 1.2, -r * 0.95, 0]);
    case 1:
      return g.poly([0, -r * 1.15, r * 1.05, r * 0.85, -r * 1.05, r * 0.85]);
    case 2:
      return g.circle(0, 0, r);
    case 3:
      return g.roundRect(-r, -r, r * 2, r * 2, r * 0.25);
    default:
      return g.poly(Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * r * 1.1, Math.sin((i * Math.PI) / 3) * r * 1.1]).flat());
  }
}

function darken(color: number, f: number): number {
  const r = Math.round(((color >> 16) & 255) * f);
  const g = Math.round(((color >> 8) & 255) * f);
  const b = Math.round((color & 255) * f);
  return (r << 16) | (g << 8) | b;
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

  // 적은 수백 마리가 되므로 병종별 텍스처를 한 번 만들어 스프라이트로 재사용한다
  const tex = (g: Graphics): Texture => app.renderer.generateTexture(g);
  const enemyTex = UNIT_TYPES.map((t) =>
    tex(drawShape(new Graphics(), t, ENEMY_STATS[t]!.radius).fill(darken(TYPE_COLORS[t]!, 0.4)).stroke({ width: 2, color: 0x4a1212 })),
  );
  const friendlyBullet = tex(new Graphics().circle(0, 0, BULLET_RADIUS).fill(0xfff1a8));
  const hostileBullet = tex(new Graphics().circle(0, 0, BULLET_RADIUS).fill(0xff6a5a));

  const campLayer = new Container();
  const enemyLayer = new Container();
  const fxLayer = new Graphics(); // 공격 예고 부채꼴
  const bulletLayer = new Container();
  const mercLayer = new Container();
  const playerLayer = new Container();
  const chargeMark = new Graphics();
  const chargeLabel = new Text({ text: "돌격", style: { fill: 0xffc27a, fontSize: 13 } });
  chargeLabel.anchor.set(0.5, 1);
  chargeMark.visible = chargeLabel.visible = false;
  world.addChild(campLayer, enemyLayer, fxLayer, bulletLayer, mercLayer, playerLayer, chargeMark, chargeLabel);

  const enemies = new Pool<Tracked & { sprite: Sprite }, EnemyWire>(
    (w) => {
      const sprite = new Sprite(enemyTex[w[4]]!);
      sprite.anchor.set(0.5);
      enemyLayer.addChild(sprite);
      return { node: sprite, sprite, x: 0, y: 0 };
    },
    (w) => [w[0], w[1], w[2]],
    true,
  );
  const bullets = new Pool<Tracked, BulletWire>(
    (w) => {
      const sprite = new Sprite(w[3] === 1 ? hostileBullet : friendlyBullet);
      sprite.anchor.set(0.5);
      bulletLayer.addChild(sprite);
      return { node: sprite, x: 0, y: 0 };
    },
    (w) => [w[0], w[1], w[2]],
    false, // 빠르게 움직이는 투사체는 서버 위치를 그대로 그린다
  );

  const drawBar = (g: Graphics, hp: number, max: number, width: number, y: number) => {
    g.clear()
      .rect(-width / 2, y, width, 4)
      .fill(0x2a2d36)
      .rect(-width / 2, y, (width * Math.max(0, hp)) / max, 4)
      .fill(hp / max > 0.3 ? 0x6fd16f : 0xe05d5d);
  };

  interface MercView extends Tracked {
    bar: Graphics;
    lastHp: number;
  }
  const mercs = new Pool<MercView, MercWire>(
    (w) => {
      const node = new Container();
      const st = MERC_STATS[w[4]]!;
      const body = drawShape(new Graphics(), w[4], st.radius)
        .fill(TYPE_COLORS[w[4]]!)
        .stroke({ width: 3, color: PLAYER_COLORS[(w[5] - 1) % PLAYER_COLORS.length]! });
      const bar = new Graphics();
      node.addChild(body, bar);
      mercLayer.addChild(node);
      return { node, bar, x: 0, y: 0, lastHp: -1 };
    },
    (w) => [w[0], w[1], w[2]],
    true,
  );

  interface PlayerView extends Tracked {
    bar: Graphics;
    aimLine: Graphics;
  }
  const players = new Pool<PlayerView, PlayerState>(
    (p) => {
      const node = new Container();
      const aimLine = new Graphics();
      const body = new Graphics().circle(0, 0, PLAYER_RADIUS).fill(PLAYER_COLORS[(p.id - 1) % PLAYER_COLORS.length]!);
      const bar = new Graphics();
      const label = new Text({ text: p.name, style: { fill: 0xffffff, fontSize: 13 } });
      label.anchor.set(0.5, 1);
      label.y = -PLAYER_RADIUS - 10;
      node.addChild(aimLine, body, bar, label);
      playerLayer.addChild(node);
      return { node, aimLine, bar, x: 0, y: 0 };
    },
    (p) => [p.id, p.x, p.y],
    true,
  );

  interface CampView extends Tracked {
    label: Text;
  }
  const camps = new Pool<CampView, CampWire>(
    () => {
      const node = new Container();
      const ring = new Graphics().circle(0, 0, CAMP_USE_RADIUS).fill({ color: 0xe0c05d, alpha: 0.06 }).stroke({ width: 2, color: 0xe0c05d, alpha: 0.5 });
      const tent = new Graphics().poly([0, -26, 26, 20, -26, 20]).fill(0xb8863b).stroke({ width: 3, color: 0x6e4d1e });
      const label = new Text({ text: "", style: { fill: 0xf2dfa0, fontSize: 13 } });
      label.anchor.set(0.5, 0);
      label.y = 26;
      node.addChild(ring, tent, label);
      campLayer.addChild(node);
      return { node, label, x: 0, y: 0 };
    },
    (w) => [w[0], w[1], w[2]],
    false,
  );

  // --- HUD (화면 고정) -----------------------------------------------------
  const hud = new Container();
  app.stage.addChild(hud);
  const hudText = new Text({ text: "", style: { fill: 0xe6e9f0, fontSize: 15 } });
  hudText.position.set(12, 34);
  const deadText = new Text({ text: "", style: { fill: 0xffffff, fontSize: 28, stroke: { color: 0x000000, width: 4 } } });
  deadText.anchor.set(0.5);
  const campPanel = new Container();
  const campPanelBg = new Graphics();
  const campPanelText = new Text({ text: "", style: { fill: 0xf2e6c0, fontSize: 15, lineHeight: 22 } });
  campPanelText.position.set(14, 10);
  campPanel.addChild(campPanelBg, campPanelText);
  campPanel.visible = false;
  const toast = new Text({ text: "", style: { fill: 0xffb4a8, fontSize: 16, stroke: { color: 0x000000, width: 3 } } });
  toast.anchor.set(0.5, 0);

  // 도움말: 병종 모양·색과 상성
  const legend = new Container();
  const legendBg = new Graphics();
  legend.addChild(legendBg);
  let lx = 12;
  for (const t of UNIT_TYPES) {
    const icon = drawShape(new Graphics(), t, 8).fill(TYPE_COLORS[t]!);
    icon.position.set(lx + 9, 14);
    const label = new Text({ text: UNIT_NAMES[t], style: { fill: 0xcfd3dc, fontSize: 12 } });
    label.position.set(lx + 22, 6);
    legend.addChild(icon, label);
    lx += 22 + label.width + 12;
  }
  const legendText = new Text({
    text: "상성: 창병>기병 · 궁병>창병 · 검방병>궁병 · 둔기병>검방병 · 기병>창병 제외 전부",
    style: { fill: 0x9aa1b0, fontSize: 12 },
  });
  legendText.position.set(12, 26);
  legend.addChild(legendText);
  const helpText = new Text({
    text: "WASD 이동 · 좌클릭 사격 · 우클릭 기병 돌격 지시 · 캠프에서 1~3 고용 / Shift+1~5 해고",
    style: { fill: 0x9aa1b0, fontSize: 12 },
  });
  helpText.position.set(12, 44);
  legend.addChild(helpText);
  const LEGEND_H = 64;
  legendBg.rect(0, 0, Math.max(lx, legendText.width + 24, helpText.width + 24), LEGEND_H).fill({ color: 0x000000, alpha: 0.35 });
  hud.addChild(hudText, deadText, campPanel, toast, legend);

  let latest: Extract<ServerMsg, { t: "state" }> | null = null;
  let myId = -1;
  let toastLeft = 0;
  let nearCampId = -1;
  // 자동 화면 검증용: 최신 서버 상태를 읽을 수 있게 노출한다
  Object.defineProperty(window, "__game", { get: () => ({ latest, myId }) });

  const ws = new WebSocket(serverUrl);
  const send = (m: ClientMsg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(m));
  ws.onopen = () => send({ t: "join", name });
  ws.onclose = () => (statusEl.textContent = "서버와 연결이 끊겼습니다");
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data) as ServerMsg;
    if (msg.t === "welcome") myId = msg.id;
    else if (msg.t === "full") statusEl.textContent = "방이 가득 찼습니다";
    else if (msg.t === "notice") {
      toast.text = msg.text;
      toastLeft = 2.5;
    } else if (msg.t === "state") {
      latest = msg;
      statusEl.textContent = `${name} · 접속 ${msg.players.length}명`;
    }
  };

  // 입력: WASD/방향키 이동, 마우스 조준, 마우스 버튼(또는 스페이스) 누르고 있으면 발사, 캠프 근처에서 1~3 키로 고용
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
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (!e.repeat && nearCampId >= 0) {
      if (!e.shiftKey && (k === "1" || k === "2" || k === "3")) send({ t: "buy", camp: nearCampId, slot: Number(k) - 1 });
      const digit = /^Digit([1-5])$/.exec(e.code);
      if (e.shiftKey && digit) send({ t: "dismiss", type: Number(digit[1]) - 1 });
    }
    keys.add(k);
    pushInput();
  });
  window.addEventListener("keyup", (e) => (keys.delete(e.key.toLowerCase()), pushInput()));
  window.addEventListener("blur", () => ((keys.clear(), (firing = false)), pushInput()));
  app.canvas.addEventListener("pointermove", (e) => ((mouseX = e.offsetX), (mouseY = e.offsetY), pushInput()));
  app.canvas.addEventListener("pointerdown", (e) => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;
    if (e.button === 2) {
      // 우클릭: 커서가 가리키는 월드 위치로 기병 돌격 지시
      const me = latest?.players.find((p) => p.id === myId);
      if (me) send({ t: "charge", x: me.x + mouseX - app.screen.width / 2, y: me.y + mouseY - app.screen.height / 2 });
      return;
    }
    firing = true;
    pushInput();
  });
  window.addEventListener("pointerup", () => ((firing = false), pushInput()));
  app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  setInterval(() => pushInput(true), 1000 / TICK_RATE);

  /** 공격 예고(부채꼴 또는 직선). 진행될수록 진해지고, 끝나는 순간 판정이 일어난다. */
  const drawTelegraph = (x: number, y: number, ang: number, reach: number, arc: number, ranged: boolean, prog: number, color: number) => {
    if (ranged) {
      fxLayer
        .moveTo(x, y)
        .lineTo(x + Math.cos(ang) * 110, y + Math.sin(ang) * 110)
        .stroke({ width: 2 + prog * 2, color, alpha: 0.25 + 0.45 * prog });
      return;
    }
    fxLayer
      .moveTo(x, y)
      .arc(x, y, reach, ang - arc, ang + arc)
      .closePath()
      .fill({ color, alpha: 0.1 + 0.35 * prog });
  };

  app.ticker.add((ticker) => {
    if (!latest) return;
    const k = 1 - Math.exp(-ticker.deltaMS / SMOOTH_MS);

    enemies.update(latest.enemies, k, (v, w) => {
      v.sprite.alpha = 0.6 + 0.4 * Math.min(1, w[3] / ENEMY_STATS[w[4]]!.hp);
    });
    bullets.update(latest.bullets, k);
    mercs.update(latest.mercs, k, (v, w) => {
      v.node.visible = w[8] <= 0; // 쓰러진 용병은 부활할 때까지 숨긴다
      if (v.lastHp !== w[3]) {
        v.lastHp = w[3];
        drawBar(v.bar, w[3], MERC_STATS[w[4]]!.hp, 26, -MERC_STATS[w[4]]!.radius - 9);
      }
    });
    players.update(latest.players, k, (v, p) => {
      const dead = p.respawn > 0;
      v.node.alpha = dead ? 0.25 : 1;
      drawBar(v.bar, p.hp, PLAYER_MAX_HP, 36, -PLAYER_RADIUS - 6);
      v.aimLine.clear();
      if (!dead) {
        v.aimLine
          .moveTo(Math.cos(p.aim) * PLAYER_RADIUS, Math.sin(p.aim) * PLAYER_RADIUS)
          .lineTo(Math.cos(p.aim) * (PLAYER_RADIUS + 14), Math.sin(p.aim) * (PLAYER_RADIUS + 14))
          .stroke({ width: 4, color: 0xffffff });
      }
    });
    camps.update(latest.camps, k, (v, w) => {
      v.label.text = `캠프 ${Math.ceil(w[3])}초`;
    });

    // 공격 예고
    fxLayer.clear();
    for (const w of latest.enemies) {
      if (w[5] <= 0) continue;
      const v = enemies.views.get(w[0]);
      const st = ENEMY_STATS[w[4]]!;
      if (v) drawTelegraph(v.x, v.y, w[6], st.reach, st.arc, st.ranged, w[5], 0xff3b3b);
    }
    for (const w of latest.mercs) {
      if (w[5] === undefined || w[6] <= 0) continue;
      const v = mercs.views.get(w[0]);
      const st = MERC_STATS[w[4]]!;
      if (v) drawTelegraph(v.x, v.y, w[7], st.reach, st.arc, st.ranged, w[6], PLAYER_COLORS[(w[5] - 1) % PLAYER_COLORS.length]!);
    }

    // 카메라와 HUD
    const me = players.views.get(myId);
    const meState = latest.players.find((p) => p.id === myId);
    const charging = !!meState && meState.chargeLeft > 0;
    chargeMark.visible = chargeLabel.visible = charging;
    if (charging && meState) {
      const pulse = 1 + 0.12 * Math.sin(performance.now() / 120);
      chargeMark
        .clear()
        .circle(0, 0, 26 * pulse)
        .stroke({ width: 3, color: 0xffa043, alpha: 0.4 + 0.5 * Math.min(1, meState.chargeLeft / 2) })
        .circle(0, 0, 4)
        .fill(0xffa043);
      chargeMark.position.set(meState.chargeX, meState.chargeY);
      chargeLabel.position.set(meState.chargeX, meState.chargeY - 32);
    }
    if (me) world.position.set(app.screen.width / 2 - me.x, app.screen.height / 2 - me.y);
    nearCampId = -1;
    if (meState) {
      const m = Math.floor(latest.time / 60);
      const s = Math.floor(latest.time % 60).toString().padStart(2, "0");
      const mine = latest.mercs.filter((w) => w[5] === myId);
      const down = mine.filter((w) => w[8] > 0).length;
      const used = mine.reduce((sum, w) => sum + UNIT_COST[w[4]]!, 0);
      hudText.text =
        `HP ${Math.ceil(meState.hp)}/${PLAYER_MAX_HP}   금화 ${meState.gold}   처치 ${meState.kills}   ${m}:${s}\n` +
        `통솔력 ${used}/${meState.leadership}   용병 ${mine.length}명` +
        (down > 0 ? `  (쓰러짐 ${down}명, 부활 대기)` : "");
      deadText.text = meState.respawn > 0 ? `쓰러졌습니다 - ${Math.ceil(meState.respawn)}초 뒤 부활` : "";

      // 가까운 캠프의 고용 목록
      let best: CampWire | null = null;
      let bestD = CAMP_USE_RADIUS;
      for (const c of latest.camps) {
        const d = Math.hypot(c[1] - meState.x, c[2] - meState.y);
        if (d <= bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best && meState.respawn <= 0) {
        nearCampId = best[0];
        const owned = mine.length;
        const lines = ["캠프 - 고용 (숫자 키)"];
        [best[4], best[5], best[6]].forEach((t, i) => {
          const price = mercPrice(t, owned);
          const noLeader = used + UNIT_COST[t]! > meState.leadership;
          lines.push(
            `[${i + 1}] ${UNIT_NAMES[t]}  ${price}G  통솔 ${UNIT_COST[t]}` +
              (noLeader ? "  (통솔력 부족)" : meState.gold < price ? "  (금화 부족)" : ""),
          );
        });
        const counts = UNIT_TYPES.map((t) => mine.filter((w) => w[4] === t).length);
        if (counts.some((c) => c > 0)) {
          lines.push("해고 (Shift+숫자, 절반 환급)");
          UNIT_TYPES.forEach((t) => counts[t]! > 0 && lines.push(`[Shift+${t + 1}] ${UNIT_NAMES[t]} x${counts[t]}`));
        }
        campPanelText.text = lines.join("\n");
        campPanelBg.clear().roundRect(0, 0, campPanelText.width + 28, campPanelText.height + 20, 8).fill({ color: 0x000000, alpha: 0.6 }).stroke({ width: 1, color: 0xe0c05d });
        campPanel.visible = true;
      } else {
        campPanel.visible = false;
      }
    }
    toastLeft = Math.max(0, toastLeft - ticker.deltaMS / 1000);
    toast.visible = toastLeft > 0;
    deadText.position.set(app.screen.width / 2, app.screen.height / 2 - 80);
    campPanel.position.set(app.screen.width / 2 - campPanel.width / 2, app.screen.height - campPanel.height - 84);
    toast.position.set(app.screen.width / 2, 74);
    legend.position.set(0, app.screen.height - LEGEND_H);
  });
}

main();
