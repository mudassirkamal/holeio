import { Vector3, WebGLRenderer } from "three";
import { audio } from "../audio/AudioEngine";
import { createBots } from "../ai/roster";
import { sizeLevelForScore } from "../config/constants";
import type { Difficulty, GameMode } from "../config/levels";
import type { SkinId } from "../config/skins";
import type { ThemeId } from "../config/themes";
import { Rng } from "../core/rng";
import { World, type HoleSetup } from "../core/World";
import { HumanInput, type JoystickState } from "../input/HumanInput";
import { QUALITY, type QualityLevel } from "../render/quality";
import { SceneView } from "../render/SceneView";
import type { FeedItem, HudSnapshot, LeaderboardRow, MatchResult } from "./types";

export interface MatchConfig {
  mode: GameMode;
  themeId: ThemeId;
  duration: number;
  blocksPerSide: number;
  seed: number;
  bots: number;
  difficulty: Difficulty;
  levelId: number | null;
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
}

const FIXED_DT = 1 / 60;
const COUNTDOWN = 3;
const DEMO_DURATION = 150;

/** Creates the WebGL renderer once per canvas (reused across sessions). */
export function createRenderer(canvas: HTMLCanvasElement, quality: QualityLevel) {
  const q = QUALITY[quality];
  const renderer = new WebGLRenderer({
    canvas,
    antialias: !q.postprocessing,
    stencil: true,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = q.shadows;
  return renderer;
}

/**
 * One running match (or menu demo): owns the world simulation, the scene view,
 * player input and the frame loop, and reports HUD state to the UI.
 */
export class GameSession {
  readonly world: World;
  readonly view: SceneView;
  private readonly input: HumanInput | null;
  private readonly playerId: number | null;
  private readonly featuredId: number | null;
  private readonly isDemo: boolean;
  private frame = 0;
  private lastTime = 0;
  private accumulator = 0;
  private countdown = COUNTDOWN;
  private lastCountdownTick = COUNTDOWN + 1;
  private paused = false;
  private ended = false;
  private disposed = false;
  private hudTimer = 0;
  private popupPoints = 0;
  private popupTimer = 0;
  private readonly screenPos = new Vector3();

  constructor(
    renderer: WebGLRenderer,
    private readonly options: SessionOptions,
  ) {
    const { match } = options;
    this.isDemo = match === null;
    const seed = match?.seed ?? Math.floor(Math.random() * 1e9);
    const rng = new Rng(seed ^ 0x5bd1e995);

    const holes: HoleSetup[] = [];
    if (match && match.mode !== "solo") holes.push(...createBots(match.bots, match.difficulty, rng, options.playerSkin));
    if (match) {
      holes.splice(rng.int(0, holes.length), 0, {
        name: options.playerName,
        skinId: options.playerSkin,
        isPlayer: true,
        controller: null,
      });
    } else {
      holes.push(...createBots(9, "hard", rng, options.playerSkin));
      holes[0] = { ...holes[0], name: options.playerName, skinId: options.playerSkin };
    }

    this.world = new World({
      seed,
      themeId: match?.themeId ?? options.demoTheme ?? "metro",
      mode: match?.mode ?? "classic",
      duration: match?.duration ?? DEMO_DURATION,
      blocksPerSide: match?.blocksPerSide ?? 5,
      holes,
    });

    this.playerId = this.world.player?.id ?? null;
    this.featuredId = this.isDemo ? 0 : null;
    this.view = new SceneView(renderer, this.world, {
      quality: QUALITY[options.quality],
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

  start() {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      this.frame = requestAnimationFrame(loop);
      // rAF timestamps can predate performance.now() after heavy setup work: never go backwards.
      const dt = Math.max(0, Math.min(0.1, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.tick(dt);
    };
    this.frame = requestAnimationFrame(loop);
  }

  pause() {
    if (this.isDemo || this.ended) return;
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
    const ratio = Math.min(window.devicePixelRatio || 1, QUALITY[this.options.quality].maxPixelRatio);
    this.view.resize(width, height, ratio);
  }

  /** Menu helpers: preview a skin on the featured demo hole. */
  previewSkin(skinId: SkinId) {
    if (this.featuredId !== null) this.view.setHoleSkin(this.featuredId, skinId);
  }

  setCloseUp(enabled: boolean) {
    this.view.closeUp = enabled;
    if (enabled && this.featuredId !== null) this.view.setFocus(this.featuredId);
  }

  private tick(dt: number) {
    if (!this.paused) {
      if (this.countdown > 0) this.updateCountdown(dt);
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < 5) {
        this.step();
        this.accumulator -= FIXED_DT;
        steps++;
      }
      if (steps === 5) this.accumulator = 0;
      this.view.update(dt);
      this.updatePopups(dt);
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
        this.world.running = true;
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

    this.world.step(FIXED_DT);
    this.view.handleEvents(this.world.events);
    this.processEvents();
    this.world.events.length = 0;

    if (this.world.finished && !this.ended) this.finish();
  }

  private processEvents() {
    const holes = this.world.holes;
    for (const e of this.world.events) {
      switch (e.type) {
        case "objectEaten":
          if (e.holeId === this.playerId) {
            audio.swallow(e.value);
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
            this.options.onFeed?.({ kind: "levelUp", level: e.level });
          }
          break;
        case "holeEaten": {
          const eater = holes[e.eaterId];
          const victim = holes[e.victimId];
          const involvesPlayer = eater.id === this.playerId || victim.id === this.playerId;
          if (!this.isDemo) audio.holeEaten(involvesPlayer);
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

  private leaderboard(): LeaderboardRow[] {
    return this.world.standings().map(({ hole, rank }) => ({
      id: hole.id,
      rank,
      name: hole.name,
      score: Math.round(hole.score),
      skinId: hole.skinId,
      isPlayer: hole.isPlayer,
      alive: !hole.eliminated,
    }));
  }

  private snapshot(): HudSnapshot {
    const w = this.world;
    const player = this.playerId !== null ? w.holes[this.playerId] : null;
    const size = sizeLevelForScore(player?.score ?? 0);
    return {
      mode: w.mode,
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

  private finish() {
    this.ended = true;
    audio.stopMusic();
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
    if (rank === 1 || (this.world.mode === "solo" && result.percent > 30)) audio.win();
    else audio.lose();
    this.options.onHud?.(this.snapshot());
    this.options.onEnd?.(result);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    audio.stopMusic();
    this.input?.dispose();
    this.view.dispose();
  }
}
