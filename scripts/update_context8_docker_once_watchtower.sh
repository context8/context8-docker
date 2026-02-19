#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/update_context8_docker_once_watchtower.sh [options]

Options:
  --repo-dir <path>     Context8 Docker repo root (default: current directory)
  --help                Show this help

Notes:
  - This script runs Watchtower one time (--run-once), not as a scheduled daemon.
  - Watchtower requires access to /var/run/docker.sock (high privilege).
EOF
}

log() { printf '[watchtower] %s\n' "$*"; }
warn() { printf '[watchtower][warn] %s\n' "$*" >&2; }
die() { printf '[watchtower][error] %s\n' "$*" >&2; exit 1; }

repo_dir="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-dir) repo_dir="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) die "Unknown option: $1 (run --help for usage)" ;;
  esac
done

[[ -d "$repo_dir" ]] || die "Repository path does not exist: $repo_dir"
env_file="$repo_dir/.env"
[[ -f "$env_file" ]] || die "Missing $env_file"

command -v docker >/dev/null 2>&1 || die "Missing required command: docker"
docker info >/dev/null 2>&1 || die "Docker daemon is not running. Check: docker info"

get_kv() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  [[ -n "$line" ]] && printf '%s' "${line#*=}" || printf ''
}

api_name="$(get_kv CONTEXT8_API_NAME)"
frontend_name="$(get_kv CONTEXT8_FRONTEND_NAME)"
embedding_name="$(get_kv CONTEXT8_EMBEDDING_NAME)"
knn_weight="$(get_kv ES_KNN_WEIGHT)"

api_name="${api_name:-context8-api}"
frontend_name="${frontend_name:-context8-frontend}"
embedding_name="${embedding_name:-context8-embedding}"

targets=("$api_name" "$frontend_name")
if [[ -n "$knn_weight" && "$knn_weight" != "0" ]]; then
  targets+=("$embedding_name")
fi

available_targets=()
for target in "${targets[@]}"; do
  if docker ps --format '{{.Names}}' | grep -Fxq "$target"; then
    available_targets+=("$target")
  else
    warn "Container is not running and will be skipped: $target"
  fi
done

if [[ "${#available_targets[@]}" -eq 0 ]]; then
  die "No running Context8 containers found for one-shot update"
fi

warn "Watchtower uses Docker socket access. Run only on trusted hosts."
log "Running one-shot Watchtower update for: ${available_targets[*]}"

docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower:latest \
  --run-once \
  --cleanup \
  "${available_targets[@]}"

log "Watchtower one-shot run completed"
