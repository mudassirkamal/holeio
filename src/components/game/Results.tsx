"use client";

import { LEVELS } from "@/game/config/levels";
import { SKIN_BY_ID } from "@/game/config/skins";
import { useApp } from "@/store/app";
import { Stars } from "../ui/Badges";
import { Button } from "../ui/Button";
import { levelMatch } from "../screens/levelMatch";

const BITE_NAMES: Partial<Record<string, string>> = {
  skyscraper: "Skyscraper",
  tower: "Tower",
  office: "Office",
  apartment: "Apartments",
  gasStation: "Gas station",
  waterTower: "Water tower",
  shop: "Shop",
  house: "House",
  houseSmall: "Cottage",
  bus: "Bus",
  truck: "Truck",
  billboard: "Billboard",
  statue: "Statue",
  fountain: "Fountain",
  lifeguardTower: "Lifeguard tower",
  busStop: "Bus stop",
  phoneBooth: "Phone booth",
  newsStand: "News stand",
  trafficLight: "Traffic light",
  lampPost: "Lamp post",
  pineTree: "Pine tree",
  palmTree: "Palm tree",
  beachUmbrella: "Umbrella",
  parkingMeter: "Parking meter",
  trashCan: "Trash can",
  flowerPot: "Flower pot",
  deckChair: "Deck chair",
};

const biteName = (id: string) => BITE_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

function headline(mode: string, rank: number, percent: number, won: boolean, eliminated: boolean) {
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
  if (!result || !reward || !match) return null;

  const level = match.levelId !== null ? LEVELS.find((l) => l.id === match.levelId) : undefined;
  const nextLevel = level ? LEVELS.find((l) => l.id === level.id + 1) : undefined;
  const won = level ? reward.stars > 0 : result.rank === 1 || (result.mode === "solo" && result.percent >= 25);
  const stats: [string, string][] = [
    ["Score", result.score.toLocaleString()],
    ["Objects", result.objectsEaten.toLocaleString()],
    ...(result.mode !== "solo" ? ([["Holes eaten", String(result.kills)]] as [string, string][]) : []),
    ["Best combo", `×${result.bestCombo}`],
    ["City", `${result.percent.toFixed(1)}%`],
    ["Biggest bite", result.biggestBite ? biteName(result.biggestBite) : "—"],
  ];

  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="panel w-full max-w-lg rounded-3xl p-6 text-center animate-pop">
        {level && <div className="text-sm font-black uppercase tracking-widest text-white/55">Level {level.id} · {level.name}</div>}
        <h2 className={`font-display text-5xl text-outline sm:text-6xl ${won ? "text-[#ffe066]" : "text-white"}`}>
          {headline(result.mode, result.rank, result.percent, won, result.eliminated)}
        </h2>
        {level && (
          <div className="mt-2 flex justify-center">
            <Stars count={reward.stars} size="text-5xl" animate />
          </div>
        )}
        {level && !won && <p className="mt-1 font-bold text-white/70">{level.mode === "solo" ? `Swallow ${level.stars[0]}% to pass` : "Finish in the top 3 to pass"}</p>}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-black/30 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/50">{label}</div>
              <div className="truncate font-display text-xl">{value}</div>
            </div>
          ))}
        </div>

        {result.mode !== "solo" && (
          <div className="mt-4 max-h-40 overflow-y-auto rounded-2xl bg-black/25 p-2 scrollbar-thin">
            {result.leaderboard.map((row) => (
              <div key={row.id} className={`flex items-center gap-2 rounded-xl px-2 py-1 text-sm font-extrabold ${row.isPlayer ? "bg-white/20" : ""}`}>
                <span className="w-6 text-right text-white/60">{row.rank}</span>
                <span className="h-3 w-3 rounded-full" style={{ background: SKIN_BY_ID[row.skinId].colors[0] }} />
                <span className="flex-1 truncate text-left">{row.name}</span>
                <span className="tabular-nums">{row.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-2 font-display text-3xl text-[#ffd65c] animate-pop" style={{ animationDelay: "0.9s" }}>
          +¢{reward.coins}
          {reward.newBest && <span className="rounded-full bg-lime px-2 py-0.5 text-sm text-ink">NEW BEST</span>}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
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
      </div>
    </div>
  );
}
