import { ARCHER, BLUNT, CAVALRY, MAGE, MERC_BASE_PRICE, SHIELD, SPEAR, TUNE, UNIT_COST } from "./rules.js";

/** 용병 단계(0~4). 한 명씩 금화를 내고 다음 단계로 강화한다. */
export const MAX_TIER = 4;
export const TIER_NAMES: readonly (readonly string[])[] = [
  ["경기병", "기마병", "중기병", "돌격 기사", "근위 기사"],
  ["창병", "장창병", "중갑 장창병", "정예 장창병", "창술 대가"],
  ["궁병", "장궁병", "정예 궁병", "신궁", "명사수"],
  ["검방병", "중갑 검방병", "근위 검방병", "철벽 방패병", "성채 수호자"],
  ["둔기병", "중갑 둔기병", "철퇴 전사", "파쇄병", "분쇄자"],
  ["마법사", "견습 마도사", "마도사", "대마도사", "현자"],
];
export const TIER_HP = [1, 1.4, 1.9, 2.5, 3.3] as const;
export const TIER_DMG = [1, 1.25, 1.55, 1.9, 2.5] as const;
/** 병종별 단계 보너스(단계마다): 기병 이동 속도·돌격 피해, 창병 카운터 피해, 궁병 사거리, 검방병 방패, 둔기병 범위, 마법사 시전 시간·범위 */
export const TIER_SPEED = [0.05, 0, 0, 0, 0, 0] as const;
export const TIER_REACH = [0, 0, 0.1, 0, 0, 0] as const;
/** 창병: 카운터 피해 배율(단계마다), 기병: 돌격 피해 배율(단계마다), 마법사: 시전 시간 감소(단계마다) */
export const TIER_COUNTER = [0, 0.1, 0, 0, 0, 0] as const;
export const TIER_CHARGE = [0.1, 0, 0, 0, 0, 0] as const;
export const TIER_CAST = [0, 0, 0, 0, 0, 0.02] as const;
export const TIER_SHIELD = [0, 0, 0, 0.15, 0, 0] as const;
export const TIER_AREA = [0, 0, 0, 0, 0.08, 0.125] as const;
/** 강화 비용 = 고용 기본 가격 x 이 배율(현재 단계 → 다음 단계) */
export const UPGRADE_COST_MULT = [1.2, 2.2, 3.6, 5.5] as const;

/** 용병 경험치: 다음 단계로 강화하려면 이만큼 모아야 한다(현재 단계 기준). 피해를 주고받으면 조금씩, 막타를 치면 많이 오른다. */
export const MERC_XP_NEED = [200, 450, 900, 1600] as const;
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

// 군세: 살아 있는 용병 수에 비례해 공격력이 오른다(물량의 강점). 짧은 시간에 여럿이 쓰러지면 사기가 꺾여 모두 공포에 질려 잠깐 도망친다(물량의 약점).
export const SWARM_PER_MERC = 0.025;
export const SWARM_MAX = 0.4;
export const SHAKEN_DEATHS = 3; // 이 시간 안에 최소 이만큼(그리고 용병 수의 SHAKEN_FRAC) 쓰러지면
export const SHAKEN_FRAC = 0.3;
export const SHAKEN_MIN_ARMY = 6; // 이보다 작은 부대는 사기 저하가 걸리지 않는다(이미 약한데 더 얹지 않는다)
export const SHAKEN_GRACE_SEC = 10; // 사기 저하가 풀린 뒤 이 시간 동안은 다시 걸리지 않는다
export const SHAKEN_WINDOW_SEC = 6;
// 사기 저하의 지속 시간과 도망 속도는 TUNE.SHAKEN_SEC / TUNE.SHAKEN_FLEE_SPEED (수치 조정 도구)

export const tierName = (type: number, tier: number): string => TIER_NAMES[type]?.[tier] ?? "";

/** 다음 단계로 강화하는 비용. 최고 단계면 null. */
export function upgradeCost(type: number, tier: number): number | null {
  const mult = UPGRADE_COST_MULT[tier];
  if (mult === undefined) return null;
  return Math.round((MERC_BASE_PRICE[type] ?? 0) * mult);
}

/** 둔기병이 때린 적의 경직 시간(초). 단계마다 늘어난다. */
export const bluntStagger = (tier: number): number => TUNE.BLUNT_STAGGER_SEC + TUNE.BLUNT_STAGGER_PER_TIER * tier;

/** tier → tier+1 로 강화할 때 늘어나는 것들을 짧은 문구로(최고 단계면 빈 목록). 보이는 숫자는 기본 능력치 기준이다. */
export function nextTierBonus(type: number, tier: number): string[] {
  if (tier >= MAX_TIER) return [];
  const pct = (v: number) => `+${Math.round(v)}%`;
  const out = [`체력 ${pct((TIER_HP[tier + 1]! / TIER_HP[tier]! - 1) * 100)}`, `공격 ${pct((TIER_DMG[tier + 1]! / TIER_DMG[tier]! - 1) * 100)}`];
  // 병종 보너스는 단계마다 기본 능력치의 일정 비율이 더해진다
  const step = (x: readonly number[]) => (x[type] ?? 0) > 0 ? pct(((1 + x[type]! * (tier + 1)) / (1 + x[type]! * tier) - 1) * 100) : "";
  if (type === CAVALRY) {
    out.push(`이동 속도 ${step(TIER_SPEED)}`);
    out.push(`돌격 피해 ${step(TIER_CHARGE)}`);
  }
  if (type === SPEAR) out.push(`카운터 피해 ${step(TIER_COUNTER)}`);
  if (type === ARCHER) out.push(`사거리 ${step(TIER_REACH)}`);
  if (type === SHIELD) out.push(`방패 ${step(TIER_SHIELD)}`);
  if (type === MAGE) {
    out.push(`시전 속도 +${Math.round(TIER_CAST[type]! * 100)}%p`);
    out.push(`폭발 범위 ${step(TIER_AREA)}`);
  }
  if (type === BLUNT) {
    out.push(`범위 ${step(TIER_AREA)}`);
    out.push(`경직 ${bluntStagger(tier).toFixed(2)}→${bluntStagger(tier + 1).toFixed(2)}초`);
  }
  return out;
}
