import { useEffect, useRef, useState, useCallback } from "react";
import { GameLoop, type GameLoopConfig } from "../engine/GameLoop";
import { useGameState } from "../hooks/useGameState";
import { CHARACTER_COLORS, type Character, type Chart, type GameMode, type BotDifficulty } from "../types/game";
import { SONG_ASSETS } from "../data/songs";
import LyricsDisplay from "./LyricsDisplay";

interface GameScreenProps {
  chart: Chart;
  playerCharacter: Character;
  opponentCharacter: Character;
  mode?: GameMode;
  botDifficulty?: BotDifficulty;
  playerVrmUrl?: string;
  opponentVrmUrl?: string;
  playerStageUrl?: string;
  opponentStageUrl?: string;
  songId?: string;
  pvpInfo?: { ws: WebSocket; slot: "p1" | "p2"; clockOffset: number; startAt: number };
  onGameOver: (winner: "player" | "opponent" | "draw", playerScore: number, opponentScore: number, maxCombo: number, misses: number) => void;
}

export default function GameScreen({
  chart,
  playerCharacter,
  opponentCharacter,
  mode = "bot",
  botDifficulty = "medium",
  playerVrmUrl,
  opponentVrmUrl,
  playerStageUrl,
  opponentStageUrl,
  songId,
  pvpInfo,
  onGameOver,
}: GameScreenProps) {
  const noteCanvasRef = useRef<HTMLCanvasElement>(null);
  const vrmCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  const [phase, setPhase] = useState<"loading" | "countdown" | "playing">("loading");
  const [countdown, setCountdown] = useState(3);

  const assets = songId ? SONG_ASSETS[songId] : undefined;
  const bgVideo = assets?.backgroundVideo;
  const [error, setError] = useState<string | null>(null);
  const [quitProgress, setQuitProgress] = useState(0); // 0-100
  const quitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const snapshot = useGameState(gameLoopRef.current?.state ?? null);

  useEffect(() => {
    const noteCanvas = noteCanvasRef.current;
    const vrmCanvas = vrmCanvasRef.current;
    if (!noteCanvas || !vrmCanvas) return;

    // Size canvases to actual pixel dimensions (fixes stretching on HiDPI)
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    noteCanvas.width = w * dpr;
    noteCanvas.height = h * dpr;
    noteCanvas.style.width = w + "px";
    noteCanvas.style.height = h + "px";
    const noteCtx = noteCanvas.getContext("2d");
    if (noteCtx) noteCtx.scale(dpr, dpr);
    // VRM canvas size is set by the Three.js renderer (setSize handles DPR internally)
    vrmCanvas.style.width = w + "px";
    vrmCanvas.style.height = h + "px";

    // Parse dev tool query params
    const params = new URLSearchParams(window.location.search);
    const startAt = params.get("startAt") ? Number(params.get("startAt")) : undefined;
    const slowmo = params.get("slowmo") ? Number(params.get("slowmo")) : undefined;
    const showHitWindows = params.get("hitwindow") === "1";

    const config: GameLoopConfig = {
      noteCanvas,
      vrmCanvas,
      chart,
      playerCharacter,
      opponentCharacter,
      mode,
      botDifficulty: botDifficulty ?? "medium",
      startAt,
      slowmo,
      showHitWindows,
      playerVrmUrl,
      opponentVrmUrl,
      playerStageUrl,
      opponentStageUrl,
      songId,
      pvpWs: pvpInfo?.ws,
      pvpSlot: pvpInfo?.slot,
      pvpClockOffset: pvpInfo?.clockOffset,
      pvpStartAt: pvpInfo?.startAt,
      onGameOver: (winner) => {
        const state = loop.state;
        onGameOver(winner, state.score, state.opponentScore, state.maxCombo, state.misses);
      },
    };

    const loop = new GameLoop(config);
    gameLoopRef.current = loop;

    loop
      .init()
      .then(() => {
        // Resize VRM renderer to match window
        loop.vrm?.resize(w, h);
        // Everything loaded -- start countdown
        setPhase("countdown");
        setCountdown(3);
      })
      .catch((err) => {
        console.error("Game init failed:", err);
        setError(String(err));
      });

    // Close audio on hot reload / unmount
    const cleanup = () => {
      loop.stop();
      gameLoopRef.current = null;
    };
    window.addEventListener("beforeunload", cleanup);

    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, [chart, playerCharacter, opponentCharacter]);

  // Countdown timer: 3, 2, 1, GO! then start the game
  useEffect(() => {
    if (phase !== "countdown") return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 700);
      return () => clearTimeout(timer);
    }

    // "GO!" visible -- start everything after a beat
    const timer = setTimeout(() => {
      const loop = gameLoopRef.current;
      if (loop) {
        loop.start().then(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
          }
          setPhase("playing");
        }).catch((e) => {
          console.error("[GameScreen] start() failed:", e);
          setPhase("playing"); // show game anyway
        });
      } else {
        setPhase("playing");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  // Hold Backspace to quit
  useEffect(() => {
    if (phase !== "playing") return;

    const QUIT_DURATION = 1500; // ms to hold
    const TICK = 50;

    const onDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" || e.repeat) return;
      e.preventDefault();
      setQuitProgress(0);
      quitTimerRef.current = setInterval(() => {
        setQuitProgress((p) => {
          const next = p + (TICK / QUIT_DURATION) * 100;
          if (next >= 100) {
            // Quit
            if (quitTimerRef.current) clearInterval(quitTimerRef.current);
            const loop = gameLoopRef.current;
            if (loop) {
              loop.stop();
              onGameOver("opponent", loop.state.score, loop.state.opponentScore, loop.state.maxCombo, loop.state.misses);
            }
            return 100;
          }
          return next;
        });
      }, TICK);
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.key !== "Backspace") return;
      if (quitTimerRef.current) {
        clearInterval(quitTimerRef.current);
        quitTimerRef.current = null;
      }
      setQuitProgress(0);
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      if (quitTimerRef.current) clearInterval(quitTimerRef.current);
    };
  }, [phase, onGameOver]);

  const playerColor = CHARACTER_COLORS[playerCharacter];
  const opponentColor = CHARACTER_COLORS[opponentCharacter];

  // Health bar: opponent fills from left, player fills from right
  // Total health = 2.0; player's portion = snapshot.health / 2.0
  const playerPct = (snapshot.health / 2.0) * 100;

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000", overflow: "hidden" }}>
      {/* Background video (if song has one) */}
      {bgVideo && (
        <video
          ref={videoRef}
          src={bgVideo}
          muted
          playsInline
          preload="auto"
          style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            objectFit: "cover", zIndex: 0,
          }}
        />
      )}

      {/* Three.js VRM layer */}
      <canvas
        ref={vrmCanvasRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: bgVideo ? 1 : 0 }}
      />

      {/* Note highway canvas (foreground, transparent bg) */}
      <canvas
        ref={noteCanvasRef}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 2 }}
      />

      {/* Lyrics display */}
      {chart.lyrics.length > 0 && gameLoopRef.current && (
        <LyricsDisplay
          lyrics={chart.lyrics}
          getSongTime={() => gameLoopRef.current?.audio.getSongTime() ?? 0}
          chartOffset={chart.chartOffset}
        />
      )}

      {/* HUD overlay */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 5, padding: "10px 20px 15px", background: "linear-gradient(transparent, rgba(0,0,0,0.7) 30%)" }}>
        {/* Health bar */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          {/* Opponent icon */}
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: opponentColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: "bold", flexShrink: 0,
          }}>
            {opponentCharacter === "teto" ? "T" : "M"}
          </div>

          {/* Health bar container */}
          <div style={{
            flex: 1, height: 20, margin: "0 10px",
            background: "#222", borderRadius: 4, overflow: "hidden",
            border: "2px solid #444", position: "relative",
          }}>
            {/* Opponent portion (left side) */}
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${100 - playerPct}%`,
              background: `linear-gradient(90deg, ${opponentColor}cc, ${opponentColor}88)`,
              transition: "width 0.1s ease-out",
            }} />
            {/* Player portion (right side) */}
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 0,
              width: `${playerPct}%`,
              background: `linear-gradient(90deg, ${playerColor}88, ${playerColor}cc)`,
              transition: "width 0.1s ease-out",
            }} />
          </div>

          {/* Player icon */}
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: playerColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: "bold", flexShrink: 0,
          }}>
            {playerCharacter === "miku" ? "M" : "T"}
          </div>
        </div>

        {/* Score row */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 40,
          fontFamily: '"Noto Sans JP", sans-serif', fontSize: 16, color: "#FFF",
        }}>
          <span>SCORE: {String(snapshot.score).padStart(6, "0")}</span>
          <span>COMBO: {snapshot.combo}</span>
          <span>MISSES: {snapshot.misses}</span>
        </div>
      </div>

      {/* Quit overlay */}
      {quitProgress > 0 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          zIndex: 20, textAlign: "center",
        }}>
          <div style={{
            background: "rgba(0,0,0,0.85)", padding: "16px 32px", borderRadius: 10,
            border: "2px solid #F9393F44",
          }}>
            <p style={{ color: "#F9393F", fontSize: "1.2rem", marginBottom: 10 }}>
              Quitting... Hold Backspace
            </p>
            <div style={{
              width: 200, height: 6, background: "#333", borderRadius: 3, overflow: "hidden",
            }}>
              <div style={{
                width: `${quitProgress}%`, height: "100%", background: "#F9393F",
                transition: "width 50ms linear",
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {phase === "loading" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.9)",
          fontFamily: '"Noto Sans JP", sans-serif', fontSize: 24, color: "#FFF",
        }}>
          {error ? `Error: ${error}` : "Loading..."}
        </div>
      )}

      {/* Countdown overlay */}
      {phase === "countdown" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.6)",
          fontFamily: '"Noto Sans JP", sans-serif',
        }}>
          <span
            key={countdown}
            style={{
              fontSize: countdown > 0 ? "8rem" : "6rem",
              color: countdown > 0 ? "#FFF" : "#12FA05",
              fontWeight: "bold",
              textShadow: countdown === 0 ? "0 0 40px #12FA05" : "0 0 20px rgba(255,255,255,0.3)",
              animation: "countPop 0.4s ease-out",
            }}
          >
            {countdown > 0 ? countdown : "GO!"}
          </span>
          <style>{`
            @keyframes countPop {
              0% { transform: scale(2); opacity: 0; }
              50% { opacity: 1; }
              100% { transform: scale(1); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
