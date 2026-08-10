# Build du client (React/Vite) en fichiers statiques.
FROM node:20-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Serveur : API + fichiers statiques du client, un seul container/port.
FROM node:20-slim
WORKDIR /app/server
# python3/make/g++ : nécessaires si better-sqlite3 doit recompiler faute de binaire préconstruit.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client-build /app/client/dist ../client-dist

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "src/index.js"]
