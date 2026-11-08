import { CAVALRY, SPEAR, ARCHER, SHIELD, BLUNT, MAGE } from "./rules.js";

/** 음성 지시로 알아들은 명령. 병종(types)은 비트마스크이고, null이면 지금 선택한 병종에 한다. */
export type VoiceCmd =
  | { kind: "stance"; v: number; types: number | null; label: string }
  | { kind: "hold"; at: "hero" | "mouse"; types: number | null; label: string }
  | { kind: "cav"; mode: "sweep" | "rear"; label: string } // 기병 전술: 진형 파괴(옆구리 휩쓸기) / 후방 공격
  | { kind: "order"; types: number | null; label: string } // 지정한 위치(없으면 마우스 위치)로: 적 근처면 공격, 빈 땅이면 이동
  | { kind: "merc"; ids: number[]; names: string[]; action: "mark" | "move" | "attack" | "clear" | "stay"; markType?: number; label: string }; // 번호·이름으로 고른 용병 개인에게

/** 이름·번호를 알아듣기 위한 용병 목록(내 용병) */
export interface VoiceMerc {
  id: number;
  name: string; // "붉은 카일"
  num?: number; // 머리 위에 표시되는 번호(3번)
}

// --- 음성 단어 표(수치 조정 화면의 "음성 명령" 탭에서 고친다) --------------------------------------

export interface VoiceGroupDef {
  key: string;
  tab: string; // 화면에서 묶는 이름
  label: string;
  hint: string;
  words: readonly string[]; // 기본 단어
}

