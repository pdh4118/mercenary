/**
 * 보스(장군) 스킬. 서버가 스킬을 고르고 예고(텔레그래프)를 보내면, 클라이언트가 예고 모양을 그린다.
 * 수치는 docs/boss-raid-plan.md의 제안값이다.
 */

/** 스킬 번호 */
export const BSK_SPRINT = 1; // 기병 장군: 질주
export const BSK_CHARGE = 2; // 기병 장군: 돌진
export const BSK_KICK = 3; // 기병 장군: 뒷발차기
export const BSK_SLASH = 4; // 기병 장군: 선회 베기
export const BSK_ROAR = 5; // 기병 장군: 돌격 함성
export const BOSS_SKILL_NAMES: Record<number, string> = {
  [BSK_SPRINT]: "질주",
  [BSK_CHARGE]: "돌진",
  [BSK_KICK]: "뒷발차기",
  [BSK_SLASH]: "선회 베기",
  [BSK_ROAR]: "돌격 함성",
};

/** 예고 모양 */
export const TELE_LINE = 0; // 직선: 시작점(x,y), 방향(ang), a = 길이, b = 폭
export const TELE_CIRCLE = 1; // 원: 중심(x,y), a = 반지름
export const TELE_CONE = 2; // 부채꼴: 꼭짓점(x,y), 방향(ang), a = 반각(라디안), b = 반지름
export const TELE_BAND = 3; // 고리 띠: 중심(x,y), a = 안쪽 반지름, b = 바깥 반지름
/** 예고 한 개: [모양, x, y, ang, a, b, 남은 시간(0.1초), 전체 시간(0.1초), 스킬 번호] */
export type TeleWire = [kind: number, x: number, y: number, ang: number, a: number, b: number, left: number, total: number, skill: number];

/** 보스 효과 이벤트(EVT_BOSSFX)의 종류(val) */
export const BFX_IMPACT = 1; // 돌진·뒷발차기가 맞음(충돌 섬광과 먼지)
export const BFX_SLASH = 2; // 선회 베기의 호(ang = 휘두르는 방향)
export const BFX_ROAR = 3; // 돌격 함성(군기 오라)
export const BFX_CRASH = 4; // 돌진이 방벽·바위에 부딪힘

/** 기병 장군(스테이지 1) 수치 */
export const BOSS_CAV = {
  firstDelay: 3, // 등장하고 첫 스킬까지
  idleMin: 1, // 스킬 사이 쉬는 시간(최소~최대)
  idleMax: 2.4,
  // 질주: 수시로 쓰는 이동 속도 증가
  sprintTele: 0.6,
  sprintSec: 3,
  sprintMult: 1.6,
  sprintCd: 8,
  // 돌진: 취약한 폼을 향해 달려가 부딪히며 지나간다
  chargeTele: 1.4,
  chargeLen: 650,
  chargeWidth: 60,
  chargeSpeed: 950,
  chargeDmg: 4, // 일반 공격 피해 대비 배율(여기에 돌격 보너스가 더해져 주인공 체력의 절반쯤)
  chargeKnock: 140,
  chargeRest: 1.5, // 끝난 뒤 멈춰 있는 시간(딜 타임)
  chargeStun: 2, // 방벽·바위에 부딪혀 기절하는 시간
  chargeCd: 14,
  chargeRange: 800, // 이 안에 대상이 있어야 쓴다
  // 뒷발차기: 뒤에 붙은 대상
  kickTele: 1.2,
  kickHalf: Math.PI / 3, // 반각(전체 약 120도)
  kickRange: 130,
  kickDmg: 5,
  kickKnock: 170,
  kickRest: 0.6,
  kickCd: 8,
  // 선회 베기: 대상 둘레의 원 궤도를 크고 빠르게 돈다
  slashTele: 1.6,
  slashRadius: 350,
  slashBand: 70, // 궤도 안팎 폭의 절반
  slashSec: 2.5,
  slashDmg: 2, // 한 번 맞을 때(같은 대상은 0.45초에 한 번)
  slashKnock: 100,
  slashRest: 1,
  slashCd: 18,
  slashRange: 700,
  // 돌격 함성: 보스군 강화
  roarTele: 1.2,
  roarSec: 5,
  roarSpeed: 1.3,
  roarDmg: 1.2,
  roarCd: 25,
} as const;
