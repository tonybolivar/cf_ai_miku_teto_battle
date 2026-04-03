import { useState } from "react";
import type { GameMode, BotDifficulty } from "../types/game";

interface ModeSelectProps {
  onSelect: (mode: GameMode, difficulty: BotDifficulty | null) => void;
}

const DIFFICULTIES: { id: BotDifficulty; label: string; desc: string; color: string }[] = [
  { id: "easy",   label: "EASY",   desc: "60% accuracy, chill vibes", color: "#12FA05" },
  { id: "medium", label: "MEDIUM", desc: "85% accuracy, real challenge", color: "#FFB800" },
  { id: "hard",   label: "HARD",   desc: "97% accuracy, near-perfect", color: "#F9393F" },
];

export default function ModeSelect({ onSelect }: ModeSelectProps) {
  const [mode, setMode] = useState<GameMode | null>(null);

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      <h2 style={{ color: "#FFF", fontSize: "2rem", marginBottom: 50, letterSpacing: 4 }}>
        {mode === null ? "SELECT MODE" : "SELECT DIFFICULTY"}
      </h2>

      {mode === null ? (
        <div style={{ display: "flex", gap: 40 }}>
          <ModeButton
            label="VS BOT"
            desc="Play against AI opponent"
            color="#00FFFF"
            onClick={() => setMode("bot")}
          />
          <ModeButton
            label="PVP"
            desc="Battle a real player online"
            color="#C24B99"
            onClick={() => onSelect("pvp", null)}
          />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 30 }}>
          {DIFFICULTIES.map((d) => (
            <ModeButton
              key={d.id}
              label={d.label}
              desc={d.desc}
              color={d.color}
              onClick={() => onSelect("bot", d.id)}
            />
          ))}
        </div>
      )}

      {mode !== null && (
        <button
          onClick={() => setMode(null)}
          style={{
            marginTop: 40, background: "none", border: "none", color: "#555",
            cursor: "pointer", fontFamily: '"Noto Sans JP", sans-serif', fontSize: "0.9rem",
          }}
        >
          &larr; BACK
        </button>
      )}
    </div>
  );
}

function ModeButton({ label, desc, color, onClick }: {
  label: string; desc: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 200, padding: "30px 20px", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 12,
        background: "#0a0a0f", border: `2px solid ${color}44`, borderRadius: 8,
        cursor: "pointer", fontFamily: '"Noto Sans JP", sans-serif',
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.background = `${color}10`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${color}44`;
        e.currentTarget.style.background = "#0a0a0f";
      }}
    >
      <span style={{ color, fontSize: "1.4rem", letterSpacing: 3 }}>{label}</span>
      <span style={{ color: "#666", fontSize: "0.7rem" }}>{desc}</span>
    </button>
  );
}
