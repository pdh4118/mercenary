import { createReadStream, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
};

/**
 * URL 경로를 정적 파일 경로로 바꾼다. 루트 폴더 밖으로 나가려는 경로(../, 인코딩된 ../ 등)나
 * 존재하지 않는 파일이면 null. 폴더는 index.html로 대신한다.
 */
export function resolveStatic(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]!.split("#")[0]!);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const base = resolve(root);
  let target = resolve(join(base, normalize(decoded)));
  if (target !== base && !target.startsWith(base + sep)) return null;
  try {
    if (statSync(target).isDirectory()) target = join(target, "index.html");
    return statSync(target).isFile() ? target : null;
  } catch {
    return null;
  }
}

/** 빌드된 클라이언트(client/dist)를 서비스한다. 해시가 붙은 에셋은 오래 캐시하고 index.html은 매번 확인하게 한다. */
export function serveStatic(root: string, req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const file = resolveStatic(root, req.url ?? "/");
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
    return;
  }
  const ext = extname(file).toLowerCase();
  const hashed = file.includes(`${sep}assets${sep}`) && /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(file);
  res.writeHead(200, {
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": hashed ? "public, max-age=31536000, immutable" : ext === ".html" ? "no-cache" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}
