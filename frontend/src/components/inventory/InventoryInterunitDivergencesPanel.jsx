/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryInterunitDivergencesPanel.jsx
 * Funcao no sistema: renderizar divergencias interunidades em painel dedicado, mantendo filtros e leitura operacional.
 */
import { KpiMini } from "./InventoryAdminUi.jsx";

export default function InventoryInterunitDivergencesPanel({
  query,
  interDaMinhaUnidadeFora,
  interOutrasNaMinha,
  interPendentes,
  interRegularizadas,
  interEmAndamento,
  interEncerrado,
  interStatusInventario,
  setInterStatusInventario,
  interUnidadeRelacionada,
  setInterUnidadeRelacionada,
  interCodigoFiltro,
  setInterCodigoFiltro,
  interSalaFiltro,
  setInterSalaFiltro,
  clearInterFilters,
  isAdmin,
  formatUnidade,
  divergenciasInterTotal,
  divergenciasInterItems,
  inventoryStatusPillClass,
  divergenceTypePillClass,
  regularizacaoPillClass,
  formatDateTimeShort,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Divergências interunidades (tempo real)</h4>
          <p className="mt-1 text-[11px] text-slate-600">Visibilidade cruzada entre unidade dona e unidade encontrada.</p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-100"
        >
          Atualizar
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <KpiMini label="Da minha unidade fora" value={interDaMinhaUnidadeFora} tone="orange" />
        <KpiMini label="Outras unidades na minha" value={interOutrasNaMinha} tone="sky" />
        <KpiMini label="Pendentes" value={interPendentes} tone="amber" />
        <KpiMini label="Regularizadas" value={interRegularizadas} tone="emerald" />
        <KpiMini label="Em andamento" value={interEmAndamento} tone="violet" />
        <KpiMini label="Encerrado" value={interEncerrado} tone="slate" />
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs text-slate-600">
            <span>Status</span>
            <select value={interStatusInventario} onChange={(event) => setInterStatusInventario(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
              <option value="TODOS">TODOS</option>
              <option value="EM_ANDAMENTO">EM_ANDAMENTO</option>
              <option value="ENCERRADO">ENCERRADO</option>
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <span>Unidade relacionada</span>
            <select
              value={interUnidadeRelacionada}
              onChange={(event) => setInterUnidadeRelacionada(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
              disabled={!isAdmin}
            >
              <option value="">{isAdmin ? "Todas" : "Minha unidade"}</option>
              <option value="1">{formatUnidade(1)}</option>
              <option value="2">{formatUnidade(2)}</option>
              <option value="3">{formatUnidade(3)}</option>
              <option value="4">{formatUnidade(4)}</option>
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <span>Código do inventário</span>
            <input
              value={interCodigoFiltro}
              onChange={(event) => setInterCodigoFiltro(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
              placeholder="Filtrar por código"
            />
          </label>

          <label className="space-y-1 text-xs text-slate-600">
            <span>Endereço</span>
            <input
              value={interSalaFiltro}
              onChange={(event) => setInterSalaFiltro(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
              placeholder="Filtrar por endereço"
            />
          </label>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={clearInterFilters}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {query.isLoading ? (
        <p className="mt-3 text-xs text-slate-500">Carregando divergências...</p>
      ) : query.error ? (
        <p className="mt-3 text-xs text-rose-700">Falha ao carregar divergências interunidades.</p>
      ) : (
        <>
          <p className="mt-3 text-xs text-slate-600">Total: {divergenciasInterTotal} | Mostrando: {divergenciasInterItems.length}</p>
          <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold">Inventário</th>
                  <th className="px-2 py-2 text-left font-semibold">Tombo/Bem</th>
                  <th className="px-2 py-2 text-right font-semibold">Dona</th>
                  <th className="px-2 py-2 text-right font-semibold">Encontrada</th>
                  <th className="px-2 py-2 text-left font-semibold">Endereço</th>
                  <th className="px-2 py-2 text-left font-semibold">Tipo</th>
                  <th className="px-2 py-2 text-left font-semibold">Regularização</th>
                  <th className="px-2 py-2 text-left font-semibold">Registro</th>
                </tr>
              </thead>
              <tbody>
                {divergenciasInterItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-xs text-slate-500">
                      Nenhuma divergência encontrada para os filtros atuais.
                    </td>
                  </tr>
                ) : divergenciasInterItems.map((row, index) => (
                  <tr key={row.contagemId} className={`border-t border-slate-100 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                    <td className="px-2 py-1.5">
                      <div className="font-semibold text-slate-800">{row.codigoEvento}</div>
                      <div className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${inventoryStatusPillClass(row.statusInventario)}`}>
                        {row.statusInventario || "-"}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-mono text-slate-800">{row.numeroTombamento || "-"}</div>
                      <div className="truncate text-[11px] text-slate-500" title={row.nomeResumo || row.codigoCatalogo || "-"}>
                        {row.nomeResumo || row.codigoCatalogo || "-"}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-right">{formatUnidade(Number(row.unidadeDonaId))}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-right">{formatUnidade(Number(row.unidadeEncontradaId))}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{row.salaEncontrada || "-"}</td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${divergenceTypePillClass(row.tipoDivergencia)}`}>
                        {row.tipoDivergencia || "DIVERGENTE"}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${regularizacaoPillClass(row.regularizacaoPendente)}`}>
                        {row.regularizacaoPendente ? "PENDENTE" : (row.regularizacaoAcao || "REGULARIZADA")}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-[11px] text-slate-600">{formatDateTimeShort(row.encontradoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
