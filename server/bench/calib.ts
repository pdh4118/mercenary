/* eslint-disable @typescript-eslint/no-explicit-any */
if (process.env.PERS !== "1") process.env.MERC_NO_PERSONALITY = "1"; // PERS=1이면 성격을 켠다
import { TUNE, UNIT_NAMES, UNIT_TYPES, TICK_RATE, MERC_XP_TYPE_MULT } from "@mercenary/shared";
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
// [스테이지, 용병 단계, 병종당 인원]
const SCEN: [number, number, number][] = (process.env.SCEN ?? "2:0:3,4:0:3,6:0:3,8:0:3,3:0:5,6:0:5,4:2:3,7:2:3,5:1:4").split(",").map((x) => x.split(":").map(Number) as [number, number, number]);
const seeds = Number(process.env.SEEDS ?? 4);
const secs = Number(process.env.SECS ?? 150);
const rounds = Number(process.env.ROUNDS ?? 3);
const measure = (): { ratios: number[][]; avg: number[] } => {
  const ratios: number[][] = [];
  for (const [st, tier, per] of SCEN) {
    const xp = [0, 0, 0, 0, 0, 0];
    for (let sd = 1; sd <= seeds; sd++) {
      mul(sd * 7919 + st * 31 + tier * 7 + per);
      const g = new Game();
      (g as any).stage = st;
      const a = g.addPlayer("c")!;
      const p = g.getPlayer(a)!;
      for (const t of UNIT_TYPES) for (let i = 0; i < per; i++) g.addMerc(a, t, p.x + 40 * (t - 2) + i * 15, p.y + 40 + 20 * i, 0, tier);
      for (let i = 0; i < secs * TICK_RATE; i++) {
        g.step();
        p.hp = p.maxHp = 1e9;
        p.invuln = 1e9;
      }
      for (const m of (g as any).mercs.values()) xp[m.type]! += m.xp / (per * (secs / 60)) / seeds;
    }
    const mean = xp.reduce((x, y) => x + y, 0) / 6;
    ratios.push(xp.map((x) => x / mean));
  }
  const avg = [0, 1, 2, 3, 4, 5].map((t) => ratios.reduce((x, r) => x + r[t]!, 0) / ratios.length);
  return { ratios, avg };
};
for (let r = 0; r < rounds; r++) {
  const { ratios, avg } = measure();
  console.log(`\n== 라운드 ${r + 1}: 보정 [${MERC_XP_TYPE_MULT.map((x) => x.toFixed(2)).join(", ")}]`);
  console.log("시나리오(스테이지:단계:인원) " + UNIT_NAMES.map((x) => x.padStart(5)).join(" "));
  SCEN.forEach((s, i) => console.log(s.join(":").padEnd(26), ratios[i]!.map((x) => x.toFixed(2).padStart(5)).join(" ")));
  console.log("평균".padEnd(26), avg.map((x) => x.toFixed(2).padStart(5)).join(" "), ` 최대/최소 ${(Math.max(...avg) / Math.min(...avg)).toFixed(2)}`);
  if (r < rounds - 1) for (let t = 0; t < 6; t++) (MERC_XP_TYPE_MULT as any)[t] = Math.round((MERC_XP_TYPE_MULT[t]! * Math.pow(1 / avg[t]!, 0.8)) * 100) / 100;
}
