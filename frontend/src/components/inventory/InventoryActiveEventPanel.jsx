/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryActiveEventPanel.jsx
 * Funcao no sistema: renderizar o card principal do evento ativo e do setup inicial no cockpit de administracao do inventario.
 */
import InventoryProgress from "../InventoryProgress.jsx";
import { InfoLine, StatusBadge } from "./InventoryAdminUi.jsx";

export default function InventoryActiveEventPanel({
  hasActiveEvent,
  eventosQuery,
  accountabilityBlock,
  activeEventSelector,
  atualizarStatusMutPending,
  onUpdateStatus,
  encerramentoObs,
  setEncerramentoObs,
  eventoAtivo,
  activeEventScope,
  activeEventMode,
  activeEventUnitLabel,
  activeEventOpenedBy,
  activeEventOpenedAt,
  selectedEventoIdFinal,
  newInventoryAndSuggestions,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4 xl:min-w-[22rem]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{hasActiveEvent ? "Evento ativo" : "Novo inventário"}</h3>
          <p className="mt-1 text-xs text-slate-600">
            {hasActiveEvent
              ? "Resumo do evento em andamento, ações críticas e progresso consolidado."
              : "Abra um evento e prepare o próximo ciclo operacional."}
          </p>
        </div>
        <StatusBadge
          label={hasActiveEvent ? "Evento em andamento" : "Sem evento ativo"}
          tone={hasActiveEvent ? "amber" : "slate"}
        />
      </div>

      <div>
        {hasActiveEvent ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
            Inventário ativo bloqueia mudança de carga durante a contagem, conforme Art. 183.
          </p>
        ) : null}

        <div className="mt-3">{accountabilityBlock}</div>

        {eventosQuery.isLoading && <p className="mt-3 text-sm text-slate-600">Carregando eventos...</p>}
        {eventosQuery.error && (
          <p className="mt-3 text-sm text-rose-700">Falha ao listar eventos ativos.</p>
        )}

        {(eventosQuery.data || []).length > 0 ? (
          <div className="mt-3 space-y-3">
            {activeEventSelector}

            <div className="grid gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={() => onUpdateStatus("ENCERRADO")}
                disabled={atualizarStatusMutPending}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Encerrar inventário
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus("CANCELADO")}
                disabled={atualizarStatusMutPending}
                className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                Cancelar inventário
              </button>
            </div>

            <label className="block space-y-1">
              <span className="text-xs text-slate-600">Observações para ação crítica (opcional)</span>
              <textarea
                value={encerramentoObs}
                onChange={(e) => setEncerramentoObs(e.target.value)}
                className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              <InfoLine label="Código" value={eventoAtivo?.codigoEvento || "-"} mono />
              <InfoLine label="Escopo" value={activeEventScope} />
              <InfoLine label="Modo" value={activeEventMode} />
              <InfoLine label="Unidade" value={activeEventUnitLabel} />
              <InfoLine label="Aberto por" value={activeEventOpenedBy} />
              <InfoLine label="Última referência" value={activeEventOpenedAt} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 md:p-3">
              <InventoryProgress eventoInventarioId={selectedEventoIdFinal} />
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Sem inventário ativo. Abra o próximo ciclo pelo bloco abaixo e use o código gerado como referência operacional.
          </p>
        )}

        {!hasActiveEvent ? <div className="mt-4">{newInventoryAndSuggestions}</div> : null}
      </div>
    </div>
  );
}
