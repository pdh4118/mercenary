import type { MercStat } from "./cards.js";
import { mercEpithet } from "./names.js";

/**
 * 용병 성격: 이름 앞의 수식어가 곧 성격이다(포켓몬 성격처럼 장점 하나, 단점 하나).
 * mods는 변화량이다: 배율 능력(체력·공격력·공격 템포·이동 속도·사거리·범위·경험치)은 (1 + 값)배, 나머지(치명타·회피·흡혈 등)는 더하는 값.
 * 고용하기 전에 캠프에서 미리 볼 수 있다.
 */
/** 주변 상황(서버가 0.4초마다 용병마다 읽는다) */
export interface SitCtx {
  enemies: number; // SIT_RADIUS.enemy 안의 적 수(토너먼트에서는 상대 선수의 유닛 수)
  allies: number; // SIT_RADIUS.ally 안의 같은 주인 다른 용병 수
  hpFrac: number; // 내 체력 비율 0..1
  elite: boolean; // SIT_RADIUS.elite 안에 정예·장군이 있다
  shield: boolean; // SIT_RADIUS.shield 안에 방패를 든 적이 있다
  homeDist: number; // 진형 자리에서 떨어진 거리(px)
}
export const SIT_RADIUS = { enemy: 240, ally: 120, elite: 300, shield: 140 } as const;
export const SIT_STEP = 0.4; // 상황을 읽는 간격(초)
export type SitCond = "outnumbered" | "easy" | "allies" | "alone" | "few" | "many" | "elite" | "grunts" | "home" | "away" | "shield";
/** 조건: 이름(설명용)과 판정 */
export const SIT_COND: Record<SitCond, { name: string; test: (c: SitCtx) => boolean }> = {
  outnumbered: { name: "수가 밀리거나 체력이 절반 아래일 때", test: (c) => c.enemies - c.allies >= 3 || c.hpFrac < 0.5 },
  easy: { name: "적이 1~2명뿐이고 체력이 넉넉할 때", test: (c) => c.enemies >= 1 && c.enemies <= 2 && c.hpFrac > 0.7 },
  allies: { name: "싸우는 중에 아군 용병이 곁(120px 안)에 넷 이상일 때", test: (c) => c.enemies >= 1 && c.allies >= 4 },
  alone: { name: "싸우는 중에 곁에 아군이 하나 이하일 때", test: (c) => c.enemies >= 1 && c.allies <= 1 },
  few: { name: "적이 1~3명일 때", test: (c) => c.enemies >= 1 && c.enemies <= 3 },
  many: { name: "적이 6명 이상일 때", test: (c) => c.enemies >= 6 },
  elite: { name: "정예·장군이 가까이 있을 때", test: (c) => c.elite },
  grunts: { name: "정예 없이 졸개만 4명 이상일 때", test: (c) => !c.elite && c.enemies >= 4 },
  home: { name: "진형 자리 가까이(60px 안)에 있을 때", test: (c) => c.homeDist < 60 },
  away: { name: "진형에서 멀리(130px 밖) 나갔을 때", test: (c) => c.homeDist > 130 },
  shield: { name: "방패를 든 적이 가까이 있을 때", test: (c) => c.shield },
};
/** 상황 효과의 수치: 능력치 변화(MercStat과 같은 규칙) + taken(받는 피해 변화, -0.1 = 10% 덜 받음) */
export type SitMods = Partial<Record<MercStat | "taken", number>>;
export interface SitRule {
  when: SitCond;
  mods: SitMods;
  good: boolean; // 이로운 효과인가(머리 위 표시 색·결과 화면 집계)
  label: string; // 효과가 켜졌을 때 머리 위에 뜨는 말
}

export interface Personality {
  name: string; // 수식어(이름 앞에 붙는 말)와 같다
  short: string; // 캠프·강화창에 보여 줄 한 줄 요약(장점 · 단점)
  mods: Partial<Record<MercStat, number>>;
  ignore: number; // 우클릭 지시·개인 명령을 무시할 확률(0~PERSONALITY_IGNORE_MAX)
  fearImmune?: boolean; // 사기가 꺾여도 도망치지 않는다
  leash?: number; // 진형에서 벗어나 쫓는 거리 변화(0.5 = 50% 더, -0.3 = 30% 덜 쫓고 진형을 지킨다)
  killHaste?: number; // 적을 쓰러뜨리면 KILL_HASTE_SEC초 동안 이동 속도·공격 템포가 이만큼(비율) 오른다
  auraDmg?: number; // 가까이(AURA_RADIUS px 안) 있는 같은 주인의 다른 용병의 공격력이 이만큼(비율) 오른다
  retreatHp?: number; // 체력이 이 비율 아래로 떨어지면 잠시(RETREAT_SEC초) 진형으로 물러난다(너무 자주는 아니고 RETREAT_COOLDOWN초에 한 번)
  price?: number; // 고용 가격 변화(-0.2 = 20% 할인)
  sit?: readonly SitRule[]; // 상황에 따라 켜지는 효과(강해지는 때와 약해지는 때)
}

