// 수치 조정 도구가 다루는 숫자 목록. 서버는 실행 중에도 값을 바꿀 수 있고, 바뀐 값은 접속한 클라이언트에도 전달된다.
// 값을 바꿔도 이 파일의 기본값(def)은 처음 읽을 때 기억해 두므로 언제든 "기본값으로"를 누를 수 있다.
import { TUNE, MERC_STATS, ENEMY_STATS, MERC_BASE_PRICE, MERC_RESPAWN_SEC, ENEMY_XP, ENEMY_GOLD, SHIELD_DAMAGE_FACTOR, UNIT_COST, ENEMY_SPAWN_WEIGHTS, WARD_WEIGHT, CAV_TARGET_WEIGHT, UNIT_NAMES } from "./rules.js";
import { MERC_XP_NEED, TIER_HP, TIER_DMG } from "./tiers.js";
import { WEAPONS, DIFFICULTY_REDUCTION, DIFFICULTY_NAMES } from "./index.js";
import { CARD_TUNE, HERO_STATS, LEGEND_CONST, MERC_STAT_BASE, MERC_STAT_LABEL, RARITY, RARITY_NAMES, SCALE_CARD, rebuildCards, type MercStat } from "./cards.js";
import { SUPPLY, BOSS_CAV, BOSS_SPEAR, BOSS_ARCHER, BOSS_SHIELD, BOSS_BLUNT, BOSS_MAGE, BOSS_MOUNT, BOSS_CHARIOT, BOSS_NECRO } from "./bossskill.js";
import { BOSS_LABELS } from "./bosslabels.js";
import { TENT } from "./rules.js";

export interface TuneDef {
  key: string;
  label: string;
  group: string;
  min: number;
  max: number;
  step: number;
  def: number;
  hint?: string;
  /** 수치 조정 화면의 위쪽 탭 */
  tab?: string;
  /** 표로 묶어 보여 줄 때: 표 이름·행 이름·열 이름(같은 표의 항목끼리 행×열 격자가 된다) */
  sheet?: string;
  row?: string;
  col?: string;
  /** 화면에 보이는 단위(예: "%", "초", "px")와, 저장 값에 곱해 보여 줄 배수(비율을 %로 보여 줄 때 100) */
  unit?: string;
  scale?: number;
}

interface Entry {
  def: TuneDef;
  get(): number;
  set(v: number): void;
  cards?: boolean; // 바꾸면 카드 목록을 다시 만들어야 하는 값
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
  terrain: "지형",
};

