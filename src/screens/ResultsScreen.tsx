import { useState } from "react";
import { CHARACTER_COLORS, type Character } from "../types/game";

interface ResultsScreenProps {
  winner: "player" | "opponent" | "draw";
  playerCharacter: Character;
  opponentCharacter: Character;
  playerScore: number;
  opponentScore: number;
  playerCombo: number;
  playerMisses: number;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
  onTitle: () => void;
}

export default function ResultsScreen({
  winner,
  playerCharacter,
  opponentCharacter,
  playerScore,
  opponentScore,
  playerCombo,
  playerMisses,
  onPlayAgain,
  onLeaderboard,
  onTitle,
}: ResultsScreenProps) {
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const winColor = winner === "player" ? "#12FA05" : winner === "opponent" ? "#F9393F" : "#FFB800";
  const winText = winner === "player" ? "YOU WIN!" : winner === "opponent" ? "YOU LOSE!" : "DRAW!";

  const handleSubmitScore = async () => {
    if (!name.trim() || submitted) return;
    try {
      await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), score: playerScore, song: "", character: playerCharacter }),
      });
    } catch { /* ignore */ }
    setSubmitted(true);
  };

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      {/* Winner banner */}
      <h1 style={{
        fontSize: "4rem", color: winColor, marginBottom: 10,
        textShadow: `0 0 30px ${winColor}66`,
        animation: "resultPop 0.5s ease-out",
      }}>
        {winText}
      </h1>

      {/* Scores side by side */}
      <div style={{ display: "flex", gap: 60, marginBottom: 40, marginTop: 20 }}>
        <ScoreCard
          label={playerCharacter.toUpperCase()}
          score={playerScore}
          color={CHARACTER_COLORS[playerCharacter]}
          highlight={winner === "player"}
        />
        <div style={{ color: "#333", fontSize: "2rem", alignSelf: "center" }}>vs</div>
        <ScoreCard
          label={opponentCharacter.toUpperCase()}
          score={opponentScore}
          color={CHARACTER_COLORS[opponentCharacter]}
          highlight={winner === "opponent"}
        />
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 30, marginBottom: 40, color: "#888", fontSize: "0.9rem" }}>
        <span>MAX COMBO: {playerCombo}</span>
        <span>MISSES: {playerMisses}</span>
      </div>

      {/* Leaderboard entry */}
      {!submitted ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 30 }}>
          <input
            type="text"
            maxLength={12}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmitScore()}
            placeholder="YOUR NAME"
            style={{
              padding: "10px 16px", background: "#111", border: "2px solid #333",
              borderRadius: 6, color: "#FFF", fontSize: "1rem",
              fontFamily: '"Noto Sans JP", sans-serif', outline: "none", width: 180,
            }}
          />
          <button
            onClick={handleSubmitScore}
            style={{
              padding: "10px 20px", background: "#39C5BB", border: "none",
              borderRadius: 6, color: "#000", fontSize: "0.9rem",
              fontFamily: '"Noto Sans JP", sans-serif', cursor: "pointer",
            }}
          >
            SUBMIT
          </button>
        </div>
      ) : (
        <p style={{ color: "#12FA05", marginBottom: 30 }}>Score submitted!</p>
      )}

      {/* Nav buttons */}
      <div style={{ display: "flex", gap: 20 }}>
        <NavButton label="PLAY AGAIN" onClick={onPlayAgain} />
        <NavButton label="LEADERBOARD" onClick={onLeaderboard} />
        <NavButton label="TITLE" onClick={onTitle} />
      </div>

      <style>{`
        @keyframes resultPop {
          0% { transform: scale(2); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ScoreCard({ label, score, color, highlight }: {
  label: string; score: number; color: string; highlight: boolean;
}) {
  return (
    <div style={{
      textAlign: "center", padding: "20px 30px",
      border: `2px solid ${highlight ? color : "#222"}`,
      borderRadius: 8, minWidth: 140,
    }}>
      <div style={{ color, fontSize: "1.1rem", letterSpacing: 2, marginBottom: 8 }}>{label}</div>
      <div style={{ color: "#FFF", fontSize: "2.5rem" }}>{String(score).padStart(6, "0")}</div>
    </div>
  );
}

function NavButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 24px", background: "none", border: "2px solid #333",
        borderRadius: 6, color: "#FFF", fontSize: "0.9rem",
        fontFamily: '"Noto Sans JP", sans-serif', cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#888")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#333")}
    >
      {label}
    </button>
  );
}
