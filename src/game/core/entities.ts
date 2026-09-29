import { Quaternion, Vector3 } from "three";
import { HOLE, holeRadiusForScore, holeSpeedForRadius, sizeLevelForScore } from "../config/constants";
import type { ObjectKind, ObjectKindId } from "../config/objectCatalog";
import type { SkinId } from "../config/skins";
import type { GridItem } from "./SpatialGrid";
import type { ValueItem } from "./ValueField";
import type { CarMover, WalkerMover } from "./traffic";
import type { World } from "./World";

export type ObjectPhase = "standing" | "falling" | "gone";

export interface FallState {
  hole: Hole;
  /** Offset from the hole center; falling objects travel with their hole. */
  ox: number;
  oz: number;
  y: number;
  vx: number;
  vy: number;
  vz: number;
  axisX: number;
  axisZ: number;
  angle: number;
  angularVelocity: number;
  spin: number;
  sunk: boolean;
  time: number;
}

const UP = new Vector3(0, 1, 0);
const tmpAxis = new Vector3();
const tmpVec = new Vector3();
const tmpYaw = new Quaternion();
const tmpTilt = new Quaternion();

export class CityObject implements GridItem, ValueItem {
  /** Render transform: center of the object and its orientation. */
  readonly position = new Vector3();
  readonly quaternion = new Quaternion();

  phase: ObjectPhase = "standing";
  visible = true;
  dirty = false;

  cell = -1;
  cellSlot = -1;
  valueCell = -1;

  /** Lean toward (or tremble next to) a nearby hole. */
  tilt = 0;
  tiltTarget = 0;
  tiltDirX = 1;
  tiltDirZ = 0;
  touched = false;
  leaning = false;
  /** Vertical offset used for walking bob. */
  bob = 0;

  fall: FallState | null = null;
  mover: CarMover | WalkerMover | null = null;

  constructor(
    readonly id: number,
    readonly kind: ObjectKind,
    /** Stable per-object random value (colors, variants). */
    readonly seed: number,
    public x: number,
    public z: number,
    public rotY: number,
  ) {
    this.writeStandingTransform();
  }

  /** Position/orientation for an upright object, pivoting any tilt around its base. */
  writeStandingTransform() {
    const halfHeight = this.kind.height / 2;
    tmpYaw.setFromAxisAngle(UP, this.rotY);
    if (this.tilt > 1e-4) {
      tmpAxis.set(this.tiltDirZ, 0, -this.tiltDirX);
      tmpTilt.setFromAxisAngle(tmpAxis, this.tilt);
      this.quaternion.multiplyQuaternions(tmpTilt, tmpYaw);
      tmpVec.set(0, halfHeight, 0).applyQuaternion(tmpTilt);
      this.position.set(this.x + tmpVec.x, tmpVec.y + this.bob, this.z + tmpVec.z);
    } else {
      this.quaternion.copy(tmpYaw);
      this.position.set(this.x, halfHeight + this.bob, this.z);
    }
  }

  writeFallingTransform() {
    const f = this.fall!;
    tmpYaw.setFromAxisAngle(UP, this.rotY);
    tmpAxis.set(f.axisX, 0, f.axisZ);
    tmpTilt.setFromAxisAngle(tmpAxis, f.angle);
    this.quaternion.multiplyQuaternions(tmpTilt, tmpYaw);
    this.position.set(f.hole.x + f.ox, f.y, f.hole.z + f.oz);
  }
}

export interface HoleInput {
  x: number;
  z: number;
  /** 0..1 fraction of top speed. */
  throttle: number;
}

export interface HoleController {
  update(world: World, hole: Hole, dt: number): void;
}

export class Hole {
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  radius: number = HOLE.startRadius;
  score = 0;
  /** Points earned from city objects only (used for solo % progress). */
  objectScore = 0;
  sizeLevel = 1;

  alive = true;
  eliminated = false;
  eliminatedAt = 0;
  respawnTimer = 0;
  protection: number = HOLE.spawnProtection;

  kills = 0;
  deaths = 0;
  objectsEaten = 0;
  combo = 0;
  bestCombo = 0;
  lastEatTime = -10;
  biggestBite: ObjectKindId | null = null;
  private biggestBiteValue = 0;
  /** Id of the hole that last swallowed this one. */
  eatenBy = -1;

  readonly input: HoleInput = { x: 0, z: 0, throttle: 0 };

  constructor(
    readonly id: number,
    readonly name: string,
    public skinId: SkinId,
    readonly isPlayer: boolean,
    public controller: HoleController | null,
  ) {}

  get targetRadius() {
    return holeRadiusForScore(this.score);
  }

  get speed() {
    return holeSpeedForRadius(this.radius);
  }

  get isProtected() {
    return this.protection > 0;
  }

  get sizeProgress() {
    return sizeLevelForScore(this.score);
  }

  recordBite(kind: ObjectKind) {
    if (kind.value > this.biggestBiteValue) {
      this.biggestBiteValue = kind.value;
      this.biggestBite = kind.id;
    }
  }

  /** True when this hole is big enough to swallow `other`. */
  canEat(other: Hole) {
    return this.radius > other.radius * HOLE.eatRatio;
  }
}
