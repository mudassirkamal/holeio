import { DEFAULT_SOLO_STARS, LEVELS, starsForResult } from "../config/levels";
import type { MatchConfig } from "./GameSession";
import type { MatchResult } from "./types";

export interface RewardBreakdown {
  stars: number;
  coins: number;
  won: boolean;
}

/** Stars and coins earned for a finished match. */
export function computeReward(match: MatchConfig, result: MatchResult): RewardBreakdown {
  const level = match.levelId !== null ? LEVELS.find((l) => l.id === match.levelId) : undefined;
  const won = result.mode === "solo" ? result.percent >= (level?.stars[0] ?? DEFAULT_SOLO_STARS[0]) : result.rank === 1;
  const performance = Math.floor(result.score / 45) + result.kills * 15;

  if (level) {
    const stars = starsForResult(level, result.rank, result.percent);
    return { stars, won: stars > 0, coins: Math.round((level.reward * stars) / 3) + performance };
  }
  const rankBonus = result.mode === "solo" ? 0 : Math.max(0, (result.holes - result.rank) * 6);
  return { stars: 0, won, coins: Math.round((performance + rankBonus) * 0.8) };
}
