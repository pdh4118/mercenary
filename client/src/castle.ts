import { Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { GATE_X, GATE_Y, RAMP_HALF, RAMP_LEN, RAMP_Y, SIEGE, castleSolids, wallX } from "@mercenary/shared";

const CASTLE_TEX = ["boss10_wall_a", "boss10_wall_b", "boss10_wall_c", "boss10_tower", "boss10_gate_0", "boss10_gate_1", "boss10_gate_2", "boss10_gate_open", "boss10_gate_ruin", "boss10_wall_side_a", "boss10_wall_side_b", "boss10_wall_side_c", "boss10_wall_side_end", "boss10_wall_front2_a", "boss10_wall_front2_b", "boss10_wall_front2_c", "boss10_tower_round2", "boss10_wall_front_a", "boss10_wall_front_b", "boss10_wall_front_c", "boss10_wall_side4_a", "boss10_wall_side4_b", "boss10_wall_side4_c", "boss10_wall_side2_a", "boss10_wall_side2_b", "boss10_wall_side2_c", "boss10_tower_round"] as const;

/**
 * 공성전의 성(그림 없이 코드로 그린다). 스테이지 10에 들어가면 성이 드러난 정도(reveal 0..1)에 따라 성벽 돌덩이가 하나씩 솟는다.
 * 돌덩이마다 깊이(zIndex)를 따로 줘서 성 안팎의 유닛과 앞뒤가 맞는다.
 */
export interface Castle {
  /** reveal 0..1, gate 0..100(성문 체력 %), open = 성문이 부서짐 */
  update(reveal: number, gate: number, open: boolean, now: number, sortie?: boolean): void;
  destroy(): void;
}

const WALL_H = 88; // 성벽 높이(화면 픽셀)
const TOWER_H = 150;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => 1 - (1 - v) * (1 - v);
const hash = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function createCastle(layer: Container): Castle {
  const solids = castleSolids();
  interface Block {
    g: Graphics;
    x: number;
    y: number;
    r: number;
    tower: boolean;
    delay: number;
    last: number;
  }
  const blocks: Block[] = solids.map((s, i) => {
    const g = new Graphics();
    g.zIndex = s.y + s.r * 0.6;
    layer.addChild(g);
    return { g, x: s.x, y: s.y, r: s.r, tower: s.tower, delay: 0.05 + hash(i) * 0.45, last: -1 };
  });
  // 그림이 도착하면 코드로 그린 돌덩이 대신 성벽·탑·성문 그림을 쓴다
  const tex: Record<string, Texture | null> = {};
  interface Piece {
    sp: Sprite;
    base: number;
    delay: number;
    last: number;
    flip: boolean;
    flat: boolean; // 위에서 내려다본 납작한 조각(옆 성벽): 솟을 때 눌리지 않고 서서히 나타난다
  }
  const pieces: Piece[] = [];
  let spritesOn = false;
  let gateSp: Sprite | null = null;
  const buildSprites = (): void => {
    const ex = SIEGE.hw - 30;
    const ey = SIEGE.hh - 30;
    const x0 = SIEGE.cx - ex;
    const x1 = SIEGE.cx + ex;
    const y0 = SIEGE.cy - ey;
    const y1 = SIEGE.cy + ey;
    const add = (name: string, x: number, y: number, scale: number, zAdd: number, i: number, flip = false, flat = false): void => {
      const t = tex[name]!;
      const sp = new Sprite(t);
      sp.anchor.set(0.5, flat ? 0.5 : 0.94);
      sp.position.set(x, y);
      sp.zIndex = flat ? y - 400 : y + zAdd; // 납작한 조각은 늘 유닛 아래
      sp.visible = false;
      layer.addChild(sp);
      pieces.push({ sp, base: scale, delay: 0.05 + hash(i) * 0.45, last: -1, flip, flat });
    };
    let n = 0;
    const hasNew = !!(tex.boss10_wall_front_a && tex.boss10_wall_side2_a && tex.boss10_tower_round);
    if (hasNew) {
      // 새 성벽 세트: 정면 성벽(남북)·윗면이 보이는 옆 성벽(동서, 위아래로 이어 붙임)·둥근 탑(윗면이 넓어 궁병이 선다)
      const frontName = (i: number) => ((tex.boss10_wall_front2_a ? ["boss10_wall_front2_a", "boss10_wall_front2_b", "boss10_wall_front2_c"] : ["boss10_wall_front_a", "boss10_wall_front_b", "boss10_wall_front_c"]) as readonly string[])[Math.floor(hash(i + 9) * 3)]!;
      const sideName = (i: number) => ((tex.boss10_wall_side4_a ? ["boss10_wall_side4_a", "boss10_wall_side4_b", "boss10_wall_side4_c"] : ["boss10_wall_side2_a", "boss10_wall_side2_b", "boss10_wall_side2_c"]) as readonly string[])[Math.floor(hash(i + 21) * 3)]!;
      const fs = 64 / Math.max(1, (tex.boss10_wall_front2_a ?? tex.boss10_wall_front_a)!.width - 12); // 정면 성벽 한 칸을 가로 약 64px로
      for (let x = x0 + 40; x < x1 - 30; x += 60) {
        add(frontName(n), x, y0 + 14, fs, 8, n++); // 북쪽
        if (Math.abs(x - GATE_X) > SIEGE.gateHalf + 70) add(frontName(n), x, y1 + 14, fs, 8, n++); // 남쪽(성문 둘레는 탑과 성문이 채운다)
      }
      const sw = (tex.boss10_wall_side4_a ?? tex.boss10_wall_side2_a)!;
      const ss = (tex.boss10_wall_side4_a ? 84 : 70) / Math.max(1, sw.width - 12); // 옆 성벽 통로 폭 약 70px
      const sh = (sw.height - 12) * ss - 4; // 위아래로 이어 붙이는 간격
      for (let y = y0 + 90; y < y1 - 60; y += sh) {
        add(sideName(n), x0, y, ss, 8, n++, false, true);
        add(sideName(n), x1, y, ss, 8, n++, true, true);
      }
      const towerName = tex.boss10_tower_round2 ? "boss10_tower_round2" : "boss10_tower_round";
      const ts = 124 / Math.max(1, tex[towerName]!.width - 12);
      for (const [tx, ty] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [GATE_X - SIEGE.gateHalf - 50, y1], [GATE_X + SIEGE.gateHalf + 50, y1]] as const) add(towerName, tx, ty + 24, ts, 30, n++);
    } else {
      const wallName = (i: number) => (["boss10_wall_a", "boss10_wall_b", "boss10_wall_c"] as const)[Math.floor(hash(i + 9) * 3)]!;
      const ws = 96 / Math.max(1, (tex.boss10_wall_a?.width ?? 225) - 12);
      for (let x = x0 + 40; x < x1 - 30; x += 84) {
        add(wallName(n), x, y0 + 14, ws, 8, n++);
        if (Math.abs(x - GATE_X) > SIEGE.gateHalf + 70) add(wallName(n), x, y1 + 14, ws, 8, n++);
      }
      for (let y = y0 + 60; y < y1 - 40; y += 56) {
        add(wallName(n), x0, y + 14, ws * 0.9, 8, n++);
        add(wallName(n), x1, y + 14, ws * 0.9, 8, n++);
      }
      const ts = 120 / Math.max(1, (tex.boss10_tower?.width ?? 190) - 12);
      for (const [tx, ty] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [GATE_X - SIEGE.gateHalf - 50, y1], [GATE_X + SIEGE.gateHalf + 50, y1]] as const) add("boss10_tower", tx, ty + 24, ts, 30, n++);
    }
    gateSp = new Sprite(tex.boss10_gate_0!);
    gateSp.anchor.set(0.5, 0.93);
    gateSp.position.set(GATE_X, GATE_Y + 26);
    gateSp.zIndex = GATE_Y + 18;
    gateSp.visible = false;
    layer.addChild(gateSp);
    for (const b of blocks) b.g.visible = false;
    spritesOn = true;
  };
  Promise.all(CASTLE_TEX.map((n) => Assets.load<Texture>(`assets/fx/${n}.png`).then((t) => (tex[n] = t)).catch(() => (tex[n] = null)))).then(() => {
    if (tex.boss10_wall_a && tex.boss10_tower && tex.boss10_gate_0) buildSprites();
  });

  // 성문이 부서진 뒤 안뜰에 드러나는 계단(성벽 위로 오르는 길): 그림 없이 코드로 그린다(바닥에 깔린 돌계단)
  const stairsG = new Graphics();
  stairsG.zIndex = RAMP_Y - 380;
  layer.addChild(stairsG);
  let stairsDrawn = false;
  const drawStairs = (): void => {
    stairsDrawn = true;
    const g = stairsG.clear();
    for (const side of [-1, 1]) {
      const wx = wallX(side);
      const n = 8;
      const sl = RAMP_LEN / n;
      for (let i = 0; i < n; i++) {
        // 안뜰 쪽(i가 큼)이 낮고 성벽 쪽(i가 작음)이 높다: 성벽에 가까울수록 밝고 윗면 폭이 넓다
        const x0 = wx + -side * i * sl;
        const x1 = wx + -side * (i + 1) * sl;
        const lx = Math.min(x0, x1);
        const w = Math.abs(x1 - x0);
        const lift = (n - i) * 2.2;
        g.rect(lx, RAMP_Y - RAMP_HALF - lift, w, RAMP_HALF * 2).fill({ color: 0x8e93a3 + 0x040404 * (n - i), alpha: 1 }).stroke({ width: 1.5, color: 0x2a2d38, alpha: 0.9 });
      }
      g.rect(Math.min(wx, wx + -side * RAMP_LEN), RAMP_Y - RAMP_HALF - 18, RAMP_LEN, 8).fill({ color: 0x6f7486 }).stroke({ width: 1.5, color: 0x2a2d38 }); // 위쪽 난간
      g.rect(Math.min(wx, wx + -side * RAMP_LEN), RAMP_Y + RAMP_HALF - 6, RAMP_LEN, 8).fill({ color: 0x6f7486 }).stroke({ width: 1.5, color: 0x2a2d38 }); // 아래쪽 난간
    }
  };

  const gateG = new Graphics();
  gateG.zIndex = GATE_Y + 30;
  layer.addChild(gateG);
  const gateLabel = new Text({ text: "", style: { fill: 0xffffff, fontSize: 15, fontWeight: "bold", stroke: { color: 0x000000, width: 4 } } });
  gateLabel.anchor.set(0.5, 1);
  gateLabel.zIndex = 99999;
  layer.addChild(gateLabel);

  const drawBlock = (b: Block, rise: number, seed: number): void => {
    const g = b.g.clear();
    if (rise <= 0.01) return;
    const H = (b.tower ? TOWER_H : WALL_H) * rise;
    const r = b.r;
    // 바닥 그림자
    g.ellipse(b.x, b.y + r * 0.35, r * 1.05, r * 0.5).fill({ color: 0x000000, alpha: 0.22 });
    if (b.tower) {
      // 탑: 둥근 기둥 + 지붕
      g.rect(b.x - r, b.y - H, r * 2, H).fill(0x8b8f9f).stroke({ width: 2, color: 0x2a2d38 });
      g.rect(b.x - r, b.y - H, r * 0.55, H).fill({ color: 0xffffff, alpha: 0.1 });
      g.rect(b.x + r * 0.45, b.y - H, r * 0.55, H).fill({ color: 0x000000, alpha: 0.18 });
      for (let k = 1; k < 5; k++) g.moveTo(b.x - r, b.y - (H * k) / 5).lineTo(b.x + r, b.y - (H * k) / 5).stroke({ width: 1, color: 0x2a2d38, alpha: 0.35 });
      g.ellipse(b.x, b.y, r, r * 0.5).fill(0x777b8b).stroke({ width: 2, color: 0x2a2d38 });
      g.ellipse(b.x, b.y - H, r * 1.12, r * 0.52).fill(0xa4a9ba).stroke({ width: 2, color: 0x2a2d38 });
      if (rise > 0.9) g.poly([b.x - r * 1.1, b.y - H, b.x + r * 1.1, b.y - H, b.x, b.y - H - r * 1.35]).fill(0x9a3a32).stroke({ width: 2, color: 0x2a1210 }); // 지붕
      return;
    }
    const w = r * 1.95;
    g.rect(b.x - w / 2, b.y - H, w, H + r * 0.1).fill(0x858a9b).stroke({ width: 1.5, color: 0x2a2d38 });
    g.rect(b.x - w / 2, b.y - H, w, H * 0.12).fill({ color: 0xffffff, alpha: 0.1 });
    // 벽돌 줄
    for (let k = 1; k < 4; k++) {
      const yy = b.y - (H * k) / 4;
      g.moveTo(b.x - w / 2, yy).lineTo(b.x + w / 2, yy).stroke({ width: 1, color: 0x2a2d38, alpha: 0.32 });
      const off = ((k + seed) % 2) * (w / 4);
      g.moveTo(b.x - w / 4 + off, yy).lineTo(b.x - w / 4 + off, yy - H / 4).stroke({ width: 1, color: 0x2a2d38, alpha: 0.28 });
    }
    // 윗면과 성가퀴(톱니)
    g.ellipse(b.x, b.y - H, w * 0.55, r * 0.5).fill(0xa2a7b8).stroke({ width: 1.5, color: 0x2a2d38 });
    if (rise > 0.85 && seed % 2 === 0) g.rect(b.x - w * 0.22, b.y - H - 12, w * 0.44, 14).fill(0x9296a8).stroke({ width: 1.5, color: 0x2a2d38 });
  };

  const drawGate = (gate: number, open: boolean, rise: number, now: number, sortie = false): void => {
    const g = gateG.clear();
    gateLabel.visible = false;
    if (rise <= 0.05) return;
    const hw = SIEGE.gateHalf;
    if (spritesOn && gateSp) {
      // 성문 그림: 상태(온전·금·크게 부서짐·열림·무너짐)에 맞는 그림을 쓰고, 체력 막대만 코드로 그린다
      const name = open ? "boss10_gate_ruin" : sortie ? "boss10_gate_open" : gate > 66 ? "boss10_gate_0" : gate > 33 ? "boss10_gate_1" : "boss10_gate_2";
      const t = tex[name] ?? tex.boss10_gate_0!;
      gateSp.texture = t;
      const gs = (hw * 2 + 30) / Math.max(1, t.width - 12);
      gateSp.scale.set(gs, gs * rise);
      gateSp.alpha = Math.min(1, rise * 2);
      gateSp.visible = true;
      if (!open) {
        const bw = hw * 2;
        const by = GATE_Y + 26 - t.height * gs * 0.93 * rise - 14;
        g.roundRect(GATE_X - bw / 2, by, bw, 10, 4).fill({ color: 0x15161b, alpha: 0.85 }).stroke({ width: 1.5, color: 0xffffff, alpha: 0.5 });
        const pulse2 = gate < 30 ? 0.7 + 0.3 * Math.sin(now / 90) : 1;
        g.roundRect(GATE_X - bw / 2 + 2, by + 2, Math.max(2, ((bw - 4) * gate) / 100), 6, 3).fill({ color: gate > 50 ? 0xe0b24a : gate > 25 ? 0xff8a3a : 0xff4a3a, alpha: pulse2 });
        gateLabel.visible = true;
        gateLabel.text = `성문 ${gate}%`;
        gateLabel.position.set(GATE_X, by - 2);
      }
      return;
    }
    const H = 112 * rise;
    const x = GATE_X;
    const y = GATE_Y + 18;
    // 문틀(돌 아치)
    g.rect(x - hw - 14, y - H - 22, 28, H + 22).fill(0x80849a).stroke({ width: 2, color: 0x2a2d38 });
    g.rect(x + hw - 14, y - H - 22, 28, H + 22).fill(0x80849a).stroke({ width: 2, color: 0x2a2d38 });
    g.rect(x - hw - 14, y - H - 26, hw * 2 + 28, 26).fill(0x9a9fb2).stroke({ width: 2, color: 0x2a2d38 });
    if (open) {
      // 부서진 성문: 어두운 입구와 나뭇조각
      g.rect(x - hw, y - H, hw * 2, H + 6).fill({ color: 0x0e0f14, alpha: 0.85 });
      for (let i = 0; i < 9; i++) {
        const px = x - hw + hash(i + 3) * hw * 2;
        const py = y + 8 + hash(i + 11) * 26;
        g.rect(px, py, 10 + hash(i) * 26, 5).fill(0x6b4a2a).stroke({ width: 1, color: 0x2a1a0c });
      }
      return;
    }
    if (sortie) {
      // 성문 개방 돌격: 문짝이 양옆으로 활짝 열리고 안이 어둡다
      g.rect(x - hw, y - H, hw * 2, H + 6).fill({ color: 0x0e0f14, alpha: 0.9 });
      g.rect(x - hw - 6, y - H, 22, H).fill(0x7a5330).stroke({ width: 2, color: 0x2a1a0c });
      g.rect(x + hw - 16, y - H, 22, H).fill(0x7a5330).stroke({ width: 2, color: 0x2a1a0c });
      g.circle(x, y - H * 0.35, 5 + 3 * Math.sin(now / 80)).fill({ color: 0xff5a3a, alpha: 0.6 });
      return;
    }
    // 나무 문짝 두 장 + 쇠띠
    const dmg = 1 - gate / 100;
    g.rect(x - hw, y - H, hw, H).fill(0x7a5330).stroke({ width: 2, color: 0x2a1a0c });
    g.rect(x, y - H, hw, H).fill(0x7a5330).stroke({ width: 2, color: 0x2a1a0c });
    for (let k = 1; k < 5; k++) g.moveTo(x - hw + (hw * k) / 5, y - H).lineTo(x - hw + (hw * k) / 5, y).stroke({ width: 1, color: 0x2a1a0c, alpha: 0.5 });
    for (let k = 1; k < 5; k++) g.moveTo(x + (hw * k) / 5, y - H).lineTo(x + (hw * k) / 5, y).stroke({ width: 1, color: 0x2a1a0c, alpha: 0.5 });
    for (const f of [0.25, 0.7]) g.rect(x - hw, y - H * f - 6, hw * 2, 12).fill(0x3b3e48).stroke({ width: 1, color: 0x15161b });
    g.circle(x - 10, y - H * 0.45, 6).fill(0xd8b24a).stroke({ width: 1, color: 0x2a1a0c });
    g.circle(x + 10, y - H * 0.45, 6).fill(0xd8b24a).stroke({ width: 1, color: 0x2a1a0c });
    // 금이 간다
    const cracks = Math.floor(dmg * 9);
    for (let i = 0; i < cracks; i++) {
      const cx = x - hw + hash(i + 40) * hw * 2;
      const cy = y - H + hash(i + 70) * H;
      g.moveTo(cx, cy).lineTo(cx + (hash(i + 5) - 0.5) * 30, cy + 22 + hash(i + 9) * 14).stroke({ width: 2, color: 0x15100a, alpha: 0.85 });
    }
    // 체력 막대
    const bw = hw * 2;
    const by = y - H - 52;
    g.roundRect(x - bw / 2, by, bw, 10, 4).fill({ color: 0x15161b, alpha: 0.85 }).stroke({ width: 1.5, color: 0xffffff, alpha: 0.5 });
    const pulse = gate < 30 ? 0.7 + 0.3 * Math.sin(now / 90) : 1;
    g.roundRect(x - bw / 2 + 2, by + 2, Math.max(2, ((bw - 4) * gate) / 100), 6, 3).fill({ color: gate > 50 ? 0xe0b24a : gate > 25 ? 0xff8a3a : 0xff4a3a, alpha: pulse });
    gateLabel.visible = true;
    gateLabel.text = `성문 ${gate}%`;
    gateLabel.position.set(x, by - 2);
  };

  return {
    update(reveal, gate, open, now, sortie) {
      if (open && !stairsDrawn) drawStairs();
      stairsG.visible = open;
      if (spritesOn) {
        for (let i = 0; i < pieces.length; i++) {
          const pc = pieces[i]!;
          const rise = ease(clamp01((reveal - pc.delay) / (1 - pc.delay)));
          const q = Math.round(rise * 40);
          if (q === pc.last) continue; // 올라가는 정도가 같으면 다시 만지지 않는다
          pc.last = q;
          pc.sp.visible = rise > 0.02;
          pc.sp.scale.set(pc.flip ? -pc.base : pc.base, pc.flat ? pc.base : pc.base * rise);
          pc.sp.alpha = Math.min(1, rise * 3);
        }
        drawGate(gate, open, ease(clamp01((reveal - 0.45) / 0.5)), now, !!sortie);
        return;
      }
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]!;
        const rise = ease(clamp01((reveal - b.delay) / (1 - b.delay - 0.02 + 0.02)));
        const q = Math.round(rise * 40);
        if (q === b.last) continue; // 올라가는 정도가 같으면 다시 그리지 않는다
        b.last = q;
        drawBlock(b, rise, i);
      }
      drawGate(gate, open, ease(clamp01((reveal - 0.45) / 0.5)), now, !!sortie);
    },
    destroy() {
      for (const pc of pieces) pc.sp.destroy();
      gateSp?.destroy();
      stairsG.destroy();
      for (const b of blocks) b.g.destroy();
      gateG.destroy();
      gateLabel.destroy();
    },
  };
}
