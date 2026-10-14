import {
  ARCHER,
  ARMY_LATERAL_SPACING,
  ARMY_MAX_UNITS,
  ARMY_PLAYER_EXPONENT,
  ARMY_RANK_SPACING,
  ARMY_RANK_WIDTH,
  BLUNT,
  BOSS_TYPES,
  CAVALRY,
  SHIELD,
  SPEAR,
  SQUAD_MAX_SIZE,
  STAGE_COUNT,
  TUNE,
} from "@mercenary/shared";

/** 보스군 병력(장군 제외) = (기본 + 증가 x (스테이지-1)) x 접속 인원^0.8 */
export function armySize(stage: number, players: number): number {
  const raw = (TUNE.ARMY_BASE_UNITS + TUNE.ARMY_UNITS_PER_STAGE * (stage - 1)) * Math.pow(Math.max(1, players), ARMY_PLAYER_EXPONENT);
  return Math.min(ARMY_MAX_UNITS, Math.round(raw));
}

export function bossTypeOf(stage: number): number {
  return BOSS_TYPES[Math.min(stage, STAGE_COUNT) - 1]!;
}

/** 기본 병종 비율(기병, 창병, 궁병, 검방병, 둔기병). 장군 병종은 더 많이 섞는다. */
const BASE_MIX = [0.14, 0.2, 0.2, 0.26, 0.2] as const;

/** 병종별 병력 수. 합이 정확히 count가 된다. */
export function armyComposition(stage: number, count: number): number[] {
  const boss = bossTypeOf(stage);
  const weights = BASE_MIX.map((w, t) => w + (t === boss ? 0.12 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((w / total) * count));
  let rest = count - out.reduce((a, b) => a + b, 0);
  // 남는 인원은 비율이 큰 병종부터 한 명씩
  const order = weights.map((w, t) => t).sort((a, b) => weights[b]! - weights[a]!);
  for (let i = 0; rest > 0; i = (i + 1) % order.length, rest--) out[order[i]!]!++;
  return out;
}

export interface ArmySlot {
  type: number;
  general: boolean;
  /** 진형 기준 좌표: forward는 행군 방향(앞이 +), lateral은 왼쪽이 + */
  forward: number;
  lateral: number;
}

/** 구성(병종별 인원)으로 진형을 짠다. generalType을 주면 가운데에 장군 자리를 둔다. */
function layoutFromComp(comp: readonly number[], generalType: number | null): ArmySlot[] {
  const slots: ArmySlot[] = [];
  let depth = 0;
  const addRows = (type: number, n: number) => {
    for (let left = n; left > 0; ) {
      const inRow = Math.min(ARMY_RANK_WIDTH, left);
      for (let i = 0; i < inRow; i++) {
        slots.push({ type, general: false, forward: -depth * ARMY_RANK_SPACING, lateral: (i - (inRow - 1) / 2) * ARMY_LATERAL_SPACING });
      }
      left -= inRow;
      depth++;
    }
  };
  addRows(SHIELD, comp[SHIELD]!);
  addRows(SPEAR, comp[SPEAR]!);
  addRows(BLUNT, comp[BLUNT]!);
  if (generalType !== null) {
    slots.push({ type: generalType, general: true, forward: -depth * ARMY_RANK_SPACING, lateral: 0 });
    depth++;
  }
  addRows(ARCHER, comp[ARCHER]!);

  // 기병: 가장 넓은 줄 바깥쪽 양옆에 세로로 늘어선다
  const halfWidth = Math.min(ARMY_RANK_WIDTH, Math.max(comp[SHIELD]!, comp[SPEAR]!, comp[BLUNT]!, 1)) * ARMY_LATERAL_SPACING * 0.5 + ARMY_LATERAL_SPACING * 1.5;
  for (let i = 0; i < comp[CAVALRY]!; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const k = Math.floor(i / 2);
    slots.push({ type: CAVALRY, general: false, forward: -(k % 6) * ARMY_RANK_SPACING, lateral: side * (halfWidth + Math.floor(k / 6) * ARMY_LATERAL_SPACING) });
  }
  return slots;
}

/**
 * 보스군 진형. 앞에서부터 검방병 → 창병 → 둔기병 → (장군) → 궁병 순으로 줄을 서고, 기병은 양옆 날개에 선다.
 * 한 줄이 ARMY_RANK_WIDTH를 넘으면 뒤로 줄을 더 만든다.
 */
export function armyLayout(stage: number, count: number): ArmySlot[] {
  return layoutFromComp(armyComposition(stage, count), bossTypeOf(stage));
}

// --- 소대: 보스가 아닐 때도 오는 소규모 혼성 부대. 병종끼리 약점을 가려 주도록 짠다. ---

export interface SquadKind {
  name: string;
  /** 병종별 비율(기병, 창병, 궁병, 검방병, 둔기병) */
  mix: readonly number[];
  /** 어떻게 서로를 보완하는지(화면 안내용) */
  note: string;
}
export const SQUAD_KINDS: readonly SquadKind[] = [
  { name: "방패 벽", mix: [0, 0.2, 0.35, 0.45, 0], note: "검방병이 화살을 막고, 궁병이 뒤에서 쏜다" },
  { name: "창 방진", mix: [0, 0.4, 0.25, 0.25, 0.1], note: "창병이 돌격을 막고, 검방병·궁병이 받쳐 준다" },
  { name: "기마 돌격", mix: [0.4, 0.1, 0.3, 0.2, 0], note: "기병이 우회하는 동안 궁병과 검방병이 정면을 잡는다" },
  { name: "파쇄조", mix: [0, 0.25, 0.1, 0.3, 0.35], note: "둔기병이 방패를 부수고, 창병이 옆을 지킨다" },
  { name: "혼성 돌파", mix: [0.2, 0.2, 0.2, 0.2, 0.2], note: "모든 병종이 고르게 섞인 정예 소대" },
];

/** 소대 규모: 스테이지와 접속 인원이 늘수록 커진다 */
export function squadSize(stage: number, players: number): number {
  return Math.min(SQUAD_MAX_SIZE, TUNE.SQUAD_BASE_SIZE + stage + Math.round(0.8 * Math.max(1, players)));
}

/** 소대 구성: 비율대로 나누되, 충분히 큰 소대라면 비중이 있는 병종이 최소 1명은 들어가게 한다(보완하는 짝이 비지 않게). */
export function squadComposition(kind: SquadKind, size: number): number[] {
  const total = kind.mix.reduce((a, b) => a + b, 0);
  const out = kind.mix.map((m) => Math.floor((m / total) * size));
  if (size >= 4) kind.mix.forEach((m, t) => m >= 0.2 && out[t] === 0 && out[t]!++);
  // 합이 맞을 때까지 가장 비중이 큰 병종부터 더하고, 넘치면 가장 많은 병종에서 뺀다
  let sum = out.reduce((a, b) => a + b, 0);
  const order = kind.mix.map((_, t) => t).sort((a, b) => kind.mix[b]! - kind.mix[a]!);
  for (let i = 0; sum < size; i = (i + 1) % order.length, sum++) out[order[i]!]!++;
  while (sum > size) {
    const t = out.indexOf(Math.max(...out));
    out[t]!--;
    sum--;
  }
  return out;
}

export function squadLayout(comp: readonly number[]): ArmySlot[] {
  return layoutFromComp(comp, null);
}
