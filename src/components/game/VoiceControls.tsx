"use client";

import { useEffect } from "react";
import { useNet } from "@/store/net";

/** Mic toggle, push-to-talk (hold V or the button) and voice mode switch. */
export default function VoiceControls({ compact = false }: { compact?: boolean }) {
  const voiceState = useNet((s) => s.voiceState);
  const voice = useNet((s) => s.voice);
  const setMic = useNet((s) => s.setMic);
  const setVoiceMode = useNet((s) => s.setVoiceMode);
  const micOn = voiceState?.micOn ?? false;
  const mode = voiceState?.mode ?? "open";
  const transmitting = voiceState?.transmitting ?? false;

  useEffect(() => {
    if (!voice) return;
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement;
    const down = (e: KeyboardEvent) => e.code === "KeyV" && !e.repeat && !typing(e) && voice.setPushHeld(true);
    const up = (e: KeyboardEvent) => e.code === "KeyV" && voice.setPushHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [voice]);

  if (!voice) return null;

  const talkButton = (
    <button
      onClick={() => mode === "open" && setMic(!micOn)}
      onPointerDown={() => {
        if (mode !== "push") return;
        if (!micOn) setMic(true);
        voice.setPushHeld(true);
      }}
      onPointerUp={() => mode === "push" && voice.setPushHeld(false)}
      onPointerLeave={() => mode === "push" && voice.setPushHeld(false)}
      className={`pointer-events-auto flex cursor-pointer items-center gap-2 rounded-2xl px-3 py-2 font-display ring-1 transition ${
        transmitting ? "bg-lime text-ink ring-lime shadow-[0_0_18px_rgba(124,240,90,0.6)]" : micOn ? "bg-white/20 ring-white/30" : "bg-black/45 ring-white/20"
      }`}
      aria-label="Microphone"
    >
      <span className="text-lg">{micOn ? "🎤" : "🔇"}</span>
      {!compact && <span>{mode === "push" ? (transmitting ? "Talking…" : "Hold to talk (V)") : micOn ? "Mic on" : "Mic off"}</span>}
    </button>
  );

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        {talkButton}
        {!compact && (
          <button
            onClick={() => setVoiceMode(mode === "open" ? "push" : "open")}
            className="pointer-events-auto cursor-pointer rounded-2xl bg-white/10 px-3 py-2 text-sm font-extrabold ring-1 ring-white/15 transition hover:bg-white/20"
          >
            {mode === "open" ? "Open mic" : "Push-to-talk"}
          </button>
        )}
      </div>
      {voiceState?.micError && <span className="text-xs font-bold text-[#ff8fa3]">{voiceState.micError}</span>}
    </div>
  );
}
