import { ARCHER, BLUNT, CAVALRY, MAGE, SHIELD, SPEAR, TUNE } from "./rules.js";

/**
 * 용병 승급 스킬. 승급 단계 n(1~4)에 도달하면 n번째 스킬을 얻는다. 1·3단계는 패시브, 2·4단계는 액티브(자동 발동).
 * 레벨 모드(TUNE.LV_MODE = 1)에서만 켜진다. 설계: docs/merc-skill-design.md
 */
export interface MercSkill {
  name: string;
  kind: "passive" | "active";
  desc: string;
}
export const MERC_SKILLS: Record<number, readonly MercSkill[]> = {
  [ARCHER]: [
    { name: "독 화살", kind: "passive", desc: "화살에 독이 묻어 맞은 적이 계속 피해를 입는다" },
    { name: "뒤로 점프", kind: "active", desc: "적이 붙으면 뒤로 크게 뛰어 거리를 벌린다" },
    { name: "얼음 화살", kind: "passive", desc: "맞은 적이 2초간 이동 속도 30% 느려진다" },
    { name: "은신", kind: "active", desc: "3초간 모습을 감추고, 풀리며 쏘는 첫 화살이 1.8배" },
  ],
  [CAVALRY]: [
    { name: "돌파", kind: "passive", desc: "돌격이 적을 뚫고 지나가며 다음 적 최대 2명에게 60% 피해" },
    { name: "일제 질주", kind: "active", desc: "곁의 기병들과 함께 한 번에 질주한다" },
    { name: "철갑마", kind: "passive", desc: "돌격 중 받는 피해 25% 감소" },
    { name: "환영 기병대", kind: "active", desc: "환영 기병 3기가 일직선으로 돌격한다" },
  ],
  [SPEAR]: [
    { name: "관통 찌르기", kind: "passive", desc: "창이 길어져 더 먼 적까지 꿰뚫는다" },
    { name: "창 던지기", kind: "active", desc: "체력이 가장 많은 적에게 창을 던져 3배 피해" },
    { name: "연속 찌르기", kind: "passive", desc: "25% 확률로 한 번 더 찌른다(70% 피해)" },
    { name: "돌진 찌르기", kind: "active", desc: "적에게 돌진하며 강하게 찌른다" },
  ],
  [SHIELD]: [
    { name: "가시 방패", kind: "passive", desc: "방패로 막은 피해의 25%를 공격자에게 되돌린다" },
    { name: "방패 밀치기", kind: "active", desc: "앞의 적을 밀쳐 내며 잠깐 기절시킨다" },
    { name: "수호", kind: "passive", desc: "곁 아군이 받는 피해의 15%를 대신 받는다" },
    { name: "도발 결계", kind: "active", desc: "주변 적을 모두 자신에게 끌어당기는 결계" },
  ],
  [BLUNT]: [
    { name: "분쇄", kind: "passive", desc: "방패·갑옷이 있는 적에게 피해 +30%" },
    { name: "도약 내려찍기", kind: "active", desc: "적 무리 속으로 뛰어올라 내려찍는다" },
    { name: "충격파", kind: "passive", desc: "경직시킨 적 주변으로 30% 확률로 경직이 번진다" },
    { name: "지진", kind: "active", desc: "땅을 내리쳐 넓은 범위를 경직시킨다" },
  ],
  [MAGE]: [
    { name: "마력 집중", kind: "passive", desc: "시전 시간 15% 감소, 폭발 반경 10% 증가" },
    { name: "점멸", kind: "active", desc: "위험하면 순간이동으로 빠져나간다" },
    { name: "불씨", kind: "passive", desc: "운석이 떨어진 자리에 3초간 불이 남아 피해를 준다" },
    { name: "연쇄 운석", kind: "active", desc: "운석 3발을 연달아 떨어뜨린다" },
  ],
};

/** 패시브 수치 */
export const SK = {
  poisonMult: 0.6, // 독 화살: 화살 피해 대비 독 총피해(POISON_SEC에 걸쳐)
  iceSec: 2,
  iceMult: 0.7, // 얼음 화살: 이동 속도 배율
  breakCount: 2, // 돌파: 추가로 맞는 적 수
  breakFrac: 0.6,
  breakRange: 110, // 돌파: 첫 대상에서 이 거리 안의 적
  ironHorse: 0.25, // 철갑마: 돌격 중 받는 피해 감소
  reachMult: 1.25, // 관통 찌르기: 창 길이
  doubleChance: 0.25, // 연속 찌르기
  doubleFrac: 0.7,
  thorns: 0.25, // 가시 방패
  guard: 0.15, // 수호
  guardRange: 130,
  crush: 0.3, // 분쇄
  shockChance: 0.3, // 충격파
  shockRange: 110,
  shockCount: 2, // 번지는 적 수
  shockFrac: 0.5, // 번진 경직 길이(원래 대비)
  focusCast: 0.15, // 마력 집중: 시전 시간 감소
  focusArea: 0.1,
  emberSec: 3, // 불씨
  emberDps: 0.35, // 운석 피해 대비 초당
  stealthSec: 3, // 은신
  stealthBonus: 1.8,
  jumpDist: 230, // 뒤로 점프
  jumpTrigger: 110,
  blinkDist: 300, // 점멸
  blinkTrigger: 130,
  dashSec: 2.5, // 일제 질주
  dashSpeed: 1.5,
  dashRadius: 520,
  phantomDmg: 2.4, // 환영 기병대: 기병 공격력 배율
  phantomLen: 600,
  phantomWid: 140,
  throwDmg: 3, // 창 던지기
  throwRange: 650,
  lungeDmg: 2.2, // 돌진 찌르기
  lungeRange: 480,
  bashDmg: 0.8, // 방패 밀치기
  bashKnock: 170,
  bashStun: 1,
  tauntSec: 4, // 도발 결계
  tauntRange: 330,
  tauntWeight: 6,
  leapDmg: 2, // 도약 내려찍기
  leapRange: 460,
  leapRadius: 140,
  leapStun: 0.8,
  quakeDmg: 1.2, // 지진
  quakeRadius: 300,
  quakeStun: 1.5,
  chainCount: 3, // 연쇄 운석
  chainGap: 0.5,
} as const;

/** 액티브 쿨다운(초): [2단계, 4단계] */
export const ACTIVE_CD: Record<number, readonly [number, number]> = {
  [ARCHER]: [12, 20],
  [CAVALRY]: [14, 24],
  [SPEAR]: [15, 18],
  [SHIELD]: [10, 24],
  [BLUNT]: [14, 25],
  [MAGE]: [14, 24],
};

/** 스킬 n(1~4)을 쓸 수 있는가: 레벨 모드이고 승급 단계가 n 이상 */
export const skillOn = (type: number, tier: number, n: number): boolean => TUNE.LV_MODE === 1 && tier >= n && MERC_SKILLS[type] !== undefined;
