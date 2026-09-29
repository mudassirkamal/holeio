"use client";

import { useEffect, useState } from "react";
import { SKIN_BY_ID, type SkinId } from "@/game/config/skins";
import type { BoardResponse, BoardRow } from "@/game/leaderboard/boards";
import { useLeaderboard } from "@/store/leaderboard";
import { useProfile } from "@/store/profile";

const skinColor = (skin: string) => SKIN_BY_ID[skin as SkinId]?.colors[0] ?? "#ffffff";

function Row({ row }: { row: Pick<BoardRow, "rank" | "name" | "skin" | "score" | "me"> }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-2 py-1 text-sm font-extrabold ${row.me ? "bg-white/20" : ""}`}>
      <span className="w-8 text-right tabular-nums text-white/60">{row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}</span>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: skinColor(row.skin) }} />
      <span className="flex-1 truncate text-left">{row.name}</span>
      <span className="tabular-nums">{row.score.toLocaleString()}</span>
    </div>
  );
}

/**
 * The world's best scores on a board, with the player's own standing. Renders nothing
 * while the server has no leaderboard database.
 */
export function GlobalBoard({ board, rows = 10, title = "🌍 World ranking" }: { board: string; rows?: number; title?: string }) {
  const fetchBoard = useLeaderboard((s) => s.fetchBoard);
  const configured = useLeaderboard((s) => s.configured);
  const playerName = useProfile((s) => s.playerName);
  const playerSkin = useProfile((s) => s.selectedSkin);
  const [state, setState] = useState<{ board: string; data: BoardResponse | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchBoard(board).then((data) => !cancelled && setState({ board, data }));
    return () => {
      cancelled = true;
    };
  }, [board, fetchBoard]);

  const loading = state?.board !== board;
  const data = loading ? null : state.data;
  if (configured === false || (data && !data.configured)) return null;

  const top = data?.top.slice(0, rows) ?? [];
  const me = data?.me ?? null;
  const meShown = top.some((r) => r.me);

  return (
    <div className="rounded-2xl bg-black/25 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-black uppercase tracking-widest text-white/55">
        <span>{title}</span>
        {me && <span className="shrink-0">{me.total.toLocaleString()} players</span>}
      </div>
      {loading ? (
        <div className="py-3 text-center text-sm font-bold text-white/55">Loading world scores…</div>
      ) : !data ? (
        <div className="py-3 text-center text-sm font-bold text-white/55">Couldn&apos;t reach the leaderboard.</div>
      ) : top.length === 0 ? (
        <div className="py-3 text-center text-sm font-bold text-white/70">No scores yet. Be the first!</div>
      ) : (
        <div className="flex flex-col">
          {top.map((row) => (
            <Row key={row.rank} row={row} />
          ))}
          {me && !meShown && (
            <>
              <div className="text-center text-xs leading-3 text-white/40">⋯</div>
              <Row row={{ rank: me.rank, name: playerName, skin: playerSkin, score: me.best, me: true }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
