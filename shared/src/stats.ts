import { UNIT_NAMES } from "./rules.js";

/**
 * 밸런스 통계: 한 판이 끝날 때 서버가 남기는 기록(MatchRecord)과, 기간 안의 기록을 한눈에 볼 수 있게 묶는 집계(aggregateStats).
 * 병종 배열은 모두 병종 번호(기병·창병·궁병·검방병·둔기병·마법사) 순서다.
 */
export interface PlayerRecord {
  diff: number; // 난이도(DIFFICULTY_REDUCTION 인덱스)
  level: number;
  kills: number;
  downs: number; // 주인공이 쓰러진 횟수
  hired: number[]; // 병종별 고용 횟수
  mercDeaths: number[]; // 병종별 용병 쓰러짐
  dealtMerc: number[]; // 병종별 용병이 적에게 준 피해
  dealtHero: number[]; // 주인공 무기(병종 속성)별 피해
  takenMerc: number[]; // 병종별 용병이 받은 피해
  takenHero: number;
  heroSec: number[]; // 무기별로 든 시간(초)
  cards: Record<string, number>;
  stage: Record<string, number[]>; // 스테이지 → [준 피해, 받은 피해, 주인공 쓰러짐, 용병 쓰러짐]
}

/** 토너먼트 한 경기에서 한쪽 선수의 기록 */
export interface TourSideRec {
  diff: number;
  level: number;
  weapon: number; // 경기 끝날 때 든 무기(병종 속성)
  mercs: number[]; // 경기 시작 때 병종별 용병 수
  dealtByType: number[]; // 상대에게 준 피해(병종 속성별: 주인공 무기와 같은 병종 용병 합계)
  takenMerc: number[]; // 병종별 용병이 받은 피해
  takenHero: number; // 주인공이 받은 피해
  mercDeaths: number[]; // 병종별 용병 쓰러짐
  avg: number; // 경기 내내 평균 남은 전력(%)
  end: number; // 끝날 때 남은 전력(%)
  down: boolean; // 주인공이 쓰러졌다
}

/** 토너먼트 한 경기 */
export interface TourMatchRecord {
  stage: number;
  round: string; // 결승·준결승·8강·16강
  dur: number; // 경기 시간(초)
  reason: "down" | "time" | "both"; // 주인공이 쓰러짐 / 시간 초과 / 동시에 쓰러짐
  winner: 0 | 1; // sides 인덱스
  sides: [TourSideRec, TourSideRec];
}

export interface MatchRecord {
  v: 1;
  t: number; // 끝난 시각(ms)
  dur: number; // 걸린 시간(초)
  stage: number; // 마지막으로 도달한 스테이지
  status: string; // victory / defeat / abandoned
  rush: boolean; // 보스 연습 방
  clears: [stage: number, time: number][]; // 장군을 쓰러뜨린 게임 시간
  skips: number[]; // 못 잡아서 시간 초과로 넘어간 스테이지
  players: PlayerRecord[];
  tour?: TourMatchRecord[]; // 토너먼트 경기들(없으면 열리지 않은 판)
}

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const avg = (a: number, n: number): number => (n > 0 ? Math.round((a / n) * 10) / 10 : 0);
const at = (a: readonly number[] | undefined, i: number): number => a?.[i] ?? 0;

export interface StatsOptions {
  /** 보스 연습 방 기록도 넣는다(기본은 뺀다) */
  includeRush?: boolean;
  /** 이 시간(ms) 이후에 끝난 기록만 */
  since?: number;
  until?: number;
  /** 난이도(DIFFICULTY_REDUCTION 인덱스)가 같은 플레이어가 있는 판만 */
  diff?: number;
  /** 너무 짧은 판(초)은 뺀다 */
  minDur?: number;
}

