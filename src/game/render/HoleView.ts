import {
  AlwaysStencilFunc,
  BackSide,
  CircleGeometry,
  CylinderGeometry,
  EqualStencilFunc,
  Group,
  KeepStencilOp,
  Mesh,
  MeshBasicMaterial,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  RingGeometry,
  type Material,
} from "three";
import { holeDepthForRadius } from "../config/constants";
import type { SkinId } from "../config/skins";
import type { Hole } from "../core/entities";
import { clamp } from "../core/math";
import {
  applySkin,
  createHaloMaterial,
  createRimMaterial,
  createShaftMaterial,
  createSkinUniforms,
  type SkinUniforms,
} from "./skinMaterial";

const RIM_WIDTH = 0.13;

// Geometries are shared by every hole.
const discGeometry = new CircleGeometry(1, 72).rotateX(-Math.PI / 2);
const shaftGeometry = new CylinderGeometry(1, 1, 1, 72, 1, true).translate(0, -0.5, 0);
const capGeometry = new CircleGeometry(1.02, 48).rotateX(-Math.PI / 2);
const rimGeometry = new RingGeometry(1, 1 + RIM_WIDTH, 128, 1).rotateX(-Math.PI / 2);
const haloGeometry = new RingGeometry(1 + RIM_WIDTH * 0.8, 1.42, 96, 1).rotateX(-Math.PI / 2);

/** Ground decals (rims, halos) are cut away inside any hole's opening. */
function stencilOutside(material: Material) {
  material.stencilWrite = true;
  material.stencilRef = 1;
  material.stencilFunc = NotEqualStencilFunc;
  material.stencilZPass = KeepStencilOp;
  return material;
}

function stencilInside(material: Material) {
  material.stencilWrite = true;
  material.stencilRef = 1;
  material.stencilFunc = EqualStencilFunc;
  material.stencilZPass = KeepStencilOp;
  return material;
}

type Phase = "alive" | "dying" | "dead" | "spawning";

const easeOutBack = (t: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/**
 * Visual for one hole. The trick behind the "hole in the ground":
 *  1. an invisible disc writes 1 into the stencil buffer first;
 *  2. the ground only draws where stencil != 1, leaving a real opening;
 *  3. the shaft walls and a black cap only draw where stencil == 1,
 *     so objects falling below ground are visible through the opening only.
 */
export class HoleView {
  readonly group = new Group();
  readonly uniforms: SkinUniforms;
  private readonly shaft: Mesh;
  private readonly cap: Mesh;
  private readonly materials: Material[];
  private phase: Phase = "alive";
  private phaseTime = 0;
  private scale = 1;
  private deathX = 0;
  private deathZ = 0;
  private targetX = 0;
  private targetZ = 0;

  constructor(skinId: SkinId) {
    this.uniforms = createSkinUniforms(skinId);

    const discMaterial = new MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: AlwaysStencilFunc,
      stencilZPass: ReplaceStencilOp,
    });
    const disc = new Mesh(discGeometry, discMaterial);
    disc.position.y = 0.02;
    disc.renderOrder = -10;

    const shaftMaterial = stencilInside(createShaftMaterial(this.uniforms));
    shaftMaterial.side = BackSide;
    this.shaft = new Mesh(shaftGeometry, shaftMaterial);

    const capMaterial = stencilInside(new MeshBasicMaterial({ color: 0x010103, fog: false }));
    this.cap = new Mesh(capGeometry, capMaterial);

    const rimMaterial = stencilOutside(createRimMaterial(this.uniforms, RIM_WIDTH));
    const rim = new Mesh(rimGeometry, rimMaterial);
    rim.position.y = 0.04;
    rim.renderOrder = 5;

    const haloMaterial = stencilOutside(createHaloMaterial(this.uniforms));
    const halo = new Mesh(haloGeometry, haloMaterial);
    halo.position.y = 0.03;
    halo.renderOrder = 4;

    this.materials = [discMaterial, shaftMaterial, capMaterial, rimMaterial, haloMaterial];
    for (const m of [disc, this.shaft, this.cap, rim, halo]) {
      m.frustumCulled = false;
      this.group.add(m);
    }
  }

  setSkin(skinId: SkinId) {
    applySkin(this.uniforms, skinId);
  }

  /** Starts the swallowed animation, shrinking toward the eater. */
  onEaten(eaterX: number, eaterZ: number) {
    if (this.phase === "dying" || this.phase === "dead") return;
    this.phase = "dying";
    this.phaseTime = 0;
    this.deathX = this.group.position.x;
    this.deathZ = this.group.position.z;
    this.targetX = eaterX;
    this.targetZ = eaterZ;
  }

  onRespawn() {
    this.phase = "spawning";
    this.phaseTime = 0;
  }

  get visible() {
    return this.group.visible;
  }

  update(hole: Hole, dt: number, time: number) {
    this.phaseTime += dt;
    this.uniforms.uTime.value = time;
    if (!hole.alive && (this.phase === "alive" || this.phase === "spawning")) this.onEaten(hole.x, hole.z);

    switch (this.phase) {
      case "dying": {
        const t = clamp(this.phaseTime / 0.45, 0, 1);
        this.scale = 1 - t * t;
        this.group.position.set(
          this.deathX + (this.targetX - this.deathX) * t,
          0,
          this.deathZ + (this.targetZ - this.deathZ) * t,
        );
        if (t >= 1) this.phase = "dead";
        break;
      }
      case "dead":
        this.scale = 0;
        if (hole.alive) this.onRespawn();
        break;
      case "spawning": {
        const t = clamp(this.phaseTime / 0.55, 0, 1);
        this.scale = easeOutBack(t);
        if (t >= 1) this.phase = "alive";
        break;
      }
      case "alive":
        this.scale = 1;
        break;
    }
    if (this.phase !== "dying") this.group.position.set(hole.x, 0, hole.z);

    const radius = Math.max(0.001, hole.radius * this.scale);
    this.group.visible = this.scale > 0.001;
    this.group.scale.setScalar(radius);
    const depth = holeDepthForRadius(hole.radius);
    this.shaft.scale.y = depth / radius;
    this.cap.position.y = -depth / radius;

    // Blink while protected after spawning.
    this.uniforms.uOpacity.value = hole.isProtected ? 0.45 + 0.55 * Math.abs(Math.sin(time * 9)) : 1;
  }

  dispose() {
    for (const m of this.materials) m.dispose();
  }
}
