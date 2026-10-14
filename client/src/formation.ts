import {
  DEFAULT_PRESETS,
  FORMATION_NAME_MAX,
  FORMATION_SLOTS,
  UNIT_NAMES,
  UNIT_TYPES,
  ZONE_NAMES,
  defaultPresets,
  layoutFormation,
  sanitizeFormation,
  type ClientMsg,
  type FormationPreset,
} from "@mercenary/shared";

const KEY = "mercenary.formations";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

interface Saved {
  presets: FormationPreset[];
  active: number;
}

function load(): Saved {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as { presets?: unknown[]; active?: unknown } | null;
    if (raw && Array.isArray(raw.presets) && raw.presets.length === FORMATION_SLOTS) {
      const presets = raw.presets.map((p, i) => {
        const f = sanitizeFormation(p);
        const name = typeof (p as { name?: unknown })?.name === "string" ? (p as { name: string }).name.slice(0, FORMATION_NAME_MAX) : "";
        return f ? { name: name || DEFAULT_PRESETS[i]!.name, ...f } : { ...DEFAULT_PRESETS[i]!, zones: [...DEFAULT_PRESETS[i]!.zones] };
      });
      const active = typeof raw.active === "number" && raw.active >= 0 && raw.active < FORMATION_SLOTS ? raw.active : 0;
      return { presets, active };
    }
  } catch {
    /* 저장소를 못 쓰면 기본값으로 */
  }
  return { presets: defaultPresets(), active: 0 };
}

export interface FormationUi {
  isOpen(): boolean;
  toggle(): void;
  close(): void;
  /** F1~F4: 저장된 진형을 적용한다 */
  apply(slot: number): void;
  /** 방에 들어갔을 때 지금 고른 진형을 서버에 알린다 */
  resend(): void;
  show(visible: boolean): void;
}

/** 진형 저장·편집·빠른 적용. 저장은 이 브라우저(localStorage)에 하고, 서버에는 고른 진형만 보낸다. */
export function createFormationUi(opts: { send(m: ClientMsg): void; colors: readonly number[]; notify(text: string): void }): FormationUi {
  const saved = load();
  let editing = saved.active;
  const editor = $("formEditor");
  const bar = $("formBar");
  const canvas = $<HTMLCanvasElement>("formPreview");

  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      /* 저장 못 해도 이번 접속에서는 동작한다 */
    }
  };
  const sendActive = () => {
    const p = saved.presets[saved.active]!;
    opts.send({ t: "formation", zones: p.zones, spacing: p.spacing });
  };

  function renderBar(): void {
    bar.replaceChildren();
    saved.presets.forEach((p, i) => {
      const b = document.createElement("button");
      b.className = i === saved.active ? "active" : "";
      const key = document.createElement("b");
      key.textContent = `F${i + 1}`;
      b.append(key, p.name);
      b.onclick = () => apply(i);
      bar.append(b);
    });
    const edit = document.createElement("button");
    edit.textContent = "편성 (B)";
    edit.onclick = () => toggle();
    bar.append(edit);
  }

  function drawPreview(): void {
    const p = saved.presets[editing]!;
    const g = canvas.getContext("2d")!;
    g.clearRect(0, 0, canvas.width, canvas.height);
    const sample = [2, 3, 3, 4, 3];
    const units: { id: number; type: number }[] = [];
    let id = 1;
    for (const t of UNIT_TYPES) for (let i = 0; i < sample[t]!; i++) units.push({ id: id++, type: t });
    const lay = layoutFormation(units, p.zones, p.spacing);
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.45;
    const scale = 0.62;
    for (const u of units) {
      const [fwd, lat] = lay.get(u.id)!;
      g.beginPath();
      g.arc(cx - lat * scale, cy - fwd * scale, 6, 0, Math.PI * 2);
      g.fillStyle = "#" + opts.colors[u.type]!.toString(16).padStart(6, "0");
      g.fill();
    }
    g.beginPath();
    g.arc(cx, cy, 6, 0, Math.PI * 2);
    g.fillStyle = "#fff";
    g.fill();
    g.fillStyle = "#7d8496";
    g.font = "11px sans-serif";
    g.fillText("▲ 전방", 8, 14);
  }

  function renderEditor(): void {
    const p = saved.presets[editing]!;
    const tabs = $("formTabs");
    tabs.replaceChildren();
    saved.presets.forEach((q, i) => {
      const b = document.createElement("button");
      b.className = i === editing ? "active" : "";
      b.textContent = `${i + 1}. ${q.name}${i === saved.active ? " ✔" : ""}`;
      b.onclick = () => {
        editing = i;
        renderEditor();
      };
      tabs.append(b);
    });
    const name = $<HTMLInputElement>("formName");
    name.value = p.name;
    const units = $("formUnits");
    units.replaceChildren();
    for (const t of UNIT_TYPES) {
      const row = document.createElement("div");
      row.className = "unit";
      const sw = document.createElement("span");
      sw.className = "sw";
      sw.style.background = "#" + opts.colors[t]!.toString(16).padStart(6, "0");
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = UNIT_NAMES[t]!;
      const sel = document.createElement("select");
      ZONE_NAMES.forEach((z, zi) => sel.add(new Option(z, String(zi), false, p.zones[t] === zi)));
      sel.onchange = () => {
        p.zones[t] = Number(sel.value);
        changed();
      };
      row.append(sw, nm, sel);
      units.append(row);
    }
    const sp = $<HTMLInputElement>("formSpacing");
    sp.value = String(p.spacing);
    $("formSpacingVal").textContent = `x${p.spacing.toFixed(1)}`;
    drawPreview();
  }

  /** 편집한 내용을 저장하고, 지금 쓰고 있는 진형이면 바로 반영한다 */
  function changed(): void {
    persist();
    drawPreview();
    renderBar();
    if (editing === saved.active) sendActive();
  }

  function apply(slot: number): void {
    if (slot < 0 || slot >= FORMATION_SLOTS) return;
    saved.active = slot;
    persist();
    sendActive();
    renderBar();
    if (editor.classList.contains("open")) renderEditor();
    opts.notify(`진형: ${saved.presets[slot]!.name}`);
  }

  const toggle = () => {
    editor.classList.toggle("open");
    if (editor.classList.contains("open")) {
      editing = saved.active;
      renderEditor();
    }
  };

  $<HTMLInputElement>("formName").oninput = (e) => {
    saved.presets[editing]!.name = (e.target as HTMLInputElement).value.slice(0, FORMATION_NAME_MAX) || DEFAULT_PRESETS[editing]!.name;
    persist();
    renderBar();
    const tab = $("formTabs").children[editing] as HTMLElement | undefined;
    if (tab) tab.textContent = `${editing + 1}. ${saved.presets[editing]!.name}${editing === saved.active ? " ✔" : ""}`;
  };
  $<HTMLInputElement>("formSpacing").oninput = (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    saved.presets[editing]!.spacing = v;
    $("formSpacingVal").textContent = `x${v.toFixed(1)}`;
    changed();
  };
  $("formReset").onclick = () => {
    saved.presets[editing] = { ...DEFAULT_PRESETS[editing]!, zones: [...DEFAULT_PRESETS[editing]!.zones] };
    renderEditor();
    changed();
  };
  $("formUse").onclick = () => apply(editing);
  $("formClose").onclick = () => editor.classList.remove("open");

  renderBar();
  bar.style.display = "none";
  return {
    isOpen: () => editor.classList.contains("open"),
    toggle,
    close: () => editor.classList.remove("open"),
    apply,
    resend: sendActive,
    show: (v) => (bar.style.display = v ? "flex" : "none"),
  };
}
