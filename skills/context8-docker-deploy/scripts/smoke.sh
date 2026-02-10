#!/usr/bin/env bash
set -euo pipefail

api_base="${API_BASE:-http://localhost:8000}"
api_key="${API_KEY:-}"

if [[ "${1:-}" == "--api-base" ]]; then
  api_base="${2:-$api_base}"
  shift 2 || true
fi
if [[ "${1:-}" == "--api-key" ]]; then
  api_key="${2:-$api_key}"
  shift 2 || true
fi

echo "API_BASE=$api_base"

deadline=$((SECONDS + 120))
until curl -fsS "$api_base/status/summary" >/dev/null; do
  if (( SECONDS >= deadline )); then
    echo "Timed out waiting for $api_base/status/summary" >&2
    exit 1
  fi
  sleep 2
done

curl -fsS "$api_base/status/summary" >/dev/null
curl -fsS "$api_base/status" >/dev/null

if [[ -n "$api_key" ]]; then
  curl -fsS -X POST "$api_base/search" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $api_key" \
    -d '{"query":"test","limit":1,"offset":0,"source":"local"}' >/dev/null

  curl -fsS "$api_base/mcp/solutions?limit=1&offset=0" -H "X-API-Key: $api_key" >/dev/null
  curl -fsS "$api_base/solutions?limit=1&offset=0" -H "X-API-Key: $api_key" >/dev/null
  curl -fsS "$api_base/v2/solutions?limit=1&offset=0" -H "X-API-Key: $api_key" >/dev/null
else
  echo "API_KEY not provided; skipped auth-required endpoint checks"
fi

echo "Smoke OK"

