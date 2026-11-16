import { Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3, type Material } from "three";
import { chunkOf, enableCulling } from "./chunks";
import { CITY } from "../config/constants";
import type { BorderStyleId, ThemeDef } from "../config/themes";
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
  buildSegment: (b: ModelBuilder, length: number, theme: ThemeDef) => void;
  towerHeight: number;
  buildTower: (b: ModelBuilder, theme: ThemeDef) => void;
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

const STYLES: Record<BorderStyleId, BorderStyle> = {
  // Concrete barrier with hazard stripes, steel railing and amber post lights.
  barrier: {
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
  picket: {
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
  laser: {
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

  // Rustic log fence (buried in snow banks on snowy maps).
  logs: {
    segment: 3.4,
    segmentHeight: 1.62,
    buildSegment: (b, len, theme) => {
      b.box(len, 0.22, 0.9, solid(theme.snowy ? "#eef4fb" : theme.palette.dirt));
      b.cylinder(0.2, 0.23, 1.45, solid("#7a5230"), { x: -len / 2 }, 7);
      b.blob(0.26, solid(theme.snowy ? "#f7fbff" : "#6b4226"), { x: -len / 2, y: 1.5, sy: 0.55 }, 1);
      span(b, -len / 2, 0.45, len / 2, 0.45, 0.14, solid("#8b5e3c"));
      span(b, -len / 2, 0.98, len / 2, 0.98, 0.14, solid("#8b5e3c"));
      if (theme.snowy) b.box(len, 0.08, 0.22, solid("#f7fbff"), { y: 1.1 });
    },
    towerHeight: 6,
    buildTower: (b, theme) => {
      b.cylinder(1.25, 1.4, 4.2, solid("#9aa3ad"), {}, 10);
      b.box(0.5, 0.7, 0.1, glow("#ffcf87", 1.8), { y: 2.8, z: 1.28 });
      b.cylinder(1.5, 1.5, 0.25, solid("#6b7280"), { y: 4.2 }, 10);
      b.cone(1.7, 1.55, solid(theme.snowy ? "#f7fbff" : "#8a4b2f"), { y: 4.45 }, 10);
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
  rope: {
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

  // Stone rampart with battlements, round corner towers and banners.
  stone: {
    segment: 4,
    segmentHeight: 2.75,
    buildSegment: (b, len, theme) => {
      const stone = theme.lighting.night > 0.5 ? "#4a4d5c" : "#a9a59c";
      const dark = theme.lighting.night > 0.5 ? "#3a3d4a" : "#8f8b82";
      b.box(len, 2.1, 0.9, solid(stone));
      b.box(len, 0.16, 1.05, solid(dark), { y: 2.1 });
      const merlons = Math.max(2, Math.round(len / 1.3));
      const w = len / merlons;
      for (let i = 0; i < merlons; i += 2) b.box(w, 0.5, 0.36, solid(stone), { x: -len / 2 + w * (i + 0.5), y: 2.26, z: 0.34 });
      b.box(0.3, 1.1, 0.06, solid(dark), { y: 0.6, z: 0.46 });
    },
    towerHeight: 9.5,
    buildTower: (b, theme) => {
      const stone = theme.lighting.night > 0.5 ? "#4a4d5c" : "#b1ada4";
      b.cylinder(1.9, 2.1, 6.4, solid(stone), {}, 12);
      b.cylinder(2.2, 2.2, 0.5, solid(theme.lighting.night > 0.5 ? "#3a3d4a" : "#8f8b82"), { y: 6.4 }, 12);
      b.box(0.5, 0.9, 0.1, glow("#ffcf87", 1.8), { y: 4.2, z: 1.95 });
      b.cone(2.3, 2.6, paint(0.15), { y: 6.9 }, 12);
    },
    postHeight: 5.2,
    buildPost: (b) => {
      b.cylinder(0.07, 0.09, 5.2, solid("#5b4636"), {}, 7);
      b.box(1.1, 1.7, 0.05, paint(0.3), { x: 0.6, y: 3.3 });
      b.cone(0.14, 0.3, glow("#ffb347", 2), { y: 4.95 }, 6);
    },
    postEvery: 6,
    palette: (t) => t.palette.accent,
  },
};

const matrix = new Matrix4();
const quat = new Quaternion();
const up = new Vector3(0, 1, 0);
const pos = new Vector3();
const scale = new Vector3(1, 1, 1);
const color = new Color();

interface Placed {
  x: number;
  y: number;
  z: number;
  rot: number;
  stretch: number;
  color: string | null;
}

/** Instanced meshes for `items`, one per map chunk so off-screen stretches of fence aren't drawn. */
function instanced(geometry: ReturnType<ModelBuilder["build"]>, material: Material, items: readonly Placed[], shadows: boolean) {
  const chunks = new Map<string, Placed[]>();
  for (const item of items) {
    const key = chunkOf(item.x, item.z);
    chunks.set(key, [...(chunks.get(key) ?? []), item]);
  }
  return [...chunks.values()].map((members) => {
    const mesh = new InstancedMesh(geometry, material, members.length);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    members.forEach((item, i) => {
      quat.setFromAxisAngle(up, item.rot);
      matrix.compose(pos.set(item.x, item.y, item.z), quat, scale.set(item.stretch, 1, 1));
      mesh.setMatrixAt(i, matrix);
      if (item.color) mesh.setColorAt(i, color.set(item.color));
    });
    enableCulling(mesh);
    return mesh;
  });
}

export function createBorder(halfX: number, halfZ: number, theme: ThemeDef, material: Material, shadows: boolean) {
  const style = STYLES[theme.border];
  const edgeX = halfX + CITY.borderOffset;
  const edgeZ = halfZ + CITY.borderOffset;
  // The segment model is fitted to the sides along X; the other two stretch it slightly.
  const length = (edgeX * 2) / Math.max(4, Math.round((edgeX * 2) / style.segment));
  const palette = style.palette(theme);
  const group = new Group();
  group.name = "border";

  // Sides: inward-facing rotation and a function mapping distance along the side to a point.
  const sides = [
    { rot: 0, span: edgeX * 2, at: (s: number) => [-edgeX + s, -edgeZ] },
    { rot: Math.PI, span: edgeX * 2, at: (s: number) => [edgeX - s, edgeZ] },
    { rot: Math.PI / 2, span: edgeZ * 2, at: (s: number) => [-edgeX, edgeZ - s] },
    { rot: -Math.PI / 2, span: edgeZ * 2, at: (s: number) => [edgeX, -edgeZ + s] },
  ] as const;
  const counts = sides.map((s) => Math.max(4, Math.round(s.span / length)));

  const segmentItems: Placed[] = [];
  const postItems: Placed[] = [];
  for (const [sideIndex, s] of sides.entries()) {
    const perSide = counts[sideIndex];
    const step = s.span / perSide;
    for (let i = 0; i < perSide; i++) {
      const [x, z] = s.at(step * (i + 0.5));
      const index = segmentItems.length;
      segmentItems.push({ x, y: style.segmentHeight / 2, z, rot: s.rot, stretch: step / length, color: palette ? palette[(index * 7) % palette.length] : null });
      if (i > 1 && i < perSide - 1 && i % style.postEvery === 0) {
        // Posts stand just inside the fence line so they don't intersect it.
        const [px, pz] = s.at(step * i);
        const n = postItems.length;
        postItems.push({ x: px + Math.sin(s.rot) * 0.55, y: style.postHeight / 2, z: pz + Math.cos(s.rot) * 0.55, rot: s.rot, stretch: 1, color: palette ? palette[(n * 3 + 1) % palette.length] : null });
      }
    }
  }
  const towerItems: Placed[] = [
    [-edgeX, -edgeZ],
    [edgeX, -edgeZ],
    [edgeX, edgeZ],
    [-edgeX, edgeZ],
    // Towers face the city center.
  ].map(([x, z], i) => ({ x, y: style.towerHeight / 2, z, rot: Math.atan2(-x, -z), stretch: 1, color: palette ? palette[i % palette.length] : null }));

  const build = (fn: (b: ModelBuilder) => void, height: number) => {
    const builder = new ModelBuilder();
    fn(builder);
    return builder.build(height);
  };
  const geometries = [
    build((b) => style.buildSegment(b, length, theme), style.segmentHeight),
    build((b) => style.buildPost(b), style.postHeight),
    build((b) => style.buildTower(b, theme), style.towerHeight),
  ];
  const meshes = [segmentItems, postItems, towerItems].flatMap((items, i) => instanced(geometries[i], material, items, shadows));
  group.add(...meshes);

  return {
    group,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const mesh of meshes) mesh.dispose();
    },
  };
}
