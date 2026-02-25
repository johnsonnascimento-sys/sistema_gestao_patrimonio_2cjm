/**
 * Modulo: frontend/components
 * Arquivo: RuntimeErrorLogPanel.jsx
 * Funcao no sistema: exibir log de erros runtime da API para suporte operacional.
 */
import { useEffect, useState } from "react";
import { listarErrosRuntime } from "../services/apiClient.js";

function formatDateTimeUtc(value) {
  if (!value) return "-";
  try {
    return `${new Date(value).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC`;
  } catch {
    return String(value);
  }
}

export default function RuntimeErrorLogPanel({ canAdmin }) {
  const [state, setState] = useState({ loading: false, data: null, error: null });

  const loadErrors = async () => {
    if (!canAdmin) return;
    setState({ loading: true, data: null, error: null });
    try {
      const data = await listarErrosRuntime({ limit: 100 });
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: String(error?.message || "Falha ao carregar log de erros.") });
    }
  };

  useEffect(() => {
    if (!canAdmin) return;
    void loadErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  if (!canAdmin) return null;
  const items = state.data?.items || [];

  return (
    <article className="rounded-xl border border-rose-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-rose-900">Log de Erros Runtime (API)</h3>
          <p className="mt-1 text-xs text-slate-600">
            Registro separado para diagnostico de falhas como FORMATO_INVALIDO, validacoes e erros internos.
          </p>
        </div>
        <button
          type="button"
          onClick={loadErrors}
          disabled={state.loading}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {state.loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {state.error ? <p className="mt-3 text-sm text-rose-700">{state.error}</p> : null}

      <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2">Data/Hora UTC</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Codigo</th>
              <th className="px-3 py-2">Rota</th>
              <th className="px-3 py-2">Mensagem</th>
              <th className="px-3 py-2">RequestId</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.map((it, idx) => (
              <tr key={`${it.requestId || "sem-id"}-${idx}`} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">{formatDateTimeUtc(it.tsUtc)}</td>
                <td className="px-3 py-2 text-slate-700">{it.status ?? "-"}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                    {it.code || "-"}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{it.method} {it.path}</td>
                <td className="px-3 py-2 text-slate-700">{it.message || "-"}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{it.requestId || "-"}</td>
              </tr>
            ))}
            {!items.length && !state.loading ? (
              <tr>
                <td className="px-3 py-4 text-slate-600" colSpan={6}>
                  Nenhum erro runtime registrado recentemente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

