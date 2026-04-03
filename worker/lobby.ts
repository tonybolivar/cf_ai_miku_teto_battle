import type { Env } from "./index";

type Phase = "waiting" | "countdown" | "playing" | "finished";
type PlayerSlot = "p1" | "p2";

interface PlayerState {
  character: "miku" | "teto";
  health: number;
  score: number;
  combo: number;
  misses: number;
  ready: boolean;
}

interface LobbyState {
  p1: PlayerState | null;
  p2: PlayerState | null;
  mode: "pvp" | "bot";
  botDifficulty: "easy" | "medium" | "hard" | null;
  songId: string;
  phase: Phase;
  startAt: number | null;
  createdAt: number;
  rematchRequests: PlayerSlot[];
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

const HEALTH_DELTAS: Record<string, number> = {
  sick: 0.023,
  good: 0.013,
  bad: -0.005,
  shit: -0.01,
};
const MISS_DELTA = -0.0475;

export class LobbyDO implements DurableObject {
  private state: LobbyState = {
    p1: null,
    p2: null,
    mode: "pvp",
    botDifficulty: null,
    songId: "",
    phase: "waiting",
    startAt: null,
    createdAt: Date.now(),
    rematchRequests: [],
  };

  private idleTimeout: ReturnType<typeof setTimeout> | null = null;
  private matchTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {
    // Restore state from storage on wake
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<LobbyState>("state");
      if (stored) this.state = stored;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request, url);
    }

    // REST endpoints for lobby management
    if (url.pathname.endsWith("/join") && request.method === "POST") {
      return this.handleJoin(request);
    }

