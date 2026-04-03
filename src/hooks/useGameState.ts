import { useState, useEffect, useRef } from "react";
import type { GameState } from "../engine/GameState";

export interface GameStateSnapshot {
  health: number;
  opponentHealth: number;
  score: number;
  combo: number;
  maxCombo: number;
  misses: number;
  opponentScore: number;
  opponentCombo: number;
  finished: boolean;
  winner: "player" | "opponent" | "draw" | null;
}

export function useGameState(gameState: GameState | null): GameStateSnapshot {
  const [snapshot, setSnapshot] = useState<GameStateSnapshot>({
    health: 1,
    opponentHealth: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    misses: 0,
    opponentScore: 0,
    opponentCombo: 0,
    finished: false,
    winner: null,
  });

  const rafRef = useRef(0);

  useEffect(() => {
    if (!gameState) return;

    // Poll game state at 30fps for HUD updates (cheaper than 60fps)
    let running = true;
    const poll = () => {
      if (!running) return;
      setSnapshot({
        health: gameState.health,
        opponentHealth: gameState.opponentHealth,
        score: gameState.score,
        combo: gameState.combo,
        maxCombo: gameState.maxCombo,
        misses: gameState.misses,
        opponentScore: gameState.opponentScore,
        opponentCombo: gameState.opponentCombo,
        finished: gameState.finished,
        winner: gameState.winner,
      });
      rafRef.current = requestAnimationFrame(poll);
    };

    // Use setTimeout at ~30fps instead of rAF to reduce overhead
    const intervalId = setInterval(() => {
      setSnapshot({
        health: gameState.health,
        opponentHealth: gameState.opponentHealth,
        score: gameState.score,
        combo: gameState.combo,
        maxCombo: gameState.maxCombo,
        misses: gameState.misses,
        opponentScore: gameState.opponentScore,
        opponentCombo: gameState.opponentCombo,
        finished: gameState.finished,
        winner: gameState.winner,
      });
    }, 33);

    return () => {
      running = false;
      clearInterval(intervalId);
      cancelAnimationFrame(rafRef.current);
    };
  }, [gameState]);

  return snapshot;
}
