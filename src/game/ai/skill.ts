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
  easy: { thinkInterval: 0.5, aimNoise: 0.35, turnRate: 3.2, awareness: 45, mistakeChance: 0.07, threatReaction: 0.55, speedFactor: 0.86 },
  normal: { thinkInterval: 0.3, aimNoise: 0.17, turnRate: 5, awareness: 70, mistakeChance: 0.03, threatReaction: 0.82, speedFactor: 0.94 },
  hard: { thinkInterval: 0.18, aimNoise: 0.08, turnRate: 8, awareness: 100, mistakeChance: 0.01, threatReaction: 0.96, speedFactor: 1 },
  insane: { thinkInterval: 0.1, aimNoise: 0.025, turnRate: 12, awareness: 140, mistakeChance: 0, threatReaction: 1, speedFactor: 1 },
};
