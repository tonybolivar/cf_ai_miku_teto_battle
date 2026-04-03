import { useState } from "react";
import { SONG_LIST } from "../data/songs";
import type { Character, GameMode } from "../types/game";

interface SongSelectProps {
  playerCharacter: Character;
  mode: GameMode;
  onSelect: (songId: string) => void;
}

export default function SongSelect({ playerCharacter, mode, onSelect }: SongSelectProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const available = SONG_LIST.filter((song) => {
    if (song.requiresCharacter && song.requiresCharacter !== playerCharacter) return false;
    if (song.modes && !song.modes.includes(mode)) return false;
    return true;
  });

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      <h2 style={{ color: "#FFF", fontSize: "2rem", marginBottom: 50, letterSpacing: 4 }}>
        SELECT SONG
      </h2>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", maxWidth: 800 }}>
        {available.map((song) => (
          <button
            key={song.id}
            onClick={() => onSelect(song.id)}
            onMouseEnter={() => setHovered(song.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: 220, padding: 20, display: "flex", flexDirection: "column",
              alignItems: "flex-start", gap: 8,
              background: hovered === song.id ? "#111" : "#0a0a0f",
              border: `2px solid ${hovered === song.id ? song.color : "#222"}`,
              borderRadius: 8, cursor: "pointer",
              fontFamily: '"Noto Sans JP", sans-serif',
              transition: "all 0.15s",
            }}
          >
            <span style={{ color: song.color, fontSize: "1.1rem" }}>{song.title}</span>
            <span style={{ color: "#888", fontSize: "0.7rem" }}>{song.artist}</span>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <span style={{ color: "#555", fontSize: "0.65rem" }}>{song.bpm} BPM</span>
              <span style={{ color: song.difficultyColor, fontSize: "0.65rem" }}>{song.difficulty}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
