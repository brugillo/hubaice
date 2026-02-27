FROM node:20-alpine AS base

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN npm ci --workspace=packages/web --include-workspace-root

# Copy source
COPY packages/web/ ./packages/web/

# Build
ENV NEXT_TELEMETRY_DISABLED=1
ARG API_URL=http://api:3001
ENV API_URL=${API_URL}
RUN npm run build -w packages/web

# Production image
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY packages/web/package.json ./packages/web/

RUN npm ci --workspace=packages/web --include-workspace-root --omit=dev

COPY --from=base /app/packages/web/.next ./packages/web/.next
COPY --from=base /app/packages/web/next.config.ts ./packages/web/next.config.ts
COPY --from=base /app/packages/web/public ./packages/web/public 2>/dev/null || true

ENV API_URL=http://api:3001

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "packages/web"]
