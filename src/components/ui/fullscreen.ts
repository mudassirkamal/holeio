/** True when launched from the home screen (already full screen, no browser bars). */
export function isInstalledApp() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches;
}

/** The Fullscreen API works on Android and desktop browsers, but not in iPhone Safari. */
export function canFullscreen() {
  return typeof document !== "undefined" && document.fullscreenEnabled && !isInstalledApp();
}

/** Must run inside a tap/click handler; browsers refuse fullscreen otherwise. */
export function enterFullscreen() {
  if (!canFullscreen() || document.fullscreenElement) return;
  document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
}

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else enterFullscreen();
}
