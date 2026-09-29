"use client";

import { useState } from "react";
import { TRAINING_INFO } from "@/game/ai/roster";
import { GAME_NAME } from "@/game/config/constants";
import { LEVELS, MODE_INFO } from "@/game/config/levels";
import { THEMES } from "@/game/config/themes";
import { useApp } from "@/store/app";
import { highestUnlockedLevel, useProfile } from "@/store/profile";
import { SkinSwatch } from "../ui/Badges";
import { Button } from "../ui/Button";
import { FullscreenButton, InstallTip, useInstallTip } from "../ui/MobileExtras";
import { Currency } from "../ui/ScreenHeader";
import { levelMatch } from "./levelMatch";

export default function MainMenu() {
  const go = useApp((s) => s.go);
  const startMatch = useApp((s) => s.startMatch);
  const playerName = useProfile((s) => s.playerName);
  const setPlayerName = useProfile((s) => s.setPlayerName);
  const selectedSkin = useProfile((s) => s.selectedSkin);
  const levelStars = useProfile((s) => s.levelStars);
  const [name, setName] = useState(playerName);
  const installTip = useInstallTip();

  const nextLevel = LEVELS[highestUnlockedLevel(levelStars) - 1];
  const theme = THEMES[nextLevel.theme];

  return (
    <div className="relative flex h-full flex-col overflow-y-auto p-4 scrollbar-thin sm:p-8 short:p-3">
      <div className="flex items-start justify-between gap-3">
        <button
          onClick={() => go("skins")}
          className="panel flex cursor-pointer items-center gap-3 rounded-2xl p-2 pr-4 transition hover:brightness-110"
        >
          <SkinSwatch skinId={selectedSkin} size={48} />
          <div className="text-left">
            <div className="text-xs font-bold uppercase tracking-widest text-white/60">Your hole</div>
            <div className="font-display text-xl">{playerName}</div>
          </div>
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FullscreenButton />
          <Currency />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 sm:gap-8 short:flex-row short:gap-6 short:py-2">
        <div className="animate-float text-center short:flex-1">
          <h1
            className="bg-[linear-gradient(90deg,#ffe066,#ff5c95,#4fd6ff,#7cf05a,#ffe066)] bg-[length:200%_100%] bg-clip-text font-display text-7xl leading-none text-transparent drop-shadow-[0_6px_0_rgba(0,0,0,0.35)] animate-shine sm:text-9xl short:text-7xl"
          >
            {GAME_NAME}
          </h1>
          <p className="mt-2 font-display text-lg tracking-wide text-white/85 text-outline sm:text-2xl short:text-lg">
            Swallow the city. Outgrow the bots.
          </p>
        </div>

        <div className="panel flex w-full max-w-md flex-col gap-4 rounded-3xl p-5 animate-rise short:max-w-sm short:gap-2.5 short:p-4">
          <label className="flex items-center gap-3 rounded-2xl bg-black/30 px-4 py-2 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-sky short:py-1">
            <span className="text-sm font-extrabold uppercase tracking-widest text-white/50">Name</span>
            <input
              value={name}
              maxLength={14}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setPlayerName(name)}
              className="w-full bg-transparent font-display text-2xl outline-none short:text-xl"
              aria-label="Player name"
            />
          </label>

          <Button
            size="xl"
            onClick={() => {
              setPlayerName(name);
              startMatch(levelMatch(nextLevel));
            }}
          >
            ▶ PLAY
          </Button>
          <div className="-mt-1 text-center text-sm font-bold text-white/70 short:hidden">
            Level {nextLevel.id} · {nextLevel.name} · {MODE_INFO[nextLevel.mode].name} · {theme.name}
          </div>

          {/* Short screens: three columns, with Skins/Settings packed into the gaps. */}
          <div className="grid grid-cols-2 gap-3 short:grid-flow-dense short:grid-cols-3 short:gap-2">
            <Button variant="secondary" onClick={() => go("levels")} icon="🗺️">
              Levels
            </Button>
            <Button variant="green" onClick={() => go("quickplay")} icon="⚡">
              Quick Play
            </Button>
            <Button variant="primary" className="col-span-2" onClick={() => go("multiplayer")} icon="🌐">
              Multiplayer · Voice chat
            </Button>
            <Button variant="gold" onClick={() => go("skins")} icon="🎨">
              Skins
            </Button>
            <Button variant="ghost" onClick={() => go("settings")} icon="⚙️">
              Settings
            </Button>
          </div>
        </div>
      </div>

      {installTip.visible ? (
        <div className="short:hidden">
          <InstallTip onDismiss={installTip.dismiss} />
        </div>
      ) : (
        <p className="text-center text-xs font-bold text-white/55 short:hidden">
          Bots evolved by self-play{TRAINING_INFO.generations > 0 ? ` over ${TRAINING_INFO.generations} generations` : ""} ·
          Mouse / WASD / touch to move
        </p>
      )}
    </div>
  );
}
