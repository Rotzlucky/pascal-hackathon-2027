// Game server for the Raspberry Pi (also runs on any laptop for testing).
//   - serves the web pages in client/ and the shared game code in shared/
//   - talks to phones and the virtual facade over WebSocket (/ws)
//   - drives the lamps through an adapter (see server/lamps/)
//
// Configuration via environment variables, see README.md.

import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import { WebSocketServer } from "ws";
import { Session } from "../shared/session.js";
import { CanvasSession } from "../shared/canvas.js";
import { starterPicture } from "../shared/canvas-start.js";
import { createLamps } from "./lamps/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 8080);

// The address phones should open. On the Pi with a tunnel, set PUBLIC_URL.
// Otherwise use this computer's address in the local network.
function joinUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  const lan = Object.values(networkInterfaces()).flat().find((a) => a?.family === "IPv4" && !a.internal);
  return `http://${lan?.address ?? "localhost"}:${PORT}/`;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

// "/" -> client/player.html, "/facade" -> client/facade.html, "/shared/x.js" -> shared/x.js
function resolvePath(urlPath) {
  const path = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  if (path.startsWith("/shared/")) return join(ROOT, path);
  if (path === "/") return join(ROOT, "client", "player.html");
  const file = extname(path) ? path : `${path}.html`;
  return join(ROOT, "client", file);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, mode: session.mode, clients: session.clients.size }));
    return;
  }
  if (url.pathname === "/info") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ joinUrl: joinUrl(), canvasUrl: new URL("canvas", joinUrl()).href }));
    return;
  }
  const file = resolvePath(url.pathname);
  if (!file.startsWith(join(ROOT, "client")) && !file.startsWith(join(ROOT, "shared"))) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Nicht gefunden");
  }
});

const lamps = createLamps(process.env);
const session = new Session({
  lamps,
  idleMs: Number(process.env.IDLE_SECONDS ?? 90) * 1000,
  paintCooldownMs: Number(process.env.PAINT_COOLDOWN_SECONDS ?? 60) * 1000,
});

// Pixel canvas for the shop window. The picture is saved to a file so a restart keeps it.
const CANVAS_FILE = process.env.CANVAS_FILE ?? join(ROOT, "data", "canvas.json");
function loadCanvas() {
  try {
    return JSON.parse(readFileSync(CANVAS_FILE, "utf8")).pixels;
  } catch {
    return starterPicture();
  }
}
let saveTimer = null;
const canvas = new CanvasSession({
  pixels: loadCanvas(),
  cooldownMs: Number(process.env.CANVAS_COOLDOWN_SECONDS ?? 30) * 1000,
  onChange(pixels) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await mkdir(dirname(CANVAS_FILE), { recursive: true });
      await writeFile(CANVAS_FILE, JSON.stringify({ savedAt: new Date().toISOString(), pixels }));
    }, 2000);
  },
});

// Each page connects to one "room": the Rathaus game or the canvas.
const ROOMS = { rathaus: session, canvas };
const ROLES = ["player", "facade", "display"];

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 1024 });
wss.on("connection", (ws, req) => {
  const id = randomUUID();
  const params = new URL(req.url, "http://localhost").searchParams;
  const room = ROOMS[params.get("room")] ?? session;
  const role = ROLES.includes(params.get("role")) ? params.get("role") : "player";
  const send = (msg) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(msg));
  room.addClient(id, send, role);

  // Simple flood protection: at most 10 messages per second per connection.
  let budget = 10;
  const refill = setInterval(() => (budget = 10), 1000);

  ws.on("message", (data) => {
    if (budget-- <= 0) return;
    try {
      room.handle(id, JSON.parse(data));
    } catch {
      // ignore malformed messages
    }
  });
  ws.on("close", () => {
    clearInterval(refill);
    room.removeClient(id);
  });
});

setInterval(() => session.tick(), 250);

server.listen(PORT, () => {
  console.log(`Rathaus Lichtspiel läuft auf http://localhost:${PORT}`);
  console.log(`  Spielseite:        ${joinUrl()}`);
  console.log(`  Virtuelle Fassade: http://localhost:${PORT}/facade`);
  console.log(`  Pixel-Leinwand:    ${new URL("canvas", joinUrl()).href}  (Schaufenster: /panel)`);
  console.log(`  Lampen:            ${lamps.description}`);
});