/** 단어 묶음. 같은 단어가 여러 묶음에 있으면 아래 설명의 순서대로 먼저 맞는 묶음이 이긴다. */
export const VOICE_GROUPS: readonly VoiceGroupDef[] = [
  { key: "type0", tab: "병종 이름", label: "기병", hint: "기병을 부르는 말", words: ["기병", "기마", "말탄", "기마병", "기병대", "기마대", "카발리"] },
  { key: "type1", tab: "병종 이름", label: "창병", hint: "창병을 부르는 말", words: ["창병", "창", "창잡이", "장창", "창병대", "랜서"] },
  { key: "type2", tab: "병종 이름", label: "궁병", hint: "궁병을 부르는 말", words: ["궁병", "궁수", "활", "아처", "아쳐", "활잡이", "활병", "궁병대", "궁수대"] },
  { key: "type3", tab: "병종 이름", label: "검방병", hint: "검방병을 부르는 말", words: ["검방병", "방패병", "방패", "검병", "검", "검방", "검사", "소드"] },
  { key: "type4", tab: "병종 이름", label: "둔기병", hint: "둔기병을 부르는 말", words: ["둔기병", "철퇴", "망치", "둔기", "둔기대", "해머", "곤봉", "철퇴병", "망치병"] },
  { key: "type5", tab: "병종 이름", label: "마법사", hint: "마법사를 부르는 말", words: ["마법사", "법사", "마법", "메이지", "마도사", "마술사", "위자드", "마법병"] },
  { key: "all", tab: "병종 이름", label: "전체", hint: "모든 병종에게 한 번에 지시하는 말", words: ["전체", "전원", "모두", "다들", "전부", "모든", "다같이", "너희", "여러분"] },
  { key: "cav_sweep", tab: "기병 전술", label: "진형 파괴", hint: "기병이 적 진형의 옆구리를 쓸고 지나가며 충돌 피해를 주는 말(병종을 말하지 않아도 기병이 움직인다)", words: ["진형파괴", "진형깨", "진형무너", "진형부수", "진형부숴", "진형뚫", "대열파괴", "대열깨", "대열무너", "옆구리", "측면돌파", "휩쓸", "쓸어버", "쓸고지나", "스윕"] },
  { key: "cav_rear", tab: "기병 전술", label: "후방 공격", hint: "기병이 적 진형을 돌아 뒤로 파고들어 등 뒤를 치는 말", words: ["후방공격", "후면공격", "배후공격", "후방돌파", "후방기습", "후방으로", "배후", "뒤를치", "뒤를쳐", "뒤를때려", "뒤를공격", "뒤를파고", "뒤로돌아가", "우회공격", "뒤쪽으로"] },
  { key: "charge", tab: "진형 명령", label: "돌격 진형", hint: "돌격 진형으로 바꾸는 말(수비·산개보다 먼저 확인)", words: ["돌격", "돌진", "돌파", "밀어", "쳐들어", "몰아붙", "들이쳐", "러시", "총공격"] },
  { key: "spread", tab: "진형 명령", label: "산개 진형", hint: "산개 진형으로 바꾸는 말", words: ["산개", "흩어", "분산", "퍼져", "퍼지", "벌려", "넓게"] },
  { key: "hold", tab: "진형 명령", label: "수비(지점 방어)", hint: "그 자리·지정한 지점을 지키는 말", words: ["수비", "지켜", "지키", "방어", "사수", "버텨", "막아", "고수", "홀드"] },
  { key: "guard", tab: "진형 명령", label: "호위 진형", hint: "주인공 곁으로 물러나 지키는 말", words: ["호위", "엄호", "보호", "후퇴", "물러", "뒤로", "철수", "퇴각"] },
  { key: "base", tab: "진형 명령", label: "기본 진형", hint: "기본 진형으로 모이는 말", words: ["기본", "집결", "모여", "모이", "복귀", "돌아와", "따라와", "따라오", "대형", "정렬", "집합", "뭉쳐", "원위치"] },
  { key: "attack", tab: "행동 명령", label: "공격", hint: "지정한 위치의 적을 공격하라는 말", words: ["공격", "쳐", "싸워", "죽여", "처치", "때려", "섬멸", "공략", "타격", "사냥", "해치워", "없애", "제거", "박살", "무찔러", "격파", "쏴"] },
  { key: "move", tab: "행동 명령", label: "이동", hint: "지정한 위치로 가라는 말", words: ["이동", "가라", "가자", "움직", "진격", "전진", "출발", "가서", "건너가", "가봐"] },
  { key: "mouse", tab: "행동 명령", label: "위치(마우스)", hint: "수비 등에서 '마우스 위치'를 가리키는 말", words: ["여기", "저기", "거기", "마우스", "이쪽", "저쪽", "커서", "이곳", "저곳", "그곳", "이리", "저리"] },
  { key: "m_clear", tab: "용병 개인 명령(번호·이름)", label: "해제", hint: "개인 명령을 풀고 부대로 돌아오라는 말", words: ["해제", "풀어", "그만", "취소", "복귀", "돌아와", "따라와", "자유", "원래대로"] },
  { key: "m_mark", tab: "용병 개인 명령(번호·이름)", label: "마크", hint: "특정 병종 적을 전담해 막으라는 말(뒤에 적 병종을 말한다)", words: ["마크", "견제", "전담", "붙어", "따라붙", "맡아", "상대해"] },
  { key: "m_attack", tab: "용병 개인 명령(번호·이름)", label: "개인 공격", hint: "그 용병만 지정 위치를 공격하라는 말", words: ["공격", "쳐", "싸워", "죽여", "처치", "때려"] },
  { key: "m_stay", tab: "용병 개인 명령(번호·이름)", label: "제자리 대기", hint: "그 용병만 제자리를 지키라는 말", words: ["수비", "지켜", "멈춰", "대기", "제자리", "가만", "정지", "스톱", "서있어"] },
  { key: "m_move", tab: "용병 개인 명령(번호·이름)", label: "개인 이동", hint: "그 용병만 지정 위치로 가라는 말", words: ["이동", "가라", "가자", "움직", "여기", "저기", "가서", "출발", "전진"] },
  { key: "link", tab: "이어 말하기", label: "연결 말", hint: "한 문장에 명령 여러 개를 이어 말할 때 명령 사이를 나누는 말(쉼표·마침표로 끊어 말해도 나뉜다). 앞 명령의 병종은 뒤 명령이 병종을 말하지 않으면 이어받는다", words: ["하고", "그리고", "그다음", "그러고", "그런다음", "한뒤", "한후", "다음에", "이어서", "그뒤에", "그후에", "하면서", "한다음"] },
  { key: "alias", tab: "잘못 알아듣는 말 바로잡기", label: "별칭", hint: "'들린말=맞는말' 형태. 음성 인식기가 자주 틀리게 적는 말을 바로잡는다(예: 귀병=기병)", words: ["귀병=기병", "기뱅=기병", "기빙=기병", "공병=궁병", "궁뱅=궁병", "궁빙=궁병", "참병=창병", "창뱅=창병", "창빙=창병", "검방뱅=검방병", "검방빙=검방병", "둔기뱅=둔기병", "둔기빙=둔기병", "마법싸=마법사", "돌겨=돌격", "돌적=돌격", "돌객=돌격", "수빈=수비", "수빙=수비", "산게=산개", "상개=산개", "공걱=공격", "공겨=공격", "마커=마크", "이둥=이동"] },
];

const GROUP_DEFAULTS = new Map<string, readonly string[]>(VOICE_GROUPS.map((g) => [g.key, g.words]));
let wordNow = new Map<string, string[]>(VOICE_GROUPS.map((g) => [g.key, [...g.words]]));
const MAX_WORDS = 80;
const MAX_WORD_LEN = 14;

