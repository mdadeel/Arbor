# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-only placeholders satisfy Zod import-time env checks during `next build`
# without baking fake values into the runtime container environment.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/arbor" \
    REDIS_URL="redis://localhost:6379" \
    NEXTAUTH_SECRET="build-time-only-nextauth-placeholder" \
    ENCRYPTION_SECRET="build-time-only-encryption-placeholder" \
    npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git openssh-client openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 arbor \
  && useradd --system --uid 1001 --gid arbor --create-home arbor \
  && mkdir -p /tmp/arbor-clones \
  && chown -R arbor:arbor /tmp/arbor-clones

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    CLONE_BASE_DIR=/tmp/arbor-clones

COPY --from=builder --chown=arbor:arbor /app/package.json /app/package-lock.json /app/next.config.mjs /app/tsconfig.json ./
COPY --from=builder --chown=arbor:arbor /app/node_modules ./node_modules
COPY --from=builder --chown=arbor:arbor /app/.next ./.next
COPY --from=builder --chown=arbor:arbor /app/public ./public
COPY --from=builder --chown=arbor:arbor /app/prisma ./prisma
COPY --from=builder --chown=arbor:arbor /app/src ./src
COPY --from=builder --chown=arbor:arbor /app/scripts ./scripts

USER arbor
EXPOSE 3000

# Default entrypoint starts the Next.js server; override with `["npm", "run", "worker"]`
# in docker-compose, Fly.io, or Railway to run the long-lived BullMQ worker.
CMD ["npm", "run", "start"]
