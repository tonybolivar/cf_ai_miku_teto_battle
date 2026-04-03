import { useEffect, useState } from "react";
import { CHARACTER_COLORS, type Character } from "../types/game";

interface LeaderboardEntry {
  name: string;
  score: number;
  song: string;
  character: Character;
  timestamp: number;
}

interface LeaderboardScreenProps {
  onBack: () => void;
}

export default function LeaderboardScreen({ onBack }: LeaderboardScreenProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json() as Promise<{ entries?: LeaderboardEntry[] }>)
      .then((data) => {
        setEntries(data.entries || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      <h2 style={{ color: "#FFF", fontSize: "2rem", marginBottom: 40, letterSpacing: 4 }}>
        LEADERBOARD
      </h2>

      {loading ? (
        <p style={{ color: "#555" }}>Loading...</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "#555" }}>No scores yet. Be the first!</p>
      ) : (
        <div style={{ width: "100%", maxWidth: 600 }}>
          {/* Header */}
          <div style={{
            display: "grid", gridTemplateColumns: "40px 1fr 80px 100px",
            gap: 10, padding: "8px 16px", color: "#555", fontSize: "0.7rem",
          }}>
            <span>#</span>
            <span>NAME</span>
            <span>CHAR</span>
            <span style={{ textAlign: "right" }}>SCORE</span>
          </div>

          {/* Entries */}
          {entries.slice(0, 20).map((entry, i) => {
            const charColor = CHARACTER_COLORS[entry.character] || "#888";
            return (
              <div
                key={i}
                style={{
                  display: "grid", gridTemplateColumns: "40px 1fr 80px 100px",
                  gap: 10, padding: "10px 16px",
                  background: i % 2 === 0 ? "#0a0a0f" : "transparent",
                  borderRadius: 4,
                }}
              >
                <span style={{ color: i < 3 ? "#FFB800" : "#555" }}>{i + 1}</span>
                <span style={{ color: "#FFF" }}>{entry.name}</span>
                <span style={{ color: charColor, fontSize: "0.8rem" }}>
                  {entry.character?.toUpperCase()}
                </span>
                <span style={{ color: "#FFF", textAlign: "right" }}>
                  {String(entry.score).padStart(6, "0")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={onBack}
        style={{
          marginTop: 40, background: "none", border: "2px solid #333",
          borderRadius: 6, color: "#FFF", padding: "10px 24px",
          fontFamily: '"Noto Sans JP", sans-serif', cursor: "pointer", fontSize: "0.9rem",
        }}
      >
        &larr; BACK
      </button>
    </div>
  );
}
