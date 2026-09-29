import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Match tickets: the game asks for one when a leaderboard match starts and hands it
 * back with the score, so a submission proves when that match began.
 */

const secret = () => process.env.LEADERBOARD_SECRET || `hole-rush-ticket:${process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? ""}`;

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function issueTicket(board: string, player: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ b: board, p: player, t: now })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Seconds since the ticket was issued, or null if it is forged or for another board or player. */
export function ticketAge(ticket: unknown, board: string, player: string, now = Date.now()): number | null {
  if (typeof ticket !== "string" || ticket.length > 512) return null;
  const [payload, signature] = ticket.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { b, p, t } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (b !== board || p !== player || typeof t !== "number") return null;
    return (now - t) / 1000;
  } catch {
    return null;
  }
}
