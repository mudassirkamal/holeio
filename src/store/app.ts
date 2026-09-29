"use client";

import { create } from "zustand";
import type { MatchConfig } from "@/game/engine/GameSession";
import type { FeedItem, HudSnapshot, MatchResult, SessionClip } from "@/game/engine/types";
import { isMobileDevice } from "@/game/render/quality";
import { enterFullscreen } from "@/components/ui/fullscreen";

export type Screen = "menu" | "levels" | "daily" | "quickplay" | "skins" | "settings" | "multiplayer" | "lobby" | "playing";

export interface FeedEntry {
  id: number;
  item: FeedItem;
  at: number;
}

/** A highlight video ready to play or share (`url` is an object URL for `blob`). */
export interface Clip extends SessionClip {
  id: number;
  url: string;
}

/** Player-saved clips kept per match, on top of the automatic best moment. */
const MAX_SAVED_CLIPS = 3;

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
  clips: Clip[];
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
  addClip: (clip: SessionClip) => void;
}

let feedId = 0;
let clipId = 0;

/** Leaving a match drops its clips; free their object URLs. */
const releaseClips = (clips: Clip[]) => clips.forEach((c) => URL.revokeObjectURL(c.url));

export const useApp = create<AppState>()((set, get) => ({
  screen: "menu",
  match: null,
  matchKey: 0,
  paused: false,
  hud: null,
  feed: [],
  result: null,
  reward: null,
  previewSkin: null,
  clips: [],
  go: (screen) => set({ screen, previewSkin: null }),
  startMatch: (match) => {
    // Phones play full screen where the browser allows it (called from the Play tap).
    if (isMobileDevice()) enterFullscreen();
    releaseClips(get().clips);
    set((s) => ({ screen: "playing", match, matchKey: s.matchKey + 1, hud: null, feed: [], result: null, reward: null, paused: false, clips: [] }));
  },
  setPaused: (paused) => set({ paused }),
  setHud: (hud) => set({ hud }),
  pushFeed: (item) =>
    set((s) => ({ feed: [...s.feed.slice(-5), { id: ++feedId, item, at: performance.now() }] })),
  finish: (result, reward) => set({ result, reward }),
  quitToMenu: () => {
    releaseClips(get().clips);
    set({ screen: "menu", match: null, hud: null, feed: [], result: null, reward: null, paused: false, clips: [] });
  },
  backToLobby: () => {
    releaseClips(get().clips);
    set({ screen: "lobby", match: null, hud: null, feed: [], result: null, reward: null, paused: false, clips: [] });
  },
  setPreviewSkin: (id) => set({ previewSkin: id }),
  addClip: (clip) => {
    const next: Clip = { ...clip, id: ++clipId, url: URL.createObjectURL(clip.blob) };
    const { clips } = get();
    const saved = clips.filter((c) => !c.auto);
    // One automatic best moment (a better one replaces it) plus the newest few saved ones.
    const dropped = clip.auto ? clips.filter((c) => c.auto) : saved.slice(0, Math.max(0, saved.length + 1 - MAX_SAVED_CLIPS));
    releaseClips(dropped);
    const kept = clips.filter((c) => !dropped.includes(c));
    set({ clips: clip.auto ? [next, ...kept] : [...kept, next] });
  },
}));
