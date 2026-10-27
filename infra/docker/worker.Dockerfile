# The worker (apps/worker) for Railway, built from the repo root:
#   docker build -f infra/docker/worker.Dockerfile -t khmio-worker .
# Includes pg_dump/pg_restore 17 for the nightly backup: a client must be at
# least the server's version, and 17 also reads 16 servers.

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl gnupg \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-17 \
  && apt-get purge -y curl gnupg && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*
# pnpm kept where the unprivileged runtime user can use it too (migrations run as that user).
ENV COREPACK_HOME=/usr/local/share/corepack COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate && chmod -R a+rX /usr/local/share/corepack
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @khmio/worker build

FROM base
ENV NODE_ENV=production
COPY --from=build /app /app
USER node
CMD ["node", "--enable-source-maps", "apps/worker/dist/index.js"]
