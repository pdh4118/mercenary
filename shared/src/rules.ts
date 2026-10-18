// 병종, 상성, 능력치, 가격. 서버 계산과 클라이언트 표시가 같은 값을 쓰도록 한 곳에 둔다.

/** 서버 실행 중에도 수치 조정 도구로 바꿀 수 있는 숫자들(shared/src/tuning.ts가 이름·범위·설명을 관리한다) */
export const TUNE = {
  GUARD_MID_FRAC: 0.5, // 검방병·창병이 지키는 궁병과 위협을 잇는 선에서 서는 위치(0=궁병 곁, 1=위협 앞, 0.5=중간)
  ENEMY_SPEED_MULT: 1.15, // 적 이동 속도 배율(빠를수록 포위가 위협적이고 주인공 이동 속도의 가치가 커진다)
  XP_BASE: 12, // 1레벨에서 필요한 경험치
  XP_PER_LEVEL: 9, // 레벨이 오를 때마다 늘어나는 필요 경험치
  START_LEADERSHIP: 5,
  MERC_PRICE_GROWTH: 0.3, // 이미 가진 용병 1명당 가격 +30%
  DISMISS_REFUND: 0.5, // 해고하면 지불한 금화의 이 비율을 돌려받는다
  START_GOLD: 100,
  CAMP_LIFETIME_SEC: 60,
  CAMP_SPAWN_INTERVAL_SEC: 18,
  XP_TEAM_SHARE: 0.5, // 팀 공유 비율. 나머지(0.5)는 처치한 사람 몫
  STAGE_GROW_SEC: 120, // 스테이지당 자유 성장 시간(2분)
  STAGE_BREAK_SEC: 10, // 클리어 뒤 쉬는 시간(회복·부활·보상)
  STAGE_ENEMY_HP_GROWTH: 0.3, // 스테이지가 오를 때마다 적 체력 +30%
  VENOM_CHANCE_PER_STAGE: 0.08, // 스테이지마다 늘어나는 독 궁병 비율(2스테이지부터)
  VENOM_CHANCE_MAX: 0.4, // 독 궁병 비율 상한
  VENOM_POISON: 0.8, // 독 화살의 독 피해(화살 피해 대비, 4초에 걸쳐)
  STAGE_ENEMY_DMG_GROWTH: 0.14, // 적 피해 +14%
  STAGE_SPAWN_GROWTH: 0.18, // 일반 적 생성량 +18%
  ENEMY_TIME_HP_GROWTH: 0.12, // 스테이지 시작 후 60초마다 적 체력 +12%
  ENEMY_TIME_DMG_GROWTH: 0.05, // 60초마다 적 피해 +5%
  ENEMY_LEVEL_HP_GROWTH: 0.035, // 접속자 평균 레벨이 1 오를 때마다 적 체력 +3.5%
  ENEMY_LEVEL_DMG_GROWTH: 0.015, // 적 피해 +1.5%
  STAGE_CLEAR_GOLD: 40, // 클리어 보상 금화 = 이 값 x 스테이지 (모든 플레이어에게)
  STAGE_CLEAR_XP: 30, // 클리어 보상 경험치 = 이 값 + 15 x 스테이지
  BOSS_HP_BASE: 7, // 보스 체력 = 병종 체력 x (기본 + 스테이지 x 증가)
  BOSS_HP_PER_STAGE: 2.5,
  BOSS_DMG_MULT: 1.6,
  BOSS_TIMEOUT_SEC: 60, // 보스군이 등장한 뒤 이 시간 안에 장군을 못 잡으면 보스군이 격노해 점점 강해진다
  BOSS_HARD_TIMEOUT_SEC: 240, // 그래도 못 잡고 이 시간이 지나면 보스군이 물러나고 다음 스테이지로 넘어간다(마지막 스테이지 제외, 0이면 없음)
  BOSS_RAGE_INTERVAL_SEC: 20, // 격노 단계가 올라가는 간격
  BOSS_RAGE_REINFORCE: 0.1, // 단계마다 늘어나는 병력(처음 병력 대비 비율, 최소 3명)
  BOSS_RAGE_POWER: 0.08, // 단계마다 보스군의 체력·방패·공격력이 곱해지는 비율
  BOSS_RAGE_SPEED: 0.02, // 단계마다 늘어나는 이동 속도 비율
  BOSS_RAGE_MAX: 12, // 격노 최대 단계
  REVIVE_SEC: 5, // 한 명이 눌러서 가득 채우는 데 걸리는 시간
  CRIT_BASE_MULT: 1.5, // 치명타 기본 피해 배율
  BACKSTAB_MULT: 1.5,
  SHIELD_REGEN_SEC: 8, // 방패가 깨진 뒤 재생될 때까지
  SPLASH_FACTOR: 0.5,
  CAV_DAMAGE_PER_SPEED: 0.07, // 현재 속도(px/s) 1당 돌격 추가 피해
  CAV_RAMP_SEC: 2, // 최대 속도까지 걸리는 시간
  KNOCK_MAX: 160, // 한 번에 밀려나는 최대 거리
  ARMY_BASE_UNITS: 10,
  ARMY_UNITS_PER_STAGE: 6,
  SQUAD_INTERVAL_BASE: 42, // 소대 간격(초). 스테이지가 오를수록 짧아진다
  SQUAD_BASE_SIZE: 4,
  TOURNAMENT_MATCH_SEC: 60, // 한 경기 제한 시간
  TOURNAMENT_NOTICE_SEC: 15, // 보스를 잡은 뒤 토너먼트가 시작되기까지 알려 주는 시간(이 동안 보상을 받고 준비할 수 있다)
  TOURNAMENT_INTRO_SEC: 5, // 대진 소개(움직일 수 없다)
  TOURNAMENT_WIN_GOLD: 30, // 경기 승리 보상 금화 = 이 값 x 스테이지
  TOURNAMENT_CHAMPION_GOLD: 100, // 우승 보상 금화 = 이 값 x 스테이지
  TOURNAMENT_CHAMPION_XP: 60, // 우승 보상 경험치 = 이 값 x 스테이지
  TOURNAMENT_RUNNERUP_GOLD: 50, // 준우승 보상 금화 = 이 값 x 스테이지
  CHEST_LUCK_BONUS: 1.5, // 상자 카드는 행운이 이만큼 더해진 것처럼 높은 등급이 잘 나온다
  CHEST_LIFETIME_SEC: 300,
  ASSAULT_ADVANCE: 200, // 돌격 진형은 대열의 중심이 주인공보다 이만큼 앞에 선다
  ASSAULT_LEASH_MULT: 2.4, // 돌격 진형에서 용병이 진형 자리를 벗어날 수 있는 거리 배율
  GUARD_DIST: 46, // 검방병이 지키는 아군과 위협 사이에서 서는 거리(아군으로부터)
  SPEAR_COVER_DIST: 70, // 창병이 기병 위협을 막으려고 지키는 아군 앞에 서는 거리
  ARCHER_REACH_FRAC: 0.88, // 궁병이 사거리의 이 비율 근처에서 쏘려 한다
  ARCHER_ROAM: 240, // 궁병이 진형 자리에서 벗어날 수 있는 거리
  ARCHER_KITE_MARGIN: 55,
  DEFEND_LEASH_MULT: 1.8, // 주인공 호위(기본)에서 용병이 진형 자리를 벗어나 적을 쫓을 수 있는 거리 배율(기병 제외)
  HERO_SHIELD_MAX: 240, // 주인공이 검을 들었을 때 방패 체력(정면 공격을 먼저 받아 낸다)
  HERO_SHIELD_REGEN_DELAY: 5, // 맞지 않고 이만큼(초) 지나면 방패가 차오르기 시작한다
  HERO_SHIELD_BROKEN_DELAY: 6, // 방패가 깨졌을 때는 이만큼(초) 뒤부터 차오른다
  HERO_SHIELD_REGEN_PCT: 0.05, // 차오르는 속도(초당 최대치 비율)
  HIGH_GROUND_ARROW_MULT: 1.4, // 고지대에서 낮은 곳을 쏜 화살의 피해 배율
  LOW_GROUND_ARROW_MULT: 0.8, // 낮은 곳에서 고지대를 쏜 화살의 피해 배율
  PLATEAU_TOP_SPEED: 0.85, // 고지대 윗면에서의 이동 속도 배율
  SLOPE_SPEED: 0.4,
  RAMP_SPEED: 0.75, // 계단·다리 같은 올라가는 길 위에서의 이동 속도 배율 // 고지대를 오르는 비탈에서의 이동 속도 배율
  CROSS_SEPARATION_SPEED: 120, // 아군과 적·주인공이 겹쳤을 때 밀려나는 최대 속도(px/초). 달리는 기병은 제외
  CROSS_CHARGE_MOMENTUM: 0.3, // 기병이 이 속도(0..1) 이상이면 돌격 중이라 다른 유닛을 통과한다
  MERC_SPACING: 1.9, // 용병끼리 유지하려는 거리 = 두 용병 반지름 합 x 이 값(뭉치지 않게)
  MERC_SEPARATION_SPEED: 160, // 겹친 용병이 서로 밀려나는 최대 속도(px/초)
  GUARD_HERO_RADIUS: 260, // 주인공 호위에서 주인공 둘레 이 거리 안의 적은 진형 자리에서 멀어도 막으러 나선다
  CATCHUP_MAX: 3.2, // 진형 자리에서 멀어졌을 때 따라붙는 최대 속도 배율(멀수록 빨라진다)
  MOVE_ORDER_SEC: 12, // 기병 이동 지시(땅을 우클릭)가 이어지는 시간
  MOVE_ENGAGE_RADIUS: 150, // 이동 지시 지점에 도착한 기병이 맞서 싸우는 반경
  ORDER_ATTACK_PICK: 150, // 우클릭한 곳 이 거리 안에 적이 있으면 공격 지시, 없으면 이동 지시
  SHAKEN_SEC: 3, // 사기 저하(공포)로 용병이 도망치는 시간(초)
  SHAKEN_FLEE_SPEED: 1.3, // 도망칠 때 이동 속도 배율
  MOUNT_SPEED_MAX: 1.7, // 기마 주인공이 달려서 붙는 최고 속도 배율(걸어갈 때 대비)
  ENEMY_MAGE_FROM_STAGE: 2, // 적 마법사가 나오기 시작하는 스테이지
  MAGE_LOCK_SEC: 1, // 운석이 떨어지기 이 시간 전부터 낙하 지점이 고정된다
  MAGE_FALLOFF: 0.4, // 폭발 가장자리의 피해 감소 비율(중심은 100%)
  CAV_RUNUP_SEC: 2.6, // 기병이 한 대 치고 빠져 다시 속도를 붙이는 최대 시간
  CAV_RUNUP_DIST: 240, // 달리기 위해 대상에서 떨어지는 거리(px)
  CAV_RUNUP_READY: 0.85, // 이 속도(최고 속도 대비)가 붙고 옆·뒤를 잡으면 다시 돌격
  CAV_FINISH_HP: 0.3, // 대상 체력이 이 비율 이하이면 빠지지 않고 끝까지 싸운다
  BLUNT_STAGGER_SEC: 0.3, // 둔기병이 때린 적이 경직되는 시간(0단계)
  BLUNT_STAGGER_PER_TIER: 0.1, // 강화 단계마다 늘어나는 경직 시간
  BLUNT_STAGGER_BOSS_FRAC: 0.3, // 보스는 이 비율만큼만 경직된다
  ARMOR_MAX_FRAC: 0.7, // 피해 감소(고정치)로 한 번의 피해를 줄일 수 있는 최대 비율
  MULTISHOT_DAMAGE: 0.7, // 발사 수 카드로 늘어난 화살의 피해 비율
  MULTISHOT_SPREAD: 0.14, // 화살 사이 각도(라디안)
  SPEAR_HALF_WIDTH_NEAR: 15, // 몸 바로 앞의 반폭(px)
  SPEAR_HALF_WIDTH_FAR: 15, // 사거리 끝의 반폭(px)
  CAV_HALF_WIDTH: 15, // 기병 찌르기(직사각형)의 반폭(px). 창병보다 사거리가 짧고 폭은 조금 넓다
  PLAYER_MAX_HP: 80, // 주인공은 약하게, 용병이 더 많은 역할을 하도록
  PLAYER_SPEED: 220, // px/s
  ENEMY_SPAWN_BASE_PER_SEC: 1.1, // 플레이어 1명당
  ENEMY_SPAWN_GROWTH_PER_SEC: 0.012, // 시간이 지날수록 초당 늘어나는 양
};

