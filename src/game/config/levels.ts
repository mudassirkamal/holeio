import type { ThemeId } from "./themes";

export type GameMode = "classic" | "battle" | "solo" | "teams";

export type Difficulty = "easy" | "normal" | "hard" | "insane";

export interface LevelDef {
  id: number;
  name: string;
  theme: ThemeId;
  mode: GameMode;
  duration: number;
  bots: number;
  difficulty: Difficulty;
  blocksPerSide: number;
  seed: number;
  /** Solo: % of the city to swallow for 1/2/3 stars. Others: rank needed for 1/2/3 stars. */
  stars: readonly [number, number, number];
  reward: number;
}

export const MODE_INFO: Record<GameMode, { name: string; description: string; icon: string }> = {
  classic: {
    name: "Classic",
    description: "Be the biggest hole when the timer runs out. Get eaten and you respawn smaller.",
    icon: "👑",
  },
  battle: {
    name: "Battle Royale",
    description: "No respawns. Swallow rivals and be the last hole standing.",
    icon: "⚔️",
  },
  solo: {
    name: "Solo",
    description: "Just you and the city. Swallow as much of it as you can before time is up.",
    icon: "🏙️",
  },
  teams: {
    name: "Teams",
    description: "Red vs Blue. Teammates can't eat each other; the team with the biggest total size wins.",
    icon: "🤝",
  },
};

export const DIFFICULTY_INFO: Record<Difficulty, { name: string; color: string }> = {
  easy: { name: "Easy", color: "#34d399" },
  normal: { name: "Normal", color: "#60a5fa" },
  hard: { name: "Hard", color: "#f59e0b" },
  insane: { name: "Insane", color: "#ef4444" },
};

type LevelSeed = Omit<LevelDef, "id" | "reward">;

const WORLD_LEVELS: LevelSeed[] = [
  // World 1 — Metro City
  { name: "First Bite", theme: "metro", mode: "solo", duration: 120, bots: 0, difficulty: "easy", blocksPerSide: 4, seed: 101, stars: [15, 30, 45] },
  { name: "Rush Hour", theme: "metro", mode: "classic", duration: 120, bots: 5, difficulty: "easy", blocksPerSide: 5, seed: 102, stars: [3, 2, 1] },
  { name: "Downtown Duel", theme: "metro", mode: "classic", duration: 120, bots: 7, difficulty: "normal", blocksPerSide: 5, seed: 103, stars: [3, 2, 1] },
  { name: "Tower Takedown", theme: "metro", mode: "battle", duration: 120, bots: 7, difficulty: "normal", blocksPerSide: 5, seed: 104, stars: [3, 2, 1] },
  // World 2 — Sunset Suburbs
  { name: "Lawn Muncher", theme: "suburbs", mode: "solo", duration: 120, bots: 0, difficulty: "easy", blocksPerSide: 5, seed: 201, stars: [18, 32, 45] },
  { name: "Cul-de-sac Clash", theme: "suburbs", mode: "classic", duration: 120, bots: 7, difficulty: "normal", blocksPerSide: 5, seed: 202, stars: [3, 2, 1] },
  { name: "Golden Hour", theme: "suburbs", mode: "classic", duration: 120, bots: 7, difficulty: "normal", blocksPerSide: 6, seed: 203, stars: [3, 2, 1] },
  { name: "Suburban Showdown", theme: "suburbs", mode: "battle", duration: 120, bots: 8, difficulty: "hard", blocksPerSide: 5, seed: 204, stars: [3, 2, 1] },
  // World 3 — Neon Nights
  { name: "Night Shift", theme: "neon", mode: "solo", duration: 120, bots: 0, difficulty: "normal", blocksPerSide: 5, seed: 301, stars: [12, 25, 40] },
  { name: "Neon Hunters", theme: "neon", mode: "classic", duration: 120, bots: 8, difficulty: "hard", blocksPerSide: 6, seed: 302, stars: [3, 2, 1] },
  { name: "Skyline Feast", theme: "neon", mode: "classic", duration: 120, bots: 8, difficulty: "hard", blocksPerSide: 6, seed: 303, stars: [3, 2, 1] },
  { name: "Blackout", theme: "neon", mode: "battle", duration: 120, bots: 9, difficulty: "hard", blocksPerSide: 6, seed: 304, stars: [3, 2, 1] },
  // World 4 — Frost Town
  { name: "First Snow", theme: "frost", mode: "solo", duration: 120, bots: 0, difficulty: "normal", blocksPerSide: 5, seed: 401, stars: [18, 30, 42] },
  { name: "Snowball Effect", theme: "frost", mode: "classic", duration: 120, bots: 8, difficulty: "hard", blocksPerSide: 6, seed: 402, stars: [3, 2, 1] },
  { name: "Blizzard", theme: "frost", mode: "classic", duration: 120, bots: 8, difficulty: "insane", blocksPerSide: 6, seed: 403, stars: [3, 2, 1] },
  { name: "Frozen Arena", theme: "frost", mode: "battle", duration: 120, bots: 8, difficulty: "insane", blocksPerSide: 6, seed: 404, stars: [3, 2, 1] },
  // World 5 — Palm Beach
  { name: "Beach Day", theme: "beach", mode: "solo", duration: 120, bots: 0, difficulty: "normal", blocksPerSide: 6, seed: 501, stars: [20, 34, 46] },
  { name: "Tide Turners", theme: "beach", mode: "classic", duration: 120, bots: 9, difficulty: "insane", blocksPerSide: 6, seed: 502, stars: [4, 2, 1] },
  { name: "Resort Rumble", theme: "beach", mode: "battle", duration: 120, bots: 8, difficulty: "insane", blocksPerSide: 6, seed: 503, stars: [4, 2, 1] },
  { name: "King of the City", theme: "beach", mode: "classic", duration: 150, bots: 9, difficulty: "insane", blocksPerSide: 7, seed: 504, stars: [4, 2, 1] },
];

export const LEVELS: readonly LevelDef[] = WORLD_LEVELS.map((level, i) => ({
  ...level,
  id: i + 1,
  reward: 60 + i * 20,
}));

export const LEVELS_PER_WORLD = 4;

/** Solo star marks used when a match isn't a campaign level (Quick Play). */
export const DEFAULT_SOLO_STARS = [15, 30, 45] as const;

/** Stars earned for a finished match. */
export function starsForResult(level: Pick<LevelDef, "mode" | "stars">, rank: number, percent: number) {
  if (level.mode === "solo") return level.stars.filter((threshold) => percent >= threshold).length;
  return level.stars.filter((neededRank) => rank <= neededRank).length;
}
