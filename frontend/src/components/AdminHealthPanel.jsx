/**
 * Modulo: frontend/components
 * Arquivo: AdminHealthPanel.jsx
 * Funcao no sistema: exibir e atualizar automaticamente a conectividade backend (/health) para operacao administrativa.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL, getHealth } from "../services/apiClient.js";

const AUTO_REFRESH_MS = 120 * 60 * 60 * 1000;
const HEALTH_LOG_STORAGE_KEY = "cjm.adminHealthPanel.healthLog.v1";
const MAX_HEALTH_LOG_ENTRIES = 10;

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

function renderValue(value) {
  const normalized = String(value || "").trim();
  return normalized || "unknown";
}

function readHealthLog() {
  if (typeof window === "undefined" || !window.localStorage) return [];

  try {
    const raw = window.localStorage.getItem(HEALTH_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        id: String(entry?.id || ""),
        at: String(entry?.at || ""),
        status: entry?.status === "ok" ? "ok" : "fail",
        requestId: String(entry?.requestId || ""),
        database: String(entry?.database || ""),
        error: String(entry?.error || ""),
      }))
      .filter((entry) => entry.id && entry.at);
  } catch {
    return [];
  }
}

function writeHealthLog(entries) {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    window.localStorage.setItem(HEALTH_LOG_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage failures, the panel must keep working even without persistence.
  }
}

function formatLogTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function makeLogEntry({ status, data, error }) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    status,
    requestId: String(data?.requestId || ""),
    database: String(data?.checks?.database || ""),
    error: String(error || ""),
  };
}

export default function AdminHealthPanel({ canAdmin }) {
  const [healthState, setHealthState] = useState({
    loading: false,
    data: null,
    error: null,
  });
  const [healthLog, setHealthLog] = useState(() => readHealthLog());
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    writeHealthLog(healthLog);
  }, [healthLog]);

  const appendHealthLog = useCallback((entry) => {
    setHealthLog((currentEntries) => {
      const nextEntries = [entry, ...currentEntries].slice(0, MAX_HEALTH_LOG_ENTRIES);
      return nextEntries;
    });
  }, []);

  const onHealth = useCallback(async () => {
    if (!canAdmin) return;
    setHealthState({ loading: true, data: null, error: null });
    try {
      const data = await getHealth();
      if (!isMountedRef.current) return;
      setHealthState({ loading: false, data, error: null });
      appendHealthLog(makeLogEntry({ status: "ok", data }));
    } catch (error) {
      if (!isMountedRef.current) return;
      const formattedError = formatApiError(error);
      setHealthState({
        loading: false,
        data: null,
        error: formattedError,
      });
      appendHealthLog(makeLogEntry({ status: "fail", error: formattedError }));
    }
  }, [appendHealthLog, canAdmin]);

  useEffect(() => {
    if (!canAdmin) return undefined;

    void onHealth();
    const timerId = window.setInterval(() => {
      void onHealth();
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [canAdmin, onHealth]);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Conectividade backend</h3>
          <p className="mt-1 text-xs text-slate-600">
            Integracao direta com backend em{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-violet-700">
              {API_BASE_URL}
            </code>
            .
          </p>
        </div>
        {!canAdmin ? (
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
            Somente ADMIN
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onHealth}
          disabled={!canAdmin || healthState.loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {healthState.loading ? "Consultando..." : "Testar /health"}
        </button>
        {healthState.error ? (
          <span className="text-sm text-rose-700">{healthState.error}</span>
        ) : null}
        {canAdmin ? (
          <span className="text-xs text-slate-500">
            Atualização automática a cada 120 horas enquanto a tela estiver aberta.
          </span>
        ) : null}
        {healthState.data ? (
          <div className="flex flex-col gap-3 text-sm text-slate-700">
            <span className="text-emerald-700">
              OK ({healthState.data.status}) requestId={healthState.data.requestId}
            </span>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Commit
                </div>
                <div className="font-mono text-xs text-slate-800">{renderValue(healthState.data.git?.commit)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Branch
                </div>
                <div className="font-mono text-xs text-slate-800">{renderValue(healthState.data.git?.branch)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Método de deploy
                </div>
                <div className="text-xs font-semibold text-slate-800">{renderValue(healthState.data.deploy?.method)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Build timestamp
                </div>
                <div className="font-mono text-xs text-slate-800">{renderValue(healthState.data.build?.timestamp)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Build source
                </div>
                <div className="text-xs font-semibold text-slate-800">{renderValue(healthState.data.build?.source)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Versão backend
                </div>
                <div className="text-xs font-semibold text-slate-800">{renderValue(healthState.data.build?.version)}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                authEnabled={String(Boolean(healthState.data.authEnabled))}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-600">
                database={renderValue(healthState.data.checks?.database)}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {canAdmin ? (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800">Historico dos ultimos 10 testes</h4>
            <span className="text-xs text-slate-500">
              Persistido localmente nesta navegacao.
            </span>
          </div>
          <ol className="mt-3 space-y-2" aria-label="Historico dos ultimos 10 testes">
            {healthLog.length ? (
              healthLog.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 md:flex-row md:items-start md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          entry.status === "ok"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {entry.status === "ok" ? "OK" : "Falha"}
                      </span>
                      <span className="font-mono text-slate-500">{formatLogTimestamp(entry.at)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.requestId ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                          requestId={entry.requestId}
                        </span>
                      ) : null}
                      {entry.database ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                          database={entry.database}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {entry.error ? (
                    <div className="max-w-2xl text-rose-700">{entry.error}</div>
                  ) : null}
                </li>
              ))
            ) : (
              <li className="list-none rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                Nenhum teste registrado ainda.
              </li>
            )}
          </ol>
        </div>
      ) : null}
    </article>
  );
}
