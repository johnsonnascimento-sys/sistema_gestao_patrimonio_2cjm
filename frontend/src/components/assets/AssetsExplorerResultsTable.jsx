/**
 * Modulo: frontend/components/assets
 * Arquivo: AssetsExplorerResultsTable.jsx
 * Funcao no sistema: renderizar resultados, paginação e atalhos da Consulta de Bens.
 */
export default function AssetsExplorerResultsTable({
  items,
  paging,
  canPrev,
  canNext,
  listLoading,
  listView,
  copyFeedback,
  setListView,
  loadList,
  copyTombamento,
  aplicarMesmoCatalogo,
  openDetail,
  formatUnidade,
  getFotoUrl,
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Resultados</h3>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={listView.showItemPhoto}
              onChange={(e) => setListView((prev) => ({ ...prev, showItemPhoto: e.target.checked }))}
              className="h-4 w-4 accent-violet-600"
            />
            Foto do item
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={listView.showCatalogPhoto}
              onChange={(e) => setListView((prev) => ({ ...prev, showCatalogPhoto: e.target.checked }))}
              className="h-4 w-4 accent-violet-600"
            />
            Foto do catálogo
          </label>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          {copyFeedback ? (
            <span
              className={`rounded-md px-2 py-1 font-semibold ${
                copyFeedback === "Número copiado"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {copyFeedback}
            </span>
          ) : null}
          <span>
            {paging.total ? `${paging.offset + 1}-${Math.min(paging.offset + paging.limit, paging.total)}` : "0"} de{" "}
            {paging.total}
          </span>
          <button
            type="button"
            disabled={!canPrev || listLoading}
            onClick={() => loadList(Math.max(0, paging.offset - paging.limit))}
            className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={!canNext || listLoading}
            onClick={() => loadList(paging.offset + paging.limit)}
            className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2">Tombo</th>
              <th className="px-3 py-2">Antigo (Azul)</th>
              <th className="px-3 py-2">Material (SKU)</th>
              <th className="px-3 py-2">Descrição / Resumo</th>
              {listView.showItemPhoto && <th className="px-3 py-2">Foto Item</th>}
              {listView.showCatalogPhoto && <th className="px-3 py-2">Foto Catálogo</th>}
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2">Local</th>
              <th className="px-3 py-2">Responsável</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-center">Obs</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-slate-50">
            {items.length === 0 && !listLoading ? (
              <tr>
                <td
                  colSpan={10 + (listView.showItemPhoto ? 1 : 0) + (listView.showCatalogPhoto ? 1 : 0)}
                  className="px-3 py-8 text-center text-sm text-slate-600"
                >
                  Nenhum bem encontrado para os filtros informados.
                </td>
              </tr>
            ) : null}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => copyTombamento(item.numeroTombamento)}
                    className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 hover:bg-slate-200"
                    title="Clique para copiar o tombamento"
                  >
                    {item.numeroTombamento || "-"}
                  </button>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-violet-700">{item.cod2Aud || "-"}</td>
                <td className="px-3 py-2 font-mono text-[11px]">
                  {item.codigoCatalogo ? (
                    <button
                      type="button"
                      onClick={() => aplicarMesmoCatalogo(item.codigoCatalogo)}
                      className="text-emerald-700 hover:underline"
                      title="Filtrar por este material (SKU)"
                    >
                      {item.codigoCatalogo}
                    </button>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">
                    {item.nomeResumo || item.catalogoDescricao || item.descricao || "-"}
                  </div>
                  {(item.catalogoDescricao || item.descricao) &&
                  (item.catalogoDescricao || item.descricao) !==
                    (item.nomeResumo || item.catalogoDescricao || item.descricao) ? (
                    <div className="text-[10px] text-slate-500 italic">
                      {item.catalogoDescricao || item.descricao}
                    </div>
                  ) : null}
                </td>
                {listView.showItemPhoto ? (
                  <td className="px-3 py-2">
                    {item.fotoUrl ? (
                      <a href={getFotoUrl(item.fotoUrl)} target="_blank" rel="noopener noreferrer">
                        <img
                          src={getFotoUrl(item.fotoUrl)}
                          alt={`Foto item ${item.numeroTombamento || ""}`}
                          className="h-10 w-10 rounded border border-slate-300 object-cover"
                        />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-500">-</span>
                    )}
                  </td>
                ) : null}
                {listView.showCatalogPhoto ? (
                  <td className="px-3 py-2">
                    {item.fotoReferenciaUrl ? (
                      <a href={getFotoUrl(item.fotoReferenciaUrl)} target="_blank" rel="noopener noreferrer">
                        <img
                          src={getFotoUrl(item.fotoReferenciaUrl)}
                          alt={`Foto catálogo ${item.codigoCatalogo || ""}`}
                          className="h-10 w-10 rounded border border-slate-300 object-cover"
                        />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-500">-</span>
                    )}
                  </td>
                ) : null}
                <td className="px-3 py-2 text-xs text-slate-800">{formatUnidade(Number(item.unidadeDonaId))}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{item.localNome || item.localFisico || "-"}</td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  {item.responsavelMatricula || item.responsavelNome
                    ? `${item.responsavelMatricula || "-"}${
                        item.responsavelNome ? ` - ${item.responsavelNome}` : ""
                      }`
                    : "-"}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs">
                    {item.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {item.temDivergenciaPendente ? (
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white"
                      title="Divergência Pendente!"
                    >
                      !
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      onClick={() => openDetail(item.id)}
                      className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                    >
                      Detalhes
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
