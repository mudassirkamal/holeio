import type { EffectComposer } from "postprocessing";
import {
  AdditiveBlending,
  NeutralToneMapping,
  Color,
  NoToneMapping,
  Scene,
  SRGBColorSpace,
  type WebGLRenderer,
} from "three";
import { KIND } from "../config/objectCatalog";
import { POWER_UPS } from "../config/powerUps";
import { SKIN_BY_ID, type SkinParticles } from "../config/skins";
import { THEMES, type ThemeDef } from "../config/themes";
import type { Hole } from "../core/entities";
import type { GameEvent } from "../core/events";
import type { World } from "../core/World";
import { createBorder } from "./border";
import { CameraRig } from "./CameraRig";
import { ParticleSystem } from "./effects/ParticleSystem";
import { Shockwaves } from "./effects/Shockwaves";
import { Environment } from "./environment";
import { createGround } from "./ground";
import { HoleView } from "./HoleView";
import { LabelLayer } from "./LabelLayer";
import { createCityMaterial } from "./materials/cityMaterial";
import { ObjectLayer, createScenery } from "./ObjectLayer";
import { createComposer } from "./postprocessing";
import { PowerUpLayer } from "./PowerUpLayer";
import type { QualitySettings } from "./quality";

export interface SceneViewOptions {
  quality: QualitySettings;
  overlay: HTMLElement | null;
  /** Hole the camera follows (the player); null for attract/demo mode. */
  focusId: number | null;
}

const TRAIL_SETTINGS: Record<Exclude<SkinParticles, "none">, { up: number; gravity: number; life: number; size: number; additive: boolean; color: 0 | 1 | 2 }> = {
  sparkles: { up: 2.2, gravity: 0.5, life: 0.9, size: 0.35, additive: true, color: 2 },
  embers: { up: 3.2, gravity: -1.5, life: 1.2, size: 0.4, additive: true, color: 0 },
  snow: { up: 1.4, gravity: 1.2, life: 1.4, size: 0.35, additive: false, color: 2 },
  bubbles: { up: 2.5, gravity: -0.8, life: 1.0, size: 0.4, additive: true, color: 2 },
  stars: { up: 1.8, gravity: 0, life: 1.1, size: 0.3, additive: true, color: 2 },
  petals: { up: 1.6, gravity: 0.6, life: 1.6, size: 0.45, additive: false, color: 0 },
};

