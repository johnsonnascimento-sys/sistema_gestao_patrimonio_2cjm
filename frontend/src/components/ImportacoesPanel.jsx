/**
 * Modulo: frontend/components
 * Arquivo: ImportacoesPanel.jsx
 * Funcao no sistema: executar importacao GEAFIN (CSV Latin1) com barra de progresso e cancelamento.
 */
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  cancelarImportacaoGeafin,
  getUltimaImportacaoGeafin,
  importarGeafin,
} from "../services/apiClient.js";

function formatApiError(error) {
  const msg = String(error?.message || "Falha na requisicao.");
  const status = error?.status != null ? String(error.status) : "";
  const code = error?.payload?.error?.code ? String(error.payload.error.code) : "";
  const requestId = error?.payload?.requestId ? String(error.payload.requestId) : "";
  const suffixParts = [
    status ? `status=${status}` : null,
    code ? `code=${code}` : null,
    requestId ? `requestId=${requestId}` : null,
  ].filter(Boolean);
  return suffixParts.length ? `${msg} (${suffixParts.join(", ")})` : msg;
}

function ImportProgressBar({ progressState, onCancel }) {
  const imp = progressState?.data?.importacao || null;
  const isActive = Boolean(progressState?.loading);

  if (!isActive && !imp && !progressState?.error) return null;

  const total = imp?.totalLinhas ? Number(imp.totalLinhas) : null;
  const done = imp?.linhasInseridas != null ? Number(imp.linhasInseridas) : null;
  const percent = imp?.percent != null ? Number(imp.percent) : null;

  const indeterminate = Boolean(
    isActive &&
      imp &&
      imp.status === "EM_ANDAMENTO" &&
      (done == null || done <= 0) &&
      (percent == null || percent <= 0),
  );

  const label = indeterminate
    ? "Preparando importacao..."
    : percent != null && Number.isFinite(percent)
      ? `${percent}%`
      : total && done != null
        ? `${done}/${total}`
        : done != null
          ? `${done} linhas`
          : "Aguardando progresso...";

  const startedEm = imp?.importedEm && typeof imp.importedEm === "string" ? imp.importedEm : null;
  const lastUpdateEm =
    imp?.ultimaAtualizacaoEm && typeof imp.ultimaAtualizacaoEm === "string"
      ? imp.ultimaAtualizacaoEm
      : startedEm;
  const finishedEm = imp?.finalizadoEm && typeof imp.finalizadoEm === "string" ? imp.finalizadoEm : null;

  const elapsedTotal =
    startedEm ? Math.max(0, Math.floor((Date.now() - Date.parse(startedEm)) / 1000)) : null;
  const idle =
    lastUpdateEm ? Math.max(0, Math.floor((Date.now() - Date.parse(lastUpdateEm)) / 1000)) : null;

  const fmt = (s) => {
    try {
      return new Date(s).toLocaleString("pt-BR");
    } catch {
      return String(s || "");
    }
  };

  const showCancel = Boolean(typeof onCancel === "function" && imp?.status === "EM_ANDAMENTO");

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Progresso da importacao (GEAFIN)
          </p>
          <p className="mt-1 text-sm text-slate-800">
            {imp?.originalFilename ? (
              <span className="font-medium">{imp.originalFilename}</span>
            ) : (
              <span className="font-medium">Arquivo</span>
            )}
            {imp?.status ? <span className="text-slate-500"> {" "}({imp.status})</span> : null}
          </p>
          {startedEm ? (
            <p className="mt-1 text-[11px] text-slate-500">inicio: {fmt(startedEm)}</p>
          ) : null}
          {lastUpdateEm ? (
            <p className="mt-1 text-[11px] text-slate-500">ultima atualizacao: {fmt(lastUpdateEm)}</p>
          ) : null}
          {finishedEm ? (
            <p className="mt-1 text-[11px] text-slate-500">finalizada em: {fmt(finishedEm)}</p>
          ) : null}
          {elapsedTotal != null ? (
            <p className="mt-1 text-[11px] text-slate-500">tempo decorrido: {elapsedTotal}s</p>
          ) : null}
          {idle != null && imp?.status === "EM_ANDAMENTO" ? (
            <p className={`mt-1 text-[11px] ${idle > 60 ? "text-amber-800" : "text-slate-500"}`}>
              sem atualizacao: {idle}s
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-violet-700">{label}</p>
          {imp ? (
            <p className="text-[11px] text-slate-500">
              ok={imp.persistenciaOk} falha_persist={imp.falhaPersistencia} falha_norm={imp.falhaNormalizacao}
            </p>
          ) : null}
          {showCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="mt-2 rounded-md border border-rose-300/30 bg-rose-200/10 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200/20"
              title="Cancelar importacao (marca como ERRO para destravar a UI)."
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
        <div
          className={[
            "h-full rounded-full bg-violet-600 transition-[width] duration-300",
            indeterminate || percent == null ? "w-2/3 animate-pulse" : "",
          ].join(" ").trim()}
          style={!indeterminate && percent != null ? { width: `${Math.max(0, Math.min(100, percent))}%` } : undefined}
        />
      </div>

      {progressState?.error ? (
        <p className="mt-2 text-xs text-rose-700">{progressState.error}</p>
      ) : null}
      {imp?.erroResumo ? (
        <p
          className={`mt-2 text-xs ${
            String(imp.status || "").toUpperCase() === "ERRO" &&
            String(imp.erroResumo || "").toLowerCase().includes("cancelad")
              ? "text-amber-800"
              : "text-rose-700"
          }`}
        >
          {String(imp.status || "").toUpperCase() === "ERRO" &&
          String(imp.erroResumo || "").toLowerCase().includes("cancelad")
            ? "cancelada: "
            : "erro: "}
          {imp.erroResumo}
        </p>
      ) : null}
      {imp?.id ? (
        <p className="mt-1 text-[11px] text-slate-500">
          arquivoId={imp.id}
        </p>
      ) : null}
    </div>
  );
}

export default function ImportacoesPanel({ canAdmin }) {
  const auth = useAuth();
  const [importState, setImportState] = useState({
    loading: false,
    response: null,
    error: null,
  });
  const [importProgress, setImportProgress] = useState({
    loading: false,
    data: null,
    error: null,
  });
  const importPollTimerRef = useRef(null);
  const importAbortRef = useRef(null);
  const [csvFile, setCsvFile] = useState(null);
  const [unidadePadraoId, setUnidadePadraoId] = useState("");

  const stopImportPolling = () => {
    if (importPollTimerRef.current) {
      window.clearInterval(importPollTimerRef.current);
      importPollTimerRef.current = null;
    }
  };

  const pollImportProgressOnce = async () => {
    const data = await getUltimaImportacaoGeafin();
    const imp = data?.importacao || null;
    const running = imp?.status === "EM_ANDAMENTO";
    setImportProgress({ loading: running, data, error: null });
    if (!running) stopImportPolling();
    return { data, running };
  };

  const startImportPolling = async () => {
    stopImportPolling();
    try {
      await pollImportProgressOnce();
    } catch (error) {
      setImportProgress((prev) => ({ ...prev, loading: true, error: formatApiError(error) }));
    }
    importPollTimerRef.current = window.setInterval(async () => {
      try {
        await pollImportProgressOnce();
      } catch (error) {
        setImportProgress((prev) => ({ ...prev, loading: true, error: prev.data ? null : formatApiError(error) }));
      }
    }, 1000);
  };

  useEffect(() => {
    if (!canAdmin) return () => stopImportPolling();
    let alive = true;
    (async () => {
      try {
        const data = await getUltimaImportacaoGeafin();
        if (!alive) return;
        const imp = data?.importacao || null;
        if (!imp) return;
        const running = imp.status === "EM_ANDAMENTO";
        setImportProgress({ loading: running, data, error: null });
        if (running) await startImportPolling();
      } catch (_error) {
        // Mantem UI operando mesmo sem endpoint de progresso.
      }
    })();
    return () => {
      alive = false;
      stopImportPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  const onImport = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setImportState({ loading: false, response: null, error: "Operacao restrita ao perfil ADMIN." });
      return;
    }
    if (!csvFile) {
      setImportState({
        loading: false,
        response: null,
        error: "Selecione um arquivo CSV GEAFIN.",
      });
      return;
    }
    const abortController = new AbortController();
    importAbortRef.current = abortController;
    setImportState({ loading: true, response: null, error: null });
    setImportProgress({ loading: true, data: null, error: null });
    await startImportPolling();
    try {
      const data = await importarGeafin(
        csvFile,
        unidadePadraoId ? Number(unidadePadraoId) : null,
        { signal: abortController.signal },
      );
      setImportState({ loading: false, response: data, error: null });
    } catch (error) {
      if (abortController.signal.aborted) {
        setImportState({ loading: false, response: null, error: "Importacao cancelada." });
      } else {
        setImportState({
          loading: false,
          response: null,
          error: formatApiError(error),
        });
      }
    } finally {
      importAbortRef.current = null;
      stopImportPolling();
      try {
        const { data, running } = await pollImportProgressOnce();
        if (!running) setImportProgress({ loading: false, data, error: null });
      } catch (error) {
        setImportProgress((prev) => ({ ...prev, loading: false, error: formatApiError(error) }));
      }
    }
  };

  const onCancelImport = async () => {
    if (!canAdmin) return;
    const impId = importProgress.data?.importacao?.id ? String(importProgress.data.importacao.id) : "";
    if (!impId) return;

    if (importAbortRef.current) {
      try {
        importAbortRef.current.abort();
      } catch (_e) {
        // noop
      }
      importAbortRef.current = null;
    }

    stopImportPolling();
    setImportProgress((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await cancelarImportacaoGeafin(impId, "Cancelada via UI (ADMIN).");
      await pollImportProgressOnce();
    } catch (error) {
      setImportProgress((prev) => ({ ...prev, loading: false, error: formatApiError(error) }));
    } finally {
      setImportState((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <section className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Importacao GEAFIN</h2>
        <p className="mt-2 text-sm text-slate-600">
          Importacao GEAFIN (CSV Latin1) com acompanhamento de progresso, cancelamento e trilha de status.
        </p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Importacao GEAFIN (CSV Latin1)</h3>
        {!canAdmin && auth.authEnabled ? (
          <p className="mt-2 text-xs text-rose-700">
            Operacao restrita ao perfil <strong>ADMIN</strong>.
          </p>
        ) : null}
        <form onSubmit={onImport} className="mt-3 grid gap-3 md:grid-cols-[1.2fr_auto_auto]">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
            disabled={!canAdmin && auth.authEnabled}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="1"
            max="4"
            value={unidadePadraoId}
            onChange={(event) => setUnidadePadraoId(event.target.value)}
            placeholder="Unidade (1-4)"
            disabled={!canAdmin && auth.authEnabled}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={importState.loading || (!canAdmin && auth.authEnabled)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {importState.loading ? "Importando..." : "Importar"}
          </button>
        </form>
        <ImportProgressBar progressState={importProgress} onCancel={onCancelImport} />
        {importState.error ? <p className="mt-2 text-sm text-rose-700">{importState.error}</p> : null}
        {importState.response ? (
          <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            {JSON.stringify(importState.response, null, 2)}
          </pre>
        ) : null}
      </article>
    </section>
  );
}
