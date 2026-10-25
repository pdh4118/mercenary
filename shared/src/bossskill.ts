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
export const BSK_CLONE = 6; // 창병 장군: 분신 돌진
export const BSK_GUARD = 7; // 창병 장군: 창 방어 태세
export const BSK_TRIPLE = 8; // 창병 장군: 장창 3연 찌르기
export const BSK_THROW = 9; // 창병 장군: 창 던지기
export const BSK_STEALTH = 10; // 궁병 장군: 은신 질주(→ 은신 저격)
export const BSK_SNIPE = 11; // 궁병 장군: 은신 저격(은신 질주에 이어 나온다)
export const BSK_ICEARROW = 12; // 궁병 장군: 얼음 화살 난사
export const BSK_RAIN = 13; // 궁병 장군: 화살비
export const BSK_REFLECT = 14; // 검방병 장군: 반사 태세
export const BSK_AREAINV = 15; // 검방병 장군: 운석 맞춤 무적
export const BSK_SHIELDRUSH = 16; // 검방병 장군: 방패 돌진
export const BSK_SUMMON = 17; // 검방병 장군: 사수 소환과 거대 방패
export const BSK_JUMP = 18; // 둔기병 장군: 점프 쿵
export const BSK_MACETHROW = 19; // 둔기병 장군: 거대 철퇴 투척
export const BSK_FLURRY = 20; // 둔기병 장군: 철퇴 난타
export const BSK_WHIRL = 21; // 둔기병 장군: 휠윈드
export const BSK_ICEPRISON = 22; // 마법사 장군: 얼음 감옥 + 메테오
export const BSK_MAGICSHIELD = 23; // 마법사 장군: 매직 쉴드
export const BSK_BLINK = 24; // 마법사 장군: 위협 순간이동
export const BSK_FIRERING = 25; // 마법사 장군: 확산 불꽃
export const BSK_HITRUN = 26; // 기마궁수: 치고 빠지기
export const BSK_ORBITSHOT = 27; // 기마궁수: 선회 사격
export const BSK_FIRETRAIL = 28; // 기마궁수: 불길 질주
export const BSK_LASSO = 29; // 기마궁수: 올가미 화살
export const BSK_ACCEL = 30; // 전차: 가속 돌진
export const BSK_SCYTHE = 31; // 전차: 낫 바퀴
export const BSK_DRIFT = 32; // 전차: 급선회 파쇄
export const BSK_RAMPAGE = 33; // 전차: 폭주
export const BOSS_SKILL_NAMES: Record<number, string> = {
  [BSK_SPRINT]: "질주",
  [BSK_CHARGE]: "돌진",
  [BSK_KICK]: "뒷발차기",
  [BSK_SLASH]: "선회 베기",
  [BSK_ROAR]: "돌격 함성",
  [BSK_CLONE]: "분신 돌진",
  [BSK_GUARD]: "창 방어 태세",
  [BSK_TRIPLE]: "장창 3연 찌르기",
  [BSK_THROW]: "창 던지기",
  [BSK_STEALTH]: "은신 질주",
  [BSK_SNIPE]: "은신 저격",
  [BSK_ICEARROW]: "얼음 화살 난사",
  [BSK_RAIN]: "화살비",
  [BSK_REFLECT]: "반사 태세",
  [BSK_AREAINV]: "운석 맞춤 무적",
  [BSK_SHIELDRUSH]: "방패 돌진",
  [BSK_SUMMON]: "사수 소환",
  [BSK_JUMP]: "점프 쿵",
  [BSK_MACETHROW]: "거대 철퇴 투척",
  [BSK_FLURRY]: "철퇴 난타",
  [BSK_WHIRL]: "휠윈드",
  [BSK_ICEPRISON]: "얼음 감옥",
  [BSK_MAGICSHIELD]: "매직 쉴드",
  [BSK_BLINK]: "순간이동",
  [BSK_FIRERING]: "확산 불꽃",
  [BSK_HITRUN]: "치고 빠지기",
  [BSK_ORBITSHOT]: "선회 사격",
  [BSK_FIRETRAIL]: "불길 질주",
  [BSK_LASSO]: "올가미 화살",
  [BSK_ACCEL]: "가속 돌진",
  [BSK_SCYTHE]: "낫 바퀴",
  [BSK_DRIFT]: "급선회 파쇄",
  [BSK_RAMPAGE]: "폭주",
};

