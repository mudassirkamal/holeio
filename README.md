# Hole Rush

A hole.io-style 3D arena game for the browser. You are a hole in the ground: swallow
people, cars, trees and eventually whole skyscrapers, grow bigger than everyone else and
swallow rival holes — all controlled by AI bots whose strategy was evolved by self-play.

Built with **Next.js 16**, **React 19**, **Three.js** and **TypeScript**.

## Features

- **Five hand-styled worlds, generated procedurally**: Metro City, Sunset Suburbs,
  Neon Nights, Frost Town and Palm Beach — roads with traffic that turns at
  intersections, pedestrians, parks, plazas, parking lots, beaches and downtown towers.
- **Three modes**: Classic (biggest hole when time runs out, respawn when eaten),
  Battle Royale (no respawns, last hole standing) and Solo (swallow a % of the city).
- **20 campaign levels** with 1–3 stars each, plus a fully configurable Quick Play.
- **20 skins** — solid, gradient, stripes, polka, checkered, neon pulse, lava, toxic,
  ice, electric, matrix, rainbow, galaxy and gold — with particle trails, unlocked with
  coins, stars or level progress.
- **Strategic AI bots** (see below) at four difficulty levels.
- **Graphics**: stencil-buffer holes you really see objects fall into, procedural
  low-poly models (40+ object types), procedural windows that light up at night, soft
  shadows, ambient occlusion (N8AO), bloom, neutral tone mapping, weather (snow, falling
  leaves, fireflies), dust and sparkle particles, shockwaves, and see-through buildings
  when they block your hole. Four quality presets (auto-detected).
- **Audio** synthesized at runtime with WebAudio (no audio files): swallow pops pitched
  by object size, size-ups, combos, hole kills and an adaptive music loop.
- Mouse, keyboard (WASD / arrows) and touch (floating joystick) controls; responsive
  layout for phones and desktops; progress saved in `localStorage`.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # static export in ./out (deploy anywhere, e.g. Vercel)
npm run lint
npm run typecheck
npm run simulate -- metro classic 9 hard 6   # headless match for balancing
npm run balance                              # campaign difficulty check
npm run train -- 48 26                       # re-evolve the bot brains
```

## How to play

- Move the mouse — your hole follows the cursor (or use WASD / arrows, or drag on touch).
- Anything smaller than your hole falls in; bigger objects wobble at the edge.
- Every swallow grows your hole. Fast chains of bites build combos.
- A hole at least 14% wider can swallow a smaller hole whose center it covers.

## The AI

Each bot runs a utility-based decision loop (`src/game/ai/BotBrain.ts`) every
reaction tick:

1. **Perception** — holes within its vision are classified as *threats* (big enough to
   eat it), *prey* (small enough to eat) or *rivals*.
2. **Survival** — if a threat enters its danger zone it flees, weighting threats by
   proximity and whether they are heading toward it, steering away from walls so it
   can't be cornered, and still grabbing food on the safe side.
3. **Hunt vs. farm** — it compares the points-per-second of its best chase (with
   intercept prediction, a bonus for prey pinned against walls and a revenge bonus
   for whoever ate it last) against the best food area on a bucketed *value field*
   that knows what a hole of its size can actually swallow in every cell — discounted
   for danger nearby and for rivals that will get there first.
4. **Micro steering** — it sweeps individual objects around it on the way.

The 16 weights of this brain (`src/game/ai/genome.ts`) are **evolved with a genetic
algorithm through self-play** (`scripts/train-bots.ts`): populations of genomes play
thousands of headless 10-hole matches (classic and battle royale, random cities);
the fittest breed with blend crossover and annealed mutation, and the best distinct
genomes ship in `src/game/ai/trainedBrains.json`. Difficulty levels then layer
human-like limits on top — reaction time, aim noise, turn rate, vision range, and the
occasional distraction.

## Project structure

```
src/
  app/                  Next.js app router (layout, page, global styles)
  components/           React UI: menus, level select, skin shop, HUD, results
  store/                Zustand stores (persisted profile, app/session state)
  game/
    config/             Constants, object catalog, themes, levels, skins
    core/               Pure TS simulation: city generator, world, traffic,
                        spatial grid, value field, holes and falling physics
    ai/                 Bot brain, genome, skill profiles, trained brains, roster
    render/             Three.js: scene view, hole stencil + skin shaders,
                        procedural models, city material, ground, sky, effects
    engine/             Game session loop tying simulation, rendering and UI
    input/              Mouse / keyboard / touch input
    audio/              WebAudio synthesizer
scripts/
  simulate.ts           Headless match runner for balancing
  balance.ts            Plays every campaign level with a player proxy
  train-bots.ts         Genetic-algorithm trainer for the bot brains
```

The simulation core has no rendering dependencies, which is what makes headless
training and balancing possible. Change `GAME_NAME` in
`src/game/config/constants.ts` to rename the game.
