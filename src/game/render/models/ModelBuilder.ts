import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type ColorRepresentation,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Surface, type SurfaceType } from "../materials/cityMaterial";

export interface PartStyle {
  color: ColorRepresentation;
  /** 1 = takes the per-instance paint color. */
  tint?: number;
  surface?: SurfaceType;
  glow?: number;
  /** Flat shading (faceted low-poly look). Defaults to true. */
  flat?: boolean;
}

export interface Placement {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

const tmpMatrix = new Matrix4();
const tmpQuat = new Quaternion();
const tmpEuler = new Euler();
const tmpScale = new Vector3();
const tmpPos = new Vector3();
const tmpColor = new Color();

/**
 * Tiny procedural modelling kit: primitives are positioned with their base at `y`,
 * decorated with per-vertex color/tint/surface/glow and merged into a single
 * geometry per model, ready for instancing with the shared city material.
 */
export class ModelBuilder {
  private readonly parts: BufferGeometry[] = [];

  add(geometry: BufferGeometry, style: PartStyle, place: Placement = {}) {
    let geo = geometry.index ? geometry.toNonIndexed() : geometry;
    geo.deleteAttribute("uv");
    geo.deleteAttribute("uv1");
    if (style.flat !== false) {
      geo.deleteAttribute("normal");
      geo.computeVertexNormals();
    }

    const count = geo.attributes.position.count;
    if (!geo.attributes.surface) {
      geo.setAttribute("surface", new BufferAttribute(new Float32Array(count * 3), 3));
    }
    const surface = geo.attributes.surface as BufferAttribute;
    if (style.surface !== undefined && style.surface !== Surface.windows && style.surface !== Surface.curtain && style.surface !== Surface.storefront) {
      for (let i = 0; i < count; i++) surface.setZ(i, style.surface);
    }

    tmpColor.set(style.color);
    const colors = new Float32Array(count * 3);
    const tints = new Float32Array(count).fill(style.tint ?? 0);
    const glows = new Float32Array(count).fill(style.glow ?? 0);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    geo.setAttribute("tint", new BufferAttribute(tints, 1));
    geo.setAttribute("glow", new BufferAttribute(glows, 1));

    tmpEuler.set(place.rx ?? 0, place.ry ?? 0, place.rz ?? 0);
    tmpQuat.setFromEuler(tmpEuler);
    tmpScale.set(place.sx ?? 1, place.sy ?? 1, place.sz ?? 1);
    tmpPos.set(place.x ?? 0, place.y ?? 0, place.z ?? 0);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    geo = geo.applyMatrix4(tmpMatrix);
    this.parts.push(geo);
    return this;
  }

  /** Box whose bottom sits at `y`. */
  box(w: number, h: number, d: number, style: PartStyle, place: Placement = {}) {
    const g = new BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    return this.add(g, style, place);
  }

  /**
   * Building volume with procedural windows on its walls. Facade coordinates are in
   * meters from the building's ground level so floors line up across parts.
   */
  facade(w: number, h: number, d: number, style: PartStyle & { surface: SurfaceType }, place: Placement = {}) {
    const baseHeight = place.y ?? 0;
    const g = new BoxGeometry(w, h, d).toNonIndexed();
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const surface = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const nx = nor.getX(i);
      const ny = nor.getY(i);
      const nz = nor.getZ(i);
      if (Math.abs(ny) > 0.5) continue;
      const u = Math.abs(nx) > 0.5 ? pos.getZ(i) * -Math.sign(nx) + d / 2 : pos.getX(i) * Math.sign(nz) + w / 2;
      surface[i * 3] = u;
      surface[i * 3 + 1] = pos.getY(i) + h / 2 + baseHeight;
      surface[i * 3 + 2] = style.surface;
    }
    g.setAttribute("surface", new BufferAttribute(surface, 3));
    g.translate(0, h / 2, 0);
    return this.add(g, { ...style, flat: false }, place);
  }

  cylinder(rTop: number, rBottom: number, h: number, style: PartStyle, place: Placement = {}, segments = 10) {
    const g = new CylinderGeometry(rTop, rBottom, h, segments);
    g.translate(0, h / 2, 0);
    return this.add(g, { flat: style.flat ?? segments < 8, ...style }, place);
  }

  cone(r: number, h: number, style: PartStyle, place: Placement = {}, segments = 10) {
    const g = new ConeGeometry(r, h, segments);
    g.translate(0, h / 2, 0);
    return this.add(g, style, place);
  }

  /** Faceted sphere centered at the placement point. */
  blob(r: number, style: PartStyle, place: Placement = {}, detail = 1) {
    return this.add(new IcosahedronGeometry(r, detail), style, place);
  }

  sphere(r: number, style: PartStyle, place: Placement = {}, segments = 12) {
    return this.add(new SphereGeometry(r, segments, Math.max(6, segments * 0.66)), { flat: false, ...style }, place);
  }

  torus(r: number, tube: number, style: PartStyle, place: Placement = {}) {
    return this.add(new TorusGeometry(r, tube, 5, 14), { flat: false, ...style }, place);
  }

  /** Triangular prism (gable roof) spanning `w` along X, ridge along X. */
  gable(w: number, h: number, d: number, style: PartStyle, place: Placement = {}) {
    const g = new CylinderGeometry(1, 1, w, 3, 1);
    // Point one edge up, then squash to the requested size.
    g.rotateZ(Math.PI / 2);
    g.rotateX(-Math.PI / 2);
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    g.translate(0, -bb.min.y, 0);
    g.scale(1, h / (bb.max.y - bb.min.y), d / (bb.max.z - bb.min.z));
    return this.add(g, style, place);
  }

  /**
   * Merges all parts into one geometry. The origin ends up at the model's center
   * (height / 2) to match the simulation's pivot convention.
   */
  build(height: number): BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    if (!merged) throw new Error("Failed to merge model parts");
    merged.translate(0, -height / 2, 0);
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    for (const p of this.parts) p.dispose();
    return merged;
  }
}
