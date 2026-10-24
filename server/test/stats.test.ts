import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ARCHER, BLUNT, TICK_RATE, aggregateStats, type MatchRecord, type PlayerRecord } from "@mercenary/shared";
import { Game } from "../src/game.js";
import { appendMatch, handleStatsApi, readMatches } from "../src/stats-store.js";

const player = (over: Partial<PlayerRecord> = {}): PlayerRecord => ({
  diff: 3, level: 10, kills: 50, downs: 1,
  hired: [0, 0, 0, 0, 0, 0], mercDeaths: [0, 0, 0, 0, 0, 0], dealtMerc: [0, 0, 0, 0, 0, 0], dealtHero: [0, 0, 0, 0, 0, 0], takenMerc: [0, 0, 0, 0, 0, 0], takenHero: 0, heroSec: [0, 0, 0, 0, 0, 0],
  cards: {}, stage: {}, ...over,
});
const match = (over: Partial<MatchRecord> = {}): MatchRecord => ({ v: 1, t: Date.now(), dur: 600, stage: 5, status: "defeat", rush: false, clears: [], skips: [], players: [player()], ...over });

test("판 기록: 주인공 무기별 피해·시간과 용병 병종별 피해·받은 피해가 쌓인다", () => {
  const g = new Game();
  g.autoSpawn = false;
  const a = g.addPlayer("a")!;
  const p = g.getPlayer(a)!;
  p.invuln = 1e6;
  g.setWeapon(a, 0); // 활
  const m = g.addMerc(a, BLUNT, p.x + 40, p.y);
  void m;
  const id = g.spawnEnemyAt(p.x + 60, p.y, 4);
  const e = (g as unknown as { enemies: Map<number, { hp: number; maxHp: number }> }).enemies.get(id)!;
  e.hp = e.maxHp = 5000;
  g.setInput(a, { dx: 0, dy: 0, aim: 0, fire: true });
  for (let i = 0; i < 6 * TICK_RATE; i++) g.step();
  const rec = g.statsRecord();
  const pr = rec.players[0]!;
  assert.ok(pr.dealtHero[ARCHER]! > 0, "활 피해");
  assert.ok(pr.heroSec[ARCHER]! > 5, "활을 든 시간");
  assert.ok(pr.dealtMerc[BLUNT]! > 0, "둔기병 피해");
  assert.ok(pr.takenMerc[BLUNT]! > 0, "둔기병이 받은 피해");
  assert.equal(rec.v, 1);
  assert.equal(rec.status, "playing");
  assert.ok(Object.keys(pr.stage).length > 0, "스테이지별 합계");
});

test("집계: 고용 비율·피해 비율·1명당 값과 스테이지 도달률이 계산되고 보스 연습 방은 기본으로 빠진다", () => {
  const a = match({ stage: 3, status: "defeat", clears: [[1, 100], [2, 260]], players: [player({ hired: [2, 0, 6, 0, 0, 0], dealtMerc: [200, 0, 600, 0, 0, 0], mercDeaths: [1, 0, 3, 0, 0, 0], cards: { 활: 2 } })] });
  const b = match({ stage: 10, status: "victory", clears: [[1, 90]], skips: [2], players: [player({ hired: [2, 0, 2, 0, 0, 0], dealtMerc: [300, 0, 100, 0, 0, 0], cards: { 활: 1, 검: 4 } }), player({ hired: [0, 4, 0, 0, 0, 0] })] });
  const rush = match({ rush: true, players: [player({ hired: [0, 0, 0, 0, 9, 0] })] });
  const r = aggregateStats([a, b, rush]);
  assert.equal(r.matches, 2, "연습 방 제외");
  assert.equal(r.players, 3);
  assert.equal(r.victoryRate, 50);
  const cav = r.mercs[0]!;
  assert.equal(cav.hired, 4);
  assert.equal(cav.hireShare, Math.round((4 / 16) * 1000) / 10);
  assert.equal(cav.usedRate, Math.round((2 / 3) * 1000) / 10);
  assert.equal(cav.dealtPerHired, Math.round(500 / 4));
  assert.equal(r.mercs[2]!.deathsPerHired, 0.38);
  assert.equal(r.stages[0]!.reached, 2);
  assert.equal(r.stages[2]!.reached, 2);
  assert.equal(r.stages[9]!.reached, 1);
  assert.equal(r.stages[9]!.reachRate, 50);
  assert.equal(r.stages[1]!.skipped, 1);
  assert.equal(r.stages[1]!.avgLen, 160, "2스테이지: 100초에 1스테이지, 260초에 2스테이지");
  assert.equal(r.cards[0]!.name, "검");
  assert.equal(aggregateStats([a, b, rush], { includeRush: true }).matches, 3);
  assert.equal(aggregateStats([a, b], { since: Date.now() + 1000 }).matches, 0, "기간 밖");
});

test("파일: 한 줄씩 쌓이고 깨진 줄은 건너뛰며, API는 기간과 권한을 지킨다", () => {
  const dir = mkdtempSync(join(tmpdir(), "merc-stats-"));
  const file = join(dir, "stats.jsonl");
  const day = 86400_000;
  appendMatch(match({ t: Date.now() - 10 * day }), file);
  appendMatch(match({ t: Date.now() - 1 * day }), file);
  appendFileSync(file, "여기는 깨진 줄\n");
  appendMatch(match({ t: Date.now() }), file);
  assert.equal(readMatches(file).length, 3);
  const call = (url: string, remote = "127.0.0.1", headers: Record<string, string> = {}) => {
    let code = 0;
    let body = "";
    const res = { writeHead(c: number) { code = c; return this; }, end(b: string) { body = b; } };
    handleStatsApi({ url, method: "GET", headers, socket: { remoteAddress: remote } } as never, res as never, file);
    return { code, body: JSON.parse(body) as { matches: number; total: number } };
  };
  assert.equal(call("/api/stats?days=7").body.matches, 2);
  assert.equal(call("/api/stats?days=0").body.matches, 3);
  assert.equal(call("/api/stats?days=7").body.total, 3);
  assert.equal(call("/api/stats?days=7", "8.8.8.8").code, 403, "밖에서는 토큰이 없으면 열리지 않는다");
  assert.equal(call("/api/stats?days=7", "127.0.0.1", { "x-forwarded-for": "1.2.3.4" }).code, 403, "프록시를 거친 요청은 밖에서 온 것으로 본다");
});
