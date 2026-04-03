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
  }

  async load(url: string): Promise<void> {
    if (!this.ctx) await this.init();
    const resp = await fetch(url);
    const arrayBuf = await resp.arrayBuffer();
    this.buffer = await this.ctx!.decodeAudioData(arrayBuf);
  }

  play(startOffsetMs = 0, delayMs = 0): void {
    if (!this.ctx || !this.buffer) return;

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

  resume(): Promise<void> {
    return this.ctx?.resume() ?? Promise.resolve();
  }
}
