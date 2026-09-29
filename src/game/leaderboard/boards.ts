import type { Difficulty } from "../config/levels";
import { LEVELS } from "../config/levels";
import { THEME_ORDER, type ThemeId } from "../config/themes";

/**
 * Global leaderboards. A board is a string key shared by the game and the server:
 *   daily-YYYY-MM-DD  the Daily Challenge (everyone plays the same city that UTC day)
 *   level-N           best scores on campaign level N
 */

export const MAX_NAME_LENGTH = 14;

/** UTC day, e.g. "2026-09-29". */
export const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export const msUntilNextDay = (now = Date.now()) => 86_400_000 - (now % 86_400_000);

export interface DailyChallenge {
  day: string;
  board: string;
  seed: number;
  themeId: ThemeId;
  blocksPerSide: number;
  bots: number;
  difficulty: Difficulty;
  duration: number;
}

/** The same city, seed and bots for everyone on a given day. */
export function dailyChallenge(day = dayKey()): DailyChallenge {
  let seed = 2166136261;
  for (let i = 0; i < day.length; i++) seed = Math.imul(seed ^ day.charCodeAt(i), 16777619) >>> 0;
  return {
    day,
    board: `daily-${day}`,
    seed,
    themeId: THEME_ORDER[seed % THEME_ORDER.length],
    blocksPerSide: 5 + ((seed >>> 8) % 2),
    bots: 9,
    difficulty: "hard",
    duration: 120,
  };
}

export const levelBoard = (levelId: number) => `level-${levelId}`;

export type BoardInfo = { kind: "daily"; day: string; duration: number } | { kind: "level"; levelId: number; duration: number };

/** Parses and validates a board key; null for anything the game doesn't offer. */
export function parseBoard(board: unknown): BoardInfo | null {
  if (typeof board !== "string") return null;
  const daily = /^daily-(\d{4}-\d{2}-\d{2})$/.exec(board);
  if (daily) return { kind: "daily", day: daily[1], duration: dailyChallenge(daily[1]).duration };
  const level = /^level-(\d{1,2})$/.exec(board);
  const def = level ? LEVELS.find((l) => l.id === Number(level[1])) : undefined;
  return def ? { kind: "level", levelId: def.id, duration: def.duration } : null;
}

/** Scores above this for a match of `duration` seconds can't come from real play. */
export const maxPlausibleScore = (duration: number) => duration * 400;

/** Trims, strips control characters and caps the length of a player name. */
export function cleanName(name: unknown) {
  if (typeof name !== "string") return "";
  return name
    .replace(/[\p{C}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

export interface BoardRow {
  rank: number;
  name: string;
  skin: string;
  score: number;
  me: boolean;
}

export interface Standing {
  rank: number;
  best: number;
  total: number;
}

/** GET /api/leaderboard response. `configured` is false until a database is connected. */
export type BoardResponse = { configured: false } | { configured: true; top: BoardRow[]; me: Standing | null };
