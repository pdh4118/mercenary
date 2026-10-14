// 레벨업 선택지. 효과 종류는 서버가 적용하고, 이름·설명은 클라이언트가 그대로 표시한다.

import { UNIT_NAMES, UNIT_TYPES } from "./rules.js";

/** 0=규모(수 늘리기), 1=용병 강화, 2=주인공 강화, 3=전설(드물고 강력한 시너지) */
export const CARD_CATEGORY_NAMES = ["규모", "용병 강화", "주인공 강화", "전설"] as const;

/** 전설 능력: 드물게 나오고 한 번만 고를 수 있으며, 다른 능력치와 겹칠수록 급격히 강해진다. */
export type LegendId = "stormfire" | "bloodthirst" | "pierceRamp" | "execute" | "thorns" | "chargeBoost" | "undying" | "splashBoost" | "warcry";
export const LEGEND_CONST = {
  bloodthirstFrac: 0.15, // 준 피해의 이만큼 회복(치명타는 2배)
  pierceRamp: 1.35, // 관통할 때마다 피해 배율
  executeBelow: 0.3, // 이 체력 비율 아래의 적에게
  executeMult: 2, // 피해 배율
  thornsFrac: 0.5, // 받은 피해의 이만큼을 공격자에게
  chargeMult: 2, // 기병 돌격 피해 배율
  undyingChance: 0.35, // 쓰러질 때 되살아날 확률
  splashMult: 2, // 범위 피해 배율
  warcryStep: 0.08, // 처치 한 번당 용병 공격 속도
  warcryMax: 5, // 최대 중첩
  warcrySec: 6, // 중첩 유지 시간
} as const;
export const LEGENDS: Record<LegendId, { name: string; desc: string }> = {
  stormfire: { name: "폭풍 연사", desc: "치명타가 터지면 다음 공격 대기시간이 사라진다 (치명타·공격 속도와 시너지)" },
  bloodthirst: { name: "피의 갈증", desc: "준 피해의 15%를 회복, 치명타는 2배 (치명타 피해와 시너지)" },
  pierceRamp: { name: "관통 증폭", desc: "화살이 적을 뚫을 때마다 피해 +35% (관통 수와 시너지)" },
  execute: { name: "처형", desc: "체력 30% 이하 적에게 피해 x2 (공격력·치명타와 시너지)" },
  thorns: { name: "가시 갑옷", desc: "받은 피해의 50%를 공격자에게 되돌린다 (체력·방어력과 시너지)" },
  chargeBoost: { name: "돌격 가속", desc: "기병 돌격 피해 x2 (기병 이동 속도와 시너지)" },
  undying: { name: "불사의 군단", desc: "용병이 쓰러질 때 35% 확률로 체력 절반으로 즉시 되살아난다" },
  splashBoost: { name: "광역 증폭", desc: "범위 공격 피해 x2 (범위·공격력과 시너지)" },
  warcry: { name: "전장의 함성", desc: "적을 처치할 때마다 6초간 용병 공격 속도 +8% (최대 5중첩)" },
};

export type CardEffect =
  | { k: "leadership"; v: number } // 통솔력 +v
  | { k: "priceMult"; v: number } // 고용 가격에 v를 곱한다
  | { k: "goldMult"; v: number } // 금화 획득 +v(비율)
  | { k: "mercStat"; stat: MercStat; v: number; type?: number } // 용병 능력치. type을 생략하면 모든 용병(효과는 작다)
  | { k: "legend"; id: LegendId }
  | { k: "heroRange"; v: number }
  | { k: "heroPierce"; v: number }
  | { k: "heroCrit"; v: number }
  | { k: "heroCritMult"; v: number }
  | { k: "heroArea"; v: number }
  | { k: "heroDefense"; v: number }
  | { k: "heroDodge"; v: number }
  | { k: "heroMaxHp"; v: number }
  | { k: "heroSpeed"; v: number }
  | { k: "heroDmg"; v: number }
  | { k: "heroFireRate"; v: number }
  | { k: "heroRegen"; v: number }; // 초당 체력 회복

export interface CardDef {
  name: string;
  desc: string;
  category: 0 | 1 | 2 | 3;
  unique?: boolean; // 한 번 고르면 다시 나오지 않는다
  weight: number; // 뽑힐 확률 가중치
  stars?: number; // 표시용 등급(1~3). 없으면 가중치로 정한다
  minLevel?: number; // 이 레벨부터 등장
  unitType?: number; // 해당 병종 용병을 가진 사람에게만 등장
  effect: CardEffect;
}

