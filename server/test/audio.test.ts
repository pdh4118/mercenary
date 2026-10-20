import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_AUDIO_SETTINGS,
  GLOBAL_MAX_VOICES,
  MUSIC,
  SOUNDS,
  SPATIAL_FAR,
  SPATIAL_NEAR,
  SoundLimiter,
  pickVariant,
  sanitizeAudioSettings,
  soundPath,
  spatialGain,
  spatialPan,
  type SoundDef,
} from "@mercenary/shared";

const def = (over: Partial<SoundDef> = {}): SoundDef => ({ variants: 3, volume: 0.5, cooldownMs: 100, maxVoices: 2, pitchVar: 0.05, spatial: true, ...over });

test("거리 감쇠: 가까우면 그대로, 멀수록 작아지고 먼 곳은 들리지 않는다", () => {
  assert.equal(spatialGain(0), 1);
  assert.equal(spatialGain(SPATIAL_NEAR), 1);
  assert.equal(spatialGain(SPATIAL_FAR), 0);
  assert.equal(spatialGain(SPATIAL_FAR + 500), 0);
  let prev = 1;
  for (let d = SPATIAL_NEAR; d <= SPATIAL_FAR; d += 50) {
    const g = spatialGain(d);
    assert.ok(g <= prev + 1e-12, `${d}`);
    prev = g;
  }
});

test("좌우 위치: 왼쪽은 음수, 오른쪽은 양수, 끝에서도 완전히 쏠리지 않는다", () => {
  assert.equal(spatialPan(0), 0);
  assert.ok(spatialPan(-300) < 0 && spatialPan(300) > 0);
  assert.equal(spatialPan(99999), 0.8);
  assert.equal(spatialPan(-99999), -0.8);
});

test("변형 고르기: 직전과 같은 것을 연달아 내지 않는다", () => {
  assert.equal(pickVariant(1, 1), 1);
  let last = 0;
  for (let i = 0; i < 200; i++) {
    const v = pickVariant(3, last, Math.random);
    assert.ok(v >= 1 && v <= 3);
    if (last) assert.notEqual(v, last);
    last = v;
  }
});

test("겹침 제한: 최소 간격, 동시 개수, 전체 동시 개수를 지키고 알림 소리는 제한하지 않는다", () => {
  const lim = new SoundLimiter();
  const d = def();
  assert.equal(lim.allow("a", d, 0, 0, 0), true);
  assert.equal(lim.allow("a", d, 50, 0, 0), false, "간격 안");
  assert.equal(lim.allow("a", d, 150, 0, 0), true, "간격 지남");
  assert.equal(lim.allow("a", d, 300, 2, 0), false, "이 소리가 이미 최대 개수");
  assert.equal(lim.allow("b", d, 300, 0, GLOBAL_MAX_VOICES), false, "전체가 가득");
  const alert = def({ important: true, cooldownMs: 1000, maxVoices: 1 });
  assert.equal(lim.allow("c", alert, 0, 5, GLOBAL_MAX_VOICES), true);
  assert.equal(lim.allow("c", alert, 1, 5, GLOBAL_MAX_VOICES), true);
});

test("소리 설정: 범위를 벗어난 값이나 잘못된 형식은 바로잡는다", () => {
  assert.deepEqual(sanitizeAudioSettings(null), DEFAULT_AUDIO_SETTINGS);
  assert.deepEqual(sanitizeAudioSettings({ muted: true, sfx: 5, music: -1 }), { muted: true, sfx: 1, music: 0 });
  assert.deepEqual(sanitizeAudioSettings({ muted: "yes", sfx: "x", music: Number.NaN }), DEFAULT_AUDIO_SETTINGS);
});

test("소리 목록은 제작 문서(docs/asset-prompts.md 10장)의 파일 이름과 정확히 일치한다", () => {
  const doc = readFileSync(fileURLToPath(new URL("../../docs/asset-prompts.md", import.meta.url)), "utf8");
  const start = doc.indexOf("## 10. 사운드");
  const end = doc.indexOf("\n## 11.", start);
  const s3 = doc.indexOf("### 11-3."); // 11장 중 스킬 소리 표(11-3)는 코드에 연결돼 있어 함께 비교한다
  const e3 = doc.indexOf("\n### 11-4.", s3);
  const section = doc.slice(start, end < 0 ? undefined : end) + "\n" + (s3 < 0 ? "" : doc.slice(s3, e3 < 0 ? undefined : e3));
  const named = new Set([...section.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]!));
  const code = new Set(Object.keys(SOUNDS));
  for (const n of code) assert.ok(named.has(n), `문서에 없음: ${n}`);
  for (const n of named) assert.ok(code.has(n), `코드에 없음: ${n}`);
  for (const m of MUSIC) assert.ok(section.includes(`\`${m}\``), `문서에 없는 음악: ${m}`);
  // 변형 수도 문서의 "N종"과 맞는다
  for (const [name, d] of Object.entries(SOUNDS)) {
    const row = section.split("\n").find((l) => l.startsWith(`| \`${name}\``))!;
    const n = /(\d+)종/.exec(row);
    if (n) assert.equal(d.variants, Number(n[1]), `${name} 변형 수`);
  }
});

test("파일 경로 규칙: <이름>_<번호>.<확장자>", () => {
  assert.equal(soundPath("arrow_hit", 2, "ogg"), "assets/audio/arrow_hit_2.ogg");
});

test("모든 소리의 값이 올바르다", () => {
  for (const [name, d] of Object.entries(SOUNDS)) {
    assert.ok(d.variants >= 1 && d.volume > 0 && d.volume <= 1 && d.maxVoices >= 1 && d.pitchVar >= 0 && d.cooldownMs >= 0, name);
  }
});
