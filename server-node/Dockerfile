FROM node:20-alpine
# Build context MUST be the game folder root:  docker build -f server-node/Dockerfile .
WORKDIR /app/game
COPY server-node/package.json server-node/package-lock.json* ./server-node/
RUN cd server-node && npm install --omit=dev
COPY server-node/server.mjs ./server-node/
COPY chuv.html index.html mac.html script.js styles.css text.json zem.jpg zem.png shop.png ./
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server-node/server.mjs"]
