/**
 * Modulo: frontend/components/assets
 * Arquivo: AssetsExplorerSummary.jsx
 * Funcao no sistema: resumir estoque total e distribuicao por unidade na Consulta de Bens.
 */
export default function AssetsExplorerSummary({
  filters,
  stats,
  unitSummary,
  formatUnidade,
  onApplyUnidadeFilter,
}) {
  return (
    <article className="grid gap-3 md:grid-cols-3">
      <button
        type="button"
        onClick={() => onApplyUnidadeFilter(null)}
        className={`rounded-xl border p-4 text-left transition ${
          !filters.unidadeDonaId
            ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
            : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
        title="Clique para listar bens de todas as unidades"
      >
        <p className="text-xs uppercase tracking-widest text-slate-500">Total bens</p>
        {stats.loading && <p className="mt-2 text-sm text-slate-600">Carregando...</p>}
        {stats.error && <p className="mt-2 text-sm text-rose-700">{stats.error}</p>}
        {stats.data && (
          <p className="mt-2 font-[Space_Grotesk] text-3xl font-bold text-violet-700">
            {stats.data.bens.total}
          </p>
        )}
      </button>
      <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
        <p className="text-xs uppercase tracking-widest text-slate-500">Bens por unidade</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {unitSummary.map((row) => (
            <button
              key={row.unidade}
              type="button"
              onClick={() => onApplyUnidadeFilter(row.unidade)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                String(filters.unidadeDonaId) === String(row.unidade)
                  ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
                  : "border-slate-200 bg-slate-100 hover:bg-slate-200"
              }`}
              title={`Clique para listar apenas a unidade ${formatUnidade(row.unidade)}`}
            >
              <p className="text-xs text-slate-600">{formatUnidade(row.unidade)}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{row.total}</p>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
