#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./scripts/configure_context8_docker.sh [options]

Modes:
  default: interactive prompts
  --non-interactive: fully flag-driven / deterministic

Options:
  --repo-dir <path>                 Context8 Docker repo root (default: current directory)
  --non-interactive                 Disable prompts
  --force                           Overwrite existing non-placeholder values

Base config:
  --api-base <url>                  Sets VITE_API_BASE
  --postgres-password <value>       Sets POSTGRES_PASSWORD
  --jwt-secret <value>              Sets JWT_SECRET
  --api-key-secret <value>          Sets API_KEY_SECRET
  --admin-reset-token <value>       Sets ADMIN_RESET_TOKEN (pass empty string to clear)

Search config:
  --enable-semantic <true|false>    Controls ES_KNN_WEIGHT behavior
  --es-knn-weight <number>          Sets ES_KNN_WEIGHT when semantic is enabled
  --es-bm25-weight <number>         Sets ES_BM25_WEIGHT

Federation config:
  --enable-federation <true|false>  Enables/disables remote search settings
  --remote-base <url>               Sets REMOTE_CONTEXT8_BASE
  --remote-api-key <value>          Sets REMOTE_CONTEXT8_API_KEY
  --remote-allow-override <true|false>
                                     Sets REMOTE_CONTEXT8_ALLOW_OVERRIDE
  --remote-allowed-hosts <csv>      Sets REMOTE_CONTEXT8_ALLOWED_HOSTS
  --remote-timeout <sec>            Sets REMOTE_CONTEXT8_TIMEOUT

Runtime:
  --up                              Run docker compose up -d --build
  --smoke                           Run health + API/MCP smoke checks
  --install-mcp                     Require npm and install context8-mcp after --up
  --skip-install-mcp                Skip auto-install context8-mcp during --up
  --profile <name>                  Compose profile (e.g. semantic)
  --help                            Show this help

Environment:
  API_KEY                           Optional API key used by --smoke and context8-mcp remote-config
EOF
}

log() { printf '[configure] %s\n' "$*"; }
warn() { printf '[configure][warn] %s\n' "$*" >&2; }
die() { printf '[configure][error] %s\n' "$*" >&2; exit 1; }

to_lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

normalize_bool() {
  local value
  value="$(to_lower "$1")"
  case "$value" in
    true|1|yes|y|on) printf 'true' ;;
    false|0|no|n|off) printf 'false' ;;
    *) die "Invalid boolean value: $1 (expected true|false)" ;;
  esac
}

is_placeholder() {
  local value lowered
  value="${1:-}"
  lowered="$(to_lower "$value")"
  [[ -z "$value" ]] && return 0
  [[ "$lowered" == "change_me" ]] && return 0
  [[ "$lowered" == "changeme" ]] && return 0
  [[ "$lowered" == "replace_me" ]] && return 0
  [[ "$lowered" == "replace-this" ]] && return 0
  [[ "$lowered" == "default" ]] && return 0
  [[ "$lowered" == change-this* ]] && return 0
  return 1
}

masked_state() {
  if [[ -n "${1:-}" ]]; then
    printf '<set>'
  else
    printf '<empty>'
  fi
}

gen_hex() {
  local bytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$bytes"
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$bytes" <<'PY'
import secrets, sys
print(secrets.token_hex(int(sys.argv[1])))
PY
    return 0
  fi
  return 1
}

prompt_text() {
  local label="$1" default_value="$2"
  local answer
  if [[ -n "$default_value" ]]; then
    read -r -p "$label [$default_value]: " answer
    printf '%s' "${answer:-$default_value}"
  else
    read -r -p "$label: " answer
    printf '%s' "$answer"
  fi
}

prompt_bool() {
  local label="$1" default_bool="$2" answer lowered
  if [[ "$default_bool" == "true" ]]; then
    read -r -p "$label [Y/n]: " answer
    lowered="$(to_lower "${answer:-y}")"
  else
    read -r -p "$label [y/N]: " answer
    lowered="$(to_lower "${answer:-n}")"
  fi
  case "$lowered" in
    y|yes) printf 'true' ;;
    n|no) printf 'false' ;;
    *) die "Invalid choice '$answer' for $label" ;;
  esac
}

