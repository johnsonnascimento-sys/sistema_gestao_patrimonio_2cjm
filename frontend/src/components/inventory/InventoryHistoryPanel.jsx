/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryHistoryPanel.jsx
 * Funcao no sistema: renderizar o historico resumido de eventos de inventario.
 */
import { StatusBadge } from "./InventoryAdminUi.jsx";

export default function InventoryHistoryPanel({
    isPrimaryView = false,
    historicoEventos,
    hasActiveEvent,
    editingEventoId,
    editForm,
    setEditForm,
    isAdmin,
    atualizarEventoMutPending,
    setEditingEventoId,
    onSaveEditEvento,
    onLoadRelatorio,
    onReopenEvento,
    onHandleEditEvento,
    onHandleDeleteEvento,
    formatUnidade,
}) {
    if (!historicoEventos.length) return null;

    const panelLabel = isPrimaryView || !hasActiveEvent ? "Painel principal" : "Leitura secundária";

    return (
        <details className="flex-1 rounded-3xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm md:p-4" open={isPrimaryView || !hasActiveEvent}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                    <h4 className="text-sm font-semibold text-slate-900">Historico Resumido</h4>
                    <p className="mt-1 text-[11px] text-slate-500">
                        {isPrimaryView ? "Consulta histórica para revisão, edição e reabertura." : "Consulta secundaria para revisao e reabertura."}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={panelLabel} tone={panelLabel === "Painel principal" ? "violet" : "slate"} />
                    <StatusBadge label={`${historicoEventos.length} evento(s)`} tone="slate" />
                </div>
            </summary>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                {historicoEventos.map((ev) => {
                    const isEditing = editingEventoId === ev.id;
                    return (
                        <div key={ev.id} className="flex items-start gap-2 rounded border border-slate-200 bg-white p-2 text-[11px]">
                            <div className="flex-1">
                                {isEditing ? (
                                    <input
                                        className="mb-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                                        value={editForm.codigoEvento}
                                        onChange={(e) => setEditForm({ ...editForm, codigoEvento: e.target.value })}
                                    />
                                ) : (
                                    <p className="font-semibold text-slate-800">{ev.codigoEvento}</p>
                                )}

                                <p className="text-slate-500">Aberto por: {ev.abertoPorNome || "Sistema"}</p>

                                {isEditing ? (
                                    <textarea
                                        className="mt-1 h-12 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                                        value={editForm.observacoes}
                                        placeholder="Observações..."
                                        onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                                    />
                                ) : (
                                    ev.observacoes ? <p className="mt-1 italic leading-tight text-slate-500">"{ev.observacoes}"</p> : null
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="mb-1 flex items-center gap-1.5">
                                    <span className={`rounded px-2 py-0.5 font-bold ${ev.status === "EM_ANDAMENTO" ? "bg-amber-300/20 text-amber-800" : "bg-emerald-300/20 text-emerald-700"}`}>{ev.status}</span>
                                </div>
                                <p className="shrink-0 text-slate-500">{ev.unidadeInventariadaId ? `Unid ${formatUnidade(ev.unidadeInventariadaId)}` : "Geral"} | {ev.modoContagem || "PADRAO"}</p>

                                {isAdmin ? (
                                    <div className="mt-2 flex gap-1.5">
                                        {isEditing ? (
                                            <>
                                                <button onClick={onSaveEditEvento} disabled={atualizarEventoMutPending} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100">Salvar</button>
                                                <button onClick={() => setEditingEventoId(null)} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100">Cancelar</button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => onLoadRelatorio(ev)}
                                                    className="rounded bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-200"
                                                >
                                                    Relatório
                                                </button>
                                                {ev.status !== "EM_ANDAMENTO" ? (
                                                    <button
                                                        onClick={() => onReopenEvento(ev)}
                                                        className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                                                    >
                                                        Reabrir
                                                    </button>
                                                ) : null}
                                                <button onClick={() => onHandleEditEvento(ev)} className="rounded bg-slate-100/50 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200">Editar</button>
                                                <button onClick={() => onHandleDeleteEvento(ev)} className="rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-200">Excluir</button>
                                            </>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        </details>
    );
}
