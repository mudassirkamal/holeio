"use client";

import { create } from "zustand";
import type { BoardResponse, Standing } from "@/game/leaderboard/boards";
import { useProfile } from "./profile";

const API = "/api/leaderboard";

/** What happened to the score of the match that just ended. */
export type Submission =
  | { board: string; status: "sending" }
  | { board: string; status: "done"; standing: Standing }
  /** No database connected, offline, or the server turned the score down. */
  | { board: string; status: "unavailable" };

interface LeaderboardState {
  /** Whether the server has a leaderboard database (null until asked). */
  configured: boolean | null;
  submission: Submission | null;
  /** Called when a leaderboard match starts: the ticket proves when it began. */
  startRun: (board: string) => void;
  /** Called when that match ends. */
  submit: (board: string, score: number) => Promise<void>;
  fetchBoard: (board: string) => Promise<BoardResponse | null>;
}

let run: { board: string; ticket: Promise<string | null> } | null = null;

const post = async <T,>(body: Record<string, unknown>): Promise<T | null> => {
  try {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
};

export const useLeaderboard = create<LeaderboardState>()((set, get) => ({
  configured: null,
  submission: null,

  startRun: (board) => {
    set({ submission: null });
    if (get().configured === false) {
      run = null;
      return;
    }
    const player = useProfile.getState().playerId;
    run = { board, ticket: post<{ ticket: string }>({ action: "ticket", board, player }).then((r) => r?.ticket ?? null) };
  },

  submit: async (board, score) => {
    const ticket = run?.board === board ? await run.ticket : null;
    run = null;
    if (!ticket) {
      set({ submission: { board, status: "unavailable" } });
      return;
    }
    set({ submission: { board, status: "sending" } });
    const { playerId, playerName, selectedSkin } = useProfile.getState();
    const standing = await post<Standing>({ action: "submit", board, player: playerId, name: playerName, skin: selectedSkin, score, ticket });
    set({ submission: standing ? { board, status: "done", standing } : { board, status: "unavailable" } });
  },

  fetchBoard: async (board) => {
    try {
      const player = useProfile.getState().playerId;
      const res = await fetch(`${API}?board=${encodeURIComponent(board)}&player=${player}`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as BoardResponse;
      set({ configured: data.configured });
      return data;
    } catch {
      return null;
    }
  },
}));
