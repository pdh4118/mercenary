import {
  BACKSTAB_ARC,
  SHIELD_FRONT_ARC,
  SPEAR,
  angleDiff,
  shieldFactor,
  TUNE,
} from "@mercenary/shared";

/** 공격을 받는 쪽의 방어 상태 */
export interface Guard {
  type: number; // 병종. 창병이면 기병의 돌격 피해를 받지 않고 되돌려준다. 병종 없음(주인공)은 -1
  spearStance?: boolean; // 창을 든 주인공도 창병처럼 돌격을 반사한다
  shield: number; // 남은 방패 체력(0이면 방패 없음 또는 깨져서 재생 대기 중)
  face: number; // 바라보는 방향(라디안). 방패가 막는 방향
  frontBlock?: number; // 정면 피해 배율(검을 든 주인공)
}

/** 들어오는 공격 */
export interface Hit {
  damage: number; // 기본 피해
  charge: number; // 기병 돌격 추가 피해(속도 비례). 창병에게는 무효이고 되돌려준다
  srcType: number; // 공격자 병종(방패 피해 배율에 쓴다). 병종 없음은 -1
  fromAngle: number; // 방어자 위치에서 공격자(또는 날아온 쪽)를 바라본 방향
  pierceGuard?: boolean; // 방패·돌격 반사·배후 배율을 무시하고 몸에 들어간다(하늘에서 떨어지는 마법)
  dot?: boolean; // 지속 피해(독): 방패·회피·배후 배율을 무시하고 몸에 들어간다
  poison?: number; // 독 총 피해(몸에 맞았을 때만 걸린다)
  crit?: boolean; // 치명타(이미 피해에 반영됨. 표시용)
  src?: unknown; // 공격자(가시 갑옷이 되돌릴 대상)
}

export interface HitResult {
  body: number; // 몸에 들어가는 피해
  shield: number; // 방패 체력에서 깎이는 양
  reflected: number; // 공격자에게 되돌아가는 피해(창병의 돌격 반사)
  shieldBroke: boolean; // 이번 공격으로 방패가 깨졌다
  backstab: boolean; // 등 뒤에서 맞았다(피해 x1.5)
}

/**
 * 한 번의 공격이 방어자에게 어떻게 들어가는지 계산한다.
 * - 창병(또는 창을 든 주인공)은 돌격 피해를 받지 않고, 그 피해를 공격자에게 되돌려준다.
 * - 방패가 있고 정면에서 오는 공격이면 방패 체력이 대신 깎인다(공격자 병종별 배율). 넘치는 피해는 몸에 들어간다.
 * - 방패가 없거나(깨진 경우 포함) 옆·뒤에서 오는 공격은 몸에 그대로 들어간다. 깨진 방패에 따로 약점 배율은 두지 않는다.
 *   검방병의 약점은 방패가 사라진 상태에서 드러나는 짧은 사거리와 낮은 공격력이다.
 */
export function resolveHit(g: Guard, h: Hit): HitResult {
  if (h.pierceGuard) return { body: h.damage, shield: 0, reflected: 0, shieldBroke: false, backstab: false };
  const spear = g.type === SPEAR || g.spearStance === true;
  const reflected = spear ? h.charge : 0;
  // 등 뒤에서 오는 공격은 피해가 늘어난다(돌격 피해도 포함). 방패는 정면만 막으므로 등 뒤에서는 어차피 소용없다.
  const backstab = Math.abs(angleDiff(h.fromAngle, g.face + Math.PI)) <= BACKSTAB_ARC;
  const mult = backstab ? TUNE.BACKSTAB_MULT : 1;
  const base = (h.damage + (spear ? 0 : h.charge)) * mult;
  const frontal = Math.abs(angleDiff(h.fromAngle, g.face)) <= SHIELD_FRONT_ARC;

  if (g.shield > 0 && frontal) {
    const factor = shieldFactor(h.srcType);
    const onShield = base * factor;
    if (onShield <= g.shield) return { body: 0, shield: onShield, reflected, shieldBroke: onShield >= g.shield, backstab };
    // 방패가 버티지 못하면 남은 몫이 몸에 들어간다(방패에 곱해진 배율은 되돌려서 계산)
    return { body: (onShield - g.shield) / factor, shield: g.shield, reflected, shieldBroke: true, backstab };
  }
  let body = base;
  if (g.frontBlock !== undefined && frontal) body *= g.frontBlock;
  return { body, shield: 0, reflected, shieldBroke: false, backstab };
}
