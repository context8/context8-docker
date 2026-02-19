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

## Critical MCP Architecture Note

`context8-docker` is **not** a native MCP server endpoint.

Use `context8-mcp` as bridge:
- `Codex MCP client -> context8-mcp (stdio) -> Context8 Docker HTTP API`

The Docker service provides MCP-compatible HTTP routes (`/mcp/solutions`), but Codex still needs `context8-mcp` for MCP tool access.

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

When `--up` is used, the configurator auto-installs `context8-mcp` if `npm` is available.
If `API_KEY` is set, it also runs `context8-mcp remote-config` to local Docker API (`http://localhost:${API_PORT:-8000}`).

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

Strict install mode (fail if `npm` missing):
```bash
./scripts/configure_context8_docker.sh --non-interactive --up --install-mcp
```

Skip MCP auto-install:
```bash
./scripts/configure_context8_docker.sh --non-interactive --up --skip-install-mcp
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

If `adminExists=false`, create admin:
```bash
curl -fsS -X POST "$API_BASE/auth/setup" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<strong-password>"}'
```

If `adminExists=true`, use reset flow, then login:
```bash
curl -fsS -X POST "$API_BASE/auth/admin/reset-password" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Reset-Token: <admin-reset-token>" \
  -d '{"identifier":"admin","newPassword":"<new-strong-password>"}'
```

Login (`token` field):
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
The configurator auto-install covers most cases; manual flow stays available:

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

## Layered Validation (Required)

### Layer 1: Service smoke (HTTP)

Use:
- `GET /status/summary`
- `GET /status`
- `POST /search` (with `X-API-Key`)
- `GET /mcp/solutions` (with `X-API-Key`)

### Layer 2: Bridge smoke (Codex MCP)

Use:
```bash
codex mcp add context8 --env CONTEXT8_REMOTE_API_KEY=<api-key> -- npx -y context8-mcp
codex mcp list
codex mcp get context8
context8-mcp diagnose
context8-mcp list --limit 1
```

Passing layer 1 does not guarantee layer 2. Validate both.

## Known Behavior / Troubleshooting

1. `context8-mcp diagnose` is reachable but `context8-mcp list` fails:
   - `diagnose` pass does not guarantee every command path is healthy.
   - Verify with fixed order:
```bash
API_BASE="http://localhost:8000"
API_KEY="<api-key>"
curl -fsS "$API_BASE/status/summary"
curl -fsS "$API_BASE/status"
curl -fsS "$API_BASE/mcp/solutions?limit=1&offset=0" -H "X-API-Key: $API_KEY"
context8-mcp remote-config --remote-url "$API_BASE" --api-key "$API_KEY"
context8-mcp diagnose
context8-mcp list --limit 1
```

2. Codex MCP server appears ready but tool/resource listing fails:
   - Check `codex mcp list` and `codex mcp get context8`.
   - Confirm bridge model: Codex talks to `context8-mcp`, which talks to Docker HTTP API routes.

3. Health endpoint confusion:
   - Standard health endpoints are `GET /status/summary` and `GET /status`.
   - `/summary` is not a standard health path for this deployment.

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
