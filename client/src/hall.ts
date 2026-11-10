import { Assets, Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from "pixi.js";
import { HALL, HALL_ENTRY, HALL_PILLARS, HALL_WALL } from "@mercenary/shared";

/**
 * 성내 전장(옥좌의 방): 성문이 부서지면 전투가 옮겨 가는 넓은 홀. 그림 파일 없이 코드로 그린다(석재 바닥·붉은 카펫·옥좌 단·횃불·기둥).
 * 바닥은 모든 유닛 아래에, 기둥은 유닛과 같이 발 위치로 앞뒤를 가른다. 충돌은 서버(`hallSolids`)와 같은 모양이다.
 */
export interface Hall {
  /** units: 유닛 발 위치(기둥 뒤에 서 있는 유닛이 보이게 기둥이 반투명해진다) */
  update(now: number, units?: readonly { x: number; y: number }[]): void;
  destroy(): void;
}

const X0 = HALL.cx - HALL.hw;
const Y0 = HALL.cy - HALL.hh;
const W = HALL.hw * 2;
const H = HALL.hh * 2;
const TILE = 100;
export const HALL_OUTER = 760; // 홀 바깥 암벽을 덮는 폭(클라이언트가 이 안의 지형 그림도 숨긴다)
const OUTER = HALL_OUTER;

export const HALL_TEXTURES = ["boss10_hall_floor", "boss10_hall_wall", "boss10_hall_pillar", "boss10_hall_throne"].map((n) => `assets/fx/${n}.png`);

/** floorLayer: 바닥·벽(유닛 아래), objLayer: 옥좌(유닛 아래, 발 위치로 앞뒤), topLayer: 기둥(유닛 위, 뒤에 선 유닛이 있으면 반투명) */
export function createHall(floorLayer: Container, objLayer: Container, topLayer: Container = objLayer): Hall {
  const floor = new Graphics();
  floor.zIndex = -1e6;
  // 홀 바깥은 어두운 암벽(성 밖 풀밭이 비쳐 보이지 않게 넓게 덮는다)
  floor.rect(X0 - HALL_WALL - OUTER, Y0 - HALL_WALL - OUTER, W + (HALL_WALL + OUTER) * 2, H + (HALL_WALL + OUTER) * 2).fill(0x0f0d14);
  // 바깥 벽 두께
  floor.rect(X0 - HALL_WALL, Y0 - HALL_WALL, W + HALL_WALL * 2, H + HALL_WALL * 2).fill(0x1d1a24);
  floor.rect(X0 - HALL_WALL, Y0 - HALL_WALL, W + HALL_WALL * 2, H + HALL_WALL * 2).stroke({ width: 8, color: 0x0d0b12 });
  // 석재 벽 줄눈
  for (let i = 0; i < 6; i++) {
    const o = HALL_WALL - 18 - i * 18;
    if (o <= 0) break;
    floor.rect(X0 - o, Y0 - o, W + o * 2, H + o * 2).stroke({ width: 2, color: 0x2e2a39, alpha: 0.9 });
  }
  // 바닥 타일(바둑판)
  for (let ix = 0; ix < W / TILE; ix++) {
    for (let iy = 0; iy < H / TILE; iy++) {
      const dark = (ix + iy) % 2 === 0;
      floor.rect(X0 + ix * TILE, Y0 + iy * TILE, TILE, TILE).fill(dark ? 0x4b4757 : 0x544f61);
    }
  }
  floor.rect(X0, Y0, W, H).stroke({ width: 3, color: 0x2a2633, alpha: 0.9 });
  // 가장자리 그림자(벽 가까이가 어둡다)
  for (let i = 0; i < 6; i++) {
    const o = i * 14;
    floor.rect(X0 + o, Y0 + o, W - o * 2, H - o * 2).stroke({ width: 14, color: 0x000000, alpha: 0.07 });
  }
  // 붉은 카펫: 입구에서 옥좌까지
  const carpetTop = Y0 + 150;
  floor.rect(HALL.cx - 105, carpetTop, 210, Y0 + H - carpetTop).fill(0x7a1f26);
  floor.rect(HALL.cx - 105, carpetTop, 210, Y0 + H - carpetTop).stroke({ width: 5, color: 0xc9a24a });
  floor.rect(HALL.cx - 88, carpetTop, 176, Y0 + H - carpetTop).stroke({ width: 2, color: 0xc9a24a, alpha: 0.7 });
  // 옥좌 단(세 단)과 옥좌
  for (let i = 0; i < 3; i++) {
    const w = 460 - i * 80;
    const h = 46;
    floor.rect(HALL.cx - w / 2, Y0 + 10 + i * h, w, h).fill(0x6b6477 - i * 0x080808).stroke({ width: 2, color: 0x2a2633 });
  }
  floor.roundRect(HALL.cx - 54, Y0 + 14, 108, 120, 10).fill(0x3a1a1e).stroke({ width: 4, color: 0xc9a24a });
  floor.rect(HALL.cx - 38, Y0 + 40, 76, 54).fill(0x8c2630);
  // 입구 문 표시(남쪽 벽 가운데)
  floor.rect(HALL.cx - 130, Y0 + H - 6, 260, HALL_WALL * 0.7).fill(0x0c0a10).stroke({ width: 4, color: 0x4a3a28 });
  void HALL_ENTRY;

  // 횃불: 벽을 따라 일정 간격으로 불빛이 번진다
  const glow = new Graphics();
  glow.zIndex = -1e6 + 1;
  const torches: [number, number][] = [];
  for (let x = X0 + 150; x < X0 + W; x += 300) torches.push([x, Y0 + 6], [x, Y0 + H - 6]);
  for (let y = Y0 + 200; y < Y0 + H - 100; y += 300) torches.push([X0 + 6, y], [X0 + W - 6, y]);
  floorLayer.addChild(floor, glow);

  const pillars = new Container();
  objLayer.addChild(pillars);
  const made: Container[] = [];
  for (const [px, py] of HALL_PILLARS) {
    const c = new Container();
    c.position.set(px, py);
    c.zIndex = py + 30;
    const g = new Graphics();
    g.ellipse(0, 6, 54, 20).fill({ color: 0x000000, alpha: 0.35 }); // 바닥 그림자
    g.rect(-44, -14, 88, 28).fill(0x3d3948).stroke({ width: 3, color: 0x1a1721 }); // 받침
    g.rect(-30, -190, 60, 180).fill(0x6e697c).stroke({ width: 3, color: 0x1a1721 }); // 기둥
    g.rect(-12, -190, 10, 180).fill({ color: 0xffffff, alpha: 0.1 }); // 빛
    g.rect(-44, -214, 88, 30).fill(0x4d495a).stroke({ width: 3, color: 0x1a1721 }); // 머리
    c.addChild(g);
    objLayer.addChild(c);
    made.push(c);
  }

  // --- 그림(boss10_hall_*)이 받아지면 코드로 그린 임시 그림 대신 그것을 쓴다 ---
  let alive = true;
  const extra: Container[] = [];
  const texPillars: { sp: Sprite; x: number; y: number }[] = [];
  void Promise.all(HALL_TEXTURES.map((u) => Assets.load<Texture>(u))).then(([floorT, wallT, pillarT, throneT]) => {
    if (!alive || !floorT || !wallT || !pillarT || !throneT) return;
    floor.visible = false;
    for (const c of made) c.visible = false;
    const Z = -1e6;
    const base = new Graphics();
    base.zIndex = Z;
    base.rect(X0 - HALL_WALL - OUTER, Y0 - HALL_WALL - OUTER, W + (HALL_WALL + OUTER) * 2, H + (HALL_WALL + OUTER) * 2).fill(0x0f0d14);
    const tile = new TilingSprite({ texture: floorT, width: W, height: H });
    tile.position.set(X0, Y0);
    tile.tileScale.set(0.78);
    tile.zIndex = Z + 1;
    const deco = new Graphics();
    deco.zIndex = Z + 2;
    for (let i = 0; i < 6; i++) {
      const o = i * 14;
      deco.rect(X0 + o, Y0 + o, W - o * 2, H - o * 2).stroke({ width: 14, color: 0x000000, alpha: 0.07 }); // 벽 가까이가 어둡다
    }
    const carpetTop = Y0 + 330;
    deco.rect(HALL.cx - 105, carpetTop, 210, Y0 + H - carpetTop).fill(0x7a1f26);
    deco.rect(HALL.cx - 105, carpetTop, 210, Y0 + H - carpetTop).stroke({ width: 5, color: 0xc9a24a });
    deco.rect(HALL.cx - 88, carpetTop, 176, Y0 + H - carpetTop).stroke({ width: 2, color: 0xc9a24a, alpha: 0.7 });
    deco.rect(HALL.cx - 130, Y0 + H - 6, 260, HALL_WALL * 0.7).fill(0x0c0a10).stroke({ width: 4, color: 0x4a3a28 }); // 입구
    // 벽: 북쪽은 벽돌 면이 보이고, 나머지 세 쪽은 윗면(석재 갓돌)만 보인다
    const ledge = new Texture({ source: wallT.source, frame: new Rectangle(wallT.frame.x, wallT.frame.y, wallT.frame.width, 52) });
    const mk = (tex: Texture, x: number, y: number, w: number, h: number, rot = 0): Sprite => {
      const sp = new Sprite(tex);
      sp.width = w;
      sp.height = h;
      sp.position.set(x, y);
      sp.rotation = rot;
      sp.zIndex = Z + 3;
      return sp;
    };
    const wl = [
      mk(ledge, X0 - HALL_WALL, Y0 + H, W + HALL_WALL * 2, HALL_WALL), // 남
      mk(ledge, X0, Y0 - HALL_WALL, H + HALL_WALL * 2, HALL_WALL, Math.PI / 2), // 동(회전: 왼쪽 위 기준이라 오른쪽 벽 바깥으로)
      mk(ledge, X0, Y0 + H + HALL_WALL, H + HALL_WALL * 2, HALL_WALL, -Math.PI / 2), // 서
      mk(wallT, X0 - HALL_WALL, Y0 - 150 + 6, W + HALL_WALL * 2, 150), // 북(벽돌 면)
    ];
    wl[1]!.position.set(X0 + W + HALL_WALL, Y0 - HALL_WALL);
    wl[2]!.position.set(X0 - HALL_WALL, Y0 + H + HALL_WALL);
    floorLayer.addChild(base, tile, deco, ...wl);
    extra.push(base, tile, deco, ...wl);
    glow.zIndex = Z + 4;
    // 옥좌: 군주 뒤(북쪽). 군주보다 아래에 그린다
    const th = new Sprite(throneT);
    th.anchor.set(0.5, 1);
    th.scale.set(0.8);
    th.position.set(HALL.cx, Y0 + 330);
    th.zIndex = Y0 + 100;
    objLayer.addChild(th);
    extra.push(th);
    // 기둥: 유닛 위에 그린다(뒤에 선 유닛이 있으면 update가 반투명하게 한다)
    for (const [px, py] of HALL_PILLARS) {
      const sp = new Sprite(pillarT);
      sp.anchor.set(0.5, 0.93);
      sp.scale.set(0.26);
      sp.position.set(px, py);
      topLayer.addChild(sp);
      extra.push(sp);
      texPillars.push({ sp, x: px, y: py });
    }
  }).catch(() => {});

  return {
    update(now, units) {
      for (const pl of texPillars) {
        let behind = false;
        if (units) for (const u of units) if (Math.abs(u.x - pl.x) < 80 && u.y < pl.y + 6 && u.y > pl.y - 360) { behind = true; break; }
        pl.sp.alpha += ((behind ? 0.45 : 1) - pl.sp.alpha) * 0.3;
      }
      glow.clear();
      for (const [i, [x, y]] of torches.entries()) {
        const f = 0.8 + 0.2 * Math.sin(now / 130 + i * 1.7);
        glow.circle(x, y, 120 * f).fill({ color: 0xff9a3c, alpha: 0.06 });
        glow.circle(x, y, 46 * f).fill({ color: 0xffc46a, alpha: 0.16 });
        glow.circle(x, y, 9).fill({ color: 0xfff0b0, alpha: 0.9 });
      }
    },
    destroy() {
      alive = false;
      for (const c of extra) c.destroy();
      floor.destroy();
      glow.destroy();
      for (const c of made) c.destroy({ children: true });
      pillars.destroy();
    },
  };
}