export function aggregateStats(records: readonly MatchRecord[], opt: StatsOptions = {}) {
  const ms = records.filter((m) => (opt.includeRush || !m.rush) && (opt.since === undefined || m.t >= opt.since) && (opt.until === undefined || m.t <= opt.until) && m.dur >= (opt.minDur ?? 20) && (opt.diff === undefined || m.players.some((p) => p.diff === opt.diff)));
  const players = ms.flatMap((m) => m.players.filter((p) => opt.diff === undefined || p.diff === opt.diff).map((p) => ({ m, p })));
  const N = players.length;
  const finished = ms.filter((m) => m.status === "victory" || m.status === "defeat");

  // 병종별
  const types = UNIT_NAMES.map((name, t) => {
    const hired = players.reduce((a, { p }) => a + at(p.hired, t), 0);
    const usedBy = players.filter(({ p }) => at(p.hired, t) > 0).length;
    const dealt = players.reduce((a, { p }) => a + at(p.dealtMerc, t), 0);
    const taken = players.reduce((a, { p }) => a + at(p.takenMerc, t), 0);
    const deaths = players.reduce((a, { p }) => a + at(p.mercDeaths, t), 0);
    return { type: t, name, hired, usedBy, dealt, taken, deaths };
  });
  const totalHired = sum(types.map((x) => x.hired));
  const totalDealtMerc = sum(types.map((x) => x.dealt));
  const totalTaken = sum(types.map((x) => x.taken));
  const mercs = types.map((x) => ({
    type: x.type,
    name: x.name,
    hired: x.hired,
    hireShare: pct(x.hired, totalHired), // 전체 고용 중 비율(%)
    usedRate: pct(x.usedBy, N), // 이 병종을 한 번이라도 고용한 플레이어 비율(%)
    avgHired: avg(x.hired, N), // 플레이어당 평균 고용 수
    dealt: Math.round(x.dealt),
    dealtShare: pct(x.dealt, totalDealtMerc), // 용병 전체 피해 중 비율(%)
    dealtPerHired: x.hired ? Math.round(x.dealt / x.hired) : 0, // 고용 1명당 준 피해
    taken: Math.round(x.taken),
    takenShare: pct(x.taken, totalTaken),
    deaths: x.deaths,
    deathsPerHired: x.hired ? Math.round((x.deaths / x.hired) * 100) / 100 : 0, // 고용 1명당 쓰러진 횟수
    deathsPerPlayer: avg(x.deaths, N),
  }));

  // 주인공 무기별(병종 속성)
  const heroSecTotal = sum(types.map((_, t) => players.reduce((a, { p }) => a + at(p.heroSec, t), 0)));
  const heroDealtTotal = sum(types.map((_, t) => players.reduce((a, { p }) => a + at(p.dealtHero, t), 0)));
  const weapons = UNIT_NAMES.map((name, t) => {
    const sec = players.reduce((a, { p }) => a + at(p.heroSec, t), 0);
    const dealt = players.reduce((a, { p }) => a + at(p.dealtHero, t), 0);
    return { type: t, name, sec: Math.round(sec), secShare: pct(sec, heroSecTotal), dealt: Math.round(dealt), dealtShare: pct(dealt, heroDealtTotal), dps: sec > 0 ? Math.round((dealt / sec) * 10) / 10 : 0 };
  });

  // 스테이지별
  const stages = Array.from({ length: 10 }, (_, i) => {
    const st = i + 1;
    const reached = ms.filter((m) => m.stage >= st).length;
    const cleared = ms.filter((m) => m.clears.some(([s]) => s === st)).length;
    const skipped = ms.filter((m) => m.skips.includes(st)).length;
    let lenSum = 0;
    let lenN = 0;
    for (const m of ms) {
      const cs = [...m.clears].sort((a, b) => a[1] - b[1]);
      const idx = cs.findIndex(([s]) => s === st);
      if (idx < 0) continue;
      lenSum += cs[idx]![1] - (idx > 0 ? cs[idx - 1]![1] : 0);
      lenN++;
    }
    const rows = players.map(({ p }) => p.stage[String(st)]).filter((r): r is number[] => !!r);
    const rsum = (k: number) => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
    return {
      stage: st,
      reached,
      reachRate: pct(reached, ms.length),
      clearRate: pct(cleared, reached), // 도달한 판 중 장군을 쓰러뜨린 비율(%)
      skipped,
      avgLen: lenN ? Math.round(lenSum / lenN) : 0, // 이 스테이지를 깨는 데 걸린 평균 시간(초)
      avgHeroDowns: avg(rsum(2), rows.length),
      avgMercDeaths: avg(rsum(3), rows.length),
      avgDealt: rows.length ? Math.round(rsum(0) / rows.length) : 0,
      avgTaken: rows.length ? Math.round(rsum(1) / rows.length) : 0,
    };
  });

  // 카드
  const cardMap = new Map<string, number>();
  for (const { p } of players) for (const [k, v] of Object.entries(p.cards)) cardMap.set(k, (cardMap.get(k) ?? 0) + v);
  const cards = [...cardMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([name, count]) => ({ name, count }));

  // 난이도, 인원
  const diffMap = new Map<number, number>();
  for (const { p } of players) diffMap.set(p.diff, (diffMap.get(p.diff) ?? 0) + 1);
  const sizeMap = new Map<number, number>();
  for (const m of ms) sizeMap.set(m.players.length, (sizeMap.get(m.players.length) ?? 0) + 1);

  // 토너먼트 경기
  const tm = ms.flatMap((m) => m.tour ?? []);
  const sides = tm.flatMap((x) => x.sides.map((sd, i) => ({ sd, won: x.winner === i, x })));
  const S = sides.length;
  const timeouts = tm.filter((x) => x.reason === "time");
  const flipped = timeouts.filter((x) => {
    const endLead = x.sides[0].end === x.sides[1].end ? -1 : x.sides[0].end > x.sides[1].end ? 0 : 1;
    return endLead >= 0 && endLead !== x.winner; // 끝날 때 전력이 앞선 쪽이 졌다(평균 전력 판정이 결과를 바꾼 경기)
  });
  const roundMap = new Map<string, number>();
  for (const x of tm) roundMap.set(x.round, (roundMap.get(x.round) ?? 0) + 1);
  const tourTypeSum = (t: number) => sides.reduce((a, { sd }) => a + at(sd.dealtByType, t), 0);
  const tourDealtAll = sum(UNIT_NAMES.map((_, t) => tourTypeSum(t)));
  const tour = {
    matches: tm.length,
    avgDur: avg(sum(tm.map((x) => x.dur)), tm.length),
    reasons: { down: pct(tm.filter((x) => x.reason === "down").length, tm.length), time: pct(timeouts.length, tm.length), both: pct(tm.filter((x) => x.reason === "both").length, tm.length) },
    timeouts: timeouts.length,
    flipped: flipped.length, // 시간 초과 경기 중, 끝날 때 전력이 앞선 쪽이 평균 판정으로 진 경기
    flipRate: pct(flipped.length, timeouts.length),
    avgMargin: avg(sum(timeouts.map((x) => Math.abs(x.sides[0].avg - x.sides[1].avg))), timeouts.length), // 평균 전력 차(%p)
    rounds: [...roundMap.entries()].map(([round, count]) => ({ round, count })),
    weapons: UNIT_NAMES.map((name, t) => {
      const w = sides.filter(({ sd }) => sd.weapon === t);
      const wins = w.filter((x) => x.won).length;
      return { type: t, name, picks: w.length, pickRate: pct(w.length, S), wins, winRate: pct(wins, w.length), avgDealt: w.length ? Math.round(sum(w.map(({ sd }) => sum(sd.dealtByType))) / w.length) : 0, avgTaken: w.length ? Math.round(sum(w.map(({ sd }) => sd.takenHero + sum(sd.takenMerc))) / w.length) : 0 };
    }),
    mercs: UNIT_NAMES.map((name, t) => {
      const has = sides.filter(({ sd }) => at(sd.mercs, t) > 0);
      const no = sides.filter(({ sd }) => at(sd.mercs, t) === 0);
      const winners = sides.filter((x) => x.won);
      const losers = sides.filter((x) => !x.won);
      const mean = (arr: typeof sides) => (arr.length ? Math.round((sum(arr.map(({ sd }) => at(sd.mercs, t))) / arr.length) * 100) / 100 : 0);
      const deaths = sum(sides.map(({ sd }) => at(sd.mercDeaths, t)));
      const hired = sum(sides.map(({ sd }) => at(sd.mercs, t)));
      return {
        type: t,
        name,
        presentRate: pct(has.length, S), // 이 병종이 있던 선수 비율
        avgCount: mean(sides),
        winRateWith: pct(has.filter((x) => x.won).length, has.length),
        winRateWithout: pct(no.filter((x) => x.won).length, no.length),
        avgWinners: mean(winners), // 이긴 선수의 평균 수
        avgLosers: mean(losers), // 진 선수의 평균 수
        dealtShare: pct(tourTypeSum(t), tourDealtAll),
        dealtPerUnit: hired ? Math.round(tourTypeSum(t) / hired) : 0, // 경기에 나온 1명(주인공 무기 포함 안 함)당 준 피해(병종 속성 합계 기준)
        deathsPerUnit: hired ? Math.round((deaths / hired) * 100) / 100 : 0,
      };
    }),
  };

  return {
    matches: ms.length,
    players: N,
    victoryRate: pct(finished.filter((m) => m.status === "victory").length, finished.length),
    abandonRate: pct(ms.filter((m) => m.status === "abandoned").length, ms.length),
    avgDur: avg(sum(ms.map((m) => m.dur)), ms.length),
    avgStage: avg(sum(ms.map((m) => m.stage)), ms.length),
    avgLevel: avg(players.reduce((a, { p }) => a + p.level, 0), N),
    avgHeroDowns: avg(players.reduce((a, { p }) => a + p.downs, 0), N),
    avgHeroTaken: N ? Math.round(players.reduce((a, { p }) => a + p.takenHero, 0) / N) : 0,
    mercs,
    weapons,
    stages,
    cards,
    difficulty: [...diffMap.entries()].sort((a, b) => a[0] - b[0]).map(([diff, count]) => ({ diff, count })),
    tour,
    sizes: [...sizeMap.entries()].sort((a, b) => a[0] - b[0]).map(([players, count]) => ({ players, count })),
  };
}
