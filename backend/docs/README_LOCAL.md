# Context8 CLI - Local Deployment Guide

This guide explains how to deploy the Context8 CLI FastAPI application locally, as an alternative to the Modal deployment.

## Overview

The local deployment consists of:
- **`local_server.py`**: Main FastAPI server
- **`local_cleanup.py`**: Scheduled cleanup task for expired verification codes
- **`app/main.py`**: The FastAPI application (shared with Modal deployment)

## Prerequisites

1. **Python 3.9+**
2. **PostgreSQL 14+** with extensions:
   - `citext` (case-insensitive text)
   - `pgvector` (vector similarity search)
3. **Dependencies** (install via requirements.txt)

## Setup Instructions

### 1. Install Dependencies

```bash
cd context8-CLI
pip install -r requirements.txt
```

### 2. Set Up PostgreSQL Database

Create a PostgreSQL database with required extensions:

```sql
CREATE DATABASE context8;
\c context8
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Database connection
DATABASE_URL=postgresql+asyncpg://username:password@localhost:5432/context8

# JWT secret for session tokens (generate a random string)
JWT_SECRET=your-random-jwt-secret-here

# API key secret for generating user API keys (generate a random string)
API_KEY_SECRET=your-random-api-key-secret-here

# Resend API key for sending verification emails (get from resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM=noreply@yourdomain.com

# OpenRouter API key for LLM chat endpoint (get from openrouter.ai)
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxx
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TITLE=Context8
```

**Generate random secrets:**
```bash
# For JWT_SECRET and API_KEY_SECRET
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. Run Database Migrations

```bash
alembic upgrade head
```

### 5. Start the Server

**Development mode** (with auto-reload):
```bash
python local_server.py --reload
```

**Production mode**:
```bash
python local_server.py --host 0.0.0.0 --port 8000 --workers 4
```

The API will be available at:
- Main API: http://127.0.0.1:8000
- Interactive docs: http://127.0.0.1:8000/docs
- OpenAPI spec: http://127.0.0.1:8000/openapi.json

### 6. Set Up Cleanup Task

The cleanup task removes expired verification codes (older than 24 hours).

**Option A: Run once manually**
```bash
python local_cleanup.py
```

**Option B: Run continuously in the background**
```bash
python local_cleanup.py --schedule --interval 6  # Every 6 hours
```

**Option C: Set up a cron job** (recommended for production)
```bash
# Edit crontab
crontab -e

# Add this line to run cleanup every 6 hours
0 */6 * * * cd /path/to/context8-CLI && /path/to/python local_cleanup.py
```

## Production Deployment

### Using systemd (Linux)

Create a systemd service file `/etc/systemd/system/context8-api.service`:

```ini
[Unit]
Description=Context8 FastAPI Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/context8-CLI
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python local_server.py --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Create cleanup service `/etc/systemd/system/context8-cleanup.service`:

```ini
[Unit]
Description=Context8 Cleanup Task
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/context8-CLI
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/python local_cleanup.py --schedule --interval 6
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable context8-api context8-cleanup
sudo systemctl start context8-api context8-cleanup

# Check status
sudo systemctl status context8-api
sudo systemctl status context8-cleanup

# View logs
sudo journalctl -u context8-api -f
sudo journalctl -u context8-cleanup -f
```

### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "local_server.py", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: context8
      POSTGRES_USER: context8
      POSTGRES_PASSWORD: your_password_here
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    build: .
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql+asyncpg://context8:your_password_here@postgres:5432/context8
    env_file:
      - .env
    ports:
      - "8000:8000"
    restart: unless-stopped

  cleanup:
    build: .
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql+asyncpg://context8:your_password_here@postgres:5432/context8
    env_file:
      - .env
    command: python local_cleanup.py --schedule --interval 6
    restart: unless-stopped

volumes:
  postgres_data:
```

Run with Docker Compose (runs migrations on startup):
```bash
docker-compose up -d
```

If you need to re-run migrations manually:
```bash
docker-compose run --rm api alembic upgrade head
```

### Using Nginx Reverse Proxy

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## API Endpoints

See the interactive documentation at `/docs` for a complete API reference.

### Main Endpoints:
- `POST /solutions` - Create a new error solution
- `GET /solutions` - List user's solutions
- `GET /solutions/{id}` - Get a specific solution
- `POST /search` - Search for solutions
- `POST /llm/chat` - Chat with the assistant (requires auth)
- `POST /auth/email/send-code` - Send verification code
- `POST /auth/email/verify-code` - Verify code and get session
- `POST /api-keys` - Generate API key

## Monitoring

### Health Check

```bash
curl http://localhost:8000/docs
```

### Logs

When running with `--reload`, logs appear in the console.

For production, configure proper logging:
- systemd: `journalctl -u context8-api -f`
- Docker: `docker-compose logs -f api`

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
python -c "from app.database import engine; import asyncio; asyncio.run(engine.connect())"
```

### Missing Environment Variables

Check that all required variables are set in `.env`:
```bash
python -c "from app.config import *; print('Config loaded successfully')"
```

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use a different port
python local_server.py --port 8001
```

## Differences from Modal Deployment

| Feature | Modal | Local |
|---------|-------|-------|
| Deployment | `modal deploy modal_app.py` | `python local_server.py` |
| Secrets | Modal secrets | `.env` file |
| Scaling | Automatic | Manual (workers) |
| Scheduled tasks | Built-in cron | Separate script + cron |
| Cold starts | Yes | No |
| Cost | Pay per use | Fixed infrastructure |

## Security Considerations

1. **Environment Variables**: Never commit `.env` to version control
2. **Database**: Use strong passwords and restrict network access
3. **Secrets**: Generate cryptographically secure random secrets
4. **HTTPS**: Use a reverse proxy with SSL/TLS in production
5. **Firewall**: Restrict access to necessary ports only
6. **Updates**: Keep dependencies updated for security patches

## Performance Tuning

### Workers

Adjust the number of workers based on your CPU cores:
```bash
# General rule: (2 x CPU cores) + 1
python local_server.py --workers 9  # For 4-core machine
```

### Database Connection Pool

Edit `app/database.py` to configure connection pooling:
```python
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,  # Max connections
    max_overflow=10,  # Additional connections when needed
)
```

## Support

For issues and questions:
- GitHub Issues: [your-repo-url]
- Documentation: [your-docs-url]