/** 숫자 하나의 설명: [이름, 묶음, 최솟값, 최댓값, 단계]. 최솟값 등을 생략하면 기본값 크기로 알맞게 잡는다. */
const SCALARS: Record<string, [string, string, number?, number?, number?]> = {
  ENEMY_SPEED_MULT: ["적 이동 속도 배율", G.stage, 0.5, 3, 0.05],
  STAGE_GROW_SEC: ["한 라운드 성장 시간(초)", G.stage, 10, 600, 5],
  STAGE_BREAK_SEC: ["클리어 뒤 쉬는 시간(초)", G.stage, 1, 120, 1],
  STAGE_ENEMY_HP_GROWTH: ["스테이지당 적 체력 증가", G.stage, 0, 2, 0.01],
  VENOM_CHANCE_PER_STAGE: ["스테이지당 늘어나는 독 궁병 비율", G.stage, 0, 1, 0.01],
  VENOM_CHANCE_MAX: ["독 궁병 비율 상한", G.stage, 0, 1, 0.05],
  VENOM_POISON: ["독 궁병 화살의 독 피해(화살 피해 대비)", G.stage, 0, 5, 0.05],
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
  TOURNAMENT_RESPAWN_MULT: ["토너먼트 용병 부활 시간 배율", G.tour, 0.1, 3, 0.05],
  TOURNAMENT_NOTICE_SEC: ["토너먼트 시작 전 예고 시간(초)", G.tour, 0, 60, 1],
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
  SPREAD_LATERAL: ["산개 진형: 좌우 간격 배율", G.ai, 1, 5, 0.1],
  SPREAD_FORWARD: ["산개 진형: 앞뒤 거리 배율", G.ai, 1, 5, 0.1],
  SPREAD_JITTER: ["산개 진형: 자리마다 어긋나는 정도(px)", G.ai, 0, 200, 5],
  DEFEND_LEASH_MULT: ["주인공 호위에서 용병이 자리를 벗어나 쫓는 거리 배율", G.ai, 1, 5, 0.1],
  HERO_SHIELD_MAX: ["주인공 검 방패 체력", G.combat, 0, 2000, 10],
  HERO_SHIELD_REGEN_DELAY: ["주인공 방패: 맞지 않아야 차오르기 시작하는 시간(초)", G.combat, 0, 30, 0.5],
  HERO_SHIELD_BROKEN_DELAY: ["주인공 방패: 깨진 뒤 차오르기 시작하는 시간(초)", G.combat, 0, 30, 0.5],
  HERO_SHIELD_REGEN_PCT: ["주인공 방패 재생(초당 최대치 비율)", G.combat, 0, 0.5, 0.005],
  HIGH_GROUND_ARROW_MULT: ["고지대에서 쏜 화살 피해 배율", G.terrain, 1, 3, 0.05],
  LOW_GROUND_ARROW_MULT: ["낮은 곳에서 고지대를 쏜 화살 피해 배율", G.terrain, 0.2, 1, 0.05],
  PLATEAU_TOP_SPEED: ["고지대 윗면 이동 속도 배율", G.terrain, 0.2, 1.2, 0.05],
  RAMP_SPEED: ["고지대 올라가는 길(계단·다리) 이동 속도 배율", G.terrain, 0.1, 1.2, 0.05],
  SLOPE_SPEED: ["고지대 비탈(오르는 길) 이동 속도 배율", G.terrain, 0.1, 1.2, 0.05],
  MERC_SPACING: ["용병끼리 유지하는 거리 배율(반지름 합 x 이 값)", G.ai, 1, 4, 0.1],
  CROSS_SEPARATION_SPEED: ["아군·적·주인공이 겹쳤을 때 밀려나는 속도(px/초)", G.ai, 0, 600, 10],
  CROSS_CHARGE_MOMENTUM: ["이 속도 이상의 기병은 돌격 중이라 통과한다(0~1)", G.ai, 0, 1, 0.05],
  MERC_SEPARATION_SPEED: ["겹친 용병이 밀려나는 속도(px/초)", G.ai, 0, 600, 10],
  GUARD_HERO_RADIUS: ["주인공 호위: 주인공 둘레 이 거리 안의 적은 막으러 나선다(px)", G.ai, 0, 800, 10],
  CATCHUP_MAX: ["용병이 진형으로 따라붙는 최대 속도 배율", G.ai, 1, 6, 0.1],
  BOSS_HARD_TIMEOUT_SEC: ["보스를 못 잡았을 때 강제로 다음 스테이지로 넘어가는 시간(초, 0이면 없음)", G.boss, 0, 1200, 10],
  BOSS_RAGE_INTERVAL_SEC: ["격노 단계 간격(초)", G.boss, 2, 120, 1],
  BOSS_RAGE_REINFORCE: ["격노 단계마다 늘어나는 병력(처음 병력 대비 비율)", G.boss, 0, 1, 0.01],
  BOSS_RAGE_POWER: ["격노 단계마다 늘어나는 체력·공격력 비율", G.boss, 0, 0.5, 0.01],
  BOSS_RAGE_SPEED: ["격노 단계마다 늘어나는 이동 속도 비율", G.boss, 0, 0.2, 0.005],
  BOSS_RAGE_MAX: ["격노 최대 단계", G.boss, 0, 60, 1],
  MOVE_ORDER_SEC: ["기병 이동 지시 지속 시간(초)", G.ai, 1, 60, 1],
  MOVE_ENGAGE_RADIUS: ["이동 지시 지점에서 기병이 싸우는 반경", G.ai, 20, 500, 10],
  ORDER_GROUP_RADIUS: ["공격 지시: 한 무리로 묶는 반경(px)", G.ai, 60, 600, 10],
  ORDER_ATTACK_PICK: ["우클릭 지점 주변에 적이 있으면 공격 지시로 보는 거리", G.ai, 10, 300, 5],
  SHAKEN_SEC: ["사기 저하(공포) 지속 시간(초)", G.merc, 0.5, 20, 0.5],
  SHAKEN_FLEE_SPEED: ["공포에 질린 용병의 도망 속도 배율", G.merc, 0.5, 3, 0.05],
  MOUNT_SPEED_MAX: ["기마 주인공 최고 속도 배율", G.hero, 1, 3, 0.05],
  ENEMY_MAGE_FROM_STAGE: ["적 마법사가 나오기 시작하는 스테이지", G.enemy, 1, 10, 1],
  MAGE_LOCK_SEC: ["운석 낙하 지점이 고정되는 시간(초, 낙하 전)", G.combat, 0, 5, 0.1],
  MAGE_AREA_FACTOR: ["마법사 계열 범위 증가 효율(1이면 그대로)", G.combat, 0, 1, 0.05],
  MAGE_FALLOFF: ["운석 폭발 가장자리 피해 감소 비율", G.combat, 0, 0.9, 0.05],
  CAV_RUNUP_SEC: ["기병 치고 빠져 속도 붙이는 최대 시간(초)", G.ai, 0.3, 8, 0.1],
  CAV_RUNUP_DIST: ["기병 달리기 위해 떨어지는 거리(px)", G.ai, 60, 600, 10],
  CAV_RUNUP_READY: ["기병 재돌격 속도 기준(최고 속도 대비)", G.ai, 0.3, 1, 0.05],
  CAV_FINISH_HP: ["기병이 끝까지 싸우는 대상 체력 비율", G.ai, 0, 1, 0.05],
  BLUNT_STAGGER_SEC: ["둔기병 경직 시간(초, 0단계)", G.combat, 0, 5, 0.05],
  BLUNT_STAGGER_PER_TIER: ["둔기병 경직 시간 단계당 증가(초)", G.combat, 0, 2, 0.05],
  BLUNT_STAGGER_BOSS_FRAC: ["보스에게 걸리는 경직 비율", G.combat, 0, 1, 0.05],
  ARMOR_MIN_DAMAGE: ["피해 감소를 쌓아도 한 번 맞을 때 최소로 들어가는 피해", G.combat, 0, 10, 0.5],
  MULTISHOT_DAMAGE: ["발사 수 카드로 늘어난 화살 피해 비율", G.combat, 0.1, 1.5, 0.05],
  MULTISHOT_SPREAD: ["발사 수 카드 화살 사이 각도(라디안)", G.combat, 0, 0.6, 0.01],
  SPEAR_HALF_WIDTH_NEAR: ["창 찌르기 폭(몸 앞, 반폭 px)", G.combat, 2, 150, 1],
  SPEAR_HALF_WIDTH_FAR: ["창 찌르기 폭(끝, 반폭 px)", G.combat, 2, 150, 1],
  CAV_HALF_WIDTH: ["기병 찌르기 폭(반폭 px)", G.combat, 2, 150, 1],
  PLAYER_MAX_HP: ["주인공 기본 체력", G.hero, 10, 2000, 5],
  PLAYER_SPEED: ["주인공 이동 속도", G.hero, 50, 800, 5],
  BOW_FIRE_SLOW: ["활 연사 중 이동 속도 감소 비율", G.hero, 0, 0.9, 0.05],
  SKILL_CD_BOW: ["스킬 쿨타임: 활 후퇴(초)", G.hero, 0, 120, 0.5],
  SKILL_CD_SPEAR: ["스킬 쿨타임: 창 돌진(초)", G.hero, 0, 120, 0.5],
  SKILL_CD_SWORD: ["스킬 쿨타임: 검 무적(초)", G.hero, 0, 120, 0.5],
  SKILL_CD_MACE: ["스킬 쿨타임: 철퇴 투척(초)", G.hero, 0, 120, 0.5],
  SKILL_CD_STAFF: ["스킬 쿨타임: 지팡이 방벽(초)", G.hero, 0, 120, 0.5],
  SKILL_CD_MOUNT: ["스킬 쿨타임: 기마 가속(초)", G.hero, 0, 120, 0.5],
  SKILL_BOOST_SEC: ["기마 가속 지속(초)", G.hero, 0, 10, 0.5],
  SKILL_BOOST_MULT: ["기마 가속 중 속도 추가 배율", G.hero, 1, 3, 0.05],
  SKILL_DASH_DIST: ["창 돌진 거리", G.hero, 0, 800, 10],
  SKILL_DASH_SEC: ["창 돌진 시간(초)", G.hero, 0.05, 1, 0.01],
  SKILL_BACKSTEP_DIST: ["활 후퇴 거리", G.hero, 0, 600, 10],
  SKILL_BACKSTEP_SEC: ["활 후퇴 시간(초)", G.hero, 0.05, 1, 0.01],
  SKILL_INVULN_SEC: ["검 무적 지속(초)", G.hero, 0, 10, 0.1],
  SKILL_MACE_RANGE: ["철퇴 투척 최대 거리", G.hero, 100, 1500, 10],
  SKILL_MACE_SPEED: ["철퇴 투척 속도", G.hero, 100, 2000, 20],
  SKILL_MACE_DAMAGE: ["던진 철퇴 피해 배율(철퇴 피해 대비)", G.hero, 0.1, 10, 0.1],
  SKILL_MACE_SPLASH: ["던진 철퇴 폭발 반경", G.hero, 10, 400, 5],
  SKILL_WALL_LEN: ["방벽 길이", G.hero, 40, 600, 10],
  SKILL_WALL_THICK: ["방벽 두께", G.hero, 6, 100, 2],
  SKILL_WALL_SEC: ["방벽 지속(초)", G.hero, 1, 60, 1],
  MACE_MIN_CHARGE: ["철퇴 최소 피해 비율(모으지 않고 뗐을 때)", G.hero, 0, 1, 0.05],
  ASSAULT_ADVANCE: ["돌격 진형: 대열이 앞으로 나가는 거리(px)", G.ai, 0, 800, 10],
  ASSAULT_LEASH_MULT: ["돌격 진형: 추격 범위 배율", G.ai, 1, 8, 0.1],
  GUARD_MID_FRAC: ["검방병·창병이 아군~위협 선에서 서는 위치(0.5=중간)", G.ai, 0, 1, 0.05],
  GUARD_DIST: ["검방병이 지키는 아군 앞에 서는 최소 거리(px)", G.ai, 10, 200, 2],
  SPEAR_COVER_DIST: ["창병이 아군 앞에서 막는 최소 거리(px)", G.ai, 10, 250, 2],
  ARCHER_REACH_FRAC: ["궁병이 쏘려는 거리(사거리 비율)", G.ai, 0.3, 1, 0.01],
  ARCHER_ROAM: ["궁병이 진형에서 벗어날 수 있는 거리(px)", G.ai, 20, 800, 10],
  ARCHER_KITE_MARGIN: ["궁병이 근접 적을 피하는 여유 거리(px)", G.ai, 0, 300, 5],
};

