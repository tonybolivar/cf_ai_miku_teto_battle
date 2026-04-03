import { useState } from "react";
import type { Character } from "../types/game";

interface CharacterSelectProps {
  onSelect: (character: Character) => void;
}

const CHARACTERS: { id: Character; name: string; color: string; desc: string }[] = [
  { id: "miku", name: "HATSUNE MIKU", color: "#39C5BB", desc: "Virtual diva, 16 years old forever" },
  { id: "teto", name: "KASANE TETO", color: "#E54451", desc: "Chimera with twin drills, age 31" },
];

export default function CharacterSelect({ onSelect }: CharacterSelectProps) {
  const [hovered, setHovered] = useState<Character | null>(null);

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"VCR OSD Mono", monospace',
    }}>
      <h2 style={{ color: "#FFF", fontSize: "2rem", marginBottom: 50, letterSpacing: 4 }}>
        CHOOSE YOUR FIGHTER
      </h2>

      <div style={{ display: "flex", gap: 60 }}>
        {CHARACTERS.map((char) => (
          <button
            key={char.id}
            onClick={() => onSelect(char.id)}
            onMouseEnter={() => setHovered(char.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: 260, height: 360, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: hovered === char.id ? `${char.color}15` : "#0a0a0f",
              border: `3px solid ${hovered === char.id ? char.color : "#333"}`,
              borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
              transform: hovered === char.id ? "scale(1.05)" : "scale(1)",
              fontFamily: '"VCR OSD Mono", monospace',
            }}
          >
            {/* Character placeholder */}
            <div style={{
              width: 120, height: 160, marginBottom: 20,
              background: `linear-gradient(135deg, ${char.color}33, ${char.color}11)`,
              border: `2px solid ${char.color}44`, borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "3rem", color: char.color,
            }}>
              {char.id === "miku" ? "M" : "T"}
            </div>

            <span style={{
              color: char.color, fontSize: "1.3rem", letterSpacing: 3, marginBottom: 8,
            }}>
              {char.name}
            </span>

            <span style={{ color: "#666", fontSize: "0.7rem", textAlign: "center", padding: "0 10px" }}>
              {char.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
