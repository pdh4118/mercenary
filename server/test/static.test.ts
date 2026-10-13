import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveStatic } from "../src/static.js";

const root = mkdtempSync(join(tmpdir(), "mercenary-static-"));
mkdirSync(join(root, "assets"));
writeFileSync(join(root, "index.html"), "<html></html>");
writeFileSync(join(root, "assets", "a.png"), "x");
writeFileSync(join(root, "..", "mercenary-secret.txt"), "secret");

test("정적 파일: 기본 경로는 index.html, 하위 파일은 그대로", () => {
  assert.equal(resolveStatic(root, "/"), join(root, "index.html"));
  assert.equal(resolveStatic(root, "/assets/a.png"), join(root, "assets", "a.png"));
  assert.equal(resolveStatic(root, "/assets/a.png?v=1#x"), join(root, "assets", "a.png"));
});

test("정적 파일: 없는 파일은 null", () => {
  assert.equal(resolveStatic(root, "/nope.js"), null);
});

test("정적 파일: 루트 밖으로 나가는 경로는 모두 거부한다", () => {
  for (const p of ["/../mercenary-secret.txt", "/%2e%2e/mercenary-secret.txt", "/assets/../../mercenary-secret.txt", "/..%2fmercenary-secret.txt", "/%00", "/%zz", "//etc/passwd", "/assets/%2e%2e/%2e%2e/x"]) {
    const r = resolveStatic(root, p);
    assert.ok(r === null || r.startsWith(root), `${p} -> ${r}`);
    assert.notEqual(r, join(root, "..", "mercenary-secret.txt"));
  }
});