const UNIT_FIELDS: [string, string, number, number, number][] = [
  ["hp", "체력", 1, 5000, 1],
  ["speed", "이동 속도", 10, 800, 1],
  ["reach", "사거리/공격 거리", 5, 700, 1],
  ["damage", "공격력", 0, 500, 0.5],
  ["windup", "공격 준비 시간(초)", 0, 10, 0.05],
  ["cooldown", "공격 대기(초)", 0.1, 10, 0.05],
  ["leash", "진형에서 벗어나는 거리", 0, 1500, 5],
  ["shield", "방패 체력", 0, 3000, 1],
  ["splash", "범위 공격 반경", 0, 300, 1],
];
const WEAPON_FIELDS: [string, string, number, number, number][] = [
  ["damage", "공격력", 0, 500, 0.5],
  ["cooldown", "공격 대기(초)", 0.05, 5, 0.05],
  ["windup", "준비 동작(초)", 0, 10, 0.05],
  ["reach", "사거리", 10, 1200, 1],
  ["splash", "범위 반경", 0, 300, 1],
];

/** 묶음 이름으로 화면 탭을 정한다 */
const TABS = ["용병", "적", "주인공", "카드", "보스", "스테이지·규칙", "AI·진형", "전투·난이도"] as const;
export const TUNE_TABS = TABS;
const tabOfGroup = (g: string): string => {
  if (g.startsWith(G.merc) || g === G.hire) return "용병";
  if (g.startsWith(G.enemy)) return "적";
  if (g.startsWith(G.weapon)) return "주인공";
  if (g === G.boss) return "보스";
  if (g === G.ai) return "AI·진형";
  if (g === G.combat) return "전투·난이도";
  if (g === G.hero) return "주인공";
  return "스테이지·규칙"; // 스테이지·토너먼트·경험치·지형
};

