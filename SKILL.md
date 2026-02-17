# Context8 Docker: Agent-Ready Deployment Skill

Repository:
- `https://github.com/context8/context8-docker`

Goal:
- Enable any Vibe Coding Agent / OpenClaw flow to deploy Context8 Docker in an internal environment with zero guesswork.

Platform:
- Linux/macOS with Bash
- Docker daemon + `docker compose`
- `git`, `curl`

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

## Admin Bootstrap

Check if admin exists:
```bash
API_BASE="http://localhost:8000"
curl -fsS "$API_BASE/auth/status"
```

Create admin once (if needed):
```bash
curl -fsS -X POST "$API_BASE/auth/setup" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<strong-password>"}'
```

Login and get JWT:
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

## Smoke Endpoints

Base checks:
- `GET /status/summary`
- `GET /status`

With API key:
- `POST /search` (`source=local`)
- `GET /mcp/solutions`
- `GET /solutions`
- `GET /v2/solutions`

If federation is enabled, `source=remote` check is attempted as warning-only (does not fail local deployment status).

## Notes

- This deployment is ES-only search (`/search` does not fallback to DB).
- Writes are synchronous DB + ES.
- No Redis/RQ worker stack in the Docker lightweight edition.
- Existing manual flow (`cp .env.example .env` + `docker compose up -d --build`) remains valid.
