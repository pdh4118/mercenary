// 레벨업 선택지. 효과 종류는 서버가 적용하고, 이름·설명은 클라이언트가 그대로 표시한다.

import { ARCHER, UNIT_NAMES, UNIT_TYPES } from "./rules.js";

/** 0=규모(수 늘리기), 1=용병 강화, 2=주인공 강화 */
export const CARD_CATEGORY_NAMES = ["규모", "용병 강화", "주인공 강화"] as const;

export type CardEffect =
  | { k: "leadership"; v: number } // 통솔력 +v
  | { k: "priceMult"; v: number } // 고용 가격에 v를 곱한다
  | { k: "goldMult"; v: number } // 금화 획득 +v(비율)
  | { k: "mercHp"; v: number } // 모든 용병 체력 +v(비율)
  | { k: "mercDmg"; v: number }
  | { k: "mercAtkSpeed"; v: number }
  | { k: "mercSpeed"; v: number }
  | { k: "mercRespawn"; v: number } // 부활 시간에 v를 곱한다
  | { k: "typeBoost"; type: number; hp: number; dmg: number } // 특정 병종만 강화
  | { k: "mercRange"; v: number } // 용병 사거리 +v(비율)
  | { k: "mercPierce"; v: number } // 용병 화살이 더 뚫는 적 수
  | { k: "mercCrit"; v: number } // 치명타 확률 +v
  | { k: "mercCritMult"; v: number } // 치명타 피해 배율 +v
  | { k: "mercArea"; v: number } // 범위(근접 부채꼴·범위 공격 반경) +v(비율)
  | { k: "heroRange"; v: number }
  | { k: "heroPierce"; v: number }
  | { k: "heroCrit"; v: number }
  | { k: "heroCritMult"; v: number }
  | { k: "heroArea"; v: number }
  | { k: "heroMaxHp"; v: number }
  | { k: "heroSpeed"; v: number }
  | { k: "heroDmg"; v: number }
  | { k: "heroFireRate"; v: number }
  | { k: "heroRegen"; v: number }; // 초당 체력 회복

export interface CardDef {
  name: string;
  desc: string;
  category: 0 | 1 | 2;
  weight: number; // 뽑힐 확률 가중치
  minLevel?: number; // 이 레벨부터 등장
  unitType?: number; // 해당 병종 용병을 가진 사람에게만 등장
  effect: CardEffect;
}

const typeCards: CardDef[] = UNIT_TYPES.map((t) => ({
  name: `${UNIT_NAMES[t]} 단련`,
  desc: `${UNIT_NAMES[t]}의 체력 +25%, 공격력 +25%`,
  category: 1 as const,
  weight: 4,
  unitType: t,
  effect: { k: "typeBoost", type: t, hp: 0.25, dmg: 0.25 } as const,
}));

export const CARDS: readonly CardDef[] = [
  // 규모: 병력 수와 경제
  { name: "통솔력 +1", desc: "더 많은 용병을 거느린다 (통솔력 +1)", category: 0, weight: 10, effect: { k: "leadership", v: 1 } },
  { name: "통솔력 +2", desc: "더 많은 용병을 거느린다 (통솔력 +2)", category: 0, weight: 4, minLevel: 4, effect: { k: "leadership", v: 2 } },
  { name: "고용 비용 -15%", desc: "캠프 고용 가격이 15% 내려간다", category: 0, weight: 5, effect: { k: "priceMult", v: 0.85 } },
  { name: "전리품 +25%", desc: "적을 잡아 얻는 금화가 25% 늘어난다", category: 0, weight: 5, effect: { k: "goldMult", v: 0.25 } },
  // 용병 강화
  { name: "용병 체력 +15%", desc: "모든 용병의 체력 +15%", category: 1, weight: 8, effect: { k: "mercHp", v: 0.15 } },
  { name: "용병 공격력 +12%", desc: "모든 용병의 공격력 +12%", category: 1, weight: 8, effect: { k: "mercDmg", v: 0.12 } },
  { name: "용병 공격 속도 +10%", desc: "모든 용병이 더 빠르게 공격한다", category: 1, weight: 6, effect: { k: "mercAtkSpeed", v: 0.1 } },
  { name: "용병 이동 속도 +10%", desc: "모든 용병이 더 빨리 움직인다", category: 1, weight: 5, effect: { k: "mercSpeed", v: 0.1 } },
  { name: "빠른 재집결", desc: "용병 부활 시간 -20%", category: 1, weight: 5, effect: { k: "mercRespawn", v: 0.8 } },
  { name: "용병 사거리 +12%", desc: "모든 용병의 공격 사거리 +12%", category: 1, weight: 6, effect: { k: "mercRange", v: 0.12 } },
  { name: "용병 치명타 +8%", desc: "용병 공격이 8% 확률로 치명타(기본 피해 x1.5)", category: 1, weight: 6, effect: { k: "mercCrit", v: 0.08 } },
  { name: "용병 치명타 피해 +30%", desc: "용병 치명타 피해 배율 +0.3", category: 1, weight: 4, minLevel: 3, effect: { k: "mercCritMult", v: 0.3 } },
  { name: "용병 범위 +15%", desc: "용병의 공격 범위(부채꼴·범위 공격) +15%", category: 1, weight: 4, effect: { k: "mercArea", v: 0.15 } },
  { name: "궁병 관통 +1", desc: "용병 화살이 적 1명을 더 뚫고 나간다", category: 1, weight: 4, minLevel: 3, unitType: ARCHER, effect: { k: "mercPierce", v: 1 } },
  ...typeCards,
  // 주인공 강화
  { name: "최대 체력 +25", desc: "주인공의 최대 체력 +25", category: 2, weight: 8, effect: { k: "heroMaxHp", v: 25 } },
  { name: "이동 속도 +8%", desc: "주인공이 더 빨리 움직인다", category: 2, weight: 6, effect: { k: "heroSpeed", v: 0.08 } },
  { name: "공격력 +25%", desc: "주인공의 모든 무기 피해 +25%", category: 2, weight: 8, effect: { k: "heroDmg", v: 0.25 } },
  { name: "연사 속도 +15%", desc: "주인공이 더 빠르게 쏜다", category: 2, weight: 6, effect: { k: "heroFireRate", v: 0.15 } },
  { name: "사거리 +12%", desc: "주인공의 무기 사거리 +12%", category: 2, weight: 6, effect: { k: "heroRange", v: 0.12 } },
  { name: "관통 +1", desc: "주인공의 화살이 적 1명을 더 뚫고 나간다", category: 2, weight: 4, minLevel: 3, effect: { k: "heroPierce", v: 1 } },
  { name: "치명타 확률 +8%", desc: "주인공 공격이 8% 확률로 치명타(기본 피해 x1.5)", category: 2, weight: 6, effect: { k: "heroCrit", v: 0.08 } },
  { name: "치명타 피해 +30%", desc: "주인공 치명타 피해 배율 +0.3", category: 2, weight: 4, minLevel: 3, effect: { k: "heroCritMult", v: 0.3 } },
  { name: "범위 +15%", desc: "주인공의 근접 부채꼴·범위 공격 +15%", category: 2, weight: 4, effect: { k: "heroArea", v: 0.15 } },
  { name: "체력 재생", desc: "주인공이 초당 체력 0.8을 회복한다", category: 2, weight: 5, effect: { k: "heroRegen", v: 0.8 } },
];

export const OFFER_SIZE = 3;
