FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/server/package.json packages/server/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json

RUN bun install --production

COPY packages/server/src/ packages/server/src/

EXPOSE 4000

CMD ["sh", "-c", "bun run packages/server/src/db/seed.ts && bun run packages/server/src/index.ts"]
