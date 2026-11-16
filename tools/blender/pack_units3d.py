"""256px 렌더(spear_kaykit.py 결과)를 게임이 읽는 틀로 옮긴다.

게임(client/src/main.ts)은 방향별 그림을 앵커 (0.46, 0.95), 배율 0.46으로 그린다. 파일럿 그림(119x110, 키 약 90px)에 맞춘 값이라
256px 렌더를 그대로 넣으면 두 배쯤 크고 발 위치가 어긋난다. 그래서 키가 약 90px이 되게 줄이고, 발 기준점이 (0.46W, 0.95H)에 오게 놓는다.
그림을 고치는 것이 아니라 줄이고 자리만 옮긴다.

실행: python tools/blender/pack_units3d.py <256px 폴더> <출력 폴더> [배율 0.536] [캔버스 너비 160] [캔버스 높이 140]
"""
import glob
import os
import sys

from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
S = float(sys.argv[3]) if len(sys.argv) > 3 else 0.536
W = int(sys.argv[4]) if len(sys.argv) > 4 else 160
H = int(sys.argv[5]) if len(sys.argv) > 5 else 140
AX, AY = 94.7, 218.0  # 256px 렌더에서 발 기준점(몸 중심선, 발바닥 바로 아래). 카메라가 고정이라 모든 컷에서 같다.
os.makedirs(OUT, exist_ok=True)
clipped = []
for f in sorted(glob.glob(os.path.join(SRC, "*.png"))):
    im = Image.open(f).convert("RGBA")
    n = round(im.width * S)
    small = im.resize((n, n), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(small, (round(0.46 * W - AX * S), round(0.95 * H - AY * S)))
    b = canvas.getchannel("A").getbbox()
    if b[0] <= 0 or b[1] <= 0 or b[2] >= W or b[3] >= H:
        clipped.append(os.path.basename(f))
    canvas.save(os.path.join(OUT, os.path.basename(f)))
print("packed", len(glob.glob(os.path.join(OUT, "*.png"))), "clipped", clipped)
