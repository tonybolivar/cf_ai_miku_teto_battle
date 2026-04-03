import { useEffect, useRef, useState, useCallback } from "react";
import { estimateClockOffset } from "../utils/clockSync";
import type { ServerMessage, ClientMessage } from "../types/protocol";

interface UseWebSocketResult {
  connected: boolean;
  clockOffset: number;
  lastMessage: ServerMessage | null;
  send: (msg: ClientMessage) => void;
  close: () => void;
}

export function useWebSocket(wsUrl: string | null): UseWebSocketResult {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);

  useEffect(() => {
    if (!wsUrl) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const fullUrl = `${protocol}//${window.location.host}${wsUrl}`;
    const ws = new WebSocket(fullUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      setConnected(true);

      // Estimate clock offset
      try {
        const offset = await estimateClockOffset(ws);
        setClockOffset(offset);
      } catch {
        setClockOffset(0);
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        // Filter out pong messages (handled by clockSync)
        if (msg.type !== "pong") {
          setLastMessage(msg);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [wsUrl]);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const close = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return { connected, clockOffset, lastMessage, send, close };
}
