/**
 * Modulo: frontend/components
 * Arquivo: MaterialInservivelBaixaPanel.jsx
 * Funcao no sistema: concentrar a triagem de material inservivel e a baixa patrimonial em uma workspace unica.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../context/AuthContext.jsx";
import {
  cancelarBaixaPatrimonial,
  concluirBaixaPatrimonial,
  criarAvaliacaoInservivel,
  criarBaixaPatrimonial,
  criarDocumento,
  getBemDetalhe,
  listarAvaliacoesInservivel,
  listarBaixasPatrimoniais,
  listarBens,
  listarMarcacoesInserviveis,
  obterBaixaPatrimonial,
  atualizarBaixaPatrimonial,
  atualizarMarcacaoInservivel,
} from "../services/apiClient.js";
import BaixaProcessDrawer from "./BaixaProcessDrawer.jsx";
import BaixaProcessesList from "./BaixaProcessesList.jsx";
import InservivelAssessmentWizard from "./InservivelAssessmentWizard.jsx";
import InservivelQueueTable from "./InservivelQueueTable.jsx";
import {
  buildBaixaProcessCsv,
  buildBaixaProcessCsvFilename,
  triggerCsvDownload,
} from "./baixaProcessCsv.js";

const EMPTY_BUSCA = Object.freeze({
  numeroTombamento: "",
  q: "",
  unidadeDonaId: "",
  localFisico: "",
});

const EMPTY_QUEUE_FILTERS = Object.freeze({
  q: "",
  tipoInservivel: "",
  destinacaoSugerida: "",
  statusFluxo: "",
  unidadeDonaId: "",
  localFisico: "",
});

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("pt-BR");
}

function formatUnit(id) {
  if (id === 1) return "1ª Aud";
  if (id === 2) return "2ª Aud";
  if (id === 3) return "Foro";
  if (id === 4) return "Almox";
  return String(id || "-");
}

function normalizeBusca(input) {
  return {
    numeroTombamento: String(input?.numeroTombamento || "").replace(/\D+/g, "").slice(0, 10),
    q: String(input?.q || "").trim(),
    unidadeDonaId: String(input?.unidadeDonaId || "").trim(),
    localFisico: String(input?.localFisico || "").trim(),
  };
}

function summarizePermissions({ canMarkWrite, canMarkExecute, canBaixaWrite, canBaixaExecute }) {
  if (canMarkExecute && canBaixaExecute) {
    return {
      label: "Execução direta",
      helper: "Pode marcar inservível, concluir baixas e cancelar rascunhos.",
      tone: "violet",
    };
  }
  if (canMarkWrite || canBaixaWrite) {
    return {
      label: "Fluxo com aprovação",
      helper: "Pode montar avaliações e processos, mas a conclusão final pode exigir aprovação.",
      tone: "amber",
    };
  }
  return {
    label: "Somente leitura",
    helper: "Consulta permitida, sem escrita nesta tela.",
    tone: "slate",
  };
}

function SummaryCard({ label, value, helper, tone = "slate" }) {
  const toneMap = {
    slate: "border-slate-200 bg-white text-slate-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${toneMap[tone] || toneMap.slate}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 font-[Space_Grotesk] text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{helper}</p>
    </article>
  );
}

function SearchResultCard({ item, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`rounded-2xl border p-4 text-left transition ${
        active ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{item.numeroTombamento}</p>
          <p className="mt-1 text-sm text-slate-700">{item.nomeResumo || item.catalogoDescricao || item.descricao || "-"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatUnit(Number(item.unidadeDonaId))} • {item.localFisico || "Local não informado"}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
          {item.status || "OK"}
        </span>
      </div>
    </button>
  );
}

function buildDesaparecimentoItems(detail) {
  if (!detail?.bem?.id) return [];
  return [
    {
      id: detail.bem.id,
      bemId: detail.bem.id,
      numeroTombamento: detail.bem.numeroTombamento,
      catalogoDescricao: detail.catalogo?.descricao || detail.bem.catalogoDescricao || detail.bem.descricao || "Bem selecionado",
      unidadeDonaId: detail.bem.unidadeDonaId,
      tipoInservivel: detail.bem.tipoInservivel || null,
    },
  ];
}

export default function MaterialInservivelBaixaPanel() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  const canMarkExecute = !auth.authEnabled || auth.can("action.inservivel.marcar.execute");
  const canMarkRequest = !auth.authEnabled || auth.can("action.inservivel.marcar.request");
  const canBaixaExecute = !auth.authEnabled || auth.can("action.baixa.execute");
  const canBaixaRequest = !auth.authEnabled || auth.can("action.baixa.request");
  const canMarkWrite = canMarkExecute || canMarkRequest;
  const canBaixaWrite = canBaixaExecute || canBaixaRequest;
  const permissionSummary = summarizePermissions({
    canMarkWrite,
    canMarkExecute,
    canBaixaWrite,
    canBaixaExecute,
  });

  const [busca, setBusca] = useState(EMPTY_BUSCA);
  const [buscaAplicada, setBuscaAplicada] = useState(null);
  const [selectedBemId, setSelectedBemId] = useState(null);
  const [queueFilters, setQueueFilters] = useState(EMPTY_QUEUE_FILTERS);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [feedback, setFeedback] = useState({ type: "", text: "" });
  const [evidenciaUrl, setEvidenciaUrl] = useState("");
  const [drawer, setDrawer] = useState({ open: false, processId: null, mode: "" });
  const [exportingProcessId, setExportingProcessId] = useState(null);

  const buscaQuery = useQuery({
    queryKey: ["material-baixa", "busca-bens", buscaAplicada],
    enabled: Boolean(buscaAplicada),
    queryFn: async () => {
      const data = await listarBens({
        numeroTombamento: buscaAplicada.numeroTombamento || undefined,
        q: buscaAplicada.q || undefined,
        unidadeDonaId: buscaAplicada.unidadeDonaId ? Number(buscaAplicada.unidadeDonaId) : undefined,
        localFisico: buscaAplicada.localFisico || undefined,
        limit: 12,
        offset: 0,
      });
      return data.items || [];
    },
  });

  const queueQuery = useQuery({
    queryKey: ["material-baixa", "marcacoes", queueFilters],
    queryFn: () => listarMarcacoesInserviveis({ ...queueFilters, limit: 200, offset: 0 }),
  });

  const baixasQuery = useQuery({
    queryKey: ["material-baixa", "baixas"],
    queryFn: () => listarBaixasPatrimoniais({ limit: 100, offset: 0 }),
  });

  const bemDetalheQuery = useQuery({
    queryKey: ["material-baixa", "bem-detalhe", selectedBemId],
    enabled: Boolean(selectedBemId),
    queryFn: () => getBemDetalhe(selectedBemId),
  });

  const historicoQuery = useQuery({
    queryKey: ["material-baixa", "avaliacoes", selectedBemId],
    enabled: Boolean(selectedBemId),
    queryFn: async () => {
      const data = await listarAvaliacoesInservivel(selectedBemId);
      return data.items || [];
    },
  });

  const processDetailQuery = useQuery({
    queryKey: ["material-baixa", "processo", drawer.processId],
    enabled: Boolean(drawer.processId),
    queryFn: () => obterBaixaPatrimonial(drawer.processId),
  });

  const queueItems = queueQuery.data?.items || [];
  const selectedQueueItems = useMemo(
    () => queueItems.filter((item) => selectedQueueIds.includes(item.id)),
    [queueItems, selectedQueueIds],
  );
  const drawerSelectedItems = useMemo(() => {
    if (drawer.processId) return processDetailQuery.data?.itens || [];
    if (drawer.mode === "DESAPARECIMENTO") return buildDesaparecimentoItems(bemDetalheQuery.data);
    return selectedQueueItems;
  }, [drawer.mode, drawer.processId, processDetailQuery.data, bemDetalheQuery.data, selectedQueueItems]);

  useEffect(() => {
    setSelectedQueueIds((current) => current.filter((id) => queueItems.some((item) => item.id === id)));
  }, [queueItems]);

  useEffect(() => {
    if (!buscaQuery.data?.length) return;
    if (selectedBemId && buscaQuery.data.some((item) => item.id === selectedBemId)) return;
    setSelectedBemId(buscaQuery.data[0].id);
  }, [buscaQuery.data, selectedBemId]);

  const refreshOperationalData = async ({ includeBem = true } = {}) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["material-baixa", "marcacoes"] }),
      queryClient.invalidateQueries({ queryKey: ["material-baixa", "baixas"] }),
      queryClient.invalidateQueries({ queryKey: ["material-baixa", "avaliacoes"] }),
      includeBem && selectedBemId
        ? queryClient.invalidateQueries({ queryKey: ["material-baixa", "bem-detalhe", selectedBemId] })
        : Promise.resolve(),
    ]);
  };

  const avaliacaoMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await criarAvaliacaoInservivel({
        bemId: payload.bemId,
        tipoInservivel: payload.tipoInservivelPreview,
        descricaoInformada: payload.descricaoInformada,
        justificativa: payload.justificativa,
        observacoes: payload.observacoes,
        criterios: payload.criterios,
        destinacaoSugerida: payload.destinacaoSugerida,
      });

      if (response?.avaliacao?.id && payload.driveUrlEvidencia) {
        await criarDocumento({
          tipo: "OUTRO",
          titulo: "Evidência - Material Inservível / Baixa",
          avaliacaoInservivelId: response.avaliacao.id,
          driveUrl: payload.driveUrlEvidencia,
          observacoes: `Triagem Art. 141: ${response.avaliacao.tipoInservivel}`,
        });
      }
      return response;
    },
    onSuccess: async (response) => {
      setEvidenciaUrl("");
      if (response?.status === "PENDENTE_APROVACAO") {
        setFeedback({
          type: "warning",
          text: "Avaliação enviada para aprovação administrativa. A fila será atualizada após deferimento.",
        });
        return;
      }
      await refreshOperationalData();
      setFeedback({
        type: "success",
        text: "Avaliação salva e bem marcado na fila de material inservível.",
      });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        text: String(error?.message || "Falha ao salvar a avaliação."),
      });
    },
  });

  const evidenciaMutation = useMutation({
    mutationFn: async () => {
      const avaliacao = historicoQuery.data?.[0];
      if (!avaliacao?.id) throw new Error("Selecione um bem com avaliação já registrada.");
      const driveUrl = String(evidenciaUrl || "").trim();
      if (!driveUrl) throw new Error("Informe a URL da evidência.");
      return criarDocumento({
        tipo: "OUTRO",
        titulo: "Evidência - Material Inservível / Baixa",
        avaliacaoInservivelId: avaliacao.id,
        driveUrl,
        observacoes: `Complemento da avaliação ${avaliacao.tipoInservivel}.`,
      });
    },
    onSuccess: async () => {
      setEvidenciaUrl("");
      await refreshOperationalData();
      setFeedback({ type: "success", text: "Evidência vinculada à última avaliação selecionada." });
    },
    onError: (error) => {
      setFeedback({ type: "error", text: String(error?.message || "Falha ao anexar evidência.") });
    },
  });

  const removeQueueMutation = useMutation({
    mutationFn: (item) => atualizarMarcacaoInservivel(item.id, { statusFluxo: "RETIRADO_FILA" }),
    onSuccess: async () => {
      await refreshOperationalData({ includeBem: false });
      setFeedback({ type: "success", text: "Bem retirado da fila de candidatos." });
    },
    onError: (error) => {
      setFeedback({ type: "error", text: String(error?.message || "Falha ao retirar item da fila.") });
    },
  });

  const createDraftMutation = useMutation({
    mutationFn: criarBaixaPatrimonial,
    onSuccess: async (response) => {
      await refreshOperationalData();
      setSelectedQueueIds([]);
      setDrawer({
        open: true,
        processId: response?.baixa?.id || null,
        mode: response?.baixa?.modalidadeBaixa || drawer.mode,
      });
      setFeedback({ type: "success", text: "Rascunho de baixa patrimonial criado." });
    },
    onError: (error) => {
      setFeedback({ type: "error", text: String(error?.message || "Falha ao criar o rascunho.") });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: ({ id, payload }) => atualizarBaixaPatrimonial(id, payload),
    onSuccess: async (response) => {
      await refreshOperationalData();
      setDrawer({
        open: true,
        processId: response?.baixa?.id || drawer.processId,
        mode: response?.baixa?.modalidadeBaixa || drawer.mode,
      });
      setFeedback({ type: "success", text: "Rascunho atualizado." });
    },
    onError: (error) => {
      setFeedback({ type: "error", text: String(error?.message || "Falha ao atualizar o rascunho.") });
    },
  });

  const concludeMutation = useMutation({
    mutationFn: ({ id, payload }) => concluirBaixaPatrimonial(id, payload),
    onSuccess: async (response) => {
      await refreshOperationalData();
      if (response?.status === "PENDENTE_APROVACAO") {
        setFeedback({ type: "warning", text: "Solicitação de conclusão enviada para aprovação administrativa." });
        return;
      }
      setFeedback({ type: "success", text: "Baixa patrimonial concluída e bens atualizados para BAIXADO." });
    },
    onError: (error) => {
      setFeedback({ type: "error", text: String(error?.message || "Falha ao concluir a baixa.") });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelarBaixaPatrimonial,
    onSuccess: async () => {
      await refreshOperationalData();
      setDrawer({ open: false, processId: null, mode: "" });
      setFeedback({ type: "success", text: "Processo cancelado e itens devolvidos para a fila." });
    },
    onError: (error) => {
      setFeedback({ type: "error", text: String(error?.message || "Falha ao cancelar o processo.") });
    },
  });

  const processes = baixasQuery.data?.items || [];
  const processosConcluidosNoPeriodo = processes.filter((item) => {
    if (item.statusProcesso !== "CONCLUIDO") return false;
    const ref = item.executadoEm || item.createdAt;
    const parsed = ref ? new Date(ref) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return false;
    const diffMs = Date.now() - parsed.getTime();
    return diffMs <= 1000 * 60 * 60 * 24 * 30;
  }).length;
  const aguardandoDestinacao = queueItems.filter((item) => item.statusFluxo === "AGUARDANDO_DESTINACAO").length;
  const processosRascunho = processes.filter((item) => item.statusProcesso === "RASCUNHO").length;

  const selectedBem = bemDetalheQuery.data;
  const ultimaAvaliacao = historicoQuery.data?.[0] || null;
  const busyDrawer =
    createDraftMutation.isPending
    || updateDraftMutation.isPending
    || concludeMutation.isPending
    || cancelMutation.isPending;

  const handleBuscaSubmit = (event) => {
    event.preventDefault();
    setFeedback({ type: "", text: "" });
    const normalized = normalizeBusca(busca);
    if (!normalized.numeroTombamento && !normalized.q && !normalized.unidadeDonaId && !normalized.localFisico) {
      setFeedback({
        type: "warning",
        text: "Informe ao menos um filtro para localizar bens pela triagem.",
      });
      return;
    }
    setBuscaAplicada(normalized);
  };

  const handleToggleSelect = (item, checked) => {
    setSelectedQueueIds((current) => {
      if (checked) return current.includes(item.id) ? current : [...current, item.id];
      return current.filter((id) => id !== item.id);
    });
  };

  const handleToggleSelectAll = (checked) => {
    setSelectedQueueIds(checked ? queueItems.map((item) => item.id) : []);
  };

  const handleQueueActionSelectBem = (item) => {
    setSelectedBemId(item.bemId);
    setFeedback({ type: "", text: "" });
  };

  const handleCreateDraftFromSelection = () => {
    if (!selectedQueueItems.length) {
      setFeedback({ type: "warning", text: "Selecione ao menos um item da fila para abrir o processo." });
      return;
    }
    setDrawer({ open: true, processId: null, mode: "" });
  };

  const handleOpenDesaparecimento = () => {
    if (!selectedBem?.bem?.id) {
      setFeedback({
        type: "warning",
        text: "Selecione um bem na triagem para abrir a baixa por desaparecimento.",
      });
      return;
    }
    setDrawer({ open: true, processId: null, mode: "DESAPARECIMENTO" });
  };

  const handleConcludeDraft = (id, payload) => {
    const confirmed = window.confirm(
      "Confirma a conclusão da baixa patrimonial? O sistema atualizará os bens para BAIXADO e gerará placeholders documentais.",
    );
    if (!confirmed) return;
    concludeMutation.mutate({ id, payload });
  };

  const handleCancelDraft = (id) => {
    const confirmed = window.confirm("Cancelar este rascunho devolverá os itens para a fila. Deseja continuar?");
    if (!confirmed) return;
    cancelMutation.mutate(id);
  };

  const handleExportDraft = async (processId) => {
    if (!processId) return;
    try {
      setExportingProcessId(processId);
      const detail =
        drawer.processId === processId && processDetailQuery.data?.baixa?.id === processId
          ? processDetailQuery.data
          : await obterBaixaPatrimonial(processId);
      const filename = buildBaixaProcessCsvFilename(detail);
      const content = buildBaixaProcessCsv(detail);
      triggerCsvDownload(filename, content);
      setFeedback({
        type: "success",
        text: `CSV do processo ${detail?.baixa?.processoReferencia || processId} exportado para uso no SEI.`,
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text: String(error?.message || "Falha ao exportar o CSV do processo."),
      });
    } finally {
      setExportingProcessId(null);
    }
  };

  return (
    <section className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">
              Material Inservível / Baixa
            </p>
            <h2 className="mt-2 font-[Space_Grotesk] text-3xl font-semibold text-slate-900">
              Triagem auditável e baixa patrimonial no mesmo espaço operacional
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A tela consolida a classificação dos arts. 141 a 152 e a baixa patrimonial dos arts. 153 a 157,
              preservando fila, histórico, documentos e trilha de aprovação.
            </p>
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              permissionSummary.tone === "violet"
                ? "border-violet-200 bg-violet-50"
                : permissionSummary.tone === "amber"
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Perfil operacional</p>
            <p className="mt-2 font-semibold text-slate-900">{permissionSummary.label}</p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-slate-600">{permissionSummary.helper}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Marcados para triagem"
            value={queueQuery.data?.paging?.total || queueItems.length}
            helper="Itens atualmente visíveis na fila de material inservível."
            tone="violet"
          />
          <SummaryCard
            label="Aguardando destinação"
            value={aguardandoDestinacao}
            helper="Já aptos para destinação formal conforme o Art. 142."
            tone="amber"
          />
          <SummaryCard
            label="Processos em rascunho"
            value={processosRascunho}
            helper="Rascunhos prontos para revisão, aprovação ou conclusão."
            tone="slate"
          />
          <SummaryCard
            label="Baixas concluídas no período"
            value={processosConcluidosNoPeriodo}
            helper="Concluídas nos últimos 30 dias, com registro de causa formal."
            tone="emerald"
          />
        </div>

        {feedback.text ? (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : feedback.type === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {feedback.text}
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Triagem / marcação</p>
            <h3 className="mt-2 font-[Space_Grotesk] text-2xl font-semibold text-slate-900">
              Localize o bem, revise o histórico e registre a classificação
            </h3>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Destinações cobertas: venda, cessão, doação, permuta, inutilização, abandono e desaparecimento.
          </div>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-5">
            <form className="rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleBuscaSubmit}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Localização do bem</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-800">Tombamento</span>
                  <input
                    value={busca.numeroTombamento}
                    onChange={(event) => setBusca((current) => ({ ...current, numeroTombamento: event.target.value }))}
                    placeholder="Ex.: 1290001788"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-800">Descrição</span>
                  <input
                    value={busca.q}
                    onChange={(event) => setBusca((current) => ({ ...current, q: event.target.value }))}
                    placeholder="Notebook, armário, impressora..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-800">Unidade</span>
                  <select
                    value={busca.unidadeDonaId}
                    onChange={(event) => setBusca((current) => ({ ...current, unidadeDonaId: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Todas</option>
                    <option value="1">1ª Aud</option>
                    <option value="2">2ª Aud</option>
                    <option value="3">Foro</option>
                    <option value="4">Almox</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-800">Local</span>
                  <input
                    value={busca.localFisico}
                    onChange={(event) => setBusca((current) => ({ ...current, localFisico: event.target.value }))}
                    placeholder="Sala, corredor, depósito..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Buscar bens
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBusca(EMPTY_BUSCA);
                    setBuscaAplicada(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  Limpar filtros
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resultados da busca</p>
                {buscaQuery.isFetching ? <span className="text-xs text-slate-500">Carregando...</span> : null}
              </div>
              <div className="mt-4 grid gap-3">
                {(buscaQuery.data || []).map((item) => (
                  <SearchResultCard
                    key={item.id}
                    item={item}
                    active={selectedBemId === item.id}
                    onSelect={setSelectedBemId}
                  />
                ))}
                {buscaAplicada && !buscaQuery.isFetching && (buscaQuery.data || []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum bem encontrado com os filtros informados.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bem selecionado</p>
              {selectedBem?.bem ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SummaryCard
                    label="Tombo"
                    value={selectedBem.bem.numeroTombamento}
                    helper={selectedBem.catalogo?.descricao || selectedBem.bem.descricao || "Sem descrição complementar."}
                  />
                  <SummaryCard
                    label="Unidade / local"
                    value={formatUnit(Number(selectedBem.bem.unidadeDonaId))}
                    helper={selectedBem.bem.localFisico || "Local não informado"}
                  />
                  <SummaryCard
                    label="Marcação atual"
                    value={selectedBem.marcacaoAtual?.statusFluxo || "Sem fila ativa"}
                    helper={selectedBem.marcacaoAtual?.tipoInservivel || "Sem classificação vigente"}
                    tone="amber"
                  />
                  <SummaryCard
                    label="Baixa patrimonial"
                    value={selectedBem.baixaPatrimonialResumo?.modalidadeBaixa || "Sem baixa"}
                    helper={selectedBem.baixaPatrimonialResumo?.statusProcesso || "Nenhum processo vinculado"}
                    tone="slate"
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  Selecione um bem da busca ou da fila para abrir o histórico e o wizard embutido.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Histórico e evidências</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Últimas avaliações do art. 141, situação atual e vínculo documental.
                  </p>
                </div>
                {ultimaAvaliacao ? (
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                    Última classe: {ultimaAvaliacao.tipoInservivel}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {(historicoQuery.data || []).slice(0, 6).map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <strong className="text-slate-900">{item.tipoInservivel}</strong>
                      <span className="text-xs text-slate-500">{formatDateTime(item.avaliadoEm)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{item.justificativa || "Sem justificativa registrada."}</p>
                  </article>
                ))}
                {selectedBemId && !historicoQuery.isFetching && (historicoQuery.data || []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Nenhuma avaliação de inservível foi registrada ainda para este bem.
                  </div>
                ) : null}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Anexar evidência complementar</p>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    value={evidenciaUrl}
                    onChange={(event) => setEvidenciaUrl(event.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => evidenciaMutation.mutate()}
                    disabled={evidenciaMutation.isPending || !ultimaAvaliacao?.id}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                  >
                    {evidenciaMutation.isPending ? "Anexando..." : "Anexar evidência"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <InservivelAssessmentWizard
            bem={selectedBem}
            busy={avaliacaoMutation.isPending}
            disabled={!canMarkWrite}
            onSubmit={(payload) => avaliacaoMutation.mutate(payload)}
          />
          {!canMarkWrite ? (
            <p className="mt-3 text-sm text-slate-500">
              Este perfil pode consultar a triagem, mas não pode registrar novas avaliações.
            </p>
          ) : null}
        </div>
      </section>

      <InservivelQueueTable
        filters={queueFilters}
        onFilterChange={(field, value) => setQueueFilters((current) => ({ ...current, [field]: value }))}
        items={queueItems}
        selectedIds={selectedQueueIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onReevaluate={handleQueueActionSelectBem}
        onAttachEvidence={handleQueueActionSelectBem}
        onRemove={(item) => removeQueueMutation.mutate(item)}
        canEdit={canMarkExecute}
      />

      <BaixaProcessesList
        items={processes}
        activeId={drawer.processId}
        onOpen={(id) => setDrawer({ open: true, processId: id, mode: "PROCESSO" })}
        onExport={handleExportDraft}
        exportingId={exportingProcessId}
        onCreateFromSelection={handleCreateDraftFromSelection}
        onOpenDesaparecimento={handleOpenDesaparecimento}
        selectionCount={selectedQueueIds.length}
        canWrite={canBaixaWrite}
      />

      <BaixaProcessDrawer
        isOpen={drawer.open}
        mode={drawer.mode === "PROCESSO" ? "" : drawer.mode}
        process={processDetailQuery.data || null}
        selectedItems={drawerSelectedItems}
        onClose={() => setDrawer({ open: false, processId: null, mode: "" })}
        onExport={handleExportDraft}
        exportBusy={exportingProcessId === drawer.processId}
        onCreateDraft={(payload) => createDraftMutation.mutate(payload)}
        onUpdateDraft={(id, payload) => updateDraftMutation.mutate({ id, payload })}
        onConclude={handleConcludeDraft}
        onCancel={handleCancelDraft}
        canWrite={canBaixaWrite}
        canExecute={canBaixaExecute}
        busy={busyDrawer}
      />
    </section>
  );
}
