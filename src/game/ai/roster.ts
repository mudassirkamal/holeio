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
const GENOME_JITTER: Record<Difficulty, number> = { easy: 0.14, normal: 0.08, hard: 0.04, insane: 0 };

export function createBots(count: number, difficulty: Difficulty, rng: Rng, avoidSkin?: SkinId): HoleSetup[] {
  const names = rng.shuffle([...BOT_NAMES]);
  const skins = rng.shuffle(SKINS.map((s) => s.id).filter((id) => id !== avoidSkin));
  return Array.from({ length: count }, (_, i) => {
    const brain = TRAINED_BRAINS[i % TRAINED_BRAINS.length];
    const jitter = GENOME_JITTER[difficulty];
    const genome = jitter > 0 ? mutateGenome(brain.genome, rng, 0.6, jitter) : brain.genome;
    return {
      name: names[i % names.length],
      skinId: skins[i % skins.length],
      isPlayer: false,
      controller: new BotBrain(genome, SKILLS[difficulty], rng),
    };
  });
}
