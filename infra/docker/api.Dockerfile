# The API (apps/api) for Railway, built from the repo root:
#   docker build -f infra/docker/api.Dockerfile -t khmio-api .
# Migrations run before each release (apps/api/railway.json: pnpm db:deploy),
# so the image keeps the Prisma CLI. Settings come from the host's variables.

FROM node:22-bookworm-slim AS base
# Prisma's query engine needs OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# pnpm kept where the unprivileged runtime user can use it too (migrations run as that user).
ENV COREPACK_HOME=/usr/local/share/corepack COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate && chmod -R a+rX /usr/local/share/corepack
WORKDIR /app

FROM base AS build
COPY . .
# Installing runs prisma generate (packages/db postinstall) for this Linux image.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @khmio/api build

FROM base
ENV NODE_ENV=production
COPY --from=build /app /app
USER node
EXPOSE 4000
CMD ["node", "--enable-source-maps", "apps/api/dist/main.js"]
