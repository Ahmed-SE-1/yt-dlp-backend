# Multi-stage build for smaller final image
# Stage 1: Builder for Node.js dependencies
FROM node:18-slim as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Runtime image with Python, yt-dlp and ffmpeg
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp (latest stable release)
RUN pip install --no-cache-dir yt-dlp && \
    yt-dlp --version

# Copy Node.js dependencies from builder
COPY --from=builder /app/node_modules /app/node_modules

# Copy application files
WORKDIR /app
COPY . .

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Run as non-root user
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Start command
CMD ["node", "server.js"]