export const CAVALRY = 0;
export const SPEAR = 1;
export const ARCHER = 2;
export const SHIELD = 3;
export const BLUNT = 4;
export const MAGE = 5;
export const UNIT_TYPES = [CAVALRY, SPEAR, ARCHER, SHIELD, BLUNT, MAGE] as const;
/** 주인공의 기본 공격·피격처럼 병종이 없는 쪽은 상성 계산에서 제외한다 */
export const NO_TYPE = -1;

export const UNIT_NAMES = ["기병", "창병", "궁병", "검방병", "둔기병", "마법사"] as const;

/**
 * 병종 상성은 배율표가 아니라 구체적인 규칙으로 표현한다.
 *
 * - 검방병: 방패 체력이 따로 있고, 정면에서 오는 공격만 방패가 흡수한다. 옆·뒤에서 맞으면 방패를 무시하고 몸을 맞는다.
 *   방패가 깨지면 일정 시간 뒤 재생된다. 깨진 동안에는 정면 흡수가 사라질 뿐 별도의 취약 배율은 없고,
 *   검방병의 짧은 사거리와 낮은 공격력이 약점으로 드러난다.
 * - 둔기병: 방패에 큰 피해를 줘서 빠르게 깬다(방패 특화).
 * - 기병: 이동하면 속도가 점점 붙고, 공격 피해에 현재 속도에 비례한 돌격 피해가 더해진다.
 * - 창병: 돌격 피해를 받지 않는다. 기병이 돌격 피해를 넣기 전에 창에 맞으면 기병이 속도를 잃고 쌓인 돌격 피해만큼 카운터를 입는다.
 * - 궁병: 사거리가 길지만 방패 정면에는 거의 막힌다.
 */
