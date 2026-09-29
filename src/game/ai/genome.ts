import type { Rng } from "../core/rng";

/**
 * Every tunable weight of the bot's decision making. The ranges bound the genetic
 * search in `scripts/train-bots.ts`; `init` is the hand-tuned starting point.
 */
export const GENE_SPECS = {
  /** >1 favours rich areas over nearby scraps. */
  valueExponent: { min: 0.4, max: 1.5, init: 0.85 },
  /** Flattens the distance penalty when comparing food areas (meters). */
  distanceBias: { min: 4, max: 70, init: 18 },
  /** How far the bot looks for food (meters, grows with size). */
  searchRadius: { min: 30, max: 180, init: 90 },
  /** Bonus that keeps the current target to avoid dithering. */
  hysteresis: { min: 0, max: 1.2, init: 0.35 },
  /** Strength of steering toward individual nearby objects. */
  microWeight: { min: 0, max: 4, init: 1.6 },
  /** Local sweep radius as a multiple of the hole radius. */
  microRadius: { min: 0.8, max: 5, init: 2.2 },
  /** Appetite for swallowing other holes. */
  huntDrive: { min: 0, max: 4, init: 1.2 },
  /** Extra size margin required before hunting (× the eat ratio). */
  huntMargin: { min: 1, max: 1.6, init: 1.08 },
  /** Seconds without closing distance before a chase is abandoned. */
  huntGiveUp: { min: 1.5, max: 10, init: 4.5 },
  /** How far ahead of the prey to aim (fraction of intercept time). */
  interceptLead: { min: 0, max: 1.6, init: 0.8 },
  /** Size of the personal danger zone around bigger holes. */
  fleeRadius: { min: 0.3, max: 3.5, init: 1.4 },
  /** How much a fleeing bot still steers toward safe food. */
  fleeFoodMix: { min: 0, max: 1.5, init: 0.4 },
  /** Avoidance of food that lies close to bigger holes. */
  dangerAversion: { min: 0, max: 4, init: 1.5 },
  /** Avoidance of food that rivals will reach first. */
  contestAversion: { min: 0, max: 3, init: 0.6 },
  /** Keeps away from walls when fleeing so the bot doesn't get cornered. */
  edgeAversion: { min: 0, max: 3, init: 1 },
  /** Extra aggression in the final seconds when not leading. */
  endgameAggression: { min: 0, max: 1.5, init: 0.5 },
} as const satisfies Record<string, { min: number; max: number; init: number }>;

export type GeneName = keyof typeof GENE_SPECS;
export type Genome = Record<GeneName, number>;

export const GENE_NAMES = Object.keys(GENE_SPECS) as GeneName[];

export const defaultGenome = (): Genome =>
  Object.fromEntries(GENE_NAMES.map((name) => [name, GENE_SPECS[name].init])) as Genome;

export const clampGenome = (genome: Genome): Genome =>
  Object.fromEntries(
    GENE_NAMES.map((name) => {
      const { min, max } = GENE_SPECS[name];
      return [name, Math.min(max, Math.max(min, genome[name]))];
    }),
  ) as Genome;

export const randomGenome = (rng: Rng): Genome =>
  Object.fromEntries(
    GENE_NAMES.map((name) => {
      const { min, max } = GENE_SPECS[name];
      return [name, rng.range(min, max)];
    }),
  ) as Genome;

/** Gaussian mutation; `strength` is a fraction of each gene's range. */
export const mutateGenome = (genome: Genome, rng: Rng, rate: number, strength: number): Genome => {
  const next = { ...genome };
  for (const name of GENE_NAMES) {
    if (!rng.chance(rate)) continue;
    const { min, max } = GENE_SPECS[name];
    next[name] += rng.gaussian() * (max - min) * strength;
  }
  return clampGenome(next);
};

/** Blend crossover: each gene is a random mix of both parents. */
export const crossoverGenomes = (a: Genome, b: Genome, rng: Rng): Genome => {
  const child = {} as Genome;
  for (const name of GENE_NAMES) {
    const t = rng.range(-0.15, 1.15);
    child[name] = a[name] + (b[name] - a[name]) * t;
  }
  return clampGenome(child);
};
