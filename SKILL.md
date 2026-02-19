# Context8 Docker: Agent-Ready Deployment Skill

Repository:
- `https://github.com/context8/context8-docker`

Goal:
- Enable any Vibe Coding Agent / OpenClaw flow to deploy Context8 Docker in an internal environment with zero guesswork.

Platform:
- Linux/macOS with Bash
- Docker daemon + `docker compose`
- `git`, `curl`

## Critical MCP Architecture Note

`context8-docker` is **not** a native MCP server endpoint.

Use `context8-mcp` as the bridge:
- `Codex MCP client -> context8-mcp (stdio) -> Context8 Docker HTTP API`

This deployment exposes MCP-compatible HTTP routes like `/mcp/solutions`, but not a standalone MCP transport endpoint for Codex direct connection.

## Minimal Agent Flow

1. Clone or update:
```bash
git clone https://github.com/context8/context8-docker.git
cd context8-docker
```

2. Configure (`.env`) interactively:
```bash
./scripts/configure_context8_docker.sh
```

3. Configure + start + smoke in one shot:
```bash
./scripts/configure_context8_docker.sh --up --smoke
```

By default, when `--up` is used, the script auto-installs `context8-mcp` if `npm` is available.
If `API_KEY` is provided in environment, it auto-applies `context8-mcp remote-config` to local Docker API (`http://localhost:${API_PORT:-8000}`).

## Non-Interactive Automation (for Agents)

Use non-interactive flags for deterministic setup:
```bash
./scripts/configure_context8_docker.sh \
  --non-interactive \
  --api-base "http://localhost:8000" \
  --enable-semantic false \
  --enable-federation false \
  --up \
  --smoke
```

To make MCP installation strict (fail if `npm` is missing), add:
```bash
--install-mcp
```

To skip MCP auto-install:
```bash
--skip-install-mcp
```

If semantic search is enabled, add the compose profile:
```bash
./scripts/configure_context8_docker.sh \
  --non-interactive \
  --enable-semantic true \
  --es-knn-weight 1 \
  --es-bm25-weight 1 \
  --profile semantic \
  --up \
  --smoke
```

See all script options:
```bash
./scripts/configure_context8_docker.sh --help
```

## npm-like Update Flow

Default update command:
```bash
./scripts/update_context8_docker.sh
```

Rollback to an exact version:
```bash
CONTEXT8_VERSION=v1.2.2 ./scripts/update_context8_docker.sh
```

Switch registry channel:
```bash
CONTEXT8_REGISTRY=ghcr.io/context8 ./scripts/update_context8_docker.sh
# or
CONTEXT8_REGISTRY=docker.io/<org_or_user> ./scripts/update_context8_docker.sh
```

Optional one-shot Watchtower update (manual trigger only):
```bash
./scripts/update_context8_docker_once_watchtower.sh
```

Image channel variables:
- `CONTEXT8_VERSION` (default `v1`)
- `CONTEXT8_REGISTRY` (default `ghcr.io/context8`)
- optional exact image overrides: `CONTEXT8_API_IMAGE`, `CONTEXT8_FRONTEND_IMAGE`, `CONTEXT8_EMBEDDING_IMAGE`

## Admin Bootstrap

Check if admin exists:
```bash
API_BASE="http://localhost:8000"
curl -fsS "$API_BASE/auth/status"
```

If `adminExists=false`, create admin:
```bash
curl -fsS -X POST "$API_BASE/auth/setup" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<strong-password>"}'
```

If `adminExists=true`, do **not** rerun setup. Use reset flow, then login:
```bash
curl -fsS -X POST "$API_BASE/auth/admin/reset-password" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Reset-Token: <admin-reset-token>" \
  -d '{"identifier":"admin","newPassword":"<new-strong-password>"}'
```

Login and get JWT (`token` field):
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

`configure_context8_docker.sh --up` will try to install `context8-mcp` automatically.
If auto-install is skipped/failed, install manually:

1. Install:
```bash
npm install -g context8-mcp
```

2. Point MCP to your local Docker API (replace port if not `8000`):
```bash
context8-mcp remote-config \
  --remote-url "http://localhost:8000" \
  --api-key "<api-key>"
```

3. Verify connection:
```bash
context8-mcp diagnose
context8-mcp list --limit 1
```

4. Agent runtime command (no global install required):
```bash
npx -y context8-mcp
```

## Layered Validation (Required)

Validate in two layers. Passing layer 1 does not guarantee layer 2.

### Layer 1: Service smoke (HTTP)

Base checks:
- `GET /status/summary`
- `GET /status`

With API key:
- `POST /search` (`source=local`)
- `GET /mcp/solutions`
- `GET /solutions`
- `GET /v2/solutions`

If federation is enabled, `source=remote` check is attempted as warning-only (does not fail local deployment status).

### Layer 2: Bridge smoke (Codex MCP)

Register and inspect bridge:
```bash
codex mcp add context8 --env CONTEXT8_REMOTE_API_KEY=<api-key> -- npx -y context8-mcp
codex mcp list
codex mcp get context8
```

Then execute one minimal bridge call:
```bash
context8-mcp diagnose
context8-mcp list --limit 1
```

## Known Behavior / Troubleshooting

1. `diagnose` says remote reachable, but `list` still fails:
   - `diagnose` success does not guarantee all subcommands are using the same runtime path.
   - Prefer fixed verification order:
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

2. Codex MCP ready, but `list_mcp_resources` fails:
   - Confirm bridge is configured (`codex mcp list` / `codex mcp get context8`).
   - Remember the bridge target is HTTP API compatibility routes (`/mcp/solutions`), not a native MCP endpoint on Docker.

3. Health path confusion:
   - Use `GET /status/summary` and `GET /status`.
   - `/summary` is not the standard health path for this deployment.

## Notes

- This deployment is ES-only search (`/search` does not fallback to DB).
- Writes are synchronous DB + ES.
- No Redis/RQ worker stack in the Docker lightweight edition.
- Existing manual flow (`cp .env.example .env` + `docker compose up -d --pull always`) remains valid.
- Local source-build development path: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`.
