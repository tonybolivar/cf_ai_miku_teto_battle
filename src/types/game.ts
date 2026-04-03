// ── Note & Chart types ──

export type Lane = 0 | 1 | 2 | 3; // left, down, up, right

export interface Note {
  noteId: string;
  time: number;        // ms from song start
  lane: Lane;
  duration: number;    // ms; 0 = tap, >0 = hold
  isOpponent: boolean;
}

export interface Lyric {
  text: string;         // Japanese/original text
  translation: string;  // English translation
  time: number;         // ms from song start
  duration: number;     // ms display duration
}

export interface Chart {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  audioFile: string;   // path relative to /audio/
  chartOffset: number; // ms offset for calibration
  notes: Note[];
  lyrics: Lyric[];
}

// ── Ratings ──

export type Rating = "sick" | "good" | "bad" | "shit";
export type JudgeResult = Rating | "miss";

export interface HitWindow {
  rating: Rating;
  window: number; // ±ms
  points: number;
  healthDelta: number;
}

export const HIT_WINDOWS: HitWindow[] = [
  { rating: "sick", window: 45,  points: 350, healthDelta: 0.023 },
  { rating: "good", window: 90,  points: 200, healthDelta: 0.013 },
  { rating: "bad",  window: 135, points: 100, healthDelta: -0.005 },
  { rating: "shit", window: 166, points: 50,  healthDelta: -0.01 },
];

export const MISS_HEALTH_DELTA = -0.0475;
export const INPUT_BUFFER_MS = 50;

// ── Lane visuals ──

export const LANE_COLORS: Record<Lane, string> = {
  0: "#C24B99", // left  — purple/pink
  1: "#00FFFF", // down  — cyan
  2: "#12FA05", // up    — green
  3: "#F9393F", // right — red
};

export const LANE_NAMES: Record<Lane, string> = {
  0: "left",
  1: "down",
  2: "up",
  3: "right",
};

// Arrow rotation in degrees: base arrow points right (→), canvas rotates clockwise
export const LANE_ROTATIONS: Record<Lane, number> = {
  0: 180, // ←
  1: 90,  // ↓ (90° clockwise from right = down)
  2: 270, // ↑ (270° clockwise from right = up)
  3: 0,   // →
};

// ── Keyboard mappings ──

export const KEY_TO_LANE: Record<string, Lane> = {
  ArrowLeft: 0,  a: 0, A: 0,
  ArrowDown: 1,  s: 1, S: 1,
  ArrowUp: 2,    w: 2, W: 2,
  ArrowRight: 3, d: 3, D: 3,
};

// ── Game constants ──

export const SCROLL_SPEED = 0.6;      // pixels per ms
export const RECEPTOR_Y = 80;          // px from top of highway
export const HIGHWAY_WIDTH = 320;      // px per side (4 lanes)
export const LANE_WIDTH = 80;          // px per lane
export const NOTE_SIZE = 56;           // px arrow size
export const HIGHWAY_HEIGHT = 600;     // px
export const HIGHWAY_GAP = 40;         // px gap between opponent/player sides

// ── Rating popup styles ──

export const RATING_STYLES: Record<JudgeResult, { color: string; glow: string | null }> = {
  sick: { color: "#FFFFFF", glow: "#00FFFF" },
  good: { color: "#FFFFFF", glow: null },
  bad:  { color: "#FF8800", glow: null },
  shit: { color: "#FF2222", glow: null },
  miss: { color: "#FF0000", glow: null },
};

// ── Character colors ──

export const CHARACTER_COLORS = {
  miku: "#39C5BB",
  teto: "#E54451",
} as const;

export type Character = "miku" | "teto";
export type GameMode = "pvp" | "bot";
export type BotDifficulty = "easy" | "medium" | "hard";
