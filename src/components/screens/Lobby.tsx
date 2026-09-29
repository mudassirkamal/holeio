"use client";

import { useEffect, useState } from "react";
import { DIFFICULTY_INFO, MODE_INFO, type Difficulty } from "@/game/config/levels";
import { THEMES, THEME_ORDER } from "@/game/config/themes";
import { NET } from "@/game/net/config";
import type { RoomSettings } from "@/game/net/protocol";
import { useNet } from "@/store/net";
import VoiceControls from "../game/VoiceControls";
import { SkinSwatch } from "../ui/Badges";
import { Button } from "../ui/Button";

function Pill<T extends string | number>({ value, current, disabled, onSelect, children }: { value: T; current: T; disabled: boolean; onSelect: (v: T) => void; children: React.ReactNode }) {
  const active = value === current;
  return (
    <button
      disabled={disabled}
      onClick={() => onSelect(value)}
      className={`rounded-xl px-3 py-1.5 text-sm font-extrabold transition disabled:cursor-default ${active ? "bg-white text-ink" : "bg-white/10 enabled:cursor-pointer enabled:hover:bg-white/20"} ${disabled && !active ? "opacity-50" : ""}`}
    >
      {children}
    </button>
  );
}

function useCountdown(target: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [target]);
  return target === null ? null : Math.max(0, Math.ceil((target - now) / 1000));
}

export default function Lobby() {
  const { room, lobby, voiceState, leave, updateSettings, startMatch, setReady, toggleMute } = useNet();
  const [copied, setCopied] = useState<string | null>(null);
  const autoStart = useCountdown(lobby?.autoStartAt ?? null);
  if (!room || !lobby) return null;

  const isHost = room.isHost;
  const me = lobby.players.find((p) => p.peerId === room.myPeerId);
  const s = lobby.settings;
  const set = (patch: Partial<RoomSettings>) => updateSettings(patch);
  const locked = !isHost || lobby.isPublic;
  const botSeats = Math.min(s.bots, NET.maxHoles - lobby.players.length);
  const inviteLink = `${window.location.origin}${window.location.pathname}?room=${lobby.code}`;

  const copy = (text: string, label: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 scrollbar-thin sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.3em] text-white/55">{lobby.isPublic ? "Public match" : "Private room"}</div>
          <h1 className="font-display text-4xl text-outline sm:text-5xl">Lobby</h1>
        </div>
        {!lobby.isPublic && (
          <div className="panel flex items-center gap-3 rounded-2xl p-2 pl-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/55">Room code</div>
              <div className="font-display text-3xl tracking-[0.25em]">{lobby.code}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => copy(lobby.code, "code")}>
              {copied === "code" ? "Copied!" : "Copy code"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => copy(inviteLink, "link")}>
              {copied === "link" ? "Copied!" : "Invite link"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="panel flex flex-col gap-2 rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">
              Players {lobby.players.length}/{NET.maxPlayers}
            </h2>
            <VoiceControls />
          </div>
          {lobby.players.map((p) => {
            const speaking = voiceState?.speaking.includes(p.peerId);
            const muted = voiceState?.muted.includes(p.peerId);
            const isMe = p.peerId === room.myPeerId;
            return (
              <div key={p.peerId} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${isMe ? "bg-white/15" : "bg-black/20"}`}>
                <div className={`rounded-full ${speaking ? "ring-4 ring-lime" : ""}`}>
                  <SkinSwatch skinId={p.skinId} size={40} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-xl">
                    {p.isHost && "👑 "}
                    {p.name}
                    {isMe && <span className="ml-2 text-sm text-white/60">(you)</span>}
                  </div>
                  <div className="text-xs font-bold text-white/60">
                    {p.isHost ? "Host" : p.ready ? "Ready" : "Not ready"}
                    {!p.isHost && ` · ${p.ping} ms`}
                    {speaking && " · talking"}
                  </div>
                </div>
                {!isMe && voiceState?.connected.includes(p.peerId) && (
                  <button onClick={() => toggleMute(p.peerId)} className="cursor-pointer rounded-xl bg-white/10 px-2 py-1 text-lg hover:bg-white/20" aria-label={muted ? "Unmute" : "Mute"}>
                    {muted ? "🔇" : "🔊"}
                  </button>
                )}
                {p.ready && <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-black text-ink">✓</span>}
              </div>
            );
          })}
          {botSeats > 0 && (
            <div className="rounded-2xl bg-black/15 px-3 py-2 text-sm font-bold text-white/60">
              🤖 {botSeats} bot{botSeats === 1 ? "" : "s"} ({DIFFICULTY_INFO[s.difficulty].name}) will fill the remaining seats
            </div>
          )}
        </section>

        <section className="panel flex flex-col gap-4 rounded-3xl p-4">
          <h2 className="font-display text-2xl">Match settings {locked && <span className="text-sm text-white/50">{lobby.isPublic ? "(public defaults)" : "(host decides)"}</span>}</h2>
          <div className="flex flex-wrap gap-2">
            {(["classic", "battle"] as const).map((m) => (
              <Pill key={m} value={m} current={s.mode} disabled={locked} onSelect={(mode) => set({ mode })}>
                {MODE_INFO[m].icon} {MODE_INFO[m].name}
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill value="random" current={s.themeId} disabled={locked} onSelect={(themeId) => set({ themeId })}>
              🎲 Random city
            </Pill>
            {THEME_ORDER.map((t) => (
              <Pill key={t} value={t} current={s.themeId} disabled={locked} onSelect={(themeId) => set({ themeId })}>
                {THEMES[t].name}
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[4, 5, 6, 7].map((b) => (
              <Pill key={b} value={b} current={s.blocksPerSide} disabled={locked} onSelect={(blocksPerSide) => set({ blocksPerSide })}>
                {["Small", "Medium", "Large", "Huge"][b - 4]} map
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[90, 120, 180, 240].map((d) => (
              <Pill key={d} value={d} current={s.duration} disabled={locked} onSelect={(duration) => set({ duration })}>
                {d / 60} min
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => (
              <Pill key={d} value={d} current={s.difficulty} disabled={locked} onSelect={(difficulty) => set({ difficulty })}>
                {DIFFICULTY_INFO[d].name} bots
              </Pill>
            ))}
          </div>
          <label className="flex items-center gap-3 font-bold">
            <span className="whitespace-nowrap">Bots: {s.bots}</span>
            <input
              type="range"
              min={0}
              max={10}
              value={s.bots}
              disabled={locked}
              onChange={(e) => set({ bots: Number(e.target.value) })}
              className="w-full accent-[#ff5c95]"
              aria-label="Bots"
            />
          </label>
        </section>
      </div>

      <div className="mt-auto flex flex-col items-center gap-2 pb-2">
        {lobby.isPublic && (
          <p className="font-bold text-white/75">
            {autoStart !== null ? `Starting in ${autoStart}s…` : "Waiting for another player to join…"}
          </p>
        )}
        <div className="flex w-full max-w-xl gap-3">
          <Button variant="ghost" className="flex-1" onClick={leave}>
            Leave
          </Button>
          {isHost ? (
            <Button size="lg" className="flex-[2]" onClick={startMatch}>
              ▶ Start match
            </Button>
          ) : (
            <Button variant={me?.ready ? "green" : "secondary"} size="lg" className="flex-[2]" onClick={() => setReady(!me?.ready)}>
              {me?.ready ? "✓ Ready" : "I'm ready"}
            </Button>
          )}
        </div>
        {!isHost && <p className="text-sm font-bold text-white/55">The host starts the match.</p>}
      </div>
    </div>
  );
}
