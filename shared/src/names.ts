/** 용병 이름: "수식어 + 이름"을 서버가 정해 번호로 보내고, 클라이언트가 문자열로 바꾼다. */
const EPITHETS = ["고집쎈", "말없는", "수줍은", "용감한", "날쌘", "철벽", "늙은", "행운의", "떠돌이", "굶주린"] as const; // 성격(personality.ts)과 같은 순서·이름
const NAMES = [
  "카일", "레온", "마르코", "브란", "에단", "로간", "디아스", "올프", "휴고", "타론",
  "세스", "바론", "라이언", "게일", "조슈", "한스", "빅터", "네로", "오스카", "하겐",
  "리암", "카심", "벤", "도리안", "이반", "마튼", "실비오", "토비", "울리히", "페드로",
  "아르텐", "볼프", "에릭", "자크", "루카", "미로", "발더", "크로우", "다니엘", "렉스",
] as const;

export const MERC_NAME_COUNT = EPITHETS.length * NAMES.length;

export function mercName(id: number): string {
  const i = ((id % MERC_NAME_COUNT) + MERC_NAME_COUNT) % MERC_NAME_COUNT;
  return `${EPITHETS[Math.floor(i / NAMES.length)]!} ${NAMES[i % NAMES.length]!}`;
}

/** 이름 번호에서 수식어 번호와 수식어를 얻는다(혼잣말의 말투를 정하는 데 쓴다) */
export function mercEpithet(id: number): string {
  const i = ((id % MERC_NAME_COUNT) + MERC_NAME_COUNT) % MERC_NAME_COUNT;
  return EPITHETS[Math.floor(i / NAMES.length)]!;
}
/** 이름 번호에서 이름(수식어 뺀 부분) */
export function mercGivenName(id: number): string {
  const i = ((id % MERC_NAME_COUNT) + MERC_NAME_COUNT) % MERC_NAME_COUNT;
  return NAMES[i % NAMES.length]!;
}

/** 같은 성격(수식어)을 가진 이름 중 usedBy가 아닌 것을 고른다(고용 전에 본 성격을 지키면서 이름이 겹치지 않게) */
export function sameEpithetName(nameId: number, used: ReadonlySet<number>): number {
  const i = ((nameId % MERC_NAME_COUNT) + MERC_NAME_COUNT) % MERC_NAME_COUNT;
  const base = Math.floor(i / NAMES.length) * NAMES.length;
  for (let k = 0; k < NAMES.length; k++) {
    const id = base + ((i - base + k) % NAMES.length);
    if (!used.has(id)) return id;
  }
  return i;
}
