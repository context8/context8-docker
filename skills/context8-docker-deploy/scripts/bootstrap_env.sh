#!/usr/bin/env bash
set -euo pipefail

repo_dir="${1:-.}"
env_example="$repo_dir/.env.example"
env_file="$repo_dir/.env"

if [[ ! -f "$env_example" ]]; then
  echo "Missing $env_example (run this from the context8-docker repo root, or pass the repo path as arg1)" >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  cp "$env_example" "$env_file"
fi

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
    echo ""
    return 0
  fi
  echo "${line#*=}"
}

is_placeholder() {
  local v="${1,,}"
  [[ -z "$v" ]] && return 0
  [[ "$v" == "change_me" ]] && return 0
  [[ "$v" == "changeme" ]] && return 0
  [[ "$v" == "replace_me" ]] && return 0
  [[ "$v" == "replace-this" ]] && return 0
  [[ "$v" == "default" ]] && return 0
  [[ "$v" == change-this* ]] && return 0
  return 1
}

gen_hex() {
  local nbytes="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$nbytes"
    return 0
  fi
  python3 - "$nbytes" <<'PY'
import secrets, sys
n = int(sys.argv[1])
print(secrets.token_hex(n))
PY
}

set_kv() {
  local key="$1"
  local value="$2"
  local escaped
  escaped="$(printf '%s' "$value" | sed 's/[\\/&]/\\&/g')"
  if grep -qE "^${key}=" "$env_file"; then
    sed_inplace "s|^${key}=.*|${key}=${escaped}|" "$env_file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$env_file"
  fi
}

updated_keys=()

current_postgres_password="$(get_kv POSTGRES_PASSWORD)"
if is_placeholder "$current_postgres_password"; then
  set_kv POSTGRES_PASSWORD "$(gen_hex 24)"
  updated_keys+=(POSTGRES_PASSWORD)
fi

current_jwt_secret="$(get_kv JWT_SECRET)"
if is_placeholder "$current_jwt_secret"; then
  set_kv JWT_SECRET "$(gen_hex 32)"
  updated_keys+=(JWT_SECRET)
fi

current_api_key_secret="$(get_kv API_KEY_SECRET)"
if is_placeholder "$current_api_key_secret"; then
  set_kv API_KEY_SECRET "$(gen_hex 32)"
  updated_keys+=(API_KEY_SECRET)
fi

if [[ -z "$(get_kv VITE_API_BASE)" ]]; then
  set_kv VITE_API_BASE "http://localhost:8000"
  updated_keys+=(VITE_API_BASE)
fi

if [[ "${#updated_keys[@]}" -eq 0 ]]; then
  echo "No changes: $env_file already has non-placeholder secrets"
else
  echo "Updated $env_file: set ${updated_keys[*]} (values not printed)"
fi

