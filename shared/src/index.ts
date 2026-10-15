// 서버와 클라이언트가 함께 쓰는 규칙·프로토콜. 전투 규칙은 여기에 두어 양쪽이 어긋나지 않게 한다.

export * from "./rules.js";
export * from "./tuning.js";
export * from "./cards.js";
export * from "./formation.js";
export * from "./tiers.js";
export * from "./names.js";
export * from "./audio.js";
import { ARCHER, BLUNT, CAVALRY, MAGE, SHIELD, SPEAR } from "./rules.js";

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
export const PLAYER_RADIUS = 16;

// 주인공 기본 공격(투사체). 병종이 없으므로 상성 배율은 적용되지 않는다.
export const FIRE_COOLDOWN_SEC = 0.3;
export const BULLET_SPEED = 600;
export const BULLET_RANGE = 520;
export const BULLET_RADIUS = 5;
export const BULLET_DAMAGE = 6; // 주인공 무기 피해는 용병을 키우려고 낮췄다(이전 7)

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
  windup: number; // 공격 전 준비 동작(초). 0이면 즉시. 철퇴는 길다
  splash: number; // 범위 공격 반경(철퇴). 0이면 없음
  note: string; // 무기 바에 보여 줄 특징
}
const rad = (d: number) => (d * Math.PI) / 180;
export const WEAPONS: readonly WeaponDef[] = [
  { name: "활", type: ARCHER, ranged: true, reach: BULLET_RANGE, arc: 0, damage: BULLET_DAMAGE, cooldown: FIRE_COOLDOWN_SEC, windup: 0, splash: 0, note: "원거리 · 방패 정면에는 약함(25%)" },
  { name: "창", type: SPEAR, ranged: false, reach: 112, arc: rad(11), damage: 11, cooldown: 0.55, windup: 0, splash: 0, note: "기병 돌격 무효·반사 · 아주 긴 사거리, 좁은 폭" },
  { name: "검", type: SHIELD, ranged: false, reach: 46, arc: rad(75), damage: 7, cooldown: 0.35, windup: 0, splash: 0, note: "정면 피해 절반 방어 · 빠른 공격" },
  { name: "철퇴", type: BLUNT, ranged: false, reach: 52, arc: rad(100), damage: 34, cooldown: 1.2, windup: 0.5, splash: 46, note: "방패 파괴(250%) · 범위 공격 · 휘두르기 전 준비 동작이 길다" },
  { name: "지팡이", type: MAGE, ranged: false, reach: 300, arc: 0, damage: 120, cooldown: 1.5, windup: 2, splash: 140, note: "마우스 위치에 운석 · 2초 주문(움직일 수 없음) · 매우 넓은 범위 · 방패 무시" },
  { name: "기마", type: CAVALRY, ranged: false, reach: 54, arc: rad(80), damage: 11, cooldown: 0.65, windup: 0.12, splash: 0, note: "달릴수록 빨라지고 속도만큼 돌격 피해 · 공격하면 속도를 잃음 · 창병에게는 반사" },
];
export const WEAPON_SWITCH_DELAY_SEC = 0.25; // 무기를 바꾼 직후 공격할 수 없는 시간
export const SWING_VISUAL_SEC = 0.18; // 근접 공격 이펙트가 보이는 시간

