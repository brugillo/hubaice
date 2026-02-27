FROM node:20-alpine AS base

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN npm ci --workspace=packages/api --include-workspace-root

# Copy source
COPY packages/api/ ./packages/api/

# Build
RUN npm run build -w packages/api

# Production image
FROM node:20-alpine AS production

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/api/package.json ./packages/api/

RUN npm ci --workspace=packages/api --include-workspace-root --omit=dev

COPY --from=base /app/packages/api/dist ./packages/api/dist

ENV NODE_ENV=production
ENV API_PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

CMD ["node", "packages/api/dist/index.js"]
