"use client";

import { audio } from "@/game/audio/AudioEngine";
import { THEMES, THEME_ORDER, type ThemeDef, type ThemeId } from "@/game/config/themes";

/** "Long" for wide strips, "Tall" for deep ones; nothing for square maps. */
const shapeTag = ({ shape: [x, z] }: ThemeDef) => (x > z * 1.3 ? "Long" : z > x * 1.3 ? "Tall" : null);

interface MapPickerProps<T extends ThemeId | "random"> {
  value: T;
  onSelect: (value: T) => void;
  disabled?: boolean;
  /** Adds a "Random" tile (multiplayer lobbies). */
  allowRandom?: boolean;
}

/** Grid of map tiles, with the selected map's description underneath. */
export function MapPicker<T extends ThemeId | "random">({ value, onSelect, disabled = false, allowRandom = false }: MapPickerProps<T>) {
  const options: (ThemeId | "random")[] = allowRandom ? ["random", ...THEME_ORDER] : [...THEME_ORDER];
  return (
    <div>
      <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto p-1 scrollbar-thin sm:grid-cols-4 short:max-h-40">
        {options.map((id) => {
          const theme = id === "random" ? null : THEMES[id];
          const [from, to] = theme?.gradient ?? ["#6b7280", "#1f2937"];
          const tag = theme && shapeTag(theme);
          return (
            <button
              key={id}
              disabled={disabled}
              onClick={() => {
                audio.click();
                onSelect(id as T);
              }}
              aria-pressed={value === id}
              style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
              className={`relative flex cursor-pointer flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-center transition disabled:cursor-default ${value === id ? "ring-4 ring-inset ring-white" : disabled ? "opacity-40" : "opacity-75 hover:opacity-100"}`}
            >
              <span className="text-2xl leading-none">{theme?.icon ?? "🎲"}</span>
              <span className="font-display text-sm leading-tight text-outline">{theme?.name ?? "Random"}</span>
              {tag && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/45 px-1.5 text-[9px] font-black uppercase tracking-wider">{tag}</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm font-bold text-white/70">{value === "random" ? "A different map every match." : THEMES[value as ThemeId].tagline}</p>
    </div>
  );
}
