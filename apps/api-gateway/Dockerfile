FROM node:22-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
COPY apps/api-gateway/package.json ./apps/api-gateway/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY packages ./packages
COPY apps/api-gateway ./apps/api-gateway
RUN cd apps/api-gateway && npx prisma generate && pnpm --filter @techfusion/api-gateway build

FROM node:22-alpine AS runner
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
COPY apps/api-gateway/package.json ./apps/api-gateway/
RUN pnpm install --frozen-lockfile
COPY --from=builder /app/apps/api-gateway/dist ./apps/api-gateway/dist
COPY apps/api-gateway/prisma ./apps/api-gateway/prisma
WORKDIR /app/apps/api-gateway
RUN npx prisma generate
CMD ["node", "dist/main.js"]