const rad = (d: number) => (d * Math.PI) / 180;

// 방패 (검방병)
export const SHIELD_FRONT_ARC = rad(70); // 정면 반각. 이 안에서 오는 공격만 방패가 막는다
/**
 * 방패 체력이 깎이는 배율(공격자 병종별): [기병, 창병, 궁병, 검방병, 둔기병].
 * 화살은 거의 막혀 방패가 오래 버티고, 철퇴는 방패를 쉽게 부순다. 기병의 돌격도 정면에서는 일부 흡수된다.
 */
export const SHIELD_DAMAGE_FACTOR = [0.5, 0.6, 0.25, 1.0, 3.0, 1.0] as const;
export function shieldFactor(srcType: number): number {
  return SHIELD_DAMAGE_FACTOR[srcType] ?? 1;
}

// 기병 돌격
export const CAV_SPEED_MIN_FRAC = 0.4; // 출발 속도(최대 속도 대비)
export const CAV_DECAY_SEC = 0.5; // 멈췄을 때 속도가 사라지는 시간
export const CAV_MOMENTUM_AFTER_HIT = 0.3; // 공격하면 속도가 이 비율로 줄어든다
export const CAV_EVADE_SPEED_FRAC = 0.6; // 공격 직후 물러날 때의 속도(최대 속도 대비)
/** 기병의 현재 속도. momentum 0..1 */
export function cavSpeed(maxSpeed: number, momentum: number): number {
  return maxSpeed * (CAV_SPEED_MIN_FRAC + (1 - CAV_SPEED_MIN_FRAC) * Math.max(0, Math.min(1, momentum)));
}
/** 현재 속도에 비례한 돌격 추가 피해 */
export function chargeBonus(maxSpeed: number, momentum: number): number {
  return TUNE.CAV_DAMAGE_PER_SPEED * cavSpeed(maxSpeed, momentum);
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

// 창 찌르기 범위: 부채꼴이 아니라 앞으로 뻗은 직사각형. 몸 앞에서 끝까지 폭이 같다(두 값을 다르게 두면 사다리꼴이 된다).
/** 사거리 reach인 창의 찌르기 범위가 앞에서 f만큼 떨어진 곳에서 갖는 반폭. widthMult는 범위 증가 능력 배율 */
export function spearHalfWidth(f: number, reach: number, widthMult = 1): number {
  const t = Math.max(0, Math.min(1, f / reach));
  return (TUNE.SPEAR_HALF_WIDTH_NEAR + (TUNE.SPEAR_HALF_WIDTH_FAR - TUNE.SPEAR_HALF_WIDTH_NEAR) * t) * widthMult;
}
/** 대상(tx,ty, 반경 r)이 (ox,oy)에서 aim 방향으로 찌르는 창 범위 안에 있는가 */
export function inSpearBox(ox: number, oy: number, aim: number, tx: number, ty: number, r: number, reach: number, widthMult = 1): boolean {
  const dx = tx - ox;
  const dy = ty - oy;
  const f = dx * Math.cos(aim) + dy * Math.sin(aim); // 앞쪽으로 얼마나 떨어졌나
  const l = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim)); // 옆으로 얼마나 비켜났나
  if (f < -r * 0.5 || f > reach + r) return false;
  return l <= spearHalfWidth(f, reach, widthMult) + r;
}

