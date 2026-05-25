#!/usr/bin/env bash
# Modulo: scripts
# Arquivo: scripts/install_supabase_healthcheck_timer.sh
# Funcao no sistema: instalar e habilitar um timer systemd para validar o banco Supabase a cada 120 horas.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cjm-patrimonio/current}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
LOG_FILE="${LOG_FILE:-/var/log/cjm_supabase_health.log}"
SERVICE_NAME="${SERVICE_NAME:-cjm-supabase-healthcheck}"
SERVICE_FILE="${SERVICE_FILE:-/etc/systemd/system/${SERVICE_NAME}.service}"
TIMER_FILE="${TIMER_FILE:-/etc/systemd/system/${SERVICE_NAME}.timer}"
CHECK_SCRIPT="${CHECK_SCRIPT:-$APP_DIR/scripts/check_supabase_health.sh}"

usage() {
  cat <<'EOF'
Uso:
  sudo APP_DIR=/opt/cjm-patrimonio/current ./scripts/install_supabase_healthcheck_timer.sh

Variaveis reconhecidas:
  APP_DIR       Diretorio do deploy na VPS (padrao: /opt/cjm-patrimonio/current)
  ENV_FILE      Arquivo .env com DATABASE_URL (padrao: $APP_DIR/.env)
  LOG_FILE      Log opcional em arquivo (padrao: /var/log/cjm_supabase_health.log)
  SERVICE_NAME  Nome base do service/timer systemd
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "ERRO: este script precisa ser executado como root." >&2
  exit 1
fi

if [[ ! -x "$CHECK_SCRIPT" ]]; then
  echo "ERRO: script de health check nao encontrado ou sem permissao de execucao: $CHECK_SCRIPT" >&2
  exit 1
fi

mkdir -p /etc/systemd/system

cat >"$SERVICE_FILE" <<EOF
[Unit]
Description=Supabase database health check for CJM
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$APP_DIR
Environment=APP_DIR=$APP_DIR
Environment=ENV_FILE=$ENV_FILE
Environment=LOG_FILE=$LOG_FILE
ExecStart=$CHECK_SCRIPT

[Install]
WantedBy=multi-user.target
EOF

cat >"$TIMER_FILE" <<EOF
[Unit]
Description=Run Supabase database health check every 120 hours

[Timer]
OnBootSec=15min
OnUnitActiveSec=120h
AccuracySec=1h
Persistent=true
Unit=${SERVICE_NAME}.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.timer"

echo "Timer instalado e ativo: ${SERVICE_NAME}.timer"
echo "Status: systemctl status ${SERVICE_NAME}.timer"
echo "Logs: journalctl -u ${SERVICE_NAME}.service -f"
