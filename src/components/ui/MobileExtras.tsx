"use client";

import { useEffect, useState } from "react";
import { canFullscreen, isInstalledApp, toggleFullscreen } from "./fullscreen";

/** Full-screen toggle, shown only where the browser supports it. */
export function FullscreenButton() {
  const [supported] = useState(canFullscreen);
  const [active, setActive] = useState(() => document.fullscreenElement !== null);
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  if (!supported) return null;
  return (
    <button
      onClick={toggleFullscreen}
      // Phones switch to full screen on their own when a match starts; narrow screens
      // need the header space more than the button.
      className="panel hidden h-11 w-11 cursor-pointer place-items-center rounded-2xl text-xl transition hover:brightness-110 sm:grid"
      aria-label={active ? "Exit full screen" : "Full screen"}
      title={active ? "Exit full screen" : "Full screen"}
    >
      {active ? "⤡" : "⤢"}
    </button>
  );
}

const TIP_KEY = "hole-rush-install-tip-dismissed";

const readDismissed = () => {
  try {
    return localStorage.getItem(TIP_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * iPhone Safari can't go full screen from a web page, but a home-screen shortcut can:
 * whether to show a one-time, dismissible hint on how to add one.
 */
export function useInstallTip() {
  const [visible, setVisible] = useState(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios && !isInstalledApp() && !readDismissed();
  });
  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(TIP_KEY, "1");
    } catch {
      // Private mode: the tip just comes back next time.
    }
  };
  return { visible, dismiss };
}

export function InstallTip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-black/45 px-4 py-2 text-sm font-bold ring-1 ring-white/15 animate-rise">
      <span className="text-xl">📲</span>
      <span className="flex-1">
        Play full screen: tap <b>Share</b>, then <b>Add to Home Screen</b>.
      </span>
      <button onClick={onDismiss} className="cursor-pointer px-1 text-lg text-white/70" aria-label="Dismiss tip">
        ✕
      </button>
    </div>
  );
}
