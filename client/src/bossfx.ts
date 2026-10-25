import { Assets, Container, Graphics, Sprite, Text, TilingSprite, type Texture } from "pixi.js";
import {
  BFX_BLINK,
  BFX_CRASH,
  BFX_ICEBREAK,
  BFX_IMPACT,
  BFX_THRUST,
  BFX_BACKSTEP,
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
  BSK_CHAIN,
  BSK_DRAIN,
  BSK_FOG,
  BSK_ORB,
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
  BUL_ORB,
  BFX_CHAINBREAK,
  BFX_HEAL,
  BFX_RISE,
  HZ_CHAIN,
  HZ_CORPSE,
  HZ_DRAINRING,
  HZ_FOG,
  HZ_LEECH,
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
  "boss9_idle", "boss9_cast", "boss9_drain",
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
    thrust: await seq("boss2_thrust", [0, 1, 2]),
    dust: await seq("boss3_dust", [0, 1, 2, 3]),
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
    spinRing: await seq("boss5_spin", [0, 1, 2, 3]),
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
    shell: await seq("boss4_shell", [0, 1, 2, 3, 4]),
    shellHit: await seq("boss4_shell_hit", [0, 1, 2]),
    fogBurst: await seq("boss9_fog_burst", [0, 1, 2, 3]),
    fog: await seq("boss9_fog", [0, 1, 2, 3]),
    corpse: await fx("boss9_corpse"),
    revive: await seq("boss9_revive", [0, 1, 2, 3]),
    rise: await seq("boss9_rise", [0, 1, 2, 3]),
    drainRing: await seq("boss9_drain_ring", [0, 1, 2, 3]),
    drainBeam: await fx("boss9_drain_beam"),
    chainLink: await fx("boss9_chain_link"),
    chainMark: await seq("boss9_chain_mark", [0, 1, 2]),
    chainBreak: await seq("boss9_chain_break", [0, 1, 2]),
    orb: await seq("boss9_orb", [0, 1, 2]),
    riceDrop: await fx("rice_drop"),
    riceGlint: await seq("rice_glint", [0, 1]),
    riceEat: await seq("rice_eat", [0, 1, 2]),
    supplyBurst: await seq("supply_burst", [0, 1, 2]),
  };
  const first = (a: Tex[]): Tex => a.find((t) => t !== null) ?? null;
  const pick = (a: Tex[], i: number): Tex => a[Math.max(0, Math.min(a.length - 1, i))] ?? first(a);
  const u = (n: string): Tex => unit[n] ?? null;
  /** 스켈레톤 그림(병종 번호 순서: 기병·창병·궁병·검방병·둔기병·마법사) */
  const skelTex: Tex[] = await Promise.all(["cavalry", "spear", "archer", "sword", "blunt", "mage"].map(async (n) => Assets.load<Texture>(`assets/units/skel_${n}.png`).catch(() => null)));

  /** 군량병 그림: 서 있기·달리기 5컷·피격 */
  const supply = {
    idle: await Assets.load<Texture>("assets/units/supply_idle.png").catch(() => null),
    run: await Promise.all([0, 1, 2, 3, 4].map(async (i) => Assets.load<Texture>(`assets/units/supply_run_${i}.png`).catch(() => null))),
    hurt: await Assets.load<Texture>("assets/units/supply_hurt.png").catch(() => null),
  };

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
    { idle: u("boss9_idle"), scale: 0.42, pose: (sk) => (sk === BSK_DRAIN ? u("boss9_drain") : sk === BSK_FOG || sk === BSK_CHAIN || sk === BSK_ORB ? u("boss9_cast") : u("boss9_idle")) },
  ];
  void BSK_STEALTH;

  // --- 효과 컷(순서대로) ---------------------------------------------------------
  const seqFx: { sp: Sprite; frames: Tex[]; age: number; dur: number }[] = [];
  const playSeq = (frames: Tex[], x: number, y: number, dur: number, scale: number, rot: number, anchorX = 0.5) => {
    const f = first(frames);
    if (!f || seqFx.length > 60) return;
    const sp = new Sprite(f);
    sp.anchor.set(anchorX, 0.5);
    sp.scale.set(scale);
    sp.rotation = rot;
    sp.position.set(x, y);
    d.fxLayer.addChild(sp);
    seqFx.push({ sp, frames, age: 0, dur });
  };

  const now0 = (): number => performance.now();
  let lastThrustSound = 0;
  /** 창 찌르기 줄기의 밝은 심: 앞으로 뻗으며 가늘어지는 흰 초록 선이 0.2초 동안 사라진다(그림 컷 위에 겹쳐 더 또렷하게 보인다) */
  const thrustG = new Graphics();
  d.fxLayer.addChild(thrustG);
  const thrustCores: { x: number; y: number; ang: number; len: number; age: number }[] = [];
  const drawThrustCores = (dtMs: number) => {
    thrustG.clear();
    for (let i = thrustCores.length - 1; i >= 0; i--) {
      const c = thrustCores[i]!;
      c.age += dtMs / 1000;
      if (c.age >= 0.2) {
        thrustCores.splice(i, 1);
        continue;
      }
      const k = c.age / 0.2;
      const reach = c.len * Math.min(1, 0.35 + k * 3); // 앞으로 쭉 뻗는다
      const w = 9 * (1 - k);
      const px = -Math.sin(c.ang);
      const py = Math.cos(c.ang);
      const ex = c.x + Math.cos(c.ang) * reach;
      const ey = c.y + Math.sin(c.ang) * reach;
      thrustG.poly([c.x + px * w, c.y + py * w, ex, ey, c.x - px * w, c.y - py * w]).fill({ color: 0xe8ffe0, alpha: 0.75 * (1 - k) });
      thrustG.moveTo(c.x, c.y).lineTo(ex, ey).stroke({ width: 2, color: 0xffffff, alpha: 0.9 * (1 - k) });
    }
  };

  /** 장군 효과 이벤트(EVT_BOSSFX) */
  const playFx = (val: number, x: number, y: number, ang: number, len = 0) => {
    if (val === BFX_IMPACT || val === BFX_CRASH) {
      playSeq(T.impact, x, y, 0.55, val === BFX_CRASH ? 1 : 0.7, 0);
      d.sound("knockback", x, y);
      if (val === BFX_CRASH) d.spawnFloat("쿵! 기절", x, y - 40, { fill: 0xffd45d, fontSize: 26, fontWeight: "900", stroke: { color: 0x5a2000, width: 5 } }, 1.2, 0.5);
    } else if (val === BFX_RISE) {
      playSeq(T.rise, x, y - 20, 0.6, 1.3, 0);
      d.sound("skill_wall_break", x, y, 0.5);
    } else if (val === BFX_HEAL) {
      d.spawnFloat(`+${Math.round(len)}`, x, y, { fill: 0x7dff8a, fontSize: 24, fontWeight: "800", stroke: { color: 0x0a3a14, width: 4 } }, 0.9, 0.2);
    } else if (val === BFX_CHAINBREAK) {
      playSeq(T.chainBreak, x, y, 0.45, 1.3, 0);
      d.sound("shield_break", x, y, 0.7);
    } else if (val === BFX_BACKSTEP) {
      // 뒤로 훌쩍 물러나는 먼지: 물러나는 쪽을 향해 퍼진다
      playSeq(T.dust, x, y + 6, 0.4, 1.1, 0);
      d.sound("skill_backstep", x, y, 0.8);
    } else if (val === BFX_THRUST) {
      // 창을 앞으로 찌르는 줄기: 몸 앞에서 시작해 길이만큼 뻗는다(그림 길이 약 190px을 늘려 맞춘다)
      const L = Math.max(60, len || 300);
      playSeq(T.thrust, x + Math.cos(ang) * 26, y - 26 + Math.sin(ang) * 26, 0.22, L / 190, ang, 0.02);
      thrustCores.push({ x: x + Math.cos(ang) * 26, y: y - 26 + Math.sin(ang) * 26, ang, len: L, age: 0 });
      if (now0() - lastThrustSound > 140) {
        lastThrustSound = now0();
        d.sound("spear_thrust", x, y, 0.8); // 방어 태세의 연속 찌르기는 소리를 겹쳐 내지 않는다
      }
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
    lx?: number; // 분신 잔상을 마지막으로 남긴 자리
    ly?: number;
    endAt?: number; // 화살비: 이 시각(ms)에 땅에 닿는다(남은 시간이 0.1초 단위로만 오므로 사이를 이어서 그린다)
    lastLeft?: number;
    sx?: number; // 서버 위치가 마지막으로 바뀐 때의 값과 시각(빠르게 움직이는 분신을 매끄럽게 그리려고)
    sy?: number;
    st?: number;
  }
  const hzViews = new Map<number, HzView>();
  /** 분신이 달려간 길에 남는 어두운 잔상(0.32초 동안 옅어지며 사라진다) */
  const trails: { sp: Sprite; age: number }[] = [];
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
        // a=1 달리는 중(찌르며 달려가는 자세 + 지나온 길에 어두운 잔상), a=2 서 있음, a=3 방금 찔렀음(찌르는 자세)
        const ba = art[stage - 1];
        const lunge = ba?.pose(BSK_CLONE, 0, true) ?? ba?.idle;
        const tex = a === 2 ? ba?.idle ?? lunge : lunge;
        if (tex) sp.texture = tex;
        const s = ba?.scale ?? 0.6;
        sp.scale.set(s * (Math.cos(ang) >= 0 ? 1 : -1), s);
        sp.tint = 0x9fe8c0;
        sp.alpha = a === 1 ? 0.78 : Math.min(0.78, sec / 0.4); // 멈춘 뒤 마지막 0.4초에 걸쳐 사라진다
        sp.anchor.set(0.5, 0.88);
        if (a === 1 && tex) {
          if (v.lx === undefined || v.ly === undefined) {
            v.lx = px;
            v.ly = py;
          }
          let dd = Math.hypot(px - v.lx, py - v.ly);
          while (dd >= 36) {
            const k = 36 / dd;
            v.lx += (px - v.lx) * k;
            v.ly! += (py - v.ly!) * k;
            const ghost = new Sprite(tex);
            ghost.anchor.set(0.5, 0.88);
            ghost.scale.set(s * (Math.cos(ang) >= 0 ? 1 : -1), s);
            ghost.tint = 0x2c3a40;
            ghost.alpha = 0.55;
            ghost.position.set(v.lx, v.ly!);
            ghost.zIndex = v.ly! - 1;
            d.standLayer.addChild(ghost);
            trails.push({ sp: ghost, age: 0 });
            dd = Math.hypot(px - v.lx, py - v.ly!);
          }
        }
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
        return null; // 그림 대신 코드로 그린 곡면 판(drawCurvedWall)
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

  /**
   * 방패 효과(반사 태세·거대 방패): 평평하지만 살짝 휜 큰 하늘색 판. 벽을 따라 곡선을 그리고 위로 세워 올린다.
   * dir 방향으로 볼록하게 휘고, 가운데가 가장 앞으로 나온다. hp(0~100)가 낮을수록 금이 간다.
   */
  const wallG = new Graphics();
  d.fxLayer.addChild(wallG);
  const drawCurvedWall = (cx: number, cy: number, along: number, dir: number, halfLen: number, bulge: number, height: number, alpha: number, hp: number, now: number): void => {
    const FLAT = 0.6; // 비스듬한 시점이라 바닥 위의 길이를 세로로 눌러 그린다
    const THICK = 20; // 판의 두께(윗면이 보인다)
    const N = 18;
    const bot: [number, number][] = [];
    const top: [number, number][] = [];
    const topIn: [number, number][] = []; // 윗면의 안쪽 가장자리(두께만큼 안으로)
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * 2 - 1;
      const bulgeNow = bulge * (1 - t * t);
      const gx = cx + Math.cos(along) * halfLen * t + Math.cos(dir) * bulgeNow;
      const gy = cy + (Math.sin(along) * halfLen * t + Math.sin(dir) * bulgeNow) * FLAT;
      bot.push([gx, gy]);
      const ty = gy - height;
      top.push([gx, ty]);
      topIn.push([gx - Math.cos(dir) * THICK, ty - Math.sin(dir) * THICK * FLAT]);
    }
    const flat = (a: [number, number][]) => a.flatMap(([x, y]) => [x, y]);
    // 앞면: 하늘색 반투명 판 + 위쪽이 더 밝은 층
    wallG.poly([...flat(bot), ...flat(top.slice().reverse())]).fill({ color: 0x4aa8ff, alpha: 0.34 * alpha });
    const mid = top.map(([x, y], i) => [x, y + (bot[i]![1] - y) * 0.5] as [number, number]);
    wallG.poly([...flat(top), ...flat(mid.slice().reverse())]).fill({ color: 0xbfe6ff, alpha: 0.24 * alpha });
    // 윗면(두께): 밝게
    wallG.poly([...flat(top), ...flat(topIn.slice().reverse())]).fill({ color: 0xe8f8ff, alpha: 0.55 * alpha });
    // 테두리
    wallG.poly(flat(top), false).stroke({ width: 4, color: 0xffffff, alpha: 0.95 * alpha });
    wallG.poly(flat(topIn), false).stroke({ width: 2, color: 0xbfe6ff, alpha: 0.8 * alpha });
    wallG.poly(flat(bot), false).stroke({ width: 3, color: 0x3b8fd6, alpha: 0.85 * alpha });
    wallG.moveTo(bot[0]![0], bot[0]![1]).lineTo(top[0]![0], top[0]![1]).moveTo(bot[N]![0], bot[N]![1]).lineTo(top[N]![0], top[N]![1]).stroke({ width: 3, color: 0xcfeaff, alpha: 0.9 * alpha });
    // 세로 빛줄기(천천히 흐른다)
    for (let j = 0; j < 3; j++) {
      const i = Math.round(((((now / 2600 + j / 3) % 1) * 0.8 + 0.1) * N));
      wallG.moveTo(bot[i]![0], bot[i]![1]).lineTo(top[i]![0], top[i]![1]).stroke({ width: 2, color: 0xffffff, alpha: 0.35 * alpha });
    }
    // 금: 체력이 줄수록 늘어난다
    const cracks = hp > 66 ? 0 : hp > 33 ? 2 : 4;
    for (let c = 0; c < cracks; c++) {
      const i = 3 + c * 4 + (c % 2);
      const x0 = top[i]![0];
      let y0 = top[i]![1] + height * 0.12;
      const x1 = bot[i]![0];
      const yb = bot[i]![1];
      wallG.moveTo(x0, y0);
      for (let s = 1; s <= 4; s++) {
        y0 += (yb - y0) / (5 - s);
        wallG.lineTo(x0 + (s % 2 ? 7 : -7) + (x1 - x0) * (s / 4), y0);
      }
      wallG.stroke({ width: 2, color: 0xffffff, alpha: 0.8 * alpha });
    }
  };
  const guardWalls: { x: number; y: number; ang: number }[] = [];

  // --- 네크로맨서: 안개·시체·생명 흡수 선·영혼 사슬 ---------------------------------------
  const necroG = new Graphics();
  d.fxLayer.addChild(necroG);
  const necroViews = new Map<number, { sprites: Sprite[] }>();
  const necroSprite = (id: number, i: number, layer: Container, tex: Tex, anchorX = 0.5, anchorY = 0.5): Sprite | null => {
    if (!tex) return null;
    let v = necroViews.get(id);
    if (!v) {
      v = { sprites: [] };
      necroViews.set(id, v);
    }
    let sp = v.sprites[i];
    if (!sp) {
      sp = new Sprite(tex);
      layer.addChild(sp);
      v.sprites[i] = sp;
    }
    sp.texture = tex;
    sp.anchor.set(anchorX, anchorY);
    sp.visible = true;
    return sp;
  };
  /** 네크로맨서 장판 하나를 그린다. 이 종류가 아니면 false */
  const necroHz = (h: HazardWire, now: number): boolean => {
    const [id, kind, x, y, ang, a, b, left, total, state] = h;
    if (kind === HZ_FOG) {
      const age = total / 10 - left / 10;
      const tex = age < 0.5 ? pick(T.fogBurst, Math.floor(age / 0.125)) : pick(T.fog, Math.floor(now / 180) % 4);
      const sp = necroSprite(id, 0, d.groundFx, tex);
      if (sp) {
        const sc = (a * 2.15) / 450;
        sp.scale.set(sc);
        sp.position.set(x, y);
        sp.alpha = 0.82 * Math.min(1, left / 10 / 1.2); // 걷힐 때 서서히 옅어진다
      }
    } else if (kind === HZ_CORPSE) {
      const sp = necroSprite(id, 0, d.standLayer, T.corpse, 0.5, 0.7);
      if (sp) {
        sp.scale.set(1.1);
        sp.position.set(x, y);
        sp.zIndex = y - 3;
        sp.alpha = 0.6 + 0.4 * (b / 3);
      }
      const rev = ang > 0.5;
      const fl = necroSprite(id, 1, d.standLayer, rev ? pick(T.revive, Math.floor(now / 110) % 4) : null, 0.5, 0.75);
      if (fl) {
        fl.visible = rev;
        fl.scale.set(1.5);
        fl.position.set(x, y + 4);
        fl.zIndex = y - 2;
        fl.alpha = 0.7 + 0.3 * Math.sin(now / 120);
      }
    } else if (kind === HZ_DRAINRING) {
      const sp = necroSprite(id, 0, d.groundFx, pick(T.drainRing, Math.floor(now / 150) % 4));
      if (sp) {
        const w = pick(T.drainRing, 0)?.width ?? 450;
        sp.scale.set((a * 2.05) / w, (a * 2.05 * 0.8) / w);
        sp.position.set(x, y + 12);
        sp.alpha = state === 0 ? 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(now / 110)) : 0.85; // 징조 동안은 맥박치고, 시작하면 또렷하다
      }
    } else if (kind === HZ_LEECH) {
      const bm = necroSprite(id, 0, d.fxLayer, T.drainBeam, 0, 0.5);
      if (bm) {
        bm.position.set(x, y);
        bm.rotation = ang;
        bm.width = a;
        bm.height = 22;
        bm.alpha = 0.5 + 0.25 * Math.sin(now / 90 + id);
      }
      // 보스 쪽으로 빨려 가는 빛 알갱이
      for (let j = 0; j < 4; j++) {
        const p = 1 - (((now / 700 + j / 4 + id * 0.13) % 1 + 1) % 1);
        necroG.circle(x + Math.cos(ang) * a * p, y + Math.sin(ang) * a * p, 4).fill({ color: 0xd8ffd0, alpha: 0.9 });
      }
    } else if (kind === HZ_CHAIN) {
      let v = necroViews.get(id);
      if (!v) {
        v = { sprites: [] };
        necroViews.set(id, v);
      }
      if (!v.sprites[0] && T.chainLink) {
        const ts = new TilingSprite({ texture: T.chainLink, width: a, height: 30 });
        ts.anchor.set(0, 0.5);
        d.fxLayer.addChild(ts);
        v.sprites[0] = ts as unknown as Sprite;
      }
      const ch = v.sprites[0] as unknown as TilingSprite | undefined;
      if (ch) {
        ch.position.set(x, y);
        ch.rotation = ang;
        ch.width = a;
        ch.height = 30;
        ch.tileScale.set(30 / (T.chainLink?.height || 68));
        ch.alpha = 0.55 + 0.45 * (b / 5); // 끊기기 직전일수록 옅어진다
        ch.tint = b <= 2 ? 0xffc0c0 : 0xffffff;
      }
      const mk = necroSprite(id, 1, d.fxLayer, pick(T.chainMark, Math.floor(now / 150) % 3), 0.5, 1);
      if (mk) {
        mk.scale.set(0.9);
        mk.position.set(x + Math.cos(ang) * a, y + Math.sin(ang) * a - 40);
      }
    } else return false;
    return true;
  };

  /** 한 프레임: 예고·장판을 그린다 */
  /**
   * 휠윈드: 몸 둘레를 크게 도는 속이 빈 소용돌이 고리(회전 4컷)를 두 겹 그린다 — 바닥에 넓은 고리 하나(장군 뒤), 몸통 높이에 작은 고리 하나(장군 앞).
   * 가운데가 비어 있어 장군 몸이 그대로 보인다. 바닥에는 피해 범위 원반을 깔고, 도는 장군 그림은 enemy 그림 선택(art.pose)에서 고른다.
   */
  const whirlBack = new Graphics();
  d.groundFx.addChild(whirlBack);
  const whirls: { id: number; x: number; y: number }[] = [];
  interface WhirlView {
    t0: number;
    ground: Sprite;
    body: Sprite;
  }
  const whirlViews = new Map<number, WhirlView>();
  const drawWhirls = (now: number) => {
    whirlBack.clear();
    for (const [id, v] of whirlViews) {
      if (whirls.some((w) => w.id === id)) continue;
      v.ground.destroy();
      v.body.destroy();
      whirlViews.delete(id);
    }
    const frameNo = Math.floor(now / WHIRL_FRAME_MS);
    for (const w of whirls) {
      let v = whirlViews.get(w.id);
      if (!v) {
        const ground = new Sprite();
        const body = new Sprite();
        ground.anchor.set(0.5);
        body.anchor.set(0.5);
        d.standLayer.addChild(ground);
        d.standLayer.addChild(body);
        v = { t0: now, ground, body };
        whirlViews.set(w.id, v);
      }
      const grow = Math.min(1, (now - v.t0) / 250); // 도는 순간 몸에서 바깥으로 퍼진다
      const FLAT = 0.52; // 비스듬한 시점이라 가로로 넓은 타원으로 눌러 그린다
      const rings: [Sprite, number, number, number, number, number][] = [
        // 스프라이트, 가로 지름, 세로 중심 오프셋, 프레임 어긋남, zIndex 보정, 투명도
        [v.ground, BOSS_BLUNT.whirlRadius * 2.15, 14, 0, -2, 0.92],
        [v.body, BOSS_BLUNT.whirlRadius * 1.5, -34, 2, 2, 0.8],
      ];
      for (const [spr, width, dy, shift, z, alpha] of rings) {
        const tex = pick(T.spinRing, (frameNo + shift) % 4);
        if (tex) spr.texture = tex;
        const sx = ((width * grow) / (tex?.width || 132)) * 1;
        spr.scale.set(sx, sx * FLAT * ((tex?.width || 132) / (tex?.height || 120)));
        spr.position.set(w.x, w.y + dy);
        spr.zIndex = w.y + z;
        spr.alpha = alpha * grow;
      }
      // 바닥: 피해 범위 원반과 고리
      const R = BOSS_BLUNT.whirlRadius * grow;
      whirlBack.ellipse(w.x, w.y + 12, R, R * FLAT).fill({ color: 0xcdb98f, alpha: 0.13 * grow }).stroke({ width: 2, color: 0xe9f1ff, alpha: 0.22 * grow });
    }
    whirls.length = 0;
  };

  const frame = (bt: TeleWire[], hz: HazardWire[], stage: number, dtMs: number, now: number) => {
    drawWhirls(now);
    drawThrustCores(dtMs);
    necroG.clear();
    wallG.clear();
    for (const gw of guardWalls) drawCurvedWall(gw.x + Math.cos(gw.ang) * 48, gw.y + 8 + Math.sin(gw.ang) * 48 * 0.6, gw.ang + Math.PI / 2, gw.ang, 96, 44, 104, 0.95, 100, now);
    guardWalls.length = 0;
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
        if (v.lastLeft !== left) {
          v.lastLeft = left;
          v.endAt = now + left * 100; // 남은 시간은 0.1초 단위로 오므로 도착 시각으로 바꿔 이어서 센다
        }
        const remain = Math.max(0, ((v.endAt ?? now) - now) / 1000);
        const pr = Math.min(1, Math.max(0, 1 - remain / Math.max(0.1, v.t0 / 10)));
        if (b === 1) {
          teleG.circle(x, y, a).fill({ color: 0xff3a2a, alpha: 0.1 + 0.2 * pr }).stroke({ width: 2, color: 0xff3a2a, alpha: 0.7 });
          if (v.sp) v.sp.visible = false;
          continue;
        }
        // 화살비: 떨어질 자리를 또렷하게 알린다(진해지는 붉은 원 + 줄어드는 고리 + 십자 표시). 화살은 마지막 순간에만 아주 빠르게 내리꽂힌다.
        const pulse = 0.6 + 0.4 * Math.sin(now / 90 + id);
        teleG.circle(x, y, a).fill({ color: 0xff3a2a, alpha: 0.1 + 0.26 * pr }).stroke({ width: 3, color: 0xff5a3a, alpha: 0.55 + 0.35 * pr });
        teleG.circle(x, y, a * (1 - 0.85 * pr)).stroke({ width: 2, color: 0xffe08a, alpha: 0.5 + 0.4 * pulse });
        teleG.moveTo(x - a * 0.35, y).lineTo(x + a * 0.35, y).moveTo(x, y - a * 0.35).lineTo(x, y + a * 0.35).stroke({ width: 2, color: 0xffe08a, alpha: 0.7 });
        const DROP = 0.2;
        const ft = pick(T.rain, 0);
        if (ft && remain <= DROP) {
          const fp = 1 - remain / DROP;
          if (!v.sp) {
            v.sp = new Sprite(ft);
            v.sp.anchor.set(0.5, 0.9);
            v.sp.scale.set(0.5);
            d.standLayer.addChild(v.sp);
          }
          v.sp.visible = true;
          v.sp.texture = ft;
          v.sp.position.set(x - 30 * (1 - fp), y - 420 * (1 - fp));
          v.sp.zIndex = y + 1;
          v.sp.rotation = 0.35;
        } else if (v.sp) v.sp.visible = false;
        continue;
      }
      if (necroHz(h, now)) continue;
      if (kind === HZ_SHIELD) {
        // 거대 방패: 그림 없이 하늘색 곡면 판으로 그린다(벽 방향 ang, 볼록한 쪽은 장군이 바라보는 쪽 = ang - 90도)
        drawCurvedWall(x, y + 4, ang, ang - Math.PI / 2, a, 46, 92, Math.min(1, left / 10 / 0.5 + 0.05) * (state === 0 ? 0.5 : 1), b, now);
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
    for (const [id, nvw] of necroViews) {
      if (seen.has(id)) continue;
      for (const sp of nvw.sprites) sp.destroy();
      necroViews.delete(id);
    }
    for (const [id, v] of hzViews) {
      if (seen.has(id)) continue;
      v.sp?.destroy();
      hzViews.delete(id);
    }
    for (let i = trails.length - 1; i >= 0; i--) {
      const tr = trails[i]!;
      tr.age += dtMs / 1000;
      tr.sp.alpha = 0.55 * Math.max(0, 1 - tr.age / 0.32);
      if (tr.age >= 0.32) {
        tr.sp.destroy();
        trails.splice(i, 1);
      }
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
  const mark = (id: number | string, kind: string, tex: Tex, x: number, y: number, scale: number, alpha: number, below = false, anchorY = 0.5): void => {
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
  const enemyMarks = (id: number, x: number, y: number, flags: number, boss: boolean, stage: number, size: number, now: number, faceAng = 0): { alpha: number; tint: number } => {
    let alpha = 1;
    let tint = 0xffffff;
    if (flags & EF_STEALTH) alpha = 0.05;
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
    if ((flags & EF_GUARD) && stage === 4) {
      // 반사 태세: 몸을 감싼 투명한 뿔 달린 등딱지(그림이 없으면 예전의 휜 하늘색 판)
      const sh = pick(T.shell, Math.floor(now / 130) % 5);
      if (sh) mark(id, "shell", sh, x, y + 30, 1.25, 0.7, true, 0.9);
      else guardWalls.push({ x, y, ang: faceAng });
    }
    if (flags & EF_SCYTHE) mark(id, "scythe", pick(T.scythe, 3), x, y - 20, 1.7, 0.9);
    return { alpha, tint };
  };

  /** 주인공·용병의 기절 표시: 머리 위에 별이 도는 그림(장군 기절 표시와 같은 그림을 쓴다). key는 대상마다 다른 문자열 */
  const stunMark = (key: string, x: number, y: number, scale: number, now: number): void => {
    mark(key, "stun", pick(T.dazed, Math.floor(now / 110) % 4), x, y, scale, 0.95);
  };

  /** 반사 태세에서 공격을 되돌려 줄 때: 등딱지에서 섬광과 충격파가 터진다 */
  const reflectFlash = (x: number, y: number): void => {
    playSeq(T.shellHit, x, y - 4, 0.35, 1.15, 0);
  };

  /** 군량병이 떨군 쌀: 바닥의 쌀 자루가 반짝인다. 사라질 때가 가까우면 깜박인다 */
  const riceFrame = (rice: readonly (readonly number[])[], now: number): void => {
    for (const r of rice) {
      const blink = r[3]! <= 5 && Math.floor(now / 200) % 2 === 0;
      const tex = Math.floor(now / 450 + r[0]!) % 3 === 0 ? pick(T.riceGlint, Math.floor(now / 450) % 2) : T.riceDrop;
      mark(`rice${r[0]}`, "rice", tex, r[1]!, r[2]!, 0.6, blink ? 0.45 : 1, true, 0.6);
    }
  };

  /** 군량병 이벤트: 0 = 쌀 자루가 터짐, 1 = 쌀을 먹음 */
  const riceEvent = (val: number, x: number, y: number): void => {
    if (val === 0) playSeq(T.supplyBurst, x, y - 10, 0.45, 0.8, 0);
    else playSeq(T.riceEat, x, y - 30, 0.6, 1, 0);
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
      case BUL_ORB:
        return { tex: pick(T.orb, 1), scale: 0.7, anchorX: 0.5 };
      case BUL_SHARD:
        return { tex: pick(T.shard, 0), scale: 0.35, anchorX: 0.5 };
      case BUL_BOSSARROW:
        return null;
      default:
        return null;
    }
  };

  return { art, frame, playFx, enemyMarks, stunMark, reflectFlash, endEnemies, bulletLook, skelTex, supply, riceFrame, riceEvent, T };
}