/** Renders one match: city, holes, effects, labels and camera. */
export class SceneView {
  readonly scene = new Scene();
  readonly rig: CameraRig;
  private readonly theme: ThemeDef;
  private readonly composer: EffectComposer | null;
  private readonly env: Environment;
  private readonly ground: ReturnType<typeof createGround>;
  private readonly objects: ObjectLayer;
  private readonly scenery: ReturnType<typeof createScenery>;
  private readonly border: ReturnType<typeof createBorder>;
  private readonly cityMaterial: ReturnType<typeof createCityMaterial>;
  private readonly holeViews: HoleView[];
  private readonly dust: ParticleSystem;
  private readonly sparks: ParticleSystem;
  private readonly shockwaves = new Shockwaves();
  private readonly powerUps = new PowerUpLayer();
  private readonly labels: LabelLayer | null;
  private time = 0;
  private width = 1;
  private height = 1;
  private pixelRatio = 1;
  private focusId: number | null;
  private demoSwitchTimer = 0;
  private trailBudget = 0;
  closeUp = false;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly world: World,
    private readonly options: SceneViewOptions,
  ) {
    const q = options.quality;
    this.theme = THEMES[world.layout.themeId];
    this.focusId = options.focusId;
    this.rig = new CameraRig(1);

    renderer.shadowMap.enabled = q.shadows;
    renderer.toneMapping = q.postprocessing ? NoToneMapping : NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = SRGBColorSpace;

    this.env = new Environment(this.scene, this.theme, renderer, { enabled: q.shadows, mapSize: q.shadowMapSize });
    this.ground = createGround(world.layout, this.theme, { textureSize: q.groundTexture, renderer });
    this.scene.add(this.ground.group);

    this.cityMaterial = createCityMaterial(this.theme.lighting);
    this.objects = new ObjectLayer(world, this.theme, this.cityMaterial.material, q.shadows);
    this.scene.add(this.objects.group);
    this.scenery = createScenery(world, this.theme, this.cityMaterial.material, q.shadows);
    this.scene.add(this.scenery.group);
    this.border = createBorder(world.half, this.theme, this.cityMaterial.material, q.shadows);
    this.scene.add(this.border.group);

    this.holeViews = world.holes.map((hole) => {
      const view = new HoleView(hole.skinId);
      this.scene.add(view.group);
      return view;
    });

    this.dust = new ParticleSystem(Math.round(q.particles * 0.5));
    this.sparks = new ParticleSystem(q.particles, AdditiveBlending);
    this.scene.add(this.dust.points, this.sparks.points, this.shockwaves.group, this.powerUps.group);

    this.labels = options.overlay ? new LabelLayer(options.overlay) : null;
    this.composer = q.postprocessing ? createComposer(renderer, this.scene, this.rig.camera, q, this.theme.lighting) : null;

    const focus = this.focusHole();
    this.rig.snap(focus?.x ?? 0, focus?.z ?? 0, focus?.radius ?? 6);
  }

  setFocus(holeId: number | null) {
    this.focusId = holeId;
  }

  private focusHole(): Hole | null {
    if (this.focusId !== null) return this.world.holes[this.focusId] ?? null;
    return this.world.standings()[0]?.hole ?? null;
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.rig.setViewport(width, height);
    this.dust.setPixelRatio(pixelRatio);
    this.sparks.setPixelRatio(pixelRatio);
  }

  /** Visual reactions to simulation events. */
  handleEvents(events: readonly GameEvent[]) {
    const holes = this.world.holes;
    for (const e of events) {
      switch (e.type) {
        case "fallStart": {
          const kind = KIND[e.kindId];
          if (kind.value >= 20 && this.isNearCamera(e.x, e.z)) {
            this.dust.emit({ x: e.x, y: 0.3, z: e.z, count: Math.min(40, 8 + kind.value / 12), color: "#d8d2c4", speed: kind.footRadius * 1.4 + 2, up: 2, size: 1 + kind.footRadius * 0.25, life: 1.1, gravity: 1, drag: 2.5 });
          }
          break;
        }
        case "objectEaten": {
          const hole = holes[e.holeId];
          if (hole.id === this.focusId) {
            const skin = SKIN_BY_ID[hole.skinId];
            this.sparks.emit({ x: hole.x, y: 0.2, z: hole.z, ring: hole.radius * 0.9, count: 3 + Math.min(12, e.value / 8), color: skin.colors[2], speed: 1.5, up: 3 + hole.radius * 0.2, size: 0.35 + hole.radius * 0.03, life: 0.7, gravity: 2 });
            const kind = KIND[e.kindId];
            if (kind.value >= 90) this.rig.addShake(Math.min(1, kind.value / 800));
          }
          break;
        }
        case "levelUp": {
          const hole = holes[e.holeId];
          if (this.isNearCamera(hole.x, hole.z)) {
            const color = SKIN_BY_ID[hole.skinId].colors[0];
            this.shockwaves.spawn(hole.x, hole.z, hole.radius, hole.radius * 2.6, color, 0.9);
            this.sparks.emit({ x: hole.x, y: 0.3, z: hole.z, ring: hole.radius, count: 40, color, speed: 4, up: 5, size: 0.5 + hole.radius * 0.04, life: 0.9, gravity: 4 });
          }
          break;
        }
        case "holeEaten": {
          const victim = holes[e.victimId];
          const eater = holes[e.eaterId];
          this.holeViews[victim.id].onEaten(eater.x, eater.z);
          const color = SKIN_BY_ID[victim.skinId].colors[0];
          this.sparks.emit({ x: e.x, y: 0.5, z: e.z, count: 90, color, speed: 9 + victim.radius, up: 7, size: 0.8 + victim.radius * 0.08, life: 1.3, gravity: 6, drag: 1.6 });
          this.shockwaves.spawn(e.x, e.z, victim.radius, victim.radius * 4 + 6, color, 1.1);
          if (e.eaterId === this.focusId || e.victimId === this.focusId) this.rig.addShake(1.2);
          break;
        }
        case "powerUpSpawned":
          if (this.isNearCamera(e.x, e.z)) this.shockwaves.spawn(e.x, e.z, 0.5, 5, POWER_UPS[e.kind].color, 0.7);
          break;
        case "powerUpTaken": {
          const hole = holes[e.holeId];
          if (!this.isNearCamera(hole.x, hole.z)) break;
          const color = POWER_UPS[e.kind].color;
          this.shockwaves.spawn(hole.x, hole.z, hole.radius, hole.radius * 2.2 + 3, color, 0.7);
          this.sparks.emit({ x: hole.x, y: 0.4, z: hole.z, ring: hole.radius, count: 36, color, speed: 3, up: 6, size: 0.55 + hole.radius * 0.03, life: 0.9, gravity: 5 });
          break;
        }
        case "holeRespawned":
          if (e.holeId === this.focusId) {
            const hole = holes[e.holeId];
            this.rig.snap(hole.x, hole.z, hole.radius);
          }
          break;
        default:
          break;
      }
    }
  }

  private isNearCamera(x: number, z: number) {
    const r = this.rig.viewRadius * 1.3;
    return Math.abs(x - this.rig.target.x) < r && Math.abs(z - this.rig.target.z) < r;
  }

  /** Score popup above the focused hole. */
  popup(text: string, className = "") {
    const hole = this.focusHole();
    if (!hole || !this.labels) return;
    this.labels.popup(text, hole.x, hole.z - hole.radius * 0.4, this.rig.camera, this.width, this.height, className);
  }

  setHoleSkin(holeId: number, skinId: Hole["skinId"]) {
    const hole = this.world.holes[holeId];
    hole.skinId = skinId;
    this.holeViews[holeId].setSkin(skinId);
  }

  update(dt: number) {
    this.time += dt;
    this.objects.sync(this.world);

    const holes = this.world.holes;
    for (let i = 0; i < holes.length; i++) this.holeViews[i].update(holes[i], dt, this.time);
    this.powerUps.sync(this.world, this.time);

    // Demo mode keeps the camera on the most interesting hole.
    if (this.options.focusId === null && !this.closeUp) {
      this.demoSwitchTimer -= dt;
      const current = this.focusId !== null ? holes[this.focusId] : null;
      if (this.demoSwitchTimer <= 0 || !current || !current.alive) {
        this.demoSwitchTimer = 12;
        const leader = this.world.standings().find((s) => s.hole.alive)?.hole;
        if (leader) this.focusId = leader.id;
      }
    }

    const focus = this.focusHole();
    const fade = this.cityMaterial.uniforms;
    fade.uFocusRadius.value = focus?.alive ? focus.radius * 1.1 + 1 : 0;
    if (focus) fade.uFocus.value.set(focus.x, 0.5, focus.z);
    if (focus) {
      const orbit = this.options.focusId === null ? (this.closeUp ? 0.25 : 0.04) : 0;
      const zoom = this.closeUp ? 0.45 : 1;
      this.rig.update(dt, focus.x, focus.z, focus.vx, focus.vz, focus.radius, orbit, zoom);
    }
    this.env.follow(this.rig.target, this.rig.viewRadius, this.pixelRatio);
    this.env.update(this.time, this.rig.camera.position);

    this.emitTrails(dt);
    this.dust.update(dt);
    this.sparks.update(dt);
    this.shockwaves.update(dt);

    if (this.labels) {
      const leader = this.world.standings()[0]?.hole.id ?? -1;
      this.labels.sync(holes, (h) => this.holeViews[h.id].visible && !this.closeUp, this.rig.camera, this.width, this.height, leader);
    }
  }

  private emitTrails(dt: number) {
    this.trailBudget += dt * 30;
    const emits = Math.floor(this.trailBudget);
    if (emits <= 0) return;
    this.trailBudget -= emits;
    for (const hole of this.world.holes) {
      if (!hole.alive || !this.isNearCamera(hole.x, hole.z)) continue;
      if (hole.hasPower("turbo")) this.emitTurboStreak(hole, emits);
      const skin = SKIN_BY_ID[hole.skinId];
      if (skin.particles === "none") continue;
      const s = TRAIL_SETTINGS[skin.particles];
      const system = s.additive ? this.sparks : this.dust;
      system.emit({
        x: hole.x,
        y: 0.15,
        z: hole.z,
        ring: hole.radius * 1.05,
        count: Math.min(4, emits),
        color: new Color(skin.colors[s.color]),
        colorJitter: skin.pattern === "rainbow" ? 2 : 0.2,
        speed: 0.4,
        up: s.up + hole.radius * 0.1,
        size: s.size * (1 + hole.radius * 0.06),
        life: s.life,
        gravity: s.gravity,
        drag: 1,
      });
    }
  }

  /** Turbo: bright sparks streaming off the back of the hole. */
  private emitTurboStreak(hole: Hole, emits: number) {
    const speed = Math.hypot(hole.vx, hole.vz);
    if (speed < 1) return;
    this.sparks.emit({
      x: hole.x - (hole.vx / speed) * hole.radius,
      y: 0.2,
      z: hole.z - (hole.vz / speed) * hole.radius,
      ring: hole.radius * 0.35,
      count: Math.min(6, emits * 2),
      color: POWER_UPS.turbo.color,
      speed: 0.6,
      up: 1.2,
      size: 0.45 + hole.radius * 0.03,
      life: 0.45,
      gravity: 0,
      drag: 3,
    });
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.rig.camera);
  }

  dispose() {
    this.composer?.dispose();
    this.env.dispose();
    this.ground.dispose();
    this.objects.dispose();
    this.scenery.dispose();
    this.border.dispose();
    this.cityMaterial.material.dispose();
    for (const v of this.holeViews) v.dispose();
    this.dust.dispose();
    this.sparks.dispose();
    this.shockwaves.dispose();
    this.powerUps.dispose();
    this.labels?.dispose();
    this.renderer.renderLists.dispose();
  }
}