/** 지금 쓰는 단어들 */
export const voiceWords = (key: string): readonly string[] => wordNow.get(key) ?? [];

const cleanWord = (w: unknown, alias: boolean): string | null => {
  if (typeof w !== "string") return null;
  let t = w.replace(/\s+/g, "");
  if (alias) {
    t = t.replace(/[＝﹦]|->|=>|→|⇒|＞|>|[:：]/g, "="); // 전각 등호·화살표·콜론도 '='로 본다
    const [a, b, ...rest] = t.split("=");
    if (!a || !b || rest.length) return null;
    t = `${a}=${b}`;
  } else t = t.replace(/[=,]/g, "");
  return t.length >= 1 && t.length <= MAX_WORD_LEN + (alias ? MAX_WORD_LEN : 0) ? t : null;
};

/** 고친 단어들을 적용한다(모르는 묶음·이상한 값은 무시). replace면 먼저 모두 기본 단어로 되돌린다. 바뀐 묶음 수를 돌려준다. */
export function applyVoiceWords(values: unknown, replace = false): number {
  if (replace) wordNow = new Map(VOICE_GROUPS.map((g) => [g.key, [...g.words]]));
  if (!values || typeof values !== "object") return 0;
  let n = 0;
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    if (!GROUP_DEFAULTS.has(k) || !Array.isArray(v)) continue;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of v) {
      const c = cleanWord(w, k === "alias");
      if (c && !seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
      if (out.length >= MAX_WORDS) break;
    }
    wordNow.set(k, out);
    n++;
  }
  return n;
}

/** 기본과 다른 묶음만(저장·전송용) */
export function voiceOverrides(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, def] of GROUP_DEFAULTS) {
    const cur = wordNow.get(k)!;
    if (cur.length !== def.length || cur.some((w, i) => w !== def[i])) out[k] = [...cur];
  }
  return out;
}

/** 지금 단어 전부(화면용) */
export const voiceAll = (): Record<string, string[]> => Object.fromEntries([...wordNow].map(([k, v]) => [k, [...v]]));

const typeWords = (): [number, string[]][] => [CAVALRY, SPEAR, ARCHER, SHIELD, BLUNT, MAGE].map((ty, i) => [ty, [...voiceWords(`type${i}`)]] as [number, string[]]);
const allWords = (): readonly string[] => voiceWords("all");
const aliasPairs = (): [string, string][] => voiceWords("alias").map((w) => w.split("=") as [string, string]);
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
  if (allWords().some((w) => t.includes(w))) return (1 << 6) - 1;
  let mask = 0;
  // 긴 단어부터 맞춰 "둔기병"의 "기병"이나 "검방병"의 "방병" 같은 겹침을 피한다
  let rest = t;
  const words = typeWords().flatMap(([ty, ws]) => ws.map((w) => [ty, w] as const)).sort((a, b) => b[1].length - a[1].length);
  for (const [ty, w] of words) {
    if (rest.includes(w)) {
      mask |= 1 << ty;
      rest = rest.split(w).join("_");
    }
  }
  if (mask === 0 && fuzzy) {
    // 정확히 맞는 병종이 없으면 소리가 가장 비슷한 병종 하나를 고른다
    const ty = closest(t, true, typeWords().flatMap(([ty, ws]) => ws.filter((w) => w.length >= 2).map((w) => [ty, w] as const)));
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
  for (const [from, to] of aliasPairs()) if (from && t0.includes(from)) t0 = t0.split(from).join(to);
  if (!t0) return null;
  const named = roster.length > 0 || /번/.test(t0) ? voiceMercs(t0, roster) : null;
  if (named && named.unknownNum && named.ids.length === 0) return null; // 없는 번호를 불렀다: 엉뚱한 병종 명령으로 해석하지 않는다
  if (named && named.ids.length > 0) {
    const r = named.rest;
    const who = named.names.join("·");
    const ids = named.ids;
    const names = named.names;
    if (has(r, fuzzy, ...voiceWords("m_clear"))) return { kind: "merc", ids, names, action: "clear", label: `${who} 개인 명령 해제` };
    if (has(r, fuzzy, ...voiceWords("m_mark"))) {
      const mask = voiceTypes(r, fuzzy);
      if (mask === null) return null;
      const ty = [0, 1, 2, 3, 4, 5].find((x) => mask & (1 << x))!;
      return { kind: "merc", ids, names, action: "mark", markType: ty, label: `${who} → 적 ${VOICE_TYPE_NAMES[ty]} 마크` };
    }
    if (has(r, fuzzy, ...voiceWords("m_attack"))) return { kind: "merc", ids, names, action: "attack", label: `${who} 공격(지정 위치)` };
    if (has(r, fuzzy, ...voiceWords("m_stay"))) return { kind: "merc", ids, names, action: "stay", label: `${who} 제자리 대기` };
    if (has(r, fuzzy, ...voiceWords("m_move"))) return { kind: "merc", ids, names, action: "move", label: `${who} 이동(지정 위치)` };
    return null;
  }
  const t = t0;
  const types = voiceTypes(t, fuzzy);
  if (has(t, fuzzy, ...voiceWords("cav_sweep"))) return { kind: "cav", mode: "sweep", label: "기병 진형 파괴(옆구리 휩쓸기)" };
  if (has(t, fuzzy, ...voiceWords("cav_rear"))) return { kind: "cav", mode: "rear", label: "기병 후방 공격(진형 뒤로 돌아 들어가기)" };
  const mouse = has(t, fuzzy, ...voiceWords("mouse"));
  if (has(t, fuzzy, ...voiceWords("charge"))) return { kind: "stance", v: 1, types, label: "돌격 진형" };
  if (has(t, fuzzy, ...voiceWords("spread"))) return { kind: "stance", v: 4, types, label: "산개 진형" };
  if (has(t, fuzzy, ...voiceWords("hold"))) return mouse ? { kind: "hold", at: "mouse", types, label: "그 지점 수비" } : { kind: "hold", at: "hero", types, label: "수비(제자리)" };
  if (has(t, fuzzy, ...voiceWords("guard"))) return { kind: "stance", v: 3, types, label: "호위 진형" };
  if (has(t, fuzzy, ...voiceWords("base"))) return { kind: "stance", v: 0, types, label: "기본 진형" };
  if (has(t, fuzzy, ...voiceWords("attack"))) return { kind: "order", types, label: "공격 지시(지정 위치)" };
  if (has(t, fuzzy, ...voiceWords("move"))) return { kind: "order", types, label: "이동 지시(지정 위치)" };
  return null;
}

