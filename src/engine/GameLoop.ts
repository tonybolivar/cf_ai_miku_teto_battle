import * as THREE from "three";
import { AudioManager } from "./AudioManager";
import { InputManager } from "./InputManager";
import { NoteEngine } from "./NoteEngine";
import { GameState } from "./GameState";
import { Renderer } from "./Renderer";
import { Effects } from "./Effects";
import { VRMManager } from "./VRMManager";
import { StageManager } from "./StageManager";
import { BotPlayer } from "./BotPlayer";
import { soundFX } from "./SoundFX";
import { SONG_ASSETS } from "../data/songs";
import { loadFBXDance } from "./FBXDanceLoader";
import {
  LANE_COLORS,
  LANE_WIDTH,
  SCROLL_SPEED,
  HIGHWAY_HEIGHT,
  HIGHWAY_WIDTH,
  HIGHWAY_GAP,
  RECEPTOR_Y,
  type Chart,
  type Lane,
  type Character,
  type BotDifficulty,
  DIFFICULTY_SCROLL_SPEED,
} from "../types/game";
import type { ServerMessage } from "../types/protocol";

export interface GameLoopConfig {
  noteCanvas: HTMLCanvasElement;
  vrmCanvas: HTMLCanvasElement;
  chart: Chart;
  playerCharacter: Character;
  opponentCharacter: Character;
  mode?: "bot" | "pvp";
  botDifficulty?: BotDifficulty;
  startAt?: number;
  slowmo?: number;
  showHitWindows?: boolean;
  playerVrmUrl?: string;
  opponentVrmUrl?: string;
  playerStageUrl?: string;
  opponentStageUrl?: string;
  songId?: string;
  pvpWs?: WebSocket;
  pvpSlot?: "p1" | "p2";
  pvpClockOffset?: number;
  pvpStartAt?: number;
  onGameOver?: (winner: "player" | "opponent" | "draw") => void;
  onStateChange?: (state: GameState) => void;
}

export class GameLoop {
  readonly audio = new AudioManager();
  readonly input = new InputManager();
  readonly playerNotes = new NoteEngine();
  readonly opponentNotes = new NoteEngine();
  readonly state = new GameState();
  readonly effects = new Effects();
  readonly renderer: Renderer;
  vrm: VRMManager | null = null;
  private bot: BotPlayer | null = null;
  private pvpWs: WebSocket | null = null;

  private chart: Chart;
  private config: GameLoopConfig;
  private rafId = 0;
  private lastFrameTime = 0;
  private running = false;
  private songStarted = false;
  private destroyed = false;

  constructor(config: GameLoopConfig) {
    this.config = config;
    this.chart = config.chart;
    this.renderer = new Renderer(config.noteCanvas);
    // Miku always on the left, Teto always on the right
    this.renderer.playerOnLeft = config.playerCharacter === "miku";
    // Difficulty affects scroll speed
    if (config.botDifficulty && DIFFICULTY_SCROLL_SPEED[config.botDifficulty]) {
      this.renderer.scrollSpeed = DIFFICULTY_SCROLL_SPEED[config.botDifficulty];
    }

    if (config.showHitWindows) {
      this.renderer.setShowHitWindows(true);
    }
  }

