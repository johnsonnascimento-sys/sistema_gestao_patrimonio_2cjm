/**
 * Modulo: frontend/components
 * Arquivo: DashboardPanel.jsx
 * Funcao no sistema: dashboard executivo operacional de abertura da aplicacao.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
import {
  getStats,
  listarAuditoriaPatrimonio,
  listarEventosInventario,
} from "../services/apiClient.js";

function unidadeLabel(unidade) {
  const id = Number(unidade || 0);
  if (id === 1) return "1a Aud";
  if (id === 2) return "2a Aud";
  if (id === 3) return "Foro";
  if (id === 4) return "Almox";
  return `Unidade ${String(unidade || "-")}`;
}

function statusLabel(status) {
  const s = String(status || "").toUpperCase();
  if (s === "OK") return "Prontos";
  if (s === "EM_CAUTELA") return "Em cautela";
  if (s === "BAIXADO") return "Baixados";
  if (s === "AGUARDANDO_RECEBIMENTO") return "Aguardando";
  return s || "Outro";
}

export default function DashboardPanel({ onNavigate }) {
  const auth = useAuth();
  const canAdmin = !auth.authEnabled || String(auth.role || "").toUpperCase() === "ADMIN";
  const [showMap, setShowMap] = useState(false);

  const statsQuery = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: async () => getStats(false),
  });

  const eventosAtivosQuery = useQuery({
    queryKey: ["dashboardInventarioAtivo"],
    queryFn: async () => {
      const data = await listarEventosInventario("EM_ANDAMENTO");
      return data.items || [];
    },
  });

  const recentAuditQuery = useQuery({
    queryKey: ["dashboardRecentAudit"],
    enabled: canAdmin,
    queryFn: async () => {
      const data = await listarAuditoriaPatrimonio({ limit: 8, offset: 0 });
      return data.items || [];
    },
  });

  const recentEventosQuery = useQuery({
    queryKey: ["dashboardRecentEventos"],
    enabled: !canAdmin,
    queryFn: async () => {
      const data = await listarEventosInventario();
      return data.items || [];
    },
  });

  const totalBens = Number(statsQuery.data?.bens?.total || 0);
  const porUnidade = useMemo(() => {
    const rows = statsQuery.data?.bens?.porUnidade || [];
    return [...rows].sort((a, b) => Number(a.unidade || 0) - Number(b.unidade || 0));
  }, [statsQuery.data?.bens?.porUnidade]);

  const kpis = useMemo(() => {
    const byStatus = new Map();
    for (const row of statsQuery.data?.bens?.porStatus || []) {
      byStatus.set(String(row.status || "").toUpperCase(), Number(row.total || 0));
    }
    const keys = ["OK", "EM_CAUTELA", "BAIXADO", "AGUARDANDO_RECEBIMENTO"];
    return keys.map((key) => ({ key, total: byStatus.get(key) || 0 }));
  }, [statsQuery.data?.bens?.porStatus]);

  const eventoAtivo = (eventosAtivosQuery.data || [])[0] || null;
  const recentRows = canAdmin ? (recentAuditQuery.data || []) : (recentEventosQuery.data || []);

  const quickActions = [
    { id: "bens", label: "Consulta de Bens" },
    { id: "movimentacoes", label: "Movimentacoes" },
    { id: "inventario-contagem", label: "Inventario - Contagem" },
    { id: "importacoes-geafin", label: "Importacoes" },
  ];

  return (
    <section className="mt-6 space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Dashboard Executivo</p>
          <h2 className="mt-2 font-[Space_Grotesk] text-3xl font-semibold text-slate-900">
            Bem-vindo, {auth?.perfil?.nome ? String(auth.perfil.nome).split(" ")[0] : "Operador"}.
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Panorama operacional consolidado para consulta, inventario e rastreabilidade patrimonial.
          </p>
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total de bens</p>
            <p className="mt-1 font-[Space_Grotesk] text-4xl font-bold text-violet-700">
              {statsQuery.isLoading ? "..." : totalBens}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onNavigate?.(action.id)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Distribuicao por unidade</p>
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {showMap ? "Ocultar mapa" : "Mapa opcional"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {porUnidade.map((row) => (
              <div key={`u-${row.unidade}`} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-700">{unidadeLabel(row.unidade)}</span>
                <span className="text-sm font-semibold text-slate-900">{Number(row.total || 0)}</span>
              </div>
            ))}
            {!porUnidade.length && !statsQuery.isLoading ? (
              <p className="text-sm text-slate-500">Sem dados de distribuicao.</p>
            ) : null}
          </div>
          {showMap ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Mapa ilustrativo</p>
              <svg className="mt-2 h-40 w-full text-violet-400" viewBox="0 0 240 120" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="234" height="114" rx="10" stroke="currentColor" />
                <path d="M20 70 L55 48 L88 56 L112 36 L150 52 L170 40 L208 58 L188 88 L140 82 L96 96 L58 84 Z" fill="currentColor" fillOpacity="0.18" stroke="currentColor" />
                <circle cx="55" cy="48" r="3.2" fill="currentColor" />
                <circle cx="112" cy="36" r="3.2" fill="currentColor" />
                <circle cx="170" cy="40" r="3.2" fill="currentColor" />
                <circle cx="96" cy="96" r="3.2" fill="currentColor" />
              </svg>
            </div>
          ) : null}
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-slate-500">{statusLabel(kpi.key)}</p>
            <p className="mt-1 font-[Space_Grotesk] text-2xl font-semibold text-slate-900">{kpi.total}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Inventario ativo</h3>
          {eventosAtivosQuery.isLoading ? (
            <p className="mt-3 text-sm text-slate-600">Carregando status...</p>
          ) : eventoAtivo ? (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Evento:</span> {eventoAtivo.codigoEvento}
              </p>
              <p>
                <span className="font-semibold">Unidade:</span> {eventoAtivo.unidadeInventariadaId ?? "Geral"}
              </p>
              <p>
                <span className="font-semibold">Status:</span> {eventoAtivo.status}
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.("inventario-admin")}
                className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Abrir Inventario - Administracao
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
              Sem inventario em andamento no momento.
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">
            {canAdmin ? "Atividade recente do patrimonio" : "Eventos recentes de inventario"}
          </h3>
          <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2">{canAdmin ? "Tipo" : "Evento"}</th>
                  <th className="px-3 py-2">{canAdmin ? "Item" : "Unidade"}</th>
                  <th className="px-3 py-2">{canAdmin ? "Operacao" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentRows.slice(0, 8).map((row, idx) => (
                  <tr key={`${row.id || "row"}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-700">
                      {canAdmin
                        ? new Date(row.executadoEm || Date.now()).toLocaleString("pt-BR")
                        : new Date(row.criadoEm || row.updatedAt || Date.now()).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {canAdmin ? (row.tabela || "-") : (row.codigoEvento || "-")}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {canAdmin
                        ? (row.numeroTombamento || row.nomeResumo || "-")
                        : (row.unidadeInventariadaId ?? "Geral")}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {canAdmin ? (row.operacao || "-") : (row.status || "-")}
                    </td>
                  </tr>
                ))}
                {!recentRows.length ? (
                  <tr>
                    <td className="px-3 py-4 text-slate-600" colSpan={4}>
                      Sem registros recentes para exibir.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
