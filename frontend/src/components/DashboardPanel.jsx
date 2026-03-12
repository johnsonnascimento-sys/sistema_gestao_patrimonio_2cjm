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
  listarSolicitacoesAprovacao,
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
  if (s === "EM_PROCESSO_BAIXA") return "Em processo de baixa";
  if (s === "AGUARDANDO_RECEBIMENTO") return "Aguardando";
  return s || "Outro";
}

function statusCardClass(status) {
  const s = String(status || "").toUpperCase();
  if (s === "EM_PROCESSO_BAIXA") return "border-rose-300 bg-rose-50 shadow-sm shadow-rose-100";
  return "border-slate-200 bg-white";
}

function statusValueClass(status) {
  const s = String(status || "").toUpperCase();
  if (s === "EM_PROCESSO_BAIXA") return "text-rose-700";
  return "text-slate-900";
}

function CjmBuildingMapIllustration({
  selectedFloor,
  hoveredFloor,
  onSelectFloor,
  onHoverFloor,
  onLeaveFloor,
}) {
  const floors = 8;
  const leftTop = 62;
  const leftBottom = 201;
  const centerTop = 42;
  const centerBottom = 180;
  const rightTop = 64;
  const rightBottom = 200;
  const leftStep = (leftBottom - leftTop) / floors;
  const centerStep = (centerBottom - centerTop) / floors;
  const rightStep = (rightBottom - rightTop) / floors;

  return (
    <svg className="mt-2 h-52 w-full" viewBox="0 0 520 230" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="bgSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eef2ff" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>
        <linearGradient id="facadeLeft" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <linearGradient id="facadeRight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#dbe4f3" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="516" height="226" rx="14" fill="url(#bgSky)" stroke="#c4b5fd" />

      <path d="M22 185 L138 165 L290 170 L490 150" stroke="#cbd5e1" strokeWidth="2" />
      <path d="M18 198 L170 176 L292 183 L504 163" stroke="#e2e8f0" strokeWidth="2" />
      <circle cx="314" cy="171" r="8" fill="#8b5cf6" fillOpacity="0.16" stroke="#7c3aed" />
      <circle cx="314" cy="171" r="3.5" fill="#7c3aed" />

      <polygon points="152,62 286,42 286,180 152,201" fill="url(#facadeLeft)" stroke="#94a3b8" />
      <polygon points="286,42 390,64 390,200 286,180" fill="url(#facadeRight)" stroke="#94a3b8" />
      <rect x="273" y="44" width="27" height="139" rx="12" fill="#ede9fe" stroke="#a78bfa" />

      <path d="M150 60 Q218 24 286 42 Q336 56 392 62" stroke="#94a3b8" strokeWidth="3" fill="none" />
      <path d="M150 205 L286 184 L390 202" stroke="#94a3b8" strokeWidth="3" />

      {Array.from({ length: floors - 1 }).map((_, idx) => {
        const i = idx + 1;
        const yLeft = leftTop + (i * leftStep);
        const yCorner = centerTop + (i * centerStep);
        const yRight = rightTop + (i * rightStep);
        return (
          <g key={`floor-line-${i}`}>
            <line x1="154" y1={yLeft} x2="284" y2={yCorner} stroke="#cbd5e1" />
            <line x1="288" y1={yCorner} x2="388" y2={yRight} stroke="#cbd5e1" />
            <line x1="275" y1={yCorner + 1} x2="299" y2={yCorner + 1} stroke="#c4b5fd" />
          </g>
        );
      })}

      {Array.from({ length: floors }).map((_, floor) => {
        const yLeft = 66 + (floor * leftStep);
        const yRight = 67 + (floor * rightStep);
        const yTower = 49 + (floor * centerStep);
        return (
          <g key={`windows-${floor}`}>
            {[165, 191, 217, 243].map((x) => (
              <rect key={`l-${floor}-${x}`} x={x} y={yLeft} width="18" height="9" rx="1.5" fill="#cbd5e1" />
            ))}
            {[300, 326, 352].map((x) => (
              <rect key={`r-${floor}-${x}`} x={x} y={yRight} width="18" height="9" rx="1.5" fill="#c7d2fe" />
            ))}
            <rect x="279" y={yTower} width="6" height="10" rx="1.2" fill="#a78bfa" />
            <rect x="288" y={yTower} width="6" height="10" rx="1.2" fill="#a78bfa" />
          </g>
        );
      })}

      {Array.from({ length: floors }).map((_, idx) => {
        const floor = floors - idx;
        const yL1 = leftTop + (idx * leftStep);
        const yL2 = leftTop + ((idx + 1) * leftStep);
        const yC1 = centerTop + (idx * centerStep);
        const yC2 = centerTop + ((idx + 1) * centerStep);
        const yR1 = rightTop + (idx * rightStep);
        const yR2 = rightTop + ((idx + 1) * rightStep);
        const active = selectedFloor === floor;
        const hover = hoveredFloor === floor;
        const fill = active ? "rgba(124,58,237,0.24)" : hover ? "rgba(167,139,250,0.2)" : "transparent";
        const stroke = active ? "#6d28d9" : hover ? "#8b5cf6" : "transparent";
        return (
          <g
            key={`floor-hit-${floor}`}
            onMouseEnter={() => onHoverFloor?.(floor)}
            onMouseLeave={() => onLeaveFloor?.()}
            onClick={() => onSelectFloor?.(floor)}
            style={{ cursor: "pointer" }}
          >
            <polygon
              points={`152,${yL1} 286,${yC1} 390,${yR1} 390,${yR2} 286,${yC2} 152,${yL2}`}
              fill={fill}
              stroke={stroke}
              strokeWidth="1.2"
            />
            <text
              x="144"
              y={(yL1 + yL2) / 2 + 4}
              fontSize="10"
              fill={active ? "#5b21b6" : "#64748b"}
              textAnchor="end"
            >
              {floor}o
            </text>
          </g>
        );
      })}

      <rect x="258" y="184" width="60" height="22" rx="3" fill="#e2e8f0" stroke="#94a3b8" />
      <rect x="277" y="189" width="23" height="17" rx="2" fill="#475569" />
      <path d="M286 184 L286 172 M292 184 L292 171" stroke="#94a3b8" />

      <text x="18" y="24" fill="#64748b" fontSize="11" fontWeight="600" letterSpacing="1.2">
        MAPA ILUSTRATIVO - PREDIO 2a CJM (8 ANDARES)
      </text>
      <text x="18" y="218" fill="#475569" fontSize="11">
        Av. Casper Libero, 88 - Centro Histórico de Sao Paulo
      </text>
      <text x="482" y="24" fill="#7c3aed" fontSize="11" fontWeight="600" textAnchor="end">
        Clique no andar
      </text>
    </svg>
  );
}

