import { defineConfig } from "vite";

// 개발 중에도 운영과 같은 주소(/ws)로 접속하도록, 게임 서버(8080)로 넘겨 준다.
export default defineConfig({
  server: { host: true, port: 5173, proxy: { "/ws": { target: "ws://localhost:8080", ws: true }, "/api": { target: "http://localhost:8080" } } },
});
