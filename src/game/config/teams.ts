/** Team mode: two sides, whose members' scores add up. */
export const TEAMS = [
  { name: "Red", color: "#ff4d6d", emoji: "🔴" },
  { name: "Blue", color: "#3a8dff", emoji: "🔵" },
] as const;

export type TeamId = 0 | 1;

/** Holes per team offered in menus (2v2 up to 6v6 — 12 holes is the match limit). */
export const TEAM_SIZES = [2, 3, 4, 5, 6] as const;

/** Index of the winning team, or -1 on a draw. */
export function winningTeam(scores: readonly number[]) {
  if (scores.length < 2 || scores[0] === scores[1]) return -1;
  return scores[0] > scores[1] ? 0 : 1;
}
