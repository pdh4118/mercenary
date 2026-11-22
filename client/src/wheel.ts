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
  /** 이름 앞에 네모 안에 넣어 보여 줄 번호(단축키) */
  badge?: string;
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
  /** 지금 강조된 항목 key(없으면 null) */
  current(): string | null;
  /** 강조를 지운다 */
  clear(): void;
  /** 열어 둔 채로 중심을 옮긴다(화면 좌표) */
  moveTo(cx: number, cy: number): void;
  /** 투명도와 크기(1이 원래 크기): 평소에는 옅고 작게, 고르는 동안에는 선명하고 크게 */
  setLook(alpha: number, scale: number): void;
}

const SVG = "http://www.w3.org/2000/svg";
const CSS = `
.wheel { position: fixed; z-index: 30; width: 0; height: 0; pointer-events: none; display: none; }
.wheel.open { display: block; }
.wheel svg { position: absolute; overflow: visible; filter: drop-shadow(0 4px 10px rgba(0,0,0,.55)); }
.wheel .sec { fill: rgba(16,19,28,.9); stroke: #0b0d12; stroke-width: 3; transition: fill .06s; }
.wheel .sec.off { fill: rgba(16,19,28,.55); }
.wheel .sec.on { fill: rgba(70,58,22,.97); }
.wheel .rim { fill: none; stroke-width: 4; opacity: .85; }
.wheel .sec.off + .rim { opacity: .25; }
.wheel .sec.on + .rim { opacity: 1; stroke-width: 6; }
.wheel text { fill: #e6e9f0; font-weight: 800; text-anchor: middle; paint-order: stroke; stroke: rgba(0,0,0,.6); stroke-width: 3px; }
.wheel text.sub { font-size: 12px; font-weight: 600; fill: #aab2c2; }
.wheel .badge { fill: rgba(0,0,0,.55); stroke: #cfd3dc; stroke-width: 1.5; }
.wheel .off .badge { stroke: #5a6172; }
.wheel .on .badge { stroke: #ffe08a; }
.wheel text.badgeNum { stroke: none; paint-order: normal; fill: #fff; }
.wheel .off text { fill: #7d8597; }
.wheel .on text { fill: #fff; }
.wheel .off text.badgeNum { fill: #8d96a8; }
.wheel .on text.sub { fill: #ffe9b0; }
`;

