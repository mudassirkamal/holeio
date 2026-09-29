/**
 * Evolves bot brains by self-play with a genetic algorithm.
 *
 *   npm run train -- [generations=36] [population=24]
 *
 * Every generation, genomes are dropped into headless 10-hole matches (classic and
 * battle royale, random cities). Fitness rewards final rank and share of the winner's
 * score. Elites survive, the rest are bred with tournament selection, blend crossover
 * and annealed gaussian mutation. The best distinct genomes are written to
 * src/game/ai/trainedBrains.json and used by the in-game bots.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BotBrain } from "../src/game/ai/BotBrain";
import {
  GENE_NAMES,
  crossoverGenomes,
  defaultGenome,
  mutateGenome,
  randomGenome,
  type Genome,
} from "../src/game/ai/genome";
import { SKILLS } from "../src/game/ai/skill";
import type { GameMode } from "../src/game/config/levels";
import { THEME_ORDER } from "../src/game/config/themes";
import { Rng } from "../src/game/core/rng";
import { World } from "../src/game/core/World";

const GENERATIONS = Number(process.argv[2] ?? 36);
const POPULATION = Number(process.argv[3] ?? 24);
const HOLES_PER_MATCH = 10;
const MATCHES_PER_GENERATION = Math.ceil((POPULATION * 7) / (HOLES_PER_MATCH - 1));
const ELITES = 4;
const DT = 1 / 20;
const DURATION = 120;

interface Individual {
  genome: Genome;
  fitness: number;
  games: number;
}

interface MatchResult {
  /** Fitness per participant index (last entry is the baseline). */
  fitness: number[];
  baselineRank: number;
}

const rng = new Rng(20260929);

function runMatch(genomes: Genome[], seed: number): MatchResult {
  const matchRng = new Rng(seed);
  const mode: GameMode = matchRng.chance(0.6) ? "classic" : "battle";
  const world = new World({
    seed,
    themeId: matchRng.pick(THEME_ORDER),
    mode,
    duration: DURATION,
    blocksPerSide: matchRng.pick([5, 6]),
    holes: genomes.map((genome, i) => ({
      name: `g${i}`,
      skinId: "classic",
      isPlayer: false,
      controller: new BotBrain(genome, SKILLS.insane, new Rng(seed * 31 + i)),
    })),
  });
  world.running = true;
  while (!world.finished) {
    world.step(DT);
    world.events.length = 0;
    world.drainDirty(() => {});
  }

  const standings = world.standings();
  const n = standings.length;
  const topScore = Math.max(1, standings[0].hole.score);
  const fitness = new Array<number>(n).fill(0);
  let baselineRank = n;
  for (const { hole, rank } of standings) {
    const rankScore = (n - rank) / (n - 1);
    const scoreShare = hole.score / topScore;
    const survival = mode === "battle" && !hole.eliminated ? 0.3 : 0;
    fitness[hole.id] = rankScore + 0.6 * scoreShare + survival;
    if (hole.id === n - 1) baselineRank = rank;
  }
  return { fitness, baselineRank };
}

/** Plays a generation; each match holds 9 population members plus the baseline genome. */
function evaluate(population: Individual[], generation: number) {
  for (const ind of population) {
    ind.fitness = 0;
    ind.games = 0;
  }
  let order: number[] = [];
  let baselineRankSum = 0;
  for (let m = 0; m < MATCHES_PER_GENERATION; m++) {
    const members: number[] = [];
    while (members.length < HOLES_PER_MATCH - 1) {
      if (order.length === 0) order = rng.shuffle(population.map((_, i) => i));
      const next = order.pop()!;
      if (!members.includes(next)) members.push(next);
    }
    const genomes = [...members.map((i) => population[i].genome), defaultGenome()];
    const result = runMatch(genomes, generation * 1000 + m + 1);
    members.forEach((idx, slot) => {
      population[idx].fitness += result.fitness[slot];
      population[idx].games++;
    });
    baselineRankSum += result.baselineRank;
  }
  for (const ind of population) ind.fitness /= Math.max(1, ind.games);
  return baselineRankSum / MATCHES_PER_GENERATION;
}

function tournament(population: Individual[], size = 3) {
  let best = population[Math.floor(rng.next() * population.length)];
  for (let i = 1; i < size; i++) {
    const challenger = population[Math.floor(rng.next() * population.length)];
    if (challenger.fitness > best.fitness) best = challenger;
  }
  return best;
}

