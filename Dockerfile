# Multi-stage build for KPDCL Payment Reconciliation Dashboard
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production && \
    cd client && npm ci --only=production

# Copy source code
COPY . .

# Build frontend
RUN cd client && npm run build

# Production stage
FROM node:18-alpine AS production

# Install Oracle Instant Client and required libraries
RUN apk add --no-cache libaio libnsl libc6-compat curl unzip && \
    cd /tmp && \
    curl -o instantclient-basiclite.zip "https://download.oracle.com/otn_software/linux/instantclient/1920000/instantclient-basiclite-linux.x64-19.20.0.0.0dbru.zip" && \
    unzip instantclient-basiclite.zip && \
    mv instantclient_* /usr/lib/instantclient && \
    rm instantclient-basiclite.zip && \
    ln -s /usr/lib/instantclient/libclntsh.so.* /usr/lib/instantclient/libclntsh.so && \
    ln -s /usr/lib/instantclient/libocci.so.* /usr/lib/instantclient/libocci.so && \
    ln -s /lib/libc.so.6 /usr/lib/libresolv.so.2 && \
    ln -s /lib64/ld-linux-x86-64.so.2 /usr/lib/instantclient/ld-linux-x86-64.so.2 && \
    apk del curl unzip

# Set Oracle environment variables
ENV LD_LIBRARY_PATH=/usr/lib/instantclient
ENV ORACLE_HOME=/usr/lib/instantclient

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kpdcl -u 1001

# Copy built application from build stage
COPY --from=build --chown=kpdcl:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=kpdcl:nodejs /app/client/build ./client/build
COPY --from=build --chown=kpdcl:nodejs /app/package*.json ./
COPY --from=build --chown=kpdcl:nodejs /app/server.js ./
COPY --from=build --chown=kpdcl:nodejs /app/config ./config
COPY --from=build --chown=kpdcl:nodejs /app/models ./models
COPY --from=build --chown=kpdcl:nodejs /app/routes ./routes
COPY --from=build --chown=kpdcl:nodejs /app/services ./services
COPY --from=build --chown=kpdcl:nodejs /app/utils ./utils
COPY --from=build --chown=kpdcl:nodejs /app/public ./public
COPY --from=build --chown=kpdcl:nodejs /app/scripts ./scripts

# Create necessary directories
RUN mkdir -p logs && \
    chown -R kpdcl:nodejs logs && \
    chmod 755 logs

# Switch to non-root user
USER kpdcl

# Expose port
EXPOSE 3001

# Add labels for better container management
LABEL maintainer="KPDCL IT Team <it@kpdcl.com>"
LABEL description="KPDCL Payment Reconciliation Dashboard"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/wasimqur11/kpdcl-payment-recon"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start application
CMD ["node", "server.js"]