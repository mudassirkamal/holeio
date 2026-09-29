import { NextResponse, type NextRequest } from "next/server";
import { SKIN_BY_ID } from "@/game/config/skins";
import { cleanName, dayKey, maxPlausibleScore, parseBoard, type BoardResponse } from "@/game/leaderboard/boards";
import { databaseConfigured, playerStanding, submitScore, topScores } from "./database";
import { issueTicket, ticketAge } from "./ticket";

/**
 * Global leaderboards.
 *   GET  ?board=daily-2026-09-29&player=<uuid>   top scores plus the player's standing
 *   POST { action: "ticket", board, player }      issued when a leaderboard match starts
 *   POST { action: "submit", board, player, name, skin, score, ticket }
 * Until SUPABASE_URL and SUPABASE_ANON_KEY are set, GET answers { configured: false }
 * and the game simply hides the global boards.
 */

const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOP_ROWS = 20;
/** A match takes at least this long (countdown plus a quick elimination). */
const MIN_MATCH_SECONDS = 20;
/** Room for the countdown, pauses and a slow results screen. */
const MAX_EXTRA_SECONDS = 30 * 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Daily boards accept today's challenge, give or take a day for clocks and midnight. */
const openDays = (now = Date.now()) => [-1, 0, 1].map((d) => dayKey(new Date(now + d * 86_400_000)));

export async function GET(request: NextRequest) {
  const board = request.nextUrl.searchParams.get("board");
  const player = request.nextUrl.searchParams.get("player");
  if (!board || !parseBoard(board)) return json({ error: "Unknown board" }, 400);
  if (!databaseConfigured()) return json({ configured: false } satisfies BoardResponse);

  const id = player && PLAYER_ID.test(player) ? player : null;
  try {
    const [top, me] = await Promise.all([topScores(board, id, TOP_ROWS), id ? playerStanding(board, id) : null]);
    return json({ configured: true, top, me } satisfies BoardResponse);
  } catch (error) {
    console.error("[leaderboard]", error);
    return json({ error: "Leaderboard unavailable" }, 502);
  }
}

export async function POST(request: NextRequest) {
  if (!databaseConfigured()) return json({ configured: false }, 503);
  const body = await request.json().catch(() => null);
  const board: unknown = body?.board;
  const player: unknown = body?.player;
  const info = parseBoard(board);
  if (!info || typeof board !== "string" || typeof player !== "string" || !PLAYER_ID.test(player)) {
    return json({ error: "Bad request" }, 400);
  }
  if (info.kind === "daily" && !openDays().includes(info.day)) return json({ error: "This challenge is closed" }, 400);

  if (body.action === "ticket") return json({ ticket: issueTicket(board, player) });
  if (body.action !== "submit") return json({ error: "Unknown action" }, 400);

  const age = ticketAge(body.ticket, board, player);
  if (age === null || age < MIN_MATCH_SECONDS || age > info.duration + MAX_EXTRA_SECONDS) return json({ error: "Invalid ticket" }, 403);

  // Scores are capped by how long the match really ran.
  const score: unknown = body.score;
  const name = cleanName(body.name);
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0 || score > maxPlausibleScore(Math.min(age, info.duration)) || !name) {
    return json({ error: "Invalid score" }, 400);
  }
  const skin = typeof body.skin === "string" && body.skin in SKIN_BY_ID ? body.skin : "classic";

  try {
    return json(await submitScore(board, player, name, skin, score));
  } catch (error) {
    console.error("[leaderboard]", error);
    return json({ error: "Leaderboard unavailable" }, 502);
  }
}
