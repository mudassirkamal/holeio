import type { InstancedMesh } from "three";

/** Side of the square chunks static objects are grouped into for frustum culling (m). */
export const CHUNK = 56;
/** Kinds with fewer instances than this stay in one mesh: splitting them only adds draw calls. */
export const MIN_TO_CHUNK = 40;
/** …unless together they are heavy enough to be worth culling (buildings). */
export const MIN_TRIANGLES_TO_CHUNK = 9000;
/** Slack around a chunk's bounds for objects leaning, sliding or falling into a hole (m). */
const CHUNK_MARGIN = 10;

export const chunkOf = (x: number, z: number) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;

/** Lets three.js skip the mesh when all its instances are off screen (or outside the shadow frustum). */
export function enableCulling(mesh: InstancedMesh) {
  mesh.computeBoundingSphere();
  mesh.boundingSphere!.radius += CHUNK_MARGIN;
  mesh.frustumCulled = true;
}
