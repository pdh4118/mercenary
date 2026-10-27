/**
 * 지형: 통과할 수 없는 바위·나무 밑동·폐허와, 올라가면 느려지지만 화살이 강해지는 고지대.
 * 판마다 새로 만들어지고(generateTerrain) 서버와 클라이언트가 같은 계산(TerrainMap)을 쓴다.
 */
import { TERRAIN_SPRITES } from "./terrain-data.js";
import { TUNE } from "./rules.js";

export const TK_ROCK = 0;
export const TK_TREE = 1;
export const TK_RUIN = 2;
export const TK_PLATEAU = 3;
export const TK_DECOR = 4; // 통과할 수 있는 장식(자갈·덤불)

export interface TerrainSprite {
  readonly i: number;
  readonly kind: number;
  readonly w: number;
  readonly h: number;
  readonly circles: readonly (readonly number[])[]; // [x, y, 반지름] 스프라이트 픽셀(왼쪽 위 원점)
  readonly tops: readonly (readonly number[])[]; // 고지대 윗면 타원 [cx, cy, rx, ry]
  readonly block?: boolean; // 올라갈 길이 없는 산: 통째로 통과할 수 없다(고지대 효과 없음)
  readonly rampW?: number; // 올라가는 길의 반폭(스프라이트 픽셀)
  readonly ramp?: readonly (readonly number[])[]; // 올라가는 길(꺾은선, 스프라이트 픽셀). 이 길 위에서는 비탈이 덜 느리다
}

export const SPRITE_BY_ID = new Map<number, TerrainSprite>((TERRAIN_SPRITES as unknown as TerrainSprite[]).map((s) => [s.i, s]));
const idsOf = (kind: number): number[] => (TERRAIN_SPRITES as unknown as TerrainSprite[]).filter((s) => s.kind === kind).map((s) => s.i);

/** 서버가 클라이언트에 보내는 지형 한 개: [스프라이트 번호, x, y, 배율, 좌우 뒤집기(0/1)] */
export type TerrainWire = [number, number, number, number, number];

/** 지형 배치 기준점: 일반 물체는 발밑(스프라이트 아래 가운데), 고지대는 윗면 타원의 중심 */
export function anchorOf(s: TerrainSprite): [number, number] {
  if (s.kind === TK_PLATEAU) return [s.tops[0]![0]!, s.tops[0]![1]!];
  return [s.w / 2, s.h];
}

interface Ell {
  x: number;
  y: number;
  rx: number;
  ry: number;
}
const segDist = (x: number, y: number, a: readonly number[], b: readonly number[]): number => {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]!) * dx + (y - a[1]!) * dy) / l2)) : 0;
  return Math.hypot(x - (a[0]! + dx * t), y - (a[1]! + dy * t));
};
const inEll = (e: Ell, x: number, y: number): boolean => ((x - e.x) / e.rx) ** 2 + ((y - e.y) / e.ry) ** 2 <= 1;

interface Solid {
  x: number;
  y: number;
  r: number;
  arrow: boolean; // 화살을 막는가(바위·폐허)
  obj: number; // 몇 번째 지형 물체의 것인가
}
interface Plateau {
  tops: Ell[];
  slope: Ell;
  ramp: [number, number][]; // 올라가는 길 꺾은선(월드)
  rampHalf: number;
  obj: number;
}

const CELL = 256;
const NAV_CELL = 50; // 길 찾기 격자 한 칸(px)
const NAV_WORLD = 4000; // 월드 한 변(WORLD_SIZE와 같다. index와 순환 참조가 생겨 따로 둔다)
const NAV_HALF = NAV_WORLD / 2;
const NAV_N = Math.ceil(NAV_WORLD / NAV_CELL);
const NAV_BODY = 16; // 격자 칸이 막혔는지 볼 때 쓰는 몸 반지름
const key = (cx: number, cy: number) => cx * 100003 + cy;

/** 서버·클라이언트가 함께 쓰는 지형 조회·충돌 */
export class TerrainMap {
  readonly solids: Solid[] = [];
  readonly plateaus: Plateau[] = [];
  /** 경기장 안에 걸친 물체인가(토너먼트 중에는 없는 셈 친다) */
  private inArena: boolean[] = [];
  private duel = false;
  private grid = new Map<number, number[]>();

