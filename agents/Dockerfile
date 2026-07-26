# Isolated HTTP agent sidecar (Compose scale)
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:agent

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV AGENT_PORT=4101
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/agentTurnServer.cjs ./dist/agentTurnServer.cjs
EXPOSE 4101
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4101/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/agentTurnServer.cjs"]
