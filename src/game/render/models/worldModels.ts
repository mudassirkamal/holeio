import { ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from "three";
import type { ObjectKindId } from "../../config/objectCatalog";
import type { ThemePalette } from "../../config/themes";
import { Surface } from "../materials/cityMaterial";
import type { ModelBuilder, PartStyle } from "./ModelBuilder";
import { C, glass, glow, metal, neonAccent, paint, solid, wheels, type Builder } from "./parts";

/**
 * Landmarks and props of the themed worlds (desert, harbor, fun fair, moon base…).
 * Same conventions as cityModels: origin on the ground, buildings face +Z, vehicles +X.
 */

const HALF_PI = Math.PI / 2;
const smooth = (style: PartStyle): PartStyle => ({ ...style, flat: false });
const STONE = "#b1ada4";
const STONE_DARK = "#8f8b82";
const LAVA = "#ff5a1f";
const GOLD: PartStyle = { color: "#d9a520", surface: Surface.metal };
const HULL = "#e6e9ee";

/** A cylinder lying along X, centered at the placement point. */
function tube(b: ModelBuilder, rFront: number, rBack: number, length: number, style: PartStyle, x: number, y: number, z = 0, segments = 12) {
  b.add(new CylinderGeometry(rFront, rBack, length, segments), style, { x, y, z, rz: -HALF_PI });
}

/** `count` points on a circle of radius `r`. */
const ring = (count: number, r: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => {
    const a = offset + (i / count) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r, a] as const;
  });

function shippingContainer(b: ModelBuilder, style: PartStyle, y: number, z: number) {
  b.box(6.1, 2.6, 2.5, style, { y, z });
  for (let i = 0; i < 10; i++) b.box(0.1, 2.44, 2.56, { ...style, color: "#cfcfcf" }, { x: -2.6 + i * 0.58, y: y + 0.08, z });
  b.box(0.06, 2.3, 2.2, solid("#3a3f48"), { x: 3.06, y: y + 0.15, z });
  for (const dz of [-0.45, 0.45]) b.box(0.08, 2.2, 0.06, metal("#b9bec6"), { x: 3.1, y: y + 0.2, z: z + dz });
}

