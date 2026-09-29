# Hole Rush

A hole.io-style 3D arena game for the browser. You are a hole in the ground: swallow
people, cars, trees and eventually whole skyscrapers, grow bigger than everyone else and
swallow rival holes — all controlled by AI bots whose strategy was evolved by self-play.

Built with **Next.js 16**, **React 19**, **Three.js** and **TypeScript**.

## Features

- **Five hand-styled worlds, generated procedurally**: Metro City, Sunset Suburbs,
  Neon Nights, Frost Town and Palm Beach — roads with traffic that turns at
  intersections, pedestrians, parks, plazas, parking lots, beaches and downtown towers.
- **Themed city walls** around every map: a concrete hazard barrier in Metro City,
  a white picket fence in the Suburbs, a glowing laser fence in Neon Nights, a snowy
  log fence in Frost Town and a rope boardwalk fence in Palm Beach — each with corner
  towers and flag or lamp posts. Holes stay inside the walls.
- **Four modes**: Classic (biggest hole when time runs out, respawn when eaten),
  Battle Royale (no respawns, last hole standing), Solo (swallow a % of the city) and
  **Teams** — Red vs Blue from 2v2 to 6v6, where teammates can't eat each other and the
  team with the biggest combined size wins. Bots play as teammates too and defend
  smaller teammates from enemies.
- **Power-ups** that spawn around the city in Quick Play and online matches (switch them
  off in the match settings): ⚡ **Turbo** (50% faster), 🧲 **Magnet** (pulls in anything
  you can swallow within 1.5× your size — it slides to the rim and drops in), 🛡️ **Shield**
  (nobody can swallow you) and 🍄 **Giant** (35% bigger for a while). Each pickup glows
  with a light beam, shows on the minimap and blinks before it fades; active power-ups
  get a timer in the HUD, an effect around the hole and an icon on the name tag. Bots
  detour for nearby pickups and play fearless while shielded. The 20 campaign levels are
  balanced without them.
- **Shareable highlight clips**: the game keeps the last seconds of play encoded in
  memory and automatically cuts your best moment (kills, skyscrapers, big combos) into a
  short video with sound, name tags, a caption and a watermark. Tap 🎬 to clip any
  moment yourself; share straight to WhatsApp, Instagram and co. from the results screen
  (or save the file).
- **20 campaign levels** with 1–3 stars each, plus a fully configurable Quick Play.
- **20 skins** — solid, gradient, stripes, polka, checkered, neon pulse, lava, toxic,
  ice, electric, matrix, rainbow, galaxy and gold — with particle trails, unlocked with
  coins, stars or level progress.
- **Online multiplayer with voice chat** (see below): quick match with players
  worldwide, private rooms with codes/invite links, and local-network play — with or
  without internet.
- **Strategic AI bots** (see below) at four difficulty levels.
- **Graphics**: stencil-buffer holes you really see objects fall into, procedural
  low-poly models (40+ object types), procedural windows that light up at night, soft
  shadows, ambient occlusion (N8AO), bloom, neutral tone mapping, weather (snow, falling
  leaves, fireflies), dust and sparkle particles, shockwaves, and see-through buildings
  when they block your hole. Four quality presets (auto-detected).
- **Audio** synthesized at runtime with WebAudio (no audio files): swallow pops pitched
  by object size, size-ups, combos, hole kills and an adaptive music loop.
- Mouse, keyboard (WASD / arrows) and touch controls; progress saved in `localStorage`.
- **Built for phones**: a floating joystick that follows your thumb, vibration on big
  swallows and kills (Android), layouts for portrait and landscape that stay clear of
  notches, a wider portrait camera, adaptive resolution that keeps the frame rate up,
  rendering capped for 120 Hz screens to save battery, and an installable app
  (Add to Home Screen) that launches full screen.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # production build (deploy to Vercel, or `npm start`)
