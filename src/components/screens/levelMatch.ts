import type { LevelDef } from "@/game/config/levels";
import type { MatchConfig } from "@/game/engine/GameSession";
import { levelBoard } from "@/game/leaderboard/boards";

export const levelMatch = (level: LevelDef): MatchConfig => ({
  mode: level.mode,
  themeId: level.theme,
  duration: level.duration,
  blocksPerSide: level.blocksPerSide,
  seed: level.seed,
  bots: level.bots,
  difficulty: level.difficulty,
  powerUps: false,
  levelId: level.id,
  board: levelBoard(level.id),
});
