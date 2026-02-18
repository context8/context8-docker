---
name: context8-docker-deploy
description: End-to-end deployment workflow for Context8 Docker (context8/context8-docker) using Docker Compose. Includes a terminal configurator for interactive and non-interactive setup, optional semantic search, optional federated search, and smoke checks for API/MCP compatibility.
---

# Context8 Docker Deploy

## Canonical Entry

Use the repository root `SKILL.md` as the external/public entrypoint:
- `./SKILL.md`

This skill stays in sync with the root skill and provides local helper scripts for repeated operations.

Repository:
- `https://github.com/context8/context8-docker`

## Quick Workflow

1. Clone or update repo:
```bash
git clone https://github.com/context8/context8-docker.git
cd context8-docker
```

2. Configure `.env` with terminal configurator:
```bash
./scripts/configure_context8_docker.sh
```

3. Configure + start + smoke in one command:
```bash
./scripts/configure_context8_docker.sh --up --smoke
```

4. Non-interactive automation:
```bash
./scripts/configure_context8_docker.sh \
  --non-interactive \
  --api-base "http://localhost:8000" \
  --enable-semantic false \
  --enable-federation false \
  --up \
  --smoke
```

Show all options:
```bash
./scripts/configure_context8_docker.sh --help
```

## Manual Fallback (No Configurator)

If you need full manual control:
```bash
cp .env.example .env
docker compose up -d --build
```

Then run checks:
```bash
API_BASE="${API_BASE:-http://localhost:8000}"
curl -fsS "$API_BASE/status/summary"
curl -fsS "$API_BASE/status"
```

## Admin Bootstrap

Check setup state:
```bash
curl -fsS "$API_BASE/auth/status"
```

Create admin (one-time):
```bash
curl -fsS -X POST "$API_BASE/auth/setup" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<strong-password>"}'
```

Login:
```bash
curl -fsS -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin","password":"<strong-password>"}'
```

Create API key:
```bash
curl -fsS -X POST "$API_BASE/apikeys" \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name":"default","dailyLimit":1000,"monthlyLimit":20000}'
```

## Connect MCP via npm `context8-mcp`

Use npm package `context8-mcp` to connect coding agents to this Docker deployment.

Install:
```bash
npm install -g context8-mcp
```

Configure remote target (replace API port if needed):
```bash
context8-mcp remote-config \
  --remote-url "http://localhost:8000" \
  --api-key "<api-key>"
```

Validate:
```bash
context8-mcp diagnose
context8-mcp list --limit 1
```

For MCP clients that execute package directly:
```bash
npx -y context8-mcp
```

## Optional Features

- Semantic search:
  - Set `ES_KNN_WEIGHT > 0`
  - Start compose with `--profile semantic`
- Federated search:
  - Set `REMOTE_CONTEXT8_BASE` + `REMOTE_CONTEXT8_API_KEY`
  - Keep `REMOTE_CONTEXT8_ALLOW_OVERRIDE=false` unless required

## Local helper scripts

- `scripts/bootstrap_env.sh`
  - Creates/updates `.env` with generated secrets (no secret values printed).
- `scripts/smoke.sh`
  - Runs health + auth-required endpoint checks using `API_BASE` and `API_KEY`.

Example:
```bash
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
"$CODEX_HOME/skills/context8-docker-deploy/scripts/bootstrap_env.sh" ./context8-docker
API_BASE="http://localhost:8000" API_KEY="<apiKey>" \
  "$CODEX_HOME/skills/context8-docker-deploy/scripts/smoke.sh"
```