npm run lint
npm run typecheck
npm run simulate -- metro classic 9 hard 6 7 on   # headless match (theme mode bots difficulty blocks seed power-ups)
npm run balance                              # campaign difficulty check
npm run lan                                  # build + serve for offline LAN play (HTTPS :8443)
npm run train -- 48 26                       # re-evolve the bot brains
```

## Multiplayer

Open **Multiplayer** from the main menu:

| Option | What it does |
|---|---|
| **Quick Match** | Joins an open public room, or hosts one if none is free. Public rooms start automatically 20 s after a second player joins; bots fill empty seats. |
| **Private Room** | Creates a room with a 5-letter code and an invite link (`?room=CODE`) to share with friends anywhere. The host picks mode (Classic, Battle Royale or Teams), city, map size, length, bot count/team size, bot difficulty and whether power-ups spawn. In Teams, players pick Red or Blue (or the host shuffles) and bots fill the empty seats. |
| **Join with a code** | Enter a friend's room code. |
| **Local network** | Players on the same Wi-Fi use private rooms; game traffic flows directly between the devices. For play **without internet**, run `npm run lan` on one computer and open the address it prints on every device. |

Up to 8 players per room (12 holes including bots).

**Team voice** — in a Teams match you only talk with your own team, at full volume
wherever they are; the other team receives silence, not just a muted stream. Everyone
hears each other again back in the lobby.

**Voice chat** — switch the mic on in the lobby or during a match. Choose open mic or
push-to-talk (hold **V** or the mic button). Mute anyone from the lobby, see who is
talking, and in matches voices fade with distance between holes (proximity chat).
Browsers only allow the microphone on HTTPS pages, which the deployed site and
`npm run lan` both provide.

### How it works

- Peer-to-peer WebRTC via [PeerJS](https://peerjs.com): there is no game server to run.
  Players find each other through the free public PeerJS signaling server, or through
  the built-in one when served by `npm run lan`. A TURN relay (below) covers players
  who can't connect directly.
- The **host's browser is authoritative**: it runs the simulation, the bots and the
  rules. Clients send their input (30 Hz) and receive hole snapshots (20 Hz, including
  power-up timers) plus gameplay events (swallows, kills, level-ups, power-ups spawned
  and collected) over reliable/unordered data channels.
- Clients **predict their own hole** so steering feels instant, interpolate other holes
  100 ms in the past, and animate falls locally from host events. Traffic is
  deterministic (each car has its own random stream), with a small correction every
  2 s, so the whole city stays in sync for ~3 KB.
- If a player disconnects mid-match, a bot takes over their hole. If the host leaves,
  the room closes.

### TURN relay (so everyone can connect)

Most players connect directly. Players behind strict networks — some mobile carriers,
office and school Wi-Fi, symmetric NATs — can't, and need a **TURN relay** that forwards
their traffic. WebRTC encrypts everything end to end, so the relay only sees ciphertext.

The game asks `GET /api/ice` (`src/app/api/ice/route.ts`) for relay servers. The provider
secret stays on the server; browsers only get short-lived credentials (24 h). Set **one**
of these as environment variables (on Vercel: *Project → Settings → Environment
Variables*, then redeploy; locally: `.env.local`):

| Provider | Variables |
|---|---|
| **Cloudflare Realtime TURN** (recommended — first 1,000 GB/month free, global) | `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` |
| **Metered** (free tier) | `METERED_TURN_DOMAIN` (e.g. `yourapp.metered.live`), `METERED_TURN_API_KEY` |
| Any TURN server, e.g. your own coturn | `TURN_URLS` (comma-separated `turn:`/`turns:` URLs), `TURN_USERNAME`, `TURN_CREDENTIAL` |

Cloudflare setup: in the Cloudflare dashboard open **Realtime → TURN Server → Create**,
then copy the *Turn Token ID* into `CLOUDFLARE_TURN_KEY_ID` and the *API Token* into
`CLOUDFLARE_TURN_API_TOKEN`.

When a relay is configured, the Multiplayer screen shows **"Relay server on"**. Without
one, the game still works for everyone who can connect directly.

## How to play

- Move the mouse — your hole follows the cursor (or use WASD / arrows, or drag anywhere
  on a touch screen).
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
  app/                  Next.js app router (layout, page, global styles,
                        api/ice: TURN relay credentials)
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
    net/                Rooms/lobby (PeerJS), host & client sync, voice chat
    clips/              Rolling WebCodecs recorder, highlight picking, clip overlay
    input/              Mouse / keyboard / touch input
    audio/              WebAudio synthesizer
scripts/
  simulate.ts           Headless match runner for balancing
  balance.ts            Plays every campaign level with a player proxy
  train-bots.ts         Genetic-algorithm trainer for the bot brains
  lan-server.ts         Local game + signaling server for offline LAN play
```

The simulation core has no rendering dependencies, which is what makes headless
training and balancing possible. Change `GAME_NAME` in
`src/game/config/constants.ts` to rename the game.
