import { Texture } from "pixi.js";

/** 병종별 바꿀 색 범위: [색상 하한, 색상 상한, 최소 채도, 최소 밝기]. 피부·말·금속처럼 범위 밖 색은 그대로 둔다. */
export type RecolorRule = [number, number, number, number];
/** 병종 번호(0 기병 … 5 마법사) → 아군 스프라이트에서 '팀 색'이 칠해진 부분 */
export const UNIT_RULES: RecolorRule[] = [
  [8, 42, 0.6, 0.55],
  [60, 115, 0.4, 0],
  [20, 55, 0.6, 0.55],
  [195, 235, 0.35, 0],
  [250, 305, 0.2, 0],
  [195, 235, 0.5, 0],
];
/** 8방향 기병 프레임용(망토·깃털의 주황 계열) */
export const CAV8_RULE: RecolorRule = [8, 42, 0.7, 0.45];

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, mx === 0 ? 0 : d / mx, mx];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

const cache = new Map<string, Texture>();

/** 원본 텍스처에서 규칙에 해당하는 색만 목표 색(0xRRGGBB)의 색상으로 바꾼 텍스처. 같은 입력은 한 번만 만든다. */
export function recolored(key: string, src: Texture, rule: RecolorRule, color: number): Texture {
  const ck = `${key}/${color}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  const res = src.source.resource as CanvasImageSource;
  const w = src.source.pixelWidth;
  const h = src.source.pixelHeight;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(res, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const [lo, hi, minS, minV] = rule;
  const [th, ts, tv] = rgbToHsv(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 10) continue;
    const [hd, s, v] = rgbToHsv(d[i]! / 255, d[i + 1]! / 255, d[i + 2]! / 255);
    if (hd < lo || hd > hi || s < minS || v < minV) continue;
    const ns = Math.min(1, ts * 1.15 * (s / 0.9));
    const nv = Math.min(1, v * (0.8 + 0.25 * tv));
    const [r, g, b] = hsvToRgb(th, ns, nv);
    d[i] = Math.round(r * 255);
    d[i + 1] = Math.round(g * 255);
    d[i + 2] = Math.round(b * 255);
  }
  ctx.putImageData(img, 0, 0);
  const t = Texture.from(cv);
  cache.set(ck, t);
  return t;
}

const silCache = new WeakMap<Texture, Texture>();
/** 같은 모양의 흰 실루엣 텍스처(독에 중독된 유닛 위에 옅은 보라색 막을 씌울 때 쓴다) */
export function silhouette(src: Texture): Texture {
  const hit = silCache.get(src);
  if (hit) return hit;
  const w = src.source.pixelWidth;
  const h = src.source.pixelHeight;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src.source.resource as CanvasImageSource, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i + 1] = d[i + 2] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = Texture.from(cv);
  silCache.set(src, t);
  return t;
}
