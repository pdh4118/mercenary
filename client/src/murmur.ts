import { INTENT, mercEpithet, mercGivenName, UNIT_NAMES } from "@mercenary/shared";

/**
 * 용병 혼잣말(림월드식): 상황이 바뀌거나 가끔 한가할 때, 머리 위에 한 줄이 잠깐 떴다 사라진다.
 * 진지한 말과 블랙코미디를 섞고, 이름의 수식어로 말투(과묵·수줍음·허세 등)를 조금 바꾼다. 내 용병만, 화면에서 가끔(용병마다 쿨타임).
 */

/** 문구 안의 {적}은 대상 병종(없으면 "저놈"), {이름}은 쓰러진 동료의 이름 */
const LINES: Record<string, string[]> = {
  chase: ["{적}부터 잡는다", "{적}… 거기 서라", "내 월급이 저기 달려 있다", "도망가면 더 피곤해지는 건 나다", "저쪽 {적}, 안됐지만 계약이라서"],
  attack: ["받아라!", "이 한 방에 월급을 걸었다", "급소는 늘 가까이에 있지", "미안하지만 일이라서", "끝내자"],
  charge: ["돌격! 퇴직금은 나중에", "살아 돌아오면 술 한 잔", "앞으로!", "죽기 전에 이기면 된다", "뒤는 안 돌아본다. 볼 게 없다"],
  kite: ["거리를 벌려야지", "가까이 오지 마, 알레르기 있어", "쏘고 빠지고, 쏘고 빠지고…", "근접전은 계약서에 없었다", "죽으면 쏠 수가 없다. 논리적이지"],
  danger: ["저건 맞으면 아프겠는데", "비켜, 비켜, 비켜!", "죽을 거면 의미 있게 죽을 거야", "오늘 운은 여기까지 쓰자", "예고가 친절해서 다행이군"],
  orderMove: ["알겠습니다", "가라니 간다", "도착하면 알려드리죠", "이동 중. 불평은 걸으면서 합니다"],
  orderAttack: ["명령 접수. 후회는 나중에", "누굴 치면 됩니까", "저쪽이군요, 말씀만 하시죠", "고용주의 뜻대로"],
  mark: ["{적}은 내가 전담한다", "{적}, 너 오늘 운이 없다", "내 눈은 이미 {적}에게 박혔다", "{적} 한 놈만 판다"],
  guard: ["여기는 내가 지킨다", "지키라니 지킵니다, 졸리지만", "한 발짝도 못 지나간다. 나도 못 간다"],
  idle: ["평화롭군… 불길하다", "심심해서 죽겠네. 아니, 죽는 건 아직", "아무도 안 오네. 고용주께 보고해야 하나", "오늘도 무사하다. 아직은", "일할 때가 제일 싫지만 안 할 때는 더 싫다", "저 구름, 어째 죽은 동료 얼굴 같네", "전쟁이 없으면 내 직업도 없다는 게 문제지"],
  back: ["대열로 돌아간다", "줄 맞추라는군", "집합 장소는 언제나 위험하다"],
  los: ["화살이 바위를 좋아하네", "각을 다시 잡자", "바위한테 쏘라고 돈 받은 게 아닌데"],
  high: ["높은 데가 좋더라", "여기서 보면 다 작아 보여", "고지대. 떨어지면 아프다"],
  fear: ["으아아아", "저건 계약서에 없었다!", "살려줘!", "나 아직 월급 안 썼어!"],
  evade: ["치고 빠진다", "한 방 먹이고 튄다", "맞기 전에 도망, 병법의 기본"],
  lowhp: ["아직 안 죽었어…", "이러다 월급도 못 받고 가겠네", "붕대 어디 있더라", "살아야 한다. 외상값이 남았다", "아프다. 아프다는 건 살아 있다는 뜻이다"],
  ignore: ["내 방식대로 한다", "말리지 마라", "안 한다고 했잖아. …한다", "명령은 참고만 하겠다", "그건 내 계획에 없다"],
  allyDown: ["{이름}… 편히 쉬어. 휴가는 아니다", "또 한 명 갔군. 인사팀에 알려야겠어", "죽지 마! …이미 죽었군", "{이름}, 장례비는 외상으로 하겠다", "이 일은 눈물이 나는 일이다. 그래도 일이다"],
  ready: ["슬슬 강해질 때가 됐지", "승급 면담을 신청합니다", "경험치가 월급보다 먼저 찼다", "강해지고 싶다. 얼마인지는 묻지 마라"],
  respawn: ["다시 왔다", "죽었다 살아났더니 허리가 아프다", "저승은 만석이더군", "방금 꿈에서 월급이 나왔다"],
};

