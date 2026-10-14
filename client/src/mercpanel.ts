import { UNIT_COST, tierName, upgradeCost, type ClientMsg, type MercWire } from "@mercenary/shared";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export interface MercPanel {
  toggle(): void;
  isOpen(): boolean;
  show(visible: boolean): void;
  /** 매 프레임 호출해도 된다. 내용이 바뀌었을 때만 다시 그린다. */
  update(mercs: readonly MercWire[], myId: number, gold: number): void;
  /** 목록에서 가리키고 있는 용병(월드에서 강조 표시) */
  hovered(): number;
}

/** 내 용병 목록과 한 명씩 강화하는 패널(U). 게임은 멈추지 않는다. */
export function createMercPanel(opts: { send(m: ClientMsg): void; colors: readonly number[] }): MercPanel {
  const panel = $("mercPanel");
  const list = $("mercList");
  const title = $("mercTitle");
  let sig = "";
  let hover = -1;
  let visible = false;
  const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");

  return {
    toggle: () => panel.classList.toggle("open"),
    isOpen: () => panel.classList.contains("open"),
    show(v) {
      visible = v;
      if (!v) panel.classList.remove("open");
    },
    hovered: () => hover,
    update(mercs, myId, gold) {
      if (!visible || !panel.classList.contains("open")) return;
      const mine = mercs.filter((w) => w[5] === myId).sort((a, b) => a[4] - b[4] || b[15] - a[15] || a[0] - b[0]);
      const next = mine.map((w) => `${w[0]}:${w[15]}:${Math.ceil(w[3] / 5)}:${w[8] > 0 ? 1 : 0}:${gold >= (upgradeCost(w[4], w[15]) ?? Infinity) ? 1 : 0}`).join("|");
      if (next === sig) return;
      sig = next;
      title.textContent = `내 용병 ${mine.length}명 · 금화 ${gold}G`;
      list.replaceChildren();
      hover = -1;
      for (const w of mine) {
        const [id, , , hp, type, , , , respawn, maxHp, , , , , , tier] = w;
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
        nm.textContent = `${tierName(type, tier)} ${"★".repeat(tier)}`;
        const sub = document.createElement("div");
        sub.className = "stat";
        sub.textContent = respawn > 0 ? `쓰러짐 (${Math.ceil(respawn)}초)` : `HP ${Math.ceil(hp)}/${maxHp} · 통솔 ${UNIT_COST[type]}`;
        name.append(nm, sub);
        const btn = document.createElement("button");
        const cost = upgradeCost(type, tier);
        if (cost === null) {
          btn.textContent = "최고 단계";
          btn.disabled = true;
        } else {
          btn.textContent = `${tierName(type, tier + 1)} ${cost}G`;
          btn.disabled = gold < cost;
          btn.onclick = () => opts.send({ t: "upgrade", merc: id });
        }
        row.append(dot, name, btn);
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
