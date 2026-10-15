// 레벨업 선택지. 효과 종류는 서버가 적용하고, 이름·설명은 클라이언트가 그대로 표시한다.
// 수치 카드는 같은 능력치라도 일반 / 희귀 / 영웅 세 등급이 있고, 등급이 높을수록 효과가 크고 드물게 나온다.

import { ARCHER, BLUNT, CAVALRY, SHIELD, SPEAR, UNIT_NAMES, UNIT_TYPES } from "./rules.js";

/** 0=규모(수 늘리기), 1=용병 강화, 2=주인공 강화, 3=전설(드물고 강력한 시너지) */
export const CARD_CATEGORY_NAMES = ["규모", "용병 강화", "주인공 강화", "전설"] as const;

/** 수치 카드의 등급. mult는 일반 카드 대비 효과 배율, weight는 뽑힐 확률 배율, minLevel은 등장 레벨. */
export const RARITY_NAMES = ["일반", "희귀", "영웅", "전설"] as const;
export const RARITY = [
  { mult: 1, weight: 1, minLevel: 1 },
  { mult: 1.6, weight: 0.4, minLevel: 3 },
  { mult: 2.4, weight: 0.12, minLevel: 6 },
] as const;

/** 전설 능력은 적용 대상이 정해져 있다: 주인공만, 또는 특정 병종만. 효과가 양쪽에 겹쳐 적용되지 않는다. */
export type LegendId = "stormfire" | "bloodthirst" | "pierceRamp" | "execute" | "thorns" | "chargeBoost" | "undying" | "splashBoost" | "warcry";
export type LegendScope = "hero" | number; // number = 병종
export const legendKey = (id: LegendId, scope: LegendScope): string => `${id}@${scope}`;
export const LEGEND_CONST = {
  bloodthirstFrac: 0.04, // 준 피해의 이만큼 회복(치명타는 2배)
  pierceRamp: 1.35, // 관통할 때마다 피해 배율
  executeBelow: 0.3, // 이 체력 비율 아래의 적에게
  executeMult: 2, // 피해 배율
  thornsFrac: 0.5, // 받은 피해의 이만큼을 공격자에게
  chargeMult: 2, // 기병 돌격 피해 배율
  undyingChance: 0.35, // 쓰러질 때 되살아날 확률
  splashMult: 2, // 범위 피해 배율
  warcryStep: 0.08, // 처치 한 번당 공격 속도
  warcryMax: 5, // 최대 중첩
  warcrySec: 6, // 중첩 유지 시간
} as const;
export const LEGENDS: Record<LegendId, { name: string; desc: string; scopes: readonly LegendScope[] }> = {
  stormfire: { name: "폭풍 연사", desc: "치명타가 터지면 다음 공격 대기시간이 사라진다 (치명타·공격 속도와 시너지)", scopes: ["hero", CAVALRY, ARCHER] },
  bloodthirst: { name: "피의 갈증", desc: "준 피해의 4%를 회복, 치명타는 2배 (치명타 피해와 시너지)", scopes: ["hero", CAVALRY, SPEAR, BLUNT] },
  pierceRamp: { name: "관통 증폭", desc: "화살이 적을 뚫을 때마다 피해 +35% (관통 수와 시너지)", scopes: ["hero", ARCHER] },
  execute: { name: "처형", desc: "체력 30% 이하 적에게 피해 x2 (공격력·치명타와 시너지)", scopes: ["hero", SPEAR, BLUNT] },
  thorns: { name: "가시 갑옷", desc: "받은 피해의 50%를 공격자에게 되돌린다 (체력·방어력과 시너지)", scopes: ["hero", SPEAR, SHIELD] },
  chargeBoost: { name: "돌격 가속", desc: "돌격 피해 x2 (이동 속도와 시너지)", scopes: [CAVALRY] },
  undying: { name: "불사", desc: "쓰러질 때 35% 확률로 체력 절반으로 즉시 되살아난다", scopes: [SPEAR, SHIELD, BLUNT] },
  splashBoost: { name: "광역 증폭", desc: "범위 공격 피해 x2 (범위·공격력과 시너지)", scopes: ["hero", BLUNT] },
  warcry: { name: "전장의 함성", desc: "적을 처치할 때마다 6초간 공격 속도 +8% (최대 5중첩)", scopes: ["hero", CAVALRY, ARCHER, BLUNT] },
};
export const legendScopeName = (scope: LegendScope): string => (scope === "hero" ? "주인공" : UNIT_NAMES[scope]!);

