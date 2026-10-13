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
 * 병종 상성은 배율표가 아니라 구체적인 규칙으로 표현한다.
 *
 * - 검방병: 방패 체력이 따로 있고, 정면에서 오는 공격만 방패가 흡수한다. 옆·뒤에서 맞으면 방패를 무시하고 몸을 맞는다.
 *   방패가 깨지면 일정 시간 뒤 재생된다. 깨진 동안에는 정면 흡수가 사라질 뿐 별도의 취약 배율은 없고,
 *   검방병의 짧은 사거리와 낮은 공격력이 약점으로 드러난다.
 * - 둔기병: 방패에 큰 피해를 줘서 빠르게 깬다(방패 특화).
 * - 기병: 이동하면 속도가 점점 붙고, 공격 피해에 현재 속도에 비례한 돌격 피해가 더해진다.
 * - 창병: 돌격 피해를 받지 않고 그대로 기병에게 되돌려준다.
 * - 궁병: 사거리가 길지만 방패 정면에는 거의 막힌다.
 */
const rad = (d: number) => (d * Math.PI) / 180;

// 방패 (검방병)
export const SHIELD_FRONT_ARC = rad(70); // 정면 반각. 이 안에서 오는 공격만 방패가 막는다
/**
 * 방패 체력이 깎이는 배율(공격자 병종별): [기병, 창병, 궁병, 검방병, 둔기병].
 * 화살은 거의 막혀 방패가 오래 버티고, 철퇴는 방패를 쉽게 부순다. 기병의 돌격도 정면에서는 일부 흡수된다.
 */
export const SHIELD_DAMAGE_FACTOR = [0.5, 0.6, 0.25, 1.0, 2.5] as const;
export const SHIELD_REGEN_SEC = 8; // 방패가 깨진 뒤 재생될 때까지
export const HERO_SWORD_FRONT_BLOCK = 0.5; // 주인공이 검을 들면 정면 피해가 이 배율로 줄어든다
export function shieldFactor(srcType: number): number {
  return SHIELD_DAMAGE_FACTOR[srcType] ?? 1;
}

// 기병 돌격
export const CAV_SPEED_MIN_FRAC = 0.4; // 출발 속도(최대 속도 대비)
export const CAV_RAMP_SEC = 2; // 최대 속도까지 걸리는 시간
export const CAV_DECAY_SEC = 0.5; // 멈췄을 때 속도가 사라지는 시간
export const CAV_DAMAGE_PER_SPEED = 0.07; // 현재 속도(px/s) 1당 돌격 추가 피해
export const CAV_MOMENTUM_AFTER_HIT = 0.3; // 공격하면 속도가 이 비율로 줄어든다
export const CAV_EVADE_SPEED_FRAC = 0.6; // 공격 직후 물러날 때의 속도(최대 속도 대비)
/** 기병의 현재 속도. momentum 0..1 */
export function cavSpeed(maxSpeed: number, momentum: number): number {
  return maxSpeed * (CAV_SPEED_MIN_FRAC + (1 - CAV_SPEED_MIN_FRAC) * Math.max(0, Math.min(1, momentum)));
}
/** 현재 속도에 비례한 돌격 추가 피해 */
export function chargeBonus(maxSpeed: number, momentum: number): number {
  return CAV_DAMAGE_PER_SPEED * cavSpeed(maxSpeed, momentum);
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
  shield: number; // 방패 체력(검방병만). 0이면 방패가 없다
  splash: number; // 범위 공격 반경(둔기병). 맞힌 대상 주변의 다른 적에게 SPLASH_FACTOR만큼 피해. 0이면 없음
}
export const SPLASH_FACTOR = 0.5;

const deg = rad;

export const MERC_STATS: readonly UnitStats[] = [
  // 기병: speed는 최대 속도. 평소엔 느리게 출발해 점점 빨라진다. 피해는 기본 + 속도에 비례한 돌격 피해.
  { hp: 110, speed: 230, reach: 30, damage: 8, windup: 0.25, cooldown: 0.9, arc: deg(60), ranged: false, radius: 14, leash: 450, shield: 0, splash: 0 },
  // 창병: 사거리가 가장 길다
  { hp: 100, speed: 95, reach: 64, damage: 10, windup: 0.3, cooldown: 0.8, arc: deg(25), ranged: false, radius: 13, leash: 150, shield: 0, splash: 0 },
  { hp: 65, speed: 95, reach: 280, damage: 8, windup: 0.25, cooldown: 1.0, arc: 0, ranged: true, radius: 12, leash: 0, shield: 0, splash: 0 },
  // 검방병: 몸 체력과 별개로 방패 체력이 있다
  { hp: 120, speed: 90, reach: 32, damage: 8, windup: 0.3, cooldown: 0.8, arc: deg(70), ranged: false, radius: 15, leash: 120, shield: 80, splash: 0 },
  // 둔기병: 범위 공격(splash)과 방패 특화(SHIELD_DAMAGE_FACTOR)
  { hp: 140, speed: 75, reach: 40, damage: 18, windup: 0.5, cooldown: 1.4, arc: deg(100), ranged: false, radius: 15, leash: 110, shield: 0, splash: 46 },
];

export const ENEMY_STATS: readonly UnitStats[] = [
  { hp: 24, speed: 190, reach: 28, damage: 4, windup: 0.35, cooldown: 1.2, arc: deg(55), ranged: false, radius: 12, leash: 0, shield: 0, splash: 0 },
  { hp: 28, speed: 85, reach: 58, damage: 5, windup: 0.45, cooldown: 1.3, arc: deg(22), ranged: false, radius: 12, leash: 0, shield: 0, splash: 0 },
  { hp: 18, speed: 75, reach: 260, damage: 4.5, windup: 0.5, cooldown: 2.0, arc: 0, ranged: true, radius: 11, leash: 0, shield: 0, splash: 0 },
  { hp: 30, speed: 70, reach: 30, damage: 4.5, windup: 0.5, cooldown: 1.4, arc: deg(65), ranged: false, radius: 14, leash: 0, shield: 50, splash: 0 },
  { hp: 36, speed: 60, reach: 38, damage: 7.5, windup: 0.7, cooldown: 1.8, arc: deg(90), ranged: false, radius: 14, leash: 0, shield: 0, splash: 40 },
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

// 경험치와 레벨: 처치 경험치의 일부는 처치한 사람에게, 나머지는 모든 플레이어에게 똑같이 나뉜다(뒤처져도 따라갈 수 있게).
export const ENEMY_XP = [3, 2.5, 2.5, 3, 4] as const; // 병종별 처치 경험치
export const XP_TEAM_SHARE = 0.5; // 팀 공유 비율. 나머지(0.5)는 처치한 사람 몫
export function xpNeeded(level: number): number {
  return 20 + 22 * (level - 1);
}

// 레벨업 순간의 밀어내기: 주변 적을 밀쳐 내고 잠깐 공격하지 못하게 한다(카드를 고를 숨 돌릴 틈)
export const LEVELUP_PUSH_RADIUS = 240;
export const LEVELUP_PUSH_DISTANCE = 170;
export const LEVELUP_STUN_SEC = 0.8;
