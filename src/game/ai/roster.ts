import type { Difficulty } from "../config/levels";
import { SKINS, type SkinId } from "../config/skins";
import type { Rng } from "../core/rng";
import type { HoleSetup } from "../core/World";
import { BotBrain } from "./BotBrain";
import { clampGenome, defaultGenome, mutateGenome, type Genome } from "./genome";
import { SKILLS } from "./skill";
import trained from "./trainedBrains.json";

const BOT_NAMES = [
  "Vortex", "Gobbler", "Muncher", "Abyss", "Chomp", "Nomad", "Sinkhole", "Echo", "Blitz", "Nebula",
  "Crater", "Maverick", "Pixel", "Zephyr", "Titan", "Shadow", "Rogue", "Comet", "Havoc", "Ninja",
  "Glitch", "Orbit", "Raptor", "Yeti", "Bandit", "Tornado", "Viper", "Nova", "Kraken", "Goblin",
  "Void", "Bruiser", "Quasar", "Sprout", "Phantom", "Wasabi", "Turbo", "Mochi", "Rocket", "Jelly",
];

export interface TrainedBrain {
  name: string;
  fitness: number;
  genome: Genome;
}

/** Evolved genomes shipped with the game (falls back to the hand-tuned default). */
export const TRAINED_BRAINS: readonly TrainedBrain[] =
  trained.brains.length > 0
    ? trained.brains.map((b) => ({ ...b, genome: clampGenome({ ...defaultGenome(), ...b.genome }) }))
    : [{ name: "Baseline", fitness: 0, genome: defaultGenome() }];

export const TRAINING_INFO = { generations: trained.generations };

/** Bots at lower difficulties also get slightly "unpolished" genomes. */
const GENOME_JITTER: Record<Difficulty, number> = { easy: 0.16, normal: 0.1, hard: 0.06, insane: 0.03 };

/** Names and skins for `count` bots. */
export function createBotRoster(count: number, rng: Rng, avoidSkins: readonly SkinId[] = []) {
  const names = rng.shuffle([...BOT_NAMES]);
  const skins = rng.shuffle(SKINS.map((s) => s.id).filter((id) => !avoidSkins.includes(id)));
  return Array.from({ length: count }, (_, i) => ({ name: names[i % names.length], skinId: skins[i % skins.length] }));
}

/** The brain for the `index`-th bot of a match, cycling through the trained genomes. */
export function createBotBrain(index: number, difficulty: Difficulty, rng: Rng) {
  const brain = TRAINED_BRAINS[index % TRAINED_BRAINS.length];
  const jitter = GENOME_JITTER[difficulty];
  const genome = jitter > 0 ? mutateGenome(brain.genome, rng, 0.6, jitter) : brain.genome;
  return new BotBrain(genome, SKILLS[difficulty], rng);
}

export function createBots(count: number, difficulty: Difficulty, rng: Rng, avoidSkin?: SkinId): HoleSetup[] {
  return createBotRoster(count, rng, avoidSkin ? [avoidSkin] : []).map((bot, i) => ({
    ...bot,
    isPlayer: false,
    controller: createBotBrain(i, difficulty, rng),
  }));
}
