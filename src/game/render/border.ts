import { Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3, type Material } from "three";
import { CITY } from "../config/constants";
import type { ThemeDef, ThemeId } from "../config/themes";
import { Surface } from "./materials/cityMaterial";
import { ModelBuilder, type PartStyle } from "./models/ModelBuilder";

/**
 * Themed city walls: a fence runs around the whole map just outside the ring road,
 * with a tower on every corner and flag/lamp posts at regular intervals. Holes are
 * kept inside it by the simulation (see World.moveHole).
 */

interface BorderStyle {
  /** Approximate segment length; the exact length is fitted to the map. */
  segment: number;
  segmentHeight: number;
  buildSegment: (b: ModelBuilder, length: number) => void;
  towerHeight: number;
  buildTower: (b: ModelBuilder) => void;
  postHeight: number;
  buildPost: (b: ModelBuilder) => void;
  /** Place a post every N segments. */
  postEvery: number;
  /** Instance colors for tinted parts (null keeps model colors). */
  palette: (theme: ThemeDef) => readonly string[] | null;
}

const solid = (color: string, extra: Partial<PartStyle> = {}): PartStyle => ({ color, ...extra });
const glow = (color: string, strength = 1.5): PartStyle => ({ color, glow: strength });
const paint = (strength = 0): PartStyle => ({ color: "#ffffff", tint: 1, glow: strength });
const metal = (color: string): PartStyle => ({ color, surface: Surface.metal });

/** A cylinder spanning two points in the XY plane (ropes, logs). */
function span(b: ModelBuilder, x0: number, y0: number, x1: number, y1: number, radius: number, style: PartStyle, z = 0) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const angle = Math.atan2(y1 - y0, x1 - x0);
  b.add(new CylinderGeometry(radius, radius, length, 7), style, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z, rz: angle - Math.PI / 2 });
}

