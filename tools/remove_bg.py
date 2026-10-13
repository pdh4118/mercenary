#!/usr/bin/env python3
"""흰 배경(체크무늬 잡음이 섞인 가짜 투명 포함)을 진짜 투명 PNG로 바꾼다.

  python3 tools/remove_bg.py input.webp output.png [--threshold 226] [--effects]

방법
1. 이미지 가장자리에서 시작해 '거의 흰색'(세 채널 모두 threshold 이상)인 픽셀을 이어서 채워 가며 바깥 배경으로 본다.
   (그림 안쪽의 흰 하이라이트는 바깥과 이어져 있지 않으므로 지워지지 않는다.)
2. 바깥 배경은 투명으로, 그 경계 2px 띠는 흰색 위의 반투명으로 보고 알파와 색을 되살린다(윤곽선이 하얗게 번지지 않게).
3. 활과 시위 사이처럼 바깥과 이어지지 않은 닫힌 구멍 속 배경은 자동으로 구분되지 않는다(칼날의 하이라이트와 색이 같다).
   지울 위치를 --pocket-box x0,y0,x1,y1 로 지정한다.
4. --effects: 속도선·폭발 같은 반투명 이펙트가 있는 이미지용. 어두운 윤곽선에서 5px 넘게 떨어진 픽셀 전체를
   같은 방식으로 반투명 처리해 흰 번짐 없이 어두운 배경에서도 자연스럽게 보이게 한다.
"""
import argparse
import sys
from collections import deque

import numpy as np
from PIL import Image


def exterior(near: np.ndarray) -> np.ndarray:
    """가장자리에서 이어진 near 영역(바깥 배경)을 구한다."""
    h, w = near.shape
    flat = near.ravel()
    seen = np.zeros(h * w, dtype=bool)
    q: deque[int] = deque()
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if flat[i] and not seen[i]:
                seen[i] = True
                q.append(i)
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if flat[i] and not seen[i]:
                seen[i] = True
                q.append(i)
    while q:
        i = q.popleft()
        y, x = divmod(i, w)
        if x > 0 and flat[i - 1] and not seen[i - 1]:
            seen[i - 1] = True
            q.append(i - 1)
        if x < w - 1 and flat[i + 1] and not seen[i + 1]:
            seen[i + 1] = True
            q.append(i + 1)
        if y > 0 and flat[i - w] and not seen[i - w]:
            seen[i - w] = True
            q.append(i - w)
        if y < h - 1 and flat[i + w] and not seen[i + w]:
            seen[i + w] = True
            q.append(i + w)
    return seen.reshape(h, w)


def enclosed_pockets(near: np.ndarray, ext: np.ndarray, boxes: list[tuple[int, int, int, int]], min_area: int = 50) -> np.ndarray:
    """바깥과 이어지지 않은 흰 영역 중, 중심이 지정한 상자 안에 있는 것(활과 시위 사이처럼 닫힌 구멍 속 배경)을 구한다.
    구멍 속 배경과 흰 물체(칼날의 하이라이트 등)는 색 통계로 구분되지 않아, 지울 곳을 사람이 지정한다."""
    h, w = near.shape
    todo = near & ~ext
    flat = todo.ravel()
    seen = np.zeros(h * w, dtype=bool)
    out = np.zeros(h * w, dtype=bool)
    for start in np.flatnonzero(flat):
        if seen[start]:
            continue
        comp = [int(start)]
        seen[start] = True
        k = 0
        while k < len(comp):
            i = comp[k]
            k += 1
            y, x = divmod(i, w)
            for j, ok in ((i - 1, x > 0), (i + 1, x < w - 1), (i - w, y > 0), (i + w, y < h - 1)):
                if ok and flat[j] and not seen[j]:
                    seen[j] = True
                    comp.append(j)
        if len(comp) < min_area:
            continue
        ys, xs = np.divmod(np.array(comp), w)
        cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        if any(x0 <= cx <= x1 and y0 <= cy <= y1 for x0, y0, x1, y1 in boxes):
            out[comp] = True
    return out.reshape(h, w)


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    p = np.pad(mask, r, constant_values=False)
    out = np.zeros_like(mask)
    h, w = mask.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= p[r + dy : r + dy + h, r + dx : r + dx + w]
    return out


def color_to_alpha(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """흰색 위에 얹힌 색을 (원래 색, 알파)로 되돌린다."""
    c = rgb.astype(np.float64)
    a = (255.0 - c).max(axis=-1) / 255.0
    safe = np.maximum(a, 1e-3)[..., None]
    out = np.clip((c - 255.0 * (1.0 - safe)) / safe, 0, 255)
    return out, a


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--threshold", type=int, default=226, help="이 값 이상이면 흰 배경으로 본다")
    ap.add_argument("--effects", action="store_true", help="반투명 이펙트(속도선·폭발)가 있는 이미지")
    ap.add_argument("--pocket-box", action="append", default=[], metavar="x0,y0,x1,y1",
                    help="이 상자 안에 중심이 있는, 바깥과 이어지지 않은 흰 영역(닫힌 구멍 속 배경)을 지운다. 여러 번 지정 가능")
    args = ap.parse_args()

    rgb = np.array(Image.open(args.input).convert("RGB"))
    near = rgb.min(axis=2) >= args.threshold
    ext = exterior(near)
    boxes = [tuple(int(v) for v in b.split(",")) for b in args.pocket_box]
    if boxes:
        ext |= enclosed_pockets(near, ext, boxes)

    out = np.zeros(rgb.shape[:2] + (4,), dtype=np.uint8)
    out[..., :3] = rgb
    out[..., 3] = np.where(ext, 0, 255)

    # 경계 띠: 바깥에 닿은 2px는 흰색 위의 반투명으로 보고 색·알파를 복원
    soft = dilate(ext, 2) & ~ext
    if args.effects:
        dark = rgb.min(axis=2) < 90  # 윤곽선(어두운 선)
        near_outline = dilate(dark, 5)
        soft |= ~ext & ~near_outline  # 윤곽선에서 멀리 떨어진 이펙트 픽셀
    if soft.any():
        col, a = color_to_alpha(rgb[soft])
        out[soft, :3] = col.astype(np.uint8)
        out[soft, 3] = np.clip(a * 255.0, 0, 255).astype(np.uint8)

    Image.fromarray(out, "RGBA").save(args.output, optimize=True)
    solid = (out[..., 3] > 0).mean()
    print(f"{args.output}: 투명 {100 * (1 - solid):.1f}% / 그림 {100 * solid:.1f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
