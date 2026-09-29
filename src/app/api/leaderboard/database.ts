import type { BoardRow, Standing } from "@/game/leaderboard/boards";

/**
 * Supabase access through the SQL functions in `supabase/leaderboard.sql`. The key stays
 * on the server; the scores table itself is closed to it (row level security), so the
 * functions are the only way in.
 */

const config = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
};

export const databaseConfigured = () => config() !== null;

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const db = config();
  if (!db) throw new Error("Leaderboard database is not configured");
  const res = await fetch(`${db.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: db.key, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${fn} failed with ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export const topScores = (board: string, player: string | null, limit: number) =>
  rpc<BoardRow[]>("hole_rush_top", { p_board: board, p_player: player, p_limit: limit });

export const playerStanding = async (board: string, player: string) =>
  (await rpc<Standing[]>("hole_rush_standing", { p_board: board, p_player: player }))[0] ?? null;

/** Keeps the player's best score on the board and returns where it ranks. */
export const submitScore = async (board: string, player: string, name: string, skin: string, score: number) =>
  (await rpc<Standing[]>("hole_rush_submit", { p_board: board, p_player: player, p_name: name, p_skin: skin, p_score: score }))[0] ?? null;
