// 서버와 클라이언트가 함께 쓰는 규칙·프로토콜. 전투 규칙은 여기에 두어 양쪽이 어긋나지 않게 한다.

export * from "./rules.js";
export * from "./cards.js";
import { ARCHER, BLUNT, SHIELD, SPEAR } from "./rules.js";

export const TICK_RATE = 20; // 서버가 초당 계산·전송하는 횟수
export const MAX_PLAYERS = 8;
export const WORLD_SIZE = 4000;
export const NAME_MAX_LENGTH = 12;

// 주인공
export const PLAYER_SPEED = 220; // px/s
export const PLAYER_RADIUS = 16;
export const PLAYER_MAX_HP = 100;
export const PLAYER_RESPAWN_SEC = 5;

// 주인공 기본 공격(투사체). 병종이 없으므로 상성 배율은 적용되지 않는다.
export const FIRE_COOLDOWN_SEC = 0.25;
export const BULLET_SPEED = 600;
export const BULLET_RANGE = 520;
export const BULLET_RADIUS = 5;
export const BULLET_DAMAGE = 10;

/**
 * 주인공 무기. 무기마다 병종 속성이 있어 같은 상성표(COUNTER_MATRIX)가 적용된다.
 * 활은 원거리 투사체, 나머지는 조준 방향으로 부채꼴을 휘두르는 근접 무기다.
 */
export interface WeaponDef {
  name: string;
  type: number; // 상성에 쓰는 병종
  ranged: boolean;
  reach: number; // 근접: 휘두르는 거리
  arc: number; // 근접: 부채꼴 반각(라디안)
  damage: number;
  cooldown: number;
}
const rad = (d: number) => (d * Math.PI) / 180;
export const WEAPONS: readonly WeaponDef[] = [
  { name: "활", type: ARCHER, ranged: true, reach: BULLET_RANGE, arc: 0, damage: BULLET_DAMAGE, cooldown: FIRE_COOLDOWN_SEC },
  { name: "창", type: SPEAR, ranged: false, reach: 74, arc: rad(20), damage: 17, cooldown: 0.5 },
  { name: "검", type: SHIELD, ranged: false, reach: 46, arc: rad(75), damage: 11, cooldown: 0.3 },
  { name: "철퇴", type: BLUNT, ranged: false, reach: 52, arc: rad(100), damage: 26, cooldown: 0.85 },
];
export const WEAPON_SWITCH_DELAY_SEC = 0.25; // 무기를 바꾼 직후 공격할 수 없는 시간
export const SWING_VISUAL_SEC = 0.18; // 근접 공격 이펙트가 보이는 시간

// 적 생성
export const ENEMY_SPAWN_DISTANCE = 650; // 플레이어로부터 이 거리(화면 밖)에서 생성
export const ENEMY_MAX = 400;
export const ENEMY_SPAWN_BASE_PER_SEC = 0.9; // 플레이어 1명당
export const ENEMY_SPAWN_GROWTH_PER_SEC = 0.012; // 시간이 지날수록 초당 늘어나는 양

export interface PlayerState {
  id: number;
  name: string;
  x: number;
  y: number;
  hp: number;
  aim: number; // 조준 방향(라디안)
  kills: number;
  gold: number;
  maxHp: number;
  weapon: number; // WEAPONS 인덱스
  swing: number; // 근접 공격 이펙트가 남은 시간(초), 0이면 없음
  level: number;
  xp: number; // 현재 레벨에서 모은 경험치
  xpNeed: number; // 다음 레벨까지 필요한 경험치
  pending: number; // 아직 고르지 않은 레벨업 선택 횟수
  offer: number[]; // 지금 고를 수 있는 카드(CARDS 인덱스). 없으면 빈 배열
  priceMult: number; // 고용 가격 배율(할인 카드)
  leadership: number; // 통솔력(보유할 수 있는 용병 비용 합의 최대치)
  chargeLeft: number; // 기병 돌격 지시가 남은 시간(초), 지시 중이 아니면 0
  chargeX: number;
  chargeY: number;
  respawn: number; // 사망 시 부활까지 남은 초, 생존 중이면 0
}

/**
 * 네트워크 용량을 줄이기 위해 적·용병·투사체·캠프는 배열로 보낸다.
 * atk: 공격 예비 동작 진행도(0=공격 중 아님, 0..1=진행), ang: 그 공격의 방향(라디안)
 */
export type EnemyWire = [id: number, x: number, y: number, hp: number, type: number, atk: number, ang: number];
export type MercWire = [
  id: number,
  x: number,
  y: number,
  hp: number,
  type: number,
  ownerId: number,
  atk: number,
  ang: number,
  respawn: number, // 쓰러졌다면 부활까지 남은 초(0이면 생존)
  maxHp: number,
];
export type BulletWire = [id: number, x: number, y: number, team: 0 | 1]; // team 1 = 적 투사체
export type CampWire = [id: number, x: number, y: number, left: number, offer0: number, offer1: number, offer2: number];

export interface PlayerInput {
  dx: number; // -1..1
  dy: number; // -1..1
  aim: number; // 라디안
  fire: boolean;
}

export type ClientMsg =
  | { t: "join"; name: string }
  | { t: "input"; dx: number; dy: number; aim: number; fire: boolean }
  | { t: "buy"; camp: number; slot: number }
  | { t: "weapon"; index: number } // 무기 변경(WEAPONS 인덱스)
  | { t: "pick"; index: number } // 레벨업 카드 선택(0..2)
  | { t: "dismiss"; type: number } // 캠프 근처에서 해당 병종 용병 1명을 해고
  | { t: "charge"; x: number; y: number }; // 기병 돌격 지시(월드 좌표)

export type ServerMsg =
  | { t: "welcome"; id: number; tick: number }
  | { t: "full" }
  | { t: "notice"; text: string }
  | {
      t: "state";
      tick: number;
      time: number; // 게임 경과 시간(초)
      players: PlayerState[];
      mercs: MercWire[];
      enemies: EnemyWire[];
      bullets: BulletWire[];
      camps: CampWire[];
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
