/**
 * Modulo: frontend/components
 * Arquivo: AdminHealthPanel.jsx
 * Funcao no sistema: exibir conectividade backend (/health) para operacao administrativa.
 */
import { useState } from "react";
import { API_BASE_URL, getHealth } from "../services/apiClient.js";

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

export default function AdminHealthPanel({ canAdmin }) {
  const [healthState, setHealthState] = useState({
    loading: false,
    data: null,
    error: null,
  });

  const onHealth = async () => {
    setHealthState({ loading: true, data: null, error: null });
    try {
      const data = await getHealth();
      setHealthState({ loading: false, data, error: null });
    } catch (error) {
      setHealthState({
        loading: false,
        data: null,
        error: formatApiError(error),
      });
    }
  };

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
    </article>
  );
}
