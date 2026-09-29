import { Vector3, WebGLRenderer } from "three";
import { audio } from "../audio/AudioEngine";
import { createBotBrain, createBots } from "../ai/roster";
import { sizeLevelForScore } from "../config/constants";
import { DEFAULT_SOLO_STARS, type Difficulty, type GameMode } from "../config/levels";
import type { SkinId } from "../config/skins";
import type { ThemeId } from "../config/themes";
import { Rng } from "../core/rng";
import { World, type HoleSetup } from "../core/World";
import { haptics } from "../input/haptics";
import { HumanInput, type JoystickState } from "../input/HumanInput";
import { ClientSync } from "../net/ClientSync";
import { HostSync, RemoteController } from "../net/HostSync";
import type { HoleStats, MatchStart } from "../net/protocol";
import type { Room } from "../net/Room";
import { isMobileDevice, qualitySettings, type QualityLevel, type QualitySettings } from "../render/quality";
import { SceneView } from "../render/SceneView";
import type { FeedItem, HudSnapshot, LeaderboardRow, MatchResult } from "./types";

export interface NetMatch {
  room: Room;
  start: MatchStart;
}

export interface MatchConfig {
  mode: GameMode;
  themeId: ThemeId;
  duration: number;
  blocksPerSide: number;
  seed: number;
  bots: number;
  difficulty: Difficulty;
  levelId: number | null;
  /** Present for online matches. */
  net?: NetMatch;
}

export interface SessionOptions {
  canvas: HTMLCanvasElement;
  overlay: HTMLElement;
  quality: QualityLevel;
  playerName: string;
  playerSkin: SkinId;
  /** null starts an attract-mode demo where only bots play. */
  match: MatchConfig | null;
  demoTheme?: ThemeId;
  onHud?: (hud: HudSnapshot) => void;
  onFeed?: (item: FeedItem) => void;
  onEnd?: (result: MatchResult) => void;
  onDemoEnd?: () => void;
  /** Online: distance in meters from the player's hole to each remote player's hole. */
  onProximity?: (distances: Map<string, number>) => void;
}

const FIXED_DT = 1 / 60;
const COUNTDOWN = 3;
const DEMO_DURATION = 150;
/** Phones render at most ~90 fps: 120 Hz screens drop to 60, which saves a lot of battery. */
const MOBILE_MIN_FRAME_MS = 1000 / 90 - 1.5;
/** Adaptive resolution never renders blurrier than this many pixels per CSS pixel. */
const MIN_PIXEL_RATIO = 0.7;