/** Names each finalist after the trait where it stands out most from the others. */
function personalities(genomes: Genome[]) {
  const traits: [string, (g: Genome) => number][] = [
    ["Predator", (g) => g.huntDrive + g.interceptLead * 0.5],
    ["Survivor", (g) => g.fleeRadius + g.dangerAversion * 0.5],
    ["Harvester", (g) => g.microWeight + g.valueExponent],
    ["Strategist", (g) => g.searchRadius / 60 + g.hysteresis],
  ];
  const stats = traits.map(([, score]) => {
    const values = genomes.map(score);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length) || 1;
    return { mean, std };
  });
  return genomes.map((g) => {
    let best = 0;
    let bestZ = -Infinity;
    traits.forEach(([, score], i) => {
      const z = (score(g) - stats[i].mean) / stats[i].std;
      if (z > bestZ) {
        bestZ = z;
        best = i;
      }
    });
    return traits[best][0];
  });
}

function main() {
  console.log(
    `Training: ${GENERATIONS} generations × ${MATCHES_PER_GENERATION} matches, population ${POPULATION}`,
  );
  const started = Date.now();

  let population: Individual[] = Array.from({ length: POPULATION }, (_, i) => ({
    genome: i === 0 ? defaultGenome() : i < POPULATION / 2 ? mutateGenome(defaultGenome(), rng, 1, 0.2) : randomGenome(rng),
    fitness: 0,
    games: 0,
  }));

  for (let gen = 0; gen < GENERATIONS; gen++) {
    const baselineRank = evaluate(population, gen);
    population.sort((a, b) => b.fitness - a.fitness);
    const best = population[0];
    const avg = population.reduce((s, p) => s + p.fitness, 0) / population.length;
    console.log(
      `gen ${String(gen + 1).padStart(2)}  best ${best.fitness.toFixed(3)}  avg ${avg.toFixed(3)}  baseline rank ${baselineRank.toFixed(2)}  (${((Date.now() - started) / 1000).toFixed(0)}s)`,
    );

    if (gen === GENERATIONS - 1) break;
    const strength = 0.16 * (1 - gen / GENERATIONS) + 0.03;
    const next: Individual[] = population.slice(0, ELITES).map((p) => ({ ...p }));
    while (next.length < POPULATION) {
      const a = tournament(population);
      const b = tournament(population);
      const child = rng.chance(0.75) ? crossoverGenomes(a.genome, b.genome, rng) : { ...a.genome };
      next.push({ genome: mutateGenome(child, rng, 0.35, strength), fitness: 0, games: 0 });
    }
    population = next;
  }

  // Final, more thorough evaluation of the top candidates.
  const finalists = population.slice(0, 8).map((p) => ({ ...p, fitness: 0, games: 0 }));
  let baselineRankSum = 0;
  const finalMatches = 24;
  for (let m = 0; m < finalMatches; m++) {
    const members = rng.shuffle(finalists.map((_, i) => i)).slice(0, HOLES_PER_MATCH - 1);
    const filler = members.length < HOLES_PER_MATCH - 1 ? HOLES_PER_MATCH - 1 - members.length : 0;
    const genomes = [
      ...members.map((i) => finalists[i].genome),
      ...Array.from({ length: filler }, () => defaultGenome()),
      defaultGenome(),
    ];
    const result = runMatch(genomes, 900000 + m);
    members.forEach((idx, slot) => {
      finalists[idx].fitness += result.fitness[slot];
      finalists[idx].games++;
    });
    baselineRankSum += result.baselineRank;
  }
  for (const f of finalists) f.fitness /= Math.max(1, f.games);
  finalists.sort((a, b) => b.fitness - a.fitness);

  const round = (genome: Genome) =>
    Object.fromEntries(GENE_NAMES.map((n) => [n, Number(genome[n].toFixed(4))])) as Genome;

  const output = {
    version: 1,
    generations: GENERATIONS,
    population: POPULATION,
    trainedAt: new Date().toISOString().slice(0, 10),
    note: "Evolved by scripts/train-bots.ts through self-play. Re-run `npm run train` to retrain.",
    baselineAverageRank: Number((baselineRankSum / finalMatches).toFixed(2)),
    brains: finalists.slice(0, 5).map((f, i, top) => ({
      name: `${personalities(top.map((t) => t.genome))[i]} ${String.fromCharCode(65 + i)}`,
      fitness: Number(f.fitness.toFixed(3)),
      genome: round(f.genome),
    })),
  };

  const target = resolve(__dirname, "../src/game/ai/trainedBrains.json");
  writeFileSync(target, JSON.stringify(output, null, 2) + "\n");
  console.log(`\nBaseline (hand-tuned) average rank vs. finalists: ${output.baselineAverageRank} / ${HOLES_PER_MATCH}`);
  console.log(output.brains.map((b) => `${b.name}: ${b.fitness}`).join("\n"));
  console.log(`Saved ${target} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main();
