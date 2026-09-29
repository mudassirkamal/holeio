import type { PeerJSOption } from "peerjs";

export const NET = {
  /** Namespace for peer ids on the shared signaling server. */
  prefix: "holerush-v1-",
  maxPlayers: 8,
  maxHoles: 12,
  snapshotInterval: 1 / 20,
  inputInterval: 1 / 30,
  moverSyncInterval: 2,
  /** Remote holes render this far in the past for smooth interpolation (s). */
  interpolationDelay: 0.1,
  publicSlots: 6,
  /** Long enough for ICE to fall back to the TURN relay on strict networks. */
  joinTimeoutMs: 10000,
  publicAutoStartMs: 20000,
} as const;

export const roomPeerId = (code: string) => `${NET.prefix}room-${code.toUpperCase()}`;
export const publicPeerId = (slot: number) => `${NET.prefix}pub-${slot}`;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomRoomCode() {
  let code = "";
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

export const normalizeRoomCode = (input: string) =>
  input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);

const STUN_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/** TURN relay servers with short-lived credentials from `/api/ice` (none if unset). */
async function relayServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch("/api/ice", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const { iceServers } = (await res.json()) as { iceServers?: RTCIceServer[] };
    return Array.isArray(iceServers) ? iceServers : [];
  } catch {
    return [];
  }
}

function parseSignalUrl(value: string): PeerJSOption {
  const url = new URL(value, window.location.href);
  const secure = url.protocol === "https:" || url.protocol === "wss:";
  return {
    host: url.hostname,
    port: Number(url.port) || (secure ? 443 : 80),
    path: url.pathname.replace(/\/$/, "") || "/",
    secure,
  };
}

export type SignalMode = "cloud" | "local";

export interface Signaling {
  mode: SignalMode;
  /** Whether a TURN relay is available for players on strict networks. */
  relay: boolean;
  options: PeerJSOption;
}

async function signalServer(): Promise<{ mode: SignalMode; options: PeerJSOption }> {
  const override = new URLSearchParams(window.location.search).get("signal");
  if (override) return { mode: "local", options: parseSignalUrl(override) };
  try {
    const res = await fetch("/net-config.json", { cache: "no-store" });
    const json = (await res.json()) as { signal?: SignalMode; path?: string };
    if (json.signal === "local") return { mode: "local", options: parseSignalUrl(`${window.location.origin}${json.path ?? "/peerjs"}`) };
  } catch {
    // Fall through to the public server.
  }
  return { mode: "cloud", options: {} };
}

/** Relay credentials last 24 h; refresh them well before that in long-open tabs. */
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
let cached: { at: number; value: Promise<Signaling> } | null = null;

/**
 * Where peers find each other and how they connect. Online play uses the free public
 * PeerJS server; when the game is served by `npm run lan` it uses that machine's own
 * signaling server, so it works on a local network without internet. `?signal=<url>`
 * overrides it (dev). ICE servers are STUN plus the TURN relay, when one is configured.
 */
export function signaling(): Promise<Signaling> {
  if (!cached || Date.now() - cached.at > REFRESH_AFTER_MS) {
    const value = Promise.all([signalServer(), relayServers()]).then(([{ mode, options }, relay]) => ({
      mode,
      relay: relay.length > 0,
      options: { ...options, config: { iceServers: [...STUN_SERVERS, ...relay] } },
    }));
    cached = { at: Date.now(), value };
  }
  return cached.value;
}
