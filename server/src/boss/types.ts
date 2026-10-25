/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TeleWire } from "@mercenary/shared";
import type { Enemy, Foe, Merc } from "../game.js";
import type { Hit } from "../combat.js";
import type { BossSystem } from "./system.js";

/** 장군 하나의 스킬 진행 상태 */
export interface BossKitState {
  cds: Record<number, number>; // 스킬 번호별 남은 쿨타임
  cur: SkillDef | null; // 쓰는 중인 스킬
  show: number; // 화면에 보이는 스킬 번호(이어지는 스킬은 지금 부분의 번호)
  ph: number; // 0 예고, 1 시전, 2 후딜(스킬마다 의미가 조금 다르다)
  t: number; // 지금 단계에 남은 시간
  total: number; // 지금 단계 전체 시간(예고 표시용)
  x: number; // 예고에서 고정한 위치·방향
  y: number;
  ang: number;
  idle: number; // 다음 스킬을 고르기까지 남은 시간
  hit: Set<number>; // 이번 시전에 이미 맞힌 대상
  hitAt: Map<number, number>; // 대상별 마지막으로 친 시각(여러 번 칠 때)
  d: Record<string, number>; // 스킬이 쓰는 임시 값
  list: any[]; // 스킬이 쓰는 임시 목록(여러 대상·여러 줄)
  v: Record<string, number>; // 장군이 쓰는 지속 값(은신 시간, 쉴드 체력, 질주 시간 등)
}

/** 스킬 한 번에 필요한 것들 */
export interface Ctx {
  e: Enemy;
  k: BossKitState;
  foes: Foe[];
  dt: number;
  sys: BossSystem;
}

export interface SkillDef {
  id: number;
  cd: number; // 쿨타임(초)
  weight: number; // 고를 때 가중치
  phase?: number; // 2면 체력 50% 이하, 3이면 40% 이하일 때만 쓴다
  can: (c: Ctx) => boolean; // 쿨타임 말고 쓸 수 있는 조건(대상이 있는가 등)
  begin: (c: Ctx) => void; // 고른 직후: 대상·위치를 고정하고 k.t·k.total(예고 시간)을 정한다
  run: (c: Ctx) => void; // 매 틱(k.t는 이미 줄어 있다). 끝나면 c.sys.end(c)
  tele?: (c: Ctx) => TeleWire[]; // 예고 모양
  telePhases?: number[]; // 예고를 보여 주는 단계(기본은 0만)
}

export interface KitDef {
  skills: SkillDef[];
  firstDelay: number;
  idleMin: number;
  idleMax: number;
  /** 스킬을 쓰지 않을 때의 이동을 맡는다(true면 기본 AI를 건너뛴다) */
  move?: (c: Ctx) => boolean;
  /** 매 틱 한 번(스킬 중이든 아니든) */
  tick?: (c: Ctx) => void;
  /** 맞기 전에 피해를 바꾼다. null이면 피해 없음. */
  preHit?: (c: Ctx, hit: Hit, ownerId: number, src?: Merc) => Hit | null;
  /** 맞은 뒤(위협 기록 등) */
  onHit?: (c: Ctx, hit: Hit, ownerId: number, src?: Merc) => void;
  /** 이동 속도 배율(질주 등) */
  speedMult?: (c: Ctx) => number;
  /** 클라이언트로 보내는 상태 비트 */
  flags?: (c: Ctx) => number;
  /** 매 틱 한 번(보스가 있는 동안 늘, 보스가 굳어 있어도): 장판처럼 보스와 따로 도는 것 */
  global?: (sys: BossSystem, friendlies: any[], dt: number) => void;
  /** 적·용병이 죽었을 때(안개 속 시체 만들기) */
  onDeath?: (sys: BossSystem, x: number, y: number, type: number, owner: number, skel: boolean) => void;
  /** 스킬을 쓰지 않을 때도 계속 보여 줄 예고(퍼지는 불꽃 고리 등) */
  teleAlways?: (c: Ctx) => TeleWire[];
}

/** 장판·장애물·움직이는 효과 */
export interface Hazard {
  id: number;
  kind: number;
  x: number;
  y: number;
  ang: number;
  a: number; // 종류별 값(반지름, 반길이 등)
  b: number;
  t: number; // 남은 시간
  total: number;
  delay: number; // 나타나기까지(예고) 남은 시간
  vx: number;
  vy: number;
  hp: number; // 체력(거대 방패) 또는 남은 횟수(얼음벽)
  hpMax: number;
  hit: Set<number>;
  tick: number; // 틱 피해 간격 계산용
  src: number; // 만든 장군 번호
  dmg: number; // 틱·폭발 피해(보스 기본 피해 배율 적용 전 값)
  solid: number; // 아군을 막는 원 반지름(0이면 막지 않는다)
  d: Record<string, number>;
}
