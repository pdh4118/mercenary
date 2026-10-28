// 시험 전체의 난수를 고정한다: 게임이 난수를 따로 받지 않는 시험(`new Game()`)도 매번 같은 결과가 나오게 한다.
// 시드는 환경 변수 TEST_SEED로 바꿀 수 있다(여러 시드로 돌려 보면 난수에 기대는 약한 시험을 찾을 수 있다).
const seed = Number(process.env.TEST_SEED ?? 20260101) >>> 0;
let a = seed || 1;
Math.random = (): number => {
  // mulberry32
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// 용병 성격(능력치 보정·지시 무시)은 시험에서 끈다: 기존 시험은 용병이 지시를 항상 따르고 능력치가 기본값이라고 가정한다. 성격 시험은 game.personality = true로 켠다.
process.env.MERC_NO_PERSONALITY = "1";
