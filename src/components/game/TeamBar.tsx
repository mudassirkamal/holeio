import { TEAMS } from "@/game/config/teams";
import type { TeamStatus } from "@/game/engine/types";

/** Red vs Blue totals with a tug-of-war bar; the player's team is marked. */
export default function TeamBar({ teams, large = false }: { teams: TeamStatus; large?: boolean }) {
  const [red, blue] = teams.scores;
  const total = red + blue;
  const redShare = total > 0 ? (red / total) * 100 : 50;
  const side = (team: 0 | 1) => (
    <div className={`flex items-center gap-1.5 ${team === 1 ? "flex-row-reverse" : ""}`}>
      <span className={`font-display tabular-nums ${large ? "text-3xl" : "text-lg short:text-base"}`} style={{ color: TEAMS[team].color }}>
        {teams.scores[team].toLocaleString()}
      </span>
      {teams.player === team && <span className="rounded-full bg-white px-1.5 text-[10px] font-black text-ink">YOU</span>}
    </div>
  );
  return (
    <div className={`w-full rounded-2xl bg-black/45 ring-1 ring-white/15 ${large ? "p-3" : "px-3 py-1.5 short:py-1"}`}>
      <div className="flex items-center justify-between gap-3">
        {side(0)}
        <span className="text-xs font-black uppercase tracking-widest text-white/60">vs</span>
        {side(1)}
      </div>
      <div className={`mt-1 flex overflow-hidden rounded-full bg-white/10 ${large ? "h-3" : "h-2"}`}>
        <div className="transition-[width] duration-500" style={{ width: `${redShare}%`, background: TEAMS[0].color }} />
        <div className="flex-1" style={{ background: TEAMS[1].color }} />
      </div>
    </div>
  );
}
