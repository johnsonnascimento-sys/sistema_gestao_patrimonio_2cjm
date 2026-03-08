#!/usr/bin/env bash
# Modulo: scripts
# Arquivo: scripts/log_alteracao.sh
# Funcao no sistema: registrar entrada padronizada no log geral de alteracoes.
#
# Uso:
#   ./scripts/log_alteracao.sh "<TIPO>" "<DETALHE>"
# Exemplo:
#   ./scripts/log_alteracao.sh "UX" "Ajuste visual da sidebar com icones SVG."
#
# Variaveis opcionais:
#   LOG_FILE=docs/LOG_GERAL_ALTERACOES.md
#   ENTRY_ID=20260225-235900-ajuste-sidebar
#   ALTER_USER="Nome Sobrenome"
#   ALTER_EMAIL="nome@dominio.com"
#   COMMIT_OVERRIDE=abc123def456
#   FINAL_MODE=1

set -euo pipefail

LOG_FILE="${LOG_FILE:-docs/LOG_GERAL_ALTERACOES.md}"

usage() {
  cat <<'EOF'
Uso:
  ./scripts/log_alteracao.sh "<TIPO>" "<DETALHE>"

Campos gerados automaticamente:
  - ID (UTC)
  - DataHoraUTC
  - Usuario (git config user.name/user.email)
  - Branch
  - Commit atual
  - Reversao sugerida (git revert <commit>)
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 2 ]]; then
  usage
  exit 2
fi

tipo="$1"
shift
detalhe_raw="$*"

timestamp_utc="$(date -u +"%Y-%m-%d %H:%M:%S UTC")"
entry_id="${ENTRY_ID:-$(date -u +"%Y%m%d-%H%M%S")}"
usuario="${ALTER_USER:-$(git config user.name 2>/dev/null || whoami)}"
email="${ALTER_EMAIL:-$(git config user.email 2>/dev/null || echo "-")}"
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "-")"
commit="${COMMIT_OVERRIDE:-$(git rev-parse --short HEAD 2>/dev/null || echo "-")}"

sanitize_md() {
  printf '%s' "$1" | tr '\n' ' ' | sed 's/|/\//g'
}

detalhe="$(sanitize_md "$detalhe_raw")"
usuario_safe="$(sanitize_md "$usuario")"
email_safe="$(sanitize_md "$email")"
tipo_safe="$(sanitize_md "$tipo")"
branch_safe="$(sanitize_md "$branch")"
commit_safe="$(sanitize_md "$commit")"

if [[ "${FINAL_MODE:-0}" == "1" ]]; then
  if [[ "$commit_safe" == "-" || "$commit_safe" == "PENDENTE_COMMIT" || "$commit_safe" == "<commit_gerado_para_esta_entrega>" ]]; then
    echo "ERRO: FINAL_MODE=1 exige commit real no log." >&2
    exit 1
  fi
fi

if [[ "$commit_safe" == "-" ]]; then
  reversao="-"
else
  reversao="git revert $commit_safe"
fi

if [[ ! -f "$LOG_FILE" ]]; then
  mkdir -p "$(dirname "$LOG_FILE")"
  cat > "$LOG_FILE" <<'EOF'
# Log Geral de Alteracoes

| ID | DataHoraUTC | Usuario | Tipo | Branch | Commit | Detalhe | ReversaoSugerida |
|---|---|---|---|---|---|---|---|
EOF
fi

printf '| %s | %s | %s <%s> | %s | `%s` | `%s` | %s | `%s` |\n' \
  "$entry_id" \
  "$timestamp_utc" \
  "$usuario_safe" \
  "$email_safe" \
  "$tipo_safe" \
  "$branch_safe" \
  "$commit_safe" \
  "$detalhe" \
  "$reversao" >> "$LOG_FILE"

echo "[log] entrada adicionada em $LOG_FILE"
echo "[log] id=$entry_id commit=$commit_safe"
