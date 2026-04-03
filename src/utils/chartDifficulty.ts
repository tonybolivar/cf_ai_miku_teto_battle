import type { Chart, Note, Lane, BotDifficulty } from "../types/game";

/**
 * Adjust a chart's note density based on difficulty.
 * - easy: thin out player notes (keep every other), remove 8th-note bursts
 * - medium: keep as-is
 * - hard: add extra 8th-note fills between player notes
 */
export function applyDifficulty(chart: Chart, difficulty: BotDifficulty): Chart {
  if (difficulty === "medium") return chart;

  const playerNotes = chart.notes.filter((n) => !n.isOpponent);
  const opponentNotes = chart.notes.filter((n) => n.isOpponent);

  let adjusted: Note[];

  if (difficulty === "easy") {
    adjusted = thinNotes(playerNotes);
  } else {
    adjusted = addFills(playerNotes, chart.bpm);
  }

  return { ...chart, notes: [...adjusted, ...opponentNotes] };
}

/** Easy: keep every other player note (preserve holds) */
function thinNotes(notes: Note[]): Note[] {
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  const result: Note[] = [];
  let skip = false;

  for (const note of sorted) {
    // Always keep hold notes
    if (note.duration > 0) {
      result.push(note);
      skip = false;
      continue;
    }
    if (skip) {
      skip = false;
      continue;
    }
    result.push(note);
    skip = true;
  }

  return result;
}

/** Hard: add 8th-note fills between existing player notes in the same lane */
function addFills(notes: Note[], bpm: number): Note[] {
  const beatMs = 60000 / bpm;
  const halfBeat = beatMs / 2;
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  const fills: Note[] = [];
  let fillId = 0;

  // Group notes by lane to find gaps
  const byLane = new Map<Lane, Note[]>();
  for (const note of sorted) {
    if (!byLane.has(note.lane)) byLane.set(note.lane, []);
    byLane.get(note.lane)!.push(note);
  }

  for (const [lane, laneNotes] of byLane) {
    for (let i = 0; i < laneNotes.length - 1; i++) {
      const curr = laneNotes[i];
      const next = laneNotes[i + 1];
      // Skip if current note is a hold (don't fill during holds)
      if (curr.duration > 0) continue;
      const gap = next.time - curr.time;
      // If there's roughly a full beat gap, add a half-beat fill
      if (gap >= beatMs * 0.9 && gap <= beatMs * 1.5) {
        fills.push({
          noteId: `f${fillId++}`,
          time: Math.round(curr.time + halfBeat),
          lane,
          duration: 0,
          isOpponent: false,
        });
      }
    }
  }

  return [...sorted, ...fills];
}
