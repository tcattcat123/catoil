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
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function json(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function readBody(req, cb) {
  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 65536) req.destroy();
  });
  req.on("end", () => {
    try {
      cb(JSON.parse(raw || "{}"));
    } catch {
      cb({});
    }
  });
}

// Task board: id -> {id,text,reward,maxClaims,claimsLeft,cid,cname,doneBy[],ts}
const TASKS_FILE = path.join(ROOT, "server-node", "tasks.json");
const tasks = new Map();
try {
  const raw = fs.readFileSync(TASKS_FILE, "utf8");
  for (const t of JSON.parse(raw)) {
    if (t && t.id) tasks.set(t.id, t);
  }
  console.log(`[TASKS] loaded ${tasks.size} tasks`);
} catch {
  /* first run */
}
function saveTasks() {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify([...tasks.values()]));
  } catch (err) {
    console.log("[TASKS] save failed:", err.message);
  }
}

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
    res.end(JSON.stringify({ ok: true, online: clients.size, known: registry.size, tasks: tasks.size }));
    return;
  }
  if (url.pathname === "/tasks" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify([...tasks.values()]));
    return;
  }
  if (url.pathname === "/tasks" && req.method === "POST") {
    readBody(req, (body) => {
      const text = String(body.text || "").slice(0, 80).trim();
      const reward = Math.min(Math.max(parseInt(body.reward, 10) || 0, 1), 999);
      const maxClaims = Math.min(Math.max(parseInt(body.maxClaims, 10) || 0, 1), 20);
      const cid = String(body.cid || "").slice(0, 40);
      const cname = String(body.cname || "").slice(0, 12);
      if (!text || !cid) return json(res, 400, { error: "bad task" });
      const task = {
        id: Date.now() + "-" + Math.floor(Math.random() * 1e6),
        text, reward, maxClaims, claimsLeft: maxClaims,
        cid, cname, doneBy: [], ts: Date.now(),
      };
      tasks.set(task.id, task);
      saveTasks();
      json(res, 200, { ok: true, task });
    });
    return;
  }
  const claimM = url.pathname.match(/^\/tasks\/([^/]+)\/(claim|delete)$/);
  if (claimM && req.method === "POST") {
    readBody(req, (body) => {
      const task = tasks.get(claimM[1]);
      if (!task) return json(res, 404, { error: "gone" });
      const cid = String(body.cid || "").slice(0, 40);
      if (claimM[2] === "delete") {
        if (task.cid !== cid) return json(res, 403, { error: "not yours" });
        tasks.delete(task.id);
        saveTasks();
        return json(res, 200, { ok: true, refund: task.claimsLeft * task.reward });
      }
      // claim
      if (task.claimsLeft <= 0 || task.doneBy.includes(cid)) {
        return json(res, 200, { ok: false, error: "done" });
      }
      task.claimsLeft -= 1;
      task.doneBy.push(cid);
      saveTasks();
      return json(res, 200, { ok: true, reward: task.reward });
    });
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

// Player registry: cid -> { firstSeen, lastSeen, name }.
// Lets everyone know for sure whether an arrival is a BRAND-NEW player.
// Persisted to registry.json so restarts don't reset it.
const REGISTRY_FILE = path.join(ROOT, "server-node", "registry.json");
const registry = new Map();
try {
  const raw = fs.readFileSync(REGISTRY_FILE, "utf8");
  for (const [cid, rec] of Object.entries(JSON.parse(raw))) {
    if (cid && rec) registry.set(cid, rec);
  }
  console.log(`[REG] loaded ${registry.size} known players`);
} catch {
  /* first run */
}
let saveTimer = null;
function saveRegistry() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(Object.fromEntries(registry)));
    } catch (err) {
      console.log("[REG] save failed:", err.message);
    }
  }, 500);
}

function send(ws, obj) {
  if (ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(obj));
      return true;
    } catch {
      clients.delete(ws);
    }
  }
  return false;
}

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
    let msg = null;
    try {
      msg = JSON.parse(text);
    } catch {
      /* non-JSON: relay as-is */
    }

    // Newcomer registration: first hello with an unknown cid = brand-new player.
    if (msg && msg.action === "hello" && msg.cid) {
      const now = Date.now();
      const known = registry.get(msg.cid);
      if (!known) {
        registry.set(msg.cid, {
          firstSeen: now,
          lastSeen: now,
          name: String(msg.cname || "").slice(0, 12),
        });
        saveRegistry();
        console.log(`[REG] NEW player ${msg.cid} (${msg.cname || "nameless"})`);
        send(ws, { action: "welcome", isNew: true });
        const announce = JSON.stringify({
          action: "player_new",
          senderId: msg.senderId,
          cid: msg.cid,
          cname: String(msg.cname || "").slice(0, 12),
        });
        for (const c of [...clients]) {
          if (c === ws || c.readyState !== 1) continue;
          try {
            c.send(announce);
          } catch {
            clients.delete(c);
          }
        }
      } else {
        known.lastSeen = now;
        if (msg.cname) known.name = String(msg.cname).slice(0, 12);
        saveRegistry();
        send(ws, { action: "welcome", isNew: false });
      }
      broadcastOnline();
      return; // hello is consumed, not relayed
    }

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