/** 직사각형 찌르기 범위를 쓰는 병종(창병, 기병). 기병은 짧고 약간 넓다. */
export function usesBox(type: number): boolean {
  return type === SPEAR || type === CAVALRY;
}
/** 병종별 범위 안 판정: 직사각형 병종이면 inSpearBox/기병 폭, 아니면 부채꼴이 아니라 호출부에서 처리하므로 false를 돌려주지 않는다(usesBox로 먼저 가를 것) */
export function inBox(type: number, ox: number, oy: number, aim: number, tx: number, ty: number, r: number, reach: number, widthMult = 1): boolean {
  if (type !== CAVALRY) return inSpearBox(ox, oy, aim, tx, ty, r, reach, widthMult);
  const dx = tx - ox;
  const dy = ty - oy;
  const f = dx * Math.cos(aim) + dy * Math.sin(aim);
  const l = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
  if (f < -r * 0.5 || f > reach + r) return false;
  return l <= TUNE.CAV_HALF_WIDTH * widthMult + r;
}
/** 적의 직사각형 찌르기 폭 배율: 적 기병·창병 모두 아군과 같은 폭(기병·창병 전체 폭 30) */
export const ENEMY_BOX_WIDTH_MULT: Readonly<Record<number, number>> = { [CAVALRY]: 1, [SPEAR]: 1 };
/** 범위 증가 능력이 폭에 주는 배율: 기본 부채꼴 각 대비 현재 각의 비 */
export function boxWidthMult(type: number, arc: number): number {
  return arc / MERC_STATS[type === CAVALRY ? CAVALRY : SPEAR]!.arc;
}

