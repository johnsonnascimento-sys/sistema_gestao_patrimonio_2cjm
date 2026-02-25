/**
 * Modulo: frontend/components
 * Arquivo: PatrimonioAuditPanel.jsx
 * Funcao no sistema: listar a auditoria patrimonial global para consulta centralizada de alteracoes.
 */
import { useEffect, useMemo, useState } from "react";
import { listarAuditoriaPatrimonio } from "../services/apiClient.js";

const TABLE_OPTIONS = [
  { value: "", label: "Todas as tabelas" },
  { value: "bens", label: "bens" },
  { value: "catalogo_bens", label: "catalogo_bens" },
  { value: "movimentacoes", label: "movimentacoes" },
  { value: "contagens", label: "contagens" },
  { value: "historico_transferencias", label: "historico_transferencias" },
  { value: "documentos", label: "documentos" },
];

const OP_OPTIONS = [
  { value: "", label: "Todas as operacoes" },
  { value: "INSERT", label: "INSERT" },
  { value: "UPDATE", label: "UPDATE" },
  { value: "DELETE", label: "DELETE" },
];

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return String(value);
  }
}

function actorLabel(item) {
  if (item?.executorNome) {
    return item.executorMatricula
      ? `${item.executorNome} (${item.executorMatricula})`
      : item.executorNome;
  }
  return String(item?.executadoPor || "-");
}

export default function PatrimonioAuditPanel({ canAdmin }) {
  const [filters, setFilters] = useState({
    q: "",
    numeroTombamento: "",
    tabela: "",
    operacao: "",
  });
  const [paging, setPaging] = useState({ limit: 30, offset: 0, total: 0 });
  const [state, setState] = useState({ loading: false, data: null, error: null });

  const loadAudit = async (nextOffset = paging.offset, forcedFilters = null) => {
    if (!canAdmin) return;
    const activeFilters = forcedFilters || filters;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await listarAuditoriaPatrimonio({
        limit: paging.limit,
        offset: nextOffset,
        q: activeFilters.q.trim() || undefined,
        numeroTombamento: activeFilters.numeroTombamento.trim() || undefined,
        tabela: activeFilters.tabela || undefined,
        operacao: activeFilters.operacao || undefined,
      });
      setState({ loading: false, data, error: null });
      setPaging((prev) => ({
        ...prev,
        offset: nextOffset,
        total: Number(data?.paging?.total || 0),
      }));
    } catch (error) {
      setState({ loading: false, data: null, error: String(error?.message || "Falha ao carregar auditoria global.") });
    }
  };

  useEffect(() => {
    if (!canAdmin) return;
    void loadAudit(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  const items = state.data?.items || [];
  const canPrev = paging.offset > 0;
  const canNext = paging.offset + paging.limit < paging.total;
  const rangeLabel = useMemo(() => {
    if (!paging.total) return "0 de 0";
    const from = paging.offset + 1;
    const to = Math.min(paging.offset + paging.limit, paging.total);
    return `${from}-${to} de ${paging.total}`;
  }, [paging.offset, paging.limit, paging.total]);

  const onSubmit = (event) => {
    event.preventDefault();
    void loadAudit(0);
  };

  if (!canAdmin) {
    return (
      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Auditoria Patrimonial (Global)</h3>
        <p className="mt-2 text-sm text-rose-700">Acesso restrito ao perfil ADMIN.</p>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Auditoria Patrimonial (Global)</h3>
          <p className="mt-1 text-xs text-slate-600">
            Veja alteracoes de patrimonio sem abrir tombo por tombo.
          </p>
        </div>
        <div className="text-xs text-slate-600">{rangeLabel}</div>
      </div>

      <form onSubmit={onSubmit} className="mt-3 grid gap-3 md:grid-cols-5">
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-slate-600">Busca geral</span>
          <input
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            placeholder="usuario, descricao, tabela..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Tombo</span>
          <input
            value={filters.numeroTombamento}
            onChange={(e) => setFilters((prev) => ({ ...prev, numeroTombamento: e.target.value.replace(/\D+/g, "").slice(0, 10) }))}
            placeholder="1010021572"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Tabela</span>
          <select
            value={filters.tabela}
            onChange={(e) => setFilters((prev) => ({ ...prev, tabela: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {TABLE_OPTIONS.map((it) => (
              <option key={it.value || "all"} value={it.value}>{it.label}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Operacao</span>
          <select
            value={filters.operacao}
            onChange={(e) => setFilters((prev) => ({ ...prev, operacao: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {OP_OPTIONS.map((it) => (
              <option key={it.value || "all"} value={it.value}>{it.label}</option>
            ))}
          </select>
        </label>

        <div className="md:col-span-5 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={state.loading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {state.loading ? "Consultando..." : "Consultar"}
          </button>
          <button
            type="button"
            onClick={() => {
              const clean = { q: "", numeroTombamento: "", tabela: "", operacao: "" };
              setFilters(clean);
              void loadAudit(0, clean);
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
          >
            Limpar
          </button>
          <button
            type="button"
            disabled={!canPrev || state.loading}
            onClick={() => void loadAudit(Math.max(0, paging.offset - paging.limit))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={!canNext || state.loading}
            onClick={() => void loadAudit(paging.offset + paging.limit)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-40"
          >
            Proxima
          </button>
        </div>
      </form>

      {state.error ? <p className="mt-3 text-sm text-rose-700">{state.error}</p> : null}

      <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">Tombo</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Tabela</th>
              <th className="px-3 py-2">Operacao</th>
              <th className="px-3 py-2">Campos alterados</th>
              <th className="px-3 py-2">Executado por</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">{formatDateTime(it.executadoEm)}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-800">{it.numeroTombamento || "-"}</td>
                <td className="px-3 py-2 text-slate-700">
                  {it.nomeResumo || it.descricaoComplementar || (it.codigoCatalogo ? `Catalogo ${it.codigoCatalogo}` : "-")}
                </td>
                <td className="px-3 py-2 text-slate-700">{it.tabela}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
                    {it.operacao}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {Array.isArray(it.camposAlterados) && it.camposAlterados.length
                    ? it.camposAlterados.slice(0, 5).join(", ")
                    : "-"}
                </td>
                <td className="px-3 py-2 text-slate-700">{actorLabel(it)}</td>
              </tr>
            ))}
            {!items.length && !state.loading ? (
              <tr>
                <td className="px-3 py-4 text-slate-600" colSpan={7}>
                  Nenhuma alteracao patrimonial encontrada para os filtros informados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}

