/**
 * Modulo: frontend/components
 * Arquivo: MovimentacoesPanel.jsx
 * Funcao no sistema: executar movimentacoes patrimoniais (transferencia/cautela) e regularizacao em lote por sala.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import BarcodeScanner from "./BarcodeScanner.jsx";
import {
  atualizarBemOperacional,
  buscarPerfisDetentor,
  listarBens,
  listarLocais,
  movimentarBem,
  getEstatisticasLocais,
  resetLocais,
  listarBensLocalizacao,
} from "../services/apiClient.js";

const MOV_TYPES = ["TRANSFERENCIA", "CAUTELA_SAIDA", "CAUTELA_RETORNO"];
const PROFILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CADASTRO_SALA_UI_STATE_KEY = "cjm_cadastro_sala_ui_v1";
const TOMBAMENTO_4_DIGITS_RE = /^\d{4}$/;

function normalizeTombamentoInput(raw) {
  if (raw == null) return "";
  return String(raw).trim().replace(/^\"+|\"+$/g, "").replace(/\D+/g, "").slice(0, 10);
}

function formatApiError(error) {
  const msg = String(error?.message || "Falha na requisicao.");
  const status = error?.status != null ? String(error.status) : "";
  const code = error?.payload?.error?.code ? String(error.payload.error.code) : "";
  const requestId = error?.payload?.requestId ? String(error.payload.requestId) : "";
  const suffixParts = [
    status ? `status=${status}` : null,
    code ? `code=${code}` : null,
    requestId ? `requestId=${requestId}` : null,
  ].filter(Boolean);
  return suffixParts.length ? `${msg} (${suffixParts.join(", ")})` : msg;
}

function formatPerfilOption(perfil) {
  const matricula = String(perfil?.matricula || "-");
  const nome = String(perfil?.nome || "-");
  const unidade = perfil?.unidadeId != null ? String(perfil.unidadeId) : "-";
  return `${matricula} - ${nome} (unid. ${unidade})`;
}

function buildMovPayload(payload) {
  const clean = {
    tipoMovimentacao: payload.tipoMovimentacao,
    termoReferencia: payload.termoReferencia,
    justificativa: payload.justificativa || undefined,
    numeroTombamento: payload.numeroTombamento || undefined,
    bemId: payload.bemId || undefined,
    unidadeDestinoId: payload.unidadeDestinoId ? Number(payload.unidadeDestinoId) : undefined,
    detentorTemporarioPerfilId: payload.detentorTemporarioPerfilId || undefined,
    cautelaSalaDestino: payload.cautelaSalaDestino || undefined,
    cautelaExterno: payload.cautelaExterno ? true : undefined,
    dataPrevistaDevolucao: payload.dataPrevistaDevolucao || undefined,
    dataEfetivaDevolucao: payload.dataEfetivaDevolucao ? new Date(payload.dataEfetivaDevolucao).toISOString() : undefined,
    manterResponsavelNoRetorno:
      payload.tipoMovimentacao === "CAUTELA_RETORNO"
        ? Boolean(payload.manterResponsavelNoRetorno)
        : undefined,
  };
  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== undefined));
}

function loadCadastroSalaUiState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CADASTRO_SALA_UI_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const loteItens = Array.isArray(parsed.loteItens) ? parsed.loteItens : [];
    return {
      unidadeSalaId: parsed.unidadeSalaId != null ? String(parsed.unidadeSalaId) : "",
      localSalaId: parsed.localSalaId != null ? String(parsed.localSalaId) : "",
      loteItens,
    };
  } catch {
    return null;
  }
}

function saveCadastroSalaUiState(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CADASTRO_SALA_UI_STATE_KEY, JSON.stringify({
      unidadeSalaId: state.unidadeSalaId || "",
      localSalaId: state.localSalaId || "",
      loteItens: Array.isArray(state.loteItens) ? state.loteItens : [],
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    // sem fatal
  }
}

export default function MovimentacoesPanel({ section = "movimentacoes" }) {
  const auth = useAuth();
  const canUse = Boolean(auth.perfil) || !auth.authEnabled;
  const canAdmin = !auth.authEnabled || String(auth.role || "").toUpperCase() === "ADMIN";
  const canExecuteOperacional =
    !auth.authEnabled
    || auth.can("action.bem.editar_operacional.execute")
    || auth.can("action.bem.alterar_localizacao.execute")
    || canAdmin;
  const canRequestOperacional =
    !auth.authEnabled
    || auth.can("action.bem.editar_operacional.request")
    || auth.can("action.bem.alterar_localizacao.request")
    || canAdmin;
  const showMovimentacaoForm = section !== "cadastro-sala";
  const showCadastroSala = section === "cadastro-sala";

  const [movState, setMovState] = useState({ loading: false, response: null, error: null });
  const [movPayload, setMovPayload] = useState({
    tipoMovimentacao: "TRANSFERENCIA",
    numeroTombamento: "",
    bemId: "",
    unidadeDestinoId: "",
    detentorTemporarioPerfilId: "",
    cautelaSalaDestino: "",
    cautelaExterno: false,
    dataPrevistaDevolucao: "",
    dataEfetivaDevolucao: "",
    manterResponsavelNoRetorno: true,
    termoReferencia: "",
    justificativa: "",
  });
  const [detentorQuery, setDetentorQuery] = useState("");
  const [detentorLookupState, setDetentorLookupState] = useState({
    loading: false,
    data: [],
    error: null,
  });
  const [detentorSelected, setDetentorSelected] = useState(null);
  const [detentorInputFocused, setDetentorInputFocused] = useState(false);
  const [semDataPrevista, setSemDataPrevista] = useState(false);

  const [locaisState, setLocaisState] = useState({ loading: false, data: [], error: null });
  const [unidadeSalaId, setUnidadeSalaId] = useState("");
  const [localSalaId, setLocalSalaId] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [tagIdModal, setTagIdModal] = useState({ isOpen: false, value: "" });
  const [scannerMode, setScannerMode] = useState("continuous");
  const [showScanner, setShowScanner] = useState(false);
  const [cameraScanPreview, setCameraScanPreview] = useState(null);
  const [loteItens, setLoteItens] = useState([]);
  const [loteState, setLoteState] = useState({ loading: false, response: null, error: null, info: null });
  const [justificativaSolicitante, setJustificativaSolicitante] = useState("");
  const [statsLocais, setStatsLocais] = useState({ loading: false, data: null, error: null });
  const [resetModal, setResetModal] = useState({ open: false, loading: false, resultado: null });
  const [bensLoc, setBensLoc] = useState({ loading: false, data: null, error: null, tabAtiva: "sem_local", offset: 0 });
  const cameraPreviewTimeoutRef = useRef(null);
  const cadastroSalaStateHydratedRef = useRef(false);
  const scanInputRef = useRef(null);

  const focusScanInput = () => {
    window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 0);
  };

  const failScanInput = (message) => {
    setLoteState({ loading: false, response: null, error: message, info: null });
    setScanInput("");
    focusScanInput();
  };

  const selectedLocal = useMemo(
    () => (locaisState.data || []).find((l) => String(l.id) === String(localSalaId)) || null,
    [locaisState.data, localSalaId],
  );

  const helperText = useMemo(() => {
    if (movPayload.tipoMovimentacao === "TRANSFERENCIA") {
      return "Transferencia muda carga (Arts. 124 e 127). Requer unidade destino e termo.";
    }
    if (movPayload.tipoMovimentacao === "CAUTELA_SAIDA") {
      return "Cautela nao muda carga. Requer detentor temporario e local (Sala destino ou Externo); data prevista de devolucao e opcional. Ao registrar cautela, o responsavel patrimonial passa a ser o detentor.";
    }
    return "Retorno de cautela encerra a cautela (requer termo; data efetiva e opcional). Ao confirmar, o sistema pergunta se deve manter o mesmo responsavel patrimonial.";
  }, [movPayload.tipoMovimentacao]);

  useEffect(() => {
    let cancelled = false;
    const loadLocais = async () => {
      setLocaisState({ loading: true, data: [], error: null });
      try {
        const data = await listarLocais({
          unidadeId: unidadeSalaId ? Number(unidadeSalaId) : undefined,
        });
        if (cancelled) return;
        setLocaisState({ loading: false, data: data?.items || [], error: null });
      } catch (error) {
        if (cancelled) return;
        setLocaisState({ loading: false, data: [], error: formatApiError(error) });
      }
    };
    if (!canUse || !showCadastroSala) return undefined;
    loadLocais();
    return () => {
      cancelled = true;
    };
  }, [canUse, showCadastroSala, unidadeSalaId]);

  useEffect(() => {
    if (!showCadastroSala || cadastroSalaStateHydratedRef.current) return;
    const saved = loadCadastroSalaUiState();
    if (saved) {
      setUnidadeSalaId(saved.unidadeSalaId || "");
      setLocalSalaId(saved.localSalaId || "");
      setLoteItens(saved.loteItens || []);
    }
    cadastroSalaStateHydratedRef.current = true;
  }, [showCadastroSala]);

  useEffect(() => {
    if (!showCadastroSala || !cadastroSalaStateHydratedRef.current) return;
    saveCadastroSalaUiState({
      unidadeSalaId,
      localSalaId,
      loteItens,
    });
  }, [showCadastroSala, unidadeSalaId, localSalaId, loteItens]);

  useEffect(() => {
    let cancelled = false;
    const loadStats = async () => {
      setStatsLocais({ loading: true, data: null, error: null });
      try {
        const payload = await getEstatisticasLocais({
          unidadeId: unidadeSalaId ? Number(unidadeSalaId) : undefined,
        });
        if (cancelled) return;
        setStatsLocais({ loading: false, data: payload ?? null, error: null });
      } catch (error) {
        if (cancelled) return;
        setStatsLocais({ loading: false, data: null, error: formatApiError(error) });
      }
    };
    if (!canUse || !showCadastroSala) return undefined;
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [canUse, showCadastroSala, unidadeSalaId, loteState.response]);

  useEffect(() => {
    if (movPayload.tipoMovimentacao === "CAUTELA_SAIDA") return;
    setDetentorQuery("");
    setDetentorSelected(null);
    setDetentorLookupState({ loading: false, data: [], error: null });
    setSemDataPrevista(false);
    setMovField("cautelaSalaDestino", "");
    setMovField("cautelaExterno", false);
  }, [movPayload.tipoMovimentacao]);

  useEffect(() => {
    if (movPayload.tipoMovimentacao !== "CAUTELA_SAIDA") return undefined;
    const query = String(detentorQuery || "").trim();
    if (!query || query.length < 2) {
      setDetentorLookupState((prev) => ({ ...prev, loading: false, data: [], error: null }));
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setDetentorLookupState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await buscarPerfisDetentor({ q: query, limit: 8 });
        if (cancelled) return;
        setDetentorLookupState({ loading: false, data: data?.items || [], error: null });
      } catch (error) {
        if (cancelled) return;
        setDetentorLookupState({ loading: false, data: [], error: formatApiError(error) });
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [movPayload.tipoMovimentacao, detentorQuery]);

  const setMovField = (key, value) => setMovPayload((prev) => ({ ...prev, [key]: value }));

  const onDetentorInputChange = (value) => {
    const raw = String(value || "");
    const trimmed = raw.trim();
    setDetentorQuery(raw);
    setDetentorSelected(null);
    if (PROFILE_ID_RE.test(trimmed)) {
      setMovField("detentorTemporarioPerfilId", trimmed);
      return;
    }
    setMovField("detentorTemporarioPerfilId", "");
  };

  const onSelectDetentor = (perfil) => {
    if (!perfil?.id) return;
    setDetentorSelected(perfil);
    setDetentorQuery(formatPerfilOption(perfil));
    setMovField("detentorTemporarioPerfilId", String(perfil.id));
    setDetentorLookupState({ loading: false, data: [], error: null });
  };

  const onMovSubmit = async (event) => {
    event.preventDefault();
    if (!canUse) {
      setMovState({ loading: false, response: null, error: "Voce precisa estar autenticado para movimentar bens." });
      return;
    }
    if (movPayload.tipoMovimentacao === "CAUTELA_SAIDA" && !movPayload.detentorTemporarioPerfilId) {
      setMovState({
        loading: false,
        response: null,
        error: "Selecione um detentor pela busca (matricula/nome) ou informe um perfilId UUID valido.",
      });
      return;
    }
    if (movPayload.tipoMovimentacao === "CAUTELA_SAIDA") {
      const salaInformada = String(movPayload.cautelaSalaDestino || "").trim();
      const externo = Boolean(movPayload.cautelaExterno);
      if (!salaInformada && !externo) {
        setMovState({
          loading: false,
          response: null,
          error: "Para CAUTELA_SAIDA, informe a Sala destino ou marque a opcao Externo.",
        });
        return;
      }
    }

    setMovState({ loading: true, response: null, error: null });
    try {
      const payloadBase = { ...movPayload };
      if (movPayload.tipoMovimentacao === "CAUTELA_RETORNO") {
        const manter = window.confirm(
          "Deseja manter o mesmo usuario da cautela como responsavel patrimonial do bem apos o retorno?"
        );
        payloadBase.manterResponsavelNoRetorno = manter;
      }
      const payload = buildMovPayload(payloadBase);
      const data = await movimentarBem(payload);
      setMovState({ loading: false, response: data, error: null });
    } catch (error) {
      setMovState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const upsertLoteItem = (item) => {
    setLoteItens((prev) => {
      const idx = prev.findIndex((x) => String(x.bemId) === String(item.bemId));
      if (idx < 0) return [item, ...prev];
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...item, repeticoes: Number(updated[idx].repeticoes || 1) + 1 };
      return updated;
    });
  };

  const removeLoteItem = (bemId) => {
    setLoteItens((prev) => prev.filter((row) => String(row.bemId) !== String(bemId)));
  };

  const clearLoteComConfirmacao = () => {
    if (!loteItens.length) return;
    const ok = window.confirm(
      "Deseja realmente limpar a fila temporaria de bens lidos?\nEsta acao remove todos os itens nao salvos.",
    );
    if (!ok) return;
    setLoteItens([]);
    setLoteState((prev) => ({ ...prev, info: "Fila temporaria limpa.", error: null }));
    setCameraScanPreview(null);
  };

  const showCameraScanPreview = (numeroTombamento, nomeResumo, mode = "single") => {
    setCameraScanPreview({
      code: String(numeroTombamento || ""),
      summary: String(nomeResumo || "Sem nome resumo cadastrado."),
    });
    if (cameraPreviewTimeoutRef.current) {
      window.clearTimeout(cameraPreviewTimeoutRef.current);
      cameraPreviewTimeoutRef.current = null;
    }
    if (mode === "continuous") {
      return;
    }
    cameraPreviewTimeoutRef.current = window.setTimeout(() => {
      setCameraScanPreview(null);
      cameraPreviewTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => () => {
    if (cameraPreviewTimeoutRef.current) {
      window.clearTimeout(cameraPreviewTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!showCadastroSala || showScanner) return;
    focusScanInput();
  }, [showCadastroSala, showScanner]);

  useEffect(() => {
    if (!showCadastroSala) return undefined;
    const onWindowKeyDown = (event) => {
      const key = String(event.key || "").toLowerCase();
      const isCtrlJ = event.ctrlKey && !event.altKey && !event.metaKey && key === "j";
      if (!isCtrlJ) return;
      event.preventDefault();
      event.stopPropagation();
      if (document.activeElement !== scanInputRef.current) {
        focusScanInput();
      }
      const value = scanInputRef.current?.value ?? scanInput;
      if (String(value || "").trim()) {
        void buscarEAdicionarTombo(value);
      }
    };
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown, true);
    };
  }, [showCadastroSala, scanInput]);

  const buscarEAdicionarTombo = async (rawTombo, options = {}) => {
    const inputNormalizado = normalizeTombamentoInput(rawTombo);
    let tombo = inputNormalizado;
    let itemResolvido = options?.itemResolvido || null;

    if (TOMBAMENTO_4_DIGITS_RE.test(inputNormalizado)) {
      const tipoBusca = options?.tipoBusca || null;
      if (!tipoBusca) {
        setTagIdModal({ isOpen: true, value: inputNormalizado });
        setScanInput(inputNormalizado);
        focusScanInput();
        return;
      }
      try {
        const lookup = await listarBens({
          numeroTombamento: inputNormalizado,
          tipoBusca,
          limit: 10,
          offset: 0,
        });
        const lookupItems = lookup?.items || [];
        if (!lookupItems.length) {
          failScanInput(
            `Nenhum bem encontrado para a etiqueta ${tipoBusca === "antigo" ? "antiga" : "nova"} "${inputNormalizado}".`,
          );
          return;
        }
        if (lookupItems.length > 1) {
          const candidatos = lookupItems
            .slice(0, 5)
            .map((x) => x.numeroTombamento)
            .filter(Boolean)
            .join(", ");
          failScanInput(
            `Codigo "${inputNormalizado}" encontrou ${lookupItems.length} patrimonios (${candidatos}${lookupItems.length > 5 ? ", ..." : ""}). Informe os 10 digitos.`,
          );
          return;
        }
        itemResolvido = lookupItems[0] || null;
        tombo = String(itemResolvido?.numeroTombamento || "");
      } catch (error) {
        failScanInput(formatApiError(error));
        return;
      }
    }

    if (!/^\d{10}$/.test(tombo)) {
      failScanInput("Informe tombamento GEAFIN com 10 digitos ou etiqueta de 4 digitos.");
      return;
    }
    if (!selectedLocal) {
      failScanInput("Selecione primeiro a sala/local de destino.");
      return;
    }
    setLoteState((prev) => ({ ...prev, loading: true, error: null, info: null }));
    try {
      let item = itemResolvido;
      if (!item) {
        const data = await listarBens({ numeroTombamento: tombo, limit: 20, offset: 0 });
        item = (data?.items || []).find((x) => String(x.numeroTombamento || "") === tombo);
      }
      if (!item) {
        setLoteState({ loading: false, response: null, error: `Tombo ${tombo} nao encontrado.`, info: null });
        return;
      }

      const unidadeBem = Number(item.unidadeDonaId || 0) || null;
      const unidadeSala = Number(selectedLocal.unidadeId || 0) || null;
      const divergenciaUnidade = Boolean(unidadeBem && unidadeSala && unidadeBem !== unidadeSala);

      let manterOutraUnidade = !divergenciaUnidade;
      if (divergenciaUnidade) {
        manterOutraUnidade = window.confirm(
          `Divergencia de unidade detectada para o tombo ${tombo}.\n` +
          `Unidade de carga do bem: ${unidadeBem}\n` +
          `Unidade da sala escolhida: ${unidadeSala}\n\n` +
          "Deseja manter este item de outra unidade na sala escolhida?",
        );
      }

      upsertLoteItem({
        bemId: item.id,
        numeroTombamento: item.numeroTombamento,
        descricao: item.descricao || item.descricaoComplementar || "-",
        unidadeDonaId: unidadeBem,
        localAtual: item.localFisico || "-",
        localAtualId: item.localId || null,
        divergenciaUnidade,
        manterOutraUnidade,
        repeticoes: 1,
        salvo: false,
        erro: null,
      });
      setLoteState({
        loading: false,
        response: null,
        error: null,
        info: divergenciaUnidade && !manterOutraUnidade
          ? `Tombo ${tombo} adicionado como divergente (nao sera salvo ate marcar manter).`
          : `Tombo ${tombo} adicionado na fila.`,
      });
      if (options?.fromCamera) {
        showCameraScanPreview(item.numeroTombamento, item.nomeResumo || item.descricao || item.descricaoComplementar, scannerMode);
      }
      setScanInput("");
      setTagIdModal({ isOpen: false, value: "" });
      focusScanInput();
    } catch (error) {
      setLoteState({ loading: false, response: null, error: formatApiError(error), info: null });
      focusScanInput();
    }
  };

  const onAdicionarTombo = async (event) => {
    event.preventDefault();
    await buscarEAdicionarTombo(scanInput);
    focusScanInput();
  };

  const handleScanInputKeyDown = (event) => {
    const key = String(event.key || "");
    const lower = key.toLowerCase();
    const isCtrlJ = event.ctrlKey && !event.altKey && !event.metaKey && lower === "j";
    const isSubmitKey = key === "Enter" || key === "Tab" || isCtrlJ;
    if (!isSubmitKey) return;
    event.preventDefault();
    event.stopPropagation();
    void onAdicionarTombo(event);
  };

  const onSalvarLote = async () => {
    if (!canExecuteOperacional && !canRequestOperacional) {
      setLoteState({ loading: false, response: null, error: "Voce nao tem permissao para alterar localizacao por sala.", info: null });
      return;
    }
    if (!selectedLocal) {
      setLoteState({ loading: false, response: null, error: "Selecione a sala/local de destino.", info: null });
      return;
    }
    if (!loteItens.length) {
      setLoteState({ loading: false, response: null, error: "Nenhum item na fila para salvar.", info: null });
      return;
    }

    const elegiveis = loteItens.filter((x) => !x.divergenciaUnidade || x.manterOutraUnidade);
    if (!elegiveis.length) {
      setLoteState({ loading: false, response: null, error: "Nao ha itens elegiveis para salvar (divergencias nao confirmadas).", info: null });
      return;
    }
    if (!canExecuteOperacional && canRequestOperacional && !String(justificativaSolicitante || "").trim()) {
      setLoteState({
        loading: false,
        response: null,
        error: "Informe a justificativa para enviar a alteracao de localizacao para aprovacao administrativa.",
        info: null,
      });
      return;
    }

    const divergentes = elegiveis.filter((x) => x.divergenciaUnidade);
    if (divergentes.length) {
      const ok = window.confirm(
        `Voce esta prestes a manter ${divergentes.length} item(ns) de outra unidade na sala selecionada.\n` +
        "Deseja continuar?",
      );
      if (!ok) return;
    }

    setLoteState({ loading: true, response: null, error: null, info: null });

    let okCount = 0;
    let pendenteCount = 0;
    let failCount = 0;
    const updated = [...loteItens];

    for (let i = 0; i < updated.length; i += 1) {
      const row = updated[i];
      if (row.divergenciaUnidade && !row.manterOutraUnidade) continue;
      try {
        const payload = {
          localId: selectedLocal.id,
          localFisico: selectedLocal.nome,
        };
        if (!canExecuteOperacional && canRequestOperacional) {
          payload.justificativaSolicitante = justificativaSolicitante;
        }
        const resp = await atualizarBemOperacional(row.bemId, payload);
        if (String(resp?.status || "").toUpperCase() === "PENDENTE_APROVACAO") {
          updated[i] = { ...row, salvo: false, pendenteAprovacao: true, erro: null };
          pendenteCount += 1;
        } else {
          updated[i] = { ...row, salvo: true, pendenteAprovacao: false, erro: null };
          okCount += 1;
        }
      } catch (error) {
        updated[i] = { ...row, salvo: false, pendenteAprovacao: false, erro: formatApiError(error) };
        failCount += 1;
      }
    }

    setLoteItens(updated);
    setLoteState({
      loading: false,
      response: { ok: okCount, pendentes: pendenteCount, falhas: failCount },
      error: null,
      info: `Regularizacao concluida: ${okCount} salvo(s), ${pendenteCount} pendente(s) de aprovacao, ${failCount} falha(s).`,
    });
  };

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">
          {showCadastroSala ? "Cadastrar bens por sala" : "Movimentacoes"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {showCadastroSala
            ? "Regularizacao em lote por sala, com leitura por scanner/camera e confirmacao de divergencias."
            : helperText}
        </p>
      </header>

      {showMovimentacaoForm ? (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold">Movimentar bem</h3>
          <p className="mt-1 text-xs text-slate-600">
            Dica: informe <code className="px-1">numeroTombamento</code> (10 digitos) ou <code className="px-1">bemId</code>.
            Durante inventario ativo, transferencias continuam bloqueadas (Art. 183).
          </p>

          <form onSubmit={onMovSubmit} className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Tipo</span>
              <select
                value={movPayload.tipoMovimentacao}
                onChange={(event) => setMovField("tipoMovimentacao", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={movState.loading}
              >
                {MOV_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-600">Numero do tombamento</span>
              <input
                value={movPayload.numeroTombamento}
                onChange={(event) => setMovField("numeroTombamento", normalizeTombamentoInput(event.target.value))}
                placeholder="Ex.: 1290001788"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-600">bemId (opcional)</span>
              <input
                value={movPayload.bemId}
                onChange={(event) => setMovField("bemId", event.target.value)}
                placeholder="UUID do bem (se preferir)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-slate-600">Termo referencia</span>
              <input
                value={movPayload.termoReferencia}
                onChange={(event) => setMovField("termoReferencia", event.target.value)}
                placeholder="Ex.: TRF-2026-0001"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>

            {movPayload.tipoMovimentacao === "TRANSFERENCIA" ? (
              <label className="space-y-1">
                <span className="text-xs text-slate-600">Unidade destino (1-4)</span>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={movPayload.unidadeDestinoId}
                  onChange={(event) => setMovField("unidadeDestinoId", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={movState.loading}
                />
              </label>
            ) : null}

            {movPayload.tipoMovimentacao === "CAUTELA_SAIDA" ? (
              <div className="space-y-1 md:col-span-2">
                <span className="text-xs text-slate-600">
                  Detentor temporario (buscar por matricula, nome ou perfilId UUID)
                </span>
                <div className="relative">
                  <input
                    value={detentorQuery}
                    onChange={(event) => onDetentorInputChange(event.target.value)}
                    onFocus={() => setDetentorInputFocused(true)}
                    onBlur={() => {
                      setTimeout(() => setDetentorInputFocused(false), 120);
                    }}
                    placeholder="Ex.: Joh, 9156 ou perfilId UUID"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    disabled={movState.loading}
                  />
                  {detentorInputFocused && movPayload.tipoMovimentacao === "CAUTELA_SAIDA" ? (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {detentorLookupState.loading ? (
                        <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p>
                      ) : null}
                      {!detentorLookupState.loading && detentorLookupState.error ? (
                        <p className="px-3 py-2 text-xs text-rose-700">{detentorLookupState.error}</p>
                      ) : null}
                      {!detentorLookupState.loading &&
                        !detentorLookupState.error &&
                        detentorLookupState.data.length === 0 &&
                        String(detentorQuery || "").trim().length >= 2 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">Nenhum perfil encontrado.</p>
                      ) : null}
                      {!detentorLookupState.loading &&
                        !detentorLookupState.error &&
                        detentorLookupState.data.map((perfil) => (
                          <button
                            key={perfil.id}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              onSelectDetentor(perfil);
                            }}
                            className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-violet-50"
                          >
                            <p className="font-semibold text-slate-900">{perfil.nome}</p>
                            <p className="mt-0.5 text-slate-600">
                              Matricula: <span className="font-mono">{perfil.matricula}</span> | PerfilId:{" "}
                              <span className="font-mono">{perfil.id}</span>
                            </p>
                          </button>
                        ))}
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-slate-600">
                  Digite ao menos 2 caracteres para sugerir. O sistema aceita busca por nome, matricula ou UUID.
                </p>
                {movPayload.detentorTemporarioPerfilId ? (
                  <p className="text-xs text-emerald-700">
                    Perfil selecionado: <span className="font-mono">{movPayload.detentorTemporarioPerfilId}</span>
                    {detentorSelected?.nome ? ` (${detentorSelected.nome})` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}

            {movPayload.tipoMovimentacao === "CAUTELA_SAIDA" ? (
              <div className="space-y-1">
                <span className="text-xs text-slate-600">Sala destino da cautela</span>
                <input
                  value={movPayload.cautelaSalaDestino}
                  onChange={(event) => setMovField("cautelaSalaDestino", event.target.value)}
                  placeholder="Ex.: Gabinete 2A, Sala 305, Arquivo"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={movState.loading || movPayload.cautelaExterno}
                />
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(movPayload.cautelaExterno)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setMovField("cautelaExterno", checked);
                      if (checked) setMovField("cautelaSalaDestino", "");
                    }}
                    className="h-4 w-4 accent-violet-600"
                    disabled={movState.loading}
                  />
                  Externo (bem saiu do predio com o detentor)
                </label>
                <p className="text-xs text-slate-600">
                  Obrigatorio informar Sala destino ou marcar Externo.
                </p>
              </div>
            ) : null}

            {movPayload.tipoMovimentacao === "CAUTELA_SAIDA" ? (
              <div className="space-y-1">
                <span className="text-xs text-slate-600">Data prevista devolucao</span>
                <input
                  type="date"
                  value={movPayload.dataPrevistaDevolucao}
                  onChange={(event) => setMovField("dataPrevistaDevolucao", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={movState.loading || semDataPrevista}
                />
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={semDataPrevista}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSemDataPrevista(checked);
                      if (checked) setMovField("dataPrevistaDevolucao", "");
                    }}
                    className="h-4 w-4 accent-violet-600"
                    disabled={movState.loading}
                  />
                  Sem data prevista (ou deixe em branco)
                </label>
                <p className="text-xs text-slate-600">
                  Se nao houver previsao de retorno no momento, marque a opcao acima ou mantenha o campo vazio.
                </p>
              </div>
            ) : null}

            {movPayload.tipoMovimentacao === "CAUTELA_RETORNO" ? (
              <label className="space-y-1">
                <span className="text-xs text-slate-600">Data efetiva devolucao (opcional)</span>
                <input
                  type="datetime-local"
                  value={movPayload.dataEfetivaDevolucao}
                  onChange={(event) => setMovField("dataEfetivaDevolucao", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={movState.loading}
                />
              </label>
            ) : null}

            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-600">Justificativa (opcional)</span>
              <textarea
                value={movPayload.justificativa}
                onChange={(event) => setMovField("justificativa", event.target.value)}
                className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={movState.loading}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {movState.loading ? "Enviando..." : "Executar /movimentar"}
              </button>
              {movState.error ? <p className="mt-2 text-sm text-rose-700">{movState.error}</p> : null}
              {movState.response ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  {JSON.stringify(movState.response, null, 2)}
                </pre>
              ) : null}
            </div>
          </form>
        </article>
      ) : null}

      {showCadastroSala ? (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-semibold">Cadastrar bens por sala (regularizacao em lote)</h3>
          <p className="mt-1 text-xs text-slate-600">
            Selecione unidade e sala de destino, bipa os itens encontrados (teclado/scanner/camera) e salve em lote.
            Em divergencia de unidade, o sistema pergunta se deseja manter o item na sala escolhida.
          </p>

          {!canAdmin ? (
            <p className="mt-3 text-sm text-amber-800">Funcionalidade restrita ao perfil ADMIN.</p>
          ) : (
            <>
              {statsLocais.loading ? (
                <div className="mt-4 animate-pulse rounded-lg bg-slate-50 p-3">
                  <div className="h-4 w-1/3 rounded bg-slate-200"></div>
                </div>
              ) : statsLocais.error ? (
                <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                  Falha ao carregar progresso: {statsLocais.error}
                </div>
              ) : statsLocais.data ? (
                <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-800">
                        Progresso de Cadastro {unidadeSalaId ? `(Unidade ${unidadeSalaId})` : "(Geral)"}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Bens com local atualizado vs. pendentes de sala
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-800">
                        {statsLocais.data.comLocal} <span className="text-sm font-normal text-slate-500">/ {statsLocais.data.total}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="flex h-full items-center justify-center bg-emerald-500 text-[10px] text-white transition-all duration-500"
                      style={{
                        width: statsLocais.data.total > 0
                          ? `${Math.round((statsLocais.data.comLocal / statsLocais.data.total) * 100)}%`
                          : "0%",
                      }}
                    />
                  </div>

                  <div className="mt-2 flex justify-between text-xs text-slate-600">
                    <div>
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1"></span>
                      {statsLocais.data.comLocal} atualizados
                    </div>
                    <div>
                      <span className="inline-block h-2 w-2 rounded-full bg-slate-300 mr-1"></span>
                      {statsLocais.data.semLocal} pendentes
                    </div>
                  </div>
                </div>
              ) : null}

              {/* ── Ações de localização (ADMIN) ── */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setResetModal({ open: true, loading: false, resultado: null, escopo: unidadeSalaId || "todas", senha: "", confirmText: "" })}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
                  disabled={loteState.loading}
                >
                  🔄 Resetar localização
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setBensLoc((s) => ({ ...s, loading: true, error: null, offset: 0 }));
                    try {
                      const res = await listarBensLocalizacao({
                        statusLocal: bensLoc.tabAtiva,
                        unidadeId: unidadeSalaId ? Number(unidadeSalaId) : undefined,
                        limit: 50,
                        offset: 0,
                      });
                      setBensLoc((s) => ({ ...s, loading: false, data: res, offset: 0 }));
                    } catch (e) {
                      setBensLoc((s) => ({ ...s, loading: false, error: formatApiError(e) }));
                    }
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  📋 Ver bens por situação
                </button>
              </div>

              {/* ── Modal de reset com dupla confirmação + senha ── */}
              {resetModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
                    <h3 className="text-base font-bold text-rose-700">⚠️ Resetar localização física</h3>

                    {resetModal.resultado != null ? (
                      <div className="mt-3 space-y-3">
                        <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
                          ✅ {resetModal.resultado} bem(ns) desvinculado(s) com sucesso.
                        </p>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setResetModal({ open: false, loading: false, resultado: null, escopo: "todas", senha: "", confirmText: "" })}
                            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                          >Fechar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {/* Escopo */}
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Escopo do reset</label>
                          <select
                            value={resetModal.escopo}
                            onChange={(e) => setResetModal((s) => ({ ...s, escopo: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                          >
                            <option value="todas">🌐 Todas as unidades</option>
                            <option value="1">Unidade 1</option>
                            <option value="2">Unidade 2</option>
                            <option value="3">Unidade 3</option>
                            <option value="4">Unidade 4</option>
                          </select>
                          <p className="mt-1 text-xs text-slate-500">
                            {resetModal.escopo === "todas"
                              ? "⚠️ Isso vai remover a sala de TODOS os bens de todas as unidades."
                              : `⚠️ Isso vai remover a sala de todos os bens da Unidade ${resetModal.escopo}.`}
                          </p>
                        </div>

                        {/* Senha admin */}
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Senha de administrador</label>
                          <input
                            type="password"
                            placeholder="Senha admin"
                            value={resetModal.senha}
                            onChange={(e) => setResetModal((s) => ({ ...s, senha: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                          />
                        </div>

                        {/* Confirmação de texto */}
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Digite <strong>RESETAR</strong> para confirmar
                          </label>
                          <input
                            type="text"
                            placeholder="RESETAR"
                            value={resetModal.confirmText}
                            onChange={(e) => setResetModal((s) => ({ ...s, confirmText: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
                          />
                        </div>

                        {resetModal.erroReset && (
                          <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{resetModal.erroReset}</p>
                        )}

                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setResetModal({ open: false, loading: false, resultado: null, escopo: "todas", senha: "", confirmText: "" })}
                            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                          >Cancelar</button>
                          <button
                            type="button"
                            disabled={resetModal.loading || resetModal.confirmText !== "RESETAR" || !resetModal.senha}
                            onClick={async () => {
                              setResetModal((s) => ({ ...s, loading: true, erroReset: null }));
                              try {
                                const res = await resetLocais({
                                  unidadeId: resetModal.escopo !== "todas" ? Number(resetModal.escopo) : undefined,
                                  adminPassword: resetModal.senha,
                                });
                                setResetModal((s) => ({ ...s, loading: false, resultado: res?.afetados ?? 0 }));
                                setStatsLocais({ loading: false, data: null, error: null });
                              } catch (e) {
                                setResetModal((s) => ({ ...s, loading: false, erroReset: formatApiError(e) }));
                              }
                            }}
                            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-40"
                          >
                            {resetModal.loading ? "Resetando…" : "Confirmar reset"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Listagem de bens por situação ── */}
              {(bensLoc.data || bensLoc.loading || bensLoc.error) && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="flex border-b border-slate-200">
                    {["sem_local", "com_local"].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={async () => {
                          const novaTab = tab;
                          setBensLoc((s) => ({ ...s, tabAtiva: novaTab, loading: true, data: null, error: null, offset: 0 }));
                          try {
                            const res = await listarBensLocalizacao({
                              statusLocal: novaTab,
                              unidadeId: unidadeSalaId ? Number(unidadeSalaId) : undefined,
                              limit: 50,
                              offset: 0,
                            });
                            setBensLoc((s) => ({ ...s, loading: false, data: res, offset: 0 }));
                          } catch (e) {
                            setBensLoc((s) => ({ ...s, loading: false, error: formatApiError(e) }));
                          }
                        }}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${bensLoc.tabAtiva === tab
                          ? tab === "sem_local"
                            ? "border-b-2 border-amber-500 text-amber-700"
                            : "border-b-2 border-emerald-500 text-emerald-700"
                          : "text-slate-500 hover:bg-slate-50"
                          }`}
                      >
                        {tab === "sem_local" ? "⏳ Pendentes (sem sala)" : "✅ Concluídos (com sala)"}
                        {bensLoc.data && bensLoc.tabAtiva === tab ? ` · ${bensLoc.data.total}` : ""}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBensLoc({ loading: false, data: null, error: null, tabAtiva: "sem_local", offset: 0 })}
                      className="px-3 text-slate-400 hover:text-slate-700"
                      title="Fechar"
                    >✕</button>
                  </div>

                  {bensLoc.loading && (
                    <div className="p-4 text-center text-xs text-slate-500 animate-pulse">Carregando…</div>
                  )}
                  {bensLoc.error && (
                    <div className="p-3 text-xs text-rose-700">{bensLoc.error}</div>
                  )}
                  {bensLoc.data && !bensLoc.loading && (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Tombamento</th>
                              <th className="px-3 py-2 text-left font-medium">Nome</th>
                              <th className="px-3 py-2 text-center font-medium">Unid.</th>
                              <th className="px-3 py-2 text-left font-medium">Sala</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bensLoc.data.items.length === 0 && (
                              <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">Nenhum item</td></tr>
                            )}
                            {bensLoc.data.items.map((item) => (
                              <tr key={item.numeroTombamento} className="hover:bg-slate-50">
                                <td className="px-3 py-1.5 font-mono">{item.numeroTombamento}</td>
                                <td className="px-3 py-1.5 max-w-[180px] truncate">{item.nomeResumo || "—"}</td>
                                <td className="px-3 py-1.5 text-center">{item.unidade}</td>
                                <td className="px-3 py-1.5">{item.localNome || <span className="text-slate-400">—</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Paginação */}
                      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
                        <span className="text-xs text-slate-500">
                          {bensLoc.data.offset + 1}–{Math.min(bensLoc.data.offset + bensLoc.data.limit, bensLoc.data.total)} de {bensLoc.data.total}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={bensLoc.data.offset === 0}
                            onClick={async () => {
                              const novoOffset = Math.max(0, bensLoc.data.offset - 50);
                              setBensLoc((s) => ({ ...s, loading: true }));
                              try {
                                const res = await listarBensLocalizacao({
                                  statusLocal: bensLoc.tabAtiva,
                                  unidadeId: unidadeSalaId ? Number(unidadeSalaId) : undefined,
                                  limit: 50,
                                  offset: novoOffset,
                                });
                                setBensLoc((s) => ({ ...s, loading: false, data: res, offset: novoOffset }));
                              } catch (e) {
                                setBensLoc((s) => ({ ...s, loading: false, error: formatApiError(e) }));
                              }
                            }}
                            className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >← Anterior</button>
                          <button
                            type="button"
                            disabled={bensLoc.data.offset + bensLoc.data.limit >= bensLoc.data.total}
                            onClick={async () => {
                              const novoOffset = bensLoc.data.offset + 50;
                              setBensLoc((s) => ({ ...s, loading: true }));
                              try {
                                const res = await listarBensLocalizacao({
                                  statusLocal: bensLoc.tabAtiva,
                                  unidadeId: unidadeSalaId ? Number(unidadeSalaId) : undefined,
                                  limit: 50,
                                  offset: novoOffset,
                                });
                                setBensLoc((s) => ({ ...s, loading: false, data: res, offset: novoOffset }));
                              } catch (e) {
                                setBensLoc((s) => ({ ...s, loading: false, error: formatApiError(e) }));
                              }
                            }}
                            className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >Próxima →</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <label className="space-y-1">
                  <span className="text-xs text-slate-600">Unidade da sala</span>
                  <select
                    value={unidadeSalaId}
                    onChange={(e) => {
                      setUnidadeSalaId(e.target.value);
                      setLocalSalaId("");
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    disabled={loteState.loading}
                  >
                    <option value="">Todas</option>
                    <option value="1">1 (1a Aud)</option>
                    <option value="2">2 (2a Aud)</option>
                    <option value="3">3 (Foro)</option>
                    <option value="4">4 (Almox)</option>
                  </select>
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs text-slate-600">Sala/Local de destino</span>
                  <select
                    value={localSalaId}
                    onChange={(e) => setLocalSalaId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    disabled={loteState.loading || locaisState.loading}
                  >
                    <option value="">Selecione...</option>
                    {(locaisState.data || []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome} (unidade {l.unidadeId || "-"})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-600">Modo camera</span>
                  <select
                    value={scannerMode}
                    onChange={(e) => setScannerMode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    disabled={loteState.loading}
                  >
                    <option value="single">Leitura simples</option>
                    <option value="continuous">Leitura continua</option>
                  </select>
                </label>
              </div>

              <form onSubmit={onAdicionarTombo} className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={scanInputRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(normalizeTombamentoInput(e.target.value))}
                  onKeyDown={handleScanInputKeyDown}
                  className="min-w-[260px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Bipe tombamento (10) ou etiqueta (4)"
                  autoComplete="off"
                  disabled={loteState.loading}
                />
                <button
                  type="submit"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                  disabled={loteState.loading}
                >
                  Adicionar
                </button>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                  disabled={loteState.loading}
                >
                  Abrir camera
                </button>
                <button
                  type="button"
                  onClick={onSalvarLote}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  disabled={loteState.loading || !loteItens.length || !selectedLocal}
                >
                  {loteState.loading ? "Salvando..." : "Salvar lote na sala"}
                </button>
                <button
                  type="button"
                  onClick={clearLoteComConfirmacao}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                  disabled={loteState.loading || !loteItens.length}
                >
                  Limpar fila
                </button>
              </form>

              {!canExecuteOperacional && canRequestOperacional ? (
                <label className="mt-3 block space-y-1">
                  <span className="text-xs text-slate-600">Justificativa do solicitante (obrigatoria para aprovacao)</span>
                  <textarea
                    value={justificativaSolicitante}
                    onChange={(e) => setJustificativaSolicitante(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Descreva por que a alteracao de sala/local e necessaria."
                    disabled={loteState.loading}
                  />
                </label>
              ) : null}

              {locaisState.error ? <p className="mt-2 text-sm text-rose-700">{locaisState.error}</p> : null}
              {loteState.error ? <p className="mt-2 text-sm text-rose-700">{loteState.error}</p> : null}
              {loteState.info ? <p className="mt-2 text-sm text-slate-700">{loteState.info}</p> : null}

              <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Tombo</th>
                      <th className="px-3 py-2">Descricao</th>
                      <th className="px-3 py-2">Unid.</th>
                      <th className="px-3 py-2">LOCAL DESTINO</th>
                      <th className="px-3 py-2">Divergencia</th>
                      <th className="px-3 py-2">Manter?</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loteItens.map((row) => (
                      <tr key={row.bemId} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-[11px]">{row.numeroTombamento}</td>
                        <td className="px-3 py-2 text-slate-800">{row.descricao}</td>
                        <td className="px-3 py-2 text-slate-700">{row.unidadeDonaId || "-"}</td>
                        <td className="px-3 py-2 text-slate-700">{row.localAtual || "-"}</td>
                        <td className="px-3 py-2">
                          {row.divergenciaUnidade ? (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">Outra unidade</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.divergenciaUnidade ? (
                            <label className="inline-flex items-center gap-2 text-slate-700">
                              <input
                                type="checkbox"
                                checked={Boolean(row.manterOutraUnidade)}
                                onChange={(e) =>
                                  setLoteItens((prev) =>
                                    prev.map((x) =>
                                      x.bemId === row.bemId ? { ...x, manterOutraUnidade: e.target.checked } : x,
                                    ),
                                  )
                                }
                                disabled={loteState.loading}
                                className="h-4 w-4 accent-violet-600"
                              />
                              Sim
                            </label>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.erro ? (
                            <span className="text-rose-700">{row.erro}</span>
                          ) : row.pendenteAprovacao ? (
                            <span className="text-amber-700">Pendente aprovacao</span>
                          ) : row.salvo ? (
                            <span className="text-emerald-700">Salvo</span>
                          ) : (
                            <span className="text-slate-500">Pendente</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLoteItem(row.bemId)}
                            disabled={loteState.loading}
                            className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loteItens.length ? (
                      <tr>
                        <td className="px-3 py-3 text-slate-600" colSpan={8}>
                          Nenhum item na fila.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </article>
      ) : null}

      {showCadastroSala && showScanner ? (
        <BarcodeScanner
          continuous={scannerMode === "continuous"}
          scanPreview={cameraScanPreview}
          onClose={() => setShowScanner(false)}
          onScan={(value) => {
            const normalized = normalizeTombamentoInput(value);
            if (normalized) {
              void buscarEAdicionarTombo(normalized, { fromCamera: true });
            }
            if (scannerMode === "single") {
              setShowScanner(false);
            }
          }}
        />
      ) : null}

      {showCadastroSala && tagIdModal.isOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl">
            <h3 className="font-[Space_Grotesk] text-xl font-bold text-slate-900">Identificar Etiqueta</h3>
            <p className="mt-4 text-slate-600">
              O codigo <span className="font-mono font-bold text-violet-700">"{tagIdModal.value}"</span> possui 4 digitos. Como deseja consultar?
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setTagIdModal({ isOpen: false, value: "" });
                  void buscarEAdicionarTombo(tagIdModal.value, { tipoBusca: "antigo" });
                }}
                className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left transition-colors hover:bg-violet-100"
              >
                <div className="font-bold text-violet-700">Etiqueta Antiga (Azul)</div>
                <div className="text-xs text-slate-500">Busca por Cod2Aud da 2a Auditoria</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTagIdModal({ isOpen: false, value: "" });
                  void buscarEAdicionarTombo(tagIdModal.value, { tipoBusca: "novo" });
                }}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100"
              >
                <div className="font-bold text-emerald-700">Etiqueta Nova (Erro)</div>
                <div className="text-xs text-slate-500">Busca pelo sufixo de 4 digitos no tombamento GEAFIN</div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setTagIdModal({ isOpen: false, value: "" });
                setScanInput("");
                focusScanInput();
              }}
              className="mt-6 w-full rounded-xl py-2 text-sm text-slate-500 hover:text-slate-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