// 적 생성
export const ENEMY_SPAWN_DISTANCE = 650; // 플레이어로부터 이 거리(화면 밖)에서 생성
export const ENEMY_MAX = 400;

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
  wind: number; // 공격 준비 동작이 남은 시간(초), 0이면 없음(철퇴)
  level: number;
  xp: number; // 현재 레벨에서 모은 경험치
  xpNeed: number; // 다음 레벨까지 필요한 경험치
  pending: number; // 아직 고르지 않은 카드 선택 횟수(레벨업 + 보상 상자)
  hs: number[]; // 주인공 능력치(지금 무기 기준): [공격력, 초당 공격 횟수, 사거리, 치명타 확률, 치명타 배율, 관통, 범위 배율, 넉백, 방어력, 회피율, 재생(초당), 이동 속도, 발사 수, 흡혈]
  stance: number; // 용병 진형 모드(STANCE_DEFEND / STANCE_ASSAULT / STANCE_HOLD)
  holdX: number; // 지점 방어 모드에서 지키는 지점(stance가 STANCE_HOLD일 때만 의미가 있다)
  holdY: number;
  box: number; // 그중 보상 상자에서 나온 선택 횟수(상자가 먼저 나온다)
  rerolls: number; // 남은 카드 새로고침 횟수
  legends: string[]; // 고른 전설 능력(LegendId)
  luck: number; // 행운(높은 등급 카드 확률)
  swarm: number; // 군세 보너스(용병 공격력 +swarm)
  shaken: number; // 사기 저하가 남은 시간(초), 0이면 정상
  offer: number[]; // 지금 고를 수 있는 카드(CARDS 인덱스). 없으면 빈 배열
  priceMult: number; // 고용 가격 배율(할인 카드)
  leadership: number; // 통솔력(보유할 수 있는 용병 비용 합의 최대치)
  chargeLeft: number; // 기병 지시(공격·이동)가 남은 시간(초), 지시 중이 아니면 0
  chargeKind: number; // 지시 종류: 0 공격(적 주변을 찍음), 1 이동(땅을 찍음)
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
export const EVT_KNOCK = 12; // 넉백으로 밀려남(소리용)
export const EVT_METEOR = 13; // 운석이 떨어져 폭발함(val = 반경)
// 피해 숫자: val은 피해량, owner는 때린 쪽(적에게 준 피해) 또는 맞은 쪽(받은 피해) 플레이어. 같은 대상에게 한 틱에 들어간 피해는 합쳐서 보낸다.
export const EVT_DMG_ENEMY = 8; // 아군이 적의 몸에 준 피해
export const EVT_DMG_ENEMY_CRIT = 9; // 같은데 치명타
export const EVT_DMG_SHIELD = 10; // 적의 방패가 흡수한 피해
export const EVT_DMG_ALLY = 11; // 아군(주인공·용병)이 입은 피해
export type EventWire = [kind: number, x: number, y: number, ang: number, val: number, owner: number];

export type StagePhase = "grow" | "boss" | "break" | "tournament";
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
  rage: number; // 보스를 오래 못 잡았을 때 오르는 보스군 격노 단계(0이면 아직 아님)
  armyTotal: number;
  squads: number; // 지금 다가오는 소대 수
  tour?: TourInfo | null; // 토너먼트 단계에서만
}

/** 토너먼트 진행 상황(토너먼트 단계일 때만 있다) */
export interface TourMatchInfo {
  a: string; // 선수 이름(자리가 비면 "")
  b: string;
  w: 0 | 1 | 2; // 0=아직, 1=a 승, 2=b 승(부전승 포함)
}
export interface TourInfo {
  title: string; // 라운드 이름(결승, 준결승, 8강...)
  step: "intro" | "fight" | "outro" | "end";
  t: number; // 이 단계가 끝나기까지 남은 초
  a: number; // 지금 경기 선수 번호(없으면 0)
  b: number;
  an: string;
  bn: string;
  ha: number; // 선수의 남은 전력 비율 0..100(주인공+용병 체력 합)
  hb: number;
  winner: string; // 방금 끝난 경기의 승자 이름(결과 표시 단계)
  champion: string; // 우승자(end 단계)
  rounds: { title: string; matches: TourMatchInfo[] }[];
  now: [round: number, match: number]; // 지금 진행 중인 경기 위치
}

export interface ResultPlayer {
  name: string;
  level: number;
  kills: number;
  revives: number; // 동료를 일으켜 세운 횟수
  dealt: number; // 주인공·용병이 적에게 준 피해 합
  taken: number; // 주인공·용병이 입은 피해 합
  downs: number; // 주인공이 쓰러진 횟수
  mercDeaths: number; // 용병이 쓰러진 횟수
  mercs: number; // 끝났을 때 거느린 용병 수
  gold: number; // 번 금화 합(보상 포함)
  wins: number; // 토너먼트 경기 승리 수
  champion: number; // 토너먼트 우승 횟수
}

