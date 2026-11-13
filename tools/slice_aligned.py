#!/usr/bin/env python3
"""가로로 늘어선 스프라이트 시트(투명 배경)를 한 장씩 자르되, 모든 그림의 캔버스 크기와 발 위치를 똑같이 맞춰 저장한다.

  python3 tools/slice_aligned.py sheet.png outdir --names boss5_swing_a,boss5_swing_b [--scale 0.5] [--foot-rows 24] [--pad 4]

같은 보스의 포즈를 번갈아 보여 줄 때(휘두르기 2장, 도는 포즈 4장 등) 몸이 튀지 않으려면 크기와 발 위치가 같아야 한다.
- 항목 나누기: 세로 방향으로 합쳐 본 투명 열(--gap px 이상 이어진 빈 구간)을 경계로 나눈다. 글자 라벨은 --label-y 아래를 미리 지워 둔다.
- 발 위치: 각 그림의 맨 아래 --foot-rows 줄 불투명 픽셀의 가로 중심을 발 중심으로 보고, 모든 그림의 발 중심을 캔버스 가운데에, 맨 아래를 캔버스 아래에 맞춘다.
- 캔버스: 모든 그림이 들어가는 가장 작은 크기(왼쪽·오른쪽은 발 중심에서 더 먼 쪽에 맞춘 대칭).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sheet")
    ap.add_argument("outdir")
    ap.add_argument("--names", required=True)
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--foot-rows", type=int, default=24)
    ap.add_argument("--gap", type=int, default=20)
    ap.add_argument("--pad", type=int, default=4)
    ap.add_argument("--alpha", type=int, default=40)
    args = ap.parse_args()
    names = args.names.split(",")

    a = np.array(Image.open(args.sheet).convert("RGBA"))
    mask = a[..., 3] > args.alpha
    cols = mask.any(0)
    runs, start, gap = [], None, 0
    for x, v in enumerate(cols):
        if v:
            if start is None:
                start = x
            gap = 0
            end = x
        elif start is not None:
            gap += 1
            if gap >= args.gap:
                runs.append((start, end))
                start = None
    if start is not None:
        runs.append((start, end))
    if len(runs) != len(names):
        print(f"그림 {len(runs)}개를 찾았지만 이름은 {len(names)}개입니다: {runs}", file=sys.stderr)
        return 1

    items = []
    for (x0, x1) in runs:
        sub = a[:, x0 : x1 + 1].copy()
        m = sub[..., 3] > args.alpha
        ys = np.where(m.any(1))[0]
        top, bottom = int(ys.min()), int(ys.max())
        foot = m[max(top, bottom - args.foot_rows + 1) : bottom + 1]
        fx = float(np.where(foot.any(0))[0].mean())  # 서브 이미지 안 발 중심 x
        items.append({"img": sub[top : bottom + 1], "fx": fx, "w": x1 - x0 + 1, "h": bottom - top + 1})
    left = max(i["fx"] for i in items)
    right = max(i["w"] - i["fx"] for i in items)
    half = int(np.ceil(max(left, right))) + args.pad
    H = max(i["h"] for i in items) + args.pad
    W = half * 2
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    for name, it in zip(names, items):
        canvas = np.zeros((H, W, 4), dtype=np.uint8)
        ox = int(round(half - it["fx"]))
        oy = H - args.pad // 2 - it["h"]
        canvas[oy : oy + it["h"], ox : ox + it["w"]] = it["img"]
        im = Image.fromarray(canvas, "RGBA")
        size = (max(1, round(W * args.scale)), max(1, round(H * args.scale)))
        im = im.resize(size, Image.LANCZOS)
        im.save(out / f"{name}.png", optimize=True)
        print(f"{name}.png  발 중심 x={it['fx']:.0f}, 원본 {it['w']}x{it['h']} → 캔버스 {W}x{H} → {size[0]}x{size[1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
