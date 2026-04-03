import { useState, useEffect, useRef } from "react";
import { estimateClockOffset } from "../utils/clockSync";
import { SONG_LIST } from "../data/songs";
import PvpChat from "../components/PvpChat";
import type { Character } from "../types/game";

interface LobbyScreenProps {
  onGameStart: (ws: WebSocket, slot: "p1" | "p2", playerCharacter: Character, opponentCharacter: Character, songId: string, clockOffset: number, startAt: number) => void;
  onCancel: () => void;
}

type Phase = "choose" | "joinInput" | "waitingForOpponent" | "charSelect" | "ready";

export default function LobbyScreen({ onGameStart, onCancel }: LobbyScreenProps) {
  const [phase, setPhase] = useState<Phase>("choose");
  const [lobbyCode, setLobbyCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [myChar, setMyChar] = useState<Character | null>(null);
  const [opponentChar, setOpponentChar] = useState<Character | null>(null);
  const [ready, setReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [selectedSong, setSelectedSong] = useState(SONG_LIST.filter((s) => !s.modes || s.modes.includes("pvp"))[0]?.id ?? "mesmerizer");

  const wsRef = useRef<WebSocket | null>(null);
  const clockOffsetRef = useRef(0);
  const slotRef = useRef<"p1" | "p2">("p1");
  const myCharRef = useRef<Character | null>(null);
  const opponentCharRef = useRef<Character | null>(null);

  const pvpSongs = SONG_LIST.filter((s) => !s.modes || s.modes.includes("pvp"));

  const connectWs = (wsUrl: string, slot: "p1" | "p2") => {
    slotRef.current = slot;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const fullUrl = `${protocol}//${window.location.host}${wsUrl}`;
    const ws = new WebSocket(fullUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      setConnected(true);
      try { clockOffsetRef.current = await estimateClockOffset(ws); } catch { /* ignore */ }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "opponent_joined") {
          setOpponentConnected(true);
          setPhase("charSelect");
        }
        if (msg.type === "opponent_character") {
          const char = (msg.character === "miku" || msg.character === "teto") ? msg.character as Character : "teto";
          setOpponentChar(char);
          opponentCharRef.current = char;
        }
        if (msg.type === "opponent_ready") setOpponentReady(true);
        if (msg.type === "start" && wsRef.current) {
          onGameStart(
            wsRef.current, slotRef.current,
            myCharRef.current ?? "miku", opponentCharRef.current ?? "teto",
            selectedSong, clockOffsetRef.current, msg.startAt,
          );
          wsRef.current = null;
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => setConnected(false);
  };

  useEffect(() => { return () => { wsRef.current?.close(); }; }, []);

  const handleCreate = async () => {
    try {
      const resp = await fetch("/api/lobby/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: selectedSong, character: "miku", mode: "pvp" }),
      });
      const data = (await resp.json()) as { lobbyCode: string; wsUrl: string };
      setLobbyCode(data.lobbyCode);
      setPhase("waitingForOpponent");
      connectWs(data.wsUrl, "p1");
    } catch { setError("Failed to create lobby"); }
  };

  const handleJoin = async () => {
    if (joinCode.length !== 6) return;
    try {
      const resp = await fetch(`/api/lobby/join/${joinCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character: "miku" }),
      });
      if (!resp.ok) { setError("Lobby not found or full"); return; }
      const data = (await resp.json()) as { wsUrl: string };
      setOpponentConnected(true);
      connectWs(data.wsUrl, "p2");
      setPhase("charSelect");
    } catch { setError("Failed to join lobby"); }
  };

  const handleCharPick = (char: Character) => {
    setMyChar(char);
    myCharRef.current = char;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "select_character", character: char }));
    }
  };

  const handleReady = () => {
    if (!myChar || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "ready" }));
    setReady(true);
    setPhase("ready");
  };

  const bothPicked = myChar !== null && opponentChar !== null;

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      {/* ── CREATE / JOIN ── */}
      {phase === "choose" && (
        <>
          <h2 style={{ color: "#FFF", fontSize: "1.8rem", marginBottom: 30, letterSpacing: 3 }}>
            PVP LOBBY
          </h2>

          {/* Song picker for host */}
          <div style={{ marginBottom: 30, textAlign: "center" }}>
            <p style={{ color: "#888", fontSize: "0.75rem", letterSpacing: 2, marginBottom: 10 }}>SONG</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {pvpSongs.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSong(s.id)}
                  style={{
                    padding: "8px 20px", borderRadius: 6,
                    background: selectedSong === s.id ? `${s.color}22` : "#111",
                    border: `2px solid ${selectedSong === s.id ? s.color : "#222"}`,
                    color: selectedSong === s.id ? s.color : "#666",
                    cursor: "pointer", fontSize: "0.85rem",
                    fontFamily: '"Noto Sans JP", sans-serif',
                  }}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 30 }}>
            <LobbyButton label="CREATE" desc="Host a new match" color="#00FFFF" onClick={handleCreate} />
            <LobbyButton label="JOIN" desc="Enter a lobby code" color="#C24B99" onClick={() => setPhase("joinInput")} />
          </div>
        </>
      )}

      {/* ── JOIN CODE INPUT ── */}
      {phase === "joinInput" && (
        <>
          <h2 style={{ color: "#FFF", fontSize: "1.8rem", marginBottom: 30, letterSpacing: 3 }}>JOIN LOBBY</h2>
          <input
            type="text" maxLength={6} value={joinCode} autoFocus
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="ENTER CODE"
            style={{
              fontSize: "2rem", letterSpacing: 8, textAlign: "center",
              padding: "16px 32px", background: "#111", border: "2px solid #333",
              borderRadius: 8, color: "#FFF", outline: "none", width: 280,
              fontFamily: '"Noto Sans JP", sans-serif',
            }}
          />
          <button onClick={handleJoin} disabled={joinCode.length !== 6}
            style={{
              marginTop: 20, padding: "12px 40px", fontSize: "1.1rem",
              background: joinCode.length === 6 ? "#C24B99" : "#333",
              border: "none", borderRadius: 6, color: "#FFF",
              cursor: joinCode.length === 6 ? "pointer" : "default",
              fontFamily: '"Noto Sans JP", sans-serif',
            }}>
            JOIN
          </button>
        </>
      )}

      {/* ── WAITING FOR OPPONENT ── */}
      {phase === "waitingForOpponent" && (
        <>
          <h2 style={{ color: "#FFF", fontSize: "1.8rem", marginBottom: 20, letterSpacing: 3 }}>
            WAITING FOR OPPONENT
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
          <p style={{ color: "#555", animation: "blink 1.5s step-end infinite" }}>Waiting for player 2...</p>
        </>
      )}

      {/* ── CHARACTER SELECT (both connected) ── */}
      {phase === "charSelect" && (
        <>
          <h2 style={{ color: "#FFF", fontSize: "1.6rem", marginBottom: 30, letterSpacing: 3 }}>
            CHOOSE YOUR FIGHTER
          </h2>

          {lobbyCode && (
            <div style={{ marginBottom: 20, color: "#00FFFF", fontSize: "0.8rem", letterSpacing: 4 }}>
              LOBBY: {lobbyCode}
            </div>
          )}

          <div style={{ display: "flex", gap: 60, marginBottom: 30 }}>
            {(["miku", "teto"] as Character[]).map((char) => {
              const isMine = myChar === char;
              const isTheirs = opponentChar === char;
              const color = char === "miku" ? "#39C5BB" : "#E54451";
              const name = char === "miku" ? "MIKU" : "TETO";
              const portrait = char === "miku" ? "/assets/portrait_miku.png" : "/assets/portrait_teto.jpg";

              return (
                <button
                  key={char}
                  onClick={() => handleCharPick(char)}
                  style={{
                    width: 180, padding: "20px 15px", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 10,
                    background: isMine ? `${color}15` : "#0a0a0f",
                    border: `3px solid ${isMine ? color : isTheirs ? "#FFB800" : "#222"}`,
                    borderRadius: 10, cursor: "pointer",
                    fontFamily: '"Noto Sans JP", sans-serif', transition: "all 0.15s",
                  }}
                >
                  <img src={portrait} alt={name} style={{
                    width: 120, height: 150, objectFit: "cover", objectPosition: "top",
                    borderRadius: 8, border: `2px solid ${isMine ? color : "#333"}`,
                  }} />
                  <span style={{ color, fontSize: "1.1rem", letterSpacing: 2 }}>{name}</span>
                  {isMine && <span style={{ color: "#12FA05", fontSize: "0.65rem" }}>YOUR PICK</span>}
                  {isTheirs && !isMine && <span style={{ color: "#FFB800", fontSize: "0.65rem" }}>OPPONENT</span>}
                  {isTheirs && isMine && <span style={{ color: "#FFB800", fontSize: "0.65rem" }}>MIRROR MATCH!</span>}
                </button>
              );
            })}
          </div>

          {/* Status */}
          <div style={{ display: "flex", gap: 30, marginBottom: 20, fontSize: "0.8rem" }}>
            <span style={{ color: myChar ? "#12FA05" : "#555" }}>You: {myChar?.toUpperCase() ?? "..."}</span>
            <span style={{ color: opponentChar ? "#FFB800" : "#555" }}>Opponent: {opponentChar?.toUpperCase() ?? "..."}</span>
          </div>

          {bothPicked && !ready && (
            <button onClick={handleReady} style={{
              padding: "16px 48px", fontSize: "1.4rem",
              background: "#12FA05", border: "none", borderRadius: 8,
              color: "#000", cursor: "pointer", fontWeight: "bold",
              fontFamily: '"Noto Sans JP", sans-serif',
            }}>
              READY!
            </button>
          )}

          {!bothPicked && myChar && (
            <p style={{ color: "#555", fontSize: "0.85rem", animation: "blink 1.5s step-end infinite" }}>
              Waiting for opponent to pick...
            </p>
          )}
        </>
      )}

      {/* ── READY PHASE ── */}
      {phase === "ready" && (
        <>
          <h2 style={{ color: "#12FA05", fontSize: "1.8rem", marginBottom: 20, letterSpacing: 3 }}>
            {opponentReady ? "STARTING..." : "WAITING FOR OPPONENT"}
          </h2>
          <div style={{ display: "flex", gap: 40, marginBottom: 30 }}>
            <StatusDot label="You" connected ready />
            <StatusDot label="Opponent" connected ready={opponentReady} />
          </div>
          {!opponentReady && (
            <p style={{ color: "#555", animation: "blink 1.5s step-end infinite" }}>
              Opponent readying up...
            </p>
          )}
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
          myCharacter={myChar ?? "miku"}
          opponentCharacter={opponentChar ?? "teto"}
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
    <button onClick={onClick} style={{
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
