/**
 * 공성전(스테이지 10): 군주가 성을 지키고, 필드에는 적이 계속 몰려온다.
 * 성은 스테이지 10에 들어가면 서서히 모습을 드러낸다(땅을 고르고 성벽이 솟는다).
 * 서버(충돌)와 클라이언트(그림)가 같은 모양을 쓰도록 여기서 정한다.
 */
export const SIEGE = {
  cx: 0, // 성 중심
  cy: -1498,
  hw: 600, // 성이 차지하는 구역의 절반 너비(탑 포함, 지형을 치우는 기준)
  hh: 330, // 구역의 절반 높이
  wallR: 48, // 성벽 충돌 원 반지름(두께 약 96)
  step: 44, // 성벽 충돌 원 간격
  towerR: 62, // 모서리 탑 반지름
  gateHalf: 48, // 성문 틈 절반 너비(성문 장판 길이)
  revealSec: 16, // 성이 드러나는 데 걸리는 시간
  solidAt: 0.55, // 이 비율을 넘으면 성벽이 단단해진다(그 전에는 솟는 중)
  lordX: 0,
  lordY: -1570,
  gateHp: 3600, // 성문 체력(주인공 근접 한 번 피해 기준)
  clearMargin: 160, // 성 둘레에서 지형을 치우는 여유
  clearApron: 330, // 성문 앞 마당
} as const;

/** 성벽 중심선 사각형(그림 한 장 `boss10_castle`의 성벽에 맞춘다) */
export const RING = { ex: 383, north: -1715, south: -1282 } as const;
export const CASTLE_WALL_Y = RING.south; // 남쪽 성벽(성문이 있는 쪽) 중심선
export const GATE_X = SIEGE.cx;
export const GATE_Y = CASTLE_WALL_Y;
/** 모서리 탑 중심(성벽 바깥쪽으로 튀어나온다) */
export const TOWERS: readonly (readonly [number, number])[] = [[-530, -1781], [530, -1781], [-530, -1249], [530, -1249]];
/** 안뜰 바닥 범위(성벽 안쪽) */
export const COURT = { cx: 0, cy: -1495, hw: 330, hh: 150 } as const;

export interface CastleSolid {
  x: number;
  y: number;
  r: number;
  tower: boolean;
}

/** 성벽·탑의 충돌 원(성문 자리는 비워 둔다) */
export function castleSolids(): CastleSolid[] {
  const out: CastleSolid[] = [];
  const line = (x0: number, y0: number, x1: number, y1: number, skip?: (x: number, y: number) => boolean) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / SIEGE.step));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      if (skip?.(x, y)) continue;
      out.push({ x, y, r: SIEGE.wallR, tower: false });
    }
  };
  const x0 = SIEGE.cx - RING.ex;
  const x1 = SIEGE.cx + RING.ex;
  line(x0, RING.north, x1, RING.north); // 북쪽
  line(x0, RING.north, x0, RING.south); // 서쪽
  line(x1, RING.north, x1, RING.south); // 동쪽
  line(x0, RING.south, x1, RING.south, (x) => Math.abs(x - GATE_X) < SIEGE.gateHalf + 14); // 남쪽(성문 틈)
  for (const [tx, ty] of TOWERS) out.push({ x: tx, y: ty, r: SIEGE.towerR, tower: true });
  return out;
}

/** 성을 지을 자리에 걸친 지형을 치워야 하는가(성 둘레 + 성문 앞 마당) */
export function inCastleZone(x: number, y: number, extra = 0): boolean {
  const m = SIEGE.clearMargin + extra;
  return Math.abs(x - SIEGE.cx) <= SIEGE.hw + m && y >= SIEGE.cy - SIEGE.hh - m && y <= SIEGE.cy + SIEGE.hh + SIEGE.clearApron + extra;
}

/** 성 안마당인가 */
export const inCourtyard = (x: number, y: number): boolean => Math.abs(x - COURT.cx) < COURT.hw && Math.abs(y - COURT.cy) < COURT.hh;

/**
 * 성벽 위(서·북·동 성벽의 윗면 통로)와 오르는 계단. 성문이 부서진 뒤 안뜰의 계단으로만 오를 수 있다.
 * 계단 두 개는 북쪽 성벽 안쪽 면을 따라 놓여 있고(그림 `boss10_castle`), 바깥 끝(모서리 쪽)이 성벽 위 통로로 이어진다.
 */
export const WALL_STRIP_HALF = 46; // 성벽 윗면 통로의 절반 폭
type Rect = readonly [number, number, number, number]; // x0, y0, x1, y1
export const WALL_STRIPS: readonly Rect[] = [
  [-RING.ex - WALL_STRIP_HALF, RING.north - WALL_STRIP_HALF, RING.ex + WALL_STRIP_HALF, RING.north + WALL_STRIP_HALF], // 북쪽
  [-RING.ex - WALL_STRIP_HALF, RING.north, -RING.ex + WALL_STRIP_HALF, RING.south - 70], // 서쪽
  [RING.ex - WALL_STRIP_HALF, RING.north, RING.ex + WALL_STRIP_HALF, RING.south - 70], // 동쪽
];
export const RAMP_Y0 = -1672; // 계단 상자(북쪽 성벽 안쪽 면을 따라)
export const RAMP_Y1 = -1592;
export const RAMP_IN = 96; // 계단 낮은 끝(중앙 쪽) |x|
export const RAMP_OUT = 292; // 계단 높은 끝(모서리 쪽) |x|
export const RAMP_TOP_AT = 258; // 이 |x| 이상이면 성벽 위에 올라선 것
export const RAMP_DOWN_AT = 130; // 올라가 있다가 이 |x| 이하로 내려오면 내려온 것
export const WALL_RAMPS: readonly Rect[] = [
  [-RAMP_OUT, RAMP_Y0, -RAMP_IN, RAMP_Y1],
  [RAMP_IN, RAMP_Y0, RAMP_OUT, RAMP_Y1],
];
const inRect = (r: Rect, x: number, y: number): boolean => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

/** 계단 상자 안에 있는가: -1 서쪽, 1 동쪽, 0 아님 */
export function rampSideAt(x: number, y: number): number {
  if (inRect(WALL_RAMPS[0]!, x, y)) return -1;
  if (inRect(WALL_RAMPS[1]!, x, y)) return 1;
  return 0;
}

/** 성벽 위에 서 있는 대상을 통로와 계단 안으로 가둔다(가장 가까운 상자 안으로 끌어 넣는다) */
export function clampToWallTop(x: number, y: number): [number, number] {
  let best: [number, number] = [x, y];
  let bd = Infinity;
  for (const r of [...WALL_STRIPS, ...WALL_RAMPS]) {
    const cx = Math.max(r[0], Math.min(r[2], x));
    const cy = Math.max(r[1], Math.min(r[3], y));
    const d = Math.hypot(cx - x, cy - y);
    if (d < bd) {
      bd = d;
      best = [cx, cy];
    }
  }
  return best;
}

/** 공성전 진행 정보(스테이지 10에서만 있다) */
export interface SiegeInfo {
  reveal: number; // 성이 드러난 정도 0..100
  gate: number; // 성문 체력 비율 0..100(0이면 부서졌다)
  open: boolean; // 성문이 부서져 군주를 칠 수 있다
  guards?: number; // 살아 있는 근위대 수
  sortie?: boolean; // 성문이 열려 정예가 쏟아져 나오는 중(그림)
}
