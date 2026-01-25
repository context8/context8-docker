# Context8 CLI - Quick Start (Local Deployment)

Get Context8 CLI running locally in 5 minutes.

## Prerequisites

- Python 3.9+
- PostgreSQL 14+ (or use Docker)

## Quick Start

### Option 1: Using Docker (Recommended)

```bash
# 1. Clone and navigate to directory
cd context8-CLI

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env and add your secrets
nano .env  # or use your preferred editor

# 4. Start all services with Docker (runs migrations on startup)
docker-compose up -d

# 5. Check logs
docker-compose logs -f api

# API is now running at http://localhost:8000
# Docs available at http://localhost:8000/docs
```

### Option 2: Manual Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Set up PostgreSQL database
createdb context8
psql context8 -c "CREATE EXTENSION IF NOT EXISTS citext;"
psql context8 -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 3. Copy and configure environment
cp .env.example .env
# Edit .env with your database URL and secrets

# 4. Run migrations
alembic upgrade head

# 5. Start the server
python local_server.py --reload

# 6. (Optional) In another terminal, start cleanup task
python local_cleanup.py --schedule
```

### Option 3: Using Makefile

```bash
# Setup
make install
make setup
make migrate

# Run development server
make dev

# Or run production server
make prod
```

## Required Environment Variables

Edit `.env` and set at minimum:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/context8

# Secrets (generate with: make generate-secret)
JWT_SECRET=<random-secret>
API_KEY_SECRET=<random-secret>

# Email (get from resend.com)
RESEND_API_KEY=re_xxxxx
RESEND_FROM=noreply@yourdomain.com

# LLM (get from openrouter.ai)
OPENROUTER_API_KEY=sk-or-xxxxx
```

## Generate Secrets

```bash
# Generate a random secret
make generate-secret

# Or manually
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Verify Installation

```bash
# Check health
curl http://localhost:8000/docs

# Create a test user
curl -X POST http://localhost:8000/auth/email/send-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## Next Steps

1. Read the [full deployment guide](README_LOCAL.md)
2. Set up a reverse proxy (Nginx/Caddy)
3. Configure SSL/TLS
4. Set up monitoring and backups

## Troubleshooting

**Port already in use:**
```bash
python local_server.py --port 8001
```

**Database connection failed:**
```bash
# Check PostgreSQL is running
pg_isready

# Test connection
python -c "from app.database import engine; import asyncio; asyncio.run(engine.connect())"
```

**Missing dependencies:**
```bash
pip install -r requirements.txt --upgrade
```

## Common Commands

```bash
# Development
make dev              # Run with auto-reload
make cleanup          # Run cleanup once
make test             # Run tests

# Production
make prod             # Run with 4 workers
make cleanup-schedule # Run cleanup continuously

# Docker
make docker-up        # Start all services
make docker-down      # Stop all services
make docker-logs      # View logs

# Utilities
make clean            # Clean cache files
make generate-secret  # Generate random secret
```

## Default Endpoints

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- OpenAPI: http://localhost:8000/openapi.json

## Support

For detailed documentation, see [README_LOCAL.md](README_LOCAL.md)
