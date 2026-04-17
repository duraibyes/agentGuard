FROM node:24-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files
COPY package.json pnpm-lock.yaml* ./

# IMPORTANT: copy patches required by pnpm
COPY patches ./patches

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy remaining source code
COPY . .

ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]