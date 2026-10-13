// 밸런스 점검용 시뮬레이션: 간단한 봇이 플레이하는 판을 서버 로직 그대로 돌리고 지표를 뽑는다.
// 실행: npm run balance -w server [-- <초> <플레이어 수 목록 예: 1,3,6> <시드 수>]
import {
  CARDS,
  CAVALRY,
  SHIELD,
  MAX_PLAYERS,
  UNIT_COST,
  WEAPONS,
  mercPrice,
  CAMP_USE_RADIUS,
} from "@mercenary/shared";
import { Game } from "../src/game.js";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Result {
  heroDeaths: number;
  mercDeaths: number;
  firstDeathSec: number | null;
  level: number;
  kills: number;
  mercs: number;
  enemiesAt: number[];
  aliveHeroPct: number;
  deathsByType: number[];
  ownedByType: number[];
}

function simulate(players: number, seconds: number, seed: number): Result {
  const rng = mulberry32(seed);
  const g = new Game(rng);
  const ids: number[] = [];
  for (let i = 0; i < players; i++) ids.push(g.addPlayer(`bot${i}`)!);
  const botRng = mulberry32(seed + 1000);

  let heroDeaths = 0;
  let mercDeaths = 0;
  let firstDeathSec: number | null = null;
  const wasDead = new Map<number, boolean>();
  const mercDown = new Set<number>();
  const deathsByType = [0, 0, 0, 0, 0];
  const enemiesAt: number[] = [];
  let aliveTicks = 0;
  let totalTicks = 0;
  const ticks = seconds * 20;

  for (let t = 0; t < ticks; t++) {
    const enemies = g.snapshotEnemies();
    const camps = g.snapshotCamps();
    for (const id of ids) {
      const p = g.getPlayer(id)!;
      if (p.respawn > 0) continue;
      // 가장 가까운 적과 주변 위험도
      let near: (typeof enemies)[number] | null = null;
      let nearD = Infinity;
      let cx = 0;
      let cy = 0;
      let cn = 0;
      for (const e of enemies) {
        const d = Math.hypot(e[1] - p.x, e[2] - p.y);
        if (d < nearD) {
          nearD = d;
          near = e;
        }
        if (d < 260) {
          cx += e[1];
          cy += e[2];
          cn++;
        }
      }
      let dx = 0;
      let dy = 0;
      // 이동: 위협이 가까우면 반대쪽으로 물러나고, 아니면 캠프로 가거나 중앙 쪽에 머문다
      if (cn > 0 && nearD < 150) {
        dx = p.x - cx / cn;
        dy = p.y - cy / cn;
      } else {
        const owned = [...g.snapshotMercs()].filter((m) => m[5] === id);
        const used = owned.reduce((n, m) => n + UNIT_COST[m[4]]!, 0);
        const wantCamp = camps.find((c) => Math.hypot(c[1] - p.x, c[2] - p.y) < 1200 && p.gold >= 45 && used < p.leadership);
        if (wantCamp) {
          dx = wantCamp[1] - p.x;
          dy = wantCamp[2] - p.y;
        } else if (Math.hypot(p.x, p.y) > 500) {
          dx = -p.x;
          dy = -p.y;
        }
      }
      const len = Math.hypot(dx, dy) || 1;
      // 무기: 가까우면 상대에 맞는 근접 무기(방패→철퇴, 기병→창, 그 밖→검), 멀면 활
      let weapon = 0;
      if (near && nearD < 90) {
        const t = near[4];
        weapon = t === SHIELD ? 3 : t === CAVALRY ? 1 : 2;
      }
      g.setWeapon(id, weapon);
      g.setInput(id, {
        dx: dx / len,
        dy: dy / len,
        aim: near ? Math.atan2(near[2] - p.y, near[1] - p.x) : 0,
        fire: !!near && nearD < 420,
      });
      // 고용
      const camp = camps.find((c) => Math.hypot(c[1] - p.x, c[2] - p.y) < CAMP_USE_RADIUS - 10);
      if (camp && t % 10 === 0) {
        const mine = g.snapshotMercs().filter((m) => m[5] === id);
        const have = new Set(mine.map((m) => m[4]));
        const order = [4, 5, 6].map((k, slot) => ({ slot, type: camp[k]! })).sort((x, y) => Number(have.has(x.type)) - Number(have.has(y.type)) || botRng() - 0.5);
        for (const o of order) {
          if (mercPrice(o.type, mine.length) * p.priceMult <= p.gold) {
            g.buy(id, camp[0], o.slot);
            break;
          }
        }
      }
      // 카드: 무작위 선택
      if (p.offer.length > 0 && t % 20 === 0) g.pick(id, Math.floor(botRng() * p.offer.length));
    }
    g.step();

    // 지표
    for (const id of ids) {
      const dead = g.getPlayer(id)!.respawn > 0;
      if (dead && !wasDead.get(id)) {
        heroDeaths++;
        if (firstDeathSec === null) firstDeathSec = t / 20;
      }
      wasDead.set(id, dead);
      totalTicks++;
      if (!dead) aliveTicks++;
    }
    for (const m of g.snapshotMercs()) {
      if (m[8] > 0 && !mercDown.has(m[0])) {
        mercDown.add(m[0]);
        mercDeaths++;
        deathsByType[m[4]]!++;
      } else if (m[8] === 0) mercDown.delete(m[0]);
    }
    if (t > 0 && t % (60 * 20) === 0) enemiesAt.push(g.enemyCount);
  }
  const ps = ids.map((id) => g.getPlayer(id)!);
  return {
    heroDeaths,
    mercDeaths,
    firstDeathSec,
    level: ps.reduce((n, p) => n + p.level, 0) / ps.length,
    kills: ps.reduce((n, p) => n + p.kills, 0),
    mercs: g.snapshotMercs().length / ps.length,
    enemiesAt,
    aliveHeroPct: (100 * aliveTicks) / totalTicks,
    deathsByType,
    ownedByType: [0, 1, 2, 3, 4].map((t) => g.snapshotMercs().filter((m) => m[4] === t).length),
  };
}

