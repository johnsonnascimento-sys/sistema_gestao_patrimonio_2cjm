#!/usr/bin/env bash
# Modulo: scripts
# Arquivo: scripts/install_supabase_healthcheck_cron.sh
# Funcao no sistema: instalar um job cron para validar o banco Supabase em uma aproximacao de 120 horas.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cjm-patrimonio/current}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
LOG_FILE="${LOG_FILE:-/var/log/cjm_supabase_health.log}"
CHECK_SCRIPT="${CHECK_SCRIPT:-$APP_DIR/scripts/check_supabase_health.sh}"
CRON_FILE="${CRON_FILE:-/etc/cron.d/cjm-supabase-healthcheck}"
WRAPPER_FILE="${WRAPPER_FILE:-/usr/local/bin/cjm_supabase_healthcheck.sh}"
CRON_SCHEDULE="${CRON_SCHEDULE:-0 3 */5 * *}"

usage() {
  cat <<'EOF'
Uso:
  sudo APP_DIR=/opt/cjm-patrimonio/current ./scripts/install_supabase_healthcheck_cron.sh

Variaveis reconhecidas:
  APP_DIR        Diretorio do deploy na VPS (padrao: /opt/cjm-patrimonio/current)
  ENV_FILE       Arquivo .env com DATABASE_URL (padrao: $APP_DIR/.env)
  LOG_FILE       Log opcional em arquivo (padrao: /var/log/cjm_supabase_health.log)
  CRON_SCHEDULE  Agendamento cron (padrao: 0 3 */5 * *)

Observacao:
  - O padrao `*/5` em cron usa o dia do mes e e apenas uma aproximacao para 120 horas.
  - Se voce precisar de intervalo exato de 120h, use o timer systemd.
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

mkdir -p /usr/local/bin

cat >"$WRAPPER_FILE" <<EOF
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$APP_DIR"
ENV_FILE="$ENV_FILE"
LOG_FILE="$LOG_FILE"
CHECK_SCRIPT="$CHECK_SCRIPT"
LOCK_FILE="/var/lock/cjm-supabase-healthcheck.lock"

mkdir -p "$(dirname "$LOG_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[supabase-health] execucao anterior ainda em andamento; pulando." >>"$LOG_FILE"
  exit 0
fi

cd "$APP_DIR"
ENV_FILE="$ENV_FILE" LOG_FILE="$LOG_FILE" "$CHECK_SCRIPT" >>"$LOG_FILE" 2>&1
EOF
chmod 0755 "$WRAPPER_FILE"

cat >"$CRON_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=""

$CRON_SCHEDULE root $WRAPPER_FILE
EOF
chmod 0644 "$CRON_FILE"

if command -v systemctl >/dev/null 2>&1; then
  systemctl restart cron >/dev/null 2>&1 || systemctl restart crond >/dev/null 2>&1 || true
fi

echo "Cron instalado: $CRON_FILE"
echo "Wrapper instalado: $WRAPPER_FILE"
echo "Verificacao manual: $WRAPPER_FILE"
echo "Logs: tail -f $LOG_FILE"
