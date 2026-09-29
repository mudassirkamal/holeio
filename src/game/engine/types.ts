import type { GameMode } from "../config/levels";
import type { ObjectKindId } from "../config/objectCatalog";
import type { PowerUpKind } from "../config/powerUps";
import type { SkinId } from "../config/skins";
import type { ClipFile } from "../clips/ClipRecorder";

export interface LeaderboardRow {
  id: number;
  rank: number;
  name: string;
  score: number;
  skinId: SkinId;
  isPlayer: boolean;
  isBot: boolean;
  alive: boolean;
  /** Team index in team mode, -1 otherwise. */
  team: number;
}

export interface MinimapDot {
  x: number;
  z: number;
  r: number;
  skinId: SkinId;
  isPlayer: boolean;
  alive: boolean;
  team: number;
}

/** A pickup on the minimap (coordinates normalized to -1..1 like the dots). */
export interface MinimapPickup {
  x: number;
  z: number;
  kind: PowerUpKind;
}

/** A power-up the player has active, with seconds left. */
export interface ActivePower {
  kind: PowerUpKind;
  left: number;
}

/** Team mode: the player's team and each team's total score. */
export interface TeamStatus {
  player: number;
  scores: number[];
}

export interface HudSnapshot {
  mode: GameMode;
  online: boolean;
  /** Round-trip time to the host (online clients), ms. */
  ping: number;
  countdown: number;
  timeLeft: number;
  duration: number;
  score: number;
  rank: number;
  holes: number;
  holesAlive: number;
  sizeLevel: number;
  sizeProgress: number;
  percent: number;
  alive: boolean;
  respawnIn: number;
  eatenBy: string | null;
  combo: number;
  leaderboard: LeaderboardRow[];
  minimap: MinimapDot[];
  pickups: MinimapPickup[];
  powers: ActivePower[];
  teams: TeamStatus | null;
  paused: boolean;
}

export type FeedItem =
  | {
      kind: "kill";
      eater: string;
      eaterSkin: SkinId;
      victim: string;
      victimSkin: SkinId;
      /** Team indexes in team mode, -1 otherwise. */
      eaterTeam: number;
      victimTeam: number;
      byPlayer: boolean;
      ofPlayer: boolean;
    }
  | { kind: "levelUp"; level: number };

export interface MatchResult {
  mode: GameMode;
  rank: number;
  holes: number;
  score: number;
  percent: number;
  kills: number;
  deaths: number;
  objectsEaten: number;
  bestCombo: number;
  sizeLevel: number;
  eliminated: boolean;
  leaderboard: LeaderboardRow[];
  biggestBite: ObjectKindId | null;
  /** Team mode: final team totals and the winner (-1 on a draw). */
  teams: (TeamStatus & { winner: number }) | null;
}

/** A recorded highlight: the best moment of a match (auto) or one the player saved. */
export interface SessionClip extends ClipFile {
  caption: string;
  auto: boolean;
}
