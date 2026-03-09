import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
import {
    atualizarStatusEventoInventario,
    baixarRelatorioEncerramentoInventarioCsv,
    buscarPerfisDetentor,
    criarEventoInventario,
    getBensNaoLocalizadosInventario,
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
import {
    InfoLine,
    StatusBadge,
} from "./inventory/InventoryAdminUi.jsx";
import InventoryInterunitDivergencesPanel from "./inventory/InventoryInterunitDivergencesPanel.jsx";
import InventoryHistoryPanel from "./inventory/InventoryHistoryPanel.jsx";
import InventoryLiveMonitoringPanel from "./inventory/InventoryLiveMonitoringPanel.jsx";
import InventoryUncountedAssetsPanel from "./inventory/InventoryUncountedAssetsPanel.jsx";
import InventoryEventSetupPanel from "./inventory/InventoryEventSetupPanel.jsx";
import InventoryAccuracyPanel from "./inventory/InventoryAccuracyPanel.jsx";

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

function formatDateTimeShort(value) {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return "-";
    try {
        return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
    } catch {
        return d.toISOString();
    }
}

function formatPercent(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return "0%";
    return `${num.toFixed(num % 1 === 0 ? 0 : 2)}%`;
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

export default function InventoryAdminPanel({ onOpenInventoryCount = null, onOpenAssetsExplorer = null }) {
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
    const [naoLocalizadosVisibleByGroup, setNaoLocalizadosVisibleByGroup] = useState({});
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

    const naoLocalizadosQuery = useQuery({
        queryKey: ["inventarioNaoLocalizados", selectedEventoIdFinal],
        enabled: Boolean(selectedEventoIdFinal),
        queryFn: async () => getBensNaoLocalizadosInventario(selectedEventoIdFinal),
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
    const naoLocalizadosSummary = naoLocalizadosQuery.data?.summary || {
        totalNaoLocalizados: 0,
        totalEnderecosComPendencia: 0,
        totalBensEsperados: 0,
        totalContados: 0,
        percentualNaoLocalizados: 0,
    };
    const naoLocalizadosGroups = Array.isArray(naoLocalizadosQuery.data?.groups) ? naoLocalizadosQuery.data.groups : [];
    const percentualCoberturaNaoLocalizados = naoLocalizadosSummary.totalBensEsperados > 0
        ? Number(((Number(naoLocalizadosSummary.totalContados || 0) / Number(naoLocalizadosSummary.totalBensEsperados || 1)) * 100).toFixed(2))
        : 0;
    const clearInterFilters = () => {
        setInterStatusInventario("TODOS");
        setInterUnidadeRelacionada("");
        setInterCodigoFiltro("");
        setInterSalaFiltro("");
    };

    const openInventoryCountForGroup = (group) => {
        if (typeof onOpenInventoryCount !== "function" || !group) return;
        onOpenInventoryCount({
            eventoInventarioId: selectedEventoIdFinal || null,
            unidadeEncontradaId: group.unidadeId != null ? Number(group.unidadeId) : null,
            localId: group.localId ? String(group.localId) : null,
            salaEncontrada: group.localNome ? String(group.localNome) : null,
            originLabel: "Inventário - Administração",
            originContext: `Retomada de contagem para ${group.localNome || "endereço"}${eventoAtivo?.codigoEvento ? ` no evento ${eventoAtivo.codigoEvento}` : ""}.`,
        });
    };

    const openAssetDetailFromRow = (row) => {
        if (typeof onOpenAssetsExplorer !== "function" || !row?.numeroTombamento) return;
        onOpenAssetsExplorer({
            unidadeDonaId: row.unidadeDonaId != null ? Number(row.unidadeDonaId) : null,
            numeroTombamento: String(row.numeroTombamento),
            openDetail: true,
            originLabel: "Inventário - Administração",
            originContext: `Detalhe aberto a partir de bens não contados${row.localNome ? ` em ${row.localNome}` : ""}.`,
        });
    };

    const openAssetsExplorerBySku = (row) => {
        if (typeof onOpenAssetsExplorer !== "function" || !row?.codigoCatalogo) return;
        onOpenAssetsExplorer({
            unidadeDonaId: row.unidadeDonaId != null ? Number(row.unidadeDonaId) : null,
            codigoCatalogo: String(row.codigoCatalogo),
            openDetail: false,
            originLabel: "Inventário - Administração",
            originContext: `Consulta por Material (SKU) aberta a partir de bens não contados${row.localNome ? ` em ${row.localNome}` : ""}.`,
        });
    };

    const expandNaoLocalizadosGroup = (localId, totalItems) => {
        const key = String(localId || "");
        if (!key) return;
        setNaoLocalizadosVisibleByGroup((prev) => ({
            ...prev,
            [key]: Math.min(Number(totalItems || 0), Number(prev[key] || 20) + 20),
        }));
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
            setUiError("Informe um perfil válido para abrir o inventário.");
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
            setUiError("Informe um perfil válido para atualizar o status do inventário.");
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
    const historicoEventos = (todosEventosQuery.data || []).slice(0, 15);
    const hasActiveEvent = Boolean(selectedEventoIdFinal);
    const createButtonLabel = escopoTipo === "GERAL" ? "Abrir inventário geral" : "Abrir micro-inventário";
    const criticalImpactText = criticalModal.status === "ENCERRADO"
        ? "Ao encerrar, este inventário não aceita novas contagens e habilita regularização pós-inventário."
        : "Ao cancelar, este inventário é descartado para regularização: manter ou transferir carga (Art. 185) não será permitido neste evento.";
    const divergenciasInterTotal = Number(divergenciasInterunidadesQuery.data?.total || divergenciasInterItems.length || 0);
    const activeEventScope = eventoAtivo?.escopoTipo || "GERAL";
    const activeEventMode = eventoAtivo?.modoContagem || "PADRAO";
    const activeEventUnitLabel = eventoAtivo?.unidadeInventariadaId
        ? formatUnidade(Number(eventoAtivo.unidadeInventariadaId))
        : "Todas as unidades";
    const activeEventOpenedAt = formatDateTimeShort(
        eventoAtivo?.abertoEm || eventoAtivo?.createdAt || eventoAtivo?.updatedAt || null,
    );
    const activeEventOpenedBy = eventoAtivo?.abertoPorNome || "Sistema";
    const monitoramentoRows = Array.isArray(monitoramentoQuery.data?.porSala) ? monitoramentoQuery.data.porSala : [];
    const monitoramentoTotalEsperados = monitoramentoRows.reduce((acc, row) => acc + Number(row.qtdEsperados || 0), 0);
    const monitoramentoTotalA = monitoramentoRows.reduce((acc, row) => acc + Number(row.qtdA || 0), 0);
    const monitoramentoTotalB = monitoramentoRows.reduce((acc, row) => acc + Number(row.qtdB || 0), 0);
    const monitoramentoTotalDesempate = monitoramentoRows.reduce((acc, row) => acc + Number(row.qtdDesempate || 0), 0);

    const accountabilityBlock = auth.perfil ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">Encarregado</p>
            <p className="mt-1">{auth.perfil.nome} ({auth.perfil.matricula})</p>
        </div>
    ) : (
        <label className="block space-y-1">
            <span className="text-xs text-slate-600">PerfilId (UUID) para abrir ou encerrar</span>
            <input
                value={perfilId}
                onChange={(e) => setPerfilId(e.target.value)}
                placeholder="UUID do perfil"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
        </label>
    );

    const activeEventSelector = eventosAtivos.length > 0 ? (
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
                {eventosAtivos.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                        {ev.codigoEvento} ({ev.modoContagem || "PADRAO"} | {ev.escopoTipo || "UNIDADE"} / unidade={ev.unidadeInventariadaId ?? "geral"})
                    </option>
                ))}
            </select>
        </label>
    ) : null;

    const newInventoryAndSuggestions = (
        <InventoryEventSetupPanel
            onCreateEvento={onCreateEvento}
            presets={INVENTARIO_PRESETS}
            applyPreset={applyPreset}
            escopoTipo={escopoTipo}
            setEscopoTipo={setEscopoTipo}
            tipoCiclo={tipoCiclo}
            setTipoCiclo={setTipoCiclo}
            modoContagem={modoContagem}
            setModoContagem={setModoContagem}
            operadorUnicoQuery={operadorUnicoQuery}
            onOperadorUnicoInputChange={onOperadorUnicoInputChange}
            setOperadorUnicoFocused={setOperadorUnicoFocused}
            operadorUnicoFocused={operadorUnicoFocused}
            operadorUnicoLookup={operadorUnicoLookup}
            onSelectOperadorUnico={onSelectOperadorUnico}
            operadorUnicoId={operadorUnicoId}
            operadorAQuery={operadorAQuery}
            onOperadorAInputChange={onOperadorAInputChange}
            setOperadorAFocused={setOperadorAFocused}
            operadorAFocused={operadorAFocused}
            operadorALookup={operadorALookup}
            onSelectOperadorA={onSelectOperadorA}
            operadorAId={operadorAId}
            permiteDesempateA={permiteDesempateA}
            setPermiteDesempateA={setPermiteDesempateA}
            operadorBQuery={operadorBQuery}
            onOperadorBInputChange={onOperadorBInputChange}
            setOperadorBFocused={setOperadorBFocused}
            operadorBFocused={operadorBFocused}
            operadorBLookup={operadorBLookup}
            onSelectOperadorB={onSelectOperadorB}
            operadorBId={operadorBId}
            permiteDesempateB={permiteDesempateB}
            setPermiteDesempateB={setPermiteDesempateB}
            unidadeInventariadaId={unidadeInventariadaId}
            setUnidadeInventariadaId={setUnidadeInventariadaId}
            locaisEscopo={locaisEscopoQuery.data || []}
            escopoLocalIds={escopoLocalIds}
            toggleEscopoLocal={toggleEscopoLocal}
            isCreating={criarEventoMut.isPending}
            createButtonLabel={createButtonLabel}
            sugestoesCicloQuery={sugestoesCicloQuery}
            onApplySuggestion={(s) => {
                setEscopoTipo("LOCAIS");
                setTipoCiclo("SEMANAL");
                setUnidadeInventariadaId(String(s.unidadeId || ""));
                setEscopoLocalIds([String(s.localId)]);
            }}
        />
    );

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
                <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Inventário - Administração</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Cockpit operacional para evento ativo, retomada de contagem e monitoramento contínuo.
                        </p>
                    </div>
                    <StatusBadge
                        label={hasActiveEvent ? "Evento em andamento" : "Sem evento em andamento"}
                        tone={hasActiveEvent ? "amber" : "slate"}
                    />
                </header>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                    <StatusBadge label={hasActiveEvent ? (eventoAtivo?.codigoEvento || "-") : "Abra um novo inventário"} tone="violet" mono />
                    <StatusBadge label={`Escopo: ${hasActiveEvent ? activeEventScope : escopoTipo}`} />
                    <StatusBadge label={`Modo: ${hasActiveEvent ? activeEventMode : modoContagem}`} tone="sky" />
                    <StatusBadge label={`Unidade: ${hasActiveEvent ? activeEventUnitLabel : (unidadeInventariadaId ? formatUnidade(Number(unidadeInventariadaId)) : "A definir")}`} tone="emerald" />
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

                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(22rem,24rem)_minmax(0,1fr)]">
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
                                            disabled={atualizarStatusMut.isPending}
                                            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                                        >
                                            Encerrar inventário
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onUpdateStatus("CANCELADO")}
                                            disabled={atualizarStatusMut.isPending}
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
                                    Sem inventário ativo. Use o formulário de criação abaixo.
                                </p>
                            )}

                            {!hasActiveEvent ? <div className="mt-4">{newInventoryAndSuggestions}</div> : null}
                        </div>
                    </div>

                    <div className="space-y-4">
                            <InventoryUncountedAssetsPanel
                                query={naoLocalizadosQuery}
                                summary={naoLocalizadosSummary}
                                percentualCobertura={percentualCoberturaNaoLocalizados}
                                groups={naoLocalizadosGroups}
                                visibleByGroup={naoLocalizadosVisibleByGroup}
                                onRefresh={() => naoLocalizadosQuery.refetch()}
                                onOpenInventoryCount={openInventoryCountForGroup}
                                onOpenAssetDetail={openAssetDetailFromRow}
                                onOpenAssetsExplorerBySku={openAssetsExplorerBySku}
                                onExpandGroup={expandNaoLocalizadosGroup}
                                formatPercent={formatPercent}
                                formatUnidade={formatUnidade}
                            />
                        <InventoryLiveMonitoringPanel
                            visible={selectedEventoIdFinal}
                            isAdmin={isAdmin}
                            query={monitoramentoQuery}
                            rows={monitoramentoRows}
                            totalA={monitoramentoTotalA}
                            totalB={monitoramentoTotalB}
                            totalEsperados={monitoramentoTotalEsperados}
                            totalDesempate={monitoramentoTotalDesempate}
                        />

                        <InventoryInterunitDivergencesPanel
                            query={divergenciasInterunidadesQuery}
                            interDaMinhaUnidadeFora={interDaMinhaUnidadeFora}
                            interOutrasNaMinha={interOutrasNaMinha}
                            interPendentes={interPendentes}
                            interRegularizadas={interRegularizadas}
                            interEmAndamento={interEmAndamento}
                            interEncerrado={interEncerrado}
                            interStatusInventario={interStatusInventario}
                            setInterStatusInventario={setInterStatusInventario}
                            interUnidadeRelacionada={interUnidadeRelacionada}
                            setInterUnidadeRelacionada={setInterUnidadeRelacionada}
                            interCodigoFiltro={interCodigoFiltro}
                            setInterCodigoFiltro={setInterCodigoFiltro}
                            interSalaFiltro={interSalaFiltro}
                            setInterSalaFiltro={setInterSalaFiltro}
                            clearInterFilters={clearInterFilters}
                            isAdmin={isAdmin}
                            formatUnidade={formatUnidade}
                            divergenciasInterTotal={divergenciasInterTotal}
                            divergenciasInterItems={divergenciasInterItems}
                            inventoryStatusPillClass={inventoryStatusPillClass}
                            divergenceTypePillClass={divergenceTypePillClass}
                            regularizacaoPillClass={regularizacaoPillClass}
                            formatDateTimeShort={formatDateTimeShort}
                        />

                        <InventoryHistoryPanel
                            historicoEventos={historicoEventos}
                            hasActiveEvent={hasActiveEvent}
                            editingEventoId={editingEventoId}
                            editForm={editForm}
                            setEditForm={setEditForm}
                            isAdmin={isAdmin}
                            atualizarEventoMutPending={atualizarEventoMut.isPending}
                            setEditingEventoId={setEditingEventoId}
                            onSaveEditEvento={saveEditEvento}
                            onLoadRelatorio={(ev) => {
                                setSelectedEventoId(ev.id);
                                setRelatorioEventoId(ev.id);
                                setUiInfo(`Relatório carregado para o evento ${ev.codigoEvento}.`);
                            }}
                            onReopenEvento={(ev) => onUpdateStatus("EM_ANDAMENTO", ev.id)}
                            onHandleEditEvento={handleEditEvento}
                            onHandleDeleteEvento={handleDeleteEvento}
                            formatUnidade={formatUnidade}
                        />
                    </div>
                </div>
            </section>

            {hasActiveEvent ? (
                <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Area secundaria</p>
                            <p className="mt-1 text-sm text-slate-700">
                                Configuracao de novo ciclo e leitura gerencial permanecem acessiveis, mas fora da zona principal de retomada da contagem.
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
                    <div className="mt-4">
                        {newInventoryAndSuggestions}
                    </div>
                </section>
            ) : null}

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
            <InventoryAccuracyPanel
                hasActiveEvent={hasActiveEvent}
                acuraciaDataInicio={acuraciaDataInicio}
                setAcuraciaDataInicio={setAcuraciaDataInicio}
                acuraciaDataFim={acuraciaDataFim}
                setAcuraciaDataFim={setAcuraciaDataFim}
                acuraciaStatusEvento={acuraciaStatusEvento}
                setAcuraciaStatusEvento={setAcuraciaStatusEvento}
                acuraciaUnidadeId={acuraciaUnidadeId}
                setAcuraciaUnidadeId={setAcuraciaUnidadeId}
                acuraciaToleranciaPct={acuraciaToleranciaPct}
                setAcuraciaToleranciaPct={setAcuraciaToleranciaPct}
                acuraciaQuery={acuraciaQuery}
                acuraciaResumo={acuraciaResumo}
                acuraciaSemaforo={acuraciaSemaforo}
                trendAcuracidadeExata={trendAcuracidadeExata}
                trendPendencia={trendPendencia}
                trendCobertura={trendCobertura}
                serieSemanalAcuracia={serieSemanalAcuracia}
                serieMensalAcuracia={serieMensalAcuracia}
                topSalasCriticasAcuracia={topSalasCriticasAcuracia}
                formatUnidade={formatUnidade}
            />

            <RegularizationPanel />
        </div>
    );
}