  constructor(readonly items: readonly TerrainWire[], arenaRadius = 0) {
    items.forEach((it, n) => {
      const s = SPRITE_BY_ID.get(it[0]);
      if (!s) {
        this.inArena.push(false);
        return;
      }
      const [x, y, sc, flip] = [it[1], it[2], it[3], it[4]];
      const [ax, ay] = anchorOf(s);
      const fx = flip ? -1 : 1;
      let extent = 0;
      const world = (px: number, py: number): [number, number] => [x + (px - ax) * sc * fx, y + (py - ay) * sc];
      for (const c of s.circles) {
        const [wx, wy] = world(c[0]!, c[1]!);
        this.solids.push({ x: wx, y: wy, r: c[2]! * sc, arrow: s.kind !== TK_TREE && c[3] !== 2, obj: n }); // 3번째 값 2: 절벽(화살은 넘어간다)
        extent = Math.max(extent, Math.hypot(wx - x, wy - y) + c[2]! * sc);
      }
      if (s.kind === TK_PLATEAU && !s.block) {
        const tops: Ell[] = s.tops.map((t) => {
          const [wx, wy] = world(t[0]!, t[1]!);
          return { x: wx, y: wy, rx: t[2]! * sc, ry: t[3]! * sc };
        });
        const [sx, sy] = world(s.w / 2, s.h * 0.58);
        const ramp = (s.ramp ?? []).map((p) => world(p[0]!, p[1]!));
        this.plateaus.push({ tops, slope: { x: sx, y: sy, rx: s.w * 0.5 * sc, ry: s.h * 0.4 * sc }, ramp, rampHalf: Math.max(24, (s.rampW ?? s.w * 0.045) * sc), obj: n });
        extent = Math.max(extent, s.w * 0.5 * sc);
      }
      this.inArena.push(arenaRadius > 0 && Math.hypot(x, y) < arenaRadius + extent);
    });
    this.solids.forEach((c, idx) => {
      const x0 = Math.floor((c.x - c.r) / CELL);
      const x1 = Math.floor((c.x + c.r) / CELL);
      const y0 = Math.floor((c.y - c.r) / CELL);
      const y1 = Math.floor((c.y + c.r) / CELL);
      for (let gx = x0; gx <= x1; gx++)
        for (let gy = y0; gy <= y1; gy++) {
          const k = key(gx, gy);
          const cell = this.grid.get(k);
          if (cell) cell.push(idx);
          else this.grid.set(k, [idx]);
        }
    });
  }

  /** 토너먼트 중에는 경기장에 걸친 지형이 사라진다 */
  setDuel(on: boolean): void {
    this.duel = on;
  }
  private live(obj: number): boolean {
    return !(this.duel && this.inArena[obj]);
  }

  /** 이 물체가 지금 있는 것으로 치는가(토너먼트 중에는 경기장에 걸친 것이 사라진다) */
  liveObj(n: number): boolean {
    return this.live(n);
  }

