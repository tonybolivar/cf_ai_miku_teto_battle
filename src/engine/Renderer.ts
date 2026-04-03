import {
  LANE_COLORS,
  LANE_ROTATIONS,
  SCROLL_SPEED,
  RECEPTOR_Y,
  HIGHWAY_WIDTH,
  LANE_WIDTH,
  NOTE_SIZE,
  HIGHWAY_HEIGHT,
  HIGHWAY_GAP,
  type Lane,
} from "../types/game";
import type { NoteEngine } from "./NoteEngine";
import type { InputManager } from "./InputManager";
import type { Effects } from "./Effects";
import type { GameState } from "./GameState";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private showHitWindows = false;
  /** When true, player highway is on the left side */
  playerOnLeft = false;
  scrollSpeed = SCROLL_SPEED;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    // Use CSS pixel size (not the DPR-scaled canvas.width)
    this.width = canvas.clientWidth || canvas.width;
    this.height = canvas.clientHeight || canvas.height;
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
  }

  setShowHitWindows(show: boolean): void {
    this.showHitWindows = show;
  }

  draw(
    songTime: number,
    playerEngine: NoteEngine,
    opponentEngine: NoteEngine,
    input: InputManager,
    effects: Effects,
    state: GameState,
  ): void {
    const ctx = this.ctx;
    const shake = effects.getShakeOffset();

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Clear
    ctx.clearRect(-10, -10, this.width + 20, this.height + 20);

    // Calculate positions — highways pushed to screen edges
    // Miku is always on the left, Teto on the right
    const edgePadding = 30;
    const leftX = edgePadding;
    const rightX = this.width - HIGHWAY_WIDTH - edgePadding;
    const playerX = this.playerOnLeft ? leftX : rightX;
    const opponentX = this.playerOnLeft ? rightX : leftX;
    const highwayTop = 20;

    // Draw highways (dark backgrounds so arrows pop over video)
    this.drawHighway(ctx, opponentX, highwayTop, 0.75);
    this.drawHighway(ctx, playerX, highwayTop, 0.8);

    // Draw hit windows visualization
    if (this.showHitWindows) {
      this.drawHitWindows(ctx, playerX, highwayTop);
    }

    // Draw receptors
    this.drawReceptors(ctx, opponentX, highwayTop, null);
    this.drawReceptors(ctx, playerX, highwayTop, input);

    // Draw notes (visible window = ~1500ms ahead)
    const windowMs = HIGHWAY_HEIGHT / this.scrollSpeed + 200;

    // Opponent notes
    const opponentNotes = opponentEngine.getVisibleNotes(songTime, windowMs);
    for (const note of opponentNotes) {
      this.drawNote(ctx, note.lane, note.time, songTime, opponentX, highwayTop, note.duration, true);
    }

    // Player notes
    const playerNotes = playerEngine.getVisibleNotes(songTime, windowMs);
    for (const note of playerNotes) {
      this.drawNote(ctx, note.lane, note.time, songTime, playerX, highwayTop, note.duration, false);
    }

    // Draw hold tails + arrow locked at receptor
    for (const hold of playerEngine.getActiveHolds()) {
      this.drawHoldTail(ctx, hold.lane, hold.time, hold.time + hold.duration, songTime, playerX, highwayTop);
      this.drawNote(ctx, hold.lane, songTime, songTime, playerX, highwayTop, 0, false);
    }
    for (const hold of opponentEngine.getActiveHolds()) {
      this.drawHoldTail(ctx, hold.lane, hold.time, hold.time + hold.duration, songTime, opponentX, highwayTop);
    }

    // Draw effects (rating popups, particles)
    effects.draw(ctx, playerX + HIGHWAY_WIDTH / 2);

    // Draw combo
    if (state.combo > 0) {
      const comboScale = effects.getComboScale();
      ctx.save();
      ctx.font = `bold ${Math.round(28 * comboScale)}px "Noto Sans JP", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFF";
      ctx.globalAlpha = 0.9;
      ctx.fillText(`${state.combo}`, playerX + HIGHWAY_WIDTH / 2, highwayTop + RECEPTOR_Y + 80);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawHighway(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    alpha: number,
  ): void {
    ctx.save();
    ctx.fillStyle = `rgba(20, 20, 30, ${alpha})`;
    ctx.fillRect(x, y, HIGHWAY_WIDTH, HIGHWAY_HEIGHT);

    // Lane dividers
    ctx.strokeStyle = `rgba(255, 255, 255, 0.05)`;
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * LANE_WIDTH, y);
      ctx.lineTo(x + i * LANE_WIDTH, y + HIGHWAY_HEIGHT);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawReceptors(
    ctx: CanvasRenderingContext2D,
    x: number,
    highwayTop: number,
    input: InputManager | null,
  ): void {
    for (let lane = 0; lane < 4; lane++) {
      const laneX = x + lane * LANE_WIDTH + LANE_WIDTH / 2;
      const laneY = highwayTop + RECEPTOR_Y;
      const color = LANE_COLORS[lane as Lane];
      const held = input?.isHeld(lane as Lane) ?? false;

      ctx.save();
      ctx.translate(laneX, laneY);
      ctx.rotate((LANE_ROTATIONS[lane as Lane] * Math.PI) / 180);

      // Draw chevron receptor
      const size = NOTE_SIZE / 2;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.3, -size * 0.7);
      ctx.lineTo(-size * 0.1, 0);
      ctx.lineTo(-size * 0.3, size * 0.7);
      ctx.closePath();

      if (held) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 1;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
      } else {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 2.5;
      }

      if (held) ctx.fill();
      else ctx.stroke();

      ctx.restore();
    }
  }

  private drawNote(
    ctx: CanvasRenderingContext2D,
    lane: Lane,
    noteTime: number,
    songTime: number,
    highwayX: number,
    highwayTop: number,
    duration: number,
    isOpponent: boolean,
  ): void {
    const color = LANE_COLORS[lane];
    const laneX = highwayX + lane * LANE_WIDTH + LANE_WIDTH / 2;

    // Notes scroll upward: future notes are below, past notes are above
    const receptorY = highwayTop + RECEPTOR_Y;
    const y = receptorY + (noteTime - songTime) * this.scrollSpeed;

    // Skip if off-screen
    if (y < highwayTop - NOTE_SIZE || y > highwayTop + HIGHWAY_HEIGHT + NOTE_SIZE) return;

    // Draw hold tail first (below the arrow)
    if (duration > 0) {
      const tailEndY = receptorY + (noteTime + duration - songTime) * this.scrollSpeed;
      this.drawHoldBar(ctx, laneX, y, tailEndY, color);
    }

    // Draw arrow
    ctx.save();
    ctx.translate(laneX, y);
    ctx.rotate((LANE_ROTATIONS[lane] * Math.PI) / 180);

    const size = NOTE_SIZE / 2;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.3, -size * 0.7);
    ctx.lineTo(-size * 0.1, 0);
    ctx.lineTo(-size * 0.3, size * 0.7);
    ctx.closePath();

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = isOpponent ? 6 : 12;

    ctx.fillStyle = color;
    ctx.globalAlpha = isOpponent ? 0.7 : 1;
    ctx.fill();

    // Bright outline
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#FFF";
    ctx.globalAlpha = isOpponent ? 0.3 : 0.6;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  private drawHoldBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    startY: number,
    endY: number,
    color: string,
  ): void {
    if (endY <= startY) return;
    const barWidth = 14;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - barWidth / 2, startY, barWidth, endY - startY);
    ctx.restore();
  }

  private drawHoldTail(
    ctx: CanvasRenderingContext2D,
    lane: Lane,
    noteStart: number,
    noteEnd: number,
    songTime: number,
    highwayX: number,
    highwayTop: number,
  ): void {
    const color = LANE_COLORS[lane];
    const laneX = highwayX + lane * LANE_WIDTH + LANE_WIDTH / 2;
    const receptorY = highwayTop + RECEPTOR_Y;

    const startY = Math.max(receptorY, receptorY + (noteStart - songTime) * this.scrollSpeed);
    const endY = receptorY + (noteEnd - songTime) * this.scrollSpeed;

    this.drawHoldBar(ctx, laneX, startY, endY, color);
  }

  private drawHitWindows(
    ctx: CanvasRenderingContext2D,
    x: number,
    highwayTop: number,
  ): void {
    const receptorY = highwayTop + RECEPTOR_Y;
    const windows = [
      { ms: 166, color: "rgba(255,0,0,0.1)" },
      { ms: 135, color: "rgba(255,136,0,0.1)" },
      { ms: 90, color: "rgba(255,255,255,0.1)" },
      { ms: 45, color: "rgba(0,255,255,0.15)" },
    ];

    for (const w of windows) {
      const h = w.ms * this.scrollSpeed * 2;
      ctx.fillStyle = w.color;
      ctx.fillRect(x, receptorY - h / 2, HIGHWAY_WIDTH, h);
    }
  }
}
