import type { Difficulty } from "../config/levels";
import type { SkinId } from "../config/skins";
import type { ThemeId } from "../config/themes";
import type { GameEvent } from "../core/events";
import type { World } from "../core/World";

/** Bump when the wire format changes; mismatched peers are rejected. */
export const PROTOCOL_VERSION = 1;

export interface PlayerProfile {
  name: string;
  skinId: SkinId;
}

export interface LobbyPlayer extends PlayerProfile {
  peerId: string;
  isHost: boolean;
  ready: boolean;
  /** Round-trip time to the host in ms. */
  ping: number;
}

export interface RoomSettings {
  mode: "classic" | "battle";
  themeId: ThemeId | "random";
  duration: number;
  blocksPerSide: number;
  /** Bots added to fill the match. */
  bots: number;
  difficulty: Difficulty;
}

export interface LobbyState {
  code: string;
  isPublic: boolean;
  phase: "lobby" | "playing";
  players: LobbyPlayer[];
  settings: RoomSettings;
  /** Epoch ms when a public room starts automatically, or null. */
  autoStartAt: number | null;
}

export interface RosterEntry extends PlayerProfile {
  /** Null for bots. */
  peerId: string | null;
}

export interface MatchStart {
  seed: number;
  themeId: ThemeId;
  mode: RoomSettings["mode"];
  duration: number;
  blocksPerSide: number;
  difficulty: Difficulty;
  roster: RosterEntry[];
}

export interface HoleStats {
  score: number;
  objectScore: number;
  kills: number;
  deaths: number;
  objectsEaten: number;
  bestCombo: number;
  sizeLevel: number;
  eliminated: boolean;
  eliminatedAt: number;
  biggestBite: string | null;
}

export type ControlMessage =
  | { t: "hello"; version: number; profile: PlayerProfile }
  | { t: "welcome"; you: string; lobby: LobbyState }
  | { t: "reject"; reason: RejectReason }
  | { t: "lobby"; lobby: LobbyState }
  | { t: "profile"; profile: PlayerProfile }
  | { t: "ready"; ready: boolean }
  | { t: "start"; match: MatchStart }
  | { t: "events"; events: GameEvent[] }
  | { t: "movers"; states: ReturnType<World["moverStates"]> }
  | { t: "end"; time: number; stats: HoleStats[] }
  | { t: "lobbyReturn" }
  | { t: "ping"; at: number }
  | { t: "pong"; at: number };

export type RejectReason = "full" | "in-game" | "version";

/** Holes are packed as flat number arrays: see `HOLE_FIELDS`. */
export const HOLE_FIELDS = 11;

export type FastMessage =
  | { t: "input"; x: number; z: number; throttle: number }
  | { t: "snap"; time: number; running: boolean; holes: number[] };

export const round2 = (v: number) => Math.round(v * 100) / 100;
