import { CITY, HOLE, PHYSICS, holeDepthForRadius, sizeLevelForScore } from "../config/constants";
import type { GameMode } from "../config/levels";
import { KIND, MAX_FOOT_RADIUS } from "../config/objectCatalog";
import { POWER_UP_KINDS, POWER_UP_RULES, POWER_UPS, powerIndex, type PowerUpKind } from "../config/powerUps";
import type { SkinId } from "../config/skins";
import type { ThemeId } from "../config/themes";
import { generateCity, type CityLayout } from "./cityGenerator";
import { CityObject, Hole, type HoleController } from "./entities";
import type { GameEvent } from "./events";
import { clamp, damp } from "./math";
import { Rng } from "./rng";
import { SpatialGrid } from "./SpatialGrid";
import { CarMover, WalkerMover, createRoadNetwork } from "./traffic";
import { ValueField } from "./ValueField";

export interface HoleSetup {
  name: string;
  skinId: SkinId;
  isPlayer: boolean;
  controller: HoleController | null;
  /** Team index (team mode only). */
  team?: number;
}

export interface MatchSetup {
  seed: number;
  themeId: ThemeId;
  mode: GameMode;
  duration: number;
  blocksPerSide: number;
  holes: HoleSetup[];
  /**
   * Network client mode: the host is authoritative for holes, scores and swallowing.
   * A replica only animates traffic, leaning and falls (see `replicateFall`).
   */
  replica?: boolean;
  /** Spawn power-up pickups around the city. */
  powerUps?: boolean;
}

export interface PowerUp {
  id: number;
  kind: PowerUpKind;
  x: number;
  z: number;
  bornAt: number;
}

export interface Standing {
  hole: Hole;
  rank: number;
}

const LEAN_EDIBLE = 0.32;
const LEAN_BLOCKED = 0.045;

export class World {
  readonly layout: CityLayout;
  readonly half: number;
  readonly mode: GameMode;
  readonly duration: number;
  readonly rng: Rng;
  readonly replica: boolean;

  readonly objects: CityObject[] = [];
  readonly holes: Hole[] = [];
  readonly powerUps: PowerUp[] = [];
  readonly grid: SpatialGrid<CityObject>;
  readonly valueField: ValueField;
  readonly totalValue: number;

  time = 0;
  /** Holes only move while running (the countdown freezes them). */
  running = false;
  finished = false;
  events: GameEvent[] = [];

  private readonly cars: CityObject[] = [];
  private readonly walkers: CityObject[] = [];
  private readonly falling: CityObject[] = [];
  private readonly leaning: CityObject[] = [];
  private dirty: CityObject[] = [];
  private readonly powerUpsEnabled: boolean;
  private nextPowerUpAt: number = POWER_UP_RULES.firstSpawn;
  private nextPowerUpId = 0;

  constructor(setup: MatchSetup) {
    this.rng = new Rng(setup.seed * 7919 + 17);
    this.mode = setup.mode;
    this.duration = setup.duration;
    this.replica = setup.replica ?? false;
    this.powerUpsEnabled = setup.powerUps ?? false;
    this.layout = generateCity(setup.themeId, setup.blocksPerSide, setup.seed);
    this.half = this.layout.half;
    this.grid = new SpatialGrid(this.half, CITY.cellSize);
    this.valueField = new ValueField(this.half, CITY.valueCellSize);

    this.spawnObjects(setup.seed);
    this.totalValue = this.objects.reduce((sum, o) => sum + o.kind.value, 0);

    setup.holes.forEach((h, i) => {
      const hole = new Hole(i, h.name, h.skinId, h.isPlayer, h.controller);
      if (this.mode === "teams") hole.team = h.team ?? i % 2;
      this.holes.push(hole);
      this.placeHole(hole);
      hole.protection = 0;
    });
  }

  get timeLeft() {
    return Math.max(0, this.duration - this.time);
  }

  get player() {
    return this.holes.find((h) => h.isPlayer) ?? null;
  }

