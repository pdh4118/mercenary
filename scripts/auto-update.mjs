// 서버를 켜 두고, GitHub에 새 버전이 올라오면 스스로 받아서(git pull) 다시 빌드하고 서버를 다시 켠다.
//   node scripts/auto-update.mjs [--interval 120] [--branch main] [--force-after 30]
// 접속자가 한 명도 없을 때만 업데이트하므로 게임 도중에 끊기지 않는다(--force-after N 이면 N분 기다린 뒤에는 접속자가 있어도 한다).
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const ROOT = process.env.MERC_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const INTERVAL_SEC = Math.max(5, Number(opt("interval", process.env.MERC_UPDATE_INTERVAL ?? 120)));
const BRANCH = opt("branch", process.env.MERC_UPDATE_BRANCH ?? "main");
const FORCE_AFTER_MIN = Number(opt("force-after", process.env.MERC_UPDATE_FORCE_AFTER ?? 0)); // 0이면 접속자가 없을 때만
const PORT = Number(process.env.PORT ?? 8080);
const WIN = process.platform === "win32";
const log = (...m) => console.log(`[자동 업데이트 ${new Date().toLocaleTimeString("ko-KR")}]`, ...m);

function run(cmd, cmdArgs, quiet = false) {
  const r = spawnSync(cmd, cmdArgs, { cwd: ROOT, shell: WIN, encoding: "utf8", stdio: quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"] });
  return { ok: r.status === 0, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
const git = (...a) => run("git", a, true);
const head = () => git("rev-parse", "HEAD").out;

/** 패키지 목록이 바뀌었으면 npm install을 한다 */
function install(before, after) {
  const changed = git("diff", "--name-only", before, after).out.split("\n");
  if (changed.some((f) => f === "package.json" || f.endsWith("/package.json") || f === "package-lock.json")) {
    log("패키지가 바뀌어 npm install을 합니다...");
    return run("npm", ["install"]).ok;
  }
  return true;
}
const build = () => {
  log("화면을 빌드합니다 (npm run build)...");
  return run("npm", ["run", "build"]).ok;
};

let child = null;
let stopping = false; // Ctrl+C로 끄는 중
let updating = false; // 업데이트로 서버를 내려 둔 중

function startServer() {
  log(`서버를 켭니다 (포트 ${PORT})`);
  const c = spawn("npm", ["start"], { cwd: ROOT, shell: WIN, stdio: "inherit", env: { ...process.env, TRUST_PROXY: process.env.TRUST_PROXY ?? "1" } });
  child = c;
  c.on("exit", (code) => {
    if (child !== c || stopping || updating) return; // 우리가 일부러 끈 것
    child = null;
    log(`서버가 종료되었습니다(코드 ${code}). 5초 뒤 다시 켭니다.`);
    setTimeout(() => !stopping && !updating && !child && startServer(), 5000);
  });
}

async function stopServer() {
  const c = child;
  child = null;
  if (!c || c.exitCode !== null) return;
  await new Promise((done) => {
    c.once("exit", done);
    if (WIN) spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill("SIGTERM");
    setTimeout(done, 8000);
  });
}

async function connections() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/healthz`);
    return Number((await res.json()).connections ?? 0);
  } catch {
    return 0; // 서버가 응답하지 않으면 접속자가 없다고 본다
  }
}

let waitingSince = 0;
async function check() {
  if (updating) return;
  if (!git("fetch", "origin", BRANCH).ok) return log("GitHub에서 새 버전을 확인하지 못했습니다(인터넷 연결?). 다음에 다시 확인합니다.");
  const local = head();
  const remote = git("rev-parse", `origin/${BRANCH}`).out;
  if (!remote || local === remote) {
    waitingSince = 0;
    return;
  }
  const n = await connections();
  if (n > 0) {
    waitingSince ||= Date.now();
    const waitedMin = (Date.now() - waitingSince) / 60000;
    if (!(FORCE_AFTER_MIN > 0 && waitedMin >= FORCE_AFTER_MIN)) return log(`새 버전이 있지만 접속자가 ${n}명이라 기다립니다.`);
    log(`${FORCE_AFTER_MIN}분을 기다렸으므로 접속자가 있어도 업데이트합니다.`);
  }
  waitingSince = 0;
  updating = true;
  try {
    log("새 버전을 받습니다...");
    await stopServer();
    const pull = git("pull", "--ff-only", "origin", BRANCH);
    if (!pull.ok) {
      log("업데이트에 실패했습니다(이 컴퓨터에서 직접 고친 파일이 있을 수 있습니다). 지금 버전으로 계속합니다.\n" + pull.err);
    } else {
      const after = head();
      log(`${local.slice(0, 7)} → ${after.slice(0, 7)}`);
      if (install(local, after) && build()) log("업데이트가 끝났습니다.");
      else log("설치나 빌드에 실패했습니다. 서버는 다시 켜지만 화면 파일이 맞지 않을 수 있습니다. 위의 오류를 확인하세요.");
    }
  } finally {
    updating = false;
    startServer();
  }
}

async function shutdown() {
  stopping = true;
  await stopServer();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (!existsSync(join(ROOT, "package.json"))) {
  console.error("게임 폴더(package.json이 있는 곳)를 찾지 못했습니다:", ROOT);
  process.exit(1);
}
log(`시작합니다. ${INTERVAL_SEC}초마다 origin/${BRANCH}에 새 버전이 있는지 확인합니다. 끄려면 Ctrl+C.`);
if (!existsSync(join(ROOT, "node_modules"))) {
  log("처음 실행: 패키지를 설치합니다...");
  run("npm", ["install"]);
}
// 켜기 전에 한 번 최신으로 맞추고 빌드한다
let needBuild = !existsSync(join(ROOT, "client", "dist", "index.html"));
if (git("fetch", "origin", BRANCH).ok && git("rev-parse", `origin/${BRANCH}`).out !== head()) {
  const before = head();
  const pull = git("pull", "--ff-only", "origin", BRANCH);
  if (pull.ok) {
    log("최신 버전으로 맞췄습니다.");
    install(before, head());
    needBuild = true;
  } else log("최신 버전으로 맞추지 못했습니다(고친 파일이 있나요?). 지금 버전으로 시작합니다.\n" + pull.err);
}
if (needBuild) build();
startServer();
setInterval(() => void check(), INTERVAL_SEC * 1000);
