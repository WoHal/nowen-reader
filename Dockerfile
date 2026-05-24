# ============================================================
# NowenReader - Production Multi-stage Dockerfile
# ============================================================

# --- Stage 1: Frontend build ---
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci

COPY frontend/ .
RUN npm run build


# --- Stage 2: Go build ---
FROM golang:1.23-alpine AS builder

ARG TARGETOS
ARG TARGETARCH

WORKDIR /build

# speed up in CN (optional)
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache git

ENV GOPROXY=https://goproxy.cn,direct

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# frontend assets
COPY --from=frontend-builder /frontend/dist ./web/dist

# build metadata (ALL injected from CI)
ARG VERSION=docker
ARG BUILD_TIME
ARG GIT_COMMIT

RUN echo "[build] ${TARGETOS}/${TARGETARCH}" && \
    CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -ldflags="-s -w \
      -X main.Version=${VERSION} \
      -X main.BuildTime=${BUILD_TIME} \
      -X main.GitCommit=${GIT_COMMIT}" \
    -o nowen-reader ./cmd/server


# --- Stage 3: Runtime ---
FROM alpine:3.20

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache \
      tini \
      ca-certificates \
      tzdata \
      p7zip \
      mupdf-tools \
      libwebp-tools \
      su-exec

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /build/nowen-reader .
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN mkdir -p /data /app/comics /app/novels /app/.cache && \
    chown -R appuser:appgroup /data /app

ENV GIN_MODE=release \
    PORT=3000 \
    DATABASE_URL=/data/nowen-reader.db \
    COMICS_DIR=/app/comics \
    NOVELS_DIR=/app/novels \
    DATA_DIR=/app/.cache \
    TZ=Asia/Shanghai

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/docker-entrypoint.sh"]