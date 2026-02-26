#!/usr/bin/env bash
# Modulo: scripts
# Arquivo: scripts/restore_db_backup.sh
# Funcao no sistema: restaurar backup do banco (arquivo local ou remoto no Google Drive) com etapa de seguranca.
#
# Atenção:
# - Operacao destrutiva no banco alvo.
# - O script gera um backup DB "pre-restore" antes de aplicar o restore.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/cjm-patrimonio/current}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
RCLONE_REMOTE_DB_DIR="${RCLONE_REMOTE_DB_DIR:-cjm_gdrive:db-backups/database}"
TMP_DIR="${TMP_DIR:-/tmp/cjm_restore}"
LOCAL_FILE=""
REMOTE_FILE=""
YES_I_KNOW=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Uso:
  ./scripts/restore_db_backup.sh [opcoes]

Origem (escolha uma):
  --local-file <caminho>       Arquivo local .sql.gz
  --remote-file <nome-arquivo> Nome do arquivo em cjm_gdrive:db-backups/database

Seguranca:
  --yes-i-know                 Confirmacao explicita para executar o restore
  --dry-run                    Apenas imprime comandos

Outras:
  --project-dir <dir>          Diretorio do projeto (padrao: /opt/cjm-patrimonio/current)
  --env-file <arquivo>         Arquivo com DATABASE_URL
  --remote-db-dir <remote>     Remote do DB (padrao: cjm_gdrive:db-backups/database)
  -h, --help                   Ajuda
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local-file) LOCAL_FILE="${2:-}"; shift 2 ;;
    --remote-file) REMOTE_FILE="${2:-}"; shift 2 ;;
    --yes-i-know) YES_I_KNOW=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --project-dir) PROJECT_DIR="${2:-}"; shift 2 ;;
    --env-file) ENV_FILE="${2:-}"; shift 2 ;;
    --remote-db-dir) RCLONE_REMOTE_DB_DIR="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERRO: argumento invalido: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -n "$LOCAL_FILE" && -n "$REMOTE_FILE" ]]; then
  echo "ERRO: informe apenas uma origem (--local-file ou --remote-file)." >&2
  exit 2
fi

if [[ -z "$LOCAL_FILE" && -z "$REMOTE_FILE" ]]; then
  echo "ERRO: informe uma origem de backup." >&2
  exit 2
fi

if [[ "$YES_I_KNOW" -ne 1 ]]; then
  echo "ERRO: faltou confirmacao explicita (--yes-i-know)." >&2
  exit 2
fi

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

run_cmd() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] $*"
    return 0
  fi
  "$@"
}

mkdir -p "$TMP_DIR"

selected_file="$LOCAL_FILE"
if [[ -n "$REMOTE_FILE" ]]; then
  selected_file="$TMP_DIR/$REMOTE_FILE"
  run_cmd rclone copyto "$RCLONE_REMOTE_DB_DIR/$REMOTE_FILE" "$selected_file"
fi

if [[ ! -f "$selected_file" ]]; then
  echo "ERRO: arquivo de backup nao encontrado: $selected_file" >&2
  exit 1
fi

echo "[restore] gerando backup de seguranca pre-restore"
run_cmd "$PROJECT_DIR/scripts/backup_to_drive.sh" --scope db --tag pre-restore

echo "[restore] aplicando restore do arquivo: $selected_file"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] gunzip -c \"$selected_file\" | docker run --rm -i --network host -e DATABASE_URL=<redacted> postgres:16-alpine psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1"
else
  gunzip -c "$selected_file" \
    | docker run --rm -i --network host -e DATABASE_URL="$DATABASE_URL" postgres:16-alpine \
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1
fi

echo "[restore] concluido com sucesso."
