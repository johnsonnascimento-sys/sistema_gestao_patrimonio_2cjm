/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryAccuracyPanel.jsx
 * Funcao no sistema: renderizar indicadores gerenciais de acuracidade de inventario.
 */
import { KpiSemaforoCard, StatusBadge, TrendListCard } from "./InventoryAdminUi.jsx";

export default function InventoryAccuracyPanel({
    isPrimaryView = false,
    hasActiveEvent,
    acuraciaDataInicio,
    setAcuraciaDataInicio,
    acuraciaDataFim,
    setAcuraciaDataFim,
    acuraciaStatusEvento,
    setAcuraciaStatusEvento,
    acuraciaUnidadeId,
    setAcuraciaUnidadeId,
    acuraciaToleranciaPct,
    setAcuraciaToleranciaPct,
    acuraciaQuery,
    acuraciaResumo,
    acuraciaSemaforo,
    trendAcuracidadeExata,
    trendPendencia,
    trendCobertura,
    serieSemanalAcuracia,
    serieMensalAcuracia,
    topSalasCriticasAcuracia,
    formatUnidade,
}) {
    const primaryLabel = isPrimaryView || !hasActiveEvent ? "Painel principal" : "Área secundária";

    return (
        <details className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-5" open={isPrimaryView || !hasActiveEvent}>
            <summary className="flex list-none cursor-pointer flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-[Space_Grotesk] text-xl font-semibold">Acuracidade de Inventario</h3>
                    <p className="mt-1 text-xs text-slate-600">
                        Leitura gerencial e analitica para o pos-operacao do inventario.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={isPrimaryView ? "Leitura gerencial" : "Leitura secundaria"} tone="slate" />
                    <StatusBadge label={primaryLabel} tone={primaryLabel === "Painel principal" ? "violet" : "slate"} />
                    <button
                        type="button"
                        onClick={(event) => {
                            event.preventDefault();
                            acuraciaQuery.refetch();
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                    >
                        Atualizar painel
                    </button>
                </div>
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
                <label className="block space-y-1">
                    <span className="text-xs text-slate-600">Data início</span>
                    <input
                        type="date"
                        value={acuraciaDataInicio}
                        onChange={(e) => setAcuraciaDataInicio(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                </label>
                <label className="block space-y-1">
                    <span className="text-xs text-slate-600">Data fim</span>
                    <input
                        type="date"
                        value={acuraciaDataFim}
                        onChange={(e) => setAcuraciaDataFim(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                </label>
                <label className="block space-y-1">
                    <span className="text-xs text-slate-600">Status evento</span>
                    <select
                        value={acuraciaStatusEvento}
                        onChange={(e) => setAcuraciaStatusEvento(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                        <option value="ENCERRADO">ENCERRADO</option>
                        <option value="EM_ANDAMENTO">EM_ANDAMENTO</option>
                        <option value="CANCELADO">CANCELADO</option>
                    </select>
                </label>
                <label className="block space-y-1">
                    <span className="text-xs text-slate-600">Unidade</span>
                    <select
                        value={acuraciaUnidadeId}
                        onChange={(e) => setAcuraciaUnidadeId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                        <option value="">Todas</option>
                        <option value="1">{formatUnidade(1)}</option>
                        <option value="2">{formatUnidade(2)}</option>
                        <option value="3">{formatUnidade(3)}</option>
                        <option value="4">{formatUnidade(4)}</option>
                    </select>
                </label>
                <label className="block space-y-1">
                    <span className="text-xs text-slate-600">Tolerância % (0-10)</span>
                    <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={acuraciaToleranciaPct}
                        onChange={(e) => setAcuraciaToleranciaPct(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                </label>
            </div>

            {acuraciaQuery.isLoading ? <p className="mt-4 text-sm text-slate-600">Calculando indicadores...</p> : null}
            {acuraciaQuery.error ? (
                <p className="mt-4 text-sm text-rose-700">Falha ao calcular indicadores de acuracidade.</p>
            ) : null}

            {!acuraciaQuery.isLoading && !acuraciaQuery.error && acuraciaResumo ? (
                <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-5">
                        <KpiSemaforoCard
                            titulo="Acuracidade Exata"
                            valor={`${Number(acuraciaResumo.acuracidadeExataPct || 0).toFixed(2)}%`}
                            status={acuraciaSemaforo.acuracidadeExata?.status}
                            tendencia={trendAcuracidadeExata}
                        />
                        <KpiSemaforoCard
                            titulo="Acuracidade Tolerância"
                            valor={`${Number(acuraciaResumo.acuracidadeToleranciaPct || 0).toFixed(2)}%`}
                            status={acuraciaSemaforo.acuracidadeTolerancia?.status}
                        />
                        <KpiSemaforoCard
                            titulo="Pendência de Regularização"
                            valor={`${Number(acuraciaResumo.taxaPendenciaRegularizacaoPct || 0).toFixed(2)}%`}
                            status={acuraciaSemaforo.pendenciaRegularizacao?.status}
                            tendencia={trendPendencia}
                        />
                        <KpiSemaforoCard
                            titulo="MTTR Regularização"
                            valor={`${Number(acuraciaResumo.mttrRegularizacaoDias || 0).toFixed(2)} dias`}
                            status={acuraciaSemaforo.mttrRegularizacao?.status}
                        />
                        <KpiSemaforoCard
                            titulo="Cobertura de Contagem"
                            valor={`${Number(acuraciaResumo.coberturaContagemPct || 0).toFixed(2)}%`}
                            status={acuraciaSemaforo.coberturaContagem?.status}
                            tendencia={trendCobertura}
                        />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        <TrendListCard
                            title="Série semanal"
                            rows={serieSemanalAcuracia}
                            metricKey="acuracidadeExataPct"
                            metricLabel="Acuracidade Exata"
                        />
                        <TrendListCard
                            title="Série mensal"
                            rows={serieMensalAcuracia}
                            metricKey="acuracidadeExataPct"
                            metricLabel="Acuracidade Exata"
                        />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-widest text-slate-500">Top endereços críticos por erro relativo médio</p>
                        {!topSalasCriticasAcuracia.length ? (
                            <p className="mt-2 text-sm text-slate-600">Sem endereços avaliados para o período.</p>
                        ) : (
                            <div className="mt-2 overflow-auto rounded-lg border border-slate-200">
                                <table className="min-w-full text-left text-xs">
                                    <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                                        <tr>
                                            <th className="px-2 py-2">Endereço</th>
                                            <th className="px-2 py-2">Erro médio</th>
                                            <th className="px-2 py-2">Cobertura</th>
                                            <th className="px-2 py-2">Hit/Miss</th>
                                            <th className="px-2 py-2">Eventos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {topSalasCriticasAcuracia.map((s) => (
                                            <tr key={`${s.sala}-${s.eventos}`}>
                                                <td className="px-2 py-2 text-slate-800">{s.sala}</td>
                                                <td className="px-2 py-2 text-slate-700">{Number(s.erroRelativoMedioSalaPct || 0).toFixed(2)}%</td>
                                                <td className="px-2 py-2 text-slate-700">{Number(s.coberturaContagemPct || 0).toFixed(2)}%</td>
                                                <td className="px-2 py-2 text-slate-700">{Number(s.hits || 0)}/{Number(s.avaliacoes || 0)}</td>
                                                <td className="px-2 py-2 text-slate-700">{Number(s.eventos || 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </details>
    );
}
