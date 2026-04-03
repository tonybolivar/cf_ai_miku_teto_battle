import type { Note, Lane, BotDifficulty, Rating } from "../types/game";
import { HIT_WINDOWS } from "../types/game";

interface BotAction {
  noteId: string;
  time: number;     // when the bot "presses"
  lane: Lane;
  hit: boolean;     // whether the bot hits or misses
  rating: Rating;
}

const DIFFICULTY_CONFIG: Record<BotDifficulty, {
  hitRate: number;
  jitterMs: number;
  ratings: { weight: number; rating: Rating }[];
}> = {
  easy: {
    hitRate: 0.6,
    jitterMs: 80,
    ratings: [
      { weight: 1, rating: "good" },
    ],
  },
  medium: {
    hitRate: 0.85,
    jitterMs: 40,
    ratings: [
      { weight: 0.4, rating: "sick" },
      { weight: 0.6, rating: "good" },
    ],
  },
  hard: {
    hitRate: 0.97,
    jitterMs: 15,
    ratings: [
      { weight: 0.8, rating: "sick" },
      { weight: 0.15, rating: "good" },
      { weight: 0.05, rating: "bad" },
    ],
  },
};

/** Box-Muller Gaussian random number */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickRating(ratings: { weight: number; rating: Rating }[]): Rating {
  const r = Math.random();
  let cumulative = 0;
  for (const { weight, rating } of ratings) {
    cumulative += weight;
    if (r <= cumulative) return rating;
  }
  return ratings[ratings.length - 1].rating;
}

export class BotPlayer {
  private actions: BotAction[] = [];
  private actionIndex = 0;
  private difficulty: BotDifficulty;

  constructor(difficulty: BotDifficulty) {
    this.difficulty = difficulty;
  }

  /** Pre-compute all bot actions from opponent notes in the chart */
  loadChart(notes: Note[]): void {
    const config = DIFFICULTY_CONFIG[this.difficulty];
    this.actions = [];
    this.actionIndex = 0;

    const opponentNotes = notes.filter((n) => n.isOpponent);

    for (const note of opponentNotes) {
      const hit = Math.random() < config.hitRate;

      if (hit) {
        const jitter = gaussianRandom() * config.jitterMs;
        const rating = pickRating(config.ratings);
        this.actions.push({
          noteId: note.noteId,
          time: note.time + jitter,
          lane: note.lane,
          hit: true,
          rating,
        });
      } else {
        // Bot misses this note
        this.actions.push({
          noteId: note.noteId,
          time: note.time,
          lane: note.lane,
          hit: false,
          rating: "good", // unused for misses
        });
      }
    }

    // Sort by time
    this.actions.sort((a, b) => a.time - b.time);
  }

  /** Get bot actions that should fire at the current song time */
  getActions(songTime: number): BotAction[] {
    const fired: BotAction[] = [];

    while (this.actionIndex < this.actions.length) {
      const action = this.actions[this.actionIndex];
      if (action.time <= songTime) {
        fired.push(action);
        this.actionIndex++;
      } else {
        break;
      }
    }

    return fired;
  }

  /** Get the health delta for a bot action */
  getHealthDelta(action: BotAction): number {
    if (!action.hit) return -0.0475; // miss

    const hw = HIT_WINDOWS.find((h) => h.rating === action.rating);
    return hw?.healthDelta ?? 0;
  }

  /** Get points for a bot action */
  getPoints(action: BotAction): number {
    if (!action.hit) return 0;
    const hw = HIT_WINDOWS.find((h) => h.rating === action.rating);
    return hw?.points ?? 0;
  }

  isComplete(): boolean {
    return this.actionIndex >= this.actions.length;
  }

  reset(): void {
    this.actionIndex = 0;
  }
}
