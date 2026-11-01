/**
 * 공성전(스테이지 10): 군주가 성을 지키고, 필드에는 적이 계속 몰려온다.
 * 성은 스테이지 10에 들어가면 서서히 모습을 드러낸다(땅을 고르고 성벽이 솟는다).
 * 서버(충돌)와 클라이언트(그림)가 같은 모양을 쓰도록 여기서 정한다.
 */
export const SIEGE = {
  cx: 0, // 성 중심
  cy: -1500,
  hw: 560, // 바깥 절반 너비
  hh: 300, // 바깥 절반 높이
  wallR: 34, // 성벽 충돌 원 반지름(두께는 약 60)
  step: 44, // 성벽 충돌 원 간격
  towerR: 62, // 모서리 탑 반지름
  gateHalf: 90, // 성문 틈 절반 너비(성문 장판 길이)
  revealSec: 16, // 성이 드러나는 데 걸리는 시간
  solidAt: 0.55, // 이 비율을 넘으면 성벽이 단단해진다(그 전에는 솟는 중)
  lordX: 0,
  lordY: -1570,
  gateHp: 3600, // 성문 체력(주인공 근접 한 번 피해 기준)
  clearMargin: 160, // 성 둘레에서 지형을 치우는 여유
  clearApron: 330, // 성문 앞 마당
} as const;

/** 성벽 중심선(바깥 사각형에서 두께의 절반만큼 안쪽) */
const ex = SIEGE.hw - 30;
const ey = SIEGE.hh - 30;
export const CASTLE_WALL_Y = SIEGE.cy + ey; // 남쪽 성벽(성문이 있는 쪽) 중심선
export const GATE_X = SIEGE.cx;
export const GATE_Y = CASTLE_WALL_Y;

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
  const x0 = SIEGE.cx - ex;
  const x1 = SIEGE.cx + ex;
  const y0 = SIEGE.cy - ey;
  const y1 = SIEGE.cy + ey;
  line(x0, y0, x1, y0); // 북쪽
  line(x0, y0, x0, y1); // 서쪽
  line(x1, y0, x1, y1); // 동쪽
  line(x0, y1, x1, y1, (x) => Math.abs(x - GATE_X) < SIEGE.gateHalf + 10); // 남쪽(성문 틈)
  for (const [tx, ty] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [GATE_X - SIEGE.gateHalf - 50, y1], [GATE_X + SIEGE.gateHalf + 50, y1]] as const) out.push({ x: tx, y: ty, r: SIEGE.towerR, tower: true });
  return out;
}

/** 성을 지을 자리에 걸친 지형을 치워야 하는가(성 둘레 + 성문 앞 마당) */
export function inCastleZone(x: number, y: number, extra = 0): boolean {
  const m = SIEGE.clearMargin + extra;
  return Math.abs(x - SIEGE.cx) <= SIEGE.hw + m && y >= SIEGE.cy - SIEGE.hh - m && y <= SIEGE.cy + SIEGE.hh + SIEGE.clearApron + extra;
}

/** 성 안마당(군주가 서 있는 곳 둘레)인가 */
export const inCourtyard = (x: number, y: number): boolean => Math.abs(x - SIEGE.cx) < SIEGE.hw - 70 && Math.abs(y - SIEGE.cy) < SIEGE.hh - 70;

/** 공성전 진행 정보(스테이지 10에서만 있다) */
export interface SiegeInfo {
  reveal: number; // 성이 드러난 정도 0..100
  gate: number; // 성문 체력 비율 0..100(0이면 부서졌다)
  open: boolean; // 성문이 부서져 군주를 칠 수 있다
  sortie?: boolean; // 성문이 열려 정예가 쏟아져 나오는 중(그림)
}
