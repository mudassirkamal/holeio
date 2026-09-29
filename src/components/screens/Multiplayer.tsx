"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeRoomCode } from "@/game/net/config";
import { useNet } from "@/store/net";
import { Button } from "../ui/Button";
import { ScreenHeader } from "../ui/ScreenHeader";

function Card({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="panel flex flex-col gap-3 rounded-3xl p-5 animate-rise">
      <h2 className="font-display text-2xl">
        <span className="mr-2">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function Multiplayer() {
  const { busy, status, error, signalMode, quickMatch, createRoom, joinRoom, clearError, detectSignaling } = useNet();
  const [code, setCode] = useState("");
  const autoJoined = useRef(false);

  useEffect(() => {
    detectSignaling();
  }, [detectSignaling]);

  // Invite links look like ?room=ABCDE and join straight away.
  useEffect(() => {
    if (autoJoined.current) return;
    autoJoined.current = true;
    const invited = normalizeRoomCode(new URLSearchParams(window.location.search).get("room") ?? "");
    if (invited.length === 5) void joinRoom(invited);
  }, [joinRoom]);

  const canJoin = code.length === 5 && !busy;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 scrollbar-thin sm:p-8">
      <ScreenHeader title="Multiplayer" />

      {(status || error) && (
        <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 font-bold ${error ? "bg-[#e8175d]/80" : "bg-black/45"}`}>
          <span>{error ?? status}</span>
          {busy && <span className="h-5 w-5 animate-spin rounded-full border-4 border-white/30 border-t-white" />}
          {error && (
            <button onClick={clearError} className="cursor-pointer text-xl" aria-label="Dismiss">
              ✕
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card icon="🌍" title="Quick Match">
          <p className="font-bold text-white/75">Jump into a public match with players from around the world. Empty seats are filled with bots.</p>
          <Button size="lg" disabled={busy} onClick={() => void quickMatch()}>
            Find a match
          </Button>
        </Card>

        <Card icon="🔒" title="Private Room">
          <p className="font-bold text-white/75">Create a room, then share its code or invite link with friends — anywhere in the world.</p>
          <Button variant="secondary" size="lg" disabled={busy} onClick={() => void createRoom()}>
            Create room
          </Button>
        </Card>

        <Card icon="🎟️" title="Join with a code">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (canJoin) void joinRoom(code);
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
              placeholder="ABCDE"
              className="w-full min-w-0 rounded-2xl bg-black/35 px-4 py-2 text-center font-display text-3xl uppercase tracking-[0.3em] outline-none ring-1 ring-white/15 focus:ring-2 focus:ring-sky"
              aria-label="Room code"
            />
            <Button variant="green" size="lg" disabled={!canJoin} type="submit">
              Join
            </Button>
          </form>
        </Card>

        <Card icon="📶" title="Local network">
          <p className="font-bold text-white/75">
            On the same Wi-Fi? Create a private room and have friends join with the code — the game traffic goes directly between your
            devices over your local network.
          </p>
          <p className="text-sm font-bold text-white/60">
            No internet at all? Run <code className="rounded bg-black/40 px-1.5 py-0.5">npm run lan</code> on one computer and open the address it
            prints on every device.
          </p>
          {signalMode === "local" && <p className="text-sm font-black text-lime">✓ Local server detected — offline play is on.</p>}
        </Card>
      </div>

      <p className="text-center text-xs font-bold text-white/55">
        Voice chat: allow microphone access in the lobby. Hold V (or the mic button) for push-to-talk. In matches, voices get quieter the
        farther away a player&apos;s hole is.
      </p>
    </div>
  );
}
