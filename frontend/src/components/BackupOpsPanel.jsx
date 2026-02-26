/**
 * Modulo: frontend/components
 * Arquivo: BackupOpsPanel.jsx
 * Funcao no sistema: exibir no painel admin o runbook de backup/restore (Drive) para operacao segura.
 */
export default function BackupOpsPanel({ canAdmin }) {
  if (!canAdmin) {
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Backup e Restore (Drive)</h3>
        <p className="mt-2 text-sm text-slate-600">
          Visivel apenas para perfil ADMIN.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold">Backup e Restore (Drive)</h3>
      <p className="mt-1 text-xs text-slate-600">
        Escopo atual: banco + imagens, com retencao de 14 dias.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Snapshot pre-GEAFIN</p>
          <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-[11px] text-slate-800">
{`cd /opt/cjm-patrimonio/current
./scripts/pre_geafin_snapshot.sh --tag pre-geafin --keep-days 14`}
          </pre>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Backup manual completo</p>
          <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-[11px] text-slate-800">
{`cd /opt/cjm-patrimonio/current
./scripts/backup_to_drive.sh --scope all --tag manual --keep-days 14`}
          </pre>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Restore do banco (destrutivo)</p>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-[11px] text-slate-800">
{`cd /opt/cjm-patrimonio/current
./scripts/restore_db_backup.sh --remote-file db_YYYYMMDDTHHMMSSZ_pre-geafin.sql.gz --yes-i-know`}
        </pre>
        <p className="mt-2 text-xs text-amber-800">
          O restore cria backup pre-restore automaticamente antes de aplicar o dump.
        </p>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Cron recomendado (02:30 UTC)</p>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-[11px] text-slate-800">
{`30 2 * * * cd /opt/cjm-patrimonio/current && ./scripts/backup_to_drive.sh --scope all --tag cron-diario --keep-days 14 >> /var/log/cjm_backup_drive.log 2>&1`}
        </pre>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold">Destino no Drive</p>
        <p className="mt-1">Remote: <code className="rounded bg-white px-1 py-0.5">cjm_gdrive:</code></p>
        <p className="mt-1">Pastas: <code className="rounded bg-white px-1 py-0.5">db-backups/database</code> e <code className="rounded bg-white px-1 py-0.5">db-backups/media</code></p>
      </div>
    </article>
  );
}
