import {
  CanvasTexture,
  Color,
  Mesh,
  MeshStandardMaterial,
  NotEqualStencilFunc,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  CircleGeometry,
  Group,
  type Material,
  type WebGLRenderer,
} from "three";
import { CITY } from "../config/constants";
import type { ThemeDef } from "../config/themes";
import type { CityLayout, Rect } from "../core/cityGenerator";
import { Rng } from "../core/rng";

/** Everything drawn flat on the ground is hidden inside holes via the stencil buffer. */
export function applyHoleStencil(material: Material) {
  material.stencilWrite = true;
  material.stencilRef = 1;
  material.stencilFunc = NotEqualStencilFunc;
}

function noiseTile(size: number, seed: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const rng = new Rng(seed);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (rng.next() - 0.5) * 90;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Small tileable texture with soft blotches, so the outer terrain isn't a flat color. */
function terrainTile(base: string, variation: number) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rng = new Rng(7);
  const color = new Color(base);
  for (let i = 0; i < 90; i++) {
    const shade = color.clone().offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-variation, variation * 0.6));
    ctx.fillStyle = `#${shade.getHexString()}`;
    ctx.globalAlpha = rng.range(0.25, 0.6);
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const r = rng.range(6, 34);
    // Draw wrapped copies so the tile repeats seamlessly.
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return canvas;
}

interface Painter {
  ctx: CanvasRenderingContext2D;
  /** Pixels per meter. */
  ppm: number;
  half: number;
}

const px = (p: Painter, v: number) => (v + p.half) * p.ppm;
const len = (p: Painter, v: number) => v * p.ppm;

function fillRect(p: Painter, r: Rect, color: string) {
  p.ctx.fillStyle = color;
  p.ctx.fillRect(px(p, r.x0), px(p, r.z0), len(p, r.x1 - r.x0), len(p, r.z1 - r.z0));
}

function strokeRect(p: Painter, r: Rect, color: string, width: number) {
  p.ctx.strokeStyle = color;
  p.ctx.lineWidth = len(p, width);
  p.ctx.strokeRect(px(p, r.x0), px(p, r.z0), len(p, r.x1 - r.x0), len(p, r.z1 - r.z0));
}

function tileLines(p: Painter, r: Rect, spacing: number, color: string, alpha: number) {
  const { ctx } = p;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, len(p, 0.06));
  ctx.beginPath();
  for (let x = r.x0; x <= r.x1; x += spacing) {
    ctx.moveTo(px(p, x), px(p, r.z0));
    ctx.lineTo(px(p, x), px(p, r.z1));
  }
  for (let z = r.z0; z <= r.z1; z += spacing) {
    ctx.moveTo(px(p, r.x0), px(p, z));
    ctx.lineTo(px(p, r.x1), px(p, z));
  }
  ctx.stroke();
  ctx.restore();
}