const seconds = Number(process.argv[2] ?? 300);
const counts = (process.argv[3] ?? "1,3,6").split(",").map(Number).filter((n) => n >= 1 && n <= MAX_PLAYERS);
const seeds = Number(process.argv[4] ?? 3);

console.log(`시뮬레이션 ${seconds}초, 시드 ${seeds}개 평균 (봇: 물러서며 사격, 캠프에서 고용, 카드 무작위)`);
console.log("인원 | 주인공 사망(1인당) | 첫 사망(초) | 용병 쓰러짐(1인당) | 평균 레벨 | 처치(1인당) | 용병 수 | 적 수 @1/2/3/4분 | 생존율");
for (const n of counts) {
  const rs = Array.from({ length: seeds }, (_, i) => simulate(n, seconds, 7 + i * 101));
  const avg = (f: (r: Result) => number) => rs.reduce((s, r) => s + f(r), 0) / rs.length;
  const firsts = rs.map((r) => r.firstDeathSec).filter((v): v is number => v !== null);
  const enemies = [0, 1, 2, 3].map((k) => Math.round(avg((r) => r.enemiesAt[k] ?? 0)));
  console.log(
    `${String(n).padStart(2)}명 | ${(avg((r) => r.heroDeaths) / n).toFixed(1).padStart(6)} | ${firsts.length ? (firsts.reduce((a, b) => a + b, 0) / firsts.length).toFixed(0).padStart(5) : "  없음"}` +
      ` | ${(avg((r) => r.mercDeaths) / n).toFixed(1).padStart(6)} | ${avg((r) => r.level).toFixed(1).padStart(5)} | ${(avg((r) => r.kills) / n).toFixed(0).padStart(6)} | ${avg((r) => r.mercs).toFixed(1).padStart(4)} | ${enemies.join("/").padEnd(14)} | ${avg((r) => r.aliveHeroPct).toFixed(0)}%`,
  );
}
if (process.env.DETAIL) {
  const rs = Array.from({ length: seeds }, (_, i) => simulate(counts[0]!, seconds, 7 + i * 101));
  const names = ["기병", "창병", "궁병", "검방병", "둔기병"];
  console.log("병종별 쓰러짐(평균):", names.map((n, i) => `${n} ${(rs.reduce((a, r) => a + r.deathsByType[i]!, 0) / rs.length / counts[0]!).toFixed(1)}`).join(" · "));
  console.log("병종별 보유(마지막):", names.map((n, i) => `${n} ${(rs.reduce((a, r) => a + r.ownedByType[i]!, 0) / rs.length / counts[0]!).toFixed(1)}`).join(" · "));
}
void CARDS;