  async init(): Promise<void> {
    // Load audio first (critical path - blocks game start)
    await this.audio.init();
    await this.audio.load(this.chart.audioFile);

    if (this.config.slowmo) {
      this.audio.setPlaybackRate(this.config.slowmo);
    }

    // Load chart into note engines
    this.playerNotes.loadChart(this.chart.notes, true);
    this.opponentNotes.loadChart(this.chart.notes, false);

    // Set up input
    this.input.attach(() => this.audio.getSongTime() + (this.chart.chartOffset || 0));

    this.input.onInput((lane, pressed) => {
      if (!this.running) return;
      if (pressed) {
        this.handleKeyPress(lane);
      } else {
        this.handleKeyRelease(lane);
      }
    });

    // Initialize bot if in bot mode (skip for solo songs -- no opponent to fight)
    const songAssets = this.config.songId ? SONG_ASSETS[this.config.songId] : undefined;
    const isSolo = !!songAssets?.soloCharacter;
    if (!isSolo && this.config.mode !== "pvp" && this.config.botDifficulty) {
      this.bot = new BotPlayer(this.config.botDifficulty);
      this.bot.loadChart(this.chart.notes);
    }

    // Attach PVP WebSocket if in pvp mode (reuse connection from lobby)
    if (this.config.mode === "pvp" && this.config.pvpWs) {
      this.attachPvpWebSocket(this.config.pvpWs);
    }

    this.state.on("gameover", (data) => {
      this.config.onGameOver?.(data.winner);
    });

    // Init 3D rendering
    if (this.config.vrmCanvas) {
      this.vrm = new VRMManager(this.config.vrmCanvas);

      const songId = this.config.songId;
      const songAssets = songId ? SONG_ASSETS[songId] : undefined;

      // Load GLB stage (unless song has video background)
      if (this.config.playerStageUrl) {
        const stage = new StageManager();
        this.vrm.setStageManager(stage);
        await stage.loadStage(this.config.playerCharacter, this.config.playerStageUrl);
        stage.showStage(this.config.playerCharacter);
      }

      // Check if song uses Yakuza (SEGA) models via @three-yakuza
      if (songAssets?.yakuzaModels) {
        const isSolo = !!songAssets.soloCharacter;
        const playerYakuza = songAssets.yakuzaModels[this.config.playerCharacter];
        const opponentYakuza = isSolo ? undefined : songAssets.yakuzaModels[this.config.opponentCharacter];

        const yakuzaLoads: Promise<void>[] = [];
        if (playerYakuza) {
          const pos = new THREE.Vector3(isSolo ? 0 : -0.5, 0, 0);
          yakuzaLoads.push(this.vrm.loadYakuzaCharacter(
            "player", playerYakuza.meshPar, playerYakuza.commonPar, playerYakuza.vmd, pos, playerYakuza.gmt,
          ));
        }
        if (opponentYakuza) {
          const pos = new THREE.Vector3(0.5, 0, 0);
          yakuzaLoads.push(this.vrm.loadYakuzaCharacter(
            "opponent", opponentYakuza.meshPar, opponentYakuza.commonPar, opponentYakuza.vmd, pos,
          ));
        }

        // Load MMD stage if specified
        if (songAssets.mmdStage) {
          yakuzaLoads.push(this.vrm.loadMMDStage(songAssets.mmdStage));
        }

        await Promise.all(yakuzaLoads);
        this.vrm.setCameraSolo();
      } else if (songAssets?.mmdModels) {
        const isSolo = !!songAssets.soloCharacter;
        const hasCamera = !!songAssets.mmdCamera;
        // Use native MMD scale when camera VMD is present (camera expects MMD coords)
        const nativeScale = hasCamera;

        const playerMMD = songAssets.mmdModels[this.config.playerCharacter];
        const opponentMMD = isSolo ? undefined : songAssets.mmdModels[this.config.opponentCharacter];

        // Miku always left, Teto always right
        const mikuIsPlayer = this.config.playerCharacter === "miku";
        const mmdLoads: Promise<void>[] = [];
        if (playerMMD) {
          const pos = nativeScale
            ? new THREE.Vector3(0, 0, 0) // camera VMD handles framing
            : new THREE.Vector3(isSolo ? 0 : (mikuIsPlayer ? -0.12 : 0.12), 0, 0);
          mmdLoads.push(this.vrm.loadMMDCharacter("player", playerMMD.pmx, playerMMD.vmd, pos, nativeScale));
        }
        if (opponentMMD) {
          const pos = nativeScale
            ? new THREE.Vector3(5, 0, 0) // offset in MMD units (~40cm)
            : new THREE.Vector3(mikuIsPlayer ? 0.12 : -0.12, 0, 0);
          mmdLoads.push(this.vrm.loadMMDCharacter("opponent", opponentMMD.pmx, opponentMMD.vmd, pos, nativeScale));
        }

        // Load MMD stage if specified
        if (songAssets.mmdStage) {
          mmdLoads.push(this.vrm.loadMMDStage(songAssets.mmdStage, nativeScale));
        }

        // Load camera VMD if specified
        if (songAssets.mmdCamera) {
          mmdLoads.push(this.vrm.loadMMDCamera(songAssets.mmdCamera));
        }

        await Promise.all(mmdLoads);
        if (nativeScale) {
          // Native MMD scale: character ~20 units tall
          this.vrm.setCameraMMD();
        } else if (isSolo) {
          this.vrm.setCameraSolo();
        } else {
          this.vrm.setCameraDual();
        }
      } else {
        // Load VRM characters (default)
        // Miku always on the left (-0.8), Teto always on the right (0.8)
        const playerX = this.config.playerCharacter === "miku" ? -0.8 : 0.8;
        const opponentX = this.config.playerCharacter === "miku" ? 0.8 : -0.8;
        const vrmLoads: Promise<void>[] = [];
        if (this.config.playerVrmUrl) {
          vrmLoads.push(this.vrm.loadCharacter("player", this.config.playerVrmUrl, new THREE.Vector3(playerX, 0, 0)));
        }
        if (this.config.opponentVrmUrl) {
          vrmLoads.push(this.vrm.loadCharacter("opponent", this.config.opponentVrmUrl, new THREE.Vector3(opponentX, 0, 0)));
        }
        await Promise.all(vrmLoads);

        if (this.config.playerVrmUrl || this.config.opponentVrmUrl) {
          this.vrm.setCameraDual();
        }
      }
    }
  }

