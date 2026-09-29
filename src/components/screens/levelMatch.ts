import type { LevelDef } from "@/game/config/levels";
import type { MatchConfig } from "@/game/engine/GameSession";

export const levelMatch = (level: LevelDef): MatchConfig => ({
  mode: level.mode,
  themeId: level.theme,
  duration: level.duration,
  blocksPerSide: level.blocksPerSide,
  seed: level.seed,
  bots: level.bots,
  difficulty: level.difficulty,
  levelId: level.id,
});
