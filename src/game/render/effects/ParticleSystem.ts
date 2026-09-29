import {
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  Points,
  ShaderMaterial,
  type Blending,
} from "three";

export interface EmitOptions {
  x: number;
  y: number;
  z: number;
  count: number;
  color: Color | string;
  colorJitter?: number;
  speed: number;
  /** Extra upward velocity. */
  up?: number;
  spread?: number;
  size: number;
  life: number;
  gravity?: number;
  drag?: number;
  /** Emit from a ring of this radius instead of a point. */
  ring?: number;
}

const tmpColor = new Color();

/**
 * Pooled CPU particle system rendered as soft point sprites. Used for dust puffs,
 * swallow sparkles, hole-eaten explosions and skin trails.
 */
export class ParticleSystem {
  readonly points: Points;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private readonly baseSize: Float32Array;
  private cursor = 0;
  private readonly material: ShaderMaterial;

  constructor(
    private readonly capacity: number,
    blending: Blending = NormalBlending,
  ) {
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.velocities = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity).fill(1);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new BufferAttribute(this.colors, 3));
    geometry.setAttribute("size", new BufferAttribute(this.sizes, 1));
    geometry.setAttribute("alpha", new BufferAttribute(this.alphas, 1));

    this.material = new ShaderMaterial({
      uniforms: { uPixelRatio: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = size * uPixelRatio * 500.0 / -mv.z;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.1, d) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending,
    });

    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }

  setPixelRatio(ratio: number) {
    this.material.uniforms.uPixelRatio.value = ratio;
  }

  emit(o: EmitOptions) {
    const base = typeof o.color === "string" ? new Color(o.color) : o.color;
    for (let n = 0; n < o.count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const a = Math.random() * Math.PI * 2;
      const spread = o.spread ?? 1;
      const speed = o.speed * (0.4 + Math.random() * 0.8);
      const ring = o.ring ?? 0;
      this.positions[i * 3] = o.x + Math.cos(a) * ring;
      this.positions[i * 3 + 1] = o.y;
      this.positions[i * 3 + 2] = o.z + Math.sin(a) * ring;
      this.velocities[i * 3] = Math.cos(a) * speed * spread;
      this.velocities[i * 3 + 1] = (o.up ?? 0) * (0.6 + Math.random() * 0.8);
      this.velocities[i * 3 + 2] = Math.sin(a) * speed * spread;
      const j = o.colorJitter ?? 0.15;
      tmpColor.copy(base).offsetHSL((Math.random() - 0.5) * j * 0.3, 0, (Math.random() - 0.5) * j);
      this.colors[i * 3] = tmpColor.r;
      this.colors[i * 3 + 1] = tmpColor.g;
      this.colors[i * 3 + 2] = tmpColor.b;
      this.maxLife[i] = o.life * (0.6 + Math.random() * 0.8);
      this.life[i] = this.maxLife[i];
      this.gravity[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 1.5;
      this.baseSize[i] = o.size * (0.6 + Math.random() * 0.8);
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) {
        if (this.alphas[i] !== 0) {
          this.alphas[i] = 0;
          this.sizes[i] = 0;
        }
        continue;
      }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      const damping = Math.exp(-this.drag[i] * dt);
      this.velocities[i * 3] *= damping;
      this.velocities[i * 3 + 2] *= damping;
      this.velocities[i * 3 + 1] = this.velocities[i * 3 + 1] * damping - this.gravity[i] * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      this.alphas[i] = Math.min(1, t * 2.2);
      this.sizes[i] = this.baseSize[i] * (0.4 + 0.6 * t);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

