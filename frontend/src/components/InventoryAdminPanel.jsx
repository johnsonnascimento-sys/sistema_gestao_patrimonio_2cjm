import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
import {
    atualizarStatusEventoInventario,
    baixarRelatorioEncerramentoInventarioCsv,
    criarEventoInventario,
    getFotoUrl,
    getRelatorioEncerramentoInventario,
    listarEventosInventario,
    listarLocais,
    listarSugestoesCicloInventario,
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

const UNIDADES_MICRO_CICLO = [1, 2, 3, 4];

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

function formatDiasSemContagemLabel(diasSemContagem) {
    const dias = Number(diasSemContagem);
    if (!Number.isFinite(dias) || dias < 0) return "Sem contagem";
    return `${dias} dias`;
}

export default function InventoryAdminPanel() {
    const qc = useQueryClient();
    const auth = useAuth();
    const isAdmin = auth?.perfil?.role === "ADMIN";

    const [perfilId, setPerfilId] = useState("");
    const [selectedEventoId, setSelectedEventoId] = useState("");
    const [unidadeInventariadaId, setUnidadeInventariadaId] = useState("");
    const [tipoCiclo, setTipoCiclo] = useState("ADHOC");
    const [escopoTipo, setEscopoTipo] = useState("GERAL");
    const [escopoLocalIds, setEscopoLocalIds] = useState([]);
    const [encerramentoObs, setEncerramentoObs] = useState("");
    const [uiError, setUiError] = useState(null);
    const [uiInfo, setUiInfo] = useState(null);
    const [editingEventoId, setEditingEventoId] = useState(null);
    const [editForm, setEditForm] = useState({ codigoEvento: "", observacoes: "" });
    const [relatorioEventoId, setRelatorioEventoId] = useState("");
    const [showItemPhotoRelatorio, setShowItemPhotoRelatorio] = useState(false);
    const [showCatalogPhotoRelatorio, setShowCatalogPhotoRelatorio] = useState(false);

    useEffect(() => {
        if (!perfilId && auth?.perfil?.id) setPerfilId(String(auth.perfil.id));
    }, [auth?.perfil?.id, perfilId]);

    useEffect(() => {
        if (escopoTipo !== "LOCAIS") setEscopoLocalIds([]);
    }, [escopoTipo]);

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

    const locaisEscopoQuery = useQuery({
        queryKey: ["inventarioLocaisEscopo", unidadeInventariadaId],
        queryFn: async () => {
            const unidade = unidadeInventariadaId ? Number(unidadeInventariadaId) : undefined;
            const data = await listarLocais(unidade ? { unidadeId: unidade } : {});
            return data.items || [];
        },
    });

    const sugestoesCicloQuery = useQuery({
        queryKey: ["inventarioSugestoesCiclo", unidadeInventariadaId],
        queryFn: async () => {
            const unidade = unidadeInventariadaId ? Number(unidadeInventariadaId) : undefined;
            const data = await listarSugestoesCicloInventario({ unidadeId: unidade, limit: 20, offset: 0, somenteAtivos: true });
            return data.items || [];
        },
    });

    const eventoAtivo = useMemo(() => {
        const ativos = eventosQuery.data || [];
        if (ativos.length > 0) {
            if (selectedEventoId) return ativos.find((e) => e.id === selectedEventoId) || ativos[0];
            return ativos[0];
        }

        // Fallback: quando o cache de ativos ainda nao refletiu a reabertura,
        // tenta resolver pelo evento selecionado no cache completo.
        if (selectedEventoId) {
            const all = todosEventosQuery.data || [];
            const selected = all.find((e) => e.id === selectedEventoId && e.status === "EM_ANDAMENTO");
            if (selected) return selected;
        }
        return null;
    }, [eventosQuery.data, todosEventosQuery.data, selectedEventoId]);

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
        onSuccess: async (data, vars) => {
            setEncerramentoObs("");
            const nextStatus = String(vars?.payload?.status || "");
            const evento = data?.evento || null;

            if (evento?.id) {
                qc.setQueryData(["inventarioEventos", "TODOS"], (prev) => {
                    const list = Array.isArray(prev) ? [...prev] : [];
                    const idx = list.findIndex((it) => it.id === evento.id);
                    if (idx >= 0) list[idx] = evento;
                    else list.unshift(evento);
                    return list;
                });

                qc.setQueryData(["inventarioEventos", "EM_ANDAMENTO"], (prev) => {
                    const list = Array.isArray(prev) ? [...prev] : [];
                    const withoutCurrent = list.filter((it) => it.id !== evento.id);
                    if (nextStatus === "EM_ANDAMENTO") return [evento, ...withoutCurrent];
                    return withoutCurrent;
                });
            }

            if (nextStatus === "ENCERRADO" && vars?.id) {
                setRelatorioEventoId(String(vars.id));
                setUiInfo("Inventario encerrado. Relatorio detalhado gerado abaixo.");
            } else if (nextStatus === "EM_ANDAMENTO" && vars?.id) {
                setRelatorioEventoId(String(vars.id));
                setSelectedEventoId(String(vars.id));
                setUiInfo("Inventário reaberto com sucesso.");
            }
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

    const relatorioEventoIdFinal = useMemo(() => {
        if (relatorioEventoId) return relatorioEventoId;
        if (selectedEventoIdFinal) return selectedEventoIdFinal;
        const all = todosEventosQuery.data || [];
        return all[0]?.id || "";
    }, [relatorioEventoId, selectedEventoIdFinal, todosEventosQuery.data]);

    const relatorioEncerramentoQuery = useQuery({
        queryKey: ["inventarioRelatorioEncerramento", relatorioEventoIdFinal],
        enabled: Boolean(relatorioEventoIdFinal),
        queryFn: async () => getRelatorioEncerramentoInventario(relatorioEventoIdFinal),
    });

    const baixarCsvMut = useMutation({
        mutationFn: async () => {
            if (!relatorioEventoIdFinal) throw new Error("Selecione um evento para exportar.");
            return baixarRelatorioEncerramentoInventarioCsv(relatorioEventoIdFinal);
        },
        onSuccess: ({ blob, filename }) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename || "relatorio_encerramento.csv";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        },
        onError: (error) => {
            setUiError(String(error?.message || "Falha ao baixar CSV do relatorio."));
        },
    });

    const report = relatorioEncerramentoQuery.data || null;
    const resumo = report?.resumo || {};
    const totalDivergencias = Number(resumo.totalDivergencias || 0);
    const totalContagens = Number(resumo.totalContagens || 0);
    const conformidadePct = totalContagens > 0
        ? Math.round(((Number(resumo.conformes || 0)) / totalContagens) * 100)
        : 0;
    const divergenciaTipoData = [
        { k: "Unidade", v: Number(resumo.divergenciasUnidade || 0), color: "#f59e0b" },
        { k: "Sala", v: Number(resumo.divergenciasSala || 0), color: "#06b6d4" },
        { k: "Unidade + Sala", v: Number(resumo.divergenciasUnidadeESala || 0), color: "#fb7185" },
    ];
    const regularizacaoData = [
        { k: "Pendentes", v: Number(resumo.regularizacoesPendentes || 0), color: "#f97316" },
        { k: "Regularizadas", v: Math.max(0, totalDivergencias - Number(resumo.regularizacoesPendentes || 0)), color: "#22c55e" },
    ];
    const porSalaTop = useMemo(() => {
        const rows = report?.porSala || [];
        return [...rows]
            .sort((a, b) => Number(b.divergencias || 0) - Number(a.divergencias || 0))
            .slice(0, 10);
    }, [report?.porSala]);

    const onCreateEvento = async (event) => {
        event.preventDefault();
        setUiError(null);

        const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
        if (!perfilIdFinal) {
            setUiError("Informe um perfilId (UUID) para abrir o evento.");
            return;
        }

        let unidadeFinal = unidadeInventariadaId.trim() === "" ? null : Number(unidadeInventariadaId);
        if (escopoTipo === "UNIDADE" && !unidadeFinal) {
            setUiError("Selecione a unidade para escopo UNIDADE.");
            return;
        }
        if (escopoTipo === "LOCAIS" && !escopoLocalIds.length) {
            setUiError("Selecione ao menos uma sala para escopo LOCAIS.");
            return;
        }
        if (escopoTipo === "GERAL") unidadeFinal = null;
        const codigo = generateCodigoEvento(unidadeFinal);

        criarEventoMut.mutate({
            codigoEvento: codigo,
            unidadeInventariadaId: unidadeFinal,
            tipoCiclo,
            escopoTipo,
            escopoLocalIds: escopoTipo === "LOCAIS" ? escopoLocalIds : undefined,
            abertoPorPerfilId: perfilIdFinal,
        });
    };

    const toggleEscopoLocal = (localId) => {
        const id = String(localId || "");
        if (!id) return;
        setEscopoLocalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const onUpdateStatus = async (status, eventoId = selectedEventoIdFinal) => {
        setUiError(null);
        setUiInfo(null);
        const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
        if (!perfilIdFinal) {
            setUiError("Informe um perfilId (UUID) para atualizar o status do evento.");
            return;
        }
        if (!eventoId) return;

        if (status === "ENCERRADO") {
            const proceed = window.confirm(
                `Tem certeza que deseja encerrar definitivamente este inventário?\nNão será mais possível inserir bens.`
            );
            if (!proceed) return;
        }
        if (status === "EM_ANDAMENTO") {
            const proceed = window.confirm(
                "Tem certeza que deseja reabrir este inventário?\nAs contagens e registros voltarão a ser aceitos."
            );
            if (!proceed) return;
        }

        atualizarStatusMut.mutate({
            id: eventoId,
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
            <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5 shadow-sm">
                <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
                    <div>
                        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Inventário - Administração</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Controle macro dos eventos, status do catálogo da CJM e central de regularizações.
                        </p>
                    </div>
                </header>

                {uiError && (
                    <p className="mt-4 mb-4 rounded-xl border border-rose-300/30 bg-rose-200/10 p-3 text-sm text-rose-700">
                        {uiError}
                    </p>
                )}
                {uiInfo && (
                    <p className="mt-4 mb-4 rounded-xl border border-emerald-300/30 bg-emerald-200/10 p-3 text-sm text-emerald-700">
                        {uiInfo}
                    </p>
                )}

                <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 flex flex-col group">
                        <h3 className="font-semibold select-none mb-3">Gestão do Evento</h3>
                        <div>
                            <p className="mt-1 text-xs text-slate-600 flex-1">
                                Inventário ativo bloqueia mudança de carga (Art. 183).
                            </p>

                            {auth.perfil ? (
                                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                    <p className="font-semibold text-slate-900">Encarregado</p>
                                    <p className="mt-1">
                                        {auth.perfil.nome} ({auth.perfil.matricula}) - perfilId {String(auth.perfil.id).slice(0, 8)}...
                                    </p>
                                </div>
                            ) : (
                                <label className="mt-3 block space-y-1">
                                    <span className="text-xs text-slate-600">PerfilId (UUID) para abrir/encerrar</span>
                                    <input
                                        value={perfilId}
                                        onChange={(e) => setPerfilId(e.target.value)}
                                        placeholder="UUID do perfil"
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                    />
                                </label>
                            )}

                            {eventosQuery.isLoading && <p className="mt-3 text-sm text-slate-600">Carregando eventos...</p>}
                            {eventosQuery.error && (
                                <p className="mt-3 text-sm text-rose-700">Falha ao listar eventos ativos.</p>
                            )}

                            {(eventosQuery.data || []).length > 0 ? (
                                <div className="mt-3 space-y-3">
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Selecionar evento em andamento</span>
                                        <select
                                            value={selectedEventoIdFinal}
                                            onChange={(e) => {
                                                setSelectedEventoId(e.target.value);
                                                setRelatorioEventoId(e.target.value);
                                            }}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                        >
                                            {(eventosQuery.data || []).map((ev) => (
                                                <option key={ev.id} value={ev.id}>
                                                    {ev.codigoEvento} ({ev.escopoTipo || "UNIDADE"} / unidade={ev.unidadeInventariadaId ?? "geral"})
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className="grid gap-2 md:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={() => onUpdateStatus("ENCERRADO")}
                                            disabled={atualizarStatusMut.isPending}
                                            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                                        >
                                            Encerrar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onUpdateStatus("CANCELADO")}
                                            disabled={atualizarStatusMut.isPending}
                                            className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                        >
                                            Cancelar
                                        </button>
                                    </div>

                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Observações de encerramento (opcional)</span>
                                        <textarea
                                            value={encerramentoObs}
                                            onChange={(e) => setEncerramentoObs(e.target.value)}
                                            className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                        />
                                    </label>
                                </div>
                            ) : (
                                <form onSubmit={onCreateEvento} className="mt-3 space-y-3">
                                    <p className="text-sm text-slate-600">
                                        Nenhum evento ativo. Abra um evento para iniciar o inventario.
                                    </p>
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Unidade inventariada (opcional)</span>
                                        <select
                                            value={unidadeInventariadaId}
                                            onChange={(e) => setUnidadeInventariadaId(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                        >
                                            <option value="">(geral)</option>
                                            <option value="1">{formatUnidade(1)}</option>
                                            <option value="2">{formatUnidade(2)}</option>
                                            <option value="3">{formatUnidade(3)}</option>
                                            <option value="4">{formatUnidade(4)}</option>
                                        </select>
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Codigo do evento</span>
                                        <input
                                            disabled
                                            value={generateCodigoEvento(unidadeInventariadaId.trim() === "" ? null : Number(unidadeInventariadaId))}
                                            className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
                                        />
                                        <p className="text-[11px] text-slate-500">
                                            Gerado automaticamente.
                                        </p>
                                    </label>
                                    <button
                                        type="submit"
                                        disabled={criarEventoMut.isPending}
                                        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    >
                                        {criarEventoMut.isPending ? "Abrindo..." : "Abrir evento"}
                                    </button>
                                </form>
                            )}

                            <form onSubmit={onCreateEvento} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-sm font-semibold text-slate-900">Novo micro-inventario ciclico</p>
                                <div className="grid gap-2 md:grid-cols-2">
                                    {UNIDADES_MICRO_CICLO.map((unidadeId) => (
                                        <button
                                            key={unidadeId}
                                            type="button"
                                            onClick={() => {
                                                setTipoCiclo("SEMANAL");
                                                setEscopoTipo("UNIDADE");
                                                setUnidadeInventariadaId(String(unidadeId));
                                            }}
                                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                                        >
                                            Ciclo semanal - {formatUnidade(unidadeId)}
                                        </button>
                                    ))}
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Tipo de ciclo</span>
                                        <select value={tipoCiclo} onChange={(e) => setTipoCiclo(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                            <option value="ADHOC">ADHOC</option>
                                            <option value="SEMANAL">SEMANAL</option>
                                            <option value="MENSAL">MENSAL</option>
                                            <option value="ANUAL">ANUAL</option>
                                        </select>
                                    </label>
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Escopo</span>
                                        <select value={escopoTipo} onChange={(e) => setEscopoTipo(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                            <option value="GERAL">GERAL</option>
                                            <option value="UNIDADE">UNIDADE</option>
                                            <option value="LOCAIS">LOCAIS</option>
                                        </select>
                                    </label>
                                </div>

                                <label className="block space-y-1">
                                    <span className="text-xs text-slate-600">Unidade inventariada</span>
                                    <select
                                        value={unidadeInventariadaId}
                                        onChange={(e) => setUnidadeInventariadaId(e.target.value)}
                                        disabled={escopoTipo === "GERAL"}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
                                    >
                                        <option value="">(geral)</option>
                                        <option value="1">{formatUnidade(1)}</option>
                                        <option value="2">{formatUnidade(2)}</option>
                                        <option value="3">{formatUnidade(3)}</option>
                                        <option value="4">{formatUnidade(4)}</option>
                                    </select>
                                </label>

                                {escopoTipo === "LOCAIS" ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-600">Salas do escopo</p>
                                        <div className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                                            {(locaisEscopoQuery.data || []).map((l) => (
                                                <label key={l.id} className="flex items-center gap-2 py-1 text-xs text-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={escopoLocalIds.includes(String(l.id))}
                                                        onChange={() => toggleEscopoLocal(l.id)}
                                                        className="h-4 w-4 accent-violet-600"
                                                    />
                                                    <span>{l.nome}</span>
                                                </label>
                                            ))}
                                            {!(locaisEscopoQuery.data || []).length ? <p className="text-xs text-slate-500">Nenhuma sala encontrada para a unidade selecionada.</p> : null}
                                        </div>
                                    </div>
                                ) : null}

                                <button
                                    type="submit"
                                    disabled={criarEventoMut.isPending}
                                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {criarEventoMut.isPending ? "Abrindo..." : "Abrir micro-inventario"}
                                </button>
                            </form>

                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-sm font-semibold text-slate-900">Sugestoes de ciclo</p>
                                <p className="text-[11px] text-slate-600">Prioridade por mais tempo sem contagem.</p>
                                <div className="mt-2 max-h-44 overflow-auto space-y-2">
                                    {(sugestoesCicloQuery.data || []).map((s) => (
                                        <button
                                            key={s.localId}
                                            type="button"
                                            onClick={() => {
                                                setEscopoTipo("LOCAIS");
                                                setTipoCiclo("SEMANAL");
                                                setUnidadeInventariadaId(String(s.unidadeId || ""));
                                                setEscopoLocalIds([String(s.localId)]);
                                            }}
                                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-xs hover:bg-slate-100"
                                        >
                                            <div className="font-semibold text-slate-900">{s.nome}</div>
                                            <div className="text-slate-600">Unid {s.unidadeId} | {formatDiasSemContagemLabel(s.diasSemContagem)} | bens {s.qtdBensAtivos}</div>
                                        </button>
                                    ))}
                                    {!(sugestoesCicloQuery.data || []).length ? <p className="text-xs text-slate-500">Sem sugestoes no momento.</p> : null}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <InventoryProgress eventoInventarioId={selectedEventoIdFinal} />

                        {(todosEventosQuery.data || []).length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 flex-1">
                                <h4 className="text-sm font-semibold mb-2">Histórico Resumido</h4>
                                <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-2">
                                    {(todosEventosQuery.data || []).slice(0, 15).map(ev => {
                                        const isEditing = editingEventoId === ev.id;
                                        return (
                                            <div key={ev.id} className="text-[11px] p-2 rounded bg-white flex justify-between items-start gap-2 border border-slate-200">
                                                <div className="flex-1">
                                                    {isEditing ? (
                                                        <input
                                                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 mb-1 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                                                            value={editForm.codigoEvento}
                                                            onChange={(e) => setEditForm({ ...editForm, codigoEvento: e.target.value })}
                                                        />
                                                    ) : (
                                                        <p className="font-semibold text-slate-800">{ev.codigoEvento}</p>
                                                    )}

                                                    <p className="text-slate-500">Aberto por: {ev.abertoPorNome || 'Sistema'}</p>

                                                    {isEditing ? (
                                                        <textarea
                                                            className="w-full h-12 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 mt-1 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                                                            value={editForm.observacoes}
                                                            placeholder="Observações..."
                                                            onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                                                        />
                                                    ) : (
                                                        ev.observacoes && <p className="text-slate-500 mt-1 italic leading-tight">"{ev.observacoes}"</p>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <span className={`px-2 py-0.5 rounded font-bold ${ev.status === 'EM_ANDAMENTO' ? 'bg-amber-300/20 text-amber-800' : 'bg-emerald-300/20 text-emerald-700'}`}>{ev.status}</span>
                                                    </div>
                                                    <p className="text-slate-500 shrink-0">{ev.unidadeInventariadaId ? `Unid ${formatUnidade(ev.unidadeInventariadaId)}` : 'Geral'}</p>

                                                    {isAdmin && (
                                                        <div className="flex gap-1.5 mt-2">
                                                            {isEditing ? (
                                                                <>
                                                                    <button onClick={saveEditEvento} disabled={atualizarEventoMut.isPending} className="border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded transition-colors text-xs font-medium">Salvar</button>
                                                                    <button onClick={() => setEditingEventoId(null)} className="border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 px-2 py-1 rounded transition-colors text-xs font-medium">Cancelar</button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedEventoId(ev.id);
                                                                            setRelatorioEventoId(ev.id);
                                                                            setUiInfo(`Relatório carregado para o evento ${ev.codigoEvento}.`);
                                                                        }}
                                                                        className="bg-violet-100 hover:bg-violet-200 text-violet-700 px-2 py-1 rounded transition-colors text-xs font-medium"
                                                                    >
                                                                        Relatório
                                                                    </button>
                                                                    {ev.status !== "EM_ANDAMENTO" && (
                                                                        <button
                                                                            onClick={() => onUpdateStatus("EM_ANDAMENTO", ev.id)}
                                                                            disabled={atualizarStatusMut.isPending}
                                                                            className="border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded transition-colors text-xs font-medium disabled:opacity-50"
                                                                        >
                                                                            Reabrir
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => handleEditEvento(ev)} className="bg-slate-100/50 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors text-xs font-medium">Editar</button>
                                                                    <button onClick={() => handleDeleteEvento(ev)} disabled={excluirEventoMut.isPending} className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2 py-1 rounded transition-colors text-xs font-medium">Excluir</button>
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

            {relatorioEventoIdFinal && (
                <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5 shadow-sm">
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h3 className="font-[Space_Grotesk] text-xl font-semibold">Relatório do Inventário (AN303/2008)</h3>
                            <p className="mt-1 text-xs text-slate-600">
                                Consolidado do evento selecionado (em andamento ou encerrado), com divergências de unidade/sala e pendências de regularização.
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                                Evento: {relatorioEncerramentoQuery.data?.evento?.codigoEvento || "-"} | Status: {relatorioEncerramentoQuery.data?.evento?.status || "-"}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => relatorioEncerramentoQuery.refetch()}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                            >
                                Atualizar
                            </button>
                            <button
                                type="button"
                                onClick={() => baixarCsvMut.mutate()}
                                disabled={baixarCsvMut.isPending}
                                className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                                {baixarCsvMut.isPending ? "Exportando..." : "Exportar CSV editável"}
                            </button>
                        </div>
                    </header>

                    {relatorioEncerramentoQuery.isLoading && <p className="mt-4 text-sm text-slate-600">Gerando relatório...</p>}
                    {relatorioEncerramentoQuery.error && (
                        <p className="mt-4 text-sm text-rose-700">Falha ao gerar relatório detalhado.</p>
                    )}

                    {!relatorioEncerramentoQuery.isLoading && !relatorioEncerramentoQuery.error && relatorioEncerramentoQuery.data && (
                        <div className="mt-4 space-y-4">
                            <div className="grid gap-3 md:grid-cols-4">
                                <CardKpi k="Contagens" v={relatorioEncerramentoQuery.data.resumo?.totalContagens} />
                                <CardKpi k="Conformes" v={relatorioEncerramentoQuery.data.resumo?.conformes} />
                                <CardKpi k="Divergências" v={relatorioEncerramentoQuery.data.resumo?.totalDivergencias} />
                                <CardKpi k="Pend. Regularização" v={relatorioEncerramentoQuery.data.resumo?.regularizacoesPendentes} />
                            </div>

                            <div className="grid gap-3 lg:grid-cols-3">
                                <DonutCard
                                    title="Bens fora da Sala/Unidade"
                                    subtitle={`Conformidade geral: ${conformidadePct}%`}
                                    total={totalDivergencias}
                                    items={divergenciaTipoData}
                                />
                                <StackedBarCard
                                    title="Regularização pós-inventário"
                                    subtitle="Pendentes x regularizadas"
                                    total={totalDivergencias}
                                    items={regularizacaoData}
                                />
                                <TopRoomsCard rows={porSalaTop} />
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-widest text-slate-500">Divergências por tipo</p>
                                <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
                                    <p className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">Unidade: <strong>{relatorioEncerramentoQuery.data.resumo?.divergenciasUnidade || 0}</strong></p>
                                    <p className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">Sala: <strong>{relatorioEncerramentoQuery.data.resumo?.divergenciasSala || 0}</strong></p>
                                    <p className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2">Unidade + Sala: <strong>{relatorioEncerramentoQuery.data.resumo?.divergenciasUnidadeESala || 0}</strong></p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-widest text-slate-500">Divergências registradas</p>
                                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={showItemPhotoRelatorio}
                                            onChange={(e) => setShowItemPhotoRelatorio(e.target.checked)}
                                            className="h-4 w-4 accent-violet-600"
                                        />
                                        Foto do item
                                    </label>
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={showCatalogPhotoRelatorio}
                                            onChange={(e) => setShowCatalogPhotoRelatorio(e.target.checked)}
                                            className="h-4 w-4 accent-violet-600"
                                        />
                                        Foto do catálogo
                                    </label>
                                </div>
                                {(relatorioEncerramentoQuery.data.divergencias || []).length === 0 ? (
                                    <p className="mt-2 text-sm text-slate-600">Nenhuma divergência registrada neste evento.</p>
                                ) : (
                                    <div className="mt-2 overflow-auto rounded-lg border border-slate-200">
                                        <table className="min-w-full text-left text-xs">
                                            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                                                <tr>
                                                    <th className="px-2 py-2">Tombo</th>
                                                    <th className="px-2 py-2">Catálogo</th>
                                                    <th className="px-2 py-2">Descrição / Resumo</th>
                                                    <th className="px-2 py-2">Tipo</th>
                                                    <th className="px-2 py-2">Unid. Dona</th>
                                                    <th className="px-2 py-2">Unid. Encontrada</th>
                                                    <th className="px-2 py-2">Esperado</th>
                                                    <th className="px-2 py-2">Encontrado</th>
                                                    <th className="px-2 py-2">Regularização</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {(relatorioEncerramentoQuery.data.divergencias || []).slice(0, 400).map((d) => (
                                                    <tr key={d.contagemId}>
                                                        <td className="px-2 py-2 text-slate-800 font-mono">{d.numeroTombamento || d.identificadorExterno || "-"}</td>
                                                        <td className="px-2 py-2 font-mono text-[11px] text-emerald-700">{d.codigoCatalogo || "-"}</td>
                                                        <td className="px-2 py-2">
                                                            <div className="font-medium text-slate-900">
                                                                {d.nomeResumo || d.descricaoComplementar || "-"}
                                                            </div>
                                                            {d.nomeResumo && d.descricaoComplementar && d.nomeResumo !== d.descricaoComplementar && (
                                                                <div className="text-[10px] text-slate-500 italic">
                                                                    {d.descricaoComplementar}
                                                                </div>
                                                            )}
                                                            {(showItemPhotoRelatorio || showCatalogPhotoRelatorio) && (
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    {showItemPhotoRelatorio && getFotoUrl(d.fotoUrl || "") && (
                                                                        <a href={getFotoUrl(d.fotoUrl || "")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded border border-violet-300 bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100/80">
                                                                            Foto item
                                                                        </a>
                                                                    )}
                                                                    {showCatalogPhotoRelatorio && getFotoUrl(d.fotoReferenciaUrl || "") && (
                                                                        <a href={getFotoUrl(d.fotoReferenciaUrl || "")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">
                                                                            Foto catálogo
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2 text-slate-600">{d.tipoDivergencia}</td>
                                                        <td className="px-2 py-2 text-slate-600">{formatUnidade(Number(d.unidadeDonaId))}</td>
                                                        <td className="px-2 py-2 text-slate-600">{formatUnidade(Number(d.unidadeEncontradaId))}</td>
                                                        <td className="px-2 py-2 text-slate-600">{d.localEsperado || "-"}</td>
                                                        <td className="px-2 py-2 text-slate-600">{d.salaEncontrada || "-"}</td>
                                                        <td className="px-2 py-2 text-slate-600">{d.regularizacaoPendente ? "PENDENTE" : (d.regularizacaoAcao || "REGULARIZADO")}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs uppercase tracking-widest text-slate-500">Conformidade legal (AN303)</p>
                                <ul className="mt-2 space-y-2 text-sm text-slate-800">
                                    {(relatorioEncerramentoQuery.data.compliance || []).map((c) => (
                                        <li key={c.artigo} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                            <p className="font-semibold">{c.artigo}</p>
                                            <p className="text-slate-600">{c.regra}</p>
                                            <p className="mt-1 text-xs text-slate-500">{(c.evidencias || []).join(" | ")}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                </section>
            )}

            <RegularizationPanel />
        </div>
    );
}

function CardKpi({ k, v }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] uppercase tracking-widest text-slate-500">{k}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{Number(v || 0)}</p>
        </div>
    );
}

function DonutCard({ title, subtitle, total, items }) {
    const t = Math.max(0, Number(total || 0));
    const safeItems = (items || []).map((it) => ({ ...it, v: Math.max(0, Number(it.v || 0)) }));
    const stops = [];
    let acc = 0;
    for (const it of safeItems) {
        const frac = t > 0 ? (it.v / t) * 100 : 0;
        const from = acc;
        const to = acc + frac;
        stops.push(`${it.color} ${from}% ${to}%`);
        acc = to;
    }
    if (acc < 100) stops.push(`#1f2937 ${acc}% 100%`);
    const bg = `conic-gradient(${stops.join(", ")})`;
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-500">{title}</p>
            <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
            <div className="mt-3 flex items-center gap-3">
                <div className="relative h-24 w-24 shrink-0 rounded-full" style={{ background: bg }}>
                    <div className="absolute inset-4 grid place-items-center rounded-full border border-slate-200 bg-slate-50 text-center">
                        <span className="text-sm font-semibold text-slate-700">{t}</span>
                    </div>
                </div>
                <div className="space-y-1 text-xs">
                    {safeItems.map((it) => (
                        <div key={it.k} className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.color }} />
                            <span className="text-slate-600">{it.k}</span>
                            <span className="font-semibold text-slate-900">{it.v}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StackedBarCard({ title, subtitle, total, items }) {
    const t = Math.max(0, Number(total || 0));
    const safeItems = (items || []).map((it) => ({ ...it, v: Math.max(0, Number(it.v || 0)) }));
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-500">{title}</p>
            <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
            <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-white">
                <div className="flex h-full w-full">
                    {safeItems.map((it) => {
                        const pct = t > 0 ? (it.v / t) * 100 : 0;
                        return <div key={it.k} style={{ width: `${pct}%`, backgroundColor: it.color }} />;
                    })}
                </div>
            </div>
            <div className="mt-2 space-y-1 text-xs">
                {safeItems.map((it) => (
                    <div key={it.k} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: it.color }} />
                            <span className="text-slate-600">{it.k}</span>
                        </div>
                        <span className="font-semibold text-slate-900">{it.v}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TopRoomsCard({ rows }) {
    const list = rows || [];
    const maxDiv = Math.max(1, ...list.map((r) => Number(r?.divergencias || 0)));
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-500">Top salas com divergencias</p>
            {!list.length ? (
                <p className="mt-3 text-sm text-slate-500">Sem divergencias por sala.</p>
            ) : (
                <div className="mt-3 space-y-2">
                    {list.map((r) => {
                        const dv = Number(r.divergencias || 0);
                        const pct = Math.max(3, Math.round((dv / maxDiv) * 100));
                        return (
                            <div key={r.salaEncontrada}>
                                <div className="mb-1 flex items-center justify-between text-xs">
                                    <span className="truncate pr-2 text-slate-600">{r.salaEncontrada}</span>
                                    <span className="font-semibold text-slate-900">{dv}</span>
                                </div>
                                <div className="h-2 rounded bg-white">
                                    <div className="h-2 rounded bg-violet-500" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}



