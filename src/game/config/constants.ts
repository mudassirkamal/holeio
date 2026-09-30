export const GAME_NAME = "HOLE RUSH";
export const DEVELOPER = { name: "Mudassir Kamal", email: "mudassirkamal@proton.me" } as const;

/** City geometry (meters). */
export const CITY = {
  roadWidth: 11,
  laneOffset: 2.6,
  sidewalkWidth: 3,
  cellSize: 8,
  valueCellSize: 10,
  /** Distance of the perimeter fence beyond the outer edge of the ring road. */
  borderOffset: 1.6,
} as const;

/** Hole growth & movement tuning. */
export const HOLE = {
  startRadius: 1.3,
  /** Area (m²) gained per point swallowed. */
  growthPerPoint: 0.062,
  /** A hole must be this many times wider to swallow another hole. */
  eatRatio: 1.14,
  baseSpeed: 10,
  speedPerRadius: 0.42,
  maxSpeed: 21,
  acceleration: 9,
  growthSmoothing: 5,
  /** Invulnerability after spawning, in seconds. */
  spawnProtection: 3,
  /** Share of the victim's score the eater receives. */
  killShare: 0.45,
  killMinimum: 40,
  /** Share of score kept when respawning after being eaten (classic mode). */
  respawnKeep: 0.55,
  respawnDelay: 3,
} as const;

export const PHYSICS = {
  gravity: 34,
  holePull: 16,
  tipAcceleration: 9,
} as const;

/** Score thresholds for each displayed size level. */
export const SIZE_LEVELS = [
  0, 20, 50, 100, 180, 300, 470, 700, 1000, 1400, 1900, 2500, 3300, 4300, 5600, 7200, 9200, 12000,
] as const;

export const holeRadiusForScore = (score: number) =>
  Math.sqrt(HOLE.startRadius * HOLE.startRadius + score * HOLE.growthPerPoint);

export const holeSpeedForRadius = (radius: number) =>
  Math.min(HOLE.maxSpeed, HOLE.baseSpeed + radius * HOLE.speedPerRadius);

export const sizeLevelForScore = (score: number) => {
  let level = 0;
  while (level < SIZE_LEVELS.length - 1 && score >= SIZE_LEVELS[level + 1]) level++;
  const floor = SIZE_LEVELS[level];
  const ceil = SIZE_LEVELS[Math.min(level + 1, SIZE_LEVELS.length - 1)];
  const progress = ceil > floor ? (score - floor) / (ceil - floor) : 1;
  return { level: level + 1, progress: Math.min(1, progress) };
};

/** Visual depth of a hole's shaft; objects deeper than this are gone. */
export const holeDepthForRadius = (radius: number) => radius * 2.4 + 6;
