// 서버와 클라이언트가 함께 쓰는 규칙·프로토콜. 전투 규칙은 여기에 두어 양쪽이 어긋나지 않게 한다.

export * from "./rules.js";
export * from "./cards.js";
export * from "./formation.js";
export * from "./tiers.js";
export * from "./names.js";
import { ARCHER, BLUNT, SHIELD, SPEAR } from "./rules.js";

export const TICK_RATE = 20; // 서버가 초당 계산·전송하는 횟수
export const MAX_PLAYERS = 8;
export const WORLD_SIZE = 4000;
export const NAME_MAX_LENGTH = 12;

// 방
export const ROOM_CODE_LENGTH = 4;
export const ROOM_NAME_MAX_LENGTH = 16;
export const MAX_ROOMS = 30;
export const JOIN_FAIL_LIMIT = 8; // 같은 주소에서 코드를 이만큼 연속으로 틀리면(무작위 대입 방지)
export const JOIN_FAIL_BLOCK_SEC = 60; // 이 시간 동안 참가 시도를 막는다
export const RECONNECT_GRACE_SEC = 30; // 접속이 끊겨도 이 시간 안에 돌아오면 같은 캐릭터로 이어서 한다

// 주인공
export const PLAYER_SPEED = 220; // px/s
export const PLAYER_RADIUS = 16;
export const PLAYER_MAX_HP = 100;

// 주인공 기본 공격(투사체). 병종이 없으므로 상성 배율은 적용되지 않는다.
export const FIRE_COOLDOWN_SEC = 0.25;
export const BULLET_SPEED = 600;
export const BULLET_RANGE = 520;
export const BULLET_RADIUS = 5;
export const BULLET_DAMAGE = 10;

/**
 * 주인공 무기. 무기마다 병종 속성이 있어 병종과 같은 규칙이 적용된다(방패에 주는 피해 배율, 창의 돌격 반사, 철퇴의 범위 공격 등).
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
  splash: number; // 범위 공격 반경(철퇴). 0이면 없음
  note: string; // 무기 바에 보여 줄 특징
}
const rad = (d: number) => (d * Math.PI) / 180;
export const WEAPONS: readonly WeaponDef[] = [
  { name: "활", type: ARCHER, ranged: true, reach: BULLET_RANGE, arc: 0, damage: BULLET_DAMAGE, cooldown: FIRE_COOLDOWN_SEC, splash: 0, note: "원거리 · 방패 정면에는 약함(25%)" },
  { name: "창", type: SPEAR, ranged: false, reach: 74, arc: rad(20), damage: 17, cooldown: 0.5, splash: 0, note: "기병 돌격 무효·반사 · 긴 사거리" },
  { name: "검", type: SHIELD, ranged: false, reach: 46, arc: rad(75), damage: 11, cooldown: 0.3, splash: 0, note: "정면 피해 절반 방어 · 빠른 공격" },
  { name: "철퇴", type: BLUNT, ranged: false, reach: 52, arc: rad(100), damage: 26, cooldown: 0.85, splash: 46, note: "방패 파괴(250%) · 범위 공격" },
];
export const WEAPON_SWITCH_DELAY_SEC = 0.25; // 무기를 바꾼 직후 공격할 수 없는 시간
export const SWING_VISUAL_SEC = 0.18; // 근접 공격 이펙트가 보이는 시간

// 적 생성
export const ENEMY_SPAWN_DISTANCE = 650; // 플레이어로부터 이 거리(화면 밖)에서 생성
export const ENEMY_MAX = 400;
export const ENEMY_SPAWN_BASE_PER_SEC = 1.1; // 플레이어 1명당
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
  rerolls: number; // 남은 카드 새로고침 횟수
  legends: string[]; // 고른 전설 능력(LegendId)
  swarm: number; // 군세 보너스(용병 공격력 +swarm)
  shaken: number; // 사기 저하가 남은 시간(초), 0이면 정상
  offer: number[]; // 지금 고를 수 있는 카드(CARDS 인덱스). 없으면 빈 배열
  priceMult: number; // 고용 가격 배율(할인 카드)
  leadership: number; // 통솔력(보유할 수 있는 용병 비용 합의 최대치)
  chargeLeft: number; // 기병 돌격 지시가 남은 시간(초), 지시 중이 아니면 0
  chargeX: number;
  chargeY: number;
  down: boolean; // 쓰러짐(스스로 일어나지 못하고, 동료가 부활시켜야 한다)
  revive: number; // 부활 진행도 0..1
  invuln: number; // 부활 직후 무적 남은 시간(초)
}

/**
 * 네트워크 용량을 줄이기 위해 적·용병·투사체·캠프는 배열로 보낸다.
 * atk: 공격 예비 동작 진행도(0=공격 중 아님, 0..1=진행), ang: 그 공격의 방향(라디안)
 */
