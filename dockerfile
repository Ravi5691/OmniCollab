# Multi-stage Dockerfile for Collaborative Coding Platform

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Install frontend dependencies first for better caching
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

# Copy frontend source code and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend & Production Image
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install backend production dependencies
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

# Copy backend source files
COPY backend/ ./

# Copy compiled frontend from Stage 1 into backend's public directory
COPY --from=frontend-builder /app/dist ./public

EXPOSE 3000

CMD ["node", "server.js"]