/** 장군 상태 비트(적 전송값의 14번째): 클라이언트가 색·투명도·표시를 바꾼다 */
export const EF_SPRINT = 1; // 질주 중
export const EF_STEALTH = 2; // 은신 중(거의 투명, 미니맵에서 숨김)
export const EF_GUARD = 4; // 방어·반사 태세
export const EF_INVULN = 8; // 무적(황금 막)
export const EF_CORNERED = 16; // 궁지에 몰림
export const EF_BUBBLE = 32; // 매직 쉴드
export const EF_STUN = 64; // 기절·그로기
export const EF_MAD = 128; // 광분(바퀴가 붉게 달아오름)
export const EF_SCYTHE = 256; // 낫 바퀴
export const EF_WHIRL = 512; // 휠윈드로 도는 중(칼날바람 소용돌이)

/** 장판·장애물(hazard) 종류. 전송값: [id, 종류, x, y, 방향, a, b, 남은 시간(0.1초), 전체 시간(0.1초), 상태(0 예고, 1 작동)] */
export const HZ_FIRE = 1; // 불길 장판: a = 반지름
export const HZ_SPEAR = 2; // 박힌 창(장애물): 방향
export const HZ_MACE = 3; // 박힌 철퇴(장애물)
export const HZ_SHIELD = 4; // 거대 방패 벽: a = 반길이, b = 남은 체력 %
export const HZ_ICE = 5; // 얼음벽 조각: a = 반길이, b = 남은 횟수
export const HZ_RAIN = 6; // 화살비: a = 반지름(떨어지기 전에는 예고 원)
export const HZ_GHOST = 7; // 분신: a = 보스 그림 번호
export const HZ_RING = 8; // 퍼지는 불꽃 고리: a = 현재 반지름, b = 틈 반각(라디안), 방향 = 틈 중심
export type HazardWire = [id: number, kind: number, x: number, y: number, ang: number, a: number, b: number, left: number, total: number, state: number];

/** 보스 투사체 그림 종류(탄환 전송값의 5번째) */
export const BUL_ICE = 2; // 얼음 화살
export const BUL_SNIPE = 3; // 저격 볼트
export const BUL_SPEAR = 4; // 던진 창
export const BUL_MACE = 5; // 던진 거대 철퇴(그림만, 피해는 서버가 시간에 맞춰 준다)
export const BUL_LASSO = 6; // 올가미 화살
export const BUL_SHARD = 7; // 철퇴 파편
export const BUL_BOSSARROW = 8; // 기마궁수의 화살

/** 아군 상태이상 종류 */
export const ST_STUN = 1; // 기절: 움직이지도 공격하지도 못한다
export const ST_SLOW = 2; // 둔화: 이동 속도가 줄어든다
export const ST_ROOT = 3; // 속박: 움직이지 못한다(공격은 한다)

/** 예고 모양 */
export const TELE_LINE = 0; // 직선: 시작점(x,y), 방향(ang), a = 길이, b = 폭
export const TELE_CIRCLE = 1; // 원: 중심(x,y), a = 반지름
export const TELE_CONE = 2; // 부채꼴: 꼭짓점(x,y), 방향(ang), a = 반각(라디안), b = 반지름
export const TELE_BAND = 3; // 고리 띠: 중심(x,y), a = 안쪽 반지름, b = 바깥 반지름
export const TELE_RING = 4; // 틈이 있는 고리: 중심(x,y), 방향 = 틈 중심, a = 틈 반각, b = 최대 반지름
/** 예고 한 개: [모양, x, y, ang, a, b, 남은 시간(0.1초), 전체 시간(0.1초), 스킬 번호] */
export type TeleWire = [kind: number, x: number, y: number, ang: number, a: number, b: number, left: number, total: number, skill: number];

