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
  /** Walkable path segments inside parks/plazas (and runways), used for ground painting. */
  paths: { ax: number; az: number; bx: number; bz: number; width: number }[];
  /** Round ponds, oasis water and lava pools, used for ground painting. */
  pools: { x: number; z: number; r: number }[];
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
  /** Half extents of the map along X and Z; `half` is the larger of the two. */
  halfX: number;
  halfZ: number;
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
    const avgBlock = this.theme.blockSize ?? 44;
    const [shapeX, shapeZ] = this.theme.shape;
    const nx = Math.max(2, Math.round(this.blocksPerSide * shapeX));
    const nz = Math.max(2, Math.round(this.blocksPerSide * shapeZ));
    const halfX = (nx * avgBlock + (nx + 1) * roadWidth) / 2;
    const halfZ = (nz * avgBlock + (nz + 1) * roadWidth) / 2;

    const roadXs = this.roadPositions(halfX, nx);
    const roadZs = this.roadPositions(halfZ, nz);

    const blocks: CityBlock[] = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const rect: Rect = {
          x0: roadXs[i] + roadWidth / 2,
          x1: roadXs[i + 1] - roadWidth / 2,
          z0: roadZs[j] + roadWidth / 2,
          z1: roadZs[j + 1] - roadWidth / 2,
        };
        const centerDistance = Math.hypot(
          (rect.x0 + rect.x1) / 2 / halfX,
          (rect.z0 + rect.z1) / 2 / halfZ,
        );
        const zone = this.rng.weighted(centerDistance < 0.45 ? this.theme.centerZones : this.theme.zones);
        blocks.push({ ...rect, zone, lots: [], paths: [], pools: [] });
      }
    }

    for (const block of blocks) this.fillBlock(block);
    this.spawnTraffic(roadXs, roadZs);

    return {
      themeId: this.themeId,
      halfX,
      halfZ,
      half: Math.max(halfX, halfZ),
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
      case "dunes":
        this.fillDunes(block, inner, occ);
        break;
      case "oasis":
        this.fillOasis(block, inner, occ);
        break;
      case "market":
        this.fillMarket(block, inner, occ);
        break;
      case "garden":
        this.fillGarden(block, inner, occ);
        break;
      case "docks":
        this.fillDocks(block, inner, occ);
        break;
      case "farm":
        this.fillFarm(block, inner, occ);
        break;
      case "sweets":
        this.fillSweets(block, inner, occ);
        break;
      case "lava":
        this.fillLava(block, inner, occ);
        break;
      case "fairground":
        this.fillFairground(block, inner, occ);
        break;
      case "airfield":
        this.fillAirfield(block, inner, occ);
        break;
      case "base":
        this.fillBase(block, inner, occ);
        break;
      case "ruins":
        this.fillRuins(block, inner, occ);
        break;
      case "keep":
        this.fillKeep(block, inner, occ);
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
    for (const idx of this.theme.trafficLights === false ? [] : rng.chance(0.5) ? [0, 2] : [1, 3]) {
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
        const options = this.theme.shops ?? (roll < 0.3 ? (["gasStation", "shop"] as const) : (["shop", "apartment", "kiosk"] as const));
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
      const placed = this.placeBuilding(block, lot, this.theme.homes ?? ["house", "houseSmall"], occ);
      if (placed) {
        this.scatter(lot, occ, [[this.theme.parkTree, 2], ["bush", 3], ["mailbox", 1], ["flowerPot", 1], ["bicycle", 0.5]], 6, 0.3);
      }
    }
    if (this.theme.snowy) this.scatter(inner, occ, [["snowman", 1]], 6);
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
    this.reserveLine(occ, inner.x0, cz, inner.x1, cz, pathWidth);
    this.reserveLine(occ, cx, inner.z0, cx, inner.z1, pathWidth);

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
  // Themed worlds
  // ---------------------------------------------------------------------------

  /**
   * Places a landmark in the middle of the block when there is room for it
   * (blocks vary in size, so the biggest landmarks only appear on the bigger ones).
   */
  private centerpiece(block: CityBlock, inner: Rect, occ: Occupancy, kind: ObjectKindId, rot = this.rng.int(0, 3) * HALF_PI) {
    const k = KIND[kind];
    const sideways = Math.abs(Math.sin(rot)) > 0.5;
    const w = sideways ? k.depth : k.width;
    const d = sideways ? k.width : k.depth;
    if (inner.x1 - inner.x0 < w + 3 || inner.z1 - inner.z0 < d + 3) return false;
    const cx = (inner.x0 + inner.x1) / 2;
    const cz = (inner.z0 + inner.z1) / 2;
    this.place(kind, cx, cz, rot);
    occ.add(cx, cz, k.footRadius * 0.92 + 0.6);
    block.lots.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    return true;
  }

  /** The first of `kinds` that fits becomes the block's centerpiece. */
  private firstCenterpiece(block: CityBlock, inner: Rect, occ: Occupancy, kinds: readonly ObjectKindId[]) {
    return kinds.some((kind) => this.centerpiece(block, inner, occ, kind));
  }

  /** Places an object if the spot is free. */
  private tryPlace(occ: Occupancy, kind: ObjectKindId, x: number, z: number, rot: number, radius = KIND[kind].footRadius * 0.85 + 0.2) {
    if (!occ.fits(x, z, radius)) return false;
    this.place(kind, x, z, rot);
    occ.add(x, z, radius);
    return true;
  }

  /** Objects evenly spaced on a circle, facing outward. */
  private ringOf(occ: Occupancy, kind: ObjectKindId, cx: number, cz: number, radius: number, count: number, chance = 1) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      if (this.rng.chance(chance)) this.tryPlace(occ, kind, cx + Math.cos(a) * radius, cz + Math.sin(a) * radius, -a + HALF_PI);
    }
  }

  /** Keeps a straight strip (a path, a runway) free of objects. */
  private reserveLine(occ: Occupancy, x0: number, z0: number, x1: number, z1: number, width: number) {
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (width * 0.8));
    for (let i = 0; i <= steps; i++) occ.add(x0 + ((x1 - x0) * i) / steps, z0 + ((z1 - z0) * i) / steps, width / 2);
  }

  /** A painted pond or lava pool that nothing stands in. */
  private addPool(block: CityBlock, occ: Occupancy, x: number, z: number, r: number) {
    block.pools.push({ x, z, r });
    occ.add(x, z, r + 0.4);
  }

  private fillDunes(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const cx = (inner.x0 + inner.x1) / 2;
    const cz = (inner.z0 + inner.z1) / 2;
    if (!(rng.chance(0.4) && this.centerpiece(block, inner, occ, "pyramid", 0))) {
      // A nomad camp around a well.
      this.tryPlace(occ, "well", cx, cz, 0);
      this.ringOf(occ, "tent", cx, cz, 7.5, 5, 0.8);
      this.ringOf(occ, "camel", cx, cz, 12, 6, 0.5);
    }
    this.scatter(inner, occ, [["cactus", 4], ["rock", 3], ["camel", 1], ["palmTree", 0.6], ["barrel", 0.6], ["tent", 0.4]], 45, 0.6);
  }

  private fillOasis(block: CityBlock, inner: Rect, occ: Occupancy) {
    const cx = (inner.x0 + inner.x1) / 2;
    const cz = (inner.z0 + inner.z1) / 2;
    const r = Math.min(inner.x1 - inner.x0, inner.z1 - inner.z0) * 0.22;
    this.addPool(block, occ, cx, cz, r);
    this.ringOf(occ, "palmTree", cx, cz, r + 2.2, 12, 0.8);
    this.ringOf(occ, "tent", cx, cz, r + 7.5, 6, 0.55);
    this.scatter(inner, occ, [["palmTree", 3], ["bush", 3], ["rock", 2], ["camel", 1], ["well", 0.4], ["flowerPot", 1]], 40, 0.5);
  }

  private fillMarket(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const cx = (inner.x0 + inner.x1) / 2;
    const cz = (inner.z0 + inner.z1) / 2;
    this.tryPlace(occ, "well", cx, cz, 0, 2.6);
    // Rows of stalls facing each other across an aisle.
    for (let z = inner.z0 + 2; z < inner.z1 - 2; z += 6.5) {
      const facing = Math.round((z - inner.z0) / 6.5) % 2 === 0 ? 0 : Math.PI;
      for (let x = inner.x0 + 2.2; x < inner.x1 - 2; x += 4.2) {
        if (rng.chance(0.75)) this.tryPlace(occ, "foodStall", x, z, facing);
      }
    }
    this.scatter(inner, occ, [["barrel", 3], ["cart", 2], ["flowerPot", 2], ["bench", 1], ["hayBale", 1]], 30, 0.4);
  }

  private fillGarden(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const cx = (inner.x0 + inner.x1) / 2;
    const cz = (inner.z0 + inner.z1) / 2;
    const pathWidth = 2.6;
    block.paths.push({ ax: block.x0, az: cz, bx: block.x1, bz: cz, width: pathWidth });
    block.paths.push({ ax: cx, az: block.z0, bx: cx, bz: block.z1, width: pathWidth });

    if (!(rng.chance(0.45) && this.centerpiece(block, inner, occ, "pagoda")) && !this.centerpiece(block, inner, occ, "teaHouse", 0)) {
      this.tryPlace(occ, "statue", cx, cz, 0);
    }
    this.reserveLine(occ, inner.x0, cz, inner.x1, cz, pathWidth);
    this.reserveLine(occ, cx, inner.z0, cx, inner.z1, pathWidth);

    // A gate over every entrance and lanterns along the paths.
    this.place("torii", inner.x0 + 1, cz, HALF_PI);
    this.place("torii", inner.x1 - 1, cz, HALF_PI);
    this.place("torii", cx, inner.z0 + 1, 0);
    this.place("torii", cx, inner.z1 - 1, 0);
    for (let s = 5; s < Math.max(inner.x1 - inner.x0, inner.z1 - inner.z0) / 2 - 2; s += 5) {
      for (const side of [-1, 1]) {
        const off = pathWidth / 2 + 0.7;
        this.tryPlace(occ, "stoneLantern", cx + side * s, cz + off, 0);
        this.tryPlace(occ, "stoneLantern", cx + off, cz + side * s, 0);
      }
    }
    // A pond in one corner.
    const qx = rng.sign();
    const qz = rng.sign();
    const pond = Math.min(inner.x1 - inner.x0, inner.z1 - inner.z0) * 0.13;
    this.addPool(block, occ, cx + qx * (inner.x1 - inner.x0) * 0.28, cz + qz * (inner.z1 - inner.z0) * 0.28, pond);
    this.scatter(inner, occ, [[this.theme.parkTree, 6], ...this.theme.parkProps], 70, 0.5);
  }

  private fillDocks(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    block.lots.push(inner);
    if (rng.chance(0.4)) {
      // Warehouses with a loading yard.
      for (const lot of this.lotsOf(inner, 21, 2)) this.placeBuilding(block, lot, ["warehouse", "shop"], occ);
      this.scatter(inner, occ, [["container", 3], ["forklift", 2], ["barrel", 3], ["boat", 1], ["cone", 1]], 26, 0.5);
      return;
    }
    // Container yard: a crane or lighthouse, then rows of boxes with aisles between them.
    const landmark: ObjectKindId = rng.chance(0.25) ? "lighthouse" : "crane";
    const lx = rng.chance(0.5) ? inner.x0 + 5.5 : inner.x1 - 5.5;
    const lz = rng.chance(0.5) ? inner.z0 + 5.5 : inner.z1 - 5.5;
    if (inner.x1 - inner.x0 > 22 && inner.z1 - inner.z0 > 22) this.tryPlace(occ, landmark, lx, lz, rng.int(0, 3) * HALF_PI, 6);
    let row = 0;
    for (let z = inner.z0 + 3.4; z < inner.z1 - 3.2; z += 6.4, row++) {
      if (row % 3 === 2) continue; // aisle
      for (let x = inner.x0 + 3.6; x < inner.x1 - 3.4; x += 7) {
        const roll = rng.next();
        if (roll < 0.2) continue;
        const kind: ObjectKindId = roll < 0.55 ? "containerStack" : "container";
        this.tryPlace(occ, kind, x, z, rng.chance(0.5) ? 0 : Math.PI, 3.1);
      }
    }
    this.scatter(inner, occ, [["forklift", 3], ["barrel", 2], ["cone", 2]], 14, 0.4);
  }

  private fillFarm(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    // Farmyard on one side, crops on the rest.
    const yardWidth = Math.min(17, (inner.x1 - inner.x0) * 0.42);
    const left = rng.chance(0.5);
    const yard: Rect = left ? { ...inner, x1: inner.x0 + yardWidth } : { ...inner, x0: inner.x1 - yardWidth };
    const field: Rect = left ? { ...inner, x0: yard.x1 + 1.5 } : { ...inner, x1: yard.x0 - 1.5 };

    for (const lot of this.lotsOf(yard, 15, 1.5)) {
      if (!this.placeBuilding(block, lot, ["barn", "house", "houseSmall"], occ)) continue;
      this.scatter(lot, occ, [["silo", 1.5], ["tractor", 2], ["hayBale", 3], ["barrel", 1], ["cow", 1]], 7, 0.3);
    }
    const fx = (field.x0 + field.x1) / 2;
    const fz = (field.z0 + field.z1) / 2;
    if (rng.chance(0.4)) this.tryPlace(occ, "windmill", fx, fz, rng.int(0, 3) * HALF_PI, 4);
    let row = 0;
    for (let z = field.z0 + 1.5; z < field.z1 - 1; z += 3.2, row++) {
      const crop: ObjectKindId = row % 3 === 0 ? "hayBale" : "pumpkin";
      const step = crop === "hayBale" ? 4.2 : 1.7;
      for (let x = field.x0 + 1.2; x < field.x1 - 1; x += step) {
        if (rng.chance(crop === "hayBale" ? 0.5 : 0.55)) this.tryPlace(occ, crop, x + rng.range(-0.2, 0.2), z, rng.range(0, Math.PI * 2));
      }
    }
    this.scatter(field, occ, [["scarecrow", 2], ["cow", 3], ["tractor", 0.6]], 9, 0.4);
  }

  private fillSweets(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const cx = (inner.x0 + inner.x1) / 2;
    const cz = (inner.z0 + inner.z1) / 2;
    if (!(rng.chance(0.4) && this.centerpiece(block, inner, occ, "cakeTower"))) {
      this.tryPlace(occ, "cupcake", cx, cz, 0);
      this.ringOf(occ, "cupcake", cx, cz, 8, 4, 0.7);
    }
    this.ringOf(occ, "lollipop", cx, cz, 11.5, 14, 0.8);
    this.scatter(inner, occ, [["lollipop", 4], ["candyCane", 4], ["donut", 1.5], ["iceCreamCone", 2], ["cupcake", 0.8], ["flowerPot", 1], ["bench", 1]], 55, 0.5);
  }

  private fillLava(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    if (rng.chance(0.55)) this.firstCenterpiece(block, inner, occ, rng.chance(0.6) ? ["miniVolcano", "drillRig"] : ["drillRig"]);
    for (let i = 0; i < 4; i++) {
      const r = rng.range(2.6, 5.5);
      const x = rng.range(inner.x0 + r + 1, inner.x1 - r - 1);
      const z = rng.range(inner.z0 + r + 1, inner.z1 - r - 1);
      if (occ.fits(x, z, r + 1)) this.addPool(block, occ, x, z, r);
    }
    this.scatter(inner, occ, [["lavaRock", 5], ["obsidianSpire", 2], ["rock", 2], ["barrel", 0.5]], 50, 0.6);
  }

  private fillFairground(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const rides: ObjectKindId[] = rng.shuffle<ObjectKindId>(["ferrisWheel", "circusTent", "carousel", "dropTower"]);
    this.firstCenterpiece(block, inner, occ, rides);
    // Stalls along two sides, facing the ride.
    for (let x = inner.x0 + 2.4; x < inner.x1 - 2; x += 4.4) {
      if (rng.chance(0.7)) this.tryPlace(occ, "foodStall", x, inner.z0 + 1.6, 0);
      if (rng.chance(0.7)) this.tryPlace(occ, "foodStall", x, inner.z1 - 1.6, Math.PI);
    }
    // A smaller ride in a corner when there is room left.
    const corner: ObjectKindId = rides[0] === "carousel" ? "dropTower" : "carousel";
    this.tryPlace(occ, corner, inner.x0 + 6.5, inner.z0 + 9, 0, KIND[corner].footRadius);
    this.scatter(inner, occ, [["balloonCart", 3], ["bench", 2], ["kiosk", 1], ["trashCan", 1.5], ["flowerPot", 2], ["lampPost", 1.5]], 40, 0.6);
  }

  private fillAirfield(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const alongX = inner.x1 - inner.x0 >= inner.z1 - inner.z0;
    const runway = 9;
    const side = rng.sign();
    block.lots.push(inner);
    // The runway hugs one edge of the block; the rest is split into an apron for
    // parked aircraft and a service area with hangars.
    let rest: Rect;
    if (alongX) {
      const z = side > 0 ? inner.z1 - runway / 2 - 0.5 : inner.z0 + runway / 2 + 0.5;
      block.paths.push({ ax: inner.x0, az: z, bx: inner.x1, bz: z, width: runway });
      this.reserveLine(occ, inner.x0, z, inner.x1, z, runway + 1);
      rest = side > 0 ? { ...inner, z1: z - runway / 2 - 1 } : { ...inner, z0: z + runway / 2 + 1 };
    } else {
      const x = side > 0 ? inner.x1 - runway / 2 - 0.5 : inner.x0 + runway / 2 + 0.5;
      block.paths.push({ ax: x, az: inner.z0, bx: x, bz: inner.z1, width: runway });
      this.reserveLine(occ, x, inner.z0, x, inner.z1, runway + 1);
      rest = side > 0 ? { ...inner, x1: x - runway / 2 - 1 } : { ...inner, x0: x + runway / 2 + 1 };
    }
    const split = 0.5;
    const first = rng.chance(0.5);
    const cut = alongX ? rest.x0 + (rest.x1 - rest.x0) * split : rest.z0 + (rest.z1 - rest.z0) * split;
    const a: Rect = alongX ? { ...rest, x1: cut - 1 } : { ...rest, z1: cut - 1 };
    const b: Rect = alongX ? { ...rest, x0: cut + 1 } : { ...rest, z0: cut + 1 };
    const apron = first ? a : b;
    const service = first ? b : a;

    // Aircraft point at the runway.
    const nose = alongX ? (side > 0 ? -HALF_PI : HALF_PI) : side > 0 ? 0 : Math.PI;
    const jet = KIND.airliner;
    const fits = alongX
      ? apron.x1 - apron.x0 > jet.depth + 1 && apron.z1 - apron.z0 > jet.width + 1
      : apron.x1 - apron.x0 > jet.width + 1 && apron.z1 - apron.z0 > jet.depth + 1;
    if (fits && rng.chance(0.75)) this.tryPlace(occ, "airliner", (apron.x0 + apron.x1) / 2, (apron.z0 + apron.z1) / 2, nose, 13);
    this.scatter(apron, occ, [["smallPlane", 3], ["helicopter", 1.5]], 8, 1.2);
    this.scatter(apron, occ, [["luggageCart", 3], ["cone", 2], ["barrel", 1]], 12, 0.4);

    const options: readonly ObjectKindId[] = rng.chance(0.2) ? ["controlTower", "hangar"] : ["hangar", "shop"];
    for (const lot of this.lotsOf(service, 24, 1.5)) this.placeBuilding(block, lot, options, occ);
    this.scatter(service, occ, [["radar", 1.5], ["luggageCart", 2], ["cone", 2], ["forklift", 1]], 10, 0.5);
  }

  private fillBase(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const cx = (inner.x0 + inner.x1) / 2;
    const cz = (inner.z0 + inner.z1) / 2;
    this.firstCenterpiece(block, inner, occ, rng.chance(0.2) ? ["rocket", "dome"] : ["dome", "satDish"]);
    // Living modules around the centerpiece.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      if (rng.chance(0.7)) this.tryPlace(occ, "habModule", cx + Math.cos(a) * 13, cz + Math.sin(a) * 13, -a + HALF_PI, 4.6);
    }
    // A solar farm in one corner.
    const sx = rng.chance(0.5) ? inner.x0 + 3 : inner.x1 - 13;
    const sz = rng.chance(0.5) ? inner.z0 + 2 : inner.z1 - 10;
    for (let x = 0; x < 3; x++) for (let z = 0; z < 4; z++) this.tryPlace(occ, "solarPanel", sx + x * 5, sz + z * 2.8, 0, 1.3);
    this.scatter(inner, occ, [["rock", 4], ["rover", 2], ["satDish", 1], ["solarPanel", 1], ["barrel", 0.6]], 40, 0.6);
  }

  private fillRuins(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    const cx = (inner.x0 + inner.x1) / 2;
    const cz = (inner.z0 + inner.z1) / 2;
    if (rng.chance(0.3)) {
      // A village in a clearing.
      this.tryPlace(occ, "well", cx, cz, 0);
      this.ringOf(occ, "hut", cx, cz, 9, 6, 0.8);
      this.ringOf(occ, "totem", cx, cz, 4, 4, 0.6);
    } else if (!(rng.chance(0.55) && this.centerpiece(block, inner, occ, "temple", 0))) {
      this.tryPlace(occ, "stoneHead", cx, cz, rng.int(0, 3) * HALF_PI);
      this.ringOf(occ, "ruinPillar", cx, cz, 7, 10, 0.7);
    }
    this.scatter(inner, occ, [[this.theme.parkTree, 5], ["bush", 4], ["rock", 2], ["totem", 1], ["ruinPillar", 1.5], ["stoneHead", 0.4]], 75, 0.5);
  }

  private fillKeep(block: CityBlock, inner: Rect, occ: Occupancy) {
    const rng = this.rng;
    this.firstCenterpiece(block, inner, occ, rng.chance(0.65) ? ["castleKeep", "watchTower"] : ["watchTower"]);
    // Guard towers on two opposite corners of the yard.
    if (inner.x1 - inner.x0 > 34 && inner.z1 - inner.z0 > 34) {
      const flip = rng.chance(0.5);
      this.tryPlace(occ, "watchTower", inner.x0 + 4, flip ? inner.z0 + 4 : inner.z1 - 4, 0, 4);
      this.tryPlace(occ, "watchTower", inner.x1 - 4, flip ? inner.z1 - 4 : inner.z0 + 4, Math.PI, 4);
    }
    this.scatter(inner, occ, [["barrel", 3], ["cart", 2], ["hayBale", 2], ["well", 0.6], ["bench", 1], ["tent", 1], ["foodStall", 0.8]], 40, 0.5);
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
