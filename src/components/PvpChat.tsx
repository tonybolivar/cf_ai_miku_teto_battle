import { useState, useEffect, useRef, useCallback } from "react";

interface ChatMessage {
  from: "me" | "them";
  text: string;
}

interface PvpChatProps {
  ws: WebSocket | null;
  myCharacter: string;
  opponentCharacter: string;
}

export default function PvpChat({ ws, myCharacter, opponentCharacter }: PvpChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!ws) return;

    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "chat") {
          setMessages((prev) => [...prev, { from: "them", text: msg.text }]);
          if (!openRef.current) setUnread((n) => n + 1);
        }
      } catch { /* ignore */ }
    };

    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, [ws]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setUnread(0);
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "chat", text }));
    setMessages((prev) => [...prev, { from: "me", text }]);
    setInput("");
  }, [input, ws]);

  const charLabel = (from: "me" | "them") =>
    from === "me" ? myCharacter.toUpperCase() : opponentCharacter.toUpperCase();

  const charColor = (from: "me" | "them") =>
    from === "me" ? "#39C5BB" : "#C24B99";

  if (!ws) return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, left: 20, zIndex: 9999,
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      {/* Chat panel */}
      {open && (
        <div style={{
          width: 300, height: 380, marginBottom: 10,
          background: "#0a0a0fee", border: "1px solid #222", borderRadius: 10,
          display: "flex", flexDirection: "column", overflow: "hidden",
          backdropFilter: "blur(8px)",
        }}>
          {/* Header */}
          <div style={{
            padding: "10px 14px", borderBottom: "1px solid #1a1a1f",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ color: "#888", fontSize: "0.75rem", letterSpacing: 2 }}>CHAT</span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none", border: "none", color: "#555",
                cursor: "pointer", fontSize: "1rem", padding: 0, lineHeight: 1,
              }}
            >
              x
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "10px 12px",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            {messages.length === 0 && (
              <p style={{ color: "#333", fontSize: "0.75rem", textAlign: "center", marginTop: 20 }}>
                Say something...
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.from === "me" ? "flex-end" : "flex-start",
                maxWidth: "80%",
              }}>
                <div style={{
                  fontSize: "0.6rem", color: charColor(msg.from),
                  marginBottom: 2, letterSpacing: 1,
                  textAlign: msg.from === "me" ? "right" : "left",
                }}>
                  {charLabel(msg.from)}
                </div>
                <div style={{
                  padding: "6px 10px", borderRadius: 8,
                  background: msg.from === "me" ? "#39C5BB18" : "#C24B9918",
                  border: `1px solid ${msg.from === "me" ? "#39C5BB33" : "#C24B9933"}`,
                  color: "#ddd", fontSize: "0.8rem", lineHeight: 1.4,
                  wordBreak: "break-word",
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "8px 10px", borderTop: "1px solid #1a1a1f",
            display: "flex", gap: 6,
          }}>
            <input
              type="text"
              maxLength={200}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type..."
              style={{
                flex: 1, padding: "8px 10px", background: "#111", border: "1px solid #222",
                borderRadius: 6, color: "#FFF", fontSize: "0.8rem", outline: "none",
                fontFamily: '"Noto Sans JP", sans-serif',
              }}
            />
            <button
              onClick={handleSend}
              style={{
                padding: "8px 14px", background: "#39C5BB", border: "none",
                borderRadius: 6, color: "#000", fontSize: "0.75rem",
                cursor: "pointer", fontWeight: "bold",
                fontFamily: '"Noto Sans JP", sans-serif',
              }}
            >
              SEND
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      {!open && (
        <button
          onClick={handleOpen}
          style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "#111", border: "2px solid #333",
            cursor: "pointer", position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#39C5BB")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#333")}
        >
          {/* Chat icon (speech bubble SVG) */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>

          {/* Unread badge */}
          {unread > 0 && (
            <div style={{
              position: "absolute", top: -4, right: -4,
              width: 20, height: 20, borderRadius: "50%",
              background: "#F9393F", color: "#FFF",
              fontSize: "0.65rem", fontWeight: "bold",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: '"Noto Sans JP", sans-serif',
            }}>
              {unread > 9 ? "9+" : unread}
            </div>
          )}
        </button>
      )}
    </div>
  );
}
