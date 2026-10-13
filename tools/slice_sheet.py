#!/usr/bin/env python3
"""스프라이트 시트(투명 배경 PNG/WEBP)를 한 장씩 잘라 개별 PNG로 저장한다.

글자 라벨은 높이가 작아서 걸러내고, 서로 맞닿은 스프라이트도 섞이지 않게 각자의 픽셀만 남긴다.
순서는 위 줄 왼쪽부터 오른쪽, 그다음 줄 순서이다.

사용 예:
  python3 tools/slice_sheet.py sheet.webp client/public/assets/units \
      --names ally_cavalry,ally_spear,ally_archer,ally_sword,ally_mace,enemy_cavalry,enemy_spear,enemy_archer,enemy_sword,enemy_mace \
      --rows 2 --scale 0.38
"""
import argparse
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def label_cells(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """8방향 연결 성분 라벨링(외부 라이브러리 없이)."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    n = 0
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or labels[y, x]:
                continue
            n += 1
            q = deque([(y, x)])
            labels[y, x] = n
            while q:
                cy, cx = q.popleft()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = n
                            q.append((ny, nx))
    return labels, n


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(mask, dy, axis=0), dx, axis=1)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("outdir")
    ap.add_argument("--names", required=True, help="쉼표로 구분한 파일 이름(확장자 제외), 위 줄 왼쪽부터")
    ap.add_argument("--rows", type=int, default=2)
    ap.add_argument("--scale", type=float, default=0.38, help="시트 대비 출력 배율. 모든 스프라이트에 같은 값을 써서 상대 크기를 유지한다")
    ap.add_argument("--min-height", type=int, default=100, help="이보다 낮은 덩어리(글자 라벨 등)는 무시")
    ap.add_argument("--alpha", type=int, default=40)
    args = ap.parse_args()

    names = args.names.split(",")
    im = Image.open(args.sheet).convert("RGBA")
    a = np.array(im)
    mask = a[..., 3] > args.alpha

    cell = 4  # 라벨링을 빠르게 하려고 4px 단위로 줄여서 처리
    h, w = mask.shape
    hh, ww = (h + cell - 1) // cell, (w + cell - 1) // cell
    pad = np.zeros((hh * cell, ww * cell), dtype=bool)
    pad[:h, :w] = mask
    small = pad.reshape(hh, cell, ww, cell).any(axis=(1, 3))
    labels, n = label_cells(small)  # 맞닿은 부분만 한 덩어리로 본다(이웃 스프라이트와 섞이지 않게)

    full_labels = np.kron(labels, np.ones((cell, cell), dtype=np.int32))[:h, :w]
    boxes = {}
    for i in range(1, n + 1):
        ys, xs = np.where(mask & (full_labels == i))
        if len(ys):
            boxes[i] = (xs.min(), ys.min(), xs.max(), ys.max())
    big = {i: b for i, b in boxes.items() if b[3] - b[1] + 1 >= args.min_height}
    # 떨어져 있는 작은 조각(창끝 등)은 근처의 큰 스프라이트에 붙이고, 멀리 있는 것(글자 라벨)은 버린다
    margin = 10
    merged = {i: [i] for i in big}
    for i, b in boxes.items():
        if i in big:
            continue
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        for j, bb in big.items():
            if bb[0] - margin <= cx <= bb[2] + margin and bb[1] - margin <= cy <= bb[3] + margin:
                merged[j].append(i)
                break
    comps = []
    for j, members in merged.items():
        own = mask & np.isin(full_labels, members)
        ys, xs = np.where(own)
        left, top, right, bottom = xs.min(), ys.min(), xs.max(), ys.max()
        comps.append({"id": members, "box": (left, top, right, bottom), "cy": (top + bottom) / 2, "cx": (left + right) / 2})

    if len(comps) != len(names):
        print(f"스프라이트 {len(comps)}개를 찾았지만 이름은 {len(names)}개입니다. --min-height를 조정하세요.", file=sys.stderr)
        for c in comps:
            print("  ", c["box"], file=sys.stderr)
        return 1

    # 줄 나누기: 세로 중심으로 정렬한 뒤 균등 분할, 각 줄은 가로 순서로
    comps.sort(key=lambda c: c["cy"])
    per_row = len(comps) // args.rows
    ordered = []
    for r in range(args.rows):
        row = sorted(comps[r * per_row : (r + 1) * per_row], key=lambda c: c["cx"])
        ordered.extend(row)

    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    for name, c in zip(names, ordered):
        left, top, right, bottom = c["box"]
        # 다른 스프라이트·글자 픽셀이 섞이지 않게 이 덩어리 영역의 픽셀만 남긴다
        keep = np.isin(full_labels, c["id"])
        sprite = a.copy()
        sprite[..., 3] = np.where(keep, sprite[..., 3], 0)
        crop = Image.fromarray(sprite[top : bottom + 1, left : right + 1])
        size = (max(1, round(crop.width * args.scale)), max(1, round(crop.height * args.scale)))
        crop = crop.resize(size, Image.LANCZOS)
        crop.save(out / f"{name}.png", optimize=True)
        print(f"{name}.png  원본 {right - left + 1}x{bottom - top + 1} -> {size[0]}x{size[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
