/**
 * Campaign difficulty check: `npm run balance -- [trials=6]`.
 *
 * Plays every level headlessly with a "player proxy" — a trained brain with
 * human-like reaction time, aim noise and full speed — and reports how often it
 * earns at least one star. Use it after changing rules, bots or levels.
 */
import { BotBrain } from "../src/game/ai/BotBrain";
import { mutateGenome } from "../src/game/ai/genome";
import { TRAINED_BRAINS, createBots } from "../src/game/ai/roster";
import type { SkillProfile } from "../src/game/ai/skill";
import { LEVELS, starsForResult } from "../src/game/config/levels";
import { Rng } from "../src/game/core/rng";
import { World } from "../src/game/core/World";

const TRIALS = Number(process.argv[2] ?? 6);

const PLAYER_SKILL: SkillProfile = {
  thinkInterval: 0.3,
  aimNoise: 0.12,
  turnRate: 5,
  awareness: 90,
  mistakeChance: 0.03,
  threatReaction: 0.85,
  speedFactor: 1,
};

for (const level of LEVELS) {
  const outcomes: string[] = [];
  let passed = 0;
  for (let trial = 0; trial < TRIALS; trial++) {
    const rng = new Rng(level.seed * 100 + trial);
    const holes = level.mode === "solo" ? [] : createBots(level.bots, level.difficulty, rng);
    const genome = mutateGenome(TRAINED_BRAINS[0].genome, rng, 0.6, 0.05);
    holes.push({ name: "Player", skinId: "classic", isPlayer: true, controller: new BotBrain(genome, PLAYER_SKILL, rng) });

    const world = new World({
      seed: level.seed + trial,
      themeId: level.theme,
      mode: level.mode,
      duration: level.duration,
      blocksPerSide: level.blocksPerSide,
      holes,
    });
    world.running = true;
    while (!world.finished) {
      world.step(1 / 20);
      world.events.length = 0;
      world.drainDirty(() => {});
    }

    const player = world.player!;
    const rank = world.rankOf(player);
    const percent = world.percentEaten(player);
    if (starsForResult(level, rank, percent) > 0) passed++;
    outcomes.push(level.mode === "solo" ? `${percent.toFixed(0)}%` : `#${rank}`);
  }
  console.log(
    `L${String(level.id).padStart(2)} ${level.mode.padEnd(7)} ${level.difficulty.padEnd(6)} ${outcomes.join(" ").padEnd(30)} passed ${passed}/${TRIALS}`,
  );
}
