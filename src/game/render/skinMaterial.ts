import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from "three";
import { SKIN_BY_ID, type SkinId, type SkinPattern } from "../config/skins";

const PATTERN_INDEX: Record<SkinPattern, number> = {
  solid: 0,
  gradient: 1,
  stripes: 2,
  dots: 3,
  checker: 4,
  pulse: 5,
  rainbow: 6,
  lava: 7,
  toxic: 8,
  electric: 9,
  ice: 10,
  galaxy: 11,
  gold: 12,
  matrix: 13,
};

/** Shared GLSL for skin patterns, in polar ring space. */
export const SKIN_GLSL = /* glsl */ `
  uniform int uPattern;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uTime;
  uniform float uSpeed;

  float skHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float skNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(skHash(i), skHash(i + vec2(1.0, 0.0)), u.x), mix(skHash(i + vec2(0.0, 1.0)), skHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float skFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * skNoise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  vec3 skHsv(float h, float s, float v) {
    vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return v * mix(vec3(1.0), k, s);
  }

  // a: angle 0..1 around the ring, t: 0 inner edge .. 1 outer edge, p: cartesian (seamless)
  vec3 skinColor(float a, float t, vec2 p) {
    float time = uTime * uSpeed;
    vec3 col = uColorA;
    if (uPattern == 0) {
      float sweep = pow(0.5 + 0.5 * sin((a - time * 0.25) * 6.2831), 12.0);
      col = mix(uColorA, uColorC, sweep * 0.6) * (1.05 - t * 0.25);
    } else if (uPattern == 1) {
      col = mix(uColorA, uColorB, 0.5 + 0.5 * sin((a + time * 0.15) * 6.2831 * 2.0));
      col = mix(col, uColorC, pow(0.5 + 0.5 * sin((a - time * 0.3) * 6.2831), 10.0) * 0.5);
    } else if (uPattern == 2) {
      float s = fract(a * 18.0 + t * 0.9 - time * 0.4);
      col = mix(uColorA, uColorB, smoothstep(0.46, 0.54, s));
    } else if (uPattern == 3) {
      vec2 g = vec2(a * 28.0 - time * 0.5, t * 2.0);
      float d = length(fract(g) - 0.5);
      col = mix(uColorA, mod(floor(g.x), 2.0) < 1.0 ? uColorB : uColorC, 1.0 - smoothstep(0.26, 0.32, d));
    } else if (uPattern == 4) {
      float c = mod(floor(a * 36.0 - time * 1.5) + floor(t * 2.0), 2.0);
      col = mix(uColorA, uColorB, c);
    } else if (uPattern == 5) {
      float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
      float band = pow(0.5 + 0.5 * sin((a * 3.0 - time * 0.8) * 6.2831), 6.0);
      col = mix(uColorA, uColorB, band) * (0.8 + pulse * 0.6);
    } else if (uPattern == 6) {
      col = skHsv(fract(a - time * 0.2 + t * 0.1), 0.85, 1.0);
    } else if (uPattern == 7) {
      float n = skFbm(p * 2.2 + vec2(time * 0.35, -time * 0.25));
      float n2 = skFbm(p * 4.5 - vec2(time * 0.5, time * 0.2));
      float heat = smoothstep(0.3, 0.8, n * 0.7 + n2 * 0.45);
      col = mix(uColorB, uColorA, heat);
      col = mix(col, uColorC * 1.6, smoothstep(0.72, 0.95, heat));
    } else if (uPattern == 8) {
      float n = skFbm(p * 3.0 + vec2(0.0, -time * 0.8));
      float bubbles = smoothstep(0.62, 0.7, skNoise(p * 7.0 - vec2(time * 0.6, time)));
      col = mix(uColorB, uColorA, smoothstep(0.25, 0.75, n));
      col = mix(col, uColorC * 1.4, bubbles);
    } else if (uPattern == 9) {
      float n = skFbm(p * 3.5 + vec2(time * 1.3, time * 0.7));
      float bolt = 1.0 - smoothstep(0.0, 0.05, abs(n - 0.5));
      float flicker = 0.7 + 0.3 * step(0.5, skHash(vec2(floor(uTime * 12.0))));
      col = mix(uColorB, uColorA * 0.6, 0.5 + 0.5 * sin(a * 6.2831 * 4.0 + time));
      col = mix(col, uColorC * 2.2 * flicker, bolt);
    } else if (uPattern == 10) {
      vec2 g = p * 5.0;
      vec2 gi = floor(g);
      float md = 1.0;
      float md2 = 1.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 o = vec2(float(x), float(y));
        vec2 r = o + vec2(skHash(gi + o), skHash(gi + o + 17.0)) - fract(g);
        float d = dot(r, r);
        if (d < md) { md2 = md; md = d; } else if (d < md2) { md2 = d; }
      }
      float edge = 1.0 - smoothstep(0.0, 0.08, sqrt(md2) - sqrt(md));
      float shine = pow(0.5 + 0.5 * sin((a - time * 0.2) * 6.2831), 16.0);
      col = mix(uColorA, uColorB, smoothstep(0.0, 0.8, md)) + uColorC * (edge * 0.9 + shine * 0.5);
    } else if (uPattern == 11) {
      float n = skFbm(p * 1.6 + vec2(time * 0.1, 0.0));
      col = mix(uColorB, uColorA, smoothstep(0.35, 0.8, n));
      col = mix(col, uColorC, smoothstep(0.55, 0.9, skFbm(p * 2.4 - time * 0.07)) * 0.7);
      float star = step(0.985, skHash(floor(p * 22.0)));
      col += star * (0.6 + 0.6 * sin(uTime * 5.0 + skHash(floor(p * 22.0)) * 40.0)) * 2.0;
    } else if (uPattern == 12) {
      float grad = 0.5 + 0.5 * sin(a * 6.2831 * 3.0 + t * 3.0);
      col = mix(uColorB, uColorA, grad);
      float shine = pow(max(0.0, sin((a * 2.0 - time * 0.5) * 6.2831)), 30.0);
      col += uColorC * shine * 1.6;
    } else if (uPattern == 13) {
      float col_ = floor(a * 64.0);
      float speed = 0.5 + skHash(vec2(col_, 3.0));
      float y = fract(t * 1.5 + time * speed + skHash(vec2(col_, 7.0)));
      float glyph = step(0.5, skHash(vec2(col_, floor((t * 6.0 + time * speed * 4.0)))));
      col = mix(uColorB, uColorA * glyph, pow(y, 2.0));
      col += uColorC * pow(y, 12.0) * 0.8;
    }
    return col;
  }
`;

