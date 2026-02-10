# Stage 1: Development stage with hot-reload support
FROM node:20-alpine AS development

# Required for native binaries (Vite/Rolldown, Lightning CSS, etc.)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./

# Use npm install instead of npm ci to resolve platform-specific dependencies
# (lockfile may lack linux-musl binaries when generated on macOS)
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 3000

# Development command with host binding for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# Stage 2: Build stage for production
FROM node:20-alpine AS builder

# Required for native binaries (Vite/Rolldown, Lightning CSS, etc.)
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Use npm install instead of npm ci to resolve platform-specific dependencies
RUN npm install

# Copy source code
COPY . .

# Build arguments for environment variables at build time
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the application
RUN npm run build


# Stage 3: Production stage with nginx
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /var/cache/nginx && \
    chown -R appuser:appgroup /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R appuser:appgroup /var/run/nginx.pid

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Expose port 80
EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
