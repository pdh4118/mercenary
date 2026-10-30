#!/usr/bin/env python3
"""shared/src/bossskill.ts의 BOSS_* 수치 표에서 수치 조정 도구용 이름표(shared/src/bosslabels.ts)를 만든다.
각 수치의 이름은 '스킬 이름 + 수치 종류(예고·피해·재사용 등)'로, 설명은 줄 끝 주석에서 가져온다.
bossskill.ts에 수치를 추가한 뒤 `python3 tools/gen_boss_labels.py`로 다시 만든다."""
import re, json, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "shared/src/bossskill.ts").read_text()
BOSSES = {"BOSS_CAV": "기병 장군", "BOSS_SPEAR": "창병 장군", "BOSS_ARCHER": "궁병 장군", "BOSS_SHIELD": "검방병 장군", "BOSS_BLUNT": "둔기병 장군", "BOSS_MAGE": "마법사 장군", "BOSS_MOUNT": "기마궁수", "BOSS_CHARIOT": "전차", "BOSS_NECRO": "네크로맨서"}
SUFFIX = [
    ("Strikes", "타격 횟수"), ("Fade", "사라지는 시간(초)"), ("Fan", "부채꼴 범위"), ("PerPlayer", "인원당 개수"), ("Area", "범위"), ("Crash", "부딪혀 기절(초)"), ("Dizzy", "어지러움(초)"), ("Pieces", "조각 수"), ("Absorb", "흡수량"), ("Threat", "위협 판단 거리"), ("Shots", "발사 수"), ("Flee", "도주 시간(초)"), ("Dps", "초당 피해"), ("Root", "속박 시간(초)"),
    ("Tele", "예고 시간(초)"), ("Cd", "재사용 대기(초)"), ("Dmg", "피해 배율"), ("Damage", "피해 배율"), ("Knock", "넉백 거리"),
    ("Rest", "끝난 뒤 멈춤(초)"), ("Range", "사용 거리"), ("Len", "길이"), ("Length", "길이"), ("Width", "폭"), ("Speed", "속도"),
    ("Radius", "반경"), ("Sec", "지속 시간(초)"), ("Stun", "기절 시간(초)"), ("Half", "반각(라디안)"), ("Count", "개수"), ("Hits", "타수"),
    ("Step", "간격(초)"), ("Mult", "배율"), ("Taken", "받는 피해 비율"), ("Hp", "체력 비율"), ("Frac", "비율"), ("Dist", "거리"), ("Thick", "두께"),
    ("Delay", "대기(초)"), ("Min", "최소"), ("Max", "최대"), ("Advance", "전진 거리"), ("Lead", "미리 예고(초)"), ("Heal", "회복량"),
    ("Fall", "낙하 시간(초)"), ("Chance", "확률"), ("Gap", "간격"), ("Front", "앞쪽 거리"), ("Back", "뒤쪽 거리"), ("Throw", "던지기"),
]
PREFIX = {
    "BOSS_CAV": {"sprint": "질주", "charge": "돌진", "kick": "뒷발차기", "slash": "선회 베기", "roar": "돌격 함성"},
    "BOSS_SPEAR": {"clone": "분신 돌진", "guard": "창 방어 태세", "triple": "장창 3연 찌르기", "throw": "창 던지기"},
    "BOSS_ARCHER": {"stealth": "은신 질주", "snipe": "은신 저격", "ice": "얼음 화살 난사", "rain": "화살비", "react": "피격 반응", "threat": "위협 판단"},
    "BOSS_SHIELD": {"reflect": "반사 태세", "inv": "운석 맞춤 무적", "rush": "방패 돌진", "summon": "사수 소환·거대 방패", "shield": "사수 소환·거대 방패", "half": "체력 절반 광역 기절"},
    "BOSS_BLUNT": {"jump": "점프 쿵", "mace": "거대 철퇴 투척", "throw": "거대 철퇴 투척", "flurry": "철퇴 난타", "whirl": "휠윈드", "shard": "철퇴 파편"},
    "BOSS_MAGE": {"blink": "순간이동", "meteor": "운석", "prison": "얼음 감옥", "ring": "확산 불꽃", "shield": "매직 쉴드"},
    "BOSS_MOUNT": {"break": "막혔을 때", "cornered": "궁지에 몰렸을 때", "flee": "도주", "hit": "치고 빠지기", "keep": "거리 유지", "lasso": "올가미 화살", "orbit": "선회 사격", "shot": "사격", "speed": "이동 속도", "blind": "실명 화살"},
    "BOSS_CHARIOT": {"accel": "가속 돌진", "drift": "급선회 파쇄", "front": "정면 충돌", "rampage": "폭주", "scythe": "낫 바퀴", "weak": "약점"},
    "BOSS_NECRO": {"chain": "영혼 사슬", "corpse": "시체", "drain": "생명 흡수", "fog": "암흑 안개", "keep": "거리 유지", "orb": "영혼 구슬(평타)", "revive": "뼈 소생", "skel": "스켈레톤"},
}
out = {}
for const, bname in BOSSES.items():
    m = re.search(r"export const %s = \{(.*?)\n\} as const;" % const, src, re.S)
    if not m:
        print("없음", const, file=sys.stderr)
        continue
    section = "기본"
    prefix_skill = {}
    for line in m.group(1).split("\n"):
        t = line.strip()
        if not t:
            continue
        sec = re.match(r"^//\s*([^:：]+)[:：]", t)
        if sec:
            section = sec.group(1).strip()
            continue
        kv = re.match(r"^(\w+):\s*([^,]+),\s*(//\s*(.*))?$", t)
        if not kv:
            continue
        key, val, comment = kv.group(1), kv.group(2).strip(), (kv.group(4) or "").strip()
        try:
            float(eval(val.replace("Math.PI", "3.141592653589793")))
        except Exception:
            continue
        pre = re.match(r"^([a-z]+)", key).group(1)
        skill = PREFIX.get(const, {}).get(pre) or ("기본" if key in ("firstDelay", "idleMin", "idleMax") else section)
        suf = next((k for s_, k in SUFFIX if key[len(pre):].endswith(s_) or key == pre + s_ or key.endswith(s_)), None)
        if key == "firstDelay":
            label, skill = "등장 뒤 첫 스킬까지(초)", "기본"
        elif key == "idleMin":
            label, skill = "스킬 사이 쉬는 시간 최소(초)", "기본"
        elif key == "idleMax":
            label, skill = "스킬 사이 쉬는 시간 최대(초)", "기본"
        elif suf:
            label = f"{suf}"
        else:
            label = (comment.split("(")[0].strip() or key)[:24] if comment else key
        out[f"{const}.{key}"] = {"boss": bname, "skill": skill, "label": label, "hint": comment}
ts = "// 자동 생성 파일(tools/gen_boss_labels.py): 보스 수치 조정 이름표. 직접 고치지 말고 스크립트를 다시 돌린다.\nexport const BOSS_LABELS: Record<string, { boss: string; skill: string; label: string; hint: string }> = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n"
(root / "shared/src/bosslabels.ts").write_text(ts)
print(len(out), "개")
