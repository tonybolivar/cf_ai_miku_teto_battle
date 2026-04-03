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
} from "../types/game";

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

    // Disable KO for bot mode -- game ends when chart finishes, not health
    if (this.config.mode !== "pvp") {
      this.state.disableKO = true;
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

      // Check if song uses MMD models (PMX + VMD, native, no retargeting)
      if (songAssets?.mmdModels) {
        const isSolo = !!songAssets.soloCharacter;
        const hasCamera = !!songAssets.mmdCamera;
        // Use native MMD scale when camera VMD is present (camera expects MMD coords)
        const nativeScale = hasCamera;

        const playerMMD = songAssets.mmdModels[this.config.playerCharacter];
        const opponentMMD = isSolo ? undefined : songAssets.mmdModels[this.config.opponentCharacter];

        const mmdLoads: Promise<void>[] = [];
        if (playerMMD) {
          const pos = nativeScale
            ? new THREE.Vector3(0, 0, 0) // camera VMD handles framing
            : new THREE.Vector3(isSolo ? 0 : 0.25, 0, 0);
          mmdLoads.push(this.vrm.loadMMDCharacter("player", playerMMD.pmx, playerMMD.vmd, pos, nativeScale));
        }
        if (opponentMMD) {
          const pos = nativeScale
            ? new THREE.Vector3(5, 0, 0) // offset in MMD units (~40cm)
            : new THREE.Vector3(-0.25, 0, 0);
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
        const vrmLoads: Promise<void>[] = [];
        if (this.config.playerVrmUrl) {
          vrmLoads.push(this.vrm.loadCharacter("player", this.config.playerVrmUrl, new THREE.Vector3(0.8, 0, 0)));
        }
        if (this.config.opponentVrmUrl) {
          vrmLoads.push(this.vrm.loadCharacter("opponent", this.config.opponentVrmUrl, new THREE.Vector3(-0.8, 0, 0)));
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
  }

  private loop = (now: number): void => {
    if (!this.running) return;

    const dt = Math.min(now - this.lastFrameTime, 50); // cap at 50ms
    this.lastFrameTime = now;

    const songTime = this.audio.getSongTime() + (this.chart.chartOffset || 0);

    // Check for auto-misses
    const misses = this.playerNotes.checkMisses(songTime);
    for (const miss of misses) {
      this.state.applyPlayerHit("miss", 0, miss.healthDelta);
      this.effects.showRating("miss", this.getPlayerCenterX(), this.getPopupY());
      this.effects.shake();
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
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private handleKeyPress(lane: Lane): void {
    const songTime = this.audio.getSongTime() + (this.chart.chartOffset || 0);
    const result = this.playerNotes.judgeInput(lane, songTime);

    if (result) {
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
      } else {
        soundFX.playMiss();
        this.effects.showRating("miss", this.getPlayerCenterX(), this.getPopupY());
        this.effects.shake();
      }
    }
  }

  private handleKeyRelease(lane: Lane): void {
    const songTime = this.audio.getSongTime() + (this.chart.chartOffset || 0);
    const result = this.playerNotes.releaseHold(lane, songTime);
    if (result) {
      this.state.applyPlayerHit(result.result, result.points, result.healthDelta);
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
    return this.canvasWidth - HIGHWAY_WIDTH - edgePadding + HIGHWAY_WIDTH / 2;
  }

  private getPlayerLaneX(lane: Lane): number {
    const edgePadding = 30;
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
}
