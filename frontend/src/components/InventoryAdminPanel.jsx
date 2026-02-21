import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
import {
    atualizarStatusEventoInventario,
    criarEventoInventario,
    listarEventosInventario,
    excluirEventoInventario,
    atualizarEventoInventario
} from "../services/apiClient.js";
import InventoryProgress from "./InventoryProgress.jsx";
import RegularizationPanel from "./RegularizationPanel.jsx";

function formatUnidade(id) {
    if (id === 1) return "1 (1a Aud)";
    if (id === 2) return "2 (2a Aud)";
    if (id === 3) return "3 (Foro)";
    if (id === 4) return "4 (Almox)";
    return String(id || "");
}

function generateCodigoEvento(unidadeInventariadaId) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const u = Number(unidadeInventariadaId);
    const suffix = u === 1 ? "1AUD" : u === 2 ? "2AUD" : u === 3 ? "FORO" : u === 4 ? "ALMOX" : "GERAL";
    return `INV_${yyyy}_${mm}_${dd}_${hh}${min}_${suffix}`;
}

export default function InventoryAdminPanel() {
    const qc = useQueryClient();
    const auth = useAuth();
    const isAdmin = auth?.perfil?.role === "ADMIN";

    const [perfilId, setPerfilId] = useState("");
    const [selectedEventoId, setSelectedEventoId] = useState("");
    const [unidadeInventariadaId, setUnidadeInventariadaId] = useState("");
    const [encerramentoObs, setEncerramentoObs] = useState("");
    const [uiError, setUiError] = useState(null);
    const [editingEventoId, setEditingEventoId] = useState(null);
    const [editForm, setEditForm] = useState({ codigoEvento: "", observacoes: "" });

    useEffect(() => {
        if (!perfilId && auth?.perfil?.id) setPerfilId(String(auth.perfil.id));
    }, [auth?.perfil?.id, perfilId]);

    const eventosQuery = useQuery({
        queryKey: ["inventarioEventos", "EM_ANDAMENTO"],
        queryFn: async () => {
            const data = await listarEventosInventario("EM_ANDAMENTO");
            return data.items || [];
        },
    });

    const todosEventosQuery = useQuery({
        queryKey: ["inventarioEventos", "TODOS"],
        queryFn: async () => {
            const data = await listarEventosInventario();
            return data.items || [];
        },
    });

    const eventoAtivo = useMemo(() => {
        const items = eventosQuery.data || [];
        if (!items.length) return null;
        if (selectedEventoId) return items.find((e) => e.id === selectedEventoId) || items[0];
        return items[0];
    }, [eventosQuery.data, selectedEventoId]);

    const selectedEventoIdFinal = eventoAtivo?.id || "";

    const criarEventoMut = useMutation({
        mutationFn: (payload) => criarEventoInventario(payload),
        onSuccess: async () => {
            setUnidadeInventariadaId("");
            await qc.invalidateQueries({ queryKey: ["inventarioEventos"] });
        },
        onError: (error) => {
            setUiError(String(error?.message || "Falha ao abrir evento."));
        },
    });

    const atualizarStatusMut = useMutation({
        mutationFn: ({ id, payload }) => atualizarStatusEventoInventario(id, payload),
        onSuccess: async () => {
            setEncerramentoObs("");
            await qc.invalidateQueries({ queryKey: ["inventarioEventos"] });
        },
        onError: (error) => {
            setUiError(String(error?.message || "Falha ao atualizar status do evento."));
        },
    });

    const excluirEventoMut = useMutation({
        mutationFn: excluirEventoInventario,
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ["inventarioEventos"] });
            if (editingEventoId) setEditingEventoId(null);
        },
        onError: (error) => {
            setUiError(String(error?.message || "Falha ao excluir evento."));
        },
    });

    const atualizarEventoMut = useMutation({
        mutationFn: ({ id, payload }) => atualizarEventoInventario(id, payload),
        onSuccess: async () => {
            setEditingEventoId(null);
            await qc.invalidateQueries({ queryKey: ["inventarioEventos"] });
        },
        onError: (error) => {
            setUiError(String(error?.message || "Falha ao atualizar evento."));
        },
    });

    const onCreateEvento = async (event) => {
        event.preventDefault();
        setUiError(null);

        const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
        if (!perfilIdFinal) {
            setUiError("Informe um perfilId (UUID) para abrir o evento.");
            return;
        }

        const unidadeFinal = unidadeInventariadaId.trim() === "" ? null : Number(unidadeInventariadaId);
        const codigo = generateCodigoEvento(unidadeFinal);

        criarEventoMut.mutate({
            codigoEvento: codigo,
            unidadeInventariadaId: unidadeFinal,
            abertoPorPerfilId: perfilIdFinal,
        });
    };

    const onUpdateStatus = async (status) => {
        setUiError(null);
        const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
        if (!perfilIdFinal) {
            setUiError("Informe um perfilId (UUID) para encerrar/cancelar o evento.");
            return;
        }
        if (!selectedEventoIdFinal) return;

        if (status === "ENCERRADO") {
            const proceed = window.confirm(
                `Tem certeza que deseja encerrar definitivamente este inventário?\nNão será mais possível inserir bens.`
            );
            if (!proceed) return;
        }

        atualizarStatusMut.mutate({
            id: selectedEventoIdFinal,
            payload: {
                status,
                encerradoPorPerfilId: perfilIdFinal,
                observacoes: encerramentoObs.trim() || undefined,
            },
        });
    };

    const handleDeleteEvento = (ev) => {
        const proceed = window.confirm(`CUIDADO: Excluir o evento ${ev.codigoEvento} removerá em cascata todas as suas contagens (forasteiros e regulares).\nDeseja continuar?`);
        if (!proceed) return;
        setUiError(null);
        excluirEventoMut.mutate(ev.id);
    };

    const handleEditEvento = (ev) => {
        setEditingEventoId(ev.id);
        setEditForm({ codigoEvento: ev.codigoEvento, observacoes: ev.observacoes || "" });
    };

    const saveEditEvento = () => {
        if (!editingEventoId) return;
        setUiError(null);
        atualizarEventoMut.mutate({
            id: editingEventoId,
            payload: {
                codigoEvento: editForm.codigoEvento.trim() || undefined,
                observacoes: editForm.observacoes.trim() || undefined
            }
        });
    };

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-white/15 bg-slate-900/55 p-3 md:p-5">
                <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
                    <div>
                        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Inventário - Administração</h2>
                        <p className="mt-2 text-sm text-slate-300">
                            Controle macro dos eventos, status do catálogo da CJM e central de regularizações.
                        </p>
                    </div>
                </header>

                {uiError && (
                    <p className="mt-4 mb-4 rounded-xl border border-rose-300/30 bg-rose-200/10 p-3 text-sm text-rose-200">
                        {uiError}
                    </p>
                )}

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                    <div className="rounded-2xl border border-white/15 bg-slate-950/35 p-3 md:p-4 flex flex-col group">
                        <h3 className="font-semibold select-none mb-3">Gestão do Evento</h3>
                        <div>
                            <p className="mt-1 text-xs text-slate-300 flex-1">
                                Inventário ativo bloqueia mudança de carga (Art. 183).
                            </p>

                            {auth.perfil ? (
                                <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/25 p-3 text-xs text-slate-300">
                                    <p className="font-semibold text-slate-100">Encarregado</p>
                                    <p className="mt-1">
                                        {auth.perfil.nome} ({auth.perfil.matricula}) - perfilId {String(auth.perfil.id).slice(0, 8)}...
                                    </p>
                                </div>
                            ) : (
                                <label className="mt-3 block space-y-1">
                                    <span className="text-xs text-slate-300">PerfilId (UUID) para abrir/encerrar</span>
                                    <input
                                        value={perfilId}
                                        onChange={(e) => setPerfilId(e.target.value)}
                                        placeholder="UUID do perfil"
                                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                                    />
                                </label>
                            )}

                            {eventosQuery.isLoading && <p className="mt-3 text-sm text-slate-300">Carregando eventos...</p>}
                            {eventosQuery.error && (
                                <p className="mt-3 text-sm text-rose-300">Falha ao listar eventos ativos.</p>
                            )}

                            {(eventosQuery.data || []).length > 0 ? (
                                <div className="mt-3 space-y-3">
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-300">Selecionar evento em andamento</span>
                                        <select
                                            value={selectedEventoIdFinal}
                                            onChange={(e) => setSelectedEventoId(e.target.value)}
                                            className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                                        >
                                            {(eventosQuery.data || []).map((ev) => (
                                                <option key={ev.id} value={ev.id}>
                                                    {ev.codigoEvento} (unidade={ev.unidadeInventariadaId ?? "geral"})
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className="grid gap-2 md:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => onUpdateStatus("ENCERRADO")}
                                            disabled={atualizarStatusMut.isPending}
                                            className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                                        >
                                            Encerrar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onUpdateStatus("CANCELADO")}
                                            disabled={atualizarStatusMut.isPending}
                                            className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>
                                    </div>

                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-300">Observações de encerramento (opcional)</span>
                                        <textarea
                                            value={encerramentoObs}
                                            onChange={(e) => setEncerramentoObs(e.target.value)}
                                            className="min-h-20 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                                        />
                                    </label>
                                </div>
                            ) : (
                                <form onSubmit={onCreateEvento} className="mt-3 space-y-3">
                                    <p className="text-sm text-slate-300">
                                        Nenhum evento ativo. Abra um evento para iniciar o inventario.
                                    </p>
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-300">Unidade inventariada (opcional)</span>
                                        <select
                                            value={unidadeInventariadaId}
                                            onChange={(e) => setUnidadeInventariadaId(e.target.value)}
                                            className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                                        >
                                            <option value="">(geral)</option>
                                            <option value="1">{formatUnidade(1)}</option>
                                            <option value="2">{formatUnidade(2)}</option>
                                            <option value="3">{formatUnidade(3)}</option>
                                            <option value="4">{formatUnidade(4)}</option>
                                        </select>
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-300">Codigo do evento</span>
                                        <input
                                            disabled
                                            value={generateCodigoEvento(unidadeInventariadaId.trim() === "" ? null : Number(unidadeInventariadaId))}
                                            className="w-full rounded-lg border border-white/20 bg-slate-800/50 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
                                        />
                                        <p className="text-[11px] text-slate-400">
                                            Gerado automaticamente.
                                        </p>
                                    </label>
                                    <button
                                        type="submit"
                                        disabled={criarEventoMut.isPending}
                                        className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                                    >
                                        {criarEventoMut.isPending ? "Abrindo..." : "Abrir evento"}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <InventoryProgress eventoInventarioId={selectedEventoIdFinal} />

                        {(todosEventosQuery.data || []).length > 0 && (
                            <div className="rounded-2xl border border-white/15 bg-slate-950/35 p-3 md:p-4 flex-1">
                                <h4 className="text-sm font-semibold mb-2">Histórico Resumido</h4>
                                <div className="max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/50 p-2 space-y-2">
                                    {(todosEventosQuery.data || []).slice(0, 15).map(ev => {
                                        const isEditing = editingEventoId === ev.id;
                                        return (
                                            <div key={ev.id} className="text-[11px] p-2 rounded bg-slate-800 flex justify-between items-start gap-2 border border-slate-700">
                                                <div className="flex-1">
                                                    {isEditing ? (
                                                        <input
                                                            className="w-full rounded bg-slate-900 border border-slate-600 px-2 py-1 text-xs mb-1 focus:outline-none"
                                                            value={editForm.codigoEvento}
                                                            onChange={(e) => setEditForm({ ...editForm, codigoEvento: e.target.value })}
                                                        />
                                                    ) : (
                                                        <p className="font-semibold text-slate-200">{ev.codigoEvento}</p>
                                                    )}

                                                    <p className="text-slate-400">Aberto por: {ev.abertoPorNome || 'Sistema'}</p>

                                                    {isEditing ? (
                                                        <textarea
                                                            className="w-full h-12 rounded bg-slate-900 border border-slate-600 px-2 py-1 text-xs mt-1 focus:outline-none"
                                                            value={editForm.observacoes}
                                                            placeholder="Observações..."
                                                            onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                                                        />
                                                    ) : (
                                                        ev.observacoes && <p className="text-slate-400 mt-1 italic leading-tight">"{ev.observacoes}"</p>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <span className={`px-2 py-0.5 rounded font-bold ${ev.status === 'EM_ANDAMENTO' ? 'bg-amber-300/20 text-amber-300' : 'bg-emerald-300/20 text-emerald-300'}`}>{ev.status}</span>
                                                    </div>
                                                    <p className="text-slate-400 shrink-0">{ev.unidadeInventariadaId ? `Unid ${formatUnidade(ev.unidadeInventariadaId)}` : 'Geral'}</p>

                                                    {isAdmin && (
                                                        <div className="flex gap-1.5 mt-2">
                                                            {isEditing ? (
                                                                <>
                                                                    <button onClick={saveEditEvento} disabled={atualizarEventoMut.isPending} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-2 py-1 rounded transition-colors text-xs font-medium">Salvar</button>
                                                                    <button onClick={() => setEditingEventoId(null)} className="bg-slate-600/30 hover:bg-slate-600/50 text-slate-300 px-2 py-1 rounded transition-colors text-xs font-medium">Cancelar</button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => handleEditEvento(ev)} className="bg-slate-700/50 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors text-xs font-medium">Editar</button>
                                                                    <button onClick={() => handleDeleteEvento(ev)} disabled={excluirEventoMut.isPending} className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 px-2 py-1 rounded transition-colors text-xs font-medium">Excluir</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <RegularizationPanel />
        </div>
    );
}
