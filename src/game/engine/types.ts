import type { GameMode } from "../config/levels";
import type { ObjectKindId } from "../config/objectCatalog";
import type { SkinId } from "../config/skins";

export interface LeaderboardRow {
  id: number;
  rank: number;
  name: string;
  score: number;
  skinId: SkinId;
  isPlayer: boolean;
  isBot: boolean;
  alive: boolean;
}

export interface MinimapDot {
  x: number;
  z: number;
  r: number;
  skinId: SkinId;
  isPlayer: boolean;
  alive: boolean;
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
  paused: boolean;
}

export type FeedItem =
  | {
      kind: "kill";
      eater: string;
      eaterSkin: SkinId;
      victim: string;
      victimSkin: SkinId;
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
}
