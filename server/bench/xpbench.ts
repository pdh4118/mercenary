/* eslint-disable @typescript-eslint/no-explicit-any */
process.env.MERC_NO_PERSONALITY = "1";
import { TUNE, UNIT_NAMES, UNIT_TYPES, TICK_RATE } from "@mercenary/shared";
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
const stages = (process.env.STAGES ?? "2,5,8").split(",").map(Number);
const seeds = Number(process.env.SEEDS ?? 5);
const secs = Number(process.env.SECS ?? 240);
const per = Number(process.env.PER ?? 3);
const tier = Number(process.env.TIER ?? 0);
const rows: Record<string, number[]> = {};
const xpRows: Record<string, number[]> = {};
const brk: number[][] = UNIT_TYPES.map(() => [0, 0, 0, 0, 0, 0]); // 준피해·받은피해·막기·막타·특기·어시스트(남은 몫)
const cnt: number[][] = UNIT_TYPES.map(() => [0, 0, 0, 0]); // 킬·어시·죽음·분
let runs = 0;
for (const st of stages) {
  for (let sd = 1; sd <= seeds; sd++) {
    mul(sd * 7919 + st);
    const g = new Game();
    (g as any).stage = st;
    const a = g.addPlayer("bench")!;
    const p = g.getPlayer(a)!;
    p.maxHp = p.hp = 1e9;
    p.invuln = 1e9;
    for (const t of UNIT_TYPES) for (let i = 0; i < per; i++) g.addMerc(a, t, p.x + 40 * (t - 2) + i * 15, p.y + 40 + 20 * i, 0, tier);
    for (let i = 0; i < secs * TICK_RATE; i++) {
      g.step();
      p.hp = p.maxHp;
      p.invuln = 1e9;
    }
    const res = (g as any).result().players[0].mercList as any[];
    for (const r of res) r.xp = ((g as any).mercs.get([...(g as any).mercs.values()].find((m: any) => m.num === r.num && m.type === r.type)?.id)?.xp ?? 0) + (r.tier ?? 0) * 0;
    for (const t of UNIT_TYPES) {
      const mine = res.filter((r) => r.type === t);
      const sc = mine.reduce((x, r) => x + r.score, 0) / (per * (secs / 60));
      (rows[`${st}`] ??= [0, 0, 0, 0, 0, 0])[t]! += sc / seeds;
      for (const r of mine) {
        const f = 1 / (per * (secs / 60));
        const arr = brk[t]!;
        (xpRows[`${st}`] ??= [0, 0, 0, 0, 0, 0])[t]! += (r.xp * f) / seeds;
        arr[0] += r.dealt * f; arr[1] += r.taken * f; arr[2] += r.blocked * f; arr[3] += r.kills * f; arr[4] += (r.counter + r.stagger * TUNE.MXP_STAGGER) * f; arr[5] += r.xp * f;
        const c = cnt[t]!; c[0] += r.kills * f; c[1] += r.assists * f; c[2] += r.deaths * f;
      }
    }
  }
}
console.log("기여도(체력 단위) / 용병 1명 / 분 (병종: " + UNIT_NAMES.join(" ") + ")");
for (const [st, v] of Object.entries(rows)) {
  const mean = v.reduce((x, y) => x + y, 0) / v.length;
  console.log(`스테이지 ${st}:`, v.map((x) => x.toFixed(1).padStart(6)).join(" "), "| 평균", mean.toFixed(1), "| 비율", v.map((x) => (x / mean).toFixed(2)).join(" "));
}
const all = Object.values(rows);
const avg = [0, 1, 2, 3, 4, 5].map((t) => all.reduce((x, v) => x + v[t]!, 0) / all.length);
const m = avg.reduce((x, y) => x + y, 0) / 6;
console.log("전체 평균 비율:", avg.map((x) => (x / m).toFixed(2)).join(" "), "(최대/최소", (Math.max(...avg) / Math.min(...avg)).toFixed(2) + ")");

runs = stages.length * seeds;
console.log("\n병종별(분당 1명): 준피해 받은피해 막은피해 킬 특기 경험치 | 킬 어시 죽음");
for (const t of UNIT_TYPES) console.log(UNIT_NAMES[t]!.padEnd(4), brk[t]!.map((x) => (x / runs).toFixed(1).padStart(6)).join(" "), "|", cnt[t]!.slice(0, 3).map((x) => (x / runs).toFixed(2).padStart(5)).join(" "));

console.log("\n경험치/분/1명 (병종별, 스테이지별):");
for (const [st, v] of Object.entries(xpRows)) { const mean = v.reduce((x, y) => x + y, 0) / 6; console.log(`스테이지 ${st}:`, v.map((x) => x.toFixed(1).padStart(6)).join(" "), "| 비율", v.map((x) => (x / mean).toFixed(2)).join(" ")); }
const xa = [0, 1, 2, 3, 4, 5].map((t) => Object.values(xpRows).reduce((x, v) => x + v[t]!, 0) / Object.keys(xpRows).length);
const xm = xa.reduce((x, y) => x + y, 0) / 6;
console.log("경험치 평균 비율:", xa.map((x) => (x / xm).toFixed(2)).join(" "), "(최대/최소", (Math.max(...xa) / Math.min(...xa)).toFixed(2) + ")");
