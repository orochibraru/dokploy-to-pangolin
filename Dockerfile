FROM oven/bun:1.3.10-alpine AS base

ENV NODE_ENV=production

WORKDIR /app

FROM base AS build

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --ignore-scripts

COPY . .

RUN bun run build

FROM base AS production

USER bun

COPY --from=build --chown=bun /app/build/index.js /app/index.js

EXPOSE 3000/tcp

CMD ["bun", "run", "/app/index.js"]
