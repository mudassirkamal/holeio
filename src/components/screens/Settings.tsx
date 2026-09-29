"use client";

import { useState } from "react";
import type { QualityLevel } from "@/game/render/quality";
import { useProfile } from "@/store/profile";
import { Button } from "../ui/Button";
import { ScreenHeader } from "../ui/ScreenHeader";

const QUALITY_LABELS: Record<QualityLevel, string> = {
  low: "Low — fastest, no shadows",
  medium: "Medium — shadows + bloom",
  high: "High — ambient occlusion",
  ultra: "Ultra — max resolution",
};

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full cursor-pointer items-center justify-between rounded-2xl bg-white/10 px-4 py-3 font-bold transition hover:bg-white/15"
    >
      {label}
      <span className={`relative h-7 w-12 rounded-full transition ${value ? "bg-lime" : "bg-white/25"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

export default function Settings() {
  const settings = useProfile((s) => s.settings);
  const update = useProfile((s) => s.updateSettings);
  const reset = useProfile((s) => s.resetProgress);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 scrollbar-thin sm:p-8">
      <ScreenHeader title="Settings" />
      <div className="mx-auto grid w-full max-w-3xl gap-4 md:grid-cols-2">
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 font-display text-2xl">Graphics</h2>
          <div className="grid gap-2">
            {(Object.keys(QUALITY_LABELS) as QualityLevel[]).map((q) => (
              <button
                key={q}
                onClick={() => update({ quality: q })}
                className={`cursor-pointer rounded-2xl px-4 py-3 text-left font-bold transition ${settings.quality === q ? "bg-white text-ink" : "bg-white/10 hover:bg-white/20"}`}
              >
                {QUALITY_LABELS[q]}
              </button>
            ))}
          </div>
        </section>
        <section className="panel flex flex-col gap-2 rounded-3xl p-5">
          <h2 className="mb-1 font-display text-2xl">Game</h2>
          <Toggle label="Sound effects" value={settings.sound} onChange={(sound) => update({ sound })} />
          <Toggle label="Music" value={settings.music} onChange={(music) => update({ music })} />
          <Toggle label="Minimap" value={settings.minimap} onChange={(minimap) => update({ minimap })} />
          <div className="mt-auto pt-4">
            {confirmReset ? (
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    reset();
                    setConfirmReset(false);
                  }}
                >
                  Erase
                </Button>
              </div>
            ) : (
              <Button variant="ghost" className="w-full" onClick={() => setConfirmReset(true)}>
                Reset progress
              </Button>
            )}
          </div>
        </section>
        <section className="panel rounded-3xl p-5 md:col-span-2">
          <h2 className="mb-2 font-display text-2xl">How to play</h2>
          <ul className="grid gap-1 font-bold text-white/80 sm:grid-cols-2">
            <li>🖱️ Move the mouse — your hole follows it</li>
            <li>⌨️ WASD / arrow keys also work</li>
            <li>📱 On touch screens, drag anywhere</li>
            <li>🕳️ Swallow objects smaller than your hole</li>
            <li>👑 Holes 14% bigger can swallow smaller holes</li>
            <li>⚡ Chain bites quickly for combos</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
