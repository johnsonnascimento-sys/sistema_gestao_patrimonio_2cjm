#!/usr/bin/env bash
# Modulo: scripts
# Arquivo: scripts/check_supabase_health.sh
# Funcao no sistema: verificar a conectividade do banco Supabase com um SELECT 1.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cjm-patrimonio/current}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
LOG_FILE="${LOG_FILE:-}"
DOCKER_IMAGE="${DOCKER_IMAGE:-postgres:16-alpine}"
PGSSLMODE="${PGSSLMODE:-require}"
PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-20}"

usage() {
  cat <<'EOF'
Uso:
  ENV_FILE=/opt/cjm-patrimonio/current/.env ./scripts/check_supabase_health.sh

Variaveis reconhecidas:
  APP_DIR             Diretorio base do deploy na VPS (padrao: /opt/cjm-patrimonio/current)
  ENV_FILE            Arquivo .env com DATABASE_URL
  LOG_FILE            Arquivo opcional para append do resultado
  DOCKER_IMAGE        Imagem fallback para executar psql (padrao: postgres:16-alpine)
  PGSSLMODE           Modo SSL do Postgres (padrao: require)
  PGCONNECT_TIMEOUT   Timeout de conexao em segundos (padrao: 20)
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

load_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
  fi
}

append_log() {
  if [[ -n "$LOG_FILE" ]]; then
    mkdir -p "$(dirname "$LOG_FILE")"
    printf '%s\n' "$1" >>"$LOG_FILE"
  fi
}

run_psql() {
  local sql_text="$1"

  if command -v psql >/dev/null 2>&1; then
    PGSSLMODE="$PGSSLMODE" PGCONNECT_TIMEOUT="$PGCONNECT_TIMEOUT" \
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -tA -c "$sql_text"
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    local sql_file
    sql_file="$(mktemp)"
    trap 'rm -f "$sql_file"' RETURN
    printf '%s\n' "$sql_text" >"$sql_file"
    docker run --rm --network host \
      -e DATABASE_URL="$DATABASE_URL" \
      -e PGSSLMODE="$PGSSLMODE" \
      -e PGCONNECT_TIMEOUT="$PGCONNECT_TIMEOUT" \
      -v "$sql_file:/tmp/check_supabase_health.sql:ro" \
      "$DOCKER_IMAGE" \
      sh -lc 'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -tA -f /tmp/check_supabase_health.sql >/dev/null'
    return 0
  fi

  echo "ERRO: nem psql nem docker estao disponiveis." >&2
  return 127
}

load_env_file

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERRO: DATABASE_URL nao definido em $ENV_FILE ou no ambiente." >&2
  exit 2
fi

started_at="$(date +%s)"
sql_text="SELECT 1;"

if output="$(run_psql "$sql_text" 2>&1)"; then
  finished_at="$(date +%s)"
  elapsed_seconds="$((finished_at - started_at))"
  result="$(printf '{"status":"ok","elapsed_seconds":%s}\n' "$elapsed_seconds")"
  printf '%s\n' "$result"
  append_log "$result"
  exit 0
fi

error_payload='{"status":"fail"}'

printf '%s\n' "$error_payload" >&2
append_log "$error_payload"
exit 1
