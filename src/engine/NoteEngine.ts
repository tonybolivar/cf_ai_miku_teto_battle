import {
  HIT_WINDOWS,
  MISS_HEALTH_DELTA,
  type Note,
  type Lane,
  type JudgeResult,
  type HitWindow,
} from "../types/game";

export interface JudgeOutput {
  noteId: string;
  result: JudgeResult;
  points: number;
  healthDelta: number;
  lane: Lane;
}

interface TrackedNote extends Note {
  judged: boolean;
  holdActive: boolean;
  holdReleased: boolean;
}

export class NoteEngine {
  private notes: TrackedNote[] = [];
  private lastMissCheck = 0;

  loadChart(notes: Note[], playerSide: boolean): void {
    this.notes = notes
      .filter((n) => n.isOpponent !== playerSide)
      .map((n) => ({ ...n, judged: false, holdActive: false, holdReleased: false }));
    this.lastMissCheck = 0;
  }

  /** Get notes visible in the current scroll window (excludes active holds) */
  getVisibleNotes(songTime: number, windowMs: number): TrackedNote[] {
    return this.notes.filter(
      (n) => !n.judged && !n.holdActive && n.time >= songTime - 300 && n.time <= songTime + windowMs
    );
  }

  /** Get all tracked notes (for opponent side rendering) */
  getAllNotes(): TrackedNote[] {
    return this.notes;
  }

  /** Judge a key press against the closest unjudged note in the lane.
   *  Prefers hold notes over taps when both are within the window. */
  judgeInput(lane: Lane, songTime: number): JudgeOutput | null {
    const outerWindow = HIT_WINDOWS[HIT_WINDOWS.length - 1].window;
    let closest: TrackedNote | null = null;
    let closestDiff = Infinity;

    for (const note of this.notes) {
      if (note.judged || note.holdActive || note.lane !== lane || note.isOpponent) continue;
      const diff = Math.abs(note.time - songTime);
      if (diff <= outerWindow && diff < closestDiff) {
        // Prefer hold notes: if we already found a tap and this is a hold at similar time, pick the hold
        if (closest && closest.duration === 0 && note.duration > 0 && Math.abs(diff - closestDiff) < 50) {
          closest = note;
          closestDiff = diff;
        } else if (diff < closestDiff) {
          closest = note;
          closestDiff = diff;
        }
      }
    }

    if (!closest) return null;

    closest.judged = true;

    // Find the tightest matching window
    for (const hw of HIT_WINDOWS) {
      if (closestDiff <= hw.window) {
        // Start hold tracking if this is a hold note
        if (closest.duration > 0) {
          closest.judged = false; // keep alive for hold tracking
          closest.holdActive = true;
        }
        return {
          noteId: closest.noteId,
          result: hw.rating,
          points: hw.points,
          healthDelta: hw.healthDelta,
          lane,
        };
      }
    }

    // Outside all windows but within outer — SHIT
    if (closest.duration > 0) {
      closest.judged = false;
      closest.holdActive = true;
    }
    return {
      noteId: closest.noteId,
      result: "shit",
      points: 50,
      healthDelta: -0.01,
      lane,
    };
  }

  /** Check for notes that have passed the hit window — auto-miss.
   *  Skips hold notes in lanes where the key is currently held. */
  checkMisses(songTime: number, heldLanes?: Set<Lane>): JudgeOutput[] {
    const outerWindow = HIT_WINDOWS[HIT_WINDOWS.length - 1].window;
    const misses: JudgeOutput[] = [];

    // Find lanes with active holds — don't auto-miss upcoming notes in those lanes
    const holdLanes = new Set<Lane>();
    for (const note of this.notes) {
      if (note.holdActive) holdLanes.add(note.lane);
    }

    for (const note of this.notes) {
      if (note.judged || note.isOpponent || note.holdActive) continue;
      if (holdLanes.has(note.lane)) continue;
      // Don't auto-miss hold notes while the player is holding that key
      if (note.duration > 0 && heldLanes?.has(note.lane)) {
        // Only miss if the entire hold has passed
        if (songTime <= note.time + note.duration) continue;
      }
      if (songTime - note.time > outerWindow) {
        note.judged = true;
        misses.push({
          noteId: note.noteId,
          result: "miss",
          points: 0,
          healthDelta: MISS_HEALTH_DELTA,
          lane: note.lane,
        });
      }
    }

    return misses;
  }