/** 용병 능력치 종류. 배율 계열(hp~area, respawn)은 곱해지고, 나머지는 더해진다. */
export type MercStat = "hp" | "dmg" | "atkSpeed" | "speed" | "range" | "area" | "crit" | "critMult" | "defense" | "dodge" | "regen" | "pierce" | "respawn";
export const MERC_STAT_LABEL: Record<MercStat, string> = {
  hp: "체력",
  dmg: "공격력",
  atkSpeed: "공격 속도",
  speed: "이동 속도",
  range: "사거리",
  area: "범위",
  crit: "치명타 확률",
  critMult: "치명타 피해",
  defense: "방어력",
  dodge: "회피율",
  regen: "체력 재생",
  pierce: "관통",
  respawn: "부활 시간",
};
/** 병종 전용 카드 한 장의 효과량. 전체 용병 카드는 이것의 GLOBAL_CARD_FACTOR배. */
export const MERC_STAT_BASE: Record<MercStat, number> = {
  hp: 0.25, dmg: 0.25, atkSpeed: 0.15, speed: 0.12, range: 0.15, area: 0.2, crit: 0.1, critMult: 0.4, defense: 0.1, dodge: 0.08, regen: 0.02, pierce: 1, respawn: -0.25,
};
export const GLOBAL_CARD_FACTOR = 0.2;
/** 병종마다 키울 수 있는 능력치(그 병종의 역할에 맞춘 목록) */
export const MERC_TYPE_FOCUS: readonly (readonly MercStat[])[] = [
  ["hp", "dmg", "speed", "crit", "dodge"], // 기병
  ["hp", "dmg", "range", "defense", "atkSpeed"], // 창병
  ["dmg", "range", "atkSpeed", "crit", "pierce"], // 궁병
  ["hp", "defense", "regen", "dmg", "respawn"], // 검방병
  ["dmg", "area", "hp", "critMult", "atkSpeed"], // 둔기병
];

/** 능력치 변화량을 사람이 읽는 문구로 */
export function describeStat(stat: MercStat, v: number): string {
  if (stat === "pierce") return `+${v}`;
  const pct = Math.abs(v) * 100;
  const text = pct >= 10 ? String(Math.round(pct)) : String(Math.round(pct * 10) / 10);
  if (stat === "regen") return `초당 최대 체력 +${text}%`;
  return `${v < 0 ? "-" : "+"}${text}%`;
}

const statCards = (): CardDef[] => {
  const out: CardDef[] = [];
  for (const t of UNIT_TYPES) {
    for (const stat of MERC_TYPE_FOCUS[t]!) {
      const v = MERC_STAT_BASE[stat];
      const rare = stat === "pierce" || stat === "critMult";
      out.push({
        name: `${UNIT_NAMES[t]} ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)}`,
        desc: `${UNIT_NAMES[t]}만: ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)}`,
        category: 1,
        weight: rare ? 4 : 5,
        stars: rare ? 3 : 2,
        minLevel: rare ? 3 : undefined,
        unitType: t,
        effect: { k: "mercStat", stat, v, type: t },
      });
    }
  }
  for (const stat of Object.keys(MERC_STAT_BASE) as MercStat[]) {
    if (stat === "pierce") continue; // 관통은 화살을 쏘는 궁병만
    const v = Math.round(MERC_STAT_BASE[stat] * GLOBAL_CARD_FACTOR * 1000) / 1000;
    out.push({
      name: `용병 ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)}`,
      desc: `모든 용병의 ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)} (병종 전용 카드의 ${GLOBAL_CARD_FACTOR * 100}%)`,
      category: 1,
      weight: 3,
      stars: 1,
      effect: { k: "mercStat", stat, v },
    });
  }
  return out;
};

export const CARDS: readonly CardDef[] = [
  // 규모: 병력 수와 경제
  { name: "통솔력 +1", desc: "더 많은 용병을 거느린다 (통솔력 +1)", category: 0, weight: 10, effect: { k: "leadership", v: 1 } },
  { name: "통솔력 +2", desc: "더 많은 용병을 거느린다 (통솔력 +2)", category: 0, weight: 4, minLevel: 4, effect: { k: "leadership", v: 2 } },
  { name: "고용 비용 -15%", desc: "캠프 고용 가격이 15% 내려간다", category: 0, weight: 5, effect: { k: "priceMult", v: 0.85 } },
  { name: "전리품 +25%", desc: "적을 잡아 얻는 금화가 25% 늘어난다", category: 0, weight: 5, effect: { k: "goldMult", v: 0.25 } },
  // 용병 강화: 병종 전용(주력)과 전체(약함)
  ...statCards(),
  // 전설: 드물게 나오는 시너지 능력(한 번만)
  ...(Object.keys(LEGENDS) as LegendId[]).map(
    (id): CardDef => ({ name: `[전설] ${LEGENDS[id].name}`, desc: LEGENDS[id].desc, category: 3, weight: 1.5, stars: 3, minLevel: 6, unique: true, effect: { k: "legend", id } }),
  ),
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
  { name: "방어력 +8%", desc: "주인공이 받는 피해 -8%", category: 2, weight: 7, effect: { k: "heroDefense", v: 0.08 } },
  { name: "회피율 +6%", desc: "6% 확률로 공격을 완전히 피한다", category: 2, weight: 5, effect: { k: "heroDodge", v: 0.06 } },
  { name: "체력 재생", desc: "주인공이 초당 체력 0.8을 회복한다", category: 2, weight: 5, effect: { k: "heroRegen", v: 0.8 } },
];

export const OFFER_SIZE = 3;
/** 카드를 고를 때마다 얻는 새로고침(제시된 카드 3장을 다시 뽑는다) 수와 보유 상한 */
export const REROLL_START = 1;
export const REROLL_PER_PICK = 1;
export const REROLL_MAX = 5;
