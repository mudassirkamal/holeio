import { CITY } from "../config/constants";
import type { CarSpawn, CityLayout, Direction, WalkRoute, WalkerSpawn } from "./cityGenerator";
import type { CityObject } from "./entities";
import type { Rng } from "./rng";

const DIR_X = [1, 0, -1, 0] as const;
const DIR_Z = [0, 1, 0, -1] as const;
const reverse = (d: Direction) => ((d + 2) % 4) as Direction;

interface Curve {
  p0x: number;
  p0z: number;
  p1x: number;
  p1z: number;
  p2x: number;
  p2z: number;
  length: number;
}

/** Road network helper: lane geometry and valid turns on the grid of roads. */
export class RoadNetwork {
  private readonly half = CITY.roadWidth / 2;

  constructor(
    readonly xs: readonly number[],
    readonly zs: readonly number[],
  ) {}

  hasNeighbour(nx: number, nz: number, dir: Direction) {
    const tx = nx + DIR_X[dir];
    const tz = nz + DIR_Z[dir];
    return tx >= 0 && tz >= 0 && tx < this.xs.length && tz < this.zs.length;
  }

  /** A point on the right-hand lane for `dir`, `along` meters past the node center. */
  lanePoint(nx: number, nz: number, dir: Direction, along: number): [number, number] {
    const cx = this.xs[nx];
    const cz = this.zs[nz];
    const lane = CITY.laneOffset;
    switch (dir) {
      case 0:
        return [cx + along, cz + lane];
      case 1:
        return [cx - lane, cz + along];
      case 2:
        return [cx - along, cz - lane];
      default:
        return [cx + lane, cz - along];
    }
  }

  roadCurve(nx: number, nz: number, dir: Direction): Curve {
    const [ax, az] = this.lanePoint(nx, nz, dir, this.half);
    const [bx, bz] = this.lanePoint(nx + DIR_X[dir], nz + DIR_Z[dir], dir, -this.half);
    return makeCurve(ax, az, (ax + bx) / 2, (az + bz) / 2, bx, bz);
  }

  turnCurve(nx: number, nz: number, from: Direction, to: Direction): Curve {
    const [ax, az] = this.lanePoint(nx, nz, from, -this.half);
    const [bx, bz] = this.lanePoint(nx, nz, to, this.half);
    if (from === to) return makeCurve(ax, az, (ax + bx) / 2, (az + bz) / 2, bx, bz);
    const horizontal = from === 0 || from === 2;
    const cx = horizontal ? bx : ax;
    const cz = horizontal ? az : bz;
    return makeCurve(ax, az, cx, cz, bx, bz);
  }

  chooseTurn(nx: number, nz: number, from: Direction, rng: Rng): Direction {
    const options: Direction[] = [];
    for (const d of [0, 1, 2, 3] as Direction[]) {
      if (d === reverse(from) || !this.hasNeighbour(nx, nz, d)) continue;
      // Going straight is more common than turning.
      options.push(d);
      if (d === from) options.push(d, d);
    }
    return options.length ? rng.pick(options) : reverse(from);
  }
}

function makeCurve(p0x: number, p0z: number, p1x: number, p1z: number, p2x: number, p2z: number): Curve {
  const chord = Math.hypot(p2x - p0x, p2z - p0z);
  const control = Math.hypot(p1x - p0x, p1z - p0z) + Math.hypot(p2x - p1x, p2z - p1z);
  return { p0x, p0z, p1x, p1z, p2x, p2z, length: Math.max(0.1, (chord + control) / 2) };
}

/** Compact, serializable car state (sent to clients to correct drift). */
export type CarState = [nodeX: number, nodeZ: number, dir: number, nextDir: number, turning: number, t: number, speed: number, rng: number];

export class CarMover {
  readonly type = "car";
  readonly cruiseSpeed: number;
  readonly halfLength: number;
  speed: number;
  headingX = 1;
  headingZ = 0;
  private nodeX: number;
  private nodeZ: number;
  private dir: Direction;
  private nextDir: Direction;
  private curve: Curve;
  private t: number;
  private turning = false;
  private stuckTime = 0;

  constructor(
    private readonly roads: RoadNetwork,
    spawn: CarSpawn,
    length: number,
    /** Each car owns its random stream so its route is identical on every peer. */
    private readonly rng: Rng,
  ) {
    this.nodeX = spawn.nodeX;
    this.nodeZ = spawn.nodeZ;
    this.dir = spawn.dir;
    this.nextDir = spawn.dir;
    this.curve = roads.roadCurve(spawn.nodeX, spawn.nodeZ, spawn.dir);
    this.t = spawn.progress;
    this.cruiseSpeed = spawn.speed;
    this.speed = spawn.speed;
    this.halfLength = length / 2;
  }

  private advanceSegment() {
    if (this.turning) {
      this.turning = false;
      this.dir = this.nextDir;
      this.curve = this.roads.roadCurve(this.nodeX, this.nodeZ, this.dir);
    } else {
      this.nodeX += DIR_X[this.dir];
      this.nodeZ += DIR_Z[this.dir];
      this.nextDir = this.roads.chooseTurn(this.nodeX, this.nodeZ, this.dir, this.rng);
      this.curve = this.roads.turnCurve(this.nodeX, this.nodeZ, this.dir, this.nextDir);
      this.turning = true;
    }
  }

