"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_SOLO_STARS, LEVELS, MODE_INFO } from "@/game/config/levels";
import { SKIN_BY_ID } from "@/game/config/skins";
import type { HudSnapshot } from "@/game/engine/types";
import { useApp } from "@/store/app";
import { useProfile } from "@/store/profile";
import { sessionRef } from "./sessionRef";

const formatTime = (seconds: number) => {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

function Timer({ hud }: { hud: HudSnapshot }) {
  const urgent = hud.timeLeft <= 10 && hud.countdown <= 0;
  return (
    <div className="flex flex-col items-end gap-1 sm:items-center">
      <div
        className={`rounded-2xl px-4 py-0.5 font-display text-3xl tabular-nums text-outline ring-1 ring-white/20 sm:px-5 sm:py-1 sm:text-4xl ${urgent ? "animate-pulse bg-[#e8175d]/85" : "bg-black/45"}`}
      >
        {formatTime(hud.timeLeft)}
      </div>
      <div className="rounded-full bg-black/40 px-3 py-0.5 text-xs font-black uppercase tracking-widest text-white/80">
        {MODE_INFO[hud.mode].icon} {MODE_INFO[hud.mode].name}
        {hud.mode === "battle" && ` · ${hud.holesAlive} alive`}
      </div>
    </div>
  );
}

function SizeMeter({ hud }: { hud: HudSnapshot }) {
  const skin = useProfile((s) => SKIN_BY_ID[s.selectedSkin]);
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-black/40 p-1.5 pr-3 ring-1 ring-white/15 sm:gap-3 sm:p-2 sm:pr-4">
      <div
        className="grid h-11 w-11 place-items-center rounded-full font-display text-xl text-outline sm:h-14 sm:w-14 sm:text-2xl"
        style={{ background: `conic-gradient(${skin.colors[0]} ${hud.sizeProgress * 360}deg, rgb(255 255 255 / 0.15) 0)` }}
      >
        <div className="grid h-8 w-8 place-items-center rounded-full bg-[#120f2e] sm:h-11 sm:w-11">{hud.sizeLevel}</div>
      </div>
      <div>
        <div className="hidden text-[10px] font-black uppercase tracking-[0.2em] text-white/60 sm:block">Size</div>
        <div className="font-display text-xl leading-none tabular-nums sm:text-2xl">{hud.score.toLocaleString()}</div>
        {hud.mode !== "solo" && <div className="text-xs font-extrabold text-white/70">{ordinal(hud.rank)} of {hud.holes}</div>}
      </div>
    </div>
  );
}

function SoloProgress({ hud }: { hud: HudSnapshot }) {
  const match = useApp((s) => s.match);
  const level = match?.levelId ? LEVELS.find((l) => l.id === match.levelId) : undefined;
  const marks = level?.stars ?? DEFAULT_SOLO_STARS;
  const max = Math.max(100, marks[2] * 1.25);
  return (
    <div className="w-64 rounded-2xl bg-black/40 p-3 ring-1 ring-white/15">
      <div className="flex justify-between text-xs font-black uppercase tracking-widest text-white/70">
        <span>City swallowed</span>
        <span className="font-display text-base text-white">{hud.percent.toFixed(1)}%</span>
      </div>
      <div className="relative mt-2 h-3 rounded-full bg-white/15">
        <div className="h-full rounded-full bg-gradient-to-r from-[#7cf05a] to-[#ffd65c] transition-[width]" style={{ width: `${Math.min(100, (hud.percent / max) * 100)}%` }} />
        {marks.map((m, i) => (
          <span key={i} className={`absolute -top-1.5 -translate-x-1/2 text-sm ${hud.percent >= m ? "text-[#ffc93c]" : "text-white/40"}`} style={{ left: `${(m / max) * 100}%` }}>
            ★
          </span>
        ))}
      </div>
    </div>
  );
}