sed_inplace() {
  if sed --version >/dev/null 2>&1; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

get_kv() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$env_file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    printf ''
    return 0
  fi
  printf '%s' "${line#*=}"
}

set_kv() {
  local key="$1" value="$2" escaped
  escaped="$(printf '%s' "$value" | sed 's/[\\/&]/\\&/g')"
  if grep -qE "^${key}=" "$env_file"; then
    sed_inplace "s|^${key}=.*|${key}=${escaped}|" "$env_file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$env_file"
  fi
}

require_command() {
  local command_name="$1"
  command -v "$command_name" >/dev/null 2>&1 || die "Missing required command: $command_name"
}

wait_for_status_summary() {
  local base_url="$1" timeout_sec="${2:-180}" elapsed=0
  while ! curl -fsS "$base_url/status/summary" >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if (( elapsed >= timeout_sec )); then
      die "Timed out waiting for $base_url/status/summary after ${timeout_sec}s"
    fi
  done
}

wait_for_local_search() {
  local base_url="$1" api_key="$2" timeout_sec="${3:-60}" elapsed=0
  while ! curl -fsS -X POST "$base_url/search" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $api_key" \
    -d '{"query":"test","limit":1,"offset":0,"source":"local"}' >/dev/null 2>&1; do
    sleep 2
    elapsed=$((elapsed + 2))
    if (( elapsed >= timeout_sec )); then
      return 1
    fi
  done
}

install_context8_mcp() {
  local mcp_remote_url="$1"
  local install_mode="$2"
  local remote_api_key="${API_KEY:-}"

  if [[ "$install_mode" == "false" ]]; then
    log "Skipped context8-mcp installation (--skip-install-mcp)"
    return 0
  fi

  if ! command -v npm >/dev/null 2>&1; then
    if [[ "$install_mode" == "true" ]]; then
      die "npm is required for --install-mcp but was not found"
    fi
    warn "npm was not found; skipped context8-mcp auto-install"
    return 0
  fi

  log "Installing context8-mcp via npm"
  if ! npm install -g context8-mcp --silent >/dev/null 2>&1; then
    if [[ "$install_mode" == "true" ]]; then
      die "Failed to install context8-mcp with npm"
    fi
    warn "context8-mcp auto-install failed; run manually: npm install -g context8-mcp"
    return 0
  fi

  if ! command -v context8-mcp >/dev/null 2>&1; then
    warn "context8-mcp installed but not found on PATH; check npm global bin"
    return 0
  fi

  log "context8-mcp installed"
  if [[ -n "$remote_api_key" ]]; then
    log "Applying context8-mcp remote-config to local Docker API: $mcp_remote_url"
    if context8-mcp remote-config --remote-url "$mcp_remote_url" --api-key "$remote_api_key" >/dev/null 2>&1; then
      log "context8-mcp remote-config applied"
    else
      warn "context8-mcp remote-config failed; run manually after startup"
    fi
  else
    warn "API_KEY is empty; skipped context8-mcp remote-config"
  fi
}

run_smoke_checks() {
  local base_url="$1"
  local smoke_api_key="${API_KEY:-}"
  local failed=0

  log "Running smoke checks against $base_url"
  curl -fsS "$base_url/status/summary" >/dev/null || failed=1
  curl -fsS "$base_url/status" >/dev/null || failed=1

  if (( failed != 0 )); then
    die "Smoke failed on base health endpoints"
  fi

  if [[ -n "$smoke_api_key" ]]; then
    if ! wait_for_local_search "$base_url" "$smoke_api_key" 60; then
      die "Smoke failed: /search did not become ready within 60s"
    fi
    curl -fsS "$base_url/mcp/solutions?limit=1&offset=0" -H "X-API-Key: $smoke_api_key" >/dev/null
    curl -fsS "$base_url/solutions?limit=1&offset=0" -H "X-API-Key: $smoke_api_key" >/dev/null
    curl -fsS "$base_url/v2/solutions?limit=1&offset=0" -H "X-API-Key: $smoke_api_key" >/dev/null

    if [[ "$enable_federation_final" == "true" ]]; then
      if ! curl -fsS -X POST "$base_url/search" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $smoke_api_key" \
        -d '{"query":"test","limit":1,"offset":0,"source":"remote"}' >/dev/null; then
        warn "Federation smoke failed (remote unreachable or unauthorized); local deployment is still valid"
      fi
    fi
  else
    warn "API_KEY is not set; skipped auth-required smoke checks"
  fi

  log "Smoke checks passed"
}

