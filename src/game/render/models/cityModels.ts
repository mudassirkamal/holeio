import { CylinderGeometry, type BufferGeometry } from "three";
import { KIND, type ObjectKindId } from "../../config/objectCatalog";
import type { ThemeDef } from "../../config/themes";
import { Surface } from "../materials/cityMaterial";
import { ModelBuilder, type PartStyle } from "./ModelBuilder";

const C = {
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

const SKIN_TONES = ["#f2c7a5", "#d9a066", "#8d5a3b"] as const;

const paint = (shade: string = C.paint): PartStyle => ({ color: shade, tint: 1 });
const solid = (color: string, extra: Partial<PartStyle> = {}): PartStyle => ({ color, ...extra });
const glow = (color: string, strength = 1): PartStyle => ({ color, glow: strength });
const glass = (color: string = C.glass): PartStyle => ({ color, surface: Surface.glass });
const metal = (color: string = C.metal): PartStyle => ({ color, surface: Surface.metal });

type Builder = (b: ModelBuilder, theme: ThemeDef, variant: number) => void;

// -----------------------------------------------------------------------------
// Shared pieces
// -----------------------------------------------------------------------------

function wheels(b: ModelBuilder, positions: [number, number][], radius: number, width: number) {
  for (const [x, z] of positions) {
    b.add(new CylinderGeometry(radius, radius, width, 12), solid(C.rubber), { x, y: radius, z, rx: Math.PI / 2 });
    b.add(new CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 8), metal("#b9bec6"), { x, y: radius, z, rx: Math.PI / 2 });
  }
}

function vehicleLights(b: ModelBuilder, halfLength: number, y: number, halfWidth: number) {
  for (const s of [-1, 1]) {
    b.box(0.06, 0.16, 0.36, glow(C.headlight, 1.2), { x: halfLength, y, z: s * halfWidth });
    b.box(0.06, 0.14, 0.4, glow(C.tailLight, 0.9), { x: -halfLength, y: y + 0.02, z: s * halfWidth });
  }
}

function neonAccent(theme: ThemeDef, variant: number) {
  return theme.palette.accent[variant % theme.palette.accent.length];
}

/** Glowing corner strips and roof ring for the neon theme. */
function neonTrim(b: ModelBuilder, w: number, d: number, y0: number, h: number, color: string) {
  const t = 0.28;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.box(t, h, t, glow(color, 2.2), { x: sx * (w / 2), y: y0, z: sz * (d / 2) });
    }
  }
  b.box(w + t, t, t, glow(color, 2.2), { y: y0 + h, z: d / 2 });
  b.box(w + t, t, t, glow(color, 2.2), { y: y0 + h, z: -d / 2 });
  b.box(t, t, d + t, glow(color, 2.2), { x: w / 2, y: y0 + h });
  b.box(t, t, d + t, glow(color, 2.2), { x: -w / 2, y: y0 + h });
}

/** Flat roof: light slab with a parapet in the building's paint color. */
function flatRoof(b: ModelBuilder, theme: ThemeDef, w: number, d: number, y: number) {
  const night = theme.lighting.night > 0.5;
  b.box(w - 0.3, 0.25, d - 0.3, solid(night ? "#3b3f4d" : C.roof), { y });
  const t = 0.45;
  const h = 0.7;
  b.box(w, h, t, paint("#dcdcdc"), { y, z: d / 2 - t / 2 });
  b.box(w, h, t, paint("#dcdcdc"), { y, z: -d / 2 + t / 2 });
  b.box(t, h, d - t * 2, paint("#dcdcdc"), { x: w / 2 - t / 2, y });
  b.box(t, h, d - t * 2, paint("#dcdcdc"), { x: -w / 2 + t / 2, y });
}

function roofUnits(b: ModelBuilder, y: number, spread: number, count: number) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.6;
    b.box(1.6, 0.9, 1.2, metal("#8a9099"), { x: Math.cos(a) * spread, y, z: Math.sin(a) * spread * 0.8 });
  }
}

// -----------------------------------------------------------------------------
// Models
// -----------------------------------------------------------------------------

