/**
 * 투명화(은신): 점점 투명해졌다가(FADE_SEC) 한동안 유지하고(hold) 다시 점점 돌아온다(FADE_SEC).
 * 투명도(alpha)가 AGGRO_ALPHA 이하인 동안은 적의 어그로가 풀린다(조준·추격 대상에서 빠진다).
 * 주인공 궁수의 스킬과 궁수 장군의 은신 저격이 같은 규칙을 쓴다.
 */
export const GHOST = {
  fadeSec: 1, // 투명해지는 시간 / 돌아오는 시간
  holdSec: 1, // 가장 투명한 채로 머무는 시간(주인공 궁수)
  minAlpha: 0.05, // 가장 투명할 때의 투명도(5%)
  aggroAlpha: 0.5, // 이 투명도 이하에서는 어그로가 풀린다(50%)
};

/** phase 0 = 투명해지는 중, 1 = 유지, 2 = 돌아오는 중. hold가 Infinity면 풀어 줄 때까지 유지한다. */
export interface Ghost {
  phase: 0 | 1 | 2;
  t: number; // 이 단계에서 흐른 시간
  hold: number;
}
export const newGhost = (hold: number = GHOST.holdSec): Ghost => ({ phase: 0, t: 0, hold });

/** 돌아오기 시작한다(유지 중이거나 투명해지는 중이어도 지금 투명도에서 이어서 돌아온다) */
export function releaseGhost(g: Ghost): void {
  if (g.phase === 2) return;
  const a = ghostAlpha(g);
  g.phase = 2;
  g.t = ((a - GHOST.minAlpha) / (1 - GHOST.minAlpha)) * GHOST.fadeSec; // 지금 투명도에 맞는 위치에서 시작
}

/** 지금 투명도(1 = 보통, 0.05 = 가장 투명) */
export function ghostAlpha(g: Ghost | undefined): number {
  if (!g) return 1;
  const k = Math.min(1, g.t / GHOST.fadeSec);
  if (g.phase === 0) return 1 - (1 - GHOST.minAlpha) * k;
  if (g.phase === 1) return GHOST.minAlpha;
  return GHOST.minAlpha + (1 - GHOST.minAlpha) * k;
}
/** 어그로가 풀려 있는가(투명도가 절반 이하) */
export const ghostHidesAggro = (g: Ghost | undefined): boolean => !!g && ghostAlpha(g) <= GHOST.aggroAlpha;

/** 시간을 흘린다. 끝났으면(완전히 돌아왔으면) false */
export function stepGhost(g: Ghost, dt: number): boolean {
  g.t += dt;
  if (g.phase === 0 && g.t >= GHOST.fadeSec) {
    g.phase = 1;
    g.t = 0;
  }
  if (g.phase === 1 && g.t >= g.hold) {
    g.phase = 2;
    g.t = 0;
  }
  if (g.phase === 2 && g.t >= GHOST.fadeSec) return false;
  return true;
}
