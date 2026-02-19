#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/update_context8_docker.sh [options]

Options:
  --repo-dir <path>     Context8 Docker repo root (default: current directory)
  --profile <name>      Compose profile override (e.g. semantic)
  --api-base <url>      Health check API base (default: API_BASE env > .env VITE_API_BASE > http://localhost:${API_PORT:-8000})
  --timeout <seconds>   Health check timeout (default: 180)
  --help                Show this help

Environment:
  API_BASE              Optional override for health check base URL
EOF
}

log() { printf '[update] %s\n' "$*"; }
die() { printf '[update][error] %s\n' "$*" >&2; exit 1; }

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "Missing required command: $command_name"
}

repo_dir="."
compose_profile=""
api_base="${API_BASE:-}"
timeout_sec=180

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-dir) repo_dir="${2:-}"; shift 2 ;;
    --profile) compose_profile="${2:-}"; shift 2 ;;
    --api-base) api_base="${2:-}"; shift 2 ;;
    --timeout) timeout_sec="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) die "Unknown option: $1 (run --help for usage)" ;;
  esac
done

[[ -d "$repo_dir" ]] || die "Repository path does not exist: $repo_dir"
env_file="$repo_dir/.env"
[[ -f "$env_file" ]] || die "Missing $env_file"
[[ "$timeout_sec" =~ ^[0-9]+$ ]] || die "Invalid --timeout: $timeout_sec"

get_kv() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  [[ -n "$line" ]] && printf '%s' "${line#*=}" || printf ''
}

if [[ -z "$compose_profile" ]]; then
  current_knn_weight="$(get_kv ES_KNN_WEIGHT)"
  if [[ -n "$current_knn_weight" && "$current_knn_weight" != "0" ]]; then
    compose_profile="semantic"
  fi
fi

if [[ -z "$api_base" ]]; then
  api_base="$(get_kv VITE_API_BASE)"
fi
if [[ -z "$api_base" ]]; then
  api_port="$(get_kv API_PORT)"
  [[ "$api_port" =~ ^[0-9]+$ ]] || api_port="8000"
  api_base="http://localhost:${api_port}"
fi

require_command docker
require_command curl
docker info >/dev/null 2>&1 || die "Docker daemon is not running. Check: docker info"
docker compose version >/dev/null 2>&1 || die "docker compose is not available"

compose_cmd=(docker compose)
if [[ -n "$compose_profile" ]]; then
  compose_cmd+=(--profile "$compose_profile")
fi

log "Updating containers from registry"
if [[ -n "$compose_profile" ]]; then
  log "Using compose profile: $compose_profile"
fi

pushd "$repo_dir" >/dev/null
"${compose_cmd[@]}" pull
"${compose_cmd[@]}" up -d --force-recreate --remove-orphans
popd >/dev/null

log "Waiting for health endpoint: $api_base/status/summary"
elapsed=0
until curl -fsS "$api_base/status/summary" >/dev/null 2>&1; do
  sleep 2
  elapsed=$((elapsed + 2))
  if (( elapsed >= timeout_sec )); then
    die "Timed out waiting for $api_base/status/summary after ${timeout_sec}s"
  fi
done

printf '\n'
log "Container status"
pushd "$repo_dir" >/dev/null
"${compose_cmd[@]}" ps

container_ids=()
while IFS= read -r line; do
  if [[ -n "$line" ]]; then
    container_ids+=("$line")
  fi
done < <("${compose_cmd[@]}" ps -q)
popd >/dev/null

printf '\n'
log "Image summary"
if [[ "${#container_ids[@]}" -eq 0 ]]; then
  printf '  <no running containers>\n'
else
  for container_id in "${container_ids[@]}"; do
    container_name="$(docker inspect --format '{{.Name}}' "$container_id" | sed 's#^/##')"
    image_ref="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
    image_id="$(docker inspect --format '{{.Image}}' "$container_id")"
    image_short="${image_id#sha256:}"
    image_short="${image_short:0:12}"
    digest="$(docker image inspect --format '{{if .RepoDigests}}{{index .RepoDigests 0}}{{else}}<none>{{end}}' "$image_id" 2>/dev/null || printf '<unknown>')"
    printf '  %s\n' "$container_name"
    printf '    image=%s\n' "$image_ref"
    printf '    digest=%s\n' "$digest"
    printf '    image_id=%s\n' "$image_short"
  done
fi

printf '\n'
log "Update completed"
