#!/usr/bin/env python3
"""그림 에셋의 화풍이 서로 얼마나 어긋나는지 수치로 재서 '튀는 것'을 뽑는다.

  python3 tools/asset_outliers.py [--assets client/public/assets] [--out report.md] [--csv metrics.csv] [--z 2.5] [--top 12]

각 PNG(같은 그림의 webp는 건너뛴다)에서 아래 수치를 잰다. 투명 픽셀은 모두 뺀다.
  sat        평균 채도(0~1). 생성 도구마다 색이 짙거나 바랜 정도가 다르다.
  lum        평균 밝기(0~1).
  contrast   밝기 분포의 90% 값 - 10% 값. 낮으면 밋밋하고, 높으면 대비가 세다.
  outline    '바깥 4px 안에서 가장 어두운 링의 밝기 - 몸통 평균 밝기'. 음수일수록 외곽선이 또렷하다.
  edge_dark  외곽선 두께 추정(px, 맨 바깥부터 어두운 링이 몇 겹인가). 얇거나 없으면 작다.
  white_halo 맨 바깥 1px 링이 그 안쪽 외곽선보다 얼마나 밝은가(0~1). 흰 배경을 지우고 남은 밝은 테두리이며, 어두운 배경에서 하얀 선으로 보인다.
  semi       알파가 반투명(32~224)인 픽셀의 비율. 이펙트는 높고 유닛은 낮은 것이 정상이다.
  margin     그림이 캔버스 가장자리에서 떨어진 최소 거리(px). 0이면 잘렸을 수 있다.
  fill       그림이 자기 상자(bbox)를 채운 비율.

비교는 '같은 종류' 안에서 한다: 일러스트(units·hero·cards·camp), 이펙트(fx), 지형(terrain·tiles), UI(ui).
각 종류 안에서 중앙값과 MAD로 만든 강건한 z점수를 쓰고, |z|가 --z 이상이면 튄다고 본다.
같은 이름 묶음(예: boss1_*, skill_*)이 4개 이상이면 그 묶음 안에서도 따로 비교한다.
"""
from __future__ import annotations

import argparse
import csv
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

KIND = {
    "units": "일러스트", "hero": "일러스트", "cards": "일러스트", "camp": "일러스트",
    "fx": "이펙트", "terrain": "지형", "tiles": "지형", "ui": "UI",
}
# 종류별 기준: 이펙트는 원래 모양·밝기·투명도가 제각각이고 색을 입혀 쓰는 흰색 계열이 많아 더 엄격하게(큰 z만) 본다
Z_BY_KIND = {"일러스트": 1.0, "이펙트": 1.6, "지형": 1.2, "UI": 1.0}
METRICS = ["sat", "lum", "contrast", "outline", "edge_dark", "white_halo", "semi"]
LABEL = {
    "sat": "채도", "lum": "밝기", "contrast": "대비", "outline": "외곽선(음수일수록 진함)",
    "edge_dark": "외곽선 두께(px)", "white_halo": "맨 바깥 밝은 테두리", "semi": "반투명 비율",
}
# 값이 어느 쪽으로 벗어났을 때 읽을 말
WORDS = {
    "sat": ("바랜 색", "과하게 짙은 색"), "lum": ("어두움", "밝음"), "contrast": ("밋밋함", "대비 셈"),
    "outline": ("외곽선이 진함", "외곽선이 약함/없음"), "edge_dark": ("외곽선이 얇음", "외곽선이 두꺼움"),
    "white_halo": ("", "맨 바깥에 밝은 테두리 남음"), "semi": ("거의 불투명", "반투명이 많음"),
}


def erode(mask: np.ndarray, n: int) -> np.ndarray:
    m = mask.copy()
    for _ in range(n):
        p = np.pad(m, 1, constant_values=False)
        m = p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return m


