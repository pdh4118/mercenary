#!/usr/bin/env python3
"""흰 배경을 지우고 남은 '밝은 테두리'를 외곽선 색으로 칠해 없앤다.

  python3 tools/fix_halo.py --auto            # 이상치 기준(맨 바깥 링이 외곽선보다 0.3 넘게 밝음)으로 찾아 고친다
  python3 tools/fix_halo.py units/ally_sword.png units/enemy_spear.png   # assets 기준 상대 경로를 직접 지정
  --dry-run  고치지 않고 대상만 보여 준다   --no-backup  _old 보관본을 만들지 않는다

문제: 어두운 외곽선 바깥에 밝은 1px(반투명 흰색)와 회색 1px가 남아 있어서, 어두운 바닥 위에서 가는 흰 선으로 보인다.
방법: 맨 바깥 두 겹(깊이 1~2) 중 밝은 픽셀의 색만, 바로 안쪽 외곽선(깊이 3)의 색으로 바꾼다. 알파(투명도)는 그대로 두므로 모양·크기·발 위치는 변하지 않는다.
      깊이 3이 없는 얇은 부분(창끝 같은 것)은 건드리지 않는다.
원본은 `<이름>_old.png`로 보관한다(이미 있으면 덮어쓰지 않는다). 고친 뒤 `python3 tools/make_webp.py`를 다시 돌린다.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "client" / "public" / "assets"
ALPHA_MIN = 0.125  # 32/255, 이 이하는 사실상 투명으로 본다


def erode(m: np.ndarray) -> np.ndarray:
    p = np.pad(m, 1, constant_values=False)
    return p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]


def depths(opaque: np.ndarray, n: int = 4) -> list[np.ndarray]:
    """깊이 1(맨 바깥)~n 픽셀 마스크."""
    out, cur = [], opaque.copy()
    for _ in range(n):
        nxt = erode(cur)
        out.append(cur & ~nxt)
        cur = nxt
    return out


def lum_of(rgb: np.ndarray) -> np.ndarray:
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def halo_amount(a: np.ndarray) -> float:
    op = a[..., 3] > ALPHA_MIN
    if op.sum() < 40:
        return 0.0
    d = depths(op, 4)
    lum = lum_of(a[..., :3])
    rings = [float(lum[x].mean()) if x.any() else 1.0 for x in d]
    return rings[0] - min(rings[1:4])


def fix(a: np.ndarray) -> tuple[np.ndarray, int]:
    """밝은 테두리를 고친 RGBA(0~1)와 바뀐 픽셀 수."""
    out = a.copy()
    op = a[..., 3] > ALPHA_MIN
    d1, d2, d3, _ = depths(op, 4)
    lum = lum_of(a[..., :3])
    changed = 0

    def neighbor_color(target: np.ndarray, source: np.ndarray) -> np.ndarray:
        """target 픽셀마다 8방향 이웃 중 source 픽셀의 색 평균(없으면 NaN)."""
        h, w = target.shape
        acc = np.zeros((h, w, 3), dtype=np.float32)
        cnt = np.zeros((h, w), dtype=np.float32)
        src = np.pad(source, 1, constant_values=False)
        col = np.pad(out[..., :3], ((1, 1), (1, 1), (0, 0)))
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                m = src[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w]
                acc += col[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w] * m[..., None]
                cnt += m
        res = np.full((h, w, 3), np.nan, dtype=np.float32)
        ok = target & (cnt > 0)
        res[ok] = acc[ok] / cnt[ok][..., None]
        return res

    # 깊이 2를 먼저(깊이 3의 외곽선 색으로), 그다음 깊이 1을 새로 칠한 깊이 2의 색으로
    for ring, src in ((d2, d3), (d1, d2)):
        light = ring & (lum > 0.12)
        col = neighbor_color(light, src & (lum < 0.3))
        ok = light & ~np.isnan(col[..., 0])
        out[..., :3][ok] = col[ok]
        changed += int(ok.sum())
    return out, changed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--auto", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-backup", action="store_true")
    ap.add_argument("--threshold", type=float, default=0.3)
    args = ap.parse_args()

    targets: list[Path] = []
    if args.auto:
        for folder in ("units", "hero", "cards", "camp"):
            for p in sorted((ROOT / folder).rglob("*.png")):
                if "_old" in p.stem or "_raw" in str(p.parent):
                    continue
                a = np.asarray(Image.open(p).convert("RGBA"), dtype=np.float32) / 255.0
                if halo_amount(a) > args.threshold:
                    targets.append(p)
    targets += [ROOT / x for x in args.paths]
    if not targets:
        print("고칠 그림이 없습니다")
        return 0
    for p in targets:
        a = np.asarray(Image.open(p).convert("RGBA"), dtype=np.float32) / 255.0
        before = halo_amount(a)
        fixed, n = fix(a)
        after = halo_amount(fixed)
        print(f"{p.relative_to(ROOT)}: 밝은 테두리 {before:+.2f} → {after:+.2f} (바꾼 픽셀 {n})")
        if args.dry_run:
            continue
        if not args.no_backup:
            old = p.with_name(p.stem + "_old.png")
            if not old.exists():
                shutil.copy2(p, old)
        Image.fromarray((np.clip(fixed, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").save(p)
    if not args.dry_run:
        print("끝났습니다. python3 tools/make_webp.py 를 다시 돌려 webp를 갱신하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
