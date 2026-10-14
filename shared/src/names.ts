/** 용병 이름: "수식어 + 이름"을 서버가 정해 번호로 보내고, 클라이언트가 문자열로 바꾼다. */
const EPITHETS = ["붉은", "날쌘", "외눈", "철벽", "말없는", "늙은", "젊은", "검은", "웃는", "고집쎈", "떠돌이", "절름발이", "푸른", "굶주린", "행운의", "불꽃", "회색", "거만한", "수줍은", "용감한"] as const;
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