def measure(path: Path) -> dict | None:
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im, dtype=np.float32) / 255.0
    rgb, al = a[..., :3], a[..., 3]
    h, w = al.shape
    opaque = al > 0.125  # 32/255
    cnt = int(opaque.sum())
    if cnt < 40:
        return None
    ys, xs = np.where(opaque)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    # 가장 바깥부터 1px씩 벗겨 가며 링별 평균 밝기를 잰다(링1=맨 바깥 1px).
    rings: list[float] = []
    cur = opaque.copy()
    for _ in range(6):
        nxt = erode(cur, 1)
        ring = cur & ~nxt
        rings.append(float(lum[ring].mean()) if ring.any() else 1.0)
        cur = nxt
    band = opaque & ~erode(opaque, 3)
    inner = opaque & ~band
    lo, hi = np.percentile(lum[opaque], [10, 90])
    bl = lum[band]
    body = float(lum[inner].mean()) if inner.any() else float(lum[opaque].mean())
    darkest = min(rings[:4])  # 외곽선 자리(맨 바깥 4px 안)의 가장 어두운 링
    thick = sum(1 for v in rings if v < max(0.15, darkest + 0.08))  # 외곽선 두께 추정(px)
    halo = rings[0] - min(rings[1:4])  # 맨 바깥 링이 외곽선보다 얼마나 밝은가(하얀 번짐)
    def longest_run(line: np.ndarray) -> int:
        best = cur = 0
        for v in line:
            cur = cur + 1 if v else 0
            best = max(best, cur)
        return best

    # 캔버스 네 변을 따라 길게 이어진 불투명 구간(가장 긴 것)의 변 길이 대비 비율. 딱 맞게 오려 낸 그림은 변과 한두 점만 닿으므로 작게 나온다.
    solid = al > 0.5
    edge_run = max(
        longest_run(solid[0, :]) / w, longest_run(solid[-1, :]) / w,
        longest_run(solid[:, 0]) / h, longest_run(solid[:, -1]) / h,
    )
    out = {
        "w": w, "h": h, "px": cnt, "edge_run": float(edge_run),
        "sat": float(sat[opaque].mean()),
        "lum": float(lum[opaque].mean()),
        "contrast": float(hi - lo),
        "outline": float(darkest - body),  # 외곽선이 몸통보다 얼마나 어두운가(음수일수록 진함)
        "edge_dark": float(thick),  # 외곽선 두께 추정(px)
        "white_halo": float(max(0.0, halo)),  # 맨 바깥 링이 외곽선보다 밝은 정도(0이면 번짐 없음)
        "semi": float(((al > 0.125) & (al < 0.88)).sum() / cnt),
        "margin": int(min(x0, y0, w - 1 - x1, h - 1 - y1)),
        "fill": float(cnt / ((x1 - x0 + 1) * (y1 - y0 + 1))),
    }
    return out


def family(name: str) -> str:
    """boss1_slash_0 -> boss1, skill_wall_up -> skill, meteor_3 -> meteor"""
    stem = Path(name).stem
    return re.split(r"[_]", stem)[0] or stem


def subset(path: str) -> str:
    """fx/skill_wall_0_a.png -> fx/skill_wall_*, units/enemy_mace.png -> units/enemy_mace"""
    stem = Path(path).with_suffix("").as_posix()
    stem = re.sub(r"(_\d+[a-d]?|_[a-d])$", "", stem)
    stem = re.sub(r"(_\d+)$", "", stem)
    stem = re.sub(r"(_\d+)$", "", stem)
    return stem


def collapse(items: list[tuple[str, str]]) -> list[str]:
    """(경로, 설명) 목록에서 같은 세트·같은 설명을 한 줄로 합친다."""
    groups: dict[tuple[str, str], list[str]] = {}
    for path, desc in items:
        groups.setdefault((subset(path), desc), []).append(path)
    out = []
    for (sub, desc), paths in groups.items():
        if len(paths) >= 3:
            out.append(f"- `{sub}_*` ({len(paths)}개): {desc}")
        else:
            out.extend(f"- `{p}`: {desc}" for p in paths)
    return out


