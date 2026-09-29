import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  MathUtils,
  Mesh,
  NormalBlending,
  PMREMGenerator,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from "three";
import type { ThemeDef } from "../config/themes";
import { Rng } from "../core/rng";

function createSkyMaterial(theme: ThemeDef, sunDirection: Vector3) {
  const l = theme.lighting;
  return new ShaderMaterial({
    uniforms: {
      uTop: { value: new Color(l.skyTop) },
      uHorizon: { value: new Color(l.skyHorizon) },
      uBottom: { value: new Color(l.skyBottom) },
      uSunDir: { value: sunDirection.clone() },
      uSunColor: { value: new Color(l.sunColor) },
      uNight: { value: l.night },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uNight;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      void main() {
        float y = vDir.y;
        vec3 col = y > 0.0 ? mix(uHorizon, uTop, pow(y, 0.55)) : mix(uHorizon, uBottom, pow(-y, 0.4));
        float sun = max(dot(vDir, uSunDir), 0.0);
        col += uSunColor * (pow(sun, 900.0) * 6.0 + pow(sun, 12.0) * 0.35) * (1.0 - uNight * 0.7);
        if (uNight > 0.5 && y > 0.05) {
          vec3 cell = floor(vDir * 260.0);
          float star = step(0.9965, hash(cell));
          col += star * vec3(0.9, 0.95, 1.0) * 1.6 * smoothstep(0.05, 0.4, y);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
}

type WeatherKind = ThemeDef["weather"];

function createWeather(kind: WeatherKind) {
  if (kind === "none") return null;
  const count = kind === "snow" ? 2600 : kind === "leaves" ? 500 : 420;
  const rng = new Rng(99);
  const base = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    base[i * 3] = rng.next();
    base[i * 3 + 1] = rng.next();
    base[i * 3 + 2] = rng.next();
    seeds[i] = rng.next();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(base, 3));
  geometry.setAttribute("seed", new BufferAttribute(seeds, 1));

  const settings = {
    snow: { color: "#ffffff", size: 0.28, fall: 2.2, height: 40, sway: 0.8, blending: NormalBlending },
    leaves: { color: "#e88a2d", size: 0.5, fall: 1.4, height: 26, sway: 2.2, blending: NormalBlending },
    fireflies: { color: "#d9ff70", size: 0.3, fall: -0.15, height: 7, sway: 1.4, blending: AdditiveBlending },
  }[kind];

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: new Vector3() },
      uBox: { value: 160 },
      uHeight: { value: settings.height },
      uFall: { value: settings.fall },
      uSway: { value: settings.sway },
      uSize: { value: settings.size },
      uColor: { value: new Color(settings.color) },
      uPixelRatio: { value: 1 },
      uFireflies: { value: kind === "fireflies" ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime;
      uniform vec3 uCenter;
      uniform float uBox;
      uniform float uHeight;
      uniform float uFall;
      uniform float uSway;
      uniform float uSize;
      uniform float uPixelRatio;
      varying float vSeed;
      void main() {
        vSeed = seed;
        vec3 p = position * vec3(uBox, uHeight, uBox);
        p.y = mod(p.y - uTime * uFall * (0.6 + seed * 0.8), uHeight);
        p.x += sin(uTime * 0.7 + seed * 40.0) * uSway;
        p.z += cos(uTime * 0.5 + seed * 23.0) * uSway;
        vec3 origin = uCenter - vec3(uBox * 0.5, 0.0, uBox * 0.5);
        p.xz = mod(p.xz - origin.xz, uBox) + origin.xz;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (0.6 + seed) * uPixelRatio * 420.0 / -mv.z;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uFireflies;
      varying float vSeed;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float alpha = smoothstep(0.5, 0.15, d);
        vec3 col = uColor * (0.8 + 0.4 * vSeed);
        if (uFireflies > 0.5) {
          alpha *= 0.3 + 0.7 * pow(0.5 + 0.5 * sin(uTime * 2.0 + vSeed * 60.0), 3.0);
          col *= 2.5;
        }
        gl_FragColor = vec4(col, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: settings.blending,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

/** Sky, sun, fog, image-based lighting and weather for a theme. */
export class Environment {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  private readonly sky: Mesh;
  private readonly sunDirection: Vector3;
  private readonly envMap: Texture;
  private readonly weather: ReturnType<typeof createWeather>;
  private readonly shadowMapSize: number;

  constructor(
    private readonly scene: Scene,
    theme: ThemeDef,
    renderer: WebGLRenderer,
    shadows: { enabled: boolean; mapSize: number },
  ) {
    const l = theme.lighting;
    const el = MathUtils.degToRad(l.sunElevation);
    const az = MathUtils.degToRad(l.sunAzimuth);
    this.sunDirection = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();

    scene.background = new Color(l.skyHorizon);
    scene.fog = new FogExp2(l.fogColor, l.fogDensity);

    this.sky = new Mesh(new SphereGeometry(1, 32, 16), createSkyMaterial(theme, this.sunDirection));
    this.sky.scale.setScalar(1800);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -20;
    scene.add(this.sky);

    // Image-based lighting generated from the theme's own sky.
    const pmrem = new PMREMGenerator(renderer);
    const envScene = new Scene();
    const envSky = new Mesh(new SphereGeometry(1, 32, 16), createSkyMaterial(theme, this.sunDirection));
    envSky.scale.setScalar(100);
    envScene.add(envSky);
    this.envMap = pmrem.fromScene(envScene, 0.02).texture;
    scene.environment = this.envMap;
    envSky.geometry.dispose();
    (envSky.material as ShaderMaterial).dispose();
    pmrem.dispose();

    // Exposure is folded into light intensities so it works with and without post-processing.
    this.hemi = new HemisphereLight(l.hemiSky, l.hemiGround, l.hemiIntensity * l.exposure);
    scene.add(this.hemi);

    this.sun = new DirectionalLight(l.sunColor, l.sunIntensity * l.exposure);
    this.shadowMapSize = shadows.mapSize;
    this.sun.castShadow = shadows.enabled;
    if (shadows.enabled) {
      this.sun.shadow.mapSize.set(shadows.mapSize, shadows.mapSize);
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.04;
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 900;
    }
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.weather = createWeather(theme.weather);
    if (this.weather) scene.add(this.weather.points);
  }

  /** Keeps the shadow frustum tight around what the camera sees. */
  follow(target: Vector3, viewRadius: number, pixelRatio: number) {
    const texel = (viewRadius * 2) / this.shadowMapSize;
    const x = Math.round(target.x / texel) * texel;
    const z = Math.round(target.z / texel) * texel;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x, 0, z).addScaledVector(this.sunDirection, 400);
    const cam = this.sun.shadow.camera;
    if (cam.right !== viewRadius) {
      cam.left = -viewRadius;
      cam.right = viewRadius;
      cam.top = viewRadius;
      cam.bottom = -viewRadius;
      cam.updateProjectionMatrix();
    }
    if (this.weather) {
      this.weather.material.uniforms.uCenter.value.set(target.x, 0, target.z);
      this.weather.material.uniforms.uBox.value = Math.max(90, viewRadius * 2.2);
      this.weather.material.uniforms.uPixelRatio.value = pixelRatio;
    }
  }

  update(time: number, cameraPosition: Vector3) {
    this.sky.position.copy(cameraPosition);
    if (this.weather) this.weather.material.uniforms.uTime.value = time;
  }

  dispose() {
    this.sky.geometry.dispose();
    (this.sky.material as ShaderMaterial).dispose();
    this.envMap.dispose();
    this.sun.shadow.map?.dispose();
    if (this.weather) {
      this.weather.points.geometry.dispose();
      this.weather.material.dispose();
    }
    this.scene.environment = null;
  }
}
