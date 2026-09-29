import { HOLE } from "../config/constants";
import type { Hole, HoleController } from "../core/entities";
import { TAU, angleDelta, clamp } from "../core/math";
import type { Rng } from "../core/rng";
import type { World } from "../core/World";
import type { Genome } from "./genome";
import type { SkillProfile } from "./skill";

export type BotMode = "farm" | "hunt" | "flee" | "roam" | "pickup";

interface FoodTarget {
  cell: number;
  x: number;
  z: number;
  utility: number;
}

/**
 * Seconds until `hunter` (moving at `speed`) can reach `prey` if the prey keeps its
 * current velocity. Returns Infinity when the prey can't be caught.
 */
export function interceptTime(hunter: Hole, prey: Hole, speed: number) {
  const dx = prey.x - hunter.x;
  const dz = prey.z - hunter.z;
  const a = prey.vx * prey.vx + prey.vz * prey.vz - speed * speed;
  const b = 2 * (dx * prey.vx + dz * prey.vz);
  const c = dx * dx + dz * dz;
  if (Math.abs(a) < 1e-6) return b < 0 ? -c / b : Number.POSITIVE_INFINITY;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Number.POSITIVE_INFINITY;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  const t = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
  return t;
}

/**
 * Utility-based bot. Every decision tick it:
 *  1. perceives holes within its vision and classifies them as threats, prey or rivals;
 *  2. flees when a bigger hole enters its danger zone (blending in safe food and
 *     avoiding walls so it can't be cornered);
 *  3. otherwise compares the value-per-second of the best chase (intercept
 *     prediction, bonus for prey cornered against walls, revenge on whoever ate
 *     it last) against the best food area on the value field;
 *  4. takes a detour for a power-up nearby;
 *  5. sweeps individual nearby objects on the way ("micro" steering).
 * Its weights come from a genome evolved by self-play (`scripts/train-bots.ts`).
 */
export class BotBrain implements HoleController {
  mode: BotMode = "farm";
  private heading: number;
  private desired: number;
  private thinkTimer: number;
  private throttle = 1;
  private targetCell = -1;
  private preyId = -1;
  private huntBestDistance = Infinity;
  private huntStall = 0;
  private readonly blacklist = new Map<number, number>();
  private distractedUntil = 0;
  private roamAngle = 0;
  private roamTimer = 0;

  constructor(
    readonly genome: Genome,
    readonly skill: SkillProfile,
    private readonly rng: Rng,
  ) {
    this.heading = rng.range(0, TAU);
    this.desired = this.heading;
    this.thinkTimer = rng.range(0, skill.thinkInterval);
  }