    if (url.pathname.endsWith("/info")) {
      return Response.json({
        phase: this.state.phase,
        p1Connected: this.state.p1 !== null,
        p2Connected: this.state.p2 !== null,
        mode: this.state.mode,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleJoin(request: Request): Promise<Response> {
    if (this.state.p2 !== null) {
      return Response.json({ error: "Lobby is full" }, { status: 409 });
    }
    return Response.json({ ok: true });
  }

  private handleWebSocketUpgrade(request: Request, url: URL): Response {
    // Check max connections
    const existingWs = this.ctx.getWebSockets();
    if (existingWs.length >= 2) {
      return Response.json({ error: "Lobby full" }, { status: 409 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const slot: PlayerSlot = existingWs.length === 0 ? "p1" : "p2";
    const character = url.searchParams.get("character") as "miku" | "teto" || "miku";

    // Accept with hibernation API
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ slot, character });

    // Initialize player state
    const playerState: PlayerState = {
      character,
      health: 1.0,
      score: 0,
      combo: 0,
      misses: 0,
      ready: false,
    };

    if (slot === "p1") {
      this.state.p1 = playerState;
      this.state.songId = url.searchParams.get("songId") || "";
      this.state.mode = (url.searchParams.get("mode") as any) || "pvp";
      this.state.botDifficulty = url.searchParams.get("botDifficulty") as any || null;
    } else {
      this.state.p2 = playerState;
      // Notify both that opponent is connected
      this.sendTo("p1", { type: "opponent_joined" });
    }

    this.saveState();

    // Start idle timeout
    this.resetIdleTimeout();

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── WebSocket Hibernation API handlers ──

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    if (typeof data !== "string") return;

    let msg: any;
    try { msg = JSON.parse(data); } catch { return; }

    const attachment = ws.deserializeAttachment() as { slot: PlayerSlot; character: string };
    const slot = attachment.slot;

    switch (msg.type) {
      case "ping":
        ws.send(JSON.stringify({ type: "pong", t0: msg.t0, t1: Date.now() }));
        break;

      case "select_character": {
        const player = slot === "p1" ? this.state.p1 : this.state.p2;
        if (!player) break;
        const char = msg.character === "miku" || msg.character === "teto" ? msg.character : "miku";
        player.character = char as "miku" | "teto";
        const otherSlot: PlayerSlot = slot === "p1" ? "p2" : "p1";
        this.sendTo(otherSlot, { type: "opponent_character", character: char });
        this.saveState();
        break;
      }

      case "ready":
        this.handleReady(slot);
        break;

      case "hit":
        this.handleHit(slot, msg.noteId, msg.rating, msg.lane);
        break;

      case "miss":
        this.handleMiss(slot, msg.noteId, msg.lane);
        break;

      case "hold_end":
        // For now, treat completed holds like a SICK hit
        if (msg.completed) {
          this.handleHit(slot, msg.noteId, "sick", 0);
        }
        break;

      case "chat": {
        const text = String(msg.text ?? "").slice(0, 200);
        if (!text) break;
        const otherSlot: PlayerSlot = slot === "p1" ? "p2" : "p1";
        this.sendTo(otherSlot, { type: "chat", from: slot, text });
        break;
      }

      case "game_finished":
        if (this.state.phase === "playing") {
          const winner = (this.state.p1?.score ?? 0) >= (this.state.p2?.score ?? 0) ? "p1" : "p2";
          this.finishMatch(
            (this.state.p1?.score ?? 0) === (this.state.p2?.score ?? 0) ? "draw" : winner,
          );
        }
        break;

      case "rematch":
        this.handleRematch(slot);
        break;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const attachment = ws.deserializeAttachment() as { slot: PlayerSlot };

    if (this.state.phase === "playing") {
      // Opponent disconnected during game — other player wins
      const winner = attachment.slot === "p1" ? "p2" : "p1";
      this.finishMatch(winner);
    }

    if (attachment.slot === "p1") this.state.p1 = null;
    else this.state.p2 = null;

    this.saveState();
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    ws.close(1011, "WebSocket error");
  }

  // ── Game logic ──

  private handleReady(slot: PlayerSlot): void {
    const player = slot === "p1" ? this.state.p1 : this.state.p2;
    if (!player) return;
    player.ready = true;

    // Notify the other player
    const otherSlot = slot === "p1" ? "p2" : "p1";
    this.sendTo(otherSlot, { type: "opponent_ready" });

    // Check if both ready (or solo mode)
    const bothReady = this.state.p1?.ready && (this.state.p2?.ready || this.state.mode === "bot");

    if (bothReady && this.state.phase === "waiting") {
      this.state.phase = "countdown";
      this.state.startAt = Date.now() + 3000; // 3 second countdown

      this.broadcast({
        type: "start",
        songId: this.state.songId,
        startAt: this.state.startAt,
      });

      // Set match timeout (song length + 30s buffer)
      this.matchTimeout = setTimeout(() => {
        if (this.state.phase === "playing") {
          this.finishMatch("draw");
        }
      }, 5 * 60 * 1000); // 5 min max

      // Transition to playing after countdown
      setTimeout(() => {
        this.state.phase = "playing";
        this.saveState();
      }, 3000);
    }

    this.saveState();
  }

  private handleHit(slot: PlayerSlot, noteId: string, rating: string, lane: number): void {
    if (this.state.phase !== "playing") return;

    const player = slot === "p1" ? this.state.p1 : this.state.p2;
    const opponent = slot === "p1" ? this.state.p2 : this.state.p1;
    if (!player) return;

    const delta = HEALTH_DELTAS[rating] ?? 0;
    const points = { sick: 350, good: 200, bad: 100, shit: 50 }[rating] ?? 0;

    player.health = clamp(player.health + delta, 0, 2);
    player.score += points;
    player.combo++;

    if (opponent) {
      opponent.health = clamp(opponent.health - delta, 0, 2);
    }

    // Send health update to the hitter
    this.sendTo(slot, { type: "your_health", health: player.health });

    // Send opponent update to the other player
    const otherSlot = slot === "p1" ? "p2" : "p1";
    this.sendTo(otherSlot, {
      type: "opponent_update",
      health: player.health,
      score: player.score,
      combo: player.combo,
      lane,
      rating,
    });
    this.sendTo(otherSlot, { type: "opponent_sing", lane });

    // Check for KO
    if (player.health <= 0) {
      this.finishMatch(slot === "p1" ? "p2" : "p1");
    } else if (opponent && opponent.health <= 0) {
      this.finishMatch(slot);
    }

    this.saveState();
  }

  private handleMiss(slot: PlayerSlot, noteId: string, lane: number): void {
    if (this.state.phase !== "playing") return;

    const player = slot === "p1" ? this.state.p1 : this.state.p2;
    const opponent = slot === "p1" ? this.state.p2 : this.state.p1;
    if (!player) return;

    player.health = clamp(player.health + MISS_DELTA, 0, 2);
    player.combo = 0;
    player.misses++;

    if (opponent) {
      opponent.health = clamp(opponent.health - MISS_DELTA, 0, 2);
    }

    this.sendTo(slot, { type: "your_health", health: player.health });

    const otherSlot = slot === "p1" ? "p2" : "p1";
    this.sendTo(otherSlot, {
      type: "opponent_update",
      health: player.health,
      score: player.score,
      combo: 0,
      lane,
      rating: "miss",
    });

    if (player.health <= 0) {
      this.finishMatch(slot === "p1" ? "p2" : "p1");
    }

    this.saveState();
  }

  private finishMatch(winner: PlayerSlot | "draw"): void {
    if (this.state.phase === "finished") return;
    this.state.phase = "finished";
    this.state.rematchRequests = [];

    if (this.matchTimeout) clearTimeout(this.matchTimeout);

    this.broadcast({
      type: "finish",
      winner,
      p1Score: this.state.p1?.score ?? 0,
      p2Score: this.state.p2?.score ?? 0,
    });

    // Write to leaderboard (fire and forget)
    // TODO: ctx.waitUntil when KV is configured

    this.saveState();
  }

  private handleRematch(slot: PlayerSlot): void {
    if (this.state.phase !== "finished") return;
    if (this.state.rematchRequests.includes(slot)) return;

    this.state.rematchRequests.push(slot);
    // Tell both players the current count
    this.broadcast({ type: "rematch_update", count: this.state.rematchRequests.length });

    if (this.state.rematchRequests.length >= 2) {
      // Both want rematch — reset and restart
      const freshPlayer = (): PlayerState => ({
        character: "miku",
        health: 1.0,
        score: 0,
        combo: 0,
        misses: 0,
        ready: false,
      });

      if (this.state.p1) {
        const char = this.state.p1.character;
        this.state.p1 = { ...freshPlayer(), character: char };
      }
      if (this.state.p2) {
        const char = this.state.p2.character;
        this.state.p2 = { ...freshPlayer(), character: char };
      }

      this.state.rematchRequests = [];
      this.state.phase = "countdown";
      this.state.startAt = Date.now() + 3000;

      this.broadcast({
        type: "rematch_start",
        startAt: this.state.startAt,
      });

      setTimeout(() => {
        this.state.phase = "playing";
        this.saveState();
      }, 3000);
    }

    this.saveState();
  }

  // ── Helpers ──

  private broadcast(msg: object): void {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(data); } catch { /* socket may be closed */ }
    }
  }

  private sendTo(slot: PlayerSlot, msg: object): void {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const attachment = ws.deserializeAttachment() as { slot: PlayerSlot };
        if (attachment.slot === slot) ws.send(data);
      } catch { /* ignore */ }
    }
  }

  private saveState(): void {
    this.ctx.storage.put("state", this.state);
  }

  private resetIdleTimeout(): void {
    if (this.idleTimeout) clearTimeout(this.idleTimeout);
    this.idleTimeout = setTimeout(() => {
      if (this.state.phase === "waiting") {
        this.broadcast({ type: "finish", winner: "draw", p1Score: 0, p2Score: 0 });
        for (const ws of this.ctx.getWebSockets()) {
          ws.close(1000, "Idle timeout");
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
}
