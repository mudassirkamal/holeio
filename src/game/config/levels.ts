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
  // World 6 — Dune Oasis
  { name: "Sand Storm", theme: "desert", mode: "solo", duration: 120, bots: 0, difficulty: "normal", blocksPerSide: 5, seed: 601, stars: [14, 26, 38] },
  { name: "Pharaoh's Feast", theme: "desert", mode: "classic", duration: 120, bots: 8, difficulty: "hard", blocksPerSide: 5, seed: 602, stars: [3, 2, 1] },
  // World 7 — Sakura Garden
  { name: "Petal Path", theme: "sakura", mode: "classic", duration: 120, bots: 7, difficulty: "normal", blocksPerSide: 5, seed: 701, stars: [3, 2, 1] },
  { name: "Pagoda Duel", theme: "sakura", mode: "battle", duration: 120, bots: 8, difficulty: "hard", blocksPerSide: 5, seed: 702, stars: [3, 2, 1] },
  // World 8 — Harbor Docks
  { name: "Dock Shift", theme: "harbor", mode: "solo", duration: 120, bots: 0, difficulty: "normal", blocksPerSide: 5, seed: 801, stars: [22, 36, 50] },
  { name: "Container Clash", theme: "harbor", mode: "classic", duration: 120, bots: 9, difficulty: "hard", blocksPerSide: 5, seed: 802, stars: [3, 2, 1] },
  // World 9 — Harvest Valley
  { name: "Harvest Time", theme: "farm", mode: "classic", duration: 120, bots: 7, difficulty: "normal", blocksPerSide: 5, seed: 901, stars: [3, 2, 1] },
  { name: "Barn Burner", theme: "farm", mode: "battle", duration: 120, bots: 8, difficulty: "hard", blocksPerSide: 5, seed: 902, stars: [3, 2, 1] },
  // World 10 — Candy Kingdom
  { name: "Sugar Rush", theme: "candy", mode: "solo", duration: 120, bots: 0, difficulty: "normal", blocksPerSide: 5, seed: 1001, stars: [18, 32, 46] },
  { name: "Cake Wars", theme: "candy", mode: "classic", duration: 120, bots: 9, difficulty: "hard", blocksPerSide: 6, seed: 1002, stars: [3, 2, 1] },
  // World 11 — Castle Town
  { name: "Market Day", theme: "castle", mode: "classic", duration: 120, bots: 8, difficulty: "hard", blocksPerSide: 5, seed: 1101, stars: [3, 2, 1] },
  { name: "Siege", theme: "castle", mode: "battle", duration: 120, bots: 9, difficulty: "hard", blocksPerSide: 6, seed: 1102, stars: [3, 2, 1] },
  // World 12 — Jungle Ruins
  { name: "Lost Temple", theme: "jungle", mode: "solo", duration: 120, bots: 0, difficulty: "normal", blocksPerSide: 5, seed: 1201, stars: [12, 22, 34] },
  { name: "Totem Hunt", theme: "jungle", mode: "classic", duration: 120, bots: 8, difficulty: "normal", blocksPerSide: 5, seed: 1202, stars: [3, 2, 1] },
  // World 13 — Sky Port
  { name: "Runway Run", theme: "airport", mode: "classic", duration: 120, bots: 8, difficulty: "hard", blocksPerSide: 5, seed: 1301, stars: [3, 2, 1] },
  { name: "Final Call", theme: "airport", mode: "battle", duration: 120, bots: 9, difficulty: "insane", blocksPerSide: 5, seed: 1302, stars: [4, 2, 1] },
  // World 14 — Fun Fair
  { name: "Night Rides", theme: "fair", mode: "classic", duration: 120, bots: 9, difficulty: "hard", blocksPerSide: 5, seed: 1401, stars: [3, 2, 1] },
  { name: "Big Top Brawl", theme: "fair", mode: "battle", duration: 120, bots: 9, difficulty: "insane", blocksPerSide: 5, seed: 1402, stars: [4, 2, 1] },
  // World 15 — Ember Ridge
  { name: "Hot Ground", theme: "volcano", mode: "solo", duration: 120, bots: 0, difficulty: "normal", blocksPerSide: 5, seed: 1501, stars: [18, 32, 46] },
  { name: "Eruption", theme: "volcano", mode: "classic", duration: 120, bots: 9, difficulty: "insane", blocksPerSide: 5, seed: 1502, stars: [4, 2, 1] },
  // World 16 — Moon Base
  { name: "Low Gravity", theme: "moon", mode: "classic", duration: 120, bots: 8, difficulty: "hard", blocksPerSide: 5, seed: 1601, stars: [4, 2, 1] },
  { name: "One Giant Bite", theme: "moon", mode: "classic", duration: 150, bots: 9, difficulty: "insane", blocksPerSide: 6, seed: 1602, stars: [4, 2, 1] },
];

export const LEVELS: readonly LevelDef[] = WORLD_LEVELS.map((level, i) => ({
  ...level,
  id: i + 1,
  reward: 60 + Math.min(i, 24) * 20,
}));

/** Campaign worlds in play order: consecutive levels that share a map. */
export const WORLDS: readonly { theme: ThemeId; levels: readonly LevelDef[] }[] = LEVELS.reduce<{ theme: ThemeId; levels: LevelDef[] }[]>((worlds, level) => {
  const last = worlds[worlds.length - 1];
  if (last?.theme === level.theme) last.levels.push(level);
  else worlds.push({ theme: level.theme, levels: [level] });
  return worlds;
}, []);

/** Solo star marks used when a match isn't a campaign level (Quick Play). */
export const DEFAULT_SOLO_STARS = [15, 30, 45] as const;

/** Stars earned for a finished match. */
export function starsForResult(level: Pick<LevelDef, "mode" | "stars">, rank: number, percent: number) {
  if (level.mode === "solo") return level.stars.filter((threshold) => percent >= threshold).length;
  return level.stars.filter((neededRank) => rank <= neededRank).length;
}