const MODELS: Record<ObjectKindId, Builder> = {
  cone: (b) => {
    b.box(0.5, 0.06, 0.5, solid(C.rubber));
    b.cone(0.22, 0.68, solid(C.orange), { y: 0.06 }, 12);
    b.cylinder(0.12, 0.155, 0.12, solid(C.white, { glow: 0.3 }), { y: 0.3 }, 12);
  },
  hydrant: (b) => {
    b.cylinder(0.2, 0.2, 0.06, solid(C.red));
    b.cylinder(0.13, 0.14, 0.6, solid(C.red), { y: 0.06 }, 10);
    b.cylinder(0.16, 0.16, 0.06, solid("#b71c1c"), { y: 0.62 }, 10);
    b.cone(0.13, 0.14, solid(C.red), { y: 0.68 }, 10);
    b.add(new CylinderGeometry(0.05, 0.05, 0.42, 8), solid("#b71c1c"), { y: 0.45, rz: Math.PI / 2 });
    b.cylinder(0.04, 0.04, 0.05, metal(), { y: 0.8 }, 6);
  },
  trashCan: (b) => {
    b.cylinder(0.3, 0.26, 0.9, solid("#2f6b3b"), {}, 12);
    b.cylinder(0.32, 0.32, 0.06, solid("#1f4a28"), { y: 0.45 }, 12);
    b.cylinder(0.33, 0.32, 0.1, solid("#26282c"), { y: 0.9 }, 12);
    b.cylinder(0.08, 0.08, 0.05, solid("#26282c"), { y: 1.0 }, 6);
  },
  mailbox: (b) => {
    b.box(0.1, 0.8, 0.1, solid(C.darkMetal));
    b.box(0.46, 0.34, 0.5, solid("#1d4ed8"), { y: 0.8 });
    b.add(new CylinderGeometry(0.23, 0.23, 0.5, 12, 1, false, 0, Math.PI), solid("#1d4ed8"), { y: 1.14, rx: Math.PI / 2, rz: Math.PI / 2 });
    b.box(0.3, 0.04, 0.02, solid(C.white), { y: 1.0, z: 0.26 });
  },
  parkingMeter: (b) => {
    b.cylinder(0.04, 0.05, 1.0, metal());
    b.box(0.22, 0.3, 0.16, solid("#6b7280"), { y: 1.0 });
    b.box(0.16, 0.12, 0.02, glass("#8fd3ff"), { y: 1.12, z: 0.08 });
    b.add(new CylinderGeometry(0.11, 0.11, 0.16, 10, 1, false, 0, Math.PI), solid("#6b7280"), { y: 1.3, rx: Math.PI / 2, rz: Math.PI / 2 });
  },
  lampPost: (b) => {
    b.cylinder(0.18, 0.2, 0.3, solid(C.darkMetal), {}, 8);
    b.cylinder(0.06, 0.09, 5.1, solid(C.darkMetal), { y: 0.3 }, 8);
    b.box(0.08, 0.08, 1.3, solid(C.darkMetal), { y: 5.25, z: 0.6 });
    b.box(0.36, 0.16, 0.62, solid(C.darkMetal), { y: 5.12, z: 1.2 });
    b.box(0.3, 0.05, 0.52, glow(C.warmLight, 2.2), { y: 5.08, z: 1.2 });
  },
  trafficLight: (b) => {
    b.cylinder(0.08, 0.1, 5.0, solid(C.darkMetal), {}, 8);
    b.box(0.38, 1.05, 0.32, solid("#23262b"), { y: 3.85 });
    b.blob(0.1, glow("#ff3b30", 1.8), { y: 4.68, z: 0.17 }, 1);
    b.blob(0.1, glow("#ffcc00", 0.5), { y: 4.38, z: 0.17 }, 1);
    b.blob(0.1, glow("#34c759", 1.8), { y: 4.08, z: 0.17 }, 1);
    b.box(0.3, 0.06, 0.12, solid("#23262b"), { y: 4.92, z: 0.18 });
  },
  bench: (b) => {
    for (const x of [-0.78, 0.78]) {
      b.box(0.08, 0.45, 0.58, solid(C.darkMetal), { x });
      b.box(0.08, 0.5, 0.08, solid(C.darkMetal), { x, y: 0.45, z: -0.27 });
    }
    for (const z of [-0.2, 0, 0.2]) b.box(1.9, 0.06, 0.16, solid(C.wood), { y: 0.45, z });
    b.box(1.9, 0.14, 0.05, solid(C.wood), { y: 0.62, z: -0.3 });
    b.box(1.9, 0.14, 0.05, solid(C.wood), { y: 0.8, z: -0.3 });
  },
  bicycle: (b) => {
    b.torus(0.33, 0.04, solid(C.rubber), { x: 0.55, y: 0.36 });
    b.torus(0.33, 0.04, solid(C.rubber), { x: -0.55, y: 0.36 });
    b.box(0.95, 0.06, 0.06, paint(), { y: 0.72 });
    b.box(0.06, 0.5, 0.06, paint(), { x: -0.25, y: 0.36, rz: 0.2 });
    b.box(0.7, 0.06, 0.06, paint(), { x: 0.2, y: 0.52, rz: -0.5 });
    b.box(0.26, 0.06, 0.14, solid(C.rubber), { x: -0.3, y: 0.92 });
    b.box(0.06, 0.06, 0.52, solid(C.darkMetal), { x: 0.45, y: 0.98 });
    b.box(0.05, 0.3, 0.05, solid(C.darkMetal), { x: 0.45, y: 0.7 });
  },
  bush: (b) => {
    b.blob(0.58, paint(), { y: 0.5 }, 1);
    b.blob(0.45, paint("#e6e6e6"), { x: 0.38, y: 0.42, z: 0.2 }, 1);
    b.blob(0.42, paint("#d4d4d4"), { x: -0.35, y: 0.45, z: -0.18 }, 1);
  },
  flowerPot: (b) => {
    b.cylinder(0.42, 0.32, 0.45, solid("#c8643b"), {}, 10);
    b.cylinder(0.38, 0.38, 0.04, solid("#5b3a29"), { y: 0.42 }, 10);
    b.blob(0.33, solid("#4f9d4a"), { y: 0.62 }, 1);
    b.blob(0.1, solid("#ff5d8f"), { x: 0.18, y: 0.84, z: 0.08 }, 0);
    b.blob(0.1, solid("#ffd23f"), { x: -0.15, y: 0.82, z: -0.1 }, 0);
    b.blob(0.1, solid("#ffffff"), { x: 0.02, y: 0.88, z: -0.16 }, 0);
  },
  newsStand: (b) => {
    b.box(1.0, 1.15, 0.7, paint());
    b.box(1.1, 0.12, 0.8, solid(C.darkMetal), { y: 1.15 });
    b.box(0.8, 0.45, 0.02, glass(C.lightGlass), { y: 0.55, z: 0.36 });
    b.box(0.9, 0.2, 0.05, glow("#ffffff", 0.8), { y: 1.28, z: 0.3 });
  },
  phoneBooth: (b) => {
    b.box(1.1, 0.12, 1.1, solid("#b71c1c"));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.12, 2.1, 0.12, solid(C.red), { x: sx * 0.49, y: 0.12, z: sz * 0.49 });
    b.box(0.96, 1.9, 0.96, glass(C.lightGlass), { y: 0.2 });
    b.box(1.14, 0.18, 1.14, solid(C.red), { y: 2.2 });
    b.box(0.8, 0.12, 1.16, glow("#fff4d6", 1), { y: 2.08 });
  },
  person: (b, _theme, variant) => {
    const skin = SKIN_TONES[variant % SKIN_TONES.length];
    b.box(0.16, 0.8, 0.18, solid("#2f3e46"), { x: -0.1 });
    b.box(0.16, 0.8, 0.18, solid("#2f3e46"), { x: 0.1 });
    b.box(0.2, 0.08, 0.26, solid("#1b1b1b"), { x: -0.1, z: 0.04 });
    b.box(0.2, 0.08, 0.26, solid("#1b1b1b"), { x: 0.1, z: 0.04 });
    b.box(0.44, 0.62, 0.26, paint(), { y: 0.8 });
    b.box(0.12, 0.56, 0.14, paint("#e8e8e8"), { x: -0.29, y: 0.84 });
    b.box(0.12, 0.56, 0.14, paint("#e8e8e8"), { x: 0.29, y: 0.84 });
    b.box(0.12, 0.12, 0.12, solid(skin), { x: -0.29, y: 0.74 });
    b.box(0.12, 0.12, 0.12, solid(skin), { x: 0.29, y: 0.74 });
    b.cylinder(0.07, 0.08, 0.08, solid(skin), { y: 1.42 }, 6);
    b.sphere(0.16, solid(skin), { y: 1.58 }, 10);
    b.blob(0.15, solid(variant === 2 ? "#1a1a1a" : "#4a2f1d"), { y: 1.66, z: -0.03, sy: 0.75 }, 1);
  },
  busStop: (b, theme) => {
    b.box(3.8, 0.12, 1.6, solid(C.darkMetal), { y: 2.55 });
    for (const sx of [-1.8, 1.8]) for (const sz of [-0.7, 0.7]) b.box(0.1, 2.55, 0.1, solid(C.darkMetal), { x: sx, z: sz });
    b.box(3.5, 1.9, 0.05, glass(C.lightGlass), { y: 0.45, z: -0.72 });
    b.box(0.1, 1.8, 1.0, glow(neonAccent(theme, 1), 1.4), { x: 1.85, y: 0.5, z: -0.1 });
    b.box(2.8, 0.08, 0.45, solid(C.wood), { y: 0.5, z: -0.45 });
  },
  kiosk: (b, theme, variant) => {
    const accent = neonAccent(theme, variant);
    b.box(3, 2.3, 2.8, paint());
    b.box(2.4, 1.0, 0.05, glass(C.lightGlass), { y: 1.1, z: 1.41 });
    b.box(2.6, 0.12, 0.6, solid(C.wood), { y: 1.0, z: 1.6 });
    b.box(3.2, 0.1, 1.3, solid(accent), { y: 2.3, z: 1.75, rx: -0.3 });
    b.box(3.2, 0.3, 3.0, solid(accent), { y: 2.3 });
    b.box(1.8, 0.55, 0.15, glow(accent, 1.3), { y: 2.62, z: 1.2 });
  },
  tree: (b) => {
    b.cylinder(0.18, 0.28, 2.7, solid(C.trunk), {}, 7);
    b.blob(1.5, paint(), { y: 3.6 }, 1);
    b.blob(1.15, paint("#e3e3e3"), { x: 0.65, y: 4.6, z: 0.3 }, 1);
    b.blob(1.0, paint("#d0d0d0"), { x: -0.7, y: 4.3, z: -0.45 }, 1);
    b.blob(0.9, paint("#ececec"), { x: 0.1, y: 5.3, z: -0.2 }, 1);
  },
  pineTree: (b, theme) => {
    const snowy = theme.id === "frost";
    b.cylinder(0.2, 0.26, 1.4, solid(C.trunk), {}, 6);
    const tiers: [number, number, number][] = [[1.5, 2.9, 1.2], [1.2, 2.5, 2.8], [0.85, 2.2, 4.4], [0.5, 1.4, 6.1]];
    for (const [r, h, y] of tiers) {
      b.cone(r, h, paint(), { y }, 8);
      if (snowy) b.cone(r * 0.62, h * 0.42, solid("#f4f8ff"), { y: y + h * 0.6 }, 8);
    }
  },
  palmTree: (b) => {
    let x = 0;
    for (let i = 0; i < 7; i++) {
      const r = 0.24 - i * 0.012;
      b.cylinder(r - 0.02, r, 1.08, solid(i % 2 ? "#b08968" : "#9c7654"), { x, y: i * 1.05, rz: -0.07 - i * 0.02 }, 7);
      x += 0.08 + i * 0.03;
    }
    const top = 7.4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.box(2.4, 0.07, 0.62, paint(), { x: x + Math.cos(a) * 1.1, y: top - 0.25, z: Math.sin(a) * 1.1, ry: -a, rz: -0.45 });
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.blob(0.2, solid("#6b4226"), { x: x + Math.cos(a) * 0.3, y: top - 0.4, z: Math.sin(a) * 0.3 }, 0);
    }
  },
  cactus: (b) => {
    const green = solid("#2d6a4f");
    b.cylinder(0.3, 0.32, 2.6, green, {}, 8);
    b.sphere(0.3, green, { y: 2.6 }, 8);
    b.add(new CylinderGeometry(0.16, 0.16, 0.6, 7), green, { x: 0.45, y: 1.2, rz: Math.PI / 2 });
    b.cylinder(0.16, 0.16, 0.8, green, { x: 0.72, y: 1.2 }, 7);
    b.sphere(0.16, green, { x: 0.72, y: 2.0 }, 7);
    b.add(new CylinderGeometry(0.14, 0.14, 0.5, 7), green, { x: -0.4, y: 1.6, rz: Math.PI / 2 });
    b.cylinder(0.14, 0.14, 0.6, green, { x: -0.62, y: 1.6 }, 7);
    b.sphere(0.14, green, { x: -0.62, y: 2.2 }, 7);
  },
  rock: (b) => {
    b.blob(1, solid("#8e9196"), { y: 0.62, sx: 1.1, sy: 0.65, sz: 0.9, ry: 0.4 }, 0);
    b.blob(0.5, solid("#9ea1a6"), { x: 0.7, y: 0.3, z: 0.3, sy: 0.7 }, 0);
  },
  snowman: (b) => {
    const snow = solid("#f7fbff");
    b.sphere(0.55, snow, { y: 0.52 }, 12);
    b.sphere(0.4, snow, { y: 1.26 }, 12);
    b.sphere(0.28, snow, { y: 1.8 }, 12);
    b.cylinder(0.3, 0.3, 0.04, solid("#1a1a1a"), { y: 2.0 }, 10);
    b.cylinder(0.19, 0.19, 0.24, solid("#1a1a1a"), { y: 2.02 }, 10);
    b.add(new CylinderGeometry(0.0, 0.06, 0.32, 6), solid(C.orange), { y: 1.8, z: 0.4, rx: Math.PI / 2 });
    b.torus(0.3, 0.07, solid(C.red), { y: 1.55, rx: Math.PI / 2 });
    b.blob(0.035, solid("#111111"), { x: 0.1, y: 1.88, z: 0.25 }, 0);
    b.blob(0.035, solid("#111111"), { x: -0.1, y: 1.88, z: 0.25 }, 0);
  },
  beachUmbrella: (b) => {
    b.cylinder(0.04, 0.04, 2.2, solid(C.white), {}, 6);
    b.cone(1.3, 0.5, paint(), { y: 2.02 }, 8);
    b.cone(1.32, 0.12, solid(C.white), { y: 1.98 }, 8);
    b.blob(0.07, solid(C.white), { y: 2.55 }, 0);
  },
  deckChair: (b) => {
    b.box(0.7, 0.12, 1.2, solid(C.white), { y: 0.25, z: 0.3 });
    b.box(0.62, 0.05, 1.1, paint(), { y: 0.37, z: 0.3 });
    b.box(0.62, 0.05, 0.8, paint(), { y: 0.4, z: -0.55, rx: -0.75 });
    for (const x of [-0.3, 0.3]) for (const z of [-0.2, 0.8]) b.box(0.05, 0.25, 0.05, solid(C.white), { x, z });
  },
  car: (b) => {
    wheels(b, [[1.35, 0.8], [1.35, -0.8], [-1.35, 0.8], [-1.35, -0.8]], 0.34, 0.26);
    b.box(4.3, 0.62, 1.8, paint(), { y: 0.3 });
    b.box(2.2, 0.52, 1.56, glass(), { x: -0.2, y: 0.9 });
    b.box(2.0, 0.08, 1.6, paint(), { x: -0.25, y: 1.4 });
    b.box(0.12, 0.2, 1.84, solid(C.darkMetal), { x: 2.12, y: 0.28 });
    b.box(0.12, 0.2, 1.84, solid(C.darkMetal), { x: -2.12, y: 0.28 });
    vehicleLights(b, 2.16, 0.62, 0.62);
  },
  taxi: (b) => {
    const yellow = solid("#ffc21a");
    wheels(b, [[1.38, 0.8], [1.38, -0.8], [-1.38, 0.8], [-1.38, -0.8]], 0.34, 0.26);
    b.box(4.4, 0.62, 1.8, yellow, { y: 0.3 });
    b.box(4.42, 0.14, 1.82, solid("#1a1a1a"), { y: 0.62 });
    b.box(2.2, 0.52, 1.56, glass(), { x: -0.2, y: 0.9 });
    b.box(2.0, 0.08, 1.6, yellow, { x: -0.25, y: 1.4 });
    b.box(0.55, 0.18, 0.24, glow("#fff1a8", 1.4), { x: -0.2, y: 1.48 });
    vehicleLights(b, 2.2, 0.55, 0.62);
  },
  van: (b) => {
    wheels(b, [[1.75, 0.9], [1.75, -0.9], [-1.75, 0.9], [-1.75, -0.9]], 0.4, 0.3);
    b.box(5.2, 1.72, 2.0, paint(), { y: 0.42 });
    b.box(0.08, 0.72, 1.8, glass(), { x: 2.58, y: 1.2 });
    b.box(1.0, 0.6, 2.02, glass(), { x: 1.9, y: 1.25 });
    b.box(2.2, 0.5, 2.02, glass(), { x: -0.6, y: 1.35 });
    b.box(5.0, 0.1, 1.9, paint("#dddddd"), { y: 2.14 });
    vehicleLights(b, 2.6, 0.8, 0.7);
  },
  truck: (b) => {
    wheels(b, [[3.0, 1.05], [3.0, -1.05], [-1.8, 1.05], [-1.8, -1.05], [-3.0, 1.05], [-3.0, -1.05]], 0.5, 0.36);
    b.box(2.2, 2.2, 2.4, solid("#e63946"), { x: 3.1, y: 0.55 });
    b.box(0.08, 0.9, 2.2, glass(), { x: 4.2, y: 1.55 });
    b.box(1.2, 0.7, 2.42, glass(), { x: 3.3, y: 1.7 });
    b.box(6.0, 2.9, 2.5, paint("#f4f4f4"), { x: -1.1, y: 0.7 });
    b.box(8.2, 0.25, 1.4, solid(C.darkMetal), { y: 0.45 });
    vehicleLights(b, 4.22, 0.9, 0.85);
  },
  bus: (b) => {
    wheels(b, [[3.6, 1.18], [3.6, -1.18], [-3.4, 1.18], [-3.4, -1.18]], 0.52, 0.38);
    b.box(11, 2.7, 2.7, paint(), { y: 0.48 });
    b.box(9.6, 0.95, 2.74, glass(), { x: -0.4, y: 1.7 });
    b.box(0.08, 1.4, 2.5, glass(), { x: 5.5, y: 1.3 });
    b.box(10.6, 0.14, 2.5, solid("#e8e8e8"), { y: 3.18 });
    b.box(0.1, 0.35, 1.8, glow("#ffb703", 1.5), { x: 5.52, y: 2.8 });
    vehicleLights(b, 5.52, 0.9, 1.0);
  },
  fountain: (b) => {
    b.cylinder(2.75, 2.75, 0.62, solid(C.stone), {}, 18);
    b.cylinder(2.5, 2.5, 0.06, { color: C.water, surface: Surface.glass, glow: 0.35 }, { y: 0.56 }, 18);
    b.cylinder(0.35, 0.45, 1.5, solid(C.stone), {}, 10);
    b.cylinder(1.15, 0.55, 0.36, solid(C.stone), { y: 1.5 }, 14);
    b.cylinder(1.0, 1.0, 0.05, { color: C.water, surface: Surface.glass, glow: 0.35 }, { y: 1.83 }, 14);
    b.cylinder(0.08, 0.14, 0.9, { color: "#bfe9ff", glow: 0.6 }, { y: 1.86 }, 8);
    b.blob(0.3, { color: "#d7f3ff", glow: 0.6 }, { y: 2.6 }, 1);
  },
  statue: (b) => {
    const bronze: PartStyle = { color: C.bronze, surface: Surface.metal };
    b.box(3.2, 0.3, 3.2, solid(C.stone));
    b.box(2.4, 1.7, 2.4, solid("#d6d3cc"), { y: 0.3 });
    b.box(0.34, 1.2, 0.3, bronze, { x: -0.22, y: 2.0 });
    b.box(0.34, 1.2, 0.3, bronze, { x: 0.22, y: 2.0 });
    b.box(0.9, 1.3, 0.5, bronze, { y: 3.2 });
    b.sphere(0.32, bronze, { y: 4.85 }, 10);
    b.box(0.22, 1.3, 0.22, bronze, { x: 0.58, y: 4.1, rz: -0.25 });
    b.box(0.22, 1.0, 0.22, bronze, { x: -0.55, y: 3.4, rz: 0.2 });
    b.cone(0.16, 0.5, glow("#ffb347", 2.4), { x: 0.9, y: 5.4 }, 8);
    b.cylinder(0.1, 0.1, 0.35, bronze, { x: 0.85, y: 5.1 }, 6);
  },
  lifeguardTower: (b, theme) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.14, 2.6, 0.14, solid(C.white), { x: sx * 1.1, z: sz * 1.1 });
    b.box(2.8, 0.14, 2.8, solid(C.wood), { y: 2.5 });
    b.box(2.2, 1.5, 2.2, solid(neonAccent(theme, 0)), { y: 2.64 });
    b.box(1.6, 0.6, 0.05, glass(C.lightGlass), { y: 3.3, z: 1.11 });
    b.box(3.0, 0.2, 3.0, solid("#e63946"), { y: 4.2 });
    b.cylinder(0.03, 0.03, 0.8, solid(C.white), { x: 1.2, y: 4.3 }, 5);
    b.box(0.5, 0.3, 0.02, solid("#e63946"), { x: 1.45, y: 4.8 });
    b.box(0.6, 2.6, 0.08, solid(C.wood), { z: 1.6, rx: 0.4 });
  },
  billboard: (b) => {
    for (const x of [-2.6, 2.6]) b.cylinder(0.22, 0.26, 4.5, solid(C.darkMetal), { x }, 8);
    b.box(8, 3.7, 0.4, solid("#2b2f36"), { y: 4.2 });
    b.box(7.5, 3.2, 0.1, { color: C.paint, tint: 1, glow: 1.3 }, { y: 4.45, z: 0.22 });
    b.box(7.5, 0.3, 0.3, solid(C.darkMetal), { y: 7.95, z: 0.1 });
    for (const x of [-2.5, 0, 2.5]) b.box(0.3, 0.14, 0.5, glow(C.warmLight, 1.6), { x, y: 7.95, z: 0.5 });
  },
  waterTower: (b) => {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        b.box(0.3, 8.8, 0.3, solid("#6b7280"), { x: sx * 2.4, z: sz * 2.4, rx: -sz * 0.08, rz: sx * 0.08 });
      }
    }
    b.box(4.6, 0.2, 0.2, solid("#6b7280"), { y: 4, z: 2.1 });
    b.box(4.6, 0.2, 0.2, solid("#6b7280"), { y: 4, z: -2.1 });
    b.cylinder(3.3, 3.3, 5, paint(), { y: 8.5 }, 16);
    b.cylinder(3.35, 3.35, 0.2, solid(C.darkMetal), { y: 9.2 }, 16);
    b.cone(3.5, 1.5, solid(C.roofDark), { y: 13.5 }, 16);
  },
  houseSmall: (b, theme, variant) => {
    const roof = theme.palette.roofTints[variant % theme.palette.roofTints.length];
    b.facade(7.2, 3.6, 7.2, { ...paint(), surface: Surface.windows });
    b.gable(8, 3.0, 8.2, solid(roof), { y: 3.6 });
    b.box(0.95, 1.95, 0.12, solid(C.wood), { y: 0.05, z: 3.6 });
    b.box(1.6, 0.18, 1.1, solid(C.concrete), { z: 4.0 });
    b.box(0.8, 1.6, 0.8, solid("#8d6e63"), { x: 2.2, y: 5.2, z: -1.2 });
  },
  house: (b, theme, variant) => {
    const roof = theme.palette.roofTints[variant % theme.palette.roofTints.length];
    b.facade(9, 5.2, 8, { ...paint(), surface: Surface.windows });
    b.gable(10, 3.3, 9, solid(roof), { y: 5.2 });
    b.box(1.1, 2.1, 0.12, solid(C.wood), { x: -1.5, y: 0.05, z: 4.02 });
    b.box(3.2, 0.14, 1.5, solid(roof), { x: -1.5, y: 2.5, z: 4.6 });
    for (const x of [-2.9, -0.1]) b.box(0.14, 2.5, 0.14, solid(C.white), { x, z: 5.25 });
    b.box(3.4, 0.2, 1.6, solid(C.concrete), { x: -1.5, z: 4.8 });
    b.box(0.9, 2.0, 0.9, solid("#8d6e63"), { x: 3, y: 6.5, z: -1.5 });
  },
  shop: (b, theme, variant) => {
    const accent = neonAccent(theme, variant + 1);
    b.facade(12, 5.2, 10, { ...paint(), surface: Surface.storefront });
    flatRoof(b, theme, 12.2, 10.2, 5.2);
    b.box(3, 0.3, 2, glass(C.lightGlass), { x: -2.5, y: 5.3, z: -1 });
    b.box(11.4, 0.12, 1.8, solid(accent), { y: 3.05, z: 5.6, rx: -0.28 });
    b.box(6.5, 1.0, 0.2, glow(accent, 1.4), { y: 4.0, z: 5.08 });
    roofUnits(b, 5.65, 3, 2);
    if (theme.id === "neon") neonTrim(b, 12, 10, 0, 5.6, accent);
  },
  gasStation: (b, theme) => {
    const accent = neonAccent(theme, 0);
    b.facade(6, 4, 5, { ...paint(), surface: Surface.storefront }, { x: -4, z: -3 });
    b.box(6.2, 0.4, 5.2, solid(C.roof), { x: -4, y: 4, z: -3 });
    for (const x of [-0.5, 5.5]) for (const z of [-1.5, 3.5]) b.box(0.4, 5.2, 0.4, solid(C.white), { x, z });
    b.box(8.5, 0.55, 7, solid("#f5f5f5"), { x: 2.5, y: 5.2, z: 1 });
    b.box(8.6, 0.25, 7.1, solid(accent), { x: 2.5, y: 5.5, z: 1 });
    b.box(8.0, 0.05, 6.5, glow("#f8fbff", 1.5), { x: 2.5, y: 5.15, z: 1 });
    for (const x of [1.2, 3.8]) {
      b.box(0.8, 1.6, 0.6, solid("#e0e0e0"), { x, z: 1 });
      b.box(0.6, 0.4, 0.62, glow(accent, 1.2), { x, y: 1.1, z: 1 });
    }
    b.cylinder(0.15, 0.15, 4.5, solid(C.darkMetal), { x: 6.4, z: -4.8 }, 6);
    b.box(1.6, 1.6, 0.25, glow(accent, 1.6), { x: 6.4, y: 4.3, z: -4.8 });
  },
  apartment: (b, theme, variant) => {
    const neon = theme.id === "neon";
    b.facade(14, 20.4, 13, { ...paint(), surface: Surface.windows });
    for (let floor = 1; floor < 6; floor++) {
      for (const x of [-4.5, 0, 4.5]) b.box(2.4, 0.16, 1.0, solid(C.concrete), { x, y: floor * 3.2 + 0.05, z: 6.95 });
    }
    flatRoof(b, theme, 14.4, 13.4, 20.4);
    b.cylinder(1.1, 1.1, 1.4, solid("#8a9099"), { x: 3.5, y: 20.6, z: -2 }, 10);
    b.box(2.4, 1.2, 2.4, paint("#cfcfcf"), { x: -3.5, y: 20.6, z: -3 });
    b.box(3, 0.2, 1.6, solid(C.concrete), { y: 3.0, z: 7.2 });
    if (neon || variant === 1) b.box(3.5, 0.8, 0.2, glow(neonAccent(theme, variant + 2), 1.4), { y: 3.5, z: 6.6 });
    if (neon) neonTrim(b, 14, 13, 0, 21, neonAccent(theme, variant));
  },
  office: (b, theme, variant) => {
    const neon = theme.id === "neon";
    const style = variant % 2 === 0 ? Surface.curtain : Surface.windows;
    b.facade(15.5, 5, 15.5, { ...paint("#e8e8e8"), surface: Surface.storefront });
    b.facade(14.5, 29, 14.5, { ...paint(), surface: style }, { y: 5 });
    flatRoof(b, theme, 14.5, 14.5, 34);
    b.box(5, 1.4, 4, solid(C.roofTrim), { x: -3, y: 34.2, z: 3 });
    roofUnits(b, 34.3, 4, 3);
    if (neon) neonTrim(b, 14.5, 14.5, 5, 29, neonAccent(theme, variant));
  },
  tower: (b, theme, variant) => {
    const neon = theme.id === "neon";
    const style = variant % 2 === 0 ? Surface.curtain : Surface.windows;
    b.facade(17, 6, 17, { ...paint("#e8e8e8"), surface: Surface.storefront });
    b.facade(16, 30, 16, { ...paint(), surface: style }, { y: 6 });
    b.facade(12, 16, 12, { ...paint(), surface: Surface.curtain }, { y: 36 });
    flatRoof(b, theme, 12, 12, 52);
    b.box(6, 1.6, 6, solid(C.roofTrim), { y: 52.2 });
    b.cylinder(0.25, 0.4, 2.2, metal(), { y: 53.8 }, 6);
    b.blob(0.35, glow("#ff3030", 3), { y: 56 }, 1);
    if (neon) {
      neonTrim(b, 16, 16, 6, 30, neonAccent(theme, variant));
      neonTrim(b, 12, 12, 36, 16, neonAccent(theme, variant + 1));
    }
  },
  skyscraper: (b, theme, variant) => {
    const neon = theme.id === "neon";
    b.facade(21, 7, 21, { ...paint("#e8e8e8"), surface: Surface.storefront });
    b.facade(19, 34, 19, { ...paint(), surface: Surface.curtain }, { y: 7 });
    b.facade(15, 22, 15, { ...paint(), surface: Surface.curtain }, { y: 41 });
    b.facade(11, 12, 11, { ...paint(), surface: Surface.curtain }, { y: 63 });
    b.box(9, 3, 9, solid(C.roofTrim), { y: 75 });
    b.cylinder(3.2, 3.2, 0.12, solid("#3b3f4d"), { y: 75, x: 0 }, 20);
    b.cone(1.3, 4, metal("#c9ced6"), { y: 78 }, 8);
    b.blob(0.3, glow("#ff3030", 3), { y: 81.8 }, 1);
    for (const y of [41, 63]) b.box(y === 41 ? 19.4 : 15.4, 0.5, y === 41 ? 19.4 : 15.4, solid(C.roof), { y: y - 0.3 });
    if (neon || variant === 1) {
      const color = neonAccent(theme, variant);
      neonTrim(b, 19, 19, 7, 34, color);
      neonTrim(b, 15, 15, 41, 22, color);
      neonTrim(b, 11, 11, 63, 12, neonAccent(theme, variant + 1));
    }
  },
};

