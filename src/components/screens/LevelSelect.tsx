"use client";

import { useState } from "react";
import { DIFFICULTY_INFO, LEVELS, LEVELS_PER_WORLD, MODE_INFO, type LevelDef } from "@/game/config/levels";
import { THEMES, THEME_ORDER } from "@/game/config/themes";
import { useApp } from "@/store/app";
import { highestUnlockedLevel, useProfile } from "@/store/profile";
import { Stars } from "../ui/Badges";
import { Button } from "../ui/Button";
import { ScreenHeader } from "../ui/ScreenHeader";
import { levelMatch } from "./levelMatch";

const WORLD_GRADIENTS: Record<string, string> = {
  metro: "from-[#3aa0ff] to-[#1d4ed8]",
  suburbs: "from-[#ff9a5c] to-[#c2417a]",
  neon: "from-[#9d4edd] to-[#240046]",
  frost: "from-[#9bd4ff] to-[#3f6fb5]",
  beach: "from-[#2ee6c8] to-[#0e8fa8]",
};

function goalText(level: LevelDef) {
  if (level.mode === "solo") return `Swallow ${level.stars[0]}% of the city (${level.stars[1]}% ★★, ${level.stars[2]}% ★★★)`;
  if (level.mode === "battle") return "Survive and finish top 3 — be the last hole standing for ★★★";
  return "Finish top 3 — be #1 for ★★★";
}

export default function LevelSelect() {
  const levelStars = useProfile((s) => s.levelStars);
  const startMatch = useApp((s) => s.startMatch);
  const unlocked = highestUnlockedLevel(levelStars);
  const [world, setWorld] = useState(() => Math.floor((unlocked - 1) / LEVELS_PER_WORLD));
  const [selected, setSelected] = useState<LevelDef | null>(null);

  const themeId = THEME_ORDER[world];
  const levels = LEVELS.slice(world * LEVELS_PER_WORLD, (world + 1) * LEVELS_PER_WORLD);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 scrollbar-thin sm:p-8">
      <ScreenHeader title="Levels" />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {THEME_ORDER.map((id, i) => {
          const locked = i * LEVELS_PER_WORLD + 1 > unlocked;
          return (
            <button
              key={id}
              disabled={locked}
              onClick={() => setWorld(i)}
              className={`shrink-0 cursor-pointer rounded-2xl bg-gradient-to-b px-4 py-2 font-display text-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${WORLD_GRADIENTS[id]} ${world === i ? "ring-4 ring-white" : "opacity-80 hover:opacity-100"}`}
            >
              {locked ? "🔒 " : ""}
              {i + 1}. {THEMES[id].name}
            </button>
          );
        })}
      </div>

      <div className={`rounded-3xl bg-gradient-to-br p-5 ${WORLD_GRADIENTS[themeId]} shadow-xl`}>
        <h2 className="font-display text-3xl text-outline">{THEMES[themeId].name}</h2>
        <p className="font-bold text-white/85">{THEMES[themeId].tagline}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {levels.map((level, i) => {
          const locked = level.id > unlocked;
          const stars = levelStars[level.id] ?? 0;
          const diff = DIFFICULTY_INFO[level.difficulty];
          return (
            <button
              key={level.id}
              disabled={locked}
              onClick={() => setSelected(level)}
              className="panel group flex cursor-pointer flex-col gap-3 rounded-3xl p-5 text-left transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50 animate-rise"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-5xl text-white/90">{locked ? "🔒" : level.id}</span>
                <span className="text-4xl">{MODE_INFO[level.mode].icon}</span>
              </div>
              <div>
                <div className="font-display text-2xl">{level.name}</div>
                <div className="text-sm font-bold text-white/60">
                  {MODE_INFO[level.mode].name} · {level.mode === "solo" ? "No bots" : `${level.bots} bots`}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Stars count={stars} />
                <span className="rounded-full px-3 py-0.5 text-xs font-black uppercase" style={{ background: diff.color, color: "#0b0a1f" }}>
                  {diff.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="panel w-full max-w-md rounded-3xl p-6 animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-black uppercase tracking-widest text-white/50">Level {selected.id}</div>
            <h2 className="font-display text-4xl">{selected.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-sm font-extrabold">
              <span className="rounded-full bg-white/10 px-3 py-1">{MODE_INFO[selected.mode].icon} {MODE_INFO[selected.mode].name}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">⏱ {Math.floor(selected.duration / 60)}:{String(selected.duration % 60).padStart(2, "0")}</span>
              <span className="rounded-full px-3 py-1 text-ink" style={{ background: DIFFICULTY_INFO[selected.difficulty].color }}>
                {DIFFICULTY_INFO[selected.difficulty].name} AI
              </span>
            </div>
            <p className="mt-4 font-bold text-white/80">{MODE_INFO[selected.mode].description}</p>
            <div className="mt-4 rounded-2xl bg-black/30 p-4">
              <div className="text-xs font-black uppercase tracking-widest text-white/50">Goal</div>
              <div className="font-bold">{goalText(selected)}</div>
              <div className="mt-2 text-sm font-bold text-[#ffd65c]">Reward up to ¢{selected.reward} + performance bonus</div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setSelected(null)}>
                Back
              </Button>
              <Button className="flex-[2]" onClick={() => startMatch(levelMatch(selected))}>
                ▶ Start
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
