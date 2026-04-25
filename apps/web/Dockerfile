# ==============================================================================
# PocketJury — Next.js Frontend Dockerfile (Cache-optimized)
# ==============================================================================

# Stage 1: Dependencies — cached unless package.json changes
FROM node:20-alpine AS deps
WORKDIR /app

COPY apps/web/package.json ./
RUN npm install --legacy-peer-deps --loglevel=error

# Stage 2: Build — only source code changes trigger this layer
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY apps/web/package.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/web/next.config.js apps/web/tsconfig.json apps/web/postcss.config.js apps/web/tailwind.config.js* ./
COPY apps/web/public ./public
COPY apps/web/src ./src

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
