import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  RingGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  type Texture,
} from "three";
import { POWER_UP_RULES, POWER_UPS, type PowerUpKind } from "../config/powerUps";
import type { PowerUp, World } from "../core/World";
import { powerUpBadge } from "./powerUpBadge";

const BADGE_SIZE = 3.4;
const BADGE_HEIGHT = 3;
/** Pickups blink for this long before they expire. */
const WARN_TIME = 5;

const beamGeometry = new CylinderGeometry(0.55, 1, 16, 24, 1, true).translate(0, 8, 0);
const ringGeometry = new RingGeometry(1.2, 1.9, 64, 1).rotateX(-Math.PI / 2);

const glowVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vLocal;
  void main() {
    vUv = uv;
    vLocal = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** A column of light that makes pickups easy to spot from across the map. */
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 1.6);
    gl_FragColor = vec4(uColor * fade * uAlpha * 0.55, 1.0);
    #include <colorspace_fragment>
  }
`;

/** A spinning dashed ring on the ground under the badge. */
const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uTime;
  varying vec2 vLocal;
  void main() {
    float r = length(vLocal);
    float band = smoothstep(1.2, 1.35, r) * smoothstep(1.9, 1.75, r);
    float angle = atan(vLocal.y, vLocal.x) / 6.2831853;
    float dash = step(0.4, fract(angle * 8.0 + uTime * 0.6));
    gl_FragColor = vec4(uColor * band * (0.35 + dash * 0.9) * uAlpha, 1.0);
    #include <colorspace_fragment>
  }
`;

interface Token {
  group: Group;
  badge: Sprite;
  beam: ShaderMaterial;
  ring: ShaderMaterial;
  phase: number;
}

const additive = (fragmentShader: string, color: string) =>
  new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
    vertexShader: glowVertex,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });

/** Floating power-up pickups: a bobbing badge, a light beam and a ground ring each. */
export class PowerUpLayer {
  readonly group = new Group();
  private readonly tokens = new Map<number, Token>();
  private readonly textures = new Map<PowerUpKind, Texture>();

  private texture(kind: PowerUpKind) {
    let texture = this.textures.get(kind);
    if (!texture) {
      texture = new CanvasTexture(powerUpBadge(kind));
      texture.colorSpace = SRGBColorSpace;
      this.textures.set(kind, texture);
    }
    return texture;
  }

  private create(p: PowerUp): Token {
    const color = POWER_UPS[p.kind].color;
    const group = new Group();
    group.position.set(p.x, 0, p.z);

    const badge = new Sprite(new SpriteMaterial({ map: this.texture(p.kind), transparent: true, depthWrite: false, fog: false }));
    badge.renderOrder = 8;
    const beam = additive(beamFragment, color);
    const ring = additive(ringFragment, color);
    const beamMesh = new Mesh(beamGeometry, beam);
    const ringMesh = new Mesh(ringGeometry, ring);
    ringMesh.position.y = 0.07;
    ringMesh.renderOrder = 6;
    group.add(badge, beamMesh, ringMesh);
    this.group.add(group);

    const token = { group, badge, beam, ring, phase: p.id * 1.7 };
    this.tokens.set(p.id, token);
    return token;
  }

  private remove(id: number, token: Token) {
    this.group.remove(token.group);
    token.badge.material.dispose();
    token.beam.dispose();
    token.ring.dispose();
    this.tokens.delete(id);
  }

  sync(world: World, time: number) {
    for (const [id, token] of this.tokens) if (!world.powerUps.some((p) => p.id === id)) this.remove(id, token);

    for (const p of world.powerUps) {
      const token = this.tokens.get(p.id) ?? this.create(p);
      const age = world.time - p.bornAt;
      const appear = Math.min(1, Math.max(0, age) / 0.5);
      const blink = POWER_UP_RULES.lifetime - age < WARN_TIME && Math.sin(time * 14) < 0 ? 0.3 : 1;
      const pulse = 1 + Math.sin(time * 5 + token.phase) * 0.06;

      token.badge.position.y = BADGE_HEIGHT + Math.sin(time * 2.4 + token.phase) * 0.35;
      token.badge.scale.setScalar(BADGE_SIZE * appear * (2 - appear) * pulse);
      token.badge.material.opacity = blink;
      token.beam.uniforms.uAlpha.value = appear * blink;
      token.ring.uniforms.uAlpha.value = appear * blink;
      token.ring.uniforms.uTime.value = time;
    }
  }

  dispose() {
    for (const [id, token] of this.tokens) this.remove(id, token);
    for (const texture of this.textures.values()) texture.dispose();
  }
}
