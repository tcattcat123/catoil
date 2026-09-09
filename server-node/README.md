# Pixel World — Node game server 🐱

Замена `server.py`: раздача статики + WebSocket-релей для онлайна.
Фронт — на **Vercel** (статика), этот сервер — **Fly.io / Render / VPS** (долгоживущие WS).

## Локально

```bash
cd server-node
npm install
npm start
# -> http://localhost:8080/chuv.html
```

## Как клиент находит сервер

`chuv.html` сам выбирает WS-адрес (по приоритету):

1. `?ws=wss://xxx/ws` в URL — для продакшена:
   `https://your-game.vercel.app/chuv.html?ws=wss://your-server.fly.dev/ws`
2. `window.GAME_WS_URL` (можно задать перед игровым скриптом)
3. тот же хост `/ws` (локальная разработка: сервер и игра с одного порта)
4. `file://` — WS выключен, работают только вкладки рядом (BroadcastChannel)

## Деплой сервера (варианты)

**Fly.io:**
```bash
# из корня папки игры (там лежат chuv.html, zem.jpg, ...):
fly launch --no-deploy
fly deploy --dockerfile server-node/Dockerfile
fly open  # даст https-домен; WS станет wss://<app>.fly.dev/ws
```

**Render:** New → Web Service → Docker, root directory — корень игры,
Dockerfile path — `server-node/Dockerfile`, порт `8080`.

**VPS:** `node server-node/server.mjs` под systemd/pm2, сверху nginx/caddy для `wss`.

## Протокол (JSON, совместим с клиентом)

- клиент → сервер: любой пакет `{ action, senderId, ... }` — рассылается остальным
- сервер → всем: `{ action: "online", online: N }` при входе/выходе/сообщении
- `GET /online` → `{"online": N}`, `GET /health` → `{"ok": true, ...}`