const deg = rad;

export const MERC_STATS: readonly UnitStats[] = [
  // 기병: speed는 최대 속도. 평소엔 느리게 출발해 점점 빨라진다. 피해는 기본 + 속도에 비례한 돌격 피해.
  { hp: 200, speed: 300, reach: 53, damage: 15, windup: 0.25, cooldown: 0.9, arc: deg(60), ranged: false, radius: 14, leash: 360, shield: 0, splash: 0 },
  // 창병: 사거리가 가장 길고 폭이 좁다(찌르기)
  { hp: 181, speed: 95, reach: 100, damage: 19, windup: 0.3, cooldown: 0.8, arc: deg(13), ranged: false, radius: 13, leash: 95, shield: 0, splash: 0 },
  { hp: 119, speed: 85, reach: 280, damage: 15, windup: 0.25, cooldown: 0.9, arc: 0, ranged: true, radius: 12, leash: 0, shield: 0, splash: 0 },
  // 검방병: 몸 체력과 별개로 방패 체력이 있다
  { hp: 200, speed: 80, reach: 32, damage: 10, windup: 0.3, cooldown: 0.8, arc: deg(70), ranged: false, radius: 15, leash: 80, shield: 150, splash: 0 },
  // 둔기병: 범위 공격(splash)과 방패 특화(SHIELD_DAMAGE_FACTOR). 한 방이 세지만 휘두르기 전 준비 동작이 길다.
  { hp: 225, speed: 75, reach: 40, damage: 32.4, windup: 0.9, cooldown: 1.5, arc: deg(100), ranged: false, radius: 15, leash: 75, shield: 0, splash: 46 },
  // 마법사: 느리고 약하지만 2초 동안 주문을 외운 뒤 지정한 곳에 운석을 떨어뜨린다. 피해가 크고 범위(splash)가 매우 넓으며 방패도 무시한다.
  { hp: 88, speed: 65, reach: 280, damage: 150.0, windup: 2, cooldown: 1.5, arc: 0, ranged: true, radius: 12, leash: 60, shield: 0, splash: 140 },
];

export const ENEMY_STATS: readonly UnitStats[] = [
  { hp: 24, speed: 230, reach: 51, damage: 4, windup: 0.35, cooldown: 1.2, arc: deg(55), ranged: false, radius: 12, leash: 0, shield: 0, splash: 0 },
  { hp: 28, speed: 85, reach: 90, damage: 5, windup: 0.45, cooldown: 1.3, arc: deg(22), ranged: false, radius: 12, leash: 0, shield: 0, splash: 0 },
  { hp: 18, speed: 75, reach: 260, damage: 4.5, windup: 0.5, cooldown: 2.0, arc: 0, ranged: true, radius: 11, leash: 0, shield: 0, splash: 0 },
  { hp: 30, speed: 70, reach: 30, damage: 4.5, windup: 0.5, cooldown: 1.4, arc: deg(65), ranged: false, radius: 14, leash: 0, shield: 50, splash: 0 },
  { hp: 36, speed: 60, reach: 38, damage: 8.55, windup: 0.9, cooldown: 1.8, arc: deg(90), ranged: false, radius: 14, leash: 0, shield: 0, splash: 40 },
  // 적 마법사: 드물게 나온다. 3.5초 주문 뒤 모여 있는 아군에게 운석을 떨어뜨린다(낙하 지점이 미리 보이니 피할 수 있다). 넉백이나 둔기병의 타격으로 밀려나면 주문이 끊긴다.
  { hp: 22, speed: 55, reach: 260, damage: 55, windup: 3.5, cooldown: 4, arc: 0, ranged: true, radius: 11, leash: 0, shield: 0, splash: 110 },
];

