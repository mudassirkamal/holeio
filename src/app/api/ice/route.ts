/**
 * GET /api/ice — TURN relay servers for multiplayer.
 *
 * Most players connect directly (peer to peer), but strict NATs, mobile carriers and
 * corporate firewalls block that; a TURN relay forwards their traffic instead. WebRTC
 * encrypts everything end to end, so the relay only ever sees ciphertext.
 *
 * Provider secrets stay on the server and browsers get short-lived credentials.
 * Configure one provider through environment variables (see README):
 *   Cloudflare Realtime TURN   CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_API_TOKEN
 *   Metered                    METERED_TURN_DOMAIN, METERED_TURN_API_KEY
 *   Any TURN server            TURN_URLS (comma-separated), TURN_USERNAME, TURN_CREDENTIAL
 */

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** Credentials outlive any page session; the client refetches well before expiry. */
const CREDENTIAL_TTL_SECONDS = 24 * 60 * 60;
const PROVIDER_TIMEOUT_MS = 4000;

async function cloudflare(keyId: string, token: string): Promise<IceServer[]> {
  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Cloudflare TURN responded ${res.status}`);
  const { iceServers } = (await res.json()) as { iceServers: IceServer | IceServer[] };
  return [iceServers].flat();
}

async function metered(domain: string, apiKey: string): Promise<IceServer[]> {
  const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`, {
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Metered TURN responded ${res.status}`);
  return (await res.json()) as IceServer[];
}

function staticServer(urls: string, username?: string, credential?: string): IceServer[] {
  return [{ urls: urls.split(",").map((u) => u.trim()).filter(Boolean), username, credential }];
}

function fromEnvironment(): Promise<IceServer[]> | null {
  const env = process.env;
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN) return cloudflare(env.CLOUDFLARE_TURN_KEY_ID, env.CLOUDFLARE_TURN_API_TOKEN);
  if (env.METERED_TURN_DOMAIN && env.METERED_TURN_API_KEY) return metered(env.METERED_TURN_DOMAIN, env.METERED_TURN_API_KEY);
  if (env.TURN_URLS) return Promise.resolve(staticServer(env.TURN_URLS, env.TURN_USERNAME, env.TURN_CREDENTIAL));
  return null;
}

/**
 * Keeps only relay (turn:/turns:) URLs — the game already lists its STUN servers, and
 * fewer ICE servers means faster connections. Port 53 is dropped because browsers
 * refuse it.
 */
function relayOnly(servers: IceServer[]): IceServer[] {
  return servers.flatMap((server) => {
    const urls = [server.urls].flat().filter((url) => /^turns?:/.test(url) && !/:53(\?|$)/.test(url));
    return urls.length > 0 ? [{ urls, username: server.username, credential: server.credential }] : [];
  });
}

export async function GET() {
  let iceServers: IceServer[] = [];
  try {
    iceServers = relayOnly((await fromEnvironment()) ?? []);
  } catch (err) {
    // Players still connect directly without a relay; just record why it's missing.
    console.error("[api/ice]", err instanceof Error ? err.message : err);
  }
  return Response.json({ iceServers }, { headers: { "Cache-Control": "no-store" } });
}
