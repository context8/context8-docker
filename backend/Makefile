.PHONY: help install setup dev prod cleanup test migrate clean

help:
	@echo "Context8 CLI - Local Deployment Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install     Install Python dependencies"
	@echo "  make setup       Create .env file from example"
	@echo "  make migrate     Run database migrations"
	@echo ""
	@echo "Running:"
	@echo "  make dev         Run development server (auto-reload)"
	@echo "  make prod        Run production server (4 workers)"
	@echo "  make cleanup     Run cleanup task once"
	@echo ""
	@echo "Utilities:"
	@echo "  make test        Run tests"
	@echo "  make clean       Clean up cache files"

install:
	pip install -r requirements.txt

setup:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env file. Please edit it with your configuration."; \
	else \
		echo ".env file already exists. Skipping."; \
	fi

migrate:
	alembic upgrade head

dev:
	python local_server.py --reload

prod:
	python local_server.py --host 0.0.0.0 --port 8000 --workers 4

cleanup:
	python local_cleanup.py

cleanup-schedule:
	python local_cleanup.py --schedule --interval 6

test:
	pytest

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

generate-secret:
	@python -c "import secrets; print(secrets.token_urlsafe(32))"

# Docker commands
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-restart:
	docker-compose restart
