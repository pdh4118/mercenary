// 병종, 상성, 능력치, 가격. 서버 계산과 클라이언트 표시가 같은 값을 쓰도록 한 곳에 둔다.

export const CAVALRY = 0;
export const SPEAR = 1;
export const ARCHER = 2;
export const SHIELD = 3;
export const BLUNT = 4;
export const UNIT_TYPES = [CAVALRY, SPEAR, ARCHER, SHIELD, BLUNT] as const;
/** 주인공의 기본 공격·피격처럼 병종이 없는 쪽은 상성 계산에서 제외한다 */
export const NO_TYPE = -1;

export const UNIT_NAMES = ["기병", "창병", "궁병", "검방병", "둔기병"] as const;

/**
 * 공격자 병종(행) → 방어자 병종(열)에 곱하는 피해 배율.
 * 상성: 기병 < 창병 < 궁병 < 검방병 < 둔기병 (왼쪽이 오른쪽에게 약하다).
 * 기병은 창병을 제외한 모든 병종에게 강하다.
 */
const WEAK = 0.75;
const STRONG = 1.5;
export const COUNTER_MATRIX: readonly (readonly number[])[] = [
  //            기병    창병    궁병    검방    둔기
  /* 기병  */ [1, 0.6, STRONG, STRONG, STRONG],
  /* 창병  */ [STRONG, 1, WEAK, 1, 1],
  /* 궁병  */ [WEAK, STRONG, 1, WEAK, 1],
  /* 검방  */ [WEAK, 1, STRONG, 1, WEAK],
  /* 둔기  */ [WEAK, 1, 1, STRONG, 1],
];

export function typeMultiplier(attacker: number, defender: number): number {
  return COUNTER_MATRIX[attacker]?.[defender] ?? 1;
}

export interface UnitStats {
  hp: number;
  speed: number; // px/s
  reach: number; // 근접: 공격 거리, 원거리: 사거리
  damage: number;
  windup: number; // 공격 예비 동작(초). 이 동안 피할 수 있고, 끝나는 순간 판정이 일어난다
  cooldown: number;
  arc: number; // 근접 공격 부채꼴 반각(라디안)
  ranged: boolean;
  radius: number;
  leash: number; // 용병: 진형 자리에서 떨어져 적을 쫓을 수 있는 최대 거리
}

const deg = (d: number) => (d * Math.PI) / 180;

export const MERC_STATS: readonly UnitStats[] = [
  { hp: 70, speed: 150, reach: 30, damage: 14, windup: 0.25, cooldown: 0.9, arc: deg(60), ranged: false, radius: 14, leash: 450 },
  { hp: 60, speed: 95, reach: 58, damage: 10, windup: 0.3, cooldown: 0.8, arc: deg(25), ranged: false, radius: 13, leash: 150 },
  { hp: 40, speed: 95, reach: 280, damage: 8, windup: 0.25, cooldown: 1.0, arc: 0, ranged: true, radius: 12, leash: 0 },
  { hp: 120, speed: 90, reach: 32, damage: 8, windup: 0.3, cooldown: 0.8, arc: deg(70), ranged: false, radius: 15, leash: 120 },
  { hp: 90, speed: 75, reach: 40, damage: 18, windup: 0.5, cooldown: 1.4, arc: deg(90), ranged: false, radius: 15, leash: 110 },
];

export const ENEMY_STATS: readonly UnitStats[] = [
  { hp: 24, speed: 125, reach: 28, damage: 10, windup: 0.35, cooldown: 1.2, arc: deg(55), ranged: false, radius: 12, leash: 0 },
  { hp: 28, speed: 85, reach: 52, damage: 9, windup: 0.45, cooldown: 1.3, arc: deg(22), ranged: false, radius: 12, leash: 0 },
  { hp: 18, speed: 75, reach: 260, damage: 7, windup: 0.5, cooldown: 2.0, arc: 0, ranged: true, radius: 11, leash: 0 },
  { hp: 45, speed: 70, reach: 30, damage: 8, windup: 0.5, cooldown: 1.4, arc: deg(65), ranged: false, radius: 14, leash: 0 },
  { hp: 36, speed: 60, reach: 38, damage: 14, windup: 0.7, cooldown: 1.8, arc: deg(85), ranged: false, radius: 14, leash: 0 },
];

