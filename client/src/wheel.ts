/**
 * 방사형 선택 휠(리그 오브 레전드의 신호 휠처럼): 누른 자리에 원형 메뉴가 뜨고, 마우스를 어느 방향으로 끌었는지로 항목을 고른다.
 * 가운데는 "중앙 항목"(기본 동작), 둘레에는 방향별 항목. 선택할 수 없는(비활성) 항목은 흐리게 보이고 고를 수 없다.
 */
export interface WheelItem {
  key: string;
  label: string;
  sub?: string;
  /** 위쪽이 0도, 시계 방향으로 늘어나는 각도 */
  angle: number;
  enabled: boolean;
  /** 항목 색(CSS) */
  color?: string;
}

export const WHEEL_CENTER = "center";

export interface Wheel {
  isOpen(): boolean;
  /** (cx, cy)는 화면(CSS 픽셀) 좌표. center를 주면 가운데 항목이 생긴다. */
  show(cx: number, cy: number, items: WheelItem[], center?: { label: string; sub?: string }): void;
  /** 마우스(화면 좌표)가 가리키는 항목을 강조하고 그 key를 돌려준다(없으면 null, 가운데는 WHEEL_CENTER) */
  point(mx: number, my: number): string | null;
  /** 닫고 마지막으로 가리킨 항목 key를 돌려준다 */
  hide(): string | null;
}

const CSS = `
.wheel { position: fixed; z-index: 30; width: 0; height: 0; pointer-events: none; display: none; }
.wheel.open { display: block; }
.wheel .ring { position: absolute; border-radius: 50%; border: 2px solid rgba(255,255,255,.14); background: rgba(8,10,16,.55); box-shadow: 0 0 0 1px rgba(0,0,0,.5) inset; }
.wheel .cell { position: absolute; width: 74px; height: 74px; margin: -37px 0 0 -37px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(16,19,28,.92); border: 2px solid #3a4052; color: #e6e9f0; font-size: 14px; font-weight: 700; text-align: center; line-height: 1.15; transition: transform .06s, border-color .06s, background .06s; }
.wheel .cell small { font-size: 10px; font-weight: 500; color: #aab2c2; margin-top: 2px; max-width: 68px; }
.wheel .cell.off { opacity: .38; filter: grayscale(.8); border-style: dashed; }
.wheel .cell.on { transform: scale(1.14); background: rgba(52,44,18,.96); border-color: #ffe08a; color: #fff; }
.wheel .cell.on small { color: #ffe9b0; }
.wheel .cell.mid { width: 64px; height: 64px; margin: -32px 0 0 -32px; }
`;

export function createWheel(radius = 92): Wheel {
  if (!document.getElementById("wheelCss")) {
    const st = document.createElement("style");
    st.id = "wheelCss";
    st.textContent = CSS;
    document.head.append(st);
  }
  const root = document.createElement("div");
  root.className = "wheel";
  document.body.append(root);
  let items: WheelItem[] = [];
  let cells = new Map<string, HTMLElement>();
  let hasCenter = false;
  let cx = 0;
  let cy = 0;
  let cur: string | null = null;
  let open = false;
  const setCur = (k: string | null) => {
    if (k === cur) return;
    if (cur) cells.get(cur)?.classList.remove("on");
    cur = k;
    if (cur) cells.get(cur)?.classList.add("on");
  };
  return {
    isOpen: () => open,
    show(x, y, its, center) {
      items = its;
      hasCenter = !!center;
      // 화면 밖으로 나가지 않게 가장자리에서 밀어 넣는다
      const m = radius + 44;
      cx = Math.max(m, Math.min(window.innerWidth - m, x));
      cy = Math.max(m, Math.min(window.innerHeight - m, y));
      root.style.left = `${cx}px`;
      root.style.top = `${cy}px`;
      root.replaceChildren();
      cells = new Map();
      const ring = document.createElement("div");
      ring.className = "ring";
      const rr = radius + 40;
      ring.style.cssText = `left:${-rr}px;top:${-rr}px;width:${rr * 2}px;height:${rr * 2}px`;
      root.append(ring);
      const mk = (key: string, label: string, sub: string | undefined, px: number, py: number, enabled: boolean, mid: boolean, color?: string) => {
        const c = document.createElement("div");
        c.className = `cell${enabled ? "" : " off"}${mid ? " mid" : ""}`;
        c.style.left = `${px}px`;
        c.style.top = `${py}px`;
        if (color) c.style.borderColor = color;
        const t = document.createElement("span");
        t.textContent = label;
        c.append(t);
        if (sub) {
          const s = document.createElement("small");
          s.textContent = sub;
          c.append(s);
        }
        root.append(c);
        cells.set(key, c);
      };
      if (center) mk(WHEEL_CENTER, center.label, center.sub, 0, 0, true, true);
      for (const it of items) {
        const a = (it.angle * Math.PI) / 180;
        mk(it.key, it.label, it.sub, Math.sin(a) * radius, -Math.cos(a) * radius, it.enabled, false, it.color);
      }
      root.classList.add("open");
      open = true;
      cur = null;
      setCur(hasCenter ? WHEEL_CENTER : null);
    },
    point(mx, my) {
      if (!open) return null;
      const dx = mx - cx;
      const dy = my - cy;
      const d = Math.hypot(dx, dy);
      if (d < 34) {
        setCur(hasCenter ? WHEEL_CENTER : null);
        return cur;
      }
      const ang = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360; // 위 0도, 시계 방향
      let best: WheelItem | null = null;
      let bd = Infinity;
      for (const it of items) {
        let diff = Math.abs(ang - it.angle) % 360;
        if (diff > 180) diff = 360 - diff;
        if (diff < bd) {
          bd = diff;
          best = it;
        }
      }
      // 가장 가까운 방향의 항목(비활성이면 고르지 않는다)
      setCur(best && best.enabled ? best.key : null);
      return cur;
    },
    hide() {
      const k = cur;
      root.classList.remove("open");
      open = false;
      cur = null;
      return k;
    },
  };
}
