# syntax=docker/dockerfile:1

# Casebook runs as a single self-contained Node process with a SQLite file and a storage
# directory on one mounted volume. The image is built multi-arch (linux/amd64 and
# linux/arm64); better-sqlite3 ships a prebuilt binding for both, so no compilation happens
# on the target machine — a Raspberry Pi needs no build toolchain.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Generate the synthetic demo database and its uploads so a fresh volume can be seeded
# without shipping a TypeScript toolchain into the runtime image.
RUN npm run setup

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --create-home nextjs

# The standalone server is the runtime; there is no `node_modules` install in this stage.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Migrations (already traced into the standalone) and the pre-seeded synthetic dataset, copied
# into the volume on first boot.
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/data ./seed-data
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
VOLUME ["/app/data"]
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
