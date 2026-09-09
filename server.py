# -*- coding: utf-8 -*-
"""
MICRO-SERVER: Pixel Resume World 🐱
HTTP static files + WebSocket multiplayer relay (aiohttp).

Run:   python server.py
Open:  http://localhost:8080/chuv.html
       http://localhost:8080/chuv.html?admin=1   (admin cat)

All client packets are relayed to every other connected client.
Also answers GET /online with {"online": N}.
"""

import json
import os
import asyncio
from aiohttp import web, WSMsgType

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", 8080))

clients = set()  # {ws}


def json_response(data, status=200):
    return web.Response(
        text=json.dumps(data, ensure_ascii=False),
        content_type="application/json",
        status=status,
    )


async def ws_handler(request):
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)
    clients.add(ws)
    print(f"[WS] +connected ({len(clients)} online)")

    # Tell the newcomer how many are online
    try:
        await ws.send_str(json.dumps({"action": "online", "online": len(clients)}))
    except Exception:
        pass

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                # Relay packet to everyone except sender
                dead = []
                data = msg.data
                for c in clients:
                    if c is ws:
                        continue
                    try:
                        await c.send_str(data)
                    except Exception:
                        dead.append(c)
                for c in dead:
                    clients.discard(c)
                # Broadcast updated online count
                online_msg = json.dumps({"action": "online", "online": len(clients)})
                dead = []
                for c in clients:
                    try:
                        await c.send_str(online_msg)
                    except Exception:
                        dead.append(c)
                for c in dead:
                    clients.discard(c)
            elif msg.type in (WSMsgType.ERROR, WSMsgType.CLOSE):
                break
    finally:
        clients.discard(ws)
        print(f"[WS] -disconnected ({len(clients)} online)")
        online_msg = json.dumps({"action": "online", "online": len(clients)})
        for c in list(clients):
            try:
                await c.send_str(online_msg)
            except Exception:
                clients.discard(c)
    return ws


async def online_handler(request):
    return json_response({"online": len(clients)})


async def index_handler(request):
    raise web.HTTPFound("/chuv.html")


def make_app():
    app = web.Application()
    app.router.add_get("/ws", ws_handler)
    app.router.add_get("/online", online_handler)
    app.add_routes([web.get("/", index_handler)])
    app.router.add_static("/", ROOT)
    return app


if __name__ == "__main__":
    print(f"🐱 Pixel World server -> http://localhost:{PORT}/chuv.html")
    web.run_app(make_app(), host="0.0.0.0", port=PORT)
