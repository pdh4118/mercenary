/* eslint-disable @typescript-eslint/no-explicit-any */
if (process.env.PERS !== "1") process.env.MERC_NO_PERSONALITY = "1"; // PERS=1이면 성격을 켠다
import { TUNE, UNIT_NAMES, UNIT_TYPES, TICK_RATE, MAX_TIER, MERC_XP_NEED, mercXpNeed } from "@mercenary/shared";
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
const stage = Number(process.env.STAGE ?? 3);
const seeds = Number(process.env.SEEDS ?? 4);
const secs = Number(process.env.SECS ?? 600);
const per = Number(process.env.PER ?? 4);
const bonus = Number(process.env.TB ?? TUNE.MXP_TIER_BONUS);
TUNE.MXP_TIER_BONUS = bonus;
if (process.env.NEED) process.env.NEED.split(",").forEach((v, i) => ((MERC_XP_NEED as any)[i] = Number(v)));
let topShare = UNIT_TYPES.map(() => 0);
let tiers = UNIT_TYPES.map(() => 0);
let maxT = UNIT_TYPES.map(() => 0);
let minT = UNIT_TYPES.map(() => 0);
let first = UNIT_TYPES.map(() => 0);
let gini = UNIT_TYPES.map(() => 0);
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
    const v = mine.map((r) => r.score).sort((x, y) => x - y);
    const n = v.length;
    const sum = v.reduce((x, y) => x + y, 0) || 1;
    gini[t]! += (v.reduce((x, y, i) => x + (2 * (i + 1) - n - 1) * y, 0) / (n * sum)) / seeds;
  }
}
console.log(`단계 보너스 ${bonus} / 병종당 ${per}명 / ${secs}초 / 스테이지 ${stage}`);
console.log("병종    ", UNIT_NAMES.map((x) => x.padStart(5)).join(" "));
console.log("1등 몫  ", topShare.map((x) => (x * 100).toFixed(0).padStart(4) + "%").join(" "), "(균등 = " + (100 / per).toFixed(0) + "%)");
console.log("지니    ", gini.map((x) => x.toFixed(2).padStart(5)).join(" "), "(0 = 완전 균등, 1 = 한 명이 전부)");
console.log("평균단계", tiers.map((x) => x.toFixed(2).padStart(5)).join(" "));
console.log("최고단계", maxT.map((x) => x.toFixed(2).padStart(5)).join(" "), " 최저단계", minT.map((x) => x.toFixed(2).padStart(5)).join(" "));
console.log("첫 강화 ", first.map((x) => (x.toFixed(0) + "s").padStart(5)).join(" "));