export const WORLD_MODELS = {
  // ---------------------------------------------------------------------------
  // Shared
  // ---------------------------------------------------------------------------
  well: (b) => {
    b.cylinder(1.05, 1.1, 0.9, solid(C.stone), {}, 12);
    b.cylinder(0.8, 0.8, 0.04, { color: "#2a6f97", surface: Surface.glass }, { y: 0.88 }, 12);
    for (const x of [-0.9, 0.9]) b.box(0.14, 1.4, 0.14, solid(C.wood), { x, y: 0.9 });
    b.box(1.9, 0.1, 0.1, solid(C.wood), { y: 1.95 });
    b.gable(2.3, 0.6, 1.6, solid("#8a4b2f"), { y: 2.1 });
    b.box(0.3, 0.3, 0.3, solid("#6b4226"), { y: 1.3 });
  },
  barrel: (b) => {
    b.cylinder(0.33, 0.33, 1, solid(C.wood), {}, 10);
    b.cylinder(0.38, 0.38, 0.5, solid("#8a5a32"), { y: 0.25 }, 10);
    for (const y of [0.18, 0.76]) b.cylinder(0.385, 0.385, 0.07, solid(C.darkMetal), { y }, 10);
  },
  foodStall: (b) => {
    b.box(3, 1, 1, solid(C.wood), { z: 0.5 });
    b.box(3.1, 0.08, 1.1, solid("#e8dcc4"), { y: 1, z: 0.5 });
    for (const x of [-1.45, 1.45]) for (const z of [-1, 1]) b.box(0.1, 2.5, 0.1, solid(C.white), { x, z });
    for (let i = 0; i < 6; i++) b.box(0.54, 0.1, 2.5, i % 2 ? solid(C.white) : paint(), { x: -1.35 + i * 0.54, y: 2.5, rx: -0.1 });
    b.box(3.2, 0.34, 0.06, paint("#dddddd"), { y: 2.14, z: 1.24 });
    const goods = ["#ff5d8f", "#ffd23f", "#7cf05a", "#ff9f1c"];
    goods.forEach((color, i) => b.blob(0.17, solid(color), { x: -0.9 + i * 0.6, y: 1.2, z: 0.5 }, 0));
  },

  // ---------------------------------------------------------------------------
  // Dune Oasis
  // ---------------------------------------------------------------------------
  tent: (b) => {
    b.cone(2.6, 2.7, paint(), { ry: Math.PI / 4 }, 4);
    b.cone(2.68, 0.5, solid("#f3ead7"), { ry: Math.PI / 4 }, 4);
    b.cylinder(0.05, 0.05, 3, solid(C.wood), {}, 5);
    b.box(0.5, 0.26, 0.03, paint("#dddddd"), { x: 0.27, y: 2.7 });
  },
  camel: (b) => {
    const fur = solid("#c9a063");
    b.box(1.5, 0.7, 0.7, fur, { y: 1 });
    b.blob(0.36, fur, { x: -0.3, y: 1.75, sy: 0.9 }, 1);
    b.blob(0.32, fur, { x: 0.35, y: 1.72, sy: 0.85 }, 1);
    for (const x of [-0.6, 0.6]) for (const z of [-0.24, 0.24]) b.box(0.16, 1, 0.16, solid("#b58d52"), { x, z });
    b.box(0.26, 1, 0.3, fur, { x: 0.78, y: 1.3, rz: -0.5 });
    b.box(0.5, 0.3, 0.3, fur, { x: 1.05, y: 2 });
    b.box(0.9, 0.12, 0.74, solid("#b23a2e"), { y: 1.7 });
  },
  adobeHouse: (b) => {
    b.facade(9, 4.2, 8, { ...paint(), surface: Surface.windows });
    b.box(9.3, 0.55, 8.3, paint("#ececec"), { y: 4.2 });
    b.box(8.5, 0.2, 7.5, solid("#b08a5a"), { y: 4.45 });
    for (const x of [-3.3, -1.1, 1.1, 3.3]) b.add(new CylinderGeometry(0.13, 0.13, 0.9, 6), solid(C.trunk), { x, y: 3.7, z: 4.2, rx: HALF_PI });
    b.box(1.1, 2.1, 0.12, solid(C.wood), { y: 0.05, z: 4.02 });
    b.sphere(1.5, paint("#f4f4f4"), { x: -2.2, y: 4.6, z: -1.2, sy: 0.4 }, 12);
  },
  pyramid: (b) => {
    b.cone(15.5, 14.2, solid("#d9b36c"), { ry: Math.PI / 4 }, 4);
    b.cone(1.75, 1.6, GOLD, { y: 13.4, ry: Math.PI / 4 }, 4);
    b.box(3.4, 3.2, 2.6, solid("#c9a25c"), { z: 9.7 });
    b.box(1.7, 2.3, 0.2, solid("#2a1d10"), { z: 11 });
    for (const x of [-2.3, 2.3]) b.cylinder(0.3, 0.36, 3.6, solid("#e3c88d"), { x, z: 10.6 }, 8);
  },

  // ---------------------------------------------------------------------------
  // Sakura Garden
  // ---------------------------------------------------------------------------
  stoneLantern: (b) => {
    b.cylinder(0.4, 0.45, 0.2, solid(C.stone), {}, 8);
    b.cylinder(0.14, 0.18, 0.9, solid(C.stone), { y: 0.2 }, 8);
    b.box(0.62, 0.12, 0.62, solid(C.stone), { y: 1.1 });
    b.box(0.42, 0.38, 0.42, glow(C.warmLight, 1.8), { y: 1.22 });
    b.cone(0.62, 0.36, solid("#8d9299"), { y: 1.6, ry: Math.PI / 4 }, 4);
  },
  torii: (b) => {
    const red = solid("#d1342f");
    for (const x of [-2.2, 2.2]) {
      b.cylinder(0.3, 0.32, 0.4, solid("#22252b"), { x }, 10);
      b.cylinder(0.22, 0.26, 4.5, red, { x, y: 0.3 }, 10);
    }
    b.box(5.2, 0.3, 0.3, red, { y: 3.6 });
    b.box(6, 0.36, 0.6, red, { y: 4.6 });
    b.box(6.4, 0.22, 0.78, solid("#22252b"), { y: 4.96 });
    b.box(0.5, 0.7, 0.14, GOLD, { y: 3.9 });
  },
  teaHouse: (b, theme) => {
    const roof = theme.palette.roofTints[0];
    b.box(10, 0.4, 8, solid("#6b4a32"));
    b.facade(8.4, 3.2, 6.4, { color: "#f5efe0", surface: Surface.windows }, { y: 0.4 });
    for (const x of [-4.4, 4.4]) for (const z of [-3.4, 3.4]) b.box(0.3, 3.2, 0.3, solid("#b23a2e"), { x, y: 0.4, z });
    b.box(10.6, 0.25, 8.8, solid(roof), { y: 3.6 });
    b.gable(10.2, 2.2, 7.6, solid(roof), { y: 3.8 });
    b.box(1.1, 2, 0.12, solid(C.wood), { y: 0.4, z: 3.22 });
    for (const x of [-1.2, 1.2]) b.box(0.3, 0.45, 0.3, glow("#ffb7a8", 1.6), { x, y: 2.6, z: 3.6 });
  },
  pagoda: (b, theme) => {
    const roof = theme.palette.roofTints[0];
    b.box(11.6, 1, 11.6, solid(C.stone));
    for (let i = 0; i < 5; i++) {
      const w = 9 - i * 1.3;
      const y = 1 + i * 4.4;
      b.box(w + 0.3, 0.25, w + 0.3, solid("#b23a2e"), { y });
      b.facade(w, 3.2, w, { color: "#f5efe0", surface: Surface.windows }, { y: y + 0.2 });
      b.cone((w + 2.6) / Math.SQRT2, 1.4, solid(roof), { y: y + 3.2, ry: Math.PI / 4 }, 4);
    }
    b.cylinder(0.1, 0.22, 2, GOLD, { y: 23 }, 6);
    b.blob(0.3, { ...GOLD, glow: 0.6 }, { y: 24.2 }, 1);
  },

  // ---------------------------------------------------------------------------
  // Harbor Docks
  // ---------------------------------------------------------------------------
  forklift: (b) => {
    wheels(b, [[0.7, 0.55], [0.7, -0.55], [-0.75, 0.55], [-0.75, -0.55]], 0.3, 0.2);
    b.box(1.7, 0.8, 1.15, solid("#f4b400"), { x: -0.25, y: 0.3 });
    for (const x of [-0.95, 0.35]) for (const z of [-0.5, 0.5]) b.box(0.07, 1, 0.07, solid(C.darkMetal), { x, y: 1.1, z });
    b.box(1.5, 0.07, 1.15, solid(C.darkMetal), { x: -0.3, y: 2.1 });
    b.box(0.12, 2.1, 1, solid(C.darkMetal), { x: 0.75 });
    for (const z of [-0.3, 0.3]) b.box(0.9, 0.06, 0.14, metal("#b9bec6"), { x: 1.3, y: 0.14, z });
  },
  container: (b) => shippingContainer(b, paint(), 0, 0),
  containerStack: (b) => {
    shippingContainer(b, paint(), 0, -1.32);
    shippingContainer(b, solid("#2a6f97"), 0, 1.32);
    shippingContainer(b, solid("#c44536"), 2.65, -1.32);
    shippingContainer(b, paint("#bdbdbd"), 2.65, 1.32);
  },
  boat: (b) => {
    for (const x of [-1.6, 1.4]) b.box(0.3, 0.5, 2.2, solid(C.wood), { x });
    b.box(5, 1.1, 2.4, paint(), { x: -0.8, y: 0.5 });
    b.blob(1.3, paint(), { x: 1.9, y: 1.05, sx: 1.25, sy: 0.42, sz: 0.92 }, 1);
    b.box(5.2, 0.12, 2.5, solid(C.white), { x: -0.8, y: 1.6 });
    b.box(1.8, 1.2, 1.6, solid(C.white), { x: -1.4, y: 1.7 });
    b.box(1.84, 0.45, 1.64, glass(), { x: -1.4, y: 2.2 });
    b.cylinder(0.05, 0.05, 0.5, solid(C.darkMetal), { x: -1.4, y: 2.9 }, 5);
  },
  warehouse: (b) => {
    b.box(18, 5.6, 13, paint());
    for (let i = 0; i < 9; i++) b.box(0.16, 5.5, 13.06, paint("#d5d5d5"), { x: -8 + i * 2 });
    b.gable(18.4, 2.4, 13.5, solid("#7d8597"), { y: 5.6 });
    for (const x of [-5.6, 0, 5.6]) b.box(3.6, 3.9, 0.14, solid("#4a5568"), { x, z: 6.5 });
    b.box(7, 0.8, 0.14, glow("#ffd23f", 1.1), { y: 4.4, z: 6.52 });
    for (const x of [-5, 5]) b.cylinder(0.5, 0.5, 0.7, metal("#8a9099"), { x, y: 7.2 }, 8);
  },
  lighthouse: (b) => {
    b.cylinder(3, 3, 1, solid(C.stone), {}, 14);
    b.cylinder(1.6, 2.6, 17, solid(C.white), { y: 1 }, 14);
    b.cylinder(2.25, 2.4, 2.6, solid(C.red), { y: 4.4 }, 14);
    b.cylinder(1.88, 2.03, 2.6, solid(C.red), { y: 10.8 }, 14);
    b.cylinder(2.2, 2.2, 0.3, solid(C.darkMetal), { y: 18 }, 14);
    b.cylinder(1.3, 1.3, 2.4, { color: "#fff3b0", glow: 2.6 }, { y: 18.3 }, 10);
    b.cone(1.7, 2.2, solid(C.red), { y: 20.7 }, 10);
    b.blob(0.3, solid(C.darkMetal), { y: 23.2 }, 0);
    b.box(0.9, 1.8, 0.12, solid(C.wood), { y: 1, z: 2.62 });
  },
  crane: (b) => {
    const yellow = solid("#f4b400");
    for (const x of [-3.8, 3.8]) for (const z of [-3.8, 3.8]) b.box(0.8, 22, 0.8, yellow, { x, z });
    for (const y of [8, 21.4]) {
      for (const z of [-3.8, 3.8]) b.box(8.4, 0.6, 0.6, yellow, { y, z });
      for (const x of [-3.8, 3.8]) b.box(0.6, 0.6, 8.4, yellow, { x, y });
    }
    b.box(5, 3, 4.4, solid("#e6e9ee"), { y: 22 });
    b.box(5.04, 0.9, 4.44, glass(), { y: 23.4 });
    b.box(0.8, 7, 0.8, yellow, { x: -2, y: 22 });
    b.box(8.8, 0.8, 0.8, yellow, { y: 25.6 });
    b.box(0.12, 4.9, 0.12, solid(C.darkMetal), { x: -2, y: 29, rz: -2.1 });
    b.box(0.1, 6.4, 0.1, solid(C.darkMetal), { x: 3.6, y: 19.4 });
    b.box(0.7, 0.9, 0.7, solid(C.darkMetal), { x: 3.6, y: 18.6 });
    b.blob(0.32, glow("#ff3030", 3), { x: -2, y: 29.4 }, 1);
  },

  // ---------------------------------------------------------------------------
  // Harvest Valley
  // ---------------------------------------------------------------------------
  pumpkin: (b) => {
    b.blob(0.4, solid("#f08a24"), { y: 0.3, sy: 0.72 }, 1);
    b.cylinder(0.04, 0.06, 0.16, solid("#4f7a34"), { y: 0.5 }, 5);
  },
  hayBale: (b) => {
    b.add(new CylinderGeometry(0.75, 0.75, 1.6, 12), solid("#d9b44a"), { y: 0.75, rz: HALF_PI });
    for (const x of [-0.42, 0.42]) b.add(new CylinderGeometry(0.77, 0.77, 0.08, 12), solid("#b8902f"), { x, y: 0.75, rz: HALF_PI });
  },
  scarecrow: (b) => {
    b.box(0.1, 2, 0.1, solid(C.wood));
    b.box(1.5, 0.1, 0.1, solid(C.wood), { y: 1.45 });
    b.box(0.6, 0.7, 0.3, solid("#c0392b"), { y: 0.95 });
    b.box(0.5, 0.5, 0.26, solid("#3d5a80"), { y: 0.45 });
    b.blob(0.22, solid("#e8c98f"), { y: 1.9 }, 1);
    b.cone(0.36, 0.38, solid(C.trunk), { y: 1.98 }, 8);
  },
  cow: (b) => {
    b.box(1.5, 0.75, 0.7, solid("#f5f5f5"), { x: -0.1, y: 0.6 });
    b.box(0.5, 0.42, 0.72, solid("#26262b"), { x: -0.45, y: 0.9 });
    b.box(0.4, 0.3, 0.72, solid("#26262b"), { x: 0.2, y: 0.62 });
    b.box(0.5, 0.45, 0.45, solid("#f5f5f5"), { x: 0.9, y: 0.95 });
    b.box(0.2, 0.25, 0.36, solid("#f2b5b5"), { x: 1.2, y: 0.95 });
    for (const x of [-0.7, 0.45]) for (const z of [-0.24, 0.24]) b.box(0.16, 0.6, 0.16, solid("#ececec"), { x, z });
  },
  tractor: (b) => {
    wheels(b, [[-0.9, 0.85], [-0.9, -0.85]], 0.75, 0.4);
    wheels(b, [[1.25, 0.8], [1.25, -0.8]], 0.42, 0.26);
    b.box(2.3, 0.8, 1.1, solid("#2e8b3d"), { x: 0.55, y: 0.7 });
    b.box(1.3, 1.2, 1.3, glass(C.lightGlass), { x: -0.8, y: 1.2 });
    b.box(1.5, 0.1, 1.5, solid("#2e8b3d"), { x: -0.8, y: 2.4 });
    b.cylinder(0.06, 0.06, 0.9, solid(C.darkMetal), { x: 1.3, y: 1.5 }, 6);
  },
  silo: (b) => {
    const steel: PartStyle = { color: "#c9ced6", surface: Surface.metal, flat: false };
    b.cylinder(2.1, 2.1, 10.5, steel, {}, 16);
    for (const y of [2.6, 5.2, 7.8]) b.cylinder(2.14, 2.14, 0.14, solid("#8a9099"), { y }, 16);
    b.sphere(2.1, steel, { y: 10.5, sy: 0.85 }, 16);
    b.cylinder(0.3, 0.3, 0.7, solid("#8a9099"), { y: 12.2 }, 8);
    b.box(0.34, 10.5, 0.1, solid(C.darkMetal), { z: 2.14 });
  },
  barn: (b) => {
    b.box(13, 5, 10, solid("#b23a2e"));
    for (const x of [-6.4, 6.4]) for (const z of [-4.9, 4.9]) b.box(0.3, 5, 0.3, solid(C.white), { x, z });
    b.box(13.1, 0.3, 10.1, solid(C.white), { y: 4.8 });
    b.gable(13.6, 4.5, 10.9, solid("#4a4e57"), { y: 5 });
    b.box(3.6, 3.9, 0.14, solid("#8a2a20"), { z: 5 });
    for (const rz of [-0.72, 0.72]) b.box(0.22, 4.9, 0.06, solid(C.white), { y: 0.1, z: 5.09, x: rz * 2.25, rz });
    b.box(1.2, 1, 0.1, glow(C.warmLight, 1.2), { x: 4.4, y: 2.4, z: 5.02 });
  },
  windmill: (b) => {
    b.cylinder(1.6, 2.6, 11, solid("#f5efe0"), {}, 8);
    b.cone(2.05, 2.2, solid("#8a4b2f"), { y: 11 }, 8);
    b.box(1, 1.9, 0.12, solid(C.wood), { z: 2.52 });
    b.box(0.7, 0.9, 0.1, glow(C.warmLight, 1.2), { y: 6, z: 2.12 });
    b.add(new CylinderGeometry(0.22, 0.22, 1, 8), solid(C.darkMetal), { y: 11.3, z: 1.9, rx: HALF_PI });
    for (let i = 0; i < 4; i++) {
      const rz = 0.4 + i * HALF_PI;
      b.box(0.16, 5.7, 0.1, solid(C.wood), { y: 11.3, z: 2.3, rz });
      b.box(0.95, 5.5, 0.05, solid("#efe6d0"), { y: 11.3, z: 2.36, rz: rz + 0.09 });
    }
  },

  // ---------------------------------------------------------------------------
  // Candy Kingdom
  // ---------------------------------------------------------------------------
  candyCane: (b) => {
    b.cylinder(0.14, 0.14, 1.9, solid(C.white), {}, 6);
    for (let i = 0; i < 4; i++) b.cylinder(0.146, 0.146, 0.2, solid(C.red), { y: 0.12 + i * 0.46 }, 6);
    b.add(new TorusGeometry(0.32, 0.14, 5, 7, Math.PI), smooth(solid(C.white)), { x: 0.32, y: 1.9 });
    b.add(new TorusGeometry(0.32, 0.146, 5, 2, 0.8), smooth(solid(C.red)), { x: 0.32, y: 1.9, rz: 1.15 });
  },
  lollipop: (b) => {
    b.cylinder(0.06, 0.06, 2.2, solid(C.white), {}, 6);
    b.add(new CylinderGeometry(0.8, 0.8, 0.3, 12), smooth(paint()), { y: 2.8, rx: HALF_PI });
    b.add(new TorusGeometry(0.5, 0.08, 3, 10), smooth(solid(C.white)), { y: 2.8, z: 0.14 });
    b.add(new TorusGeometry(0.22, 0.08, 3, 7), smooth(solid(C.white)), { y: 2.8, z: 0.14 });
  },
  iceCreamCone: (b) => {
    b.add(new ConeGeometry(1, 2.6, 10), solid("#d9a25f"), { y: 1.3, rx: Math.PI });
    b.sphere(1.05, paint(), { y: 3 }, 12);
    b.sphere(0.85, solid("#fff3e0"), { y: 4 }, 12);
    b.blob(0.22, solid(C.red), { y: 4.8 }, 1);
  },
  donut: (b) => {
    b.box(1.3, 0.3, 1.3, solid(C.white));
    b.torus(1.42, 0.62, solid("#e0a15e"), { y: 2.2 });
    b.torus(1.42, 0.5, paint(), { y: 2.2, z: 0.22 });
    const sprinkles = ["#ffffff", "#ffd23f", "#4fd6ff", "#7cf05a"];
    for (const [x, y, a] of ring(10, 1.42, 0.2)) b.box(0.26, 0.08, 0.08, solid(sprinkles[Math.floor(a * 3) % 4]), { x, y: 2.2 + y, z: 0.72, rz: a * 2.3 });
  },
  cupcake: (b) => {
    b.cylinder(2.3, 1.7, 2.2, paint(), {}, 12);
    for (const [x, z, a] of ring(12, 2.02)) b.box(0.12, 2.1, 0.5, paint("#d0d0d0"), { x, y: 0.05, z, ry: -a });
    const frosting = smooth(solid("#fff0f5"));
    b.sphere(2.3, frosting, { y: 2.6, sy: 0.5 }, 14);
    b.sphere(1.7, frosting, { y: 3.4, sy: 0.5 }, 14);
    b.sphere(1.1, frosting, { y: 4.1, sy: 0.55 }, 12);
    b.sphere(0.5, solid(C.red), { y: 4.9 }, 10);
  },
  gingerbreadHouse: (b, theme) => {
    b.facade(8.2, 4.2, 7.2, { color: "#a4633a", surface: Surface.windows });
    b.box(8.5, 0.3, 7.5, solid(C.white), { y: 4 });
    b.gable(9, 3.5, 8.2, solid("#fff7fb"), { y: 4.2 });
    theme.palette.accent.forEach((color, i) => b.blob(0.34, solid(color), { x: -3.4 + i * 1.7, y: 7.75 }, 1));
    b.box(1.3, 2.3, 0.14, solid("#ff8fb1"), { z: 3.62 });
    for (const x of [-1.1, 1.1]) b.cylinder(0.12, 0.12, 2.5, solid(C.white), { x, z: 3.8 }, 6);
    for (const x of [-1.1, 1.1]) for (const y of [0.5, 1.3, 2.1]) b.cylinder(0.126, 0.126, 0.25, solid(C.red), { x, y, z: 3.8 }, 6);
  },
  cakeTower: (b, theme) => {
    const icing = smooth(solid("#fff7fb"));
    const tiers: [number, number, number][] = [[6, 6, 0], [4.4, 5.5, 6], [2.8, 5, 11.5]];
    tiers.forEach(([r, h, y], t) => {
      b.cylinder(r, r, h, smooth(paint(t === 1 ? "#e2e2e2" : "#ffffff")), { y }, 20);
      b.cylinder(r + 0.16, r + 0.16, 0.8, icing, { y: y + h - 0.6 }, 20);
      for (const [x, z, a] of ring(8 - t * 2, r + 0.05, t)) {
        b.blob(0.42, solid(neonAccent(theme, Math.round(a * 3))), { x, y: y + h * 0.4, z }, 0);
      }
    });
    b.cylinder(0.3, 0.3, 2.4, solid(C.white), { y: 16.5 }, 8);
    b.cone(0.36, 0.9, glow("#ff9d2e", 3), { y: 18.9 }, 8);
  },

  // ---------------------------------------------------------------------------
  // Ember Ridge
  // ---------------------------------------------------------------------------
  lavaRock: (b) => {
    b.blob(1.1, solid("#2b2422"), { y: 0.72, sx: 1.15, sy: 0.75, sz: 0.95, ry: 0.5 }, 0);
    b.blob(0.5, solid("#3a302c"), { x: -0.8, y: 0.3, z: 0.4, sy: 0.7 }, 0);
    b.blob(0.3, glow(LAVA, 2.6), { x: 0.5, y: 1, z: 0.42 }, 0);
    b.blob(0.22, glow("#ff8a1f", 2.6), { x: -0.2, y: 1.2, z: -0.3 }, 0);
  },
  obsidianSpire: (b) => {
    const obsidian: PartStyle = { color: "#2a2633", surface: Surface.glass };
    b.cylinder(1.5, 1.7, 0.25, glow(LAVA, 1.4), {}, 8);
    b.cone(1.3, 9, obsidian, { ry: 0.3 }, 5);
    b.cone(0.7, 4.6, obsidian, { x: 0.9, z: 0.4, rz: -0.25 }, 5);
    b.cone(0.6, 3.2, obsidian, { x: -0.8, z: -0.5, rz: 0.3 }, 5);
  },
  bunker: (b) => {
    b.box(9, 3.4, 8, solid("#676c78"));
    b.box(9.6, 0.5, 8.6, solid("#3f434d"), { y: 3.4 });
    b.box(3.2, 0.42, 0.1, glow("#ffb347", 1.9), { y: 2.2, z: 4.02 });
    b.box(1.3, 2.1, 0.14, solid("#2c3036"), { x: -3, z: 4 });
    b.cylinder(0.5, 0.5, 0.6, metal("#8a9099"), { x: 2.5, y: 3.9, z: -2 }, 8);
    b.blob(0.2, glow("#ff3030", 3), { x: -3.6, y: 4.1, z: 3.4 }, 0);
  },
  drillRig: (b) => {
    const steel = solid("#8a939e");
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.3, 14.2, 0.3, steel, { x: sx * 2.6, z: sz * 2.6, rx: -sz * 0.14, rz: sx * 0.14 });
    b.box(5.8, 0.3, 5.8, solid("#4a4e57"), { y: 1.2 });
    b.box(3.8, 0.25, 3.8, solid("#4a4e57"), { y: 7 });
    b.box(1.7, 0.9, 1.7, solid("#c0392b"), { y: 13.9 });
    b.cylinder(0.2, 0.2, 13, solid(C.darkMetal), { y: 1 }, 8);
    b.box(2, 1.5, 1.5, solid("#d97706"), { x: 1.6, y: 1.5, z: 1.4 });
    b.blob(0.34, glow("#ff3030", 3), { y: 15.3 }, 1);
  },
  miniVolcano: (b) => {
    b.cylinder(2.4, 7, 8, solid("#5a463c"), {}, 10);
    b.cylinder(2.2, 2.2, 0.3, glow(LAVA, 3), { y: 7.85 }, 10);
    for (const [x, z] of ring(6, 2.5)) b.blob(0.7, solid("#2b2422"), { x, y: 7.9, z, sy: 0.7 }, 0);
    const stream = glow("#ff7a1a", 2.3);
    b.box(0.7, 8.6, 0.15, stream, { z: 7.05, rx: -0.52 });
    b.box(0.15, 8.6, 0.6, stream, { x: 7.05, rz: 0.52 });
    b.box(0.15, 8.6, 0.5, stream, { x: -7.05, rz: -0.52 });
    b.blob(0.8, solid("#5c5856"), { x: 0.4, y: 8.4 }, 0);
  },

  // ---------------------------------------------------------------------------
  // Fun Fair
  // ---------------------------------------------------------------------------
  balloonCart: (b, theme) => {
    for (const z of [-0.42, 0.42]) b.add(new CylinderGeometry(0.26, 0.26, 0.08, 8), solid(C.rubber), { y: 0.26, z, rx: HALF_PI });
    b.box(1.2, 0.8, 0.8, paint(), { y: 0.3 });
    b.cylinder(0.03, 0.03, 1.6, solid(C.white), { y: 1.1 }, 4);
    theme.palette.accent.slice(0, 4).forEach((color, i) => {
      b.blob(0.3, { color, glow: 0.35 }, { x: Math.cos(i * 1.9) * 0.34, y: 2.55 + (i % 3) * 0.22, z: Math.sin(i * 1.9) * 0.3, sy: 1.15 }, 1);
    });
  },
  carousel: (b) => {
    b.cylinder(4.4, 4.4, 0.5, solid(C.stone), {}, 16);
    b.cylinder(0.8, 0.8, 4.4, solid("#fff7e6"), { y: 0.5 }, 10);
    b.cylinder(4.65, 4.65, 0.4, { color: "#fff4c2", glow: 1.6 }, { y: 4.6 }, 16);
    b.cone(4.6, 2, paint(), { y: 4.9 }, 12);
    b.blob(0.3, { ...GOLD, glow: 0.8 }, { y: 6.9 }, 1);
    ring(8, 3.4).forEach(([x, z, a], i) => {
      b.cylinder(0.06, 0.06, 4.2, GOLD, { x, y: 0.5, z }, 6);
      const y = 1.4 + (i % 2) * 0.5;
      b.box(0.9, 0.5, 0.3, solid(C.white), { x, y, z, ry: -a + HALF_PI });
      b.box(0.28, 0.5, 0.26, solid(C.white), { x: x - Math.sin(a) * 0.45, y: y + 0.35, z: z + Math.cos(a) * 0.45, ry: -a + HALF_PI });
    });
  },
  dropTower: (b, theme) => {
    b.box(4, 1, 4, solid("#3b3f4d"));
    b.box(1.4, 24, 1.4, paint("#dddddd"), { y: 1 });
    for (const x of [-0.76, 0.76]) for (const z of [-0.76, 0.76]) b.box(0.12, 24, 0.12, glow(neonAccent(theme, 1), 2), { x, y: 1, z });
    b.box(3.6, 1.2, 3.6, solid("#22252b"), { y: 14 });
    b.box(3.7, 0.2, 3.7, glow(C.warmLight, 1.8), { y: 14.5 });
    b.box(2.2, 0.8, 2.2, solid("#22252b"), { y: 25 });
    b.blob(0.3, glow("#ff3030", 3), { y: 26 }, 1);
  },
  circusTent: (b) => {
    b.cylinder(6.6, 6.6, 3.6, solid("#fff7e6"), {}, 16);
    for (const [x, z, a] of ring(8, 6.62)) b.box(1.3, 3.5, 0.08, paint(), { x, z, ry: -a + HALF_PI });
    b.cone(7.2, 5.4, paint(), { y: 3.6 }, 16);
    b.cone(2.6, 2.6, solid("#fff7e6"), { y: 7.7 }, 12);
    b.cylinder(0.06, 0.06, 1, solid(C.darkMetal), { y: 10 }, 5);
    b.box(0.8, 0.44, 0.04, solid(C.red), { x: 0.42, y: 10.5 });
    b.box(2.6, 2.9, 0.3, solid("#3a0d12"), { z: 6.5 });
    for (const [x, z] of ring(14, 6.9)) b.blob(0.16, glow(C.warmLight, 2.4), { x, y: 3.65, z }, 0);
  },
  ferrisWheel: (b, theme) => {
    const cy = 10.2;
    const r = 8;
    b.box(13, 0.4, 5, solid("#3b3f4d"));
    for (const z of [-1.6, 1.6]) for (const sx of [-1, 1]) b.box(0.4, 11.3, 0.4, solid(C.white), { x: sx * 5, z, rz: sx * 0.456 });
    b.add(new CylinderGeometry(0.6, 0.6, 3.8, 10), metal("#b9bec6"), { y: cy, rx: HALF_PI });
    b.add(new TorusGeometry(r, 0.2, 4, 32), smooth({ color: "#ffffff", tint: 1, glow: 0.9 }), { y: cy });
    b.add(new TorusGeometry(r * 0.6, 0.1, 3, 24), smooth(solid(C.white)), { y: cy });
    for (let i = 0; i < 16; i++) b.box(0.12, r, 0.12, solid(C.white), { y: cy, rz: (i * Math.PI) / 8 });
    ring(12, r).forEach(([x, y], i) => {
      b.box(1.1, 1, 1.2, solid(neonAccent(theme, i)), { x, y: cy + y - 1.1 });
      b.box(1.14, 0.3, 1.24, glass(C.lightGlass), { x, y: cy + y - 0.55 });
    });
  },

  // ---------------------------------------------------------------------------
  // Sky Port
  // ---------------------------------------------------------------------------
  luggageCart: (b) => {
    wheels(b, [[1, 0.55], [1, -0.55], [-0.4, 0.55], [-1.2, 0.55], [-0.4, -0.55], [-1.2, -0.55]], 0.2, 0.14);
    b.box(1, 1, 1.2, solid("#f4b400"), { x: 1, y: 0.2 });
    b.box(1.9, 0.14, 1.3, solid(C.darkMetal), { x: -0.7, y: 0.3 });
    const bags = ["#c0392b", "#2a6f97", "#3a7d44", "#6a4c93"];
    bags.forEach((color, i) => b.box(0.7, 0.45 + (i % 2) * 0.2, 0.5, solid(color), { x: -0.25 - (i >> 1) * 0.85, y: 0.44, z: i % 2 ? 0.3 : -0.3 }));
  },
  radar: (b) => {
    b.box(2.6, 3, 2.6, solid(HULL));
    b.box(2.8, 0.2, 2.8, solid("#8a9099"), { y: 3 });
    b.cylinder(0.25, 0.3, 1.6, metal(), { y: 3.2 }, 8);
    b.box(3.8, 1.3, 0.2, solid(HULL), { y: 4.8, rx: -0.2 });
    for (const x of [-1.3, 0, 1.3]) b.box(0.5, 1.32, 0.22, solid(C.red), { x, y: 4.8, rx: -0.2 });
    b.blob(0.2, glow("#ff3030", 3), { y: 6.7 }, 0);
    b.cylinder(0.04, 0.04, 0.6, metal(), { y: 6.1 }, 5);
  },
  smallPlane: (b) => {
    wheels(b, [[1.2, 0.9], [1.2, -0.9], [-3.4, 0]], 0.3, 0.16);
    for (const z of [-0.9, 0.9]) b.box(0.1, 0.8, 0.1, solid(C.darkMetal), { x: 1.2, y: 0.3, z });
    tube(b, 0.72, 0.4, 7, smooth(paint()), -0.5, 1.45, 0, 10);
    b.add(new ConeGeometry(0.72, 1.3, 10), smooth(solid(HULL)), { x: 3.65, y: 1.45, rz: -HALF_PI });
    b.box(0.08, 2.3, 0.2, solid(C.darkMetal), { x: 4.34, y: 0.3 });
    b.box(1.6, 0.14, 10, paint("#e8e8e8"), { x: 0.7, y: 2.1 });
    b.box(1.4, 0.55, 1.3, glass(), { x: 1.2, y: 1.72 });
    b.box(1, 0.1, 3.2, paint("#e8e8e8"), { x: -3.6, y: 1.55 });
    b.box(1.1, 1.3, 0.12, paint(), { x: -3.6, y: 1.6 });
  },
  helicopter: (b) => {
    for (const z of [-0.9, 0.9]) {
      b.box(3.2, 0.08, 0.12, metal("#b9bec6"), { x: 1, z });
      for (const x of [0.2, 1.8]) b.box(0.08, 0.7, 0.08, metal("#b9bec6"), { x, z });
    }
    b.blob(1.4, paint(), { x: 1, y: 1.7, sx: 1.5, sy: 0.9, sz: 0.95 }, 1);
    b.blob(1, glass(), { x: 2.25, y: 1.7, sx: 1.05, sy: 0.82, sz: 0.9 }, 1);
    b.box(4.2, 0.35, 0.35, paint("#dddddd"), { x: -2.4, y: 1.8 });
    b.box(0.5, 1.3, 0.12, paint(), { x: -4.2, y: 1.7 });
    b.add(new CylinderGeometry(0.6, 0.6, 0.05, 10), solid(C.darkMetal), { x: -4.2, y: 2.6, z: 0.16, rx: HALF_PI });
    b.cylinder(0.12, 0.12, 0.5, solid(C.darkMetal), { x: 1, y: 2.9 }, 6);
    b.box(8.6, 0.06, 0.28, solid(C.darkMetal), { x: 0.2, y: 3.4, ry: 0.12 });
    b.box(0.28, 0.06, 2.8, solid(C.darkMetal), { x: 1, y: 3.42 });
  },
  hangar: (b) => {
    b.box(22, 0.3, 18, solid("#8a9099"));
    b.add(new CylinderGeometry(9, 9, 21.6, 18, 1, false, 0, Math.PI), smooth(paint("#e8e8e8")), { y: 0.3, rz: HALF_PI });
    for (const x of [-7.2, -3.6, 0, 3.6, 7.2]) b.add(new CylinderGeometry(9.08, 9.08, 0.3, 18, 1, false, 0, Math.PI), smooth(solid("#aab0b9")), { x, y: 0.3, rz: HALF_PI });
    b.box(0.2, 6.6, 11.5, solid("#4a5568"), { x: 10.84, y: 0.3 });
    b.box(0.22, 0.5, 11.5, glow("#ffd23f", 1.3), { x: 10.86, y: 7 });
    b.blob(0.3, glow("#ff3030", 3), { y: 9.5 }, 1);
  },
  controlTower: (b) => {
    b.facade(7, 5, 7, { color: HULL, surface: Surface.storefront });
    b.cylinder(1.9, 2.3, 17, smooth(solid("#dfe3e8")), { y: 5 }, 12);
    b.cylinder(3.4, 2.4, 1.2, solid("#c9ced6"), { y: 22 }, 12);
    b.cylinder(3.5, 3.2, 2.6, { color: "#8fd3ff", surface: Surface.glass, glow: 0.5 }, { y: 23.2 }, 12);
    b.cylinder(3.7, 3.7, 0.4, solid(C.darkMetal), { y: 25.8 }, 12);
    b.box(2.6, 0.5, 0.2, solid(C.red), { y: 26.3 });
    b.cylinder(0.08, 0.12, 1.4, metal(), { y: 26.2 }, 6);
    b.blob(0.26, glow("#ff3030", 3), { y: 27.7 }, 1);
  },
  airliner: (b) => {
    const body = smooth(solid("#ffffff"));
    wheels(b, [[8, 0.3], [8, -0.3], [-1, 2.2], [-1, -2.2]], 0.55, 0.4);
    b.box(0.2, 1.4, 0.2, solid(C.darkMetal), { x: 8, y: 0.5 });
    for (const z of [-2.2, 2.2]) b.box(0.24, 1.4, 0.24, solid(C.darkMetal), { x: -1, y: 0.5, z });
    tube(b, 1.9, 1.9, 18, body, 0.5, 3.2, 0, 14);
    b.sphere(1.9, body, { x: 9.5, y: 3.2, sx: 1.5 }, 14);
    b.add(new ConeGeometry(1.9, 5, 14), body, { x: -11, y: 3.3, rz: HALF_PI });
    b.blob(0.9, glass(), { x: 11.1, y: 3.8, sx: 1, sy: 0.45, sz: 1.3 }, 1);
    b.box(15, 0.3, 3.84, glass(), { x: 0.8, y: 3.5 });
    b.box(18, 0.25, 3.84, paint(), { x: 0.5, y: 2.9 });
    for (const s of [-1, 1]) {
      b.box(4.2, 0.3, 11, solid("#e6e9ee"), { x: 0.2, y: 2.5, z: s * 5.9, ry: s * 0.35 });
      tube(b, 0.78, 0.7, 2.6, metal("#c9ced6"), 1.8, 1.85, s * 4.6, 10);
      b.box(2, 0.2, 3.8, solid("#e6e9ee"), { x: -11.6, y: 3.8, z: s * 1.9, ry: s * 0.3 });
    }
    b.box(3.2, 3.5, 0.3, paint(), { x: -10.2, y: 4.1, rz: 0.32 });
  },

  // ---------------------------------------------------------------------------
  // Moon Base
  // ---------------------------------------------------------------------------
  solarPanel: (b) => {
    b.cylinder(0.08, 0.1, 1.4, metal(), {}, 6);
    b.box(4.1, 0.05, 1.7, metal("#b9bec6"), { y: 1.28, rx: -0.5 });
    b.box(4, 0.08, 1.6, { color: "#1b3a6b", surface: Surface.glass }, { y: 1.3, rx: -0.5 });
  },
  rover: (b) => {
    wheels(b, [[1.1, 0.9], [1.1, -0.9], [0, 0.9], [0, -0.9], [-1.1, 0.9], [-1.1, -0.9]], 0.38, 0.3);
    b.box(3, 0.4, 1.4, solid(HULL), { y: 0.5 });
    b.box(1.4, 0.7, 1.2, { color: "#c9a227", surface: Surface.glass }, { x: 0.5, y: 0.9 });
    b.cylinder(0.04, 0.04, 0.7, metal(), { x: -0.9, y: 0.9 }, 5);
    b.cone(0.36, 0.2, solid(HULL), { x: -0.9, y: 1.78, rx: Math.PI }, 8);
  },
  satDish: (b) => {
    b.box(2.4, 1.2, 2.4, solid("#d9dde3"));
    b.cylinder(0.35, 0.45, 2.4, metal(), { y: 1.2 }, 8);
    b.cone(2.5, 0.9, smooth(solid(HULL)), { y: 4.6, rx: Math.PI - 0.6 }, 16);
    b.cylinder(0.05, 0.05, 1.5, metal(), { y: 4.6, rx: -0.6 }, 5);
    b.blob(0.16, glow("#9fe3ff", 2), { y: 5.84, z: -0.85 }, 0);
  },
  habModule: (b) => {
    const hull = smooth(solid(HULL));
    for (const x of [-3, 3]) for (const z of [-1.2, 1.2]) b.box(0.3, 0.6, 0.3, metal(), { x, z });
    tube(b, 1.8, 1.8, 8.4, hull, 0, 2.1, 0, 14);
    for (const x of [-4.2, 4.2]) b.sphere(1.8, hull, { x, y: 2.1, sx: 0.45 }, 12);
    for (const x of [-2.4, 0, 2.4]) b.box(0.9, 0.6, 3.64, glow("#9fe3ff", 1.5), { x, y: 2.3 });
    b.box(8.4, 0.22, 3.64, paint(), { y: 1.3 });
    b.box(1.4, 2, 0.5, solid("#c9ced6"), { y: 0.3, z: 1.75 });
  },
  dome: (b) => {
    b.cylinder(6, 6, 0.8, solid("#d9dde3"), {}, 20);
    b.add(new SphereGeometry(5.6, 18, 7, 0, Math.PI * 2, 0, HALF_PI), { color: "#9fd8ff", surface: Surface.glass, glow: 0.3, flat: false }, { y: 0.8 });
    for (let i = 0; i < 3; i++) b.add(new TorusGeometry(5.62, 0.12, 4, 16, Math.PI), smooth(solid(C.white)), { y: 0.8, ry: (i * Math.PI) / 3 });
    b.torus(4.85, 0.1, solid(C.white), { y: 3.6, rx: HALF_PI });
    b.box(2.2, 2.4, 2, solid("#c9ced6"), { z: 5 });
    b.box(1.2, 1.7, 0.1, glow("#9fe3ff", 1.4), { z: 6.02 });
  },
  rocket: (b) => {
    const hull = smooth(solid("#ffffff"));
    b.box(5, 0.6, 5, solid("#4a4e57"));
    b.cylinder(0.9, 1.3, 2, solid(C.darkMetal), { y: 0.6 }, 12);
    b.cylinder(1.5, 1.5, 18, hull, { y: 2.6 }, 14);
    b.cylinder(1.52, 1.52, 1.4, smooth(paint()), { y: 12 }, 14);
    b.cylinder(1.52, 1.52, 0.5, smooth(paint()), { y: 5 }, 14);
    b.cone(1.5, 4.6, smooth(paint()), { y: 20.6 }, 14);
    b.cylinder(0.03, 0.05, 0.9, metal(), { y: 25.1 }, 5);
    b.blob(0.42, glass(), { y: 17.4, z: 1.3 }, 1);
    for (const [x, z, a] of ring(4, 1.9, Math.PI / 4)) b.box(0.2, 4, 1.7, paint(), { x, y: 2.6, z, ry: -a + HALF_PI });
    b.box(0.6, 20, 0.6, solid("#b23a2e"), { x: -2.1, y: 0.6, z: -2.1 });
    b.box(1.6, 0.3, 0.3, solid("#b23a2e"), { x: -1.5, y: 16, z: -1.5, ry: -Math.PI / 4 });
  },

  // ---------------------------------------------------------------------------
  // Jungle Ruins
  // ---------------------------------------------------------------------------
  ruinPillar: (b) => {
    b.box(1.3, 0.3, 1.3, solid(STONE_DARK));
    b.cylinder(0.5, 0.55, 3.6, solid("#9c978a"), { y: 0.3 }, 8);
    b.box(1.2, 0.4, 1.2, solid("#9c978a"), { y: 3.9, rz: 0.08 });
    b.blob(0.4, solid("#4f7a34"), { x: 0.4, y: 0.4, z: 0.3, sy: 0.6 }, 0);
  },
  totem: (b, theme) => {
    for (let i = 0; i < 4; i++) {
      const y = i * 1.15;
      b.box(1 - (i % 2) * 0.12, 1.15, 1 - (i % 2) * 0.12, solid(i % 2 ? "#7a5230" : neonAccent(theme, i)), { y });
      for (const x of [-0.24, 0.24]) b.box(0.2, 0.2, 0.06, glow("#fff3b0", 1.2), { x, y: y + 0.65, z: 0.5 });
      b.box(0.5, 0.14, 0.08, solid("#2a1d10"), { y: y + 0.25, z: 0.5 });
    }
    b.cone(0.6, 0.4, solid("#7a5230"), { y: 4.6, ry: Math.PI / 4 }, 4);
  },
  jungleTree: (b) => {
    b.cylinder(0.4, 0.7, 6.4, solid("#5d4230"), {}, 7);
    for (const [x, z] of ring(4, 0.7, 0.4)) b.cone(0.3, 1.4, solid("#5d4230"), { x, z }, 5);
    b.blob(2.4, paint(), { y: 7.6 }, 1);
    b.blob(1.9, paint("#e3e3e3"), { x: 1.3, y: 8.6, z: 0.5 }, 1);
    b.blob(1.8, paint("#cfcfcf"), { x: -1.2, y: 8.2, z: -0.8 }, 1);
    b.blob(1.5, paint("#ededed"), { y: 9.6 }, 1);
    for (const [x, z] of ring(3, 1.6, 1)) b.box(0.08, 2.4, 0.08, solid("#3f6b2f"), { x, y: 4.6, z });
  },
  stoneHead: (b) => {
    b.box(3.2, 0.4, 3.2, solid(STONE_DARK));
    b.box(2.4, 3.4, 2.2, solid("#9c978a"), { y: 0.4 });
    b.box(2, 0.5, 2, solid(STONE_DARK), { y: 3.8 });
    b.box(2.6, 0.5, 0.6, solid(STONE_DARK), { y: 3, z: 1 });
    b.box(0.6, 1.5, 0.6, solid("#a8a396"), { y: 1.6, z: 1.2 });
    b.box(1.4, 0.25, 0.2, solid("#3b382f"), { y: 1, z: 1.12 });
    for (const x of [-0.6, 0.6]) b.box(0.5, 0.3, 0.1, solid("#3b382f"), { x, y: 2.6, z: 1.12 });
    b.blob(0.6, solid("#4f7a34"), { x: -1, y: 4.1, z: -0.4, sy: 0.5 }, 0);
  },
  hut: (b) => {
    b.cylinder(2.6, 2.6, 2.4, solid("#c9a66b"), {}, 10);
    b.cone(3.6, 2.8, solid("#8a6d3b"), { y: 2.2 }, 10);
    b.box(0.9, 1.7, 0.2, solid("#3b2a1a"), { z: 2.5 });
    b.cylinder(0.08, 0.08, 0.5, solid(C.wood), { y: 4.8 }, 5);
  },
  temple: (b) => {
    for (let i = 0; i < 4; i++) {
      const w = 20 - i * 4;
      b.box(w, 2.6, w, solid(i % 2 ? "#9c978a" : "#a8a396"), { y: i * 2.6 });
      b.box(3.6, 1.3, 1, solid("#bdb8a9"), { y: i * 2.6, z: w / 2 + 0.4 });
      b.box(3.6, 2.6, 1, solid("#bdb8a9"), { y: i * 2.6, z: w / 2 - 0.6 });
    }
    b.box(5, 2.6, 5, solid(STONE_DARK), { y: 10.4 });
    b.box(6.2, 0.6, 6.2, solid("#9c978a"), { y: 13 });
    b.box(1.6, 2, 0.2, glow("#ffb347", 1.6), { y: 10.4, z: 2.52 });
    for (const x of [-3, 3]) b.cone(0.3, 0.8, glow(LAVA, 2.6), { x, y: 10.4, z: 3 }, 6);
    b.blob(1.3, solid("#4f7a34"), { x: -7, y: 2.8, z: 6, sy: 0.4 }, 0);
    b.blob(1.1, solid("#4f7a34"), { x: 5, y: 5.4, z: -4, sy: 0.4 }, 0);
  },

  // ---------------------------------------------------------------------------
  // Castle Town
  // ---------------------------------------------------------------------------
  cart: (b) => {
    wheels(b, [[0, 0.72], [0, -0.72]], 0.55, 0.1);
    b.box(2, 0.14, 1.2, solid(C.wood), { y: 0.6 });
    for (const z of [-0.6, 0.6]) b.box(2, 0.5, 0.08, solid("#8a5a32"), { y: 0.7, z });
    for (const z of [-0.5, 0.5]) b.box(1.2, 0.08, 0.08, solid(C.wood), { x: 1.5, y: 0.75, z });
    b.blob(0.6, solid("#d9b44a"), { y: 1.05, sx: 1.3, sy: 0.6 }, 0);
  },
  timberHouse: (b, theme, variant) => {
    const roof = theme.palette.roofTints[variant % theme.palette.roofTints.length];
    const beam = solid("#4a3526");
    b.facade(8.4, 3.2, 7.4, { ...paint("#e2e2e2"), surface: Surface.windows });
    b.facade(9, 3, 8, { ...paint(), surface: Surface.windows }, { y: 3.2 });
    for (const y of [3.2, 6]) b.box(9.1, 0.25, 0.12, beam, { y, z: 4.02 });
    for (const x of [-4.4, 0, 4.4]) b.box(0.25, 3, 0.12, beam, { x, y: 3.2, z: 4.02 });
    for (const s of [-1, 1]) b.box(0.2, 3.3, 0.1, beam, { x: s * 2.2 + s * 0.7, y: 3.2, z: 4.03, rz: s * 0.44 });
    b.gable(9.6, 3.6, 8.8, solid(roof), { y: 6.2 });
    b.box(1.1, 2.1, 0.12, solid(C.wood), { z: 3.72 });
    b.box(0.9, 2.2, 0.9, solid("#8d6e63"), { x: 2.8, y: 7.4, z: -1.6 });
  },
  watchTower: (b) => {
    b.cylinder(2.4, 2.8, 11, solid(STONE), {}, 10);
    b.cylinder(3, 2.5, 1.2, solid(STONE_DARK), { y: 11 }, 10);
    for (const [x, z, a] of ring(8, 2.72)) b.box(0.9, 0.9, 0.5, solid(STONE), { x, y: 12.2, z, ry: -a + HALF_PI });
    b.cone(2.5, 3.2, paint(), { y: 12.2 }, 10);
    b.cylinder(0.05, 0.05, 0.9, solid(C.darkMetal), { y: 15.2 }, 5);
    b.box(0.8, 0.44, 0.04, paint(), { x: 0.42, y: 15.5 });
    b.box(0.3, 0.9, 0.1, glow(C.warmLight, 1.7), { y: 6, z: 2.6 });
    b.box(0.3, 0.9, 0.1, glow(C.warmLight, 1.7), { y: 9.2, z: 2.48 });
    b.box(1, 1.9, 0.14, solid(C.wood), { z: 2.76 });
  },
  chapel: (b, theme) => {
    const roof = theme.palette.roofTints[0];
    b.facade(8, 6.5, 13, { ...paint(), surface: Surface.windows });
    b.gable(13.4, 4, 8.8, solid(roof), { y: 6.5, ry: HALF_PI });
    b.facade(3.6, 12, 3.6, { ...paint("#ececec"), surface: Surface.windows }, { z: 5.2 });
    b.cone(2.9, 5.2, solid(roof), { y: 12, z: 5.2, ry: Math.PI / 4 }, 4);
    b.box(0.15, 0.9, 0.15, GOLD, { y: 17.1, z: 5.2 });
    b.box(0.6, 0.15, 0.15, GOLD, { y: 17.5, z: 5.2 });
    b.box(1.6, 2.6, 0.15, solid(C.wood), { z: 7.02 });
    b.add(new CylinderGeometry(0.8, 0.8, 0.1, 12), glow("#ffd89a", 1.6), { y: 8.4, z: 7.02, rx: HALF_PI });
  },
  castleKeep: (b) => {
    const wall = solid("#b8b3a8");
    const slit = glow(C.warmLight, 1.5);
    b.box(13, 16, 13, wall);
    for (const y of [6.5, 11.5]) {
      for (const o of [-4, 0, 4]) {
        for (const s of [-1, 1]) {
          b.box(0.4, 1.5, 0.1, slit, { x: o, y, z: s * 6.52 });
          b.box(0.1, 1.5, 0.4, slit, { x: s * 6.52, y, z: o });
        }
      }
    }
    b.box(13.8, 0.8, 13.8, solid("#9c978a"), { y: 16 });
    for (let i = 0; i < 5; i++) {
      const o = -5.6 + i * 2.8;
      for (const s of [-1, 1]) {
        b.box(1.4, 1.1, 0.8, solid(STONE), { x: o, y: 16.8, z: s * 6.5 });
        b.box(0.8, 1.1, 1.4, solid(STONE), { x: s * 6.5, y: 16.8, z: o });
      }
    }
    b.box(7, 6, 7, wall, { y: 16.8 });
    for (const s of [-1, 1]) b.box(0.5, 1.6, 0.1, slit, { y: 19, z: s * 3.52 });
    b.cone(5.6, 3.2, paint(), { y: 22.8, ry: Math.PI / 4 }, 4);
    for (const x of [-7.4, 7.4]) {
      for (const z of [-7.4, 7.4]) {
        b.cylinder(2.5, 2.6, 19, solid(STONE), { x, z }, 10);
        b.cylinder(2.8, 2.5, 0.8, solid(STONE_DARK), { x, y: 19, z }, 10);
        b.cone(2.9, 3.4, paint(), { x, y: 19.8, z }, 10);
      }
    }
    b.box(3.4, 4.4, 0.3, solid("#4a3526"), { z: 6.52 });
    b.box(2.6, 0.5, 0.32, glow(C.warmLight, 1.2), { y: 4.6, z: 6.52 });
    for (const x of [-3.8, 3.8]) b.box(0.9, 3.2, 0.06, paint(), { x, y: 8.6, z: 6.56 });
  },
} satisfies Partial<Record<ObjectKindId, Builder>>;

export type WorldKindId = keyof typeof WORLD_MODELS;

/** Which theme palette paints the tinted parts of each world model. */
export const WORLD_PALETTES: Partial<Record<WorldKindId, keyof Pick<ThemePalette, "accent" | "buildingTints" | "foliage">>> = {
  foodStall: "accent",
  tent: "accent",
  adobeHouse: "buildingTints",
  container: "accent",
  containerStack: "accent",
  boat: "accent",
  warehouse: "buildingTints",
  lollipop: "accent",
  iceCreamCone: "accent",
  donut: "accent",
  cupcake: "accent",
  cakeTower: "buildingTints",
  balloonCart: "accent",
  carousel: "accent",
  dropTower: "accent",
  circusTent: "accent",
  ferrisWheel: "accent",
  smallPlane: "accent",
  helicopter: "accent",
  hangar: "buildingTints",
  airliner: "accent",
  habModule: "accent",
  rocket: "accent",
  jungleTree: "foliage",
  timberHouse: "buildingTints",
  watchTower: "accent",
  chapel: "buildingTints",
  castleKeep: "accent",
};