function Leaderboard({ hud }: { hud: HudSnapshot }) {
  const top = hud.leaderboard.slice(0, 5);
  const player = hud.leaderboard.find((r) => r.isPlayer);
  const rows = player && !top.includes(player) ? [...top, player] : top;
  return (
    <div className="w-40 rounded-2xl bg-black/40 p-1.5 ring-1 ring-white/15 sm:w-56 sm:p-2">
      {rows.map((row, i) => (
        <div
          key={row.id}
          className={`items-center gap-2 rounded-xl px-2 py-0.5 text-xs font-extrabold sm:py-1 sm:text-sm ${i >= 3 && !row.isPlayer ? "hidden sm:flex" : "flex"} ${row.isPlayer ? "bg-white/20" : ""} ${row.alive ? "" : "opacity-40 line-through"}`}
        >
          <span className="w-5 text-right text-white/60">{row.rank}</span>
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: SKIN_BY_ID[row.skinId].colors[0] }} />
          <span className="flex-1 truncate">{row.rank === 1 ? "👑 " : ""}{row.name}</span>
          <span className="tabular-nums text-white/80">{row.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function Minimap({ hud }: { hud: HudSnapshot }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "rgba(10, 8, 30, 0.55)";
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();
    const pad = 10;
    const scale = (size - pad * 2) / 2;
    for (const dot of hud.minimap) {
      if (!dot.alive) continue;
      const x = pad + (dot.x + 1) * scale;
      const y = pad + (dot.z + 1) * scale;
      const r = Math.max(3, dot.r * scale);
      ctx.fillStyle = SKIN_BY_ID[dot.skinId].colors[0];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (dot.isPlayer) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
  }, [hud]);
  return <canvas ref={ref} width={140} height={140} className="h-28 w-28 sm:h-36 sm:w-36" />;
}

/** Current time, refreshed on an interval so time-based UI can expire. */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function KillFeed() {
  const feed = useApp((s) => s.feed);
  const now = useNow(500);
  const kills = feed.filter((f) => f.item.kind === "kill" && now - f.at < 4500);
  return (
    <div className="flex flex-col items-end gap-1">
      {kills.map(({ id, item }) =>
        item.kind === "kill" ? (
          <div
            key={id}
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-extrabold animate-rise ${item.byPlayer ? "bg-[#2fbf4a]/80" : item.ofPlayer ? "bg-[#e8175d]/80" : "bg-black/45"}`}
          >
            <span style={{ color: item.byPlayer ? "#fff" : SKIN_BY_ID[item.eaterSkin].colors[0] }}>{item.eater}</span>
            <span>🕳️</span>
            <span style={{ color: item.ofPlayer ? "#fff" : SKIN_BY_ID[item.victimSkin].colors[0] }}>{item.victim}</span>
          </div>
        ) : null,
      )}
    </div>
  );
}

function LevelUpToast() {
  const feed = useApp((s) => s.feed);
  const now = useNow(200);
  const last = [...feed].reverse().find((f) => f.item.kind === "levelUp");
  if (!last || last.item.kind !== "levelUp" || now - last.at > 1400) return null;
  return (
    <div key={last.id} className="font-display text-5xl text-[#ffe066] text-outline animate-pop sm:text-6xl">
      SIZE UP! <span className="text-white">Lv {last.item.level}</span>
    </div>
  );
}

function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const joy = sessionRef.current?.joystick;
      const base = baseRef.current;
      const knob = knobRef.current;
      if (!base || !knob) return;
      if (!joy?.active) {
        base.style.opacity = "0";
        return;
      }
      base.style.opacity = "1";
      base.style.transform = `translate(${joy.baseX}px, ${joy.baseY}px) translate(-50%, -50%)`;
      knob.style.transform = `translate(${joy.knobX - joy.baseX}px, ${joy.knobY - joy.baseY}px)`;
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div ref={baseRef} className="pointer-events-none fixed left-0 top-0 grid h-32 w-32 place-items-center rounded-full border-4 border-white/30 bg-white/10 opacity-0 transition-opacity">
      <div ref={knobRef} className="h-14 w-14 rounded-full bg-white/70 shadow-lg" />
    </div>
  );
}

function CenterMessages({ hud }: { hud: HudSnapshot }) {
  if (hud.countdown > 0) {
    const n = Math.ceil(hud.countdown);
    return (
      <div key={n} className="font-display text-[9rem] leading-none text-white text-outline animate-pop">
        {n}
      </div>
    );
  }
  if (hud.countdown <= 0 && hud.duration - hud.timeLeft < 0.8) {
    return <div className="font-display text-8xl text-[#7cf05a] text-outline animate-pop">GO!</div>;
  }
  if (!hud.alive && hud.respawnIn > 0) {
    return (
      <div className="panel rounded-3xl px-8 py-5 text-center animate-pop">
        <div className="font-display text-3xl text-[#ff5c8a]">Swallowed{hud.eatenBy ? ` by ${hud.eatenBy}` : ""}!</div>
        <div className="font-bold text-white/80">Respawning in {hud.respawnIn.toFixed(1)}s</div>
      </div>
    );
  }
  return <LevelUpToast />;
}

export default function Hud() {
  const hud = useApp((s) => s.hud);
  const setPaused = useApp((s) => s.setPaused);
  const result = useApp((s) => s.result);
  const minimap = useProfile((s) => s.settings.minimap);
  if (!hud) return null;

  return (
    <div className="pointer-events-none absolute inset-0 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused(true)}
              className="pointer-events-auto grid h-12 w-12 cursor-pointer place-items-center rounded-2xl bg-black/45 font-display text-2xl ring-1 ring-white/20 transition hover:bg-black/60"
              aria-label="Pause"
            >
              ❚❚
            </button>
            <SizeMeter hud={hud} />
          </div>
          {hud.mode === "solo" && <SoloProgress hud={hud} />}
        </div>
        <div className="absolute left-1/2 top-4 hidden -translate-x-1/2 sm:block">
          <Timer hud={hud} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="sm:hidden">
            <Timer hud={hud} />
          </div>
          {hud.mode !== "solo" && (
            <>
              <Leaderboard hud={hud} />
              <KillFeed />
            </>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 top-[28%] flex justify-center">{!result && <CenterMessages hud={hud} />}</div>

      {minimap && (
        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
          <Minimap hud={hud} />
        </div>
      )}
      <Joystick />
    </div>
  );
}
