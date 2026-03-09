/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryCriticalActionModal.jsx
 * Funcao no sistema: renderizar a confirmacao forte das acoes criticas de encerrar ou cancelar evento de inventario.
 */
export default function InventoryCriticalActionModal({
  criticalModal,
  criticalImpactText,
  encerramentoObs,
  setEncerramentoObs,
  criticalConfirmText,
  setCriticalConfirmText,
  atualizarStatusMutPending,
  onClose,
  onConfirm,
}) {
  if (!criticalModal.open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
        <h4 className="text-base font-semibold text-slate-900">Confirmação de ação crítica</h4>
        <p className="mt-2 text-sm text-slate-700">
          Inventário: <strong>{criticalModal.eventoCodigo || "-"}</strong>
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Ação: <strong>{criticalModal.status === "ENCERRADO" ? "Encerrar inventário" : "Cancelar inventário"}</strong>
        </p>
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">{criticalImpactText}</p>
        <label className="mt-3 block space-y-1">
          <span className="text-xs text-slate-600">Observação (opcional)</span>
          <textarea
            value={encerramentoObs}
            onChange={(e) => setEncerramentoObs(e.target.value)}
            className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        {criticalModal.status === "CANCELADO" ? (
          <label className="mt-3 block space-y-1">
            <span className="text-xs text-slate-600">
              Para confirmar o cancelamento, digite exatamente: <strong>CANCELAR_INVENTARIO</strong>
            </span>
            <input
              value={criticalConfirmText}
              onChange={(e) => setCriticalConfirmText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="CANCELAR_INVENTARIO"
            />
          </label>
        ) : null}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={atualizarStatusMutPending}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Confirmar {criticalModal.status === "ENCERRADO" ? "encerramento" : "cancelamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
