#!/usr/bin/env bash
# Modulo: scripts
# Arquivo: scripts/vps_deploy.sh
# Funcao no sistema: deploy deterministico na VPS (git pull + rebuild + restart de containers via docker compose).
#
# Observacao:
# - Este script NAO imprime segredos e NAO deve ler/ecoar o conteudo do .env.
# - Ajuste o APP_DIR se o repositorio estiver em outro caminho.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cjm-patrimonio/releases/cjm-patrimonio}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.vps.yml}"

usage() {
  cat <<'EOF'
Uso:
  APP_DIR=/opt/cjm-patrimonio/releases/cjm-patrimonio ./scripts/vps_deploy.sh [all|frontend|backend]

Comportamento:
  - Faz git pull (ff-only)
  - Recria containers com os nomes padrao (cjm_frontend/cjm_backend)
  - Rebuild do(s) servico(s) escolhido(s)

EOF
}

target="${1:-all}"
if [[ "$target" != "all" && "$target" != "frontend" && "$target" != "backend" ]]; then
  usage
  exit 2
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERRO: APP_DIR nao existe: $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"

if [[ ! -d .git ]]; then
  echo "ERRO: APP_DIR nao parece ser um repo git (faltou .git): $APP_DIR" >&2
  echo "Dica: clone o repositorio oficial em $APP_DIR e tente novamente." >&2
  exit 1
fi

echo "[deploy] atualizando codigo (git pull)..."
git fetch --all --prune
git pull --ff-only

echo "[deploy] removendo containers antigos (se existirem)..."
docker rm -f cjm_frontend >/dev/null 2>&1 || true
docker rm -f cjm_backend >/dev/null 2>&1 || true

echo "[deploy] build + up ($target)..."
if [[ "$target" == "frontend" ]]; then
  docker compose -f "$COMPOSE_FILE" build frontend
  docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate frontend
elif [[ "$target" == "backend" ]]; then
  docker compose -f "$COMPOSE_FILE" build backend
  docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate backend
else
  docker compose -f "$COMPOSE_FILE" build backend frontend
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate
fi

echo "[deploy] ok."
