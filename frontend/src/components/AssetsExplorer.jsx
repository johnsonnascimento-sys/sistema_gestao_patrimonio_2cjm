/**
 * Modulo: frontend/components
 * Arquivo: AssetsExplorer.jsx
 * Funcao no sistema: consulta paginada do cadastro de bens via API backend.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
import AssetsExplorerDetailModal from "./assets/AssetsExplorerDetailModal.jsx";
import AssetsExplorerHeader from "./assets/AssetsExplorerHeader.jsx";
import AssetsExplorerResultsTable from "./assets/AssetsExplorerResultsTable.jsx";
import AssetsExplorerSearchPanel from "./assets/AssetsExplorerSearchPanel.jsx";
import AssetsExplorerSummary from "./assets/AssetsExplorerSummary.jsx";
import BarcodeScanner from "./BarcodeScanner.jsx";
import {
  atualizarBem,
  getBemAuditoria,
  getBemDetalhe,
  getStats,
  listarBens,
  listarCatalogos,
  listarLocais,
  reverterBemAuditoria,
  uploadFoto,
  getFotoUrl,
  atualizarFotoCatalogo,
  buscarPerfisDetentor,
} from "../services/apiClient.js";

const STATUS_OPTIONS = ["", "OK", "EM_CAUTELA", "BAIXADO", "AGUARDANDO_RECEBIMENTO"];
const UNIT_OPTIONS = ["", "1", "2", "3", "4"];

function formatUnidade(id) {
  if (id === 1) return "1 (1a Aud)";
  if (id === 2) return "2 (2a Aud)";
  if (id === 3) return "3 (Foro)";
  if (id === 4) return "4 (Almox)";
  return String(id || "");
}

function normalizeTombamentoInput(raw) {
  if (raw == null) return "";
  return String(raw).trim().replace(/^\"+|\"+$/g, "").replace(/\D+/g, "").slice(0, 10);
}

export default function AssetsExplorer({ initialUnidadeDonaId = null, navigationPreset = null }) {
  const auth = useAuth();
  const [stats, setStats] = useState({ loading: false, data: null, error: null });
  const [list, setList] = useState({ loading: false, data: null, error: null });
  const [formError, setFormError] = useState(null);
  const [tipoBusca4Digitos, setTipoBusca4Digitos] = useState(null);
  const [tagIdModal, setTagIdModal] = useState({ isOpen: false, value: "", fromCamera: false, mode: "single" });
  const [detail, setDetail] = useState({ open: false, loading: false, data: null, error: null });
  const [filters, setFilters] = useState({
    numeroTombamento: "",
    codigoCatalogo: "",
    q: "",
    localId: "",
    unidadeDonaId: "",
    status: "",
    responsavelPerfilId: "",
    responsavel: "",
  });
  const [paging, setPaging] = useState({ limit: 50, offset: 0, total: 0 });
  const [listView, setListView] = useState({
    showItemPhoto: false,
    showCatalogPhoto: false,
  });
  const [copyFeedback, setCopyFeedback] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState("continuous");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [cameraScanPreview, setCameraScanPreview] = useState(null);
  const cameraPreviewTimeoutRef = useRef(null);
  const tombamentoInputRef = useRef(null);

  const [responsavelLookup, setResponsavelLookup] = useState({ loading: false, error: null, data: [] });
  const [responsavelInputFocused, setResponsavelInputFocused] = useState(false);
  const focusTombamentoInput = () => {
    window.setTimeout(() => {
      tombamentoInputRef.current?.focus();
    }, 0);
  };

  const canPrev = paging.offset > 0;
  const canNext = paging.offset + paging.limit < paging.total;

  const locaisFiltroQuery = useQuery({
    queryKey: ["locais", "todos"],
    queryFn: async () => {
      const data = await listarLocais({});
      return data.items || [];
    },
  });

  const locaisFiltroOptions = useMemo(() => {
    const unidadeFiltro = filters.unidadeDonaId ? Number(filters.unidadeDonaId) : null;
    return (locaisFiltroQuery.data || []).filter((l) => {
      if (l.ativo === false) return false;
      if (unidadeFiltro == null) return true;
      return l.unidadeId == null || Number(l.unidadeId) === unidadeFiltro;
    });
  }, [filters.unidadeDonaId, locaisFiltroQuery.data]);

  useEffect(() => {
    if (!filters.localId) return;
    const exists = locaisFiltroOptions.some((l) => String(l.id) === String(filters.localId));
    if (!exists) {
      setFilters((prev) => ({ ...prev, localId: "" }));
    }

  }, [filters.localId, locaisFiltroOptions]);
  useEffect(() => {
    const query = String(filters.responsavel || "").trim();
    if (query.length < 2) {
      setResponsavelLookup({ loading: false, error: null, data: [] });
      return;
    }
    let active = true;
    setResponsavelLookup((prev) => ({ ...prev, loading: true, error: null }));
    const timer = window.setTimeout(async () => {
      try {
        const data = await buscarPerfisDetentor({ q: query, limit: 20 });
        if (!active) return;
        setResponsavelLookup({ loading: false, error: null, data: data?.items || [] });
      } catch (e) {
        if (!active) return;
        setResponsavelLookup({ loading: false, error: String(e?.message || "Falha ao buscar responsavel."), data: [] });
      }
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters.responsavel]);

  const unitSummary = useMemo(() => {
    const rows = stats.data?.bens?.porUnidade || [];
    const map = new Map(rows.map((r) => [Number(r.unidade), Number(r.total)]));
    return [
      { unidade: 1, total: map.get(1) || 0 },
      { unidade: 2, total: map.get(2) || 0 },
      { unidade: 3, total: map.get(3) || 0 },
      { unidade: 4, total: map.get(4) || 0 },
    ];
  }, [stats.data]);

  const applyUnidadeFilter = (unidadeIdOrNull) => {
    const unidadeValue = unidadeIdOrNull == null ? "" : String(Number(unidadeIdOrNull));
    const nextFilters = {
      ...filters,
      unidadeDonaId: unidadeValue,
      localId: "",
    };
    setFilters(nextFilters);
    setPaging((prev) => ({ ...prev, offset: 0 }));
    setTimeout(() => loadList(0, undefined, nextFilters), 0);
  };

  const loadStats = async () => {
    setStats({ loading: true, data: null, error: null });
    try {
      const data = await getStats(false);
      setStats({ loading: false, data, error: null });
    } catch (error) {
      setStats({ loading: false, data: null, error: error.message });
    }
  };

  const loadList = async (newOffset, forcedTipoBusca, forcedFilters) => {
    setList({ loading: true, data: null, error: null });
    try {
      const activeFilters = forcedFilters || filters;
      const tombamentoRaw = activeFilters.numeroTombamento.trim();
      const tipoBusca =
        tombamentoRaw.length === 4 ? (forcedTipoBusca ?? tipoBusca4Digitos ?? undefined) : undefined;

      const data = await listarBens({
        numeroTombamento: tombamentoRaw || undefined,
        tipoBusca,
        codigoCatalogo: activeFilters.codigoCatalogo.trim() || undefined,
        q: activeFilters.q.trim() || undefined,
        localId: activeFilters.localId ? String(activeFilters.localId) : undefined,
        unidadeDonaId: activeFilters.unidadeDonaId ? Number(activeFilters.unidadeDonaId) : undefined,
        status: activeFilters.status || undefined,
        responsavelPerfilId: activeFilters.responsavelPerfilId ? String(activeFilters.responsavelPerfilId) : undefined,
        responsavel: activeFilters.responsavelPerfilId ? undefined : (activeFilters.responsavel ? String(activeFilters.responsavel).trim() : undefined),
        limit: paging.limit,
        offset: newOffset,
      });
      setList({ loading: false, data, error: null });
      setPaging((prev) => ({
        ...prev,
        offset: newOffset,
        total: Number(data.paging?.total || 0),
      }));
    } catch (error) {
      setList({ loading: false, data: null, error: error.message });
    }
  };

  useEffect(() => {
    loadStats();
    loadList(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialUnidadeDonaId == null) return;
    const unidadeNum = Number(initialUnidadeDonaId);
    if (!Number.isInteger(unidadeNum) || unidadeNum < 1 || unidadeNum > 4) return;
    applyUnidadeFilter(unidadeNum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUnidadeDonaId]);

  const onSubmit = (event) => {
    event.preventDefault();
    setFormError(null);

    const tombo = String(filters.numeroTombamento || "").trim();
    if (tombo && !/^\d{10}$/.test(tombo) && !/^\d{4}$/.test(tombo)) {
      setFormError("Tombamento inválido: use 10 dígitos (ex.: 1290001788) ou 4 dígitos (ex.: 1260 ou 2657).");
      return;
    }
    if (/^\d{4}$/.test(tombo) && !tipoBusca4Digitos) {
      setTagIdModal({ isOpen: true, value: tombo, fromCamera: false, mode: "single" });
      return;
    }
    if (/^\d{10}$/.test(tombo) && tipoBusca4Digitos) {
      setTipoBusca4Digitos(null);
    }
    const nextFilters = { ...filters };
    loadList(0, undefined, nextFilters);
    if (tombo) {
      setFilters((prev) => ({ ...prev, numeroTombamento: "" }));
    }
    focusTombamentoInput();
  };

  const handleTombamentoInputKeyDown = (event) => {
    const key = String(event.key || "");
    const lower = key.toLowerCase();
    const isCtrlJ = event.ctrlKey && !event.altKey && !event.metaKey && lower === "j";
    const isSubmitKey = key === "Enter" || key === "Tab" || isCtrlJ;
    if (!isSubmitKey) return;
    event.preventDefault();
    event.stopPropagation();
    onSubmit(event);
  };

  const onClear = () => {
    setFormError(null);
    setTipoBusca4Digitos(null);
    setTagIdModal({ isOpen: false, value: "", fromCamera: false, mode: "single" });
    const clearedFilters = { numeroTombamento: "", codigoCatalogo: "", q: "", localId: "", unidadeDonaId: "", status: "", responsavelPerfilId: "", responsavel: "" };
    setFilters(clearedFilters);
    setPaging((prev) => ({ ...prev, offset: 0 }));
    setTimeout(() => loadList(0, undefined, clearedFilters), 0);
  };

  const onSelectTipoBusca = async (tipoBusca, options = {}) => {
    const value4 = String(options?.value ?? tagIdModal.value ?? filters.numeroTombamento ?? "").trim();
    const fromCamera = Boolean(options?.fromCamera);
    const previewMode = options?.mode || scannerMode;
    setFormError(null);
    setTipoBusca4Digitos(tipoBusca);
    setTagIdModal({ isOpen: false, value: "", fromCamera: false, mode: "single" });
    if (fromCamera && /^\d{4}$/.test(value4)) {
      try {
        const data = await listarBens({
          numeroTombamento: value4,
          tipoBusca,
          limit: 1,
          offset: 0,
        });
        const bem = (data?.items || [])[0] || null;
        if (bem) {
          const tombamentoResolvido = String(bem.numeroTombamento || value4);
          const nomeResumo = bem?.nomeResumo || bem?.descricao || bem?.descricaoComplementar || "Sem nome resumo cadastrado.";
          showCameraPreview(tombamentoResolvido, nomeResumo, previewMode);
        } else {
          showCameraPreview(value4, "Nenhum bem encontrado para este codigo de 4 digitos.", previewMode);
        }
      } catch (_error) {
        showCameraPreview(value4, "Falha ao resolver etiqueta de 4 digitos.", previewMode);
      }
    }
    await loadList(0, tipoBusca);
    setFilters((prev) => ({ ...prev, numeroTombamento: "" }));
    focusTombamentoInput();
  };

  const items = list.data?.items || [];

  const showCameraPreview = (code, summary, mode = "single") => {
    setCameraScanPreview({
      code: String(code || ""),
      summary: String(summary || "Sem nome resumo cadastrado."),
    });
    if (cameraPreviewTimeoutRef.current) {
      window.clearTimeout(cameraPreviewTimeoutRef.current);
      cameraPreviewTimeoutRef.current = null;
    }
    if (mode === "continuous") return;
    cameraPreviewTimeoutRef.current = window.setTimeout(() => {
      setCameraScanPreview(null);
      cameraPreviewTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => () => {
    if (cameraPreviewTimeoutRef.current) window.clearTimeout(cameraPreviewTimeoutRef.current);
  }, []);

  const onCameraScan = async (decodedValue) => {
    const normalized = normalizeTombamentoInput(decodedValue);
    if (!normalized) return;

    setFormError(null);
    setTipoBusca4Digitos(null);
    const nextFilters = { ...filters, numeroTombamento: normalized };
    setFilters(nextFilters);
    setPaging((prev) => ({ ...prev, offset: 0 }));

    if (normalized.length === 4) {
      showCameraPreview(normalized, "Etiqueta de 4 digitos lida. Selecione o tipo de busca.", scannerMode);
      setTagIdModal({ isOpen: true, value: normalized, fromCamera: true, mode: scannerMode });
      if (scannerMode === "single") setShowScanner(false);
      return;
    }

    if (!/^\d{10}$/.test(normalized)) {
      setFormError("Leitura invalida da camera. Use tombamento de 10 digitos ou etiqueta de 4 digitos.");
      return;
    }

    try {
      const data = await listarBens({ numeroTombamento: normalized, limit: 1, offset: 0 });
      const bem = (data?.items || [])[0];
      const nomeResumo = bem?.nomeResumo || bem?.descricao || bem?.descricaoComplementar || "Sem nome resumo cadastrado.";
      showCameraPreview(normalized, nomeResumo, scannerMode);
    } catch (_error) {
      showCameraPreview(normalized, "Tombamento lido. Falha ao carregar nome resumo.", scannerMode);
    }

    await loadList(0, undefined, nextFilters);
    if (scannerMode === "single") setShowScanner(false);
  };

  const aplicarMesmoCatalogo = (codigoCatalogo) => {
    const codigo = String(codigoCatalogo || "").trim();
    if (!codigo) return;
    setFormError(null);
    setTipoBusca4Digitos(null);
    setTagIdModal({ isOpen: false, value: "", fromCamera: false, mode: "single" });
    const nextFilters = {
      ...filters,
      numeroTombamento: "",
      codigoCatalogo: codigo,
    };
    setFilters(nextFilters);
    setPaging((prev) => ({ ...prev, offset: 0 }));
    setTimeout(() => loadList(0, undefined, nextFilters), 0);
  };

  const copyTombamento = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback("Número copiado");
      window.setTimeout(() => setCopyFeedback(""), 1600);
    } catch (_error) {
      // Clipboard pode falhar em alguns navegadores; sem efeito colateral.
      setCopyFeedback("Falha ao copiar");
      window.setTimeout(() => setCopyFeedback(""), 1600);
    }
  };

  const openDetail = async (bemId) => {
    if (!bemId) return;
    setDetail({ open: true, loading: true, data: null, error: null });
    try {
      const data = await getBemDetalhe(bemId);
      setDetail({ open: true, loading: false, data, error: null });
    } catch (error) {
      setDetail({ open: true, loading: false, data: null, error: error.message });
    }
  };

  const closeDetail = () => setDetail((prev) => ({ ...prev, open: false }));

  useEffect(() => {
    const preset = navigationPreset && typeof navigationPreset === "object" ? navigationPreset : null;
    if (!preset?.nonce) return;

    let active = true;
    const runPreset = async () => {
      const nextFilters = {
        numeroTombamento: preset.numeroTombamento ? normalizeTombamentoInput(preset.numeroTombamento) : "",
        codigoCatalogo: preset.codigoCatalogo ? String(preset.codigoCatalogo).trim() : "",
        q: "",
        localId: "",
        unidadeDonaId: preset.unidadeDonaId != null && preset.unidadeDonaId !== ""
          ? String(Number(preset.unidadeDonaId))
          : "",
        status: "",
        responsavelPerfilId: "",
        responsavel: "",
      };

      setFormError(null);
      setTipoBusca4Digitos(null);
      setTagIdModal({ isOpen: false, value: "", fromCamera: false, mode: "single" });
      setFilters(nextFilters);
      setShowAdvancedFilters(Boolean(nextFilters.codigoCatalogo || nextFilters.unidadeDonaId));
      setPaging((prev) => ({ ...prev, offset: 0 }));
      const data = await listarBens({
        numeroTombamento: nextFilters.numeroTombamento || undefined,
        codigoCatalogo: nextFilters.codigoCatalogo || undefined,
        unidadeDonaId: nextFilters.unidadeDonaId ? Number(nextFilters.unidadeDonaId) : undefined,
        limit: paging.limit,
        offset: 0,
      });
      if (!active) return;
      setList({ loading: false, data, error: null });
      setPaging((prev) => ({
        ...prev,
        offset: 0,
        total: Number(data?.paging?.total || 0),
      }));
      if (preset.openDetail) {
        const first = (data?.items || [])[0] || null;
        if (first?.id) {
          await openDetail(first.id);
        }
      }
      focusTombamentoInput();
    };

    setList({ loading: true, data: null, error: null });
    runPreset().catch((error) => {
      if (!active) return;
      setList({ loading: false, data: null, error: String(error?.message || "Falha ao aplicar navegação da consulta.") });
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationPreset?.nonce]);

  const presetOriginLabel = navigationPreset?.originLabel ? String(navigationPreset.originLabel) : "";
  const presetOriginContext = navigationPreset?.originContext ? String(navigationPreset.originContext) : "";
  const handleFilterChange = (field, value, options = {}) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      ...(options.clearPerfil ? { responsavelPerfilId: "" } : {}),
    }));
  };
  const handleTombamentoChange = (event) => {
    const normalized = normalizeTombamentoInput(event.target.value);
    setFilters((prev) => ({ ...prev, numeroTombamento: normalized }));
    if (normalized.length !== 4 || normalized !== String(filters.numeroTombamento || "")) {
      setTipoBusca4Digitos(null);
    }
    setFormError(null);
  };
  const handleSelectResponsavelPerfil = (perfil) => {
    const label = perfil?.matricula
      ? `${perfil.matricula}${perfil?.nome ? ` - ${perfil.nome}` : ""}`
      : (perfil?.nome || perfil?.id || "");
    setFilters((prev) => ({
      ...prev,
      responsavelPerfilId: String(perfil?.id || ""),
      responsavel: label,
    }));
    setResponsavelInputFocused(false);
  };

  return (
    <section className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <AssetsExplorerHeader originLabel={presetOriginLabel} originContext={presetOriginContext} />

      <AssetsExplorerSummary
        filters={filters}
        stats={stats}
        unitSummary={unitSummary}
        formatUnidade={formatUnidade}
        onApplyUnidadeFilter={applyUnidadeFilter}
      />

      <AssetsExplorerSearchPanel
        filters={filters}
        formError={formError}
        listError={list.error}
        listLoading={list.loading}
        scannerMode={scannerMode}
        setScannerMode={setScannerMode}
        setShowScanner={setShowScanner}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        tipoBusca4Digitos={tipoBusca4Digitos}
        tombamentoInputRef={tombamentoInputRef}
        onFiltersChange={handleFilterChange}
        onTombamentoChange={handleTombamentoChange}
        onSubmit={onSubmit}
        onClear={onClear}
        onTombamentoInputKeyDown={handleTombamentoInputKeyDown}
        formatUnidade={formatUnidade}
        unitOptions={UNIT_OPTIONS}
        statusOptions={STATUS_OPTIONS}
        locaisFiltroOptions={locaisFiltroOptions}
        locaisFiltroLoading={locaisFiltroQuery.isLoading}
        responsavelLookup={responsavelLookup}
        responsavelInputFocused={responsavelInputFocused}
        setResponsavelInputFocused={setResponsavelInputFocused}
        onSelectResponsavelPerfil={handleSelectResponsavelPerfil}
      />

      <AssetsExplorerResultsTable
        items={items}
        paging={paging}
        canPrev={canPrev}
        canNext={canNext}
        listLoading={list.loading}
        listView={listView}
        copyFeedback={copyFeedback}
        setListView={setListView}
        loadList={loadList}
        copyTombamento={copyTombamento}
        aplicarMesmoCatalogo={aplicarMesmoCatalogo}
        openDetail={openDetail}
        formatUnidade={formatUnidade}
        getFotoUrl={getFotoUrl}
      />

      {showScanner && (
        <BarcodeScanner
          continuous={scannerMode === "continuous"}
          scanPreview={cameraScanPreview}
          onClose={() => setShowScanner(false)}
          onScan={(value) => {
            void onCameraScan(value);
          }}
        />
      )}

      {tagIdModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl">
            <h3 className="font-[Space_Grotesk] text-xl font-bold text-slate-900">Identificar Etiqueta</h3>
            <p className="mt-4 text-slate-600">
              O codigo <span className="font-mono font-bold text-violet-700">"{tagIdModal.value}"</span> possui 4 digitos. Como deseja consultar?
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => onSelectTipoBusca("antigo", { fromCamera: tagIdModal.fromCamera, mode: tagIdModal.mode, value: tagIdModal.value })}
                className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left transition-colors hover:bg-violet-100"
              >
                <div className="font-bold text-violet-700">Etiqueta Antiga (Azul)</div>
                <div className="text-xs text-slate-500">Busca por Cod2Aud da 2ª Auditoria</div>
              </button>
              <button
                type="button"
                onClick={() => onSelectTipoBusca("novo", { fromCamera: tagIdModal.fromCamera, mode: tagIdModal.mode, value: tagIdModal.value })}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100"
              >
                <div className="font-bold text-emerald-700">Etiqueta Nova (Erro)</div>
                <div className="text-xs text-slate-500">Busca pelo sufixo de 4 digitos no tombamento GEAFIN</div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setTagIdModal({ isOpen: false, value: "", fromCamera: false, mode: "single" });
                setFilters((prev) => ({ ...prev, numeroTombamento: "" }));
                focusTombamentoInput();
              }}
              className="mt-6 w-full rounded-xl py-2 text-sm text-slate-500 hover:text-slate-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {detail.open && (
        <AssetsExplorerDetailModal
          state={detail}
          onClose={closeDetail}
          onReload={() => openDetail(detail?.data?.bem?.id)}
          isAdmin={String(auth?.role || "").toUpperCase() === "ADMIN"}
        />
      )}
    </section>
  );
}