/** 수식어별 말투: 해당 용병은 이 목록의 말을 섞어 쓴다(가끔은 이 말만) */
const TONE: Record<string, string[]> = {
  고집쎈: ["내 방식대로 한다", "말리지 마라", "안 한다고 했잖아. …한다", "명령서는 휴지가 아니다. 가끔은"],
  말없는: ["…", "……", "(끄덕)", "(침묵)"],
  수줍은: ["저, 저기…", "죄송합니다…", "아, 아니에요…", "저 때문은 아니죠…?"],
  용감한: ["두렵지 않다!", "더 와라!", "죽는 건 나중 일이다"],
  날쌘: ["잡을 테면 잡아 봐", "느려, 너무 느려", "바람보다 빨라야 월급이 나온다"],
  철벽: ["뚫리지 않는다", "내 방패는 월급보다 오래 간다", "움직이기 싫은 게 아니라 안 움직이는 거다"],
  늙은: ["이 짓도 이십 년째네", "허리야…", "내가 젊었을 땐 말이야"],
  행운의: ["오늘은 운이 좋을 것 같아", "동전 던졌는데 앞면이더라", "운도 실력이라더군"],
  떠돌이: ["어디든 일자리는 있지", "오늘은 이 깃발 아래다", "옮겨 다니는 게 취미라서"],
  굶주린: ["배고프다", "이기면 고기다", "전쟁보다 점심이 급하다"],
};

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;

export interface MurmurIn {
  id: number;
  type: number;
  nameId: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  down: boolean; // 쓰러져 있는가
  intent: number;
  arg: number;
  ready: boolean; // 강화 가능
}

interface S {
  intent: number;
  cd: number; // 다음에 말할 수 있는 시각(ms)
  lowHp: boolean;
  ready: boolean;
  down: boolean;
  idleSince: number;
  text: string;
  until: number;
}

const SHOW_MS = 2600;

