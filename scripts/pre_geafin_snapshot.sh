#!/usr/bin/env bash
# Modulo: scripts
# Arquivo: scripts/pre_geafin_snapshot.sh
# Funcao no sistema: gerar snapshot (banco + imagens) antes da Importacao GEAFIN.
#
# Uso:
#   ./scripts/pre_geafin_snapshot.sh
#   ./scripts/pre_geafin_snapshot.sh --tag lote-fev

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/cjm-patrimonio/current}"
TAG="${TAG:-pre-geafin}"
KEEP_DAYS="${KEEP_DAYS:-14}"
EXTRA_ARGS=()

usage() {
  cat <<'EOF'
Uso:
  ./scripts/pre_geafin_snapshot.sh [opcoes]

Opcoes:
  --tag <texto>        Sufixo do arquivo (padrao: pre-geafin)
  --keep-days <N>      Retencao em dias (padrao: 14)
  --dry-run            Apenas imprime comandos
  -h, --help           Ajuda
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --keep-days) KEEP_DAYS="${2:-}"; shift 2 ;;
    --dry-run) EXTRA_ARGS+=("--dry-run"); shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERRO: argumento invalido: $1" >&2; usage; exit 2 ;;
  esac
done

echo "[snapshot] iniciando snapshot pre-importacao GEAFIN"
"$PROJECT_DIR/scripts/backup_to_drive.sh" \
  --scope all \
  --tag "$TAG" \
  --keep-days "$KEEP_DAYS" \
  "${EXTRA_ARGS[@]:-}"

echo "[snapshot] pronto. Agora execute a importacao GEAFIN na UI."