/** 적 생성 비율(기병, 창병, 궁병, 검방병, 둔기병) */
export const ENEMY_SPAWN_WEIGHTS = [15, 25, 20, 25, 15, 3] as const;
export const ENEMY_GOLD = [5, 4, 4, 5, 7, 8] as const;

// 투사체 속도(px/s)
export const MERC_ARROW_SPEED = 420;
export const ENEMY_ARROW_SPEED = 260;

// 용병 고용
export const MERC_BASE_PRICE = [70, 40, 45, 50, 60, 90] as const;
/** 통솔력 비용: 보유 용병의 비용 합이 통솔력(최대 병력 규모)을 넘을 수 없다. 기병만 2. */
export const UNIT_COST = [2, 1, 1, 1, 1, 2] as const;
/** 통솔력과 별개로 개체 수를 묶어 두는 안전 한도 */
/** 쓰러진 뒤 부활까지(초). 기병은 유지 부담으로 더 오래 걸린다. */
export const MERC_RESPAWN_SEC = [40, 30, 30, 30, 30, 40] as const;

export function mercPrice(type: number, owned: number): number {
  const base = MERC_BASE_PRICE[type] ?? 0;
  return Math.round(base * (1 + TUNE.MERC_PRICE_GROWTH * owned));
}

// 기병 운용
export const CAV_EVADE_SEC = 0.5; // 공격한 뒤 이 시간 동안 물러난다(치고 빠지기)
export const CAV_FLANK_MAX_SEC = 3; // 우회 접근에 쓰는 최대 시간. 넘으면 곧장 돌격한다
export const CAV_SELF_DEFENSE = 70; // 창병 적이 이 거리 안으로 오면 어쩔 수 없이 맞서 싸운다
export const CAV_RETREAT_HP = 0.4; // 체력이 이 비율 아래면 모험을 멈추고 복귀한다
export const SPEAR_AVOID_RADIUS = 150; // 기병이 창병 적을 피해 도는 거리
// 우클릭 돌격 지시
export const CHARGE_DURATION_SEC = 6;
export const CHARGE_TARGET_RADIUS = 300; // 돌격 지점 주변에서 대상을 찾는 반경

// 궁병 카이팅: 근접 적이 (적 사거리 + 이 여유) 안으로 들어오면 뒤로 물러나며 쏜다
export const ARCHER_KITE_SPEED_MULT = 1.15;
export const ARCHER_KITE_HOME_PULL = 0.7; // 물러날 때 진형 자리 쪽으로 끌리는 정도(적진 반대편으로 달아나지 않게)

// 진형 모드: 기본 진형은 주인공 주변을 지키며 싸우고, 돌격 진형은 대열이 앞으로 나가 더 멀리 적을 쫓는다
export const STANCE_DEFEND = 0;
export const STANCE_ASSAULT = 1;
export const STANCE_HOLD = 2; // 지정한 지점에 진형을 펴고 지킨다(주인공이 떠나도 그 자리에 남는다)
export const STANCE_NAMES = ["기본(주인공 수비)", "돌격", "지점 방어"] as const;
export const ASSAULT_LEASH_MULT_CAVALRY = 1.6;

// 병종별 역할 AI
/** 검방병이 지키려는 아군의 취약도(병종별: 기병, 창병, 궁병, 검방병, 둔기병). 주인공은 HERO_WARD_WEIGHT */
export const WARD_WEIGHT = [1.2, 1.6, 3, 0.9, 1.4, 3.4] as const;
export const HERO_WARD_WEIGHT = 2.6;
export const GUARD_THREAT_RADIUS = 320; // 지키는 아군 둘레에서 위협으로 보는 거리
export const ARCHER_STRAFE_SEC = 2.5; // 방패 정면을 피해 돌아가려고 시도하는 최대 시간
export const SPEAR_WATCH_RANGE = 520; // 창병이 적 기병을 주시하는 거리
/** 기병이 노릴 가치(적 병종별: 기병, 창병, 궁병, 검방병, 둔기병). 궁병과 둔기병을 먼저, 정면의 방패는 나중에 */
export const CAV_TARGET_WEIGHT = [1, 1, 2.2, 0.5, 1.8, 3.2] as const;
/** 둔기병이 방패 있는 검방병을 노리는 가중치 */
export const BLUNT_SHIELD_PREF = 2.6;

