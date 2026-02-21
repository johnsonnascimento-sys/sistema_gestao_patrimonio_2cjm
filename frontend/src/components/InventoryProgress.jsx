import { useQuery } from "@tanstack/react-query";
import { getProgressoInventario } from "../services/apiClient.js";

export default function InventoryProgress({ eventoInventarioId }) {
    const progressoQuery = useQuery({
        queryKey: ["inventarioProgresso", eventoInventarioId],
        enabled: Boolean(eventoInventarioId && navigator.onLine),
        queryFn: async () => {
            const data = await getProgressoInventario(eventoInventarioId);
            return data.items || [];
        },
        refetchInterval: 30000, // Optional: auto-refresh progress
    });

    return (
        <details className="rounded-2xl border border-white/15 bg-slate-950/35 p-3 md:p-4 flex flex-col group" open>
            <summary className="font-semibold cursor-pointer select-none">Progresso do Inventário</summary>
            <div className="mt-3 group-open:block">
                <p className="text-xs text-slate-300 mb-3">
                    Itens esperados vs inventariados por sala.
                </p>

                {!eventoInventarioId ? (
                    <p className="mt-3 text-sm text-slate-300">Nenhum evento ativo.</p>
                ) : progressoQuery.isFetching && !progressoQuery.data ? (
                    <p className="mt-3 text-sm text-slate-300">Carregando progresso...</p>
                ) : progressoQuery.error ? (
                    <p className="mt-3 text-sm text-rose-300">Falha ao carregar progresso.</p>
                ) : (progressoQuery.data || []).length === 0 ? (
                    <p className="mt-3 text-sm text-slate-300">Sem dados de progresso para o momento.</p>
                ) : (
                    <div className="mt-4 flex-1 overflow-auto rounded-lg border border-white/10 bg-slate-900/50 p-2 space-y-2 max-h-80">
                        {(progressoQuery.data || []).map((p, idx) => {
                            const perc = p.qtdEsperados > 0
                                ? Math.min(100, Math.round((p.qtdInventariados / p.qtdEsperados) * 100))
                                : p.qtdInventariados > 0 ? 100 : 0;

                            return (
                                <div key={idx} className="rounded-xl border border-white/10 bg-slate-800 p-2">
                                    <div className="flex justify-between items-end mb-1">
                                        <p className="text-xs font-semibold text-slate-100">{p.salaEncontrada || 'Desconhecida'}</p>
                                        <p className="text-[10px] text-slate-300">
                                            {p.qtdInventariados}/{p.qtdEsperados}
                                        </p>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex">
                                        <div
                                            className={`h-full ${perc === 100 ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                                            style={{ width: `${perc}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </details>
    );
}