  /** Handle hold note release */
  releaseHold(lane: Lane, songTime: number): JudgeOutput | null {
    for (const note of this.notes) {
      if (!note.holdActive || note.lane !== lane) continue;

      note.holdActive = false;
      note.holdReleased = true;
      note.judged = true;

      const holdEnd = note.time + note.duration;
      const completed = songTime >= holdEnd - 50; // 50ms grace period

      if (completed) {
        return {
          noteId: note.noteId,
          result: "sick",
          points: 350,
          healthDelta: 0.023,
          lane,
        };
      }
      // Released early — no penalty, just stop scoring
      return null;
    }
    return null;
  }

  /** Auto-activate hold notes when the player is already holding the key.
   *  Window extends from the normal hit window through the entire hold duration. */
  autoActivateHolds(songTime: number, heldLanes: Set<Lane>): JudgeOutput[] {
    const outerWindow = HIT_WINDOWS[HIT_WINDOWS.length - 1].window;
    const activated: JudgeOutput[] = [];

    for (const note of this.notes) {
      if (note.judged || note.holdActive || note.isOpponent) continue;
      if (note.duration <= 0) continue;
      if (!heldLanes.has(note.lane)) continue;

      const holdEnd = note.time + note.duration;
      // Activate if: we're within the early hit window OR we've passed the start but the hold hasn't ended
      const early = note.time - songTime;
      const late = songTime - note.time;

      if (early <= outerWindow && songTime <= holdEnd) {
        note.holdActive = true;
        const diff = Math.abs(note.time - songTime);
        const rating = diff <= 45 ? "sick" : diff <= 90 ? "good" : diff <= 166 ? "bad" : "good";
        const points = { sick: 350, good: 200, bad: 100 }[rating] ?? 200;
        const delta = { sick: 0.023, good: 0.013, bad: -0.005 }[rating] ?? 0.013;
        activated.push({ noteId: note.noteId, result: rating, points, healthDelta: delta, lane: note.lane });
      }
    }

    return activated;
  }

  /** Auto-consume notes that fall within an active hold's duration,
   *  and auto-complete holds whose duration has fully elapsed. */
  consumeHeldNotes(songTime: number): JudgeOutput[] {
    const consumed: JudgeOutput[] = [];

    for (const hold of this.notes) {
      if (!hold.holdActive) continue;
      const holdEnd = hold.time + hold.duration;

      // Auto-consume overlapping TAP notes in the same lane (skip other holds)
      for (const note of this.notes) {
        if (note === hold || note.judged || note.isOpponent) continue;
        if (note.lane !== hold.lane) continue;
        if (note.duration > 0) continue; // Don't eat other holds — they activate independently
        if (note.time > hold.time && note.time <= holdEnd + 50 && songTime >= note.time) {
          note.judged = true;
          consumed.push({
            noteId: note.noteId,
            result: "sick",
            points: 350,
            healthDelta: 0.023,
            lane: note.lane,
          });
        }
      }

      // Auto-complete hold when its duration has elapsed (player still holding)
      if (songTime >= holdEnd) {
        hold.holdActive = false;
        hold.holdReleased = true;
        hold.judged = true;
        consumed.push({
          noteId: hold.noteId,
          result: "sick",
          points: 350,
          healthDelta: 0.023,
          lane: hold.lane,
        });
      }
    }

    return consumed;
  }

  /** Get active hold notes for rendering hold tails */
  getActiveHolds(): TrackedNote[] {
    return this.notes.filter((n) => n.holdActive);
  }

  /** Check if song is complete (all player notes judged or passed) */
  isComplete(songTime: number): boolean {
    return this.notes.every(
      (n) => n.judged || n.isOpponent || songTime > n.time + (n.duration || 0) + 500
    );
  }
}
