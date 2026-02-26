#!/usr/bin/env bash
# Modulo: scripts
# Arquivo: scripts/backup_to_drive.sh
# Funcao no sistema: gerar backup do banco e/ou das imagens e enviar para Google Drive (rclone), com retencao.
#
# Uso rapido:
#   ./scripts/backup_to_drive.sh --scope all --tag manual
#
# Requisitos:
# - rclone configurado (remote padrao: cjm_gdrive:)
# - DATABASE_URL disponivel em /opt/cjm-patrimonio/current/.env (ou --env-file)
# - Docker instalado (usa imagem postgres para pg_dump)

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/cjm-patrimonio/current}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/cjm-patrimonio/backups}"
RCLONE_REMOTE_BASE="${RCLONE_REMOTE_BASE:-cjm_gdrive:db-backups}"
MEDIA_SOURCE="${MEDIA_SOURCE:-/opt/cjm-patrimonio/shared/data/fotos}"
KEEP_DAYS="${KEEP_DAYS:-14}"
SCOPE="all"
TAG="manual"
DRY_RUN=0

usage() {
  cat <<'EOF'
Uso:
  ./scripts/backup_to_drive.sh [opcoes]

Opcoes:
  --scope <db|media|all>      Escopo do backup (padrao: all)
  --tag <texto>               Sufixo do nome do arquivo (padrao: manual)
  --keep-days <N>             Retencao local/remota em dias (padrao: 14)
  --project-dir <dir>         Diretorio do projeto (padrao: /opt/cjm-patrimonio/current)
  --env-file <arquivo>        Arquivo .env com DATABASE_URL
  --backup-root <dir>         Raiz de backups locais (padrao: /opt/cjm-patrimonio/backups)
  --remote-base <remote:path> Base remota no rclone (padrao: cjm_gdrive:db-backups)
  --media-source <dir>        Origem das imagens (padrao: /opt/cjm-patrimonio/shared/data/fotos)
  --dry-run                   Apenas imprime comandos
  -h, --help                  Ajuda
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope) SCOPE="${2:-}"; shift 2 ;;
    --tag) TAG="${2:-}"; shift 2 ;;
    --keep-days) KEEP_DAYS="${2:-}"; shift 2 ;;
    --project-dir) PROJECT_DIR="${2:-}"; shift 2 ;;
    --env-file) ENV_FILE="${2:-}"; shift 2 ;;
    --backup-root) BACKUP_ROOT="${2:-}"; shift 2 ;;
    --remote-base) RCLONE_REMOTE_BASE="${2:-}"; shift 2 ;;
    --media-source) MEDIA_SOURCE="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERRO: argumento invalido: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ "$SCOPE" != "db" && "$SCOPE" != "media" && "$SCOPE" != "all" ]]; then
  echo "ERRO: --scope deve ser db, media ou all." >&2
  exit 2
fi

if ! [[ "$KEEP_DAYS" =~ ^[0-9]+$ ]]; then
  echo "ERRO: --keep-days deve ser inteiro >= 0." >&2
  exit 2
fi

DB_LOCAL_DIR="$BACKUP_ROOT/db"
MEDIA_LOCAL_DIR="$BACKUP_ROOT/media"
REMOTE_DB_DIR="$RCLONE_REMOTE_BASE/database"
REMOTE_MEDIA_DIR="$RCLONE_REMOTE_BASE/media"
TS_UTC="$(date -u +%Y%m%dT%H%M%SZ)"

run_cmd() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] $*"
    return 0
  fi
  "$@"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERRO: comando obrigatorio nao encontrado: $cmd" >&2
    exit 1
  fi
}

require_cmd rclone
require_cmd docker
require_cmd gzip
require_cmd tar

mkdir -p "$DB_LOCAL_DIR" "$MEDIA_LOCAL_DIR"

dump_db() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERRO: arquivo .env nao encontrado: $ENV_FILE" >&2
    exit 1
  fi

  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "ERRO: DATABASE_URL nao definido em $ENV_FILE" >&2
    exit 1
  fi

  local file_name="db_${TS_UTC}_${TAG}.sql.gz"
  local local_file="$DB_LOCAL_DIR/$file_name"

  echo "[backup] banco -> $local_file"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] docker run --rm --network host -e DATABASE_URL=<redacted> postgres:16-alpine sh -lc 'pg_dump \"\$DATABASE_URL\" --no-owner --no-privileges --format=plain' | gzip -9 > \"$local_file\""
  else
    docker run --rm --network host -e DATABASE_URL="$DATABASE_URL" postgres:16-alpine \
      sh -lc 'pg_dump "$DATABASE_URL" --no-owner --no-privileges --format=plain' \
      | gzip -9 > "$local_file"
  fi

  run_cmd rclone copyto "$local_file" "$REMOTE_DB_DIR/$file_name"
}

backup_media() {
  local source_dir="$MEDIA_SOURCE"
  if [[ ! -d "$source_dir" ]]; then
    source_dir="$PROJECT_DIR/backend/data/fotos"
  fi
  if [[ ! -d "$source_dir" ]]; then
    echo "ERRO: diretorio de imagens nao encontrado em $MEDIA_SOURCE nem em $PROJECT_DIR/backend/data/fotos" >&2
    exit 1
  fi

  local file_name="media_${TS_UTC}_${TAG}.tar.gz"
  local local_file="$MEDIA_LOCAL_DIR/$file_name"

  echo "[backup] imagens -> $local_file (origem: $source_dir)"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] tar -C \"$(dirname "$source_dir")\" -czf \"$local_file\" \"$(basename "$source_dir")\""
  else
    tar -C "$(dirname "$source_dir")" -czf "$local_file" "$(basename "$source_dir")"
  fi

  run_cmd rclone copyto "$local_file" "$REMOTE_MEDIA_DIR/$file_name"
}

prune_retention() {
  echo "[backup] aplicando retencao local/remota: ${KEEP_DAYS} dia(s)"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] find \"$DB_LOCAL_DIR\" -type f -name 'db_*.sql.gz' -mtime +$KEEP_DAYS -delete"
    echo "[dry-run] find \"$MEDIA_LOCAL_DIR\" -type f -name 'media_*.tar.gz' -mtime +$KEEP_DAYS -delete"
    echo "[dry-run] rclone delete \"$REMOTE_DB_DIR\" --min-age ${KEEP_DAYS}d --include 'db_*.sql.gz'"
    echo "[dry-run] rclone delete \"$REMOTE_MEDIA_DIR\" --min-age ${KEEP_DAYS}d --include 'media_*.tar.gz'"
    return 0
  fi

  find "$DB_LOCAL_DIR" -type f -name "db_*.sql.gz" -mtime "+$KEEP_DAYS" -delete || true
  find "$MEDIA_LOCAL_DIR" -type f -name "media_*.tar.gz" -mtime "+$KEEP_DAYS" -delete || true
  rclone delete "$REMOTE_DB_DIR" --min-age "${KEEP_DAYS}d" --include "db_*.sql.gz" || true
  rclone delete "$REMOTE_MEDIA_DIR" --min-age "${KEEP_DAYS}d" --include "media_*.tar.gz" || true
}

if [[ "$SCOPE" == "db" || "$SCOPE" == "all" ]]; then
  dump_db
fi

if [[ "$SCOPE" == "media" || "$SCOPE" == "all" ]]; then
  backup_media
fi

prune_retention

echo "[backup] concluido: scope=$SCOPE tag=$TAG remoto=$RCLONE_REMOTE_BASE"
