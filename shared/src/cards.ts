// 레벨업 선택지. 효과 종류는 서버가 적용하고, 이름·설명은 클라이언트가 그대로 표시한다.
// 수치 카드는 같은 능력치라도 일반 / 희귀 / 영웅 세 등급이 있고, 등급이 높을수록 효과가 크고 드물게 나온다.

import { ARCHER, BLUNT, CAVALRY, MAGE, SHIELD, SPEAR, UNIT_NAMES, UNIT_TYPES } from "./rules.js";

/** 0=규모(수 늘리기), 1=용병 강화, 2=주인공 강화, 3=전설(드물고 강력한 시너지) */
export const CARD_CATEGORY_NAMES = ["규모", "용병 강화", "주인공 강화", "전설"] as const;

/** 수치 카드의 등급. mult는 일반 카드 대비 효과 배율, weight는 뽑힐 확률 배율, minLevel은 등장 레벨. */
export const RARITY_NAMES = ["일반", "희귀", "영웅", "전설"] as const;
/** 독 지속 시간(초) */
export const POISON_SEC = 4;

export interface RarityDef {
  mult: number;
  weight: number;
  minLevel: number;
}
export const RARITY: [RarityDef, RarityDef, RarityDef] = [
  { mult: 1, weight: 1, minLevel: 1 },
  { mult: 1.6, weight: 0.4, minLevel: 3 },
  { mult: 2.4, weight: 0.12, minLevel: 6 },
];

/** 전설 능력은 적용 대상이 정해져 있다: 주인공만, 또는 특정 병종만. 효과가 양쪽에 겹쳐 적용되지 않는다. */
export type LegendId = "stormfire" | "bloodthirst" | "pierceRamp" | "execute" | "chargeBoost" | "undying" | "splashBoost" | "warcry";
export type LegendScope = "hero" | number; // number = 병종
export const legendKey = (id: LegendId, scope: LegendScope): string => `${id}@${scope}`;
export const LEGEND_CONST = {
  bloodthirstFrac: 0.00625, // 준 피해의 이만큼 회복(치명타는 2배)
  pierceRamp: 1.35, // 관통할 때마다 피해 배율
  executeBelow: 0.3, // 이 체력 비율 아래의 적에게
  executeMult: 2, // 피해 배율
  chargeMult: 2, // 기병 돌격 피해 배율
  undyingChance: 0.35, // 쓰러질 때 되살아날 확률
  splashMult: 2, // 범위 피해 배율
  warcryStep: 0.08, // 처치 한 번당 공격 속도
  warcryMax: 5, // 최대 중첩
  warcrySec: 6, // 중첩 유지 시간
};
const pctText = (v: number): string => `${Math.round(v * 1000) / 10}%`;
/** 전설 능력의 설명: 수치는 LEGEND_CONST에서 만든다(수치를 조정하면 다시 만든다) */
const legendDescs = (): Record<LegendId, string> => ({
  stormfire: "치명타가 터지면 다음 공격 대기시간이 사라진다 (치명타·공격 속도와 시너지)",
  bloodthirst: `준 피해의 ${pctText(LEGEND_CONST.bloodthirstFrac)}를 회복, 치명타는 2배 (치명타 피해와 시너지)`,
  pierceRamp: `화살이 적을 뚫을 때마다 피해 +${Math.round((LEGEND_CONST.pierceRamp - 1) * 100)}% (관통 수와 시너지)`,
  execute: `체력 ${Math.round(LEGEND_CONST.executeBelow * 100)}% 이하 적에게 피해 x${LEGEND_CONST.executeMult} (공격력·치명타와 시너지)`,
  chargeBoost: `돌격 피해 x${LEGEND_CONST.chargeMult} (이동 속도와 시너지)`,
  undying: `쓰러질 때 ${Math.round(LEGEND_CONST.undyingChance * 100)}% 확률로 체력 절반으로 즉시 되살아난다`,
  splashBoost: `범위 공격 피해 x${LEGEND_CONST.splashMult} (범위·공격력과 시너지)`,
  warcry: `적을 처치할 때마다 ${LEGEND_CONST.warcrySec}초간 공격 속도 +${Math.round(LEGEND_CONST.warcryStep * 100)}% (최대 ${LEGEND_CONST.warcryMax}중첩)`,
});
export const LEGENDS: Record<LegendId, { name: string; desc: string; scopes: readonly LegendScope[] }> = {
  stormfire: { name: "폭풍 연사", desc: "", scopes: ["hero", CAVALRY, ARCHER] },
  bloodthirst: { name: "피의 갈증", desc: "", scopes: ["hero", CAVALRY, SPEAR, BLUNT] },
  pierceRamp: { name: "관통 증폭", desc: "", scopes: ["hero", ARCHER] },
  execute: { name: "처형", desc: "", scopes: ["hero", SPEAR, BLUNT] },
  chargeBoost: { name: "돌격 가속", desc: "", scopes: [CAVALRY] },
  undying: { name: "불사", desc: "", scopes: [SPEAR, SHIELD, BLUNT] },
  splashBoost: { name: "광역 증폭", desc: "", scopes: ["hero", BLUNT, MAGE] },
  warcry: { name: "전장의 함성", desc: "", scopes: ["hero", CAVALRY, ARCHER, BLUNT, MAGE] },
};
for (const [id, d] of Object.entries(legendDescs())) LEGENDS[id as LegendId].desc = d;
export const legendScopeName = (scope: LegendScope): string => (scope === "hero" ? "주인공" : UNIT_NAMES[scope]!);

