import { useEffect } from "react";

interface TitleScreenProps {
  onStart: () => void;
}

export default function TitleScreen({ onStart }: TitleScreenProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") onStart();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStart]);

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"VCR OSD Mono", monospace', position: "relative", overflow: "hidden",
    }}>
      {/* Background gradient glow */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.3,
        background: "radial-gradient(ellipse at 30% 50%, #39C5BB33 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, #E5445133 0%, transparent 50%)",
      }} />

      {/* Scanline overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
      }} />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        {/* Character labels */}
        <div style={{ display: "flex", justifyContent: "center", gap: 60, marginBottom: 16 }}>
          <span style={{ color: "#39C5BB", fontSize: "1.5rem", letterSpacing: 4 }}>MIKU</span>
          <span style={{ color: "#666", fontSize: "1.5rem" }}>vs</span>
          <span style={{ color: "#E54451", fontSize: "1.5rem", letterSpacing: 4 }}>TETO</span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: "4rem", letterSpacing: 6, lineHeight: 1,
          background: "linear-gradient(90deg, #39C5BB, #8B5CF6, #E54451)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          textShadow: "none", marginBottom: "0.5rem",
        }}>
          RHYTHM BATTLE
        </h1>

        <p style={{ color: "#555", fontSize: "0.8rem", marginBottom: "4rem", letterSpacing: 2 }}>
          FRIDAY NIGHT FUNKIN' STYLE
        </p>

        {/* Start prompt */}
        <p style={{
          color: "#FFF", fontSize: "1.3rem", letterSpacing: 3,
          animation: "blink 1s step-end infinite",
        }}>
          PRESS ENTER
        </p>

        {/* Arrow hint */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 20, marginTop: 60, opacity: 0.3,
        }}>
          <span style={{ color: "#C24B99", fontSize: "1.8rem" }}>&larr;</span>
          <span style={{ color: "#00FFFF", fontSize: "1.8rem" }}>&darr;</span>
          <span style={{ color: "#12FA05", fontSize: "1.8rem" }}>&uarr;</span>
          <span style={{ color: "#F9393F", fontSize: "1.8rem" }}>&rarr;</span>
        </div>
      </div>

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
