import { KEY_TO_LANE, INPUT_BUFFER_MS, type Lane } from "../types/game";

export interface BufferedInput {
  lane: Lane;
  time: number; // songTime in ms
}

export type InputCallback = (lane: Lane, pressed: boolean) => void;

export class InputManager {
  private heldKeys = new Set<Lane>();
  private buffer: BufferedInput[] = [];
  private callbacks: InputCallback[] = [];
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private getSongTime: () => number = () => 0;

  constructor() {
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  attach(getSongTime: () => number): void {
    this.getSongTime = getSongTime;
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
  }

  detach(): void {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    this.heldKeys.clear();
    this.buffer.length = 0;
  }

  onInput(cb: InputCallback): void {
    this.callbacks.push(cb);
  }

  isHeld(lane: Lane): boolean {
    return this.heldKeys.has(lane);
  }

  /** Drain buffered inputs that are within range of a note time */
  drainBuffer(noteTime: number): BufferedInput | null {
    for (let i = 0; i < this.buffer.length; i++) {
      const inp = this.buffer[i];
      if (Math.abs(inp.time - noteTime) <= INPUT_BUFFER_MS) {
        this.buffer.splice(i, 1);
        return inp;
      }
    }
    return null;
  }

  /** Remove stale buffered inputs older than cutoff */
  cleanBuffer(songTime: number): void {
    this.buffer = this.buffer.filter((b) => songTime - b.time < 300);
  }

  getBuffer(): BufferedInput[] {
    return this.buffer;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    const lane = KEY_TO_LANE[e.key];
    if (lane === undefined) return;

    e.preventDefault();
    this.heldKeys.add(lane);
    this.buffer.push({ lane, time: this.getSongTime() });

    for (const cb of this.callbacks) cb(lane, true);
  }

  private onKeyUp(e: KeyboardEvent): void {
    const lane = KEY_TO_LANE[e.key];
    if (lane === undefined) return;

    e.preventDefault();
    this.heldKeys.delete(lane);

    for (const cb of this.callbacks) cb(lane, false);
  }
}