/** 한 번에 실행하는 이어 말하기 명령 수의 한계(인식 실수로 문장이 엉뚱하게 길어져도 폭주하지 않게) */
export const VOICE_MAX_CHAIN = 5;

/** 문장을 연결 말·쉼표·마침표에서 조각으로 나눈다(조각이 하나면 이어 말한 것이 아니다) */
export function splitVoice(text: string): string[] {
  const t = text.replace(/[.,;!?]+/g, "|").replace(/\s+/g, "");
  const links = [...voiceWords("link")].filter((w) => w).sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(["\\|", ...links].join("|"), "g");
  return t.split(re).filter((x) => x.length > 0);
}

export interface VoiceStep {
  cmd: VoiceCmd;
  text: string; // 이 명령이 된 조각
  fuzzy: boolean;
}

/**
 * 이어 말한 문장을 순서대로 여러 명령으로 해석한다(연결 말이 없으면 명령 하나). 조각마다 해석하고, 병종을 말하지 않은 조각은
 * 앞 명령의 병종을 이어받는다. 못 알아들은 조각은 건너뛰고(skipped), 하나도 못 알아들으면 null.
 */
export function parseVoiceMulti(alts: readonly string[], roster: readonly VoiceMerc[] = []): { steps: VoiceStep[]; text: string; skipped: number } | null {
  let partial: { steps: VoiceStep[]; text: string; skipped: number } | null = null;
  for (const text of alts) {
    const segs = splitVoice(text);
    if (segs.length < 2) continue;
    const used = segs.slice(0, VOICE_MAX_CHAIN);
    const steps: VoiceStep[] = [];
    let prevTypes: number | null = null;
    for (const seg of used) {
      const b = parseVoiceBest([seg], roster);
      if (!b) continue;
      const cmd = b.cmd;
      if (cmd.kind === "stance" || cmd.kind === "hold" || cmd.kind === "order") {
        if (cmd.types === null && prevTypes !== null) cmd.types = prevTypes;
        if (cmd.types !== null) prevTypes = cmd.types;
      }
      steps.push({ cmd, text: seg, fuzzy: b.fuzzy });
    }
    const r = { steps, text, skipped: used.length - steps.length };
    if (steps.length >= 2 && r.skipped === 0) return r;
    if (steps.length >= 2 && (!partial || steps.length > partial.steps.length)) partial = r;
  }
  if (partial) return partial;
  const one = parseVoiceBest(alts, roster);
  return one ? { steps: [{ cmd: one.cmd, text: one.text, fuzzy: one.fuzzy }], text: one.text, skipped: 0 } : null;
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
