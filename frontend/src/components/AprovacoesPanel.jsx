/**
 * Modulo: frontend/components
 * Arquivo: AprovacoesPanel.jsx
 * Funcao no sistema: listar e decidir solicitacoes de aprovacao administrativa.
 */
import { useEffect, useMemo, useState } from "react";
import {
  aprovarSolicitacaoAprovacao,
  listarSolicitacoesAprovacao,
  reprovarSolicitacaoAprovacao,
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

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PENDENTE", label: "Pendente" },
  { value: "APROVADA", label: "Aprovada" },
  { value: "REPROVADA", label: "Reprovada" },
  { value: "ERRO_APLICACAO", label: "Erro de aplicacao" },
];

export default function AprovacoesPanel() {
  const [state, setState] = useState({ loading: false, data: null, error: null });
  const [statusFiltro, setStatusFiltro] = useState("PENDENTE");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [actionState, setActionState] = useState({ loading: false, error: null, message: null, id: null });

  const items = useMemo(() => state.data?.items || [], [state.data]);

  const loadSolicitacoes = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await listarSolicitacoesAprovacao({
        status: statusFiltro || undefined,
        tipoAcao: tipoFiltro || undefined,
        limit: 100,
        offset: 0,
      });
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  useEffect(() => {
    void loadSolicitacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFiltro, tipoFiltro]);

  const onAprovar = async (id) => {
    if (!id) return;
    setActionState({ loading: true, error: null, message: null, id });
    try {
      const resp = await aprovarSolicitacaoAprovacao(id, {
        adminPassword,
        justificativaAdmin: justificativa || undefined,
      });
      setActionState({
        loading: false,
        error: null,
        message: String(resp?.message || "Acao aprovada e aplicada com sucesso."),
        id: null,
      });
      await loadSolicitacoes();
    } catch (error) {
      setActionState({ loading: false, error: formatApiError(error), message: null, id: null });
    }
  };

  const onReprovar = async (id) => {
    if (!id) return;
    setActionState({ loading: true, error: null, message: null, id });
    try {
      const resp = await reprovarSolicitacaoAprovacao(id, {
        adminPassword,
        justificativaAdmin: justificativa,
      });
      setActionState({
        loading: false,
        error: null,
        message: String(resp?.message || "Acao reprovada."),
        id: null,
      });
      await loadSolicitacoes();
    } catch (error) {
      setActionState({ loading: false, error: formatApiError(error), message: null, id: null });
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Fila de aprovacoes</h3>
          <p className="mt-1 text-xs text-slate-600">
            Use a senha de administrador para aprovar ou reprovar solicitacoes sensiveis.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSolicitacoes}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
          disabled={state.loading || actionState.loading}
        >
          {state.loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Status</span>
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((it) => (
              <option key={it.value || "all"} value={it.value}>{it.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Tipo acao</span>
          <input
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            placeholder="Ex.: BEM_PATCH"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Senha admin</span>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <label className="mt-3 block space-y-1">
        <span className="text-xs text-slate-600">Justificativa admin (obrigatoria para reprovar)</span>
        <textarea
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </label>

      {state.error ? <p className="mt-3 text-sm text-rose-700">{state.error}</p> : null}
      {actionState.error ? <p className="mt-2 text-sm text-rose-700">{actionState.error}</p> : null}
      {actionState.message ? <p className="mt-2 text-sm text-emerald-700">{actionState.message}</p> : null}

      <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Criado em</th>
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Solicitante</th>
              <th className="px-3 py-2 text-left font-semibold">Detalhe</th>
              <th className="px-3 py-2 text-left font-semibold">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {!state.loading && !items.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-500">Nenhuma solicitacao encontrada.</td>
              </tr>
            ) : null}
            {items.map((item) => {
              const canDecide = String(item?.status || "") === "PENDENTE";
              return (
                <tr key={item.id} className="border-t border-slate-200 align-top">
                  <td className="px-3 py-2 text-slate-700">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{item.tipoAcao || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{item.status || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {item.solicitanteNome || "-"}
                    <div className="text-xs text-slate-500">{item.solicitanteMatricula || ""}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {item.justificativaSolicitante || "-"}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[11px] text-slate-500">Payload</summary>
                      <pre className="mt-1 max-w-[420px] overflow-auto rounded bg-slate-100 p-2 text-[11px]">{JSON.stringify(item.payload || {}, null, 2)}</pre>
                    </details>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canDecide || actionState.loading}
                        onClick={() => onAprovar(String(item.id))}
                        className="rounded-md border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        disabled={!canDecide || actionState.loading}
                        onClick={() => onReprovar(String(item.id))}
                        className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Reprovar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
