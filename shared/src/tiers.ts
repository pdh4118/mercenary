import { MERC_BASE_PRICE, UNIT_COST } from "./rules.js";

/** 용병 단계(0~4). 한 명씩 금화를 내고 다음 단계로 강화한다. */
export const MAX_TIER = 4;
export const TIER_NAMES: readonly (readonly string[])[] = [
  ["경기병", "기마병", "중기병", "돌격 기사", "근위 기사"],
  ["창병", "장창병", "중갑 장창병", "정예 장창병", "창술 대가"],
  ["궁병", "장궁병", "정예 궁병", "신궁", "명사수"],
  ["검방병", "중갑 검방병", "근위 검방병", "철벽 방패병", "성채 수호자"],
  ["둔기병", "중갑 둔기병", "철퇴 전사", "파쇄병", "분쇄자"],
];
export const TIER_HP = [1, 1.3, 1.65, 2.05, 2.5] as const;
export const TIER_DMG = [1, 1.2, 1.45, 1.75, 2.1] as const;
/** 병종별 단계 보너스(단계마다): 기병 이동 속도, 창병·궁병 사거리, 검방병 방패, 둔기병 범위 */
export const TIER_SPEED = [0.05, 0, 0, 0, 0] as const;
export const TIER_REACH = [0, 0.08, 0.07, 0, 0] as const;
export const TIER_SHIELD = [0, 0, 0, 0.15, 0] as const;
export const TIER_AREA = [0, 0, 0, 0, 0.08] as const;
/** 강화 비용 = 고용 기본 가격 x 이 배율(현재 단계 → 다음 단계) */
export const UPGRADE_COST_MULT = [1.2, 2.2, 3.6, 5.5] as const;

/** 용병 경험치: 다음 단계로 강화하려면 이만큼 모아야 한다(현재 단계 기준). 피해를 주고받으면 조금씩, 막타를 치면 많이 오른다. */
export const MERC_XP_NEED = [40, 80, 140, 220] as const;
export const MERC_XP_PER_DAMAGE = 0.08; // 준 피해 1당
export const MERC_XP_PER_HURT = 0.12; // 받은 피해 1당
export const MERC_XP_KILL = 14; // 막타(보스는 x4). 적 병종과 무관한 기본값
export const MERC_XP_OVERFLOW = 1.5; // 필요량의 이 배수까지는 쌓아 둔다
export const mercXpNeed = (tier: number): number => MERC_XP_NEED[tier] ?? Infinity;

/** 통솔력: 병종 기본 비용에 단계마다 +1. 정예는 자리를 많이 차지하므로 숫자로 밀어붙이는 쪽이 통솔력당 더 강하다. */
export const unitCost = (type: number, tier: number): number => (UNIT_COST[type] ?? 1) + tier;

/** 캠프에서 단계가 높은 용병을 바로 사는 값 배율(0단계는 1). 하나씩 강화하는 비용의 합에 20%를 더한 값이다. */
export const TIER_BUY_MULT = [1, 2.64, 5.28, 9.6, 16.2] as const;
/** 캠프에 이 시간(초)이 지날 때마다 나올 수 있는 최고 단계가 1씩 오른다 */
export const CAMP_TIER_SEC = 240;
export const campMaxTier = (time: number): number => Math.min(MAX_TIER, Math.floor(time / CAMP_TIER_SEC));
/** 캠프 선택지는 병종 + 10 x 단계 한 숫자로 보낸다 */
export const encodeOffer = (type: number, tier: number): number => type + 10 * tier;
export const decodeOffer = (code: number): { type: number; tier: number } => ({ type: code % 10, tier: Math.floor(code / 10) });
/** 높은 단계 용병은 부활이 오래 걸린다 */
export const TIER_RESPAWN_EXTRA = 0.15;

// 군세: 살아 있는 용병 수에 비례해 공격력이 오른다(물량의 강점). 짧은 시간에 여럿이 쓰러지면 사기가 꺾여 약해진다(물량의 약점).
export const SWARM_PER_MERC = 0.025;
export const SWARM_MAX = 0.4;
export const SHAKEN_DEATHS = 3; // 이 시간 안에 최소 이만큼(그리고 용병 수의 SHAKEN_FRAC) 쓰러지면
export const SHAKEN_FRAC = 0.3;
export const SHAKEN_MIN_ARMY = 6; // 이보다 작은 부대는 사기 저하가 걸리지 않는다(이미 약한데 더 얹지 않는다)
export const SHAKEN_GRACE_SEC = 10; // 사기 저하가 풀린 뒤 이 시간 동안은 다시 걸리지 않는다
export const SHAKEN_WINDOW_SEC = 6;
export const SHAKEN_SEC = 8; // 사기 저하가 이어지는 시간
export const SHAKEN_DMG = 0.8; // 그동안 용병 공격력 배율

export const tierName = (type: number, tier: number): string => TIER_NAMES[type]?.[tier] ?? "";

/** 다음 단계로 강화하는 비용. 최고 단계면 null. */
export function upgradeCost(type: number, tier: number): number | null {
  const mult = UPGRADE_COST_MULT[tier];
  if (mult === undefined) return null;
  return Math.round((MERC_BASE_PRICE[type] ?? 0) * mult);
}
