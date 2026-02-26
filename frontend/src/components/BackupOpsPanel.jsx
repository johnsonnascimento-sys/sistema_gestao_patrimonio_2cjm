/**
 * Modulo: frontend/components
 * Arquivo: BackupOpsPanel.jsx
 * Funcao no sistema: executar backup/restore via API admin com confirmacao por senha e exibir status operacional.
 */
import { useEffect, useMemo, useState } from "react";
import {
  executarBackupManual,
  executarRestoreBackup,
  executarSnapshotPreGeafin,
  getBackupStatus,
} from "../services/apiClient.js";

export default function BackupOpsPanel({ canAdmin }) {
  const [statusState, setStatusState] = useState({ loading: false, data: null, error: null });
  const [adminPassword, setAdminPassword] = useState("");
  const [keepDays, setKeepDays] = useState("14");
  const [manualScope, setManualScope] = useState("all");
  const [manualTag, setManualTag] = useState("manual-ui");
  const [restoreFile, setRestoreFile] = useState("");
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [actionState, setActionState] = useState({ loading: false, error: null, ok: null });

  const tools = statusState.data?.tools || {};
  const remoteDb = statusState.data?.remote?.db || [];
  const remoteMedia = statusState.data?.remote?.media || [];
  const ops = statusState.data?.ops || [];

  const backupReady = useMemo(
    () => Boolean(tools.rclone && tools.pg_dump && tools.tar && tools.gzip),
    [tools],
  );

  const loadStatus = async () => {
    if (!canAdmin) return;
    setStatusState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getBackupStatus({ limitOps: 20 });
      setStatusState({ loading: false, data, error: null });
    } catch (error) {
      setStatusState({
        loading: false,
        data: null,
        error: String(error?.message || "Falha ao consultar status de backup."),
      });
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  const fmt = (v) => {
    if (!v) return "-";
    try {
      return new Date(v).toLocaleString("pt-BR");
    } catch {
      return String(v);
    }
  };

  const fmtBytes = (n) => {
    const size = Number(n || 0);
    if (!Number.isFinite(size) || size <= 0) return "0 B";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const ensurePassword = () => {
    if (!String(adminPassword || "").trim()) {
      setActionState({ loading: false, error: "Informe sua senha de ADMIN para confirmar a operacao.", ok: null });
      return false;
    }
    return true;
  };

  const onSnapshot = async () => {
    if (!ensurePassword()) return;
    setActionState({ loading: true, error: null, ok: null });
    try {
      const data = await executarSnapshotPreGeafin({
        adminPassword,
        keepDays: Number(keepDays || 14),
        tag: "pre-geafin-ui",
      });
      setActionState({ loading: false, error: null, ok: `Snapshot concluido. requestId=${data?.requestId || "-"}` });
      await loadStatus();
    } catch (error) {
      setActionState({ loading: false, error: String(error?.message || "Falha ao executar snapshot."), ok: null });
    }
  };

  const onBackupManual = async () => {
    if (!ensurePassword()) return;
    setActionState({ loading: true, error: null, ok: null });
    try {
      const data = await executarBackupManual({
        adminPassword,
        scope: manualScope,
        keepDays: Number(keepDays || 14),
        tag: manualTag || "manual-ui",
      });
      setActionState({ loading: false, error: null, ok: `Backup concluido. requestId=${data?.requestId || "-"}` });
      await loadStatus();
    } catch (error) {
      setActionState({ loading: false, error: String(error?.message || "Falha ao executar backup manual."), ok: null });
    }
  };

  const onRestore = async () => {
    if (!ensurePassword()) return;
    if (!restoreFile) {
      setActionState({ loading: false, error: "Selecione o arquivo remoto de dump para restore.", ok: null });
      return;
    }
    if (String(restoreConfirm || "").trim().toUpperCase() !== "RESTORE") {
      setActionState({ loading: false, error: "Digite RESTORE para confirmar o restore.", ok: null });
      return;
    }
    setActionState({ loading: true, error: null, ok: null });
    try {
      const data = await executarRestoreBackup({
        adminPassword,
        remoteFile: restoreFile,
        confirmText: "RESTORE",
        keepDays: Number(keepDays || 14),
      });
      setActionState({ loading: false, error: null, ok: `Restore concluido. requestId=${data?.requestId || "-"}` });
      setRestoreConfirm("");
      await loadStatus();
    } catch (error) {
      setActionState({ loading: false, error: String(error?.message || "Falha ao executar restore."), ok: null });
    }
  };

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
        Execute as acoes por botao com confirmacao por senha ADMIN.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-slate-600">Senha ADMIN (confirmacao obrigatoria)</span>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Digite sua senha"
            autoComplete="current-password"
            disabled={actionState.loading}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Retencao (dias)</span>
          <input
            type="number"
            min="0"
            max="180"
            value={keepDays}
            onChange={(e) => setKeepDays(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            disabled={actionState.loading}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSnapshot}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={actionState.loading || !backupReady}
        >
          Snapshot pre-GEAFIN
        </button>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
          <span className="text-xs text-slate-600">Escopo</span>
          <select
            value={manualScope}
            onChange={(e) => setManualScope(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            disabled={actionState.loading}
          >
            <option value="all">all</option>
            <option value="db">db</option>
            <option value="media">media</option>
          </select>
        </label>
        <input
          value={manualTag}
          onChange={(e) => setManualTag(e.target.value)}
          className="min-w-[180px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="tag do backup"
          disabled={actionState.loading}
        />
        <button
          type="button"
          onClick={onBackupManual}
          className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={actionState.loading || !backupReady}
        >
          Backup manual
        </button>
        <button
          type="button"
          onClick={loadStatus}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={actionState.loading || statusState.loading}
        >
          Atualizar status
        </button>
      </div>

      {statusState.error ? <p className="mt-2 text-sm text-rose-700">{statusState.error}</p> : null}
      {actionState.error ? <p className="mt-2 text-sm text-rose-700">{actionState.error}</p> : null}
      {actionState.ok ? <p className="mt-2 text-sm text-emerald-700">{actionState.ok}</p> : null}
      {!backupReady ? (
        <p className="mt-2 text-sm text-amber-800">
          Ferramentas incompletas no backend para backup/restore. Verifique rclone/pg_dump/psql/tar/gzip no servidor.
        </p>
      ) : null}

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Restore do banco (destrutivo)</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Arquivo remoto (Drive)</span>
            <select
              value={restoreFile}
              onChange={(e) => setRestoreFile(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={actionState.loading}
            >
              <option value="">Selecione...</option>
              {remoteDb.map((row) => (
                <option key={row.name} value={row.name}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Confirmacao (digite RESTORE)</span>
            <input
              value={restoreConfirm}
              onChange={(e) => setRestoreConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="RESTORE"
              disabled={actionState.loading}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={onRestore}
          className="mt-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={actionState.loading || !restoreFile}
        >
          Executar restore
        </button>
        <p className="mt-2 text-xs text-amber-800">
          O sistema gera automaticamente um backup pre-restore antes de restaurar.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Backups remotos - database</p>
          <div className="mt-2 max-h-44 overflow-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-2 py-1.5">Arquivo</th>
                  <th className="px-2 py-1.5">Tamanho</th>
                  <th className="px-2 py-1.5">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {remoteDb.slice(0, 20).map((row) => (
                  <tr key={`db-${row.name}`}>
                    <td className="px-2 py-1.5 font-mono text-[11px]">{row.name}</td>
                    <td className="px-2 py-1.5">{fmtBytes(row.size)}</td>
                    <td className="px-2 py-1.5">{fmt(row.modifiedAt)}</td>
                  </tr>
                ))}
                {!remoteDb.length ? (
                  <tr><td className="px-2 py-2 text-slate-500" colSpan={3}>Sem arquivos.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Backups remotos - media</p>
          <div className="mt-2 max-h-44 overflow-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-2 py-1.5">Arquivo</th>
                  <th className="px-2 py-1.5">Tamanho</th>
                  <th className="px-2 py-1.5">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {remoteMedia.slice(0, 20).map((row) => (
                  <tr key={`media-${row.name}`}>
                    <td className="px-2 py-1.5 font-mono text-[11px]">{row.name}</td>
                    <td className="px-2 py-1.5">{fmtBytes(row.size)}</td>
                    <td className="px-2 py-1.5">{fmt(row.modifiedAt)}</td>
                  </tr>
                ))}
                {!remoteMedia.length ? (
                  <tr><td className="px-2 py-2 text-slate-500" colSpan={3}>Sem arquivos.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold">Ultimas operacoes</p>
        <div className="mt-2 max-h-40 overflow-auto rounded border border-slate-200 bg-white p-2">
          {ops.length ? (
            ops.map((op, idx) => (
              <div key={`op-${idx}`} className="border-b border-slate-100 py-1 text-[11px] last:border-b-0">
                <span className={String(op.status || "").toUpperCase() === "OK" ? "text-emerald-700" : "text-rose-700"}>
                  {String(op.status || "-")}
                </span>{" "}
                {String(op.action || "-")} | {fmt(op.tsUtc)} | requestId={String(op.requestId || "-")}
              </div>
            ))
          ) : (
            <p className="text-[11px] text-slate-500">Sem operacoes registradas ainda.</p>
          )}
        </div>
      </div>
    </article>
  );
}
