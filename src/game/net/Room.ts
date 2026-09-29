import type { DataConnection, Peer } from "peerjs";
import { createBotRoster } from "../ai/roster";
import { DEFAULT_SKIN, SKIN_BY_ID } from "../config/skins";
import { THEME_ORDER } from "../config/themes";
import type { GameEvent } from "../core/events";
import { Rng } from "../core/rng";
import type { World } from "../core/World";
import { NET, publicPeerId, randomRoomCode, roomPeerId, signaling } from "./config";
import {
  PROTOCOL_VERSION,
  type ControlMessage,
  type FastMessage,
  type LobbyPlayer,
  type LobbyState,
  type MatchStart,
  type PlayerProfile,
  type RejectReason,
  type RosterEntry,
  type RoomSettings,
} from "./protocol";

type Handler<A extends unknown[]> = (...args: A) => void;

/** Minimal typed event emitter. */
class Emitter<E extends { [K in keyof E]: unknown[] }> {
  private readonly handlers: { [K in keyof E]?: Set<Handler<E[K]>> } = {};

  on<K extends keyof E>(event: K, handler: Handler<E[K]>) {
    const set = (this.handlers[event] ??= new Set());
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  protected emit<K extends keyof E>(event: K, ...args: E[K]) {
    this.handlers[event]?.forEach((handler) => handler(...args));
  }
}

export type NetErrorCode = "not-found" | "timeout" | "id-taken" | "rejected" | "network" | "unsupported";

export class NetError extends Error {
  constructor(
    readonly code: NetErrorCode,
    message: string,
    readonly reason?: RejectReason,
  ) {
    super(message);
  }
}

type SnapMessage = Extract<FastMessage, { t: "snap" }>;
type InputMessage = Extract<FastMessage, { t: "input" }>;
type EndMessage = Extract<ControlMessage, { t: "end" }>;
type MoverStates = ReturnType<World["moverStates"]>;

export type RoomEvents = {
  lobby: [LobbyState];
  start: [MatchStart];
  closed: [reason: string];
  snapshot: [SnapMessage];
  events: [GameEvent[]];
  movers: [MoverStates];
  end: [EndMessage];
  lobbyReturn: [];
  input: [peerId: string, input: InputMessage];
  playerLeft: [peerId: string];
};

interface Channel {
  control: DataConnection;
  fast: DataConnection | null;
  lastSeen: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  mode: "classic",
  themeId: "random",
  duration: 120,
  blocksPerSide: 5,
  bots: 5,
  teamSize: 4,
  difficulty: "normal",
  powerUps: true,
};

async function createPeer(id?: string): Promise<Peer> {
  const { default: PeerClass } = await import("peerjs");
  const { options } = await signaling();
  return new Promise((resolve, reject) => {
    const peer = id ? new PeerClass(id, options) : new PeerClass(options);
    const timer = window.setTimeout(() => {
      peer.destroy();
      reject(new NetError("network", "Couldn't reach the matchmaking server. Check your connection."));
    }, 10000);
    peer.once("open", () => {
      window.clearTimeout(timer);
      resolve(peer);
    });
    peer.once("error", (err) => {
      window.clearTimeout(timer);
      peer.destroy();
      if (err.type === "unavailable-id") reject(new NetError("id-taken", "That room id is taken."));
      else if (err.type === "browser-incompatible") reject(new NetError("unsupported", "This browser doesn't support online play."));
      else reject(new NetError("network", "Couldn't reach the matchmaking server. Check your connection."));
    });
  });
}

const send = (conn: DataConnection | null | undefined, msg: ControlMessage | FastMessage) => {
  if (conn?.open) void conn.send(msg);
};

/**
 * A multiplayer room over WebRTC. The host's browser is authoritative: it keeps the
 * lobby, starts matches and runs the simulation; clients stream inputs to it and
 * receive state back. Each client keeps two data channels to the host — an ordered
 * "control" channel (lobby, events) and an unordered "fast" one (snapshots, input).
 */
export class Room extends Emitter<RoomEvents> {
  lobby: LobbyState;
  /** Client: round-trip time to the host in ms. */
  rtt = 0;
  private readonly channels = new Map<string, Channel>();
  private hostControl: DataConnection | null = null;
  private hostFast: DataConnection | null = null;
  private readonly intervals: number[] = [];
  private isClosed = false;

