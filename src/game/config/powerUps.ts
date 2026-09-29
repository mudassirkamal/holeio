/** Pickups that appear around the city during a match. */
export type PowerUpKind = "turbo" | "magnet" | "shield" | "giant";

/** Fixed order: a hole's timers and the network snapshot use these indexes. */
export const POWER_UP_KINDS: readonly PowerUpKind[] = ["turbo", "magnet", "shield", "giant"];

export const POWER_UPS: Record<PowerUpKind, { name: string; icon: string; color: string; duration: number; description: string; weight: number }> = {
  turbo: { name: "Turbo", icon: "⚡", color: "#ffd23f", duration: 6, description: "50% faster", weight: 3 },
  magnet: { name: "Magnet", icon: "🧲", color: "#ff5c8a", duration: 8, description: "Pulls in things near your rim", weight: 3 },
  shield: { name: "Shield", icon: "🛡️", color: "#4fd6ff", duration: 7, description: "Nobody can swallow you", weight: 2 },
  giant: { name: "Giant", icon: "🍄", color: "#7cf05a", duration: 7, description: "35% bigger for a while", weight: 2 },
};

export const POWER_UP_RULES = {
  /** First pickup appears this long after the start, then one every `spawnEvery` seconds. */
  firstSpawn: 6,
  spawnEvery: 7,
  /** Pickups on the map at once: a base plus one per few holes. */
  maxBase: 2,
  holesPerExtra: 4,
  /** Uncollected pickups fade away after this long. */
  lifetime: 30,
  /** Extra reach beyond the rim for collecting a pickup (m). */
  pickupReach: 1.2,
  turboSpeed: 1.5,
  giantScale: 1.35,
  /** Magnet: things this far out (× radius) get pulled into the hole. */
  magnetReach: 1.5,
} as const;

export const powerIndex = (kind: PowerUpKind) => POWER_UP_KINDS.indexOf(kind);
