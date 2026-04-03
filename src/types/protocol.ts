import type { Rating, Lane } from "./game";

// ── Client → Server ──

export type ClientMessage =
  | { type: "ping"; t0: number }
  | { type: "ready" }
  | { type: "hit"; noteId: string; rating: Rating; lane: Lane }
  | { type: "miss"; noteId: string; lane: Lane }
  | { type: "hold_end"; noteId: string; completed: boolean }
  | { type: "chat"; text: string };

// ── Server → Client ──

export type ServerMessage =
  | { type: "pong"; t0: number; t1: number }
  | { type: "opponent_joined" }
  | { type: "opponent_ready" }
  | { type: "start"; songId: string; startAt: number }
  | { type: "opponent_update"; health: number; score: number; combo: number; lane: Lane; rating: string }
  | { type: "your_health"; health: number }
  | { type: "opponent_sing"; lane: Lane }
  | { type: "finish"; winner: "p1" | "p2" | "draw"; p1Score: number; p2Score: number }
  | { type: "chat"; from: "p1" | "p2"; text: string };