  private constructor(
    readonly role: "host" | "client",
    readonly peer: Peer,
    lobby: LobbyState,
  ) {
    super();
    this.lobby = lobby;
    peer.on("disconnected", () => {
      // Signaling dropped; data channels survive, but reconnect for new peers/voice.
      if (!peer.destroyed) window.setTimeout(() => !peer.destroyed && peer.reconnect(), 1000);
    });
    peer.on("error", (err) => {
      if (err.type === "network" || err.type === "server-error") return;
      console.warn("[net]", err.type, err.message);
    });
  }

  get myPeerId() {
    return this.peer.id;
  }

  get isHost() {
    return this.role === "host";
  }

  // ---------------------------------------------------------------------------
  // Creating and joining
  // ---------------------------------------------------------------------------

  /** Hosts a private room with a fresh code, or a public room in a free quick-match slot. */
  static async host(profile: PlayerProfile, options: { isPublic: boolean }): Promise<Room> {
    const ids = options.isPublic
      ? Array.from({ length: NET.publicSlots }, (_, i) => ({ id: publicPeerId(i + 1), code: `PUBLIC ${i + 1}` }))
      : Array.from({ length: 5 }, () => {
          const code = randomRoomCode();
          return { id: roomPeerId(code), code };
        });
    for (const { id, code } of ids) {
      try {
        const peer = await createPeer(id);
        return Room.createHost(peer, profile, code, options.isPublic);
      } catch (err) {
        if (err instanceof NetError && err.code === "id-taken") continue;
        throw err;
      }
    }
    throw new NetError("id-taken", options.isPublic ? "All public rooms are busy. Try again soon." : "Couldn't create a room. Try again.");
  }

  private static createHost(peer: Peer, profile: PlayerProfile, code: string, isPublic: boolean) {
    const lobby: LobbyState = {
      code,
      isPublic,
      phase: "lobby",
      players: [{ ...sanitize(profile), peerId: peer.id, isHost: true, ready: true, ping: 0, team: 0 }],
      settings: isPublic ? { ...DEFAULT_SETTINGS, bots: 6 } : { ...DEFAULT_SETTINGS },
      autoStartAt: null,
    };
    const room = new Room("host", peer, lobby);
    room.listenAsHost();
    return room;
  }

  static async join(code: string, profile: PlayerProfile): Promise<Room> {
    const peer = await createPeer();
    try {
      return await Room.connect(peer, roomPeerId(code), profile);
    } catch (err) {
      peer.destroy();
      throw err;
    }
  }

  /**
   * Quick match: join the first open public room, otherwise host one in a free slot.
   * Public rooms live at well-known peer ids, so no lobby server is needed.
   */
  static async quickMatch(profile: PlayerProfile, onStatus?: (text: string) => void): Promise<Room> {
    const peer = await createPeer();
    for (let slot = 1; slot <= NET.publicSlots; slot++) {
      onStatus?.(`Looking for a public match (${slot}/${NET.publicSlots})…`);
      try {
        return await Room.connect(peer, publicPeerId(slot), profile);
      } catch {
        // Empty, full or already playing: try the next slot.
      }
    }
    peer.destroy();
    onStatus?.("No open match found — hosting a new public room…");
    return Room.host(profile, { isPublic: true });
  }

