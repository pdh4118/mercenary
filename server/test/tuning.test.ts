import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { MERC_STATS, SPEAR, TUNE, WEAPONS, applyTuning, resetTuning, tuneDefs, tuneOverrides, tuneValues, xpNeeded } from "@mercenary/shared";

const dir = mkdtempSync(join(tmpdir(), "merc-tune-"));
process.env.MERC_TUNING_FILE = join(dir, "tuning.json"); // 시험이 실제 저장 파일을 건드리지 않게
const store = await import("../src/tuning-store.js");

test("조정 목록: 이름이 겹치지 않고 기본값이 범위 안에 있다", () => {
  const defs = tuneDefs();
  assert.ok(defs.length > 200, `항목 ${defs.length}개`);
  assert.equal(new Set(defs.map((d) => d.key)).size, defs.length);
  for (const d of defs) {
    assert.ok(d.min <= d.def && d.def <= d.max, `${d.key}: ${d.min} ≤ ${d.def} ≤ ${d.max}`);
    assert.ok(d.label && d.group && d.step > 0, d.key);
  }
  assert.deepEqual(tuneOverrides(), {}, "처음에는 바뀐 것이 없다");
});

test("값을 바꾸면 게임 규칙표에 바로 반영되고, 범위를 벗어나거나 잘못된 값은 무시·보정된다", () => {
  try {
    const reach0 = MERC_STATS[SPEAR]!.reach;
    const n = applyTuning({ "MERC_STATS.1.reach": 150, "WEAPONS.3.windup": 0.8, STAGE_GROW_SEC: 120, "없는.항목": 5, "MERC_STATS.0.hp": "x", XP_BASE: 99999 });
    assert.equal(n, 4, "알려진 이름의 숫자 값만 적용(범위 밖은 보정해서 적용)");
    assert.equal(MERC_STATS[SPEAR]!.reach, 150);
    assert.equal(WEAPONS[3]!.windup, 0.8);
    assert.equal(TUNE.STAGE_GROW_SEC, 120);
    assert.ok(TUNE.XP_BASE <= 500, "최댓값으로 보정");
    assert.equal(xpNeeded(1), TUNE.XP_BASE);
    const o = tuneOverrides();
    assert.equal(o["MERC_STATS.1.reach"], 150);
    assert.ok(!("MERC_STATS.0.hp" in o));
    assert.equal(tuneValues()["MERC_STATS.1.reach"], 150);
    resetTuning();
    assert.equal(MERC_STATS[SPEAR]!.reach, reach0);
    assert.deepEqual(tuneOverrides(), {});
    // replace=true는 먼저 모두 기본값으로 되돌린다
    applyTuning({ START_GOLD: 300 });
    applyTuning({ START_LEADERSHIP: 9 }, true);
    assert.equal(TUNE.START_GOLD, 100);
    assert.equal(TUNE.START_LEADERSHIP, 9);
  } finally {
    resetTuning();
  }
});

test("조정한 값이 실제 판에 쓰인다(스테이지 성장 시간)", async () => {
  const { Game } = await import("../src/game.js");
  try {
    applyTuning({ STAGE_GROW_SEC: 40 });
    const g = new Game();
    g.addPlayer("a");
    assert.equal(g.info().timer, 40);
    applyTuning({ START_GOLD: 250 });
    const h = new Game();
    const id = h.addPlayer("b")!;
    assert.equal(h.getPlayer(id)!.gold, 250);
  } finally {
    resetTuning();
  }
});

