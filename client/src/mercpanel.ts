import { nextTierBonus, unitCost, mercName, mercXpNeed, tierName, upgradeCost, type ClientMsg, type MercWire } from "@mercenary/shared";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface MercPanel {
  toggle(): void;
  isOpen(): boolean;
  show(visible: boolean): void;
  /** 매 프레임 호출해도 된다. 내용이 바뀌었을 때만 다시 그린다. */
  update(mercs: readonly MercWire[], myId: number, gold: number, freeLeadership: number): void;
  /** 목록에서 가리키고 있는 용병(월드에서 강조 표시) */
  hovered(): number;
}

/** 강화할 수 있는 상태인가: 경험치를 다 채웠고 최고 단계가 아니다 */
export const isReady = (w: MercWire): boolean => w[8] <= 0 && w[15] < 4 && w[17] >= mercXpNeed(w[15]);

/** 내 용병 목록과 한 명씩 강화하는 패널(U). 경험치를 채운 용병만 강화 버튼이 뜬다. 게임은 멈추지 않는다. */
export function createMercPanel(opts: { send(m: ClientMsg): void; colors: readonly number[]; notify(text: string): void }): MercPanel {
  const panel = $("mercPanel");
  const list = $("mercList");
  const title = $("mercTitle");
  let sig = "";
  let hover = -1;
  let visible = false;
  let ready = new Set<number>();
  let first = true;
  const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");

  return {
    toggle: () => panel.classList.toggle("open"),
    isOpen: () => panel.classList.contains("open"),
    show(v) {
      visible = v;
      if (!v) {
        panel.classList.remove("open");
        first = true;
        ready = new Set();
      }
    },
    hovered: () => hover,
    update(mercs, myId, gold, freeLeadership) {
      if (!visible) return;
      const mine = mercs.filter((w) => w[5] === myId);
      // 경험치를 다 채운 용병이 새로 생기면 알려 준다
      const nowReady = new Set(mine.filter(isReady).map((w) => w[0]));
      if (!first) for (const w of mine) if (nowReady.has(w[0]) && !ready.has(w[0])) opts.notify(`${mercName(w[16])} 강화 가능! (U)`);
      ready = nowReady;
      first = false;
      if (!panel.classList.contains("open")) return;
      mine.sort((a, b) => Number(isReady(b)) - Number(isReady(a)) || a[4] - b[4] || b[15] - a[15] || a[0] - b[0]);
      const next = mine.map((w) => `${w[0]}:${w[15]}:${Math.ceil(w[3] / 5)}:${w[8] > 0 ? 1 : 0}:${w[17]}:${freeLeadership >= 1 ? 1 : 0}:${gold >= (upgradeCost(w[4], w[15]) ?? Infinity) ? 1 : 0}`).join("|");
      if (next === sig) return;
      sig = next;
      title.textContent = `내 용병 ${mine.length}명 · 금화 ${gold}G · 강화 가능 ${nowReady.size}`;
      list.replaceChildren();
      hover = -1;
      for (const w of mine) {
        const [id, , , hp, type, , , , respawn, maxHp, , , , , , tier, nameId, xp] = w;
        const row = document.createElement("div");
        row.className = "mrow";
        row.onmouseenter = () => (hover = id);
        row.onmouseleave = () => (hover = hover === id ? -1 : hover);
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = hex(opts.colors[type]!);
        const name = document.createElement("div");
        name.className = "grow";
        const nm = document.createElement("div");
        nm.textContent = `${mercName(nameId)} · ${tierName(type, tier)} ${"★".repeat(tier)}`;
        const sub = document.createElement("div");
        sub.className = "stat";
        sub.textContent = respawn > 0 ? `쓰러짐 (${Math.ceil(respawn)}초)` : `HP ${Math.ceil(hp)}/${maxHp} · 통솔 ${unitCost(type, tier)}`;
        name.append(nm, sub);
        const need = mercXpNeed(tier);
        if (Number.isFinite(need)) {
          const bar = document.createElement("div");
          bar.className = "xpbar";
          const fill = document.createElement("div");
          fill.style.width = `${Math.min(100, (100 * xp) / need)}%`;
          if (xp >= need) fill.className = "full";
          bar.append(fill);
          name.append(bar);
        }
        const bonus = nextTierBonus(type, tier);
        if (bonus.length > 0) {
          const b = document.createElement("div");
          b.className = "bonus";
          b.textContent = `강화 시: ${bonus.join(" · ")}`;
          name.append(b);
        }
        row.append(dot, name);
        const cost = upgradeCost(type, tier);
        if (cost === null) {
          const t = document.createElement("span");
          t.className = "stat";
          t.textContent = "최고 단계";
          row.append(t);
        } else if (xp >= need) {
          const btn = document.createElement("button");
          const noLeader = freeLeadership < 1;
          btn.textContent = `${tierName(type, tier + 1)} ${cost}G`;
          btn.title = noLeader ? "통솔력이 부족합니다 (강화하면 통솔력 +1)" : `강화하면 통솔력 +1 · ${bonus.join(" · ")}`;
          btn.className = "primary";
          btn.disabled = gold < cost || respawn > 0 || noLeader;
          btn.onclick = () => opts.send({ t: "upgrade", merc: id });
          row.append(btn);
        } else {
          const t = document.createElement("span");
          t.className = "stat";
          t.textContent = `경험치 ${xp}/${need}`;
          row.append(t);
        }
        list.append(row);
      }
      if (mine.length === 0) {
        const e = document.createElement("div");
        e.className = "empty";
        e.textContent = "용병이 없습니다. 캠프에서 고용하세요";
        list.append(e);
      }
    },
  };
}
