FROM node:22-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm --filter @techfusion/worker build

FROM node:22-alpine AS runner
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