/** 용병 능력치 종류. 배율 계열(hp~area, respawn)은 곱해지고, 나머지는 더해진다. */
export type MercStat = "hp" | "dmg" | "atkSpeed" | "speed" | "range" | "area" | "crit" | "critMult" | "defense" | "dodge" | "regen" | "pierce" | "respawn" | "knock" | "xp";

export type CardEffect =
  | { k: "leadership"; v: number } // 통솔력 +v
  | { k: "priceMult"; v: number } // 고용 가격에 v를 곱한다
  | { k: "goldMult"; v: number } // 금화 획득 +v(비율)
  | { k: "xpMult"; v: number } // 주인공 경험치 획득 +v(비율)
  | { k: "luck"; v: number } // 행운 +v: 높은 등급 카드가 나올 확률이 올라간다
  | { k: "bounty"; v: number } // 스테이지·소대 클리어 금화 +v(비율)
  | { k: "mercStat"; stat: MercStat; v: number; type?: number } // 용병 능력치. type을 생략하면 모든 용병(효과는 작다)
  | { k: "legend"; id: LegendId; scope: LegendScope }
  | { k: "heroRange"; v: number }
  | { k: "heroPierce"; v: number }
  | { k: "heroCrit"; v: number }
  | { k: "heroCritMult"; v: number }
  | { k: "heroArea"; v: number }
  | { k: "heroKnock"; v: number }
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
  pierce: "관통",
  respawn: "부활 시간",
  knock: "넉백",
  xp: "경험치 획득",
};
/** 병종 전용 일반 카드 한 장의 효과량. 전체 용병 카드는 이것의 GLOBAL_CARD_FACTOR배. */
export const MERC_STAT_BASE: Record<MercStat, number> = {
  hp: 0.25, dmg: 0.25, atkSpeed: 0.15, speed: 0.12, range: 0.15, area: 0.2, crit: 0.1, critMult: 0.4, defense: 0.1, dodge: 0.08, regen: 0.004, pierce: 1, respawn: -0.25, knock: 30, xp: 0.3,
};
export const GLOBAL_CARD_FACTOR = 0.2;
/** 병종마다 키울 수 있는 능력치(그 병종의 역할에 맞춘 목록). 공격 속도와 범위는 쓸모가 있는 병종에 모두 있다. */
export const MERC_TYPE_FOCUS: readonly (readonly MercStat[])[] = [
  ["hp", "dmg", "speed", "crit", "dodge", "atkSpeed", "area", "knock", "xp"], // 기병
  ["hp", "dmg", "range", "defense", "atkSpeed", "area", "knock", "xp"], // 창병
  ["dmg", "range", "atkSpeed", "crit", "pierce", "xp"], // 궁병(화살이라 범위는 없다)
  ["hp", "defense", "regen", "dmg", "respawn", "atkSpeed", "area", "knock", "xp"], // 검방병
  ["dmg", "area", "hp", "critMult", "atkSpeed", "knock", "xp"], // 둔기병
];

const round3 = (v: number) => Math.round(v * 1000) / 1000;
/** 등급을 반영한 효과량. 관통은 정수로 1/2/3, 나머지는 등급 배율. */
export const scaledValue = (stat: MercStat | "heroPierce", base: number, rarity: number): number =>
  stat === "pierce" || stat === "heroPierce" ? base * (rarity + 1) : round3(base * RARITY[rarity]!.mult);

