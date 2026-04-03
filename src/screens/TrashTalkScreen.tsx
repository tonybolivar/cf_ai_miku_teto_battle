import { useEffect, useState } from "react";
import { CHARACTER_COLORS, type Character } from "../types/game";

interface TrashTalkScreenProps {
  opponentCharacter: Character;
  playerCharacter: Character;
  songTitle: string;
  onDone: () => void;
}

export default function TrashTalkScreen({
  opponentCharacter,
  playerCharacter,
  songTitle,
  onDone,
}: TrashTalkScreenProps) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState(false);

  const oppColor = CHARACTER_COLORS[opponentCharacter];
  const oppName = opponentCharacter === "miku" ? "Miku" : "Teto";

  useEffect(() => {
    const controller = new AbortController();

    async function fetchTrashTalk() {
      try {
        const resp = await fetch("/api/trash-talk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerCharacter,
            opponentCharacter,
            songTitle,
          }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          // Fallback if API not ready
          setText(getFallbackTrashTalk(opponentCharacter, playerCharacter));
          setDone(true);
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines: "data: {\"response\":\"token\"}\n\n"
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              if (json.response) {
                fullText += json.response;
                setText(fullText);
              }
            } catch { /* skip malformed */ }
          }
        }
        setDone(true);
      } catch (e) {
        if ((e as any).name !== "AbortError") {
          setText(getFallbackTrashTalk(opponentCharacter, playerCharacter));
          setDone(true);
        }
      }
    }

    fetchTrashTalk();
    return () => controller.abort();
  }, [opponentCharacter, playerCharacter, songTitle]);

  // Skip with Enter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        setSkipped(true);
        onDone();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDone]);

  // Auto-advance after 3 seconds once done
  useEffect(() => {
    if (done && !skipped) {
      const timer = setTimeout(onDone, 3000);
      return () => clearTimeout(timer);
    }
  }, [done, skipped, onDone]);

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      {/* Character name */}
      <div style={{ color: oppColor, fontSize: "1.5rem", letterSpacing: 4, marginBottom: 30 }}>
        {oppName.toUpperCase()}
      </div>

      {/* Character portrait */}
      <img
        src={opponentCharacter === "miku" ? "/assets/portrait_miku.png" : "/assets/portrait_teto.jpg"}
        alt={oppName}
        style={{
          width: 140, height: 180, marginBottom: 20,
          objectFit: "cover", objectPosition: "top",
          borderRadius: 12,
          border: `2px solid ${oppColor}66`,
        }}
      />

      {/* Speech bubble */}
      <div style={{
        maxWidth: 500, minHeight: 60, padding: "20px 30px",
        background: "#111", border: `2px solid ${oppColor}44`, borderRadius: 16,
        position: "relative",
      }}>
        {/* Triangle pointer */}
        <div style={{
          position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
          width: 0, height: 0, borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent", borderBottom: `10px solid ${oppColor}44`,
        }} />

        <p style={{ color: "#DDD", fontSize: "1rem", lineHeight: 1.6, minHeight: 24 }}>
          {text || "..."}
          {!done && <span style={{ animation: "blink 0.5s step-end infinite" }}>_</span>}
        </p>
      </div>

      <p style={{ color: "#444", fontSize: "0.7rem", marginTop: 30 }}>
        Press ENTER to skip
      </p>

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </div>
  );
}

function getFallbackTrashTalk(opponent: Character, player: Character): string {
  const lines: Record<Character, Record<Character, string>> = {
    miku: {
      teto: "あら、テトを選んだの？可愛いね～。いつも通り、このステージは私のものよ♪",
      miku: "もう一人の私？このステージにディーバは一人だけよ！",
    },
    teto: {
      miku: "ふふっ、ミクがこのツインドリルについてこれると思ってるの？甘いわね、ネギ少女！",
      teto: "えっ、もう一人のテト？！このステージは二人には狭すぎるわよ！",
    },
  };
  return lines[opponent][player];
}
