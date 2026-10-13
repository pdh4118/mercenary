#!/usr/bin/env python3
"""바닥 타일이 이음새 없이 반복되는지 확인한다.

  python3 tools/tile_preview.py ground.png

- 3x3으로 이어 붙인 미리보기를 `<이름>_preview.png`로 저장한다(눈으로 이음새 확인).
- 이음새 점수: 타일의 왼쪽-오른쪽, 위-아래 가장자리 차이를, 타일 안쪽에서 이웃한 픽셀 줄끼리의 평균 차이와 비교한 배율.
  1.0 근처면 자연스럽고, 2.0을 넘으면 이음새가 눈에 띌 가능성이 크다.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def seam_ratio(a: np.ndarray) -> tuple[float, float]:
    a = a.astype(np.float64)
    # 이웃한 줄 사이의 평균 차이(기준값)와 타일 양 끝이 이어질 때의 차이를 비교한다
    inner_x = np.abs(np.diff(a, axis=1)).mean()
    inner_y = np.abs(np.diff(a, axis=0)).mean()
    seam_x = np.abs(a[:, 0] - a[:, -1]).mean()
    seam_y = np.abs(a[0, :] - a[-1, :]).mean()
    eps = 1e-6
    return seam_x / (inner_x + eps), seam_y / (inner_y + eps)


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    src = Path(sys.argv[1])
    im = Image.open(src).convert("RGB")
    a = np.array(im)
    rx, ry = seam_ratio(a)
    tiled = Image.new("RGB", (im.width * 3, im.height * 3))
    for y in range(3):
        for x in range(3):
            tiled.paste(im, (x * im.width, y * im.height))
    if tiled.width > 1500:
        s = 1500 / tiled.width
        tiled = tiled.resize((1500, round(tiled.height * s)), Image.LANCZOS)
    out = src.with_name(src.stem + "_preview.png")
    tiled.save(out)
    verdict = "이음새가 거의 없습니다" if max(rx, ry) < 1.5 else "이음새가 보일 수 있습니다. 미리보기를 확인하세요" if max(rx, ry) < 2.5 else "이음새가 뚜렷합니다. 다시 만들거나 보정이 필요합니다"
    print(f"크기 {im.width}x{im.height}  이음새 점수 가로 {rx:.2f} / 세로 {ry:.2f}  -> {verdict}")
    print(f"미리보기: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
