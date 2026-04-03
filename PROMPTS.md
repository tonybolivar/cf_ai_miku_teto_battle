# AI Prompts Used

## Workers AI — Trash Talk (In-Game)

Called once per match after character select. The opponent character delivers trash talk streamed token-by-token into a speech bubble.

**Model:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

**System Prompt:**
```
You are [opponent character name] from the Vocaloid universe.
Your opponent just picked [player character] and challenged you to a rhythm battle on "[song title]".
Write one short trash talk line in Japanese, 1-2 sentences max.
Stay fully in character. Be playful and confident, not cruel.
Do not use quotation marks in your response. Write only in Japanese.
```

**User Message:**
```
Give me your best trash talk line!
```

**Streaming:** Response is streamed via SSE to the frontend for a typing effect in the speech bubble.

**Fallback:** If Workers AI is unavailable, hardcoded character-specific lines are used instead.

## Development Prompts

These are the prompts used with Claude Code (Opus) during development. I wrote the core architecture and game engine first, then used these prompts to extend and build on top of my code.

### 1. Initial Scaffolding

```
I have a React + TypeScript + Vite project set up with a Cloudflare Workers backend. I've written
the core game loop, Canvas 2D note highway renderer, and input manager for a Friday Night Funkin-style
rhythm battle game (Miku vs Teto). The note engine handles 4-lane arrow judgment with timing windows
(sick/good/bad/shit/miss), hold notes, and combo tracking.

Build out the rest of the game flow on top of this:
- Health bar system with zero-sum damage (player hits heal you and hurt the opponent, misses do the opposite)
- Bot AI opponent with difficulty levels (easy/medium/hard) that plays against the player's chart
- Score tracking and a GameState class with event emitters for UI updates
- Screen flow: title → character select → mode select → song select → countdown → game → results
- Leaderboard screen that reads from a /api/leaderboard endpoint
- Procedural SFX using Web Audio API oscillators — hit sounds per lane, miss sound, countdown beeps, menu select

I already have the Workers backend entry point. Add:
- POST /api/leaderboard with KV storage for score persistence
- GET /api/leaderboard returning top 50 scores
- POST /api/trash-talk that uses Workers AI (Llama 3.3 70B) to generate in-character trash talk
  from the opponent, streamed via SSE. Fall back to hardcoded lines if AI is unavailable.
```

### 2. 3D Character Rendering

```
I've added Three.js and @pixiv/three-vrm to the project. I have .vrm files for Miku and Teto in
/public/assets/.

Add a VRMManager class that renders characters on a second canvas layered behind my note canvas:
- Load and display both player and opponent VRM models side by side
- Idle animation loop: subtle body swaying, breathing (chest bone oscillation), periodic blinking
- Singing poses triggered per-lane when the player hits notes — each arrow direction should map to a
  different arm/head pose
- Dual camera showing both characters

Also load a GLB concert stage model as the 3D environment behind the characters. Build a StageManager
that handles loading and crossfading between stages.
```

### 3. MMD Dance Animation Support

```
I want to add a second song (Mesmerizer) that uses PMX models with VMD dance animations instead of
static VRM poses. I have the PMX and VMD files ready.

Extend the character system to support MMD alongside VRM:
- PMX model loading via three-stdlib's MMDLoader
- VMD motion parsing and playback
- Bone mapping from MMD skeleton names to VRM humanoid bones (need a lookup table — MMD uses
  Japanese bone names)
- VMD facial morph extraction (the morph names are Shift-JIS encoded in the binary)

Also add:
- Video background support as an alternative to the GLB stage (Mesmerizer uses an MP4 background)
- A lyrics display component with timed text + translation, fading in/out per line
- Per-song asset config registry (SONG_ASSETS) so each song can specify its own VRM URLs, MMD models,
  video backgrounds, camera VMD, stage model, solo character flag, etc.
```

### 4. Second MMD Song + Native Scale

```
Adding Po Pi Po as the third song. This one has PMX models, VMD dance files, a VMD camera, and a
PMX stage model. The camera VMD expects native MMD coordinates (~20 unit scale) unlike Mesmerizer
which was rescaled to VRM proportions.

I need the engine to handle native MMD scale:
- When a song has a camera VMD, load characters and stage at native MMD scale (no rescaling)
- Let the VMD camera animation drive the view instead of the static dual camera
- Load PMX stages (not just GLB) with proper positioning

Also hook up the MMD camera loader to read the VMD camera file and apply it to the Three.js camera
each frame.
```

### 5. Quit System + Song Restrictions + Bot Fixes

```
A few things to add on top of what I have:

1. Hold-to-quit: holding Escape during gameplay fills a radial progress ring. When full, quit back to
   title. Show a visual indicator in the corner.

2. Song restrictions: I've added per-song character restrictions in SONG_ASSETS (allowedCharacters,
   soloCharacter). Filter the song select list based on the chosen character and game mode. Hide solo
   songs from PVP mode.

3. Bot mode fix: the bot opponent can currently die from KO mid-song. In bot mode, disable KO so the
   match always plays to the end of the chart — final winner determined by score, not health.
```

### 6. PVP Multiplayer with Durable Objects

```
I've set up the wrangler config with a Durable Object binding (LobbyDO) and the WebSocket upgrade
route in my worker. Build the full multiplayer system on top of this:

Durable Object (LobbyDO):
- Use the WebSocket hibernation API for connection handling
- Assign player slots (p1/p2) on connect, store character/health/score/combo per player
- Game phases: waiting → countdown → playing → finished
- When a player sends a hit or miss, compute health deltas server-side and broadcast the update to
  the opponent (score, combo, health, lane, rating)
- Idle timeout and max match duration (5 min each)
- If someone disconnects during play, the other player wins

Worker routes:
- POST /api/lobby/create → generate a 6-char alphanumeric code, return code + WS URL
- POST /api/lobby/join/:code → validate lobby has space, return WS URL
- /ws/lobby/:code → forward WebSocket upgrade to the DO

Frontend LobbyScreen:
- Create/Join flow with lobby code display and input
- Connection status dots + ready-up button
- Clock sync via ping/pong round trips
- When both ready and server sends "start", hand off the live WebSocket to the game screen

In the GameLoop, reuse the lobby WebSocket (don't reconnect). Send hit/miss/hold_end messages on
every player action. Receive opponent_update, your_health, opponent_sing, and finish messages to
update game state and trigger opponent animations.
```

### 7. PVP Chat

```
Implement chat before and after the game. In a little chat button.
```
