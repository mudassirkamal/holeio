import { Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3, type Material } from "three";
import type { ObjectKindId } from "../config/objectCatalog";
import type { ThemeDef } from "../config/themes";
import type { CityObject } from "../core/entities";
import { Rng } from "../core/rng";
import type { World } from "../core/World";
import { buildKindModel, instancePalette, variantCount } from "./models/cityModels";

interface Slot {
  mesh: InstancedMesh;
  index: number;
}

const matrix = new Matrix4();
const ONE = new Vector3(1, 1, 1);
const ZERO = new Vector3(0, 0, 0);
const color = new Color();

const variantOf = (obj: CityObject, theme: ThemeDef) =>
  Math.floor(obj.seed * 9973) % variantCount(obj.kind.id, theme);

const paintColor = (palette: readonly string[], seed: number) => {
  color.set(palette[Math.floor(seed * 7919) % palette.length]);
  // Subtle brightness jitter so neighbours never look identical.
  const jitter = 0.9 + ((seed * 104729) % 1) * 0.2;
  return color.multiplyScalar(jitter);
};

/** All city objects as instanced meshes (one per kind + variant), synced from the simulation. */
export class ObjectLayer {
  readonly group = new Group();
  private readonly slots: Slot[] = [];
  private readonly meshes: InstancedMesh[] = [];
  private readonly touched = new Set<InstancedMesh>();

  constructor(world: World, theme: ThemeDef, material: Material, shadows: boolean) {
    this.group.name = "objects";
    const buckets = new Map<string, CityObject[]>();
    for (const obj of world.objects) {
      const key = `${obj.kind.id}:${variantOf(obj, theme)}`;
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push(obj);
    }

    for (const [key, list] of buckets) {
      const [kind, variant] = key.split(":") as [ObjectKindId, string];
      const geometry = buildKindModel(kind, theme, Number(variant));
      const mesh = new InstancedMesh(geometry, material, list.length);
      mesh.name = key;
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      mesh.frustumCulled = false;

      const palette = instancePalette(kind, theme);
      list.forEach((obj, index) => {
        matrix.compose(obj.position, obj.quaternion, ONE);
        mesh.setMatrixAt(index, matrix);
        if (palette) mesh.setColorAt(index, paintColor(palette, obj.seed));
        this.slots[obj.id] = { mesh, index };
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }

  sync(world: World) {
    world.drainDirty((obj) => {
      const slot = this.slots[obj.id];
      matrix.compose(obj.position, obj.quaternion, obj.visible ? ONE : ZERO);
      slot.mesh.setMatrixAt(slot.index, matrix);
      this.touched.add(slot.mesh);
    });
    for (const mesh of this.touched) mesh.instanceMatrix.needsUpdate = true;
    this.touched.clear();
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      mesh.dispose();
    }
  }
}

/** Decorative, non-interactive trees around the city edge. */
export function createScenery(world: World, theme: ThemeDef, material: Material, shadows: boolean) {
  const group = new Group();
  const kind: ObjectKindId = theme.outer === "water" ? "palmTree" : theme.id === "frost" ? "pineTree" : "tree";
  const rng = new Rng(world.objects.length);
  const half = world.half;
  const inner = half + 10;
  const outer = theme.outer === "water" ? half + 34 : half + 90;
  const positions: [number, number, number, number][] = [];
  const count = theme.outer === "water" ? 90 : theme.id === "neon" ? 160 : 420;
  for (let i = 0; i < count * 3 && positions.length < count; i++) {
    const x = rng.range(-outer, outer);
    const z = rng.range(-outer, outer);
    if (Math.max(Math.abs(x), Math.abs(z)) < inner) continue;
    positions.push([x, z, rng.range(0, Math.PI * 2), rng.range(0.8, 1.5)]);
  }

  const geometry = buildKindModel(kind, theme, 0);
  const mesh = new InstancedMesh(geometry, material, positions.length);
  mesh.castShadow = shadows;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const pos = new Vector3();
  const scale = new Vector3();
  const height = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;
  positions.forEach(([x, z, rot, s], i) => {
    q.setFromAxisAngle(up, rot);
    pos.set(x, (height / 2) * s, z);
    scale.setScalar(s);
    matrix.compose(pos, q, scale);
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, paintColor(theme.palette.foliage, rng.next()));
  });
  group.add(mesh);
  return {
    group,
    dispose() {
      geometry.dispose();
      mesh.dispose();
    },
  };
}