/** Number of distinct model variants a kind has in a theme (each is its own mesh). */
export function variantCount(kind: ObjectKindId, theme: ThemeDef): number {
  switch (kind) {
    case "house":
    case "houseSmall":
      return theme.palette.roofTints.length;
    case "person":
      return SKIN_TONES.length;
    case "office":
    case "tower":
    case "apartment":
    case "skyscraper":
    case "shop":
    case "kiosk":
      return theme.id === "neon" ? 3 : 2;
    default:
      return 1;
  }
}

/** Colors used to paint instances of a kind (null = keep the model's own colors). */
export function instancePalette(kind: ObjectKindId, theme: ThemeDef): readonly string[] | null {
  const p = theme.palette;
  switch (kind) {
    case "house":
    case "houseSmall":
    case "shop":
    case "gasStation":
    case "apartment":
    case "office":
    case "tower":
    case "skyscraper":
    case "waterTower":
    case "kiosk":
      return p.buildingTints;
    case "car":
    case "van":
    case "truck":
    case "bus":
      return p.carTints;
    case "person":
      return p.clothTints;
    case "tree":
    case "pineTree":
    case "palmTree":
    case "bush":
      return p.foliage;
    case "beachUmbrella":
    case "deckChair":
    case "billboard":
    case "newsStand":
    case "bicycle":
      return p.accent;
    default:
      return null;
  }
}

export function buildKindModel(kind: ObjectKindId, theme: ThemeDef, variant: number): BufferGeometry {
  const builder = new ModelBuilder();
  MODELS[kind](builder, theme, variant);
  return builder.build(KIND[kind].height);
}
