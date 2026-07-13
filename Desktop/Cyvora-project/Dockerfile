# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages anthropic

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV JARVIS_WORKSPACE_ROOT=/app
ENV MISSIONS_DB_PATH=/app/data/missions.db
ENV TENANTS_ROOT=/app/data/tenants
ENV AGENCY_AGENTS_DIR=/app/personas

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/personas ./personas
COPY --from=builder /app/scripts ./scripts

RUN chmod +x ./scripts/entrypoint.sh ./scripts/worker-loop.sh \
  && mkdir -p /app/data/tenants /app/logs

VOLUME ["/app/data", "/app/logs"]

EXPOSE 3000

ENTRYPOINT ["./scripts/entrypoint.sh"]