/** 능력치 변화량을 사람이 읽는 문구로 */
export function describeStat(stat: MercStat, v: number): string {
  if (stat === "pierce") return `+${v}`;
  if (stat === "knock") return `+${Math.round(v)}`;
  const pct = Math.abs(v) * 100;
  const text = pct >= 10 ? String(Math.round(pct)) : String(Math.round(pct * 10) / 10);
  if (stat === "regen") return `초당 최대 체력 +${text}%`;
  return `${v < 0 ? "-" : "+"}${text}%`;
}

const statCards = (): CardDef[] => {
  const out: CardDef[] = [];
  for (const t of UNIT_TYPES) {
    for (const stat of MERC_TYPE_FOCUS[t]!) {
      const special = stat === "pierce" || stat === "critMult";
      for (let r = 0; r < 3; r++) {
        const v = scaledValue(stat, MERC_STAT_BASE[stat], r);
        out.push({
          name: `${UNIT_NAMES[t]} ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)}`,
          desc: `${UNIT_NAMES[t]}만: ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)}`,
          category: 1,
          rarity: r as 0 | 1 | 2,
          weight: (special ? 4 : 5) * RARITY[r]!.weight,
          stars: r + 1,
          minLevel: Math.max(RARITY[r]!.minLevel, special ? 3 : 1),
          unitType: t,
          effect: { k: "mercStat", stat, v, type: t },
        });
      }
    }
  }
  for (const stat of Object.keys(MERC_STAT_BASE) as MercStat[]) {
    if (stat === "pierce") continue; // 관통은 화살을 쏘는 궁병만
    for (let r = 0; r < 3; r++) {
      const v = round3(scaledValue(stat, MERC_STAT_BASE[stat], r) * GLOBAL_CARD_FACTOR);
      out.push({
        name: `용병 ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)}`,
        desc: `모든 용병의 ${MERC_STAT_LABEL[stat]} ${describeStat(stat, v)} (병종 전용 카드의 ${GLOBAL_CARD_FACTOR * 100}%)`,
        category: 1,
        rarity: r as 0 | 1 | 2,
        weight: 3 * RARITY[r]!.weight,
        stars: r + 1,
        minLevel: RARITY[r]!.minLevel,
        effect: { k: "mercStat", stat, v },
      });
    }
  }
  return out;
};

