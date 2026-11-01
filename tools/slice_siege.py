#!/usr/bin/env python3
"""공성전 에셋 시트(흰 배경 + 연한 칸 선)를 투명 PNG로 바꿔 한 장씩 잘라 저장한다.
  1) 시트를 가로지르는 연한 회색 칸 선을 흰색으로 지운다.  2) tools/remove_bg.py 방식으로 바깥 흰 배경을 투명하게 만든다.
  3) 덩어리(스프라이트)별로 잘라 왼쪽→오른쪽(같은 줄은 위→아래) 순서로 이름을 붙인다.
쓰는 법: python3 tools/slice_siege.py sheet.webp outdir name1,name2,... [--scale 0.5] [--effects] [--pad 6]"""
import argparse, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import remove_bg as rb  # noqa: E402


def erase_grid(rgb: np.ndarray) -> np.ndarray:
    """칸 구분선(양옆이 흰색인 가는 연한 회색 선)을 흰색으로 덮는다. 그림과 맞닿은 선은 그림 쪽을 건드리지 않는다."""
    h, w, _ = rgb.shape
    v = rgb.astype(int)
    grayish = (v.min(axis=2) >= 150) & (v.max(axis=2) <= 238) & ((v.max(axis=2) - v.min(axis=2)) <= 10)
    white = v.min(axis=2) >= 240
    out = rgb.copy()
    for x in range(6, w - 6):
        lab, n = ndi.label(grayish[:, x])
        for i in range(1, n + 1):
            idx = np.flatnonzero(lab == i)
            if len(idx) < 40:
                continue
            ok = idx[white[idx, x - 6] & white[idx, x + 6]]  # 양옆이 흰색인 픽셀만(그림의 회색은 건드리지 않는다)
            if len(ok) >= 0.5 * len(idx):
                out[ok, x] = 255
    for y in range(6, h - 6):
        lab, n = ndi.label(grayish[y, :])
        for i in range(1, n + 1):
            idx = np.flatnonzero(lab == i)
            if len(idx) < 40:
                continue
            ok = idx[white[y - 6, idx] & white[y + 6, idx]]
            if len(ok) >= 0.5 * len(idx):
                out[y, ok] = 255
    return out


def to_rgba(rgb: np.ndarray, threshold: int, effects: bool, holes: int = 0) -> np.ndarray:
    near = rgb.min(axis=2) >= threshold
    ext = rb.exterior(near)
    if holes:
        # 문 구멍처럼 바깥과 이어지지 않은 큰 흰 영역도 배경으로 본다
        lab, n = ndi.label(near & ~ext)
        for i in range(1, n + 1):
            comp = lab == i
            if comp.sum() >= holes:
                ext |= comp
    out = np.zeros(rgb.shape[:2] + (4,), dtype=np.uint8)
    out[..., :3] = rgb
    out[..., 3] = np.where(ext, 0, 255)
    soft = rb.dilate(ext, 2) & ~ext
    if effects:
        dark = rgb.min(axis=2) < 90
        soft |= ~ext & ~rb.dilate(dark, 5)
    if soft.any():
        col, a = rb.color_to_alpha(rgb[soft])
        out[soft, :3] = col.astype(np.uint8)
        out[soft, 3] = np.clip(a * 255.0, 0, 255).astype(np.uint8)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("outdir")
    ap.add_argument("names")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--effects", action="store_true")
    ap.add_argument("--threshold", type=int, default=226)
    ap.add_argument("--pad", type=int, default=6)
    ap.add_argument("--merge", type=int, default=14, help="이 거리 안의 조각은 한 스프라이트로 묶는다")
    ap.add_argument("--min-area", type=float, default=0.12, help="가장 큰 덩어리 대비 이 비율보다 작으면 버린다")
    ap.add_argument("--holes", type=int, default=0, help="이 면적(px) 이상인 닫힌 흰 구멍도 투명하게")
    ap.add_argument("--rowsort", action="store_true", help="위 줄부터 읽는다(기본은 왼쪽→오른쪽)")
    args = ap.parse_args()
    names = args.names.split(",")
    rgb = np.array(Image.open(args.sheet).convert("RGB"))
    rgb = erase_grid(rgb)
    rgba = to_rgba(rgb, args.threshold, args.effects, args.holes)
    mask = rgba[..., 3] > 40
    core = ndi.binary_opening(mask, structure=np.ones((7, 7), bool))  # 칸 선 같은 가는 선은 열기 연산으로 사라진다
    if core.sum() < 50:
        core = mask
    grown = rb.dilate(core, args.merge // 2)
    lab, n = ndi.label(grown)
    boxes = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(rb.dilate(lab == i, 6) & mask & (lab == i))
        if len(xs) == 0:
            continue
        boxes.append([xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, len(xs), i])
    if not boxes:
        print("스프라이트 없음")
        return 1
    big = max(b[4] for b in boxes)
    boxes = [b for b in boxes if b[4] >= big * args.min_area]
    if args.rowsort:
        boxes.sort(key=lambda b: (round(b[1] / 300), b[0]))
    else:
        boxes.sort(key=lambda b: b[0])
    if len(boxes) != len(names):
        print(f"덩어리 {len(boxes)}개, 이름 {len(names)}개 - 확인 필요:", [(b[0], b[1], b[2], b[3]) for b in boxes], file=sys.stderr)
    os.makedirs(args.outdir, exist_ok=True)
    for b, name in zip(boxes, names):
        x0, y0, x1, y1, _, i = b
        sub = rgba[y0:y1, x0:x1].copy()
        keep = (lab[y0:y1, x0:x1] == i)  # 같은 덩어리의 픽셀만(이웃 스프라이트 조각 제외)
        sub[~rb.dilate(keep, 2), 3] = 0
        im = Image.fromarray(sub, "RGBA")
        if args.scale != 1.0:
            im = im.resize((max(1, round(im.width * args.scale)), max(1, round(im.height * args.scale))), Image.LANCZOS)
        pad = args.pad
        canvas = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
        canvas.alpha_composite(im, (pad, pad))
        p = os.path.join(args.outdir, name + ".png")
        canvas.save(p)
        print(name, canvas.size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
