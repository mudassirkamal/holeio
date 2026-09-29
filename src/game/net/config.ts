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
  joinTimeoutMs: 7000,
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

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
    { urls: "stun:stun.cloudflare.com:3478" },
  ];
  // Optional TURN relay for players behind strict NATs (set at build time).
  const turn = process.env.NEXT_PUBLIC_TURN_URLS;
  if (turn) {
    servers.push({
      urls: turn.split(",").map((u) => u.trim()),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
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

let resolved: Promise<{ mode: SignalMode; options: PeerJSOption }> | null = null;

/**
 * Where peers find each other. Online play uses the free public PeerJS server; when
 * the game is served by `npm run lan` it uses that machine's own signaling server, so
 * it works on a local network without internet. `?signal=<url>` overrides it (dev).
 */
export function signaling() {
  resolved ??= (async () => {
    const config: RTCConfiguration = { iceServers: iceServers() };
    const override = new URLSearchParams(window.location.search).get("signal");
    if (override) return { mode: "local" as const, options: { ...parseSignalUrl(override), config } };
    try {
      const res = await fetch("/net-config.json", { cache: "no-store" });
      const json = (await res.json()) as { signal?: SignalMode; path?: string };
      if (json.signal === "local") {
        const origin = `${window.location.origin}${json.path ?? "/peerjs"}`;
        return { mode: "local" as const, options: { ...parseSignalUrl(origin), config } };
      }
    } catch {
      // Fall through to the public server.
    }
    return { mode: "cloud" as const, options: { config } };
  })();
  return resolved;
}
