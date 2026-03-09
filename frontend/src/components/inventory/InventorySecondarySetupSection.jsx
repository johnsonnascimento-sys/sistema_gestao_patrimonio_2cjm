/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventorySecondarySetupSection.jsx
 * Funcao no sistema: renderizar a area secundaria de configuracao de novo ciclo quando ja existe evento ativo.
 */
import { StatusBadge } from "./InventoryAdminUi.jsx";

export default function InventorySecondarySetupSection({ hasActiveEvent, content }) {
  if (!hasActiveEvent) return null;

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Area secundaria</p>
          <p className="mt-1 text-sm text-slate-700">
            Configuração de novo ciclo e leitura gerencial permanecem acessíveis, mas fora da zona principal de retomada da contagem.
          </p>
        </div>
        <StatusBadge label="Apoio ao evento ativo" tone="slate" />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-[Space_Grotesk] text-xl font-semibold text-slate-900">Novo inventário</h3>
          <p className="mt-1 text-sm text-slate-600">
            Abertura secundária enquanto o evento ativo segue como foco principal da página.
          </p>
        </div>
        <StatusBadge label="Área secundária" tone="slate" />
      </div>
      <div className="mt-4">{content}</div>
    </section>
  );
}
