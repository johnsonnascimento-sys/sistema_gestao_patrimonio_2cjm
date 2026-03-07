import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
import {
    atualizarStatusEventoInventario,
    baixarRelatorioEncerramentoInventarioCsv,
    buscarPerfisDetentor,
    criarEventoInventario,
    getMonitoramentoContagemInventario,
    getFotoUrl,
    getIndicadoresAcuracidadeInventario,
    getRelatorioEncerramentoInventario,
    listarDivergenciasInterunidades,
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

const PROFILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVENTARIO_PRESETS = [
    { key: "inventario-geral", label: "Inventário geral", apply: { escopoTipo: "GERAL", tipoCiclo: "ADHOC", unidadeInventariadaId: "", escopoLocalIds: [] } },
    { key: "ciclo-1aud", label: "Ciclo semanal 1a Aud", apply: { escopoTipo: "UNIDADE", tipoCiclo: "SEMANAL", unidadeInventariadaId: "1", escopoLocalIds: [] } },
    { key: "ciclo-2aud", label: "Ciclo semanal 2a Aud", apply: { escopoTipo: "UNIDADE", tipoCiclo: "SEMANAL", unidadeInventariadaId: "2", escopoLocalIds: [] } },
    { key: "ciclo-foro", label: "Ciclo semanal Foro", apply: { escopoTipo: "UNIDADE", tipoCiclo: "SEMANAL", unidadeInventariadaId: "3", escopoLocalIds: [] } },
    { key: "ciclo-almox", label: "Ciclo semanal Almox", apply: { escopoTipo: "UNIDADE", tipoCiclo: "SEMANAL", unidadeInventariadaId: "4", escopoLocalIds: [] } },
    { key: "por-sala", label: "Por endereço", apply: { escopoTipo: "LOCAIS", tipoCiclo: "ADHOC" } },
];

function formatPerfilOption(perfil) {
    const matricula = String(perfil?.matricula || "-");
    const nome = String(perfil?.nome || "-");
    const unidade = perfil?.unidadeId != null ? String(perfil.unidadeId) : "-";
    return `${matricula} - ${nome} (unid. ${unidade})`;
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

function formatDiasSemContagemLabel(diasSemContagem) {
    const dias = Number(diasSemContagem);
    if (!Number.isFinite(dias) || dias < 0) return "Sem contagem";
    return `${dias} dias`;
}

function formatDateTimeShort(value) {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return "-";
    try {
        return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
    } catch {
        return d.toISOString();
    }
}

function toIsoDateInput(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function shiftDays(date, deltaDays) {
    const d = new Date(date);
    d.setDate(d.getDate() + deltaDays);
    return d;
}

function semaforoClass(status) {
    if (status === "VERDE") return "border-emerald-300 bg-emerald-50 text-emerald-700";
    if (status === "AMARELO") return "border-amber-300 bg-amber-50 text-amber-700";
    return "border-rose-300 bg-rose-50 text-rose-700";
}

function calcTrend(points, field) {
    const list = Array.isArray(points) ? points : [];
    if (list.length < 2) return null;
    const last = Number(list[list.length - 1]?.[field] || 0);
    const prev = Number(list[list.length - 2]?.[field] || 0);
    if (!Number.isFinite(last) || !Number.isFinite(prev)) return null;
    return Number((last - prev).toFixed(2));
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
    const [modoContagem, setModoContagem] = useState("PADRAO");
    const [escopoLocalIds, setEscopoLocalIds] = useState([]);
    const [operadorUnicoId, setOperadorUnicoId] = useState("");
    const [operadorAId, setOperadorAId] = useState("");
    const [operadorBId, setOperadorBId] = useState("");
    const [operadorUnicoQuery, setOperadorUnicoQuery] = useState("");
    const [operadorAQuery, setOperadorAQuery] = useState("");
    const [operadorBQuery, setOperadorBQuery] = useState("");
    const [operadorUnicoLookup, setOperadorUnicoLookup] = useState({ loading: false, data: [], error: null, selected: null });
    const [operadorALookup, setOperadorALookup] = useState({ loading: false, data: [], error: null, selected: null });
    const [operadorBLookup, setOperadorBLookup] = useState({ loading: false, data: [], error: null, selected: null });
    const [operadorUnicoFocused, setOperadorUnicoFocused] = useState(false);
    const [operadorAFocused, setOperadorAFocused] = useState(false);
    const [operadorBFocused, setOperadorBFocused] = useState(false);
    const [permiteDesempateA, setPermiteDesempateA] = useState(false);
    const [permiteDesempateB, setPermiteDesempateB] = useState(false);
    const [encerramentoObs, setEncerramentoObs] = useState("");
    const [uiError, setUiError] = useState(null);
    const [uiInfo, setUiInfo] = useState(null);
    const [editingEventoId, setEditingEventoId] = useState(null);
    const [editForm, setEditForm] = useState({ codigoEvento: "", observacoes: "" });
    const [relatorioEventoId, setRelatorioEventoId] = useState("");
    const [showItemPhotoRelatorio, setShowItemPhotoRelatorio] = useState(false);
    const [showCatalogPhotoRelatorio, setShowCatalogPhotoRelatorio] = useState(false);
    const [criticalModal, setCriticalModal] = useState({ open: false, status: "", eventoId: "", eventoCodigo: "" });
    const [criticalConfirmText, setCriticalConfirmText] = useState("");
    const [interStatusInventario, setInterStatusInventario] = useState("TODOS");
    const [interUnidadeRelacionada, setInterUnidadeRelacionada] = useState("");
    const [interCodigoFiltro, setInterCodigoFiltro] = useState("");
    const [interSalaFiltro, setInterSalaFiltro] = useState("");
    const [acuraciaDataFim, setAcuraciaDataFim] = useState(() => toIsoDateInput(new Date()));
    const [acuraciaDataInicio, setAcuraciaDataInicio] = useState(() => toIsoDateInput(shiftDays(new Date(), -90)));
    const [acuraciaUnidadeId, setAcuraciaUnidadeId] = useState("");
    const [acuraciaStatusEvento, setAcuraciaStatusEvento] = useState("ENCERRADO");
    const [acuraciaToleranciaPct, setAcuraciaToleranciaPct] = useState("2");

    useEffect(() => {
        if (!perfilId && auth?.perfil?.id) setPerfilId(String(auth.perfil.id));
    }, [auth?.perfil?.id, perfilId]);

    useEffect(() => {
        if (escopoTipo !== "LOCAIS") setEscopoLocalIds([]);
    }, [escopoTipo]);

    useEffect(() => {
        if (escopoTipo === "GERAL") setUnidadeInventariadaId("");
    }, [escopoTipo]);

    useEffect(() => {
        if (modoContagem !== "CEGO") {
            setOperadorUnicoFocused(false);
            setOperadorUnicoLookup((prev) => ({ ...prev, loading: false, data: [], error: null }));
            return;
        }
        const query = String(operadorUnicoQuery || "").trim();
        if (query.length < 2) {
            setOperadorUnicoLookup((prev) => ({ ...prev, loading: false, data: [], error: null }));
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setOperadorUnicoLookup((prev) => ({ ...prev, loading: true, error: null }));
            try {
                const data = await buscarPerfisDetentor({ q: query, limit: 8 });
                if (cancelled) return;
                setOperadorUnicoLookup((prev) => ({ ...prev, loading: false, data: data?.items || [], error: null }));
            } catch (error) {
                if (cancelled) return;
                setOperadorUnicoLookup((prev) => ({ ...prev, loading: false, data: [], error: String(error?.message || "Falha ao buscar perfis.") }));
            }
        }, 220);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [modoContagem, operadorUnicoQuery]);

    useEffect(() => {
        if (modoContagem !== "DUPLO_CEGO") {
            setOperadorAFocused(false);
            setOperadorALookup((prev) => ({ ...prev, loading: false, data: [], error: null }));
            return;
        }
        const query = String(operadorAQuery || "").trim();
        if (query.length < 2) {
            setOperadorALookup((prev) => ({ ...prev, loading: false, data: [], error: null }));
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setOperadorALookup((prev) => ({ ...prev, loading: true, error: null }));
            try {
                const data = await buscarPerfisDetentor({ q: query, limit: 8 });
                if (cancelled) return;
                setOperadorALookup((prev) => ({ ...prev, loading: false, data: data?.items || [], error: null }));
            } catch (error) {
                if (cancelled) return;
                setOperadorALookup((prev) => ({ ...prev, loading: false, data: [], error: String(error?.message || "Falha ao buscar perfis.") }));
            }
        }, 220);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [modoContagem, operadorAQuery]);

    useEffect(() => {
        if (modoContagem !== "DUPLO_CEGO") {
            setOperadorBFocused(false);
            setOperadorBLookup((prev) => ({ ...prev, loading: false, data: [], error: null }));
            return;
        }
        const query = String(operadorBQuery || "").trim();
        if (query.length < 2) {
            setOperadorBLookup((prev) => ({ ...prev, loading: false, data: [], error: null }));
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setOperadorBLookup((prev) => ({ ...prev, loading: true, error: null }));
            try {
                const data = await buscarPerfisDetentor({ q: query, limit: 8 });
                if (cancelled) return;
                setOperadorBLookup((prev) => ({ ...prev, loading: false, data: data?.items || [], error: null }));
            } catch (error) {
                if (cancelled) return;
                setOperadorBLookup((prev) => ({ ...prev, loading: false, data: [], error: String(error?.message || "Falha ao buscar perfis.") }));
            }
        }, 220);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [modoContagem, operadorBQuery]);

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

        // Fallback: quando o cache de ativos ainda não refletiu a reabertura,
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
                setUiInfo("Inventário encerrado. Relatorio detalhado gerado abaixo.");
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

    const monitoramentoQuery = useQuery({
        queryKey: ["inventarioMonitoramentoContagem", selectedEventoIdFinal],
        enabled: Boolean(selectedEventoIdFinal && isAdmin),
        refetchInterval: 5000,
        queryFn: async () => getMonitoramentoContagemInventario(selectedEventoIdFinal),
    });

    const divergenciasInterunidadesQuery = useQuery({
        queryKey: ["inventarioDivergenciasInterunidades", interStatusInventario, interUnidadeRelacionada || "ALL"],
        enabled: Boolean(auth?.perfil?.id),
        refetchInterval: 7000,
        queryFn: async () =>
            listarDivergenciasInterunidades({
                statusInventario: interStatusInventario,
                unidadeRelacionadaId: interUnidadeRelacionada ? Number(interUnidadeRelacionada) : undefined,
                limit: 500,
                offset: 0,
            }),
    });

    const acuraciaQuery = useQuery({
        queryKey: [
            "inventarioIndicadoresAcuracidade",
            acuraciaDataInicio,
            acuraciaDataFim,
            acuraciaStatusEvento,
            acuraciaUnidadeId,
            acuraciaToleranciaPct,
        ],
        enabled: Boolean(acuraciaDataInicio && acuraciaDataFim),
        queryFn: async () => {
            const tolerancia = Number(acuraciaToleranciaPct);
            return getIndicadoresAcuracidadeInventario({
                dataInicio: acuraciaDataInicio,
                dataFim: acuraciaDataFim,
                statusEvento: acuraciaStatusEvento,
                unidadeId: acuraciaUnidadeId ? Number(acuraciaUnidadeId) : undefined,
                toleranciaPct: Number.isFinite(tolerancia) ? tolerancia : 2,
            });
        },
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
        { k: "Endereço", v: Number(resumo.divergenciasSala || 0), color: "#06b6d4" },
        { k: "Unidade + Endereço", v: Number(resumo.divergenciasUnidadeESala || 0), color: "#fb7185" },
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
    const divergenciasInterItems = useMemo(() => {
        const all = divergenciasInterunidadesQuery.data?.items || [];
        const codigoFiltro = String(interCodigoFiltro || "").trim().toLowerCase();
        const salaFiltro = String(interSalaFiltro || "").trim().toLowerCase();
        return all.filter((row) => {
            const codeOk = !codigoFiltro || String(row.codigoEvento || "").toLowerCase().includes(codigoFiltro);
            const salaOk = !salaFiltro || String(row.salaEncontrada || "").toLowerCase().includes(salaFiltro);
            return codeOk && salaOk;
        });
    }, [divergenciasInterunidadesQuery.data?.items, interCodigoFiltro, interSalaFiltro]);
    const unidadeAtual = Number(auth?.perfil?.unidadeId || 0);
    const interDaMinhaUnidadeFora = useMemo(
        () =>
            divergenciasInterItems.filter(
                (x) => Number(x.unidadeDonaId) === unidadeAtual && Number(x.unidadeEncontradaId) !== unidadeAtual,
            ).length,
        [divergenciasInterItems, unidadeAtual],
    );
    const interOutrasNaMinha = useMemo(
        () =>
            divergenciasInterItems.filter(
                (x) => Number(x.unidadeEncontradaId) === unidadeAtual && Number(x.unidadeDonaId) !== unidadeAtual,
            ).length,
        [divergenciasInterItems, unidadeAtual],
    );
    const interPendentes = useMemo(
        () => divergenciasInterItems.filter((x) => Boolean(x.regularizacaoPendente)).length,
        [divergenciasInterItems],
    );
    const interRegularizadas = useMemo(
        () => divergenciasInterItems.filter((x) => !x.regularizacaoPendente).length,
        [divergenciasInterItems],
    );
    const interEmAndamento = useMemo(
        () => divergenciasInterItems.filter((x) => String(x.statusInventario || "").toUpperCase() === "EM_ANDAMENTO").length,
        [divergenciasInterItems],
    );
    const interEncerrado = useMemo(
        () => divergenciasInterItems.filter((x) => String(x.statusInventario || "").toUpperCase() === "ENCERRADO").length,
        [divergenciasInterItems],
    );
    const clearInterFilters = () => {
        setInterStatusInventario("TODOS");
        setInterUnidadeRelacionada("");
        setInterCodigoFiltro("");
        setInterSalaFiltro("");
    };
    const inventoryStatusPillClass = (status) => {
        const normalized = String(status || "").toUpperCase();
        if (normalized === "EM_ANDAMENTO") return "bg-amber-100 text-amber-800 border-amber-200";
        if (normalized === "ENCERRADO") return "bg-emerald-100 text-emerald-800 border-emerald-200";
        return "bg-slate-100 text-slate-700 border-slate-200";
    };
    const divergenceTypePillClass = (tipo) => {
        const normalized = String(tipo || "").toUpperCase();
        if (normalized.includes("UNIDADE_E_SALA")) return "bg-rose-100 text-rose-800 border-rose-200";
        if (normalized.includes("UNIDADE")) return "bg-orange-100 text-orange-800 border-orange-200";
        if (normalized.includes("SALA")) return "bg-cyan-100 text-cyan-800 border-cyan-200";
        return "bg-slate-100 text-slate-700 border-slate-200";
    };
    const regularizacaoPillClass = (pendente) => (
        pendente
            ? "bg-amber-100 text-amber-800 border-amber-200"
            : "bg-emerald-100 text-emerald-800 border-emerald-200"
    );

    const acuraciaData = acuraciaQuery.data || null;
    const acuraciaResumo = acuraciaData?.resumo || null;
    const acuraciaSemaforo = acuraciaResumo?.semaforo || {};
    const serieSemanalAcuracia = acuraciaData?.serieSemanal || [];
    const serieMensalAcuracia = acuraciaData?.serieMensal || [];
    const trendAcuracidadeExata = calcTrend(serieSemanalAcuracia, "acuracidadeExataPct");
    const trendPendencia = calcTrend(serieSemanalAcuracia, "taxaPendenciaRegularizacaoPct");
    const trendCobertura = calcTrend(serieSemanalAcuracia, "coberturaContagemPct");
    const topSalasCriticasAcuracia = useMemo(() => (acuraciaData?.porSala || []).slice(0, 8), [acuraciaData?.porSala]);
    const onCreateEvento = async (event) => {
        event.preventDefault();
        setUiError(null);

        const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
        if (!perfilIdFinal) {
            setUiError("Informe um perfil valido para abrir o inventario.");
            return;
        }

        let unidadeFinal = unidadeInventariadaId.trim() === "" ? null : Number(unidadeInventariadaId);
        if (escopoTipo === "UNIDADE" && !unidadeFinal) {
            setUiError("Selecione a unidade para escopo UNIDADE.");
            return;
        }
        if (escopoTipo === "LOCAIS") {
            if (!unidadeFinal) {
                setUiError("Selecione a unidade para escopo LOCAIS.");
                return;
            }
            if (!escopoLocalIds.length) {
                setUiError("Selecione ao menos um endereço para escopo LOCAIS.");
                return;
            }
        }
        if (escopoTipo === "GERAL") unidadeFinal = null;

        const codigo = generateCodigoEvento(unidadeFinal);
        const operadoresDesignados = [];
        if (modoContagem === "CEGO") {
            const operadorPerfilId = String(operadorUnicoId || "").trim();
            if (!operadorPerfilId) {
                setUiError("Modo CEGO exige operador unico designado.");
                return;
            }
            operadoresDesignados.push({ perfilId: operadorPerfilId, papelContagem: "OPERADOR_UNICO" });
        } else if (modoContagem === "DUPLO_CEGO") {
            const perfilA = String(operadorAId || "").trim();
            const perfilB = String(operadorBId || "").trim();
            if (!perfilA || !perfilB) {
                setUiError("Modo DUPLO_CEGO exige os perfis dos operadores A e B.");
                return;
            }
            if (perfilA === perfilB) {
                setUiError("Operador A e B devem ser perfis diferentes.");
                return;
            }
            operadoresDesignados.push({ perfilId: perfilA, papelContagem: "OPERADOR_A", permiteDesempate: permiteDesempateA });
            operadoresDesignados.push({ perfilId: perfilB, papelContagem: "OPERADOR_B", permiteDesempate: permiteDesempateB });
        }

        criarEventoMut.mutate({
            codigoEvento: codigo,
            unidadeInventariadaId: unidadeFinal,
            tipoCiclo,
            escopoTipo,
            modoContagem,
            operadoresDesignados: operadoresDesignados.length ? operadoresDesignados : undefined,
            escopoLocalIds: escopoTipo === "LOCAIS" ? escopoLocalIds : undefined,
            abertoPorPerfilId: perfilIdFinal,
        });
    };

    const toggleEscopoLocal = (localId) => {
        const id = String(localId || "");
        if (!id) return;
        setEscopoLocalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const applyPreset = (preset) => {
        if (!preset?.apply) return;
        if (preset.apply.escopoTipo) setEscopoTipo(preset.apply.escopoTipo);
        if (preset.apply.tipoCiclo) setTipoCiclo(preset.apply.tipoCiclo);
        if (preset.apply.unidadeInventariadaId != null) setUnidadeInventariadaId(String(preset.apply.unidadeInventariadaId || ""));
        if (Array.isArray(preset.apply.escopoLocalIds)) setEscopoLocalIds(preset.apply.escopoLocalIds.map((x) => String(x)));
        if (preset.key === "por-sala" && !unidadeInventariadaId) {
            const defaultUnidade = Number(auth?.perfil?.unidadeId || 0);
            if (defaultUnidade > 0) setUnidadeInventariadaId(String(defaultUnidade));
        }
    };

    const executarAtualizacaoStatus = (status, eventoId, observacoes) => {
        const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
        if (!perfilIdFinal) {
            setUiError("Informe um perfil valido para atualizar o status do inventario.");
            return;
        }
        if (!eventoId) return;
        atualizarStatusMut.mutate({
            id: eventoId,
            payload: {
                status,
                encerradoPorPerfilId: perfilIdFinal,
                observacoes: String(observacoes || "").trim() || undefined,
            },
        });
    };

    const abrirModalCritico = (status, eventoId = selectedEventoIdFinal) => {
        const refEvento =
            (eventosQuery.data || []).find((ev) => ev.id === eventoId) ||
            (todosEventosQuery.data || []).find((ev) => ev.id === eventoId) ||
            null;
        if (!refEvento?.id) return;
        setEncerramentoObs("");
        setCriticalConfirmText("");
        setCriticalModal({
            open: true,
            status,
            eventoId: refEvento.id,
            eventoCodigo: refEvento.codigoEvento || "",
        });
    };

    const onConfirmCriticalStatus = () => {
        if (!criticalModal.open || !criticalModal.eventoId || !criticalModal.status) return;
        if (criticalModal.status === "CANCELADO") {
            const confirmFinal = String(criticalConfirmText || "").trim().toUpperCase();
            if (confirmFinal !== "CANCELAR_INVENTARIO") {
                setUiError("Para cancelar, digite exatamente CANCELAR_INVENTARIO.");
                return;
            }
        }
        executarAtualizacaoStatus(criticalModal.status, criticalModal.eventoId, encerramentoObs);
        setCriticalModal({ open: false, status: "", eventoId: "", eventoCodigo: "" });
        setCriticalConfirmText("");
    };

    const onUpdateStatus = async (status, eventoId = selectedEventoIdFinal) => {
        setUiError(null);
        setUiInfo(null);
        if (!eventoId) return;
        if (status === "ENCERRADO" || status === "CANCELADO") {
            abrirModalCritico(status, eventoId);
            return;
        }
        if (status === "EM_ANDAMENTO") {
            executarAtualizacaoStatus(status, eventoId, encerramentoObs);
        }
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

    const onOperadorUnicoInputChange = (value) => {
        const raw = String(value || "");
        const trimmed = raw.trim();
        setOperadorUnicoQuery(raw);
        setOperadorUnicoLookup((prev) => ({ ...prev, selected: null }));
        if (PROFILE_ID_RE.test(trimmed)) {
            setOperadorUnicoId(trimmed);
            return;
        }
        setOperadorUnicoId("");
    };

    const onOperadorAInputChange = (value) => {
        const raw = String(value || "");
        const trimmed = raw.trim();
        setOperadorAQuery(raw);
        setOperadorALookup((prev) => ({ ...prev, selected: null }));
        if (PROFILE_ID_RE.test(trimmed)) {
            setOperadorAId(trimmed);
            return;
        }
        setOperadorAId("");
    };

    const onOperadorBInputChange = (value) => {
        const raw = String(value || "");
        const trimmed = raw.trim();
        setOperadorBQuery(raw);
        setOperadorBLookup((prev) => ({ ...prev, selected: null }));
        if (PROFILE_ID_RE.test(trimmed)) {
            setOperadorBId(trimmed);
            return;
        }
        setOperadorBId("");
    };

    const onSelectOperadorUnico = (perfil) => {
        if (!perfil?.id) return;
        setOperadorUnicoId(String(perfil.id));
        setOperadorUnicoQuery(formatPerfilOption(perfil));
        setOperadorUnicoLookup({ loading: false, data: [], error: null, selected: perfil });
    };

    const onSelectOperadorA = (perfil) => {
        if (!perfil?.id) return;
        setOperadorAId(String(perfil.id));
        setOperadorAQuery(formatPerfilOption(perfil));
        setOperadorALookup({ loading: false, data: [], error: null, selected: perfil });
    };

    const onSelectOperadorB = (perfil) => {
        if (!perfil?.id) return;
        setOperadorBId(String(perfil.id));
        setOperadorBQuery(formatPerfilOption(perfil));
        setOperadorBLookup({ loading: false, data: [], error: null, selected: perfil });
    };

    const eventosAtivos = eventosQuery.data || [];
    const createButtonLabel = escopoTipo === "GERAL" ? "Abrir inventario geral" : "Abrir micro-inventario";
    const criticalImpactText = criticalModal.status === "ENCERRADO"
        ? "Ao encerrar, este inventario nao aceita novas contagens e habilita regularizacao pos-inventario."
        : "Ao cancelar, este inventario e descartado para regularizacao: manter/transferir carga (Art. 185) nao sera permitido neste evento.";
    const divergenciasInterTotal = Number(divergenciasInterunidadesQuery.data?.total || divergenciasInterItems.length || 0);

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5 shadow-sm">
                <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
                    <div>
                        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Inventário - Administração</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Controle operacional do inventário, monitoramento e regularização.
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
                        <h3 className="font-semibold select-none mb-3">Controle do Inventário</h3>
                        <div>
                            <p className="mt-1 text-xs text-slate-600 flex-1">
                                Inventário ativo bloqueia mudança de carga (Art. 183).
                            </p>

                            {auth.perfil ? (
                                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                    <p className="font-semibold text-slate-900">Encarregado</p>
                                    <p className="mt-1">{auth.perfil.nome} ({auth.perfil.matricula})</p>
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
                                        <span className="text-xs text-slate-600">Inventário em andamento</span>
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
                                                    {ev.codigoEvento} ({ev.modoContagem || "PADRAO"} | {ev.escopoTipo || "UNIDADE"} / unidade={ev.unidadeInventariadaId ?? "geral"})
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
                                            Encerrar inventario
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onUpdateStatus("CANCELADO")}
                                            disabled={atualizarStatusMut.isPending}
                                            className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                        >
                                            Cancelar inventario
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
                                </div>
                            ) : (
                                <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    Sem inventário ativo. Use o formulário de criação abaixo.
                                </p>
                            )}

                            <form onSubmit={onCreateEvento} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-sm font-semibold text-slate-900">Novo inventario</p>
                                <div className="grid gap-2 md:grid-cols-2">
                                    {INVENTARIO_PRESETS.map((preset) => (
                                        <button
                                            key={preset.key}
                                            type="button"
                                            onClick={() => applyPreset(preset)}
                                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                                    Inventários por UNIDADE e LOCAIS podem rodar em paralelo entre unidades. Inventário GERAL é exclusivo.
                                </p>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Escopo</span>
                                        <select value={escopoTipo} onChange={(e) => setEscopoTipo(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                            <option value="GERAL">GERAL</option>
                                            <option value="UNIDADE">UNIDADE</option>
                                            <option value="LOCAIS">LOCAIS</option>
                                        </select>
                                    </label>
                                    {escopoTipo !== "GERAL" ? (
                                        <label className="block space-y-1">
                                            <span className="text-xs text-slate-600">Tipo de ciclo</span>
                                            <select value={tipoCiclo} onChange={(e) => setTipoCiclo(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                                <option value="ADHOC">ADHOC</option>
                                                <option value="SEMANAL">SEMANAL</option>
                                                <option value="MENSAL">MENSAL</option>
                                                <option value="ANUAL">ANUAL</option>
                                            </select>
                                        </label>
                                    ) : null}
                                </div>

                                <label className="block space-y-1">
                                    <span className="text-xs text-slate-600">Modo de contagem</span>
                                    <select value={modoContagem} onChange={(e) => setModoContagem(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                        <option value="PADRAO">PADRAO</option>
                                        <option value="CEGO">CEGO</option>
                                        <option value="DUPLO_CEGO">DUPLO_CEGO</option>
                                    </select>
                                </label>

                                {modoContagem === "CEGO" ? (
                                    <div className="space-y-1">
                                        <label className="block space-y-1">
                                            <span className="text-xs text-slate-600">Operador único (buscar por matrícula ou nome)</span>
                                            <div className="relative">
                                                <input
                                                    value={operadorUnicoQuery}
                                                    onChange={(e) => onOperadorUnicoInputChange(e.target.value)}
                                                    onFocus={() => setOperadorUnicoFocused(true)}
                                                    onBlur={() => setTimeout(() => setOperadorUnicoFocused(false), 120)}
                                                    placeholder="Digite matrícula ou nome do operador"
                                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                                />
                                                {operadorUnicoFocused ? (
                                                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                                                        {operadorUnicoLookup.loading ? <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p> : null}
                                                        {!operadorUnicoLookup.loading && operadorUnicoLookup.error ? (
                                                            <p className="px-3 py-2 text-xs text-rose-700">{operadorUnicoLookup.error}</p>
                                                        ) : null}
                                                        {!operadorUnicoLookup.loading && !operadorUnicoLookup.error && (operadorUnicoLookup.data || []).length === 0 && String(operadorUnicoQuery || "").trim().length >= 2 ? (
                                                            <p className="px-3 py-2 text-xs text-slate-500">Nenhum perfil encontrado.</p>
                                                        ) : null}
                                                        {!operadorUnicoLookup.loading && !operadorUnicoLookup.error && (operadorUnicoLookup.data || []).map((perfil) => (
                                                            <button
                                                                key={perfil.id}
                                                                type="button"
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                onClick={() => onSelectOperadorUnico(perfil)}
                                                                className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-violet-50"
                                                            >
                                                                <div className="font-semibold text-slate-900">{perfil.nome || "-"}</div>
                                                                <div className="text-slate-600">Matrícula: <span className="font-mono">{perfil.matricula || "-"}</span></div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </label>
                                        <p className="text-[11px] text-slate-500">Digite ao menos 2 caracteres para sugerir. UUID direto tambem e aceito.</p>
                                        {operadorUnicoId ? (
                                            <p className="text-[11px] text-emerald-700">
                                                Operador selecionado: <span className="font-mono">{operadorUnicoId}</span>
                                                {operadorUnicoLookup?.selected?.nome ? ` (${operadorUnicoLookup.selected.nome})` : ""}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}

                                {modoContagem === "DUPLO_CEGO" ? (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="block space-y-1">
                                                <span className="text-xs text-slate-600">Operador A (matrícula/nome)</span>
                                                <div className="relative">
                                                    <input
                                                        value={operadorAQuery}
                                                        onChange={(e) => onOperadorAInputChange(e.target.value)}
                                                        onFocus={() => setOperadorAFocused(true)}
                                                        onBlur={() => setTimeout(() => setOperadorAFocused(false), 120)}
                                                        placeholder="Digite matrícula ou nome"
                                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                                    />
                                                    {operadorAFocused ? (
                                                        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                                                            {operadorALookup.loading ? <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p> : null}
                                                            {!operadorALookup.loading && operadorALookup.error ? <p className="px-3 py-2 text-xs text-rose-700">{operadorALookup.error}</p> : null}
                                                            {!operadorALookup.loading && !operadorALookup.error && (operadorALookup.data || []).length === 0 && String(operadorAQuery || "").trim().length >= 2 ? (
                                                                <p className="px-3 py-2 text-xs text-slate-500">Nenhum perfil encontrado.</p>
                                                            ) : null}
                                                            {!operadorALookup.loading && !operadorALookup.error && (operadorALookup.data || []).map((perfil) => (
                                                                <button
                                                                    key={perfil.id}
                                                                    type="button"
                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                    onClick={() => onSelectOperadorA(perfil)}
                                                                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-violet-50"
                                                                >
                                                                    <div className="font-semibold text-slate-900">{perfil.nome || "-"}</div>
                                                                    <div className="text-slate-600">Matrícula: <span className="font-mono">{perfil.matricula || "-"}</span></div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </label>
                                            {operadorAId ? (
                                                <p className="text-[11px] text-emerald-700">A: <span className="font-mono">{operadorAId}</span>{operadorALookup?.selected?.nome ? ` (${operadorALookup.selected.nome})` : ""}</p>
                                            ) : null}
                                            <label className="flex items-center gap-2 text-xs text-slate-700">
                                                <input type="checkbox" checked={permiteDesempateA} onChange={(e) => setPermiteDesempateA(e.target.checked)} className="h-4 w-4 accent-violet-600" />
                                                Permitir desempate para A
                                            </label>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block space-y-1">
                                                <span className="text-xs text-slate-600">Operador B (matrícula/nome)</span>
                                                <div className="relative">
                                                    <input
                                                        value={operadorBQuery}
                                                        onChange={(e) => onOperadorBInputChange(e.target.value)}
                                                        onFocus={() => setOperadorBFocused(true)}
                                                        onBlur={() => setTimeout(() => setOperadorBFocused(false), 120)}
                                                        placeholder="Digite matrícula ou nome"
                                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                                    />
                                                    {operadorBFocused ? (
                                                        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                                                            {operadorBLookup.loading ? <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p> : null}
                                                            {!operadorBLookup.loading && operadorBLookup.error ? <p className="px-3 py-2 text-xs text-rose-700">{operadorBLookup.error}</p> : null}
                                                            {!operadorBLookup.loading && !operadorBLookup.error && (operadorBLookup.data || []).length === 0 && String(operadorBQuery || "").trim().length >= 2 ? (
                                                                <p className="px-3 py-2 text-xs text-slate-500">Nenhum perfil encontrado.</p>
                                                            ) : null}
                                                            {!operadorBLookup.loading && !operadorBLookup.error && (operadorBLookup.data || []).map((perfil) => (
                                                                <button
                                                                    key={perfil.id}
                                                                    type="button"
                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                    onClick={() => onSelectOperadorB(perfil)}
                                                                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-violet-50"
                                                                >
                                                                    <div className="font-semibold text-slate-900">{perfil.nome || "-"}</div>
                                                                    <div className="text-slate-600">Matrícula: <span className="font-mono">{perfil.matricula || "-"}</span></div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </label>
                                            {operadorBId ? (
                                                <p className="text-[11px] text-emerald-700">B: <span className="font-mono">{operadorBId}</span>{operadorBLookup?.selected?.nome ? ` (${operadorBLookup.selected.nome})` : ""}</p>
                                            ) : null}
                                            <label className="flex items-center gap-2 text-xs text-slate-700">
                                                <input type="checkbox" checked={permiteDesempateB} onChange={(e) => setPermiteDesempateB(e.target.checked)} className="h-4 w-4 accent-violet-600" />
                                                Permitir desempate para B
                                            </label>
                                        </div>
                                    </div>
                                ) : null}

                                {escopoTipo !== "GERAL" ? (
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Unidade inventariada</span>
                                        <select
                                            value={unidadeInventariadaId}
                                            onChange={(e) => setUnidadeInventariadaId(e.target.value)}
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                        >
                                            <option value="">Selecione</option>
                                            <option value="1">{formatUnidade(1)}</option>
                                            <option value="2">{formatUnidade(2)}</option>
                                            <option value="3">{formatUnidade(3)}</option>
                                            <option value="4">{formatUnidade(4)}</option>
                                        </select>
                                    </label>
                                ) : null}

                                {escopoTipo === "LOCAIS" ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-600">Endereços do escopo</p>
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
                                            {!(locaisEscopoQuery.data || []).length ? <p className="text-xs text-slate-500">Nenhum endereço encontrado para a unidade selecionada.</p> : null}
                                        </div>
                                    </div>
                                ) : null}

                                <button
                                    type="submit"
                                    disabled={criarEventoMut.isPending}
                                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {criarEventoMut.isPending ? "Abrindo..." : createButtonLabel}
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
                        {selectedEventoIdFinal && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
                                <h4 className="text-sm font-semibold">Monitoramento em tempo real</h4>
                                <p className="mt-1 text-[11px] text-slate-600">Por endereço, operador/rodada e pendências de desempate.</p>
                                {monitoramentoQuery.isLoading ? (
                                    <p className="mt-2 text-xs text-slate-500">Carregando monitoramento...</p>
                                ) : monitoramentoQuery.error ? (
                                    <p className="mt-2 text-xs text-rose-700">Falha ao carregar monitoramento.</p>
                                ) : (
                                    <>
                                        <p className="mt-2 text-xs text-slate-700">
                                            Pendentes de desempate: <strong>{Number(monitoramentoQuery.data?.pendentesDesempate || 0)}</strong>
                                        </p>
                                        <div className="mt-2 max-h-52 overflow-auto rounded-lg border border-slate-200">
                                            <table className="min-w-full text-xs">
                                                <thead className="bg-slate-50 text-slate-600">
                                                    <tr>
                                                        <th className="px-2 py-2 text-left">Endereço</th>
                                                        <th className="px-2 py-2 text-right">Esp.</th>
                                                        <th className="px-2 py-2 text-right">A</th>
                                                        <th className="px-2 py-2 text-right">B</th>
                                                        <th className="px-2 py-2 text-right">Des.</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(monitoramentoQuery.data?.porSala || []).map((row) => (
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
                        )}

                        <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-semibold">Divergencias interunidades (tempo real)</h4>
                                    <p className="mt-1 text-[11px] text-slate-600">Visibilidade cruzada entre unidade dona e unidade encontrada.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => divergenciasInterunidadesQuery.refetch()}
                                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-100"
                                >
                                    Atualizar
                                </button>
                            </div>

                            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                <KpiMini label="Da minha unidade fora" value={interDaMinhaUnidadeFora} tone="orange" />
                                <KpiMini label="Outras unidades na minha" value={interOutrasNaMinha} tone="sky" />
                                <KpiMini label="Pendentes" value={interPendentes} tone="amber" />
                                <KpiMini label="Regularizadas" value={interRegularizadas} tone="emerald" />
                                <KpiMini label="Em andamento" value={interEmAndamento} tone="violet" />
                                <KpiMini label="Encerrado" value={interEncerrado} tone="slate" />
                            </div>

                            <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                                <label className="space-y-1 text-xs text-slate-600">
                                    <span>Status</span>
                                    <select value={interStatusInventario} onChange={(e) => setInterStatusInventario(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
                                        <option value="TODOS">TODOS</option>
                                        <option value="EM_ANDAMENTO">EM_ANDAMENTO</option>
                                        <option value="ENCERRADO">ENCERRADO</option>
                                    </select>
                                </label>
                                <label className="space-y-1 text-xs text-slate-600">
                                    <span>Unidade relacionada</span>
                                    <select
                                        value={interUnidadeRelacionada}
                                        onChange={(e) => setInterUnidadeRelacionada(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                                        disabled={!isAdmin}
                                    >
                                        <option value="">{isAdmin ? "Todas" : "Minha unidade"}</option>
                                        <option value="1">{formatUnidade(1)}</option>
                                        <option value="2">{formatUnidade(2)}</option>
                                        <option value="3">{formatUnidade(3)}</option>
                                        <option value="4">{formatUnidade(4)}</option>
                                    </select>
                                </label>
                                <label className="space-y-1 text-xs text-slate-600">
                                    <span>Codigo do inventario</span>
                                    <input value={interCodigoFiltro} onChange={(e) => setInterCodigoFiltro(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="Filtrar por codigo" />
                                </label>
                                <label className="space-y-1 text-xs text-slate-600">
                                    <span>Endereço</span>
                                    <input value={interSalaFiltro} onChange={(e) => setInterSalaFiltro(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs" placeholder="Filtrar por endereço" />
                                </label>
                            </div>
                            <div className="mt-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={clearInterFilters}
                                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                    Limpar filtros
                                </button>
                            </div>

                            {divergenciasInterunidadesQuery.isLoading ? (
                                <p className="mt-3 text-xs text-slate-500">Carregando divergencias...</p>
                            ) : divergenciasInterunidadesQuery.error ? (
                                <p className="mt-3 text-xs text-rose-700">Falha ao carregar divergencias interunidades.</p>
                            ) : (
                                <>
                                    <p className="mt-3 text-xs text-slate-600">Total: {divergenciasInterTotal} | Mostrando: {divergenciasInterItems.length}</p>
                                    <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-200">
                                        <table className="min-w-full text-xs">
                                            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                                                <tr>
                                                    <th className="px-2 py-2 text-left font-semibold">Inventário</th>
                                                    <th className="px-2 py-2 text-left font-semibold">Tombo/Bem</th>
                                                    <th className="px-2 py-2 text-right font-semibold">Dona</th>
                                                    <th className="px-2 py-2 text-right font-semibold">Encontrada</th>
                                                    <th className="px-2 py-2 text-left font-semibold">Endereço</th>
                                                    <th className="px-2 py-2 text-left font-semibold">Tipo</th>
                                                    <th className="px-2 py-2 text-left font-semibold">Regularizacao</th>
                                                    <th className="px-2 py-2 text-left font-semibold">Registro</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {divergenciasInterItems.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="px-3 py-6 text-center text-xs text-slate-500">
                                                            Nenhuma divergencia encontrada para os filtros atuais.
                                                        </td>
                                                    </tr>
                                                ) : divergenciasInterItems.map((row, index) => (
                                                    <tr key={row.contagemId} className={`border-t border-slate-100 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/60"}`}>
                                                        <td className="px-2 py-1.5">
                                                            <div className="font-semibold text-slate-800">{row.codigoEvento}</div>
                                                            <div className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${inventoryStatusPillClass(row.statusInventario)}`}>{row.statusInventario || "-"}</div>
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <div className="font-mono text-slate-800">{row.numeroTombamento || "-"}</div>
                                                            <div className="truncate text-[11px] text-slate-500" title={row.nomeResumo || row.codigoCatalogo || "-"}>
                                                                {row.nomeResumo || row.codigoCatalogo || "-"}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatUnidade(Number(row.unidadeDonaId))}</td>
                                                        <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatUnidade(Number(row.unidadeEncontradaId))}</td>
                                                        <td className="px-2 py-1.5 whitespace-nowrap">{row.salaEncontrada || "-"}</td>
                                                        <td className="px-2 py-1.5">
                                                            <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${divergenceTypePillClass(row.tipoDivergencia)}`}>
                                                                {row.tipoDivergencia || "DIVERGENTE"}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${regularizacaoPillClass(row.regularizacaoPendente)}`}>
                                                                {row.regularizacaoPendente ? "PENDENTE" : (row.regularizacaoAcao || "REGULARIZADA")}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 whitespace-nowrap text-[11px] text-slate-600">{formatDateTimeShort(row.encontradoEm)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>

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
                                                    <p className="text-slate-500 shrink-0">{ev.unidadeInventariadaId ? `Unid ${formatUnidade(ev.unidadeInventariadaId)}` : 'Geral'} | {ev.modoContagem || "PADRAO"}</p>

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

            {criticalModal.open ? (
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
                                onClick={() => {
                                    setCriticalModal({ open: false, status: "", eventoId: "", eventoCodigo: "" });
                                    setCriticalConfirmText("");
                                }}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            >
                                Voltar
                            </button>
                            <button
                                type="button"
                                onClick={onConfirmCriticalStatus}
                                disabled={atualizarStatusMut.isPending}
                                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                            >
                                Confirmar {criticalModal.status === "ENCERRADO" ? "encerramento" : "cancelamento"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5 shadow-sm">
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="font-[Space_Grotesk] text-xl font-semibold">Acuracidade de Inventario</h3>
                        <p className="mt-1 text-xs text-slate-600">
                            Painel operacional com Exact Match, tolerancia por endereço e serie semanal/mensal.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => acuraciaQuery.refetch()}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                    >
                        Atualizar painel
                    </button>
                </header>

                <div className="mt-4 grid gap-3 md:grid-cols-5">
                    <label className="block space-y-1">
                        <span className="text-xs text-slate-600">Data inicio</span>
                        <input
                            type="date"
                            value={acuraciaDataInicio}
                            onChange={(e) => setAcuraciaDataInicio(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-slate-600">Data fim</span>
                        <input
                            type="date"
                            value={acuraciaDataFim}
                            onChange={(e) => setAcuraciaDataFim(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-slate-600">Status evento</span>
                        <select
                            value={acuraciaStatusEvento}
                            onChange={(e) => setAcuraciaStatusEvento(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                            <option value="ENCERRADO">ENCERRADO</option>
                            <option value="EM_ANDAMENTO">EM_ANDAMENTO</option>
                            <option value="CANCELADO">CANCELADO</option>
                        </select>
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-slate-600">Unidade</span>
                        <select
                            value={acuraciaUnidadeId}
                            onChange={(e) => setAcuraciaUnidadeId(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                            <option value="">Todas</option>
                            <option value="1">{formatUnidade(1)}</option>
                            <option value="2">{formatUnidade(2)}</option>
                            <option value="3">{formatUnidade(3)}</option>
                            <option value="4">{formatUnidade(4)}</option>
                        </select>
                    </label>
                    <label className="block space-y-1">
                        <span className="text-xs text-slate-600">Tolerancia % (0-10)</span>
                        <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={acuraciaToleranciaPct}
                            onChange={(e) => setAcuraciaToleranciaPct(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                    </label>
                </div>

                {acuraciaQuery.isLoading && <p className="mt-4 text-sm text-slate-600">Calculando indicadores...</p>}
                {acuraciaQuery.error && (
                    <p className="mt-4 text-sm text-rose-700">Falha ao calcular indicadores de acuracidade.</p>
                )}

                {!acuraciaQuery.isLoading && !acuraciaQuery.error && acuraciaResumo && (
                    <div className="mt-4 space-y-4">
                        <div className="grid gap-3 md:grid-cols-5">
                            <KpiSemaforoCard
                                titulo="Acuracidade Exata"
                                valor={`${Number(acuraciaResumo.acuracidadeExataPct || 0).toFixed(2)}%`}
                                status={acuraciaSemaforo.acuracidadeExata?.status}
                                tendencia={trendAcuracidadeExata}
                            />
                            <KpiSemaforoCard
                                titulo="Acuracidade Tolerancia"
                                valor={`${Number(acuraciaResumo.acuracidadeToleranciaPct || 0).toFixed(2)}%`}
                                status={acuraciaSemaforo.acuracidadeTolerancia?.status}
                            />
                            <KpiSemaforoCard
                                titulo="Pendencia Regularizacao"
                                valor={`${Number(acuraciaResumo.taxaPendenciaRegularizacaoPct || 0).toFixed(2)}%`}
                                status={acuraciaSemaforo.pendenciaRegularizacao?.status}
                                tendencia={trendPendencia}
                            />
                            <KpiSemaforoCard
                                titulo="MTTR Regularizacao"
                                valor={`${Number(acuraciaResumo.mttrRegularizacaoDias || 0).toFixed(2)} dias`}
                                status={acuraciaSemaforo.mttrRegularizacao?.status}
                            />
                            <KpiSemaforoCard
                                titulo="Cobertura Contagem"
                                valor={`${Number(acuraciaResumo.coberturaContagemPct || 0).toFixed(2)}%`}
                                status={acuraciaSemaforo.coberturaContagem?.status}
                                tendencia={trendCobertura}
                            />
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2">
                            <TrendListCard
                                title="Serie semanal"
                                rows={serieSemanalAcuracia}
                                metricKey="acuracidadeExataPct"
                                metricLabel="Acuracidade Exata"
                            />
                            <TrendListCard
                                title="Serie mensal"
                                rows={serieMensalAcuracia}
                                metricKey="acuracidadeExataPct"
                                metricLabel="Acuracidade Exata"
                            />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs uppercase tracking-widest text-slate-500">Top endereços criticas por erro relativo medio</p>
                            {!topSalasCriticasAcuracia.length ? (
                                <p className="mt-2 text-sm text-slate-600">Sem endereços avaliadas para o periodo.</p>
                            ) : (
                                <div className="mt-2 overflow-auto rounded-lg border border-slate-200">
                                    <table className="min-w-full text-left text-xs">
                                        <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                                            <tr>
                                                <th className="px-2 py-2">Endereço</th>
                                                <th className="px-2 py-2">Erro medio</th>
                                                <th className="px-2 py-2">Cobertura</th>
                                                <th className="px-2 py-2">Hit/Miss</th>
                                                <th className="px-2 py-2">Eventos</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {topSalasCriticasAcuracia.map((s) => (
                                                <tr key={`${s.sala}-${s.eventos}`}>
                                                    <td className="px-2 py-2 text-slate-800">{s.sala}</td>
                                                    <td className="px-2 py-2 text-slate-700">{Number(s.erroRelativoMedioSalaPct || 0).toFixed(2)}%</td>
                                                    <td className="px-2 py-2 text-slate-700">{Number(s.coberturaContagemPct || 0).toFixed(2)}%</td>
                                                    <td className="px-2 py-2 text-slate-700">{Number(s.hits || 0)}/{Number(s.avaliacoes || 0)}</td>
                                                    <td className="px-2 py-2 text-slate-700">{Number(s.eventos || 0)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>

            <RegularizationPanel />
        </div>
    );
}

function KpiMini({ label, value, tone = "slate" }) {
    const toneClass = tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : tone === "orange"
            ? "border-orange-200 bg-orange-50 text-orange-800"
            : tone === "sky"
                ? "border-cyan-200 bg-cyan-50 text-cyan-800"
                : tone === "emerald"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : tone === "violet"
                        ? "border-violet-200 bg-violet-50 text-violet-800"
                        : "border-slate-200 bg-slate-50 text-slate-700";
    return (
        <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
            <p className="text-[11px] font-medium">{label}</p>
            <p className="mt-1 text-lg font-semibold">{Number(value || 0)}</p>
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

function KpiSemaforoCard({ titulo, valor, status, tendencia }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-widest text-slate-500">{titulo}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${semaforoClass(status)}`}>
                    {status || "SEM_DADO"}
                </span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{valor}</p>
            {Number.isFinite(tendencia) && (
                <p className={`mt-1 text-[11px] ${tendencia > 0 ? "text-emerald-700" : tendencia < 0 ? "text-rose-700" : "text-slate-500"}`}>
                    Semana anterior: {tendencia > 0 ? "+" : ""}{Number(tendencia).toFixed(2)} p.p.
                </p>
            )}
        </div>
    );
}

function TrendListCard({ title, rows, metricKey, metricLabel }) {
    const list = Array.isArray(rows) ? rows : [];
    const visible = list.slice(-8);
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-widest text-slate-500">{title}</p>
            {!visible.length ? (
                <p className="mt-3 text-sm text-slate-600">Sem pontos para o periodo.</p>
            ) : (
                <div className="mt-3 space-y-2">
                    {visible.map((row) => {
                        const val = Number(row?.[metricKey] || 0);
                        const rotulo = row?.periodo?.rotulo || row?.chave || "-";
                        return (
                            <div key={`${title}-${row?.chave}`} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                                <span className="truncate pr-3 text-slate-600">{rotulo}</span>
                                <span className="font-semibold text-slate-900">{metricLabel}: {val.toFixed(2)}%</span>
                            </div>
                        );
                    })}
                </div>
            )}
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
            <p className="text-xs uppercase tracking-widest text-slate-500">Top endereços com divergencias</p>
            {!list.length ? (
                <p className="mt-3 text-sm text-slate-500">Sem divergencias por endereço.</p>
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