def robust_z(vals: list[float]) -> list[float]:
    arr = np.array(vals, dtype=np.float64)
    med = np.median(arr)
    mad = np.median(np.abs(arr - med)) * 1.4826
    if mad < 1e-6:  # 거의 다 같은 값이면 표준편차로 대신한다
        sd = arr.std()
        mad = sd if sd > 1e-6 else 1.0
    return list((arr - med) / mad)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--assets", default="client/public/assets")
    ap.add_argument("--out", default="asset_outliers.md")
    ap.add_argument("--csv", default="")
    ap.add_argument("--z", type=float, default=2.5)
    ap.add_argument("--top", type=int, default=12)
    args = ap.parse_args()
    root = Path(args.assets)
    rows: list[dict] = []
    for folder, kind in KIND.items():
        d = root / folder
        if not d.is_dir():
            continue
        for p in sorted(d.rglob("*.png")):
            if "_old" in p.stem or "_raw" in str(p.parent):  # 보관용 이전 그림은 건너뛴다
                continue
            m = measure(p)
            if m is None:
                continue
            m.update(path=str(p.relative_to(root)), folder=folder, kind=kind, fam=f"{folder}/{family(p.name)}")
            rows.append(m)
    if not rows:
        print("읽을 PNG가 없습니다", file=sys.stderr)
        return 1

    # z점수: 종류 전체 기준, 그리고 같은 이름 묶음(4개 이상) 기준
    for r in rows:
        r["z"], r["zf"] = {}, {}
    by_kind: dict[str, list[dict]] = defaultdict(list)
    by_fam: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_kind[r["kind"]].append(r)
        by_fam[r["fam"]].append(r)
    # 종류 기준(z): 묶음별 중앙값들의 중앙값과 MAD를 쓴다(장수가 많은 묶음, 예: 기병 프레임 48장이 기준을 끌고 가지 않게)
    for kind, g in by_kind.items():
        fams: dict[str, list[dict]] = defaultdict(list)
        for x in g:
            fams[x["fam"]].append(x)
        if len(fams) < 6:
            continue
        for mname in METRICS:
            fm = np.array([float(np.median([x[mname] for x in fg])) for fg in fams.values()])
            med = float(np.median(fm))
            mad = float(np.median(np.abs(fm - med))) * 1.4826
            if mad < 1e-6:
                mad = float(fm.std()) or 1.0
            for x in g:
                x["z"][mname] = (x[mname] - med) / mad
    for g in by_fam.values():
        if len(g) < 4:
            continue
        for mname in METRICS:
            zs = robust_z([x[mname] for x in g])
            for x, z in zip(g, zs):
                x["zf"][mname] = z

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8") as f:
            wr = csv.writer(f)
            wr.writerow(["path", "kind", "w", "h", *METRICS, "margin", "fill"])
            for r in rows:
                wr.writerow([r["path"], r["kind"], r["w"], r["h"], *[f"{r[m]:.3f}" for m in METRICS], r["margin"], f"{r['fill']:.3f}"])

    L: list[str] = []
    L.append(f"# 그림 에셋 이상치 보고서\n\n측정한 PNG {len(rows)}개 (`_old`·`_raw` 제외). 기준 |z| ≥ {args.z}.\n")
    L.append("| 종류 | 개수 | 채도 중앙값 | 밝기 중앙값 | 대비 중앙값 | 외곽선 중앙값 | 외곽선 두께(px) | 밝은 테두리 | 반투명 |")
    L.append("|---|---|---|---|---|---|---|---|---|")
    for kind, g in by_kind.items():
        med = lambda m: float(np.median([x[m] for x in g]))
        L.append(f"| {kind} | {len(g)} | {med('sat'):.2f} | {med('lum'):.2f} | {med('contrast'):.2f} | {med('outline'):+.2f} | {med('edge_dark'):.1f} | {med('white_halo'):.2f} | {med('semi'):.2f} |")
    L.append("")

    # 1) 확실한 결함: 잘림, 흰 테두리
    cut = sorted([r for r in rows if r["edge_run"] >= 0.2 and r["kind"] in ("일러스트", "이펙트") and r["fill"] < 0.97], key=lambda r: -r["edge_run"])
    L.append(f"## 1. 캔버스 가장자리에 길게 닿아 잘렸을 수 있는 그림 ({len(cut)}개)\n")
    L.append("불투명한 부분이 캔버스 한 변의 20% 넘게 이어져 닿은 것(딱 맞게 오린 그림은 한두 점만 닿아서 제외). 지형 타일은 원래 가득 채우므로 뺐다. 넓은 바닥 그림자나 땅에 닿는 이펙트는 정상일 수 있다.\n")
    for r in cut[:40]:
        L.append(f"- `{r['path']}` ({r['w']}x{r['h']}, 닿은 길이 {r['edge_run'] * 100:.0f}%)")
    if len(cut) > 40:
        L.append(f"- … 외 {len(cut) - 40}개")
    L.append("")
    halo = sorted([r for r in rows if r["white_halo"] > 0.3 and r["kind"] == "일러스트"], key=lambda r: -r["white_halo"])
    L.append(f"## 2. 맨 바깥에 밝은 테두리가 남은 일러스트 ({len(halo)}개)\n")
    L.append("일러스트의 맨 바깥 1px 링이 그 안쪽 외곽선보다 0.3 넘게 밝다. 흰 배경을 지운 흔적이며 어두운 바닥 위에서 가는 흰 선으로 보인다. 이펙트는 밝은 것이 정상이라 뺐다.\n")
    for r in halo[: args.top * 2]:
        L.append(f"- `{r['path']}` 밝은 테두리 +{r['white_halo']:.2f}")
    L.append("")

    # 2) 종류 안에서 화풍이 어긋난 그림
    L.append("## 3. 같은 종류 안에서 화풍이 어긋난 그림\n")
    L.append("같은 종류의 묶음별 중앙값에서 크게 벗어난 그림. 이펙트는 모양·밝기가 원래 제각각이고 색을 입혀 쓰는 흰색 계열(`skill_*`)이 많아 기준을 1.6배로 높이고 두 가지 이상이 벗어난 것만 적었다(`--z`로 조정). 같은 세트가 같은 이유로 3장 이상 튀면 한 줄로 합쳤다.\n")
    for kind, g in by_kind.items():
        scored = []
        for r in g:
            zk = args.z * Z_BY_KIND.get(kind, 1.0)
            bad = [(m, r["z"].get(m, 0.0)) for m in ("sat", "lum", "contrast", "outline", "edge_dark") if abs(r["z"].get(m, 0.0)) >= zk]
            if bad and (kind != "이펙트" or len(bad) >= 2):
                scored.append((sum(abs(z) for _, z in bad), r, bad))
        scored.sort(key=lambda t: -t[0])
        L.append(f"### {kind} ({len(g)}개 중 {len(scored)}개가 튐)\n")
        if len(g) < 8:
            L.append("표본이 적어 비교하지 않았다.\n")
            continue
        items = []
        for _, r, bad in scored:
            desc = ", ".join(WORDS[m][0 if z < 0 else 1] for m, z in sorted(bad, key=lambda t: -abs(t[1]))[:3])
            items.append((r["path"], desc))
        lines = collapse(items)
        L.extend(lines[: args.top * 2])
        if len(lines) > args.top * 2:
            L.append(f"- … 외 {len(lines) - args.top * 2}줄")
        L.append("")

    # 3) 묶음 안에서 어긋난 그림
    L.append("## 4. 같은 이름 묶음 안에서 어긋난 그림\n")
    L.append("`boss1_*`, `skill_*`처럼 같은 접두어 묶음(4개 이상)의 중앙값과 비교했다. 한 세트로 그린 그림 중 혼자 다른 것이다.\n")
    items = []
    for fam, g in sorted(by_fam.items()):
        if len(g) < 4:
            continue
        for r in g:
            bad = [(m, r["zf"].get(m, 0.0)) for m in ("sat", "lum", "contrast", "outline", "edge_dark") if abs(r["zf"].get(m, 0.0)) >= args.z + 0.5]
            if bad:
                desc = ", ".join(WORDS[m][0 if z < 0 else 1] for m, z in sorted(bad, key=lambda t: -abs(t[1]))[:2])
                items.append((r["path"], desc))
    lines = collapse(items)
    L.extend(lines[: args.top * 6])
    if len(lines) > args.top * 6:
        L.append(f"- … 외 {len(lines) - args.top * 6}줄")
    L.append("")

    # 4) 묶음끼리 화풍 차이: 보스별·묶음별 중앙값을 나란히
    L.append("## 5. 묶음별 중앙값 비교 (일러스트·이펙트)\n")
    L.append("묶음끼리 평균이 서로 다르면 '다른 시기·다른 도구로 만든 그림'일 가능성이 있다. 종류 중앙값에서 가장 먼 묶음부터.\n")
    for kind in ("일러스트", "이펙트"):
        g = by_kind.get(kind, [])
        if not g:
            continue
        gm = {m: float(np.median([x[m] for x in g])) for m in ("sat", "lum", "contrast", "outline")}
        spread = {m: (float(np.median([abs(x[m] - gm[m]) for x in g])) * 1.4826 or 1.0) for m in gm}
        rowsf = []
        for fam, fg in by_fam.items():
            if fg[0]["kind"] != kind or len(fg) < 4:
                continue
            med = {m: float(np.median([x[m] for x in fg])) for m in gm}
            dist = sum(abs(med[m] - gm[m]) / spread[m] for m in gm)
            rowsf.append((dist, fam, len(fg), med))
        rowsf.sort(reverse=True)
        L.append(f"### {kind}\n")
        L.append("| 묶음 | 개수 | 채도 | 밝기 | 대비 | 외곽선 | 종류 중앙값과의 거리 |")
        L.append("|---|---|---|---|---|---|---|")
        for dist, fam, n, med in rowsf[: args.top]:
            L.append(f"| `{fam}` | {n} | {med['sat']:.2f} | {med['lum']:.2f} | {med['contrast']:.2f} | {med['outline']:+.2f} | {dist:.1f} |")
        L.append(f"| (종류 중앙값) | {len(g)} | {gm['sat']:.2f} | {gm['lum']:.2f} | {gm['contrast']:.2f} | {gm['outline']:+.2f} | - |")
        L.append("")

    Path(args.out).write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"측정 {len(rows)}개 → {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
