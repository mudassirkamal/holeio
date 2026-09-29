import { KIND } from "../config/objectCatalog";
import type { Hole } from "../core/entities";
import type { GameEvent } from "../core/events";
import type { World } from "../core/World";
import { NET } from "./config";
import { HOLE_FIELDS, type ControlMessage, type FastMessage } from "./protocol";
import type { Room } from "./Room";

type Snap = Extract<FastMessage, { t: "snap" }>;
type EndMessage = Extract<ControlMessage, { t: "end" }>;

interface Sample {
  /** Local receive time, seconds. */
  at: number;
  snap: Snap;
}

const now = () => performance.now() / 1000;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Client side of a match. Other holes are shown slightly in the past and
 * interpolated between host snapshots; the player's own hole is predicted locally
 * from input (so it responds instantly) and gently reconciled with the host.
 * Gameplay events from the host drive swallowing animations in the replica world.
 */
export class ClientSync {
  private readonly samples: Sample[] = [];
  private pendingEvents: GameEvent[] = [];
  private inputTimer = 0;
  private wasAlive = true;
  private readonly unsubscribe: (() => void)[] = [];
  endMessage: EndMessage | null = null;
  hostRunning = false;

  constructor(
    private readonly room: Room,
    private readonly world: World,
    private readonly playerId: number,
  ) {
    this.unsubscribe.push(
      room.on("snapshot", (snap) => {
        // Ignore malformed snapshots rather than corrupting the replica.
        if (!Array.isArray(snap.holes) || snap.holes.length !== world.holes.length * HOLE_FIELDS || !snap.holes.every(Number.isFinite)) return;
        this.samples.push({ at: now(), snap });
        while (this.samples.length > 30) this.samples.shift();
        this.hostRunning = snap.running;
      }),
      room.on("events", (events) => {
        if (Array.isArray(events)) this.pendingEvents.push(...events.filter((e) => this.isValid(e)));
      }),
      room.on("movers", (states) => {
        const finiteList = (list: unknown, width: number) =>
          Array.isArray(list) && list.every((v) => v === null || (width === 1 ? Number.isFinite(v) : Array.isArray(v) && v.length === width && v.every(Number.isFinite)));
        if (finiteList(states?.cars, 8) && finiteList(states?.walkers, 1)) world.applyMoverStates(states);
      }),
      room.on("end", (msg) => {
        if (Array.isArray(msg.stats) && msg.stats.length === world.holes.length) this.endMessage = msg;
      }),
    );
  }

  /** Positions every hole for this step. Call after the player's input is set. */
  beforeStep(dt: number) {
    const latest = this.samples[this.samples.length - 1];
    if (!latest) return;

    const player = this.world.holes[this.playerId];
    this.inputTimer += dt;
    if (this.inputTimer >= NET.inputInterval) {
      this.inputTimer = 0;
      const { x, z, throttle } = player.input;
      this.room.sendInput(Math.round(x * 100) / 100, Math.round(z * 100) / 100, Math.round(throttle * 100) / 100);
    }

    // Host clock, extrapolated since the last snapshot.
    this.world.time = latest.snap.time + (this.hostRunning ? now() - latest.at : 0);
    this.world.running = this.hostRunning;

    const renderAt = now() - NET.interpolationDelay;
    for (const hole of this.world.holes) {
      if (hole.id === this.playerId) this.predictOwn(hole, latest, dt);
      else this.interpolate(hole, renderAt);
    }
  }

  private fields(snap: Snap, id: number) {
    return snap.holes.slice(id * HOLE_FIELDS, id * HOLE_FIELDS + HOLE_FIELDS);
  }

  /** Copies the non-positional state of a hole from a snapshot. */
  private applyState(hole: Hole, f: number[]) {
    hole.score = f[5];
    hole.objectScore = f[6];
    hole.alive = (f[7] & 1) === 1;
    hole.eliminated = (f[7] & 2) === 2;
    hole.respawnTimer = f[8];
    hole.protection = f[9];
    hole.combo = f[10];
  }

