import { N8AOPostPass } from "n8ao";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  type Effect,
} from "postprocessing";
import { Color, HalfFloatType, type PerspectiveCamera, type Scene, type WebGLRenderer } from "three";
import type { ThemeLighting } from "../config/themes";
import type { QualitySettings } from "./quality";

/**
 * Render pipeline: scene (with stencil for holes) → ambient occlusion → bloom,
 * neutral tone mapping, a saturation lift, vignette and SMAA merged into one effect pass.
 */
export function createComposer(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  quality: QualitySettings,
  lighting: ThemeLighting,
) {
  const composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
    stencilBuffer: true,
    depthBuffer: true,
  });
  composer.addPass(new RenderPass(scene, camera));

  if (quality.ambientOcclusion) {
    const ao = new N8AOPostPass(scene, camera, 1, 1);
    ao.configuration.aoRadius = 4;
    ao.configuration.distanceFalloff = 1.2;
    ao.configuration.intensity = lighting.night > 0.5 ? 2.2 : 3.2;
    ao.configuration.color = new Color(0, 0, 0);
    ao.configuration.halfRes = quality.ambientOcclusion === "half";
    ao.configuration.gammaCorrection = false;
    ao.setQualityMode(quality.ambientOcclusion === "half" ? "Medium" : "High");
    composer.addPass(ao);
  }

  const effects: Effect[] = [];
  if (quality.bloom) {
    effects.push(
      new BloomEffect({
        intensity: lighting.bloom,
        luminanceThreshold: lighting.night > 0.5 ? 0.55 : 0.85,
        luminanceSmoothing: 0.25,
        mipmapBlur: true,
        radius: 0.7,
      }),
    );
  }
  effects.push(new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }));
  effects.push(new HueSaturationEffect({ saturation: 0.1 }));
  effects.push(new VignetteEffect({ offset: 0.32, darkness: lighting.night > 0.5 ? 0.62 : 0.45 }));
  if (quality.antialias) effects.push(new SMAAEffect());
  composer.addPass(new EffectPass(camera, ...effects));
  return composer;
}