  /** 반지름 r인 몸이 통과할 수 없는 지형 밖으로 밀려난 위치. 안 겹치면 그대로. */
  pushOut(x: number, y: number, r: number): [number, number] {
    if (this.solids.length === 0) return [x, y];
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++)
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const cell = this.grid.get(key(gx, gy));
          if (!cell) continue;
          for (const idx of cell) {
            const c = this.solids[idx]!;
            if (!this.live(c.obj)) continue;
            const dx = x - c.x;
            const dy = y - c.y;
            const min = c.r + r;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min) continue;
            const d = Math.sqrt(d2);
            const nx = d > 1e-6 ? dx / d : 1;
            const ny = d > 1e-6 ? dy / d : 0;
            x = c.x + nx * min;
            y = c.y + ny * min;
            moved = true;
          }
        }
      if (!moved) break;
    }
    return [x, y];
  }

  /** 점(x,y)이 통과할 수 없는 지형에 닿는가(화살은 arrowOnly로 막는 것만) */
  hitsSolid(x: number, y: number, r: number, arrowOnly = false): boolean {
    if (this.solids.length === 0) return false;
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    for (let gx = cx - 1; gx <= cx + 1; gx++)
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const cell = this.grid.get(key(gx, gy));
        if (!cell) continue;
        for (const idx of cell) {
          const c = this.solids[idx]!;
          if (arrowOnly && !c.arrow) continue;
          if (!this.live(c.obj)) continue;
          if (Math.hypot(x - c.x, y - c.y) < c.r + r) return true;
        }
      }
    return false;
  }

  /** 고지대 윗면에 서 있는가 */
  elevated(x: number, y: number): boolean {
    for (const p of this.plateaus) if (this.live(p.obj) && p.tops.some((t) => inEll(t, x, y))) return true;
    return false;
  }

  private onRampOf(p: Plateau, x: number, y: number): boolean {
    for (let i = 0; i + 1 < p.ramp.length; i++) if (segDist(x, y, p.ramp[i]!, p.ramp[i + 1]!) <= p.rampHalf) return true;
    return false;
  }

  private inZone(p: Plateau, x: number, y: number): boolean {
    return p.tops.some((t) => inEll(t, x, y)) || this.onRampOf(p, x, y);
  }

  /** 올라가는 길 꺾은선에서 가장 가까운 점의 위치(구간 번호 + 구간 안 비율)와 거리 */
  private progress(p: Plateau, x: number, y: number): { pr: number; d: number } {
    let best = { pr: 0, d: Infinity };
    for (let i = 0; i + 1 < p.ramp.length; i++) {
      const a = p.ramp[i]!;
      const b = p.ramp[i + 1]!;
      const dx = b[0]! - a[0]!;
      const dy = b[1]! - a[1]!;
      const l2 = dx * dx + dy * dy;
      const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]!) * dx + (y - a[1]!) * dy) / l2)) : 0;
      const d = Math.hypot(x - (a[0]! + dx * u), y - (a[1]! + dy * u));
      if (d < best.d) best = { pr: i + u, d };
    }
    return best;
  }

  /**
   * 올라가는 길로만 오르내릴 수 있으므로, 고지대 안팎이나 층 사이를 오가는 유닛은 길을 따라가야 한다.
   * 목적지(tx,ty)로 가기 위해 지금 향해야 할 중간 지점을 돌려준다. 그대로 가도 되면 null.
   */
  route(x: number, y: number, tx: number, ty: number): [number, number] | null {
    for (const p of this.plateaus) {
      if (!this.live(p.obj) || p.ramp.length < 2) continue;
      const inS = this.inZone(p, x, y);
      const inT = this.inZone(p, tx, ty);
      if (!inS && !inT) continue; // 둘 다 밖: 이 고지대와 상관없다
      const ps = inS ? this.progress(p, x, y).pr : -1;
      const pt = inT ? this.progress(p, tx, ty).pr : -1;
      if (Math.abs(ps - pt) < 0.6) continue; // 같은 층: 곧장
      if (!inS) {
        // 올라가기 전: 길 입구로(이미 입구 근처면 첫 구간으로)
        return p.ramp[Math.abs(this.progress(p, x, y).d) < p.rampHalf * 1.6 ? 1 : 0]!;
      }
      if (pt > ps) return p.ramp[Math.min(p.ramp.length - 1, Math.floor(ps) + 1)]!; // 위로: 다음 꼭짓점
      // 아래로: 지나온 꼭짓점
      const k = Math.ceil(ps) - 1 < 0 ? 0 : Math.ceil(ps) - 1;
      if (ps < 0.6 && pt < 0) return null; // 입구에 닿았다: 목적지로 곧장
      return p.ramp[ps - Math.floor(ps) > 0.02 ? Math.floor(ps) : Math.max(0, k)]!;
    }
    return null;
  }

  /** 올라가는 길(계단·다리) 위에 서 있는가 */
  onRamp(x: number, y: number): boolean {
    for (const p of this.plateaus) {
      if (!this.live(p.obj) || p.ramp.length < 2 || !inEll(p.slope, x, y)) continue;
      for (let i = 0; i + 1 < p.ramp.length; i++) if (segDist(x, y, p.ramp[i]!, p.ramp[i + 1]!) <= p.rampHalf) return true;
    }
    return false;
  }

  /** 지형이 이동 속도에 주는 배율: 고지대 윗면은 조금, 비탈은 많이, 올라가는 길은 비탈보다 덜 느리다 */
  speedMult(x: number, y: number): number {
    let m = 1;
    for (const p of this.plateaus) {
      if (!this.live(p.obj)) continue;
      if (p.tops.some((t) => inEll(t, x, y))) m = Math.min(m, TUNE.PLATEAU_TOP_SPEED);
      else if (inEll(p.slope, x, y)) {
        if (p.ramp.length >= 2) {
          if (this.onRampOf(p, x, y)) m = Math.min(m, TUNE.RAMP_SPEED); // 길 밖은 절벽이라 들어올 수 없다
        } else m = Math.min(m, TUNE.SLOPE_SPEED);
      }
    }
    return m;
  }

  /** 두 점 사이를 몸 반지름 r로 지나갈 수 있는가(단단한 지형에 걸리지 않는가) */
  lineClear(x0: number, y0: number, x1: number, y1: number, r: number, arrowOnly = false): boolean {
    if (this.solids.length === 0) return true;
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(d / 30));
    for (let i = 1; i <= n; i++) if (this.hitsSolid(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, arrowOnly)) return false;
    return true;
  }

  private nav: { duel: boolean; blocked: Uint8Array } | null = null;
  private navBlocked(): Uint8Array {
    if (this.nav && this.nav.duel === this.duel) return this.nav.blocked;
    const blocked = new Uint8Array(NAV_N * NAV_N);
    for (let gy = 0; gy < NAV_N; gy++) for (let gx = 0; gx < NAV_N; gx++) if (this.hitsSolid((gx + 0.5) * NAV_CELL - NAV_HALF, (gy + 0.5) * NAV_CELL - NAV_HALF, NAV_BODY)) blocked[gy * NAV_N + gx] = 1;
    this.nav = { duel: this.duel, blocked };
    return blocked;
  }

  /**
   * 단단한 지형을 피해 (x,y)에서 (tx,ty)로 가는 길을 격자 A*로 찾아, 꺾이는 지점(월드 좌표)들을 돌려준다. 곧장 갈 수 있으면 빈 배열, 길이 없으면 null.
   * 곧장 가는 선이 막힌 경우에만 쓰도록 만든 것이라, 막히지 않았으면 바로 돌려준다.
   */
  findPath(x: number, y: number, tx: number, ty: number, r = 14): [number, number][] | null {
    if (this.lineClear(x, y, tx, ty, r)) return [];
    const blocked = this.navBlocked();
    const cell = (v: number) => Math.max(0, Math.min(NAV_N - 1, Math.floor((v + NAV_HALF) / NAV_CELL)));
    const sx = cell(x);
    const sy = cell(y);
    let gx = cell(tx);
    let gy = cell(ty);
    if (blocked[gy * NAV_N + gx]) {
      // 목표가 지형 안이면 가장 가까운 빈 칸으로
      let found = false;
      for (let rad = 1; rad <= 6 && !found; rad++) {
        for (let dy = -rad; dy <= rad && !found; dy++)
          for (let dx = -rad; dx <= rad && !found; dx++) {
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx < 0 || ny < 0 || nx >= NAV_N || ny >= NAV_N || blocked[ny * NAV_N + nx]) continue;
            gx = nx;
            gy = ny;
            found = true;
          }
      }
      if (!found) return null;
    }
    const idx = (cx: number, cy: number) => cy * NAV_N + cx;
    const g = new Float32Array(NAV_N * NAV_N).fill(Infinity);
    const from = new Int32Array(NAV_N * NAV_N).fill(-1);
    const closed = new Uint8Array(NAV_N * NAV_N);
    const heap: [number, number][] = []; // [f, idx]
    const push = (f: number, i: number) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) {
        const up = (k - 1) >> 1;
        if (heap[up]![0] <= heap[k]![0]) break;
        [heap[up], heap[k]] = [heap[k]!, heap[up]!];
        k = up;
      }
    };
    const pop = (): number => {
      const top = heap[0]!;
      const last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = k * 2 + 1;
          const rr = l + 1;
          let m = k;
          if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
          if (rr < heap.length && heap[rr]![0] < heap[m]![0]) m = rr;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k]!, heap[m]!];
          k = m;
        }
      }
      return top[1];
    };
    const h = (cx: number, cy: number) => Math.hypot(cx - gx, cy - gy);
    g[idx(sx, sy)] = 0;
    push(h(sx, sy), idx(sx, sy));
    const goal = idx(gx, gy);
    let expanded = 0;
    while (heap.length > 0 && expanded < 6000) {
      const cur = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      expanded++;
      if (cur === goal) break;
      const cx = cur % NAV_N;
      const cy = (cur / NAV_N) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= NAV_N || ny >= NAV_N) continue;
          const ni = idx(nx, ny);
          if (closed[ni] || (blocked[ni] && ni !== idx(sx, sy))) continue;
          if (dx && dy && (blocked[idx(cx + dx, cy)] || blocked[idx(cx, cy + dy)])) continue; // 모서리를 비스듬히 스치지 않는다
          const ng = g[cur]! + (dx && dy ? 1.414 : 1);
          if (ng < g[ni]!) {
            g[ni] = ng;
            from[ni] = cur;
            push(ng + h(nx, ny), ni);
          }
        }
    }
    if (!closed[goal]) return null;
    const cells: [number, number][] = [];
    for (let i = goal; i !== -1 && i !== idx(sx, sy); i = from[i]!) cells.push([(i % NAV_N + 0.5) * NAV_CELL - NAV_HALF, (((i / NAV_N) | 0) + 0.5) * NAV_CELL - NAV_HALF]);
    cells.reverse();
    // 곧게 이어지는 구간을 줄인다(가장 먼 보이는 지점으로 건너뛴다)
    const out: [number, number][] = [];
    let ax = x;
    let ay = y;
    let k = 0;
    while (k < cells.length) {
      let far = k;
      for (let j = cells.length - 1; j > k; j--) {
        if (this.lineClear(ax, ay, cells[j]![0], cells[j]![1], r)) {
          far = j;
          break;
        }
      }
      out.push(cells[far]!);
      [ax, ay] = cells[far]!;
      k = far + 1;
    }
    return out;
  }

  /** 무엇이든 놓기 곤란한 곳인가(캠프·보상 상자 자리 고르기용): 단단한 지형이거나 고지대 */
  blocked(x: number, y: number, r: number): boolean {
    if (this.hitsSolid(x, y, r)) return true;
    const fat = (e: Ell): Ell => ({ x: e.x, y: e.y, rx: e.rx + r, ry: e.ry + r });
    return this.plateaus.some((p) => this.live(p.obj) && (p.tops.some((t) => inEll(fat(t), x, y)) || inEll(fat(p.slope), x, y)));
  }
}

