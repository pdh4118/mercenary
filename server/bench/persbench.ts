/* eslint-disable @typescript-eslint/no-explicit-any */
process.env.PERS = "1";
import { TUNE, PERSONALITIES, MERC_NAME_COUNT, mercEpithet, TICK_RATE, SPEAR, SHIELD, ARCHER, MAGE, UNIT_NAMES } from "@mercenary/shared";
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
const nameOf = (persona: string): number => { for (let i = 0; i < MERC_NAME_COUNT; i++) if (mercEpithet(i) === persona) return i; throw new Error(persona); };
const type = Number(process.env.TYPE ?? SPEAR);
const seeds = Number(process.env.SEEDS ?? 5);
const secs = Number(process.env.SECS ?? 150);
const stage = Number(process.env.STAGE ?? 4);
type Scen = { name: string; wave: (g: any, p: any, t: number) => void };
const ring = (p: any, r: number, k: number) => ((Math.PI * 2 * k) / 8) + (Math.random() * 0.3) && { x: p.x + Math.cos(Math.PI * 2 * Math.random()) * r, y: p.y + Math.sin(Math.PI * 2 * Math.random()) * r };
const spawn = (g: any, p: any, n: number, enemyType: number, r: number, elite = false, hpMult = 1) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const id = g.spawnEnemyAt(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, enemyType);
    const e = g.getEnemy(id);
    if (elite) e.elite = true;
    e.hp = e.maxHp = e.maxHp * hpMult;
  }
};
const SCEN: Scen[] = [
  { name: "졸개 떼", wave: (g, p, t) => { if (t % 12 === 0) spawn(g, p, 12, 1, 420); } },
  { name: "소수 적", wave: (g, p, t) => { if (t % 9 === 0) spawn(g, p, 2, 1, 380); } },
  { name: "정예 위주", wave: (g, p, t) => { if (t % 20 === 0) spawn(g, p, 2, 4, 420, true, 3); } },
  { name: "원거리 위주", wave: (g, p, t) => { if (t % 14 === 0) { spawn(g, p, 4, 2, 380); spawn(g, p, 2, 5, 400); } } },
  { name: "방패 부대", wave: (g, p, t) => { if (t % 16 === 0) spawn(g, p, 6, 3, 420); } },
  { name: "대규모", wave: (g, p, t) => { if (t % 18 === 0) spawn(g, p, 22, 1, 480); } },
];
const names = PERSONALITIES.map((x) => x.name);
const table: number[][] = names.map(() => SCEN.map(() => 0));
const up: number[] = names.map(() => 0);
const down: number[] = names.map(() => 0);
SCEN.forEach((sc, si) => {
  for (let sd = 1; sd <= seeds; sd++) {
    mul(sd * 6007 + si * 131);
    const g: any = new Game();
    g.autoSpawn = false;
    (g as any).stage = stage;
    const a = g.addPlayer("p")!;
    const p = g.getPlayer(a)!;
    for (const [i, n] of names.entries()) {
      const ang = (Math.PI * 2 * i) / names.length;
      g.addMerc(a, type, p.x + Math.cos(ang) * 110, p.y + Math.sin(ang) * 110, 0, 0, nameOf(n));
    }
    for (let i = 0; i < secs * TICK_RATE; i++) {
      if (i % TICK_RATE === 0) sc.wave(g, p, i / TICK_RATE);
      g.step();
      p.hp = p.maxHp = 1e9;
      p.invuln = 1e9;
    }
    const mercs = [...g.mercs.values()];
    names.forEach((n, i) => {
      const m = mercs.find((x: any) => mercEpithet(x.nameId) === n);
      if (m) {
        table[i]![si]! += m.career.score / seeds;
        up[i]! += m.career.sitUp / (seeds * SCEN.length);
        down[i]! += m.career.sitDown / (seeds * SCEN.length);
      }
    });
  }
});
console.log(`병종 ${UNIT_NAMES[type]} · 스테이지 ${stage} · 시드 ${seeds} · ${secs}초 — 기여도(시나리오 평균 대비)`);
console.log("성격".padEnd(6), SCEN.map((s) => s.name.padStart(8)).join(" "), "   평균  최고→최저  켜짐(+/-초)");
const meanCol = SCEN.map((_, si) => table.reduce((x, r) => x + r[si]!, 0) / names.length);
const out: number[][] = table.map((r) => r.map((v, si) => v / (meanCol[si] || 1)));
names.forEach((n, i) => {
  const r = out[i]!;
  const avg = r.reduce((x, y) => x + y, 0) / r.length;
  const best = SCEN[r.indexOf(Math.max(...r))]!.name;
  const worst = SCEN[r.indexOf(Math.min(...r))]!.name;
  console.log(n.padEnd(6), r.map((v) => v.toFixed(2).padStart(8)).join(" "), `  ${avg.toFixed(2)}  ${best}→${worst}  ${up[i]!.toFixed(0)}/${down[i]!.toFixed(0)}`);
});
