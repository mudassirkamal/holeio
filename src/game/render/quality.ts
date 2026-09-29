export type QualityLevel = "low" | "medium" | "high" | "ultra";

export interface QualitySettings {
  maxPixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  postprocessing: boolean;
  ambientOcclusion: false | "half" | "full";
  bloom: boolean;
  antialias: boolean;
  groundTexture: number;
  particles: number;
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  low: { maxPixelRatio: 1, shadows: false, shadowMapSize: 1024, postprocessing: false, ambientOcclusion: false, bloom: false, antialias: true, groundTexture: 2048, particles: 800 },
  medium: { maxPixelRatio: 1.5, shadows: true, shadowMapSize: 2048, postprocessing: true, ambientOcclusion: false, bloom: true, antialias: true, groundTexture: 4096, particles: 1600 },
  high: { maxPixelRatio: 2, shadows: true, shadowMapSize: 2048, postprocessing: true, ambientOcclusion: "half", bloom: true, antialias: true, groundTexture: 4096, particles: 2400 },
  ultra: { maxPixelRatio: 2, shadows: true, shadowMapSize: 4096, postprocessing: true, ambientOcclusion: "full", bloom: true, antialias: true, groundTexture: 8192, particles: 3200 },
};

/** Phones and tablets: touch-first devices with tighter GPU memory and battery budgets. */
export function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
}

/**
 * The preset for `level` on this device. Mobile browsers get a smaller ground texture
 * and fewer particles: iOS in particular kills tabs that use too much memory.
 */
export function qualitySettings(level: QualityLevel): QualitySettings {
  const q = QUALITY[level];
  if (!isMobileDevice()) return q;
  return { ...q, groundTexture: Math.min(q.groundTexture, 3072), shadowMapSize: Math.min(q.shadowMapSize, 2048), particles: Math.min(q.particles, 1600) };
}

/** A sensible starting quality for the current device. */
export function detectQuality(): QualityLevel {
  if (typeof window === "undefined") return "high";
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isMobileDevice()) {
    // Adaptive resolution keeps medium smooth on most phones; only clearly weak
    // Android devices (deviceMemory is Chrome-only) start on low.
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return (memory !== undefined && memory <= 3) || cores <= 2 ? "low" : "medium";
  }
  return cores >= 8 ? "high" : "medium";
}
