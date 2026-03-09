/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryLiveMonitoringPanel.jsx
 * Funcao no sistema: renderizar o monitoramento em tempo real do inventario sem acoplar a composicao principal.
 */
import { KpiMini } from "./InventoryAdminUi.jsx";

export default function InventoryLiveMonitoringPanel({
  visible,
  isAdmin,
  query,
  rows,
  totalA,
  totalB,
  totalEsperados,
  totalDesempate,
}) {
  if (!visible) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Monitoramento em tempo real</h4>
          <p className="mt-1 text-[11px] text-slate-600">Por endereço, operador/rodada e pendências de desempate.</p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-100"
        >
          Atualizar
        </button>
      </div>

      {!isAdmin ? (
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          O monitoramento detalhado fica disponível apenas para perfis administrativos.
        </p>
      ) : query.isLoading ? (
        <p className="mt-3 text-xs text-slate-500">Carregando monitoramento...</p>
      ) : query.error ? (
        <p className="mt-3 text-xs text-rose-700">Falha ao carregar monitoramento.</p>
      ) : (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <KpiMini label="Pendências de desempate" value={Number(query.data?.pendentesDesempate || 0)} tone="amber" />
            <KpiMini label="Endereços monitorados" value={rows.length} tone="sky" />
            <KpiMini label="Contagens A / B" value={`${totalA} / ${totalB}`} tone="violet" />
            <KpiMini label="Esperados / Desempate" value={`${totalEsperados} / ${totalDesempate}`} tone="emerald" />
          </div>

          <div className="mt-3 max-h-60 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-2 py-2 text-left">Endereço</th>
                  <th className="px-2 py-2 text-right">Esp.</th>
                  <th className="px-2 py-2 text-right">A</th>
                  <th className="px-2 py-2 text-right">B</th>
                  <th className="px-2 py-2 text-right">Des.</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs text-slate-500">
                      Sem dados de monitoramento para o evento selecionado.
                    </td>
                  </tr>
                ) : rows.map((row) => (
                  <tr key={`${row.salaEncontrada}-${row.qtdEsperados}`} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">{row.salaEncontrada || "-"}</td>
                    <td className="px-2 py-1.5 text-right">{row.qtdEsperados || 0}</td>
                    <td className="px-2 py-1.5 text-right">{row.qtdA || 0}</td>
                    <td className="px-2 py-1.5 text-right">{row.qtdB || 0}</td>
                    <td className="px-2 py-1.5 text-right">{row.qtdDesempate || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
