import { RATING_STYLES, type JudgeResult } from "../types/game";

interface RatingPopup {
  result: JudgeResult;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  age: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export class Effects {
  private popups: RatingPopup[] = [];
  private particles: Particle[] = [];
  private shakeAmount = 0;
  private shakeDecay = 0;
  private comboScale = 1;

  /** Spawn a rating popup at the given position */
  showRating(result: JudgeResult, x: number, y: number): void {
    this.popups.push({
      result,
      x,
      y,
      opacity: 1,
      scale: 1.5,
      age: 0,
    });
  }

  /** Trigger screen shake */
  shake(): void {
    this.shakeAmount = 4;
    this.shakeDecay = 200;
  }

  /** Spawn hit particles at position */
  spawnParticles(x: number, y: number, color: string): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.5;
      const speed = 100 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        life: 400 + Math.random() * 200,
        maxLife: 400 + Math.random() * 200,
        size: 3 + Math.random() * 3,
      });
    }
  }

  /** Set combo scale (grows with streak) */
  setComboScale(combo: number): void {
    this.comboScale = Math.min(1.3, 1.0 + combo * 0.004);
  }

  /** Update all effects by dt milliseconds */
  update(dt: number): void {
    // Rating popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.age += dt;
      p.opacity = Math.max(0, 1 - p.age / 500);
      p.scale = 1.5 - 0.5 * Math.min(1, p.age / 100); // snap to 1.0
      p.y -= dt * 0.03; // drift upward
      if (p.opacity <= 0) this.popups.splice(i, 1);
    }

    // Particles
    const dtSec = dt / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 300 * dtSec; // gravity
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Screen shake decay
    if (this.shakeDecay > 0) {
      this.shakeDecay -= dt;
      if (this.shakeDecay <= 0) {
        this.shakeAmount = 0;
        this.shakeDecay = 0;
      }
    }
  }

  /** Get current shake offset */
  getShakeOffset(): { x: number; y: number } {
    if (this.shakeAmount <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * 2 * this.shakeAmount,
      y: (Math.random() - 0.5) * 2 * this.shakeAmount,
    };
  }

  /** Draw all effects onto the canvas */
  draw(ctx: CanvasRenderingContext2D, playerCenterX: number): void {
    // Rating popups
    for (const p of this.popups) {
      const style = RATING_STYLES[p.result];
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.font = `bold ${Math.round(32 * p.scale)}px "VCR OSD Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (style.glow) {
        ctx.shadowColor = style.glow;
        ctx.shadowBlur = 20;
      }

      ctx.fillStyle = style.color;
      ctx.fillText(p.result.toUpperCase(), p.x, p.y);

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }

  getComboScale(): number {
    return this.comboScale;
  }

  clear(): void {
    this.popups.length = 0;
    this.particles.length = 0;
    this.shakeAmount = 0;
    this.shakeDecay = 0;
    this.comboScale = 1;
  }
}
