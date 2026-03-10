/**
 * Modulo: frontend/components
 * Arquivo: BaixaProcessesList.jsx
 * Funcao no sistema: listar processos de baixa patrimonial e atalhos operacionais.
 */
const STATUS_LABELS = {
  RASCUNHO: "Rascunho",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

export default function BaixaProcessesList({
  items,
  activeId,
  onOpen,
  onCreateFromSelection,
  onOpenDesaparecimento,
  selectionCount,
  canWrite,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Processos de baixa</p>
          <h3 className="mt-2 font-[Space_Grotesk] text-2xl font-semibold text-slate-900">
            Rascunhos, conclusões e desaparecimento
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreateFromSelection}
            disabled={!canWrite || selectionCount === 0}
            className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Abrir processo com {selectionCount} item(ns)
          </button>
          <button
            type="button"
            onClick={onOpenDesaparecimento}
            disabled={!canWrite}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Baixa por desaparecimento
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                active ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-slate-50 hover:border-violet-200"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.processoReferencia}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {item.modalidadeBaixa} • {STATUS_LABELS[item.statusProcesso] || item.statusProcesso}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  {item.totalItens || 0} item(ns)
                </div>
              </div>
            </button>
          );
        })}
        {items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Nenhum processo de baixa cadastrado ainda.
          </div>
        )}
      </div>
    </section>
  );
}
