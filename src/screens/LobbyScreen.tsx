import { useState, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import type { Character } from "../types/game";

interface LobbyScreenProps {
  playerCharacter: Character;
  songId: string;
  mode: "pvp" | "bot";
  botDifficulty?: string;
  onGameStart: (wsUrl: string) => void;
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
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { connected, lastMessage, send } = useWebSocket(wsUrl);

  // Listen for game start message
  useEffect(() => {
    if (lastMessage?.type === "start") {
      onGameStart(wsUrl!);
    }
  }, [lastMessage, wsUrl, onGameStart]);

  // Send ready when connected
  useEffect(() => {
    if (connected) {
      send({ type: "ready" });
    }
  }, [connected, send]);

  const handleCreate = async () => {
    try {
      const resp = await fetch("/api/lobby/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, character: playerCharacter, mode, botDifficulty }),
      });
      const data = (await resp.json()) as { lobbyCode: string; wsUrl: string };
      setLobbyCode(data.lobbyCode);
      setWsUrl(data.wsUrl);
      setSubscreen("create");
    } catch (e) {
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
      if (!resp.ok) {
        setError("Lobby not found or full");
        return;
      }
      const data = (await resp.json()) as { wsUrl: string };
      setWsUrl(data.wsUrl);
      setSubscreen("join");
    } catch {
      setError("Failed to join lobby");
    }
  };

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"VCR OSD Mono", monospace',
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

      {subscreen === "create" && (
        <>
          <h2 style={{ color: "#FFF", fontSize: "1.8rem", marginBottom: 20, letterSpacing: 3 }}>
            WAITING FOR OPPONENT
          </h2>
          <p style={{ color: "#888", fontSize: "0.9rem", marginBottom: 30 }}>
            Share this code:
          </p>
          <div style={{
            fontSize: "3rem", letterSpacing: 12, color: "#00FFFF",
            padding: "20px 40px", border: "3px solid #00FFFF33", borderRadius: 8,
          }}>
            {lobbyCode || "------"}
          </div>
          {connected && (
            <p style={{ color: "#12FA05", marginTop: 20, fontSize: "0.8rem" }}>Connected</p>
          )}
          <p style={{ color: "#555", marginTop: 20, animation: "blink 1.5s step-end infinite" }}>
            Waiting for player 2...
          </p>
        </>
      )}

      {subscreen === "join" && !wsUrl && (
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
              fontFamily: '"VCR OSD Mono", monospace',
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
              fontFamily: '"VCR OSD Mono", monospace',
            }}
          >
            JOIN
          </button>
        </>
      )}

      {subscreen === "join" && wsUrl && (
        <>
          <h2 style={{ color: "#FFF", fontSize: "1.8rem", letterSpacing: 3 }}>
            CONNECTED
          </h2>
          <p style={{ color: "#12FA05", marginTop: 20 }}>Waiting for host to start...</p>
        </>
      )}

      {error && <p style={{ color: "#F9393F", marginTop: 20 }}>{error}</p>}

      <button
        onClick={onCancel}
        style={{
          marginTop: 50, background: "none", border: "none", color: "#555",
          cursor: "pointer", fontFamily: '"VCR OSD Mono", monospace', fontSize: "0.9rem",
        }}
      >
        &larr; BACK
      </button>

      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
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
        cursor: "pointer", fontFamily: '"VCR OSD Mono", monospace',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${color}44`; }}
    >
      <span style={{ color, fontSize: "1.4rem", letterSpacing: 3 }}>{label}</span>
      <span style={{ color: "#666", fontSize: "0.7rem" }}>{desc}</span>
    </button>
  );
}
