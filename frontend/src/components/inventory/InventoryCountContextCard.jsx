/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryCountContextCard.jsx
 * Funcao no sistema: renderizar o resumo do contexto operacional da contagem.
 */
function ContextInfoTile({ label, value, helper = "", tone = "default" }) {
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

export default function InventoryCountContextCard({
  eventCode,
  eventHelper,
  eventTone,
  showRound,
  roundValue,
  roundHelper,
  unitValue,
  unitTone,
  localValue,
  localHelper,
  localTone,
  roomValue,
  roomHelper,
  roomTone,
}) {
  return (
    <section className="mt-5 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Contexto da contagem</h3>
          <p className="mt-1 text-xs text-slate-600">
            Confirme o evento, a unidade e o local cadastrado antes de iniciar a leitura contínua.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        <ContextInfoTile
          label="Evento aplicado"
          value={eventCode}
          helper={eventHelper}
          tone={eventTone}
        />
        {showRound ? (
          <ContextInfoTile
            label="Rodada"
            value={roundValue}
            helper={roundHelper}
            tone="warn"
          />
        ) : null}
        <ContextInfoTile
          label="Unidade encontrada"
          value={unitValue}
          tone={unitTone}
        />
        <ContextInfoTile
          label="Local cadastrado"
          value={localValue}
          helper={localHelper}
          tone={localTone}
        />
        <ContextInfoTile
          label="Endereço operacional"
          value={roomValue}
          helper={roomHelper}
          tone={roomTone}
        />
      </div>
    </section>
  );
}
