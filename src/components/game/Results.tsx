"use client";

import { LEVELS } from "@/game/config/levels";
import { SKIN_BY_ID } from "@/game/config/skins";
import { TEAMS } from "@/game/config/teams";
import type { MatchResult } from "@/game/engine/types";
import { useApp } from "@/store/app";
import { useNet } from "@/store/net";
import { Stars } from "../ui/Badges";
import { Button } from "../ui/Button";
import { biteName } from "@/game/config/objectNames";
import { levelMatch } from "../screens/levelMatch";
import ClipCard from "./ClipCard";
import TeamBar from "./TeamBar";


function headline({ mode, rank, percent, eliminated, teams }: MatchResult, won: boolean) {
  if (teams) return teams.winner < 0 ? "IT'S A DRAW!" : `${TEAMS[teams.winner].name.toUpperCase()} TEAM WINS!`;
  if (mode === "solo") return won ? `${percent.toFixed(0)}% SWALLOWED!` : `${percent.toFixed(0)}% swallowed`;
  if (rank === 1) return mode === "battle" ? "LAST HOLE STANDING!" : "VICTORY!";
  if (eliminated) return "SWALLOWED!";
  return `${rank}${rank === 2 ? "nd" : rank === 3 ? "rd" : "th"} PLACE`;
}

export default function Results() {
  const result = useApp((s) => s.result);
  const reward = useApp((s) => s.reward);
  const match = useApp((s) => s.match);
  const startMatch = useApp((s) => s.startMatch);
  const quit = useApp((s) => s.quitToMenu);
  const clips = useApp((s) => s.clips);
  const room = useNet((s) => s.room);
  const leaveRoom = useNet((s) => s.leave);
  if (!result || !reward || !match) return null;
  const online = Boolean(match.net);

  const level = match.levelId !== null ? LEVELS.find((l) => l.id === match.levelId) : undefined;
  const nextLevel = level ? LEVELS.find((l) => l.id === level.id + 1) : undefined;
  const { won } = reward;
  const stats: [string, string][] = [
    ["Score", result.score.toLocaleString()],
    ["Objects", result.objectsEaten.toLocaleString()],
    ...(result.mode !== "solo" ? ([["Holes eaten", String(result.kills)]] as [string, string][]) : []),
    ["Best combo", `×${result.bestCombo}`],
    ["City", `${result.percent.toFixed(1)}%`],
    ["Biggest bite", result.biggestBite ? biteName(result.biggestBite) : "—"],
  ];

  return (
    // `m-auto` centres the panel but, unlike grid centring, still scrolls fully when it
    // is taller than the screen. Short screens split it into two columns.
    <div className="absolute inset-0 z-30 flex overflow-y-auto bg-black/60 p-4 backdrop-blur-sm short:p-3">
      <div className="panel m-auto w-full max-w-lg rounded-3xl p-6 text-center animate-pop short:grid short:max-w-3xl short:grid-cols-2 short:items-center short:gap-4 short:p-4">
        <div>
          {level && <div className="text-sm font-black uppercase tracking-widest text-white/55">Level {level.id} · {level.name}</div>}
          <h2 className={`font-display text-5xl text-outline sm:text-6xl short:text-4xl ${won ? "text-[#ffe066]" : "text-white"}`}>
            {headline(result, won)}
          </h2>
          {result.teams && (
            <div className="mt-2">
              <TeamBar teams={result.teams} large />
            </div>
          )}
          {level && (
            <div className="mt-2 flex justify-center short:mt-1">
              <Stars count={reward.stars} size="text-5xl short:text-4xl" animate />
            </div>
          )}
          {level && !won && <p className="mt-1 font-bold text-white/70">{level.mode === "solo" ? `Swallow ${level.stars[0]}% to pass` : "Finish in the top 3 to pass"}</p>}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 short:mt-2">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-black/30 px-3 py-2 short:py-1.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50">{label}</div>
                <div className="truncate font-display text-xl short:text-lg">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {clips.length > 0 && <ClipCard clips={clips} />}
          {result.mode !== "solo" && (
            // On short screens a clip takes the leaderboard's place, so the buttons stay in view.
            <div className={`mt-4 max-h-40 overflow-y-auto rounded-2xl bg-black/25 p-2 scrollbar-thin short:mt-0 short:max-h-36 ${clips.length > 0 ? "short:hidden" : ""}`}>
              {result.leaderboard.map((row) => (
                <div key={row.id} className={`flex items-center gap-2 rounded-xl px-2 py-1 text-sm font-extrabold ${row.isPlayer ? "bg-white/20" : ""}`}>
                  <span className="w-6 text-right text-white/60">{row.rank}</span>
                  <span className="h-3 w-3 rounded-full" style={{ background: row.team >= 0 ? TEAMS[row.team].color : SKIN_BY_ID[row.skinId].colors[0] }} />
                  <span className="flex-1 truncate text-left">{row.name}</span>
                  <span className="tabular-nums">{row.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 font-display text-3xl text-[#ffd65c] animate-pop short:mt-2 short:text-2xl" style={{ animationDelay: "0.9s" }}>
            +¢{reward.coins}
            {reward.newBest && <span className="rounded-full bg-lime px-2 py-0.5 text-sm text-ink">NEW BEST</span>}
          </div>

          {online ? (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row short:mt-3">
              <Button variant="ghost" className="flex-1" onClick={leaveRoom}>
                Leave room
              </Button>
              {room?.isHost ? (
                <Button className="flex-[1.4]" onClick={() => room.returnToLobby()}>
                  Back to lobby
                </Button>
              ) : (
                <div className="flex flex-[1.4] items-center justify-center rounded-2xl bg-black/30 px-4 py-2 font-bold text-white/70">
                  Waiting for the host…
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row short:mt-3">
              <Button variant="ghost" className="flex-1" onClick={quit}>
                Menu
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => startMatch({ ...match, seed: level ? match.seed : Math.floor(Math.random() * 1e9) })}>
                ↻ Retry
              </Button>
              {won && nextLevel && (
                <Button className="flex-[1.4]" onClick={() => startMatch(levelMatch(nextLevel))}>
                  Next ▶
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
