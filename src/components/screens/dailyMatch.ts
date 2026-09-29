import { dailyChallenge, type DailyChallenge } from "@/game/leaderboard/boards";
import type { MatchConfig } from "@/game/engine/GameSession";

export const dailyMatch = (challenge: DailyChallenge = dailyChallenge()): MatchConfig => ({
  mode: "classic",
  themeId: challenge.themeId,
  duration: challenge.duration,
  blocksPerSide: challenge.blocksPerSide,
  seed: challenge.seed,
  bots: challenge.bots,
  difficulty: challenge.difficulty,
  powerUps: true,
  levelId: null,
  board: challenge.board,
});
