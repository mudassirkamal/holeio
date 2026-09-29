"use client";

import { useState } from "react";
import type { Clip } from "@/store/app";
import { Button } from "../ui/Button";

const fileName = (clip: Clip) => `hole-rush-${clip.id}.${clip.extension.replace(/^\./, "")}`;

function downloadClip(clip: Clip) {
  const link = document.createElement("a");
  link.href = clip.url;
  link.download = fileName(clip);
  link.click();
}

/** Opens the system share sheet (WhatsApp, Instagram, …) or, where files can't be shared, downloads. */
async function shareClip(clip: Clip): Promise<"shared" | "saved" | "cancelled"> {
  const file = new File([clip.blob], fileName(clip), { type: clip.mimeType });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Hole Rush", text: `${clip.caption} Play Hole Rush: ${window.location.origin}` });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  downloadClip(clip);
  return "saved";
}

/** The match's highlight videos with share and save buttons. */
export default function ClipCard({ clips }: { clips: Clip[] }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const clip = clips.find((c) => c.id === selectedId) ?? clips[0];

  const share = async () => {
    const outcome = await shareClip(clip);
    setStatus(outcome === "saved" ? "Saved to your downloads" : outcome === "shared" ? "Shared!" : null);
  };

  return (
    <div className="mt-4 rounded-2xl bg-black/30 p-2 text-left short:mt-0">
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-xs font-black uppercase tracking-widest text-white/60">🎬 {clip.auto ? "Your best moment" : "Your clip"}</span>
        <span className="text-xs font-bold text-white/50">{Math.round(clip.durationS)}s</span>
      </div>
      <video key={clip.id} src={clip.url} autoPlay muted loop playsInline controls className="max-h-56 w-full rounded-xl bg-black object-contain short:max-h-32" />
      <div className="mt-1.5 truncate px-1 font-display text-lg">{clip.caption}</div>
      {clips.length > 1 && (
        <div className="mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
          {clips.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-extrabold transition ${c.id === clip.id ? "bg-white text-ink" : "bg-white/10 hover:bg-white/20"}`}
            >
              {c.auto ? "★ Best" : `Clip ${i}`}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => void share()}>
          📤 Share
        </Button>
        <Button variant="ghost" size="sm" className="flex-1" onClick={() => downloadClip(clip)}>
          ⬇️ Save
        </Button>
      </div>
      {status && <p className="mt-1.5 text-center text-xs font-bold text-white/60">{status}</p>}
    </div>
  );
}
