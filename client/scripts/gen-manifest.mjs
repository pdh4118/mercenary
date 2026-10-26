// 그림 목록(assets/manifest.json)을 만든다. 클라이언트가 시작할 때 이 목록의 그림을 한꺼번에 받아 로딩을 줄인다.
//  - core: 처음 화면에 꼭 필요한 그림(병종·주인공·바닥·캠프·카드·기본 이펙트). 시작할 때 병렬로 받는다.
//  - webp: .webp 짝이 있는 그림(이 경우 .png 대신 .webp를 받는다. 용량이 훨씬 작다. 만들기: python3 tools/make_webp.py)
// 장군 이펙트·장군 그림·스켈레톤·군량병·지형은 core에 넣지 않는다(필요할 때 따로 받는다).
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(join(root, "assets")).map((p) => relative(root, p).split("\\").join("/"));
const pngs = files.filter((f) => f.endsWith(".png"));
const webp = pngs.filter((f) => files.includes(f.replace(/\.png$/, ".webp")));
const lazy = (f) => /^assets\/terrain\//.test(f) || /\/(boss\d|skel_|supply_|rice_)/.test(f) || /assets\/fx\/(boss\d|supply_|rice_)/.test(f);
const core = pngs.filter((f) => !lazy(f) && !/_old\./.test(f));
writeFileSync(join(root, "assets", "manifest.json"), JSON.stringify({ core, webp }));
console.log(`[manifest] core ${core.length}개, webp ${webp.length}개`);
