#!/usr/bin/env bash
# Modulo: scripts
# Arquivo: scripts/reverter_alteracao.sh
# Funcao no sistema: executar rollback seguro por commit ou por ID do log geral.
#
# Uso:
#   ./scripts/reverter_alteracao.sh --commit <hash>
#   ./scripts/reverter_alteracao.sh --log-id <ID>
#
# Opcoes:
#   --in-place      reverte na branch atual (padrao: cria branch rollback/*)
#   --log-file      caminho do log geral (padrao: docs/LOG_GERAL_ALTERACOES.md)

set -euo pipefail

LOG_FILE="${LOG_FILE:-docs/LOG_GERAL_ALTERACOES.md}"
MODE=""
TARGET=""
CREATE_BRANCH=1

usage() {
  cat <<'EOF'
Uso:
  ./scripts/reverter_alteracao.sh --commit <hash>
  ./scripts/reverter_alteracao.sh --log-id <ID>

Opcoes:
  --in-place              Reverte na branch atual.
  --log-file <arquivo>    Define arquivo de log (padrao: docs/LOG_GERAL_ALTERACOES.md).
  -h, --help              Mostra ajuda.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --commit)
      MODE="commit"
      TARGET="${2:-}"
      shift 2
      ;;
    --log-id)
      MODE="log-id"
      TARGET="${2:-}"
      shift 2
      ;;
    --in-place)
      CREATE_BRANCH=0
      shift
      ;;
    --log-file)
      LOG_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERRO: argumento invalido: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$MODE" || -z "$TARGET" ]]; then
  usage
  exit 2
fi

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERRO: execute dentro de um repositorio git." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERRO: working tree suja. Commit/stash antes de reverter." >&2
  exit 1
fi

resolve_commit_from_log() {
  local id="$1"
  local file="$2"

  if [[ ! -f "$file" ]]; then
    echo "ERRO: log nao encontrado: $file" >&2
    return 1
  fi

  awk -F'|' -v target_id="$id" '
    NR > 2 {
      for (i = 1; i <= NF; i++) {
        gsub(/^[ \t]+|[ \t]+$/, "", $i)
      }
      if ($2 == target_id) {
        gsub(/`/, "", $7)
        print $7
        found = 1
        exit
      }
    }
    END {
      if (!found) exit 1
    }
  ' "$file"
}

if [[ "$MODE" == "commit" ]]; then
  commit="$TARGET"
else
  commit="$(resolve_commit_from_log "$TARGET" "$LOG_FILE")" || {
    echo "ERRO: ID nao encontrado no log: $TARGET" >&2
    exit 1
  }
fi

if [[ -z "$commit" || "$commit" == "-" ]]; then
  echo "ERRO: commit invalido para rollback." >&2
  exit 1
fi

if ! git cat-file -e "${commit}^{commit}" 2>/dev/null; then
  echo "ERRO: commit nao encontrado no repositorio local: $commit" >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CREATE_BRANCH" -eq 1 ]]; then
  rollback_branch="rollback/${commit}-$(date -u +%Y%m%d%H%M%S)"
  git switch -c "$rollback_branch"
  echo "[rollback] branch criada: $rollback_branch (origem: $current_branch)"
fi

git revert --no-edit "$commit"

echo "[rollback] commit revertido com sucesso: $commit"
echo "[rollback] proximo passo sugerido: git push origin $(git rev-parse --abbrev-ref HEAD)"
