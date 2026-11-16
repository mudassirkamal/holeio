import { Color, DynamicDrawUsage, Group, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type Material } from "three";
import type { ObjectKindId } from "../config/objectCatalog";
import type { ThemeDef } from "../config/themes";
import type { CityObject } from "../core/entities";
import { Rng } from "../core/rng";
import type { World } from "../core/World";
import { chunkOf, enableCulling, MIN_TO_CHUNK, MIN_TRIANGLES_TO_CHUNK } from "./chunks";
import { buildKindModel, instancePalette, variantCount } from "./models/cityModels";

interface Slot {
  mesh: InstancedMesh;
  index: number;
}

/** Cars or pedestrians of one model: only the ones near the camera are uploaded and drawn. */
interface MoverMesh {
  mesh: InstancedMesh;
  objects: CityObject[];
  /** Paint color per object (r, g, b), or null when the model isn't tinted. */
  colors: Float32Array | null;
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

/**
 * All city objects as instanced meshes, synced from the simulation. Static objects are
 * split into one mesh per kind, variant and map chunk so that only the part of the city
 * in view is drawn; cars and pedestrians roam the whole map and stay in one mesh each.
 */
export class ObjectLayer {
  readonly group = new Group();
  private readonly slots: Slot[] = [];
  private readonly meshes: InstancedMesh[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly movers: MoverMesh[] = [];
  private readonly touched = new Set<InstancedMesh>();

  constructor(world: World, theme: ThemeDef, material: Material, shadows: boolean) {
    this.group.name = "objects";
    const kinds = new Map<string, CityObject[]>();
    for (const obj of world.objects) {
      const key = `${obj.kind.id}:${variantOf(obj, theme)}`;
      let list = kinds.get(key);
      if (!list) kinds.set(key, (list = []));
      list.push(obj);
    }

    for (const [key, list] of kinds) {
      const [kind, variant] = key.split(":") as [ObjectKindId, string];
      const geometry = buildKindModel(kind, theme, Number(variant));
      this.geometries.push(geometry);
      const palette = instancePalette(kind, theme);

      if (list[0].kind.mobility !== "static") {
        const mesh = this.createMesh(key, geometry, material, list.length, shadows);
        const colors = palette ? new Float32Array(list.length * 3) : null;
        list.forEach((obj, i) => colors && paintColor(palette!, obj.seed).toArray(colors, i * 3));
        if (colors) mesh.setColorAt(0, color.setRGB(1, 1, 1));
        this.movers.push({ mesh, objects: list, colors });
        continue;
      }

      // Rare, simple models stay in one mesh: splitting them would only add draw calls.
      const triangles = geometry.attributes.position.count / 3;
      const split = list.length >= MIN_TO_CHUNK || list.length * triangles >= MIN_TRIANGLES_TO_CHUNK;
      const chunks = new Map<string, CityObject[]>();
      for (const obj of list) {
        const chunk = split ? chunkOf(obj.x, obj.z) : "";
        let members = chunks.get(chunk);
        if (!members) chunks.set(chunk, (members = []));
        members.push(obj);
      }

      for (const [chunk, members] of chunks) {
        const mesh = this.createMesh(`${key}@${chunk}`, geometry, material, members.length, shadows);
        members.forEach((obj, index) => {
          matrix.compose(obj.position, obj.quaternion, ONE);
          mesh.setMatrixAt(index, matrix);
          if (palette) mesh.setColorAt(index, paintColor(palette, obj.seed));
          this.slots[obj.id] = { mesh, index };
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        enableCulling(mesh);
      }
    }
  }

  private createMesh(name: string, geometry: BufferGeometry, material: Material, count: number, shadows: boolean) {
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.name = name;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.meshes.push(mesh);
    this.group.add(mesh);
    return mesh;
  }

  /**
   * Copies what the simulation changed into the meshes. Cars and pedestrians within
   * `range` meters of (`x`, `z`) — everything the camera or the shadow map can see —
   * are packed to the front of their mesh, and only those are drawn.
   */
  sync(world: World, x: number, z: number, range: number) {
    world.drainDirty((obj) => {
      const slot = this.slots[obj.id];
      if (!slot) return; // a mover: handled below
      matrix.compose(obj.position, obj.quaternion, obj.visible ? ONE : ZERO);
      slot.mesh.setMatrixAt(slot.index, matrix);
      this.touched.add(slot.mesh);
    });
    for (const mesh of this.touched) mesh.instanceMatrix.needsUpdate = true;
    this.touched.clear();

    const rangeSq = range * range;
    for (const { mesh, objects, colors } of this.movers) {
      const tint = mesh.instanceColor?.array;
      let n = 0;
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const dx = obj.position.x - x;
        const dz = obj.position.z - z;
        if (!obj.visible || dx * dx + dz * dz > rangeSq) continue;
        matrix.compose(obj.position, obj.quaternion, ONE);
        matrix.toArray(mesh.instanceMatrix.array, n * 16);
        if (tint) {
          tint[n * 3] = colors![i * 3];
          tint[n * 3 + 1] = colors![i * 3 + 1];
          tint[n * 3 + 2] = colors![i * 3 + 2];
        }
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    for (const mesh of this.meshes) mesh.dispose();
    for (const geometry of this.geometries) geometry.dispose();
  }
}

/** Decorative, non-interactive trees around the city edge. */
export function createScenery(world: World, theme: ThemeDef, material: Material, shadows: boolean) {
  const group = new Group();
  if (!theme.scenery) return { group, dispose() {} };
  const { kind, count } = theme.scenery;
  const palette = instancePalette(kind, theme);
  const rng = new Rng(world.objects.length);
  const reach = theme.outer === "water" ? 34 : 90;
  const positions: [number, number, number, number][] = [];
  for (let i = 0; i < count * 3 && positions.length < count; i++) {
    const x = rng.range(-world.halfX - reach, world.halfX + reach);
    const z = rng.range(-world.halfZ - reach, world.halfZ + reach);
    if (Math.abs(x) < world.halfX + 10 && Math.abs(z) < world.halfZ + 10) continue;
    positions.push([x, z, rng.range(0, Math.PI * 2), rng.range(0.8, 1.5)]);
  }

  // Grouped by chunk like the city, so trees behind the camera cost nothing.
  const geometry = buildKindModel(kind, theme, 0);
  const height = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;
  const chunks = new Map<string, typeof positions>();
  for (const p of positions) {
    const key = chunkOf(p[0], p[1]);
    chunks.set(key, [...(chunks.get(key) ?? []), p]);
  }
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const pos = new Vector3();
  const scale = new Vector3();
  const meshes = [...chunks.values()].map((members) => {
    const mesh = new InstancedMesh(geometry, material, members.length);
    mesh.castShadow = shadows;
    mesh.receiveShadow = false;
    members.forEach(([x, z, rot, s], i) => {
      q.setFromAxisAngle(up, rot);
      pos.set(x, (height / 2) * s, z);
      scale.setScalar(s);
      matrix.compose(pos, q, scale);
      mesh.setMatrixAt(i, matrix);
      if (palette) mesh.setColorAt(i, paintColor(palette, rng.next()));
    });
    enableCulling(mesh);
    group.add(mesh);
    return mesh;
  });
  return {
    group,
    dispose() {
      geometry.dispose();
      for (const mesh of meshes) mesh.dispose();
    },
  };
}