/** 주인공 능력치 카드(전체 용병이 아니라 주인공에게만 적용) */
const HERO_STATS: { k: Exclude<CardEffect["k"], "mercStat" | "legend" | "leadership" | "priceMult" | "goldMult">; label: string; base: number; weight: number; minLevel?: number; fmt: "pct" | "flat" | "int" | "regen" }[] = [
  { k: "heroMaxHp", label: "최대 체력", base: 25, weight: 8, fmt: "flat" },
  { k: "heroSpeed", label: "이동 속도", base: 0.12, weight: 6, fmt: "pct" },
  { k: "heroDmg", label: "공격력", base: 0.25, weight: 8, fmt: "pct" },
  { k: "heroFireRate", label: "공격 속도", base: 0.15, weight: 6, fmt: "pct" },
  { k: "heroRange", label: "사거리", base: 0.12, weight: 6, fmt: "pct" },
  { k: "heroPierce", label: "관통", base: 1, weight: 4, minLevel: 3, fmt: "int" },
  { k: "heroCrit", label: "치명타 확률", base: 0.08, weight: 6, fmt: "pct" },
  { k: "heroCritMult", label: "치명타 피해", base: 0.3, weight: 4, minLevel: 3, fmt: "pct" },
  { k: "heroArea", label: "범위", base: 0.15, weight: 4, fmt: "pct" },
  { k: "heroKnock", label: "넉백", base: 30, weight: 5, fmt: "flat" },
  { k: "heroDefense", label: "방어력", base: 0.08, weight: 7, fmt: "pct" },
  { k: "heroDodge", label: "회피율", base: 0.06, weight: 5, fmt: "pct" },
  { k: "heroRegen", label: "체력 재생", base: 0.2, weight: 5, fmt: "regen" },
];
const heroCards = (): CardDef[] =>
  HERO_STATS.flatMap((h) =>
    [0, 1, 2].map((r): CardDef => {
      const v = h.k === "heroPierce" ? h.base * (r + 1) : h.fmt === "flat" ? Math.round(h.base * RARITY[r]!.mult) : round3(h.base * RARITY[r]!.mult);
      const text = h.fmt === "pct" ? `+${Math.round(v * 1000) / 10}%` : h.fmt === "regen" ? `초당 +${Math.round(v * 10) / 10}` : `+${v}`;
      return {
        name: `${h.label} ${text}`,
        desc: `주인공만: ${h.label} ${text}`,
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
    const price = round3(1 - 0.15 * m.mult);
    const gold = round3(0.25 * m.mult);
    return [
      { name: `통솔력 +${lead}`, desc: `더 많은 용병을 거느린다 (통솔력 +${lead})`, category: 0, rarity: rr, weight: 40 * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "leadership", v: lead } },
      { name: `고용 비용 -${Math.round((1 - price) * 100)}%`, desc: `캠프 고용 가격이 ${Math.round((1 - price) * 100)}% 내려간다`, category: 0, rarity: rr, weight: 5 * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "priceMult", v: price } },
      { name: `경험치 +${Math.round(15 * m.mult)}%`, desc: `주인공이 얻는 경험치가 ${Math.round(15 * m.mult)}% 늘어난다 (더 빨리 레벨업)`, category: 0, rarity: rr, weight: 6 * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "xpMult", v: round3(0.15 * m.mult) } },
      { name: `행운 +${Math.round(20 * m.mult)}%`, desc: `희귀·영웅·전설 카드가 나올 확률이 올라간다 (행운 +${Math.round(20 * m.mult)}%)`, category: 0, rarity: rr, weight: 4 * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "luck", v: round3(0.2 * m.mult) } },
      { name: `보상금 +${Math.round(30 * m.mult)}%`, desc: `스테이지·소대를 정리했을 때 받는 금화가 ${Math.round(30 * m.mult)}% 늘어난다`, category: 0, rarity: rr, weight: 4 * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "bounty", v: round3(0.3 * m.mult) } },
      { name: `전리품 +${Math.round(gold * 100)}%`, desc: `적을 잡아 얻는 금화가 ${Math.round(gold * 100)}% 늘어난다`, category: 0, rarity: rr, weight: 5 * m.weight, stars: r + 1, minLevel: m.minLevel, effect: { k: "goldMult", v: gold } },
    ];
  });

/** 전설: 드물게 나오고 같은 (능력, 대상) 조합은 한 번만 고를 수 있다 */
const legendCards = (): CardDef[] =>
  (Object.keys(LEGENDS) as LegendId[]).flatMap((id) =>
    LEGENDS[id].scopes.map(
      (scope): CardDef => ({
        name: `[전설] ${legendScopeName(scope)} ${LEGENDS[id].name}`,
        desc: LEGENDS[id].desc, // 대상은 이름에 이미 들어 있다
        category: 3,
        rarity: 3,
        weight: 0.6,
        stars: 3,
        minLevel: 6,
        unique: true,
        unitType: scope === "hero" ? undefined : scope,
        effect: { k: "legend", id, scope },
      }),
    ),
  );

export const CARDS: readonly CardDef[] = [...scaleCards(), ...statCards(), ...legendCards(), ...heroCards()];

export const OFFER_SIZE = 3;
/** 행운 1.0이면 등급별 카드 확률 배율이 (1 + 행운 x 이 값)이 된다(일반 카드는 그대로). 전설 포함. */
export const LUCK_RARITY_BOOST = [0, 3, 6, 8] as const;
export const LUCK_MAX = 3;
export const luckWeight = (rarity: number, luck: number): number => 1 + Math.min(LUCK_MAX, Math.max(0, luck)) * (LUCK_RARITY_BOOST[rarity] ?? 0);
/** 카드를 고를 때마다 얻는 새로고침(제시된 카드 3장을 다시 뽑는다) 수와 보유 상한 */
export const REROLL_START = 1;
export const REROLL_PER_PICK = 1;
export const REROLL_MAX = 5;
