import type { MercStat } from "./cards.js";
import { mercEpithet } from "./names.js";

/**
 * 용병 성격: 이름 앞의 수식어가 곧 성격이다(포켓몬 성격처럼 장점 하나, 단점 하나).
 * mods는 변화량이다: 배율 능력(체력·공격력·공격 템포·이동 속도·사거리·범위·경험치)은 (1 + 값)배, 나머지(치명타·회피·흡혈 등)는 더하는 값.
 * 고용하기 전에 캠프에서 미리 볼 수 있다.
 */
export interface Personality {
  name: string; // 수식어(이름 앞에 붙는 말)와 같다
  short: string; // 캠프·강화창에 보여 줄 한 줄 요약(장점 · 단점)
  mods: Partial<Record<MercStat, number>>;
  ignore: number; // 우클릭 지시·개인 명령을 무시할 확률(0~PERSONALITY_IGNORE_MAX)
  fearImmune?: boolean; // 사기가 꺾여도 도망치지 않는다
  leash?: number; // 진형에서 벗어나 쫓는 거리 변화(0.5 = 50% 더)
  price?: number; // 고용 가격 변화(-0.2 = 20% 할인)
}

/** 명령을 무시하는 확률의 상한(30%) */
export const PERSONALITY_IGNORE_MAX = 0.3;

export const PERSONALITIES: readonly Personality[] = [
  { name: "고집쎈", short: "공격력 +15% · 지시 25% 무시", mods: { dmg: 0.15 }, ignore: 0.25 },
  { name: "말없는", short: "공포에 안 흔들림 · 경험치 -15%", mods: { xp: -0.15 }, ignore: 0, fearImmune: true },
  { name: "수줍은", short: "회피 +12% · 공격력 -10%", mods: { dodge: 0.12, dmg: -0.1 }, ignore: 0 },
  { name: "용감한", short: "체력 +12% · 공격 템포 -8%", mods: { hp: 0.12, atkSpeed: -0.08 }, ignore: 0 },
  { name: "날쌘", short: "이동 속도 +12% · 체력 -12%", mods: { speed: 0.12, hp: -0.12 }, ignore: 0 },
  { name: "철벽", short: "체력 +15% · 이동 속도 -10%", mods: { hp: 0.15, speed: -0.1 }, ignore: 0 },
  { name: "늙은", short: "경험치 +30% · 이동 속도 -10%", mods: { xp: 0.3, speed: -0.1 }, ignore: 0 },
  { name: "행운의", short: "치명타 +8%p · 체력 -10%", mods: { crit: 0.08, hp: -0.1 }, ignore: 0 },
  { name: "떠돌이", short: "고용비 -20% · 멀리 쫓음 · 무시 10%", mods: {}, ignore: 0.1, leash: 0.5, price: -0.2 },
  { name: "굶주린", short: "입힌 피해의 4% 회복 · 공격 템포 -10%", mods: { lifesteal: 0.04, atkSpeed: -0.1 }, ignore: 0 },
];
const BY_NAME = new Map(PERSONALITIES.map((p) => [p.name, p]));
const NEUTRAL: Personality = { name: "", short: "", mods: {}, ignore: 0 };

/** 이름 번호에서 성격을 얻는다 */
export const personalityOf = (nameId: number): Personality => BY_NAME.get(mercEpithet(nameId)) ?? NEUTRAL;
