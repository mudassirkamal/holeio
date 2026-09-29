import { createBotBrain } from "../ai/roster";
import type { Difficulty } from "../config/levels";
import type { Hole, HoleController } from "../core/entities";
import type { GameEvent } from "../core/events";
import { clamp } from "../core/math";
import type { Rng } from "../core/rng";
import type { World } from "../core/World";
import { NET } from "./config";
import { round2, type HoleStats } from "./protocol";
import type { Room } from "./Room";

/** Drives a hole from the latest input a remote player sent. */
export class RemoteController implements HoleController {
  private x = 0;
  private z = 0;
  private throttle = 0;

  setInput(x: number, z: number, throttle: number) {
    // Inputs come from the network: keep them finite and in range.
    this.x = Number.isFinite(x) ? clamp(x, -1e3, 1e3) : 0;
    this.z = Number.isFinite(z) ? clamp(z, -1e3, 1e3) : 0;
    this.throttle = Number.isFinite(throttle) ? clamp(throttle, 0, 1) : 0;
  }

  update(_world: World, hole: Hole) {
    hole.input.x = this.x;
    hole.input.z = this.z;
    hole.input.throttle = this.throttle;
  }
}

export function packHoles(world: World) {
  const data: number[] = [];
  for (const h of world.holes) {
    data.push(
      round2(h.x),
      round2(h.z),
      round2(h.vx),
      round2(h.vz),
      round2(h.radius),
      Math.round(h.score),
      Math.round(h.objectScore),
      (h.alive ? 1 : 0) | (h.eliminated ? 2 : 0),
      round2(h.respawnTimer),
      round2(h.protection),
      h.combo,
    );
    for (const t of h.powers) data.push(Math.round(t * 10) / 10);
  }
  return data;
}

export const holeStats = (h: Hole): HoleStats => ({
  score: Math.round(h.score),
  objectScore: Math.round(h.objectScore),
  kills: h.kills,
  deaths: h.deaths,
  objectsEaten: h.objectsEaten,
  bestCombo: h.bestCombo,
  sizeLevel: h.sizeLevel,
  eliminated: h.eliminated,
  eliminatedAt: h.eliminatedAt,
  biggestBite: h.biggestBite,
});

/** Trims event payloads before they go over the wire. */
function compact(e: GameEvent): GameEvent {
  if ("x" in e) return { ...e, x: Math.round(e.x * 10) / 10, z: Math.round(e.z * 10) / 10 };
  return e;
}

/**
 * Host side of a match: applies remote inputs, streams hole snapshots (20 Hz),
 * batches gameplay events, periodically corrects traffic on clients, and hands a
 * player's hole to a bot if they disconnect.
 */
export class HostSync {
  private snapTimer = 0;
  private moverTimer = 0;
  private events: GameEvent[] = [];
  private readonly unsubscribe: (() => void)[] = [];

  constructor(
    private readonly room: Room,
    private readonly world: World,
    remotes: Map<string, { holeId: number; controller: RemoteController }>,
    difficulty: Difficulty,
    rng: Rng,
  ) {
    this.unsubscribe.push(
      room.on("input", (peerId, msg) => remotes.get(peerId)?.controller.setInput(msg.x, msg.z, msg.throttle)),
      room.on("playerLeft", (peerId) => {
        const remote = remotes.get(peerId);
        if (!remote) return;
        remotes.delete(peerId);
        world.holes[remote.holeId].controller = createBotBrain(remote.holeId, difficulty, rng);
      }),
    );
  }

  afterStep(dt: number, events: readonly GameEvent[]) {
    for (const e of events) if (e.type !== "matchEnd") this.events.push(compact(e));

    this.snapTimer += dt;
    if (this.snapTimer >= NET.snapshotInterval) {
      this.snapTimer = 0;
      this.room.broadcastEvents(this.events);
      this.events = [];
      this.room.broadcastSnapshot({ t: "snap", time: round2(this.world.time), running: this.world.running, holes: packHoles(this.world) });
    }

    this.moverTimer += dt;
    if (this.moverTimer >= NET.moverSyncInterval) {
      this.moverTimer = 0;
      this.room.broadcastMovers(this.world.moverStates());
    }
  }

  finish() {
    this.room.broadcastEvents(this.events);
    this.events = [];
    this.room.broadcastSnapshot({ t: "snap", time: round2(this.world.time), running: false, holes: packHoles(this.world) });
    this.room.broadcastEnd({ t: "end", time: this.world.time, stats: this.world.holes.map(holeStats) });
  }

  dispose() {
    for (const off of this.unsubscribe) off();
  }
}

