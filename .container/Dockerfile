# ---------- Build migrate CLI ----------
FROM --platform=${BUILDPLATFORM} golang:1.24 AS migrate-builder

ARG TARGETOS
ARG TARGETARCH

ENV CGO_ENABLED=0 \
    GOBIN=/out \
    GOOS=${TARGETOS} \
    GOARCH=${TARGETARCH}

RUN /usr/local/go/bin/go install \
    -trimpath \
    -tags 'clickhouse' \
    -ldflags='-s -w' \
    github.com/golang-migrate/migrate/v4/cmd/migrate@v4.19.1


# ---------- Runtime container ----------
FROM node:20-alpine

WORKDIR /app

# Install migrate CLI
COPY --from=migrate-builder /out/migrate /usr/local/bin/migrate

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source
COPY . .

# Build app (skip if not needed)
RUN npm run build || echo "No build step"

# CRITICAL: expose port used by app
EXPOSE 3000

# CRITICAL: start the server
CMD ["npm", "start"]