function paintRoads(p: Painter, layout: CityLayout, theme: ThemeDef) {
  const { ctx } = p;
  const { roadWidth } = CITY;
  const hw = roadWidth / 2;
  const pal = theme.palette;
  const h = layout.half;

  for (const x of layout.roadXs) fillRect(p, { x0: x - hw, x1: x + hw, z0: -h, z1: h }, pal.asphalt);
  for (const z of layout.roadZs) fillRect(p, { x0: -h, x1: h, z0: z - hw, z1: z + hw }, pal.asphalt);
  // Curb along the city edge, where the perimeter fence stands.
  strokeRect(p, { x0: -h - 0.3, z0: -h - 0.3, x1: h + 0.3, z1: h + 0.3 }, pal.curb, 0.6);

  // Dashed center lines between intersections.
  ctx.save();
  ctx.strokeStyle = pal.centerLine;
  ctx.lineWidth = len(p, 0.22);
  ctx.setLineDash([len(p, 3), len(p, 2.5)]);
  ctx.beginPath();
  for (let i = 0; i < layout.roadXs.length; i++) {
    for (let j = 0; j < layout.roadZs.length - 1; j++) {
      const x = layout.roadXs[i];
      ctx.moveTo(px(p, x), px(p, layout.roadZs[j] + hw + 3));
      ctx.lineTo(px(p, x), px(p, layout.roadZs[j + 1] - hw - 3));
    }
  }
  for (let j = 0; j < layout.roadZs.length; j++) {
    for (let i = 0; i < layout.roadXs.length - 1; i++) {
      const z = layout.roadZs[j];
      ctx.moveTo(px(p, layout.roadXs[i] + hw + 3), px(p, z));
      ctx.lineTo(px(p, layout.roadXs[i + 1] - hw - 3), px(p, z));
    }
  }
  ctx.stroke();
  ctx.restore();

  // Zebra crossings and stop lines around each intersection.
  ctx.fillStyle = pal.laneLine;
  const stripe = 0.55;
  for (const x of layout.roadXs) {
    for (const z of layout.roadZs) {
      for (const side of [-1, 1]) {
        // Crossings on the vertical road (north/south of the intersection).
        const cz = z + side * (hw + 1.4);
        for (let s = -hw + 0.6; s < hw - 0.4; s += stripe * 2) {
          ctx.fillRect(px(p, x + s), px(p, cz - 1.1), len(p, stripe), len(p, 2.2));
        }
        // Crossings on the horizontal road (east/west).
        const cx = x + side * (hw + 1.4);
        for (let s = -hw + 0.6; s < hw - 0.4; s += stripe * 2) {
          ctx.fillRect(px(p, cx - 1.1), px(p, z + s), len(p, 2.2), len(p, stripe));
        }
      }
    }
  }
}

