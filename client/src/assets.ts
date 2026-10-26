import { Assets } from "pixi.js";

/**
 * 그림 불러오기 가속:
 *  1) .webp 짝이 있는 그림은 .png 대신 .webp를 받는다(용량이 훨씬 작다). 호출하는 쪽은 그대로 .png 이름을 쓴다.
 *  2) 시작할 때 목록(assets/manifest.json)의 핵심 그림을 한꺼번에 병렬로 받아 둔다. 뒤이어 하나씩 기다리는 코드는 이미 받은 그림을 바로 쓴다.
 * 목록이 없거나 못 받으면(옛 빌드) 예전처럼 필요할 때 받는다.
 */
let webpSet = new Set<string>();
let patched = false;

const mapUrl = (u: unknown): unknown => (typeof u === "string" && webpSet.has(u) ? u.replace(/\.png$/, ".webp") : u);

function patchLoader(): void {
  if (patched) return;
  patched = true;
  const orig = Assets.load.bind(Assets) as (urls: unknown, onProgress?: unknown) => Promise<unknown>;
  (Assets as unknown as { load: typeof orig }).load = (urls, onProgress) => orig(Array.isArray(urls) ? urls.map(mapUrl) : mapUrl(urls), onProgress);
}

export async function warmAssets(onProgress?: (done: number, total: number) => void): Promise<void> {
  try {
    const res = await fetch("assets/manifest.json", { cache: "no-cache" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return;
    const m = (await res.json()) as { core: string[]; webp: string[] };
    webpSet = new Set(m.webp ?? []);
    patchLoader();
    let done = 0;
    const total = m.core.length;
    await Promise.all(
      m.core.map((u) =>
        Assets.load(u)
          .catch(() => null)
          .then(() => onProgress?.(++done, total)),
      ),
    );
  } catch {
    /* 목록 없이도 동작한다 */
  }
}

/** 그림 한 장을 미리 받아 둔다(백그라운드). 실패해도 조용히 넘어간다. */
export const prefetch = (urls: string[]): Promise<unknown> => Promise.all(urls.map((u) => Assets.load(u).catch(() => null)));
