"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { LEVELS } from "@/game/config/levels";
import { DEFAULT_SKIN, SKIN_BY_ID, type SkinDef, type SkinId } from "@/game/config/skins";
import { detectQuality, isMobileDevice, type QualityLevel } from "@/game/render/quality";

export interface Settings {
  quality: QualityLevel;
  sound: boolean;
  music: boolean;
  minimap: boolean;
  vibration: boolean;
  /** Keep a rolling recording for highlight clips. */
  clips: boolean;
}

interface ProfileState {
  playerName: string;
  /** Anonymous id for the global leaderboards (kept private: boards never show it). */
  playerId: string;
  /** Best score per leaderboard board (daily challenges and levels). */
  bestScores: Record<string, number>;
  coins: number;
  selectedSkin: SkinId;
  ownedSkins: SkinId[];
  /** Best stars per level id. */
  levelStars: Record<number, number>;
  gamesPlayed: number;
  wins: number;
  settings: Settings;
  setPlayerName: (name: string) => void;
  selectSkin: (id: SkinId) => void;
  buySkin: (id: SkinId) => boolean;
  addCoins: (amount: number) => void;
  recordLevel: (levelId: number, stars: number) => void;
  recordGame: (won: boolean) => void;
  recordBest: (board: string, score: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetProgress: () => void;
}

/** A random v4 UUID; `crypto.randomUUID` needs HTTPS, which offline LAN play may not have. */
function newPlayerId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Old daily challenges drop out of the saved bests after a week. */
const KEEP_DAILY_MS = 7 * 86_400_000;

const initialProfile = () => ({
  playerName: "You",
  playerId: newPlayerId(),
  bestScores: {} as Record<string, number>,
  coins: 0,
  selectedSkin: DEFAULT_SKIN,
  ownedSkins: ["classic", "mint"] as SkinId[],
  levelStars: {} as Record<number, number>,
  gamesPlayed: 0,
  wins: 0,
  settings: { quality: detectQuality(), sound: true, music: true, minimap: true, vibration: true, clips: true } as Settings,
});

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      ...initialProfile(),
      setPlayerName: (name) => set({ playerName: name.trim().slice(0, 14) || "You" }),
      selectSkin: (id) => {
        if (isSkinUnlocked(SKIN_BY_ID[id], get())) set({ selectedSkin: id });
      },
      buySkin: (id) => {
        const skin = SKIN_BY_ID[id];
        const state = get();
        if (skin.unlock.type !== "coins" || state.ownedSkins.includes(id) || state.coins < skin.unlock.price) return false;
        set({ coins: state.coins - skin.unlock.price, ownedSkins: [...state.ownedSkins, id], selectedSkin: id });
        return true;
      },
      addCoins: (amount) => set((s) => ({ coins: s.coins + Math.max(0, Math.round(amount)) })),
      recordLevel: (levelId, stars) =>
        set((s) => ({ levelStars: { ...s.levelStars, [levelId]: Math.max(s.levelStars[levelId] ?? 0, stars) } })),
      recordGame: (won) => set((s) => ({ gamesPlayed: s.gamesPlayed + 1, wins: s.wins + (won ? 1 : 0) })),
      recordBest: (board, score) =>
        set((s) => {
          const cutoff = Date.now() - KEEP_DAILY_MS;
          const kept = Object.entries(s.bestScores).filter(([key]) => !key.startsWith("daily-") || Date.parse(key.slice(6)) >= cutoff);
          return { bestScores: { ...Object.fromEntries(kept), [board]: Math.max(s.bestScores[board] ?? 0, score) } };
        }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetProgress: () => set({ ...initialProfile(), playerName: get().playerName, playerId: get().playerId, settings: get().settings }),
    }),
    {
      name: "hole-rush-profile",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, version) => {
        const state = persisted as ProfileState;
        // v2: phones got adaptive resolution, so re-pick their starting quality once.
        if (version < 2 && state?.settings && isMobileDevice()) state.settings.quality = detectQuality();
        return state;
      },
      // Settings added later get their defaults in profiles saved before they existed.
      merge: (persisted, current) => {
        const saved = persisted as Partial<ProfileState> | undefined;
        return { ...current, ...saved, settings: { ...current.settings, ...saved?.settings } };
      },
    },
  ),
);

export const totalStars = (levelStars: Record<number, number>) =>
  Object.values(levelStars).reduce((sum, s) => sum + s, 0);

/** Highest level id the player may start (the one after the last cleared level). */
export const highestUnlockedLevel = (levelStars: Record<number, number>) => {
  let unlocked = 1;
  for (const level of LEVELS) {
    if ((levelStars[level.id] ?? 0) > 0) unlocked = Math.min(LEVELS.length, level.id + 1);
    else break;
  }
  return unlocked;
};

export function isSkinUnlocked(
  skin: SkinDef,
  profile: Pick<ProfileState, "ownedSkins" | "levelStars">,
): boolean {
  switch (skin.unlock.type) {
    case "free":
      return true;
    case "coins":
      return profile.ownedSkins.includes(skin.id as SkinId);
    case "level":
      return (profile.levelStars[skin.unlock.level] ?? 0) > 0;
    case "stars":
      return totalStars(profile.levelStars) >= skin.unlock.stars;
  }
}
