/* eslint-disable */
if (process.env.PERS !== "1") process.env.MERC_NO_PERSONALITY = "1";
import { TUNE, UNIT_TYPES, TICK_RATE } from "@mercenary/shared";
import { Game } from "../src/game.js";
TUNE.ENEMY_CAV_RAM_FRAC = 0;
const mul = (seed: number) => { let a = seed >>> 0 || 1; Math.random = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const per = Number(process.env.PER ?? 2); const stage = Number(process.env.STAGE ?? 3); const secs = Number(process.env.SECS ?? 600);
for (const pay of [0, TUNE.PAY_PER_COST]) {
  TUNE.PAY_PER_COST = pay; let sum = 0; const N = 3;
  for (let sd = 1; sd <= N; sd++) {
    mul(sd * 104729); const g: any = new Game(); g.stage = stage; const a = g.addPlayer("p")!; const p = g.getPlayer(a)!; p.gold = 0;
    for (const t of UNIT_TYPES) for (let i = 0; i < per; i++) g.addMerc(a, t, p.x + 40 * (t - 2) + i * 15, p.y + 40 + 20 * i, 0, 0);
    for (let i = 0; i < secs * TICK_RATE; i++) { g.step(); p.hp = p.maxHp = 1e9; p.invuln = 1e9; p.leadership = 1e9; }
    sum += p.gold;
  }
  console.log(`급여계수 ${pay}: ${secs}초 뒤 평균 금화 ${(sum / N).toFixed(0)} (용병 ${per * 6}명, 스테이지 ${stage})`);
}
