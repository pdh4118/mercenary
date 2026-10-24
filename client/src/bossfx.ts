import { Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import {
  BFX_BLINK,
  BFX_CRASH,
  BFX_ICEBREAK,
  BFX_IMPACT,
  BOSS_SPEAR,
  BOSS_BLUNT,
  BFX_MACEBOOM,
  BFX_ROAR,
  BFX_SHIELDBREAK,
  BFX_SLASH,
  BOSS_SKILL_NAMES,
  BSK_ACCEL,
  BSK_BLINK,
  BSK_CLONE,
  BSK_FLURRY,
  BSK_GUARD,
  BSK_JUMP,
  BSK_MACETHROW,
  BSK_RAIN,
  BSK_RAMPAGE,
  BSK_REFLECT,
  BSK_SHIELDRUSH,
  BSK_SNIPE,
  BSK_STEALTH,
  BSK_ICEARROW,
  BSK_SUMMON,
  BSK_THROW,
  BSK_TRIPLE,
  BSK_WHIRL,
  BUL_BOSSARROW,
  BUL_ICE,
  BUL_LASSO,
  BUL_MACE,
  BUL_SHARD,
  BUL_SNIPE,
  BUL_SPEAR,
  EF_BUBBLE,
  EF_CORNERED,
  EF_GUARD,
  EF_INVULN,
  EF_MAD,
  EF_SCYTHE,
  EF_STEALTH,
  EF_STUN,
  EF_WHIRL,
  HZ_FIRE,
  HZ_GHOST,
  HZ_ICE,
  HZ_MACE,
  HZ_RAIN,
  HZ_RING,
  HZ_SHIELD,
  HZ_SPEAR,
  TELE_BAND,
  TELE_CIRCLE,
  TELE_CONE,
  TELE_LINE,
  TELE_RING,
  type HazardWire,
  type TeleWire,
} from "@mercenary/shared";

type Tex = Texture | null;

/** 휠윈드: 도는 장군 4방향 그림과 소용돌이 그림을 넘기는 간격(ms). 짧을수록 빠르게 돈다 */
const WHIRL_FRAME_MS = 55;

/** 스테이지 장군 그림: 기본 그림과 상황별 자세, 화면 배율 */
export interface BossArt {
  idle: Tex;
  scale: number;
  /** 스킬 번호·상태 비트·공격 중 여부에 따른 그림 */
  pose: (skill: number, flags: number, atk: boolean) => Tex;
}

export interface BossFxDeps {
  /** 바닥 효과(유닛 아래) */
  groundFx: Container;
  /** 서 있는 물건(장애물·방패·얼음벽·분신): zIndex를 y로 두고 정렬되는 층 */
  standLayer: Container;
  /** 위쪽 효과(컷 연출) */
  fxLayer: Container;
  /** 맨 위(이름표) */
  skyLayer: Container;
  spawnFloat: (text: string, x: number, y: number, style: Record<string, unknown>, life: number, pop: number) => void;
  sound: (name: string, x: number, y: number, vol?: number) => void;
  /** 던진 철퇴가 땅에 닿는 폭발 그림(갈라진 땅과 흙먼지). 그림이 없으면 false */
  maceBoom: (x: number, y: number, r: number) => boolean;
}

const BOSS_UNIT_TEX = [
  "boss1_idle", "boss1_attack",
  "boss2_idle", "boss2_guard", "boss2_thrust",
  "boss3_idle", "boss3_aim", "boss3_sky",
  "boss4_idle", "boss4_reflect", "boss4_charge",
  "boss5_idle", "boss5_jump", "boss5_smash",
  "boss5_whirlpose_0", "boss5_whirlpose_1", "boss5_whirlpose_2", "boss5_whirlpose_3",
  "boss6_idle", "boss6_cast", "boss6_blink",
  "boss7_gallop", "boss7_shoot",
  "boss8_normal", "boss8_mad",
] as const;

/**
 * 장군 스킬의 화면 표현: 예고(붉은 바닥 표시와 이름표), 장판·장애물·분신, 상태 표시(은신·무적·기절 등), 효과 컷, 장군 투사체 그림.
 */
export async function createBossFx(d: BossFxDeps) {
  const fx = async (name: string): Promise<Tex> => Assets.load<Texture>(`assets/fx/${name}.png`).catch(() => null);
  const seq = (name: string, idx: number[]) => Promise.all(idx.map((i) => fx(`${name}_${i}`)));
  const unit: Record<string, Tex> = {};
  await Promise.all(BOSS_UNIT_TEX.map(async (n) => (unit[n] = await Assets.load<Texture>(`assets/units/${n}.png`).catch(() => null))));
  const T = {
    impact: await seq("boss1_impact", [0, 1, 2, 3]),
    slash: await seq("boss1_slash", [1, 2, 3]),
    cry: await seq("boss1_cry", [0, 1, 2]),
    spearStuck: await fx("boss2_spear_stuck"),
    spearFly: await fx("boss2_spear_fly"),
    ice: await seq("boss3_ice", [0, 1, 2, 3, 4]),
    snipe: await fx("boss3_snipe"),
    rain: await seq("boss3_rain", [0, 1]),
    rainStuck: await fx("boss3_rain_stuck"),
    shield: await seq("boss4_shield", [0, 1, 2]),
    reflect: await seq("boss4_reflect", [0, 1, 2, 3]),
    inv: await seq("boss4_inv", [0, 1, 2, 3]),
    bash: await seq("boss4_bash", [1, 2, 3]),
    maceFly: await fx("boss5_mace_fly"),
    maceStuck: await fx("boss5_mace_stuck"),
    shard: await seq("boss5_shard", [0, 1, 2]),
    quake: await seq("boss5_quake", [0, 1, 2, 3, 4]),
    tornadoA: await seq("boss5_tornado_a", [0, 1, 2, 3]),
    tornadoB: await seq("boss5_tornado_b", [0, 1, 2, 3]),
    iceWall: await seq("boss6_ice", [0, 1, 2]),
    iceBreak: await seq("boss6_break", [0, 1, 2, 3]),
    bubble: await seq("boss6_shield", [0, 1, 2]),
    tele: await seq("boss6_tele", [0, 1, 2, 3]),
    fire: await seq("boss7_fire", [0, 1, 2]),
    fireOut: await fx("boss7_fire_out"),
    lasso: await fx("boss7_lasso"),
    cornered: await seq("boss7_cornered", [0, 1, 2]),
    dazed: await seq("boss8_dazed", [0, 1, 2, 3]),
    scythe: await seq("boss8_scythe", [0, 1, 2, 3]),
    crash: await seq("boss8_crash", [1, 2, 3, 4]),
  };
  const first = (a: Tex[]): Tex => a.find((t) => t !== null) ?? null;
  const pick = (a: Tex[], i: number): Tex => a[Math.max(0, Math.min(a.length - 1, i))] ?? first(a);
  const u = (n: string): Tex => unit[n] ?? null;

  /** 스테이지 1~8 장군 그림과 자세 */
  const art: BossArt[] = [
    { idle: u("boss1_idle"), scale: 0.5, pose: (sk, _fl, atk) => ((atk || sk > 0) && u("boss1_attack")) || u("boss1_idle") },
    { idle: u("boss2_idle"), scale: 0.6, pose: (sk, _fl, atk) => (sk === BSK_GUARD ? u("boss2_guard") : sk === BSK_CLONE || sk === BSK_TRIPLE || sk === BSK_THROW || atk ? u("boss2_thrust") : u("boss2_idle")) },
    { idle: u("boss3_idle"), scale: 0.4, pose: (sk, _fl, atk) => (sk === BSK_RAIN ? u("boss3_sky") : sk === BSK_SNIPE || sk === BSK_ICEARROW || atk ? u("boss3_aim") : u("boss3_idle")) },
    { idle: u("boss4_idle"), scale: 0.42, pose: (sk, fl) => (sk === BSK_REFLECT || fl & EF_GUARD ? u("boss4_reflect") : sk === BSK_SHIELDRUSH ? u("boss4_charge") : u("boss4_idle")) },
    { idle: u("boss5_idle"), scale: 0.42, pose: (sk, fl, atk) => (fl & EF_WHIRL ? u(`boss5_whirlpose_${Math.floor(performance.now() / WHIRL_FRAME_MS) % 4}`) : sk === BSK_JUMP ? u("boss5_jump") : sk === BSK_MACETHROW || sk === BSK_FLURRY || sk === BSK_WHIRL || atk ? u("boss5_smash") : u("boss5_idle")) },
    { idle: u("boss6_idle"), scale: 0.5, pose: (sk, _fl, atk) => (sk === BSK_BLINK ? u("boss6_blink") : sk > 0 || atk ? u("boss6_cast") : u("boss6_idle")) },
    { idle: u("boss7_gallop"), scale: 0.55, pose: (sk, _fl, atk) => (sk > 0 || atk ? u("boss7_shoot") : u("boss7_gallop")) },
    { idle: u("boss8_normal"), scale: 0.75, pose: (sk, fl) => (sk === BSK_ACCEL ? u("boss8_normal") : fl & EF_MAD || sk === BSK_RAMPAGE ? u("boss8_mad") : u("boss8_normal")) },
  ];
  void BSK_STEALTH;

  // --- 효과 컷(순서대로) ---------------------------------------------------------
  const seqFx: { sp: Sprite; frames: Tex[]; age: number; dur: number }[] = [];
  const playSeq = (frames: Tex[], x: number, y: number, dur: number, scale: number, rot: number) => {
    const f = first(frames);
    if (!f || seqFx.length > 60) return;
    const sp = new Sprite(f);
    sp.anchor.set(0.5);
    sp.scale.set(scale);
    sp.rotation = rot;
    sp.position.set(x, y);
    d.fxLayer.addChild(sp);
    seqFx.push({ sp, frames, age: 0, dur });
  };

  /** 장군 효과 이벤트(EVT_BOSSFX) */
  const playFx = (val: number, x: number, y: number, ang: number) => {
    if (val === BFX_IMPACT || val === BFX_CRASH) {
      playSeq(T.impact, x, y, 0.55, val === BFX_CRASH ? 1 : 0.7, 0);
      d.sound("knockback", x, y);
      if (val === BFX_CRASH) d.spawnFloat("쿵! 기절", x, y - 40, { fill: 0xffd45d, fontSize: 26, fontWeight: "900", stroke: { color: 0x5a2000, width: 5 } }, 1.2, 0.5);
    } else if (val === BFX_MACEBOOM) {
      if (!d.maceBoom(x, y, ang * 100)) playSeq(T.impact, x, y, 0.55, 1, 0);
      d.sound("skill_mace_hit", x, y);
    } else if (val === BFX_SLASH) playSeq(T.slash, x + Math.cos(ang) * 40, y + Math.sin(ang) * 40, 0.3, 1.2, ang);
    else if (val === BFX_ROAR) {
      playSeq(T.cry, x, y, 0.9, 1.5, 0);
      d.sound("boss_warning", x, y, 0.6);
    } else if (val === BFX_ICEBREAK) {
      playSeq(T.iceBreak, x, y - 30, 0.5, 1.1, 0);
      d.sound("skill_wall_break", x, y);
    } else if (val === BFX_SHIELDBREAK) {
      playSeq(T.bash, x, y, 0.5, 1.3, 0);
      d.sound("shield_break", x, y);
    } else if (val === BFX_BLINK) playSeq(T.tele, x, y, 0.5, 1, 0);
  };

  // --- 예고(텔레그래프)와 장판 ----------------------------------------------------------
  const teleG = new Graphics();
  d.groundFx.addChild(teleG);
  const labels: Text[] = [];

  interface HzView {
    kind: number;
    sp: Sprite | null;
    t0: number; // 처음 본 남은 시간(예고 진행도 계산용)
    sx?: number; // 서버 위치가 마지막으로 바뀐 때의 값과 시각(빠르게 움직이는 분신을 매끄럽게 그리려고)
    sy?: number;
    st?: number;
  }
  const hzViews = new Map<number, HzView>();
  const stood = (sp: Sprite) => {
    sp.anchor.set(0.5, 0.9);
    d.standLayer.addChild(sp);
    return sp;
  };

  const drawTele = (t: TeleWire, now: number, i: number) => {
    const [kind, tx, ty, ta, tA, tB, left, total, tsk] = t;
    const pr = Math.min(1, Math.max(0, 1 - left / Math.max(1, total)));
    const pulse = 0.5 + 0.5 * Math.sin(now / 90);
    const RED = 0xff3a2a;
    if (kind === TELE_LINE) {
      const px = -Math.sin(ta) * (tB / 2);
      const py = Math.cos(ta) * (tB / 2);
      const ex = tx + Math.cos(ta) * tA;
      const ey = ty + Math.sin(ta) * tA;
      teleG.poly([tx + px, ty + py, ex + px, ey + py, ex - px, ey - py, tx - px, ty - py]).fill({ color: RED, alpha: 0.12 }).stroke({ width: 2, color: RED, alpha: 0.55 + 0.25 * pulse });
      const fx2 = tx + Math.cos(ta) * tA * pr;
      const fy2 = ty + Math.sin(ta) * tA * pr;
      teleG.poly([tx + px, ty + py, fx2 + px, fy2 + py, fx2 - px, fy2 - py, tx - px, ty - py]).fill({ color: RED, alpha: 0.3 });
    } else if (kind === TELE_CONE) {
      teleG.moveTo(tx, ty).arc(tx, ty, tB, ta - tA, ta + tA).closePath().fill({ color: RED, alpha: 0.12 }).stroke({ width: 2, color: RED, alpha: 0.55 + 0.25 * pulse });
      teleG.moveTo(tx, ty).arc(tx, ty, tB * pr, ta - tA, ta + tA).closePath().fill({ color: RED, alpha: 0.3 });
    } else if (kind === TELE_BAND) {
      const mid = (tA + tB) / 2;
      teleG.circle(tx, ty, mid).stroke({ width: tB - tA, color: RED, alpha: 0.12 + 0.2 * pr });
      teleG.circle(tx, ty, tA).stroke({ width: 2, color: RED, alpha: 0.6 + 0.2 * pulse });
      teleG.circle(tx, ty, tB).stroke({ width: 2, color: RED, alpha: 0.6 + 0.2 * pulse });
    } else if (kind === TELE_RING) {
      // 틈이 있는 고리: 최대 반지름의 고리를 틈만 비우고 보여 준다
      const gap = tA;
      teleG.arc(tx, ty, tB, ta + gap, ta + Math.PI * 2 - gap).stroke({ width: 4, color: RED, alpha: 0.55 + 0.25 * pulse });
      for (const s of [-1, 1]) teleG.moveTo(tx, ty).lineTo(tx + Math.cos(ta + s * gap) * tB, ty + Math.sin(ta + s * gap) * tB).stroke({ width: 2, color: 0xffd45d, alpha: 0.7 });
      teleG.arc(tx, ty, tB * pr, ta + gap, ta + Math.PI * 2 - gap).stroke({ width: 8, color: RED, alpha: 0.3 });
    } else {
      teleG.circle(tx, ty, tA * (0.6 + 0.4 * pr)).stroke({ width: 3, color: kind === TELE_CIRCLE && tsk >= BSK_JUMP ? RED : 0xffb04a, alpha: 0.7 }).circle(tx, ty, tA * (0.6 + 0.4 * pr)).fill({ color: kind === TELE_CIRCLE && tsk >= BSK_JUMP ? RED : 0xffb04a, alpha: 0.12 + 0.12 * pr });
    }
    let lab = labels[i];
    if (!lab) {
      lab = new Text({ text: "", style: { fill: 0xffe08a, fontSize: 20, fontWeight: "900", stroke: { color: 0x3a0800, width: 5 } } });
      lab.anchor.set(0.5, 1);
      d.skyLayer.addChild(lab);
      labels[i] = lab;
    }
    lab.text = `${BOSS_SKILL_NAMES[tsk] ?? ""}!`;
    lab.position.set(tx, kind === TELE_BAND ? ty - tB - 14 : ty - 70);
    lab.visible = true;
  };

  const hzSprite = (h: HazardWire, v: HzView, now: number, stage: number): void => {
    const [, kind, x, y, ang, a, b, left, total, state] = h;
    const sp = v.sp;
    if (!sp) return;
    let px = x;
    let py = y;
    if (kind === HZ_GHOST) {
      // 분신은 아주 빨라서 서버 위치(20Hz)만 그리면 순간이동처럼 보인다: 바뀐 시점부터 진행 방향으로 이어서 그린다
      if (v.sx !== x || v.sy !== y) {
        v.sx = x;
        v.sy = y;
        v.st = now;
      }
      const ahead = Math.min(0.06, Math.max(0, (now - (v.st ?? now)) / 1000));
      px += Math.cos(ang) * BOSS_SPEAR.cloneSpeed * ahead;
      py += Math.sin(ang) * BOSS_SPEAR.cloneSpeed * ahead;
    }
    sp.position.set(px, py);
    sp.zIndex = py;
    const sec = left / 10;
    const fade = Math.min(1, sec / 0.5);
    switch (kind) {
      case HZ_SPEAR:
        sp.alpha = fade;
        break;
      case HZ_SHIELD: {
        const tex = pick(T.shield, b > 66 ? 0 : b > 33 ? 1 : 2);
        if (tex) sp.texture = tex;
        sp.rotation = ang;
        sp.width = a * 2;
        sp.height = 64;
        break;
      }
      case HZ_ICE: {
        const tex = pick(T.iceWall, b >= 4 ? 0 : b === 3 ? 1 : 2);
        if (tex) sp.texture = tex;
        sp.scale.set((a * 2.1) / 110);
        break;
      }
      case HZ_GHOST: {
        const tex = (art[stage - 1]?.pose(BSK_CLONE, 0, true)) ?? art[stage - 1]?.idle;
        if (tex) sp.texture = tex;
        const s = art[stage - 1]?.scale ?? 0.6;
        sp.scale.set(s * (Math.cos(ang) >= 0 ? 1 : -1), s);
        sp.tint = 0x9fe8c0;
        sp.alpha = 0.7;
        sp.anchor.set(0.5, 0.88);
        break;
      }
      case HZ_FIRE: {
        const tex = sec < 0.6 ? T.fireOut : pick(T.fire, Math.floor(now / 110) % 3);
        if (tex) sp.texture = tex;
        sp.anchor.set(0.5, 0.8);
        sp.width = a * 3;
        sp.scale.y = sp.scale.x;
        sp.alpha = Math.min(1, sec / 0.6);
        break;
      }
      case HZ_MACE:
        sp.alpha = 1;
        break;
      case HZ_RAIN: {
        if (state === 1) {
          if (b === 1) {
            const tex = pick(T.quake, Math.floor((1 - left / Math.max(1, total)) * 5));
            if (tex) sp.texture = tex;
            sp.anchor.set(0.5, 0.7);
            sp.scale.set((a * 2.4) / 125);
            sp.alpha = 1;
          } else {
            const tex = T.rainStuck;
            if (tex) sp.texture = tex;
            sp.anchor.set(0.5, 0.9);
            sp.scale.set(0.55);
            sp.alpha = Math.min(1, sec / 0.2);
          }
        } else {
          sp.visible = false;
          void total;
        }
        break;
      }
      default:
    }
    void total;
  };

  const hzTexture = (kind: number, b: number): Tex => {
    switch (kind) {
      case HZ_SPEAR:
        return T.spearStuck;
      case HZ_MACE:
        return T.maceStuck;
      case HZ_SHIELD:
        return first(T.shield);
      case HZ_ICE:
        return first(T.iceWall);
      case HZ_FIRE:
        return first(T.fire);
      case HZ_RAIN:
        return b === 1 ? first(T.quake) : T.rainStuck;
      case HZ_GHOST:
        return null;
      default:
        return null;
    }
  };

  /** 한 프레임: 예고·장판을 그린다 */
  /**
   * 휠윈드: 장군 뒤에 소용돌이 그림(회전 4컷)을 깔고, 앞에는 옅은 소용돌이를 한 겹 더 씌워 장군이 소용돌이 안에서 도는 것처럼 보이게 한다.
   * 바닥에는 피해 범위(먼지 원반과 고리)와 지면을 도는 칼날 빛줄기를 코드로 그린다. 도는 장군 그림은 enemy 그림 선택(art.pose)에서 고른다.
   */
  const whirlBack = new Graphics();
  const whirlFront = new Graphics();
  d.groundFx.addChild(whirlBack);
  d.fxLayer.addChild(whirlFront);
  const whirls: { id: number; x: number; y: number }[] = [];
  interface WhirlView {
    t0: number;
    back: Sprite;
    front: Sprite;
  }
  const whirlViews = new Map<number, WhirlView>();
  const WHIRL_HEIGHT = 250; // 소용돌이 그림이 서는 높이(px)
  const drawWhirls = (now: number) => {
    whirlBack.clear();
    whirlFront.clear();
    for (const [id, v] of whirlViews) {
      if (whirls.some((w) => w.id === id)) continue;
      v.back.destroy();
      v.front.destroy();
      whirlViews.delete(id);
    }
    const frameNo = Math.floor(now / WHIRL_FRAME_MS);
    for (const w of whirls) {
      let v = whirlViews.get(w.id);
      if (!v) {
        const back = new Sprite();
        const front = new Sprite();
        back.anchor.set(0.5, 0.96);
        front.anchor.set(0.5, 0.96);
        d.standLayer.addChild(back);
        d.standLayer.addChild(front);
        v = { t0: now, back, front };
        whirlViews.set(w.id, v);
      }
      const grow = Math.min(1, (now - v.t0) / 280); // 도는 순간 아래에서부터 솟아오른다
      const ta = pick(T.tornadoA, frameNo % 4);
      const tb = pick(T.tornadoB, (frameNo + 2) % 4);
      for (const [spr, tex, z, alpha] of [[v.back, ta, -2, 0.92], [v.front, tb, 2, 0.22]] as const) {
        if (tex) spr.texture = tex;
        const sc = (WHIRL_HEIGHT / (tex?.height || 509)) * (0.35 + 0.65 * grow);
        spr.scale.set(sc);
        spr.position.set(w.x, w.y + 14);
        spr.zIndex = w.y + z;
        spr.alpha = alpha * grow;
      }
      // 바닥: 피해 범위(먼지 원반·고리)와 지면을 도는 칼날 빛줄기
      const R = BOSS_BLUNT.whirlRadius * grow;
      const FLAT = 0.5;
      whirlBack.ellipse(w.x, w.y + 10, R, R * FLAT).fill({ color: 0xcdb98f, alpha: 0.16 * grow });
      whirlFront.ellipse(w.x, w.y + 10, R, R * FLAT).stroke({ width: 3, color: 0xe9f1ff, alpha: 0.3 * grow });
      const t = now / 1000;
      for (let b = 0; b < 3; b++) {
        const head = t * 14 + (b * Math.PI * 2) / 3;
        const n = 12;
        for (let j = 0; j < n; j++) {
          const f0 = j / n;
          const f1 = (j + 1) / n;
          const a0 = head - 1.3 * (1 - f0);
          const a1 = head - 1.3 * (1 - f1);
          const g = Math.sin(a1) > 0 ? whirlFront : whirlBack;
          g.moveTo(w.x + Math.cos(a0) * R * 0.92, w.y + 10 + Math.sin(a0) * R * 0.92 * FLAT)
            .lineTo(w.x + Math.cos(a1) * R * 0.92, w.y + 10 + Math.sin(a1) * R * 0.92 * FLAT)
            .stroke({ width: 2 + 8 * f1 * f1, color: f1 > 0.7 ? 0xffffff : 0xbcd6f5, alpha: grow * (0.1 + 0.8 * f1) });
        }
      }
    }
    whirls.length = 0;
  };

  const frame = (bt: TeleWire[], hz: HazardWire[], stage: number, dtMs: number, now: number) => {
    drawWhirls(now);
    teleG.clear();
    for (let i = 0; i < bt.length; i++) drawTele(bt[i]!, now, i);
    for (let i = bt.length; i < labels.length; i++) labels[i]!.visible = false;
    // 장판
    const seen = new Set<number>();
    for (const h of hz) {
      const [id, kind, x, y, ang, a, b, left, total, state] = h;
      seen.add(id);
      let v = hzViews.get(id);
      if (!v) {
        const tex = hzTexture(kind, b);
        let sp: Sprite | null = null;
        if (tex || kind === HZ_GHOST) {
          sp = new Sprite(tex ?? undefined);
          sp.anchor.set(0.5, kind === HZ_GHOST ? 0.88 : kind === HZ_SHIELD ? 0.5 : kind === HZ_FIRE ? 0.8 : 0.9);
          (kind === HZ_FIRE ? d.groundFx : d.standLayer).addChild(sp);
        }
        v = { kind, sp, t0: left };
        hzViews.set(id, v);
      }
      if (state === 0) v.t0 = Math.max(v.t0, left);
      // 예고 중인 화살비·철퇴 착탄: 바닥에 붉은 원
      if (kind === HZ_RAIN && state === 0) {
        const pr = Math.min(1, Math.max(0, 1 - left / Math.max(1, v.t0)));
        teleG.circle(x, y, a).fill({ color: 0xff3a2a, alpha: 0.1 + 0.2 * pr }).stroke({ width: 2, color: 0xff3a2a, alpha: 0.7 });
        if (b !== 1) {
          // 떨어지는 화살 한 대
          const ft = pick(T.rain, 0);
          if (ft) {
            if (!v.sp) {
              v.sp = new Sprite(ft);
              v.sp.anchor.set(0.5, 0.9);
              v.sp.scale.set(0.5);
              d.standLayer.addChild(v.sp);
            }
            v.sp.visible = true;
            v.sp.texture = ft;
            v.sp.position.set(x - 30 * (1 - pr), y - 380 * (1 - pr));
            v.sp.zIndex = y + 1;
            v.sp.rotation = 0.35;
          }
        } else if (v.sp) v.sp.visible = false;
        continue;
      }
      if (kind === HZ_RAIN && state === 1 && v.sp) v.sp.visible = true;
      if (kind === HZ_RING) {
        // 퍼지는 불꽃 고리: 틈(방향 ang, 반각 b/100)만 비우고 그린다
        const gap = b / 100;
        teleG.arc(x, y, a, ang + gap, ang + Math.PI * 2 - gap).stroke({ width: 30, color: 0xff6a1a, alpha: 0.35 }).arc(x, y, a, ang + gap, ang + Math.PI * 2 - gap).stroke({ width: 14, color: 0xffd27a, alpha: 0.9 });
        continue;
      }
      if (v.sp) hzSprite(h, v, now, stage);
    }
    for (const [id, v] of hzViews) {
      if (seen.has(id)) continue;
      v.sp?.destroy();
      hzViews.delete(id);
    }
    // 컷 연출
    for (let i = seqFx.length - 1; i >= 0; i--) {
      const f = seqFx[i]!;
      f.age += dtMs / 1000;
      const idx = Math.min(f.frames.length - 1, Math.floor((f.age / f.dur) * f.frames.length));
      const tex = f.frames[idx];
      if (tex) f.sp.texture = tex;
      f.sp.alpha = Math.max(0, Math.min(1, 2.2 * (1 - f.age / f.dur)));
      if (f.age >= f.dur) {
        f.sp.destroy();
        seqFx.splice(i, 1);
      }
    }
  };

  // --- 장군 몸 위 표시(은신·무적·기절·쉴드 등) ---------------------------------------
  const marks = new Map<string, Sprite>();
  const touched = new Set<string>();
  const mark = (id: number, kind: string, tex: Tex, x: number, y: number, scale: number, alpha: number, below = false, anchorY = 0.5): void => {
    const key = `${id}:${kind}`;
    touched.add(key);
    if (!tex) return;
    let sp = marks.get(key);
    if (!sp) {
      sp = new Sprite(tex);
      sp.anchor.set(0.5, anchorY);
      d.standLayer.addChild(sp);
      marks.set(key, sp);
    }
    sp.texture = tex;
    sp.anchor.set(0.5, anchorY);
    sp.scale.set(scale);
    sp.alpha = alpha;
    sp.position.set(x, y);
    sp.zIndex = below ? y - 1 : y + 2;
    sp.visible = true;
  };

  /**
   * 적(장군이든 아니든) 한 마리의 상태 표시. 돌려주는 값으로 투명도·색을 바꾼다.
   * @returns alpha 배율(은신이면 아주 투명), tint
   */
  const enemyMarks = (id: number, x: number, y: number, flags: number, boss: boolean, stage: number, size: number, now: number): { alpha: number; tint: number } => {
    let alpha = 1;
    let tint = 0xffffff;
    if (flags & EF_STEALTH) alpha = 0.12;
    if (flags & EF_INVULN) {
      tint = 0xffe9a0;
      if (boss) mark(id, "inv", pick(T.inv, 1 + (Math.floor(now / 140) % 2)), x, y + 6, 1.7, 0.6, true, 0.7);
    }
    if (!boss) return { alpha, tint };
    if (flags & EF_WHIRL) whirls.push({ id, x, y });
    const top = y - 120 * Math.max(0.8, size);
    if (flags & EF_STUN) mark(id, "dazed", pick(T.dazed, Math.floor(now / 110) % 4), x, top, 0.9, 0.95);
    if (flags & EF_CORNERED) mark(id, "cornered", pick(T.cornered, 1), x, top - 12, 0.6, 1);
    if (flags & EF_BUBBLE) mark(id, "bubble", pick(T.bubble, 1 + (Math.floor(now / 200) % 2)), x, y - 40, 2.1, 0.75);
    if ((flags & EF_GUARD) && stage === 4) mark(id, "reflect", pick(T.reflect, 2), x, y - 30, 1.6, 0.6);
    if (flags & EF_SCYTHE) mark(id, "scythe", pick(T.scythe, 3), x, y - 20, 1.7, 0.9);
    return { alpha, tint };
  };

  /** 이번 프레임에 표시를 갱신하지 않은 것(사라진 적)을 치운다 */
  const endEnemies = () => {
    for (const [key, sp] of marks) {
      if (touched.has(key)) continue;
      sp.destroy();
      marks.delete(key);
    }
    touched.clear();
  };

  /** 장군 투사체 그림(탄환 종류 2 이상) */
  const bulletLook = (kind: number): { tex: Tex; scale: number; anchorX: number } | null => {
    switch (kind) {
      case BUL_ICE:
        return { tex: pick(T.ice, 2), scale: 0.55, anchorX: 0.85 };
      case BUL_SNIPE:
        return { tex: T.snipe, scale: 0.8, anchorX: 0.9 };
      case BUL_SPEAR:
        return { tex: T.spearFly, scale: 0.9, anchorX: 0.95 };
      case BUL_MACE:
        return { tex: T.maceFly, scale: 0.8, anchorX: 0.5 };
      case BUL_LASSO:
        return { tex: T.lasso, scale: 0.55, anchorX: 0.92 };
      case BUL_SHARD:
        return { tex: pick(T.shard, 0), scale: 0.35, anchorX: 0.5 };
      case BUL_BOSSARROW:
        return null;
      default:
        return null;
    }
  };

  return { art, frame, playFx, enemyMarks, endEnemies, bulletLook, T };
}

