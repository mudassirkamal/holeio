"use client";

import dynamic from "next/dynamic";
import { useEffect, useSyncExternalStore } from "react";
import { audio } from "@/game/audio/AudioEngine";
import { useApp } from "@/store/app";
import { useProfile } from "@/store/profile";
import Hud from "./game/Hud";
import { sessionRef } from "./game/sessionRef";
import PauseMenu from "./game/PauseMenu";
import Results from "./game/Results";
import LevelSelect from "./screens/LevelSelect";
import MainMenu from "./screens/MainMenu";
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
    if (process.env.NODE_ENV === "development") {
      // Dev-only handle for inspecting/steering a running game from the console.
      (window as unknown as { __debug: unknown }).__debug = { useApp, useProfile, sessionRef };
    }
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink">
      {/* Remount on quality change so the WebGL context is created with matching options. */}
      <GameCanvas key={quality} />
      {hydrated && (
        <div className={`absolute inset-0 ${screen === "playing" ? "pointer-events-none" : ""}`}>
          {screen === "menu" && <MainMenu />}
          {screen === "levels" && <LevelSelect />}
          {screen === "quickplay" && <QuickPlay />}
          {screen === "skins" && <SkinShop />}
          {screen === "settings" && <Settings />}
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
