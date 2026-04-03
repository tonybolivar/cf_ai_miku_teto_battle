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
      alignItems: "center", justifyContent: "flex-end",
      background: "url('/assets/title_bg.jpg') center/cover no-repeat #000",
      fontFamily: '"Noto Sans JP", sans-serif', position: "relative", overflow: "hidden",
    }}>
      {/* Dark gradient overlay -- keeps art visible at top, readable at bottom */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.9) 80%, #000 100%)",
      }} />

      {/* Content pinned to bottom */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", paddingBottom: 60 }}>
        {/* Character labels */}
        <div style={{ display: "flex", justifyContent: "center", gap: 40, marginBottom: 12 }}>
          <span style={{ color: "#39C5BB", fontSize: "1.6rem", fontWeight: 700, letterSpacing: 4, textShadow: "0 0 12px #39C5BB88, 0 2px 8px rgba(0,0,0,0.9)" }}>MIKU</span>
          <span style={{ color: "#ddd", fontSize: "1.4rem", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>vs</span>
          <span style={{ color: "#E54451", fontSize: "1.6rem", fontWeight: 700, letterSpacing: 4, textShadow: "0 0 12px #E5445188, 0 2px 8px rgba(0,0,0,0.9)" }}>TETO</span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: "4rem", letterSpacing: 6, lineHeight: 1,
          background: "linear-gradient(90deg, #39C5BB, #8B5CF6, #E54451)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          marginBottom: "2.5rem",
          filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.8))",
        }}>
          RHYTHM BATTLE
        </h1>

        {/* Start prompt */}
        <p style={{
          color: "#FFF", fontSize: "1.3rem", letterSpacing: 3,
          animation: "blink 1s step-end infinite",
          textShadow: "0 2px 8px rgba(0,0,0,0.8)",
        }}>
          PRESS ENTER
        </p>

        {/* Arrow hint */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 20, marginTop: 40, opacity: 0.4,
        }}>
          <span style={{ color: "#C24B99", fontSize: "1.8rem", textShadow: "0 0 6px #C24B99" }}>&larr;</span>
          <span style={{ color: "#00FFFF", fontSize: "1.8rem", textShadow: "0 0 6px #00FFFF" }}>&darr;</span>
          <span style={{ color: "#12FA05", fontSize: "1.8rem", textShadow: "0 0 6px #12FA05" }}>&uarr;</span>
          <span style={{ color: "#F9393F", fontSize: "1.8rem", textShadow: "0 0 6px #F9393F" }}>&rarr;</span>
        </div>
      </div>

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