let registry: Map<string, Entry> | null = null;

function build(): Map<string, Entry> {
  const reg = new Map<string, Entry>();
  const add = (def: Omit<TuneDef, "def">, get: () => number, set: (v: number) => void, cards = false) => reg.set(def.key, { def: { ...def, tab: def.tab ?? tabOfGroup(def.group), def: get() }, get, set, cards });
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

  // --- 표로 보여 주는 항목: 위에서 만든 항목에 표 이름·행·열을 붙인다 ---
  const sheetOf = (key: string, sheet: string, row: string, col: string, extra: Partial<TuneDef> = {}) => {
    const e = reg.get(key);
    if (e) e.def = { ...e.def, sheet, row, col, ...extra };
  };
  const fieldLabel = (f: string) => UNIT_FIELDS.find((x) => x[0] === f)?.[1] ?? f;
  UNIT_NAMES.forEach((un, t) => {
    for (const [f] of UNIT_FIELDS) {
      sheetOf(`MERC_STATS.${t}.${f}`, "용병 능력치", un, fieldLabel(f));
      sheetOf(`ENEMY_STATS.${t}.${f}`, "적 능력치", un, fieldLabel(f));
    }
  });
  WEAPONS.forEach((w, i) => {
    for (const [f, fl] of WEAPON_FIELDS) sheetOf(`WEAPONS.${i}.${f}`, "주인공 무기", w.name, fl);
  });
  UNIT_NAMES.forEach((un, t) => {
    sheetOf(`MERC_BASE_PRICE.${t}`, "용병 고용·부활", un, "고용 가격");
    sheetOf(`UNIT_COST.${t}`, "용병 고용·부활", un, "통솔력 비용");
    sheetOf(`MERC_RESPAWN_SEC.${t}`, "용병 고용·부활", un, "부활 시간(초)");
    sheetOf(`ENEMY_XP.${t}`, "적 처치 보상·생성", un, "경험치");
    sheetOf(`ENEMY_GOLD.${t}`, "적 처치 보상·생성", un, "금화");
    sheetOf(`ENEMY_SPAWN_WEIGHTS.${t}`, "적 처치 보상·생성", un, "생성 비율");
    sheetOf(`SHIELD_DAMAGE_FACTOR.${t}`, "병종 상성·우선도", un, "방패가 받는 피해 배율");
    sheetOf(`WARD_WEIGHT.${t}`, "병종 상성·우선도", un, "검방병이 지킬 우선도");
    sheetOf(`CAV_TARGET_WEIGHT.${t}`, "병종 상성·우선도", un, "기병이 노릴 우선도");
  });
  for (let i = 0; i < 5; i++) {
    sheetOf(`TIER_HP.${i}`, "용병 강화 단계", `${i}단계`, "체력 배율");
    sheetOf(`TIER_DMG.${i}`, "용병 강화 단계", `${i}단계`, "공격력 배율");
  }
  ["0→1단계", "1→2단계", "2→3단계", "3→4단계"].forEach((n, i) => sheetOf(`MERC_XP_NEED.${i}`, "용병 강화 단계", n.replace("→", "→"), "필요 경험치"));

  // --- 난이도: 받는 피해 감소율 ---
  const reduction = DIFFICULTY_REDUCTION as unknown as number[];
  DIFFICULTY_NAMES.forEach((n, i) => {
    add({ key: `DIFFICULTY_REDUCTION.${i}`, label: `${n} 난이도: 받는 피해 감소`, group: G.combat, tab: "전투·난이도", min: 0, max: 1, step: 0.01, sheet: "난이도", row: n, col: "받는 피해 감소", unit: "%", scale: 100, hint: "주인공·용병이 적에게 받는 피해가 이만큼 줄어듭니다(0%면 그대로)" }, () => reduction[i]!, (v) => (reduction[i] = v));
  });

  // --- 군량병·휴식 텐트 ---
  const objEntries = (name: string, obj: object, tab: string, group: string, specs: Record<string, [label: string, min: number, max: number, step: number, unit?: string, scale?: number]>) => {
    const o = obj as Record<string, number>;
    for (const [k, [label, min, max, step, unit, scale]] of Object.entries(specs)) {
      add({ key: `${name}.${k}`, label, group, tab, min, max, step, unit, scale }, () => o[k]!, (v) => (o[k] = v));
    }
  };
  objEntries("SUPPLY", SUPPLY, "전투·난이도", "군량병", {
    hp: ["체력(1스테이지)", 1, 1000, 1],
    hpGrow: ["스테이지당 체력 증가", 0, 2, 0.01, "%", 100],
    speed: ["도망 속도", 10, 400, 1],
    fleeRange: ["아군이 이 거리 안에 오면 도망", 100, 1500, 10, "px"],
    firstSec: ["첫 등장까지", 0, 300, 1, "초"],
    gapMin: ["등장 간격 최소", 3, 600, 1, "초"],
    gapMax: ["등장 간격 최대", 3, 600, 1, "초"],
    max: ["동시에 나오는 최대 수(1명일 때)", 1, 20, 1],
    lifeSec: ["못 잡으면 사라지는 시간", 5, 300, 1, "초"],
    riceSec: ["쌀이 남아 있는 시간", 3, 120, 1, "초"],
    riceRadius: ["쌀을 먹는 거리", 10, 200, 1, "px"],
    healFrac: ["쌀 회복: 최대 체력의 비율", 0, 1, 0.01, "%", 100],
    healFlat: ["쌀 회복: 고정 회복량", 0, 500, 1],
  });
  objEntries("TENT", TENT, "전투·난이도", "휴식 텐트", {
    useRadius: ["텐트에 들어갈 수 있는 거리", 20, 400, 5, "px"],
    lifeSec: ["텐트가 남아 있는 시간", 10, 600, 5, "초"],
    firstSec: ["첫 텐트가 나오기까지", 0, 300, 1, "초"],
    intervalSec: ["텐트 생성 간격", 5, 600, 1, "초"],
    max: ["동시에 있는 텐트 최대 수", 1, 10, 1],
    healPerSec: ["쉬는 동안 초당 회복(최대 체력 비율)", 0, 1, 0.01, "%", 100],
    respawnBoost: ["쉬는 동안 용병 부활 속도 배수", 1, 10, 0.1, "배"],
  });

  // --- 보스 스킬 수치(자동 이름표: shared/src/bosslabels.ts) ---
  const bossObjs: Record<string, object> = { BOSS_CAV, BOSS_SPEAR, BOSS_ARCHER, BOSS_SHIELD, BOSS_BLUNT, BOSS_MAGE, BOSS_MOUNT, BOSS_CHARIOT, BOSS_NECRO };
  for (const [key, info] of Object.entries(BOSS_LABELS)) {
    const [objName, field] = key.split(".") as [string, string];
    const o = bossObjs[objName] as Record<string, number> | undefined;
    if (!o || typeof o[field] !== "number") continue;
    const cur = o[field]!;
    const isTime = info.label.includes("(초)");
    const step = Math.abs(cur) < 1 ? 0.01 : Math.abs(cur) < 10 ? 0.05 : 1;
    const max = cur === 0 ? 10 : Math.max(1, Math.ceil(Math.abs(cur) * 5));
    add({ key, label: `${info.skill} · ${info.label}`, group: `보스 · ${info.boss}`, tab: "보스", min: 0, max, step: isTime ? Math.min(step, 0.1) : step, hint: info.hint || undefined, sheet: info.boss, row: info.skill, col: info.label }, () => o[field]!, (v) => (o[field] = v));
  }

  // --- 카드 ---
  RARITY.forEach((r, i) => {
    const n = RARITY_NAMES[i]!;
    add({ key: `RARITY.${i}.mult`, label: `${n} 카드 효과 배율`, group: "카드 등급", tab: "카드", min: 0.1, max: 10, step: 0.05, sheet: "카드 등급", row: n, col: "효과 배율", hint: "일반 등급 카드를 1로 봤을 때 효과의 크기" }, () => r.mult, (v) => (r.mult = v), true);
    add({ key: `RARITY.${i}.weight`, label: `${n} 카드가 나올 확률 배율`, group: "카드 등급", tab: "카드", min: 0, max: 5, step: 0.01, sheet: "카드 등급", row: n, col: "나올 확률 배율", hint: "클수록 자주 나옵니다" }, () => r.weight, (v) => (r.weight = v), true);
    add({ key: `RARITY.${i}.minLevel`, label: `${n} 카드가 나오기 시작하는 레벨`, group: "카드 등급", tab: "카드", min: 1, max: 30, step: 1, sheet: "카드 등급", row: n, col: "등장 레벨" }, () => r.minLevel, (v) => (r.minLevel = v), true);
  });
  const stats = Object.keys(MERC_STAT_BASE) as MercStat[];
  for (const st of stats) {
    const fmt = st === "pierce" || st === "multi" || st === "armor" || st === "thorns" || st === "knock" ? undefined : st === "poison" ? undefined : "%";
    add({ key: `MERC_STAT_BASE.${st}`, label: `용병 ${MERC_STAT_LABEL[st]} 카드(일반 등급) 기준 효과`, group: "용병 능력치 카드", tab: "카드", min: 0, max: Math.max(2, MERC_STAT_BASE[st] * 5), step: MERC_STAT_BASE[st] < 0.05 ? 0.0005 : MERC_STAT_BASE[st] < 1 ? 0.005 : 0.5, sheet: "용병 능력치 카드", row: MERC_STAT_LABEL[st], col: "병종 전용 카드 기준 효과", unit: fmt, scale: fmt ? 100 : undefined, hint: "공용 카드는 이 값에 아래 '공용 카드 효율'을 곱합니다" }, () => MERC_STAT_BASE[st], (v) => (MERC_STAT_BASE[st] = v), true);
  }
  const ct = CARD_TUNE as Record<string, number>;
  const cardList: [string, string, number, number, number, string?, number?][] = [
    ["globalFactor", "용병 공용 카드 효율(전용 카드 대비)", 0.05, 2, 0.01, "%", 100],
    ["globalLifesteal", "공용 흡혈 카드 추가 배수", 1, 20, 0.5, "배"],
    ["globalWeight", "공용 카드가 나올 가중치(일반 등급)", 0, 50, 0.5],
    ["legendWeight", "전설 카드가 나올 가중치", 0, 10, 0.05],
    ["bloodthirstWeight", "전설 '피의 갈증'이 나올 가중치", 0, 10, 0.05],
    ["legendMinLevel", "전설 카드가 나오기 시작하는 레벨", 1, 30, 1],
  ];
  for (const [k, label, min, max, step, unit, scale] of cardList) add({ key: `CARD_TUNE.${k}`, label, group: "카드 공통", tab: "카드", min, max, step, unit, scale, sheet: "카드 공통 설정", row: label, col: "값" }, () => ct[k]!, (v) => (ct[k] = v), true);
  const sc = SCALE_CARD as Record<string, number>;
  const scaleList: [string, string, number, number, number, string?, number?][] = [
    ["leadWeight", "통솔력 +N 카드가 나올 가중치", 0, 200, 1],
    ["leadPctBase", "통솔력 % 카드 효과(일반)", 0, 1, 0.01, "%", 100],
    ["leadPctWeight", "통솔력 % 카드 가중치", 0, 200, 1],
    ["priceBase", "고용 비용 할인 카드 효과(일반)", 0, 0.5, 0.01, "%", 100],
    ["priceWeight", "고용 비용 카드 가중치", 0, 200, 1],
    ["xpBase", "경험치 카드 효과(일반)", 0, 1, 0.01, "%", 100],
    ["xpWeight", "경험치 카드 가중치", 0, 200, 1],
    ["luckBase", "행운 카드 효과(일반)", 0, 1, 0.01, "%", 100],
    ["luckWeight", "행운 카드 가중치", 0, 200, 1],
    ["bountyBase", "보상금 카드 효과(일반)", 0, 2, 0.01, "%", 100],
    ["bountyWeight", "보상금 카드 가중치", 0, 200, 1],
    ["goldBase", "전리품 카드 효과(일반)", 0, 2, 0.01, "%", 100],
    ["goldWeight", "전리품 카드 가중치", 0, 200, 1],
  ];
  for (const [k, label, min, max, step, unit, scale] of scaleList) add({ key: `SCALE_CARD.${k}`, label, group: "규모 카드", tab: "카드", min, max, step, unit, scale, sheet: "규모 카드", row: label.replace(/ \(.*$/, ""), col: k.endsWith("Weight") ? "가중치" : "효과" }, () => sc[k]!, (v) => (sc[k] = v), true);
  HERO_STATS.forEach((h, i) => {
    const pct = h.fmt === "pct" || h.fmt === "regen" ? (h.fmt === "pct" ? "%" : undefined) : undefined;
    add({ key: `HERO_STATS.${i}.base`, label: `주인공 ${h.label} 카드(일반) 효과`, group: "주인공 카드", tab: "카드", min: 0, max: Math.max(1, h.base * 6), step: h.base < 0.05 ? 0.0005 : h.base < 1 ? 0.005 : 0.5, sheet: "주인공 카드", row: h.label, col: "일반 등급 효과", unit: pct, scale: pct ? 100 : undefined }, () => h.base, (v) => (h.base = v), true);
    add({ key: `HERO_STATS.${i}.weight`, label: `주인공 ${h.label} 카드 가중치`, group: "주인공 카드", tab: "카드", min: 0, max: 50, step: 0.5, sheet: "주인공 카드", row: h.label, col: "나올 가중치" }, () => h.weight, (v) => (h.weight = v), true);
    add({ key: `HERO_STATS.${i}.minLevel`, label: `주인공 ${h.label} 카드 등장 레벨`, group: "주인공 카드", tab: "카드", min: 1, max: 30, step: 1, sheet: "주인공 카드", row: h.label, col: "등장 레벨" }, () => h.minLevel ?? 1, (v) => (h.minLevel = v), true);
  });
  const lc = LEGEND_CONST as Record<string, number>;
  const legendList: [string, string, number, number, number, string?, number?][] = [
    ["bloodthirstFrac", "피의 갈증: 준 피해의 회복 비율", 0, 0.1, 0.0005, "%", 100],
    ["pierceRamp", "관통 증폭: 관통마다 피해 배율", 1, 3, 0.05, "배"],
    ["executeBelow", "처형: 이 체력 비율 이하 적에게", 0, 1, 0.01, "%", 100],
    ["executeMult", "처형: 피해 배율", 1, 10, 0.1, "배"],
    ["chargeMult", "돌격 가속: 돌격 피해 배율", 1, 10, 0.1, "배"],
    ["undyingChance", "불사: 되살아날 확률", 0, 1, 0.01, "%", 100],
    ["splashMult", "광역 증폭: 범위 피해 배율", 1, 10, 0.1, "배"],
    ["warcryStep", "전장의 함성: 처치당 공격 속도", 0, 0.5, 0.005, "%", 100],
    ["warcryMax", "전장의 함성: 최대 중첩", 1, 30, 1],
    ["warcrySec", "전장의 함성: 중첩 유지 시간", 1, 60, 1, "초"],
  ];
  for (const [k, label, min, max, step, unit, scale] of legendList) add({ key: `LEGEND_CONST.${k}`, label, group: "전설 카드", tab: "카드", min, max, step, unit, scale, sheet: "전설 카드", row: label.split(":")[0]!, col: label.includes(":") ? label.split(":")[1]!.trim() : "값" }, () => lc[k]!, (v) => (lc[k] = v), true);
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
  let cardsTouched = false;
  if (replace) for (const e of r.values()) {
    e.set(e.def.def);
    if (e.cards) cardsTouched = true;
  }
  if (!values || typeof values !== "object") {
    if (cardsTouched) rebuildCards();
    return 0;
  }
  let n = 0;
  for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
    const e = r.get(k);
    if (!e || typeof v !== "number" || !Number.isFinite(v)) continue;
    e.set(Math.max(e.def.min, Math.min(e.def.max, v)));
    if (e.cards) cardsTouched = true;
    n++;
  }
  if (cardsTouched) rebuildCards(); // 카드 수치가 바뀌었으면 카드 목록(이름·설명·효과량·가중치)을 다시 만든다
  return n;
}

export function resetTuning(): void {
  let cards = false;
  for (const e of reg().values()) {
    e.set(e.def.def);
    if (e.cards) cards = true;
  }
  if (cards) rebuildCards();
}
