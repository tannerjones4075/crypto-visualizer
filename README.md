# Cryptography Visualizer

Classroom SPA (React) + Go OpenSSL runner. See `DESIGN.md`.

## Local UI (Part 1)

```bash
cd web && npm install && npm run dev
```

## Local API (needed for Real-world Run)

Uses port **18080** locally so it does not collide with other labs on 8080. Vite already proxies `/api` there.

```bash
cd server && PORT=18080 go run .
```

Open http://127.0.0.1:5173 — Real-world Run needs OpenSSL on `PATH`.

Classroom Docker publishes **8080**.

## Docker (SPA + API in one container)

Needs [Task](https://taskfile.dev) and Docker.

```bash
task docker:build
task docker:run
```

Or `task` to build then run. Open http://127.0.0.1:8080 — Real-world Run uses OpenSSL inside the image.
