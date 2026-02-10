---
name: context8-docker-deploy
description: End-to-end deployment workflow for Context8 Docker (context8/context8-docker) using Docker Compose. Use when asked to self-host Context8, deploy the Context8 Docker stack, configure `.env` secrets and ports, enable optional semantic search (embedding + ES kNN), configure optional federated search to a remote Context8 server, or run smoke checks for API and MCP compatibility.
---

# Context8 Docker Deploy

## Overview

Deploy a complete Context8 instance (Dashboard + API + Elasticsearch + Postgres) with a small, predictable architecture.
Clone/pull the GitHub repo, generate a safe `.env`, start the compose stack, and verify health + core endpoints.

## Workflow

Follow these steps in order. Prefer fixing the root cause (config/env) over adding runtime hacks.

### 0) Preflight

- Ensure prerequisites:
  - Docker is installed and the daemon is running
  - `docker compose` is available
  - `git` is available
- Pick a working directory (example):
  - Linux: `/opt/context8-docker`
  - macOS: any writable folder

Quick checks:
```bash
docker version
docker compose version
git --version
```

### 1) Clone Or Update The Repo

Clone (new machine):
```bash
git clone https://github.com/context8/context8-docker.git
cd context8-docker
```

Update (already cloned):
```bash
cd context8-docker
git fetch --all --prune
git pull --ff-only
```

### 2) Create And Harden `.env`

Create `.env` once:
```bash
cp .env.example .env
```

Set required variables (do not use placeholders):
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `API_KEY_SECRET`
- `VITE_API_BASE` (browser-reachable API base, e.g. `http://localhost:8000`)

Generate strong secrets:
```bash
openssl rand -hex 32
```

Important constraints:
- `VITE_API_BASE` is a frontend build-time value; changing it requires rebuild (`docker compose up -d --build`).
- Changing `POSTGRES_PASSWORD` after the Postgres volume exists requires updating the DB role password or recreating the volume. Prefer setting it correctly before first boot.

Optional: avoid exposing DB/ES to the network (safe defaults):
- `POSTGRES_BIND=127.0.0.1`
- `ES_BIND=127.0.0.1`

### 3) Start The Stack (Baseline)

Start (BM25 only; no embedding container):
```bash
docker compose up -d --build
```

Open:
- Dashboard: `http://<host>:3000`
- API docs: `http://<host>:8000/docs`

### 4) Wait For Readiness

Wait for the API healthcheck:
```bash
API_BASE="${API_BASE:-http://localhost:8000}"
curl -fsS "$API_BASE/status/summary"
```

If it fails:
```bash
docker compose logs --tail=200 api
docker compose ps
```

### 5) First-Time Admin Setup And API Key

Check admin status:
```bash
curl -fsS "$API_BASE/auth/status"
```

If no admin exists, create one (one-time):
```bash
curl -fsS -X POST "$API_BASE/auth/setup" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<strong-password>"}'
```

Login and get a JWT:
```bash
curl -fsS -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin","password":"<strong-password>"}'
```

Create an API key (optionally set quotas):
```bash
curl -fsS -X POST "$API_BASE/apikeys" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"default","dailyLimit":1000,"monthlyLimit":20000}'
```

### 6) Smoke Checks (API + MCP Contract)

With `X-API-Key`, verify:
- `POST /search` works (ES-only search source)
- `GET /mcp/solutions` returns an array (MCP compatibility)
- `GET /solutions` returns an array for API-key auth (compat route)
- `GET /v2/solutions` returns pagination (new contract)

Example:
```bash
API_KEY="<apiKey-from-admin>"

curl -fsS -X POST "$API_BASE/search" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"query":"test","limit":5,"offset":0,"source":"local"}'

curl -fsS "$API_BASE/mcp/solutions?limit=1&offset=0" -H "X-API-Key: $API_KEY"
curl -fsS "$API_BASE/solutions?limit=1&offset=0" -H "X-API-Key: $API_KEY"
```

### 7) Optional: Enable Semantic Search (Embedding + ES kNN)

Enable kNN in `.env`:
- `ES_KNN_WEIGHT=1`
- optional: tune `ES_BM25_WEIGHT`

Start the `semantic` profile (adds `embedding` container):
```bash
docker compose --profile semantic up -d --build
```

Re-check:
```bash
curl -fsS "$API_BASE/status"
```

### 8) Optional: Federated Search (Remote Context8)

Set in `.env`:
- `REMOTE_CONTEXT8_BASE=https://remote.example.com`
- `REMOTE_CONTEXT8_API_KEY=...`
- keep `REMOTE_CONTEXT8_ALLOW_OVERRIDE=false` unless you understand the security implications

Test:
```bash
curl -fsS -X POST "$API_BASE/search" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"query":"test","limit":5,"offset":0,"source":"remote"}'
```

### 9) Stop / Restart / Upgrade

Stop (keeps volumes/data):
```bash
docker compose down
```

Upgrade:
```bash
git pull --ff-only
docker compose up -d --build
```

## Resources (optional)

### scripts/
Use these scripts to reduce mistakes in repetitive steps:
- `scripts/bootstrap_env.sh`: create/update `.env` with generated secrets (does not print secret values).
- `scripts/smoke.sh`: run basic health + auth-required endpoint checks using `API_BASE` and `API_KEY`.

Example usage (default Codex home is `~/.codex`):
```bash
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

"$CODEX_HOME/skills/context8-docker-deploy/scripts/bootstrap_env.sh" ./context8-docker
API_BASE="http://localhost:8000" API_KEY="<apiKey>" \
  "$CODEX_HOME/skills/context8-docker-deploy/scripts/smoke.sh"
```

### references/
Keep empty unless you need to store deployment-specific notes that are too long for SKILL.md.

If you add references, keep them one hop away from SKILL.md (no deep reference chains).
