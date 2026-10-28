import { CARDS, HERO_STATS, LEGENDS, MERC_STAT_LABEL, describeStat, type CardEffect, type MercStat } from "./cards.js";
import { UNIT_NAMES } from "./rules.js";

/** 표의 열: 영웅, 병종 6개, 모든 용병(공용 카드) */
export const SUMMARY_COLUMNS = ["영웅", ...UNIT_NAMES, "공용 용병"] as const;

export interface SummaryRow {
  label: string;
  cells: string[]; // SUMMARY_COLUMNS와 같은 길이. 비어 있으면 ""
}
export interface CardSummary {
  rows: SummaryRow[]; // 능력치 표
  legends: string[][]; // 열마다 고른 전설 이름
  extras: { label: string; text: string }[]; // 통솔력·고용 비용·경험치·행운·보상금·전리품
  count: number; // 고른 카드 수
}

/** 영웅 카드가 용병 능력치와 같은 줄을 쓰도록 짝을 짓는다(없으면 영웅만의 줄) */
const HERO_ROW: Partial<Record<CardEffect["k"], MercStat>> = {
  heroMaxHp: "hp", heroSpeed: "speed", heroDmg: "dmg", heroFireRate: "atkSpeed", heroRange: "range", heroPierce: "pierce", heroMulti: "multi", heroPoison: "poison",
  heroArmor: "armor", heroCrit: "crit", heroCritMult: "critMult", heroArea: "area", heroKnock: "knock", heroThorns: "thorns", heroDefense: "defense", heroDodge: "dodge",
  heroRegen: "regen", heroLifesteal: "lifesteal", heroCast: "cast",
};
const ROW_ORDER: MercStat[] = ["hp", "dmg", "atkSpeed", "speed", "range", "area", "crit", "critMult", "defense", "dodge", "regen", "lifesteal", "armor", "thorns", "pierce", "multi", "poison", "knock", "cast", "xp", "respawn"];

const pct = (v: number) => {
  const p = Math.abs(v) * 100;
  const t = p >= 10 ? String(Math.round(p)) : String(Math.round(p * 10) / 10);
  return `${v < 0 ? "-" : "+"}${t}%`;
};
/** 영웅 카드 합계를 보기 좋게(영웅 능력치는 카드 표기와 같은 단위) */
function heroText(k: CardEffect["k"], v: number): string {
  const h = HERO_STATS.find((x) => x.k === k);
  if (k === "heroArmor") return `-${v}`;
  if (k === "heroThorns") return `${v}`;
  if (h?.fmt === "flat" || h?.fmt === "int") return `+${Math.round(v * 10) / 10}`;
  if (h?.fmt === "regen") return `초당 +${Math.round(v * 10) / 10}`;
  return pct(v);
}

/** 지금까지 고른 카드(CARDS 번호 목록)를 영웅 · 병종별 표로 묶는다 */
export function summarizePicks(picks: readonly number[]): CardSummary {
  const nCol = SUMMARY_COLUMNS.length;
  // 줄 키 → 열별 합계
  const sums = new Map<string, number[]>();
  const heroOnly = new Map<string, { label: string; k: CardEffect["k"]; v: number }>();
  const legends: string[][] = SUMMARY_COLUMNS.map(() => []);
  let lead = 0;
  let leadPct = 0;
  let price = 1;
  let xp = 0;
  let luck = 0;
  let bounty = 0;
  let gold = 0;
  let count = 0;
  const add = (key: string, col: number, v: number) => {
    let r = sums.get(key);
    if (!r) sums.set(key, (r = new Array(nCol).fill(0)));
    r[col] = r[col]! + v;
  };
  const heroSum = new Map<string, number>(); // 영웅 칸은 영웅 단위로 따로 서식을 쓴다
  for (const i of picks) {
    const c = CARDS[i];
    if (!c) continue;
    count++;
    const e = c.effect;
    if (e.k === "mercStat") add(e.stat, e.type === undefined ? nCol - 1 : e.type + 1, e.v);
    else if (e.k === "legend") (e.scope === "hero" ? legends[0]! : legends[(e.scope as number) + 1]!).push(LEGENDS[e.id].name);
    else if (e.k === "leadership") lead += e.v;
    else if (e.k === "leadershipPct") leadPct += e.v;
    else if (e.k === "priceMult") price *= e.v;
    else if (e.k === "xpMult") xp += e.v;
    else if (e.k === "luck") luck += e.v;
    else if (e.k === "bounty") bounty += e.v;
    else if (e.k === "goldMult") gold += e.v;
    else {
      const row = HERO_ROW[e.k];
      const v = (e as { v: number }).v;
      if (row) {
        add(row, 0, v);
        heroSum.set(row, (heroSum.get(row) ?? 0) + v);
      } else {
        const h = HERO_STATS.find((x) => x.k === e.k);
        const cur = heroOnly.get(e.k);
        heroOnly.set(e.k, { label: h?.label ?? e.k, k: e.k, v: (cur?.v ?? 0) + v });
      }
    }
  }
  const heroKey = new Map<string, CardEffect["k"]>(Object.entries(HERO_ROW).map(([k, v]) => [v as string, k as CardEffect["k"]]));
  const rows: SummaryRow[] = [];
  for (const stat of ROW_ORDER) {
    const r = sums.get(stat);
    if (!r) continue;
    rows.push({
      label: MERC_STAT_LABEL[stat],
      cells: r.map((v, col) => (v === 0 ? "" : col === 0 ? heroText(heroKey.get(stat)!, v) : stat === "poison" ? `${Math.round(v * 100)}%` : describeStat(stat, v))),
    });
  }
  for (const h of heroOnly.values()) rows.push({ label: h.label, cells: ["", ...Array(nCol - 1).fill("")].map((_, col) => (col === 0 ? heroText(h.k, h.v) : "")) });
  const extras: { label: string; text: string }[] = [];
  if (lead > 0 || leadPct > 0) extras.push({ label: "통솔력", text: [lead > 0 ? `+${lead}` : "", leadPct > 0 ? `+${Math.round(leadPct * 100)}%` : ""].filter(Boolean).join(" ") });
  if (price < 1) extras.push({ label: "고용 비용", text: `-${Math.round((1 - price) * 100)}%` });
  if (xp > 0) extras.push({ label: "경험치", text: `+${Math.round(xp * 100)}%` });
  if (gold > 0) extras.push({ label: "전리품", text: `+${Math.round(gold * 100)}%` });
  if (bounty > 0) extras.push({ label: "보상금", text: `+${Math.round(bounty * 100)}%` });
  if (luck > 0) extras.push({ label: "행운", text: `+${Math.round(luck * 100)}%` });
  return { rows, legends, extras, count };
}