  update(world: World, hole: Hole, dt: number) {
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      const interval = this.skill.thinkInterval * this.rng.range(0.75, 1.25);
      this.thinkTimer = interval;
      this.think(world, hole, interval);
    }
    const maxTurn = this.skill.turnRate * dt;
    this.heading += clamp(angleDelta(this.heading, this.desired), -maxTurn, maxTurn);
    hole.input.x = Math.cos(this.heading);
    hole.input.z = Math.sin(this.heading);
    hole.input.throttle = this.throttle * this.skill.speedFactor;
  }

  // ---------------------------------------------------------------------------

  private think(world: World, hole: Hole, interval: number) {
    const g = this.situationalGenome(world, hole);
    const r = hole.radius;
    const vision = this.skill.awareness + r * 5;

    const threats: Hole[] = [];
    const prey: Hole[] = [];
    const rivals: Hole[] = [];
    for (const other of world.holes) {
      if (other === hole || !other.alive) continue;
      const d = Math.hypot(other.x - hole.x, other.z - hole.z);
      if (d > vision) continue;
      // Teammates are harmless and off the menu, but still compete for the same food,
      // which spreads a team across the map.
      if (world.areTeammates(hole, other)) {
        rivals.push(other);
        continue;
      }
      if (other.radius > r * HOLE.eatRatio * 0.97) {
        const obvious = d < other.radius + r + 6;
        if (obvious || this.rng.chance(this.skill.threatReaction)) threats.push(other);
      } else if (r > other.radius * HOLE.eatRatio * g.huntMargin && !other.isProtected && !other.hasPower("shield")) {
        if ((this.blacklist.get(other.id) ?? 0) < world.time) prey.push(other);
      } else {
        rivals.push(other);
      }
    }

    this.throttle = 1;

    // 1. Survival first (a shield makes it fearless).
    if (!hole.isProtected && !hole.hasPower("shield") && this.tryFlee(world, hole, g, threats, rivals)) {
      this.applyNoise();
      return;
    }

    // 2. Distraction (easy bots wander off now and then).
    if (world.time < this.distractedUntil) {
      this.desired = this.roamAngle;
      return;
    }
    if (this.rng.chance(this.skill.mistakeChance)) {
      this.distractedUntil = world.time + this.rng.range(0.6, 1.6);
      this.roamAngle = this.rng.range(0, TAU);
    }

    // 3. Compare hunting vs. farming in points per second.
    const food = this.bestFood(world, hole, g, threats, rivals, null);
    const foodUtility = food ? food.utility * hole.speed : 0;
    const hunt = this.bestPrey(world, hole, g, prey, threats);

    // 4. A power-up nearby is worth a detour, unless a chase is about to pay off.
    const pickup = this.bestPickup(world, hole, threats);
    if (pickup && (!hunt || hunt.utility <= foodUtility || pickup.dist < hunt.time * hole.speed * 0.5)) {
      this.mode = "pickup";
      this.preyId = -1;
      this.desired = Math.atan2(pickup.z - hole.z, pickup.x - hole.x);
    } else if (hunt && hunt.utility > foodUtility) {
      this.chase(world, hole, g, hunt.prey, hunt.time, interval);
    } else if (food) {
      this.farm(world, hole, g, food);
    } else {
      this.roam(world, hole, interval);
    }
    this.applyNoise();
  }

  /** Makes the bot more careful when leading late in a match, hungrier when behind. */
  private situationalGenome(world: World, hole: Hole): Genome {
    const g = { ...this.genome };
    if (world.mode === "battle") {
      g.fleeRadius *= 1.25;
      g.huntDrive *= 1.25;
    }
    if (world.mode !== "solo" && world.timeLeft < 25) {
      const scores = world.mode === "teams" ? world.teamScores() : null;
      const leading = scores ? scores[hole.team] > scores[1 - hole.team] : world.rankOf(hole) === 1;
      if (leading) {
        g.fleeRadius *= 1.35;
        g.huntDrive *= 0.8;
      } else {
        g.huntDrive *= 1 + g.endgameAggression;
        g.fleeRadius *= 1 - g.endgameAggression * 0.3;
      }
    }
    return g;
  }

  private tryFlee(world: World, hole: Hole, g: Genome, threats: Hole[], rivals: Hole[]) {
    let fx = 0;
    let fz = 0;
    let danger = 0;
    for (const t of threats) {
      const dx = t.x - hole.x;
      const dz = t.z - hole.z;
      const d = Math.max(0.1, Math.hypot(dx, dz));
      const range = t.radius + hole.radius + (5 + t.radius * 1.2) * g.fleeRadius;
      if (d >= range) continue;
      const closeness = 1 - d / range;
      const tSpeed = Math.hypot(t.vx, t.vz);
      // Positive when the threat is heading at us.
      const approach = tSpeed > 0.5 ? clamp(-(t.vx * dx + t.vz * dz) / (d * tSpeed), 0, 1) : 0;
      const w = closeness * closeness * (1 + approach * 1.5);
      fx -= (dx / d) * w;
      fz -= (dz / d) * w;
      danger = Math.max(danger, closeness);
    }
    if (danger < 0.02) return false;

    this.mode = "flee";
    this.preyId = -1;

    const [ex, ez] = this.edgeForce(world, hole, 18 + hole.radius * 2);
    const fleeLen = Math.hypot(fx, fz) || 1;
    fx = fx / fleeLen + ex * g.edgeAversion;
    fz = fz / fleeLen + ez * g.edgeAversion;

    // Keep eating while escaping, but only food on the safe side.
    const food = this.bestFood(world, hole, g, threats, rivals, [fx, fz]);
    if (food) {
      const dx = food.x - hole.x;
      const dz = food.z - hole.z;
      const d = Math.hypot(dx, dz) || 1;
      const mix = g.fleeFoodMix * (1 - danger);
      fx += (dx / d) * mix;
      fz += (dz / d) * mix;
    }
    this.desired = Math.atan2(fz, fx);
    return true;
  }

  private threatensTeammate(world: World, hole: Hole, enemy: Hole) {
    return world.holes.some(
      (t) => t !== hole && t.alive && world.areTeammates(hole, t) && enemy.canEat(t) && Math.hypot(enemy.x - t.x, enemy.z - t.z) < enemy.radius * 3 + 15,
    );
  }

  private bestPrey(world: World, hole: Hole, g: Genome, prey: Hole[], threats: Hole[]) {
    let best: { prey: Hole; utility: number; time: number } | null = null;
    for (const p of prey) {
      const time = interceptTime(hole, p, hole.speed);
      if (!Number.isFinite(time) || time > g.huntGiveUp * 2.5) continue;
      // Don't chase into the arms of a bigger hole.
      const guarded = threats.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < t.radius * 2 + 10);
      if (guarded) continue;
      const value =
        Math.max(HOLE.killMinimum, p.score * HOLE.killShare) + (world.mode === "battle" ? 120 : 0);
      let utility = (g.huntDrive * value) / (time + 1);
      // Prey pinned against a wall or corner has nowhere to run.
      const wallGap = world.half - Math.max(Math.abs(p.x), Math.abs(p.z));
      if (wallGap < 30) utility *= 1 + (1 - wallGap / 30) * 0.8;
      if (p.id === this.preyId) utility *= 1.3;
      // Revenge: hunt down whoever swallowed us last.
      if (p.id === hole.eatenBy) utility *= 1.4;
      // Bodyguard: an enemy closing in on a smaller teammate is a priority target.
      if (world.mode === "teams" && this.threatensTeammate(world, hole, p)) utility *= 1.6;
      if (!best || utility > best.utility) best = { prey: p, utility, time };
    }
    return best;
  }

  /** Nearest pickup within reach that isn't guarded by a bigger hole. */
  private bestPickup(world: World, hole: Hole, threats: Hole[]) {
    const range = this.skill.awareness * 0.5 + hole.radius * 2;
    let best: { x: number; z: number; dist: number } | null = null;
    for (const p of world.powerUps) {
      const dist = Math.hypot(p.x - hole.x, p.z - hole.z) - hole.radius;
      if (dist > range || (best && dist >= best.dist)) continue;
      if (threats.some((t) => Math.hypot(t.x - p.x, t.z - p.z) < t.radius * 2 + 8)) continue;
      best = { x: p.x, z: p.z, dist };
    }
    return best;
  }

  private chase(world: World, hole: Hole, g: Genome, prey: Hole, time: number, interval: number) {
    const d = Math.hypot(prey.x - hole.x, prey.z - hole.z);
    if (this.preyId !== prey.id) {
      this.preyId = prey.id;
      this.huntBestDistance = d;
      this.huntStall = 0;
    } else if (d < this.huntBestDistance - 0.5) {
      this.huntBestDistance = d;
      this.huntStall = 0;
    } else {
      this.huntStall += interval;
      if (this.huntStall > g.huntGiveUp) {
        this.blacklist.set(prey.id, world.time + 5);
        this.preyId = -1;
      }
    }

    this.mode = "hunt";
    const lead = d < hole.radius * 1.5 ? 0.15 : g.interceptLead;
    const limit = world.half;
    const tx = clamp(prey.x + prey.vx * time * lead, -limit, limit);
    const tz = clamp(prey.z + prey.vz * time * lead, -limit, limit);
    this.desired = Math.atan2(tz - hole.z, tx - hole.x);
  }

  private farm(world: World, hole: Hole, g: Genome, food: FoodTarget) {
    this.mode = "farm";
    this.preyId = -1;
    this.targetCell = food.cell;

    let dx = food.x - hole.x;
    let dz = food.z - hole.z;
    const macro = Math.hypot(dx, dz) || 1;
    dx /= macro;
    dz /= macro;

    // Micro steering: pull toward individual edible objects nearby.
    const r = hole.radius;
    const edible = r * 0.98;
    const local = r * g.microRadius + 3;
    let mx = 0;
    let mz = 0;
    let localValue = 0;
    world.grid.forEachInRadius(hole.x, hole.z, local, (obj) => {
      if (obj.kind.requiredRadius >= edible) return;
      const ox = obj.x - hole.x;
      const oz = obj.z - hole.z;
      const d2 = ox * ox + oz * oz;
      if (d2 > local * local) return;
      const w = obj.kind.value / (d2 + 1);
      mx += ox * w;
      mz += oz * w;
      localValue += obj.kind.value;
    });
    const microLen = Math.hypot(mx, mz);
    if (microLen > 1e-6) {
      const strength = g.microWeight * Math.min(1, localValue / 10);
      dx += (mx / microLen) * strength;
      dz += (mz / microLen) * strength;
    }
    this.desired = Math.atan2(dz, dx);
  }

  private roam(world: World, hole: Hole, interval: number) {
    this.mode = "roam";
    this.roamTimer -= interval;
    if (this.roamTimer <= 0) {
      this.roamTimer = this.rng.range(2, 4);
      const h = world.half * 0.7;
      this.roamAngle = Math.atan2(this.rng.range(-h, h) - hole.z, this.rng.range(-h, h) - hole.x);
    }
    this.desired = this.roamAngle;
  }

  private bestFood(
    world: World,
    hole: Hole,
    g: Genome,
    threats: Hole[],
    rivals: Hole[],
    safeDirection: [number, number] | null,
  ): FoodTarget | null {
    const field = world.valueField;
    const r = hole.radius;
    const edible = r * 0.98;
    const search = g.searchRadius + r * 3;
    const cs = field.cellSize;
    const cols = field.cols;
    const toCell = (v: number) => clamp(Math.floor((v + field.half) / cs), 0, cols - 1);
    const cx0 = toCell(hole.x - search);
    const cx1 = toCell(hole.x + search);
    const cz0 = toCell(hole.z - search);
    const cz1 = toCell(hole.z + search);

    let best: FoodTarget | null = null;
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const cell = cz * cols + cx;
        const value = field.edibleValue(cell, edible);
        if (value <= 0) continue;
        const px = field.cellCenterX(cell);
        const pz = field.cellCenterZ(cell);
        const dx = px - hole.x;
        const dz = pz - hole.z;
        const dist = Math.hypot(dx, dz);
        if (dist > search) continue;
        if (safeDirection && dx * safeDirection[0] + dz * safeDirection[1] < 0) continue;

        let utility = Math.pow(value, g.valueExponent) / (dist + g.distanceBias);
        for (const t of threats) {
          const zone = t.radius * 2 + 18;
          const dd = Math.hypot(t.x - px, t.z - pz);
          if (dd < zone) utility /= 1 + g.dangerAversion * 2 * (1 - dd / zone);
        }
        for (const rv of rivals) {
          const zone = rv.radius + 12;
          const dd = Math.hypot(rv.x - px, rv.z - pz);
          if (dd < zone && dd < dist) utility /= 1 + g.contestAversion * (1 - dd / zone);
        }
        if (cell === this.targetCell) utility *= 1 + g.hysteresis;
        if (!best || utility > best.utility) best = { cell, x: px, z: pz, utility };
      }
    }
    return best;
  }

  private edgeForce(world: World, hole: Hole, margin: number): [number, number] {
    const h = world.half;
    let ex = 0;
    let ez = 0;
    if (hole.x < -h + margin) ex += (-h + margin - hole.x) / margin;
    if (hole.x > h - margin) ex -= (hole.x - (h - margin)) / margin;
    if (hole.z < -h + margin) ez += (-h + margin - hole.z) / margin;
    if (hole.z > h - margin) ez -= (hole.z - (h - margin)) / margin;
    return [ex, ez];
  }

  private applyNoise() {
    if (this.skill.aimNoise > 0) this.desired += this.rng.gaussian() * this.skill.aimNoise;
  }
}