export function createWheel(radius = 120): Wheel {
  if (!document.getElementById("wheelCss")) {
    const st = document.createElement("style");
    st.id = "wheelCss";
    st.textContent = CSS;
    document.head.append(st);
  }
  const root = document.createElement("div");
  root.className = "wheel";
  document.body.append(root);
  const R_IN = 44; // 가운데 원 반지름
  let items: WheelItem[] = [];
  let groups = new Map<string, SVGGElement>();
  let hasCenter = false;
  let cx = 0;
  let cy = 0;
  let cur: string | null = null;
  let open = false;
  const setCur = (k: string | null) => {
    if (k === cur) return;
    if (cur) groups.get(cur)?.querySelector(".sec")?.classList.remove("on");
    if (cur) groups.get(cur)?.classList.remove("on");
    cur = k;
    if (cur) {
      groups.get(cur)?.querySelector(".sec")?.classList.add("on");
      groups.get(cur)?.classList.add("on");
    }
  };
  /** 위 0도·시계 방향 각도(도)와 반지름의 점 */
  const pt = (deg: number, r: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [Math.sin(a) * r, -Math.cos(a) * r];
  };
  const slicePath = (a0: number, a1: number, r0: number, r1: number): string => {
    const [x0, y0] = pt(a0, r1);
    const [x1, y1] = pt(a1, r1);
    const [x2, y2] = pt(a1, r0);
    const [x3, y3] = pt(a0, r0);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
  };
  const arcPath = (a0: number, a1: number, r: number): string => {
    const [x0, y0] = pt(a0, r);
    const [x1, y1] = pt(a1, r);
    return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) => {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    parent?.append(e);
    return e;
  };
  return {
    isOpen: () => open,
    show(x, y, its, center) {
      items = [...its].sort((p, q) => p.angle - q.angle);
      hasCenter = !!center;
      const m = radius + 12;
      cx = Math.max(m, Math.min(window.innerWidth - m, x));
      cy = Math.max(m, Math.min(window.innerHeight - m, y));
      root.style.left = `${cx}px`;
      root.style.top = `${cy}px`;
      root.replaceChildren();
      groups = new Map();
      const svg = el("svg", { width: radius * 2, height: radius * 2, viewBox: `${-radius} ${-radius} ${radius * 2} ${radius * 2}` });
      svg.style.left = `${-radius}px`;
      svg.style.top = `${-radius}px`;
      root.append(svg);
      const n = items.length;
      // 조각: 이웃 항목과의 가운데 각도까지가 한 조각의 경계(피자처럼 빈틈 없이 나눈다)
      items.forEach((it, i) => {
        const prev = items[(i + n - 1) % n]!;
        const next = items[(i + 1) % n]!;
        const gapPrev = (((it.angle - prev.angle) % 360) + 360) % 360 || 360;
        const gapNext = (((next.angle - it.angle) % 360) + 360) % 360 || 360;
        const a0 = it.angle - gapPrev / 2;
        const a1 = it.angle + gapNext / 2;
        const g = el("g", {}, svg) as SVGGElement;
        el("path", { class: `sec${it.enabled ? "" : " off"}`, d: slicePath(a0 + 0.6, a1 - 0.6, R_IN + 3, radius) }, g);
        el("path", { class: "rim", d: arcPath(a0 + 2, a1 - 2, radius - 3), stroke: it.color ?? "#3a4052" }, g);
        const mid = (R_IN + radius) / 2 + 4;
        const [tx, ty] = pt(it.angle, mid);
        const ty0 = it.sub ? ty - 4 : ty + 5;
        const shift = it.badge ? 12 : 0; // 번호 네모가 이름 앞에 들어갈 자리만큼 이름을 오른쪽으로 민다
        const t = el("text", { x: tx + shift, y: ty0, "font-size": 16 }, g);
        t.textContent = it.label;
        if (it.badge) {
          const w = it.label.length * 16; // 이름의 대략적인 폭(한글 16px)
          const bx = tx - w / 2 - 3; // 네모(18px) 가운데. 이름과는 6px 띄운다
          el("rect", { class: "badge", x: bx - 9, y: ty0 - 14, width: 18, height: 18, rx: 4 }, g);
          const bt = el("text", { class: "badgeNum", x: bx, y: ty0 - 0.5, "font-size": 13 }, g);
          bt.textContent = it.badge;
        }
        if (it.sub) {
          const s2 = el("text", { class: "sub", x: tx, y: ty + 14 }, g);
          s2.textContent = it.sub;
        }
        groups.set(it.key, g);
      });
      if (center) {
        const g = el("g", {}, svg) as SVGGElement;
        el("circle", { class: "sec", r: R_IN, cx: 0, cy: 0 }, g);
        const t = el("text", { x: 0, y: center.sub ? -2 : 5, "font-size": 15 }, g);
        t.textContent = center.label;
        if (center.sub) {
          const s2 = el("text", { class: "sub", x: 0, y: 14, "font-size": 11 }, g);
          s2.textContent = center.sub;
        }
        groups.set(WHEEL_CENTER, g);
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
      if (d < R_IN) {
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
      setCur(best && best.enabled ? best.key : null); // 비활성 조각은 고르지 않는다
      return cur;
    },
    current: () => cur,
    clear() {
      setCur(null);
    },
    moveTo(x, y) {
      const m = radius + 12;
      cx = Math.max(m, Math.min(window.innerWidth - m, x));
      cy = Math.max(m, Math.min(window.innerHeight - m, y));
      root.style.left = `${cx}px`;
      root.style.top = `${cy}px`;
    },
    setLook(alpha, scale) {
      root.style.opacity = String(alpha);
      root.style.transform = `scale(${scale})`;
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
