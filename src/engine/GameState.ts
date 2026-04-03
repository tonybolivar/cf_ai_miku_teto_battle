import type { JudgeResult } from "../types/game";

type EventType = "health" | "score" | "combo" | "rating" | "gameover";
type Listener = (data: any) => void;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export class GameState {
  // Player
  health = 1.0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  misses = 0;

  // Opponent
  opponentHealth = 1.0;
  opponentScore = 0;
  opponentCombo = 0;

  // Game phase
  finished = false;
  winner: "player" | "opponent" | "draw" | null = null;

  private listeners = new Map<EventType, Listener[]>();

  on(event: EventType, fn: Listener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
  }

  off(event: EventType, fn: Listener): void {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  private emit(event: EventType, data?: any): void {
    for (const fn of this.listeners.get(event) ?? []) fn(data);
  }

  applyPlayerHit(result: JudgeResult, points: number, healthDelta: number): void {
    if (this.finished) return;

    this.score += points;

    if (result === "miss") {
      this.combo = 0;
      this.misses++;
      this.health = clamp(this.health + healthDelta, 0, 2);
      this.opponentHealth = clamp(this.opponentHealth - healthDelta, 0, 2);
    } else {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.health = clamp(this.health + healthDelta, 0, 2);
      this.opponentHealth = clamp(this.opponentHealth - healthDelta, 0, 2);
    }

    this.emit("score", this.score);
    this.emit("combo", this.combo);
    this.emit("health", { player: this.health, opponent: this.opponentHealth });
    this.emit("rating", result);

    this.checkGameOver();
  }

  applyOpponentHit(result: JudgeResult, healthDelta: number, score: number, combo: number): void {
    if (this.finished) return;

    this.opponentScore = score;
    this.opponentCombo = combo;

    // Zero-sum: opponent's gain is player's loss
    this.opponentHealth = clamp(this.opponentHealth + healthDelta, 0, 2);
    this.health = clamp(this.health - healthDelta, 0, 2);

    this.emit("health", { player: this.health, opponent: this.opponentHealth });
    this.checkGameOver();
  }

  private checkGameOver(): void {
    if (this.finished) return;

    if (this.health <= 0) {
      this.health = 0;
      this.finished = true;
      this.winner = "opponent";
      this.emit("gameover", { winner: "opponent" });
    } else if (this.opponentHealth <= 0) {
      this.opponentHealth = 0;
      this.finished = true;
      this.winner = "player";
      this.emit("gameover", { winner: "player" });
    }
  }

  finishByTime(): void {
    if (this.finished) return;
    this.finished = true;

    if (this.health > this.opponentHealth) this.winner = "player";
    else if (this.opponentHealth > this.health) this.winner = "opponent";
    else this.winner = "draw";

    this.emit("gameover", { winner: this.winner });
  }

  reset(): void {
    this.health = 1.0;
    this.opponentHealth = 1.0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.misses = 0;
    this.opponentScore = 0;
    this.opponentCombo = 0;
    this.finished = false;
    this.winner = null;
  }
}