export type EnemyWire = [
  id: number,
  x: number,
  y: number,
  hp: number, // 체력 비율 0..100(스테이지 강화·보스 배율과 무관하게 표시하기 위해)
  type: number,
  atk: number,
  ang: number,
  shield: number, // 방패 체력(검방병). 깨졌으면 0
  face: number, // 바라보는 방향(방패가 막는 방향)
  mom: number, // 기병의 속도 0..1
  regen: number, // 깨진 방패가 재생될 때까지 남은 초(0이면 해당 없음)
  boss: number, // 1이면 보스(장군)
];
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
  shield: number,
  maxShield: number,
  face: number,
  mom: number,
  regen: number,
  tier: number, // 강화 단계 0~4
  nameId: number, // mercName()으로 이름을 얻는다
  xp: number, // 용병 경험치(다음 단계 필요량은 mercXpNeed)
];
/** 서버가 알려 주는 순간 효과(그 틱에 일어난 일): [종류, x, y, 방향] */
export const EVT_ARROW_HIT = 0; // 아군 화살 명중
export const EVT_ENEMY_ARROW_HIT = 1; // 적 화살 명중
export const EVT_SHIELD_BLOCK = 2; // 방패가 막음
export const EVT_SHIELD_BREAK = 3; // 방패가 깨짐
export const EVT_REVIVE = 4; // 부활
export const EVT_CRIT = 5; // 치명타
export const EVT_DODGE = 6; // 회피
export const EVT_BACKSTAB = 7; // 배후 공격
export type EventWire = [kind: number, x: number, y: number, ang: number];

export type StagePhase = "grow" | "boss" | "break";
export type GameStatus = "playing" | "victory" | "defeat";
/** 진행 상황: 스테이지, 단계(성장/보스/휴식), 남은 시간, 보스군 상태 */
export interface GameInfo {
  stage: number;
  phase: StagePhase;
  timer: number; // grow: 보스군 도착까지, break: 다음 스테이지까지 남은 초. boss: 0
  status: GameStatus;
  bossType: number; // 이번 스테이지 보스 병종
  bossHp: number; // 보스 체력 비율 0..100(보스 단계가 아니면 0)
  armyLeft: number; // 남은 보스군 병력(장군 포함)
  armyTotal: number;
  squads: number; // 지금 다가오는 소대 수
}

export interface ResultPlayer {
  name: string;
  level: number;
  kills: number;
  revives: number; // 동료를 일으켜 세운 횟수
}

export type BulletWire = [id: number, x: number, y: number, team: 0 | 1]; // team 1 = 적 투사체
export type CampWire = [id: number, x: number, y: number, left: number, offer0: number, offer1: number, offer2: number];

export interface PlayerInput {
  dx: number; // -1..1
  dy: number; // -1..1
  aim: number; // 라디안
  fire: boolean;
  revive: boolean; // 곁에 쓰러진 동료가 있을 때 누르고 있으면 일으켜 세운다
}

export type RoomPhase = "waiting" | "playing" | "ended";

export interface RoomInfo {
  code: string;
  name: string;
  players: number;
  max: number;
  playing: boolean; // 이미 게임이 시작된 방(대기 중이 아님)
}

export interface RoomMember {
  id: number;
  name: string;
  online: boolean;
  ready: boolean; // 대기실에서 준비를 눌렀는가
}

export type ClientMsg =
  // 로비
  | { t: "list" }
  | { t: "create"; name: string; room?: string; private?: boolean } // 비공개 방은 목록에 안 나오고 코드로만 입장
  | { t: "join"; name: string; code: string }
  | { t: "quick"; name: string }
  | { t: "rejoin"; token: string }
  | { t: "leave" }
  | { t: "kick"; id: number } // 방장만
  | { t: "ready"; ready: boolean } // 대기실에서 준비/준비 취소
  | { t: "start" } // 방장만. 모두 준비되면 게임 시작
  | { t: "rematch" } // 방장만. 게임이 끝난 뒤 대기실로 돌아가 다시 시작
  // 게임 중
  | { t: "input"; dx: number; dy: number; aim: number; fire: boolean; revive?: boolean }
  | { t: "buy"; camp: number; slot: number }
  | { t: "weapon"; index: number } // 무기 변경(WEAPONS 인덱스)
  | { t: "formation"; zones: number[]; spacing: number } // 진형 변경(병종별 구역 + 간격)
  | { t: "pick"; index: number } // 레벨업 카드 선택(0..2)
  | { t: "reroll" } // 지금 제시된 카드를 새로 뽑는다(새로고침 1회 소모)
  | { t: "upgrade"; merc: number } // 용병 한 명을 다음 단계로 강화
  | { t: "dismiss"; type: number } // 캠프 근처에서 해당 병종 용병 1명을 해고
  | { t: "charge"; x: number; y: number }; // 기병 돌격 지시(월드 좌표)

export type ServerMsg =
  | { t: "rooms"; rooms: RoomInfo[] } // 로비에 있는 동안 방 목록이 바뀔 때마다 온다
  | { t: "welcome"; id: number; tick: number; code: string; token: string } // token은 재접속에 쓴다
  | { t: "room"; code: string; name: string; hostId: number; phase: RoomPhase; private: boolean; players: RoomMember[] } // 방 구성이 바뀔 때마다
  | { t: "left"; reason: string } // 방에서 나왔다(스스로, 내보내짐, 방 종료)
  | { t: "error"; text: string }
  | { t: "notice"; text: string }
  | { t: "result"; status: GameStatus; stage: number; time: number; players: ResultPlayer[] } // 게임이 끝났다
  | {
      t: "state";
      tick: number;
      time: number; // 게임 경과 시간(초)
      players: PlayerState[];
      mercs: MercWire[];
      enemies: EnemyWire[];
      bullets: BulletWire[];
      g: GameInfo;
      ev: EventWire[];
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
  return { dx, dy, aim: num(raw.aim, -Math.PI * 2, Math.PI * 2), fire: raw.fire === true, revive: raw.revive === true };
}

export function clampToWorld(v: number, radius: number): number {
  const half = WORLD_SIZE / 2 - radius;
  return Math.max(-half, Math.min(half, v));
}
