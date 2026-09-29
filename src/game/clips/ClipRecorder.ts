import type { VideoCodec } from "mediabunny";
import { PcmRing } from "./PcmRing";

const FPS = 30;
const FRAME_MS = 1000 / FPS;
/** Seconds of encoded video kept in memory; clips are cut from this window. */
const BUFFER_SECONDS = 14;

interface CodecChoice {
  /** WebCodecs codec string. */
  codec: string;
  /** Mediabunny codec name. */
  name: VideoCodec;
  container: "mp4" | "webm";
}

/** H.264 in MP4 plays and shares everywhere (WhatsApp, Instagram, iOS); VP9/VP8 WebM is the fallback. */
const CODECS: readonly CodecChoice[] = [
  { codec: "avc1.42001f", name: "avc", container: "mp4" },
  { codec: "vp09.00.10.08", name: "vp9", container: "webm" },
  { codec: "vp8", name: "vp8", container: "webm" },
];

interface RecordedFrame {
  chunk: EncodedVideoChunk;
  /** Capture time on the performance.now() clock. */
  timeMs: number;
}

/** Where game audio comes from (the audio engine). */
export interface AudioCapture {
  capture(onBlock: (left: Float32Array, right: Float32Array, startMs: number) => void): (() => void) | null;
  readonly sampleRate: number;
}

export interface ClipFile {
  blob: Blob;
  mimeType: string;
  extension: string;
  durationS: number;
}

export type OverlayPainter = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Keeps the last few seconds of gameplay encoded — a keyframe every second — so a
 * highlight can be cut out instantly and saved as a video file without re-encoding.
 * Frames are copied from the game canvas at 30 fps, scaled down, with an overlay.
 */
export class ClipRecorder {
  static get supported() {
    return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
  }

  private readonly canvas = document.createElement("canvas");
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly startMs = performance.now();
  private encoder: VideoEncoder | null = null;
  private choice: CodecChoice | null = null;
  private decoderConfig: VideoDecoderConfig | null = null;
  private frames: RecordedFrame[] = [];
  private frameIndex = 0;
  private lastCaptureMs = -Infinity;
  private configuring = false;
  private failures = 0;
  private audioCodec: "aac" | "opus" | null = null;
  private audioRing: PcmRing | null = null;
  private stopAudio: (() => void) | null = null;
  private disposed = false;

  constructor(
    private readonly source: HTMLCanvasElement,
    private readonly maxLongSide: number,
    private readonly audio: AudioCapture | null,
  ) {
    this.ctx2d = this.canvas.getContext("2d")!;
    if (audio) void this.pickAudioCodec();
  }

  private async pickAudioCodec() {
    const probe = (codec: string) =>
      AudioEncoder.isConfigSupported({ codec, sampleRate: this.audio!.sampleRate, numberOfChannels: 2, bitrate: 128_000 })
        .then((r) => r.supported === true)
        .catch(() => false);
    if (typeof AudioEncoder === "undefined") return;
    if (await probe("mp4a.40.2")) this.audioCodec = "aac";
    else if (await probe("opus")) this.audioCodec = "opus";
  }

  /** Capture size: the canvas aspect ratio at a fixed resolution (stable while resolution adapts). */
  private targetSize(): [number, number] {
    const w = this.source.clientWidth || this.source.width;
    const h = this.source.clientHeight || this.source.height;
    const long = Math.min(this.maxLongSide, Math.max(w, h) * Math.min(2, window.devicePixelRatio || 1));
    const scale = long / Math.max(w, h);
    const round8 = (v: number) => Math.max(16, Math.round((v * scale) / 8) * 8);
    return [round8(w), round8(h)];
  }

