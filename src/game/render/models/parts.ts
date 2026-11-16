import { CylinderGeometry } from "three";
import type { ThemeDef } from "../../config/themes";
import { Surface } from "../materials/cityMaterial";
import type { ModelBuilder, PartStyle } from "./ModelBuilder";

/** Colors, part styles and pieces shared by all model files. */
export const C = {
  white: "#ffffff",
  paint: "#ffffff",
  metal: "#50555e",
  darkMetal: "#2c3036",
  rubber: "#1b1c1f",
  glass: "#1d2a3a",
  lightGlass: "#a9d6f5",
  wood: "#9a6b3f",
  trunk: "#7a5230",
  stone: "#c3c7cc",
  concrete: "#d9d6cf",
  roofDark: "#3c4048",
  roof: "#c4c8cf",
  roofTrim: "#9aa1ab",
  warmLight: "#ffe3a1",
  headlight: "#fff8e0",
  tailLight: "#ff2a2a",
  red: "#d62828",
  orange: "#ff7b00",
  bronze: "#a07a45",
  water: "#58c4f0",
} as const;

export const SKIN_TONES = ["#f2c7a5", "#d9a066", "#8d5a3b"] as const;

export const paint = (shade: string = C.paint): PartStyle => ({ color: shade, tint: 1 });
export const solid = (color: string, extra: Partial<PartStyle> = {}): PartStyle => ({ color, ...extra });
export const glow = (color: string, strength = 1): PartStyle => ({ color, glow: strength });
export const glass = (color: string = C.glass): PartStyle => ({ color, surface: Surface.glass });
export const metal = (color: string = C.metal): PartStyle => ({ color, surface: Surface.metal });

export type Builder = (b: ModelBuilder, theme: ThemeDef, variant: number) => void;

export function wheels(b: ModelBuilder, positions: [number, number][], radius: number, width: number) {
  for (const [x, z] of positions) {
    b.add(new CylinderGeometry(radius, radius, width, 12), solid(C.rubber), { x, y: radius, z, rx: Math.PI / 2 });
    b.add(new CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 8), metal("#b9bec6"), { x, y: radius, z, rx: Math.PI / 2 });
  }
}

export function neonAccent(theme: ThemeDef, variant: number) {
  return theme.palette.accent[variant % theme.palette.accent.length];
}

