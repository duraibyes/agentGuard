# Use Node 24 as required
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy dependency files first (for caching)
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Azure App Service uses PORT env variable
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start application
CMD ["pnpm", "start"]