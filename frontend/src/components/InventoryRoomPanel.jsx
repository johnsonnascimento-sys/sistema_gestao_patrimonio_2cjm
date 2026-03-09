/**
 * Modulo: frontend/components
 * Arquivo: InventoryRoomPanel.jsx
 * Funcao no sistema: modo inventario (offline-first) com contagens por endereço e sincronizacao deterministica.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get as idbGet, set as idbSet } from "idb-keyval";
import useOfflineSync from "../hooks/useOfflineSync.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  listarContagensInventario,
  listarBens,
  listarBensTerceirosInventario,
  listarForasteirosInventario,
  listarEventosInventario,
  listarLocais,
  registrarBemTerceiroInventario,
  registrarBemNaoIdentificadoInventario,
  getFotoUrl,
  getMinhaSessaoContagemInventario,
} from "../services/apiClient.js";
import InventoryProgress from "./InventoryProgress.jsx";
import InventoryAddressOverviewCard from "./inventory/InventoryAddressOverviewCard.jsx";
import InventoryCountContextCard from "./inventory/InventoryCountContextCard.jsx";
import InventoryDivergencesPanel from "./inventory/InventoryDivergencesPanel.jsx";
import InventoryExceptionPanels from "./inventory/InventoryExceptionPanels.jsx";
import InventoryExpectedAssetsPanel from "./inventory/InventoryExpectedAssetsPanel.jsx";
import InventoryPrimaryReadPanel from "./inventory/InventoryPrimaryReadPanel.jsx";
import {
  BlindModeBanner,
  ModeBadge,
  StatusBadge,
  formatModeLabel,
} from "./inventory/InventoryRoomUi.jsx";
import { filterExpectedAssetGroups } from "./inventory/expectedAssetsFilter.js";
import { normalizeTombamentoInput } from "./inventory/inventoryInputUtils.js";
const TOMBAMENTO_RE = /^\d{10}$/;
const TOMBAMENTO_4_DIGITS_RE = /^\d{4}$/;
const ROOM_CATALOG_CACHE_PREFIX = "cjm_room_catalog_v2|";
const INVENTORY_UI_KEY = "cjm_inventory_ui_v1";
const INVENTARIO_REDUCED_MODE_KEY = "cjm_inventario_reduced_mode_v1";

function normalizeRoomKey(raw) {
  if (raw == null) return "";
  return String(raw).trim().toLowerCase();
}

function normalizeRoomLabel(raw) {
  if (raw == null) return "";
  return String(raw).trim().toLowerCase().replace(/\s+/g, " ");
}

function roomCacheKey(localIdOrName) {
  return `${ROOM_CATALOG_CACHE_PREFIX}${normalizeRoomKey(localIdOrName)}`;
}

async function loadRoomCatalogFromCache(localIdOrName) {
  const v = await idbGet(roomCacheKey(localIdOrName));
  return Array.isArray(v) ? v : [];
}

async function saveRoomCatalogToCache(localIdOrName, items) {
  await idbSet(roomCacheKey(localIdOrName), items);
}

function formatUnidade(id) {
  if (id === 1) return "1 (1a Aud)";
  if (id === 2) return "2 (2a Aud)";
  if (id === 3) return "3 (Foro)";
  if (id === 4) return "4 (Almox)";
  return String(id || "");
}

function playAlertBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close().catch(() => undefined);
    }, 180);
  } catch (_error) {
    // Sem audio em alguns navegadores; não impede o fluxo.
  }
}

function playSuccessBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 660;
    g.gain.value = 0.07;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close().catch(() => undefined);
    }, 120);
  } catch (_error) {
    // Sem audio em alguns navegadores; não impede o fluxo.
  }
}

function loadInventoryUiState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(INVENTORY_UI_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

function saveInventoryUiState(patch) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadInventoryUiState() || {};
    const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(INVENTORY_UI_KEY, JSON.stringify(next));
  } catch {
    // sem fatal
  }
}


export default function InventoryRoomPanel({ navigationPreset = null }) {
  const qc = useQueryClient();
  const auth = useAuth();
  const offline = useOfflineSync();
  const appliedPresetNonceRef = useRef(null);
  const skipNextUnitResetRef = useRef(false);
  const presetOriginLabel = navigationPreset?.originLabel ? String(navigationPreset.originLabel) : "";
  const presetOriginContext = navigationPreset?.originContext ? String(navigationPreset.originContext) : "";

  const initialUi = loadInventoryUiState();

  const [unidadeEncontradaId, setUnidadeEncontradaId] = useState(
    initialUi?.unidadeEncontradaId != null ? String(initialUi.unidadeEncontradaId) : "",
  );
  const [selectedEventoId, setSelectedEventoId] = useState(
    initialUi?.selectedEventoId != null ? String(initialUi.selectedEventoId) : "",
  );
  const [selectedLocalId, setSelectedLocalId] = useState(
    initialUi?.selectedLocalId != null ? String(initialUi.selectedLocalId) : "",
  );
  const [salaEncontrada, setSalaEncontrada] = useState(
    initialUi?.salaEncontrada != null ? String(initialUi.salaEncontrada) : "",
  );
  const [scannerValue, setScannerValue] = useState("");
  const [uiError, setUiError] = useState(null);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [lastScans, setLastScans] = useState([]);
  const [expectedAssetsFilter, setExpectedAssetsFilter] = useState("ALL");
  const [showItemPhotoList, setShowItemPhotoList] = useState(false);
  const [showCatalogPhotoList, setShowCatalogPhotoList] = useState(false);
  const [unitEffectReady, setUnitEffectReady] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraScanPreview, setCameraScanPreview] = useState(null);
  const [scannerMode, setScannerMode] = useState("single"); // 'single' ou 'continuous'
  const [tagIdModal, setTagIdModal] = useState({ isOpen: false, value: "", type: null, fromCamera: false });
  const [rodadaSelecionada, setRodadaSelecionada] = useState("A");

  // Registro segregado: bem de terceiro (sem tombamento GEAFIN).
  const [terceiroDescricao, setTerceiroDescricao] = useState("");
  const [terceiroProprietario, setTerceiroProprietario] = useState("");
  const [terceiroIdentificador, setTerceiroIdentificador] = useState("");
  const [terceiroStatus, setTerceiroStatus] = useState(null);

  // Registro segregado: bem não identificado (Art. 175)
  const [naoIdDescricao, setNaoIdDescricao] = useState("");
  const [naoIdLocalizacao, setNaoIdLocalizacao] = useState("");
  const [naoIdFotoBase64, setNaoIdFotoBase64] = useState("");
  const [naoIdStatus, setNaoIdStatus] = useState(null);

  const [divergenteAlertItem, setDivergenteAlertItem] = useState(null);
  const scannedSessionRef = useRef(new Set());
  const scanCooldownRef = useRef(new Map());
  const cameraPreviewTimeoutRef = useRef(null);
  const scannerInputRef = useRef(null);

  const focusScannerInput = () => {
    window.setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 0);
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
    if (showScanner || tagIdModal.isOpen) return;
    focusScannerInput();
  }, [showScanner, tagIdModal.isOpen]);


  useEffect(() => {
    // Se o usuario mudar a unidade encontrada, o local deve ser re-selecionado (lista de locais e por unidade).
    if (!unitEffectReady) {
      setUnitEffectReady(true);
      return;
    }
    if (skipNextUnitResetRef.current) {
      skipNextUnitResetRef.current = false;
      return;
    }
    setSelectedLocalId("");
    // salaEncontrada sera limpada pelo efeito de coerencia do local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadeEncontradaId]);

  if (initialUi && !initialUi._migrated) {
    // Marca como migrado para evitar reprocessamento em renders futuros.
    saveInventoryUiState({ _migrated: true });
  }

  const eventosQuery = useQuery({
    queryKey: ["inventarioEventos", "EM_ANDAMENTO"],
    queryFn: async () => {
      const data = await listarEventosInventario("EM_ANDAMENTO");
      return data.items || [];
    },
  });

  const eventoAtivo = useMemo(() => {
    const items = eventosQuery.data || [];
    if (!items.length) return null;
    if (selectedEventoId) {
      const byId = items.find((ev) => String(ev.id) === String(selectedEventoId));
      if (byId) return byId;
    }
    const unidade = Number(unidadeEncontradaId);
    if (Number.isInteger(unidade) && unidade >= 1 && unidade <= 4) {
      const byUnit = items.find((ev) => Number(ev?.unidadeInventariadaId) === unidade);
      if (byUnit) return byUnit;
      const geral = items.find((ev) => ev?.unidadeInventariadaId == null);
      if (geral) return geral;
      return null;
    }
    return items[0];
  }, [eventosQuery.data, selectedEventoId, unidadeEncontradaId]);
  const modoContagemEvento = String(eventoAtivo?.modoContagem || "PADRAO").toUpperCase();

  const selectedEventoIdFinal = eventoAtivo?.id || "";
  const sessaoContagemQuery = useQuery({
    queryKey: ["inventarioSessaoContagem", selectedEventoIdFinal],
    enabled: Boolean(selectedEventoIdFinal && navigator.onLine),
    queryFn: async () => getMinhaSessaoContagemInventario(selectedEventoIdFinal),
  });
  const sessaoContagem = sessaoContagemQuery.data || null;
  const uiReduzida = Boolean(sessaoContagem?.uiReduzida);
  const blindCountMode = modoContagemEvento === "CEGO" || modoContagemEvento === "DUPLO_CEGO";
  // Fail-closed: em modo cego, se a sessão não estiver disponível ainda, não exibir dados esperados.
  const shouldHideExpectedData = blindCountMode && (uiReduzida || !sessaoContagem);
  const rodadasPermitidas = Array.isArray(sessaoContagem?.rodadasPermitidas) ? sessaoContagem.rodadasPermitidas : ["A"];
  const eventoSelecionadoIncompativel = useMemo(() => {
    if (!eventoAtivo) return false;
    const unidade = Number(unidadeEncontradaId);
    if (!Number.isInteger(unidade) || unidade < 1 || unidade > 4) return false;
    const evUnidade = eventoAtivo?.unidadeInventariadaId != null ? Number(eventoAtivo.unidadeInventariadaId) : null;
    return evUnidade != null && evUnidade !== unidade;
  }, [eventoAtivo, unidadeEncontradaId]);

  useEffect(() => {
    if (!selectedEventoIdFinal) return;
    setSelectedEventoId(String(selectedEventoIdFinal));
  }, [selectedEventoIdFinal]);

  useEffect(() => {
    const preset = navigationPreset && typeof navigationPreset === "object" ? navigationPreset : null;
    const nonce = preset?.nonce;
    if (!preset || nonce == null) return;
    if (appliedPresetNonceRef.current === nonce) return;

    appliedPresetNonceRef.current = nonce;

    const nextEventoId = preset.eventoInventarioId ? String(preset.eventoInventarioId) : "";
    const nextUnidadeId = preset.unidadeEncontradaId != null ? String(preset.unidadeEncontradaId) : "";
    const nextLocalId = preset.localId ? String(preset.localId) : "";
    const nextSala = preset.salaEncontrada ? String(preset.salaEncontrada) : "";

    if (nextUnidadeId || nextLocalId) {
      skipNextUnitResetRef.current = true;
    }
    if (nextEventoId) setSelectedEventoId(nextEventoId);
    if (nextUnidadeId) setUnidadeEncontradaId(nextUnidadeId);
    if (nextLocalId) setSelectedLocalId(nextLocalId);
    if (nextSala) setSalaEncontrada(nextSala);

    saveInventoryUiState({
      selectedEventoId: nextEventoId || undefined,
      unidadeEncontradaId: nextUnidadeId || undefined,
      selectedLocalId: nextLocalId || undefined,
      salaEncontrada: nextSala || undefined,
    });
  }, [navigationPreset]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedEventoIdFinal) {
      window.localStorage.removeItem(INVENTARIO_REDUCED_MODE_KEY);
      return;
    }
    if (uiReduzida && sessaoContagem?.designado) {
      const payload = {
        active: true,
        eventoId: selectedEventoIdFinal,
        modoContagem: modoContagemEvento,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(INVENTARIO_REDUCED_MODE_KEY, JSON.stringify(payload));
      return;
    }
    window.localStorage.removeItem(INVENTARIO_REDUCED_MODE_KEY);
  }, [modoContagemEvento, selectedEventoIdFinal, sessaoContagem?.designado, uiReduzida]);

  useEffect(() => {
    const prefer = (rodadasPermitidas || []).includes(rodadaSelecionada)
      ? rodadaSelecionada
      : (rodadasPermitidas[0] || "A");
    if (prefer !== rodadaSelecionada) setRodadaSelecionada(prefer);
  }, [rodadaSelecionada, rodadasPermitidas]);

  useEffect(() => {
    setScanFeedback(null);
  }, [selectedEventoIdFinal, selectedLocalId, salaEncontrada, unidadeEncontradaId]);

  const registrarBemTerceiroMut = useMutation({
    mutationFn: (payload) => registrarBemTerceiroInventario(payload),
    onSuccess: async () => {
      setTerceiroDescricao("");
      setTerceiroProprietario("");
      setTerceiroIdentificador("");
      setTerceiroStatus({ kind: "ok", at: new Date().toISOString() });

      // Atualiza contagens do endereço (se online) para refletir o registro.
      await qc.invalidateQueries({ queryKey: ["inventarioContagens", selectedEventoIdFinal, salaEncontrada] }).catch(
        () => undefined,
      );
      await qc.invalidateQueries({ queryKey: ["inventarioBensTerceiros", selectedEventoIdFinal, salaEncontrada] }).catch(
        () => undefined,
      );
    },
  });

  const registrarNaoIdentificadoMut = useMutation({
    mutationFn: (payload) => registrarBemNaoIdentificadoInventario(payload),
    onSuccess: async () => {
      setNaoIdDescricao("");
      setNaoIdLocalizacao("");
      setNaoIdFotoBase64("");
      setNaoIdStatus({ kind: "ok", at: new Date().toISOString() });
      await qc.invalidateQueries({ queryKey: ["inventarioContagens", selectedEventoIdFinal, salaEncontrada] }).catch(() => undefined);
      await qc.invalidateQueries({ queryKey: ["inventarioBensTerceiros", selectedEventoIdFinal, salaEncontrada] }).catch(() => undefined);
    },
    onError: (error) => {
      setUiError(String(error?.message || "Falha ao registrar bem não identificado."));
    }
  });



  const bensSalaQuery = useQuery({
    queryKey: ["bensSala", selectedLocalId],
    enabled: Boolean(selectedLocalId && String(selectedLocalId).trim() !== "" && !shouldHideExpectedData),
    queryFn: async () => {
      const localId = String(selectedLocalId || "").trim();
      if (!localId) return [];

      // Offline-first: se não houver conexao, tenta carregar o ultimo catalogo baixado para este endereço.
      if (!navigator.onLine) {
        const cached = await loadRoomCatalogFromCache(localId);
        if (cached.length) return cached;
        throw new Error("SEM_CACHE_OFFLINE");
      }

      const data = await listarBens({ localId, limit: 5000, offset: 0, incluirTerceiros: false });
      const items = data.items || [];
      await saveRoomCatalogToCache(localId, items);
      return items;
    },
  });

  const locaisQuery = useQuery({
    queryKey: ["locais", unidadeEncontradaId],
    enabled: Boolean(navigator.onLine),
    queryFn: async () => {
      const unidade = unidadeEncontradaId ? Number(unidadeEncontradaId) : null;
      const data = await listarLocais(unidade != null ? { unidadeId: unidade } : {});
      return data.items || [];
    },
  });

  const localIdsPermitidosEvento = useMemo(() => {
    const escopoTipo = String(eventoAtivo?.escopoTipo || "").toUpperCase();
    if (escopoTipo !== "LOCAIS") return null;
    const ids = (eventoAtivo?.escopoLocais || [])
      .map((x) => String(x?.localId || "").trim())
      .filter(Boolean);
    return new Set(ids);
  }, [eventoAtivo?.escopoLocais, eventoAtivo?.escopoTipo]);

  const locaisOptions = useMemo(() => {
    const rows = locaisQuery.data || [];
    if (!localIdsPermitidosEvento) return rows;
    return rows.filter((l) => localIdsPermitidosEvento.has(String(l.id)));
  }, [locaisQuery.data, localIdsPermitidosEvento]);

  useEffect(() => {
    if (!selectedLocalId) return;
    const local = (locaisQuery.data || []).find((l) => String(l.id) === String(selectedLocalId));
    if (!local) return;
    const nextUnidade = local?.unidadeId != null ? String(local.unidadeId) : "";
    if (!nextUnidade || nextUnidade === String(unidadeEncontradaId || "")) return;
    skipNextUnitResetRef.current = true;
    setUnidadeEncontradaId(nextUnidade);
  }, [locaisQuery.data, selectedLocalId, unidadeEncontradaId]);

  useEffect(() => {
    if (!selectedLocalId) return;
    if (!localIdsPermitidosEvento) return;
    if (localIdsPermitidosEvento.has(String(selectedLocalId))) return;
    setSelectedLocalId("");
    setSalaEncontrada("");
  }, [localIdsPermitidosEvento, selectedLocalId]);

  useEffect(() => {
    // Mantem salaEncontrada coerente com o local selecionado (evita texto "solto" no estado).
    if (!selectedLocalId) {
      if (salaEncontrada) setSalaEncontrada("");
      return;
    }
    const local = (locaisOptions || []).find((l) => String(l.id) === String(selectedLocalId));
    if (local?.nome && String(local.nome) !== String(salaEncontrada || "")) {
      setSalaEncontrada(String(local.nome));
    }
  }, [locaisOptions, salaEncontrada, selectedLocalId]);

  const contagensSalaQuery = useQuery({
    queryKey: ["inventarioContagens", selectedEventoIdFinal, salaEncontrada],
    enabled: Boolean(selectedEventoIdFinal && selectedLocalId && salaEncontrada.trim().length >= 2 && navigator.onLine),
    queryFn: async () => {
      const data = await listarContagensInventario({
        eventoInventarioId: selectedEventoIdFinal,
        salaEncontrada: salaEncontrada.trim(),
        limit: 2000,
      });
      return data.items || [];
    },
  });

  const forasteirosEventoQuery = useQuery({
    queryKey: ["inventarioForasteirosEvento", selectedEventoIdFinal],
    enabled: Boolean(selectedEventoIdFinal && navigator.onLine),
    queryFn: async () => {
      const data = await listarForasteirosInventario({
        eventoInventarioId: selectedEventoIdFinal,
        limit: 10000,
      });
      return data.items || [];
    },
  });

  const terceirosSalaQuery = useQuery({
    queryKey: ["inventarioBensTerceiros", selectedEventoIdFinal, salaEncontrada],
    enabled: Boolean(selectedEventoIdFinal && selectedLocalId && salaEncontrada.trim().length >= 2 && navigator.onLine),
    queryFn: async () => {
      const data = await listarBensTerceirosInventario({
        eventoInventarioId: selectedEventoIdFinal,
        salaEncontrada: salaEncontrada.trim(),
        limit: 500,
      });
      return data.items || [];
    },
  });

  const bemByTombamento = useMemo(() => {
    const map = new Map();
    for (const b of bensSalaQuery.data || []) {
      if (b.numeroTombamento) map.set(b.numeroTombamento, b);
    }
    return map;
  }, [bensSalaQuery.data]);

  const grouped = useMemo(() => {
    const items = bensSalaQuery.data || [];
    const map = new Map();
    for (const b of items) {
      const key = b.catalogoBemId || "sem-catalogo";
      const group = map.get(key) || {
        catalogoBemId: key,
        catalogoDescricao: b.catalogoDescricao || "Sem catálogo",
        items: [],
      };
      group.items.push(b);
      map.set(key, group);
    }
    return Array.from(map.values()).sort((a, b) => a.catalogoDescricao.localeCompare(b.catalogoDescricao));
  }, [bensSalaQuery.data]);

  const contagemByTombamento = useMemo(() => {
    const map = new Map();
    for (const c of contagensSalaQuery.data || []) {
      if (c.numeroTombamento) map.set(c.numeroTombamento, c);
    }
    return map;
  }, [contagensSalaQuery.data]);

  const forasteiroByTombamento = useMemo(() => {
    const map = new Map();
    for (const c of forasteirosEventoQuery.data || []) {
      if (c.numeroTombamento) map.set(c.numeroTombamento, c);
    }
    return map;
  }, [forasteirosEventoQuery.data]);

  const pendingByTombamento = useMemo(() => {
    const map = new Map();
    const salaKey = normalizeRoomKey(salaEncontrada);
    const evId = selectedEventoIdFinal;
    for (const it of offline.items || []) {
      if (!evId || it.eventoInventarioId !== evId) continue;
      if (normalizeRoomKey(it.salaEncontrada) !== salaKey) continue;
      if (it.numeroTombamento) map.set(it.numeroTombamento, it);
    }
    return map;
  }, [offline.items, salaEncontrada, selectedEventoIdFinal]);

  const pendingAnyByTombamento = useMemo(() => {
    const map = new Map();
    const evId = selectedEventoIdFinal;
    for (const it of offline.items || []) {
      if (!evId || it.eventoInventarioId !== evId) continue;
      if (it.numeroTombamento) map.set(it.numeroTombamento, it);
    }
    return map;
  }, [offline.items, selectedEventoIdFinal]);

  const foundSet = useMemo(() => {
    const s = new Set();
    for (const t of contagemByTombamento.keys()) s.add(t);
    for (const t of forasteiroByTombamento.keys()) s.add(t);
    for (const t of pendingByTombamento.keys()) s.add(t);
    for (const t of pendingAnyByTombamento.keys()) s.add(t);
    return s;
  }, [contagemByTombamento, forasteiroByTombamento, pendingAnyByTombamento, pendingByTombamento]);

  function getConferenciaMeta(bem) {
    const t = bem?.numeroTombamento || null;
    if (!t) return { encontrado: false, divergente: false, fonte: null };
    const salaAtualKey = normalizeRoomKey(salaEncontrada);

    const c = contagemByTombamento.get(t);
    if (c) {
      return {
        encontrado: true,
        divergente: c.tipoOcorrencia === "ENCONTRADO_EM_LOCAL_DIVERGENTE",
        fonte: "SERVIDOR",
      };
    }

    const cAny = forasteiroByTombamento.get(t);
    if (cAny) {
      const encontradoEmOutraSala = normalizeRoomKey(cAny.salaEncontrada) !== salaAtualKey;
      return {
        encontrado: true,
        divergente: true,
        fonte: encontradoEmOutraSala ? "SERVIDOR_OUTRA_SALA" : "SERVIDOR",
      };
    }

    const p = pendingByTombamento.get(t);
    if (p) {
      const unidadeEncontrada = Number(p.unidadeEncontradaId);
      const unidadeDona = Number(bem.unidadeDonaId);
      const localDonoId = bem?.localId != null ? String(bem.localId) : null;
      const localEncontradoId = p?.localEncontradoId != null ? String(p.localEncontradoId) : null;
      const divergenciaUnidade = Number.isInteger(unidadeEncontrada) && Number.isInteger(unidadeDona) ? unidadeEncontrada !== unidadeDona : false;
      const divergenciaSala = localDonoId && localEncontradoId
        ? localDonoId !== localEncontradoId
        : normalizeRoomLabel(bem?.localFisico) !== "" && normalizeRoomLabel(p?.salaEncontrada) !== ""
          ? normalizeRoomLabel(bem?.localFisico) !== normalizeRoomLabel(p?.salaEncontrada)
          : false;
      return {
        encontrado: true,
        divergente: divergenciaUnidade || divergenciaSala,
        fonte: "PENDENTE",
      };
    }

    const pAny = pendingAnyByTombamento.get(t);
    if (pAny) {
      const unidadeEncontrada = Number(pAny.unidadeEncontradaId);
      const unidadeDona = Number(bem.unidadeDonaId);
      const localDonoId = bem?.localId != null ? String(bem.localId) : null;
      const localEncontradoId = pAny?.localEncontradoId != null ? String(pAny.localEncontradoId) : null;
      const divergenciaUnidade = Number.isInteger(unidadeEncontrada) && Number.isInteger(unidadeDona) ? unidadeEncontrada !== unidadeDona : false;
      const divergenciaSalaById = localDonoId && localEncontradoId ? localDonoId !== localEncontradoId : false;
      const divergenciaSalaByNome = normalizeRoomKey(pAny.salaEncontrada) !== salaAtualKey;
      return {
        encontrado: true,
        divergente: divergenciaUnidade || divergenciaSalaById || divergenciaSalaByNome,
        fonte: "PENDENTE_OUTRA_SALA",
      };
    }

    return { encontrado: false, divergente: false, fonte: null };
  }

  const filteredGrouped = useMemo(() => {
    return filterExpectedAssetGroups(grouped, expectedAssetsFilter, getConferenciaMeta);
  }, [
    grouped,
    expectedAssetsFilter,
    contagemByTombamento,
    forasteiroByTombamento,
    pendingByTombamento,
    pendingAnyByTombamento,
    salaEncontrada,
  ]);

  const canRegister = Boolean(
    selectedEventoIdFinal &&
    !eventoSelecionadoIncompativel &&
    salaEncontrada.trim().length >= 2 &&
    selectedLocalId &&
    String(selectedLocalId).trim() !== "" &&
    unidadeEncontradaId &&
    Number(unidadeEncontradaId) >= 1 &&
    Number(unidadeEncontradaId) <= 4 &&
    (!localIdsPermitidosEvento || localIdsPermitidosEvento.has(String(selectedLocalId))) &&
    (modoContagemEvento === "PADRAO" || Boolean(sessaoContagem?.designado || (rodadaSelecionada === "DESEMPATE" && sessaoContagem?.podeDesempate))),
  );

  const canRegisterTerceiro = Boolean(
    canRegister &&
    terceiroDescricao.trim().length >= 3 &&
    terceiroProprietario.trim().length >= 3,
  );

  const canRegisterNaoIdentificado = Boolean(
    canRegister &&
    naoIdDescricao.trim().length >= 3 &&
    naoIdLocalizacao.trim().length >= 3 &&
    naoIdFotoBase64
  );

  const handleFotoNaoId = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12_000_000) {
      setUiError("A foto é muito grande. Escolha uma imagem menor (max ~12MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setNaoIdFotoBase64(String(ev.target.result));
    reader.readAsDataURL(file);
  };

  const onRegistrarNaoIdentificado = async (e) => {
    e.preventDefault();
    setUiError(null);
    setNaoIdStatus(null);

    const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : "";
    if (!perfilIdFinal) {
      setUiError("Informe um perfilId (UUID) para registrar bem não identificado.");
      return;
    }

    if (!canRegisterNaoIdentificado) {
      setUiError("Preencha descrição, localização exata e tire/envie uma foto.");
      return;
    }

    registrarNaoIdentificadoMut.reset();
    registrarNaoIdentificadoMut.mutate({
      eventoInventarioId: selectedEventoIdFinal,
      unidadeEncontradaId: Number(unidadeEncontradaId),
      salaEncontrada: salaEncontrada.trim(),
      descricao: naoIdDescricao.trim(),
      localizacaoExata: naoIdLocalizacao.trim(),
      base64Data: naoIdFotoBase64,
    });
  };

  const onRegistrarBemTerceiro = async (e) => {
    e.preventDefault();
    setUiError(null);
    setTerceiroStatus(null);

    const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : "";
    if (!perfilIdFinal) {
      setUiError("Informe um perfilId (UUID) para registrar bem de terceiro.");
      return;
    }

    if (!canRegisterTerceiro) {
      setUiError("Preencha descrição e proprietário do bem de terceiro.");
      return;
    }

    registrarBemTerceiroMut.reset();
    registrarBemTerceiroMut.mutate({
      eventoInventarioId: selectedEventoIdFinal,
      unidadeEncontradaId: Number(unidadeEncontradaId),
      salaEncontrada: salaEncontrada.trim(),
      encontradoPorPerfilId: perfilIdFinal,
      descricao: terceiroDescricao.trim(),
      proprietarioExterno: terceiroProprietario.trim(),
      identificadorExterno: terceiroIdentificador.trim() || undefined,
      observacoes: "UI: registro de bem de terceiro durante inventário.",
    });
  };

  const handleScanValue = async (rawValue, options = {}) => {
    setUiError(null);
    setScanFeedback(null);

    if (!canRegister) {
      setUiError("Selecione evento ativo, unidade encontrada e endereço antes de registrar.");
      return;
    }
    if (eventoSelecionadoIncompativel) {
      setUiError("O evento selecionado não corresponde a unidade encontrada informada.");
      return;
    }

    const numeroTombamento = normalizeTombamentoInput(rawValue);

    if (TOMBAMENTO_4_DIGITS_RE.test(numeroTombamento)) {
      setTagIdModal({ isOpen: true, value: numeroTombamento, type: null, fromCamera: Boolean(options?.fromCamera) });
      return;
    }

    if (!TOMBAMENTO_RE.test(numeroTombamento)) {
      setUiError("Tombamento inválido. Use 10 dígitos (ex.: 1290001788) ou 4 dígitos (ex.: 1260 ou 2657).");
      return;
    }

    await processScan(numeroTombamento, null, options);
  };

  const registerScan = async (event) => {
    event.preventDefault();
    await handleScanValue(scannerValue);
    focusScannerInput();
  };

  const handleScannerInputKeyDown = (event) => {
    const key = String(event.key || "");
    const lower = key.toLowerCase();
    const isCtrlJ = event.ctrlKey && !event.altKey && !event.metaKey && lower === "j";
    const isSubmitKey = key === "Enter" || key === "Tab" || isCtrlJ;
    if (!isSubmitKey) return;
    event.preventDefault();
    event.stopPropagation();
    void registerScan(event);
  };

  const processScan = async (numeroTombamento, tipoBusca = null, options = {}) => {
    setUiError(null);
    setScanFeedback(null);
    const unidadeEncontrada = Number(unidadeEncontradaId);
    const localEncontradoId = selectedLocalId ? String(selectedLocalId).trim() : "";
    const salaAtual = salaEncontrada.trim();
    let bem = shouldHideExpectedData ? null : (bemByTombamento.get(numeroTombamento) || null);
    let lookupItems = [];

    // Scanner hibrido: se o tombo não estiver no catalogo do endereço carregado, tenta lookup rapido no backend (quando online).
    const shouldLookupBem = navigator.onLine && (!shouldHideExpectedData || Boolean(tipoBusca));
    if (!bem && shouldLookupBem) {
      try {
        const lookup = await listarBens({
          numeroTombamento,
          limit: tipoBusca ? 10 : 1,
          offset: 0,
          incluirTerceiros: false,
          tipoBusca,
        });
        lookupItems = lookup.items || [];
        bem = lookupItems[0] || null;
      } catch (_error) {
        // Falha de lookup não impede enfileirar o scan.
      }
    }

    if (tipoBusca && lookupItems.length > 1) {
      const candidatos = lookupItems
        .slice(0, 5)
        .map((x) => x.numeroTombamento)
        .filter(Boolean)
        .join(", ");
      setUiError(
        `Codigo "${numeroTombamento}" encontrou ${lookupItems.length} patrimonios (${candidatos}${lookupItems.length > 5 ? ", ..." : ""}). Informe os 10 digitos.`,
      );
      setScannerValue("");
      return;
    }

    if (tipoBusca && !bem) {
      if (!navigator.onLine) {
        setUiError("Sem conexao para resolver etiqueta de 4 digitos. Conecte-se para identificar se e etiqueta azul ou sufixo de etiqueta nova.");
      } else {
        setUiError(`Nenhum bem encontrado para a etiqueta ${tipoBusca === "antigo" ? "antiga" : "nova"} "${numeroTombamento}".`);
      }
      setScannerValue("");
      return;
    }

    const finalTombamento = bem?.numeroTombamento || numeroTombamento;
    const resumoLido = bem?.nomeResumo || bem?.descricao || bem?.descricaoComplementar || bem?.catalogoDescricao || "Sem nome resumo cadastrado.";
    const rodadaSync = modoContagemEvento === "PADRAO" ? "A" : (rodadaSelecionada || "A");
    const scanKey = [selectedEventoIdFinal, rodadaSync, localEncontradoId || normalizeRoomKey(salaAtual), finalTombamento].join("|");
    const now = Date.now();
    const lastScanAt = scanCooldownRef.current.get(scanKey);
    if (lastScanAt && now - lastScanAt < 1200) {
      playAlertBeep();
      setScanFeedback({
        kind: "warn",
        message: `${finalTombamento} ja foi capturado agora. Afaste a camera para evitar leitura repetida.`,
      });
      setScannerValue("");
      return;
    }

    const alreadyFromServer = contagemByTombamento.get(finalTombamento);
    const alreadyPending = pendingByTombamento.get(finalTombamento);
    const alreadyInSession = scannedSessionRef.current.has(scanKey);
    if (alreadyFromServer || alreadyPending || alreadyInSession) {
      playAlertBeep();
      scanCooldownRef.current.set(scanKey, now);
      setScanFeedback({
        kind: "warn",
        message: `${finalTombamento} ja foi lido neste endereço.`,
      });
      setScannerValue("");
      return;
    }

    const unidadeDonaId = bem?.unidadeDonaId != null ? Number(bem.unidadeDonaId) : null;
    const localEsperadoId = bem?.localId != null ? String(bem.localId) : null;
    const localEsperadoNome = localEsperadoId
      ? (locaisQuery.data || []).find((l) => String(l.id) === localEsperadoId)?.nome || bem?.localFisico || null
      : bem?.localFisico || null;
    const divergenciaUnidade = shouldHideExpectedData
      ? false
      : (Number.isInteger(unidadeDonaId) ? unidadeDonaId !== unidadeEncontrada : false);
    const divergenciaSala = shouldHideExpectedData
      ? false
      : (
        localEsperadoId && localEncontradoId
          ? localEsperadoId !== localEncontradoId
          : normalizeRoomLabel(localEsperadoNome) !== "" && normalizeRoomLabel(salaAtual) !== ""
            ? normalizeRoomLabel(localEsperadoNome) !== normalizeRoomLabel(salaAtual)
            : false
      );
    const divergente = divergenciaUnidade || divergenciaSala;

    // Regra legal: divergencia de local deve gerar ocorrencia sem trocar carga no inventario.
    // Art. 185 (AN303_Art185).
    if (divergente && !shouldHideExpectedData) {
      playAlertBeep();
      setDivergenteAlertItem({
        numeroTombamento: finalTombamento,
        salaEncontrada: salaAtual,
        salaEsperada: localEsperadoNome,
        unidadeDonaId: bem?.unidadeDonaId || null,
        unidadeEncontradaId: unidadeEncontrada,
        divergenciaUnidade,
        divergenciaSala,
      });
    }

    const observacoes = (!shouldHideExpectedData && divergente)
      ? [
        divergenciaUnidade ? "Divergencia de unidade detectada na leitura." : null,
        divergenciaSala ? "Divergencia de endereço detectada na leitura." : null,
      ].filter(Boolean).join(" ")
      : null;
    const payload = {
      id: crypto.randomUUID(),
      eventoInventarioId: selectedEventoIdFinal,
      rodada: rodadaSync,
      unidadeEncontradaId: unidadeEncontrada,
      salaEncontrada: salaAtual,
      localEncontradoId: localEncontradoId || undefined,
      encontradoPorPerfilId: auth.perfil?.id ? String(auth.perfil.id).trim() : null,
      numeroTombamento: finalTombamento,
      encontradoEm: new Date().toISOString(),
      observacoes,
      metaBusca: tipoBusca ? { tipoBusca, valorOriginal: numeroTombamento } : undefined,
    };

    scannedSessionRef.current.add(scanKey);
    scanCooldownRef.current.set(scanKey, now);
    await offline.enqueue(payload);
    setScannerValue("");
    saveInventoryUiState({
      salaEncontrada,
      unidadeEncontradaId,
      selectedLocalId,
      selectedEventoId: selectedEventoIdFinal,
    });
    const statusLabel = shouldHideExpectedData
      ? "Registrado"
      : divergente
        ? `Divergente${divergenciaSala ? " de endereço" : ""}${divergenciaUnidade ? `${divergenciaSala ? " e" : " de"} unidade` : ""}`
        : "Conforme";
    setScanFeedback({
      kind: shouldHideExpectedData ? "success" : (divergente ? "warn" : "success"),
      message: shouldHideExpectedData ? `${finalTombamento} registrado.` : `${finalTombamento} ${statusLabel}.`,
    });
    if (options?.fromCamera) {
      showCameraScanPreview(finalTombamento, resumoLido, scannerMode);
    }
    if (shouldHideExpectedData || !divergente) playSuccessBeep();

    setLastScans((prev) => [
      {
        id: payload.id,
        numeroTombamento: finalTombamento,
        divergente: shouldHideExpectedData ? false : divergente,
        divergenciaEndereço: shouldHideExpectedData ? false : divergenciaSala,
        divergenciaUnidade: shouldHideExpectedData ? false : divergenciaUnidade,
        unidadeDonaId: bem?.unidadeDonaId || null,
        unidadeEncontradaId: unidadeEncontrada,
        salaEsperada: shouldHideExpectedData ? null : localEsperadoNome,
        statusLabel,
        when: new Date().toLocaleString(),
      },
      ...prev,
    ].slice(0, 8));

  if (navigator.onLine) {
      await offline.syncNow();
      await contagensSalaQuery.refetch();
      await forasteirosEventoQuery.refetch();
    }
  };

  const papelSessaoLabel = sessaoContagem?.papel ? String(sessaoContagem.papel).replaceAll("_", " ") : "";
  const totalEsperadosEndereco = (bensSalaQuery.data || []).length;
  const totalConferidosEndereco = totalEsperadosEndereco
    ? (bensSalaQuery.data || []).reduce((acc, bem) => acc + (foundSet.has(bem.numeroTombamento) ? 1 : 0), 0)
    : 0;
  const totalDivergentesEndereco = totalEsperadosEndereco
    ? (bensSalaQuery.data || []).reduce((acc, bem) => {
      const meta = getConferenciaMeta(bem);
      return acc + (meta.encontrado && meta.divergente ? 1 : 0);
    }, 0)
    : 0;
  const totalFaltantesEndereco = Math.max(0, totalEsperadosEndereco - totalConferidosEndereco);
  const roomPendingOfflineCount = (offline.items || []).filter((item) =>
    item?.eventoInventarioId === selectedEventoIdFinal &&
    normalizeRoomKey(item?.salaEncontrada) === normalizeRoomKey(salaEncontrada)
  ).length;
  const canRegisterHint = !selectedEventoIdFinal
    ? "Abra ou selecione um evento em andamento."
    : eventoSelecionadoIncompativel
      ? "O evento atual não é compatível com a unidade encontrada selecionada."
      : !unidadeEncontradaId
        ? "Selecione a unidade encontrada."
        : !selectedLocalId
          ? "Selecione o local cadastrado do endereço."
          : !salaEncontrada.trim()
            ? "Confirme o endereço operacional."
            : modoContagemEvento !== "PADRAO" && !sessaoContagem?.designado && !(rodadaSelecionada === "DESEMPATE" && sessaoContagem?.podeDesempate)
              ? "Seu usuário não está designado para esta rodada."
              : null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="font-[Space_Grotesk] text-2xl font-semibold text-slate-900">Inventário - Contagem</h2>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operação patrimonial</p>
          <p className="text-sm text-slate-600">
            Fluxo operacional para leitura por endereço com persistência local e sincronização determinística.
          </p>
        </div>
        <div className="hidden">
          <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Modo Inventário (offline-first)</h2>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Operação patrimonial</p>
          <p className="mt-2 text-sm text-slate-600">
            Fluxo operacional para leitura por endereço com persistência local e sincronização determinística.
          </p>
        </div>
        <div className="hidden text-xs text-slate-600">
          <p>
            Pendentes offline:{" "}
            <span className="font-semibold text-violet-700">{offline.pendingCount}</span>
          </p>
          <p className="mt-1">
            Conexao:{" "}
            <span className={navigator.onLine ? "text-emerald-700" : "text-amber-800"}>
              {navigator.onLine ? "ONLINE" : "OFFLINE"}
            </span>
          </p>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <ModeBadge mode={modoContagemEvento} />
        <StatusBadge tone={navigator.onLine ? "success" : "warn"}>
          {navigator.onLine ? "Online" : "Offline"}
        </StatusBadge>
        <StatusBadge tone={eventoSelecionadoIncompativel ? "danger" : selectedEventoIdFinal ? "success" : "warn"}>
          {eventoSelecionadoIncompativel ? "Evento incompatível" : selectedEventoIdFinal ? "Evento aplicado" : "Sem evento"}
        </StatusBadge>
        <StatusBadge tone={offline.pendingCount ? "warn" : "success"}>
          Pendentes offline: {offline.pendingCount}
        </StatusBadge>
      </div>

      {presetOriginLabel ? (
        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
            Contexto aplicado de {presetOriginLabel}
          </p>
          <p className="mt-1 text-sm text-violet-900">
            {presetOriginContext || "Os filtros de evento, unidade e endereço foram carregados a partir da navegação operacional."}
          </p>
        </div>
      ) : null}

      {uiReduzida ? (
        <div className="mt-4">
          <BlindModeBanner mode={modoContagemEvento} roleLabel={papelSessaoLabel} rodada={modoContagemEvento !== "PADRAO" ? rodadaSelecionada : ""} />
        </div>
      ) : null}

      {(uiError || offline.lastError) && (
        <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-200/10 p-3 text-sm text-rose-700">
          {uiError || offline.lastError}
        </p>
      )}

      {scanFeedback && (
        <p
          className={`mt-4 rounded-xl border p-3 text-sm ${
            scanFeedback.kind === "success"
              ? "border-emerald-300/30 bg-emerald-200/10 text-emerald-700"
              : "border-amber-300/30 bg-amber-200/10 text-amber-800"
          }`}
        >
          {scanFeedback.message}
        </p>
      )}

      <InventoryCountContextCard
        eventCode={eventoAtivo?.codigoEvento || "Sem evento"}
        eventHelper={selectedEventoIdFinal ? `${formatModeLabel(modoContagemEvento)} / ${eventoAtivo?.escopoTipo || "UNIDADE"}` : "Abra um evento na Administração do Inventário."}
        eventTone={selectedEventoIdFinal ? "success" : "warn"}
        showRound={modoContagemEvento !== "PADRAO"}
        roundValue={rodadaSelecionada}
        roundHelper={papelSessaoLabel || "Rodada operacional"}
        unitValue={unidadeEncontradaId ? formatUnidade(Number(unidadeEncontradaId)) : "Aguardando seleção"}
        unitTone={unidadeEncontradaId ? "success" : "warn"}
        localValue={(locaisOptions || []).find((l) => String(l.id) === String(selectedLocalId))?.nome || "Aguardando seleção"}
        localHelper={localIdsPermitidosEvento ? "Escopo restrito pelos locais do evento." : "Endereço padronizado cadastrado pelo Admin."}
        localTone={selectedLocalId ? "success" : "warn"}
        roomValue={salaEncontrada || "Aguardando seleção"}
        roomHelper={selectedLocalId ? "Sincronizado automaticamente com o local escolhido." : "Será preenchido quando o local for selecionado."}
        roomTone={salaEncontrada ? "success" : "warn"}
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <InventoryPrimaryReadPanel
          canRegister={canRegister}
          canRegisterHint={canRegisterHint}
          roomPendingOfflineCount={roomPendingOfflineCount}
          selectedEventoId={selectedEventoId}
          setSelectedEventoId={setSelectedEventoId}
          eventos={eventosQuery.data || []}
          selectedEventoIdFinal={selectedEventoIdFinal}
          eventoAtivo={eventoAtivo}
          formatModeLabel={formatModeLabel}
          modoContagemEvento={modoContagemEvento}
          eventoSelecionadoIncompativel={eventoSelecionadoIncompativel}
          sessaoContagemLoading={sessaoContagemQuery.isLoading}
          sessaoDesignado={sessaoContagem?.designado}
          rodadaSelecionada={rodadaSelecionada}
          setRodadaSelecionada={setRodadaSelecionada}
          rodadasPermitidas={rodadasPermitidas}
          podeDesempate={sessaoContagem?.podeDesempate}
          unidadeEncontradaId={unidadeEncontradaId}
          setUnidadeEncontradaId={setUnidadeEncontradaId}
          formatUnidade={formatUnidade}
          selectedLocalId={selectedLocalId}
          setSelectedLocalId={setSelectedLocalId}
          locaisOptions={locaisOptions || []}
          locaisLoading={locaisQuery.isFetching}
          localIdsPermitidosEvento={localIdsPermitidosEvento}
          setSalaEncontrada={setSalaEncontrada}
          registerScan={registerScan}
          scannerInputRef={scannerInputRef}
          scannerValue={scannerValue}
          setScannerValue={setScannerValue}
          normalizeTombamentoInput={normalizeTombamentoInput}
          handleScannerInputKeyDown={handleScannerInputKeyDown}
          scannerMode={scannerMode}
          setScannerMode={setScannerMode}
          setShowScanner={setShowScanner}
          salaEncontrada={salaEncontrada}
          showScanner={showScanner}
          cameraScanPreview={cameraScanPreview}
          handleScanValue={handleScanValue}
          lastScans={lastScans}
        />
        <div className="flex flex-col gap-4">
          <InventoryAddressOverviewCard
            accentClassName={uiReduzida ? "border-amber-200" : "border-slate-200"}
            expectedValue={shouldHideExpectedData ? "Oculto no modo cego" : totalEsperadosEndereco}
            expectedHelper={shouldHideExpectedData ? "Painéis de esperado permanecem ocultos por regra operacional." : "Itens vinculados ao local cadastrado."}
            expectedTone={shouldHideExpectedData ? "warn" : "default"}
            countedValue={shouldHideExpectedData ? "Oculto" : totalConferidosEndereco}
            countedHelper={shouldHideExpectedData ? "Resumo reduzido enquanto a contagem cega estiver ativa." : "Bens já localizados neste endereço."}
            countedTone={shouldHideExpectedData ? "warn" : "success"}
            divergencesValue={totalDivergentesEndereco}
            divergencesTone={totalDivergentesEndereco ? "danger" : "default"}
            missingValue={shouldHideExpectedData ? "Oculto" : totalFaltantesEndereco}
            missingHelper={shouldHideExpectedData ? "Oculto no modo cego." : "Esperados ainda não conferidos."}
            missingTone={shouldHideExpectedData ? "warn" : totalFaltantesEndereco ? "warn" : "success"}
          />
          {!uiReduzida ? <InventoryProgress eventoInventarioId={selectedEventoIdFinal} /> : null}
        </div>
      </div>

      {!uiReduzida ? (
        <InventoryDivergencesPanel
          salaEncontrada={salaEncontrada}
          contagens={contagensSalaQuery.data || []}
          offlineItems={offline.items || []}
          bensSala={bensSalaQuery.data || []}
          eventoInventarioId={selectedEventoIdFinal}
          formatUnidade={formatUnidade}
          getFotoUrl={getFotoUrl}
        />
      ) : null}

      <InventoryExceptionPanels
        canRegisterTerceiro={canRegisterTerceiro}
        onRegistrarBemTerceiro={onRegistrarBemTerceiro}
        terceiroDescricao={terceiroDescricao}
        setTerceiroDescricao={setTerceiroDescricao}
        terceiroProprietario={terceiroProprietario}
        setTerceiroProprietario={setTerceiroProprietario}
        terceiroIdentificador={terceiroIdentificador}
        setTerceiroIdentificador={setTerceiroIdentificador}
        registrarBemTerceiroMut={registrarBemTerceiroMut}
        terceiroStatus={terceiroStatus}
        canRegisterNaoIdentificado={canRegisterNaoIdentificado}
        onRegistrarNaoIdentificado={onRegistrarNaoIdentificado}
        naoIdDescricao={naoIdDescricao}
        setNaoIdDescricao={setNaoIdDescricao}
        naoIdLocalizacao={naoIdLocalizacao}
        setNaoIdLocalizacao={setNaoIdLocalizacao}
        handleFotoNaoId={handleFotoNaoId}
        naoIdFotoBase64={naoIdFotoBase64}
        registrarNaoIdentificadoMut={registrarNaoIdentificadoMut}
        naoIdStatus={naoIdStatus}
        selectedEventoIdFinal={selectedEventoIdFinal}
        salaEncontrada={salaEncontrada}
        isOnline={navigator.onLine}
        terceirosSalaLoading={terceirosSalaQuery.isFetching}
        terceirosSalaItems={terceirosSalaQuery.data || []}
      />

      {!shouldHideExpectedData ? (
        <InventoryExpectedAssetsPanel
          expectedAssetsFilter={expectedAssetsFilter}
          setExpectedAssetsFilter={setExpectedAssetsFilter}
          totalEsperadosEndereco={totalEsperadosEndereco}
          totalConferidosEndereco={totalConferidosEndereco}
          totalFaltantesEndereco={totalFaltantesEndereco}
          bensSalaItems={bensSalaQuery.data || []}
          bensSalaLoading={bensSalaQuery.isFetching}
          bensSalaError={bensSalaQuery.error}
          showItemPhotoList={showItemPhotoList}
          setShowItemPhotoList={setShowItemPhotoList}
          showCatalogPhotoList={showCatalogPhotoList}
          setShowCatalogPhotoList={setShowCatalogPhotoList}
          isOnline={navigator.onLine}
          salaEncontrada={salaEncontrada}
          filteredGrouped={filteredGrouped}
          foundSet={foundSet}
          getConferenciaMeta={getConferenciaMeta}
          formatUnidade={formatUnidade}
          getFotoUrl={getFotoUrl}
        />
      ) : null}

      {/* Modal Identificação Etiqueta 4 Dígitos */}
      {tagIdModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-2xl">
            <h3 className="font-[Space_Grotesk] text-xl font-bold text-slate-900">Identificar Etiqueta</h3>
            <p className="mt-4 text-slate-600">
              O código <span className="font-mono font-bold text-violet-700">"{tagIdModal.value}"</span> possui apenas 4 dígitos. Como deseja identificá-lo?
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  processScan(tagIdModal.value, "antigo", tagIdModal.fromCamera ? { fromCamera: true } : {});
                  setTagIdModal({ isOpen: false, value: "", type: null, fromCamera: false });
                  focusScannerInput();
                }}
                className="flex items-center justify-between rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left transition-colors hover:bg-violet-100"
              >
                <div>
                  <div className="font-bold text-violet-700">Etiqueta Antiga (Azul)</div>
                  <div className="text-xs text-slate-500">Código legado da 2ª Auditoria</div>
                </div>
                <div className="text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  processScan(tagIdModal.value, "novo", tagIdModal.fromCamera ? { fromCamera: true } : {});
                  setTagIdModal({ isOpen: false, value: "", type: null, fromCamera: false });
                  focusScannerInput();
                }}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100"
              >
                <div>
                  <div className="font-bold text-emerald-700">Etiqueta Nova (Erro)</div>
                  <div className="text-xs text-slate-500">Etiqueta GEAFIN impressa com erro (apenas sufixo)</div>
                </div>
                <div className="text-emerald-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setTagIdModal({ isOpen: false, value: "", type: null, fromCamera: false });
                setScannerValue("");
                focusScannerInput();
              }}
              className="mt-6 w-full rounded-xl py-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL ALERTA DIVERGÊNCIA */}
      {
        divergenteAlertItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-rose-300 bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3 text-rose-700">
                <svg className="h-10 w-10 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-xl font-bold uppercase tracking-wide">Atenção: Bem Divergente!</h2>
              </div>

              <p className="mb-4 text-base text-slate-800">
                O item <strong className="font-mono text-slate-900">{divergenteAlertItem.numeroTombamento}</strong> foi registrado em <strong>{divergenteAlertItem.salaEncontrada}</strong>.
                {divergenteAlertItem.divergenciaUnidade ? (
                  <>
                    {" "}Unidade de carga: <strong>{formatUnidade(Number(divergenteAlertItem.unidadeDonaId))}</strong>. Unidade encontrada:{" "}
                    <strong>{formatUnidade(Number(divergenteAlertItem.unidadeEncontradaId))}</strong>.
                  </>
                ) : null}
                {divergenteAlertItem.divergenciaSala ? (
                  <>
                    {" "}Endereço de carga: <strong>{divergenteAlertItem.salaEsperada || "não informada"}</strong>.
                  </>
                ) : null}
              </p>

              <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <p className="font-bold text-amber-800 uppercase">Não leve este item para outro local!</p>
                <p className="mt-2 text-sm text-amber-800/80 leading-relaxed">
                  Segundo o <strong>Art. 185 (ATN 303)</strong>, divergências constatadas in-loco de fato compõem o rol de Ocorrências (Disparidades).
                  O bem deverá permanecer obrigatoriamente neste local até o fim dos trabalhos, momento em que a fila de forasteiros possibilitará sua regularização por transferência.
                </p>
              </div>

              <button
                onClick={() => setDivergenteAlertItem(null)}
                className="w-full rounded-xl bg-rose-600 py-3 font-semibold text-white transition-colors hover:bg-rose-500 active:bg-rose-700"
              >
                Ciente. Vou manter este bem aqui.
              </button>
            </div>
          </div>
        )
      }
    </section >
  );
}