const STYLES: Record<ThemeId, BorderStyle> = {
  // Concrete barrier with hazard stripes, steel railing and amber post lights.
  metro: {
    segment: 4,
    segmentHeight: 1.75,
    buildSegment: (b, len) => {
      b.box(len, 0.7, 0.5, solid("#b9bdc5"));
      const stripes = Math.max(2, Math.round(len / 0.55));
      const w = len / stripes;
      for (let i = 0; i < stripes; i++) {
        b.box(w, 0.22, 0.02, solid(i % 2 ? "#1d1f24" : "#ffc300", { glow: i % 2 ? 0 : 0.2 }), { x: -len / 2 + w * (i + 0.5), y: 0.22, z: 0.26 });
      }
      b.box(len, 0.06, 0.52, solid("#8f949c"), { y: 0.7 });
      b.box(0.12, 0.95, 0.12, metal("#8a939e"), { x: -len / 2, y: 0.72 });
      b.box(len, 0.07, 0.07, metal("#a3acb7"), { y: 1.2 });
      b.box(len, 0.07, 0.07, metal("#a3acb7"), { y: 1.62 });
      b.blob(0.09, glow("#ffb347", 2.2), { x: -len / 2, y: 1.72 }, 1);
    },
    towerHeight: 7.2,
    buildTower: (b) => {
      b.box(2.4, 6, 2.4, solid("#c3c7ce"));
      for (let i = 0; i < 4; i++) b.box(2.46, 0.3, 2.46, solid(i % 2 ? "#1d1f24" : "#ffc300"), { y: 0.6 + i * 0.45 });
      b.box(2.8, 0.4, 2.8, solid("#8f949c"), { y: 6 });
      b.cylinder(0.25, 0.3, 0.4, metal("#8a939e"), { y: 6.4 }, 8);
      b.blob(0.42, glow("#ff3030", 3), { y: 6.95 }, 1);
    },
    postHeight: 5,
    buildPost: (b) => {
      b.cylinder(0.08, 0.1, 5, metal("#8a939e"), {}, 8);
      b.box(1.7, 1.1, 0.05, paint(0.35), { x: 0.88, y: 3.6 });
      b.blob(0.12, glow("#ffffff", 2), { y: 5 }, 1);
    },
    postEvery: 8,
    palette: (t) => t.palette.accent,
  },

  // White picket fence between brick pillars.
  suburbs: {
    segment: 3.6,
    segmentHeight: 1.45,
    buildSegment: (b, len) => {
      b.box(0.46, 1.3, 0.46, solid("#a0522d"), { x: -len / 2 });
      b.box(0.56, 0.12, 0.56, solid("#efe4d2"), { x: -len / 2, y: 1.3 });
      b.box(len, 0.09, 0.05, solid("#f7f7f2"), { y: 0.35, z: -0.03 });
      b.box(len, 0.09, 0.05, solid("#f7f7f2"), { y: 0.9, z: -0.03 });
      const pickets = Math.floor((len - 0.5) / 0.32);
      for (let i = 0; i < pickets; i++) {
        const x = -len / 2 + 0.42 + i * 0.32;
        b.box(0.13, 0.98, 0.035, solid("#fbfbf7"), { x, y: 0.1, z: 0.02 });
        b.cone(0.093, 0.14, solid("#fbfbf7"), { x, y: 1.08, z: 0.02, ry: Math.PI / 4 }, 4);
      }
    },
    towerHeight: 3.9,
    buildTower: (b) => {
      b.box(1.5, 2.9, 1.5, solid("#a0522d"));
      b.box(1.75, 0.18, 1.75, solid("#efe4d2"), { y: 2.9 });
      b.box(0.5, 0.6, 0.5, glow("#ffd89a", 1.6), { y: 3.08 });
      b.cone(0.42, 0.25, solid("#2f3a2f"), { y: 3.66 }, 4);
      b.blob(0.55, solid("#5c9e45"), { x: 0.9, y: 0.4, z: 0.9 }, 1);
      b.blob(0.55, solid("#5c9e45"), { x: -0.9, y: 0.4, z: 0.9 }, 1);
    },
    postHeight: 3.3,
    buildPost: (b) => {
      b.cylinder(0.07, 0.09, 3, solid("#2f3a2f"), {}, 8);
      b.box(0.05, 0.05, 0.7, solid("#2f3a2f"), { y: 2.9, z: 0.3 });
      b.box(0.3, 0.4, 0.3, glow("#ffd89a", 1.8), { y: 2.45, z: 0.62 });
      b.blob(0.3, paint(), { y: 2.1, z: 0.62 }, 1);
    },
    postEvery: 7,
    palette: (t) => t.palette.accent,
  },

  // Laser fence: dark pylons with glowing light bars.
  neon: {
    segment: 4.2,
    segmentHeight: 1.95,
    buildSegment: (b, len) => {
      b.box(len, 0.22, 0.34, solid("#1b1d28"));
      b.box(len, 0.04, 0.36, paint(0.7), { y: 0.22 });
      b.box(0.2, 1.8, 0.2, solid("#262938"), { x: -len / 2 });
      b.blob(0.13, paint(1.6), { x: -len / 2, y: 1.86 }, 1);
      for (const y of [0.7, 1.15, 1.6]) b.box(len, 0.05, 0.05, paint(0.9), { y });
    },
    towerHeight: 9,
    buildTower: (b) => {
      b.cylinder(0.55, 1.1, 8, solid("#1f2230"), {}, 8);
      for (const y of [1.6, 3.6, 5.6, 7.4]) b.torus(0.95 - y * 0.05, 0.07, paint(2.8), { y, rx: Math.PI / 2 });
      b.blob(0.6, paint(3.2), { y: 8.5 }, 1);
    },
    postHeight: 4.6,
    buildPost: (b) => {
      b.box(0.16, 4.2, 0.16, solid("#262938"));
      b.box(1.4, 2.2, 0.08, paint(2.2), { x: 0.78, y: 2.2 });
      b.box(1.5, 0.08, 0.1, solid("#262938"), { x: 0.78, y: 4.4 });
    },
    postEvery: 6,
    palette: (t) => t.palette.accent,
  },

  // Rustic log fence buried in snow banks.
  frost: {
    segment: 3.4,
    segmentHeight: 1.62,
    buildSegment: (b, len) => {
      b.box(len, 0.22, 0.9, solid("#eef4fb"));
      b.cylinder(0.2, 0.23, 1.45, solid("#7a5230"), { x: -len / 2 }, 7);
      b.blob(0.26, solid("#f7fbff"), { x: -len / 2, y: 1.5, sy: 0.55 }, 1);
      span(b, -len / 2, 0.45, len / 2, 0.45, 0.14, solid("#8b5e3c"));
      span(b, -len / 2, 0.98, len / 2, 0.98, 0.14, solid("#8b5e3c"));
      b.box(len, 0.08, 0.22, solid("#f7fbff"), { y: 1.1 });
    },
    towerHeight: 6,
    buildTower: (b) => {
      b.cylinder(1.25, 1.4, 4.2, solid("#9aa3ad"), {}, 10);
      b.box(0.5, 0.7, 0.1, glow("#ffcf87", 1.8), { y: 2.8, z: 1.28 });
      b.cylinder(1.5, 1.5, 0.25, solid("#6b7280"), { y: 4.2 }, 10);
      b.cone(1.7, 1.55, solid("#f7fbff"), { y: 4.45 }, 10);
    },
    postHeight: 3.6,
    buildPost: (b) => {
      b.cylinder(0.09, 0.11, 2.6, solid("#7a5230"), {}, 7);
      b.cone(0.55, 1.1, solid("#2f6b4f"), { y: 2.4 }, 8);
      b.cone(0.35, 0.45, solid("#f7fbff"), { y: 3.1 }, 8);
      b.blob(0.08, paint(2), { x: 0.3, y: 2.6, z: 0.3 }, 0);
      b.blob(0.08, paint(2), { x: -0.32, y: 2.8, z: 0.2 }, 0);
      b.blob(0.08, paint(2), { x: 0.1, y: 3.0, z: -0.3 }, 0);
    },
    postEvery: 7,
    palette: (t) => t.palette.accent,
  },

  // Boardwalk posts with sagging ropes, life rings and tiki torches.
  beach: {
    segment: 3.2,
    segmentHeight: 1.25,
    buildSegment: (b, len) => {
      b.cylinder(0.17, 0.2, 1.15, solid("#f5efe0"), { x: -len / 2 }, 8);
      b.cylinder(0.22, 0.22, 0.1, solid("#d9cdb4"), { x: -len / 2, y: 1.15 }, 8);
      for (const y of [0.55, 1.0]) {
        span(b, -len / 2, y, 0, y - 0.16, 0.07, solid("#c9a66b"));
        span(b, 0, y - 0.16, len / 2, y, 0.07, solid("#c9a66b"));
      }
    },
    towerHeight: 4.8,
    buildTower: (b) => {
      b.cylinder(0.3, 0.36, 4, solid("#f5efe0"), {}, 8);
      b.torus(0.55, 0.12, solid("#ff6b35"), { y: 2.2, z: 0.42 });
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        b.box(0.26, 0.26, 0.26, solid("#ffffff"), { x: Math.cos(a) * 0.55, y: 2.07 + Math.sin(a) * 0.55, z: 0.42, rz: a });
      }
      b.cylinder(0.04, 0.04, 1, solid("#ffffff"), { y: 3.8 }, 5);
      b.box(0.9, 0.55, 0.03, paint(0.3), { x: 0.46, y: 4.2 });
    },
    postHeight: 2.6,
    buildPost: (b) => {
      b.cylinder(0.08, 0.1, 2.1, solid("#c8a165"), {}, 7);
      b.cylinder(0.16, 0.12, 0.3, solid("#6b4226"), { y: 2.05 }, 7);
      b.cone(0.13, 0.45, glow("#ff9d2e", 3), { y: 2.3 }, 7);
    },
    postEvery: 6,
    palette: (t) => t.palette.accent,
  },
};

