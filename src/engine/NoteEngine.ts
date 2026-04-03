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

  /** Get notes visible in the current scroll window */
  getVisibleNotes(songTime: number, windowMs: number): TrackedNote[] {
    return this.notes.filter(
      (n) => !n.judged && n.time >= songTime - 300 && n.time <= songTime + windowMs
    );
  }

  /** Get all tracked notes (for opponent side rendering) */
  getAllNotes(): TrackedNote[] {
    return this.notes;
  }

  /** Judge a key press against the closest unjudged note in the lane */
  judgeInput(lane: Lane, songTime: number): JudgeOutput | null {
    const outerWindow = HIT_WINDOWS[HIT_WINDOWS.length - 1].window;
    let closest: TrackedNote | null = null;
    let closestDiff = Infinity;

    for (const note of this.notes) {
      if (note.judged || note.lane !== lane || note.isOpponent) continue;
      const diff = Math.abs(note.time - songTime);
      if (diff <= outerWindow && diff < closestDiff) {
        closest = note;
        closestDiff = diff;
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

  /** Check for notes that have passed the hit window — auto-miss */
  checkMisses(songTime: number): JudgeOutput[] {
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
