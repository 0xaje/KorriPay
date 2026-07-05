# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: deps  — install production dependencies only
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

# Build-time args
ARG BUILD_DATE
ARG GIT_COMMIT
ARG APP_VERSION=dev

WORKDIR /app

# Install OS-level build tools needed by some native Node modules (e.g. pg)
RUN apk add --no-cache python3 make g++ openssl

# Copy manifests first for layer caching
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/

WORKDIR /app/backend
RUN npm ci --omit=dev --prefer-offline && \
    npx prisma generate

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: builder — copy all source files
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# ──────────────────────────────────────────────────────────────────────────────
# Stage 3: production — minimal runtime image
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

ARG BUILD_DATE
ARG GIT_COMMIT
ARG APP_VERSION=dev
ARG NODE_ENV=production

# OCI standard labels
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.title="KorriPay Backend" \
      org.opencontainers.image.description="KorriPay Fintech Platform — Node.js API" \
      org.opencontainers.image.vendor="KorriPay" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=${NODE_ENV} \
    PORT=3000 \
    # Disable Prisma telemetry in production
    PRISMA_TELEMETRY_INFORMATION=false

# Security: run as non-root user
RUN addgroup -g 1001 -S korripay && \
    adduser -S -u 1001 -G korripay korripay && \
    apk add --no-cache curl tini

WORKDIR /app

# Copy built application
COPY --from=builder --chown=korripay:korripay /app/backend ./backend/
COPY --from=builder --chown=korripay:korripay /app/frontend ./frontend/

WORKDIR /app/backend

USER korripay

EXPOSE 3000

# Tini as init process (proper signal handling, zombie reaping)
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -sf http://localhost:3000/api/v1/giwa/services || exit 1
