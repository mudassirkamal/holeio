import {
  AdditiveBlending,
  AlwaysStencilFunc,
  BackSide,
  CircleGeometry,
  Color,
  CylinderGeometry,
  EqualStencilFunc,
  Group,
  KeepStencilOp,
  Mesh,
  MeshBasicMaterial,
  NotEqualStencilFunc,
  ReplaceStencilOp,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  type Material,
} from "three";
import { holeDepthForRadius } from "../config/constants";
import { POWER_UP_RULES, POWER_UPS, powerIndex, type PowerUpKind } from "../config/powerUps";
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
const bubbleGeometry = new SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const magnetGeometry = new RingGeometry(1.1, POWER_UP_RULES.magnetReach, 128, 1).rotateX(-Math.PI / 2);
const auraGeometry = new RingGeometry(1, 1.6, 96, 1).rotateX(-Math.PI / 2);

const GROUND_VERTEX = /* glsl */ `
  varying vec2 vLocal;
  void main() {
    vLocal = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Additive glow shared by the power-up effects around a hole. */
function glowMaterial(kind: PowerUpKind, fragmentShader: string, vertexShader = GROUND_VERTEX) {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(POWER_UPS[kind].color) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

/** Shield: a fresnel bubble with a slow shimmer rising over it. */
const BUBBLE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vHeight;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    vHeight = position.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const BUBBLE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vHeight;
  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.5);
    float shimmer = 0.5 + 0.5 * sin(vHeight * 18.0 - uTime * 4.0);
    float glow = fresnel * 0.9 + shimmer * 0.08 + 0.04;
    gl_FragColor = vec4(uColor * glow * uAlpha, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Magnet: chevrons sweeping inward across the pull range, with a crisp outer edge. */
const MAGNET_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uTime;
  varying vec2 vLocal;
  void main() {
    float r = length(vLocal);
    float t = (r - 1.1) / ${(POWER_UP_RULES.magnetReach - 1.1).toFixed(3)};
    float edge = smoothstep(0.9, 0.97, t) * smoothstep(1.0, 0.97, t);
    float sweep = smoothstep(0.6, 1.0, fract(t * 3.0 + uTime * 1.6)) * t;
    gl_FragColor = vec4(uColor * (edge * 1.4 + sweep * 0.8) * uAlpha, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Giant: a pulsing glow just outside the rim. */
const AURA_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uTime;
  varying vec2 vLocal;
  void main() {
    float r = length(vLocal);
    float glow = smoothstep(1.6, 1.12, r) * smoothstep(1.0, 1.1, r);
    float pulse = 0.65 + 0.35 * sin(uTime * 6.0 - r * 10.0);
    gl_FragColor = vec4(uColor * glow * pulse * uAlpha, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Effects fade in over this long, and blink during their last seconds. */
const EFFECT_FADE = 0.25;
const EFFECT_WARN = 1.5;

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
  private readonly effects: { kind: PowerUpKind; material: ShaderMaterial; mesh: Mesh; alpha: number }[];
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

    const bubble = new Mesh(bubbleGeometry, glowMaterial("shield", BUBBLE_FRAGMENT, BUBBLE_VERTEX));
    bubble.scale.set(1.2, 0.6, 1.2);
    bubble.renderOrder = 9;
    const magnet = new Mesh(magnetGeometry, stencilOutside(glowMaterial("magnet", MAGNET_FRAGMENT)));
    magnet.position.y = 0.05;
    magnet.renderOrder = 6;
    const aura = new Mesh(auraGeometry, stencilOutside(glowMaterial("giant", AURA_FRAGMENT)));
    aura.position.y = 0.05;
    aura.renderOrder = 6;
    this.effects = [
      { kind: "shield", mesh: bubble, material: bubble.material as ShaderMaterial, alpha: 0 },
      { kind: "magnet", mesh: magnet, material: magnet.material as ShaderMaterial, alpha: 0 },
      { kind: "giant", mesh: aura, material: aura.material as ShaderMaterial, alpha: 0 },
    ];

    this.materials = [discMaterial, shaftMaterial, capMaterial, rimMaterial, haloMaterial, ...this.effects.map((e) => e.material)];
    for (const m of [disc, this.shaft, this.cap, rim, halo, bubble, magnet, aura]) {
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
    this.updateEffects(hole, dt, time);
  }

  private updateEffects(hole: Hole, dt: number, time: number) {
    for (const effect of this.effects) {
      const left = hole.alive ? hole.powers[powerIndex(effect.kind)] : 0;
      effect.alpha = clamp(effect.alpha + (left > 0 ? dt : -dt) / EFFECT_FADE, 0, 1);
      effect.mesh.visible = effect.alpha > 0;
      const blink = left > 0 && left < EFFECT_WARN && Math.sin(time * 16) < 0 ? 0.25 : 1;
      effect.material.uniforms.uAlpha.value = effect.alpha * blink;
      effect.material.uniforms.uTime.value = time;
    }
  }

  dispose() {
    for (const m of this.materials) m.dispose();
  }
}
