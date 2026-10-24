import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { aggregateStats, type MatchRecord } from "@mercenary/shared";
import { tuningAllowed } from "./tuning-store.js";

/** 한 판이 끝날 때마다 한 줄씩 쌓이는 밸런스 통계 파일(JSON Lines). 지우면 통계가 처음부터 다시 쌓인다. */
export const STATS_FILE = process.env.MERC_STATS_FILE ?? join(process.cwd(), "stats.jsonl");

export function appendMatch(rec: MatchRecord, file = STATS_FILE): void {
  try {
    appendFileSync(file, JSON.stringify(rec) + "\n");
  } catch (err) {
    console.error("[mercenary] 통계를 저장하지 못했습니다:", err);
  }
}

/** 파일의 기록을 읽는다(깨진 줄은 건너뛴다). since(ms) 이후만 */
export function readMatches(file = STATS_FILE, since = 0): MatchRecord[] {
  if (!existsSync(file)) return [];
  const out: MatchRecord[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const m = JSON.parse(line) as MatchRecord;
      if (m && m.v === 1 && Array.isArray(m.players) && m.t >= since) out.push(m);
    } catch {
      /* 깨진 줄 */
    }
  }
  return out;
}

const json = (res: ServerResponse, code: number, body: unknown): void => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
};

/**
 * GET /api/stats?days=7&rush=0&diff=3 : 기간(일, 0이면 전체) 안의 기록을 집계해 돌려준다.
 * 수치 조정 도구와 같은 규칙으로, 이 컴퓨터에서 열거나 MERC_ADMIN_TOKEN과 `?token=`이 맞을 때만 열린다.
 */
export function handleStatsApi(req: IncomingMessage, res: ServerResponse, file = STATS_FILE, now = Date.now()): void {
  if (!tuningAllowed(req)) return json(res, 403, { error: "이 컴퓨터에서만 열 수 있습니다. 밖에서 쓰려면 서버에 MERC_ADMIN_TOKEN을 정하고 ?token=값 으로 여세요." });
  if (req.method !== "GET") return json(res, 405, { error: "GET만 됩니다" });
  const q = new URL(req.url ?? "/", "http://x").searchParams;
  const days = Math.max(0, Math.min(3650, Number(q.get("days") ?? 7) || 0));
  const since = days > 0 ? now - days * 86400_000 : 0;
  const diffRaw = q.get("diff");
  const diff = diffRaw !== null && diffRaw !== "" && Number.isFinite(Number(diffRaw)) ? Number(diffRaw) : undefined;
  const all = readMatches(file, 0);
  const agg = aggregateStats(all, { since, includeRush: q.get("rush") === "1", diff });
  json(res, 200, { days, since, total: all.length, firstAt: all[0]?.t ?? 0, ...agg });
}
