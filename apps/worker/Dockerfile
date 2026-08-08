FROM node:22-alpine AS base
RUN npm install -g pnpm@9
RUN apk add --no-cache bash

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
COPY apps/worker/package.json ./apps/worker/
COPY scripts/sync-prisma-schema.sh ./scripts/sync-prisma-schema.sh
COPY apps/api-gateway/prisma ./apps/api-gateway/prisma
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY packages ./packages
COPY scripts/sync-prisma-schema.sh ./scripts/sync-prisma-schema.sh
COPY apps/api-gateway/prisma ./apps/api-gateway/prisma
COPY apps/worker ./apps/worker
RUN pnpm --filter @techfusion/worker build

FROM base AS runner
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
COPY apps/worker/package.json ./apps/worker/
COPY scripts/sync-prisma-schema.sh ./scripts/sync-prisma-schema.sh
COPY apps/api-gateway/prisma ./apps/api-gateway/prisma
RUN pnpm install --frozen-lockfile
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