/** 용병 능력치 종류. 배율 계열(hp~area, xp)은 곱해지고, 나머지는 더해진다. 방어력·회피율·부활 속도·시전 속도는 더한 값 x를 x/(1+x) 꼴로 환산한다(상한 없음). */
export type MercStat = "hp" | "dmg" | "atkSpeed" | "speed" | "range" | "area" | "crit" | "critMult" | "defense" | "dodge" | "regen" | "lifesteal" | "pierce" | "multi" | "poison" | "armor" | "respawn" | "knock" | "thorns" | "xp" | "cast";

export type CardEffect =
  | { k: "leadership"; v: number } // 통솔력 +v
  | { k: "leadershipPct"; v: number } // 통솔력 +v(비율, 지금까지 쌓인 통솔력 전체에 곱한다)
  | { k: "priceMult"; v: number } // 고용 가격에 v를 곱한다
  | { k: "goldMult"; v: number } // 금화 획득 +v(비율)
  | { k: "xpMult"; v: number } // 주인공 경험치 획득 +v(비율)
  | { k: "luck"; v: number } // 행운 +v: 높은 등급 카드가 나올 확률이 올라간다
  | { k: "bounty"; v: number } // 스테이지·소대 클리어 금화 +v(비율)
  | { k: "mercStat"; stat: MercStat; v: number; type?: number } // 용병 능력치. type을 생략하면 모든 용병(효과는 작다)
  | { k: "legend"; id: LegendId; scope: LegendScope }
  | { k: "heroRange"; v: number }
  | { k: "heroPierce"; v: number }
  | { k: "heroMulti"; v: number }
  | { k: "heroPoison"; v: number }
  | { k: "heroArmor"; v: number }
  | { k: "heroCrit"; v: number }
  | { k: "heroCritMult"; v: number }
  | { k: "heroArea"; v: number }
  | { k: "heroKnock"; v: number }
  | { k: "heroThorns"; v: number } // 근접 공격을 받을 때마다 공격자에게 주는 고정 피해
  | { k: "heroDefense"; v: number }
  | { k: "heroDodge"; v: number }
  | { k: "heroMaxHp"; v: number }
  | { k: "heroSpeed"; v: number }
  | { k: "heroDmg"; v: number }
  | { k: "heroFireRate"; v: number }
  | { k: "heroLifesteal"; v: number } // 준 피해의 v(비율)만큼 회복
  | { k: "heroRegen"; v: number } // 초당 체력 회복
  | { k: "heroShield"; v: number } // 검 방패 체력 최대치 +v
  | { k: "heroShieldRegen"; v: number }
  | { k: "heroSkillPow"; v: number } // 스페이스 스킬 효과(거리·시간·피해·크기) +v(비율, 합 x면 1+x배)
  | { k: "heroSkill"; v: number } // 스페이스 스킬 회복 속도 +v(합이 x면 쿨타임 1/(1+x)배)
  | { k: "heroCast"; v: number }; // 지팡이 시전 속도 +v(합이 x면 주문 시간 1/(1+x)배) // 검 방패 재생 속도 +v(비율)

