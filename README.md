# Miku vs Teto: Rhythm Battle

A rhythm battle game built on Cloudflare infrastructure. Two players (or one vs bot) compete head-to-head hitting notes to Vocaloid songs. One plays as Hatsune Miku, the other as Kasane Teto.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Three.js |
| Game Engine | Canvas 2D (note highways) + Three.js (3D characters, stages) |
| 3D Characters | @pixiv/three-vrm for VRM models, three-stdlib MMDLoader for PMX models with VMD dance animation |
| Lobby State | Durable Objects (WebSocket Hibernation API) |
| Matchmaking API | Cloudflare Workers |
| Trash Talk | Workers AI (Llama 3.3 70B, streaming) |
| Leaderboard | Cloudflare KV |

## Songs

- **Po Pi Po** (138 BPM) - Hatsune Miku, with VRM character models and GLB beach stage
- **Mesmerizer** (143 BPM) - Hatsune Miku & Kasane Teto SV, with PMX models dancing via VMD motion data and video background

## Game Mechanics

- 4 lanes: Left (purple), Down (cyan), Up (green), Right (red)
- Hit windows: SICK +-45ms, GOOD +-90ms, BAD +-135ms, SHIT +-166ms
- Zero-sum health bar (0.0-2.0), KO at 0.0
- Hold notes, combo tracking, rating popups
- Bot opponent with 3 difficulty levels
- Japanese lyrics with English translation synced to SRT timing
- Web Audio API for precise timing + input buffering
- Per-song custom assets: VRM/PMX models, VMD dance animations, GLB stages, video backgrounds

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173

### Dev Tools (query params)

- `?startAt=30000` - skip to 30s into the song
- `?slowmo=0.5` - half-speed playback
- `?hitwindow=1` - visualize hit windows

## Deployment

```bash
npx wrangler login
npx wrangler kv namespace create LEADERBOARD
# Update wrangler.jsonc with real KV ID and uncomment AI binding
npm run deploy
```

## Controls

| Key | Lane |
|---|---|
| A / ArrowLeft | Left |
| S / ArrowDown | Down |
| W / ArrowUp | Up |
| D / ArrowRight | Right |

## Credits

- Mesmerizer by 32ki (https://www.youtube.com/watch?v=19y8YTbvri8)
- Dance motion by Nabix / Durles / Rellis Starlab
- Motion actors: Nabix & Tia Lee
- Choreo by SEGA & Crypton Future Media
- Motion retarget by Durles, facials by Durles / SAUGU
- PDXHD Default Miku model by Durles
- PDXHD Default Teto model

## Project Structure

```
src/
  engine/       Game loop, audio, input, note engine, renderer, effects, VRM, MMD, stages, bot, SFX
  screens/      React components for all game screens + lyrics display
  types/        TypeScript types for game state and WebSocket protocol
  hooks/        useGameState, useWebSocket
  data/         Song charts, metadata, per-song asset config
  utils/        Clock sync utility
worker/
  index.ts      Cloudflare Worker API router
  lobby.ts      Durable Object (lobby state, WebSocket, health logic)
tools/
  osu_to_chart.ts   .osu beatmap to game chart converter
```
