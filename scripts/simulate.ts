/**
 * Headless match runner for balancing:
 * `npm run simulate -- [theme] [mode] [bots] [difficulty] [blocks] [seed] [powerups: on|off]`.
 * Prints object counts, simulation speed and the final standings.
 */
import { createBots } from "../src/game/ai/roster";
import { holeRadiusForScore } from "../src/game/config/constants";
import type { Difficulty, GameMode } from "../src/game/config/levels";
import type { ThemeId } from "../src/game/config/themes";
import { Rng } from "../src/game/core/rng";
import { World } from "../src/game/core/World";

const [theme = "metro", mode = "classic", bots = "9", difficulty = "hard", blocks = "6", seed = "7", powerUps = "on"] = process.argv.slice(2);

const rng = new Rng(Number(seed));
const holes = createBots(Number(bots), difficulty as Difficulty, rng);
const world = new World({
  seed: Number(seed),
  themeId: theme as ThemeId,
  mode: mode as GameMode,
  duration: 120,
  blocksPerSide: Number(blocks),
  holes,
  powerUps: powerUps === "on",
});

const counts = new Map<string, number>();
for (const o of world.objects) counts.set(o.kind.id, (counts.get(o.kind.id) ?? 0) + 1);
console.log(`map ${(world.half * 2).toFixed(0)}m, ${world.objects.length} objects, total value ${world.totalValue}`);
console.log([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));

world.running = true;
const dt = 1 / 30;
const started = performance.now();
let steps = 0;
let kills = 0;
let friendlyKills = 0;
const pickups = new Map<string, number>();
while (!world.finished) {
  world.step(dt);
  for (const e of world.events) {
    if (e.type === "powerUpTaken") pickups.set(e.kind, (pickups.get(e.kind) ?? 0) + 1);
    if (e.type !== "holeEaten") continue;
    kills++;
    if (world.areTeammates(world.holes[e.eaterId], world.holes[e.victimId])) friendlyKills++;
  }
  world.events.length = 0;
  world.drainDirty(() => {});
  steps++;
  if (steps % 900 === 0) {
    const top = world.standings()[0].hole;
    console.log(`t=${world.time.toFixed(0)}s leader ${top.name} score ${top.score.toFixed(0)} r=${top.radius.toFixed(1)}`);
  }
}
const ms = performance.now() - started;
console.log(`simulated ${world.time.toFixed(1)}s in ${ms.toFixed(0)}ms (${(ms / steps).toFixed(2)}ms/step), kills ${kills}`);
if (pickups.size) console.log(`power-ups taken: ${[...pickups.entries()].map(([k, v]) => `${k}:${v}`).join(" ")}`);
for (const { hole, rank } of world.standings()) {
  console.log(
    `${String(rank).padStart(2)}. ${hole.name.padEnd(10)} score ${hole.score.toFixed(0).padStart(6)}  r=${holeRadiusForScore(hole.score).toFixed(1).padStart(5)}  eaten ${String(hole.objectsEaten).padStart(4)}  kills ${hole.kills} deaths ${hole.deaths}  ${world.percentEaten(hole).toFixed(1)}%${hole.eliminated ? " (out)" : ""}`,
  );
}
if (world.mode === "teams") {
  const [red, blue] = world.teamScores().map(Math.round);
  console.log(`teams: red ${red} vs blue ${blue}, friendly kills ${friendlyKills}`);
}
