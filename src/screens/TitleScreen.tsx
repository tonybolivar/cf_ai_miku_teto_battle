import { useState } from "react";

interface TitleScreenProps {
  onSingleplayer: () => void;
  onMultiplayer: () => void;
  onKiryuToggle?: (active: boolean) => void;
}

export default function TitleScreen({ onSingleplayer, onMultiplayer, onKiryuToggle }: TitleScreenProps) {
  const [kiryuMode, setKiryuMode] = useState(false);
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-end",
      background: "url('/assets/title_bg.jpg') center/cover no-repeat #000",
      fontFamily: '"Noto Sans JP", sans-serif', position: "relative", overflow: "hidden",
    }}>
      {/* Dark gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.9) 80%, #000 100%)",
      }} />

      {/* Content pinned to bottom */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", paddingBottom: 60 }}>
        {/* GIF */}
        <img src="/assets/title_gif.gif" alt="" style={{ width: 120, marginBottom: 16 }} />

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

        {/* Mode buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <button
            onClick={onSingleplayer}
            style={{
              padding: "16px 60px", fontSize: "1.3rem", letterSpacing: 4,
              background: "none", border: "2px solid #39C5BB88", borderRadius: 8,
              color: "#FFF", cursor: "pointer", fontFamily: '"Noto Sans JP", sans-serif',
              transition: "all 0.15s", textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#39C5BB"; e.currentTarget.style.background = "#39C5BB15"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#39C5BB88"; e.currentTarget.style.background = "none"; }}
          >
            SINGLEPLAYER
          </button>
          <button
            onClick={onMultiplayer}
            style={{
              padding: "14px 52px", fontSize: "1rem", letterSpacing: 3,
              background: "none", border: "2px solid #C24B9988", borderRadius: 8,
              color: "#aaa", cursor: "pointer", fontFamily: '"Noto Sans JP", sans-serif',
              transition: "all 0.15s", textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C24B99"; e.currentTarget.style.color = "#FFF"; e.currentTarget.style.background = "#C24B9915"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#C24B9988"; e.currentTarget.style.color = "#aaa"; e.currentTarget.style.background = "none"; }}
          >
            MULTIPLAYER
          </button>
        </div>

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

      {/* Secret Kiryu toggle — bottom right */}
      <button
        onClick={() => {
          setKiryuMode((prev) => {
            const next = !prev;
            onKiryuToggle?.(next);
            return next;
          });
        }}
        style={{
          position: "absolute", bottom: 16, right: 16, zIndex: 2,
          background: "none", border: "none", cursor: "pointer",
          fontSize: "1.2rem", opacity: kiryuMode ? 1 : 0.15,
          transition: "opacity 0.3s",
          filter: kiryuMode ? "drop-shadow(0 0 8px #FFD700)" : "none",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = kiryuMode ? "1" : "0.15"; }}
        title="Dragon of Dojima Mode"
      >
        {kiryuMode ? "🐉" : "🐲"}
      </button>

      {/* Kiryu mode banner */}
      {kiryuMode && (
        <div style={{
          position: "absolute", bottom: 48, right: 16, zIndex: 2,
          color: "#FFD700", fontSize: "0.7rem", letterSpacing: 2,
          textShadow: "0 0 8px #FFD700",
        }}>
          KIRYU MODE
        </div>
      )}
    </div>
  );
}