// --- 만들기 -----------------------------------------------------------------

/** 해상도가 낮은 옛 에셋(번호 40 미만): 작게, 드물게 쓴다 */
export const LEGACY_SPRITE_BELOW = 40;
const LEGACY_SCALE = 0.45; // 그림 크기가 100~200px라 이 정도까지 줄여야 확대 흐림이 안 보인다
const SMALL_SHEET_SCALE = 0.7; // 새 시트의 작은 바위(번호 54~60)도 원본이 작다
const HI_RES_FROM = 70; // 번호 70 이상은 800px급 고해상도 고지대
const legacyFactor = (id: number): number => (id < LEGACY_SPRITE_BELOW ? LEGACY_SCALE : id >= 54 && id <= 60 ? SMALL_SHEET_SCALE : 1);
const ROCKS = (() => {
  const all = idsOf(TK_ROCK);
  const fresh = all.filter((id) => id >= LEGACY_SPRITE_BELOW);
  return [...all, ...fresh, ...fresh, ...fresh]; // 새 바위가 옛 바위보다 4배쯤 자주 뽑힌다
})();
const TREES = idsOf(TK_TREE);
const RUINS = idsOf(TK_RUIN);
const PLATEAUS = idsOf(TK_PLATEAU);
const DECOR = idsOf(TK_DECOR);
const SCALE: Record<number, [number, number]> = {
  [TK_ROCK]: [1.0, 1.5],
  [TK_TREE]: [0.9, 1.25],
  [TK_RUIN]: [1.1, 1.5],
  [TK_PLATEAU]: [1.0, 1.0], // 고지대는 목표 너비로 따로 정한다(plateauScale)
  [TK_DECOR]: [0.9, 1.4],
};

