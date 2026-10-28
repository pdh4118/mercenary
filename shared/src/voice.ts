import { CAVALRY, SPEAR, ARCHER, SHIELD, BLUNT, MAGE } from "./rules.js";

/** 음성 지시로 알아들은 명령. 병종(types)은 비트마스크이고, null이면 지금 선택한 병종에 한다. */
export type VoiceCmd =
  | { kind: "stance"; v: number; types: number | null; label: string }
  | { kind: "hold"; at: "hero" | "mouse"; types: number | null; label: string }
  | { kind: "order"; types: number | null; label: string } // 마우스 위치로: 적 근처면 공격, 빈 땅이면 이동(우클릭과 같다)
  | { kind: "merc"; ids: number[]; names: string[]; action: "mark" | "move" | "attack" | "clear" | "stay"; markType?: number; label: string }; // 이름으로 고른 용병 개인에게

/** 이름을 알아듣기 위한 용병 목록(내 용병) */
export interface VoiceMerc {
  id: number;
  name: string; // "붉은 카일"
}

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

/** 말한 문장에서 용병 이름을 찾는다: 수식어까지 말하면 그 용병 한 명, 이름만 말하면 그 이름의 용병 모두. 찾은 이름은 문장에서 지운다. */
function voiceMercs(text: string, roster: readonly VoiceMerc[]): { ids: number[]; names: string[]; rest: string } {
  let rest = text;
  const ids = new Set<number>();
  const names: string[] = [];
  const parts = roster.map((m) => {
    const words = m.name.split(/\s+/);
    return { id: m.id, full: m.name.replace(/\s+/g, ""), given: words[words.length - 1]!, name: m.name };
  });
  for (const p of parts) {
    if (p.full.length >= 2 && rest.includes(p.full)) {
      ids.add(p.id);
      if (!names.includes(p.name)) names.push(p.name);
    }
  }
  for (const p of parts) rest = rest.split(p.full).join("_");
  for (const given of new Set(parts.map((p) => p.given))) {
    if (given.length < 2 || !rest.includes(given)) continue; // 한 글자 이름은 다른 말과 섞이기 쉬워 수식어와 함께 말해야 한다
    for (const p of parts) if (p.given === given) ids.add(p.id);
    names.push(given);
    rest = rest.split(given).join("_");
  }
  return { ids: [...ids], names, rest };
}

/** 정해진 말(병종 이름 + 명령어, 또는 용병 이름 + 명령어)을 명령으로 바꾼다. 못 알아들으면 null. */
export function parseVoice(text: string, roster: readonly VoiceMerc[] = []): VoiceCmd | null {
  const t0 = text.replace(/[\s.,!?]+/g, "");
  if (!t0) return null;
  const named = roster.length > 0 ? voiceMercs(t0, roster) : null;
  if (named && named.ids.length > 0) {
    const r = named.rest;
    const who = named.names.join("·");
    const ids = named.ids;
    const names = named.names;
    if (has(r, "해제", "풀어", "그만", "취소", "복귀", "돌아와", "따라와")) return { kind: "merc", ids, names, action: "clear", label: `${who} 개인 명령 해제` };
    if (has(r, "마크", "견제", "전담", "붙어", "따라붙")) {
      const mask = voiceTypes(r);
      if (mask === null) return null;
      const ty = [0, 1, 2, 3, 4, 5].find((x) => mask & (1 << x))!;
      return { kind: "merc", ids, names, action: "mark", markType: ty, label: `${who} → 적 ${VOICE_TYPE_NAMES[ty]} 마크` };
    }
    if (has(r, "공격", "쳐", "싸워", "죽여")) return { kind: "merc", ids, names, action: "attack", label: `${who} 공격(마우스 위치)` };
    if (has(r, "수비", "지켜", "멈춰", "대기", "제자리")) return { kind: "merc", ids, names, action: "stay", label: `${who} 제자리 대기` };
    if (has(r, "이동", "가라", "가자", "움직", "여기", "저기")) return { kind: "merc", ids, names, action: "move", label: `${who} 이동(마우스 위치)` };
    return null;
  }
  const t = t0;
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
