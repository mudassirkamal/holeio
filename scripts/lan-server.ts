/**
 * Offline / local-network play: `npm run lan`
 *
 * Serves the built game (`next build`) together with a PeerJS signaling server from
 * this computer, so devices on the same Wi-Fi can play together without internet. It
 * runs over HTTPS with a self-signed certificate because browsers only allow microphone
 * access (voice chat) on secure pages — accept the certificate warning once per device.
 *
 *   npm run lan              HTTPS on :8443 (voice chat works)
 *   npm run lan -- --http    plain HTTP on :8080 (no voice chat, no warning)
 */
import express from "express";
import next from "next";
import { existsSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { ExpressPeerServer } from "peer";
import { generate } from "selfsigned";

const useHttp = process.argv.includes("--http");
const port = Number(process.env.PORT ?? (useHttp ? 8080 : 8443));
const projectDir = resolve(__dirname, "..");

if (!existsSync(resolve(projectDir, ".next/BUILD_ID"))) {
  console.error("No build found. Run `npm run build` first (or use `npm run lan`, which builds for you).");
  process.exit(1);
}

const lanAddresses = () =>
  Object.values(networkInterfaces())
    .flat()
    .filter((a): a is NonNullable<typeof a> => !!a && a.family === "IPv4" && !a.internal)
    .map((a) => a.address);

async function main() {
  const game = next({ dev: false, dir: projectDir });
  await game.prepare();
  const handle = game.getRequestHandler();

  const app = express();
  // Tells the game to use this machine's signaling server instead of the public one.
  app.get("/net-config.json", (_req, res) => res.json({ signal: "local", path: "/peerjs" }));

  let server: http.Server | https.Server;
  if (useHttp) {
    server = http.createServer(app);
  } else {
    const pems = await generate([{ name: "commonName", value: "hole-rush.local" }], {
      keySize: 2048,
      extensions: [
        {
          name: "subjectAltName",
          altNames: [{ type: 2, value: "localhost" }, { type: 7, ip: "127.0.0.1" }, ...lanAddresses().map((ip) => ({ type: 7 as const, ip }))],
        },
      ],
    });
    server = https.createServer({ key: pems.private, cert: pems.cert }, app);
  }

  const peerServer = ExpressPeerServer(server, { path: "/", allow_discovery: false });
  peerServer.on("connection", (client) => console.log(`  ↳ player connected (${client.getId().slice(0, 8)}…)`));
  app.use("/peerjs", peerServer);
  app.use((req, res) => handle(req, res));

  server.listen(port, () => {
    const scheme = useHttp ? "http" : "https";
    console.log(`\n  Hole Rush LAN server is running.\n`);
    console.log(`  On this computer:   ${scheme}://localhost:${port}`);
    for (const ip of lanAddresses()) console.log(`  On your network:    ${scheme}://${ip}:${port}`);
    console.log(`\n  Open one of these on every device, then create/join a room under Multiplayer.`);
    if (!useHttp) console.log(`  Your browser will warn about the certificate — choose "Advanced" → "Proceed".`);
    console.log("");
  });
}

void main();
