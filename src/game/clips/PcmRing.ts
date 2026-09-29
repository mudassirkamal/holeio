/**
 * The last few seconds of game audio as raw stereo PCM, stamped on the
 * `performance.now()` clock so it lines up with recorded video frames.
 */
export class PcmRing {
  private readonly left: Float32Array;
  private readonly right: Float32Array;
  private readonly capacity: number;
  /** Total frames ever written; the write position is `written % capacity`. */
  private written = 0;
  /** Performance time (ms) just after the newest sample. */
  private endMs = 0;

  constructor(
    readonly sampleRate: number,
    seconds: number,
  ) {
    this.capacity = Math.ceil(sampleRate * seconds);
    this.left = new Float32Array(this.capacity);
    this.right = new Float32Array(this.capacity);
  }

  /** Appends a block whose first sample played at `startMs`. */
  push(left: Float32Array, right: Float32Array, startMs: number) {
    // Fill gaps (e.g. the context was suspended) with silence to keep the clock in sync.
    if (this.written > 0) {
      const gap = Math.round(((startMs - this.endMs) / 1000) * this.sampleRate);
      if (gap > this.sampleRate * 0.05) this.writeSilence(Math.min(gap, this.capacity));
    }
    for (let i = 0; i < left.length; i++) {
      const at = (this.written + i) % this.capacity;
      this.left[at] = left[i];
      this.right[at] = right[i];
    }
    this.written += left.length;
    this.endMs = startMs + (left.length / this.sampleRate) * 1000;
  }

  private writeSilence(frames: number) {
    for (let i = 0; i < frames; i++) {
      const at = (this.written + i) % this.capacity;
      this.left[at] = 0;
      this.right[at] = 0;
    }
    this.written += frames;
  }

  /** Audio between two performance times, or null if none of it is still buffered. */
  slice(fromMs: number, toMs: number): AudioBuffer | null {
    const framesAgo = (ms: number) => Math.round(((this.endMs - ms) / 1000) * this.sampleRate);
    const oldest = this.written - Math.min(this.written, this.capacity);
    const start = Math.max(oldest, this.written - framesAgo(fromMs));
    const end = Math.min(this.written, this.written - framesAgo(toMs));
    if (end - start < this.sampleRate * 0.5) return null;
    const buffer = new AudioBuffer({ numberOfChannels: 2, length: end - start, sampleRate: this.sampleRate });
    const l = buffer.getChannelData(0);
    const r = buffer.getChannelData(1);
    for (let i = start; i < end; i++) {
      const at = i % this.capacity;
      l[i - start] = this.left[at];
      r[i - start] = this.right[at];
    }
    // Pad the front with silence if the video starts before the buffered audio.
    const lead = start - (this.written - framesAgo(fromMs));
    if (lead <= 0) return buffer;
    const padded = new AudioBuffer({ numberOfChannels: 2, length: buffer.length + lead, sampleRate: this.sampleRate });
    padded.getChannelData(0).set(l, lead);
    padded.getChannelData(1).set(r, lead);
    return padded;
  }
}
