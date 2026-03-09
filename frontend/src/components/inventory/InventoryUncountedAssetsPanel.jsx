/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryUncountedAssetsPanel.jsx
 * Funcao no sistema: renderizar o painel operacional de bens nao contados por endereco no cockpit do inventario.
 */
import { KpiMini } from "./InventoryAdminUi.jsx";

export default function InventoryUncountedAssetsPanel({
  query,
  summary,
  percentualCobertura,
  groups,
  visibleByGroup,
  onRefresh,
  onOpenInventoryCount,
  onOpenAssetDetail,
  onOpenAssetsExplorerBySku,
  onExpandGroup,
  formatPercent,
  formatUnidade,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Bens não contados</h4>
          <p className="mt-1 text-[11px] text-slate-600">Pendências por endereço para o evento em andamento.</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-100"
        >
          Atualizar
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <KpiMini label="Não contados" value={summary.totalNaoLocalizados} tone="amber" />
        <KpiMini label="Endereços críticos" value={summary.totalEnderecosComPendencia} tone="orange" />
        <KpiMini label="% de cobertura" value={formatPercent(percentualCobertura)} tone="sky" />
        <KpiMini label="Contados / Esperados" value={`${summary.totalContados} / ${summary.totalBensEsperados}`} tone="violet" />
      </div>

      {query.isLoading ? (
        <p className="mt-3 text-xs text-slate-500">Carregando pendências de contagem...</p>
      ) : query.error ? (
        <p className="mt-3 text-xs text-rose-700">Falha ao carregar bens não contados.</p>
      ) : groups.length === 0 ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          Nenhum bem pendente de contagem neste evento.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map((group) => {
            const localKey = String(group.localId || group.localNome || "");
            const items = Array.isArray(group.items) ? group.items : [];
            const visibleCount = Math.max(20, Number(visibleByGroup[localKey] || 20));
            const visibleItems = items.slice(0, visibleCount);
            const hasMore = items.length > visibleItems.length;

            return (
              <details key={localKey} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{group.localNome || "Endereço sem nome"}</span>
                      <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        {group.qtdNaoLocalizados || 0} pendente(s)
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Cobertura {formatPercent(group.percentualCobertura)} | Contados {group.qtdContados || 0} de {group.qtdEsperados || 0}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOpenInventoryCount(group);
                    }}
                    className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                  >
                    Abrir contagem do endereço
                  </button>
                </summary>

                <div className="mt-3 overflow-hidden rounded-xl border border-amber-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-amber-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left">Tombo</th>
                          <th className="px-3 py-2 text-left">Material (SKU)</th>
                          <th className="px-3 py-2 text-left">Descrição</th>
                          <th className="px-3 py-2 text-left">Unidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleItems.map((item) => (
                          <tr key={String(item.bemId || item.numeroTombamento)} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-mono text-slate-900">
                              {item.numeroTombamento ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenAssetDetail(item)}
                                  className="font-mono text-violet-700 hover:underline"
                                  title="Abrir detalhes do bem"
                                >
                                  {item.numeroTombamento}
                                </button>
                              ) : "-"}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {item.codigoCatalogo ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenAssetsExplorerBySku(item)}
                                  className="font-mono text-emerald-700 hover:underline"
                                  title="Abrir Consulta de Bens filtrada por Material (SKU)"
                                >
                                  {item.codigoCatalogo}
                                </button>
                              ) : "-"}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{item.nomeResumo || "-"}</td>
                            <td className="px-3 py-2 text-slate-700">{formatUnidade(Number(item.unidadeDonaId))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {hasMore ? (
                    <div className="border-t border-amber-100 bg-amber-50/60 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onExpandGroup(localKey, items.length)}
                        className="text-xs font-semibold text-violet-700 hover:text-violet-900"
                      >
                        Ver mais ({items.length - visibleItems.length} restantes)
                      </button>
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
