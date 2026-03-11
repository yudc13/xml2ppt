# syntax=docker/dockerfile:1.5

# Install dependencies in a separate layer for better caching
FROM node:20-alpine AS deps
WORKDIR /app
# Copy only manifest and lockfile to maximize cache hits
COPY package.json package-lock.json* ./
# Install dependencies with npm
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Build the Next.js app
FROM node:20-alpine AS builder
WORKDIR /app
# Reuse node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy the full source
COPY . .
# Build for production
RUN npm run build

# Runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy only the production artifacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Expose the Next.js port
EXPOSE 3000
# Start the server
CMD ["npm", "run", "start"]