  private spawnObjects(seed: number) {
    const roads = createRoadNetwork(this.layout);
    this.layout.objects.forEach((placed, id) => {
      const kind = KIND[placed.kind];
      const obj = new CityObject(id, kind, placed.seed, placed.x, placed.z, placed.rotY);
      if (placed.spawn?.type === "car") {
        obj.mover = new CarMover(roads, placed.spawn, kind.width, new Rng(seed * 131 + id * 7 + 1));
        this.cars.push(obj);
      } else if (placed.spawn?.type === "walker") {
        obj.mover = new WalkerMover(this.layout.walkRoutes[placed.spawn.route], placed.spawn);
        this.walkers.push(obj);
      }
      this.objects.push(obj);
    });

    // Resolve initial mover positions before indexing.
    for (const car of this.cars) (car.mover as CarMover).update(car, this.cars, 0);
    for (const w of this.walkers) (w.mover as WalkerMover).update(w, 0);

    for (const obj of this.objects) {
      obj.writeStandingTransform();
      this.grid.insert(obj);
      this.valueField.add(obj);
    }
  }

  /** Picks a spawn point away from bigger holes. */
  private placeHole(hole: Hole) {
    const margin = this.half * 0.85;
    let best = { x: 0, z: 0, score: -Infinity };
    for (let i = 0; i < 28; i++) {
      const x = this.rng.range(-margin, margin);
      const z = this.rng.range(-margin, margin);
      let score = Infinity;
      for (const other of this.holes) {
        if (other === hole || !other.alive) continue;
        const threat = other.radius >= hole.radius ? 1 + other.radius * 0.15 : 0.6;
        score = Math.min(score, Math.hypot(other.x - x, other.z - z) / threat);
      }
      if (score > best.score) best = { x, z, score };
    }
    hole.x = best.x;
    hole.z = best.z;
    hole.vx = 0;
    hole.vz = 0;
    hole.radius = hole.targetRadius;
    hole.alive = true;
    hole.protection = HOLE.spawnProtection;
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  step(dt: number) {
    if (this.finished) return;
    if (this.replica) {
      this.stepReplica(dt);
      return;
    }

    if (this.running) {
      this.time += dt;
      for (const hole of this.holes) {
        if (!hole.alive) continue;
        hole.controller?.update(this, hole, dt);
        this.moveHole(hole, dt);
      }
    }

    this.updateMovers(dt);

    if (this.running) {
      for (const hole of this.holes) if (hole.alive) this.interact(hole, true);
    }

    this.updateFalling(dt);
    this.updateLeaning(dt);

    if (this.running) {
      this.updateHoles(dt);
      if (this.powerUpsEnabled) this.updatePowerUps();
      this.resolveHoleCollisions();
      this.checkEnd();
    }
  }

  /** Client-side step: holes are positioned from the network; only visuals simulate. */
  private stepReplica(dt: number) {
    this.updateMovers(dt);
    for (const hole of this.holes) if (hole.alive) this.interact(hole, false);
    this.updateFalling(dt);
    this.updateLeaning(dt);
  }

  private markDirty(obj: CityObject) {
    if (!obj.dirty) {
      obj.dirty = true;
      this.dirty.push(obj);
    }
  }

  /** Hands every object whose transform changed since the last call to `fn`. */
  drainDirty(fn: (obj: CityObject) => void) {
    const list = this.dirty;
    this.dirty = [];
    for (const obj of list) {
      obj.dirty = false;
      fn(obj);
    }
  }

  /** Moves a hole from its input (also used by clients to predict their own hole). */
  moveHole(hole: Hole, dt: number) {
    const { input } = hole;
    const len = Math.hypot(input.x, input.z);
    const throttle = len > 1e-3 ? clamp(input.throttle, 0, 1) : 0;
    const speed = hole.speed * throttle;
    const tx = len > 1e-3 ? (input.x / len) * speed : 0;
    const tz = len > 1e-3 ? (input.z / len) * speed : 0;
    hole.vx = damp(hole.vx, tx, HOLE.acceleration, dt);
    hole.vz = damp(hole.vz, tz, HOLE.acceleration, dt);
    hole.x += hole.vx * dt;
    hole.z += hole.vz * dt;

    // Keep the whole rim inside the perimeter fence.
    const limit = Math.max(0, Math.min(this.half, this.half + CITY.borderOffset - hole.radius * 1.05));
    if (hole.x < -limit || hole.x > limit) {
      hole.x = clamp(hole.x, -limit, limit);
      hole.vx = 0;
    }
    if (hole.z < -limit || hole.z > limit) {
      hole.z = clamp(hole.z, -limit, limit);
      hole.vz = 0;
    }
  }

  private updateMovers(dt: number) {
    for (const car of this.cars) {
      if (car.phase !== "standing") continue;
      (car.mover as CarMover).update(car, this.cars, dt);
      this.afterMove(car);
    }
    for (const walker of this.walkers) {
      if (walker.phase !== "standing") continue;
      (walker.mover as WalkerMover).update(walker, dt);
      this.afterMove(walker);
    }
  }

  private afterMove(obj: CityObject) {
    this.grid.move(obj);
    this.valueField.move(obj);
    obj.writeStandingTransform();
    this.markDirty(obj);
  }

  /** Makes nearby objects lean toward the hole, and swallows the ones that fit. */
  private interact(hole: Hole, allowFalls: boolean) {
    const r = hole.radius;
    // A magnet catches edible things beyond the rim; they slide in before dropping.
    const reach = hole.hasPower("magnet") ? r * POWER_UP_RULES.magnetReach : r;
    this.grid.forEachInRadius(hole.x, hole.z, reach + MAX_FOOT_RADIUS * 0.6, (obj) => {
      const foot = obj.kind.footRadius;
      const dx = obj.x - hole.x;
      const dz = obj.z - hole.z;
      const d = Math.hypot(dx, dz);
      const edible = obj.kind.requiredRadius < r;
      if (d > (edible ? reach : r) + foot * 0.6) return;

      if (edible && d + foot * 0.35 < reach) {
        if (allowFalls) {
          this.startFall(obj, hole);
          return;
        }
      }

      const inv = d > 1e-3 ? 1 / d : 0;
      obj.tiltDirX = -dx * inv;
      obj.tiltDirZ = -dz * inv;
      if (edible) {
        const overlap = clamp((reach + foot * 0.6 - d) / (foot * 0.95 + 0.01), 0, 1);
        obj.tiltTarget = Math.max(obj.tiltTarget, LEAN_EDIBLE * overlap);
      } else {
        const tremble = Math.sin(this.time * 32 + obj.seed * 50) * 0.5 + 0.5;
        obj.tiltTarget = Math.max(obj.tiltTarget, LEAN_BLOCKED * (0.4 + tremble) * Math.min(1, r / foot));
      }
      obj.touched = true;
      if (!obj.leaning) {
        obj.leaning = true;
        this.leaning.push(obj);
      }
    });
  }

  private startFall(obj: CityObject, hole: Hole) {
    this.grid.remove(obj);
    this.valueField.remove(obj);
    obj.phase = "falling";

    const ox = obj.x - hole.x;
    const oz = obj.z - hole.z;
    const d = Math.hypot(ox, oz);
    let dx: number;
    let dz: number;
    if (d > 0.05) {
      dx = -ox / d;
      dz = -oz / d;
    } else {
      const a = this.rng.range(0, Math.PI * 2);
      dx = Math.cos(a);
      dz = Math.sin(a);
    }

    obj.fall = {
      hole,
      ox,
      oz,
      y: obj.position.y,
      vx: dx * 1.5 + hole.vx * 0.2,
      vy: 0,
      vz: dz * 1.5 + hole.vz * 0.2,
      axisX: dz,
      axisZ: -dx,
      angle: obj.tilt,
      angularVelocity: 1.2 + this.rng.range(0, 1.5),
      spin: this.rng.range(-1.2, 1.2),
      sunk: false,
      time: 0,
      outside: d > Math.max(0.05, hole.radius - obj.kind.footRadius * 0.4),
    };
    this.falling.push(obj);
    this.events.push({ type: "fallStart", holeId: hole.id, objectId: obj.id, kindId: obj.kind.id, x: obj.x, z: obj.z });
  }

  private updateFalling(dt: number) {
    let write = 0;
    for (let i = 0; i < this.falling.length; i++) {
      const obj = this.falling[i];
      const f = obj.fall!;
      const hole = f.hole;
      const h = obj.kind.height;
      const r = hole.radius;

      f.time += dt;
      if (f.outside && hole.alive) {
        // Magnet catch: glide over the ground to the rim, then fall like everything else.
        const allowed = Math.max(0.05, r - obj.kind.footRadius * 0.4);
        const nd = Math.hypot(f.ox, f.oz);
        const move = Math.min(nd, (7 + r * 1.5) * dt);
        f.ox -= (f.ox / nd) * move;
        f.oz -= (f.oz / nd) * move;
        f.outside = nd - move > allowed;
        obj.writeFallingTransform();
        this.markDirty(obj);
        this.falling[write++] = obj;
        continue;
      }
      f.vy -= PHYSICS.gravity * dt;
      const d = Math.hypot(f.ox, f.oz);
      if (d > 0.01) {
        const pull = PHYSICS.holePull * (0.6 + r * 0.08);
        f.vx -= (f.ox / d) * pull * dt;
        f.vz -= (f.oz / d) * pull * dt;
      }
      const drag = Math.exp(-3 * dt);
      f.vx *= drag;
      f.vz *= drag;
      f.ox += f.vx * dt;
      f.oz += f.vz * dt;
      f.y += f.vy * dt;

      // Stay inside the hole's shaft.
      const allowed = Math.max(0.05, r - obj.kind.footRadius * 0.4);
      const nd = Math.hypot(f.ox, f.oz);
      if (nd > allowed) {
        const nx = f.ox / nd;
        const nz = f.oz / nd;
        f.ox = nx * allowed;
        f.oz = nz * allowed;
        const radial = f.vx * nx + f.vz * nz;
        if (radial > 0) {
          f.vx -= radial * nx * 1.3;
          f.vz -= radial * nz * 1.3;
        }
      }

      f.angularVelocity += PHYSICS.tipAcceleration * dt;
      f.angle = Math.min(f.angle + f.angularVelocity * dt, 1.95);
      obj.rotY += f.spin * dt;
      obj.writeFallingTransform();
      this.markDirty(obj);

      const reach = (h / 2) * Math.abs(Math.cos(f.angle)) + (obj.kind.footRadius * 0.8) * Math.abs(Math.sin(f.angle));
      if (!f.sunk && (f.y + reach < 0.2 || !hole.alive)) {
        f.sunk = true;
        if (!this.replica) this.swallow(hole, obj);
      }

      const gone = f.y + reach < -holeDepthForRadius(r) || f.time > 6 || !hole.alive;
      if (gone) {
        if (!f.sunk && !this.replica) this.swallow(hole, obj);
        obj.phase = "gone";
        obj.visible = false;
        obj.fall = null;
        continue;
      }
      this.falling[write++] = obj;
    }
    this.falling.length = write;
  }

  private swallow(hole: Hole, obj: CityObject) {
    const value = obj.kind.value;
    hole.objectScore += value;
    hole.objectsEaten++;
    hole.recordBite(obj.kind);
    hole.combo = this.time - hole.lastEatTime < 1.2 ? hole.combo + 1 : 1;
    hole.bestCombo = Math.max(hole.bestCombo, hole.combo);
    hole.lastEatTime = this.time;
    this.events.push({
      type: "objectEaten",
      holeId: hole.id,
      kindId: obj.kind.id,
      value,
      x: obj.position.x,
      z: obj.position.z,
      combo: hole.combo,
    });
    this.addScore(hole, value);
  }

  private addScore(hole: Hole, points: number) {
    hole.score += points;
    const { level } = sizeLevelForScore(hole.score);
    if (level > hole.sizeLevel) {
      hole.sizeLevel = level;
      this.events.push({ type: "levelUp", holeId: hole.id, level });
    }
  }

  private updateLeaning(dt: number) {
    let write = 0;
    for (let i = 0; i < this.leaning.length; i++) {
      const obj = this.leaning[i];
      if (obj.phase !== "standing") {
        obj.leaning = false;
        continue;
      }
      const target = obj.touched ? obj.tiltTarget : 0;
      obj.tilt = damp(obj.tilt, target, obj.touched ? 9 : 5, dt);
      obj.touched = false;
      obj.tiltTarget = 0;
      obj.writeStandingTransform();
      this.markDirty(obj);
      if (target === 0 && obj.tilt < 0.002) {
        obj.tilt = 0;
        obj.leaning = false;
        obj.writeStandingTransform();
        continue;
      }
      this.leaning[write++] = obj;
    }
    this.leaning.length = write;
  }

  private updateHoles(dt: number) {
    for (const hole of this.holes) {
      if (hole.alive) {
        for (let i = 0; i < hole.powers.length; i++) hole.powers[i] = Math.max(0, hole.powers[i] - dt);
        hole.radius = damp(hole.radius, hole.targetRadius, HOLE.growthSmoothing, dt);
        hole.protection = Math.max(0, hole.protection - dt);
        if (this.time - hole.lastEatTime > 1.2) hole.combo = 0;
      } else if (!hole.eliminated) {
        hole.respawnTimer -= dt;
        if (hole.respawnTimer <= 0) {
          this.placeHole(hole);
          this.events.push({ type: "holeRespawned", holeId: hole.id });
        }
      }
    }
  }

  private resolveHoleCollisions() {
    const holes = this.holes;
    for (let i = 0; i < holes.length; i++) {
      const a = holes[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < holes.length; j++) {
        const b = holes[j];
        if (!b.alive || !a.alive) continue;
        if (this.areTeammates(a, b)) continue;
        const big = a.radius >= b.radius ? a : b;
        const small = big === a ? b : a;
        if (big.isProtected || small.isProtected || small.hasPower("shield") || !big.canEat(small)) continue;
        const d = Math.hypot(big.x - small.x, big.z - small.z);
        if (d < big.radius - small.radius * 0.3) this.eatHole(big, small);
      }
    }
  }

  private eatHole(eater: Hole, victim: Hole) {
    const gain = Math.max(HOLE.killMinimum, victim.score * HOLE.killShare);
    eater.kills++;
    this.addScore(eater, gain);

    victim.alive = false;
    victim.deaths++;
    victim.powers.fill(0);
    victim.eatenBy = eater.id;
    victim.combo = 0;
    this.events.push({ type: "holeEaten", eaterId: eater.id, victimId: victim.id, x: victim.x, z: victim.z, gain });

    if (this.mode === "battle") {
      victim.eliminated = true;
      victim.eliminatedAt = this.time;
    } else {
      victim.score *= HOLE.respawnKeep;
      victim.sizeLevel = sizeLevelForScore(victim.score).level;
      victim.respawnTimer = HOLE.respawnDelay;
    }
  }

  /** Collects, expires and spawns power-up pickups. */
  private updatePowerUps() {
    for (const hole of this.holes) {
      if (!hole.alive) continue;
      for (let i = this.powerUps.length - 1; i >= 0; i--) {
        const p = this.powerUps[i];
        if (Math.hypot(p.x - hole.x, p.z - hole.z) > hole.radius + POWER_UP_RULES.pickupReach) continue;
        this.powerUps.splice(i, 1);
        hole.powers[powerIndex(p.kind)] = POWER_UPS[p.kind].duration;
        this.events.push({ type: "powerUpTaken", id: p.id, holeId: hole.id, kind: p.kind });
      }
    }
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      if (this.time - this.powerUps[i].bornAt < POWER_UP_RULES.lifetime) continue;
      this.events.push({ type: "powerUpExpired", id: this.powerUps[i].id });
      this.powerUps.splice(i, 1);
    }
    if (this.time < this.nextPowerUpAt) return;
    this.nextPowerUpAt = this.time + POWER_UP_RULES.spawnEvery;
    const max = POWER_UP_RULES.maxBase + Math.floor(this.holes.length / POWER_UP_RULES.holesPerExtra);
    if (this.powerUps.length < max) this.spawnPowerUp();
  }

