export class AudioManager {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private scheduledTime = 0;
  private startOffset = 0;
  private _playing = false;
  private playbackRate = 1;

  async init(): Promise<void> {
    this.ctx = new AudioContext();
    // Track for cleanup on hot reload
    const win = window as any;
    if (!win.__audioContexts) win.__audioContexts = [];
    win.__audioContexts.push(this.ctx);
  }

  async load(url: string): Promise<void> {
    if (!this.ctx) await this.init();
    console.log("[Audio] Loading:", url);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Audio fetch failed: ${resp.status} ${url}`);
    const arrayBuf = await resp.arrayBuffer();
    console.log("[Audio] Decoding:", arrayBuf.byteLength, "bytes");
    this.buffer = await this.ctx!.decodeAudioData(arrayBuf);
    console.log("[Audio] Loaded OK, duration:", this.buffer.duration.toFixed(1), "s");
  }

  play(startOffsetMs = 0, delayMs = 0): void {
    if (!this.ctx || !this.buffer) {
      console.warn("[Audio] play() called but ctx/buffer missing:", { ctx: !!this.ctx, buffer: !!this.buffer });
      return;
    }

    this.stop();
    this.startOffset = startOffsetMs;

    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = this.playbackRate;
    source.connect(this.ctx.destination);
    source.onended = () => {
      this._playing = false;
    };

    const delaySec = Math.max(0, delayMs / 1000);
    this.scheduledTime = this.ctx.currentTime + delaySec;
    source.start(this.scheduledTime, startOffsetMs / 1000);

    this.source = source;
    this._playing = true;
  }

  stop(): void {
    if (this.source) {
      try { this.source.stop(); } catch { /* already stopped */ }
      this.source.disconnect();
      this.source = null;
    }
    this._playing = false;
  }

  /** Current song position in ms, accounting for playback rate */
  getSongTime(): number {
    if (!this.ctx || !this._playing) return this.startOffset;
    const elapsed = (this.ctx.currentTime - this.scheduledTime) * 1000;
    return this.startOffset + elapsed * this.playbackRate;
  }

  get playing(): boolean {
    return this._playing;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get duration(): number {
    return this.buffer ? this.buffer.duration * 1000 : 0;
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.source) {
      this.source.playbackRate.value = rate;
    }
  }

  close(): void {
    this.stop();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.buffer = null;
  }

  resume(): Promise<void> {
    return this.ctx?.resume() ?? Promise.resolve();
  }
}