  private async configure(width: number, height: number) {
    this.configuring = true;
    this.encoder?.close();
    this.encoder = null;
    this.frames = [];
    this.decoderConfig = null;
    this.frameIndex = 0;
    const bitrate = Math.min(5_000_000, Math.round(width * height * FPS * 0.12));
    for (const choice of CODECS) {
      const config: VideoEncoderConfig = {
        codec: choice.codec,
        width,
        height,
        bitrate,
        framerate: FPS,
        latencyMode: "realtime",
        ...(choice.name === "avc" ? { avc: { format: "avc" as const } } : {}),
      };
      const supported = await VideoEncoder.isConfigSupported(config)
        .then((r) => r.supported === true)
        .catch(() => false);
      if (!supported || this.disposed) continue;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => this.onChunk(chunk, meta),
        error: () => {
          this.encoder = null;
          this.failures++;
        },
      });
      encoder.configure(config);
      this.encoder = encoder;
      this.choice = choice;
      this.canvas.width = width;
      this.canvas.height = height;
      break;
    }
    if (!this.encoder) this.failures = Infinity; // nothing this browser can encode
    this.configuring = false;
  }

  private onChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) {
    if (meta?.decoderConfig) this.decoderConfig = meta.decoderConfig;
    const timeMs = this.startMs + chunk.timestamp / 1000;
    this.frames.push({ chunk, timeMs });
    // Forget footage older than the buffer, always keeping a keyframe to start from.
    const cutoff = timeMs - BUFFER_SECONDS * 1000;
    if (this.frames[0].timeMs >= cutoff) return;
    let keep = 0;
    for (let i = 0; i < this.frames.length && this.frames[i].timeMs < cutoff; i++) if (this.frames[i].chunk.type === "key") keep = i;
    if (keep > 0) this.frames.splice(0, keep);
  }

  private attachAudio() {
    if (this.stopAudio || !this.audio || !this.audioCodec) return;
    const stop = this.audio.capture((left, right, startMs) => this.audioRing?.push(left, right, startMs));
    if (!stop) return;
    this.audioRing = new PcmRing(this.audio.sampleRate, BUFFER_SECONDS + 2);
    this.stopAudio = stop;
  }

  /** Call right after the game renders a frame (the WebGL buffer is only readable then). */
  capture(nowMs: number, paint?: OverlayPainter) {
    if (this.disposed || this.configuring || this.failures > 3) return;
    if (nowMs - this.lastCaptureMs < FRAME_MS - 4) return;
    const [width, height] = this.targetSize();
    if (!this.encoder || width !== this.canvas.width || height !== this.canvas.height) {
      void this.configure(width, height);
      return;
    }
    if (this.encoder.encodeQueueSize > 2) return; // the encoder is behind: drop this frame
    this.lastCaptureMs = nowMs;
    this.attachAudio();
    this.ctx2d.drawImage(this.source, 0, 0, width, height);
    paint?.(this.ctx2d, width, height);
    const frame = new VideoFrame(this.canvas, { timestamp: Math.round((nowMs - this.startMs) * 1000) });
    this.encoder.encode(frame, { keyFrame: this.frameIndex % FPS === 0 });
    frame.close();
    this.frameIndex++;
  }

  /** Cuts the footage between two performance times into a video file (null if too little). */
  async exportClip(fromMs: number, toMs: number): Promise<ClipFile | null> {
    // Encoded frames arrive a moment after capture: give the tail of the window time to land.
    for (let i = 0; i < 20 && (this.frames.at(-1)?.timeMs ?? 0) < toMs - FRAME_MS * 3; i++) await sleep(50);
    const { choice, decoderConfig } = this;
    if (!choice || !decoderConfig) return null;
    const frames = this.frames;
    let first = frames.findLastIndex((f) => f.chunk.type === "key" && f.timeMs <= fromMs);
    if (first < 0) first = frames.findIndex((f) => f.chunk.type === "key");
    const clip = first < 0 ? [] : frames.slice(first).filter((f) => f.timeMs <= toMs);
    if (clip.length < FPS) return null;

    const { AudioBufferSource, BufferTarget, EncodedPacket, EncodedVideoPacketSource, Mp4OutputFormat, Output, WebMOutputFormat } = await import("mediabunny");
    const t0 = clip[0].timeMs;
    const durationS = (clip[clip.length - 1].timeMs - t0) / 1000 + 1 / FPS;
    const format = choice.container === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat();
    const output = new Output({ format, target: new BufferTarget() });
    const video = new EncodedVideoPacketSource(choice.name);
    output.addVideoTrack(video, { frameRate: FPS });

    // WebM only carries Opus; MP4 prefers AAC for the widest playback.
    const audioCodec = choice.container === "webm" ? (this.audioCodec ? "opus" : null) : this.audioCodec;
    const audioBuffer = audioCodec ? (this.audioRing?.slice(t0, t0 + durationS * 1000) ?? null) : null;
    const audio = audioCodec && audioBuffer ? new AudioBufferSource({ codec: audioCodec, bitrate: 128_000 }) : null;
    if (audio) output.addAudioTrack(audio);

    await output.start();
    for (let i = 0; i < clip.length; i++) {
      const packet = EncodedPacket.fromEncodedChunk(clip[i].chunk).clone({ timestamp: (clip[i].timeMs - t0) / 1000, duration: 1 / FPS });
      await video.add(packet, i === 0 ? { decoderConfig } : undefined);
    }
    if (audio && audioBuffer) await audio.add(audioBuffer);
    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer) return null;
    return { blob: new Blob([buffer], { type: format.mimeType }), mimeType: format.mimeType, extension: format.fileExtension, durationS };
  }

  dispose() {
    this.disposed = true;
    if (this.encoder?.state === "configured") this.encoder.close();
    this.encoder = null;
    this.stopAudio?.();
    this.stopAudio = null;
  }
}
