# ==============================================================================
# PocketJury API — Dockerfile (Multi-stage, Cache-optimized)
# ==============================================================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies — cached unless package.json or shared package changes
FROM base AS deps
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json
COPY packages/shared/src ./packages/shared/src
COPY apps/api/package.json apps/api/package-lock.json* ./
RUN sed -i 's|"@pocketjury/shared": "\*"|"@pocketjury/shared": "file:./packages/shared"|' package.json
RUN if [ -f package-lock.json ]; then npm ci --loglevel=error; else npm install --loglevel=error; fi

# Build — only source code changes trigger this layer
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared ./packages/shared
# Build shared package first (run from /app so npx finds node_modules/.bin/tsc)
RUN npx tsc -p packages/shared/tsconfig.json
COPY apps/api/prisma ./prisma
RUN npx prisma generate
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json* ./
COPY apps/api/src ./src
RUN npm run build

# Production
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 pocketjury

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
# Link built shared package into node_modules
RUN rm -rf node_modules/@pocketjury/shared && \
    mkdir -p node_modules/@pocketjury && \
    ln -s /app/packages/shared node_modules/@pocketjury/shared

USER pocketjury
EXPOSE 4000
CMD ["npm", "start"]
