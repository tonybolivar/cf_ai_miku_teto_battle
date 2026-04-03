#!/usr/bin/env npx tsx
/**
 * Converts .osu beatmap files to the game's Chart JSON format.
 *
 * Usage: npx tsx tools/osu_to_chart.ts <input.osu> <output.json> [--song-id <id>]
 *
 * Expects osu!mania 4K maps. Maps hit columns 0-3 to lanes left/down/up/right.
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface OsuNote {
  time: number;
  column: number;
  endTime: number; // 0 for tap notes
}

function parseOsu(content: string): {
  title: string;
  artist: string;
  bpm: number;
  notes: OsuNote[];
} {
  const lines = content.split("\n").map((l) => l.trim());

  let title = "";
  let artist = "";
  let bpm = 120;
  const notes: OsuNote[] = [];
  let inHitObjects = false;
  let inTimingPoints = false;
  let circleSize = 4;

  for (const line of lines) {
    if (line === "[General]" || line === "[Metadata]" || line === "[Difficulty]") {
      inHitObjects = false;
      inTimingPoints = false;
    }
    if (line === "[TimingPoints]") {
      inTimingPoints = true;
      inHitObjects = false;
      continue;
    }
    if (line === "[HitObjects]") {
      inHitObjects = true;
      inTimingPoints = false;
      continue;
    }

    // Parse metadata
    if (line.startsWith("Title:")) title = line.slice(6).trim();
    if (line.startsWith("Artist:")) artist = line.slice(7).trim();
    if (line.startsWith("CircleSize:")) circleSize = parseFloat(line.split(":")[1]);

    // Parse first timing point for BPM
    if (inTimingPoints && line.includes(",")) {
      const parts = line.split(",");
      if (parts.length >= 2) {
        const beatLength = parseFloat(parts[1]);
        if (beatLength > 0) {
          bpm = Math.round(60000 / beatLength);
          inTimingPoints = false; // only need the first one
        }
      }
    }

    // Parse hit objects
    if (inHitObjects && line.includes(",")) {
      const parts = line.split(",");
      if (parts.length >= 5) {
        const x = parseInt(parts[0]);
        const time = parseInt(parts[2]);
        const type = parseInt(parts[3]);

        // Map x position to column (osu!mania)
        const columnWidth = 512 / circleSize;
        const column = Math.min(3, Math.floor(x / columnWidth));

        let endTime = 0;
        // Long note (type & 128)
        if (type & 128) {
          const extraParts = parts[5]?.split(":");
          if (extraParts?.[0]) {
            endTime = parseInt(extraParts[0]);
          }
        }

        notes.push({ time, column, endTime });
      }
    }
  }

  return { title, artist, bpm, notes };
}

function convert(inputPath: string, outputPath: string, songId?: string) {
  const content = fs.readFileSync(inputPath, "utf-8");
  const { title, artist, bpm, notes } = parseOsu(content);

  const id = songId || path.basename(inputPath, ".osu").toLowerCase().replace(/\s+/g, "_");

  // Map columns to lanes: 0=left, 1=down, 2=up, 3=right
  const laneMap = [0, 1, 2, 3] as const;

  // Split notes into player and opponent (alternate by time groups)
  const sortedNotes = [...notes].sort((a, b) => a.time - b.time);
  let noteId = 0;

  const chartNotes = sortedNotes.map((n, i) => ({
    noteId: `n${noteId++}`,
    time: n.time,
    lane: laneMap[n.column] ?? 0,
    duration: n.endTime > 0 ? n.endTime - n.time : 0,
    isOpponent: i % 3 === 0, // every 3rd note to opponent
  }));

  const chart = {
    id,
    title,
    artist,
    bpm,
    audioFile: `/audio/${id}.mp3`,
    chartOffset: 0,
    notes: chartNotes,
    lyrics: [],
  };

  fs.writeFileSync(outputPath, JSON.stringify(chart, null, 2));
  console.log(`Converted ${notes.length} notes → ${outputPath}`);
  console.log(`  Title: ${title}`);
  console.log(`  Artist: ${artist}`);
  console.log(`  BPM: ${bpm}`);
  console.log(`  Player notes: ${chartNotes.filter((n) => !n.isOpponent).length}`);
  console.log(`  Opponent notes: ${chartNotes.filter((n) => n.isOpponent).length}`);
}

// CLI
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: npx tsx tools/osu_to_chart.ts <input.osu> <output.json> [--song-id <id>]");
  process.exit(1);
}

const songIdIdx = args.indexOf("--song-id");
const songId = songIdIdx >= 0 ? args[songIdIdx + 1] : undefined;

convert(args[0], args[1], songId);