export default function DashboardPanel({ onNavigate }) {
  const auth = useAuth();
  const canAdmin = !auth.authEnabled || String(auth.role || "").toUpperCase() === "ADMIN";
  const canListarAprovacoes = !auth.authEnabled || auth.can("action.aprovacao.listar") || canAdmin;
  const [showMap, setShowMap] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState(8);
  const [hoveredFloor, setHoveredFloor] = useState(null);

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

  const aprovacoesPendentesQuery = useQuery({
    queryKey: ["dashboardAprovacoesPendentes"],
    enabled: canListarAprovacoes,
    queryFn: async () => {
      const data = await listarSolicitacoesAprovacao({ status: "PENDENTE", limit: 6, offset: 0 });
      return {
        items: Array.isArray(data?.items) ? data.items : [],
        total: Number(data?.paging?.total || 0),
      };
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
    return [
      { key: "OK", total: byStatus.get("OK") || 0 },
      { key: "EM_CAUTELA", total: byStatus.get("EM_CAUTELA") || 0 },
      { key: "EM_PROCESSO_BAIXA", total: Number(statsQuery.data?.bens?.emProcessoBaixa || 0) },
      { key: "BAIXADO", total: byStatus.get("BAIXADO") || 0 },
      { key: "AGUARDANDO_RECEBIMENTO", total: byStatus.get("AGUARDANDO_RECEBIMENTO") || 0 },
    ];
  }, [statsQuery.data?.bens?.emProcessoBaixa, statsQuery.data?.bens?.porStatus]);

  const eventosAtivos = eventosAtivosQuery.data || [];
  const recentRows = canAdmin ? (recentAuditQuery.data || []) : (recentEventosQuery.data || []);

  const quickActions = [
    { id: "bens", label: "Consulta de Bens" },
    { id: "movimentacoes", label: "Movimentações" },
    { id: "operacoes-cadastro-sala", label: "Cadastrar bens por Endereço" },
    { id: "inventario-contagem", label: "Inventário -> Contagem" },
    { id: "importacoes-geafin", label: "Importacao GEAFIN" },
  ];
  const activeFloor = hoveredFloor || selectedFloor;
  const goToBensByUnidade = (unidadeDonaId = null) => {
    onNavigate?.({
      id: "bens",
      filters: { unidadeDonaId },
    });
  };

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
            <button
              type="button"
              onClick={() => goToBensByUnidade(null)}
              className="w-full text-left"
              title="Abrir Consulta de Bens sem filtro de unidade"
            >
              <p className="text-xs uppercase tracking-widest text-slate-500">Total de bens</p>
              <p className="mt-1 font-[Space_Grotesk] text-4xl font-bold text-violet-700">
                {statsQuery.isLoading ? "..." : totalBens}
              </p>
            </button>
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
              <button
                key={`u-${row.unidade}`}
                type="button"
                onClick={() => goToBensByUnidade(Number(row.unidade))}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-100"
                title={`Abrir Consulta de Bens filtrada para ${unidadeLabel(row.unidade)}`}
              >
                <span className="text-sm text-slate-700">{unidadeLabel(row.unidade)}</span>
                <span className="text-sm font-semibold text-slate-900">{Number(row.total || 0)}</span>
              </button>
            ))}
            {!porUnidade.length && !statsQuery.isLoading ? (
              <p className="text-sm text-slate-500">Sem dados de distribuicao.</p>
            ) : null}
          </div>
          {showMap ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">Mapa ilustrativo</p>
              <div className="mt-2 grid gap-3 lg:grid-cols-[1fr_200px]">
                <CjmBuildingMapIllustration
                  selectedFloor={selectedFloor}
                  hoveredFloor={hoveredFloor}
                  onSelectFloor={setSelectedFloor}
                  onHoverFloor={setHoveredFloor}
                  onLeaveFloor={() => setHoveredFloor(null)}
                />
                <aside className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Andar selecionado</p>
                  <p className="mt-1 font-[Space_Grotesk] text-2xl font-semibold text-violet-700">{activeFloor}o</p>
                  <p className="mt-2 text-xs text-slate-600">
                    Mapa detalhado de endereços/localizacao ainda sera cadastrado por andar.
                  </p>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 8 }).map((_, idx) => {
                      const floor = 8 - idx;
                      const active = selectedFloor === floor;
                      return (
                        <button
                          key={`floor-btn-${floor}`}
                          type="button"
                          onClick={() => setSelectedFloor(floor)}
                          className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                            active
                              ? "border-violet-300 bg-violet-50 text-violet-700"
                              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {floor}o
                        </button>
                      );
                    })}
                  </div>
                </aside>
              </div>
            </div>
          ) : null}
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.key} className={`rounded-xl border p-4 shadow-sm ${statusCardClass(kpi.key)}`}>
            <p className="text-xs uppercase tracking-widest text-slate-500">{statusLabel(kpi.key)}</p>
            <p className={`mt-1 font-[Space_Grotesk] text-2xl font-semibold ${statusValueClass(kpi.key)}`}>{kpi.total}</p>
            {kpi.key === "EM_PROCESSO_BAIXA" ? (
              <p className="mt-2 text-xs font-semibold text-rose-700">
                Bens com baixa patrimonial aberta em Material Inservível / Baixa.
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <div className={`grid gap-6 ${canListarAprovacoes ? "xl:grid-cols-3" : "xl:grid-cols-[0.9fr_1.1fr]"}`}>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Inventário ativo</h3>
          {eventosAtivosQuery.isLoading ? (
            <p className="mt-3 text-sm text-slate-600">Carregando status...</p>
          ) : eventosAtivos.length ? (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p className="text-xs text-slate-600">
                {eventosAtivos.length > 1
                  ? `${eventosAtivos.length} eventos ativos em paralelo.`
                  : "1 evento ativo em andamento."}
              </p>
              <div className="space-y-2">
                {eventosAtivos.map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p><span className="font-semibold">Evento:</span> {ev.codigoEvento}</p>
                    <p><span className="font-semibold">Unidade:</span> {ev.unidadeInventariadaId ?? "Geral"}</p>
                    <p><span className="font-semibold">Status:</span> {ev.status}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.("inventario-admin")}
                className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Abrir Inventário / Administração
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

        {canListarAprovacoes ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-900">Aprovações pendentes</h3>
              <button
                type="button"
                onClick={() => onNavigate?.("admin-aprovacoes")}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Abrir fila
              </button>
            </div>
            {aprovacoesPendentesQuery.isLoading ? (
              <p className="mt-3 text-sm text-slate-600">Carregando pendências...</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Total pendente: <strong>{Number(aprovacoesPendentesQuery.data?.total || 0)}</strong>
                </p>
                <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Criada em</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Solicitante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(aprovacoesPendentesQuery.data?.items || []).slice(0, 6).map((row) => (
                        <tr key={String(row.id)} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-700">
                            {new Date(row.createdAt || Date.now()).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{row.tipoAcao || "-"}</td>
                          <td className="px-3 py-2 text-slate-700">
                            {row.solicitanteNome || row.solicitanteMatricula || "-"}
                          </td>
                        </tr>
                      ))}
                      {!(aprovacoesPendentesQuery.data?.items || []).length ? (
                        <tr>
                          <td className="px-3 py-4 text-slate-600" colSpan={3}>
                            Nenhuma aprovação pendente no momento.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </article>
        ) : null}
      </div>
    </section>
  );
}