  /** Drops a pickup in open space, away from holes and other pickups: worth a detour. */
  private spawnPowerUp() {
    const margin = this.half * 0.85;
    let best = { x: 0, z: 0, score: -Infinity };
    for (let i = 0; i < 12; i++) {
      const x = this.rng.range(-margin, margin);
      const z = this.rng.range(-margin, margin);
      let score = Infinity;
      for (const h of this.holes) if (h.alive) score = Math.min(score, Math.hypot(h.x - x, h.z - z) - h.radius);
      for (const p of this.powerUps) score = Math.min(score, Math.hypot(p.x - x, p.z - z));
      if (score > best.score) best = { x, z, score };
    }
    const total = POWER_UP_KINDS.reduce((sum, k) => sum + POWER_UPS[k].weight, 0);
    let roll = this.rng.range(0, total);
    const kind = POWER_UP_KINDS.find((k) => (roll -= POWER_UPS[k].weight) < 0) ?? POWER_UP_KINDS[0];
    const p: PowerUp = { id: this.nextPowerUpId++, kind, x: best.x, z: best.z, bornAt: this.time };
    this.powerUps.push(p);
    this.events.push({ type: "powerUpSpawned", id: p.id, kind, x: p.x, z: p.z });
  }

  private checkEnd() {
    let end = this.time >= this.duration;
    if (this.mode === "battle") {
      const alive = this.holes.filter((h) => !h.eliminated).length;
      const player = this.player;
      if (alive <= 1 || (player && player.eliminated)) end = true;
    }
    if (end) {
      this.finished = true;
      this.events.push({ type: "matchEnd" });
    }
  }

