import { Application, Assets, Container, Graphics, Sprite, Text, TilingSprite, type Texture } from "pixi.js";
import { createLobby } from "./lobby.js";
import { createFormationUi } from "./formation.js";
import {
  CARDS,
  CARD_CATEGORY_NAMES,
  CAMP_USE_RADIUS,
  SHIELD,
  SHIELD_FRONT_ARC,
  ARCHER as ARCHER_TYPE,
  BLUNT as BLUNT_TYPE,
  SPEAR as SPEAR_TYPE,
  LEVELUP_PUSH_RADIUS,
  SWING_VISUAL_SEC,
  WEAPONS,
  ENEMY_STATS,
  BOSS_SIZE,
  EVT_ARROW_HIT,
  EVT_ENEMY_ARROW_HIT,
  EVT_REVIVE,
  EVT_SHIELD_BREAK,
  EVT_SHIELD_BLOCK,
  REVIVE_RADIUS,
  STAGE_COUNT,
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
// 기본은 접속한 주소와 같은 곳의 /ws. HTTPS 페이지에서는 자동으로 wss가 된다. 개발 서버도 /ws를 게임 서버로 넘겨 준다.
const serverUrl = params.get("server") ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
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
/** 주인공 스프라이트 파일 이름(무기 순서: 활, 창, 검, 철퇴) */
const HERO_FILES = ["archer", "spear", "sword", "mace"] as const;
/** 주인공은 일반 병사보다 한눈에 띄게 조금 크게 그린다 */
const HERO_SCALE = 0.62;
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
    private onRemove?: (v: T) => void,
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
        this.onRemove?.(v);
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

  const half = WORLD_SIZE / 2;
  // 병종 스프라이트(기병, 창병, 궁병, 검방병, 둔기병 순). 적은 수백 마리가 되므로 텍스처 하나를 모두가 공유한다.
  const loadUnits = (side: "ally" | "enemy") => Promise.all(UNIT_FILES.map((f) => Assets.load<Texture>(`assets/units/${side}_${f}.png`)));
  const [allyTex, enemyTex] = await Promise.all([loadUnits("ally"), loadUnits("enemy")]);
  // 주인공(무기별), 캠프, 바닥, 화살(기본·속도선 3단계·명중 순)
  const [heroTex, campTex, groundTex, allyArrow, enemyArrow] = await Promise.all([
    Promise.all(HERO_FILES.map((f) => Assets.load<Texture>(`assets/hero/hero_${f}.png`))),
    Assets.load<Texture>("assets/camp/camp.png"),
    Assets.load<Texture>("assets/tiles/ground_a.png"),
    Promise.all([0, 1, 2, 3, 4].map((i) => Assets.load<Texture>(`assets/fx/arrow_ally_${i}.png`))),
    Promise.all([0, 1, 2, 3, 4].map((i) => Assets.load<Texture>(`assets/fx/arrow_enemy_${i}.png`))),
  ]);

  // 바닥은 타일을 반복해서 깔고, 월드 경계를 선으로 표시한다
  const ground = new TilingSprite({ texture: groundTex, width: WORLD_SIZE, height: WORLD_SIZE });
  ground.position.set(-half, -half);
  ground.tint = 0xa6a6a6; // 전투가 잘 보이도록 바닥을 한 단계 어둡게 눌러 둔다
  const border = new Graphics().rect(-half, -half, WORLD_SIZE, WORLD_SIZE).stroke({ width: 4, color: 0x5a3b3b });
  world.addChild(ground, border);

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
  /** 화살은 날아가는 방향으로 돌려 그린다. 서버가 방향을 보내지 않으므로 이전 위치와의 차이로 구한다. */
  interface BulletView extends Tracked {
    hostile: boolean;
    angle: number;
    ready: boolean;
    x0: number; // 이전 프레임 위치(방향 계산용)
    y0: number;
  }
  const hitFx: { node: Sprite; age: number }[] = [];
  const HIT_FX_SEC = 0.22;
  const ARROW_SCALE = 0.5;
  const bullets = new Pool<BulletView, BulletWire>(
    (w) => {
      const hostile = w[3] === 1;
      const sprite = new Sprite((hostile ? enemyArrow : allyArrow)[2]!); // 속도선이 중간 정도인 컷
      sprite.anchor.set(0.82, 0.5); // 화살촉이 위치에 오도록
      sprite.scale.set(ARROW_SCALE);
      sprite.visible = false; // 첫 프레임에는 방향을 모른다
      bulletLayer.addChild(sprite);
      return { node: sprite, x: 0, y: 0, hostile, angle: 0, ready: false, x0: w[1], y0: w[2] };
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
    aimMark: Graphics;
    sprite: Sprite;
  }
  const HERO_TOP = -Math.max(...heroTex.map((t) => t.height)) * HERO_SCALE * SPRITE_ANCHOR_Y; // 가장 큰 포즈의 머리 위쪽
  const players = new Pool<PlayerView, PlayerState>(
    (p) => {
      const node = new Container();
      const color = PLAYER_COLORS[(p.id - 1) % PLAYER_COLORS.length]!;
      // 어느 플레이어인지 발밑 고리 색으로 구분한다(용병과 같은 방식)
      const footY = Math.max(...heroTex.map((t) => t.height)) * HERO_SCALE * (1 - SPRITE_ANCHOR_Y) * 0.85;
      const ring = new Graphics()
        .ellipse(0, footY, PLAYER_RADIUS * 1.5, PLAYER_RADIUS * 0.7)
        .fill({ color, alpha: 0.3 })
        .stroke({ width: 3, color });
      const sprite = new Sprite(heroTex[0]!);
      sprite.anchor.set(0.5, SPRITE_ANCHOR_Y);
      const aimMark = new Graphics(); // 조준 방향 표시(몸 바깥에)
      const bar = new Graphics();
      const label = new Text({ text: p.name, style: { fill: 0xffffff, fontSize: 13, stroke: { color: 0x000000, width: 3 } } });
      label.anchor.set(0.5, 1);
      label.y = HERO_TOP - 12;
      node.addChild(ring, sprite, aimMark, bar, label);
      playerLayer.addChild(node);
      return { node, aimMark, bar, sprite, x: 0, y: 0 };
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
      const tent = new Sprite(campTex);
      tent.anchor.set(0.5, 0.6); // 모닥불 쪽이 원 가운데에 오도록
      tent.scale.set(0.5);
      const label = new Text({ text: "", style: { fill: 0xf2dfa0, fontSize: 13, stroke: { color: 0x000000, width: 3 } } });
      label.anchor.set(0.5, 0);
      label.y = campTex.height * 0.5 * 0.4 + 4;
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
    text: "검방병: 정면만 방패 방어(화살 25%·창 60%) · 둔기병: 방패 파괴 · 기병: 속도 비례 돌격, 창병은 반사",
    style: { fill: 0x9aa1b0, fontSize: 12 },
  });
  legendText.position.set(12, 26);
  legend.addChild(legendText);
  const helpText = new Text({
    text: "WASD 이동 · 좌클릭 사격 · 우클릭 기병 돌격 지시 · 캠프에서 1~3 고용 / Shift+1~5 해고 · F1~F4 진형 · B 진형 편성",
    style: { fill: 0x9aa1b0, fontSize: 12 },
  });
  helpText.position.set(12, 44);
  legend.addChild(helpText);
  const LEGEND_H = 64;
  legendBg.rect(0, 0, Math.max(lx, legendText.width + 24, helpText.width + 24), LEGEND_H).fill({ color: 0x000000, alpha: 0.35 });
  const xpBar = new Graphics();
  const stageText = new Text({ text: "", style: { fill: 0xffffff, fontSize: 18, fontWeight: "bold", stroke: { color: 0x000000, width: 4 } } });
  stageText.anchor.set(0.5, 0);
  const bossBar = new Graphics();
  const levelToast = new Text({ text: "", style: { fill: 0xffe08a, fontSize: 20, stroke: { color: 0x000000, width: 3 } } });
  levelToast.anchor.set(0.5, 0);

  // 레벨업 카드: 게임을 멈추지 않는 작은 카드. Z/X/C 한 번으로 고른다. 시안(강철 테두리·일러스트 창·별)을 따라 그린다.
  const CARD_W = 264;
  const CARD_H = 96;
  const CARD_GAP = 8;
  const ART = 72;
  const CATEGORY_COLORS = [0xe0c05d, 0x6fd16f, 0x5da6e0];
  const cardArt = await Promise.all(UNIT_FILES.map((f) => Assets.load<Texture>(`assets/cards/art_${f}.png`)));
  /** 카드 일러스트: 병종 단련은 그 병종, 그 밖은 비슷한 성격의 그림을 빌려 쓴다. 없으면 글자 아이콘(-1). */
  const artOf = (c: (typeof CARDS)[number]): number => {
    const e = c.effect;
    switch (e.k) {
      case "typeBoost": return e.type;
      case "mercHp": return SHIELD;
      case "mercDmg": return BLUNT_TYPE;
      case "mercAtkSpeed": return SPEAR_TYPE;
      case "mercSpeed": return 0;
      case "heroDmg":
      case "heroFireRate": return ARCHER_TYPE;
      default: return -1;
    }
  };
  const GLYPHS: Record<string, string> = { leadership: "+", priceMult: "%", goldMult: "G", mercRespawn: "↺", heroMaxHp: "HP", heroSpeed: "»", heroRegen: "♥" };
  /** 뽑힐 확률이 낮을수록 별이 많다 */
  const starsOf = (weight: number) => (weight >= 8 ? 1 : weight >= 5 ? 2 : 3);
  const cardPanel = new Container();
  const cardHeader = new Text({ text: "", style: { fill: 0xffe08a, fontSize: 14, fontWeight: "bold", stroke: { color: 0x000000, width: 3 } } });
  cardPanel.addChild(cardHeader);
  const cardViews = [0, 1, 2].map((i) => {
    const node = new Container();
    node.position.set(0, 26 + i * (CARD_H + CARD_GAP));
    const bg = new Graphics();
    const artSprite = new Sprite();
    artSprite.position.set(12, 12);
    const artMask = new Graphics().roundRect(12, 12, ART, ART, 8).fill(0xffffff);
    artSprite.mask = artMask;
    const artFrame = new Graphics();
    const glyph = new Text({ text: "", style: { fill: 0xffffff, fontSize: 28, fontWeight: "bold", stroke: { color: 0x000000, width: 4 } } });
    glyph.anchor.set(0.5);
    glyph.position.set(12 + ART / 2, 12 + ART / 2);
    const keyBg = new Graphics().circle(0, 0, 11).fill(0x11141b).stroke({ width: 2, color: 0xffd45d });
    keyBg.position.set(12, 12 + ART);
    const key = new Text({ text: "ZXC"[i]!, style: { fill: 0xffffff, fontSize: 14, fontWeight: "bold" } });
    key.anchor.set(0.5);
    key.position.set(12, 12 + ART);
    const tag = new Text({ text: "", style: { fill: 0xffffff, fontSize: 11, fontWeight: "bold" } });
    tag.position.set(ART + 26, 8);
    const title = new Text({ text: "", style: { fill: 0xffffff, fontSize: 16, fontWeight: "bold" } });
    title.position.set(ART + 26, 24);
    const desc = new Text({ text: "", style: { fill: 0xc8ccd6, fontSize: 12, wordWrap: true, wordWrapWidth: CARD_W - ART - 40 } });
    desc.position.set(ART + 26, 46);
    const starOn = new Text({ text: "", style: { fill: 0xffd45d, fontSize: 13 } });
    const starOff = new Text({ text: "", style: { fill: 0x3b4152, fontSize: 13 } });
    starOn.position.set(CARD_W - 62, CARD_H - 22);
    starOff.position.set(CARD_W - 62, CARD_H - 22);
    node.addChild(bg, artSprite, artMask, artFrame, glyph, keyBg, key, tag, title, desc, starOff, starOn);
    cardPanel.addChild(node);
    return { node, bg, artSprite, artFrame, glyph, tag, title, desc, starOn, starOff };
  });
  cardPanel.visible = false;
  let shownOffer = "";
  const showOffer = (offer: number[], pending: number) => {
    const key = `${offer.join(",")}|${pending}`;
    if (key === shownOffer) return;
    shownOffer = key;
    cardPanel.visible = offer.length > 0;
    cardHeader.text = offer.length > 0 ? `LEVEL UP!  카드를 고르세요${pending > 1 ? `  (대기 ${pending}회)` : ""}` : "";
    cardViews.forEach((v, i) => {
      const card = offer[i] !== undefined ? CARDS[offer[i]!] : undefined;
      v.node.visible = !!card;
      if (!card) return;
      const color = CATEGORY_COLORS[card.category]!;
      const art = artOf(card);
      v.artSprite.visible = art >= 0;
      if (art >= 0) {
        const tex = cardArt[art]!;
        v.artSprite.texture = tex;
        v.artSprite.scale.set(ART / tex.width, ART / tex.height);
      }
      v.glyph.visible = art < 0;
      v.glyph.text = card.effect.k === "leadership" ? `+${card.effect.v}` : (GLYPHS[card.effect.k] ?? "★");
      v.tag.text = CARD_CATEGORY_NAMES[card.category];
      v.tag.style.fill = color;
      v.title.text = card.name;
      v.desc.text = card.desc;
      const n = starsOf(card.weight);
      v.starOn.text = "★".repeat(n);
      v.starOff.text = "★".repeat(3);
      v.bg
        .clear()
        .roundRect(0, 0, CARD_W, CARD_H, 10)
        .fill({ color: 0x1b1f2a, alpha: 0.94 })
        .stroke({ width: 3, color: 0x050608 })
        .roundRect(2.5, 2.5, CARD_W - 5, CARD_H - 5, 8)
        .stroke({ width: 1.5, color: 0x59627a })
        .roundRect(8, 8, ART + 8, ART + 8, 10) // 일러스트 창 바탕
        .fill({ color: darken(color, 0.35) })
        .poly([CARD_W - 12, 3, CARD_W - 5, 10, CARD_W - 12, 17, CARD_W - 19, 10]) // 모서리 보석
        .fill(0x6fb8ff);
      v.artFrame
        .clear()
        .roundRect(12, 12, ART, ART, 8)
        .stroke({ width: 2, color: 0x0a0c11 })
        .roundRect(12, 12, ART, ART, 8)
        .stroke({ width: 1, color, alpha: 0.7 });
    });
  };
  // 무기 바: 현재 무기와 그 특징(방패·돌격 규칙 등)을 보여 준다
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
    weaponHint.text = WEAPONS[active]!.note;
  };
  weaponBar.visible = false;
  hud.addChild(hudText, xpBar, stageText, bossBar, weaponBar, deadText, campPanel, toast, levelToast, cardPanel, legend);

  const levelOf = new Map<number, number>();
  const rings: { x: number; y: number; age: number }[] = [];
  const bursts: { kind: number; x: number; y: number; ang: number; age: number }[] = [];
  const BURST_SEC = 0.35;
  const RING_SEC = 0.5;
  let latest: Extract<ServerMsg, { t: "state" }> | null = null;
  let myId = -1;
  let toastLeft = 0;
  let levelToastLeft = 0;
  let lastLevel = 0;
  let nearCampId = -1;
  // 자동 화면 검증용: 최신 서버 상태를 읽을 수 있게 노출한다
  Object.defineProperty(window, "__game", { get: () => ({ latest, myId }) });

  // --- 접속: 로비(방 목록·만들기·참가)를 거쳐 방에 들어가고, 끊기면 같은 캐릭터로 이어서 접속한다 ---
  let ws!: WebSocket;
  const send = (m: ClientMsg) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(m));
  const formations = createFormationUi({
    send,
    colors: TYPE_COLORS,
    notify: (text) => {
      toast.text = text;
      toastLeft = 2;
    },
  });
  const lobby = createLobby({
    send,
    onEnter: (id) => {
      myId = id;
      formations.show(true);
      formations.resend();
    },
    onLeave: () => {
      myId = -1;
      formations.show(false);
      formations.close();
      latest = null;
      levelOf.clear();
      lastLevel = 0;
      statusEl.textContent = "";
    },
  });
  let retries = 0;
  let autoStarted = false;
  const connect = () => {
    ws = new WebSocket(serverUrl);
    ws.onopen = () => {
      retries = 0;
      const token = lobby.token();
      if (token) {
        statusEl.textContent = "이어서 접속하는 중...";
        send({ t: "rejoin", token });
        return;
      }
      statusEl.textContent = "";
      // ?name=이름 으로 열면 로비를 건너뛰고 바로 시작한다(테스트·링크 공유용). ?room=코드 를 같이 주면 그 방에 참가한다.
      const autoName = params.get("name");
      if (!autoStarted && autoName) {
        autoStarted = true;
        const room = params.get("room");
        send(room ? { t: "join", name: autoName, code: room } : { t: "quick", name: autoName });
      }
    };
    ws.onclose = () => {
      lobby.markDisconnected();
      if (lobby.token() && retries < 15) {
        retries++;
        statusEl.textContent = `연결이 끊겼습니다. 다시 접속하는 중... (${retries}/15)`;
        setTimeout(connect, 2000);
        return;
      }
      lobby.clearToken();
      statusEl.textContent = "";
      lobby.showLobby("서버와 연결이 끊겼습니다. 서버가 켜져 있는지 확인하고 페이지를 새로 고쳐 주세요");
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerMsg;
      if (lobby.handle(msg)) return;
      if (msg.t === "notice") {
        toast.text = msg.text;
        toastLeft = 2.5;
      } else if (msg.t === "state") {
        latest = msg;
        for (const [kind, x, y, ang] of msg.ev ?? []) {
          if (kind === EVT_ARROW_HIT || kind === EVT_ENEMY_ARROW_HIT) {
            const fx = new Sprite((kind === EVT_ENEMY_ARROW_HIT ? enemyArrow : allyArrow)[4]!);
            fx.anchor.set(0.85, 0.5);
            fx.scale.set(ARROW_SCALE);
            fx.position.set(x, y);
            fx.rotation = ang;
            bulletLayer.addChild(fx);
            hitFx.push({ node: fx, age: 0 });
          } else if (bursts.length < 60) {
            bursts.push({ kind, x, y, ang, age: 0 });
          }
        }
        statusEl.textContent = `방 ${lobby.roomCode()} · 접속 ${msg.players.length}명 · Esc: 방 메뉴`;
      }
    };
  };
  connect();

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
    const revive = keys.has("e");
    const key = `${dx},${dy},${aim},${fire},${revive}`;
    if (force || key !== last) {
      last = key;
      send({ t: "input", dx, dy, aim, fire, revive });
    }
  };
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (formations.isOpen()) formations.close();
      else lobby.toggleRoomPanel();
      return;
    }
    if (lobby.blocksGameInput()) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "SELECT") return; // 이름·간격 입력 중에는 게임 키로 쓰지 않는다
    const k = e.key.toLowerCase();
    if (/^F[1-4]$/.test(e.key) && !e.repeat) {
      e.preventDefault();
      formations.apply(Number(e.key[1]) - 1);
      return;
    }
    if (k === "b" && !e.repeat) {
      formations.toggle();
      return;
    }
    if (formations.isOpen()) return; // 편성 화면에서는 게임 조작을 받지 않는다
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
      const size = w[11] === 1 ? BOSS_SIZE : 1;
      v.sprite.scale.set(SPRITE_SCALE * size * v.face, SPRITE_SCALE * size);
      v.sprite.zIndex = v.y;
      v.sprite.alpha = 0.7 + 0.3 * Math.min(1, w[3] / 100);
    });
    bullets.update(latest.bullets, k, (v, w) => {
      // 이동한 방향으로 화살을 돌린다
      const dx = w[1] - v.x0;
      const dy = w[2] - v.y0;
      if (Math.abs(dx) + Math.abs(dy) > 0.5) {
        v.angle = Math.atan2(dy, dx);
        v.node.rotation = v.angle;
        v.node.visible = true;
        v.ready = true;
      }
      v.x0 = w[1];
      v.y0 = w[2];
    });
    // 명중 이펙트: 잠깐 보였다가 사라진다
    for (let i = hitFx.length - 1; i >= 0; i--) {
      const fx = hitFx[i]!;
      fx.age += ticker.deltaMS / 1000;
      fx.node.alpha = Math.max(0, 1 - fx.age / HIT_FX_SEC);
      if (fx.age >= HIT_FX_SEC) {
        fx.node.destroy();
        hitFx.splice(i, 1);
      }
    }
    mercs.update(latest.mercs, k, (v, w) => {
      v.node.visible = w[8] <= 0; // 쓰러진 용병은 부활할 때까지 숨긴다
      faceFrom(v, v.x, w[6] > 0 ? w[7] : null);
      v.sprite.scale.set(SPRITE_SCALE * v.face, SPRITE_SCALE);
      v.node.zIndex = v.y;
      const key = `${w[3]}/${w[9]}/${w[10]}/${w[11]}`;
      if (v.lastKey !== key) {
        v.lastKey = key;
        const top = -allyTex[w[4]]!.height * SPRITE_SCALE * SPRITE_ANCHOR_Y - 6;
        drawBar(v.bar, w[3], w[9], 26, top);
        if (w[11] > 0) {
          // 방패 체력: 몸 체력 막대 위에 파란색으로. 깨졌으면 비어 보인다.
          v.bar
            .rect(-13, top - 5, 26, 3)
            .fill(0x2a2d36)
            .rect(-13, top - 5, (26 * Math.max(0, w[10])) / w[11], 3)
            .fill(0x6fb8ff);
        }
      }
    });
    players.update(latest.players, k, (v, p) => {
      const dead = p.down;
      // 쓰러지면 흐리게, 부활 직후 무적일 때는 깜빡인다
      v.node.alpha = dead ? 0.4 : p.invuln > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(performance.now() / 90)) : 1;
      // 들고 있는 무기에 맞는 모습으로 바꾸고, 조준한 쪽을 바라보게 좌우 반전한다
      const tex = heroTex[p.weapon] ?? heroTex[0]!;
      if (v.sprite.texture !== tex) v.sprite.texture = tex;
      v.sprite.scale.set(HERO_SCALE * (Math.cos(p.aim) >= 0 ? 1 : -1), HERO_SCALE);
      drawBar(v.bar, p.hp, p.maxHp, 36, HERO_TOP - 6);
      if (dead) {
        // 부활 진행도
        v.bar
          .rect(-22, HERO_TOP - 14, 44, 6)
          .fill(0x2a2d36)
          .rect(-22, HERO_TOP - 14, 44 * p.revive, 6)
          .fill(0x7be08f);
      }
      v.aimMark.clear();
      if (!dead) {
        // 조준 방향 표시: 몸 바깥의 작은 화살촉(무기 색)
        const ca = Math.cos(p.aim);
        const sa = Math.sin(p.aim);
        const tip = 50;
        const base = 40;
        v.aimMark
          .poly([ca * tip, sa * tip, ca * base - sa * 6, sa * base + ca * 6, ca * base + sa * 6, sa * base - ca * 6])
          .fill({ color: TYPE_COLORS[WEAPONS[p.weapon]!.type]!, alpha: 0.95 })
          .stroke({ width: 1.5, color: 0x000000, alpha: 0.7 });
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

    // 방패(검방병): 정면을 막는 호. 깨지면 회색으로 비고, 재생되면 다시 파랗게 돌아온다.
    const shieldArc = (x: number, y: number, face: number, ratio: number, regen: number, radius: number, color: number) => {
      if (ratio <= 0 && regen <= 0) return;
      const a0 = face - SHIELD_FRONT_ARC;
      fxLayer
        .moveTo(x + Math.cos(a0) * radius, y + Math.sin(a0) * radius)
        .arc(x, y, radius, a0, face + SHIELD_FRONT_ARC)
        .stroke(ratio > 0 ? { width: 3 + 3 * ratio, color, alpha: 0.45 + 0.4 * ratio } : { width: 2, color: 0x7a8294, alpha: 0.45 });
    };
    for (const w of latest.enemies) {
      if (w[4] !== SHIELD) continue;
      const v = enemies.views.get(w[0]);
      if (v) shieldArc(v.x, v.y, w[8], w[7] / 100, w[10], (ENEMY_STATS[SHIELD]!.radius + 12) * (w[11] === 1 ? BOSS_SIZE : 1), 0xffa89a);
    }
    for (const w of latest.mercs) {
      if (w[4] !== SHIELD || w[8] > 0) continue;
      const v = mercs.views.get(w[0]);
      if (v) shieldArc(v.x, v.y, w[12], w[11] > 0 ? w[10] / w[11] : 0, w[14], MERC_STATS[SHIELD]!.radius + 12, 0x8fd0ff);
    }
    // 장군: 발밑에 금빛 고리
    for (const w of latest.enemies) {
      if (w[11] !== 1) continue;
      const v = enemies.views.get(w[0]);
      if (v) fxLayer.ellipse(v.x, v.y + 22, 34, 15).stroke({ width: 3, color: 0xffd45d, alpha: 0.85 });
    }
    // 서버가 알려 준 순간 효과(명중·방패·부활)
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]!;
      b.age += ticker.deltaMS / 1000;
      const t = b.age / BURST_SEC;
      if (t >= 1) {
        bursts.splice(i, 1);
        continue;
      }
      if (b.kind === EVT_SHIELD_BLOCK) {
        const r = 22 + 8 * t;
        fxLayer
          .moveTo(b.x + Math.cos(b.ang - 0.7) * r, b.y + Math.sin(b.ang - 0.7) * r)
          .arc(b.x, b.y, r, b.ang - 0.7, b.ang + 0.7)
          .stroke({ width: 4 * (1 - t) + 1, color: 0xbfe6ff, alpha: 0.9 * (1 - t) });
      } else if (b.kind === EVT_SHIELD_BREAK) {
        fxLayer.circle(b.x, b.y, 14 + 34 * t).stroke({ width: 5 * (1 - t) + 1, color: 0x8fd0ff, alpha: 0.9 * (1 - t) });
      } else if (b.kind === EVT_REVIVE) {
        fxLayer.circle(b.x, b.y, 10 + 60 * t).stroke({ width: 6 * (1 - t) + 1, color: 0x7be08f, alpha: 0.9 * (1 - t) });
      }
    }

    // 기병이 속도를 낼수록 뒤에 속도선이 길어진다
    const streak = (x: number, y: number, face: number, mom: number) => {
      if (mom < 0.4) return;
      for (const dy of [-8, 0, 8]) {
        fxLayer
          .moveTo(x - face * 16, y + dy)
          .lineTo(x - face * (16 + 34 * mom), y + dy)
          .stroke({ width: 2, color: 0xffffff, alpha: 0.12 + 0.3 * mom });
      }
    };
    for (const w of latest.enemies) {
      if (w[4] !== 0) continue;
      const v = enemies.views.get(w[0]);
      if (v) streak(v.x, v.y, v.face, w[9]);
    }
    for (const w of latest.mercs) {
      if (w[4] !== 0 || w[8] > 0) continue;
      const v = mercs.views.get(w[0]);
      if (v) streak(v.x, v.y, v.face, w[13]);
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
      const fallen = latest.players.find((q) => q.id !== myId && q.down && Math.hypot(q.x - meState.x, q.y - meState.y) <= REVIVE_RADIUS * 1.5);
      deadText.text = meState.down
        ? meState.revive > 0
          ? `동료가 일으켜 세우는 중... ${Math.round(meState.revive * 100)}%`
          : "쓰러졌습니다 - 동료가 일으켜 주기를 기다리는 중"
        : fallen
          ? `${fallen.name} 부활: E 누르고 있기${fallen.revive > 0 ? ` (${Math.round(fallen.revive * 100)}%)` : ""}`
          : "";

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
      if (best && !meState.down) {
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
    const gi = latest.g;
    if (gi && gi.status !== "playing") deadText.text = ""; // 결과 화면이 뜨면 안내 문구는 숨긴다
    if (gi) {
      const mmss = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
      if (gi.phase === "grow") stageText.text = `스테이지 ${gi.stage}/${STAGE_COUNT} · 보스군 도착까지 ${mmss(gi.timer)}`;
      else if (gi.phase === "boss") stageText.text = `스테이지 ${gi.stage}/${STAGE_COUNT} · ${UNIT_NAMES[gi.bossType]} 장군의 군대 ${gi.armyLeft}/${gi.armyTotal}`;
      else stageText.text = `스테이지 ${gi.stage} 클리어! 다음 스테이지까지 ${gi.timer}초`;
      stageText.position.set(app.screen.width / 2, 8);
      bossBar.clear();
      if (gi.phase === "boss" && gi.bossHp > 0) {
        const bw = 320;
        const bx = app.screen.width / 2 - bw / 2;
        bossBar.roundRect(bx, 36, bw, 10, 4).fill({ color: 0x000000, alpha: 0.6 }).roundRect(bx, 36, (bw * gi.bossHp) / 100, 10, 4).fill(0xe8883a);
      }
    }
    levelToastLeft = Math.max(0, levelToastLeft - ticker.deltaMS / 1000);
    levelToast.visible = levelToastLeft > 0;
    levelToast.position.set(app.screen.width / 2, 100);
    weaponBar.position.set(app.screen.width - (WEAPONS.length * (SLOT_W + 4) - 4) - 12, app.screen.height - 100);
    cardPanel.position.set(app.screen.width - CARD_W - 12, Math.max(110, app.screen.height / 2 - 150));
    toastLeft = Math.max(0, toastLeft - ticker.deltaMS / 1000);
    toast.visible = toastLeft > 0;
    deadText.position.set(app.screen.width / 2, app.screen.height / 2 - 120);
    campPanel.position.set(app.screen.width / 2 - campPanel.width / 2, app.screen.height - campPanel.height - 112);
    toast.position.set(app.screen.width / 2, 74);
    legend.position.set(0, app.screen.height - LEGEND_H);
  });
}

main();
