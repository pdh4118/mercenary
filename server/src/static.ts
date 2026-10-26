import { createReadStream, readFileSync, statSync } from "node:fs";
import { brotliCompressSync, constants as zc, gzipSync } from "node:zlib";
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

const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".svg"]);
/** 압축본 캐시(파일 경로+수정 시각이 같으면 다시 압축하지 않는다) */
const packed = new Map<string, { mtime: number; gz: Buffer; br: Buffer }>();

/** 빌드된 클라이언트(client/dist)를 서비스한다. 해시가 붙은 에셋은 오래 캐시하고 index.html은 매번 확인하게 한다. 글자 파일은 압축해서 보내고, 바뀌지 않았으면 304로 답한다. */
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
  const st = statSync(file);
  const hashed = file.includes(`${sep}assets${sep}`) && /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(file);
  const etag = `W/"${st.size.toString(16)}-${Math.round(st.mtimeMs).toString(16)}"`;
  const headers: Record<string, string | number> = {
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": hashed ? "public, max-age=31536000, immutable" : ext === ".html" || ext === ".json" ? "no-cache" : "public, max-age=3600",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
  };
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, headers).end();
    return;
  }
  // 글자 파일은 brotli → gzip 순으로 압축한다(그림·소리는 이미 압축되어 있어 그대로 보낸다)
  if (COMPRESSIBLE.has(ext)) {
    const accept = String(req.headers["accept-encoding"] ?? "");
    const useBr = /\bbr\b/.test(accept);
    const useGz = !useBr && /\bgzip\b/.test(accept);
    if (useBr || useGz) {
      let c = packed.get(file);
      if (!c || c.mtime !== st.mtimeMs) {
        const raw = readFileSync(file);
        c = { mtime: st.mtimeMs, gz: gzipSync(raw, { level: 9 }), br: brotliCompressSync(raw, { params: { [zc.BROTLI_PARAM_QUALITY]: 9 } }) };
        packed.set(file, c);
      }
      const body = useBr ? c.br : c.gz;
      res.writeHead(200, { ...headers, "Content-Encoding": useBr ? "br" : "gzip", Vary: "Accept-Encoding", "Content-Length": body.length });
      if (req.method === "HEAD") res.end();
      else res.end(body);
      return;
    }
  }
  res.writeHead(200, { ...headers, "Content-Length": st.size });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}