export interface CardDef {
  name: string;
  desc: string;
  category: 0 | 1 | 2 | 3;
  rarity: 0 | 1 | 2 | 3; // RARITY_NAMES 인덱스(3은 전설)
  unique?: boolean; // 한 번 고르면 다시 나오지 않는다
  weight: number; // 뽑힐 확률 가중치
  stars?: number; // 표시용 등급(1~3)
  minLevel?: number; // 이 레벨부터 등장
  unitType?: number; // 해당 병종 용병을 가진 사람에게만 등장
  effect: CardEffect;
}

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
  lifesteal: "흡혈",
  pierce: "관통",
  multi: "발사 수",
  poison: "독 화살",
  armor: "피해 감소",
  respawn: "부활 속도",
  knock: "넉백",
  thorns: "근접 반사",
  xp: "경험치 획득",
  cast: "시전 속도",
};
/** 병종 전용 일반 카드 한 장의 효과량(이전의 1.5배: 후반에는 용병술이 더 중요하도록). 관통·발사 수는 개수라 그대로다. 전체 용병 카드는 이것의 GLOBAL_CARD_FACTOR배. */
export const MERC_STAT_BASE: Record<MercStat, number> = {
  hp: 0.375, dmg: 0.3, atkSpeed: 0.225, speed: 0.18, range: 0.225, area: 0.3, crit: 0.15, critMult: 0.3, defense: 0.15, dodge: 0.12, regen: 0.0075, lifesteal: 0.0045, pierce: 1, multi: 1, poison: 0.75, armor: 3, respawn: 0.25, knock: 45, thorns: 3, xp: 0.45, cast: 0.1,
};
/** 수치 조정 도구로 바꿀 수 있는 카드 설정 */
export const CARD_TUNE = { globalFactor: 0.35, globalLifesteal: 5, globalWeight: 6, legendWeight: 0.6, bloodthirstWeight: 1.6, legendMinLevel: 6 };
/** 규모 카드(통솔력·고용 비용·경험치·행운·보상금·전리품): base는 일반 등급 효과량, weight는 일반 등급 뽑힐 가중치 */
export const SCALE_CARD = {
  leadWeight: 40,
  leadPctBase: 0.1,
  leadPctWeight: 14,
  priceBase: 0.15,
  priceWeight: 5,
  xpBase: 0.15,
  xpWeight: 6,
  luckBase: 0.2,
  luckWeight: 4,
  bountyBase: 0.3,
  bountyWeight: 4,
  goldBase: 0.25,
  goldWeight: 5,
};
/** 용병 공용 흡혈 카드는 효과가 작아 다른 공용 카드의 5배로 준다(궁병 50%·마법사 25%는 따로 적용) */
export const GLOBAL_LIFESTEAL_BOOST = 5; // 기본값
export const GLOBAL_CARD_FACTOR = 0.35; // 기본값(수치 조정 도구가 바꾸는 실제 값은 CARD_TUNE) // 병종 전용 카드가 없어지고 용병 공용 카드가 그 자리를 대신하므로 예전(0.2)보다 올렸다
/** 병종마다 키울 수 있는 능력치(그 병종의 역할에 맞춘 목록). 공격 속도와 범위는 쓸모가 있는 병종에 모두 있다. */
export const MERC_TYPE_FOCUS: readonly (readonly MercStat[])[] = [
  ["hp", "dmg", "speed", "crit", "dodge", "armor", "lifesteal", "atkSpeed", "area", "xp"], // 기병
  ["hp", "dmg", "range", "defense", "armor", "thorns", "lifesteal", "atkSpeed", "area", "knock", "xp"], // 창병
  ["hp", "dmg", "range", "atkSpeed", "crit", "pierce", "multi", "poison", "armor", "knock", "xp"], // 궁병(화살이라 범위는 없다. 거리를 유지하는 병종이라 넉백을 쓴다)
  ["hp", "defense", "armor", "thorns", "regen", "lifesteal", "dmg", "respawn", "atkSpeed", "area", "xp"], // 검방병
  ["dmg", "area", "hp", "armor", "thorns", "lifesteal", "critMult", "atkSpeed", "xp"], // 둔기병
  ["dmg", "area", "range", "atkSpeed", "cast", "hp", "crit", "critMult", "xp"], // 마법사(주문이 느리지만 한 방이 크고 넓다)
];