/** 처치 후 속도 상승 시간(초), 곁의 아군 용병에게 닿는 거리(px) */
export const KILL_HASTE_SEC = 3;
export const AURA_RADIUS = 170;

/** 체력이 낮아 물러나는 시간(초)과 다시 물러나기까지의 간격(초) */
export const RETREAT_SEC = 4;
export const RETREAT_COOLDOWN = 14;

/** 명령을 무시하는 확률의 상한(30%) */
export const PERSONALITY_IGNORE_MAX = 0.3;

const r = (when: SitCond, mods: SitMods, good: boolean, label: string): SitRule => ({ when, mods, good, label });
export const PERSONALITIES: readonly Personality[] = [
  { name: "고집쎈", short: "지시 25% 무시 · 정예·장군 앞에서 공격력 +18% · 졸개만 많으면 공격력 -12%", mods: {}, ignore: 0.25, sit: [r("elite", { dmg: 0.18 }, true, "고집!"), r("grunts", { dmg: -0.12 }, false, "시시해")] },
  { name: "말없는", short: "공포에 안 흔들림 · 경험치 -10% · 정예·장군 앞에서 받는 피해 -12% · 졸개만 많으면 공격 템포 -10%", mods: { xp: -0.1 }, ignore: 0, fearImmune: true, sit: [r("elite", { taken: -0.12, dmg: 0.05 }, true, "침착"), r("grunts", { atkSpeed: -0.1 }, false, "심드렁")] },
  { name: "수줍은", short: "체력 35% 아래면 잠시 물러남 · 아군이 곁에 넷 이상이면 회피 +15%·공격력 +10% · 혼자면 공격력 -10%", mods: {}, ignore: 0, retreatHp: 0.35, sit: [r("allies", { dodge: 0.15, dmg: 0.1 }, true, "든든"), r("alone", { dmg: -0.1, dodge: -0.05 }, false, "위축")] },
  { name: "용감한", short: "체력 +6% · 수가 밀리거나 체력이 절반 아래면 공격력 +25%·받는 피해 -10% · 적이 적고 편하면 공격 템포 -12%", mods: { hp: 0.06 }, ignore: 0, sit: [r("outnumbered", { dmg: 0.25, taken: -0.1 }, true, "사생결단"), r("easy", { atkSpeed: -0.12 }, false, "나태")] },
  { name: "날쌘", short: "이동 속도 +8% · 체력 -6% · 처치하면 3초간 이동·공격 +25% · 적이 1~3명이면 공격 템포 +12% · 6명 이상이면 -10%", mods: { speed: 0.08, hp: -0.06 }, ignore: 0, killHaste: 0.25, sit: [r("few", { atkSpeed: 0.12 }, true, "깔끔"), r("many", { atkSpeed: -0.1 }, false, "정신없음")] },
  { name: "철벽", short: "체력 +8% · 진형을 지킴(덜 쫓음) · 진형 자리 가까이서 받는 피해 -18% · 멀리 끌려 나가면 공격력 -8%·받는 피해 +8%", mods: { hp: 0.08 }, ignore: 0, leash: -0.3, sit: [r("home", { taken: -0.18 }, true, "굳건"), r("away", { dmg: -0.08, taken: 0.08 }, false, "휘청")] },
  { name: "늙은", short: "경험치 +15% · 곁의 아군 용병 공격력 +6% · 아군이 곁에 넷 이상이면 공격력 +12% · 혼자면 -8%", mods: { xp: 0.15 }, ignore: 0, auraDmg: 0.06, sit: [r("allies", { dmg: 0.12 }, true, "노련"), r("alone", { dmg: -0.08 }, false, "고독")] },
  { name: "행운의", short: "체력 -4% · 치명타 +3%p · 적이 6명 이상이면 치명타 +15%p · 1~3명이면 -6%p", mods: { hp: -0.04, crit: 0.03 }, ignore: 0, sit: [r("many", { crit: 0.15 }, true, "신들림"), r("few", { crit: -0.06 }, false, "불운")] },
  { name: "떠돌이", short: "고용비 -20% · 멀리 쫓음 · 무시 10% · 진형에서 멀리 나가면 공격력 +8% · 진형 자리에 있으면 -12%", mods: {}, ignore: 0.1, leash: 0.35, price: -0.2, sit: [r("away", { dmg: 0.08 }, true, "방랑"), r("home", { dmg: -0.12 }, false, "답답")] },
  { name: "굶주린", short: "입힌 피해의 3% 회복 · 공격 템포 -5% · 적이 6명 이상이면 회복 +5% · 방패 든 적 앞에서 공격력 -12%", mods: { lifesteal: 0.03, atkSpeed: -0.05 }, ignore: 0, sit: [r("many", { lifesteal: 0.05 }, true, "허기"), r("shield", { dmg: -0.12 }, false, "단단해")] },
];
const BY_NAME = new Map(PERSONALITIES.map((p) => [p.name, p]));
const NEUTRAL: Personality = { name: "", short: "", mods: {}, ignore: 0 };

/** 이름 번호에서 성격을 얻는다 */
export const personalityOf = (nameId: number): Personality => BY_NAME.get(mercEpithet(nameId)) ?? NEUTRAL;
