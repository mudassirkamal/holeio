"use client";

import { useState } from "react";
import { DIFFICULTY_INFO, MODE_INFO, type Difficulty, type GameMode } from "@/game/config/levels";
import { THEMES, THEME_ORDER, type ThemeId } from "@/game/config/themes";
import { useApp } from "@/store/app";
import { Button } from "../ui/Button";
import { ScreenHeader } from "../ui/ScreenHeader";

const MAP_SIZES = [
  { label: "Small", blocks: 4 },
  { label: "Medium", blocks: 5 },
  { label: "Large", blocks: 6 },
  { label: "Huge", blocks: 7 },
] as const;

function Choice<T extends string | number>({
  value,
  current,
  onSelect,
  children,
}: {
  value: T;
  current: T;
  onSelect: (v: T) => void;
  children: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      onClick={() => onSelect(value)}
      className={`cursor-pointer rounded-2xl px-4 py-3 text-left font-bold transition ${active ? "bg-white text-ink shadow-lg" : "bg-white/10 hover:bg-white/20"}`}
    >
      {children}
    </button>
  );
}

export default function QuickPlay() {
  const startMatch = useApp((s) => s.startMatch);
  const [mode, setMode] = useState<GameMode>("classic");
  const [theme, setTheme] = useState<ThemeId>("metro");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [bots, setBots] = useState(9);
  const [blocks, setBlocks] = useState(5);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 scrollbar-thin sm:p-8">
      <ScreenHeader title="Quick Play" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 font-display text-2xl">Mode</h2>
          <div className="grid gap-2">
            {(Object.keys(MODE_INFO) as GameMode[]).map((m) => (
              <Choice key={m} value={m} current={mode} onSelect={setMode}>
                <div className="font-display text-xl">{MODE_INFO[m].icon} {MODE_INFO[m].name}</div>
                <div className="text-sm opacity-75">{MODE_INFO[m].description}</div>
              </Choice>
            ))}
          </div>
        </section>
        <section className="panel rounded-3xl p-5">
          <h2 className="mb-3 font-display text-2xl">City</h2>
          <div className="grid grid-cols-2 gap-2">
            {THEME_ORDER.map((t) => (
              <Choice key={t} value={t} current={theme} onSelect={setTheme}>
                <div className="font-display text-lg">{THEMES[t].name}</div>
              </Choice>
            ))}
          </div>
          <h2 className="mb-3 mt-5 font-display text-2xl">Map size</h2>
          <div className="grid grid-cols-4 gap-2">
            {MAP_SIZES.map((s) => (
              <Choice key={s.blocks} value={s.blocks} current={blocks} onSelect={setBlocks}>
                <div className="text-center">{s.label}</div>
              </Choice>
            ))}
          </div>
        </section>
        {mode !== "solo" && (
          <section className="panel rounded-3xl p-5 lg:col-span-2">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h2 className="mb-3 font-display text-2xl">Bot brains</h2>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => (
                    <Choice key={d} value={d} current={difficulty} onSelect={setDifficulty}>
                      <div className="text-center" style={{ color: difficulty === d ? undefined : DIFFICULTY_INFO[d].color }}>
                        {DIFFICULTY_INFO[d].name}
                      </div>
                    </Choice>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="mb-3 font-display text-2xl">Opponents: {bots}</h2>
                <input
                  type="range"
                  min={3}
                  max={11}
                  value={bots}
                  onChange={(e) => setBots(Number(e.target.value))}
                  className="w-full accent-[#ff5c95]"
                  aria-label="Number of bots"
                />
              </div>
            </div>
          </section>
        )}
      </div>
      <div className="flex justify-center pb-4">
        <Button
          size="xl"
          onClick={() =>
            startMatch({
              mode,
              themeId: theme,
              duration: 120,
              blocksPerSide: blocks,
              seed: Math.floor(Math.random() * 1e9),
              bots: mode === "solo" ? 0 : bots,
              difficulty,
              levelId: null,
            })
          }
        >
          ▶ START
        </Button>
      </div>
    </div>
  );
}
