// 수치 조정 도구가 다루는 숫자 목록. 서버는 실행 중에도 값을 바꿀 수 있고, 바뀐 값은 접속한 클라이언트에도 전달된다.
// 값을 바꿔도 이 파일의 기본값(def)은 처음 읽을 때 기억해 두므로 언제든 "기본값으로"를 누를 수 있다.
import { TUNE, MERC_STATS, ENEMY_STATS, MERC_BASE_PRICE, MERC_RESPAWN_SEC, ENEMY_XP, ENEMY_GOLD, SHIELD_DAMAGE_FACTOR, UNIT_COST, ENEMY_SPAWN_WEIGHTS, WARD_WEIGHT, CAV_TARGET_WEIGHT, UNIT_NAMES } from "./rules.js";
import { MERC_XP_NEED, TIER_HP, TIER_DMG } from "./tiers.js";
import { WEAPONS } from "./index.js";

export interface TuneDef {
  key: string;
  label: string;
  group: string;
  min: number;
  max: number;
  step: number;
  def: number;
  hint?: string;
}

interface Entry {
  def: TuneDef;
  get(): number;
  set(v: number): void;
}

const G = {
  stage: "스테이지·적 성장",
  boss: "보스·상자",
  tour: "토너먼트",
  hire: "용병 고용·통솔",
  merc: "용병 능력치",
  enemy: "적 능력치",
  weapon: "주인공 무기",
  hero: "주인공·적 생성",
  combat: "전투 규칙",
  xp: "경험치·보상",
  ai: "용병 AI·진형",
};

