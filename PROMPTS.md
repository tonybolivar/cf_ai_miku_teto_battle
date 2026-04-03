# AI Prompts Used

## Workers AI — Trash Talk (In-Game)

Called once per match after character select. The opponent character delivers trash talk streamed token-by-token into a speech bubble.

**Model:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

**System Prompt:**
```
You are [opponent character name] from the Vocaloid universe.
Your opponent just picked [player character] and challenged you to a rhythm battle on "[song title]".
Write one short trash talk line, 1-2 sentences max.
Stay fully in character. Be playful and confident, not cruel.
Do not use quotation marks in your response.
```

If a player name is available:
```
Their name is [playerName].
```

**User Message:**
```
Give me your best trash talk line!
```

**Streaming:** Response is streamed via SSE to the frontend for a typing effect in the speech bubble.

**Fallback:** If Workers AI is unavailable, hardcoded character-specific lines are used instead.

## Claude Code — Development

This entire project was built using Claude Code (Opus 4.6) as the AI coding assistant. The architecture specification was provided by the developer, and Claude Code implemented all code across the full stack: React frontend, Canvas 2D game engine, Three.js/VRM character system, Cloudflare Workers API, Durable Object multiplayer backend, and build configuration.
