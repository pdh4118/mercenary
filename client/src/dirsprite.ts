import { Assets, type Texture } from "pixi.js";

/**
 * 방향별 그림(3D로 렌더한 8방향 스프라이트) 고르기.
 * 파일은 5방향만 있다(0 뒤, 1 뒤 비스듬, 2 옆(오른쪽), 3 앞 비스듬, 4 앞)이고, 왼쪽을 보는 방향은 좌우 반전해서 쓴다.
 * 화면에서의 몸 방향 각도(라디안, 동쪽 0, 남쪽(화면 아래) +PI/2)를 8구간으로 나눠 그림을 고른다.
 */
export const DIR_ANIMS = ["idle", "walk", "attack"] as const;
export type DirAnim = (typeof DIR_ANIMS)[number];
const FRAMES: Record<DirAnim, number> = { idle: 1, walk: 4, attack: 4 };

export interface DirSet {
  tex: Record<DirAnim, Texture[][]>; // [방향 0..4][프레임]
  anchorX: number;
  anchorY: number;
}

/** 구간 번호(0 동, 1 남동, 2 남, 3 남서, 4 서, 5 북서, 6 북, 7 북동) -> [파일 방향, 좌우 반전] */
const SECTOR_FILE: readonly (readonly [number, boolean])[] = [
  [2, false], // 동(오른쪽 옆)
  [3, false], // 남동(앞 비스듬, 오른쪽)
  [4, false], // 남(앞)
  [3, true], // 남서
  [2, true], // 서
  [1, true], // 북서(뒤 비스듬, 왼쪽)
  [0, false], // 북(뒤)
  [1, false], // 북동
];

/** 구간이 경계 근처에서 깜빡이지 않게, 현재 구간에서 0.65구간(약 29도) 넘게 벗어났을 때만 바꾼다 */
export function nextSector(cur: number, ang: number): number {
  const f = (((Math.atan2(Math.sin(ang), Math.cos(ang)) / (Math.PI / 4)) % 8) + 8) % 8;
  let diff = Math.abs(f - cur);
  diff = Math.min(diff, 8 - diff);
  return diff > 0.65 ? Math.round(f) % 8 : cur;
}

export function pickDir(set: DirSet, sector: number, anim: DirAnim, frame: number): { tex: Texture; flip: boolean } {
  const [file, flip] = SECTOR_FILE[sector]!;
  const frames = set.tex[anim][file]!;
  return { tex: frames[Math.max(0, Math.min(frames.length - 1, frame))]!, flip };
}

const sets = new Map<string, Promise<DirSet | null>>();
/** assets/units3d/<이름>_<팀>_<방향>_<동작>_<번호>.png 를 모두 받는다. 하나라도 없으면 null(옛 그림을 그대로 쓴다) */
export function loadDirSet(name: string, team: "ally" | "enemy", anchor: { x: number; y: number }): Promise<DirSet | null> {
  const key = `${name}/${team}`;
  let p = sets.get(key);
  if (!p) {
    p = (async () => {
      try {
        const tex = { idle: [] as Texture[][], walk: [] as Texture[][], attack: [] as Texture[][] };
        for (let d = 0; d < 5; d++)
          for (const a of DIR_ANIMS) {
            const list = await Promise.all(Array.from({ length: FRAMES[a] }, (_, i) => Assets.load<Texture>(`assets/units3d/${name}_${team}_${d}_${a}_${i}.png`)));
            tex[a][d] = list;
          }
        return { tex, anchorX: anchor.x, anchorY: anchor.y };
      } catch {
        return null;
      }
    })();
    sets.set(key, p);
  }
  return p;
}
