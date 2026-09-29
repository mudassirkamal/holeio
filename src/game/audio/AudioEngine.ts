/**
 * All sound is synthesized with WebAudio — no audio files to download.
 * SFX: swallow pops scaled by object size, size-up arpeggios, hole-eaten booms, UI.
 * Music: a tiny 16-step procedural groove (kick, hats, bass, arpeggio).
 */
const NOTE = (semitone: number) => 220 * Math.pow(2, semitone / 12);
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
const BASS_LINE = [0, 0, 7, 0, 5, 5, 3, 5];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private sfxEnabled = true;
  private musicEnabled = true;
  private lastPop = 0;
  private musicTimer: number | null = null;
  private step = 0;
  private nextStepTime = 0;
  private intensity = 0;

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      this.master.connect(compressor).connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.32 : 0;
      this.musicGain.connect(this.master);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setSfx(enabled: boolean) {
    this.sfxEnabled = enabled;
  }

  setMusic(enabled: boolean) {
    this.musicEnabled = enabled;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(enabled ? 0.32 : 0, this.ctx.currentTime, 0.2);
  }

  /** 0..1 — adds layers to the music as the match heats up. */
  setIntensity(value: number) {
    this.intensity = value;
  }

  private tone(freq: number, duration: number, type: OscillatorType, volume: number, slideTo?: number, delay = 0, target = this.sfxGain) {
    if (!this.ctx || !target) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(target);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  private burst(duration: number, volume: number, filterFreq: number, delay = 0, target = this.sfxGain, q = 0.8) {
    if (!this.ctx || !this.noise || !target) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(gain).connect(target);
    src.start(t, Math.random() * 0.5, duration + 0.05);
  }

  /** Swallowing an object; bigger objects sound deeper. */
  swallow(value: number) {
    if (!this.sfxEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPop < 0.045) return;
    this.lastPop = now;
    const size = Math.min(1, Math.log10(value + 1) / 3);
    const pitch = 900 - size * 650 + Math.random() * 120;
    this.tone(pitch, 0.12 + size * 0.2, "triangle", 0.18 + size * 0.12, pitch * 0.45);
    if (value >= 40) {
      this.tone(90, 0.5, "sine", 0.4, 40);
      this.burst(0.5, 0.25, 300);
    }
  }

  levelUp() {
    if (!this.sfxEnabled) return;
    [0, 4, 7, 12].forEach((s, i) => this.tone(NOTE(s + 12), 0.22, "square", 0.08, undefined, i * 0.07));
    this.tone(NOTE(24), 0.5, "sine", 0.12, undefined, 0.28);
  }

  holeEaten(involvesPlayer: boolean) {
    if (!this.sfxEnabled) return;
    const v = involvesPlayer ? 0.55 : 0.2;
    this.tone(160, 0.7, "sawtooth", v * 0.5, 30);
    this.tone(60, 0.9, "sine", v, 25);
    this.burst(0.8, v * 0.6, 500, 0, this.sfxGain, 0.5);
  }

  combo(level: number) {
    if (!this.sfxEnabled) return;
    this.tone(NOTE(12 + Math.min(level, 12)), 0.15, "square", 0.07);
  }

  countdown(final: boolean) {
    if (!this.sfxEnabled) return;
    this.tone(final ? 880 : 440, final ? 0.45 : 0.18, "square", 0.12);
  }

  click() {
    if (!this.sfxEnabled) return;
    this.tone(660, 0.06, "triangle", 0.1, 900);
  }

  purchase() {
    if (!this.sfxEnabled) return;
    [0, 7, 12, 19].forEach((s, i) => this.tone(NOTE(s + 12), 0.18, "triangle", 0.12, undefined, i * 0.06));
  }

  win() {
    if (!this.sfxEnabled) return;
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(NOTE(s + 7), 0.3, "square", 0.08, undefined, i * 0.09));
  }

  lose() {
    if (!this.sfxEnabled) return;
    [7, 5, 3, 0].forEach((s, i) => this.tone(NOTE(s), 0.35, "triangle", 0.14, undefined, i * 0.16));
  }

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 50);
  }

  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic() {
    if (!this.ctx || !this.musicGain) return;
    const stepLength = 60 / 118 / 4;
    while (this.nextStepTime < this.ctx.currentTime + 0.15) {
      const delay = Math.max(0, this.nextStepTime - this.ctx.currentTime);
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % 8;
      if (s % 4 === 0) this.tone(120, 0.18, "sine", 0.5, 40, delay, this.musicGain);
      if (s % 2 === 1) this.burst(0.04, 0.08, 9000, delay, this.musicGain, 1.5);
      if (s === 4 || s === 12) this.burst(0.12, 0.12 + this.intensity * 0.1, 2000, delay, this.musicGain, 0.7);
      if (s % 2 === 0) this.tone(NOTE(BASS_LINE[bar] - 12) / 2, stepLength * 1.6, "triangle", 0.22, undefined, delay, this.musicGain);
      if (this.intensity > 0.2 && s % 2 === 0) {
        const note = SCALE[(s / 2 + bar * 3) % SCALE.length] + BASS_LINE[bar];
        this.tone(NOTE(note + 12), stepLength * 0.9, "square", 0.035 + this.intensity * 0.03, undefined, delay, this.musicGain);
      }
      this.nextStepTime += stepLength;
      this.step++;
    }
  }
}

export const audio = new AudioEngine();
