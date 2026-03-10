/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryAdminHeader.jsx
 * Funcao no sistema: renderizar o cabecalho operacional e os badges-resumo do cockpit administrativo do inventario.
 */
import { StatusBadge } from "./InventoryAdminUi.jsx";

export default function InventoryAdminHeader({
  sectionTitle,
  sectionDescription,
  hasActiveEvent,
  eventoCodigo,
  activeEventScope,
  escopoTipo,
  activeEventMode,
  modoContagem,
  activeEventUnitLabel,
  unidadeInventariadaId,
  activeEventOpenedBy,
  uiError,
  uiInfo,
  formatUnidade,
}) {
  return (
    <>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-[Space_Grotesk] text-2xl font-semibold">{sectionTitle || "Inventário - Administração"}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {sectionDescription || "Cockpit operacional para evento ativo, retomada de contagem e monitoramento contínuo."}
          </p>
        </div>
        <StatusBadge
          label={hasActiveEvent ? "Evento em andamento" : "Sem evento em andamento"}
          tone={hasActiveEvent ? "amber" : "slate"}
        />
      </header>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <StatusBadge label={hasActiveEvent ? (eventoCodigo || "-") : "Abra um novo inventário"} tone="violet" mono />
        <StatusBadge label={`Escopo: ${hasActiveEvent ? activeEventScope : escopoTipo}`} />
        <StatusBadge label={`Modo: ${hasActiveEvent ? activeEventMode : modoContagem}`} tone="sky" />
        <StatusBadge
          label={`Unidade: ${hasActiveEvent ? activeEventUnitLabel : (unidadeInventariadaId ? formatUnidade(Number(unidadeInventariadaId)) : "A definir")}`}
          tone="emerald"
        />
        <StatusBadge label={hasActiveEvent ? `Responsável: ${activeEventOpenedBy}` : "Prepare o próximo ciclo"} tone="slate" />
      </div>

      {uiError && (
        <p className="mt-4 rounded-xl border border-rose-300/40 bg-rose-50 p-3 text-sm text-rose-700">
          {uiError}
        </p>
      )}
      {uiInfo && (
        <p className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-50 p-3 text-sm text-emerald-700">
          {uiInfo}
        </p>
      )}
    </>
  );
}
