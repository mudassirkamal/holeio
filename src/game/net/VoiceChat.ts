import type { MediaConnection, Peer } from "peerjs";

export type VoiceMode = "open" | "push";

export interface VoiceState {
  /** The player wants to talk (mic enabled). */
  micOn: boolean;
  /** Audio is actually being sent right now (open mic, or push-to-talk held). */
  transmitting: boolean;
  micError: string | null;
  mode: VoiceMode;
  /** Peer ids (including our own) currently speaking. */
  speaking: string[];
  muted: string[];
  connected: string[];
}

interface Link {
  call: MediaConnection;
  audio: HTMLAudioElement;
  analyser: AnalyserNode | null;
}

const SPEAKING_RMS = 0.018;

/** Full volume within 40 m of another hole, fading to a whisper across the map. */
const proximityGain = (meters: number) => (meters < 40 ? 1 : Math.max(0.12, 1 - (meters - 40) / 180));

/**
 * Voice chat over the room's WebRTC peer: every pair of players shares one audio
 * call. Until the mic is switched on we send a silent track, then swap in the
 * microphone without renegotiating. In matches, volume follows hole distance.
 */
export class VoiceChat {
  private ctx: AudioContext | null = null;
  private silent: MediaStream | null = null;
  private mic: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private readonly links = new Map<string, Link>();
  private readonly muted = new Set<string>();
  private proximity: Map<string, number> | null = null;
  private pushHeld = false;
  private readonly meterTimer: number;
  private readonly meterBuffer = new Float32Array(512);
  private state: VoiceState = { micOn: false, transmitting: false, micError: null, mode: "open", speaking: [], muted: [], connected: [] };

  constructor(
    private readonly peer: Peer,
    private readonly onChange: (state: VoiceState) => void,
  ) {
    peer.on("call", (call) => {
      this.links.get(call.peer)?.call.close();
      call.answer(this.outgoingStream());
      this.attach(call);
    });
    this.meterTimer = window.setInterval(() => this.meter(), 150);
  }

  private audioContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private outgoingStream(): MediaStream {
    if (this.mic) return this.mic;
    this.silent ??= this.audioContext().createMediaStreamDestination().stream;
    return this.silent;
  }

  /** Opens/closes audio links so we're connected to exactly these peers. */
  syncPeers(peerIds: readonly string[]) {
    const myId = this.peer.id;
    for (const id of peerIds) {
      // One call per pair: the peer with the larger id dials.
      if (id !== myId && !this.links.has(id) && myId > id && this.peer.open) {
        this.attach(this.peer.call(id, this.outgoingStream()));
      }
    }
    for (const id of [...this.links.keys()]) if (!peerIds.includes(id)) this.dropLink(id);
  }

  private attach(call: MediaConnection) {
    const audio = new Audio();
    audio.autoplay = true;
    const link: Link = { call, audio, analyser: null };
    this.links.set(call.peer, link);
    call.on("stream", (stream) => {
      audio.srcObject = stream;
      void audio.play().catch(() => {});
      const ctx = this.audioContext();
      link.analyser = ctx.createAnalyser();
      link.analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(link.analyser);
      this.applyVolume(call.peer);
      this.publish();
    });
    call.on("close", () => this.dropLink(call.peer, call));
    call.on("error", () => this.dropLink(call.peer, call));
  }

  private dropLink(peerId: string, call?: MediaConnection) {
    const link = this.links.get(peerId);
    if (!link || (call && link.call !== call)) return;
    this.links.delete(peerId);
    link.call.close();
    link.audio.srcObject = null;
    this.publish();
  }

  async setMicOn(on: boolean) {
    if (on && !this.mic) {
      if (!navigator.mediaDevices?.getUserMedia) {
        this.state.micError = "Voice chat needs a secure (https) page.";
        return this.publish();
      }
      try {
        this.mic = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        this.state.micError = "Microphone access was blocked.";
        return this.publish();
      }
      this.state.micError = null;
      const track = this.mic.getAudioTracks()[0];
      for (const { call } of this.links.values()) {
        const sender = call.peerConnection?.getSenders().find((s) => s.track?.kind === "audio" || s.track === null);
        void sender?.replaceTrack(track);
      }
      const ctx = this.audioContext();
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 512;
      ctx.createMediaStreamSource(this.mic).connect(this.micAnalyser);
    }
    this.state.micOn = on;
    this.updateTransmit();
  }

  setMode(mode: VoiceMode) {
    this.state.mode = mode;
    this.updateTransmit();
  }

  /** Push-to-talk key/button state. */
  setPushHeld(held: boolean) {
    if (this.pushHeld === held) return;
    this.pushHeld = held;
    this.updateTransmit();
  }

  private updateTransmit() {
    const transmitting = this.state.micOn && (this.state.mode === "open" || this.pushHeld);
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = transmitting));
    this.state.transmitting = transmitting && this.mic !== null;
    this.publish();
  }

  setMuted(peerId: string, muted: boolean) {
    if (muted) this.muted.add(peerId);
    else this.muted.delete(peerId);
    this.applyVolume(peerId);
    this.publish();
  }

  /** Distances to other players' holes in meters, or null for full volume (lobby). */
  setProximity(distances: Map<string, number> | null) {
    this.proximity = distances;
    for (const id of this.links.keys()) this.applyVolume(id);
  }

  private applyVolume(peerId: string) {
    const link = this.links.get(peerId);
    if (!link) return;
    const distance = this.proximity?.get(peerId);
    const gain = this.muted.has(peerId) ? 0 : distance === undefined ? 1 : proximityGain(distance);
    link.audio.volume = gain;
  }

  private meter() {
    const speaking: string[] = [];
    const buffer = this.meterBuffer;
    const loud = (analyser: AnalyserNode | null) => {
      if (!analyser) return false;
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
      return Math.sqrt(sum / buffer.length) > SPEAKING_RMS;
    };
    if (this.state.transmitting && loud(this.micAnalyser)) speaking.push(this.peer.id);
    for (const [id, link] of this.links) if (!this.muted.has(id) && loud(link.analyser)) speaking.push(id);
    if (speaking.join() !== this.state.speaking.join()) {
      this.state.speaking = speaking;
      this.publish();
    }
  }

  private publish() {
    this.state = {
      ...this.state,
      muted: [...this.muted],
      connected: [...this.links.entries()].filter(([, l]) => l.analyser).map(([id]) => id),
    };
    this.onChange(this.state);
  }

  destroy() {
    window.clearInterval(this.meterTimer);
    for (const id of [...this.links.keys()]) this.dropLink(id);
    this.mic?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
  }
}
