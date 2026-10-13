// 서버와 클라이언트가 함께 쓰는 규칙·프로토콜. 전투 규칙은 여기에 두어 양쪽이 어긋나지 않게 한다.

export const TICK_RATE = 20; // 서버가 초당 계산·전송하는 횟수
export const MAX_PLAYERS = 8;
export const WORLD_SIZE = 4000;
export const PLAYER_SPEED = 220; // px/s
export const PLAYER_RADIUS = 16;
export const NAME_MAX_LENGTH = 12;

export interface PlayerState {
  id: number;
  name: string;
  x: number;
  y: number;
}

export interface MoveInput {
  dx: number; // -1..1
  dy: number; // -1..1
}

export type ClientMsg =
  | { t: "join"; name: string }
  | { t: "input"; dx: number; dy: number };

export type ServerMsg =
  | { t: "welcome"; id: number; tick: number }
  | { t: "full" }
  | { t: "state"; tick: number; players: PlayerState[] };

/** 입력을 -1..1 범위로 자르고 대각선 속도가 빨라지지 않게 정규화한다. 클라이언트 입력은 신뢰하지 않는다. */
export function sanitizeInput(dx: unknown, dy: unknown): MoveInput {
  let x = typeof dx === "number" && Number.isFinite(dx) ? Math.max(-1, Math.min(1, dx)) : 0;
  let y = typeof dy === "number" && Number.isFinite(dy) ? Math.max(-1, Math.min(1, dy)) : 0;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { dx: x, dy: y };
}

export function stepPlayer(p: PlayerState, input: MoveInput, dt: number): void {
  const half = WORLD_SIZE / 2 - PLAYER_RADIUS;
  p.x = Math.max(-half, Math.min(half, p.x + input.dx * PLAYER_SPEED * dt));
  p.y = Math.max(-half, Math.min(half, p.y + input.dy * PLAYER_SPEED * dt));
}
