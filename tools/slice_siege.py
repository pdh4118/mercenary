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


def erase_dark_grid(rgb: np.ndarray) -> np.ndarray:
    """어두운 칸 선(검은 가는 선)도 양옆이 흰색인 곳만 지운다(번개처럼 선을 가로지르는 그림은 건드리지 않는다)."""
    v = rgb.astype(int)
    thin = v.max(axis=2) <= 200
    white = v.min(axis=2) >= 235
    out = rgb.copy()
    h, w, _ = rgb.shape
    for x in range(6, w - 6):
        ok = thin[:, x] & white[:, x - 6] & white[:, x + 6]
        out[ok, x] = 255
    for y in range(6, h - 6):
        ok = thin[y, :] & white[y - 6, :] & white[y + 6, :]
        out[y, ok] = 255
    return out


def to_rgba(rgb: np.ndarray, threshold: int, effects: bool, holes: int = 0, glow: float = 0.0) -> np.ndarray:
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
    if glow:
        # 빛 번짐: 바깥 흰 배경에서 이어진 '밝은' 픽셀 전체를 흰색 위의 반투명으로 본다(윤곽선 안쪽에 갇힌 흰 심은 그대로 둔다)
        light = rgb.min(axis=2) >= 150
        soft |= rb.exterior(light) & ~ext
    if effects:
        dark = rgb.min(axis=2) < 90
        soft |= ~ext & ~rb.dilate(dark, 5)
    if soft.any():
        col, a = rb.color_to_alpha(rgb[soft])
        if glow:
            a = np.clip(a * glow, 0, 1)
        out[soft, :3] = col.astype(np.uint8)
        out[soft, 3] = np.clip(a * 255.0, 0, 255).astype(np.uint8)
    return out


def cut_cells(rgba: np.ndarray, args: argparse.Namespace, names: list[str]) -> int:
    """칸마다 같은 크기로 자르고, 모든 칸의 그림이 들어가는 공통 상자로 다듬는다(칸 사이 위치 차이를 보존)."""
    x0, y0, cw, ch, n = (int(t) for t in args.cells.split(","))
    ins = args.inset
    crops = []
    for i in range(n):
        cx = x0 + i * cw
        c = rgba[y0 + ins : y0 + ch - ins, cx + ins : cx + cw - ins].copy()
        # 같은 칸의 큰 덩어리 둘레만 남긴다(칸 선 조각 정리)
        m = c[..., 3] > 40
        core = ndi.binary_opening(m, structure=np.ones((5, 5), bool))
        keep = rb.dilate(core, 10) & m if core.sum() > 30 else m
        c[~keep, 3] = 0
        crops.append(c)
    ys = [np.nonzero(c[..., 3] > 40)[0] for c in crops]
    xs = [np.nonzero(c[..., 3] > 40)[1] for c in crops]
    tx0 = min(int(x.min()) for x in xs if len(x))
    tx1 = max(int(x.max()) for x in xs if len(x)) + 1
    ty0 = min(int(y.min()) for y in ys if len(y))
    ty1 = max(int(y.max()) for y in ys if len(y)) + 1
    pad = args.pad
    os.makedirs(args.outdir, exist_ok=True)
    cell_cx = (cw - 2 * ins) / 2
    for c, name in zip(crops, names):
        im = Image.fromarray(c[ty0:ty1, tx0:tx1], "RGBA")
        if args.scale != 1.0:
            im = im.resize((max(1, round(im.width * args.scale)), max(1, round(im.height * args.scale))), Image.LANCZOS)
        canvas = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0))
        canvas.alpha_composite(im, (pad, pad))
        canvas.save(os.path.join(args.outdir, name + ".png"))
    sw = (tx1 - tx0) * args.scale + 2 * pad
    sh = (ty1 - ty0) * args.scale + 2 * pad
    # 칸 가운데 아랫부분(예: 바닥 고리 중심) 기준 앵커 계산용 정보
    print(f"공통 상자 {sw:.0f}x{sh:.0f}, 칸 가운데 x의 위치 비율 {((cell_cx - tx0) * args.scale + pad) / sw:.3f}, 칸 위쪽 y 원점의 위치 {(-ty0 * args.scale + pad):.0f}px")
    return 0


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
    ap.add_argument("--cells", help="x0,y0,w,h,n: 가로로 n칸(칸 너비 w)을 칸마다 그대로 자른다(모든 칸을 같은 기준점으로 맞춘 채 공통으로 다듬는다)")
    ap.add_argument("--glow", type=float, default=0.0, help="빛 번짐 이펙트용: 밝은 번짐을 반투명으로 살린다(값은 투명도 증폭 배율, 예 2.0)")
    ap.add_argument("--dark", action="store_true", help="어두운 칸 선도 지운다")
    ap.add_argument("--blank", action="append", default=[], help="x0,y0,x1,y1 상자를 흰색으로 덮는다(글자 라벨 지우기). 여러 번 지정")
    ap.add_argument("--inset", type=int, default=4, help="--cells에서 칸 가장자리 선을 피해 안쪽으로 줄이는 폭")
    ap.add_argument("--rowsort", action="store_true", help="위 줄부터 읽는다(기본은 왼쪽→오른쪽)")
    args = ap.parse_args()
    names = args.names.split(",")
    rgb = np.array(Image.open(args.sheet).convert("RGB"))
    for b in args.blank:
        bx0, by0, bx1, by1 = (int(t) for t in b.split(","))
        rgb[by0:by1, bx0:bx1] = 255
    rgb = erase_grid(rgb)
    if args.dark:
        rgb = erase_dark_grid(rgb)
    rgba = to_rgba(rgb, args.threshold, args.effects, args.holes, args.glow)
    if args.cells:
        return cut_cells(rgba, args, names)
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
