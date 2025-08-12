# Multi-stage build for Price Tracker
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps-lite
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
# Install dependencies without puppeteer
RUN npm ci --omit=dev

COPY client/package*.json ./client/
RUN cd client && npm ci

# Install dependencies with puppeteer
FROM base AS deps-full
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
# Install dependencies and puppeteer
RUN npm ci --omit=dev
RUN npm install puppeteer

COPY client/package*.json ./client/
RUN cd client && npm ci

# Build the application (lite version)
FROM base AS builder-lite
WORKDIR /app
COPY --from=deps-lite /app/node_modules ./node_modules
COPY --from=deps-lite /app/client/node_modules ./client/node_modules
COPY . .

# Build client
RUN cd client && npm run build

# Build server
RUN npm run build:server

# Build the application (full version)
FROM base AS builder-full
WORKDIR /app
COPY --from=deps-full /app/node_modules ./node_modules
COPY --from=deps-full /app/client/node_modules ./client/node_modules
COPY . .

# Build client
RUN cd client && npm run build

# Build server
RUN npm run build:server

# Production image - LITE (Cheerio only)
FROM base AS lite
WORKDIR /app

# Install minimal runtime dependencies
RUN apk add --no-cache \
  dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 pricetracker

# Copy built application
COPY --from=builder-lite /app/dist ./dist
COPY --from=builder-lite /app/client/dist ./client/dist
COPY --from=builder-lite /app/node_modules ./node_modules
COPY --from=builder-lite /app/package*.json ./
COPY --from=builder-lite /app/drizzle ./drizzle
COPY --from=builder-lite /app/drizzle.config.ts ./
COPY --from=builder-lite /app/scripts ./scripts

# Set proper permissions
USER pricetracker

# Expose port
EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]

# Production image - FULL (Puppeteer + Cheerio)
FROM base AS full
WORKDIR /app

# Install runtime dependencies including Chromium
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 pricetracker

# Copy built application
COPY --from=builder-full /app/dist ./dist
COPY --from=builder-full /app/client/dist ./client/dist
COPY --from=builder-full /app/node_modules ./node_modules
COPY --from=builder-full /app/package*.json ./
COPY --from=builder-full /app/drizzle ./drizzle
COPY --from=builder-full /app/drizzle.config.ts ./
COPY --from=builder-full /app/scripts ./scripts

# Set proper permissions
USER pricetracker

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Expose port
EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]

# Default to full image for backward compatibility
FROM full AS default