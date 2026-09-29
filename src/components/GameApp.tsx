"use client";

import dynamic from "next/dynamic";
import { useEffect, useSyncExternalStore } from "react";
import { createBots } from "@/game/ai/roster";
import { audio } from "@/game/audio/AudioEngine";
import { ClipRecorder } from "@/game/clips/ClipRecorder";
import { LEVELS } from "@/game/config/levels";
import { Rng } from "@/game/core/rng";
import { useApp } from "@/store/app";
import { useNet } from "@/store/net";
import { useProfile } from "@/store/profile";
import Hud from "./game/Hud";
import { sessionRef } from "./game/sessionRef";
import PauseMenu from "./game/PauseMenu";
import Results from "./game/Results";
import { levelMatch } from "./screens/levelMatch";
import LevelSelect from "./screens/LevelSelect";
import Lobby from "./screens/Lobby";
import MainMenu from "./screens/MainMenu";
import Multiplayer from "./screens/Multiplayer";
import QuickPlay from "./screens/QuickPlay";
import Settings from "./screens/Settings";
import SkinShop from "./screens/SkinShop";

const GameCanvas = dynamic(() => import("./game/GameCanvas"), { ssr: false });

const noopSubscribe = () => () => {};

/** True only after hydration — the persisted profile lives in localStorage. */
const useIsClient = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

/** Root client component: the 3D canvas stays mounted while screens swap on top. */
export default function GameApp() {
  const screen = useApp((s) => s.screen);
  const paused = useApp((s) => s.paused);
  const result = useApp((s) => s.result);
  const quality = useProfile((s) => s.settings.quality);
  const hydrated = useIsClient();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("room")) useApp.getState().go("multiplayer");
    if (process.env.NODE_ENV === "development") {
      // Dev-only handle for inspecting/steering a running game from the console.
      const brain = () => createBots(1, "hard", new Rng(Date.now()))[0].controller;
      (window as unknown as { __debug: unknown }).__debug = { useApp, useProfile, useNet, sessionRef, levels: LEVELS, levelMatch, brain, ClipRecorder };
    }
    // Not `once`: phones suspend audio when the app goes to the background, and it can
    // only be resumed from the next touch.
    const unlock = () => audio.unlock();
    const onVisible = () => !document.hidden && audio.resume();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink">
      {/* Remount on quality change so the WebGL context is created with matching options. */}
      <GameCanvas key={quality} />
      {hydrated && (
        <div className={`safe-inset absolute ${screen === "playing" ? "pointer-events-none" : ""}`}>
          {screen === "menu" && <MainMenu />}
          {screen === "levels" && <LevelSelect />}
          {screen === "quickplay" && <QuickPlay />}
          {screen === "skins" && <SkinShop />}
          {screen === "settings" && <Settings />}
          {screen === "multiplayer" && <Multiplayer />}
          {screen === "lobby" && <Lobby />}
          {screen === "playing" && (
            <>
              <Hud />
              <div className="pointer-events-auto">
                {paused && !result && <PauseMenu />}
                {result && <Results />}
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