  // ---------------------------------------------------------------------------
  // Networking
  // ---------------------------------------------------------------------------

  /** Replica: starts the fall the host reported (no-op if already falling). */
  replicateFall(objectId: number, holeId: number) {
    const obj = this.objects[objectId];
    const hole = this.holes[holeId];
    if (obj && hole && obj.phase === "standing") this.startFall(obj, hole);
  }

  /** Replica: mirrors a pickup the host spawned. */
  addPowerUp(id: number, kind: PowerUpKind, x: number, z: number) {
    if (!this.powerUps.some((p) => p.id === id)) this.powerUps.push({ id, kind, x, z, bornAt: this.time });
  }

  /** Replica: removes a pickup the host reported taken or expired. */
  removePowerUp(id: number) {
    const i = this.powerUps.findIndex((p) => p.id === id);
    if (i >= 0) this.powerUps.splice(i, 1);
  }

  /** Traffic state for drift correction on clients. */
  moverStates() {
    return {
      cars: this.cars.map((c) => (c.phase === "standing" ? (c.mover as CarMover).getState() : null)),
      walkers: this.walkers.map((w) => (w.phase === "standing" ? (w.mover as WalkerMover).getState() : null)),
    };
  }

  applyMoverStates(states: ReturnType<World["moverStates"]>) {
    states.cars.forEach((state, i) => {
      const car = this.cars[i];
      if (!state || !car || car.phase !== "standing") return;
      (car.mover as CarMover).setState(car, state);
      this.afterMove(car);
    });
    states.walkers.forEach((state, i) => {
      const walker = this.walkers[i];
      if (state === null || !walker || walker.phase !== "standing") return;
      (walker.mover as WalkerMover).setState(walker, state);
      this.afterMove(walker);
    });
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /** Current leaderboard. In battle mode survivors always rank above eliminated holes. */
  standings(): Standing[] {
    const sorted = [...this.holes].sort((a, b) => {
      if (this.mode === "battle" && a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      if (this.mode === "battle" && a.eliminated && b.eliminated) return b.eliminatedAt - a.eliminatedAt;
      return b.score - a.score;
    });
    return sorted.map((hole, i) => ({ hole, rank: i + 1 }));
  }

  rankOf(hole: Hole) {
    return this.standings().find((s) => s.hole === hole)?.rank ?? this.holes.length;
  }

  /** Team mode: holes on the same team never eat each other. */
  areTeammates(a: Hole, b: Hole) {
    return a.team >= 0 && a.team === b.team;
  }

  /** Team mode: each team's total score (index = team). */
  teamScores() {
    const scores = [0, 0];
    for (const h of this.holes) if (h.team >= 0) scores[h.team] += h.score;
    return scores;
  }

  /** Share of the city's total value swallowed by `hole`, in percent. */
  percentEaten(hole: Hole) {
    return this.totalValue > 0 ? (hole.objectScore / this.totalValue) * 100 : 0;
  }
}
