/* eslint-disable @typescript-eslint/no-explicit-any */
// 스테이지를 실제로 진행시키며 용병이 몇 단계까지 크는지 본다. 주인공은 가만히 서 있고(무적), 용병은 일정 간격으로 늘어난다.
if (process.env.PERS !== "1") process.env.MERC_NO_PERSONALITY = "1";
import { TUNE, UNIT_TYPES, TICK_RATE, MAX_TIER, mercXpNeed, STAGE_COUNT, mercLevel, promoLevel } from "@mercenary/shared";
import { Game } from "../src/game.js";
TUNE.ENEMY_CAV_RAM_FRAC = 0;
const mul = (seed: number) => {
  let a = seed >>> 0 || 1;
  Math.random = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
if (process.env.TJ) Object.assign(TUNE, JSON.parse(process.env.TJ)); // TJ = TUNE 덮어쓰기(JSON). 예: {"BOSS_HARD_TIMEOUT_SEC":100}은 보스를 못 잡아도 100초 뒤 다음 스테이지로
if (process.env.LV_MODE) TUNE.LV_MODE = Number(process.env.LV_MODE);
const seeds = Number(process.env.SEEDS ?? 3);
const maxSec = Number(process.env.SECS ?? 1800);
const start = Number(process.env.START ?? 6); // 처음 용병 수
const every = Number(process.env.EVERY ?? 60); // 몇 초마다 한 명씩 늘리나
const cap = Number(process.env.CAP ?? 24);
const marks = [2, 4, 6, 8, 10];
const agg: Record<number, { lvAvg: number; lvMax: number; lvMin: number; t: number; n: number; max: number; avg: number; cnt: number; sec: number }> = {};
for (let sd = 1; sd <= seeds; sd++) {
  mul(sd * 7919);
  const g = new Game();
  const a = g.addPlayer("run")!;
  const p = g.getPlayer(a)!;
  p.gold = Number(process.env.START_GOLD ?? 200);
  let n = 0;
  const add = () => { g.addMerc(a, UNIT_TYPES[n % 6]!, p.x + 40 * ((n % 6) - 2) + (n % 5) * 15, p.y + 40 + 20 * (n % 4), 0, 0); n++; };
  for (let i = 0; i < start; i++) add();
  const seen = new Set<number>();
  for (let i = 0; i < maxSec * TICK_RATE; i++) {
    g.step();
    p.hp = p.maxHp = 1e9;
    p.invuln = 1e9;
    p.leadership = 1e9;
    g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false } as any);
    const sec = i / TICK_RATE;
    if (i % TICK_RATE === 0) {
      if (sec > 0 && sec % every === 0 && n < cap) add();
      for (const m of [...(g as any).mercs.values()].sort((x: any, y: any) => y.xp - x.xp)) {
        if (m.respawn <= 0 && m.tier < MAX_TIER && (TUNE.LV_MODE ? mercLevel(m.xp) >= promoLevel(m.tier) : m.xp >= mercXpNeed(m.tier))) g.upgrade(a, m.id);
      }
    }
    const st = (g as any).stage as number;
    if (marks.includes(st) && !seen.has(st) && (g as any).phase !== "boss") {
      // 스테이지에 처음 들어선 순간의 단계 분포를 적는다(들어선 직후)
    }
    if (!seen.has(st)) {
      seen.add(st);
      const ms = [...(g as any).mercs.values()];
      const e = (agg[st] ??= { lvAvg: 0, lvMax: 0, lvMin: 0, t: 0, n: 0, max: 0, avg: 0, cnt: 0, sec: 0 });
      e.cnt++;
      const lvs = ms.map((m: any) => mercLevel(m.xp));
      e.lvAvg += lvs.reduce((x: number, y: number) => x + y, 0) / Math.max(1, lvs.length);
      e.lvMax += Math.max(0, ...lvs);
      e.lvMin += Math.min(...(lvs.length ? lvs : [0]));
      e.sec += sec;
      e.n += ms.length;
      e.max += ms.filter((m: any) => m.tier >= MAX_TIER).length;
      e.avg += ms.reduce((x: number, m: any) => x + m.tier, 0) / Math.max(1, ms.length);
    }
    if ((g as any).status === "victory" || (g as any).status === "defeat") break;
  }
}
console.log(`시험: 시작 용병 ${start}명, ${every}초마다 +1(최대 ${cap}), 시드 ${seeds}, 최대 ${maxSec}초`);
console.log("스테이지 진입 시점  (평균 시각 · 용병 수 · 최종단계 도달 수 · 평균 단계)  [표본 수]");
for (const st of Object.keys(agg).map(Number).sort((x, y) => x - y)) {
  const e = agg[st]!;
  console.log(`스테이지 ${String(st).padStart(2)}  ${Math.round(e.sec / e.cnt / 60).toString().padStart(3)}분  ${(e.n / e.cnt).toFixed(1).padStart(5)}명  최종 ${(e.max / e.cnt).toFixed(1).padStart(4)}명  평균 ${(e.avg / e.cnt).toFixed(2)}  [${e.cnt}]`);
}
if (TUNE.LV_MODE) for (const st of Object.keys(agg).map(Number).sort((x, y) => x - y)) { const e = agg[st]!; console.log(`스테이지 ${st} 레벨 평균 ${(e.lvAvg / e.cnt).toFixed(1)} · 최고 ${(e.lvMax / e.cnt).toFixed(1)} · 최저 ${(e.lvMin / e.cnt).toFixed(1)}`); }
void STAGE_COUNT;