test("조정 도구 접근: 이 컴퓨터에서 프록시 없이 온 요청과 올바른 토큰만 허용", () => {
  const req = (addr: string, headers: Record<string, string> = {}, url = "/api/tuning") => ({ socket: { remoteAddress: addr }, headers, url }) as never;
  assert.ok(store.tuningAllowed(req("127.0.0.1")));
  assert.ok(store.tuningAllowed(req("::1")));
  assert.ok(store.tuningAllowed(req("::ffff:127.0.0.1")));
  assert.ok(!store.tuningAllowed(req("203.0.113.5")), "바깥 주소");
  assert.ok(!store.tuningAllowed(req("127.0.0.1", { "cf-connecting-ip": "203.0.113.5" })), "터널(Cloudflare)을 거친 요청");
  assert.ok(!store.tuningAllowed(req("127.0.0.1", { "x-forwarded-for": "203.0.113.5" })), "프록시를 거친 요청");
  assert.ok(!store.tuningAllowed(req("127.0.0.1", { "x-forwarded-for": "1.2.3.4" }, "/api/tuning?token=abc"), ""), "토큰이 비어 있으면 토큰으로 못 연다");
  assert.ok(store.tuningAllowed(req("203.0.113.5", { "x-forwarded-for": "1.2.3.4" }, "/api/tuning?token=secret"), "secret"), "올바른 토큰");
  assert.ok(!store.tuningAllowed(req("203.0.113.5", { "x-forwarded-for": "1.2.3.4" }, "/api/tuning?token=wrong"), "secret"));
  assert.ok(store.tuningAllowed(req("203.0.113.5", { "x-forwarded-for": "1.2.3.4", "x-admin-token": "secret" }), "secret"), "헤더로도 가능");
});

test("조정 API: 조회·저장·적용 알림·기본값 복원, 저장 파일에서 다시 불러오기", async () => {
  const changes: Record<string, number>[] = [];
  const srv = createServer((q, r) => void store.handleTuningApi(q, r, (v) => changes.push(v)));
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) => fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  try {
    const got = (await (await fetch(base + "/api/tuning")).json()) as { defs: unknown[]; values: Record<string, number>; overrides: Record<string, number> };
    assert.ok(got.defs.length > 200);
    assert.equal(got.values["MERC_STATS.2.reach"], MERC_STATS[2]!.reach);
    // 프록시를 거친 요청은 막는다
    assert.equal((await fetch(base + "/api/tuning", { headers: { "x-forwarded-for": "9.9.9.9" } })).status, 403);
    assert.equal((await post("/api/tuning", { values: { START_GOLD: 1 } }, { "cf-connecting-ip": "9.9.9.9" })).status, 403);
    assert.equal(TUNE.START_GOLD, 100, "막힌 요청은 적용되지 않는다");
    // 저장
    const res = (await (await post("/api/tuning", { values: { START_GOLD: 321, "MERC_STATS.2.reach": 300 } })).json()) as { applied: number; overrides: Record<string, number> };
    assert.equal(res.applied, 2);
    assert.equal(TUNE.START_GOLD, 321);
    assert.equal(res.overrides.START_GOLD, 321);
    assert.deepEqual(changes.at(-1), { START_GOLD: 321, "MERC_STATS.2.reach": 300 }, "접속자에게 알릴 값");
    const file = JSON.parse(readFileSync(process.env.MERC_TUNING_FILE!, "utf8")) as { values: Record<string, number> };
    assert.equal(file.values.START_GOLD, 321);
    // 저장 파일에서 다시 불러오기(서버를 다시 켠 것처럼)
    resetTuning();
    assert.equal(TUNE.START_GOLD, 100);
    assert.equal(store.loadTuning(), 2);
    assert.equal(TUNE.START_GOLD, 321);
    // 일부만 기본값으로
    await post("/api/tuning/reset", { keys: ["START_GOLD"] });
    assert.equal(TUNE.START_GOLD, 100);
    assert.equal(MERC_STATS[2]!.reach, 300);
    // 전부 기본값으로
    await post("/api/tuning/reset", {});
    assert.equal(MERC_STATS[2]!.reach, 280);
    assert.deepEqual(tuneOverrides(), {});
    assert.equal((await fetch(base + "/api/nope")).status, 404);
    assert.equal((await fetch(base + "/api/tuning", { method: "POST", body: "{망가진" })).status, 400);
  } finally {
    resetTuning();
    await new Promise((ok) => srv.close(ok));
  }
  assert.ok(existsSync(process.env.MERC_TUNING_FILE!));
});
