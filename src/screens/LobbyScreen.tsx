import { useState, useEffect, useRef } from "react";
import { estimateClockOffset } from "../utils/clockSync";
import PvpChat from "../components/PvpChat";
import type { Character, GameMode } from "../types/game";

interface LobbyScreenProps {
  playerCharacter: Character;
  songId: string;
  mode: GameMode;
  botDifficulty?: string;
  onGameStart: (ws: WebSocket, slot: "p1" | "p2", clockOffset: number, startAt: number) => void;
  onCancel: () => void;
}

export default function LobbyScreen({
  playerCharacter,
  songId,
  mode,
  botDifficulty,
  onGameStart,
  onCancel,
}: LobbyScreenProps) {
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [subscreen, setSubscreen] = useState<"choose" | "create" | "join">("choose");
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const clockOffsetRef = useRef(0);
  const slotRef = useRef<"p1" | "p2">("p1");
  const gameStartedRef = useRef(false);

  const connectWs = (wsUrl: string, slot: "p1" | "p2") => {
    slotRef.current = slot;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const fullUrl = `${protocol}//${window.location.host}${wsUrl}`;
    const ws = new WebSocket(fullUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      setConnected(true);
      try {
        clockOffsetRef.current = await estimateClockOffset(ws);
      } catch { /* ignore */ }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "opponent_joined") setOpponentConnected(true);
        if (msg.type === "opponent_ready") setOpponentReady(true);
        if (msg.type === "start" && wsRef.current) {
          gameStartedRef.current = true;
          onGameStart(wsRef.current, slotRef.current, clockOffsetRef.current, msg.startAt);
          // Clear ref so cleanup doesn't close the handed-off WS
          wsRef.current = null;
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => setConnected(false);
  };

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  const handleCreate = async () => {
    try {
      const resp = await fetch("/api/lobby/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, character: playerCharacter, mode, botDifficulty }),
      });
      const data = (await resp.json()) as { lobbyCode: string; wsUrl: string };
      setLobbyCode(data.lobbyCode);
      setSubscreen("create");
      connectWs(data.wsUrl, "p1");
    } catch {
      setError("Failed to create lobby");
    }
  };

  const handleJoin = async () => {
    if (joinCode.length !== 6) return;
    try {
      const resp = await fetch(`/api/lobby/join/${joinCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: playerCharacter }),
      });
      if (!resp.ok) { setError("Lobby not found or full"); return; }
      const data = (await resp.json()) as { wsUrl: string };
      setSubscreen("join");
      setOpponentConnected(true);
      connectWs(data.wsUrl, "p2");
    } catch {
      setError("Failed to join lobby");
    }
  };

  const handleReady = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ready" }));
      setReady(true);
    }
  };

  const bothConnected = connected && opponentConnected;
  const waitingForOpponent = connected && !opponentConnected;

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      {subscreen === "choose" && (
        <>
          <h2 style={{ color: "#FFF", fontSize: "1.8rem", marginBottom: 40, letterSpacing: 3 }}>
            PVP LOBBY
          </h2>
          <div style={{ display: "flex", gap: 30 }}>
            <LobbyButton label="CREATE" desc="Host a new match" color="#00FFFF" onClick={handleCreate} />
            <LobbyButton label="JOIN" desc="Enter a lobby code" color="#C24B99" onClick={() => setSubscreen("join")} />
          </div>
        </>
      )}

      {(subscreen === "create" || (subscreen === "join" && connected)) && (
        <>
          <h2 style={{ color: "#FFF", fontSize: "1.8rem", marginBottom: 20, letterSpacing: 3 }}>
            {bothConnected ? "BOTH CONNECTED" : "WAITING FOR OPPONENT"}
          </h2>

          {lobbyCode && (
            <>
              <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: 15 }}>Share this code:</p>
              <div style={{
                fontSize: "3rem", letterSpacing: 12, color: "#00FFFF",
                padding: "15px 35px", border: "3px solid #00FFFF33", borderRadius: 8,
                marginBottom: 30, userSelect: "all",
              }}>
                {lobbyCode}
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 40, marginBottom: 30 }}>
            <StatusDot label="You" connected={connected} ready={ready} />
            <StatusDot label="Opponent" connected={opponentConnected} ready={opponentReady} />
          </div>

          {bothConnected && !ready && (
            <button
              onClick={handleReady}
              style={{
                padding: "16px 48px", fontSize: "1.4rem",
                background: "#12FA05", border: "none", borderRadius: 8,
                color: "#000", cursor: "pointer", fontWeight: "bold",
                fontFamily: '"Noto Sans JP", sans-serif',
              }}
            >
              READY!
            </button>
          )}

          {ready && !opponentReady && (
            <p style={{ color: "#12FA05", fontSize: "1.1rem", animation: "blink 1.5s step-end infinite" }}>
              Waiting for opponent to ready up...
            </p>
          )}

          {waitingForOpponent && (
            <p style={{ color: "#555", animation: "blink 1.5s step-end infinite" }}>
              Waiting for player 2...
            </p>
          )}
        </>
      )}

      {subscreen === "join" && !connected && (
        <>
          <h2 style={{ color: "#FFF", fontSize: "1.8rem", marginBottom: 30, letterSpacing: 3 }}>
            JOIN LOBBY
          </h2>
          <input
            type="text"
            maxLength={6}
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="ENTER CODE"
            autoFocus
            style={{
              fontSize: "2rem", letterSpacing: 8, textAlign: "center",
              padding: "16px 32px", background: "#111", border: "2px solid #333",
              borderRadius: 8, color: "#FFF", outline: "none", width: 280,
              fontFamily: '"Noto Sans JP", sans-serif',
            }}
          />
          <button
            onClick={handleJoin}
            disabled={joinCode.length !== 6}
            style={{
              marginTop: 20, padding: "12px 40px", fontSize: "1.1rem",
              background: joinCode.length === 6 ? "#C24B99" : "#333",
              border: "none", borderRadius: 6, color: "#FFF",
              cursor: joinCode.length === 6 ? "pointer" : "default",
              fontFamily: '"Noto Sans JP", sans-serif',
            }}
          >
            JOIN
          </button>
        </>
      )}

      {error && <p style={{ color: "#F9393F", marginTop: 20 }}>{error}</p>}

      <button
        onClick={() => { wsRef.current?.close(); onCancel(); }}
        style={{
          marginTop: 50, background: "none", border: "none", color: "#555",
          cursor: "pointer", fontFamily: '"Noto Sans JP", sans-serif', fontSize: "0.9rem",
        }}
      >
        &larr; BACK
      </button>

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>

      {connected && (
        <PvpChat
          ws={wsRef.current}
          myCharacter={playerCharacter}
          opponentCharacter={playerCharacter === "miku" ? "teto" : "miku"}
        />
      )}
    </div>
  );
}

function StatusDot({ label, connected, ready }: { label: string; connected: boolean; ready: boolean }) {
  const color = ready ? "#12FA05" : connected ? "#FFB800" : "#555";
  const status = ready ? "READY" : connected ? "CONNECTED" : "WAITING";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%", background: color,
        margin: "0 auto 8px", boxShadow: connected ? `0 0 10px ${color}` : "none",
      }} />
      <div style={{ color: "#FFF", fontSize: "0.9rem" }}>{label}</div>
      <div style={{ color, fontSize: "0.7rem" }}>{status}</div>
    </div>
  );
}

function LobbyButton({ label, desc, color, onClick }: {
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
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${color}44`; }}
    >
      <span style={{ color, fontSize: "1.4rem", letterSpacing: 3 }}>{label}</span>
      <span style={{ color: "#666", fontSize: "0.7rem" }}>{desc}</span>
    </button>
  );
}
