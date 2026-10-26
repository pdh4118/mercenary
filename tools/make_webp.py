#!/usr/bin/env python3
"""client/public/assets 아래 모든 PNG의 .webp 짝을 만든다(손실 압축 품질 92, 투명도는 무손실에 가깝게).
클라이언트는 .webp 짝이 있으면 .png 대신 그것을 받아 로딩이 훨씬 빨라진다(PNG 원본은 지우지 않는다).
그림을 새로 추가하거나 바꾼 뒤 `python3 tools/make_webp.py`를 다시 돌린다(PNG가 더 새것이면 다시 만든다).
쓰는 법: python3 tools/make_webp.py [--quality 92] [--force]"""
import argparse, os, sys
from PIL import Image

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "client", "public", "assets")
ap = argparse.ArgumentParser()
ap.add_argument("--quality", type=int, default=92)
ap.add_argument("--force", action="store_true")
args = ap.parse_args()

before = after = made = skipped = 0
for d, _, files in os.walk(root):
    for f in files:
        if not f.endswith(".png"):
            continue
        src = os.path.join(d, f)
        dst = src[:-4] + ".webp"
        size = os.path.getsize(src)
        if os.path.exists(dst) and not args.force and os.path.getmtime(dst) >= os.path.getmtime(src):
            before += size; after += os.path.getsize(dst); continue
        im = Image.open(src)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA")
        im.save(dst, "WEBP", quality=args.quality, alpha_quality=100, method=6)
        new = os.path.getsize(dst)
        if new > size * 0.85:  # 별 이득이 없으면 PNG를 그대로 쓴다
            os.remove(dst); skipped += 1; before += size; after += size; continue
        made += 1; before += size; after += new
print(f"webp {made}개 만듦, {skipped}개는 이득이 없어 PNG 유지 · {before/1e6:.1f}MB → {after/1e6:.1f}MB")