/** Creates the WebGL renderer once per canvas (reused across sessions). */
export function createRenderer(canvas: HTMLCanvasElement, quality: QualityLevel) {
  const q = qualitySettings(quality);
  const renderer = new WebGLRenderer({
    canvas,
    antialias: !q.postprocessing,
    stencil: true,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = q.shadows;
  return renderer;
}

/** Hole setups for an online match, in roster order (hole id = roster index). */
function netHoles(net: NetMatch, rng: Rng) {
  const { room, start } = net;
  const remotes = new Map<string, { holeId: number; controller: RemoteController }>();
  const holes: HoleSetup[] = start.roster.map((entry, i) => {
    const isMe = entry.peerId === room.myPeerId;
    let controller: HoleSetup["controller"] = null;
    if (room.isHost && !isMe) {
      if (entry.peerId === null) {
        controller = createBotBrain(i, start.difficulty, rng);
      } else {
        const remote = new RemoteController();
        remotes.set(entry.peerId, { holeId: i, controller: remote });
        controller = remote;
      }
    }
    return { name: entry.name, skinId: entry.skinId, isPlayer: isMe, controller };
  });
  return { holes, remotes };
}

/**
 * One running match (or menu demo): owns the world simulation, the scene view,
 * player input and the frame loop, and reports HUD state to the UI. Online, the host's
 * session is authoritative (HostSync) and clients run a replica (ClientSync).
 */
export class GameSession {
  readonly world: World;
  readonly view: SceneView;
  private readonly input: HumanInput | null;
  private readonly playerId: number | null;
  private readonly featuredId: number | null;
  private readonly isDemo: boolean;
  private readonly net: NetMatch | null;
  private readonly hostSync: HostSync | null = null;
  private readonly clientSync: ClientSync | null = null;
  private readonly botIds: Set<number>;
  private frame = 0;
  private backgroundTimer = 0;
  private lastTime = 0;
  private accumulator = 0;
  private countdown = COUNTDOWN;
  private lastCountdownTick = COUNTDOWN + 1;
  private paused = false;
  private ended = false;
  private disposed = false;
  private hudTimer = 0;
  private proximityTimer = 0;
  private popupPoints = 0;
  private popupTimer = 0;
  private readonly screenPos = new Vector3();
  private readonly quality: QualitySettings;
  private resolutionScale = 1;
  private resolutionCeiling = 1;
  private perfWarmup = 2;
  private perfTime = 0;
  private perfFrames = 0;
  private perfMin = Infinity;
  private perfMax = 0;
  private perfSmoothFor = 0;

  constructor(
    renderer: WebGLRenderer,
    private readonly options: SessionOptions,
  ) {
    const { match } = options;
    this.isDemo = match === null;
    this.net = match?.net ?? null;
    const seed = this.net?.start.seed ?? match?.seed ?? Math.floor(Math.random() * 1e9);
    const rng = new Rng(seed ^ 0x5bd1e995);

    let holes: HoleSetup[];
    let remotes = new Map<string, { holeId: number; controller: RemoteController }>();
    if (this.net) {
      ({ holes, remotes } = netHoles(this.net, rng));
      this.botIds = new Set(this.net.start.roster.flatMap((e, i) => (e.peerId === null ? [i] : [])));
    } else if (match) {
      holes = match.mode === "solo" ? [] : createBots(match.bots, match.difficulty, rng, options.playerSkin);
      holes.splice(rng.int(0, holes.length), 0, { name: options.playerName, skinId: options.playerSkin, isPlayer: true, controller: null });
      this.botIds = new Set(holes.flatMap((h, i) => (h.isPlayer ? [] : [i])));
    } else {
      holes = createBots(9, "hard", rng, options.playerSkin);
      holes[0] = { ...holes[0], name: options.playerName, skinId: options.playerSkin };
      this.botIds = new Set(holes.map((_, i) => i));
    }

    const start = this.net?.start;
    this.world = new World({
      seed,
      themeId: start?.themeId ?? match?.themeId ?? options.demoTheme ?? "metro",
      mode: start?.mode ?? match?.mode ?? "classic",
      duration: start?.duration ?? match?.duration ?? DEMO_DURATION,
      blocksPerSide: start?.blocksPerSide ?? match?.blocksPerSide ?? 5,
      holes,
      replica: this.net ? !this.net.room.isHost : false,
    });

    this.playerId = this.world.player?.id ?? null;
    if (this.net && this.playerId !== null) {
      if (this.net.room.isHost) this.hostSync = new HostSync(this.net.room, this.world, remotes, this.net.start.difficulty, rng);
      else this.clientSync = new ClientSync(this.net.room, this.world, this.playerId);
    }

    this.featuredId = this.isDemo ? 0 : null;
    this.quality = qualitySettings(options.quality);
    this.view = new SceneView(renderer, this.world, {
      quality: this.quality,
      overlay: options.overlay,
      focusId: this.playerId,
    });
    this.input = this.isDemo ? null : new HumanInput(options.overlay);

    if (this.isDemo) {
      this.world.running = true;
      this.countdown = 0;
    }
    this.resize();
  }

  get joystick(): JoystickState | null {
    return this.input?.joystick ?? null;
  }

  get isOnline() {
    return this.net !== null;
  }

  start() {
    const minFrameMs = isMobileDevice() ? MOBILE_MIN_FRAME_MS : 0;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      this.frame = requestAnimationFrame(loop);
      if (now - this.lastTime < minFrameMs) return;
      // rAF timestamps can predate performance.now() after heavy setup work: never go backwards.
      const frameTime = (now - this.lastTime) / 1000;
      this.lastTime = now;
      this.adaptResolution(frameTime);
      this.tick(Math.max(0, Math.min(0.1, frameTime)));
    };
    this.frame = requestAnimationFrame(loop);

    // Browsers stop rAF in background tabs; an online host must keep simulating.
    if (this.hostSync) {
      this.backgroundTimer = window.setInterval(() => {
        if (!document.hidden) return;
        const now = performance.now();
        const dt = Math.min(1, (now - this.lastTime) / 1000);
        this.lastTime = now;
        this.simulate(dt, 60);
      }, 250);
    }
  }

  /** Online matches can't be paused: the world keeps going for everyone else. */
  pause() {
    if (this.isDemo || this.ended || this.net) return;
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.lastTime = performance.now();
  }

  get isPaused() {
    return this.paused;
  }

  resize() {
    const { canvas } = this.options;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const base = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio);
    const ratio = Math.max(Math.min(base, MIN_PIXEL_RATIO), base * this.resolutionScale);
    this.view.resize(width, height, ratio);
  }

  /** Fraction of the full resolution currently rendered (adaptive resolution). */
  get renderScale() {
    return this.resolutionScale;
  }

  /**
   * Adaptive resolution: renders fewer pixels while frames run slow (phones, weak
   * laptops) and gives them back once there is headroom. A scale that proved too slow
   * is never retried, so it settles instead of oscillating.
   */
  private adaptResolution(frameTime: number) {
    if (frameTime <= 0 || frameTime > 1) return; // back from a hidden tab or a long stall
    if (this.perfWarmup > 0) {
      this.perfWarmup -= frameTime; // shader compilation right after setup
      return;
    }
    this.perfTime += frameTime;
    this.perfFrames++;
    this.perfMin = Math.min(this.perfMin, frameTime);
    this.perfMax = Math.max(this.perfMax, frameTime);
    if (this.perfTime < 1) return;
    const fps = this.perfFrames / this.perfTime;
    // An evenly paced ~30 fps is the OS frame cap (e.g. iPhone Low Power Mode), not a
    // struggling GPU: fewer pixels wouldn't make it any faster.
    const osCapped = fps > 27 && fps < 33 && this.perfMax - this.perfMin < 0.004;
    this.perfTime = 0;
    this.perfFrames = 0;
    this.perfMin = Infinity;
    this.perfMax = 0;
    if (osCapped) return;

    const base = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio);
    const minScale = Math.min(1, Math.max(0.45, MIN_PIXEL_RATIO / base));
    if (fps < 45 && this.resolutionScale > minScale) {
      this.resolutionCeiling = Math.max(minScale, this.resolutionScale - 0.05);
      this.setResolutionScale(Math.max(minScale, this.resolutionScale - 0.15));
    } else if (fps > 56 && this.resolutionScale < this.resolutionCeiling) {
      if (++this.perfSmoothFor >= 5) this.setResolutionScale(Math.min(this.resolutionCeiling, this.resolutionScale + 0.1));
    } else {
      this.perfSmoothFor = 0;
    }
  }

  private setResolutionScale(scale: number) {
    this.resolutionScale = scale;
    this.perfSmoothFor = 0;
    this.resize();
  }

  /** Menu helpers: preview a skin on the featured demo hole. */
  previewSkin(skinId: SkinId) {
    if (this.featuredId !== null) this.view.setHoleSkin(this.featuredId, skinId);
  }

  /** `shiftX`/`shiftY` move the featured hole on screen (see CameraRig.setScreenShift). */
  setCloseUp(enabled: boolean, shiftX = 0, shiftY = 0) {
    this.view.closeUp = enabled;
    this.view.rig.setScreenShift(enabled ? shiftX : 0, enabled ? shiftY : 0);
    if (enabled && this.featuredId !== null) this.view.setFocus(this.featuredId);
  }

  private simulate(dt: number, maxSteps: number) {
    if (this.countdown > 0) this.updateCountdown(dt);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < maxSteps) {
      this.step();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === maxSteps) this.accumulator = 0;
  }

  private tick(dt: number) {
    if (!this.paused) {
      this.simulate(dt, 5);
      this.view.update(dt);
      this.updatePopups(dt);
      this.updateProximity(dt);
    }
    this.view.render();

    this.hudTimer -= dt;
    if (this.hudTimer <= 0 && !this.isDemo) {
      this.hudTimer = 0.1;
      this.options.onHud?.(this.snapshot());
    }
  }

  private updateCountdown(dt: number) {
    this.countdown = Math.max(0, this.countdown - dt);
    const tick = Math.ceil(this.countdown);
    if (tick < this.lastCountdownTick) {
      this.lastCountdownTick = tick;
      audio.countdown(tick === 0);
      if (tick === 0) {
        if (!this.clientSync) this.world.running = true;
        audio.startMusic();
      }
    }
  }

  private step() {
    const player = this.playerId !== null ? this.world.holes[this.playerId] : null;
    if (player && this.input) {
      this.screenPos.set(player.x, 0, player.z).project(this.view.rig.camera);
      const rect = this.options.overlay.getBoundingClientRect();
      this.input.setOrigin((this.screenPos.x * 0.5 + 0.5) * rect.width, (-this.screenPos.y * 0.5 + 0.5) * rect.height);
      const { x, z, throttle } = this.input.read();
      player.input.x = x;
      player.input.z = z;
      player.input.throttle = throttle;
    }

    let hostEvents: ReturnType<ClientSync["takeEvents"]> = [];
    if (this.clientSync) {
      this.clientSync.beforeStep(FIXED_DT);
      hostEvents = this.clientSync.takeEvents();
    }

    this.world.step(FIXED_DT);
    if (hostEvents.length) this.world.events.push(...hostEvents);
    this.hostSync?.afterStep(FIXED_DT, this.world.events);

    this.view.handleEvents(this.world.events);
    this.processEvents();
    this.world.events.length = 0;

    const endedOnline = this.clientSync?.endMessage != null;
    if ((this.world.finished || endedOnline) && !this.ended) this.finish();
  }

  private processEvents() {
    const holes = this.world.holes;
    for (const e of this.world.events) {
      switch (e.type) {
        case "objectEaten":
          if (e.holeId === this.playerId) {
            audio.swallow(e.value);
            if (e.value >= 40) haptics.pulse(e.value >= 400 ? [35, 30, 35] : e.value >= 110 ? 24 : 12);
            this.popupPoints += e.value;
            if (e.combo > 0 && e.combo % 10 === 0) {
              this.view.popup(`COMBO ×${e.combo}`, "is-combo");
              audio.combo(e.combo / 10);
            }
          }
          break;
        case "levelUp":
          if (e.holeId === this.playerId) {
            audio.levelUp();
            haptics.pulse([18, 40, 18]);
            this.options.onFeed?.({ kind: "levelUp", level: e.level });
          }
          break;
        case "holeEaten": {
          const eater = holes[e.eaterId];
          const victim = holes[e.victimId];
          const involvesPlayer = eater.id === this.playerId || victim.id === this.playerId;
          if (!this.isDemo) audio.holeEaten(involvesPlayer);
          if (eater.id === this.playerId) haptics.pulse([30, 40, 60], 0);
          else if (victim.id === this.playerId) haptics.pulse(220, 0);
          if (eater.id === this.playerId) this.view.popup(`+${Math.round(e.gain)} ATE ${victim.name.toUpperCase()}!`, "is-kill");
          this.options.onFeed?.({
            kind: "kill",
            eater: eater.name,
            eaterSkin: eater.skinId,
            victim: victim.name,
            victimSkin: victim.skinId,
            byPlayer: eater.id === this.playerId,
            ofPlayer: victim.id === this.playerId,
          });
          break;
        }
        case "matchEnd":
          if (this.isDemo) this.options.onDemoEnd?.();
          break;
        default:
          break;
      }
    }
  }

  private updatePopups(dt: number) {
    this.popupTimer -= dt;
    if (this.popupTimer <= 0 && this.popupPoints > 0) {
      this.view.popup(`+${Math.round(this.popupPoints)}`);
      this.popupPoints = 0;
      this.popupTimer = 0.28;
    }
    if (!this.isDemo && this.playerId !== null) {
      const player = this.world.holes[this.playerId];
      audio.setIntensity(Math.min(1, player.radius / 10 + (this.world.timeLeft < 30 ? 0.3 : 0)));
    }
  }

  /** Voice chat gets quieter the further away another player's hole is. */
  private updateProximity(dt: number) {
    if (!this.net || this.playerId === null || !this.options.onProximity) return;
    this.proximityTimer -= dt;
    if (this.proximityTimer > 0) return;
    this.proximityTimer = 0.2;
    const me = this.world.holes[this.playerId];
    const distances = new Map<string, number>();
    this.net.start.roster.forEach((entry, i) => {
      if (entry.peerId && i !== this.playerId) {
        const other = this.world.holes[i];
        distances.set(entry.peerId, Math.max(0, Math.hypot(other.x - me.x, other.z - me.z) - other.radius - me.radius));
      }
    });
    this.options.onProximity(distances);
  }

  private leaderboard(): LeaderboardRow[] {
    return this.world.standings().map(({ hole, rank }) => ({
      id: hole.id,
      rank,
      name: hole.name,
      score: Math.round(hole.score),
      skinId: hole.skinId,
      isPlayer: hole.isPlayer,
      isBot: this.botIds.has(hole.id),
      alive: !hole.eliminated,
    }));
  }

  private snapshot(): HudSnapshot {
    const w = this.world;
    const player = this.playerId !== null ? w.holes[this.playerId] : null;
    const size = sizeLevelForScore(player?.score ?? 0);
    return {
      mode: w.mode,
      online: this.net !== null,
      ping: this.net && !this.net.room.isHost ? this.net.room.rtt : 0,
      countdown: this.countdown,
      timeLeft: w.timeLeft,
      duration: w.duration,
      score: Math.round(player?.score ?? 0),
      rank: player ? w.rankOf(player) : 0,
      holes: w.holes.length,
      holesAlive: w.holes.filter((h) => !h.eliminated).length,
      sizeLevel: size.level,
      sizeProgress: size.progress,
      percent: player ? w.percentEaten(player) : 0,
      alive: player?.alive ?? true,
      respawnIn: player && !player.alive && !player.eliminated ? Math.max(0, player.respawnTimer) : 0,
      eatenBy: player && player.eatenBy >= 0 ? w.holes[player.eatenBy].name : null,
      combo: player?.combo ?? 0,
      leaderboard: this.leaderboard(),
      minimap: w.holes.map((h) => ({ x: h.x / w.half, z: h.z / w.half, r: h.radius / w.half, skinId: h.skinId, isPlayer: h.isPlayer, alive: h.alive })),
      paused: this.paused,
    };
  }

  /** Clients take final stats from the host so everyone sees the same results. */
  private applyFinalStats(stats: HoleStats[]) {
    stats.forEach((s, i) => {
      const hole = this.world.holes[i];
      if (!hole) return;
      Object.assign(hole, {
        score: s.score,
        objectScore: s.objectScore,
        kills: s.kills,
        deaths: s.deaths,
        objectsEaten: s.objectsEaten,
        bestCombo: s.bestCombo,
        sizeLevel: s.sizeLevel,
        eliminated: s.eliminated,
        eliminatedAt: s.eliminatedAt,
        biggestBite: s.biggestBite,
      });
    });
  }

  private finish() {
    this.ended = true;
    audio.stopMusic();
    this.hostSync?.finish();
    if (this.clientSync?.endMessage) this.applyFinalStats(this.clientSync.endMessage.stats);
    if (this.isDemo || this.playerId === null) return;
    const player = this.world.holes[this.playerId];
    const rank = this.world.rankOf(player);
    const result: MatchResult = {
      mode: this.world.mode,
      rank,
      holes: this.world.holes.length,
      score: Math.round(player.score),
      percent: this.world.percentEaten(player),
      kills: player.kills,
      deaths: player.deaths,
      objectsEaten: player.objectsEaten,
      bestCombo: player.bestCombo,
      sizeLevel: player.sizeLevel,
      eliminated: player.eliminated,
      leaderboard: this.leaderboard(),
      biggestBite: player.biggestBite,
    };
    if (rank === 1 || (this.world.mode === "solo" && result.percent >= DEFAULT_SOLO_STARS[0])) {
      audio.win();
      haptics.pulse([40, 60, 40, 60, 90], 0);
    } else {
      audio.lose();
    }
    this.options.onHud?.(this.snapshot());
    this.options.onEnd?.(result);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.clearInterval(this.backgroundTimer);
    audio.stopMusic();
    this.hostSync?.dispose();
    this.clientSync?.dispose();
    this.input?.dispose();
    this.view.dispose();
  }
}