export function createMurmur() {
  const st = new Map<number, S>();
  const downEvents: { x: number; y: number; at: number; name: string; id: number }[] = [];
  let active = 0; // 지금 떠 있는 말풍선 수(동시에 많이 뜨지 않게)

  const compose = (key: keyof typeof LINES, m: MurmurIn, extra?: { enemy?: string; name?: string }): string => {
    const tone = TONE[mercEpithet(m.nameId)];
    // 말투가 있는 용병은 가끔(과묵은 자주) 자기 말투로 말한다
    const toneChance = mercEpithet(m.nameId) === "말없는" ? 0.7 : 0.3;
    let s = tone && tone.length > 0 && Math.random() < toneChance && key !== "danger" && key !== "fear" ? pick(tone) : pick(LINES[key]!);
    s = s.replaceAll("{적}", extra?.enemy ?? "저놈").replaceAll("{이름}", extra?.name ?? "동료");
    return s;
  };

  return {
    /** 한 프레임에 한 번: 내 용병 전체를 보고 말할 때가 된 용병의 말을 정한다. 반환: 용병 번호 → 지금 보일 말과 투명도 */
    update(list: readonly MurmurIn[], now: number, cam: { x: number; y: number; r: number }): Map<number, { text: string; alpha: number }> {
      const out = new Map<number, { text: string; alpha: number }>();
      const seen = new Set<number>();
      // 새로 쓰러진 동료를 기록한다
      for (const m of list) {
        seen.add(m.id);
        let s = st.get(m.id);
        if (!s) {
          s = { intent: m.intent, cd: now + 4000 + Math.random() * 12000, lowHp: false, ready: m.ready, down: m.down, idleSince: now, text: "", until: 0 };
          st.set(m.id, s);
        }
        if (m.down && !s.down) downEvents.push({ x: m.x, y: m.y, at: now, name: mercGivenName(m.nameId), id: m.id });
      }
      while (downEvents.length > 0 && now - downEvents[0]!.at > 3000) downEvents.shift();
      active = 0;
      for (const s of st.values()) if (s.until > now) active++;

      for (const m of list) {
        const s = st.get(m.id)!;
        const wasIntent = s.intent;
        const wasDown = s.down;
        const wasReady = s.ready;
        s.intent = m.intent;
        s.down = m.down;
        s.ready = m.ready;
        if (m.down) {
          s.lowHp = false;
          continue;
        }
        const onScreen = Math.hypot(m.x - cam.x, m.y - cam.y) < cam.r;
        let key: keyof typeof LINES | null = null;
        let chance = 0;
        let extra: { enemy?: string; name?: string } | undefined;
        const enemy = m.arg >= 0 ? UNIT_NAMES[m.arg] : undefined;
        if (wasDown) {
          key = "respawn";
          chance = 0.8;
        } else if (m.maxHp > 0 && m.hp / m.maxHp < 0.3 && !s.lowHp) {
          s.lowHp = true;
          key = "lowhp";
          chance = 0.8;
        } else if (m.hp / Math.max(1, m.maxHp) > 0.6) s.lowHp = false;
        if (!key && m.ready && !wasReady) {
          key = "ready";
          chance = 0.7;
        }
        if (!key) {
          const ev = downEvents.find((d) => d.id !== m.id && Math.hypot(d.x - m.x, d.y - m.y) < 380 && now - d.at < 2500);
          if (ev && Math.random() < 0.03) {
            key = "allyDown"; // 프레임마다 굴리므로 확률은 작게(2.5초 동안 몇 번 기회)
            chance = 1;
            extra = { name: ev.name };
          }
        }
        if (!key && m.intent !== wasIntent) {
          s.idleSince = now;
          const map: Record<number, keyof typeof LINES> = {
            [INTENT.CHASE]: "chase", [INTENT.ATTACK]: "attack", [INTENT.CHARGE]: "charge", [INTENT.KITE]: "kite", [INTENT.DANGER]: "danger",
            [INTENT.ORDER_MOVE]: "orderMove", [INTENT.ORDER_ATTACK]: "orderAttack", [INTENT.MARK]: "mark", [INTENT.GUARD]: "guard",
            [INTENT.RETURN]: "back", [INTENT.IGNORE]: "ignore", [INTENT.LOS]: "los", [INTENT.HIGH]: "high", [INTENT.FEAR]: "fear", [INTENT.EVADE]: "evade",
          };
          key = map[m.intent] ?? null;
          chance = m.intent === INTENT.ATTACK ? 0.1 : m.intent === INTENT.FEAR || m.intent === INTENT.DANGER ? 0.45 : 0.3;
          extra = { enemy };
        } else if (!key && m.intent === INTENT.HOLD && now - s.idleSince > 14000) {
          s.idleSince = now;
          key = "idle";
          chance = 0.7;
        }
        if (key && onScreen && now >= s.cd && active < 3 && Math.random() < chance) {
          s.text = compose(key, m, extra);
          s.until = now + SHOW_MS;
          s.cd = now + 14000 + Math.random() * 16000; // 용병마다 14~30초에 한 번
          active++;
        }
        if (s.until > now && s.text) out.set(m.id, { text: s.text, alpha: Math.min(1, (s.until - now) / 400) });
      }
      for (const id of st.keys()) if (!seen.has(id)) st.delete(id);
      return out;
    },
  };
}
