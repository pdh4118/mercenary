import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { applyTuning, resetTuning, tuneDefs, tuneOverrides, tuneValues } from "@mercenary/shared";

/** 수치 조정 값이 저장되는 파일. 서버를 다시 켜도 이 값이 적용된다. */
export const TUNING_FILE = process.env.MERC_TUNING_FILE ?? join(process.cwd(), "tuning.json");
/** 인터넷(터널)을 거쳐 조정 도구를 쓰려면 이 값을 정하고 `?token=값`으로 연다. 비우면 서버를 켠 컴퓨터에서만 열린다. */
const ADMIN_TOKEN = process.env.MERC_ADMIN_TOKEN ?? "";
const MAX_BODY = 64 * 1024;

export function loadTuning(file = TUNING_FILE): number {
  try {
    if (!existsSync(file)) return 0;
    const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
    return applyTuning((raw as { values?: unknown })?.values ?? raw, true);
  } catch (err) {
    console.error("[mercenary] 수치 조정 파일을 읽지 못했습니다(기본값으로 시작합니다):", err);
    return 0;
  }
}

export function saveTuning(file = TUNING_FILE): void {
  writeFileSync(file, JSON.stringify({ values: tuneOverrides() }, null, 2) + "\n");
}

/**
 * 조정 도구를 써도 되는 요청인가: 프록시를 거치지 않은 이 컴퓨터(루프백)의 요청이거나, 올바른 토큰을 가진 요청.
 * (터널은 이 컴퓨터에서 연결해 오므로 주소만 보면 안 되고, 프록시 헤더가 있으면 외부 요청으로 본다.)
 */
export function tuningAllowed(req: IncomingMessage, token = ADMIN_TOKEN): boolean {
  const given = typeof req.headers["x-admin-token"] === "string" ? (req.headers["x-admin-token"] as string) : new URL(req.url ?? "/", "http://x").searchParams.get("token");
  if (token && given === token) return true;
  const proxied = !!(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.headers["forwarded"]);
  const addr = req.socket.remoteAddress ?? "";
  const loopback = addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
  return loopback && !proxied;
}

const json = (res: ServerResponse, code: number, body: unknown): void => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(body));
};

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/** /api/tuning 요청을 처리한다. 값이 바뀌면 onChange(바뀐 값 전체)를 부른다(접속자에게 전달). */
export async function handleTuningApi(req: IncomingMessage, res: ServerResponse, onChange: (overrides: Record<string, number>) => void): Promise<void> {
  if (!tuningAllowed(req)) return json(res, 403, { error: "이 컴퓨터에서만 열 수 있습니다. 밖에서 쓰려면 서버에 MERC_ADMIN_TOKEN을 정하고 ?token=값 으로 여세요." });
  const path = (req.url ?? "").split("?")[0]!;
  const snapshot = () => ({ defs: tuneDefs(), values: tuneValues(), overrides: tuneOverrides() });
  try {
    if (req.method === "GET" && path === "/api/tuning") return json(res, 200, snapshot());
    if (req.method === "POST" && path === "/api/tuning") {
      const body = (await readBody(req)) as { values?: unknown };
      const n = applyTuning(body.values);
      saveTuning();
      onChange(tuneOverrides());
      return json(res, 200, { applied: n, ...snapshot() });
    }
    if (req.method === "POST" && path === "/api/tuning/reset") {
      const body = (await readBody(req)) as { keys?: unknown };
      if (Array.isArray(body.keys)) {
        const defs = new Map(tuneDefs().map((d) => [d.key, d.def]));
        const back: Record<string, number> = {};
        for (const k of body.keys) if (typeof k === "string" && defs.has(k)) back[k] = defs.get(k)!;
        applyTuning(back);
      } else resetTuning();
      saveTuning();
      onChange(tuneOverrides());
      return json(res, 200, snapshot());
    }
    return json(res, 404, { error: "not found" });
  } catch {
    return json(res, 400, { error: "잘못된 요청입니다" });
  }
}
