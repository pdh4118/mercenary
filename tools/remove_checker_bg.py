#!/usr/bin/env python3
"""체크무늬(흰색·연회색)로 그려진 '가짜 투명 배경'을 진짜 투명 PNG로 바꾼다.

  python3 tools/remove_checker_bg.py input.webp output.png [--min-v 190] [--pocket-area 10]

생성 도구가 투명 배경이라며 체크무늬를 그림에 구워서 내놓을 때 쓴다(흰 배경만 지우는 `remove_bg.py`는 회색 칸을 못 지운다).
1. '무채색이고 밝은'(채널 차이 6 이하, 밝기 min-v 이상) 픽셀을 배경 후보로 본다.
2. 이미지 가장자리에서 이어진 후보를 바깥 배경으로 지운다(어두운 외곽선이 막아 주므로 그림 속은 지워지지 않는다).
3. 바깥과 이어지지 않은 후보 덩어리(말 다리 사이·창과 깃발 사이 같은 구멍)는 체크무늬의 연회색 칸이 6% 이상 들어 있을 때만 지운다(진짜 흰 물체는 연회색 칸이 없다).
4. 배경 바로 옆 1px는 어두운 외곽선과 배경이 섞인 회색이라 무채색이고 어두운 정도가 중간이면 지운다. 남는 흰 번짐은 `tools/fix_halo.py`로 정리한다.
"""
from __future__ import annotations

import argparse
import sys
from collections import deque

import numpy as np
from PIL import Image


def dilate(m: np.ndarray) -> np.ndarray:
    p = np.pad(m, 1, constant_values=False)
    return p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]


def components(mask: np.ndarray) -> list[np.ndarray]:
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for y0, x0 in zip(*np.where(mask)):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        out.append(np.array(pts))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--min-v", type=int, default=190)
    ap.add_argument("--pocket-area", type=int, default=10)
    args = ap.parse_args()

    rgb = np.asarray(Image.open(args.src).convert("RGB"), dtype=np.int32)
    h, w, _ = rgb.shape
    v = rgb.max(-1)
    neutral = (v - rgb.min(-1)) <= 6
    cand = neutral & (v >= args.min_v)

    # 바깥 배경: 가장자리에서 이어진 후보
    bg = np.zeros((h, w), dtype=bool)
    q = deque()
    for y in range(h):
        for x in (0, w - 1):
            if cand[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for x in range(w):
        for y in (0, h - 1):
            if cand[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))

    # 구멍 속 배경: 체크무늬 두 색이 대부분이면 지운다
    # 체크무늬의 연회색 칸(밝기 196~210)이 조금이라도(6% 이상) 들어 있으면 배경으로 본다. 진짜 흰 물체(이빨·눈)에는 연회색 칸이 없다.
    gray = (v >= 196) & (v <= 210)
    pockets = 0
    for pts in components(cand & ~bg):
        if len(pts) < args.pocket_area:
            continue
        ys, xs = pts[:, 0], pts[:, 1]
        if gray[ys, xs].mean() >= 0.06:
            bg[ys, xs] = True
            pockets += 1

    # 배경 바로 옆 1px: 외곽선과 배경이 섞인 회색
    ring = dilate(bg) & ~bg
    mixed = ring & neutral & (v >= 90)
    bg2 = bg | mixed

    alpha = np.where(bg2, 0, 255).astype(np.uint8)
    out = np.dstack([rgb.astype(np.uint8), alpha])
    Image.fromarray(out, "RGBA").save(args.dst)
    print(f"{args.src} → {args.dst}: 배경 {bg.mean() * 100:.0f}%, 구멍 {pockets}개, 가장자리 회색 {int(mixed.sum())}px 제거")
    return 0


if __name__ == "__main__":
    sys.exit(main())
