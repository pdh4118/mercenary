import {
  FORMATION_LATERAL_SPACING,
  FORMATION_ROW_OFFSET,
  FORMATION_ROW_WRAP,
  FORMATION_WING_FORWARD,
  FORMATION_WING_LATERAL,
  UNIT_TYPES,
} from "./rules.js";

/** 진형 구역: 병종마다 어느 구역에 설지 고른다 */
export const ZONE_FRONT = 0;
export const ZONE_MID = 1;
export const ZONE_BACK = 2;
export const ZONE_LEFT = 3;
export const ZONE_RIGHT = 4;
export const ZONE_BOTH = 5; // 좌우 날개에 번갈아
export const ZONE_GUARD = 6; // 가장 뒤에서 호위
export const ZONE_NAMES = ["전열", "중열", "후열", "좌익", "우익", "양익", "후위 호위"] as const;
const ROW_OFFSETS = [...FORMATION_ROW_OFFSET, -130] as const; // 전열·중열·후열·호위의 앞뒤 위치

export const FORMATION_SPACING_MIN = 0.7;
export const FORMATION_SPACING_MAX = 1.8;
export const FORMATION_SLOTS = 4; // 저장해 두고 단축키(F1~F4)로 바로 쓰는 진형 수
export const FORMATION_NAME_MAX = 8;

export interface FormationPreset {
  name: string;
  zones: number[]; // 병종(UNIT_TYPES 순서)별 구역
  spacing: number; // 간격 배율
}

/** 기본으로 들어 있는 진형 4개(기병, 창병, 궁병, 검방병, 둔기병, 마법사 순서) */
export const DEFAULT_PRESETS: readonly FormationPreset[] = [
  { name: "기본", zones: [ZONE_BOTH, ZONE_MID, ZONE_BACK, ZONE_FRONT, ZONE_FRONT, ZONE_GUARD], spacing: 1 },
  { name: "방진", zones: [ZONE_GUARD, ZONE_FRONT, ZONE_BACK, ZONE_FRONT, ZONE_MID, ZONE_GUARD], spacing: 0.8 },
  { name: "양익 포위", zones: [ZONE_BOTH, ZONE_MID, ZONE_BACK, ZONE_MID, ZONE_FRONT, ZONE_GUARD], spacing: 1.4 },
  { name: "측면 압박", zones: [ZONE_LEFT, ZONE_FRONT, ZONE_BACK, ZONE_FRONT, ZONE_RIGHT, ZONE_GUARD], spacing: 1.5 },
];

export const defaultPresets = (): FormationPreset[] => DEFAULT_PRESETS.map((p) => ({ ...p, zones: [...p.zones] }));

/** 신뢰할 수 없는 입력을 올바른 진형으로 바로잡는다. 구역은 정수 0..6, 간격은 범위 안으로. 틀리면 null. */
export function sanitizeFormation(raw: unknown): { zones: number[]; spacing: number } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { zones?: unknown; spacing?: unknown };
  if (!Array.isArray(r.zones) || r.zones.length < 5 || r.zones.length > UNIT_TYPES.length) return null; // 병종이 늘기 전에 저장된 진형(5개)도 받는다
  const zones: number[] = [];
  for (const z of r.zones) {
    if (typeof z !== "number" || !Number.isInteger(z) || z < 0 || z >= ZONE_NAMES.length) return null;
    zones.push(z);
  }
  const sp = typeof r.spacing === "number" && Number.isFinite(r.spacing) ? r.spacing : 1;
  while (zones.length < UNIT_TYPES.length) zones.push(ZONE_GUARD); // 새 병종(마법사)은 가장 뒤에서 호위
  return { zones, spacing: Math.max(FORMATION_SPACING_MIN, Math.min(FORMATION_SPACING_MAX, sp)) };
}

/**
 * 진형 배치. 주인공 기준 (앞으로 forward, 왼쪽으로 lateral) 상대 좌표를 돌려준다.
 * 같은 구역의 유닛은 id 순으로 한 줄(최대 FORMATION_ROW_WRAP명)씩 서고, 넘치면 뒤에 줄을 더 만든다.
 */
export function layoutFormation(units: readonly { id: number; type: number }[], zones: readonly number[], spacing: number): Map<number, [number, number]> {
  const out = new Map<number, [number, number]>();
  const byZone: { id: number }[][] = ZONE_NAMES.map(() => []);
  for (const u of units) byZone[zones[u.type] ?? ZONE_MID]!.push(u);
  const gap = FORMATION_LATERAL_SPACING * spacing;
  for (let z = 0; z < ZONE_NAMES.length; z++) {
    const list = byZone[z]!.sort((a, b) => a.id - b.id);
    if (z === ZONE_LEFT || z === ZONE_RIGHT || z === ZONE_BOTH) {
      list.forEach((u, i) => {
        const side = z === ZONE_LEFT ? 1 : z === ZONE_RIGHT ? -1 : i % 2 === 0 ? 1 : -1;
        const k = z === ZONE_BOTH ? Math.floor(i / 2) : i;
        out.set(u.id, [FORMATION_WING_FORWARD, side * (FORMATION_WING_LATERAL + k * gap)]);
      });
      continue;
    }
    list.forEach((u, i) => {
      const col = i % FORMATION_ROW_WRAP;
      const wrap = Math.floor(i / FORMATION_ROW_WRAP);
      const inLine = Math.min(FORMATION_ROW_WRAP, list.length - wrap * FORMATION_ROW_WRAP);
      out.set(u.id, [(z === ZONE_GUARD ? ROW_OFFSETS[3] : ROW_OFFSETS[z])! - wrap * 30 * spacing, (col - (inLine - 1) / 2) * gap]);
    });
  }
  return out;
}