function paintBlock(p: Painter, block: CityLayout["blocks"][number], theme: ThemeDef, rng: Rng) {
  const pal = theme.palette;
  const sw = CITY.sidewalkWidth;
  fillRect(p, block, pal.sidewalk);
  tileLines(p, block, 1.5, pal.curb, 0.35);
  strokeRect(p, { x0: block.x0 + 0.12, z0: block.z0 + 0.12, x1: block.x1 - 0.12, z1: block.z1 - 0.12 }, pal.curb, 0.25);

  const inner: Rect = { x0: block.x0 + sw, z0: block.z0 + sw, x1: block.x1 - sw, z1: block.z1 - sw };

  switch (block.zone) {
    case "downtown":
    case "commercial":
    case "plaza": {
      fillRect(p, inner, pal.plaza);
      tileLines(p, inner, block.zone === "plaza" ? 2 : 3, pal.curb, 0.25);
      if (block.zone === "plaza") {
        const cx = (inner.x0 + inner.x1) / 2;
        const cz = (inner.z0 + inner.z1) / 2;
        p.ctx.save();
        p.ctx.globalAlpha = 0.5;
        p.ctx.strokeStyle = pal.curb;
        p.ctx.lineWidth = len(p, 0.4);
        for (const r of [5, 9.5]) {
          p.ctx.beginPath();
          p.ctx.arc(px(p, cx), px(p, cz), len(p, r), 0, Math.PI * 2);
          p.ctx.stroke();
        }
        p.ctx.restore();
      }
      // Planted strips add color to paved blocks.
      if (block.zone !== "plaza") {
        for (const lot of block.lots) {
          fillRect(p, { x0: lot.x0 - 0.6, x1: lot.x1 + 0.6, z0: lot.z0 - 0.6, z1: lot.z1 + 0.6 }, pal.curb);
        }
      }
      break;
    }
    case "residential": {
      fillRect(p, inner, pal.grass);
      // Mowing stripes.
      p.ctx.save();
      p.ctx.globalAlpha = 0.35;
      p.ctx.fillStyle = pal.grassAlt;
      for (let x = inner.x0; x < inner.x1; x += 3) p.ctx.fillRect(px(p, x), px(p, inner.z0), len(p, 1.5), len(p, inner.z1 - inner.z0));
      p.ctx.restore();
      for (const lot of block.lots) {
        fillRect(p, { x0: lot.x0 - 0.4, x1: lot.x1 + 0.4, z0: lot.z0 - 0.4, z1: lot.z1 + 0.4 }, pal.dirt);
      }
      break;
    }
    case "park": {
      fillRect(p, inner, pal.grass);
      p.ctx.save();
      p.ctx.globalAlpha = 0.25;
      for (let i = 0; i < 30; i++) {
        p.ctx.fillStyle = rng.chance(0.5) ? pal.grassAlt : pal.grass;
        p.ctx.beginPath();
        p.ctx.arc(px(p, rng.range(inner.x0, inner.x1)), px(p, rng.range(inner.z0, inner.z1)), len(p, rng.range(2, 6)), 0, Math.PI * 2);
        p.ctx.fill();
      }
      p.ctx.restore();
      for (const path of block.paths) {
        p.ctx.strokeStyle = pal.dirt;
        p.ctx.lineCap = "round";
        p.ctx.lineWidth = len(p, path.width);
        p.ctx.beginPath();
        p.ctx.moveTo(px(p, path.ax), px(p, path.az));
        p.ctx.lineTo(px(p, path.bx), px(p, path.bz));
        p.ctx.stroke();
      }
      const cx = (inner.x0 + inner.x1) / 2;
      const cz = (inner.z0 + inner.z1) / 2;
      p.ctx.fillStyle = pal.dirt;
      p.ctx.beginPath();
      p.ctx.arc(px(p, cx), px(p, cz), len(p, 5.5), 0, Math.PI * 2);
      p.ctx.fill();
      break;
    }
    case "parking": {
      fillRect(p, inner, pal.asphalt);
      p.ctx.save();
      p.ctx.strokeStyle = pal.laneLine;
      p.ctx.globalAlpha = 0.8;
      p.ctx.lineWidth = len(p, 0.14);
      p.ctx.beginPath();
      for (let z = inner.z0 + 0.8 + 2.6; z < inner.z1 - 2; z += 6.5) {
        for (let x = inner.x0 + 0.8 + 0.4; x < inner.x1 - 0.8; x += 2.8) {
          p.ctx.moveTo(px(p, x), px(p, z - 2.3));
          p.ctx.lineTo(px(p, x), px(p, z + 2.3));
        }
      }
      p.ctx.stroke();
      p.ctx.restore();
      break;
    }
    case "beach": {
      fillRect(p, inner, pal.sand);
      p.ctx.save();
      p.ctx.globalAlpha = 0.18;
      for (let i = 0; i < 60; i++) {
        p.ctx.fillStyle = rng.chance(0.5) ? "#ffffff" : pal.dirt;
        p.ctx.beginPath();
        p.ctx.arc(px(p, rng.range(inner.x0, inner.x1)), px(p, rng.range(inner.z0, inner.z1)), len(p, rng.range(0.6, 2.5)), 0, Math.PI * 2);
        p.ctx.fill();
      }
      p.ctx.restore();
      break;
    }
  }
}