export interface SkinUniforms {
  [key: string]: { value: unknown };
  uPattern: { value: number };
  uColorA: { value: Color };
  uColorB: { value: Color };
  uColorC: { value: Color };
  uTime: { value: number };
  uSpeed: { value: number };
  uGlow: { value: number };
  uOpacity: { value: number };
  uInner: { value: number };
}

export function createSkinUniforms(skinId: SkinId): SkinUniforms {
  const uniforms: SkinUniforms = {
    uPattern: { value: 0 },
    uColorA: { value: new Color() },
    uColorB: { value: new Color() },
    uColorC: { value: new Color() },
    uTime: { value: 0 },
    uSpeed: { value: 1 },
    uGlow: { value: 1 },
    uOpacity: { value: 1 },
    uInner: { value: 1 },
  };
  applySkin(uniforms, skinId);
  return uniforms;
}

export function applySkin(uniforms: SkinUniforms, skinId: SkinId) {
  const skin = SKIN_BY_ID[skinId];
  uniforms.uPattern.value = PATTERN_INDEX[skin.pattern];
  uniforms.uColorA.value.set(skin.colors[0]);
  uniforms.uColorB.value.set(skin.colors[1]);
  uniforms.uColorC.value.set(skin.colors[2]);
  uniforms.uSpeed.value = skin.speed;
  uniforms.uGlow.value = skin.glow;
}

/**
 * The hole's rim: a flat ring on the ground drawn with the animated skin pattern.
 * Geometry is a unit ring (inner radius `uInner`, outer 1 + width); `t` is derived
 * from the local position so the pattern is independent of ring UVs.
 */
export function createRimMaterial(uniforms: SkinUniforms, rimWidth: number) {
  return new ShaderMaterial({
    uniforms: { ...uniforms, uWidth: { value: rimWidth } },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${SKIN_GLSL}
      uniform float uGlow;
      uniform float uOpacity;
      uniform float uWidth;
      varying vec2 vLocal;
      void main() {
        float r = length(vLocal);
        float t = clamp((r - 1.0) / uWidth, 0.0, 1.0);
        float a = atan(vLocal.y, vLocal.x) / 6.2831853 + 0.5;
        vec3 col = skinColor(a, t, vLocal * 2.0);
        // Bevel: bright lip on the inner edge, darker toward the outside.
        float lip = smoothstep(0.35, 0.0, t);
        col *= 0.8 + lip * 0.55;
        col += col * uGlow * 0.55;
        float edge = smoothstep(1.0, 0.86, t);
        gl_FragColor = vec4(col, uOpacity * edge);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/** Soft additive halo around the rim. */
export function createHaloMaterial(uniforms: SkinUniforms) {
  return new ShaderMaterial({
    uniforms: { uColorA: uniforms.uColorA, uGlow: uniforms.uGlow, uOpacity: uniforms.uOpacity, uTime: uniforms.uTime },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform float uGlow;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vLocal;
      void main() {
        float r = length(vLocal);
        float t = clamp((r - 1.08) / 0.34, 0.0, 1.0);
        float fall = pow(1.0 - t, 2.6);
        float pulse = 0.85 + 0.15 * sin(uTime * 2.5);
        gl_FragColor = vec4(uColorA * fall * uGlow * 0.4 * pulse * uOpacity, 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

/** Inner shaft of the hole: skin-tinted near the lip, fading into darkness. */
export function createShaftMaterial(uniforms: SkinUniforms) {
  return new ShaderMaterial({
    uniforms: { uColorA: uniforms.uColorA, uColorB: uniforms.uColorB, uTime: uniforms.uTime },
    vertexShader: /* glsl */ `
      varying float vDepth;
      varying vec2 vDir;
      void main() {
        vDepth = -position.y;
        vDir = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uTime;
      varying float vDepth;
      varying vec2 vDir;
      void main() {
        float a = atan(vDir.y, vDir.x);
        float rings = 0.9 + 0.1 * sin(vDepth * 40.0 - uTime * 3.0);
        vec3 lip = mix(uColorB, uColorA, 0.35) * 0.55;
        float fade = exp(-vDepth * 7.0);
        vec3 col = lip * fade * rings + vec3(0.004, 0.004, 0.012) * (1.0 - fade);
        col *= 0.85 + 0.15 * sin(a * 12.0);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
