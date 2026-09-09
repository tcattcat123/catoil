// -*- coding: utf-8 -*-
// PIXEL WORLD SERVER (Node) 🐱
// Static files + WebSocket multiplayer relay. Replaces server.py.
//
// Run locally:  npm install; npm start          (or: PORT=8080 node server.mjs)
// Open:         http://localhost:8080/chuv.html
//               http://localhost:8080/chuv.html?ws=ws://localhost:8080/ws
//
// Deploy: static game -> Vercel, this server -> Fly.io / Render / any VPS.
// Then open:    https://your-game.vercel.app/chuv.html?ws=wss://your-server.fly.dev/ws
// (or set window.GAME_WS_URL before the game script).
//
// Protocol (JSON text frames, same as the game client):
//   client -> server: any packet { action, senderId, ... }  (relayed to others)
//   server -> all:    { action: "online", online: N }        (on join/leave)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, ".."); // serve the game folder (chuv.html, zem.jpg, ...)
const PORT = parseInt(process.env.PORT || "8080", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/") {
    res.writeHead(302, { Location: "/chuv.html" });
    res.end();
    return;
  }
  if (url.pathname === "/online") {
    const body = JSON.stringify({ online: clients.size });
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body);
    return;
  }
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, online: clients.size }));
    return;
  }
  // No dotfiles / no traversal: confine to ROOT.
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const abs = path.normalize(path.join(ROOT, rel));
  if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.stat(abs, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(abs).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(abs).pipe(res);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ path: "/ws", server });
const clients = new Set();

function broadcastOnline() {
  const msg = JSON.stringify({ action: "online", online: clients.size });
  for (const c of [...clients]) {
    if (c.readyState === 1) {
      try {
        c.send(msg);
      } catch {
        clients.delete(c);
      }
    } else {
      clients.delete(c);
    }
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[WS] +connected (${clients.size} online)`);
  try {
    ws.send(JSON.stringify({ action: "online", online: clients.size }));
  } catch {
    /* ignore */
  }

  ws.on("message", (data) => {
    const text = data.toString();
    for (const c of [...clients]) {
      if (c === ws || c.readyState !== 1) continue;
      try {
        c.send(text);
      } catch {
        clients.delete(c);
      }
    }
    broadcastOnline();
  });

  const drop = () => {
    if (clients.delete(ws)) {
      console.log(`[WS] -disconnected (${clients.size} online)`);
      broadcastOnline();
    }
  };
  ws.on("close", drop);
  ws.on("error", drop);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🐱 Pixel World server -> http://localhost:${PORT}/chuv.html`);
});