/** 스프라이트의 월드 기준 대략적인 점유 반지름(겹침 방지용) */
/** 고지대의 배율: 원본 해상도가 크지 않아서 확대를 거의 하지 않는다 */
function plateauScale(s: TerrainSprite, rng: () => number): number {
  // 원본보다 크게 늘리면 흐려 보이므로, 중간 해상도(300~500px) 고지대는 원본의 1.0~1.25배까지만, 고해상도(800px급)는 0.85~1.05배로 쓴다
  return s.i >= HI_RES_FROM ? 0.85 + rng() * 0.2 : 1.0 + rng() * 0.25;
}

function footprint(s: TerrainSprite, sc: number): number {
  if (s.kind === TK_PLATEAU) return s.w * 0.5 * sc;
  if (s.kind === TK_TREE) return s.w * 0.28 * sc;
  return s.w * 0.45 * sc;
}

/**
 * 판마다 새 지형을 만든다. avoid: 비워 둘 곳 [x, y, 반지름](시작 위치 등).
 * 고지대 몇 곳 + 폐허·바위로 된 방벽(사이에 좁은 통로) + 흩어진 바위·나무·장식.
 */
export function generateTerrain(rng: () => number, half: number, avoid: readonly (readonly number[])[] = []): TerrainWire[] {
  const out: TerrainWire[] = [];
  const placed: { x: number; y: number; r: number; solid: boolean }[] = [];
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rng() * a.length)]!;
  const lim = half - 220;
  const free = (x: number, y: number, r: number, gap: number, solid: boolean): boolean => {
    if (Math.abs(x) > lim || Math.abs(y) > lim) return false;
    for (const a of avoid) if (Math.hypot(x - a[0]!, y - a[1]!) < r + a[2]!) return false;
    for (const p of placed) {
      if (!solid && !p.solid) continue; // 장식끼리는 겹쳐도 된다
      if (Math.hypot(x - p.x, y - p.y) < r + p.r + gap) return false;
    }
    return true;
  };
  const add = (id: number, x: number, y: number, sc: number, flip: number) => {
    const s = SPRITE_BY_ID.get(id)!;
    out.push([id, Math.round(x), Math.round(y), Math.round(sc * 100) / 100, flip]);
    placed.push({ x, y, r: footprint(s, sc), solid: s.kind !== TK_DECOR });
  };
  const place = (ids: readonly number[], tries: number, gap: number): boolean => {
    for (let t = 0; t < tries; t++) {
      const id = pick(ids);
      const s = SPRITE_BY_ID.get(id)!;
      const [lo, hi] = SCALE[s.kind]!;
      const sc = s.kind === TK_PLATEAU ? plateauScale(s, rng) : (lo + rng() * (hi - lo)) * legacyFactor(id);
      const x = (rng() * 2 - 1) * lim;
      const y = (rng() * 2 - 1) * lim;
      if (!free(x, y, footprint(s, sc), gap, s.kind !== TK_DECOR)) continue;
      add(id, x, y, sc, rng() < 0.5 ? 1 : 0);
      return true;
    }
    return false;
  };

  // 1) 고지대(크게)
  const nPlateau = 5 + Math.floor(rng() * 3);
  for (let n = 0; n < nPlateau; n++) place(PLATEAUS, 40, 160);
  // 2) 방벽: 폐허·바위 3~5개를 한 줄로 세우되 사이에 좁은 통로를 남긴다
  const nWalls = 5 + Math.floor(rng() * 3);
  for (let n = 0; n < nWalls; n++) {
    const len = 3 + Math.floor(rng() * 3);
    const ang = rng() * Math.PI;
    const cx = (rng() * 2 - 1) * lim;
    const cy = (rng() * 2 - 1) * lim;
    const dirx = Math.cos(ang);
    const diry = Math.sin(ang);
    const pieces: { id: number; sc: number }[] = [];
    for (let k = 0; k < len; k++) {
      const id = pick(rng() < 0.45 ? RUINS : ROCKS);
      const s = SPRITE_BY_ID.get(id)!;
      const [lo, hi] = SCALE[s.kind]!;
      pieces.push({ id, sc: (lo + rng() * (hi - lo)) * legacyFactor(id) });
    }
    // 이어 놓을 위치(조각 반지름 + 통로 폭)
    const gapPx = rng() < 0.5 ? 100 : 160;
    let off = -((len - 1) / 2) * 150;
    const spots: { id: number; sc: number; x: number; y: number }[] = [];
    for (const pc of pieces) {
      const r = footprint(SPRITE_BY_ID.get(pc.id)!, pc.sc);
      spots.push({ ...pc, x: cx + dirx * off, y: cy + diry * off });
      off += r * 1.6 + gapPx * 0.5;
    }
    if (spots.every((p) => free(p.x, p.y, footprint(SPRITE_BY_ID.get(p.id)!, p.sc) * 0.8, 40, true))) for (const p of spots) add(p.id, p.x, p.y, p.sc, rng() < 0.5 ? 1 : 0);
  }
  // 3) 흩어진 바위·폐허·나무, 장식
  for (let n = 0; n < 20; n++) place(rng() < 0.85 ? ROCKS : RUINS, 30, 90);
  for (let n = 0; n < 22; n++) place(TREES, 30, 40);
  for (let n = 0; n < 24; n++) place(DECOR, 10, 0);
  return out;
}
