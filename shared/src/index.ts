// 서버와 클라이언트가 함께 쓰는 규칙·프로토콜. 전투 규칙은 여기에 두어 양쪽이 어긋나지 않게 한다.

export const TICK_RATE = 20; // 서버가 초당 계산·전송하는 횟수
export const MAX_PLAYERS = 8;
export const WORLD_SIZE = 4000;
export const NAME_MAX_LENGTH = 12;

// 주인공
export const PLAYER_SPEED = 220; // px/s
export const PLAYER_RADIUS = 16;
export const PLAYER_MAX_HP = 100;
export const PLAYER_RESPAWN_SEC = 5;
export const PLAYER_HIT_COOLDOWN_SEC = 0.5; // 같은 플레이어가 연속으로 피해를 받는 최소 간격

// 주인공 기본 공격(투사체)
export const FIRE_COOLDOWN_SEC = 0.25;
export const BULLET_SPEED = 600;
export const BULLET_RANGE = 520;
export const BULLET_RADIUS = 5;
export const BULLET_DAMAGE = 10;

// 적
export const ENEMY_RADIUS = 12;
export const ENEMY_HP = 20;
export const ENEMY_SPEED = 90;
export const ENEMY_CONTACT_DAMAGE = 8;
export const ENEMY_SPAWN_DISTANCE = 650; // 플레이어로부터 이 거리(화면 밖)에서 생성
export const ENEMY_MAX = 400;
export const ENEMY_SPAWN_BASE_PER_SEC = 2; // 플레이어 1명당
export const ENEMY_SPAWN_GROWTH_PER_SEC = 0.04; // 시간이 지날수록 초당 늘어나는 양

export interface PlayerState {
  id: number;
  name: string;
  x: number;
  y: number;
  hp: number;
  aim: number; // 조준 방향(라디안)
  kills: number;
  respawn: number; // 사망 시 부활까지 남은 초, 생존 중이면 0
}

/** 네트워크 용량을 줄이기 위해 적·투사체는 배열로 보낸다. */
export type EnemyWire = [id: number, x: number, y: number, hp: number];
export type BulletWire = [id: number, x: number, y: number, ownerId: number];

export interface PlayerInput {
  dx: number; // -1..1
  dy: number; // -1..1
  aim: number; // 라디안
  fire: boolean;
}

export type ClientMsg =
  | { t: "join"; name: string }
  | { t: "input"; dx: number; dy: number; aim: number; fire: boolean };

export type ServerMsg =
  | { t: "welcome"; id: number; tick: number }
  | { t: "full" }
  | {
      t: "state";
      tick: number;
      time: number; // 게임 경과 시간(초)
      players: PlayerState[];
      enemies: EnemyWire[];
      bullets: BulletWire[];
    };

/** 클라이언트 입력은 신뢰하지 않는다: 범위를 자르고, 대각선 속도가 빨라지지 않게 정규화한다. */
export function sanitizeInput(raw: Partial<Record<keyof PlayerInput, unknown>>): PlayerInput {
  const num = (v: unknown, lo: number, hi: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0;
  let dx = num(raw.dx, -1, 1);
  let dy = num(raw.dy, -1, 1);
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  return { dx, dy, aim: num(raw.aim, -Math.PI * 2, Math.PI * 2), fire: raw.fire === true };
}

export function clampToWorld(v: number, radius: number): number {
  const half = WORLD_SIZE / 2 - radius;
  return Math.max(-half, Math.min(half, v));
}