repo_dir="."
non_interactive="false"
force="false"
run_up="false"
run_smoke="false"
profile=""
install_mcp="auto"

api_base=""
postgres_password=""
jwt_secret=""
api_key_secret=""
admin_reset_token=""
admin_reset_token_set="false"

enable_semantic=""
es_knn_weight=""
es_bm25_weight=""

enable_federation=""
remote_base=""
remote_api_key=""
remote_allow_override=""
remote_allowed_hosts=""
remote_timeout=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-dir) repo_dir="${2:-}"; shift 2 ;;
    --non-interactive) non_interactive="true"; shift ;;
    --force) force="true"; shift ;;
    --api-base) api_base="${2:-}"; shift 2 ;;
    --postgres-password) postgres_password="${2:-}"; shift 2 ;;
    --jwt-secret) jwt_secret="${2:-}"; shift 2 ;;
    --api-key-secret) api_key_secret="${2:-}"; shift 2 ;;
    --admin-reset-token) admin_reset_token="${2-}"; admin_reset_token_set="true"; shift 2 ;;
    --enable-semantic) enable_semantic="$(normalize_bool "${2:-}")"; shift 2 ;;
    --es-knn-weight) es_knn_weight="${2:-}"; shift 2 ;;
    --es-bm25-weight) es_bm25_weight="${2:-}"; shift 2 ;;
    --enable-federation) enable_federation="$(normalize_bool "${2:-}")"; shift 2 ;;
    --remote-base) remote_base="${2:-}"; shift 2 ;;
    --remote-api-key) remote_api_key="${2:-}"; shift 2 ;;
    --remote-allow-override) remote_allow_override="$(normalize_bool "${2:-}")"; shift 2 ;;
    --remote-allowed-hosts) remote_allowed_hosts="${2:-}"; shift 2 ;;
    --remote-timeout) remote_timeout="${2:-}"; shift 2 ;;
    --up) run_up="true"; shift ;;
    --smoke) run_smoke="true"; shift ;;
    --install-mcp) install_mcp="true"; shift ;;
    --skip-install-mcp) install_mcp="false"; shift ;;
    --profile) profile="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) die "Unknown option: $1 (run --help for usage)" ;;
  esac
done

[[ -d "$repo_dir" ]] || die "Repository path does not exist: $repo_dir"
env_example="$repo_dir/.env.example"
env_file="$repo_dir/.env"

[[ -f "$env_example" ]] || die "Missing $env_example (run from context8-docker root or pass --repo-dir)"
if [[ ! -f "$env_file" ]]; then
  cp "$env_example" "$env_file"
  log "Created $env_file from .env.example"
fi

current_api_base="$(get_kv VITE_API_BASE)"
current_postgres_password="$(get_kv POSTGRES_PASSWORD)"
current_jwt_secret="$(get_kv JWT_SECRET)"
current_api_key_secret="$(get_kv API_KEY_SECRET)"
current_admin_reset_token="$(get_kv ADMIN_RESET_TOKEN)"
current_knn_weight="$(get_kv ES_KNN_WEIGHT)"
current_bm25_weight="$(get_kv ES_BM25_WEIGHT)"
current_remote_base="$(get_kv REMOTE_CONTEXT8_BASE)"
current_remote_api_key="$(get_kv REMOTE_CONTEXT8_API_KEY)"
current_remote_allow_override="$(get_kv REMOTE_CONTEXT8_ALLOW_OVERRIDE)"
current_remote_allowed_hosts="$(get_kv REMOTE_CONTEXT8_ALLOWED_HOSTS)"
current_remote_timeout="$(get_kv REMOTE_CONTEXT8_TIMEOUT)"
current_postgres_bind="$(get_kv POSTGRES_BIND)"
current_es_bind="$(get_kv ES_BIND)"
current_api_port="$(get_kv API_PORT)"

