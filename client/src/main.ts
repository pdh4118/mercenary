import { Application, Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import {
  BULLET_RADIUS,
  CARDS,
  CARD_CATEGORY_NAMES,
  CAMP_USE_RADIUS,
  COUNTER_MATRIX,
  LEVELUP_PUSH_RADIUS,
  SWING_VISUAL_SEC,
  WEAPONS,
  ENEMY_STATS,
  MERC_STATS,
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
/** 스프라이트 파일 이름(병종 번호 순서) */
const UNIT_FILES = ["cavalry", "spear", "archer", "sword", "mace"] as const;
/** 이미지는 화면 표시 크기의 약 2배로 만들어 두었다 */
const SPRITE_SCALE = 0.5;
/** 스프라이트 기준점: 가로 중앙, 세로는 몸통 쪽(발은 그 아래). 서버의 유닛 좌표가 몸통 중심이 된다. */
const SPRITE_ANCHOR_Y = 0.65;
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

  // 병종 스프라이트(기병, 창병, 궁병, 검방병, 둔기병 순). 적은 수백 마리가 되므로 텍스처 하나를 모두가 공유한다.
  const loadUnits = (side: "ally" | "enemy") => Promise.all(UNIT_FILES.map((f) => Assets.load<Texture>(`assets/units/${side}_${f}.png`)));
  const [allyTex, enemyTex] = await Promise.all([loadUnits("ally"), loadUnits("enemy")]);
  const tex = (g: Graphics): Texture => app.renderer.generateTexture(g);
  const friendlyBullet = tex(new Graphics().circle(0, 0, BULLET_RADIUS).fill(0xfff1a8));
  const hostileBullet = tex(new Graphics().circle(0, 0, BULLET_RADIUS).fill(0xff6a5a));

  const campLayer = new Container();
  const enemyLayer = new Container();
  const fxLayer = new Graphics(); // 공격 예고 부채꼴
  const bulletLayer = new Container();
  const mercLayer = new Container();
  const playerLayer = new Container();
  enemyLayer.sortableChildren = true; // 아래쪽에 있는 유닛이 위에 그려지게(깊이 정렬)
  mercLayer.sortableChildren = true;
  const chargeMark = new Graphics();
  const chargeLabel = new Text({ text: "돌격", style: { fill: 0xffc27a, fontSize: 13 } });
  chargeLabel.anchor.set(0.5, 1);
  chargeMark.visible = chargeLabel.visible = false;
  world.addChild(campLayer, enemyLayer, fxLayer, bulletLayer, mercLayer, playerLayer, chargeMark, chargeLabel);

  /** 스프라이트는 오른쪽을 보고 그려져 있어, 왼쪽으로 움직이거나 공격할 때는 좌우 반전한다 */
  interface Facing {
    lastX: number;
    face: 1 | -1;
  }
  const faceFrom = (v: Facing, x: number, attackAng: number | null) => {
    if (attackAng !== null) v.face = Math.cos(attackAng) >= 0 ? 1 : -1;
    else if (Math.abs(x - v.lastX) > 0.15) v.face = x > v.lastX ? 1 : -1;
    v.lastX = x;
  };

  const enemies = new Pool<Tracked & Facing & { sprite: Sprite }, EnemyWire>(
    (w) => {
      const sprite = new Sprite(enemyTex[w[4]]!);
      sprite.anchor.set(0.5, SPRITE_ANCHOR_Y);
      enemyLayer.addChild(sprite);
      return { node: sprite, sprite, x: 0, y: 0, lastX: w[1], face: 1 };
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

  interface MercView extends Tracked, Facing {
    bar: Graphics;
    sprite: Sprite;
    lastKey: string;
  }
  const mercs = new Pool<MercView, MercWire>(
    (w) => {
      const node = new Container();
      const st = MERC_STATS[w[4]]!;
      const t = allyTex[w[4]]!;
      const color = PLAYER_COLORS[(w[5] - 1) % PLAYER_COLORS.length]!;
      // 어느 플레이어의 용병인지 발밑 고리 색으로 구분한다
      const footY = t.height * SPRITE_SCALE * (1 - SPRITE_ANCHOR_Y) * 0.85;
      const ring = new Graphics()
        .ellipse(0, footY, st.radius * 1.25, st.radius * 0.6)
        .fill({ color, alpha: 0.28 })
        .stroke({ width: 3, color });
      const sprite = new Sprite(t);
      sprite.anchor.set(0.5, SPRITE_ANCHOR_Y);
      const bar = new Graphics();
      node.addChild(ring, sprite, bar);
      mercLayer.addChild(node);
      return { node, bar, sprite, x: 0, y: 0, lastKey: "", lastX: w[1], face: 1 };
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
    const icon = new Sprite(allyTex[t]!);
    icon.anchor.set(0.5);
    icon.scale.set(22 / icon.texture.height);
    icon.position.set(lx + 14, 14);
    const label = new Text({ text: UNIT_NAMES[t], style: { fill: 0xcfd3dc, fontSize: 12 } });
    label.position.set(lx + 32, 6);
    legend.addChild(icon, label);
    lx += 32 + label.width + 12;
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
  const xpBar = new Graphics();
  const levelToast = new Text({ text: "", style: { fill: 0xffe08a, fontSize: 20, stroke: { color: 0x000000, width: 3 } } });
  levelToast.anchor.set(0.5, 0);

  // 레벨업 카드: 게임을 멈추지 않는 작은 카드. Z/X/C 한 번으로 고른다.
  const CARD_W = 244;
  const CARD_H = 78;
  const CARD_GAP = 8;
  const CATEGORY_COLORS = [0xe0c05d, 0x6fd16f, 0x5da6e0];
  const cardPanel = new Container();
  const cardHeader = new Text({ text: "", style: { fill: 0xffe08a, fontSize: 14 } });
  cardPanel.addChild(cardHeader);
  const cardViews = [0, 1, 2].map((i) => {
    const node = new Container();
    node.position.set(0, 26 + i * (CARD_H + CARD_GAP));
    const bg = new Graphics();
    const key = new Text({ text: "ZXC"[i]!, style: { fill: 0xffffff, fontSize: 22, fontWeight: "bold" } });
    key.position.set(14, 22);
    const title = new Text({ text: "", style: { fill: 0xffffff, fontSize: 15, fontWeight: "bold" } });
    title.position.set(46, 8);
    const desc = new Text({ text: "", style: { fill: 0xc8ccd6, fontSize: 12, wordWrap: true, wordWrapWidth: CARD_W - 60 } });
    desc.position.set(46, 30);
    node.addChild(bg, key, title, desc);
    cardPanel.addChild(node);
    return { node, bg, title, desc };
  });
  cardPanel.visible = false;
  let shownOffer = "";
  const showOffer = (offer: number[], pending: number) => {
    const key = `${offer.join(",")}|${pending}`;
    if (key === shownOffer) return;
    shownOffer = key;
    cardPanel.visible = offer.length > 0;
    cardHeader.text = offer.length > 0 ? `레벨 업! 카드를 고르세요${pending > 1 ? `  (대기 ${pending}회)` : ""}` : "";
    cardViews.forEach((v, i) => {
      const card = offer[i] !== undefined ? CARDS[offer[i]!] : undefined;
      v.node.visible = !!card;
      if (!card) return;
      v.title.text = card.name;
      v.desc.text = `[${CARD_CATEGORY_NAMES[card.category]}] ${card.desc}`;
      v.bg
        .clear()
        .roundRect(0, 0, CARD_W, CARD_H, 8)
        .fill({ color: 0x000000, alpha: 0.7 })
        .stroke({ width: 1, color: CATEGORY_COLORS[card.category]! })
        .rect(0, 0, 6, CARD_H)
        .fill(CATEGORY_COLORS[card.category]!);
    });
  };
  // 무기 바: 현재 무기와 상성(유리/불리)을 보여 준다
  const SLOT_W = 76;
  const weaponBar = new Container();
  const weaponSlots = WEAPONS.map((w, i) => {
    const node = new Container();
    node.position.set(i * (SLOT_W + 4), 16);
    const bg = new Graphics();
    const label = new Text({ text: w.name, style: { fill: 0xffffff, fontSize: 15, fontWeight: "bold" } });
    label.anchor.set(0.5, 0);
    label.position.set(SLOT_W / 2, 8);
    const sub = new Text({ text: `${UNIT_NAMES[w.type]}계`, style: { fill: 0xb8bdc9, fontSize: 11 } });
    sub.anchor.set(0.5, 0);
    sub.position.set(SLOT_W / 2, 30);
    node.addChild(bg, label, sub);
    weaponBar.addChild(node);
    return { bg };
  });
  const weaponHint = new Text({ text: "", style: { fill: 0xcfd3dc, fontSize: 12 } });
  weaponHint.position.set(0, 70);
  const weaponTitle = new Text({ text: "무기 전환: Q / 마우스 휠", style: { fill: 0x9aa1b0, fontSize: 11 } });
  weaponBar.addChild(weaponTitle, weaponHint);
  let shownWeapon = -1;
  const drawWeaponBar = (active: number) => {
    if (active === shownWeapon) return;
    shownWeapon = active;
    weaponSlots.forEach((slot, i) => {
      const color = TYPE_COLORS[WEAPONS[i]!.type]!;
      slot.bg
        .clear()
        .roundRect(0, 0, SLOT_W, 50, 6)
        .fill({ color: i === active ? darken(color, 0.55) : 0x000000, alpha: i === active ? 0.9 : 0.5 })
        .stroke({ width: i === active ? 3 : 1, color });
    });
    const row = COUNTER_MATRIX[WEAPONS[active]!.type]!;
    const names = (pred: (m: number) => boolean) => UNIT_TYPES.filter((t) => pred(row[t]!)).map((t) => UNIT_NAMES[t]).join("·") || "-";
    weaponHint.text = `유리: ${names((m) => m > 1)}   불리: ${names((m) => m < 1)}`;
  };
  weaponBar.visible = false;
  hud.addChild(hudText, xpBar, weaponBar, deadText, campPanel, toast, levelToast, cardPanel, legend);

  const levelOf = new Map<number, number>();
  const rings: { x: number; y: number; age: number }[] = [];
  const RING_SEC = 0.5;
  let latest: Extract<ServerMsg, { t: "state" }> | null = null;
  let myId = -1;
  let toastLeft = 0;
  let levelToastLeft = 0;
  let lastLevel = 0;
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
  const cycleWeapon = (dir: number) => {
    const cur = latest?.players.find((p) => p.id === myId)?.weapon;
    if (cur === undefined) return;
    send({ t: "weapon", index: (cur + dir + WEAPONS.length) % WEAPONS.length });
  };
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
    if (!e.repeat && k === "q") cycleWeapon(1);
    if (!e.repeat && (k === "z" || k === "x" || k === "c")) send({ t: "pick", index: "zxc".indexOf(k) });
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
  app.canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.deltaY !== 0) cycleWeapon(e.deltaY > 0 ? 1 : -1);
    },
    { passive: false },
  );
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
      faceFrom(v, v.x, w[5] > 0 ? w[6] : null);
      v.sprite.scale.set(SPRITE_SCALE * v.face, SPRITE_SCALE);
      v.sprite.zIndex = v.y;
      v.sprite.alpha = 0.7 + 0.3 * Math.min(1, w[3] / ENEMY_STATS[w[4]]!.hp);
    });
    bullets.update(latest.bullets, k);
    mercs.update(latest.mercs, k, (v, w) => {
      v.node.visible = w[8] <= 0; // 쓰러진 용병은 부활할 때까지 숨긴다
      faceFrom(v, v.x, w[6] > 0 ? w[7] : null);
      v.sprite.scale.set(SPRITE_SCALE * v.face, SPRITE_SCALE);
      v.node.zIndex = v.y;
      const key = `${w[3]}/${w[9]}`;
      if (v.lastKey !== key) {
        v.lastKey = key;
        drawBar(v.bar, w[3], w[9], 26, -allyTex[w[4]]!.height * SPRITE_SCALE * SPRITE_ANCHOR_Y - 6);
      }
    });
    players.update(latest.players, k, (v, p) => {
      const dead = p.respawn > 0;
      v.node.alpha = dead ? 0.25 : 1;
      drawBar(v.bar, p.hp, p.maxHp, 36, -PLAYER_RADIUS - 6);
      v.aimLine.clear();
      if (!dead) {
        v.aimLine
          .moveTo(Math.cos(p.aim) * PLAYER_RADIUS, Math.sin(p.aim) * PLAYER_RADIUS)
          .lineTo(Math.cos(p.aim) * (PLAYER_RADIUS + 14), Math.sin(p.aim) * (PLAYER_RADIUS + 14))
          .stroke({ width: 4, color: TYPE_COLORS[WEAPONS[p.weapon]!.type]! });
      }
      // 레벨업을 감지해 밀어내기 고리를 띄운다(처음 접속 시에는 제외)
      const seenLevel = levelOf.get(p.id);
      if (seenLevel !== undefined && p.level > seenLevel) rings.push({ x: v.x, y: v.y, age: 0 });
      levelOf.set(p.id, p.level);
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

    // 근접 무기 휘두르기 이펙트와 레벨업 밀어내기 고리
    for (const p of latest.players) {
      const w = WEAPONS[p.weapon]!;
      const v = players.views.get(p.id);
      if (!v || p.swing <= 0 || w.ranged) continue;
      fxLayer
        .moveTo(v.x, v.y)
        .arc(v.x, v.y, w.reach, p.aim - w.arc, p.aim + w.arc)
        .closePath()
        .fill({ color: TYPE_COLORS[w.type]!, alpha: 0.55 * Math.min(1, p.swing / SWING_VISUAL_SEC) });
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]!;
      r.age += ticker.deltaMS / 1000;
      if (r.age >= RING_SEC) {
        rings.splice(i, 1);
        continue;
      }
      const k2 = r.age / RING_SEC;
      fxLayer.circle(r.x, r.y, LEVELUP_PUSH_RADIUS * (0.25 + 0.75 * k2)).stroke({ width: 5 * (1 - k2) + 1, color: 0xffe08a, alpha: 0.8 * (1 - k2) });
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
        `HP ${Math.ceil(meState.hp)}/${meState.maxHp}   금화 ${meState.gold}   처치 ${meState.kills}   ${m}:${s}\n` +
        `통솔력 ${used}/${meState.leadership}   용병 ${mine.length}명` +
        (down > 0 ? `  (쓰러짐 ${down}명, 부활 대기)` : "") +
        `\nLv ${meState.level}`;
      xpBar
        .clear()
        .roundRect(52, 91, 160, 7, 3)
        .fill(0x2a2d36)
        .roundRect(52, 91, 160 * Math.min(1, meState.xp / meState.xpNeed), 7, 3)
        .fill(0xffe08a);
      showOffer(meState.offer, meState.pending);
      weaponBar.visible = true;
      drawWeaponBar(meState.weapon);
      if (lastLevel > 0 && meState.level > lastLevel) {
        levelToast.text = `레벨 ${meState.level}!`;
        levelToastLeft = 2;
      }
      lastLevel = meState.level;
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
          const price = Math.round(mercPrice(t, owned) * meState.priceMult);
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
    levelToastLeft = Math.max(0, levelToastLeft - ticker.deltaMS / 1000);
    levelToast.visible = levelToastLeft > 0;
    levelToast.position.set(app.screen.width / 2, 100);
    weaponBar.position.set(app.screen.width - (WEAPONS.length * (SLOT_W + 4) - 4) - 12, app.screen.height - 100);
    cardPanel.position.set(app.screen.width - CARD_W - 12, Math.max(110, app.screen.height / 2 - 130));
    toastLeft = Math.max(0, toastLeft - ticker.deltaMS / 1000);
    toast.visible = toastLeft > 0;
    deadText.position.set(app.screen.width / 2, app.screen.height / 2 - 80);
    campPanel.position.set(app.screen.width / 2 - campPanel.width / 2, app.screen.height - campPanel.height - 112);
    toast.position.set(app.screen.width / 2, 74);
    legend.position.set(0, app.screen.height - LEGEND_H);
  });
}

main();