const round3 = (v: number) => Math.round(v * 1000) / 1000;
/** 등급을 반영한 효과량. 관통은 정수로 1/2/3, 나머지는 등급 배율. */
export const scaledValue = (stat: MercStat | "heroPierce" | "heroMulti" | "heroArmor" | "heroThorns", base: number, rarity: number): number =>
  stat === "armor" || stat === "heroArmor" ? base * rarity : stat === "thorns" || stat === "heroThorns" ? round3(base * (rarity + 1)) : stat === "multi" || stat === "heroMulti" ? base * rarity : stat === "pierce" || stat === "heroPierce" ? base * (rarity + 1) : round3(base * RARITY[rarity]!.mult);

/** 능력치 변화량을 사람이 읽는 문구로 */
export function describeStat(stat: MercStat, v: number): string {
  if (stat === "pierce" || stat === "multi") return `+${v}`;
  if (stat === "armor") return `-${v}`;
  if (stat === "thorns") return `${v}`;
  if (stat === "poison") return `화살 피해의 ${Math.round(v * 100)}%`;
  if (stat === "knock") return `+${Math.round(v)}`;
  const pct = Math.abs(v) * 100;
  const text = pct >= 10 ? String(Math.round(pct)) : String(Math.round(pct * 10) / 10);
  if (stat === "regen") return `초당 최대 체력 +${text}%`;
  return `${v < 0 ? "-" : "+"}${text}%`;
}

/** 방어력·회피율·부활 속도: 몇 장을 쌓아도 한 장의 효율이 같다(체력 증가로 환산) */
const EFFICIENCY_NOTE: Partial<Record<string, string>> = {
  defense: " (받는 피해가 1/(1+합)배 — 쌓아도 체력 증가와 같은 효율, 상한 없음)",
  dodge: " (회피 확률 합/(1+합) — 쌓아도 체력 증가와 같은 효율, 상한 없음)",
  respawn: " (부활 시간 1/(1+합)배 — 상한 없음)",
  cast: " (주문 시간 1/(1+합)배 — 상한 없음)",
  skill: " (스페이스 스킬 쿨타임 1/(1+합)배 — 쌓아도 체력 증가와 같은 효율, 상한 없음)",
};
const statDesc = (t: number, stat: MercStat, v: number): string =>
  stat === "poison"
    ? `${UNIT_NAMES[t]}만: 맞은 적이 ${describeStat(stat, v)}만큼 독 피해를 ${POISON_SEC}초에 걸쳐 입는다(방패에 막히면 없음)`
    : stat === "thorns"
      ? `${UNIT_NAMES[t]}만: 근접 공격을 받으면 ${describeStat(stat, v)}의 피해를 공격자에게 되돌린다 (맞을 때마다 고정 피해, 방어력·방패와 무관, 화살·마법은 해당 없음)`
      : stat === "armor"
      ? `${UNIT_NAMES[t]}만: 맞을 때마다 받는 피해 ${describeStat(stat, v)} (방어력과 별개의 고정 감소)`
      : `${UNIT_NAMES[t]}만: ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)}${EFFICIENCY_NOTE[stat] ?? ""}`;

