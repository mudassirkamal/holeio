"use client";

import { create } from "zustand";
import { signaling, type SignalMode } from "@/game/net/config";
import type { LobbyState, RoomSettings } from "@/game/net/protocol";
import { NetError, Room } from "@/game/net/Room";
import { VoiceChat, type VoiceMode, type VoiceState } from "@/game/net/VoiceChat";
import { useApp } from "./app";
import { useProfile } from "./profile";

interface NetState {
  room: Room | null;
  voice: VoiceChat | null;
  lobby: LobbyState | null;
  voiceState: VoiceState | null;
  signalMode: SignalMode | null;
  /** A TURN relay is configured, so players on strict networks can connect too. */
  relay: boolean;
  status: string | null;
  error: string | null;
  busy: boolean;
  detectSignaling: () => void;
  quickMatch: () => Promise<void>;
  createRoom: () => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  leave: () => void;
  updateSettings: (patch: Partial<RoomSettings>) => void;
  startMatch: () => void;
  setReady: (ready: boolean) => void;
  setTeam: (team: number) => void;
  shuffleTeams: () => void;
  setMic: (on: boolean) => void;
  setVoiceMode: (mode: VoiceMode) => void;
  toggleMute: (peerId: string) => void;
  clearError: () => void;
}

const profile = () => {
  const p = useProfile.getState();
  return { name: p.playerName, skinId: p.selectedSkin };
};

/** Lobby objects are mutated in place by the host, so copy them for React. */
const snapshotLobby = (lobby: LobbyState): LobbyState => ({ ...lobby, players: lobby.players.map((p) => ({ ...p })) });

export const useNet = create<NetState>()((set, get) => {
  const adopt = (room: Room) => {
    const voice = new VoiceChat(room.peer, (voiceState) => set({ voiceState: { ...voiceState } }));
    room.on("lobby", (lobby) => {
      set({ lobby: snapshotLobby(lobby) });
      voice.syncPeers(lobby.players.map((p) => p.peerId));
    });
    room.on("start", (start) => {
      useApp.getState().startMatch({
        mode: start.mode,
        themeId: start.themeId,
        duration: start.duration,
        blocksPerSide: start.blocksPerSide,
        seed: start.seed,
        bots: 0,
        difficulty: start.difficulty,
        levelId: null,
        net: { room, start },
      });
    });
    room.on("lobbyReturn", () => {
      voice.setProximity(null);
      useApp.getState().backToLobby();
    });
    room.on("closed", (reason) => {
      voice.destroy();
      const app = useApp.getState();
      if (app.screen === "lobby" || app.screen === "playing") {
        app.quitToMenu();
        app.go("multiplayer");
      }
      set({ room: null, voice: null, lobby: null, voiceState: null, busy: false, status: null, error: reason === "You left the room." ? null : reason });
    });
    set({ room, voice, lobby: snapshotLobby(room.lobby), busy: false, status: null, error: null });
    voice.syncPeers(room.lobby.players.map((p) => p.peerId));
    useApp.getState().go("lobby");
  };

  const attempt = async (status: string, open: () => Promise<Room>) => {
    if (get().busy || get().room) return;
    set({ busy: true, status, error: null });
    try {
      adopt(await open());
    } catch (err) {
      set({ busy: false, status: null, error: err instanceof NetError ? err.message : "Something went wrong. Please try again." });
    }
  };

  return {
    room: null,
    voice: null,
    lobby: null,
    voiceState: null,
    signalMode: null,
    relay: false,
    status: null,
    error: null,
    busy: false,
    detectSignaling: () => {
      void signaling().then(({ mode, relay }) => set({ signalMode: mode, relay }));
    },
    quickMatch: () => attempt("Looking for a public match…", () => Room.quickMatch(profile(), (status) => set({ status }))),
    createRoom: () => attempt("Creating your room…", () => Room.host(profile(), { isPublic: false })),
    joinRoom: (code) => attempt(`Joining room ${code}…`, () => Room.join(code, profile())),
    leave: () => get().room?.leave(),
    updateSettings: (patch) => get().room?.updateSettings(patch),
    startMatch: () => get().room?.start(),
    setReady: (ready) => get().room?.setReady(ready),
    setTeam: (team) => get().room?.setTeam(team),
    shuffleTeams: () => get().room?.shuffleTeams(),
    setMic: (on) => void get().voice?.setMicOn(on),
    setVoiceMode: (mode) => get().voice?.setMode(mode),
    toggleMute: (peerId) => {
      const { voice, voiceState } = get();
      voice?.setMuted(peerId, !voiceState?.muted.includes(peerId));
    },
    clearError: () => set({ error: null }),
  };
});