function paintDetail(p: Painter, size: number) {
  const { ctx } = p;
  const tile = noiseTile(128, 42);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = ctx.createPattern(tile, "repeat")!;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function paintLightPools(layout: CityLayout, size: number, ppm: number, warm: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.max(256, size / 4);
  const scale = canvas.width / size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "lighter";
  const color = new Color(warm);
  const rgb = `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`;
  for (const o of layout.objects) {
    if (o.kind !== "lampPost") continue;
    const ox = o.x + Math.sin(o.rotY) * 1.2;
    const oz = o.z + Math.cos(o.rotY) * 1.2;
    const cx = (ox + layout.half) * ppm * scale;
    const cz = (oz + layout.half) * ppm * scale;
    const r = 9 * ppm * scale;
    const g = ctx.createRadialGradient(cx, cz, 0, cx, cz, r);
    g.addColorStop(0, `rgba(${rgb},0.55)`);
    g.addColorStop(0.5, `rgba(${rgb},0.18)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cz - r, r * 2, r * 2);
  }
  return canvas;
}

export interface GroundOptions {
  textureSize: number;
  renderer: WebGLRenderer;
}

/** Builds the painted city ground, the surrounding terrain and (for beach) the sea. */
export function createGround(layout: CityLayout, theme: ThemeDef, options: GroundOptions) {
  const group = new Group();
  group.name = "ground";
  const size = options.textureSize;
  const cityExtent = layout.half * 2 + 24;
  const painter: Painter = {
    ctx: document.createElement("canvas").getContext("2d")!,
    ppm: size / cityExtent,
    half: cityExtent / 2,
  };
  const canvas = painter.ctx.canvas;
  canvas.width = canvas.height = size;

  const pal = theme.palette;
  painter.ctx.fillStyle = theme.outer === "water" ? pal.sand : pal.outer;
  painter.ctx.fillRect(0, 0, size, size);
  const rng = new Rng(layout.objects.length * 13 + 5);
  paintRoads(painter, layout, theme);
  for (const block of layout.blocks) paintBlock(painter, block, theme, rng);
  paintDetail(painter, size);

  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = options.renderer.capabilities.getMaxAnisotropy();

  const material = new MeshStandardMaterial({ map, roughness: 0.92, metalness: 0 });
  if (theme.lighting.night > 0.5) {
    const pools = new CanvasTexture(paintLightPools(layout, size, painter.ppm, "#ffcf87"));
    pools.colorSpace = SRGBColorSpace;
    material.emissiveMap = pools;
    material.emissive = new Color("#ffffff");
    material.emissiveIntensity = 0.9;
  }
  applyHoleStencil(material);

  const city = new Mesh(new PlaneGeometry(cityExtent, cityExtent), material);
  city.rotation.x = -Math.PI / 2;
  city.receiveShadow = true;
  city.renderOrder = 1;
  group.add(city);

  // Surrounding terrain fading into the fog.
  const outerMap = new CanvasTexture(terrainTile(theme.outer === "water" ? pal.water : pal.outer, theme.outer === "water" ? 0.06 : 0.16));
  outerMap.colorSpace = SRGBColorSpace;
  outerMap.wrapS = outerMap.wrapT = RepeatWrapping;
  outerMap.repeat.set(160, 160);
  outerMap.anisotropy = map.anisotropy;
  const outerMaterial = new MeshStandardMaterial({
    map: outerMap,
    roughness: theme.outer === "water" ? 0.25 : 0.95,
    metalness: theme.outer === "water" ? 0.1 : 0,
  });
  applyHoleStencil(outerMaterial);
  const outer = new Mesh(new CircleGeometry(1600, 48), outerMaterial);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = theme.outer === "water" ? -0.8 : -0.05;
  outer.receiveShadow = true;
  outer.renderOrder = 1;
  group.add(outer);

  if (theme.outer === "water") {
    // Sandy shore ring between the city and the sea.
    const shoreMat = new MeshStandardMaterial({ color: pal.sand, roughness: 1 });
    applyHoleStencil(shoreMat);
    const shore = new Mesh(new PlaneGeometry(cityExtent + 70, cityExtent + 70), shoreMat);
    shore.rotation.x = -Math.PI / 2;
    shore.position.y = -0.1;
    shore.receiveShadow = true;
    shore.renderOrder = 1;
    group.add(shore);
  }

  return {
    group,
    dispose() {
      group.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const m = o.material as MeshStandardMaterial;
          m.map?.dispose();
          m.emissiveMap?.dispose();
          m.dispose();
        }
      });
    },
  };
}
