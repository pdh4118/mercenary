import {
  MAX_PLAYERS,
  NAME_MAX_LENGTH,
  TICK_RATE,
  sanitizeInput,
  stepPlayer,
  type MoveInput,
  type PlayerState,
} from "@mercenary/shared";

interface Slot {
  state: PlayerState;
  input: MoveInput;
}

/** 서버가 전투를 계산하는 권위 있는 게임 상태. 네트워크와 무관하게 테스트할 수 있다. */
export class Game {
  tick = 0;
  private slots = new Map<number, Slot>();
  private nextId = 1;

  get isFull(): boolean {
    return this.slots.size >= MAX_PLAYERS;
  }

  addPlayer(name: string): number | null {
    if (this.isFull) return null;
    const id = this.nextId++;
    // 겹치지 않게 중앙 주변에 원형으로 배치
    const angle = (id * Math.PI * 2) / MAX_PLAYERS;
    const clean = name.trim().slice(0, NAME_MAX_LENGTH) || `용병단${id}`;
    this.slots.set(id, {
      state: { id, name: clean, x: Math.cos(angle) * 80, y: Math.sin(angle) * 80 },
      input: { dx: 0, dy: 0 },
    });
    return id;
  }

  removePlayer(id: number): void {
    this.slots.delete(id);
  }

  setInput(id: number, dx: unknown, dy: unknown): void {
    const slot = this.slots.get(id);
    if (slot) slot.input = sanitizeInput(dx, dy);
  }

  step(): void {
    const dt = 1 / TICK_RATE;
    for (const slot of this.slots.values()) stepPlayer(slot.state, slot.input, dt);
    this.tick++;
  }

  snapshot(): PlayerState[] {
    return [...this.slots.values()].map((s) => ({ ...s.state }));
  }
}
