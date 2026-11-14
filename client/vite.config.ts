import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

// 이 화면(번들)의 버전: changelog.json 맨 위 버전. 서버가 알려 주는 버전과 다르면 열어 둔 화면이 옛 것이라 새로 고친다.
const buildVer = (() => {
  try {
    return (JSON.parse(readFileSync(new URL("./public/changelog.json", import.meta.url), "utf8")) as { versions: { version: string }[] }).versions[0]!.version;
  } catch {
    return "";
  }
})();

// 개발 중에도 운영과 같은 주소(/ws)로 접속하도록, 게임 서버(8080)로 넘겨 준다.
export default defineConfig({
  define: { __BUILD_VER__: JSON.stringify(buildVer) },
  server: { host: true, port: 5173, proxy: { "/ws": { target: "ws://localhost:8080", ws: true }, "/api": { target: "http://localhost:8080" } } },
});