export const ENEMY_SURROUND_RANGE = 360; // 적이 대상에서 이 거리보다 멀수록 크게 돌아(포위) 접근한다

// 캠프(용병을 고용할 수 있는 곳)
export const CAMP_OFFERS = 3;
export const CAMP_FIRST_SPAWN_SEC = 5;
export const CAMP_USE_RADIUS = 120;
export const CAMP_MAX = 4;

// 진형: 주인공이 바라보는 방향 기준의 줄. 0=앞, 1=중간, 2=뒤, -1=양옆 날개(기병)
export const FORMATION_ROW_OF_TYPE = [-1, 1, 2, 0, 0, 2] as const;
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
export const ENEMY_XP = [3, 2.5, 2.5, 3, 4, 5] as const; // 병종별 처치 경험치
export function xpNeeded(level: number): number {
  return TUNE.XP_BASE + TUNE.XP_PER_LEVEL * (level - 1); // 레벨업이 잦도록 낮게 잡았다
}

// 레벨업 순간의 밀어내기: 주변 적을 밀쳐 내고 잠깐 공격하지 못하게 한다(카드를 고를 숨 돌릴 틈)
export const LEVELUP_PUSH_RADIUS = 240;
export const LEVELUP_PUSH_DISTANCE = 170;
export const LEVELUP_STUN_SEC = 0.8;

// --- 스테이지와 보스군 -----------------------------------------------------------
// 스테이지마다 자유 성장 시간(적이 계속 몰려옴) → 보스군 진격 → 보스(장군)를 쓰러뜨리면 클리어. 10스테이지를 모두 깨면 승리.
export const STAGE_COUNT = 10;
// 같은 스테이지 안에서도 시간이 갈수록, 그리고 플레이어 레벨이 오를수록 적이 단단해진다(성장을 따라잡는다).

// 보스군: 진형과 병종 조합을 갖춰 천천히 행군해 온다. 인원 수에 비례해 커진다.
export const ARMY_PLAYER_EXPONENT = 0.8; // 병력 = (기본 + 스테이지 x 증가) x 인원^0.8
export const ARMY_MAX_UNITS = 260;
export const ARMY_SPAWN_DISTANCE = 900;
export const ARMY_MARCH_SPEED = 55; // 진형이 전진하는 속도(px/s)
export const ARMY_ENGAGE_DISTANCE = 220; // 아군과 이 거리 안이면 진형이 멈추고 싸운다
export const ARMY_AGGRO = 240; // 병사가 진형을 벗어나 아군을 쫓기 시작하는 거리
export const ARMY_LEASH = 380; // 진형 자리에서 이만큼 벗어나면 되돌아간다
export const ARMY_RANK_SPACING = 38;
export const ARMY_LATERAL_SPACING = 34;
export const ARMY_RANK_WIDTH = 10; // 한 줄 최대 인원
/** 스테이지별 보스(장군) 병종: 방패, 창, 기병, 둔기, 궁, 방패, 둔기, 기병, 창, 둔기 */
// 소대: 보스가 아닐 때도 가끔 소규모 혼성 부대가 진형을 갖추고 다가온다
export const SQUAD_FIRST_SEC = 30; // 스테이지 시작 뒤 첫 소대까지
export const SQUAD_INTERVAL_STAGE = 3;
export const SQUAD_INTERVAL_MIN = 20;
export const SQUAD_MAX_SIZE = 14;
export const SQUAD_SPAWN_DISTANCE = 700;
export const SQUAD_MARCH_MULT = 1.3; // 보스군보다 빠르게 행군한다
export const SQUAD_CLEAR_GOLD = 4; // 소대를 전멸시키면 병사 1명당 모든 플레이어가 받는 금화
export const BOSS_TYPES = [SHIELD, SPEAR, CAVALRY, BLUNT, ARCHER, SHIELD, BLUNT, CAVALRY, SPEAR, BLUNT] as const;
export const BOSS_SIZE = 1.7; // 반경·그림 크기 배율
export const BOSS_SPEED_MULT = 0.9;

// 보스를 못 잡아도 보스군이 나타난 지 이만큼 지나면 다음 스테이지로 넘어간다(보스군은 사라지고 보상은 없다). 마지막 스테이지는 예외.
// 보스를 쓰러뜨리면 접속한 인원 수만큼 상자가 떨어진다. 상자마다 주인이 있고, 주인이 다가가면 열려 카드 한 장을 고른다(레벨업과 별개).
export const CHEST_OPEN_RADIUS = 60;