/** 적 생성 비율(기병, 창병, 궁병, 검방병, 둔기병) */
export const ENEMY_SPAWN_WEIGHTS = [15, 25, 20, 25, 15] as const;
export const ENEMY_GOLD = [5, 4, 4, 5, 7] as const;

// 투사체 속도(px/s)
export const MERC_ARROW_SPEED = 420;
export const ENEMY_ARROW_SPEED = 260;

// 용병 고용
export const MERC_BASE_PRICE = [70, 40, 45, 50, 60] as const;
export const MERC_PRICE_GROWTH = 0.3; // 이미 가진 용병 1명당 가격 +30%
/** 통솔력 비용: 보유 용병의 비용 합이 통솔력(최대 병력 규모)을 넘을 수 없다. 기병만 2. */
export const UNIT_COST = [2, 1, 1, 1, 1] as const;
export const START_LEADERSHIP = 5;
/** 통솔력과 별개로 개체 수를 묶어 두는 안전 한도 */
export const MAX_MERCS_PER_PLAYER = 16;
/** 쓰러진 뒤 부활까지(초). 기병은 유지 부담으로 더 오래 걸린다. */
export const MERC_RESPAWN_SEC = [25, 15, 15, 15, 15] as const;
export const DISMISS_REFUND = 0.5; // 해고하면 지불한 금화의 이 비율을 돌려받는다
export const START_GOLD = 100;

export function mercPrice(type: number, owned: number): number {
  const base = MERC_BASE_PRICE[type] ?? 0;
  return Math.round(base * (1 + MERC_PRICE_GROWTH * owned));
}

// 기병 운용
export const CAV_EVADE_SEC = 0.5; // 공격한 뒤 이 시간 동안 물러난다(치고 빠지기)
export const CAV_FLANK_MAX_SEC = 3; // 우회 접근에 쓰는 최대 시간. 넘으면 곧장 돌격한다
export const CAV_SELF_DEFENSE = 70; // 창병 적이 이 거리 안으로 오면 어쩔 수 없이 맞서 싸운다
export const CAV_RETREAT_HP = 0.4; // 체력이 이 비율 아래면 모험을 멈추고 복귀한다
export const SPEAR_AVOID_RADIUS = 150; // 기병이 창병 적을 피해 도는 거리
// 우클릭 돌격 지시
export const CHARGE_DURATION_SEC = 6;
export const CHARGE_MAX_DISTANCE = 900; // 주인공으로부터 이 거리까지만 지정할 수 있다
export const CHARGE_TARGET_RADIUS = 300; // 돌격 지점 주변에서 대상을 찾는 반경

// 캠프(용병을 고용할 수 있는 곳)
export const CAMP_OFFERS = 3;
export const CAMP_LIFETIME_SEC = 60;
export const CAMP_FIRST_SPAWN_SEC = 5;
export const CAMP_SPAWN_INTERVAL_SEC = 18;
export const CAMP_USE_RADIUS = 120;
export const CAMP_MAX = 4;

// 진형: 주인공이 바라보는 방향 기준의 줄. 0=앞, 1=중간, 2=뒤, -1=양옆 날개(기병)
export const FORMATION_ROW_OF_TYPE = [-1, 1, 2, 0, 0] as const;
export const FORMATION_ROW_OFFSET = [85, 15, -60] as const;
export const FORMATION_WING_LATERAL = 150; // 기병은 주인공 양옆 이만큼 바깥에서 대기한다
export const FORMATION_WING_FORWARD = 30;
export const FORMATION_LATERAL_SPACING = 34;
export const FORMATION_ROW_WRAP = 5; // 한 줄에 이 수를 넘으면 뒤에 다음 줄을 만든다
export const FORMATION_TURN_RATE = 4; // 진형이 조준 방향을 따라 도는 최대 속도(rad/s)

/** 두 각도의 차이를 -π..π 로 돌려준다 */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
