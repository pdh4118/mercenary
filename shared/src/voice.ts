import { CAVALRY, SPEAR, ARCHER, SHIELD, BLUNT, MAGE } from "./rules.js";

/** 음성 지시로 알아들은 명령. 병종(types)은 비트마스크이고, null이면 지금 선택한 병종에 한다. */
export type VoiceCmd =
  | { kind: "stance"; v: number; types: number | null; label: string }
  | { kind: "hold"; at: "hero" | "mouse"; types: number | null; label: string }
  | { kind: "order"; types: number | null; label: string }; // 마우스 위치로: 적 근처면 공격, 빈 땅이면 이동(우클릭과 같다)

const TYPE_WORDS: [number, string[]][] = [
  [CAVALRY, ["기병", "기마", "말탄"]],
  [SPEAR, ["창병", "창"]],
  [ARCHER, ["궁병", "궁수", "활", "아처"]],
  [SHIELD, ["검방병", "방패병", "방패", "검병", "검"]],
  [BLUNT, ["둔기병", "철퇴", "망치", "둔기"]],
  [MAGE, ["마법사", "법사", "마법", "메이지"]],
];
const ALL_WORDS = ["전체", "전원", "모두", "다들", "전부"];
export const VOICE_TYPE_NAMES = ["기병", "창병", "궁병", "검방병", "둔기병", "마법사"];

/** 말한 문장에서 병종을 찾는다. 병종을 말하지 않았으면 null(선택한 병종), "전원"이면 모든 병종 */
export function voiceTypes(text: string): number | null {
  const t = text.replace(/\s+/g, "");
  if (ALL_WORDS.some((w) => t.includes(w))) return (1 << 6) - 1;
  let mask = 0;
  // 긴 단어부터 맞춰 "둔기병"의 "기병"이나 "검방병"의 "방병" 같은 겹침을 피한다
  let rest = t;
  const words = TYPE_WORDS.flatMap(([ty, ws]) => ws.map((w) => [ty, w] as const)).sort((a, b) => b[1].length - a[1].length);
  for (const [ty, w] of words) {
    if (rest.includes(w)) {
      mask |= 1 << ty;
      rest = rest.split(w).join("_");
    }
  }
  return mask === 0 ? null : mask;
}

const has = (t: string, ...ws: string[]) => ws.some((w) => t.includes(w));

/** 정해진 말(병종 이름 + 명령어)을 명령으로 바꾼다. 못 알아들으면 null. */
export function parseVoice(text: string): VoiceCmd | null {
  const t = text.replace(/[\s.,!?]+/g, "");
  if (!t) return null;
  const types = voiceTypes(t);
  const mouse = has(t, "여기", "저기", "거기", "마우스", "이쪽", "저쪽");
  if (has(t, "돌격", "돌진", "밀어", "쳐들어")) return { kind: "stance", v: 1, types, label: "돌격 진형" };
  if (has(t, "산개", "흩어", "분산", "퍼져")) return { kind: "stance", v: 4, types, label: "산개 진형" };
  if (has(t, "수비", "지켜", "지키", "방어", "사수")) return mouse ? { kind: "hold", at: "mouse", types, label: "그 지점 수비" } : { kind: "hold", at: "hero", types, label: "수비(제자리)" };
  if (has(t, "호위", "엄호", "보호", "후퇴", "물러", "뒤로")) return { kind: "stance", v: 3, types, label: "호위 진형" };
  if (has(t, "기본", "집결", "모여", "모이", "복귀", "돌아와", "따라와", "대형")) return { kind: "stance", v: 0, types, label: "기본 진형" };
  if (has(t, "공격", "쳐", "싸워", "죽여", "처치", "때려", "섬멸")) return { kind: "order", types, label: "공격 지시(마우스 위치)" };
  if (has(t, "이동", "가라", "가자", "움직", "진격")) return { kind: "order", types, label: "이동 지시(마우스 위치)" };
  return null;
}
