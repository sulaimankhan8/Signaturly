# ==============================================================================
# SIGNATURLY PRO BACKEND - PRODUCTION DOCKERFILE
# ==============================================================================

# Use official Node.js 20 LTS Slim (Debian-based for optimal native package compatibility like bcrypt)
FROM node:20-slim AS base

# Install OpenSSL, curl, and CA certificates for secure cryptographic operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Stage 1: Install production dependencies
FROM base AS dependencies
RUN npm ci --only=production

# Stage 2: Final lightweight runtime container
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Copy node_modules from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Create uploads directory and assign ownership to non-root node user
RUN mkdir -p /app/uploads && chown -R node:node /app

# Switch to non-root node user for container security
USER node

# Expose backend API port
EXPOSE 5000

# Healthcheck to verify the server is active
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/templates/public || exit 1

# Start the Node.js Express server
CMD ["node", "src/server.js"]