  private predictOwn(hole: Hole, latest: Sample, dt: number) {
    const f = this.fields(latest.snap, hole.id);
    this.applyState(hole, f);
    hole.radius += (f[4] - hole.radius) * Math.min(1, dt * 8);

    const respawned = hole.alive && !this.wasAlive;
    this.wasAlive = hole.alive;
    if (!hole.alive) return;

    if (this.hostRunning) this.world.moveHole(hole, dt);

    // Where the host will have us by the time our latest input arrives.
    const lead = this.room.rtt / 2000 + (now() - latest.at);
    const tx = f[0] + f[2] * lead;
    const tz = f[1] + f[3] * lead;
    const error = Math.hypot(tx - hole.x, tz - hole.z);
    if (respawned || error > 8) {
      hole.x = tx;
      hole.z = tz;
    } else {
      const k = Math.min(1, dt * 4);
      hole.x += (tx - hole.x) * k;
      hole.z += (tz - hole.z) * k;
    }
  }

  private interpolate(hole: Hole, renderAt: number) {
    const samples = this.samples;
    let a = samples[0];
    let b = samples[samples.length - 1];
    for (let i = samples.length - 1; i > 0; i--) {
      if (samples[i - 1].at <= renderAt) {
        a = samples[i - 1];
        b = samples[i];
        break;
      }
    }
    const fa = this.fields(a.snap, hole.id);
    const fb = this.fields(b.snap, hole.id);
    this.applyState(hole, fb);

    const span = b.at - a.at;
    let t = span > 1e-4 ? (renderAt - a.at) / span : 1;
    // Past the newest sample: extrapolate briefly along its velocity.
    const extra = t > 1 ? Math.min(0.25, renderAt - b.at) : 0;
    t = Math.max(0, Math.min(1, t));
    hole.x = lerp(fa[0], fb[0], t) + fb[2] * extra;
    hole.z = lerp(fa[1], fb[1], t) + fb[3] * extra;
    hole.vx = fb[2];
    hole.vz = fb[3];
    hole.radius = lerp(fa[4], fb[4], t);
  }

  /** Only accept events that reference holes, objects and kinds that exist. */
  private isValid(e: GameEvent) {
    const hole = (id: unknown) => Number.isInteger(id) && (id as number) >= 0 && (id as number) < this.world.holes.length;
    switch (e?.type) {
      case "fallStart":
        return hole(e.holeId) && Number.isInteger(e.objectId) && e.objectId >= 0 && e.objectId < this.world.objects.length;
      case "objectEaten":
        return hole(e.holeId) && e.kindId in KIND && Number.isFinite(e.value);
      case "levelUp":
        return hole(e.holeId) && Number.isFinite(e.level);
      case "holeEaten":
        return hole(e.eaterId) && hole(e.victimId) && Number.isFinite(e.gain);
      case "holeRespawned":
        return hole(e.holeId);
      default:
        return false;
    }
  }

  /**
   * Host events for this step. Falls are started in the replica world (which emits
   * its own local fallStart for effects), everything else is passed to the session.
   */
  takeEvents(): GameEvent[] {
    if (this.pendingEvents.length === 0) return [];
    const events = this.pendingEvents;
    this.pendingEvents = [];
    const forward: GameEvent[] = [];
    for (const e of events) {
      if (e.type === "fallStart") {
        this.world.replicateFall(e.objectId, e.holeId);
        continue;
      }
      if (e.type === "holeEaten") {
        const victim = this.world.holes[e.victimId];
        victim.alive = false;
        victim.eatenBy = e.eaterId;
      }
      if (e.type === "levelUp") this.world.holes[e.holeId].sizeLevel = e.level;
      forward.push(e);
    }
    return forward;
  }

  dispose() {
    for (const off of this.unsubscribe) off();
  }
}
