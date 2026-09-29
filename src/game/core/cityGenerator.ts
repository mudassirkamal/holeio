import { CITY } from "../config/constants";
import { KIND, type ObjectKindId } from "../config/objectCatalog";
import { THEMES, type ThemeDef, type ThemeId, type ZoneType } from "../config/themes";
import { Rng } from "./rng";

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface CityBlock extends Rect {
  zone: ZoneType;
  /** Lots (building plots) used for ground painting. */
  lots: Rect[];
  /** Walkable path segments inside parks/plazas, used for ground painting. */
  paths: { ax: number; az: number; bx: number; bz: number; width: number }[];
}

export type Direction = 0 | 1 | 2 | 3; // East(+x), South(+z), West(-x), North(-z)

export interface CarSpawn {
  type: "car";
  /** Road node the car is driving away from. */
  nodeX: number;
  nodeZ: number;
  dir: Direction;
  progress: number;
  speed: number;
}

export interface WalkerSpawn {
  type: "walker";
  route: number;
  distance: number;
  direction: 1 | -1;
  speed: number;
  lateral: number;
}

export interface PlacedObject {
  kind: ObjectKindId;
  x: number;
  z: number;
  rotY: number;
  /** Stable random number used by the renderer to pick colors/variants. */
  seed: number;
  spawn?: CarSpawn | WalkerSpawn;
}

/** A closed rectangular loop pedestrians walk around. */
export interface WalkRoute {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  perimeter: number;
}

export interface CityLayout {
  themeId: ThemeId;
  half: number;
  roadXs: number[];
  roadZs: number[];
  blocks: CityBlock[];
  objects: PlacedObject[];
  walkRoutes: WalkRoute[];
}

interface Circle {
  x: number;
  z: number;
  r: number;
}

/** Keeps generated objects from overlapping inside a block. */
class Occupancy {
  private circles: Circle[] = [];

  fits(x: number, z: number, r: number) {
    for (const c of this.circles) {
      const dx = c.x - x;
      const dz = c.z - z;
      const min = c.r + r;
      if (dx * dx + dz * dz < min * min) return false;
    }
    return true;
  }

  add(x: number, z: number, r: number) {
    this.circles.push({ x, z, r });
  }
}

const HALF_PI = Math.PI / 2;

/** Splits `total` into `count` segments with random sizes in [min, max], scaled to fit. */
function randomSegments(rng: Rng, count: number, total: number) {
  const raw = Array.from({ length: count }, () => rng.range(0.8, 1.25));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => (v / sum) * total);
}

/** Rotation that makes a building's front (+Z) face the closest block edge. */
function faceNearestEdge(block: Rect, x: number, z: number) {
  const distances = [
    { d: block.z1 - z, rot: 0 },
    { d: z - block.z0, rot: Math.PI },
    { d: block.x1 - x, rot: HALF_PI },
    { d: x - block.x0, rot: -HALF_PI },
  ];
  distances.sort((a, b) => a.d - b.d);
  return distances[0].rot;
}

export class CityGenerator {
  private readonly rng: Rng;
  private readonly theme: ThemeDef;
  private readonly objects: PlacedObject[] = [];
  private readonly walkRoutes: WalkRoute[] = [];

  constructor(
    private readonly themeId: ThemeId,
    private readonly blocksPerSide: number,
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.theme = THEMES[themeId];
  }

  generate(): CityLayout {
    const { roadWidth } = CITY;
    const n = this.blocksPerSide;
    const avgBlock = 44;
    const size = n * avgBlock + (n + 1) * roadWidth;
    const half = size / 2;

    const roadXs = this.roadPositions(half, n);
    const roadZs = this.roadPositions(half, n);

    const blocks: CityBlock[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const rect: Rect = {
          x0: roadXs[i] + roadWidth / 2,
          x1: roadXs[i + 1] - roadWidth / 2,
          z0: roadZs[j] + roadWidth / 2,
          z1: roadZs[j + 1] - roadWidth / 2,
        };
        const centerDistance = Math.hypot(
          (rect.x0 + rect.x1) / 2 / half,
          (rect.z0 + rect.z1) / 2 / half,
        );
        const zone = this.rng.weighted(centerDistance < 0.45 ? this.theme.centerZones : this.theme.zones);
        blocks.push({ ...rect, zone, lots: [], paths: [] });
      }
    }

    for (const block of blocks) this.fillBlock(block);
    this.spawnTraffic(roadXs, roadZs);

