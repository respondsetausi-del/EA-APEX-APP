# Use Bun image to run scripts and serve static build
FROM oven/bun:1.2.20-alpine

# Install curl for health checks, Node.js for Expo CLI, and build tools for native deps
RUN apk add --no-cache curl nodejs npm python3 make g++

# Set env vars (override NODE_ENV during install below)
ENV NODE_ENV=production
ENV EXPO_NO_TELEMETRY=1

WORKDIR /app

# Install dependencies first (better layer cache)
COPY package.json bun.lock* package-lock.json* ./
# Install all deps including devDependencies for the build step
RUN NODE_ENV=development bun install

# Copy the rest of the source
COPY . .

# Build static web export to dist/ using Node (avoids Bun sideEffects warning)
RUN node ./node_modules/.bin/expo export --platform web

# Run post-build script to set up PWA manifest and icons
RUN node scripts/post-build.js

# Remove build tools to slim image
RUN apk del python3 make g++

# Fix #12: Create non-root user with names matching actual stack (Bun/Expo, not Next.js)
RUN addgroup -g 1001 -S appgroup
RUN adduser -S appuser -u 1001

# Change ownership of the app directory
RUN chown -R appuser:appgroup /app
USER appuser

# Serve the static site (Render injects PORT at runtime, default 3000)
EXPOSE 3000

# Fix #14: Use shell form so $PORT is resolved at runtime, with fallback to 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

CMD ["bun", "run", "serve:dist"]
