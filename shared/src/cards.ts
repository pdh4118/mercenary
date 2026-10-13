// 레벨업 선택지. 효과 종류는 서버가 적용하고, 이름·설명은 클라이언트가 그대로 표시한다.

import { UNIT_NAMES, UNIT_TYPES } from "./rules.js";

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
  ...typeCards,
  // 주인공 강화
  { name: "최대 체력 +25", desc: "주인공의 최대 체력 +25", category: 2, weight: 8, effect: { k: "heroMaxHp", v: 25 } },
  { name: "이동 속도 +8%", desc: "주인공이 더 빨리 움직인다", category: 2, weight: 6, effect: { k: "heroSpeed", v: 0.08 } },
  { name: "사격 피해 +25%", desc: "주인공의 사격 피해 +25%", category: 2, weight: 8, effect: { k: "heroDmg", v: 0.25 } },
  { name: "연사 속도 +15%", desc: "주인공이 더 빠르게 쏜다", category: 2, weight: 6, effect: { k: "heroFireRate", v: 0.15 } },
  { name: "체력 재생", desc: "주인공이 초당 체력 0.8을 회복한다", category: 2, weight: 5, effect: { k: "heroRegen", v: 0.8 } },
];

export const OFFER_SIZE = 3;
