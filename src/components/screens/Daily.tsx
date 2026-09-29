"use client";

import { useEffect, useState } from "react";
import { DIFFICULTY_INFO } from "@/game/config/levels";
import { POWER_UPS, POWER_UP_KINDS } from "@/game/config/powerUps";
import { THEMES } from "@/game/config/themes";
import { dailyChallenge, msUntilNextDay } from "@/game/leaderboard/boards";
import { useApp } from "@/store/app";
import { useLeaderboard } from "@/store/leaderboard";
import { useProfile } from "@/store/profile";
import { Button } from "../ui/Button";
import { GlobalBoard } from "../ui/GlobalBoard";
import { ScreenHeader } from "../ui/ScreenHeader";
import { dailyMatch } from "./dailyMatch";

const MAP_NAMES: Record<number, string> = { 5: "Medium", 6: "Large" };

/** Milliseconds until the next UTC midnight, refreshed every half minute. */
function useTimeToReset() {
  const [left, setLeft] = useState(() => msUntilNextDay());
  useEffect(() => {
    const id = window.setInterval(() => setLeft(msUntilNextDay()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return left;
}

/** One city a day, the same for everyone, with a world ranking that resets at midnight UTC. */
export default function Daily() {
  const startMatch = useApp((s) => s.startMatch);
  const configured = useLeaderboard((s) => s.configured);
  const left = useTimeToReset();
  // Re-derived after midnight (the countdown ticking over re-renders the screen).
  const challenge = dailyChallenge();
  const best = useProfile((s) => s.bestScores[challenge.board]);
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const facts = [
    `🏙️ ${THEMES[challenge.themeId].name}`,
    `🗺️ ${MAP_NAMES[challenge.blocksPerSide]} map`,
    `🤖 ${challenge.bots} ${DIFFICULTY_INFO[challenge.difficulty].name} bots`,
    `⏱ ${challenge.duration / 60} min`,
    `${POWER_UP_KINDS.map((k) => POWER_UPS[k].icon).join("")} Power-ups`,
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 scrollbar-thin sm:p-8 short:gap-3 short:p-3">
      <ScreenHeader title="Daily Challenge" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel flex flex-col gap-4 rounded-3xl p-5 short:gap-3">
          <div>
            <div className="text-sm font-black uppercase tracking-widest text-white/55">{challenge.day}</div>
            <h2 className="font-display text-4xl text-outline short:text-3xl">Today&apos;s city</h2>
            <p className="mt-1 font-bold text-white/75">Everyone plays the same city with the same bots today. Score as high as you can: your best run counts.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-extrabold">
            {facts.map((f) => (
              <span key={f} className="rounded-full bg-white/10 px-3 py-1">
                {f}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-black/30 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/50">Your best today</div>
              <div className="font-display text-2xl">{best ? best.toLocaleString() : "—"}</div>
            </div>
            <div className="rounded-2xl bg-black/30 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/50">New city in</div>
              <div className="font-display text-2xl tabular-nums">
                {hours}h {String(minutes).padStart(2, "0")}m
              </div>
            </div>
          </div>
          <Button size="xl" onClick={() => startMatch(dailyMatch(challenge))}>
            ▶ PLAY
          </Button>
          {configured === false && (
            <p className="text-center text-sm font-bold text-white/60">World rankings aren&apos;t switched on yet. Your best score is saved on this device.</p>
          )}
        </section>
        {configured !== false && (
          <section className="panel rounded-3xl p-5">
            <GlobalBoard board={challenge.board} rows={20} title="🌍 Today's world ranking" />
          </section>
        )}
      </div>
    </div>
  );
}