/** 잘 나오게 하고 싶은 능력치의 뽑힐 확률 가중치(일반 5). 체력 재생·흡혈은 한 장의 효과를 낮추는 대신 자주 나온다. */
/** 궁병은 화살마다 밀어서 연사·다중 발사와 겹치면 강하므로, 넉백 카드 효과를 창병의 이 비율만큼만 준다 */
export const ARCHER_KNOCK_FACTOR = 0.5;

const STAT_WEIGHT: Partial<Record<MercStat, number>> = { regen: 9, lifesteal: 9 };

/** 병종 전용 카드로만 나오는 능력치(그 병종의 특화): 관통·발사 수·독은 궁병, 방어구·가시는 몸으로 싸우는 병종, 시전 시간은 마법사, 넉백은 창병·궁병 */
const TYPE_ONLY_STATS: ReadonlySet<MercStat> = new Set(["pierce", "multi", "poison", "armor", "thorns", "cast", "knock"]);

const statCards = (): CardDef[] => {
  const out: CardDef[] = [];
  for (const t of UNIT_TYPES) {
    for (const stat of MERC_TYPE_FOCUS[t]!) {
      if (!TYPE_ONLY_STATS.has(stat)) continue; // 그 병종만의 특화 능력이 아니면 용병 공용 카드로만 나온다
      const special = stat === "pierce" || stat === "multi" || stat === "poison" || stat === "critMult" || stat === "thorns";
      for (let r = stat === "armor" || stat === "multi" ? 1 : 0; r < 3; r++) { // 방어구·발사 수는 희귀부터
        const v = round3(scaledValue(stat, MERC_STAT_BASE[stat], r) * (stat === "knock" && t === ARCHER ? ARCHER_KNOCK_FACTOR : 1));
        out.push({
          name: `${UNIT_NAMES[t]} ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)}`,
          desc: statDesc(t, stat, v),
          category: 1,
          rarity: r as 0 | 1 | 2,
          weight: (STAT_WEIGHT[stat] ?? (stat === "armor" ? 3 : special ? 4 : 5)) * RARITY[r]!.weight,
          stars: r + 1,
          minLevel: Math.max(RARITY[r]!.minLevel, stat === "armor" ? 4 : special ? 3 : 1),
          unitType: t,
          effect: { k: "mercStat", stat, v, type: t },
        });
      }
    }
  }
  for (const stat of Object.keys(MERC_STAT_BASE) as MercStat[]) {
    if (stat === "pierce" || stat === "multi" || stat === "poison" || stat === "armor" || stat === "thorns" || stat === "cast" || stat === "knock") continue; // 시전 시간은 마법사만, 관통·발사 수는 화살을 쏘는 궁병만, 넉백은 창병·궁병 전용이라 전체 용병 카드가 없다
    for (let r = 0; r < 3; r++) {
      const v = round3(scaledValue(stat, MERC_STAT_BASE[stat], r) * CARD_TUNE.globalFactor * (stat === "lifesteal" ? CARD_TUNE.globalLifesteal : 1));
      out.push({
        name: `용병 ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)}`,
        desc: `모든 용병의 ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)}${EFFICIENCY_NOTE[stat] ?? ""} (병종 전용 카드의 ${Math.round(CARD_TUNE.globalFactor * 100)}%)`,
        category: 1,
        rarity: r as 0 | 1 | 2,
        weight: (STAT_WEIGHT[stat] ?? CARD_TUNE.globalWeight) * RARITY[r]!.weight, // 병종 전용 카드가 줄어든 만큼 공용 카드가 더 자주 나온다
        stars: r + 1,
        minLevel: RARITY[r]!.minLevel,
        effect: { k: "mercStat", stat, v },
      });
    }
  }
  return out;
};

