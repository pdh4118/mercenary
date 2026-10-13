import {
  ARCHER,
  ARMY_BASE_UNITS,
  ARMY_LATERAL_SPACING,
  ARMY_MAX_UNITS,
  ARMY_PLAYER_EXPONENT,
  ARMY_RANK_SPACING,
  ARMY_RANK_WIDTH,
  ARMY_UNITS_PER_STAGE,
  BLUNT,
  BOSS_TYPES,
  CAVALRY,
  SHIELD,
  SPEAR,
  STAGE_COUNT,
} from "@mercenary/shared";

/** 보스군 병력(장군 제외) = (기본 + 증가 x (스테이지-1)) x 접속 인원^0.8 */
export function armySize(stage: number, players: number): number {
  const raw = (ARMY_BASE_UNITS + ARMY_UNITS_PER_STAGE * (stage - 1)) * Math.pow(Math.max(1, players), ARMY_PLAYER_EXPONENT);
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

/**
 * 진형 배치. 앞에서부터 검방병 → 창병 → 둔기병 → (장군) → 궁병 순으로 줄을 서고, 기병은 양옆 날개에 선다.
 * 한 줄이 ARMY_RANK_WIDTH를 넘으면 뒤로 줄을 더 만든다.
 */
export function armyLayout(stage: number, count: number): ArmySlot[] {
  const comp = armyComposition(stage, count);
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
  slots.push({ type: bossTypeOf(stage), general: true, forward: -depth * ARMY_RANK_SPACING, lateral: 0 });
  depth++;
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
