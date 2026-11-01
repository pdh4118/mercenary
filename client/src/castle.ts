import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { GATE_X, GATE_Y, SIEGE } from "@mercenary/shared";

/**
 * 공성전의 성: 그림 한 장(`boss10_castle`)을 두 층으로 나눠 그린다.
 *  - 뒤 층: 성 전체(유닛보다 늘 아래). 안뜰 바닥·북쪽 성벽·계단·성벽 윗면이 여기 있다.
 *  - 앞 층: 남쪽 성벽과 모서리 탑(남쪽 성벽 뒤에 선 유닛을 가린다).
 * 성이 드러날 때는 바닥에서 위로 솟아오른다. 성문은 5상태 그림을 앞 층에 얹고, 체력 막대는 코드로 그린다.
 */
export interface Castle {
  /** reveal 0..1, gate 0..100(성문 체력 %), open = 성문이 부서짐 */
  update(reveal: number, gate: number, open: boolean, now: number, sortie?: boolean, behind?: boolean): void;
  destroy(): void;
}

// 그림 `boss10_castle`(원본 1200x896에서 투명한 가장자리를 자른 1134x819)을 월드에 맞추는 값
const CROP_X = 38; // 자르기 전 원본에서 잘린 왼쪽·위쪽 폭
const CROP_Y = 40;
const IMG_CX = 604.5; // 원본에서 성 중심 x
const IMG_BASE = 810; // 원본에서 남쪽 성벽 앞면 바닥 y(성문 아치 바닥)
const SX = 1.1; // 월드 px / 그림 px (가로)
const SY = 0.95; // (세로: 내려다보는 시점이라 조금 낮춰 맞춘다)
const FRONT_MID_Y = 604; // 남쪽 성벽 바깥쪽 성가퀴(요철)부터 앞 층: 윗면 통로 위에 선 수비병은 이 성가퀴 뒤로 하반신이 가려진다 // 원본에서 남쪽 성벽 윗면이 시작하는 y(이 아래가 앞 층)
const FRONT_TOWER_Y = 470; // 남쪽 탑은 더 위에서부터 앞 층
const MID_X0 = 250; // 원본에서 남쪽 성벽 가운데 구간
const MID_X1 = 960;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => 1 - (1 - v) * (1 - v);
const GATE_TEX = ["boss10_gate_0", "boss10_gate_1", "boss10_gate_2", "boss10_gate_open", "boss10_gate_ruin"] as const;