  async start(): Promise<void> {
    if (this.destroyed) return;
    this.running = true;
    this.songStarted = false;
    this.lastFrameTime = performance.now();

    // Start audio - must succeed before notes scroll
    try {
      await this.audio.resume();
      if (this.audio.context) soundFX.init(this.audio.context);
      this.audio.play(this.config.startAt ?? 0);
      this.songStarted = true;
      console.log("[GameLoop] Audio started, songTime:", this.audio.getSongTime());
    } catch (e) {
      console.error("[GameLoop] Audio failed to start:", e);
      // Fallback: use performance timer so notes still scroll
      this.songStarted = true;
    }

    this.loop(performance.now());
  }

  stop(): void {
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.audio.stop();
    this.audio.close();
    this.input.detach();
    this.vrm?.dispose();
    // Don't close pvpWs — it's reused for post-game chat. App.tsx owns the lifecycle.
    this.pvpWs = null;
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    const dt = Math.min(now - this.lastFrameTime, 50); // cap at 50ms
    this.lastFrameTime = now;

    const songTime = this.audio.getSongTime() + (this.chart.chartOffset || 0);

    // Auto-activate hold notes when the player is already holding the key
    // (must run BEFORE checkMisses so holds latch before being auto-missed)
    const heldLanes = new Set(([0, 1, 2, 3] as Lane[]).filter((l) => this.input.isHeld(l)));
    const autoHolds = this.playerNotes.autoActivateHolds(songTime, heldLanes);
    for (const h of autoHolds) {
      this.state.applyPlayerHit(h.result, h.points, h.healthDelta);
      this.pvpSend({ type: "hit", noteId: h.noteId, rating: h.result as any, lane: h.lane });
    }

    // Auto-consume notes inside active holds (slide notes)
    const held = this.playerNotes.consumeHeldNotes(songTime);

    // Check for auto-misses (after hold activation so holds aren't prematurely missed)
    const misses = this.playerNotes.checkMisses(songTime, heldLanes);
    for (const miss of misses) {
      this.state.applyPlayerHit("miss", 0, miss.healthDelta);
      this.effects.showRating("miss", this.getPlayerCenterX(), this.getPopupY());
      this.effects.shake();
      this.pvpSend({ type: "miss", noteId: miss.noteId, lane: miss.lane });
    }
    for (const h of held) {
      this.state.applyPlayerHit(h.result, h.points, h.healthDelta);
      this.pvpSend({ type: "hit", noteId: h.noteId, rating: h.result as any, lane: h.lane });
    }

    // Process bot actions
    if (this.bot) {
      const botActions = this.bot.getActions(songTime);
      for (const action of botActions) {
        const delta = this.bot.getHealthDelta(action);
        const points = this.bot.getPoints(action);

        if (action.hit) {
          this.state.applyOpponentHit(
            action.rating,
            delta,
            this.state.opponentScore + points,
            this.state.opponentCombo + 1,
          );
          // Trigger opponent character animation
          this.vrm?.triggerSing("opponent", action.lane);
        } else {
          this.state.applyOpponentHit("miss", delta, this.state.opponentScore, 0);
        }
      }
    }

    // Clean stale inputs
    this.input.cleanBuffer(songTime);

    // Process buffered inputs against upcoming notes
    this.processInputBuffer(songTime);

    // Update effects
    this.effects.update(dt);
    this.effects.setComboScale(this.state.combo);

    // Notify UI
    this.config.onStateChange?.(this.state);

    // Render note highways
    this.renderer.draw(
      songTime,
      this.playerNotes,
      this.opponentNotes,
      this.input,
      this.effects,
      this.state,
    );

    // Render VRM characters
    if (this.vrm) {
      this.vrm.update(dt);
      this.vrm.render();
    }

    // Check song end -- finish when all player notes are done
    if (
      this.songStarted &&
      !this.state.finished &&
      songTime > 5000 &&
      this.playerNotes.isComplete(songTime)
    ) {
      this.state.finishByTime();
      this.pvpSend({ type: "game_finished" });
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private handleKeyPress(lane: Lane): void {
    const songTime = this.audio.getSongTime() + (this.chart.chartOffset || 0);
    const result = this.playerNotes.judgeInput(lane, songTime);

    if (result) {
      // Remove the buffer entry — we handled this input immediately
      const buf = this.input.getBuffer();
      for (let i = buf.length - 1; i >= 0; i--) {
        if (buf[i].lane === lane) { buf.splice(i, 1); break; }
      }

      this.state.applyPlayerHit(result.result, result.points, result.healthDelta);

      if (result.result !== "miss") {
        soundFX.playHit(lane);
        const popupX = this.getPlayerCenterX();
        const popupY = this.getPopupY();
        this.effects.showRating(result.result, popupX, popupY);
        this.effects.spawnParticles(
          this.getPlayerLaneX(lane),
          this.getNoteCanvasReceptorY(),
          LANE_COLORS[lane],
        );

        // Trigger player character sing animation
        this.vrm?.triggerSing("player", lane);

        // Send hit to server in PVP mode
        this.pvpSend({ type: "hit", noteId: result.noteId, rating: result.result as any, lane });
      } else {
        soundFX.playMiss();
        this.effects.showRating("miss", this.getPlayerCenterX(), this.getPopupY());
        this.effects.shake();

        // Send miss to server in PVP mode
        this.pvpSend({ type: "miss", noteId: result.noteId, lane });
      }
    }
  }

  private handleKeyRelease(lane: Lane): void {
    const songTime = this.audio.getSongTime() + (this.chart.chartOffset || 0);
    const result = this.playerNotes.releaseHold(lane, songTime);
    if (result) {
      this.state.applyPlayerHit(result.result, result.points, result.healthDelta);
      this.pvpSend({ type: "hold_end", noteId: result.noteId, completed: true });
    }
  }

  private processInputBuffer(songTime: number): void {
    // Try to resolve buffered early inputs
    for (const buf of [...this.input.getBuffer()]) {
      const result = this.playerNotes.judgeInput(buf.lane, songTime);
      if (result) {
        // Remove from buffer
        const idx = this.input.getBuffer().indexOf(buf);
        if (idx >= 0) this.input.getBuffer().splice(idx, 1);

        this.state.applyPlayerHit(result.result, result.points, result.healthDelta);
        if (result.result !== "miss") {
          this.effects.showRating(result.result, this.getPlayerCenterX(), this.getPopupY());
          this.effects.spawnParticles(
            this.getPlayerLaneX(buf.lane),
            this.getNoteCanvasReceptorY(),
            LANE_COLORS[buf.lane],
          );
          this.vrm?.triggerSing("player", buf.lane);
        }
      }
    }
  }

  // ── Layout helpers (use CSS pixel width, not DPR-scaled canvas.width) ──

  private get canvasWidth(): number {
    return this.config.noteCanvas.clientWidth || this.config.noteCanvas.width;
  }

  private getPlayerCenterX(): number {
    const edgePadding = 30;
    if (this.renderer.playerOnLeft) {
      return edgePadding + HIGHWAY_WIDTH / 2;
    }
    return this.canvasWidth - HIGHWAY_WIDTH - edgePadding + HIGHWAY_WIDTH / 2;
  }

  private getPlayerLaneX(lane: Lane): number {
    const edgePadding = 30;
    if (this.renderer.playerOnLeft) {
      return edgePadding + lane * LANE_WIDTH + LANE_WIDTH / 2;
    }
    return this.canvasWidth - HIGHWAY_WIDTH - edgePadding + lane * LANE_WIDTH + LANE_WIDTH / 2;
  }

  private getPopupY(): number {
    return 20 + RECEPTOR_Y + 40;
  }

  private getNoteCanvasReceptorY(): number {
    return 20 + RECEPTOR_Y;
  }

  /** Trigger opponent character sing (called from WebSocket or bot) */
  triggerOpponentSing(lane: Lane): void {
    this.vrm?.triggerSing("opponent", lane);
  }

  // ── PVP WebSocket ──

  private attachPvpWebSocket(ws: WebSocket): void {
    this.pvpWs = ws;

    // Replace lobby message handlers with game handlers
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        this.handlePvpMessage(msg);
      } catch { /* ignore non-JSON */ }
    };

    ws.onclose = () => {
      // If game is still running, opponent disconnected
      if (this.running && !this.state.finished) {
        this.state.finished = true;
        this.state.winner = "player";
        this.config.onGameOver?.("player");
      }
    };
  }

  private handlePvpMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case "opponent_update":
        // Server tells us what the opponent did — update opponent state display
        this.state.opponentScore = msg.score;
        this.state.opponentCombo = msg.combo;
        break;

      case "your_health":
        // Server is authoritative for health in PVP
        this.state.health = msg.health;
        break;

      case "opponent_sing":
        this.vrm?.triggerSing("opponent", msg.lane);
        break;

      case "finish": {
        if (this.state.finished) break;
        this.state.finished = true;
        const mySlot = this.config.pvpSlot ?? "p1";
        const winner = msg.winner === "draw" ? "draw"
          : msg.winner === mySlot ? "player" : "opponent";
        this.state.winner = winner;
        this.config.onGameOver?.(winner);
        break;
      }
    }
  }

  private pvpSend(msg: object): void {
    if (this.pvpWs?.readyState === WebSocket.OPEN) {
      this.pvpWs.send(JSON.stringify(msg));
    }
  }
}