/** 보스 효과 이벤트(EVT_BOSSFX)의 종류(val) */
export const BFX_IMPACT = 1; // 돌진·뒷발차기가 맞음(충돌 섬광과 먼지)
export const BFX_SLASH = 2; // 선회 베기의 호(ang = 휘두르는 방향)
export const BFX_ROAR = 3; // 돌격 함성(군기 오라)
export const BFX_CRASH = 4; // 돌진이 방벽·바위에 부딪힘
export const BFX_ICEBREAK = 5; // 얼음벽 조각이 부서짐
export const BFX_SHIELDBREAK = 6; // 거대 방패가 부서짐
export const BFX_BLINK = 7; // 순간이동(마법진 섬광)
export const BFX_BACKSTEP = 11; // 뒤로 훌쩍 물러나는 먼지(ang = 물러나는 방향)
export const BFX_THRUST = 10; // 창을 앞으로 찌르는 줄기(ang = 찌르는 방향, 길이는 이벤트의 owner 값)
export const BFX_MACEBOOM = 9; // 점프 쿵: 던진 철퇴가 땅에 닿는 폭발 그림(ang x 100 = 반경)

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
  slashTele: 1.4,
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

/** 스테이지별 장군 체력 배율(기본 공식 대비). 기마궁수는 약하다. */
export const BOSS_HP_STAGE_MULT: Record<number, number> = { 7: 0.4 };

/** 창병 장군(스테이지 2) 수치 */
export const BOSS_SPEAR = {
  firstDelay: 3,
  idleMin: 1,
  idleMax: 2.4,
  // 분신 돌진: 범위 안 주인공(플레이어)마다 분신이 한 명씩 돌진한다
  cloneRange: 450,
  cloneTele: 1.6,
  cloneSpeed: 2400, // 예고(cloneTele)가 끝나면 매우 빠르게 돌진한다
  cloneWidth: 40,
  cloneDmg: 4,
  cloneKnock: 90,
  // 분신은 달려와 멈춘 뒤 창을 여러 번 찌르고 사라진다
  cloneStrikes: 4,
  cloneStrikeStep: 0.3,
  cloneStrikeRange: 260, // 멈춘 자리에서 이 안의 가장 가까운 아군을 향해 찌른다
  cloneStrikeLen: 170,
  cloneStrikeWidth: 60,
  cloneStrikeDmg: 1.5,
  cloneStrikeKnock: 35,
  cloneFade: 0.4,
  cloneCd: 16,
  // 창 방어 태세: 정면 부채꼴로 들어오는 대상을 찌르고 화살을 쓸어 낸다
  guardTele: 1.2,
  guardSec: 5,
  guardHalf: (Math.PI * 100) / 180 / 2,
  guardRange: 200,
  guardStep: 0.1, // 태세 중 이 간격으로 쉬지 않고 찌른다(아주 빠른 연속 찌르기)
  guardDmg: 0.45,
  guardKnock: 18,
  guardRest: 1,
  guardCd: 14,
  // 장창 3연 찌르기
  tripleTele: 1.3,
  tripleLen: 420,
  tripleWidth: 50,
  tripleGap: (Math.PI * 25) / 180,
  tripleStep: 0.07, // 예고가 끝나면 세 번을 아주 빠르게 연달아 찌른다
  tripleDmg: 3,
  tripleKnock: 60,
  tripleRest: 0.6,
  tripleCd: 8,
  // 창 던지기: 가장 먼 주인공에게, 관통
  throwTele: 1.4,
  throwSpeed: 1800,
  throwWidth: 40,
  throwLen: 1300,
  throwDmg: 5,
  throwCd: 11,
  throwObstacleSec: 4,
} as const;