export type BulletWire = [id: number, x: number, y: number, team: 0 | 1]; // team 1 = 적 투사체
/** 보스 보상 상자: id, x, y, 주인 번호, 남은 초 */
/** 마법사가 주문을 외우는 중인 운석: 시전자 키(용병 번호, 주인공은 -번호), x, y, 진행도(0~100), 반경, 주인 번호(0이면 적), 전체 주문 시간(0.1초 단위) */
export type MeteorWire = [key: number, x: number, y: number, progress: number, radius: number, owner: number, total: number];
export type ChestWire = [id: number, x: number, y: number, owner: number, left: number];
export type CampWire = [id: number, x: number, y: number, left: number, offer0: number, offer1: number, offer2: number];

export interface PlayerInput {
  dx: number; // -1..1
  dy: number; // -1..1
  aim: number; // 라디안
  fire: boolean;
  revive: boolean; // 곁에 쓰러진 동료가 있을 때 누르고 있으면 일으켜 세운다
  dist?: number; // 마우스까지의 거리(px). 마법사 지팡이가 운석을 떨어뜨릴 위치를 정한다
}

/** 난이도: 플레이어(주인공·용병)가 적에게 받는 피해를 줄이는 비율. 인덱스로 고른다. */
export const DIFFICULTY_REDUCTION = [0.75, 0.5, 0.25, 0] as const;
export const DIFFICULTY_NAMES = ["매우 쉬움", "쉬움", "보통", "어려움"] as const;
export const DEFAULT_DIFFICULTY = 3;
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
  | { t: "difficulty"; v: number } // 방장만, 대기실에서. DIFFICULTY_REDUCTION 인덱스
  | { t: "rematch" } // 방장만. 게임이 끝난 뒤 대기실로 돌아가 다시 시작
  // 게임 중
  | { t: "input"; dx: number; dy: number; aim: number; fire: boolean; revive?: boolean; dist?: number }
  | { t: "buy"; camp: number; slot: number }
  | { t: "weapon"; index: number } // 무기 변경(WEAPONS 인덱스)
  | { t: "formation"; zones: number[]; spacing: number } // 진형 변경(병종별 구역 + 간격)
  | { t: "pick"; index: number } // 레벨업 카드 선택(0..2)
  | { t: "reroll" } // 지금 제시된 카드를 새로 뽑는다(새로고침 1회 소모)
  | { t: "upgrade"; merc: number } // 용병 한 명을 다음 단계로 강화
  | { t: "dismiss"; type: number } // 캠프 근처에서 해당 병종 용병 1명을 해고
  | { t: "charge"; x: number; y: number } // 기병 돌격 지시(월드 좌표)
  | { t: "stance"; v: number } // 용병 진형 모드(0 기본, 1 돌격, 2 지점 방어)
  | { t: "hold"; x: number; y: number } // 이 지점을 지키도록 지시(지점 방어 모드로 바꾼다)
  | { t: "record" }; // 지금까지의 기록 요청(중도 종료 전에 확인용)

export type ServerMsg =
  | { t: "rooms"; rooms: RoomInfo[] } // 로비에 있는 동안 방 목록이 바뀔 때마다 온다
  | { t: "tuning"; values: Record<string, number> } // 수치 조정 값(기본값과 다른 것만). 받으면 기본값으로 되돌린 뒤 적용한다
  | { t: "welcome"; id: number; tick: number; code: string; token: string } // token은 재접속에 쓴다
  | { t: "room"; code: string; name: string; hostId: number; phase: RoomPhase; private: boolean; difficulty: number; players: RoomMember[] } // 방 구성이 바뀔 때마다
  | { t: "left"; reason: string } // 방에서 나왔다(스스로, 내보내짐, 방 종료)
  | { t: "error"; text: string }
  | { t: "notice"; text: string }
  | { t: "result"; status: GameStatus; stage: number; time: number; players: ResultPlayer[]; partial?: boolean } // 게임이 끝났다. partial이면 진행 중에 요청한 중간 기록
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
      chests: ChestWire[];
      meteors?: MeteorWire[];
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
  return { dx, dy, aim: num(raw.aim, -Math.PI * 2, Math.PI * 2), fire: raw.fire === true, revive: raw.revive === true, dist: num(raw.dist, 0, 3000) };
}

export function clampToWorld(v: number, radius: number): number {
  const half = WORLD_SIZE / 2 - radius;
  return Math.max(-half, Math.min(half, v));
}