const matrix = new Matrix4();
const quat = new Quaternion();
const up = new Vector3(0, 1, 0);
const pos = new Vector3();
const one = new Vector3(1, 1, 1);
const color = new Color();

function instanced(geometry: ReturnType<ModelBuilder["build"]>, material: Material, count: number, shadows: boolean) {
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.frustumCulled = false;
  return mesh;
}

export function createBorder(half: number, theme: ThemeDef, material: Material, shadows: boolean) {
  const style = STYLES[theme.id];
  const edge = half + CITY.borderOffset;
  const side = edge * 2;
  const perSide = Math.max(4, Math.round(side / style.segment));
  const length = side / perSide;
  const palette = style.palette(theme);
  const group = new Group();
  group.name = "border";

  // Sides: inward-facing rotation and a function mapping distance along the side to a point.
  const sides = [
    { rot: 0, at: (s: number) => [-edge + s, -edge] },
    { rot: Math.PI, at: (s: number) => [edge - s, edge] },
    { rot: Math.PI / 2, at: (s: number) => [-edge, edge - s] },
    { rot: -Math.PI / 2, at: (s: number) => [edge, -edge + s] },
  ] as const;

  const segBuilder = new ModelBuilder();
  style.buildSegment(segBuilder, length);
  const segments = instanced(segBuilder.build(style.segmentHeight), material, perSide * 4, shadows);
  const postSlots: { x: number; z: number; rot: number }[] = [];
  let index = 0;
  for (const s of sides) {
    for (let i = 0; i < perSide; i++) {
      const [x, z] = s.at(length * (i + 0.5));
      quat.setFromAxisAngle(up, s.rot);
      matrix.compose(pos.set(x, style.segmentHeight / 2, z), quat, one);
      segments.setMatrixAt(index, matrix);
      if (palette) segments.setColorAt(index, color.set(palette[(index * 7) % palette.length]));
      index++;
      if (i > 1 && i < perSide - 1 && i % style.postEvery === 0) {
        const [px, pz] = s.at(length * i);
        postSlots.push({ x: px, z: pz, rot: s.rot });
      }
    }
  }
  group.add(segments);

  const postBuilder = new ModelBuilder();
  style.buildPost(postBuilder);
  const posts = instanced(postBuilder.build(style.postHeight), material, Math.max(1, postSlots.length), shadows);
  postSlots.forEach((p, i) => {
    quat.setFromAxisAngle(up, p.rot);
    // Posts stand just inside the fence line so they don't intersect it.
    const inward = new Vector3(0, 0, 0.55).applyQuaternion(quat);
    matrix.compose(pos.set(p.x + inward.x, style.postHeight / 2, p.z + inward.z), quat, one);
    posts.setMatrixAt(i, matrix);
    if (palette) posts.setColorAt(i, color.set(palette[(i * 3 + 1) % palette.length]));
  });
  posts.count = postSlots.length;
  group.add(posts);

  const towerBuilder = new ModelBuilder();
  style.buildTower(towerBuilder);
  const towers = instanced(towerBuilder.build(style.towerHeight), material, 4, shadows);
  [
    [-edge, -edge],
    [edge, -edge],
    [edge, edge],
    [-edge, edge],
  ].forEach(([x, z], i) => {
    // Face the city center.
    quat.setFromAxisAngle(up, Math.atan2(-x, -z));
    matrix.compose(pos.set(x, style.towerHeight / 2, z), quat, one);
    towers.setMatrixAt(i, matrix);
    if (palette) towers.setColorAt(i, color.set(palette[i % palette.length]));
  });
  group.add(towers);

  return {
    group,
    dispose() {
      for (const mesh of [segments, posts, towers]) {
        mesh.geometry.dispose();
        mesh.dispose();
      }
    },
  };
}
