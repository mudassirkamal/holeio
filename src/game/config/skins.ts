export type SkinPattern =
  | "solid"
  | "gradient"
  | "stripes"
  | "dots"
  | "checker"
  | "pulse"
  | "rainbow"
  | "lava"
  | "toxic"
  | "electric"
  | "ice"
  | "galaxy"
  | "gold"
  | "matrix";

export type SkinParticles = "none" | "sparkles" | "embers" | "snow" | "bubbles" | "stars" | "petals";

export type SkinRarity = "common" | "rare" | "epic" | "legendary";

export type SkinUnlock =
  | { type: "free" }
  | { type: "coins"; price: number }
  | { type: "level"; level: number }
  | { type: "stars"; stars: number };

export interface SkinDef {
  id: string;
  name: string;
  pattern: SkinPattern;
  /** Primary, secondary and accent colors. */
  colors: readonly [string, string, string];
  speed: number;
  glow: number;
  particles: SkinParticles;
  rarity: SkinRarity;
  unlock: SkinUnlock;
}

const SKIN_LIST = [
  { id: "classic", name: "Classic", pattern: "solid", colors: ["#3a86ff", "#1f5fd1", "#9cc3ff"], speed: 1, glow: 0.6, particles: "none", rarity: "common", unlock: { type: "free" } },
  { id: "mint", name: "Mint", pattern: "solid", colors: ["#2ec4b6", "#15928a", "#a7f3ea"], speed: 1, glow: 0.6, particles: "none", rarity: "common", unlock: { type: "free" } },
  { id: "crimson", name: "Crimson", pattern: "solid", colors: ["#ef233c", "#a4161a", "#ff8fa3"], speed: 1, glow: 0.7, particles: "none", rarity: "common", unlock: { type: "coins", price: 150 } },
  { id: "tangerine", name: "Tangerine", pattern: "solid", colors: ["#ff8500", "#d45d00", "#ffc078"], speed: 1, glow: 0.7, particles: "none", rarity: "common", unlock: { type: "coins", price: 150 } },
  { id: "sunset", name: "Sunset", pattern: "gradient", colors: ["#ff7b00", "#ff006e", "#ffd000"], speed: 0.6, glow: 0.8, particles: "none", rarity: "rare", unlock: { type: "coins", price: 350 } },
  { id: "ocean", name: "Ocean", pattern: "gradient", colors: ["#00b4d8", "#3a0ca3", "#90e0ef"], speed: 0.6, glow: 0.8, particles: "bubbles", rarity: "rare", unlock: { type: "coins", price: 400 } },
  { id: "candy", name: "Candy Cane", pattern: "stripes", colors: ["#ff4d6d", "#ffffff", "#ffb3c1"], speed: 0.8, glow: 0.5, particles: "none", rarity: "rare", unlock: { type: "coins", price: 500 } },
  { id: "bumblebee", name: "Bumblebee", pattern: "stripes", colors: ["#ffd60a", "#1b1b1e", "#fff3b0"], speed: 1.2, glow: 0.5, particles: "none", rarity: "rare", unlock: { type: "coins", price: 500 } },
  { id: "polka", name: "Polka Party", pattern: "dots", colors: ["#8338ec", "#ffbe0b", "#fb5607"], speed: 0.7, glow: 0.6, particles: "none", rarity: "rare", unlock: { type: "coins", price: 650 } },
  { id: "racer", name: "Checkered", pattern: "checker", colors: ["#f8f9fa", "#111111", "#ff0054"], speed: 1.4, glow: 0.4, particles: "none", rarity: "rare", unlock: { type: "coins", price: 800 } },
  { id: "blossom", name: "Blossom", pattern: "gradient", colors: ["#ffafcc", "#cdb4db", "#ffc8dd"], speed: 0.5, glow: 0.9, particles: "petals", rarity: "epic", unlock: { type: "level", level: 6 } },
  { id: "neon", name: "Neon Pulse", pattern: "pulse", colors: ["#ff00e5", "#00f0ff", "#ffffff"], speed: 1.3, glow: 1.6, particles: "sparkles", rarity: "epic", unlock: { type: "level", level: 10 } },
  { id: "toxic", name: "Toxic", pattern: "toxic", colors: ["#70e000", "#004b23", "#ccff33"], speed: 1, glow: 1.2, particles: "bubbles", rarity: "epic", unlock: { type: "coins", price: 1000 } },
  { id: "lava", name: "Molten Lava", pattern: "lava", colors: ["#ff4800", "#6a040f", "#ffba08"], speed: 0.8, glow: 1.5, particles: "embers", rarity: "epic", unlock: { type: "coins", price: 1300 } },
  { id: "frostbite", name: "Frostbite", pattern: "ice", colors: ["#caf0f8", "#0077b6", "#ffffff"], speed: 0.6, glow: 1.1, particles: "snow", rarity: "epic", unlock: { type: "level", level: 14 } },
  { id: "electric", name: "Electric", pattern: "electric", colors: ["#4cc9f0", "#240046", "#ffffff"], speed: 1.6, glow: 1.8, particles: "sparkles", rarity: "epic", unlock: { type: "coins", price: 1600 } },
  { id: "matrix", name: "Matrix", pattern: "matrix", colors: ["#00ff41", "#001a07", "#b6ffcb"], speed: 1.2, glow: 1.3, particles: "none", rarity: "epic", unlock: { type: "coins", price: 2000 } },
  { id: "rainbow", name: "Rainbow", pattern: "rainbow", colors: ["#ff0000", "#00ff00", "#0000ff"], speed: 0.8, glow: 1.2, particles: "sparkles", rarity: "legendary", unlock: { type: "stars", stars: 25 } },
  { id: "galaxy", name: "Galaxy", pattern: "galaxy", colors: ["#7209b7", "#03001c", "#4cc9f0"], speed: 0.5, glow: 1.4, particles: "stars", rarity: "legendary", unlock: { type: "coins", price: 3000 } },
  { id: "golden", name: "24K Gold", pattern: "gold", colors: ["#ffd166", "#b8860b", "#fff5cc"], speed: 0.9, glow: 1.2, particles: "sparkles", rarity: "legendary", unlock: { type: "stars", stars: 45 } },
] as const satisfies readonly SkinDef[];

export type SkinId = (typeof SKIN_LIST)[number]["id"];

export const SKINS: readonly (SkinDef & { id: SkinId })[] = SKIN_LIST;

export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s])) as Record<SkinId, SkinDef & { id: SkinId }>;

export const DEFAULT_SKIN: SkinId = "classic";

export const RARITY_COLORS: Record<SkinRarity, string> = {
  common: "#9aa5b1",
  rare: "#3a86ff",
  epic: "#b14aed",
  legendary: "#ffb703",
};
