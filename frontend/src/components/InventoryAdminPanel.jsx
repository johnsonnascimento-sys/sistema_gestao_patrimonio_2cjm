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
import RegularizationPanel from "./RegularizationPanel.jsx";
import {
    StatusBadge,
} from "./inventory/InventoryAdminUi.jsx";
import InventoryEventSetupPanel from "./inventory/InventoryEventSetupPanel.jsx";
import InventoryAccuracyPanel from "./inventory/InventoryAccuracyPanel.jsx";
import InventoryActiveEventPanel from "./inventory/InventoryActiveEventPanel.jsx";
import InventorySecondarySetupSection from "./inventory/InventorySecondarySetupSection.jsx";
import InventoryCriticalActionModal from "./inventory/InventoryCriticalActionModal.jsx";
import InventoryAdminHeader from "./inventory/InventoryAdminHeader.jsx";
import InventoryAdminOperationalColumn from "./inventory/InventoryAdminOperationalColumn.jsx";
import {
    calcTrend,
    formatDateTimeShort,
    formatPercent,
    formatPerfilOption,
    formatUnidade,
    generateCodigoEvento,
    shiftDays,
    toIsoDateInput,
} from "./inventory/InventoryAdminUtils.js";

const PROFILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVENTARIO_PRESETS = [
    { key: "inventario-geral", label: "Inventário geral", apply: { escopoTipo: "GERAL", tipoCiclo: "ADHOC", unidadeInventariadaId: "", escopoLocalIds: [] } },
    { key: "ciclo-1aud", label: "Ciclo semanal 1a Aud", apply: { escopoTipo: "UNIDADE", tipoCiclo: "SEMANAL", unidadeInventariadaId: "1", escopoLocalIds: [] } },
    { key: "ciclo-2aud", label: "Ciclo semanal 2a Aud", apply: { escopoTipo: "UNIDADE", tipoCiclo: "SEMANAL", unidadeInventariadaId: "2", escopoLocalIds: [] } },
    { key: "ciclo-foro", label: "Ciclo semanal Foro", apply: { escopoTipo: "UNIDADE", tipoCiclo: "SEMANAL", unidadeInventariadaId: "3", escopoLocalIds: [] } },
    { key: "ciclo-almox", label: "Ciclo semanal Almox", apply: { escopoTipo: "UNIDADE", tipoCiclo: "SEMANAL", unidadeInventariadaId: "4", escopoLocalIds: [] } },
    { key: "por-sala", label: "Por endereço", apply: { escopoTipo: "LOCAIS", tipoCiclo: "ADHOC" } },
];

function semaforoClass(status) {
    if (status === "VERDE") return "border-emerald-300 bg-emerald-50 text-emerald-700";
    if (status === "AMARELO") return "border-amber-300 bg-amber-50 text-amber-700";
    return "border-rose-300 bg-rose-50 text-rose-700";
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
                <InventoryAdminHeader
                    hasActiveEvent={hasActiveEvent}
                    eventoCodigo={eventoAtivo?.codigoEvento || ""}
                    activeEventScope={activeEventScope}
                    escopoTipo={escopoTipo}
                    activeEventMode={activeEventMode}
                    modoContagem={modoContagem}
                    activeEventUnitLabel={activeEventUnitLabel}
                    unidadeInventariadaId={unidadeInventariadaId}
                    activeEventOpenedBy={activeEventOpenedBy}
                    uiError={uiError}
                    uiInfo={uiInfo}
                    formatUnidade={formatUnidade}
                />

                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(22rem,24rem)_minmax(0,1fr)]">
                    <InventoryActiveEventPanel
                        hasActiveEvent={hasActiveEvent}
                        eventosQuery={eventosQuery}
                        accountabilityBlock={accountabilityBlock}
                        activeEventSelector={activeEventSelector}
                        atualizarStatusMutPending={atualizarStatusMut.isPending}
                        onUpdateStatus={onUpdateStatus}
                        encerramentoObs={encerramentoObs}
                        setEncerramentoObs={setEncerramentoObs}
                        eventoAtivo={eventoAtivo}
                        activeEventScope={activeEventScope}
                        activeEventMode={activeEventMode}
                        activeEventUnitLabel={activeEventUnitLabel}
                        activeEventOpenedBy={activeEventOpenedBy}
                        activeEventOpenedAt={activeEventOpenedAt}
                        selectedEventoIdFinal={selectedEventoIdFinal}
                        newInventoryAndSuggestions={newInventoryAndSuggestions}
                    />

                    <InventoryAdminOperationalColumn
                        naoLocalizadosQuery={naoLocalizadosQuery}
                        naoLocalizadosSummary={naoLocalizadosSummary}
                        percentualCoberturaNaoLocalizados={percentualCoberturaNaoLocalizados}
                        naoLocalizadosGroups={naoLocalizadosGroups}
                        naoLocalizadosVisibleByGroup={naoLocalizadosVisibleByGroup}
                        openInventoryCountForGroup={openInventoryCountForGroup}
                        openAssetDetailFromRow={openAssetDetailFromRow}
                        openAssetsExplorerBySku={openAssetsExplorerBySku}
                        expandNaoLocalizadosGroup={expandNaoLocalizadosGroup}
                        formatPercent={formatPercent}
                        formatUnidade={formatUnidade}
                        selectedEventoIdFinal={selectedEventoIdFinal}
                        isAdmin={isAdmin}
                        monitoramentoQuery={monitoramentoQuery}
                        monitoramentoRows={monitoramentoRows}
                        monitoramentoTotalA={monitoramentoTotalA}
                        monitoramentoTotalB={monitoramentoTotalB}
                        monitoramentoTotalEsperados={monitoramentoTotalEsperados}
                        monitoramentoTotalDesempate={monitoramentoTotalDesempate}
                        divergenciasInterunidadesQuery={divergenciasInterunidadesQuery}
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
                        divergenciasInterTotal={divergenciasInterTotal}
                        divergenciasInterItems={divergenciasInterItems}
                        inventoryStatusPillClass={inventoryStatusPillClass}
                        divergenceTypePillClass={divergenceTypePillClass}
                        regularizacaoPillClass={regularizacaoPillClass}
                        formatDateTimeShort={formatDateTimeShort}
                        historicoEventos={historicoEventos}
                        hasActiveEvent={hasActiveEvent}
                        editingEventoId={editingEventoId}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        atualizarEventoMutPending={atualizarEventoMut.isPending}
                        setEditingEventoId={setEditingEventoId}
                        saveEditEvento={saveEditEvento}
                        setSelectedEventoId={setSelectedEventoId}
                        setRelatorioEventoId={setRelatorioEventoId}
                        setUiInfo={setUiInfo}
                        onUpdateStatus={onUpdateStatus}
                        handleEditEvento={handleEditEvento}
                        handleDeleteEvento={handleDeleteEvento}
                    />
                </div>
            </section>

            <InventorySecondarySetupSection
                hasActiveEvent={hasActiveEvent}
                content={newInventoryAndSuggestions}
            />

            <InventoryCriticalActionModal
                criticalModal={criticalModal}
                criticalImpactText={criticalImpactText}
                encerramentoObs={encerramentoObs}
                setEncerramentoObs={setEncerramentoObs}
                criticalConfirmText={criticalConfirmText}
                setCriticalConfirmText={setCriticalConfirmText}
                atualizarStatusMutPending={atualizarStatusMut.isPending}
                onClose={() => {
                    setCriticalModal({ open: false, status: "", eventoId: "", eventoCodigo: "" });
                    setCriticalConfirmText("");
                }}
                onConfirm={onConfirmCriticalStatus}
            />
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

