import { CAVALRY, SPEAR, ARCHER, SHIELD, BLUNT, MAGE } from "./rules.js";

/** 음성 지시로 알아들은 명령. 병종(types)은 비트마스크이고, null이면 지금 선택한 병종에 한다. */
export type VoiceCmd =
  | { kind: "stance"; v: number; types: number | null; label: string }
  | { kind: "hold"; at: "hero" | "mouse"; types: number | null; label: string }
  | { kind: "order"; types: number | null; label: string } // 지정한 위치(없으면 마우스 위치)로: 적 근처면 공격, 빈 땅이면 이동
  | { kind: "merc"; ids: number[]; names: string[]; action: "mark" | "move" | "attack" | "clear" | "stay"; markType?: number; label: string }; // 번호·이름으로 고른 용병 개인에게

/** 이름·번호를 알아듣기 위한 용병 목록(내 용병) */
export interface VoiceMerc {
  id: number;
  name: string; // "붉은 카일"
  num?: number; // 머리 위에 표시되는 번호(3번)
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

// --- 한글 소리 비교 ------------------------------------------------------------

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
/** 소리가 거의 같은 모음·받침은 같은 것으로 본다(인식기가 자주 헷갈리는 쌍) */
const VOWEL_FOLD: Record<string, string> = { ㅐ: "ㅔ", ㅒ: "ㅖ", ㅙ: "ㅞ", ㅚ: "ㅞ", ㅟ: "ㅣ" };
const FINAL_FOLD: Record<string, string> = { ㄲ: "ㄱ", ㅋ: "ㄱ", ㄳ: "ㄱ", ㅅ: "ㄷ", ㅆ: "ㄷ", ㅈ: "ㄷ", ㅊ: "ㄷ", ㅌ: "ㄷ", ㅎ: "ㄷ", ㅍ: "ㅂ" };

/** 한글 음절을 초성·중성·종성으로 쪼갠다(비슷한 소리는 합쳐서) */
export function toJamo(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) {
      const n = c - 0xac00;
      const cho = CHO[Math.floor(n / 588)]!;
      const jung = JUNG[Math.floor((n % 588) / 28)]!;
      const jong = JONG[n % 28]!;
      out += cho + (VOWEL_FOLD[jung] ?? jung) + (jong ? FINAL_FOLD[jong] ?? jong : "");
    } else out += ch;
  }
  return out;
}

function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n]!;
}

/** 허용하는 소리 차이(자모 수): 짧은 말은 정확히, 긴 말은 조금 틀려도 받아 준다 */
const allow = (jl: number) => (jl <= 4 ? 0 : jl <= 7 ? 1 : 2);

/** 문장 안에 w가 있는가(fuzzy면 소리가 비슷한 부분도). 있으면 가장 가까운 거리를, 없으면 Infinity */
function dist(t: string, w: string, fuzzy: boolean): number {
  if (t.includes(w)) return 0;
  if (!fuzzy) return Infinity;
  const jw = toJamo(w);
  const a = allow(jw.length);
  if (a === 0) return Infinity;
  let best = Infinity;
  for (let len = Math.max(1, w.length - 1); len <= w.length + 1; len++) {
    for (let i = 0; i + len <= t.length; i++) {
      const d = lev(toJamo(t.slice(i, i + len)), jw);
      if (d < best) best = d;
    }
  }
  return best <= a ? best : Infinity;
}