/** 궁병 장군(스테이지 3) 수치 */
export const BOSS_ARCHER = {
  firstDelay: 3,
  idleMin: 1,
  idleMax: 2.2,
  reactCd: 15, // 위협 반응 스킬(은신 질주, 얼음 화살)의 쿨타임
  threatCav: 200, // 아군 기병이 이만큼 가까이 오면 위협
  threatSec: 2, // 주인공 근접 공격을 받은 뒤 위협으로 보는 시간
  // 은신 질주 → 은신 저격
  stealthTele: 0.5,
  stealthSec: 3,
  stealthMult: 2,
  stealthDist: 650, // 저격하러 가는 거리(대상에서)
  snipeTele: 1,
  snipeLen: 1500,
  snipeWidth: 50,
  snipeDmg: 9,
  snipeRest: 0.7,
  // 얼음 화살 난사
  iceTele: 1.2,
  iceCount: 10,
  iceFan: (Math.PI * 70) / 180,
  iceSpeed: 1100,
  iceBackSec: 0.3, // 쏘기 시작할 때 뒤로 훌쩍 물러나는 시간(주인공 궁수의 후퇴처럼)
  iceBackSpeed: 950,
  iceRange: 950,
  iceDmg: 1.6,
  iceSlowSec: 2.5,
  iceSlowMult: 0.6,
  // 화살비
  rainTele: 1,
  rainFall: 0.55, // 화살이 하늘에서 떨어지는 시간(예고 원이 차오르는 시간)
  rainGap: 0.04, // 화살 사이 간격
  rainArea: 260,
  rainR: 60,
  rainDmg: 3,
  rainPerPlayer: 4,
  rainMin: 8,
  rainMax: 22,
  rainCd: 15,
} as const;

/** 검방병 장군(스테이지 4) 수치 */
export const BOSS_SHIELD = {
  firstDelay: 3,
  idleMin: 1,
  idleMax: 2.4,
  reflectTele: 0.8,
  reflectSec: 3,
  reflectTaken: 0.3, // 반사 태세 중 보스가 받는 피해 비율
  reflectMult: 2, // 맞은 피해의 몇 배를 되돌리나
  reflectCd: 16,
  invHalf: 0.75, // 운석이 떨어지는 순간 앞뒤로 이만큼 무적
  invRadius: 300, // 무적이 되는 범위(보스 중심)
  rushTele: 1.2,
  rushLen: 600,
  rushWidth: 90,
  rushSpeed: 800,
  rushDmg: 4,
  rushKnock: 150,
  rushStun: 1,
  rushCd: 13,
  rushCrash: 2,
  summonTele: 1,
  summonCount: 4,
  summonCd: 28,
  shieldHpFrac: 0.14, // 거대 방패 체력(보스 최대 체력 대비)
  shieldHalf: 130,
  shieldThick: 24,
  shieldFront: 100,
  shieldMaxSec: 20,
  halfRushRadius: 170,
  halfRushStun: 1.5,
} as const;

/** 둔기병 장군(스테이지 5) 수치 */
export const BOSS_BLUNT = {
  firstDelay: 3,
  idleMin: 1,
  idleMax: 2.4,
  jumpRange: 520,
  jumpTele: 0.9,
  jumpRadius: 220,
  jumpDmg: 6,
  jumpStun: 1.5,
  jumpCd: 13,
  throwTele: 1.2,
  throwSpeed: 500,
  throwRange: 600,
  throwRadius: 140,
  throwDmg: 5,
  throwKnock: 150,
  throwCd: 12,
  maceMax: 2,
  flurryTele: 1.2,
  flurryHalf: (Math.PI * 140) / 180 / 2,
  flurryRange: 160,
  flurryHits: 5,
  flurryStep: 0.25,
  flurryDmg: 2.5,
  flurryKnock: 45,
  flurryAdvance: 120,
  flurryRest: 1.5,
  flurryCd: 8,
  whirlTele: 1.2,
  whirlRadius: 200,
  whirlSec: 3,
  whirlStep: 0.3,
  whirlDmg: 2,
  whirlKnock: 60,
  whirlSpeedMult: 0.6,
  whirlDizzy: 2,
  whirlCd: 16,
  shardCount: 3,
  shardDmg: 2,
} as const;