/** 숫자 하나의 설명: [이름, 묶음, 최솟값, 최댓값, 단계]. 최솟값 등을 생략하면 기본값 크기로 알맞게 잡는다. */
const SCALARS: Record<string, [string, string, number?, number?, number?]> = {
  STAGE_GROW_SEC: ["한 라운드 성장 시간(초)", G.stage, 10, 600, 5],
  STAGE_BREAK_SEC: ["클리어 뒤 쉬는 시간(초)", G.stage, 1, 120, 1],
  STAGE_ENEMY_HP_GROWTH: ["스테이지당 적 체력 증가", G.stage, 0, 2, 0.01],
  STAGE_ENEMY_DMG_GROWTH: ["스테이지당 적 피해 증가", G.stage, 0, 2, 0.01],
  STAGE_SPAWN_GROWTH: ["스테이지당 적 물량 증가", G.stage, 0, 2, 0.01],
  ENEMY_TIME_HP_GROWTH: ["60초마다 적 체력 증가", G.stage, 0, 2, 0.01],
  ENEMY_TIME_DMG_GROWTH: ["60초마다 적 피해 증가", G.stage, 0, 2, 0.01],
  ENEMY_LEVEL_HP_GROWTH: ["평균 레벨 1당 적 체력 증가", G.stage, 0, 1, 0.005],
  ENEMY_LEVEL_DMG_GROWTH: ["평균 레벨 1당 적 피해 증가", G.stage, 0, 1, 0.005],
  ENEMY_SPAWN_BASE_PER_SEC: ["적 생성(플레이어 1명당 초당)", G.hero, 0, 10, 0.05],
  ENEMY_SPAWN_GROWTH_PER_SEC: ["시간에 따른 적 생성 증가(초당)", G.hero, 0, 0.2, 0.002],
  ARMY_BASE_UNITS: ["보스군 기본 병력", G.stage, 1, 200, 1],
  ARMY_UNITS_PER_STAGE: ["스테이지당 보스군 병력 증가", G.stage, 0, 60, 1],
  SQUAD_INTERVAL_BASE: ["적 소대가 오는 기본 간격(초)", G.stage, 5, 300, 1],
  SQUAD_BASE_SIZE: ["적 소대 기본 규모", G.stage, 1, 30, 1],
  BOSS_HP_BASE: ["보스 체력 기본 배율", G.boss, 1, 50, 0.5],
  BOSS_HP_PER_STAGE: ["스테이지당 보스 체력 배율 증가", G.boss, 0, 20, 0.1],
  BOSS_DMG_MULT: ["보스 피해 배율", G.boss, 0.5, 10, 0.1],
  BOSS_TIMEOUT_SEC: ["보스 제한 시간(초) - 지나면 다음 라운드", G.boss, 10, 600, 5],
  STAGE_CLEAR_GOLD: ["스테이지 클리어 금화(×스테이지)", G.boss, 0, 500, 5],
  STAGE_CLEAR_XP: ["스테이지 클리어 경험치 기본", G.boss, 0, 500, 5],
  CHEST_LIFETIME_SEC: ["보스 상자가 남아 있는 시간(초)", G.boss, 10, 1800, 10],
  CHEST_LUCK_BONUS: ["상자 카드의 행운 보너스", G.boss, 0, 5, 0.1],
  TOURNAMENT_INTRO_SEC: ["토너먼트 경기 전 소개 시간(초)", G.tour, 1, 30, 1],
  TOURNAMENT_MATCH_SEC: ["토너먼트 경기 제한 시간(초)", G.tour, 10, 300, 5],
  TOURNAMENT_WIN_GOLD: ["경기 승리 금화(×스테이지)", G.tour, 0, 500, 5],
  TOURNAMENT_RUNNERUP_GOLD: ["준우승 금화(×스테이지)", G.tour, 0, 500, 5],
  TOURNAMENT_CHAMPION_GOLD: ["우승 금화(×스테이지)", G.tour, 0, 1000, 5],
  TOURNAMENT_CHAMPION_XP: ["우승 경험치(×스테이지)", G.tour, 0, 1000, 5],
  START_LEADERSHIP: ["시작 통솔력", G.hire, 1, 30, 1],
  MERC_PRICE_GROWTH: ["용병 1명 보유당 가격 증가율", G.hire, 0, 2, 0.01],
  DISMISS_REFUND: ["해고 환급 비율", G.hire, 0, 1, 0.05],
  START_GOLD: ["시작 금화", G.hire, 0, 2000, 10],
  CAMP_LIFETIME_SEC: ["캠프가 남아 있는 시간(초)", G.hire, 10, 300, 5],
  CAMP_SPAWN_INTERVAL_SEC: ["캠프 생성 간격(초)", G.hire, 3, 300, 1],
  REVIVE_SEC: ["동료 부활에 걸리는 시간(초)", G.combat, 1, 60, 0.5],
  XP_BASE: ["1레벨 필요 경험치", G.xp, 1, 500, 1],
  XP_PER_LEVEL: ["레벨당 필요 경험치 증가", G.xp, 0, 200, 1],
  XP_TEAM_SHARE: ["경험치 팀 공유 비율", G.xp, 0, 1, 0.05],
  CRIT_BASE_MULT: ["치명타 기본 배율", G.combat, 1, 5, 0.05],
  BACKSTAB_MULT: ["배후 공격 배율", G.combat, 1, 5, 0.05],
  SHIELD_REGEN_SEC: ["깨진 방패 재생 시간(초)", G.combat, 1, 60, 0.5],
  SPLASH_FACTOR: ["범위 공격 피해 비율", G.combat, 0, 2, 0.05],
  CAV_DAMAGE_PER_SPEED: ["기병 속도당 돌격 추가 피해", G.combat, 0, 1, 0.005],
  CAV_RAMP_SEC: ["기병이 최고 속도까지 걸리는 시간(초)", G.combat, 0.2, 10, 0.1],
  KNOCK_MAX: ["넉백 최대 거리(px)", G.combat, 0, 600, 5],
  SPEAR_HALF_WIDTH_NEAR: ["창 찌르기 폭(몸 앞, 반폭 px)", G.combat, 2, 150, 1],
  SPEAR_HALF_WIDTH_FAR: ["창 찌르기 폭(끝, 반폭 px)", G.combat, 2, 150, 1],
  PLAYER_MAX_HP: ["주인공 기본 체력", G.hero, 10, 2000, 5],
  PLAYER_SPEED: ["주인공 이동 속도", G.hero, 50, 800, 5],
  ASSAULT_ADVANCE: ["돌격 진형: 대열이 앞으로 나가는 거리(px)", G.ai, 0, 800, 10],
  ASSAULT_LEASH_MULT: ["돌격 진형: 추격 범위 배율", G.ai, 1, 8, 0.1],
  GUARD_DIST: ["검방병이 지키는 아군 앞에 서는 거리(px)", G.ai, 10, 200, 2],
  SPEAR_COVER_DIST: ["창병이 아군 앞에서 기병을 막는 거리(px)", G.ai, 10, 250, 2],
  ARCHER_REACH_FRAC: ["궁병이 쏘려는 거리(사거리 비율)", G.ai, 0.3, 1, 0.01],
  ARCHER_ROAM: ["궁병이 진형에서 벗어날 수 있는 거리(px)", G.ai, 20, 800, 10],
  ARCHER_KITE_MARGIN: ["궁병이 근접 적을 피하는 여유 거리(px)", G.ai, 0, 300, 5],
};