  private static connect(peer: Peer, target: string, profile: PlayerProfile): Promise<Room> {
    return new Promise((resolve, reject) => {
      const control = peer.connect(target, { label: "control", reliable: true, serialization: "json" });
      let settled = false;
      const cleanup = () => {
        settled = true;
        window.clearTimeout(timer);
        peer.off("error", onPeerError);
      };
      const fail = (error: NetError) => {
        if (settled) return;
        cleanup();
        try {
          control.close();
        } catch {
          // PeerJS may already have torn down a connection to a missing peer.
        }
        reject(error);
      };
      const timer = window.setTimeout(() => fail(new NetError("timeout", "The room didn't answer. It may be behind a strict network.")), NET.joinTimeoutMs);
      const onPeerError = (err: { type: string; message: string }) => {
        if (err.type === "peer-unavailable" && err.message.includes(target)) fail(new NetError("not-found", "Room not found. Check the code."));
      };
      peer.on("error", onPeerError);

      control.on("open", () => send(control, { t: "hello", version: PROTOCOL_VERSION, profile }));
      control.on("data", function onFirst(data) {
        const msg = data as ControlMessage;
        if (msg.t === "reject") {
          const text = msg.reason === "full" ? "That room is full." : msg.reason === "in-game" ? "That match already started." : "That room runs a different game version.";
          fail(new NetError("rejected", text, msg.reason));
        } else if (msg.t === "welcome" && !settled) {
          cleanup();
          control.off("data", onFirst);
          const room = new Room("client", peer, msg.lobby);
          room.attachHost(control);
          resolve(room);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Host side
  // ---------------------------------------------------------------------------

  private listenAsHost() {
    this.peer.on("connection", (conn) => {
      if (conn.label === "fast") {
        const channel = this.channels.get(conn.peer);
        if (!channel) return conn.close();
        channel.fast = conn;
        conn.on("data", (data) => {
          const msg = data as FastMessage;
          channel.lastSeen = Date.now();
          if (msg.t === "input") this.emit("input", conn.peer, msg);
        });
        return;
      }
      conn.on("data", (data) => this.onHostControl(conn, data as ControlMessage));
      conn.on("close", () => this.removePlayer(conn.peer));
      conn.on("error", () => this.removePlayer(conn.peer));
    });

    this.intervals.push(
      window.setInterval(() => {
        const now = Date.now();
        for (const [peerId, channel] of this.channels) {
          send(channel.control, { t: "ping", at: now });
          if (now - channel.lastSeen > 12000) this.removePlayer(peerId);
        }
        this.updateAutoStart(now);
        if (this.lobby.phase === "lobby") this.broadcastLobby();
      }, 2000),
    );
  }

  private onHostControl(conn: DataConnection, msg: ControlMessage) {
    const channel = this.channels.get(conn.peer);
    if (channel) channel.lastSeen = Date.now();
    switch (msg.t) {
      case "hello": {
        const reject = (reason: RejectReason) => {
          send(conn, { t: "reject", reason });
          window.setTimeout(() => conn.close(), 500);
        };
        if (msg.version !== PROTOCOL_VERSION) return reject("version");
        if (this.lobby.phase !== "lobby") return reject("in-game");
        if (this.lobby.players.length >= NET.maxPlayers) return reject("full");
        this.channels.set(conn.peer, { control: conn, fast: null, lastSeen: Date.now() });
        this.lobby.players.push({ ...sanitize(msg.profile), peerId: conn.peer, isHost: false, ready: false, ping: 0, team: this.smallerTeam() });
        send(conn, { t: "welcome", you: conn.peer, lobby: this.lobby });
        this.updateAutoStart(Date.now());
        this.broadcastLobby();
        break;
      }
      case "profile":
        this.patchPlayer(conn.peer, sanitize(msg.profile));
        break;
      case "ready":
        this.patchPlayer(conn.peer, { ready: msg.ready });
        break;
      case "team":
        this.assignTeam(conn.peer, msg.team);
        break;
      case "ping":
        send(conn, { t: "pong", at: msg.at });
        break;
      case "pong": {
        const player = this.lobby.players.find((p) => p.peerId === conn.peer);
        if (player) player.ping = Date.now() - msg.at;
        break;
      }
      default:
        break;
    }
  }

  private patchPlayer(peerId: string, patch: Partial<LobbyPlayer>) {
    const player = this.lobby.players.find((p) => p.peerId === peerId);
    if (!player) return;
    Object.assign(player, patch);
    this.broadcastLobby();
  }

  private removePlayer(peerId: string) {
    const channel = this.channels.get(peerId);
    if (!channel) return;
    this.channels.delete(peerId);
    channel.control.close();
    channel.fast?.close();
    this.lobby.players = this.lobby.players.filter((p) => p.peerId !== peerId);
    if (this.lobby.phase === "playing") this.emit("playerLeft", peerId);
    this.updateAutoStart(Date.now());
    this.broadcastLobby();
  }

  private updateAutoStart(now: number) {
    if (!this.lobby.isPublic || this.lobby.phase !== "lobby") return;
    if (this.lobby.players.length < 2) {
      this.lobby.autoStartAt = null;
    } else if (this.lobby.autoStartAt === null) {
      this.lobby.autoStartAt = now + NET.publicAutoStartMs;
    } else if (now >= this.lobby.autoStartAt) {
      this.start();
    }
  }

  private broadcastLobby() {
    this.emit("lobby", this.lobby);
    for (const channel of this.channels.values()) send(channel.control, { t: "lobby", lobby: this.lobby });
  }

  updateSettings(patch: Partial<RoomSettings>) {
    if (!this.isHost || this.lobby.phase !== "lobby") return;
    const settings = { ...this.lobby.settings, ...patch };
    // Every human needs a seat: a team can't be smaller than its players.
    settings.teamSize = Math.min(6, Math.max(settings.teamSize, this.minTeamSize()));
    this.lobby.settings = settings;
    this.broadcastLobby();
  }

  // ---------------------------------------------------------------------------
  // Teams
  // ---------------------------------------------------------------------------

  private humansOn(team: number) {
    return this.lobby.players.filter((p) => p.team === team).length;
  }

  /** Smallest team size that seats everyone (2v2 at least). */
  minTeamSize() {
    return Math.max(2, this.humansOn(0), this.humansOn(1));
  }

  private smallerTeam() {
    return this.humansOn(1) < this.humansOn(0) ? 1 : 0;
  }

  /** Host: moves a player to a team if it has a free seat. */
  private assignTeam(peerId: string, team: number) {
    if (this.lobby.phase !== "lobby" || (team !== 0 && team !== 1)) return;
    const player = this.lobby.players.find((p) => p.peerId === peerId);
    if (!player || player.team === team) return;
    if (this.lobby.settings.mode === "teams" && this.humansOn(team) >= this.lobby.settings.teamSize) return;
    this.patchPlayer(peerId, { team });
  }

  /** Asks to switch team (the host decides whether there is room). */
  setTeam(team: number) {
    if (this.isHost) this.assignTeam(this.myPeerId, team);
    else send(this.hostControl, { t: "team", team });
  }

  /** Host: deals the players into two random, balanced teams. */
  shuffleTeams() {
    if (!this.isHost || this.lobby.phase !== "lobby") return;
    new Rng(Date.now()).shuffle([...this.lobby.players]).forEach((p, i) => (p.team = i % 2));
    this.broadcastLobby();
  }

  /** Team match roster: every player on their team, bots filling the empty seats. */
  private teamRoster(rng: Rng): RosterEntry[] {
    const players = this.lobby.players;
    const size = Math.max(this.lobby.settings.teamSize, this.minTeamSize());
    const botsFor = [size - this.humansOn(0), size - this.humansOn(1)];
    const bots = createBotRoster(botsFor[0] + botsFor[1], rng, players.map((p) => p.skinId));
    return [
      ...players.map((p) => ({ peerId: p.peerId, name: p.name, skinId: p.skinId, team: p.team })),
      ...bots.map((b, i) => ({ ...b, peerId: null, team: i < botsFor[0] ? 0 : 1 })),
    ];
  }

  /** Host: builds the roster (players + bots) and starts the match everywhere. */
  start(): MatchStart | null {
    if (!this.isHost || this.lobby.phase !== "lobby") return null;
    const seed = Math.floor(Math.random() * 1e9);
    const rng = new Rng(seed ^ 0x2545f491);
    const s = this.lobby.settings;
    const players = this.lobby.players;
    const botCount = Math.max(0, Math.min(s.bots, NET.maxHoles - players.length));
    const roster: RosterEntry[] =
      s.mode === "teams"
        ? this.teamRoster(rng)
        : [
            ...players.map((p) => ({ peerId: p.peerId, name: p.name, skinId: p.skinId })),
            ...createBotRoster(botCount, rng, players.map((p) => p.skinId)).map((b) => ({ ...b, peerId: null })),
          ];
    const match: MatchStart = {
      seed,
      themeId: s.themeId === "random" ? rng.pick(THEME_ORDER) : s.themeId,
      mode: s.mode,
      duration: s.duration,
      blocksPerSide: s.blocksPerSide,
      difficulty: s.difficulty,
      powerUps: s.powerUps,
      roster,
    };
    this.lobby.phase = "playing";
    this.lobby.autoStartAt = null;
    this.broadcastLobby();
    for (const channel of this.channels.values()) send(channel.control, { t: "start", match });
    this.emit("start", match);
    return match;
  }

  /** Host: ends the post-match screen and brings everyone back to the lobby. */
  returnToLobby() {
    if (!this.isHost) return;
    this.lobby.phase = "lobby";
    for (const p of this.lobby.players) p.ready = p.isHost;
    this.broadcastLobby();
    for (const channel of this.channels.values()) send(channel.control, { t: "lobbyReturn" });
    this.emit("lobbyReturn");
  }

  broadcastSnapshot(snap: SnapMessage) {
    for (const channel of this.channels.values()) send(channel.fast, snap);
  }

  broadcastEvents(events: GameEvent[]) {
    if (events.length === 0) return;
    for (const channel of this.channels.values()) send(channel.control, { t: "events", events });
  }

  broadcastMovers(states: MoverStates) {
    for (const channel of this.channels.values()) send(channel.control, { t: "movers", states });
  }

  broadcastEnd(msg: EndMessage) {
    for (const channel of this.channels.values()) send(channel.control, msg);
  }

  // ---------------------------------------------------------------------------
  // Client side
  // ---------------------------------------------------------------------------

  private attachHost(control: DataConnection) {
    this.hostControl = control;
    control.on("data", (data) => this.onClientControl(data as ControlMessage));
    control.on("close", () => this.close("The host left the room."));
    control.on("error", () => this.close("Lost connection to the host."));

    this.hostFast = this.peer.connect(control.peer, { label: "fast", reliable: false, serialization: "json" });
    this.hostFast.on("data", (data) => {
      const msg = data as FastMessage;
      if (msg.t === "snap") this.emit("snapshot", msg);
    });

    this.intervals.push(window.setInterval(() => send(this.hostControl, { t: "ping", at: Date.now() }), 2000));
  }

  private onClientControl(msg: ControlMessage) {
    switch (msg.t) {
      case "lobby":
        this.lobby = msg.lobby;
        this.emit("lobby", msg.lobby);
        break;
      case "start":
        this.emit("start", msg.match);
        break;
      case "events":
        this.emit("events", msg.events);
        break;
      case "movers":
        this.emit("movers", msg.states);
        break;
      case "end":
        this.emit("end", msg);
        break;
      case "lobbyReturn":
        this.emit("lobbyReturn");
        break;
      case "ping":
        send(this.hostControl, { t: "pong", at: msg.at });
        break;
      case "pong":
        this.rtt = Date.now() - msg.at;
        break;
      default:
        break;
    }
  }

  setReady(ready: boolean) {
    send(this.hostControl, { t: "ready", ready });
  }

  setProfile(profile: PlayerProfile) {
    if (this.isHost) {
      const me = this.lobby.players.find((p) => p.peerId === this.myPeerId);
      if (me) Object.assign(me, sanitize(profile));
      this.broadcastLobby();
    } else {
      send(this.hostControl, { t: "profile", profile });
    }
  }

  sendInput(x: number, z: number, throttle: number) {
    send(this.hostFast, { t: "input", x, z, throttle });
  }

  // ---------------------------------------------------------------------------

  private close(reason: string) {
    if (this.isClosed) return;
    this.isClosed = true;
    for (const id of this.intervals) window.clearInterval(id);
    this.peer.destroy();
    this.emit("closed", reason);
  }

  leave() {
    this.close("You left the room.");
  }
}

/** Never trust what a peer sends: clamp names and fall back to a known skin. */
function sanitize(profile: PlayerProfile): PlayerProfile {
  const name = String(profile?.name ?? "Player").replace(/[<>]/g, "").trim().slice(0, 14) || "Player";
  const skinId = profile?.skinId in SKIN_BY_ID ? profile.skinId : DEFAULT_SKIN;
  return { name, skinId };
}