/** high: 유닛 위에 그리는 층. 성벽 뒤(안쪽)에 선 유닛이 있으면 앞 층 성벽이 이 층으로 올라가 유닛을 가리고, 위치가 보이도록 반투명해진다 */
export function createCastle(layer: Container, high: Container): Castle {
  const baseY = GATE_Y + (858 - IMG_BASE) * SY; // 그림 아래 끝(탑 바닥)의 월드 y
  const tex: Record<string, Texture | null> = {};
  const back = new Container();
  back.zIndex = -1e6;
  back.visible = false;
  const front = new Container();
  front.zIndex = GATE_Y + 1;
  front.visible = false;
  const towers = new Container(); // 남쪽 탑: 성벽 위 수비병보다도 앞(수비병이 탑 기둥에 가려진다)
  towers.zIndex = 1e5;
  towers.visible = false;
  layer.addChild(back, front, towers);
  for (const c of [back, front, towers]) {
    c.pivot.set(0, baseY);
    c.position.set(0, baseY);
  }
  const gateG = new Graphics();
  gateG.zIndex = 999999;
  layer.addChild(gateG);
  const gateLabel = new Text({ text: "", style: { fill: 0xffffff, fontSize: 15, fontWeight: "bold", stroke: { color: 0x000000, width: 4 } } });
  gateLabel.anchor.set(0.5, 1);
  gateLabel.zIndex = 999999;
  layer.addChild(gateLabel);
  let gateSp: Sprite | null = null;
  let ready = false;
  let isHigh = false;
  let seeThru = 1;
  const rise0 = (r: number) => ease(clamp01(r));

  const place = (sp: Sprite, ox: number, oy: number): void => {
    // ox, oy: 원본 그림에서의 왼쪽 위 좌표
    sp.scale.set(SX, SY);
    sp.position.set((ox - IMG_CX) * SX, GATE_Y - (IMG_BASE - oy) * SY);
  };

  Promise.all([...GATE_TEX.map((n) => Assets.load<Texture>(`assets/fx/${n}.png`).then((t) => (tex[n] = t)).catch(() => (tex[n] = null))), Assets.load<Texture>("assets/fx/boss10_castle.png").then((t) => (tex.castle = t)).catch(() => (tex.castle = null))]).then(() => {
    const t = tex.castle;
    if (!t) return;
    // 뒤 층: 그림 전체
    const whole = new Sprite(t);
    place(whole, CROP_X, CROP_Y);
    back.addChild(whole);
    // 앞 층: 남쪽 성벽 가운데 + 양쪽 탑(그림을 잘라 낸 조각)
    const piece = (x0: number, y0: number, x1: number, y1: number, into: Container = front): void => {
      const fx = x0 - CROP_X;
      const fy = y0 - CROP_Y;
      const sp = new Sprite(new Texture({ source: t.source, frame: new Rectangle(fx, fy, x1 - x0, y1 - y0) }));
      place(sp, x0, y0);
      into.addChild(sp);
    };
    piece(MID_X0, FRONT_MID_Y, MID_X1, 858);
    piece(CROP_X, FRONT_TOWER_Y, MID_X0, 858, towers);
    piece(MID_X1, FRONT_TOWER_Y, 1171, 858, towers);
    if (tex.boss10_gate_0) {
      gateSp = new Sprite(tex.boss10_gate_0);
      gateSp.anchor.set(0.5, 1);
      gateSp.position.set(GATE_X, GATE_Y + 6);
      front.addChild(gateSp);
    }
    ready = true;
  });

  const drawGate = (gate: number, open: boolean, show: boolean, now: number, sortie: boolean): void => {
    const g = gateG.clear();
    gateLabel.visible = false;
    if (!gateSp) return;
    const name = open ? "boss10_gate_ruin" : sortie ? "boss10_gate_open" : gate > 66 ? "boss10_gate_0" : gate > 33 ? "boss10_gate_1" : "boss10_gate_2";
    const t = tex[name] ?? tex.boss10_gate_0!;
    gateSp.texture = t;
    const gs = 150 / Math.max(1, t.width - 12);
    gateSp.scale.set(gs);
    if (!show || open) return;
    const bw = SIEGE.gateHalf * 2 + 40;
    const by = GATE_Y - t.height * gs - 12;
    g.roundRect(GATE_X - bw / 2, by, bw, 10, 4).fill({ color: 0x15161b, alpha: 0.85 }).stroke({ width: 1.5, color: 0xffffff, alpha: 0.5 });
    const pulse = gate < 30 ? 0.7 + 0.3 * Math.sin(now / 90) : 1;
    g.roundRect(GATE_X - bw / 2 + 2, by + 2, Math.max(2, ((bw - 4) * gate) / 100), 6, 3).fill({ color: gate > 50 ? 0xe0b24a : gate > 25 ? 0xff8a3a : 0xff4a3a, alpha: pulse });
    gateLabel.visible = true;
    gateLabel.text = `성문 ${gate}%`;
    gateLabel.position.set(GATE_X, by - 2);
  };

  return {
    update(reveal, gate, open, now, sortie, behind) {
      if (!ready) return;
      const wantHigh = !!behind && rise0(reveal) >= 0.98;
      if (wantHigh !== isHigh) {
        isHigh = wantHigh;
        for (const c of [front, towers]) (wantHigh ? high : layer).addChild(c);
      }
      seeThru += ((wantHigh ? 0.5 : 1) - seeThru) * 0.2; // 가려질 때 반투명으로 서서히 바뀐다
      const rise = ease(clamp01(reveal));
      back.visible = front.visible = towers.visible = rise > 0.02;
      for (const c of [back, front, towers]) {
        c.scale.set(1, Math.max(0.01, rise));
        c.alpha = Math.min(1, rise * 2.5) * (c === back ? 1 : seeThru);
      }
      drawGate(gate, open, rise >= 0.98, now, !!sortie);
    },
    destroy() {
      back.destroy({ children: true });
      front.destroy({ children: true });
      towers.destroy({ children: true });
      gateG.destroy();
      gateLabel.destroy();
    },
  };
}
