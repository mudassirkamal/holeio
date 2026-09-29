"use client";

import { useEffect, useRef, useState } from "react";
import type { WebGLRenderer } from "three";
import { audio } from "@/game/audio/AudioEngine";
import { haptics } from "@/game/input/haptics";
import { THEME_ORDER } from "@/game/config/themes";
import type { SkinId } from "@/game/config/skins";
import { GameSession, createRenderer } from "@/game/engine/GameSession";
import { teammatePeerIds } from "@/game/net/protocol";
import { computeReward } from "@/game/engine/rewards";
import { useApp } from "@/store/app";
import { useNet } from "@/store/net";
import { useProfile } from "@/store/profile";
import { sessionRef } from "./sessionRef";

/**
 * Hosts the WebGL canvas. Behind the menus it runs an attract-mode demo where the
 * trained bots play; during a match it runs the player's session and reports HUD
 * state and results back to the stores.
 */
export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const [demoIndex, setDemoIndex] = useState(0);

  const quality = useProfile((s) => s.settings.quality);
  const screen = useApp((s) => s.screen);
  const match = useApp((s) => s.match);
  const matchKey = useApp((s) => s.matchKey);
  const paused = useApp((s) => s.paused);
  const previewSkin = useApp((s) => s.previewSkin);
  const selectedSkin = useProfile((s) => s.selectedSkin);
  const playing = screen === "playing" && match !== null;

  // Renderer (declared first so it exists before the session effect runs).
  useEffect(() => {
    const renderer = createRenderer(canvasRef.current!, quality);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [quality]);

  // Session: a demo behind the menus, or the actual match.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !canvasRef.current || !overlayRef.current) return;
    const profile = useProfile.getState();
    const app = useApp.getState();
    const session = new GameSession(renderer, {
      canvas: canvasRef.current,
      overlay: overlayRef.current,
      quality,
      playerName: profile.playerName,
      playerSkin: profile.selectedSkin,
      match: playing ? app.match : null,
      demoTheme: THEME_ORDER[demoIndex % THEME_ORDER.length],
      onHud: (hud) => useApp.getState().setHud(hud),
      onFeed: (item) => useApp.getState().pushFeed(item),
      onEnd: (result) => {
        const current = useApp.getState().match;
        if (!current) return;
        const reward = computeReward(current, result);
        const store = useProfile.getState();
        const previous = current.levelId !== null ? (store.levelStars[current.levelId] ?? 0) : 0;
        if (current.levelId !== null) store.recordLevel(current.levelId, reward.stars);
        store.addCoins(reward.coins);
        store.recordGame(reward.won);
        window.setTimeout(() => {
          useApp.getState().finish(result, { ...reward, newBest: reward.stars > previous });
        }, 900);
      },
      onDemoEnd: () => setDemoIndex((i) => i + 1),
      onProximity: (distances) => useNet.getState().voice?.setProximity(distances),
      recordClips: profile.settings.clips,
      onClip: (clip) => useApp.getState().addClip(clip),
    });
    sessionRef.current = session;
    session.start();

    // Team matches switch voice chat to team-only; the lobby hears everyone again.
    const net = playing ? app.match?.net : undefined;
    const voice = useNet.getState().voice;
    if (net?.start.mode === "teams") voice?.setTeammates(teammatePeerIds(net.start, net.room.myPeerId));

    // Observing the canvas catches phone rotations after layout has settled, which a
    // window resize event on iOS does not always do.
    const observer = new ResizeObserver(() => session.resize());
    observer.observe(canvasRef.current);
    return () => {
      observer.disconnect();
      useNet.getState().voice?.setProximity(null);
      useNet.getState().voice?.setTeammates(null);
      session.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [playing, matchKey, demoIndex, quality]);

  // Pause handling (manual and when the tab is hidden).
  useEffect(() => {
    const session = sessionRef.current;
    if (!session || !playing) return;
    if (paused) session.pause();
    else session.resume();
  }, [paused, playing]);

  useEffect(() => {
    if (!playing) return;
    const onVisibility = () => {
      const { result, match } = useApp.getState();
      if (document.hidden && !result && !match?.net) useApp.getState().setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [playing]);

  // Keep the phone screen on during a match (it can dim while you watch after being eaten).
  useEffect(() => {
    if (!playing || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const acquire = () => {
      // The browser drops the lock whenever the page is hidden; take it again on return.
      if (document.hidden) return;
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (active) lock = sentinel;
          else void sentinel.release();
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, [playing]);

  // Skin shop: close-up of the featured demo hole wearing the previewed skin.
  useEffect(() => {
    const session = sessionRef.current;
    if (!session || playing) return;
    // Phones in landscape show the skin list beside the preview: keep the hole top right,
    // above the details panel.
    const sideBySide = window.matchMedia("(max-height: 540px) and (orientation: landscape)").matches;
    session.setCloseUp(screen === "skins", sideBySide ? 0.24 : 0, sideBySide ? -0.2 : 0);
    session.previewSkin((previewSkin as SkinId | null) ?? selectedSkin);
  }, [screen, previewSkin, selectedSkin, playing, demoIndex, quality]);

  // Audio and vibration settings.
  const sound = useProfile((s) => s.settings.sound);
  const music = useProfile((s) => s.settings.music);
  const vibration = useProfile((s) => s.settings.vibration);
  useEffect(() => {
    audio.setSfx(sound);
    audio.setMusic(music);
    haptics.setEnabled(vibration);
  }, [sound, music, vibration]);

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div ref={overlayRef} className="absolute inset-0 overflow-hidden" style={{ touchAction: "none" }} />
      {!playing && <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/40 via-transparent to-ink/70" />}
    </div>
  );
}