/** 주인공 능력치 카드(전체 용병이 아니라 주인공에게만 적용). 체력 재생·흡혈·근접 반사·피해 감소·관통·발사 수를 뺀 수치는 이전의 1.5배(용병 공용 카드 1명분의 약 1.8배). */
export const HERO_STATS: { k: Exclude<CardEffect["k"], "mercStat" | "legend" | "leadership" | "leadershipPct" | "priceMult" | "goldMult">; label: string; base: number; weight: number; minLevel?: number; fmt: "pct" | "flat" | "int" | "regen" | "shield" | "cut" }[] = [
  { k: "heroMaxHp", label: "최대 체력", base: 18.75, weight: 8, fmt: "flat" },
  { k: "heroSpeed", label: "이동 속도", base: 0.09, weight: 6, fmt: "pct" },
  { k: "heroDmg", label: "공격력", base: 0.1875, weight: 8, fmt: "pct" },
  { k: "heroFireRate", label: "공격 속도", base: 0.1125, weight: 6, fmt: "pct" },
  { k: "heroRange", label: "사거리", base: 0.09, weight: 6, fmt: "pct" },
  { k: "heroPierce", label: "관통", base: 1, weight: 4, minLevel: 3, fmt: "int" },
  { k: "heroMulti", label: "발사 수", base: 1, weight: 3, minLevel: 3, fmt: "int" },
  { k: "heroPoison", label: "독 화살", base: 0.375, weight: 3, minLevel: 3, fmt: "pct" },
  { k: "heroArmor", label: "피해 감소", base: 1, weight: 2.5, minLevel: 4, fmt: "int" },
  { k: "heroCrit", label: "치명타 확률", base: 0.12, weight: 6, fmt: "pct" },
  { k: "heroCritMult", label: "치명타 피해", base: 0.15, weight: 4, minLevel: 3, fmt: "pct" },
  { k: "heroArea", label: "범위", base: 0.1125, weight: 4, fmt: "pct" },
  { k: "heroKnock", label: "넉백", base: 22.5, weight: 5, fmt: "flat" },
  { k: "heroThorns", label: "근접 반사", base: 2, weight: 4, minLevel: 3, fmt: "int" },
  { k: "heroDefense", label: "방어력", base: 0.225, weight: 7, fmt: "pct" },
  { k: "heroDodge", label: "회피율", base: 0.18, weight: 5, fmt: "pct" },
  { k: "heroRegen", label: "체력 재생", base: 0.12, weight: 9, fmt: "regen" },
  { k: "heroLifesteal", label: "흡혈", base: 0.003, weight: 9, fmt: "pct" },
  { k: "heroCast", label: "시전 속도", base: 0.075, weight: 4, fmt: "pct" },
  { k: "heroSkill", label: "스킬 가속", base: 0.06, weight: 5, fmt: "pct" }, // 일반 +4%(희귀 x1.6, 영웅 x2.4), 쿨타임 1/(1+합)배
  { k: "heroSkillPow", label: "스킬 효과", base: 0.12, weight: 5, fmt: "pct" }, // 일반 +8%(희귀 x1.6, 영웅 x2.4)
  { k: "heroShield", label: "방패 체력", base: 60, weight: 5, fmt: "flat" },
  { k: "heroShieldRegen", label: "방패 재생 속도", base: 0.3, weight: 5, fmt: "pct" },
];
const heroCards = (): CardDef[] =>
  HERO_STATS.flatMap((h) =>
    (h.k === "heroArmor" || h.k === "heroMulti" ? [1, 2] : [0, 1, 2]).map((r): CardDef => {
      const v = h.k === "heroArmor" ? h.base * r : h.k === "heroThorns" ? h.base * (r + 1) : h.k === "heroMulti" ? h.base * r : h.k === "heroPierce" ? h.base * (r + 1) : h.fmt === "flat" ? Math.round(h.base * RARITY[r]!.mult) : round3(h.base * RARITY[r]!.mult);
      const text = h.k === "heroArmor" ? `-${v}` : h.k === "heroThorns" ? `${v}` : h.k === "heroPoison" ? `화살 피해의 ${Math.round(v * 100)}%` : h.fmt === "cut" ? `-${Math.round(Math.abs(v) * 1000) / 10}%` : h.fmt === "pct" ? `+${Math.round(v * 1000) / 10}%` : h.fmt === "regen" ? `초당 +${Math.round(v * 10) / 10}` : `+${v}`;
      return {
        name: `${h.label} ${text}`,
        desc: h.k === "heroPoison" ? `주인공 화살: 맞은 적이 ${text}만큼 독 피해를 ${POISON_SEC}초에 걸쳐 입는다(방패에 막히면 없음)` : h.k === "heroThorns" ? `주인공만: 근접 공격을 받으면 ${text}의 피해를 공격자에게 되돌린다 (맞을 때마다 고정 피해, 방어력·방패와 무관, 화살·마법은 해당 없음)` : h.k === "heroArmor" ? `주인공만: 맞을 때마다 받는 피해 ${text} (방어력과 별개의 고정 감소)` : h.k === "heroSkillPow" ? `주인공만: 스페이스 스킬 효과 ${text} (후퇴·돌진 거리, 검 무적 시간, 철퇴 투척 피해·폭발 반경, 방벽 길이, 기마 가속 속도)` : h.k === "heroCast" ? `주인공이 지팡이를 들었을 때: 시전 속도 ${text}${EFFICIENCY_NOTE.cast}` : h.k === "heroShield" ? `주인공이 검을 들었을 때: 방패 체력 ${text}` : h.k === "heroShieldRegen" ? `주인공이 검을 들었을 때: 방패가 차오르는 속도 ${text} (맞지 않고 기다리는 시간은 그대로)` : `주인공만: ${h.label} ${text}${h.k === "heroDefense" ? EFFICIENCY_NOTE.defense : h.k === "heroDodge" ? EFFICIENCY_NOTE.dodge : h.k === "heroSkill" ? EFFICIENCY_NOTE.skill : ""}`,
        category: 2,
        rarity: r as 0 | 1 | 2,
        weight: h.weight * RARITY[r]!.weight,
        stars: r + 1,
        minLevel: Math.max(RARITY[r]!.minLevel, h.minLevel ?? 1),
        effect: { k: h.k, v } as CardEffect,
      };
    }),
  );