const has = (t: string, fuzzy: boolean, ...ws: string[]) => ws.some((w) => dist(t, w, fuzzy) !== Infinity);
const closest = <T,>(t: string, fuzzy: boolean, items: readonly (readonly [T, string])[]): T | null => {
  let best: T | null = null;
  let bd = Infinity;
  for (const [v, w] of items) {
    const d = dist(t, w, fuzzy);
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
};

/** 인식기가 자주 잘못 알아듣는 말을 바로잡는다(발견되는 대로 늘린다) */
const ALIASES: [RegExp, string][] = [
  [/귀병|기뱅|기빙|기병해|기병이/g, "기병"],
  [/공병|궁뱅|궁빙|궁병이/g, "궁병"],
  [/참병|창뱅|창빙|창병이/g, "창병"],
  [/검방뱅|검방빙|검방병이/g, "검방병"],
  [/둔기뱅|둔기빙|둔기병이/g, "둔기병"],
  [/마법싸|마법사가/g, "마법사"],
  [/돌겨|돌적|돌객|돌격해/g, "돌격"],
  [/수빈|수빙|수비해/g, "수비"],
  [/산게|상개|산개해/g, "산개"],
  [/공걱|공겨|공격해/g, "공격"],
  [/마커|마크해(?!제)/g, "마크"],
  [/이둥|이동해/g, "이동"],
];

// --- 번호 ----------------------------------------------------------------------

const SINO: Record<string, number> = { 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 };
const NATIVE_UNITS: Record<string, number> = { 한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9 };
const NATIVE_TENS: Record<string, number> = { 열: 10, 스물: 20, 스무: 20, 서른: 30, 마흔: 40 };

/** "삼", "십이", "이십삼", "열두", "스물셋" 같은 우리말 숫자를 수로 바꾼다. 못 바꾸면 null */
export function koNumber(s: string): number | null {
  if (/^[0-9]+$/.test(s)) return Number(s);
  if (s in SINO) return SINO[s]!;
  const sino = /^([일이삼사오육칠팔구])?십([일이삼사오육칠팔구])?$/.exec(s);
  if (sino) return (sino[1] ? SINO[sino[1]]! : 1) * 10 + (sino[2] ? SINO[sino[2]]! : 0);
  const sino2 = /^([일이삼사오육칠팔구])십([일이삼사오육칠팔구])?$/.exec(s);
  if (sino2) return SINO[sino2[1]!]! * 10 + (sino2[2] ? SINO[sino2[2]]! : 0);
  if (s in NATIVE_UNITS) return NATIVE_UNITS[s]!;
  for (const [ten, v] of Object.entries(NATIVE_TENS)) {
    if (s === ten) return v;
    if (s.startsWith(ten) && s.slice(ten.length) in NATIVE_UNITS) return v + NATIVE_UNITS[s.slice(ten.length)]!;
  }
  return null;
}

/** 문장 속 "3번", "삼번", "세번", "이십삼번"을 번호로 뽑아 내고 문장에서 지운다 */
export function extractNumbers(text: string): { nums: number[]; rest: string } {
  const nums: number[] = [];
  const rest = text.replace(/([0-9]+|[일이삼사오육칠팔구십]+|스물[한두세네]?[하나둘셋넷다섯여섯일곱여덟아홉]*|서른[한두세네]?[하나둘셋넷다섯여섯일곱여덟아홉]*|열[한두세네]?[하나둘셋넷다섯여섯일곱여덟아홉]*|하나|한|두|둘|세|셋|네|넷|다섯|여섯|일곱|여덟|아홉)\s*번/g, (all, w: string) => {
    const n = koNumber(w);
    if (n === null || n < 1 || n > 99) return all;
    nums.push(n);
    return "_";
  });
  return { nums, rest };
}

/** 말한 문장에서 병종을 찾는다. 병종을 말하지 않았으면 null(선택한 병종), "전원"이면 모든 병종 */
export function voiceTypes(text: string, fuzzy = false): number | null {
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
  if (mask === 0 && fuzzy) {
    // 정확히 맞는 병종이 없으면 소리가 가장 비슷한 병종 하나를 고른다
    const ty = closest(t, true, TYPE_WORDS.flatMap(([ty, ws]) => ws.filter((w) => w.length >= 2).map((w) => [ty, w] as const)));
    if (ty !== null) mask = 1 << ty;
  }
  return mask === 0 ? null : mask;
}

/** 말한 문장에서 용병(번호·이름)을 찾는다. 찾은 것은 문장에서 지운다. */
function voiceMercs(text: string, roster: readonly VoiceMerc[]): { ids: number[]; names: string[]; rest: string; unknownNum: boolean } {
  const ids = new Set<number>();
  const names: string[] = [];
  // 번호: "3번"
  const { nums, rest: afterNums } = extractNumbers(text);
  let rest = afterNums;
  let unknownNum = false;
  for (const n of nums) {
    const m = roster.find((x) => x.num === n);
    if (m) {
      ids.add(m.id);
      names.push(`${n}번`);
    } else unknownNum = true;
  }
  // 이름: 수식어까지 말하면 그 용병 한 명, 이름만 말하면 그 이름의 용병 모두
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
  return { ids: [...ids], names, rest, unknownNum };
}

/**
 * 정해진 말(병종 이름 + 명령어, 또는 용병 번호·이름 + 명령어)을 명령으로 바꾼다. 못 알아들으면 null.
 * fuzzy가 켜지면 소리가 비슷한 말(귀병→기병 등)도 받아 준다.
 */
export function parseVoice(text: string, roster: readonly VoiceMerc[] = [], fuzzy = false): VoiceCmd | null {
  let t0 = text.replace(/[\s.,!?]+/g, "");
  for (const [re, to] of ALIASES) t0 = t0.replace(re, to);
  if (!t0) return null;
  const named = roster.length > 0 || /번/.test(t0) ? voiceMercs(t0, roster) : null;
  if (named && named.unknownNum && named.ids.length === 0) return null; // 없는 번호를 불렀다: 엉뚱한 병종 명령으로 해석하지 않는다
  if (named && named.ids.length > 0) {
    const r = named.rest;
    const who = named.names.join("·");
    const ids = named.ids;
    const names = named.names;
    if (has(r, fuzzy, "해제", "풀어", "그만", "취소", "복귀", "돌아와", "따라와")) return { kind: "merc", ids, names, action: "clear", label: `${who} 개인 명령 해제` };
    if (has(r, fuzzy, "마크", "견제", "전담", "붙어", "따라붙")) {
      const mask = voiceTypes(r, fuzzy);
      if (mask === null) return null;
      const ty = [0, 1, 2, 3, 4, 5].find((x) => mask & (1 << x))!;
      return { kind: "merc", ids, names, action: "mark", markType: ty, label: `${who} → 적 ${VOICE_TYPE_NAMES[ty]} 마크` };
    }
    if (has(r, fuzzy, "공격", "쳐", "싸워", "죽여")) return { kind: "merc", ids, names, action: "attack", label: `${who} 공격(지정 위치)` };
    if (has(r, fuzzy, "수비", "지켜", "멈춰", "대기", "제자리")) return { kind: "merc", ids, names, action: "stay", label: `${who} 제자리 대기` };
    if (has(r, fuzzy, "이동", "가라", "가자", "움직", "여기", "저기")) return { kind: "merc", ids, names, action: "move", label: `${who} 이동(지정 위치)` };
    return null;
  }
  const t = t0;
  const types = voiceTypes(t, fuzzy);
  const mouse = has(t, fuzzy, "여기", "저기", "거기", "마우스", "이쪽", "저쪽");
  if (has(t, fuzzy, "돌격", "돌진", "밀어", "쳐들어")) return { kind: "stance", v: 1, types, label: "돌격 진형" };
  if (has(t, fuzzy, "산개", "흩어", "분산", "퍼져")) return { kind: "stance", v: 4, types, label: "산개 진형" };
  if (has(t, fuzzy, "수비", "지켜", "지키", "방어", "사수")) return mouse ? { kind: "hold", at: "mouse", types, label: "그 지점 수비" } : { kind: "hold", at: "hero", types, label: "수비(제자리)" };
  if (has(t, fuzzy, "호위", "엄호", "보호", "후퇴", "물러", "뒤로")) return { kind: "stance", v: 3, types, label: "호위 진형" };
  if (has(t, fuzzy, "기본", "집결", "모여", "모이", "복귀", "돌아와", "따라와", "대형")) return { kind: "stance", v: 0, types, label: "기본 진형" };
  if (has(t, fuzzy, "공격", "쳐", "싸워", "죽여", "처치", "때려", "섬멸")) return { kind: "order", types, label: "공격 지시(지정 위치)" };
  if (has(t, fuzzy, "이동", "가라", "가자", "움직", "진격")) return { kind: "order", types, label: "이동 지시(지정 위치)" };
  return null;
}

/**
 * 인식기가 준 여러 후보 문장 중 명령으로 해석되는 것을 고른다. 먼저 정확히 맞는 후보(앞 순서 우선)를 찾고,
 * 없으면 소리가 비슷한 말까지 받아 주는 해석으로 다시 찾는다.
 */
export function parseVoiceBest(alts: readonly string[], roster: readonly VoiceMerc[] = []): { cmd: VoiceCmd; text: string; fuzzy: boolean } | null {
  for (const fuzzy of [false, true]) {
    for (const text of alts) {
      const cmd = parseVoice(text, roster, fuzzy);
      if (cmd) return { cmd, text, fuzzy };
    }
  }
  return null;
}