  getState(): CarState {
    return [this.nodeX, this.nodeZ, this.dir, this.nextDir, this.turning ? 1 : 0, Math.round(this.t * 1e4) / 1e4, Math.round(this.speed * 100) / 100, this.rng.state];
  }

  setState(obj: CityObject, [nodeX, nodeZ, dir, nextDir, turning, t, speed, rng]: CarState) {
    this.nodeX = nodeX;
    this.nodeZ = nodeZ;
    this.dir = dir as Direction;
    this.nextDir = nextDir as Direction;
    this.turning = turning === 1;
    this.curve = this.turning
      ? this.roads.turnCurve(nodeX, nodeZ, this.dir, this.nextDir)
      : this.roads.roadCurve(nodeX, nodeZ, this.dir);
    this.t = t;
    this.speed = speed;
    this.rng.state = rng;
    this.writePosition(obj);
  }

  update(obj: CityObject, cars: readonly CityObject[], dt: number) {
    // Brake for cars ahead travelling the same way.
    let targetSpeed = this.turning && this.nextDir !== this.dir ? this.cruiseSpeed * 0.6 : this.cruiseSpeed;
    if (this.stuckTime < 3) {
      for (const other of cars) {
        if (other === obj || other.phase !== "standing") continue;
        const m = other.mover as CarMover;
        if (m.headingX * this.headingX + m.headingZ * this.headingZ < 0.5) continue;
        const dx = other.x - obj.x;
        const dz = other.z - obj.z;
        const ahead = dx * this.headingX + dz * this.headingZ;
        if (ahead <= 0) continue;
        const gap = ahead - this.halfLength - m.halfLength;
        if (gap > 6) continue;
        const lateral = Math.abs(dx * -this.headingZ + dz * this.headingX);
        if (lateral > 1.8) continue;
        targetSpeed = Math.min(targetSpeed, Math.max(0, (gap - 1.2) * 1.6));
      }
    }
    this.stuckTime = targetSpeed < 0.2 ? this.stuckTime + dt : Math.max(0, this.stuckTime - dt * 2);
    if (this.stuckTime > 4) this.stuckTime = 0;

    const accel = targetSpeed < this.speed ? 14 : 4;
    this.speed += Math.sign(targetSpeed - this.speed) * Math.min(Math.abs(targetSpeed - this.speed), accel * dt);

    this.t += (this.speed * dt) / this.curve.length;
    while (this.t >= 1) {
      const overflow = (this.t - 1) * this.curve.length;
      this.advanceSegment();
      this.t = overflow / this.curve.length;
    }
    this.writePosition(obj);
  }

  private writePosition(obj: CityObject) {
    const { p0x, p0z, p1x, p1z, p2x, p2z } = this.curve;
    const t = this.t;
    const u = 1 - t;
    obj.x = u * u * p0x + 2 * u * t * p1x + t * t * p2x;
    obj.z = u * u * p0z + 2 * u * t * p1z + t * t * p2z;
    const tx = 2 * u * (p1x - p0x) + 2 * t * (p2x - p1x);
    const tz = 2 * u * (p1z - p0z) + 2 * t * (p2z - p1z);
    const len = Math.hypot(tx, tz) || 1;
    this.headingX = tx / len;
    this.headingZ = tz / len;
    // Vehicle models face local +X.
    obj.rotY = Math.atan2(-this.headingZ, this.headingX);
  }
}

export class WalkerMover {
  readonly type = "walker";
  private readonly direction: 1 | -1;
  private readonly speed: number;
  private readonly lateral: number;
  private distance: number;
  private phase: number;

  constructor(
    private readonly route: WalkRoute,
    spawn: WalkerSpawn,
  ) {
    this.direction = spawn.direction;
    this.speed = spawn.speed;
    this.lateral = spawn.lateral;
    this.distance = spawn.distance;
    this.phase = spawn.distance * 3.1;
  }

  getState() {
    return Math.round(this.distance * 100) / 100;
  }

  setState(obj: CityObject, distance: number) {
    this.distance = distance;
    this.update(obj, 0);
  }

  update(obj: CityObject, dt: number) {
    const r = this.route;
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    this.distance = (((this.distance + this.speed * this.direction * dt) % r.perimeter) + r.perimeter) % r.perimeter;
    this.phase += this.speed * dt * 5.5;

    let s = this.distance;
    let x: number, z: number, hx: number, hz: number;
    if (s < w) {
      x = r.x0 + s; z = r.z0; hx = 1; hz = 0;
    } else if ((s -= w) < d) {
      x = r.x1; z = r.z0 + s; hx = 0; hz = 1;
    } else if ((s -= d) < w) {
      x = r.x1 - s; z = r.z1; hx = -1; hz = 0;
    } else {
      s -= w;
      x = r.x0; z = r.z1 - s; hx = 0; hz = -1;
    }
    // Inward normal for a clockwise loop is (-hz, hx).
    obj.x = x - hz * this.lateral;
    obj.z = z + hx * this.lateral;
    hx *= this.direction;
    hz *= this.direction;
    obj.rotY = Math.atan2(hx, hz) + Math.sin(this.phase) * 0.08;
    obj.bob = Math.abs(Math.sin(this.phase)) * 0.07;
  }
}

export const createRoadNetwork = (layout: CityLayout) => new RoadNetwork(layout.roadXs, layout.roadZs);