/** 규모 카드(통솔력·고용 비용·전리품) */
const scaleCards = (): CardDef[] =>
  [0, 1, 2].flatMap((r): CardDef[] => {
    const m = RARITY[r]!;
    const rr = r as 0 | 1 | 2;
    const lead = r + 1;
    const C = SCALE_CARD;
    const price = round3(1 - C.priceBase * m.mult);
    const gold = round3(C.goldBase * m.mult);
    const pct = (v: number) => Math.round(v * 100);
    return [
      { name: `통솔력 +${lead}`, desc: `더 많은 용병을 거느린다 (통솔력 +${lead})`, category: 0, rarity: rr, weight: C.leadWeight * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "leadership", v: lead } },
      { name: `통솔력 +${pct(C.leadPctBase * m.mult)}%`, desc: `거느릴 수 있는 통솔력이 ${pct(C.leadPctBase * m.mult)}% 늘어난다 (통솔력이 클수록 효과가 크다)`, category: 0, rarity: rr, weight: C.leadPctWeight * m.weight, stars: r + 1, minLevel: m.minLevel + 2, effect: { k: "leadershipPct", v: round3(C.leadPctBase * m.mult) } },
      { name: `고용 비용 -${pct(1 - price)}%`, desc: `캠프 고용 가격이 ${pct(1 - price)}% 내려간다`, category: 0, rarity: rr, weight: C.priceWeight * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "priceMult", v: price } },
      { name: `경험치 +${pct(C.xpBase * m.mult)}%`, desc: `주인공이 얻는 경험치가 ${pct(C.xpBase * m.mult)}% 늘어난다 (더 빨리 레벨업)`, category: 0, rarity: rr, weight: C.xpWeight * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "xpMult", v: round3(C.xpBase * m.mult) } },
      { name: `행운 +${pct(C.luckBase * m.mult)}%`, desc: `희귀·영웅·전설 카드가 나올 확률이 올라간다 (행운 +${pct(C.luckBase * m.mult)}%)`, category: 0, rarity: rr, weight: C.luckWeight * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "luck", v: round3(C.luckBase * m.mult) } },
      { name: `보상금 +${pct(C.bountyBase * m.mult)}%`, desc: `스테이지·소대를 정리했을 때 받는 금화가 ${pct(C.bountyBase * m.mult)}% 늘어난다`, category: 0, rarity: rr, weight: C.bountyWeight * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "bounty", v: round3(C.bountyBase * m.mult) } },
      { name: `전리품 +${pct(gold)}%`, desc: `적을 잡아 얻는 금화가 ${pct(gold)}% 늘어난다`, category: 0, rarity: rr, weight: C.goldWeight * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "goldMult", v: gold } },
    ];
  });

