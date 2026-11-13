#!/usr/bin/env python3
"""한 가지 단색(회색 등)으로 칠해진 배경을 진짜 투명 PNG로 바꾼다.

  python3 tools/remove_flat_bg.py input.webp output.png [--tol 10] [--pocket-area 12] [--bg R,G,B]

생성 도구가 '투명 배경' 대신 기준 시트의 회색 같은 단색을 깔아서 내놓을 때 쓴다.
1. 배경색은 네 모서리의 가장 흔한 색으로 자동으로 정한다(--bg로 지정 가능).
2. 배경색과 가까운(tol 이내) 픽셀 중 가장자리에서 이어진 것을 지운다.
3. 바깥과 이어지지 않은 닫힌 구멍(활과 몸 사이 등)도 배경색이면 지운다(그림 속에 배경과 같은 회색이 없다는 가정).
4. 배경 바로 옆 1px는 어두운 외곽선과 배경이 섞인 회색이므로 외곽선 색으로 칠해 회색 번짐을 없앤다(알파는 그대로).
5. 떨어져 있는 작은 조각(생성 도구 로고 같은 것, --min-piece px 미만, 글자 라벨 영역 제외 불가이므로 --keep-below-y로 지정)은 지운다.
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter, deque

import numpy as np
from PIL import Image


def dilate(m: np.ndarray) -> np.ndarray:
    p = np.pad(m, 1, constant_values=False)
    return p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]


def components(mask: np.ndarray, conn8: bool = False):
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    steps = [(1, 0), (-1, 0), (0, 1), (0, -1)] + ([(1, 1), (1, -1), (-1, 1), (-1, -1)] if conn8 else [])
    for y0, x0 in zip(*np.where(mask)):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy, dx in steps:
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        yield np.array(pts)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--tol", type=float, default=10.0, help="배경색과의 RGB 거리. 너무 크면 배경과 비슷한 밝은 회색 물체(칼날 등)의 안쪽이 같이 지워진다(검방병 장군에서 22일 때 칼날이 비었고 8로 해결)")
    ap.add_argument("--pocket-area", type=int, default=12)
    ap.add_argument("--bg", default="")
    ap.add_argument("--min-piece", type=int, default=400, help="이보다 작은 떨어진 조각은 지운다(로고 등)")
    ap.add_argument("--keep-below-y", type=int, default=-1, help="이 y보다 아래(글자 라벨 영역)는 작은 조각을 지우지 않는다")
    args = ap.parse_args()

    rgb = np.asarray(Image.open(args.src).convert("RGB"), dtype=np.float32)
    h, w, _ = rgb.shape
    if args.bg:
        bgc = np.array([float(x) for x in args.bg.split(",")], dtype=np.float32)
    else:
        corners = np.concatenate([rgb[:20, :20].reshape(-1, 3), rgb[:20, -20:].reshape(-1, 3), rgb[-20:, :20].reshape(-1, 3), rgb[-20:, -20:].reshape(-1, 3)])
        bgc = np.array(Counter(map(tuple, (corners // 4 * 4).astype(int))).most_common(1)[0][0], dtype=np.float32) + 2
    dist = np.sqrt(((rgb - bgc) ** 2).sum(-1))
    near = dist <= args.tol

    bg = np.zeros((h, w), dtype=bool)
    q = deque()
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    pockets = 0
    for pts in components(near & ~bg):
        if len(pts) >= args.pocket_area:
            bg[pts[:, 0], pts[:, 1]] = True
            pockets += 1

    alpha = np.where(bg, 0, 255).astype(np.uint8)
    out = rgb.copy()
    # 배경 바로 옆 1px: 외곽선과 배경이 섞인 회색 → 외곽선 색으로
    ring = dilate(bg) & ~bg
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    grayish = (rgb.max(-1) - rgb.min(-1)) < 28
    fix = ring & grayish & (lum > 30)
    out[fix] = (8, 8, 8)

    # 떨어진 작은 조각(로고·부스러기) 지우기
    removed = 0
    sprite = alpha > 0
    for pts in components(sprite, conn8=True):
        if len(pts) < args.min_piece and (args.keep_below_y < 0 or pts[:, 0].max() < args.keep_below_y):
            alpha[pts[:, 0], pts[:, 1]] = 0
            removed += 1
    res = np.dstack([np.clip(out, 0, 255).astype(np.uint8), alpha])
    Image.fromarray(res, "RGBA").save(args.dst)
    print(f"{args.src} → {args.dst}: 배경색 {tuple(int(v) for v in bgc)}, 배경 {bg.mean() * 100:.0f}%, 구멍 {pockets}개, 회색 번짐 {int(fix.sum())}px, 작은 조각 {removed}개 제거")
    return 0


if __name__ == "__main__":
    sys.exit(main())
