import { useState } from "react";
import type { Character } from "../types/game";

interface CharacterSelectProps {
  onSelect: (character: Character) => void;
}

const CHARACTERS: { id: Character; name: string; color: string; desc: string; portrait: string }[] = [
  { id: "miku", name: "HATSUNE MIKU", color: "#39C5BB", desc: "Virtual diva, 16 years old forever", portrait: "/assets/portrait_miku.png" },
  { id: "teto", name: "KASANE TETO", color: "#E54451", desc: "Chimera with twin drills, age 31", portrait: "/assets/portrait_teto.jpg" },
];

export default function CharacterSelect({ onSelect }: CharacterSelectProps) {
  const [hovered, setHovered] = useState<Character | null>(null);

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"Noto Sans JP", sans-serif',
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
              width: 280, height: 420, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: hovered === char.id ? `${char.color}15` : "#0a0a0f",
              border: `3px solid ${hovered === char.id ? char.color : "#333"}`,
              borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
              transform: hovered === char.id ? "scale(1.05)" : "scale(1)",
              fontFamily: '"Noto Sans JP", sans-serif',
            }}
          >
            {/* Character portrait */}
            <img
              src={char.portrait}
              alt={char.name}
              style={{
                width: 200, height: 240, marginBottom: 20,
                objectFit: "cover", objectPosition: "top",
                borderRadius: 8,
                border: `2px solid ${hovered === char.id ? char.color : char.color + "44"}`,
                transition: "border-color 0.2s",
              }}
            />

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