/** 전설: 드물게 나오고 같은 (능력, 대상) 조합은 한 번만 고를 수 있다 */
/** 전설 카드 가중치(기본 0.6). 피의 갈증은 흡혈 카드와 함께 자주 나오게 한다. */
const legendCards = (): CardDef[] =>
  (Object.keys(LEGENDS) as LegendId[]).flatMap((id) =>
    LEGENDS[id].scopes.map(
      (scope): CardDef => ({
        name: `[전설] ${legendScopeName(scope)} ${LEGENDS[id].name}`,
        desc: LEGENDS[id].desc, // 대상은 이름에 이미 들어 있다
        category: 3,
        rarity: 3,
        weight: id === "bloodthirst" ? CARD_TUNE.bloodthirstWeight : CARD_TUNE.legendWeight,
        stars: 3,
        minLevel: CARD_TUNE.legendMinLevel,
        unique: true,
        unitType: scope === "hero" ? undefined : scope,
        effect: { k: "legend", id, scope },
      }),
    ),
  );

const buildCards = (): CardDef[] => [...scaleCards(), ...statCards(), ...legendCards(), ...heroCards()];
const cardList: CardDef[] = buildCards();
export const CARDS: readonly CardDef[] = cardList;

/**
 * 수치 조정 도구가 카드 수치(RARITY·MERC_STAT_BASE·CARD_TUNE·SCALE_CARD·HERO_STATS·LEGEND_CONST)를 바꾼 뒤 카드 목록을 다시 만든다.
 * 카드의 번호(CARDS 안의 자리)는 서버와 클라이언트가 같아야 하므로 같은 자리에 새 카드를 덮어쓴다(개수·순서는 수치와 무관하다).
 */
export function rebuildCards(): void {
  for (const [id, d] of Object.entries(legendDescs())) LEGENDS[id as LegendId].desc = d;
  const next = buildCards();
  if (next.length !== cardList.length) return;
  for (let i = 0; i < next.length; i++) cardList[i] = next[i]!;
}

export const OFFER_SIZE = 3;
/** 행운 1.0이면 등급별 카드 확률 배율이 (1 + 행운 x 이 값)이 된다(일반 카드는 그대로). 전설 포함. */
export const LUCK_RARITY_BOOST = [0, 3, 6, 8] as const;
export const LUCK_MAX = 3;
export const luckWeight = (rarity: number, luck: number): number => 1 + Math.min(LUCK_MAX, Math.max(0, luck)) * (LUCK_RARITY_BOOST[rarity] ?? 0);
/** 카드를 고를 때마다 얻는 새로고침(제시된 카드 3장을 다시 뽑는다) 수와 보유 상한 */
export const REROLL_START = 2; // 카드 종류가 늘어난 만큼 처음부터 두 번(하나 추가)
export const REROLL_PER_PICK = 1;
export const REROLL_MAX = 5;