    return {
      themeId: this.themeId,
      half,
      roadXs,
      roadZs,
      blocks,
      objects: this.objects,
      walkRoutes: this.walkRoutes,
    };
  }

  private roadPositions(half: number, n: number) {
    const { roadWidth } = CITY;
    const total = half * 2 - (n + 1) * roadWidth;
    const segments = randomSegments(this.rng, n, total);
    const positions = [-half + roadWidth / 2];
    for (const seg of segments) positions.push(positions[positions.length - 1] + seg + roadWidth);
    return positions;
  }

  private place(kind: ObjectKindId, x: number, z: number, rotY = 0, spawn?: PlacedObject["spawn"]) {
    this.objects.push({ kind, x, z, rotY, seed: this.rng.next(), spawn });
  }

  // ---------------------------------------------------------------------------
  // Blocks
  // ---------------------------------------------------------------------------

  private fillBlock(block: CityBlock) {
    const occ = new Occupancy();
    const sidewalkRoute = this.fillSidewalk(block, occ);

    const inset = CITY.sidewalkWidth + 0.8;
    const inner: Rect = {
      x0: block.x0 + inset,
      z0: block.z0 + inset,
      x1: block.x1 - inset,
      z1: block.z1 - inset,
    };

    switch (block.zone) {
      case "downtown":
        this.fillDowntown(block, inner, occ);
        break;
      case "commercial":
        this.fillCommercial(block, inner, occ);
        break;
      case "residential":
        this.fillResidential(block, inner, occ);
        break;
      case "park":
        this.fillPark(block, inner, occ);
        break;
      case "parking":
        this.fillParking(block, inner, occ);
        break;
      case "plaza":
        this.fillPlaza(block, inner, occ);
        break;
      case "beach":
        this.fillBeach(block, inner, occ);
        break;
    }

    this.addWalkers(block, sidewalkRoute);
  }

  /**
   * Lamp posts, street trees, traffic lights and random street furniture.
   * Returns the index of the sidewalk walking loop around the block.
   */
  private fillSidewalk(block: CityBlock, occ: Occupancy) {
    const rng = this.rng;
    const edgeInset = 0.9;
    const corners = [
      [block.x0 + edgeInset, block.z0 + edgeInset],
      [block.x1 - edgeInset, block.z0 + edgeInset],
      [block.x1 - edgeInset, block.z1 - edgeInset],
      [block.x0 + edgeInset, block.z1 - edgeInset],
    ] as const;

    // Traffic lights on two opposite corners.
    for (const idx of rng.chance(0.5) ? [0, 2] : [1, 3]) {
      const [x, z] = corners[idx];
      this.place("trafficLight", x, z, rng.int(0, 3) * HALF_PI);
      occ.add(x, z, 0.8);
    }

    const edges = [
      { ax: block.x0, az: block.z0, bx: block.x1, bz: block.z0, nx: 0, nz: 1 },
      { ax: block.x1, az: block.z0, bx: block.x1, bz: block.z1, nx: -1, nz: 0 },
      { ax: block.x1, az: block.z1, bx: block.x0, bz: block.z1, nx: 0, nz: -1 },
      { ax: block.x0, az: block.z1, bx: block.x0, bz: block.z0, nx: 1, nz: 0 },
    ];

    for (const e of edges) {
      const length = Math.hypot(e.bx - e.ax, e.bz - e.az);
      const ux = (e.bx - e.ax) / length;
      const uz = (e.bz - e.az) / length;
      const faceRot = Math.atan2(-e.nx, -e.nz); // facing the road
      const curbX = e.ax + e.nx * edgeInset;
      const curbZ = e.az + e.nz * edgeInset;

      // Lamp posts at regular intervals.
      const lampSpacing = 15;
      for (let s = 6; s < length - 4; s += lampSpacing) {
        const x = curbX + ux * s;
        const z = curbZ + uz * s;
        if (occ.fits(x, z, 0.6)) {
          this.place("lampPost", x, z, faceRot);
          occ.add(x, z, 0.6);
        }
      }

      // Street trees between lamps.
      if (this.theme.streetTree && block.zone !== "parking") {
        for (let s = 10.5; s < length - 5; s += lampSpacing / (rng.chance(0.5) ? 1 : 2)) {
          const x = curbX + ux * s + e.nx * 0.4;
          const z = curbZ + uz * s + e.nz * 0.4;
          if (rng.chance(0.75) && occ.fits(x, z, 1.3)) {
            this.place(this.theme.streetTree, x, z, rng.range(0, Math.PI * 2));
            occ.add(x, z, 1.3);
          }
        }
      }

      // Scattered props.
      for (let s = 3; s < length - 3; s += rng.range(3.5, 7)) {
        if (!rng.chance(0.55)) continue;
        const kind = rng.weighted(this.theme.streetProps);
        const k = KIND[kind];
        const inward = kind === "bench" || kind === "busStop" || kind === "newsStand" ? 1.9 : rng.range(0.3, 1.6);
        const x = curbX + ux * s + e.nx * inward;
        const z = curbZ + uz * s + e.nz * inward;
        const r = k.footRadius * 0.8 + 0.2;
        if (occ.fits(x, z, r)) {
          const rot = kind === "bench" || kind === "bicycle" ? faceRot + (kind === "bench" ? Math.PI : HALF_PI) : rng.range(0, Math.PI * 2);
          this.place(kind, x, z, rot);
          occ.add(x, z, r);
        }
      }

      // Occasional bus stop.
      if (length > 30 && rng.chance(0.18)) {
        const s = length * rng.range(0.35, 0.65);
        const x = curbX + ux * s + e.nx * 1.5;
        const z = curbZ + uz * s + e.nz * 1.5;
        if (occ.fits(x, z, 2)) {
          this.place("busStop", x, z, faceRot + Math.PI);
          occ.add(x, z, 2);
        }
      }
    }

    this.walkRoutes.push({
      x0: block.x0 + 1.7,
      z0: block.z0 + 1.7,
      x1: block.x1 - 1.7,
      z1: block.z1 - 1.7,
      perimeter: 2 * (block.x1 - block.x0 - 3.4 + (block.z1 - block.z0 - 3.4)),
    });
    return this.walkRoutes.length - 1;
  }

  private addWalkers(block: CityBlock, route: number) {
    const rng = this.rng;
    const r = this.walkRoutes[route];
    const zoneBoost = block.zone === "plaza" || block.zone === "beach" ? 1.6 : block.zone === "downtown" ? 1.2 : 1;
    const count = Math.round(this.theme.walkerDensity * zoneBoost * rng.range(0.7, 1.3));
    for (let i = 0; i < count; i++) {
      const distance = rng.range(0, r.perimeter);
      this.place("person", 0, 0, 0, {
        type: "walker",
        route,
        distance,
        direction: rng.sign(),
        speed: rng.range(1.1, 1.9),
        lateral: rng.range(-0.7, 0.7),
      });
    }
  }

  /** Splits a rect into a grid of lots of roughly `target` size. */
  private lotsOf(rect: Rect, target: number, gap = 1.2): Rect[] {
    const w = rect.x1 - rect.x0;
    const d = rect.z1 - rect.z0;
    return this.lotGrid(rect, Math.max(1, Math.round(w / target)), Math.max(1, Math.round(d / target)), gap);
  }

  /** Splits a rect into as many lots as possible that are at least `minSize` wide. */
  private lotsAtLeast(rect: Rect, minSize: number, gap: number): Rect[] {
    const w = rect.x1 - rect.x0;
    const d = rect.z1 - rect.z0;
    return this.lotGrid(rect, Math.max(1, Math.floor(w / minSize)), Math.max(1, Math.floor(d / minSize)), gap);
  }

  private lotGrid(rect: Rect, nx: number, nz: number, gap: number): Rect[] {
    const lw = (rect.x1 - rect.x0) / nx;
    const ld = (rect.z1 - rect.z0) / nz;
    const lots: Rect[] = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        lots.push({
          x0: rect.x0 + i * lw + gap / 2,
          x1: rect.x0 + (i + 1) * lw - gap / 2,
          z0: rect.z0 + j * ld + gap / 2,
          z1: rect.z0 + (j + 1) * ld - gap / 2,
        });
      }
    }
    return lots;
  }

  /**
   * Places the biggest candidate that fits the lot, facing the nearest road.
   * Returns the footprint radius used, or 0 if nothing fits.
   */
  private placeBuilding(
    block: CityBlock,
    lot: Rect,
    candidates: readonly ObjectKindId[],
    occ: Occupancy,
  ) {
    const cx = (lot.x0 + lot.x1) / 2;
    const cz = (lot.z0 + lot.z1) / 2;
    const rot = faceNearestEdge(block, cx, cz);
    const sideways = Math.abs(Math.sin(rot)) > 0.5;
    const lw = lot.x1 - lot.x0;
    const ld = lot.z1 - lot.z0;

    const fitting = candidates.filter((id) => {
      const k = KIND[id];
      const w = sideways ? k.depth : k.width;
      const d = sideways ? k.width : k.depth;
      return w <= lw && d <= ld;
    });
    if (fitting.length === 0) return 0;

    // Prefer bigger buildings but keep variety.
    fitting.sort((a, b) => KIND[b].value - KIND[a].value);
    const pick = fitting[Math.min(fitting.length - 1, Math.floor(this.rng.next() ** 1.6 * fitting.length))];
    const k = KIND[pick];
    const w = sideways ? k.depth : k.width;
    const d = sideways ? k.width : k.depth;

    // Push the building toward its road so leftover space ends up behind it.
    const slackX = lw - w;
    const slackZ = ld - d;
    const x = cx + (rot === HALF_PI ? slackX / 2 : rot === -HALF_PI ? -slackX / 2 : 0);
    const z = cz + (rot === 0 ? slackZ / 2 : rot === Math.PI ? -slackZ / 2 : 0);

    this.place(pick, x, z, rot);
    occ.add(x, z, Math.min(w, d) / 2);
    block.lots.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    return Math.max(w, d) / 2;
  }

  /** Fills free space in a rect with random props. */
  private scatter(
    rect: Rect,
    occ: Occupancy,
    props: readonly (readonly [ObjectKindId, number])[],
    attempts: number,
    spacing = 0.6,
  ) {
    for (let i = 0; i < attempts; i++) {
      const kind = this.rng.weighted(props);
      const k = KIND[kind];
      const r = k.footRadius * 0.75 + spacing;
      const x = this.rng.range(rect.x0 + r, rect.x1 - r);
      const z = this.rng.range(rect.z0 + r, rect.z1 - r);
      if (occ.fits(x, z, r)) {
        this.place(kind, x, z, this.rng.range(0, Math.PI * 2));
        occ.add(x, z, r);
      }
    }
  }

  private fillDowntown(block: CityBlock, inner: Rect, occ: Occupancy) {
    const w = inner.x1 - inner.x0;
    const d = inner.z1 - inner.z0;
    const rng = this.rng;

    if (w >= 24 && d >= 24 && rng.chance(0.35)) {
      const cx = (inner.x0 + inner.x1) / 2;
      const cz = (inner.z0 + inner.z1) / 2;
      const kind = rng.chance(0.55) ? "skyscraper" : "tower";
      const rot = rng.int(0, 3) * HALF_PI;
      this.place(kind, cx, cz, rot);
      const k = KIND[kind];
      occ.add(cx, cz, k.footRadius * 0.95);
      block.lots.push({ x0: cx - k.width / 2, x1: cx + k.width / 2, z0: cz - k.depth / 2, z1: cz + k.depth / 2 });
      this.scatter(inner, occ, [["flowerPot", 3], ["bench", 2], ["bush", 2], ["trashCan", 1], ["kiosk", 0.6]], 40);
      return;
    }

    const lots = this.lotsAtLeast(inner, rng.pick([16.5, 17.5, 18.5]), 0.8);
    for (const lot of lots) {
      this.placeBuilding(block, lot, ["tower", "office", "apartment", "shop"], occ);
    }
    this.scatter(inner, occ, [["flowerPot", 3], ["bush", 2], ["bench", 1], ["trashCan", 1]], 25);
  }

  private fillCommercial(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const lots = this.lotsOf(inner, rng.pick([13, 14, 16]));
    for (const lot of lots) {
      const roll = rng.next();
      if (roll < 0.12) {
        // A small lot used as parking.
        this.parkCars(lot, occ);
        block.lots.push(lot);
      } else {
        const options: ObjectKindId[] = roll < 0.3 ? ["gasStation", "shop"] : ["shop", "apartment", "kiosk"];
        this.placeBuilding(block, lot, options, occ);
      }
    }
    this.scatter(inner, occ, [["kiosk", 1], ["flowerPot", 2], ["bench", 2], ["trashCan", 2], ["newsStand", 1], ["bush", 2]], 30);
  }

  private fillResidential(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const lots = this.lotsOf(inner, rng.pick([11.5, 12.5, 13.5]), 1.6);
    for (const lot of lots) {
      if (rng.chance(0.12)) {
        // Garden lot.
        this.scatter(lot, occ, [[this.theme.parkTree, 3], ["bush", 3], ["flowerPot", 1]], 8, 0.4);
        continue;
      }
      const placed = this.placeBuilding(block, lot, ["house", "houseSmall"], occ);
      if (placed) {
        this.scatter(lot, occ, [[this.theme.parkTree, 2], ["bush", 3], ["mailbox", 1], ["flowerPot", 1], ["bicycle", 0.5]], 6, 0.3);
      }
    }
    if (this.theme.id === "frost") this.scatter(inner, occ, [["snowman", 1]], 6);
    // Occasional water tower on bigger residential blocks.
    if (rng.chance(0.12)) this.scatter(inner, occ, [["waterTower", 1]], 4, 0.5);
  }

  private fillPark(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const cx = (inner.x0 + inner.x1) / 2;
    const cz = (inner.z0 + inner.z1) / 2;
    const pathWidth = 2.6;

    // Cross-shaped paths with a centerpiece.
    block.paths.push({ ax: block.x0, az: cz, bx: block.x1, bz: cz, width: pathWidth });
    block.paths.push({ ax: cx, az: block.z0, bx: cx, bz: block.z1, width: pathWidth });

    const centerpiece: ObjectKindId = rng.chance(0.55) ? "fountain" : "statue";
    this.place(centerpiece, cx, cz, rng.int(0, 3) * HALF_PI);
    occ.add(cx, cz, KIND[centerpiece].footRadius + 1.2);

    // Keep the paths clear.
    const along = (x0: number, z0: number, x1: number, z1: number) => {
      const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2);
      for (let i = 0; i <= steps; i++) occ.add(x0 + ((x1 - x0) * i) / steps, z0 + ((z1 - z0) * i) / steps, pathWidth / 2);
    };
    along(inner.x0, cz, inner.x1, cz);
    along(cx, inner.z0, cx, inner.z1);

    // Benches along the paths.
    for (let s = inner.x0 + 4; s < inner.x1 - 4; s += 7) {
      if (Math.abs(s - cx) < 5) continue;
      for (const side of [-1, 1]) {
        const z = cz + side * (pathWidth / 2 + 0.7);
        if (rng.chance(0.6) && occ.fits(s, z, 0.9)) {
          this.place("bench", s, z, side > 0 ? 0 : Math.PI);
          occ.add(s, z, 0.9);
        }
      }
    }

    this.scatter(inner, occ, [[this.theme.parkTree, 5], ...this.theme.parkProps], 70, 0.5);

    // An inner walking loop around the centerpiece.
    const ring = 7;
    this.walkRoutes.push({ x0: cx - ring, z0: cz - ring, x1: cx + ring, z1: cz + ring, perimeter: ring * 8 });
    const route = this.walkRoutes.length - 1;
    for (let i = 0; i < 4; i++) {
      this.place("person", 0, 0, 0, {
        type: "walker",
        route,
        distance: rng.range(0, ring * 8),
        direction: rng.sign(),
        speed: rng.range(0.9, 1.5),
        lateral: rng.range(-0.5, 0.5),
      });
    }
  }

  private parkCars(rect: Rect, occ: Occupancy) {
    const rng = this.rng;
    const rowSpacing = 6.5;
    const stall = 2.8;
    for (let z = rect.z0 + 2.6; z < rect.z1 - 2; z += rowSpacing) {
      for (let x = rect.x0 + 1.8; x < rect.x1 - 1.2; x += stall) {
        if (!rng.chance(0.72)) continue;
        const kind = rng.weighted<ObjectKindId>([["car", 6], ["taxi", 1], ["van", 1.5]]);
        if (occ.fits(x, z, 1.1)) {
          this.place(kind, x, z, HALF_PI + (rng.chance(0.5) ? Math.PI : 0) + rng.range(-0.05, 0.05));
          occ.add(x, z, 1.1);
        }
      }
    }
  }

  private fillParking(block: CityBlock, inner: Rect, occ: Occupancy) {
    block.lots.push(inner);
    this.parkCars(inner, occ);
    this.scatter(inner, occ, [["kiosk", 1], ["lampPost", 2], ["cone", 3], ["trashCan", 1]], 10);
  }

  private fillPlaza(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const cx = (inner.x0 + inner.x1) / 2;
    const cz = (inner.z0 + inner.z1) / 2;

    const centerpiece: ObjectKindId = rng.chance(0.5) ? "fountain" : "statue";
    this.place(centerpiece, cx, cz, rng.int(0, 3) * HALF_PI);
    occ.add(cx, cz, KIND[centerpiece].footRadius + 1);

    // Ring of benches and planters.
    const ringR = 7.5;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const x = cx + Math.cos(a) * ringR;
      const z = cz + Math.sin(a) * ringR;
      const kind: ObjectKindId = (Math.round(a / (Math.PI / 6)) % 2 === 0) ? "bench" : "flowerPot";
      if (occ.fits(x, z, 0.8)) {
        this.place(kind, x, z, -a + HALF_PI);
        occ.add(x, z, 0.8);
      }
    }

    // Billboards in corners.
    for (const [x, z] of [[inner.x0 + 5, inner.z0 + 2], [inner.x1 - 5, inner.z1 - 2]] as const) {
      if (rng.chance(0.6) && occ.fits(x, z, 3.5)) {
        this.place("billboard", x, z, faceNearestEdge(block, x, z));
        occ.add(x, z, 3.5);
      }
    }

    this.scatter(inner, occ, [["kiosk", 1.5], ["phoneBooth", 1], ["newsStand", 1], ["flowerPot", 2], [this.theme.parkTree, 2], ["trashCan", 1], ["bicycle", 1]], 40, 0.8);
  }

  private fillBeach(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    for (let x = inner.x0 + 2.5; x < inner.x1 - 2; x += 5.5) {
      for (let z = inner.z0 + 2.5; z < inner.z1 - 2; z += 6) {
        if (!rng.chance(0.65)) continue;
        const ux = x + rng.range(-0.6, 0.6);
        const uz = z + rng.range(-0.6, 0.6);
        if (!occ.fits(ux, uz, 1.4)) continue;
        this.place("beachUmbrella", ux, uz, rng.range(0, Math.PI * 2));
        occ.add(ux, uz, 1.3);
        for (const side of [-1, 1]) {
          const cx = ux + side * 1.2;
          const cz = uz + 1.9;
          if (occ.fits(cx, cz, 0.6)) {
            this.place("deckChair", cx, cz, rng.range(-0.2, 0.2));
            occ.add(cx, cz, 0.6);
          }
        }
      }
    }
    const tx = inner.x0 + (inner.x1 - inner.x0) * rng.range(0.3, 0.7);
    const tz = inner.z0 + 2.5;
    if (occ.fits(tx, tz, 2)) {
      this.place("lifeguardTower", tx, tz, 0);
      occ.add(tx, tz, 2);
    }
    this.scatter(inner, occ, [["palmTree", 3], ["kiosk", 1], ["rock", 1]], 20, 0.6);
  }

  // ---------------------------------------------------------------------------
  // Traffic
  // ---------------------------------------------------------------------------

  private spawnTraffic(roadXs: number[], roadZs: number[]) {
    const rng = this.rng;
    const segments = 2 * roadXs.length * (roadZs.length - 1);
    const count = Math.round(segments * this.theme.trafficDensity);
    const spawned: { x: number; z: number }[] = [];

    for (let attempt = 0; attempt < count * 4 && spawned.length < count; attempt++) {
      const dir = rng.int(0, 3) as Direction;
      const horizontal = dir === 0 || dir === 2;
      const nodeX = horizontal ? rng.int(dir === 0 ? 0 : 1, dir === 0 ? roadXs.length - 2 : roadXs.length - 1) : rng.int(0, roadXs.length - 1);
      const nodeZ = horizontal ? rng.int(0, roadZs.length - 1) : rng.int(dir === 1 ? 0 : 1, dir === 1 ? roadZs.length - 2 : roadZs.length - 1);
      const progress = rng.range(0.1, 0.9);

      // Approximate world position for spacing checks.
      const ax = roadXs[nodeX];
      const az = roadZs[nodeZ];
      const bx = horizontal ? roadXs[nodeX + (dir === 0 ? 1 : -1)] : ax;
      const bz = horizontal ? az : roadZs[nodeZ + (dir === 1 ? 1 : -1)];
      const x = ax + (bx - ax) * progress;
      const z = az + (bz - az) * progress;
      if (spawned.some((p) => Math.abs(p.x - x) + Math.abs(p.z - z) < 12)) continue;
      spawned.push({ x, z });

      const kind = rng.weighted(this.theme.vehicles);
      const baseSpeed = kind === "bus" || kind === "truck" ? 6.5 : 8.5;
      this.place(kind, x, z, 0, {
        type: "car",
        nodeX,
        nodeZ,
        dir,
        progress,
        speed: baseSpeed * rng.range(0.85, 1.15),
      });
    }
  }
}

export const generateCity = (themeId: ThemeId, blocksPerSide: number, seed: number) =>
  new CityGenerator(themeId, blocksPerSide, seed).generate();