// --- 토너먼트 ----------------------------------------------------------------------
// 이 스테이지의 보스를 쓰러뜨리면 남은 적을 모두 없애고, 접속한 플레이어끼리 1대1 토너먼트를 연다(2명 이상일 때).
// 각자 자기 용병을 데리고 싸우고, 주인공이 쓰러지면 진다. 시간이 다 되면 남은 체력 비율이 높은 쪽이 이긴다.
export const TOURNAMENT_STAGES = [3, 6, 9, 10] as const;
export const TOURNAMENT_OUTRO_SEC = 4; // 경기 뒤 결과 표시
export const TOURNAMENT_END_SEC = 7; // 우승자 발표
/**
 * 로비나 대기실(게임이 진행 중이 아닐 때)에서 이 시간(초) 동안 아무 조작이 없으면 연결을 끊는다.
 * 창을 안 끄고 둔 접속 때문에 자동 업데이트(접속자 0명을 기다린다)가 막히지 않게 한다. 게임 진행 중에는 적용하지 않는다.
 */
export const IDLE_KICK_SEC = 300;
export const TOURNAMENT_ARENA_RADIUS = 1950; // 경기장 반지름(px). 월드 중앙. 지름이 예전(1600)의 약 2.4배로, 월드(4000)가 허락하는 최대에 가깝다
export const TOURNAMENT_START_DIST = 1270; // 두 선수가 중앙에서 떨어져 서는 거리
export const isTournamentStage = (stage: number): boolean => (TOURNAMENT_STAGES as readonly number[]).includes(stage);
/** n명이 겨루는 토너먼트의 라운드 이름: 결승, 준결승, 8강... (roundsLeft는 이 라운드를 포함해 남은 라운드 수) */
export const tournamentRoundName = (roundsLeft: number): string => (roundsLeft <= 1 ? "결승" : roundsLeft === 2 ? "준결승" : `${2 ** roundsLeft}강`);

// --- 쓰러짐과 부활 ---------------------------------------------------------------
// 주인공은 체력이 0이 되면 쓰러지고 저절로 일어나지 않는다. 다른 주인공이 곁에서 부활 키를 누르고 있으면 일으켜 세울 수 있다.
// 모든 주인공이 동시에 쓰러져 있으면 게임 오버. 스테이지를 클리어하면 모두 회복·부활한다.
export const REVIVE_RADIUS = 70;
export const REVIVE_DECAY_FACTOR = 0.25; // 멈추면 진행도가 채울 때의 이 배율로 천천히 줄어든다(이어서 할 수 있게)
export const REVIVE_HP_FRAC = 0.5;
export const REVIVE_INVULN_SEC = 2;

// 공격 능력치(레벨업 카드)
export const CRIT_MAX_CHANCE = 0.75; // 치명타 확률 상한
export const DEFENSE_MAX = 0.6; // 방어력(피해 감소) 상한
export const DODGE_MAX = 0.5; // 회피율 상한
// 배후 공격: 방어하는 쪽의 등 뒤에서 오는 공격은 피해가 늘어난다(기병의 우회가 빛난다). 적·아군 모두에게 적용된다.
export const BACKSTAB_ARC = rad(60); // 등 뒤 반각(전체 120도)
export const KNOCK_BOSS_FACTOR = 0.25; // 보스는 넉백이 이만큼만 먹힌다
export const KNOCK_STUN_SEC = 0.4; // 밀려난 적이 공격하지 못하는 시간
export const CAST_TIME_MIN_MULT = 0.3; // 시전 시간 감소 카드를 아무리 모아도 원래 시간의 이 비율 밑으로는 줄지 않는다
/**
 * 근접 공격이 범위 증가를 받았을 때의 부채꼴 반각. 철퇴(둔기)·검은 몸을 두르듯 퍼지는 대신 앞으로 길어지므로(깔때기) 각도는 그대로 둔다.
 * 같은 범위 배율이 철퇴에서는 meleeReach로 사거리에 곱해진다.
 */
/** 범위 증가가 각도 대신 사거리를 늘리는 병종: 철퇴(둔기)와 검방 */
const lengthensOnArea = (type: number): boolean => type === BLUNT || type === SHIELD;
export const meleeArc = (type: number, baseArc: number, area: number): number => (lengthensOnArea(type) ? baseArc : Math.min(AREA_ARC_MAX, baseArc * area));
export const meleeReach = (type: number, reach: number, area: number): number => (lengthensOnArea(type) ? reach * area : reach);
export const AREA_ARC_MAX = 2.4; // 범위 증가로 넓어지는 근접 부채꼴 반각 상한(라디안)