if [[ "$non_interactive" == "true" ]]; then
  if [[ -z "$api_base" ]]; then
    if [[ "$force" == "false" && -n "$current_api_base" ]]; then
      api_base="$current_api_base"
    else
      api_base="http://localhost:8000"
    fi
  fi
else
  api_base="$(prompt_text "VITE_API_BASE" "${api_base:-${current_api_base:-http://localhost:8000}}")"
fi

resolve_secret_value() {
  local provided="$1" current="$2" bytes="$3" key_name="$4" value
  if [[ -n "$provided" ]]; then
    printf '%s' "$provided"
    return 0
  fi
  if [[ "$force" == "false" ]] && ! is_placeholder "$current"; then
    printf '%s' "$current"
    return 0
  fi
  value="$(gen_hex "$bytes" || true)"
  [[ -n "$value" ]] || die "Unable to generate $key_name (need openssl or python3)"
  printf '%s' "$value"
}

postgres_password_final="$(resolve_secret_value "$postgres_password" "$current_postgres_password" 24 "POSTGRES_PASSWORD")"
jwt_secret_final="$(resolve_secret_value "$jwt_secret" "$current_jwt_secret" 32 "JWT_SECRET")"
api_key_secret_final="$(resolve_secret_value "$api_key_secret" "$current_api_key_secret" 32 "API_KEY_SECRET")"

if [[ "$admin_reset_token_set" == "true" ]]; then
  admin_reset_token_final="$admin_reset_token"
elif [[ "$non_interactive" == "true" ]]; then
  admin_reset_token_final="$current_admin_reset_token"
else
  admin_reset_token_final="$(prompt_text "ADMIN_RESET_TOKEN (optional)" "$current_admin_reset_token")"
fi

if [[ -z "$enable_semantic" ]]; then
  if [[ "$non_interactive" == "true" ]]; then
    if [[ -n "$current_knn_weight" && "$current_knn_weight" != "0" ]]; then
      enable_semantic="true"
    else
      enable_semantic="false"
    fi
  else
    default_semantic="false"
    if [[ -n "$current_knn_weight" && "$current_knn_weight" != "0" ]]; then
      default_semantic="true"
    fi
    enable_semantic="$(prompt_bool "Enable semantic search (ES kNN + embedding)" "$default_semantic")"
  fi
fi

if [[ "$enable_semantic" == "true" ]]; then
  if [[ -z "$es_knn_weight" ]]; then
    if [[ "$force" == "false" && -n "$current_knn_weight" && "$current_knn_weight" != "0" ]]; then
      es_knn_weight="$current_knn_weight"
    elif [[ "$non_interactive" == "true" ]]; then
      es_knn_weight="1"
    else
      es_knn_weight="$(prompt_text "ES_KNN_WEIGHT" "${current_knn_weight:-1}")"
    fi
  fi
else
  es_knn_weight="0"
fi

if [[ -z "$es_bm25_weight" ]]; then
  if [[ "$force" == "false" && -n "$current_bm25_weight" ]]; then
    es_bm25_weight="$current_bm25_weight"
  elif [[ "$non_interactive" == "true" ]]; then
    es_bm25_weight="1"
  else
    es_bm25_weight="$(prompt_text "ES_BM25_WEIGHT" "${current_bm25_weight:-1}")"
  fi
fi

if [[ -z "$enable_federation" ]]; then
  if [[ "$non_interactive" == "true" ]]; then
    if [[ -n "$current_remote_base" && -n "$current_remote_api_key" ]]; then
      enable_federation="true"
    else
      enable_federation="false"
    fi
  else
    default_federation="false"
    if [[ -n "$current_remote_base" && -n "$current_remote_api_key" ]]; then
      default_federation="true"
    fi
    enable_federation="$(prompt_bool "Enable federated search (REMOTE_CONTEXT8_*)" "$default_federation")"
  fi
fi

if [[ "$enable_federation" == "true" ]]; then
  if [[ -z "$remote_base" ]]; then
    if [[ "$force" == "false" && -n "$current_remote_base" ]]; then
      remote_base="$current_remote_base"
    elif [[ "$non_interactive" == "true" ]]; then
      die "Federation enabled but --remote-base is missing"
    else
      remote_base="$(prompt_text "REMOTE_CONTEXT8_BASE" "$current_remote_base")"
    fi
  fi
  [[ -n "$remote_base" ]] || die "REMOTE_CONTEXT8_BASE is required when federation is enabled"

  if [[ -z "$remote_api_key" ]]; then
    if [[ "$force" == "false" && -n "$current_remote_api_key" ]]; then
      remote_api_key="$current_remote_api_key"
    elif [[ "$non_interactive" == "true" ]]; then
      die "Federation enabled but --remote-api-key is missing"
    else
      remote_api_key="$(prompt_text "REMOTE_CONTEXT8_API_KEY" "$current_remote_api_key")"
    fi
  fi
  [[ -n "$remote_api_key" ]] || die "REMOTE_CONTEXT8_API_KEY is required when federation is enabled"

  if [[ -z "$remote_allow_override" ]]; then
    if [[ "$force" == "false" && -n "$current_remote_allow_override" ]]; then
      remote_allow_override="$(normalize_bool "$current_remote_allow_override")"
    elif [[ "$non_interactive" == "true" ]]; then
      remote_allow_override="false"
    else
      remote_allow_override="$(prompt_bool "REMOTE_CONTEXT8_ALLOW_OVERRIDE" "false")"
    fi
  fi

  if [[ -z "$remote_allowed_hosts" ]]; then
    if [[ "$force" == "false" ]]; then
      remote_allowed_hosts="$current_remote_allowed_hosts"
    elif [[ "$non_interactive" == "true" ]]; then
      remote_allowed_hosts=""
    else
      remote_allowed_hosts="$(prompt_text "REMOTE_CONTEXT8_ALLOWED_HOSTS (csv, optional)" "$current_remote_allowed_hosts")"
    fi
  fi

  if [[ -z "$remote_timeout" ]]; then
    if [[ "$force" == "false" && -n "$current_remote_timeout" ]]; then
      remote_timeout="$current_remote_timeout"
    elif [[ "$non_interactive" == "true" ]]; then
      remote_timeout="6"
    else
      remote_timeout="$(prompt_text "REMOTE_CONTEXT8_TIMEOUT (sec)" "${current_remote_timeout:-6}")"
    fi
  fi
else
  remote_base=""
  remote_api_key=""
  remote_allow_override="false"
  remote_allowed_hosts=""
  remote_timeout="${remote_timeout:-${current_remote_timeout:-6}}"
fi

if [[ -z "$current_postgres_bind" || "$force" == "true" ]]; then
  set_kv POSTGRES_BIND "127.0.0.1"
fi
if [[ -z "$current_es_bind" || "$force" == "true" ]]; then
  set_kv ES_BIND "127.0.0.1"
fi

set_kv VITE_API_BASE "$api_base"
set_kv POSTGRES_PASSWORD "$postgres_password_final"
set_kv JWT_SECRET "$jwt_secret_final"
set_kv API_KEY_SECRET "$api_key_secret_final"
set_kv ADMIN_RESET_TOKEN "$admin_reset_token_final"
set_kv ES_KNN_WEIGHT "$es_knn_weight"
set_kv ES_BM25_WEIGHT "$es_bm25_weight"
set_kv REMOTE_CONTEXT8_BASE "$remote_base"
set_kv REMOTE_CONTEXT8_API_KEY "$remote_api_key"
set_kv REMOTE_CONTEXT8_ALLOW_OVERRIDE "$remote_allow_override"
set_kv REMOTE_CONTEXT8_ALLOWED_HOSTS "$remote_allowed_hosts"
set_kv REMOTE_CONTEXT8_TIMEOUT "$remote_timeout"

enable_federation_final="$enable_federation"
mcp_remote_port="${current_api_port:-8000}"
if [[ ! "$mcp_remote_port" =~ ^[0-9]+$ ]]; then
  warn "Invalid API_PORT '$mcp_remote_port'; fallback to 8000 for context8-mcp remote-config"
  mcp_remote_port="8000"
fi
mcp_remote_url="http://localhost:${mcp_remote_port}"

if [[ "$run_up" == "true" || "$run_smoke" == "true" ]]; then
  require_command curl
fi

if [[ "$run_up" == "true" ]]; then
  require_command docker
  require_command git
  docker info >/dev/null 2>&1 || die "Docker daemon is not running. Check: docker info"
  docker compose version >/dev/null 2>&1 || die "docker compose is not available"

  compose_profile="$profile"
  if [[ "$enable_semantic" == "true" && -z "$compose_profile" ]]; then
    compose_profile="semantic"
    log "Semantic is enabled; using compose profile: semantic"
  fi

  pushd "$repo_dir" >/dev/null
  if [[ -n "$compose_profile" ]]; then
    docker compose --profile "$compose_profile" up -d --build
  else
    docker compose up -d --build
  fi
  popd >/dev/null

  wait_for_status_summary "$api_base" 180
  install_context8_mcp "$mcp_remote_url" "$install_mcp"
fi

if [[ "$run_smoke" == "true" ]]; then
  wait_for_status_summary "$api_base" 180
  run_smoke_checks "$api_base"
fi

printf '\n'
log "Effective config summary (sanitized)"
printf '  repo_dir=%s\n' "$repo_dir"
printf '  env_file=%s\n' "$env_file"
printf '  VITE_API_BASE=%s\n' "$api_base"
printf '  MCP_REMOTE_URL=%s\n' "$mcp_remote_url"
printf '  POSTGRES_PASSWORD=%s\n' "$(masked_state "$postgres_password_final")"
printf '  JWT_SECRET=%s\n' "$(masked_state "$jwt_secret_final")"
printf '  API_KEY_SECRET=%s\n' "$(masked_state "$api_key_secret_final")"
printf '  ADMIN_RESET_TOKEN=%s\n' "$(masked_state "$admin_reset_token_final")"
printf '  semantic_enabled=%s\n' "$enable_semantic"
printf '  ES_KNN_WEIGHT=%s\n' "$es_knn_weight"
printf '  ES_BM25_WEIGHT=%s\n' "$es_bm25_weight"
printf '  federation_enabled=%s\n' "$enable_federation_final"
printf '  REMOTE_CONTEXT8_BASE=%s\n' "${remote_base:-<empty>}"
printf '  REMOTE_CONTEXT8_API_KEY=%s\n' "$(masked_state "$remote_api_key")"
printf '  REMOTE_CONTEXT8_ALLOW_OVERRIDE=%s\n' "$remote_allow_override"
printf '  REMOTE_CONTEXT8_ALLOWED_HOSTS=%s\n' "${remote_allowed_hosts:-<empty>}"
printf '  REMOTE_CONTEXT8_TIMEOUT=%s\n' "$remote_timeout"
printf '  install_context8_mcp=%s\n' "$install_mcp"

printf '\n'
log "Next commands"
if [[ "$run_up" == "false" ]]; then
  if [[ "$enable_semantic" == "true" ]]; then
    printf '  cd %s && docker compose --profile semantic up -d --build\n' "$repo_dir"
  else
    printf '  cd %s && docker compose up -d --build\n' "$repo_dir"
  fi
fi
if [[ "$run_smoke" == "false" ]]; then
  printf '  API_BASE="%s" API_KEY="<api_key_optional>" %s --smoke\n' "$api_base" "$0"
fi
log "Done"
