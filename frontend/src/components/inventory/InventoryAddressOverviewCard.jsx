/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryAddressOverviewCard.jsx
 * Funcao no sistema: renderizar o resumo operacional do endereco atual na contagem.
 */
function OverviewInfoTile({ label, value, helper = "", tone = "default" }) {
  const valueCls = tone === "danger"
    ? "text-rose-700"
    : tone === "warn"
      ? "text-amber-800"
      : tone === "success"
        ? "text-emerald-700"
        : "text-slate-900";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${valueCls}`}>{value}</p>
      {helper ? <p className="mt-1 text-[11px] text-slate-500">{helper}</p> : null}
    </div>
  );
}

export default function InventoryAddressOverviewCard({
  accentClassName,
  expectedValue,
  expectedHelper,
  expectedTone,
  countedValue,
  countedHelper,
  countedTone,
  divergencesValue,
  divergencesTone,
  missingValue,
  missingHelper,
  missingTone,
}) {
  return (
    <section className={`rounded-2xl border bg-white p-4 shadow-sm ${accentClassName}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Visão rápida do endereço</h3>
          <p className="mt-1 text-xs text-slate-600">
            Resumo operacional para decidir se a equipe segue na bipagem ou trata exceções.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <OverviewInfoTile
          label="Esperados"
          value={expectedValue}
          helper={expectedHelper}
          tone={expectedTone}
        />
        <OverviewInfoTile
          label="Conferidos"
          value={countedValue}
          helper={countedHelper}
          tone={countedTone}
        />
        <OverviewInfoTile
          label="Divergências"
          value={divergencesValue}
          helper="Ocorrências registradas neste endereço."
          tone={divergencesTone}
        />
        <OverviewInfoTile
          label="Faltantes"
          value={missingValue}
          helper={missingHelper}
          tone={missingTone}
        />
      </div>
    </section>
  );
}
