import { LobbyDO } from "./lobby";

export { LobbyDO };

export interface Env {
  ASSETS: Fetcher;
  LOBBY: DurableObjectNamespace;
  LEADERBOARD: KVNamespace;
  AI: Ai;
  LEADERBOARD_SECRET: string;
}

function generateLobbyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(url, request, env, ctx);
    }

    if (url.pathname.startsWith("/ws/")) {
      return handleWebSocket(url, request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleApi(
  url: URL,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  // CORS headers for all API responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (url.pathname === "/api/health") {
    return Response.json({ status: "ok", timestamp: Date.now() }, { headers: corsHeaders });
  }

  // Create lobby
  if (url.pathname === "/api/lobby/create" && request.method === "POST") {
    const body = (await request.json()) as {
      songId: string;
      character: string;
      mode: string;
      botDifficulty?: string;
    };

    const lobbyCode = generateLobbyCode();
    const lobbyId = env.LOBBY.idFromName(lobbyCode);

    // Verify the DO can be reached
    const stub = env.LOBBY.get(lobbyId);
    await stub.fetch(new Request(`https://lobby/${lobbyCode}/info`));

    const wsUrl = `/ws/lobby/${lobbyCode}?character=${body.character}&songId=${body.songId}&mode=${body.mode}${body.botDifficulty ? `&botDifficulty=${body.botDifficulty}` : ""}`;

    return Response.json({ lobbyCode, wsUrl }, { headers: corsHeaders });
  }

  // Join lobby
  if (url.pathname.startsWith("/api/lobby/join/") && request.method === "POST") {
    const code = url.pathname.split("/").pop()!;
    const body = (await request.json()) as { character: string };

    const lobbyId = env.LOBBY.idFromName(code);
    const stub = env.LOBBY.get(lobbyId);

    // Check if lobby exists and has space
    const infoResp = await stub.fetch(new Request(`https://lobby/${code}/info`));
    const info = (await infoResp.json()) as { p2Connected: boolean };

    if (info.p2Connected) {
      return Response.json({ error: "Lobby is full" }, { status: 409, headers: corsHeaders });
    }

    const wsUrl = `/ws/lobby/${code}?character=${body.character}`;
    return Response.json({ wsUrl }, { headers: corsHeaders });
  }

  // Trash talk (Workers AI)
  if (url.pathname === "/api/trash-talk" && request.method === "POST") {
    const body = (await request.json()) as {
      playerCharacter: string;
      opponentCharacter: string;
      songTitle: string;
    };

    // Check if AI binding exists
    if (!env.AI) {
      return new Response(getFallbackTrashTalk(body.opponentCharacter, body.playerCharacter), {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    try {
      const oppName = body.opponentCharacter === "miku" ? "Hatsune Miku" : "Kasane Teto";

      const systemPrompt = `You are ${oppName} from the Vocaloid universe.
Your opponent just picked ${body.playerCharacter} and challenged you to a rhythm battle on "${body.songTitle}".
Write one short trash talk line in Japanese, 1-2 sentences max.
Stay fully in character. Be playful and confident, not cruel.
Do not use quotation marks in your response. Write only in Japanese.`;

      const stream = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast" as any, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Give me your best trash talk line!" },
        ],
        stream: true,
      });

      return new Response(stream as ReadableStream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    } catch {
      return new Response(getFallbackTrashTalk(body.opponentCharacter, body.playerCharacter), {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
  }

  // Leaderboard read
  if (url.pathname === "/api/leaderboard" && request.method === "GET") {
    if (!env.LEADERBOARD) {
      return Response.json({ entries: [] }, { headers: corsHeaders });
    }

    try {
      const list = await env.LEADERBOARD.list({ prefix: "score:", limit: 50 });
      const entries = await Promise.all(
        list.keys.reverse().map(async (key) => {
          const val = await env.LEADERBOARD.get(key.name, "json");
          return val;
        }),
      );
      return Response.json({ entries: entries.filter(Boolean) }, { headers: corsHeaders });
    } catch {
      return Response.json({ entries: [] }, { headers: corsHeaders });
    }
  }

  // Leaderboard write
  if (url.pathname === "/api/leaderboard" && request.method === "POST") {
    if (!env.LEADERBOARD) {
      return Response.json({ error: "KV not configured" }, { status: 503, headers: corsHeaders });
    }

    const body = (await request.json()) as {
      name: string;
      score: number;
      song: string;
      character: string;
    };

    const paddedScore = String(body.score).padStart(10, "0");
    const ulid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const key = `score:${paddedScore}:${ulid}`;

    await env.LEADERBOARD.put(key, JSON.stringify({
      name: body.name,
      score: body.score,
      song: body.song,
      character: body.character,
      timestamp: Date.now(),
    }));

    return Response.json({ ok: true }, { headers: corsHeaders });
  }

  return Response.json({ error: "not found" }, { status: 404, headers: corsHeaders });
}

async function handleWebSocket(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response> {
  // Expected path: /ws/lobby/:code
  const parts = url.pathname.split("/");
  const code = parts[3];
  if (!code) {
    return Response.json({ error: "Missing lobby code" }, { status: 400 });
  }

  const lobbyId = env.LOBBY.idFromName(code);
  const stub = env.LOBBY.get(lobbyId);

  // Forward the WebSocket upgrade to the Durable Object
  return stub.fetch(request);
}

function getFallbackTrashTalk(opponent: string, player: string): string {
  if (opponent === "miku") {
    return `あら、${player}を選んだの？可愛いね～。いつも通り、このステージは私のものよ♪`;
  }
  return `ふふっ、${player}がこのツインドリルについてこれると思ってるの？甘いわね！`;
}
