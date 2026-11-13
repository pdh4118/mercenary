/* eslint-disable @typescript-eslint/no-explicit-any */
if (process.env.PERS !== "1") process.env.MERC_NO_PERSONALITY = "1"; // PERS=1이면 성격을 켠다
import { MERC_XP_TYPE_MULT, TUNE, UNIT_NAMES, UNIT_TYPES, TICK_RATE, MAX_TIER, MERC_XP_NEED, mercXpNeed } from "@mercenary/shared";
import { Game } from "../src/game.js";
TUNE.ENEMY_CAV_RAM_FRAC = 0;
if (process.env.SM) TUNE.MXP_STREAK_MAX = Number(process.env.SM);
if (process.env.SS) TUNE.MXP_STREAK_MERIT = Number(process.env.SS); // SS = 연속 생존 최대까지 필요한 기여도
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
if (process.env.MT) process.env.MT.split(",").forEach((v, i) => ((MERC_XP_TYPE_MULT as any)[i] = Number(v))); // MT = 병종별 경험치 보정 6개(기병,창병,궁병,검방병,둔기병,마법사)
if (process.env.TJ) Object.assign(TUNE, JSON.parse(process.env.TJ)); // TJ = TUNE 덮어쓰기(JSON)
const stage = Number(process.env.STAGE ?? 3);
const seeds = Number(process.env.SEEDS ?? 4);
const secs = Number(process.env.SECS ?? 600);
const per = Number(process.env.PER ?? 4);
const bonus = Number(process.env.TB ?? TUNE.MXP_TIER_BONUS);
TUNE.MXP_TIER_BONUS = bonus;
TUNE.MERC_TIER_POWER = Number(process.env.TP ?? TUNE.MERC_TIER_POWER);
TUNE.MXP_DEATH_LOSS = Number(process.env.DL ?? TUNE.MXP_DEATH_LOSS);
if (process.env.NEED) process.env.NEED.split(",").forEach((v, i) => ((MERC_XP_NEED as any)[i] = Number(v)));
let topShare = UNIT_TYPES.map(() => 0);
let tiers = UNIT_TYPES.map(() => 0);
let maxT = UNIT_TYPES.map(() => 0);
let minT = UNIT_TYPES.map(() => 0);
let first = UNIT_TYPES.map(() => 0);
let gini = UNIT_TYPES.map(() => 0);
const avg0 = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
let tps = UNIT_TYPES.map(() => 0);
let stg = UNIT_TYPES.map(() => 0);
let blk = UNIT_TYPES.map(() => 0);
let dps = UNIT_TYPES.map(() => 0);
let totXp = UNIT_TYPES.map(() => 0);
let aliveFr = UNIT_TYPES.map(() => 0);
let dths = UNIT_TYPES.map(() => 0);
let sps = UNIT_TYPES.map(() => 0);
for (let sd = 1; sd <= seeds; sd++) {
  mul(sd * 104729 + stage);
  const g = new Game();
  (g as any).stage = stage;
  const a = g.addPlayer("snow")!;
  const p = g.getPlayer(a)!;
  const slot = (g as any).slots.get(a);
  if (process.env.GOLD === 'real') p.gold = Number(process.env.START_GOLD ?? 200);
  for (const t of UNIT_TYPES) for (let i = 0; i < per; i++) g.addMerc(a, t, p.x + 40 * (t - 2) + i * 15, p.y + 40 + 20 * i, 0, 0);
  const firstAt = UNIT_TYPES.map(() => -1);
  for (let i = 0; i < secs * TICK_RATE; i++) {
    g.step();
    p.hp = p.maxHp = 1e9;
    p.invuln = 1e9;
    if (process.env.GOLD === 'real' && process.env.AUTOPLAY !== '0') g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: false } as any);
    if (process.env.GOLD !== 'real') p.gold = Number(process.env.GOLD ?? 1e9);
    p.leadership = 1e9;
    if (i % TICK_RATE === 0) {
      for (const m of [...(g as any).mercs.values()].sort((x: any, y: any) => y.xp - x.xp)) {
        if (m.respawn <= 0 && m.tier < MAX_TIER && m.xp >= mercXpNeed(m.tier)) {
          g.upgrade(a, m.id);
          if (firstAt[m.type]! < 0) firstAt[m.type] = i / TICK_RATE;
        }
      }
    }
  }
  const rows = (g as any).result().players[0].mercList as any[];
  for (const t of UNIT_TYPES) {
    const mine = rows.filter((r) => r.type === t);
    const tot = mine.reduce((x, r) => x + r.score, 0) || 1;
    topShare[t]! += Math.max(...mine.map((r) => r.score)) / tot / seeds;
    tiers[t]! += mine.reduce((x, r) => x + r.tier, 0) / mine.length / seeds;
    maxT[t]! += Math.max(...mine.map((r) => r.tier)) / seeds;
    minT[t]! += Math.min(...mine.map((r) => r.tier)) / seeds;
    first[t]! += (firstAt[t]! < 0 ? secs : firstAt[t]!) / seeds;
    tps[t]! += mine.reduce((x, r) => x + (r.alive > 0 ? r.taken / r.alive : 0), 0) / mine.length / seeds;
    stg[t]! += mine.reduce((x, r) => x + (r.alive > 0 ? r.stagger / r.alive : 0), 0) / mine.length / seeds;
    blk[t]! += mine.reduce((x, r) => x + (r.alive > 0 ? (r.blocked + r.counter) / r.alive : 0), 0) / mine.length / seeds;
    dps[t]! += mine.reduce((x, r) => x + (r.alive > 0 ? r.dealt / r.alive : 0), 0) / mine.length / seeds;
    const live = [...(g as any).mercs.values()].filter((m: any) => m.type === t);
    totXp[t]! += live.reduce((x: number, m: any) => x + m.xp + MERC_XP_NEED.slice(0, m.tier).reduce((a, b) => a + b, 0), 0) / Math.max(1, live.length) / seeds;
    aliveFr[t]! += mine.reduce((x, r) => x + r.alive / secs, 0) / mine.length / seeds;
    dths[t]! += mine.reduce((x, r) => x + r.deaths, 0) / mine.length / seeds;
    sps[t]! += mine.reduce((x, r) => x + (r.alive > 0 ? r.score / r.alive : 0), 0) / mine.length / seeds;
    const v = mine.map((r) => r.score).sort((x, y) => x - y);
    const n = v.length;
    const sum = v.reduce((x, y) => x + y, 0) || 1;
    gini[t]! += (v.reduce((x, y, i) => x + (2 * (i + 1) - n - 1) * y, 0) / (n * sum)) / seeds;
  }
}
console.log(`쓰러짐 경험치 손실 ${TUNE.MXP_DEATH_LOSS} / 단계 경험치 보너스 ${bonus} / 능력치 보너스 ${TUNE.MERC_TIER_POWER} / 병종당 ${per}명 / ${secs}초 / 스테이지 ${stage}`);
console.log("병종    ", UNIT_NAMES.map((x) => x.padStart(5)).join(" "));
console.log("1등 몫  ", topShare.map((x) => (x * 100).toFixed(0).padStart(4) + "%").join(" "), "(균등 = " + (100 / per).toFixed(0) + "%)");
console.log("지니    ", gini.map((x) => x.toFixed(2).padStart(5)).join(" "), "(0 = 완전 균등, 1 = 한 명이 전부)");
console.log("평균단계", tiers.map((x) => x.toFixed(2).padStart(5)).join(" "));
console.log("최고단계", maxT.map((x) => x.toFixed(2).padStart(5)).join(" "), " 최저단계", minT.map((x) => x.toFixed(2).padStart(5)).join(" "));
console.log("초당기여", sps.map((x) => x.toFixed(1).padStart(5)).join(" "), " (5분 ≈", (avg0(sps) * 300).toFixed(0) + ")");
console.log("초당 준피해", dps.map((x) => x.toFixed(1).padStart(5)).join(" "));
console.log("초당 받은 ", tps.map((x) => x.toFixed(1).padStart(5)).join(" "));
console.log("초당 경직 ", stg.map((x) => x.toFixed(1).padStart(5)).join(" "));
console.log("초당 방어+반격", blk.map((x) => x.toFixed(1).padStart(5)).join(" "));
console.log("총경험치", totXp.map((x) => x.toFixed(0).padStart(5)).join(" "), " (강화에 쓴 것 포함)");
console.log("생존비율", aliveFr.map((x) => x.toFixed(2).padStart(5)).join(" "));
console.log("쓰러짐  ", dths.map((x) => x.toFixed(1).padStart(5)).join(" "));
console.log("첫 강화 ", first.map((x) => (x.toFixed(0) + "s").padStart(5)).join(" "));

const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`요약: 1등 몫 평균 ${(avg(topShare) * 100).toFixed(1)}% · 지니 평균 ${avg(gini).toFixed(3)} · 같은 병종 안 단계 차이(최고-최저) 평균 ${avg(maxT.map((x, i) => x - minT[i]!)).toFixed(2)} · 평균 단계 ${avg(tiers).toFixed(2)}`);
