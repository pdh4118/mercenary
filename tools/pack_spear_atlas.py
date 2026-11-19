#!/usr/bin/env python3
"""창병 걷기·공격 그림을 한 장의 아틀라스로 묶는다(그림마다 텍스처가 따로면 화면에 적이 많을 때 그리기 호출이 늘어 렉이 난다).

  python3 tools/pack_spear_atlas.py

입력: client/public/assets/units/{ally,enemy}_spear_walk_N.png, {ally,enemy}_spear_atk_{windup,strike}_D.png
출력: client/public/assets/units/{ally,enemy}_spear_atlas.png + .json  ({이름: {x,y,w,h,ax}}, ax = 발 중심 x(프레임 안 픽셀))
각 프레임은 투명 여백을 잘라 내고, 발 중심(원본 가로 가운데)이 어디였는지를 ax로 남긴다.
"""
import json
from pathlib import Path
from PIL import Image

U = Path(__file__).resolve().parent.parent / "client/public/assets/units"
WALK_N = 12
PAD = 2


def frames(side: str):
    names = [f"walk_{i}" for i in range(WALK_N)] + [f"atk_{p}_{d}" for p in ("windup", "strike") for d in range(5)]
    for n in names:
        im = Image.open(U / f"{side}_spear_{n}.png").convert("RGBA")
        bb = im.getbbox()
        yield n, im.crop(bb), im.width / 2 - bb[0]  # 발 중심 x(잘라낸 그림 기준)


for side in ("ally", "enemy"):
    items = list(frames(side))
    W = 2048
    x = y = rowh = 0
    pos = {}
    for n, im, ax in items:
        if x + im.width + PAD > W:
            x, y, rowh = 0, y + rowh + PAD, 0
        pos[n] = {"x": x, "y": y, "w": im.width, "h": im.height, "ax": round(ax, 2)}
        x += im.width + PAD
        rowh = max(rowh, im.height)
    H = y + rowh + PAD
    atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for n, im, ax in items:
        atlas.paste(im, (pos[n]["x"], pos[n]["y"]))
    atlas.save(U / f"{side}_spear_atlas.png")
    (U / f"{side}_spear_atlas.json").write_text(json.dumps(pos, ensure_ascii=False), encoding="utf-8")
    print(side, atlas.size, len(pos), "프레임")
