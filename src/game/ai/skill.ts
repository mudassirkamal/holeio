import type { Difficulty } from "../config/levels";

/** Human-like limitations layered on top of a (trained) genome. */
export interface SkillProfile {
  /** Seconds between decisions (reaction time). */
  thinkInterval: number;
  /** Standard deviation of steering error, radians. */
  aimNoise: number;
  /** Max turn rate, radians per second. */
  turnRate: number;
  /** Base vision radius in meters (grows with hole size). */
  awareness: number;
  /** Chance per decision of getting distracted for a moment. */
  mistakeChance: number;
  /** Chance per decision of noticing a nearby threat. */
  threatReaction: number;
  /** Fraction of top speed used. */
  speedFactor: number;
}

export const SKILLS: Record<Difficulty, SkillProfile> = {
  easy: { thinkInterval: 0.5, aimNoise: 0.35, turnRate: 3.2, awareness: 45, mistakeChance: 0.08, threatReaction: 0.55, speedFactor: 0.82 },
  normal: { thinkInterval: 0.32, aimNoise: 0.2, turnRate: 4.8, awareness: 65, mistakeChance: 0.04, threatReaction: 0.78, speedFactor: 0.88 },
  hard: { thinkInterval: 0.26, aimNoise: 0.14, turnRate: 6, awareness: 78, mistakeChance: 0.025, threatReaction: 0.85, speedFactor: 0.9 },
  insane: { thinkInterval: 0.18, aimNoise: 0.08, turnRate: 7.5, awareness: 100, mistakeChance: 0.012, threatReaction: 0.92, speedFactor: 0.94 },
};
