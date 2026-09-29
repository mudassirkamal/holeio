"use client";

import { useApp } from "@/store/app";
import { useProfile } from "@/store/profile";
import { Button } from "../ui/Button";

export default function PauseMenu() {
  const setPaused = useApp((s) => s.setPaused);
  const match = useApp((s) => s.match);
  const startMatch = useApp((s) => s.startMatch);
  const quit = useApp((s) => s.quitToMenu);
  const settings = useProfile((s) => s.settings);
  const update = useProfile((s) => s.updateSettings);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="panel flex w-full max-w-xs flex-col gap-3 rounded-3xl p-6 text-center animate-pop">
        <h2 className="font-display text-5xl">Paused</h2>
        <Button size="lg" onClick={() => setPaused(false)}>
          ▶ Resume
        </Button>
        {match && (
          <Button variant="secondary" onClick={() => startMatch({ ...match })}>
            ↻ Restart
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" size="sm" onClick={() => update({ sound: !settings.sound })}>
            {settings.sound ? "🔊 Sound" : "🔇 Sound"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => update({ music: !settings.music })}>
            {settings.music ? "🎵 Music" : "🚫 Music"}
          </Button>
        </div>
        <Button variant="ghost" onClick={quit}>
          Quit to menu
        </Button>
      </div>
    </div>
  );
}