/** 마법사 장군(스테이지 6) 수치 */
export const BOSS_MAGE = {
  firstDelay: 3,
  idleMin: 1,
  idleMax: 2.4,
  prisonRange: 700,
  prisonTele: 1,
  prisonPieces: 8,
  prisonHits: 5,
  meteorSec: 2.5,
  meteorRadius: 140,
  meteorDmg: 1, // 적 마법사의 운석 피해(보스 기본 피해 55)와 같다
  prisonCd: 18,
  shieldTele: 1,
  shieldSec: 6,
  shieldAbsorb: 0.7,
  shieldHpFrac: 0.15,
  shieldStun: 1.5,
  shieldCd: 20,
  blinkThreat: 150,
  blinkMin: 400,
  blinkMax: 600,
  blinkTele: 0.5,
  blinkMeteorSec: 1.2,
  blinkCd: 12,
  ringTele: 1.2,
  ringSpeed: 300,
  ringMax: 600,
  ringWidth: 60,
  ringGap: (Math.PI * 60) / 180,
  ringDmg: 0.5,
  ringCd: 18,
} as const;

/** 기마궁수(스테이지 7) 수치 */
export const BOSS_MOUNT = {
  firstDelay: 2,
  idleMin: 0.8,
  idleMax: 1.8,
  speed: 330, // 이동 속도(px/s, 주인공 220보다 훨씬 빠르다)
  fleeBoost: 1.7, // 치고 빠지기 직후 도망 배율
  fleeRadius: 360, // 이 안에 아군이 있으면 도망친다
  keepDist: 480, // 평소 유지하는 거리
  shotCd: 1.3,
  shotDmg: 1.5,
  shotSpeed: 700,
  shotRange: 800,
  corneredRadius: 300,
  corneredGap: (Math.PI * 120) / 180,
  corneredMin: 3, // 이만큼 이상 둘러싸야 궁지로 본다
  corneredSec: 2.5,
  corneredSpeed: 0.3,
  corneredTaken: 1.5,
  breakDist: 650,
  breakSpeed: 900,
  breakDmg: 4,
  hitRunTele: 0.9,
  hitRunShots: 3,
  hitRunGap: 0.15,
  hitRunFlee: 1,
  hitRunCd: 6,
  orbitTele: 0.9,
  orbitSec: 5,
  orbitRadius: 420,
  orbitShotStep: 1,
  orbitCd: 12,
  trailTele: 0.9,
  trailLen: 720,
  trailSpeed: 700,
  trailStep: 38,
  trailR: 42,
  trailSec: 5,
  trailDps: 3,
  trailCd: 14,
  lassoTele: 0.9,
  lassoSpeed: 1000,
  lassoRoot: 1.5,
  lassoDmg: 1,
  lassoCharge: 800,
  lassoChargeDmg: 4,
  lassoCd: 12,
} as const;

/** 전차(스테이지 8) 수치 */
export const BOSS_CHARIOT = {
  firstDelay: 3,
  idleMin: 1,
  idleMax: 2.2,
  frontMult: 0.6, // 정면에서 받는 피해
  weakMult: 1.5, // 측면·후면에서 받는 피해
  frontHalf: (Math.PI * 60) / 180,
  accelTele: 0.9,
  accelLen: 900,
  accelStart: 260,
  accelRate: 900,
  accelMax: 900,
  accelLethal: 0.6, // 최대 속도의 이 비율을 넘으면 직격이 한 방
  accelWidth: 80,
  accelDmg: 6,
  accelStun: 3,
  accelRest: 1,
  accelCd: 10,
  scytheTele: 0.9,
  scytheSec: 4,
  scytheStep: 0.25,
  scytheRange: 120,
  scytheDmg: 3,
  scytheKnock: 60,
  scytheCd: 12,
  driftTele: 0.9,
  driftRange: 230,
  driftHalf: (Math.PI * 100) / 180,
  driftDmg: 6,
  driftKnock: 150,
  driftRest: 1.2,
  driftCd: 11,
  rampageTele: 1.5,
  rampageMax: 1500,
  rampageAccel: 1100,
  rampageStart: 300,
  rampageStopFrac: 0.3,
  rampageHitW: 90,
  rampageStun: 4,
  rampageCd: 40,
  breakWall: 0.25,
  breakMace: 0.25,
  breakSpear: 0.15,
} as const;

/** 보스 메테오 폭발 가장자리의 피해 감소 비율(적 마법사와 같다) */
export const MAGE_FALLOFF_FALLBACK = 0.4;
