import type { Difficulty } from "../config/levels";
import type { SkinId } from "../config/skins";
import type { ThemeId } from "../config/themes";
import type { GameEvent } from "../core/events";
import type { World } from "../core/World";

/** Bump when the wire format changes; mismatched peers are rejected. */
export const PROTOCOL_VERSION = 2;

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
  /** Chosen team (used when the mode is "teams"). */
  team: number;
}

export interface RoomSettings {
  mode: "classic" | "battle" | "teams";
  themeId: ThemeId | "random";
  duration: number;
  blocksPerSide: number;
  /** Bots added to fill the match (classic/battle). */
  bots: number;
  /** Holes per team in team mode; bots fill the empty seats. */
  teamSize: number;
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
  /** Team index (team mode only). */
  team?: number;
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
  | { t: "team"; team: number }
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

/** Team match: the other human players on `peerId`'s team. */
export function teammatePeerIds(start: MatchStart, peerId: string) {
  const team = start.roster.find((e) => e.peerId === peerId)?.team;
  return new Set(start.roster.flatMap((e) => (e.peerId && e.peerId !== peerId && e.team === team ? [e.peerId] : [])));
}
