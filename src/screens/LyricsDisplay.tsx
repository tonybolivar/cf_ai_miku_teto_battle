import { useEffect, useRef, useState } from "react";
import type { Lyric } from "../types/game";

interface LyricsDisplayProps {
  lyrics: Lyric[];
  getSongTime: () => number;
  chartOffset: number;
}

interface ActiveLyric {
  lyric: Lyric;
  active: boolean;
}

export default function LyricsDisplay({ lyrics, getSongTime, chartOffset }: LyricsDisplayProps) {
  const [current, setCurrent] = useState<ActiveLyric | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    let running = true;

    const update = () => {
      if (!running) return;

      const songTime = getSongTime() + chartOffset;

      // Find the currently active lyric
      let found: ActiveLyric | null = null;
      for (const lyric of lyrics) {
        const start = lyric.time;
        const end = lyric.time + lyric.duration;

        if (songTime >= start - 100 && songTime <= end + 200) {
          const active = songTime >= start && songTime <= end;
          found = { lyric, active };
          break;
        }
      }

      setCurrent((prev) => {
        if (!found && !prev) return null;
        if (!found && prev) {
          // Fading out
          if (!prev.active) return null;
          return { ...prev, active: false };
        }
        return found;
      });

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [lyrics, getSongTime, chartOffset]);

  if (!current) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        textAlign: "center",
        pointerEvents: "none",
        zIndex: 3,
        opacity: current.active ? 1 : 0,
        transition: current.active
          ? "opacity 100ms ease-in"
          : "opacity 200ms ease-out",
      }}
    >
      {/* Japanese text */}
      <div style={{
        fontFamily: '"Noto Sans JP", "VCR OSD Mono", sans-serif',
        fontSize: "1.6rem",
        color: "#FFF",
        textShadow: "0 0 10px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.9)",
        marginBottom: 6,
        letterSpacing: 2,
      }}>
        {current.lyric.text}
      </div>

      {/* English translation */}
      <div style={{
        fontFamily: '"VCR OSD Mono", monospace',
        fontSize: "0.9rem",
        color: "#AAA",
        textShadow: "0 0 8px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.9)",
        letterSpacing: 1,
      }}>
        {current.lyric.translation}
      </div>
    </div>
  );
}
