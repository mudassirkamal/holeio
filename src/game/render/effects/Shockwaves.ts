import { AdditiveBlending, Color, Group, Mesh, RingGeometry, ShaderMaterial } from "three";

interface Wave {
  mesh: Mesh;
  material: ShaderMaterial;
  age: number;
  life: number;
  from: number;
  to: number;
}

const geometry = new RingGeometry(0.86, 1, 96, 1).rotateX(-Math.PI / 2);

/** Expanding glowing rings on the ground (size-ups, holes swallowed). */
export class Shockwaves {
  readonly group = new Group();
  private readonly waves: Wave[] = [];

  constructor(capacity = 10) {
    for (let i = 0; i < capacity; i++) {
      const material = new ShaderMaterial({
        uniforms: { uColor: { value: new Color() }, uAlpha: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vLocal;
          void main() {
            vLocal = position.xz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uAlpha;
          varying vec2 vLocal;
          void main() {
            float r = length(vLocal);
            float band = smoothstep(0.86, 0.95, r) * smoothstep(1.0, 0.95, r);
            gl_FragColor = vec4(uColor * band * uAlpha * 2.0, 1.0);
            #include <colorspace_fragment>
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const mesh = new Mesh(geometry, material);
      mesh.visible = false;
      mesh.position.y = 0.06;
      mesh.renderOrder = 6;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.waves.push({ mesh, material, age: 1, life: 1, from: 1, to: 2 });
    }
  }

  spawn(x: number, z: number, from: number, to: number, color: string | Color, life = 0.8) {
    const wave = this.waves.reduce((oldest, w) => (w.age / w.life > oldest.age / oldest.life ? w : oldest));
    wave.age = 0;
    wave.life = life;
    wave.from = from;
    wave.to = to;
    wave.mesh.position.x = x;
    wave.mesh.position.z = z;
    wave.material.uniforms.uColor.value.set(color);
    wave.mesh.visible = true;
  }

  update(dt: number) {
    for (const w of this.waves) {
      if (!w.mesh.visible) continue;
      w.age += dt;
      const t = Math.min(1, w.age / w.life);
      const eased = 1 - Math.pow(1 - t, 3);
      w.mesh.scale.setScalar(w.from + (w.to - w.from) * eased);
      w.material.uniforms.uAlpha.value = 1 - t;
      if (t >= 1) w.mesh.visible = false;
    }
  }

  dispose() {
    for (const w of this.waves) w.material.dispose();
  }
}
