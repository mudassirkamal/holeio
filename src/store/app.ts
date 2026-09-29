"use client";

import { create } from "zustand";
import type { MatchConfig } from "@/game/engine/GameSession";
import type { FeedItem, HudSnapshot, MatchResult } from "@/game/engine/types";

export type Screen = "menu" | "levels" | "quickplay" | "skins" | "settings" | "multiplayer" | "lobby" | "playing";

export interface FeedEntry {
  id: number;
  item: FeedItem;
  at: number;
}

export interface Reward {
  stars: number;
  coins: number;
  won: boolean;
  newBest: boolean;
}

interface AppState {
  screen: Screen;
  match: MatchConfig | null;
  /** Increments to force a fresh session for the same config (retry). */
  matchKey: number;
  paused: boolean;
  hud: HudSnapshot | null;
  feed: FeedEntry[];
  result: MatchResult | null;
  reward: Reward | null;
  previewSkin: string | null;
  go: (screen: Screen) => void;
  startMatch: (match: MatchConfig) => void;
  setPaused: (paused: boolean) => void;
  setHud: (hud: HudSnapshot) => void;
  pushFeed: (item: FeedItem) => void;
  finish: (result: MatchResult, reward: Reward) => void;
  quitToMenu: () => void;
  /** Online: leave the finished match and show the room lobby again. */
  backToLobby: () => void;
  setPreviewSkin: (id: string | null) => void;
}

let feedId = 0;

export const useApp = create<AppState>()((set) => ({
  screen: "menu",
  match: null,
  matchKey: 0,
  paused: false,
  hud: null,
  feed: [],
  result: null,
  reward: null,
  previewSkin: null,
  go: (screen) => set({ screen, previewSkin: null }),
  startMatch: (match) =>
    set((s) => ({ screen: "playing", match, matchKey: s.matchKey + 1, hud: null, feed: [], result: null, reward: null, paused: false })),
  setPaused: (paused) => set({ paused }),
  setHud: (hud) => set({ hud }),
  pushFeed: (item) =>
    set((s) => ({ feed: [...s.feed.slice(-5), { id: ++feedId, item, at: performance.now() }] })),
  finish: (result, reward) => set({ result, reward }),
  quitToMenu: () => set({ screen: "menu", match: null, hud: null, feed: [], result: null, reward: null, paused: false }),
  backToLobby: () => set({ screen: "lobby", match: null, hud: null, feed: [], result: null, reward: null, paused: false }),
  setPreviewSkin: (id) => set({ previewSkin: id }),
}));
