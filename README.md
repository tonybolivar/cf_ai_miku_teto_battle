# Miku vs Teto — Rhythm Battle

A Friday Night Funkin'-style rhythm battle game built entirely on Cloudflare infrastructure. Two players (or one vs bot) compete head-to-head hitting notes to Vocaloid songs. One plays as Hatsune Miku, the other as Kasane Teto.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Three.js (Cloudflare Workers static assets) |
| Game Engine | Client-side Canvas 2D (note highways) + Three.js (VRM characters, GLB stages) |
| Lobby State | Durable Objects (WebSocket Hibernation API, one per lobby) |
| Matchmaking API | Cloudflare Workers |
| Trash Talk | Workers AI (Llama 3.3 70B, streaming) |
| Leaderboard | Cloudflare KV |
| 3D Characters | @pixiv/three-vrm for VRM model loading and bone-based animation |

```
Browser (P1) ←——WebSocket (DO)——→ Browser (P2)
                    ↓
              Durable Object
         (authoritative health state)
                    ↓
              KV (leaderboard)
```

## Game Mechanics

Faithful FNF implementation:
- 4 lanes: Left (purple), Down (cyan), Up (green), Right (red)
- Hit windows: SICK ±45ms, GOOD ±90ms, BAD ±135ms, SHIT ±166ms
- Zero-sum health bar (0.0–2.0), KO at 0.0
- Hold notes, combo tracking, rating popups
- Bot opponent with 3 difficulty levels (Gaussian timing jitter)
- Lyrics display with Japanese text + English translation
- Web Audio API for precise timing + input buffering

## Songs

- **Po Pi Po** (138 BPM, Easy) — Hatsune Miku
- **Melt** (148 BPM, Medium) — Hatsune Miku
- **Kasane Territory** (175 BPM, Hard) — Kasane Teto

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Dev Tools (query params)

- `?startAt=30000` — skip to 30s into the song
- `?slowmo=0.5` — half-speed playback
- `?hitwindow=1` — visualize hit windows

### Adding VRM Characters

Place `.vrm` files in `public/assets/` and pass their URLs as `playerVrmUrl` / `opponentVrmUrl` props to the GameScreen.

### Adding Stage Environments

Place `.glb` files in `public/assets/` and pass their URLs as `playerStageUrl` / `opponentStageUrl`.

## Deployment

```bash
# Login to Cloudflare
npx wrangler login

# Create KV namespace
npx wrangler kv namespace create LEADERBOARD

# Update wrangler.jsonc with real KV ID and uncomment AI binding

# Deploy
npm run deploy
```

## Controls

| Key | Lane |
|---|---|
| A / ArrowLeft | Left |
| S / ArrowDown | Down |
| W / ArrowUp | Up |
| D / ArrowRight | Right |

## Project Structure

```
src/
  engine/       — Game loop, audio, input, note engine, renderer, effects, VRM, stages, bot, SFX
  screens/      — React components for all 10 game screens + lyrics display
  types/        — TypeScript types for game state and WebSocket protocol
  hooks/        — useGameState, useWebSocket
  data/         — Song charts and metadata
  utils/        — Clock sync utility
worker/
  index.ts      — Cloudflare Worker API router
  lobby.ts      — Durable Object (lobby state, WebSocket, health logic)
tools/
  osu_to_chart.ts — .osu beatmap to game chart converter
```