const UNIT_FIELDS: [string, string, number, number, number][] = [
  ["hp", "체력", 1, 5000, 1],
  ["speed", "이동 속도", 10, 800, 1],
  ["reach", "사거리/공격 거리", 5, 700, 1],
  ["damage", "공격력", 0, 500, 0.5],
  ["windup", "공격 준비 시간(초)", 0, 3, 0.05],
  ["cooldown", "공격 대기(초)", 0.1, 10, 0.05],
  ["leash", "진형에서 벗어나는 거리", 0, 1500, 5],
  ["shield", "방패 체력", 0, 3000, 1],
  ["splash", "범위 공격 반경", 0, 300, 1],
];
const WEAPON_FIELDS: [string, string, number, number, number][] = [
  ["damage", "공격력", 0, 500, 0.5],
  ["cooldown", "공격 대기(초)", 0.05, 5, 0.05],
  ["windup", "준비 동작(초)", 0, 3, 0.05],
  ["reach", "사거리", 10, 1200, 1],
  ["splash", "범위 반경", 0, 300, 1],
];

let registry: Map<string, Entry> | null = null;

function build(): Map<string, Entry> {
  const reg = new Map<string, Entry>();
  const add = (def: Omit<TuneDef, "def">, get: () => number, set: (v: number) => void) => reg.set(def.key, { def: { ...def, def: get() }, get, set });
  const T = TUNE as Record<string, number>;
  for (const key of Object.keys(T)) {
    const meta = SCALARS[key];
    const def = T[key]!;
    const [label, group, min, max, step] = meta ?? [key, "기타"];
    add({ key, label, group, min: min ?? 0, max: max ?? Math.max(10, def * 20), step: step ?? (def < 1 ? 0.01 : def < 10 ? 0.1 : 1) }, () => T[key]!, (v) => (T[key] = v));
  }
  const table = (name: string, arr: readonly number[], label: string, group: string, labels: readonly string[] | null, min: number, max: number, step: number) => {
    const a = arr as number[];
    a.forEach((_, i) => add({ key: `${name}.${i}`, label: `${label} - ${labels?.[i] ?? i + 1}`, group, min, max, step }, () => a[i]!, (v) => (a[i] = v)));
  };
  UNIT_NAMES.forEach((un, t) => {
    for (const [f, fl, min, max, step] of UNIT_FIELDS) {
      add({ key: `MERC_STATS.${t}.${f}`, label: `${un} ${fl}`, group: `${G.merc} · ${un}`, min, max, step }, () => (MERC_STATS[t] as unknown as Record<string, number>)[f]!, (v) => ((MERC_STATS[t] as unknown as Record<string, number>)[f] = v));
      add({ key: `ENEMY_STATS.${t}.${f}`, label: `적 ${un} ${fl}`, group: `${G.enemy} · ${un}`, min, max, step }, () => (ENEMY_STATS[t] as unknown as Record<string, number>)[f]!, (v) => ((ENEMY_STATS[t] as unknown as Record<string, number>)[f] = v));
    }
  });
  WEAPONS.forEach((w, i) => {
    for (const [f, fl, min, max, step] of WEAPON_FIELDS) {
      add({ key: `WEAPONS.${i}.${f}`, label: `${w.name} ${fl}`, group: `${G.weapon} · ${w.name}`, min, max, step }, () => (WEAPONS[i] as unknown as Record<string, number>)[f]!, (v) => ((WEAPONS[i] as unknown as Record<string, number>)[f] = v));
    }
  });
  table("MERC_BASE_PRICE", MERC_BASE_PRICE, "고용 기본 가격", G.hire, UNIT_NAMES, 1, 1000, 1);
  table("UNIT_COST", UNIT_COST, "통솔력 비용", G.hire, UNIT_NAMES, 1, 20, 1);
  table("MERC_RESPAWN_SEC", MERC_RESPAWN_SEC, "용병 부활 시간(초)", G.hire, UNIT_NAMES, 1, 300, 1);
  table("ENEMY_XP", ENEMY_XP, "적 처치 경험치", G.xp, UNIT_NAMES, 0, 100, 0.5);
  table("ENEMY_GOLD", ENEMY_GOLD, "적 처치 금화", G.xp, UNIT_NAMES, 0, 200, 1);
  table("ENEMY_SPAWN_WEIGHTS", ENEMY_SPAWN_WEIGHTS, "적 생성 비율", G.hero, UNIT_NAMES, 0, 100, 1);
  table("SHIELD_DAMAGE_FACTOR", SHIELD_DAMAGE_FACTOR, "방패가 받는 피해 배율(공격자 병종)", G.combat, UNIT_NAMES, 0, 10, 0.05);
  table("MERC_XP_NEED", MERC_XP_NEED, "용병 강화에 필요한 경험치", G.xp, ["0→1단계", "1→2단계", "2→3단계", "3→4단계"], 1, 5000, 5);
  table("TIER_HP", TIER_HP, "단계별 체력 배율", G.merc, ["0단계", "1단계", "2단계", "3단계", "4단계"], 0.5, 10, 0.05);
  table("TIER_DMG", TIER_DMG, "단계별 공격력 배율", G.merc, ["0단계", "1단계", "2단계", "3단계", "4단계"], 0.5, 10, 0.05);
  table("WARD_WEIGHT", WARD_WEIGHT, "검방병이 지킬 우선도", G.ai, UNIT_NAMES, 0, 10, 0.1);
  table("CAV_TARGET_WEIGHT", CAV_TARGET_WEIGHT, "기병이 노릴 우선도", G.ai, UNIT_NAMES, 0, 10, 0.1);
  return reg;
}

