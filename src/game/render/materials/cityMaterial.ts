import { Color, MeshStandardMaterial, Vector3 } from "three";
import type { ThemeLighting } from "../../config/themes";

/** Values for the per-vertex `surface.z` attribute. */
export const Surface = {
  plain: 0,
  /** Punched windows (houses, apartments). */
  windows: 1,
  /** Glass curtain wall with thin mullions (offices, towers). */
  curtain: 2,
  /** Large shop windows on the ground floor only. */
  storefront: 3,
  /** Fully glossy glass (car windows, booths). */
  glass: 4,
  /** Shiny metal. */
  metal: 5,
} as const;

export type SurfaceType = (typeof Surface)[keyof typeof Surface];

export interface CityMaterialUniforms {
  uNight: { value: number };
  uGlow: { value: number };
  uWindowDay: { value: Color };
  uWindowLit: { value: Color };
  /** World position of the followed hole; objects between it and the camera are dithered away. */
  uFocus: { value: Vector3 };
  uFocusRadius: { value: number };
}

/**
 * One shared PBR material for every city object. Extra vertex attributes drive:
 *  - `tint`: how much the per-instance color applies (1 = body paint, 0 = fixed detail);
 *  - `surface`: facade coordinates in meters + surface type, for procedural windows,
 *    glass reflections and lit windows at night (no textures needed);
 *  - `glow`: emissive strength (lamps, headlights, neon, screens).
 * Objects below ground (falling into a hole) fade into darkness, and anything standing
 * between the camera and the followed hole is dithered out so the player is never hidden.
 */
export function createCityMaterial(lighting: ThemeLighting) {
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.74,
    metalness: 0.03,
    envMapIntensity: lighting.envIntensity,
  });

  const uniforms: CityMaterialUniforms = {
    uNight: { value: lighting.night },
    uGlow: { value: 0.12 + lighting.night * 2.6 },
    uWindowDay: { value: new Color(lighting.night > 0.5 ? "#1b2238" : "#3d5a80") },
    uWindowLit: { value: new Color("#ffd89a") },
    uFocus: { value: new Vector3() },
    uFocusRadius: { value: 0 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        attribute float tint;
        attribute vec3 surface;
        attribute float glow;
        varying vec3 vSurface;
        varying float vGlow;
        varying float vSeed;
        varying vec3 vCityWorld;`,
      )
      .replace(
        "#include <color_vertex>",
        /* glsl */ `
        vColor = vec4(color, 1.0);
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb = mix(vColor.rgb, vColor.rgb * instanceColor.rgb, tint);
        #endif
        vSurface = surface;
        vGlow = glow;
        #ifdef USE_INSTANCING
          vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #else
          vSeed = 0.37;
        #endif`,
      )
      .replace(
        "#include <worldpos_vertex>",
        /* glsl */ `#include <worldpos_vertex>
        vec4 cityWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cityWorld = instanceMatrix * cityWorld;
        #endif
        vCityWorld = (modelMatrix * cityWorld).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        uniform float uNight;
        uniform float uGlow;
        uniform vec3 uWindowDay;
        uniform vec3 uWindowLit;
        varying vec3 vSurface;
        varying float vGlow;
        uniform vec3 uFocus;
        uniform float uFocusRadius;
        varying float vSeed;
        varying vec3 vCityWorld;
        float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);`,
      )
      .replace(
        "#include <clipping_planes_fragment>",
        /* glsl */ `#include <clipping_planes_fragment>
        if (uFocusRadius > 0.0 && vCityWorld.y > 2.5) {
          vec3 toFocus = uFocus - cameraPosition;
          float focusDistance = length(toFocus);
          vec3 ray = toFocus / focusDistance;
          vec3 rel = vCityWorld - cameraPosition;
          float along = dot(rel, ray);
          if (along > 0.0 && along < focusDistance - uFocusRadius - 1.5) {
            float off = length(rel - ray * along);
            float fade = 1.0 - smoothstep(uFocusRadius, uFocusRadius + 3.0, off);
            ivec2 cell = ivec2(mod(gl_FragCoord.xy, 4.0));
            if (fade * 0.82 > (BAYER[cell.x + cell.y * 4] + 0.5) / 16.0) discard;
          }
        }`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float glassMask = 0.0;
        float metalMask = 0.0;
        float litWindow = 0.0;
        float surfaceType = floor(vSurface.z + 0.5);
        if (surfaceType > 0.5 && surfaceType < 3.5) {
          vec2 cellSize = surfaceType > 1.5 && surfaceType < 2.5 ? vec2(3.0, 3.6) : (surfaceType > 2.5 ? vec2(4.2, 4.2) : vec2(2.7, 3.2));
          vec2 f = vSurface.xy / cellSize;
          vec2 cell = floor(f);
          vec2 g = fract(f);
          vec2 aa = fwidth(f) * 1.2 + 0.001;
          vec2 lo = surfaceType > 1.5 && surfaceType < 2.5 ? vec2(0.05, 0.1) : vec2(0.2, 0.26);
          vec2 hi = surfaceType > 1.5 && surfaceType < 2.5 ? vec2(0.95, 0.92) : vec2(0.8, 0.84);
          vec2 m = smoothstep(lo, lo + aa, g) * (1.0 - smoothstep(hi - aa, hi, g));
          float windowMask = m.x * m.y;
          if (surfaceType > 2.5) windowMask *= step(cell.y, 0.5);
          float h = cityHash(cell + vec2(vSeed * 91.7, vSeed * 17.3));
          litWindow = step(0.4, h) * uNight * windowMask;
          vec3 glass = uWindowDay * (0.75 + 0.5 * cityHash(cell.yx + vSeed * 7.1));
          vec3 lit = uWindowLit * (0.75 + 0.5 * cityHash(cell.yx + vSeed * 13.1));
          diffuseColor.rgb = mix(diffuseColor.rgb, mix(glass, lit * 0.35, step(0.5, litWindow)), windowMask);
          glassMask = windowMask;
          litWindow *= 0.8 + 0.4 * cityHash(cell * 3.1 + vSeed);
        } else if (surfaceType > 3.5 && surfaceType < 4.5) {
          glassMask = 1.0;
        } else if (surfaceType > 4.5) {
          metalMask = 1.0;
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.1, glassMask);
        roughnessFactor = mix(roughnessFactor, 0.28, metalMask);`,
      )
      .replace(
        "#include <metalnessmap_fragment>",
        /* glsl */ `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.4, glassMask);
        metalnessFactor = mix(metalnessFactor, 0.9, metalMask);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance += uWindowLit * litWindow * 1.8;
        totalEmissiveRadiance += diffuseColor.rgb * vGlow * uGlow;`,
      )
      .replace(
        "#include <tonemapping_fragment>",
        /* glsl */ `
        float underground = clamp(-vCityWorld.y / 16.0, 0.0, 1.0);
        gl_FragColor.rgb *= 1.0 - underground * underground * 0.95 - underground * 0.03;
        #include <tonemapping_fragment>`,
      );
  };

  return { material, uniforms };
}
