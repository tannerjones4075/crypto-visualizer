FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.26-bookworm AS go
ARG TARGETARCH
WORKDIR /src/server
COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH go build -o /out/server .

FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=go /out/server /app/server
COPY --from=web /src/web/dist /app/dist
ENV STATIC_DIR=/app/dist
USER 10001
EXPOSE 8080
ENTRYPOINT ["/app/server"]