function reg(): Map<string, Entry> {
  return (registry ??= build());
}

/** 조정할 수 있는 모든 숫자의 설명(이름·묶음·범위·기본값) */
export function tuneDefs(): TuneDef[] {
  const order = Object.values(G);
  const rank = (g: string) => {
    const i = order.findIndex((o) => g === o || g.startsWith(o + " · "));
    return i < 0 ? order.length : i;
  };
  // 묶음은 정해 둔 순서대로, 같은 묶음 안에서는 등록한 순서대로(정렬은 안정적이다)
  return [...reg().values()].map((e) => e.def).sort((a, b) => rank(a.group) - rank(b.group));
}

/** 지금 값 전체 */
export function tuneValues(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, e] of reg()) out[k] = e.get();
  return out;
}

/** 기본값과 다른 것만(저장·전송용) */
export function tuneOverrides(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, e] of reg()) if (e.get() !== e.def.def) out[k] = e.get();
  return out;
}

/** 값들을 적용한다. 알 수 없는 이름·숫자가 아닌 값은 무시하고, 범위를 벗어나면 범위 안으로 맞춘다. replace면 먼저 모두 기본값으로 되돌린다. 적용한 개수를 돌려준다. */
export function applyTuning(values: unknown, replace = false): number {
  const r = reg();
  if (replace) for (const e of r.values()) e.set(e.def.def);
  if (!values || typeof values !== "object") return 0;
  let n = 0;
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    const e = r.get(k);
    if (!e || typeof v !== "number" || !Number.isFinite(v)) continue;
    e.set(Math.max(e.def.min, Math.min(e.def.max, v)));
    n++;
  }
  return n;
}

export function resetTuning(): void {
  for (const e of reg().values()) e.set(e.def.def);
}
