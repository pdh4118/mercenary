#!/usr/bin/env python3
"""줄마다 글자 캡션이 달린 이펙트 시트(투명 배경 PNG)를 컷으로 자른다.

  python3 tools/slice_fx_rows.py sheet.png outdir --rows jump:4,blink:4,stealth:3 [--scale 0.5] [--anchor lunge=right]

- 캡션(어둡고 납작한 글자 덩어리)을 찾아 줄과 칸의 기준으로 삼는다. 캡션 위에 있는 조각은 가장 가까운 캡션 칸에 묶는다
  (blink 마지막 컷처럼 떨어진 작은 점 여러 개도 한 컷이 된다). 캡션 자체는 버린다.
- 한 줄의 컷은 같은 캔버스 크기로 맞추고 컷의 가운데(또는 --anchor 줄=right|left)를 기준점으로 놓는다.
- 이름은 <줄이름>_<번호>(칸이 하나인 줄은 번호 없이 <줄이름>)이다. --rows는 위 줄부터.
"""
import argparse
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def components(mask: np.ndarray, grow: int, ds: int = 4):
    """mask를 ds배 줄여 grow만큼 불린 뒤 8방향 연결 성분 라벨(전체 해상도 라벨 배열 반환)."""
    h, w = mask.shape
    hh, ww = -(-h // ds), -(-w // ds)
    pad = np.zeros((hh * ds, ww * ds), dtype=bool)
    pad[:h, :w] = mask
    small = pad.reshape(hh, ds, ww, ds).any(axis=(1, 3))
    for _ in range(grow):
        p = np.pad(small, 1)
        small = small | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    lab = np.zeros(small.shape, dtype=np.int32)
    n = 0
    for y in range(hh):
        for x in range(ww):
            if not small[y, x] or lab[y, x]:
                continue
            n += 1
            lab[y, x] = n
            q = deque([(y, x)])
            while q:
                cy, cx = q.popleft()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < hh and 0 <= nx < ww and small[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n
                            q.append((ny, nx))
    full = np.kron(lab, np.ones((ds, ds), dtype=np.int32))[:h, :w]
    return full, n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("outdir")
    ap.add_argument("--rows", required=True, help="줄이름:칸수, 위 줄부터 쉼표로")
    ap.add_argument("--scale", type=float, default=0.5)
    ap.add_argument("--anchor", default="", help="줄이름=right|left 쉼표로(기본 가운데)")
    ap.add_argument("--grow", type=int, default=0, help="조각을 한 덩어리로 묶는 거리(4px 단위)")
    args = ap.parse_args()

    im = Image.open(args.sheet).convert("RGBA")
    a = np.asarray(im)
    mask = a[..., 3] > 40
    lab, n = components(mask, args.grow)
    rows = [(r.split(":")[0], int(r.split(":")[1])) for r in args.rows.split(",")]
    anchors = dict(kv.split("=") for kv in args.anchor.split(",") if kv)

    # 캡션 줄: 어둡고(RGB 평균 70 미만) 불투명한 픽셀이 가로로 많은 높이 22~50px의 띠
    rgb = a[..., :3].astype(int)
    dark = (a[..., 3] > 200) & (rgb.mean(axis=2) < 70)
    ys = np.nonzero(dark.sum(axis=1) >= 18)[0]
    bands: list[tuple[int, int]] = []
    s0 = p0 = int(ys[0])
    for y in ys[1:]:
        if y - p0 > 5:
            bands.append((s0, p0))
            s0 = int(y)
        p0 = int(y)
    bands.append((s0, p0))
    bands = [b for b in bands if 22 <= b[1] - b[0] <= 50]
    if len(bands) != len(rows):
        raise SystemExit(f"캡션 띠 {len(bands)}개, 요청한 줄 {len(rows)}개가 다릅니다: {bands}")
    # 효과 조각: 캡션 띠를 지운 마스크의 연결 성분
    fx = mask.copy()
    for b in bands:
        fx[max(0, b[0] - 6) : b[1] + 7] = False
    lab, n = components(fx, args.grow)
    others = []
    for i in range(1, n + 1):
        yy, xx = np.nonzero(lab == i)
        if len(yy) < 6:
            continue
        others.append(dict(id=i, x0=xx.min(), x1=xx.max() + 1, y0=yy.min(), y1=yy.max() + 1))
    lines = []
    for b in bands:
        cols_x = np.nonzero(dark[b[0] : b[1] + 1].sum(axis=0) > 0)[0]
        groups: list[list[int]] = [[int(cols_x[0])]]
        for x in cols_x[1:]:
            if x - groups[-1][-1] > 60:
                groups.append([int(x)])
            else:
                groups[-1].append(int(x))
        lines.append([dict(x0=g[0], x1=g[-1] + 1, y0=b[0], y1=b[1] + 1) for g in groups if g[-1] - g[0] > 40])
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    prev_bottom = 0
    for (name, count), line in zip(rows, lines):
        line.sort(key=lambda c: c["x0"])
        if len(line) != count:
            raise SystemExit(f"{name}: 캡션 {len(line)}개, 요청 {count}칸")
        top = min(c["y0"] for c in line)
        centers = [(c["x0"] + c["x1"]) / 2 for c in line]
        cols: list[list[dict]] = [[] for _ in line]
        for c in others:
            cy = (c["y0"] + c["y1"]) / 2
            if not (prev_bottom <= cy < top):
                continue
            cx = (c["x0"] + c["x1"]) / 2
            cols[int(np.argmin([abs(cx - k) for k in centers]))].append(c)
        prev_bottom = max(c["y1"] for c in line)
        frames = []
        for col in cols:
            if not col:
                raise SystemExit(f"{name}: 빈 칸이 있습니다")
            x0, x1 = min(c["x0"] for c in col), max(c["x1"] for c in col)
            y0, y1 = min(c["y0"] for c in col), max(c["y1"] for c in col)
            ids = [c["id"] for c in col]
            sel = np.isin(lab[y0:y1, x0:x1], ids)
            crop = a[y0:y1, x0:x1].copy()
            crop[~sel] = 0  # 이 칸에 묶인 조각만 남긴다
            frames.append(Image.fromarray(crop, "RGBA"))
        W = max(f.width for f in frames) + 8
        H = max(f.height for f in frames) + 8
        for i, f in enumerate(frames):
            canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            anc = anchors.get(name, "center")
            ox = (W - f.width) // 2 if anc == "center" else (W - f.width - 4 if anc == "right" else 4)
            oy = (H - f.height) // 2
            canvas.alpha_composite(f, (ox, oy))
            if args.scale != 1:
                canvas = canvas.resize((max(1, round(W * args.scale)), max(1, round(H * args.scale))), Image.LANCZOS)
            fn = f"mskill_{name}" if count == 1 else f"mskill_{name}_{i}"
            canvas.save(outdir / f"{fn}.png")
        print(f"{name}: {count}컷 {round(W * args.scale)}x{round(H * args.scale)}")


if __name__ == "__main__":
    main()
