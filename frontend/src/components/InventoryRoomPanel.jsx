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
import BarcodeScanner from "./BarcodeScanner.jsx";
import InventoryProgress from "./InventoryProgress.jsx";
import InventoryAddressOverviewCard from "./inventory/InventoryAddressOverviewCard.jsx";
import InventoryCountContextCard from "./inventory/InventoryCountContextCard.jsx";
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

function formatModeLabel(mode) {
  const normalized = String(mode || "PADRAO").toUpperCase();
  if (normalized === "DUPLO_CEGO") return "Duplo cego";
  if (normalized === "CEGO") return "Cego";
  return "Padrão";
}

function ModeBadge({ mode }) {
  const normalized = String(mode || "PADRAO").toUpperCase();
  const cls = normalized === "DUPLO_CEGO"
    ? "border-amber-300 bg-amber-50 text-amber-800"
    : normalized === "CEGO"
      ? "border-orange-300 bg-orange-50 text-orange-800"
      : "border-violet-300 bg-violet-50 text-violet-700";
  const presetOriginLabel = navigationPreset?.originLabel ? String(navigationPreset.originLabel) : "";
  const presetOriginContext = navigationPreset?.originContext ? String(navigationPreset.originContext) : "";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {formatModeLabel(normalized)}
    </span>
  );
}

function StatusBadge({ tone = "slate", children }) {
  const cls = tone === "success"
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : tone === "danger"
        ? "border-rose-300 bg-rose-50 text-rose-700"
        : "border-slate-300 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function DisclosureMetaBadge({ tone = "slate", children }) {
  const cls = tone === "danger"
    ? "border-rose-300 bg-rose-50 text-rose-700"
    : tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : tone === "support"
        ? "border-violet-300 bg-violet-50 text-violet-700"
        : tone === "success"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-300 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

function FilterChipButton({ tone = "slate", active = false, children, onClick }) {
  const activeCls = tone === "danger"
    ? "border-rose-300 bg-rose-100 text-rose-800 shadow-sm"
    : tone === "warning"
      ? "border-amber-300 bg-amber-100 text-amber-900 shadow-sm"
      : tone === "support"
        ? "border-violet-300 bg-violet-100 text-violet-800 shadow-sm"
        : tone === "success"
          ? "border-emerald-300 bg-emerald-100 text-emerald-800 shadow-sm"
          : "border-slate-300 bg-slate-100 text-slate-800 shadow-sm";
  const idleCls = tone === "danger"
    ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
    : tone === "warning"
      ? "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
      : tone === "support"
        ? "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
        : tone === "success"
          ? "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${active ? activeCls : idleCls}`}
    >
      {children}
    </button>
  );
}

function DisclosureCard({
  title,
  subtitle,
  tone = "neutral",
  defaultOpen = false,
  meta = null,
  children,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const shellCls = tone === "danger"
    ? "border-rose-200 bg-rose-50/40"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50/40"
      : tone === "support"
        ? "border-violet-200 bg-violet-50/30"
        : "border-slate-200 bg-white";
  const iconCls = tone === "danger"
    ? "bg-rose-100 text-rose-700"
    : tone === "warning"
      ? "bg-amber-100 text-amber-800"
      : tone === "support"
        ? "bg-violet-100 text-violet-700"
        : "bg-slate-100 text-slate-600";
  const chevronCls = isOpen ? "rotate-180" : "";

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className={`group rounded-2xl border shadow-sm ${shellCls} ${className}`.trim()}
    >
      <summary className="list-none cursor-pointer select-none p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconCls}`}>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm-.75 4.75a.75.75 0 011.5 0v3.19l2.28 2.28a.75.75 0 11-1.06 1.06L9.47 10.53a.75.75 0 01-.22-.53V6.75z" clipRule="evenodd" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              </div>
              {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {meta ? <div className="flex flex-wrap justify-end gap-2">{meta}</div> : null}
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
              <svg className={`h-4 w-4 transition-transform ${chevronCls}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.514a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        </div>
      </summary>
      <div className="border-t border-slate-200/80 px-4 pb-4 pt-4 md:px-5 md:pb-5">{children}</div>
    </details>
  );
}

function SectionCard({ title, subtitle = "", accent = "slate", actions = null, children, className = "" }) {
  const accentCls = accent === "violet"
    ? "border-violet-200"
    : accent === "amber"
      ? "border-amber-200"
      : accent === "rose"
        ? "border-rose-200"
        : "border-slate-200";
  return (
    <section className={`rounded-2xl border bg-white p-4 shadow-sm ${accentCls} ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-600">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoLine({ label, value, helper = null, tone = "default" }) {
  const valueCls = tone === "danger"
    ? "text-rose-700"
    : tone === "warn"
      ? "text-amber-800"
      : tone === "success"
        ? "text-emerald-700"
        : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${valueCls}`}>{value}</p>
      {helper ? <p className="mt-1 text-[11px] text-slate-500">{helper}</p> : null}
    </div>
  );
}

function BlindModeBanner({ mode, roleLabel, rodada }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">Contagem cega em andamento</p>
          <p className="mt-1 text-sm text-amber-900">
            Parte dos painéis foi ocultada para preservar a regra operacional do modo {formatModeLabel(mode)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {roleLabel ? <StatusBadge tone="warn">{roleLabel}</StatusBadge> : null}
          {rodada ? <StatusBadge tone="warn">Rodada {rodada}</StatusBadge> : null}
        </div>
      </div>
    </div>
  );
}

export default function InventoryRoomPanel({ navigationPreset = null }) {
  const qc = useQueryClient();
  const auth = useAuth();
  const offline = useOfflineSync();
  const appliedPresetNonceRef = useRef(null);
  const skipNextUnitResetRef = useRef(false);

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
        <article className="rounded-2xl border border-violet-200 bg-white p-3 shadow-sm md:p-4 lg:col-span-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Leitura principal</h3>
              <p className="mt-1 text-xs text-slate-600">
                Prepare o contexto e mantenha o foco na bipagem contínua do endereço atual.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <StatusBadge tone={canRegister ? "success" : "warn"}>
                {canRegister ? "Pronto para bipagem" : "Aguardando contexto"}
              </StatusBadge>
              <StatusBadge tone={roomPendingOfflineCount ? "warn" : "success"}>
                Fila do endereço: {roomPendingOfflineCount}
              </StatusBadge>
            </div>
          </div>
          <h3 className="font-semibold">Endereço e scanner</h3>
          <p className="mt-1 text-xs text-slate-600">
            Selecione o endereço e registre tombamentos. Divergencias tocam alerta e viram ocorrencia (Art. 185).
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-600">Evento ativo</span>
              <select
                value={selectedEventoId}
                onChange={(e) => setSelectedEventoId(String(e.target.value || ""))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">
                  {(eventosQuery.data || []).length
                    ? "Selecione um evento ativo"
                    : "Nenhum evento ativo em andamento"}
                </option>
                {(eventosQuery.data || []).map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {`${ev.codigoEvento || ev.id} - ${ev.modoContagem || "PADRAO"} - ${ev.escopoTipo || "UNIDADE"} - Unidade ${ev.unidadeInventariadaId ?? "GERAL"}`}
                  </option>
                ))}
              </select>
              {selectedEventoIdFinal ? (
                <p className="text-[11px] text-slate-500">
                  Evento aplicado: <strong>{eventoAtivo?.codigoEvento || selectedEventoIdFinal}</strong>{" "}
                  ({eventoAtivo?.modoContagem || "PADRAO"} / {eventoAtivo?.escopoTipo || "UNIDADE"} / unidade {eventoAtivo?.unidadeInventariadaId ?? "GERAL"}).
                </p>
              ) : (
                <p className="text-[11px] text-amber-700">
                  Abra um evento na aba de Administração do Inventário para iniciar a contagem.
                </p>
              )}
              {eventoSelecionadoIncompativel ? (
                <p className="text-[11px] text-rose-700">
                  Evento incompatível com a unidade encontrada selecionada. Escolha o evento da mesma unidade ou um evento GERAL.
                </p>
              ) : null}
              {modoContagemEvento !== "PADRAO" && !sessaoContagemQuery.isLoading && !sessaoContagem?.designado ? (
                <p className="text-[11px] text-rose-700">
                  Usuario não designado para este evento em modo {modoContagemEvento}. Solicite ao admin sua designacao.
                </p>
              ) : null}
            </label>
            {modoContagemEvento !== "PADRAO" ? (
              <label className="space-y-1">
                <span className="text-xs text-slate-600">Rodada</span>
                <select
                  value={rodadaSelecionada}
                  onChange={(e) => setRodadaSelecionada(String(e.target.value || "A"))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {rodadasPermitidas.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  {sessaoContagem?.podeDesempate ? <option value="DESEMPATE">DESEMPATE</option> : null}
                </select>
              </label>
            ) : null}
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Unidade encontrada (1..4)</span>
              <select
                value={unidadeEncontradaId}
                onChange={(e) => setUnidadeEncontradaId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                <option value="1">{formatUnidade(1)}</option>
                <option value="2">{formatUnidade(2)}</option>
                <option value="3">{formatUnidade(3)}</option>
                <option value="4">{formatUnidade(4)}</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-600">Local cadastrado (Admin)</span>
              <select
                value={selectedLocalId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedLocalId(id);
                  const local = (locaisOptions || []).find((l) => String(l.id) === String(id));
                  if (local?.nome) setSalaEncontrada(String(local.nome));
                }}
                disabled={!unidadeEncontradaId || locaisQuery.isFetching || !!(localIdsPermitidosEvento && !locaisOptions.length)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">
                  {!unidadeEncontradaId
                    ? "Selecione a unidade encontrada primeiro"
                    : locaisQuery.isFetching
                      ? "Carregando locais..."
                      : "Selecione um local"}
                </option>
                {(locaisOptions || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Este campo não e texto livre. O Admin cadastra os locais em "Operações API" (seção Locais).
              </p>
              {localIdsPermitidosEvento ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  Este evento esta em escopo LOCAIS: apenas os endereços selecionados no evento podem ser usados.
                </p>
              ) : null}
            </label>
          </div>

          <form onSubmit={registerScan} className="mt-4">
            <label className="block space-y-1 mb-2">
              <span className="text-xs text-slate-600">Bipar tombamento (10 dígitos)</span>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Leitura do tombamento</span>
              <span className="block text-xs text-slate-500">Leia 10 dígitos ou etiqueta de 4 dígitos para abrir a identificação.</span>
              <div className="grid gap-2 grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_auto]">
                <input
                  ref={scannerInputRef}
                  value={scannerValue}
                  onChange={(e) => setScannerValue(normalizeTombamentoInput(e.target.value))}
                  onKeyDown={handleScannerInputKeyDown}
                  placeholder="Ex.: 1290001788"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="off"
                  className="col-span-1 w-full rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-base font-semibold tracking-[0.08em] text-slate-900 shadow-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setScannerMode("single"); setShowScanner(true); }}
                    title="Câmera (Uma leitura)"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-violet-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScannerMode("continuous"); setShowScanner(true); }}
                    title="Câmera (Contínuo)"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-violet-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!canRegister}
                  className="col-span-2 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 md:col-span-1"
                >
                  Registrar
                </button>
              </div>
            </label>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <span className="block font-semibold">Endereço ativo</span>
                <span>{salaEncontrada || "Selecione um local cadastrado."}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <span className="block font-semibold">Status de registro</span>
                <span>{canRegister ? "Leitura liberada para este contexto." : canRegisterHint}</span>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="block font-semibold">Modo da câmera</span>
                <span>{scannerMode === "continuous" ? "Contínuo" : "Uma leitura por abertura"}</span>
              </div>
            </div>
          </form>

          {showScanner && (
            <BarcodeScanner
              continuous={scannerMode === "continuous"}
              scanPreview={cameraScanPreview}
              onClose={() => setShowScanner(false)}
              onScan={(decodedText) => {
                const cleaned = normalizeTombamentoInput(decodedText);
                if (cleaned.length === 10 || cleaned.length === 4) {
                  setScannerValue(cleaned);
                  // Simula o envio do formulário programaticamente (para engatilhar a mesma lógica de registerScan)
                  if (!canRegister) return;
                  if (scannerMode === "single") setShowScanner(false);

                  // Wrap in a setTimeout so the state update resolves before we submit the scan
                  setTimeout(() => {
                    handleScanValue(cleaned, { fromCamera: true });
                  }, 50);
                } else if (scannerMode === "single") {
                  // Manteve a varredura se estiver contínuo
                  setScannerValue(cleaned || decodedText);
                }
              }}
            />
          )}

          {lastScans.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-widest text-slate-500">Últimos registros</p>
                <span className="text-[11px] text-slate-500">Leituras recentes do operador</span>
              </div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Últimos registros</p>
              {lastScans.map((s) => (
                <div key={s.id} className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-slate-900">{s.numeroTombamento}</span>
                    <span className="text-slate-600">{s.when}</span>
                  </div>
                  <div className="mt-1 text-slate-600">
                    {s.divergente ? (
                      <span className="text-amber-800">
                        {s.statusLabel || "Divergente"}: dono={formatUnidade(Number(s.unidadeDonaId))} encontrado={formatUnidade(Number(s.unidadeEncontradaId))}
                        {s.divergenciaSala && s.salaEsperada ? ` | endereço esperado=${s.salaEsperada}` : ""}
                      </span>
                    ) : (
                      <span className="text-emerald-700">{s.statusLabel || "Conforme"}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
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
        <DivergencesPanel
          salaEncontrada={salaEncontrada}
          contagens={contagensSalaQuery.data || []}
          offlineItems={offline.items || []}
          bensSala={bensSalaQuery.data || []}
          eventoInventarioId={selectedEventoIdFinal}
        />
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <DisclosureCard
          title="Bem de terceiro"
          subtitle="Controle segregado, sem tombamento GEAFIN."
          tone="warning"
          meta={<DisclosureMetaBadge tone="warning">Exceção</DisclosureMetaBadge>}
          className="order-2"
        >
          <div className="mt-3 group-open:block">
            <form onSubmit={onRegistrarBemTerceiro} className="rounded-xl border border-amber-200 bg-white p-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                <p>
                  Sem tombamento GEAFIN. Regra: Art. 99/110 VI/175 IX (AN303_Art99 / AN303_Art110_VI / AN303_Art175_IX).
                </p>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs text-slate-600">Descrição</span>
                  <input
                    value={terceiroDescricao}
                    onChange={(e) => setTerceiroDescricao(e.target.value)}
                    placeholder="Ex.: Notebook do prestador de TI, impressora da empresa X..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-600">Proprietário externo</span>
                  <input
                    value={terceiroProprietario}
                    onChange={(e) => setTerceiroProprietario(e.target.value)}
                    placeholder="Ex.: Empresa Contratada XYZ"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-600">Identificador externo (opcional)</span>
                  <input
                    value={terceiroIdentificador}
                    onChange={(e) => setTerceiroIdentificador(e.target.value)}
                    placeholder="Ex.: ETIQ-000123 (ou deixe em branco)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="submit"
                  disabled={!canRegisterTerceiro || registrarBemTerceiroMut.isPending}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {registrarBemTerceiroMut.isPending ? "Registrando..." : "Registrar bem de terceiro"}
                </button>

                {terceiroStatus?.kind === "ok" ? (
                  <span className="text-xs text-emerald-700">Registrado.</span>
                ) : null}
              </div>

              {registrarBemTerceiroMut.error ? (
                <p className="mt-2 text-sm text-rose-700">
                  Falha ao registrar bem de terceiro: {String(registrarBemTerceiroMut.error?.message || "erro")}
                </p>
              ) : null}
            </form>
          </div>
        </DisclosureCard>

        <DisclosureCard
          title="Bem sem identificação"
          subtitle="Obrigatório foto e descrição detalhada."
          tone="danger"
          defaultOpen
          meta={[
            <DisclosureMetaBadge key="tipo" tone="danger">Divergência</DisclosureMetaBadge>,
            <DisclosureMetaBadge key="foto" tone={naoIdFotoBase64 ? "success" : "warning"}>
              {naoIdFotoBase64 ? "Foto anexada" : "Foto pendente"}
            </DisclosureMetaBadge>,
          ]}
          className="order-1"
        >
          <div className="mt-3 group-open:block">
            <form onSubmit={onRegistrarNaoIdentificado} className="rounded-xl border border-rose-200 bg-white p-4">
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                Obrigatório foto e descrição. Fica onde está. Art. 175 (AN303_Art175).
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs text-slate-600">Descrição detalhada do bem</span>
                  <input
                    value={naoIdDescricao}
                    onChange={(e) => setNaoIdDescricao(e.target.value)}
                    placeholder="Ex.: Cadeira giratória azul, marca Frisokar, sem braços..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-600">Localização exata</span>
                  <input
                    value={naoIdLocalizacao}
                    onChange={(e) => setNaoIdLocalizacao(e.target.value)}
                    placeholder="Ex.: Perto da janela, mesa 3..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-600">Fotografia (Obrigatória)</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFotoNaoId}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs file:mr-3 file:rounded-lg file:bg-slate-100 file:border-0 file:px-3 file:py-1 file:text-slate-800"
                  />
                </label>
                {naoIdFotoBase64 && (
                  <div className="md:col-span-2 mt-2">
                    <p className="text-xs text-emerald-700 mb-1 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      Foto anexada
                    </p>
                    <img src={naoIdFotoBase64} alt="Prévia" className="h-16 w-16 object-cover rounded-md border border-slate-300" />
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="submit"
                  disabled={!canRegisterNaoIdentificado || registrarNaoIdentificadoMut.isPending}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  {registrarNaoIdentificadoMut.isPending ? "Registrando..." : "Registrar bem sem identificação"}
                </button>

                {naoIdStatus?.kind === "ok" ? (
                  <span className="text-xs text-emerald-700">Adicionado às disparidades do endereço.</span>
                ) : null}
              </div>

              {registrarNaoIdentificadoMut.error ? (
                <p className="mt-2 text-sm text-rose-700">
                  Falha: {String(registrarNaoIdentificadoMut.error?.message || "erro interno")}
                </p>
              ) : null}
            </form>
          </div>
        </DisclosureCard>

        <DisclosureCard
          title="Terceiros registrados"
          subtitle="Lista já registrada neste endereço."
          tone="neutral"
          meta={[
            <DisclosureMetaBadge key="tipo" tone="neutral">Consulta</DisclosureMetaBadge>,
            !selectedEventoIdFinal || !salaEncontrada.trim()
              ? <DisclosureMetaBadge key="status" tone="neutral">Sem contexto</DisclosureMetaBadge>
              : !navigator.onLine
                ? <DisclosureMetaBadge key="status" tone="warning">Offline</DisclosureMetaBadge>
                : terceirosSalaQuery.isFetching
                  ? <DisclosureMetaBadge key="status" tone="support">Carregando</DisclosureMetaBadge>
                  : <DisclosureMetaBadge key="status" tone="neutral">Itens {(terceirosSalaQuery.data || []).length}</DisclosureMetaBadge>,
          ]}
          className="order-3 lg:col-span-2"
        >
          <div className="mt-3 group-open:block">
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                <p>
                  Fonte: `vw_bens_terceiros_inventario` (derivado de contagens). Controle segregado.
                </p>
              </div>

              {!selectedEventoIdFinal || !salaEncontrada.trim() ? (
                <p className="mt-3 text-sm text-slate-600">Selecione evento e endereço para listar os registros.</p>
              ) : !navigator.onLine ? (
                <p className="mt-3 text-sm text-slate-600">
                  Offline: a lista de bens de terceiros depende da API (os registros feitos offline ainda ficam na fila de sincronização).
                </p>
              ) : terceirosSalaQuery.isFetching ? (
                <p className="mt-3 text-sm text-slate-600">Carregando...</p>
              ) : (terceirosSalaQuery.data || []).length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">Nenhum bem de terceiro registrado para este endereço.</p>
              ) : (
                <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Identificador</th>
                        <th className="px-3 py-2">Descrição</th>
                        <th className="px-3 py-2">Proprietário</th>
                        <th className="px-3 py-2">Quando</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(terceirosSalaQuery.data || []).slice(0, 30).map((t) => (
                        <tr key={t.contagemId} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-800">
                            {t.identificadorExterno || "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-800">{t.descricao || "-"}</td>
                          <td className="px-3 py-2 text-slate-600">{t.proprietarioExterno || "-"}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {t.encontradoEm ? new Date(t.encontradoEm).toLocaleString("pt-BR") : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </DisclosureCard>
      </div>

      {!shouldHideExpectedData ? (
      <DisclosureCard
        title="Bens esperados do endereço"
        subtitle="Lista agrupada para apoio à conferência."
        tone="support"
        meta={[
          <FilterChipButton
            key="esperados"
            tone="support"
            active={expectedAssetsFilter === "ALL"}
            onClick={() => setExpectedAssetsFilter("ALL")}
          >
            Esperados {totalEsperadosEndereco}
          </FilterChipButton>,
          <FilterChipButton
            key="conferidos"
            tone="success"
            active={expectedAssetsFilter === "FOUND"}
            onClick={() => setExpectedAssetsFilter("FOUND")}
          >
            Conferidos {totalConferidosEndereco}
          </FilterChipButton>,
          <FilterChipButton
            key="faltantes"
            tone={totalFaltantesEndereco ? "warning" : "neutral"}
            active={expectedAssetsFilter === "MISSING"}
            onClick={() => setExpectedAssetsFilter("MISSING")}
          >
            Faltantes {totalFaltantesEndereco}
          </FilterChipButton>,
          bensSalaQuery.isFetching ? <DisclosureMetaBadge key="loading" tone="neutral">Carregando</DisclosureMetaBadge> : null,
        ].filter(Boolean)}
        className="mt-5"
      >
        <div className="rounded-xl border border-violet-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs text-slate-600">
              Itens carregados: <span className="font-semibold text-slate-900">{(bensSalaQuery.data || []).length}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showItemPhotoList}
                  onChange={(e) => setShowItemPhotoList(e.target.checked)}
                  className="h-4 w-4 accent-violet-600"
                />
                Mostrar foto do item
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showCatalogPhotoList}
                  onChange={(e) => setShowCatalogPhotoList(e.target.checked)}
                  className="h-4 w-4 accent-violet-600"
                />
                Mostrar foto do catálogo
              </label>
            </div>
          </div>

          {!navigator.onLine && (
            <p className="mt-2 text-[11px] text-slate-500">
              fonte: <span className="font-semibold text-slate-800">CACHE (offline)</span>
            </p>
          )}

          {bensSalaQuery.error && (
            <p className="mt-3 text-sm text-rose-700">Falha ao carregar bens para este local.</p>
          )}

          {!bensSalaQuery.isFetching && (bensSalaQuery.data || []).length === 0 && (
            <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm text-slate-800">
                Nenhum bem vinculado ao local <span className="font-semibold text-slate-900">"{salaEncontrada.trim()}"</span>.
              </p>
              <p className="text-xs text-slate-500">
                Aqui o inventário usa <code className="px-1">bens.local_id</code> (local cadastrado pelo Admin), não o texto do GEAFIN.
                Para aparecerem itens, um Admin deve vincular os bens a este local.
              </p>
            </div>
          )}

          {(bensSalaQuery.data || []).length > 0 ? (
            <p className="mt-3 text-xs text-slate-600">
              Filtro ativo:{" "}
              <span className="font-semibold text-slate-900">
                {expectedAssetsFilter === "FOUND"
                  ? "Conferidos"
                  : expectedAssetsFilter === "MISSING"
                    ? "Faltantes"
                    : "Esperados"}
              </span>
            </p>
          ) : null}

          <div className="mt-3 space-y-2">
            {filteredGrouped.length === 0 && (bensSalaQuery.data || []).length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                Nenhum item encontrado para o filtro selecionado neste endereço.
              </div>
            ) : null}
            {filteredGrouped.map((g) => (
              <details key={g.catalogoBemId} className="rounded-xl border border-slate-200 bg-white p-3">
                {(() => {
                  const total = g.items.length;
                  const encontrados = g.items.reduce((acc, b) => acc + (foundSet.has(b.numeroTombamento) ? 1 : 0), 0);
                  const faltantes = Math.max(0, total - encontrados);
                  const divergentes = g.items.reduce((acc, b) => {
                    const meta = getConferenciaMeta(b);
                    return acc + (meta.encontrado && meta.divergente ? 1 : 0);
                  }, 0);
                  return (
                    <summary className="cursor-pointer select-none">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                        <div className="flex flex-col">
                          <span>{g.items[0]?.nomeResumo || g.catalogoDescricao}</span>
                          {g.items[0]?.nomeResumo && g.items[0]?.nomeResumo !== g.catalogoDescricao && (
                            <span className="text-[10px] text-slate-500 font-normal italic">{g.catalogoDescricao}</span>
                          )}
                        </div>
                        <span className="text-xs font-normal text-slate-600 ml-auto">
                          Total: <span className="font-semibold text-slate-900">{total}</span>{" "}
                          | Encontrados: <span className="font-semibold text-emerald-700">{encontrados}</span>{" "}
                          | Divergentes: <span className="font-semibold text-rose-700">{divergentes}</span>{" "}
                          | Faltantes: <span className="font-semibold text-amber-800">{faltantes}</span>
                        </span>
                      </div>
                    </summary>
                  );
                })()}
                <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                  <ul className="divide-y divide-slate-200 bg-slate-50">
                    {g.items.slice(0, 200).map((b) => {
                      const meta = getConferenciaMeta(b);
                      const badge = meta.encontrado
                        ? meta.divergente
                          ? { text: "LOCAL_DIVERGENTE", cls: "border-rose-300/40 text-rose-700 bg-rose-200/10" }
                          : { text: "ENCONTRADO", cls: "border-emerald-300/40 text-emerald-700 bg-emerald-200/10" }
                        : { text: "FALTANTE", cls: "border-amber-300/40 text-amber-800 bg-amber-200/10" };

                      return (
                        <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={meta.encontrado}
                              readOnly
                              className="h-4 w-4 accent-violet-600"
                              title={meta.encontrado ? `Conferido (${meta.fonte})` : "Não conferido"}
                            />
                            <div className="flex flex-col items-start gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-900">{b.numeroTombamento || "-"}</span>
                                {b.cod2Aud && (
                                  <span className="rounded bg-violet-100 px-1 py-0.5 text-[9px] font-bold text-violet-700 border border-violet-300/40" title={`Etiqueta Azul: ${b.cod2Aud}`}>
                                    {b.cod2Aud}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 leading-tight">
                                {formatUnidade(Number(b.unidadeDonaId))} • {b.nomeResumo || "Sem resumo"}
                              </span>
                              {(showItemPhotoList || showCatalogPhotoList) && (
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  {showItemPhotoList && (
                                    b.fotoUrl ? (
                                      <a href={getFotoUrl(b.fotoUrl)} target="_blank" rel="noopener noreferrer">
                                        <img
                                          src={getFotoUrl(b.fotoUrl)}
                                          alt={`Foto item ${b.numeroTombamento || ""}`}
                                          className="h-10 w-10 rounded border border-slate-300 object-cover"
                                        />
                                      </a>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">Item sem foto</span>
                                    )
                                  )}
                                  {showCatalogPhotoList && (
                                    b.fotoReferenciaUrl ? (
                                      <a href={getFotoUrl(b.fotoReferenciaUrl)} target="_blank" rel="noopener noreferrer">
                                        <img
                                          src={getFotoUrl(b.fotoReferenciaUrl)}
                                          alt={`Foto catalogo ${b.codigoCatalogo || ""}`}
                                          className="h-10 w-10 rounded border border-slate-300 object-cover"
                                        />
                                      </a>
                                    ) : (
                                      <span className="text-[10px] text-slate-500">Catálogo sem foto</span>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          </label>
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badge.cls}`}>
                            {badge.text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        </div>
      </DisclosureCard>
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

function describeRowDivergence(row) {
  const unidadeDona = Number(row?.unidadeDonaId);
  const unidadeEncontrada = Number(row?.unidadeEncontradaId);
  const hasUnits = Number.isInteger(unidadeDona) && Number.isInteger(unidadeEncontrada);
  const unidadeDivergente = hasUnits ? unidadeDona !== unidadeEncontrada : false;

  const salaEsperada = String(row?.localEsperadoNome || row?.localEsperadoTexto || "").trim();
  const salaEncontrada = String(row?.salaEncontrada || "").trim();
  const salaDivergente = salaEsperada && salaEncontrada
    ? normalizeRoomLabel(salaEsperada) !== normalizeRoomLabel(salaEncontrada)
    : false;

  if (unidadeDivergente && salaDivergente) {
    return {
      badge: "UNIDADE + ENDEREÇO",
      badgeClass: "border-rose-300/40 bg-rose-200/10 text-rose-700",
      title: "Carga em unidade diferente e endereço divergente.",
      detail: `Esperado: ${salaEsperada}. Encontrado: ${salaEncontrada}.`,
    };
  }
  if (unidadeDivergente) {
    return {
      badge: "UNIDADE",
      badgeClass: "border-amber-300/40 bg-amber-200/10 text-amber-800",
      title: "Carga em unidade diferente.",
      detail: "",
    };
  }
  if (salaDivergente) {
    return {
      badge: "ENDEREÇO",
      badgeClass: "border-violet-300 bg-violet-100/10 text-violet-700",
      title: "Mesma unidade, mas endereço divergente.",
      detail: `Esperado: ${salaEsperada}. Encontrado: ${salaEncontrada}.`,
    };
  }
  return {
    badge: "REGISTRO",
    badgeClass: "border-slate-300 bg-slate-100 text-slate-800",
    title: "Divergencia registrada (sem detalhe de local esperado).",
    detail: salaEsperada ? `Endereço de referência: ${salaEsperada}.` : "",
  };
}

function DivergencesPanel({ salaEncontrada, contagens, offlineItems, bensSala, eventoInventarioId }) {
  const salaKey = normalizeRoomKey(salaEncontrada);
  const [showItemPhoto, setShowItemPhoto] = useState(false);
  const [showCatalogPhoto, setShowCatalogPhoto] = useState(false);

  const bemByTomb = useMemo(() => {
    const m = new Map();
    for (const b of bensSala || []) {
      if (b?.numeroTombamento) m.set(String(b.numeroTombamento), b);
    }
    return m;
  }, [bensSala]);

  const serverDivergences = useMemo(() => {
    const out = [];
    for (const c of contagens || []) {
      const isDivergente = c?.tipoOcorrencia === "ENCONTRADO_EM_LOCAL_DIVERGENTE" || c?.tipoOcorrencia === "BEM_NAO_IDENTIFICADO";
      if (!isDivergente) continue;
      if (normalizeRoomKey(c.salaEncontrada) !== salaKey) continue;
      if (c?.regularizacaoPendente === false) continue;
      out.push({
        fonte: "SERVIDOR",
        numeroTombamento: c.numeroTombamento,
        identificadorExterno: c.identificadorExterno,
        codigoCatalogo: c.codigoCatalogo,
        catalogoDescricao: c.catalogoDescricao,
        descricaoComplementar: c.descricaoComplementar,
        fotoUrl: c.fotoUrl,
        fotoReferenciaUrl: c.fotoReferenciaUrl,
        observacoes: c.observacoes,
        unidadeDonaId: c.unidadeDonaId,
        unidadeEncontradaId: c.unidadeEncontradaId,
        salaEncontrada: c.salaEncontrada,
        localEsperadoId: c.localEsperadoId,
        localEsperadoTexto: c.localEsperadoTexto,
        localEsperadoNome: c.localEsperadoNome,
        encontradoEm: c.encontradoEm,
      });
    }
    return out;
  }, [contagens, salaKey]);

  const pendingDivergences = useMemo(() => {
    const out = [];
    for (const it of offlineItems || []) {
      if (!eventoInventarioId || it.eventoInventarioId !== eventoInventarioId) continue;
      if (normalizeRoomKey(it.salaEncontrada) !== salaKey) continue;
      const b = it.numeroTombamento ? bemByTomb.get(String(it.numeroTombamento)) : null;
      const unidadeDonaId = b?.unidadeDonaId != null ? Number(b.unidadeDonaId) : null;
      const unidadeEncontradaId = it.unidadeEncontradaId != null ? Number(it.unidadeEncontradaId) : null;
      const localDonoId = b?.localId != null ? String(b.localId) : null;
      const localEncontradoId = it?.localEncontradoId != null ? String(it.localEncontradoId) : null;
      const divergenciaUnidade =
        Number.isInteger(unidadeDonaId) && Number.isInteger(unidadeEncontradaId) ? unidadeDonaId !== unidadeEncontradaId : false;
      const divergenciaSala = localDonoId && localEncontradoId ? localDonoId !== localEncontradoId : false;
      const divergente = divergenciaUnidade || divergenciaSala;
      if (!divergente) continue;
      out.push({
        fonte: "PENDENTE",
        numeroTombamento: it.numeroTombamento,
        codigoCatalogo: b?.codigoCatalogo || null,
        catalogoDescricao: b?.catalogoDescricao || null,
        fotoUrl: b?.fotoUrl || null,
        fotoReferenciaUrl: b?.fotoReferenciaUrl || null,
        unidadeDonaId,
        unidadeEncontradaId,
        salaEncontrada: it.salaEncontrada,
        localEsperadoId: b?.localId != null ? String(b.localId) : null,
        localEsperadoNome: b?.localFisico || null,
        observacoes: divergenciaSala && b?.localFisico ? `Endereço esperado: ${b.localFisico}` : undefined,
        encontradoEm: it.encontradoEm,
      });
    }
    return out;
  }, [offlineItems, eventoInventarioId, salaKey, bemByTomb]);

  const all = useMemo(() => {
    const map = new Map();
    for (const row of [...serverDivergences, ...pendingDivergences]) {
      const key = row.numeroTombamento ? String(row.numeroTombamento) : row.identificadorExterno;
      if (!key) continue;
      // Preferir servidor quando existir, para refletir persistencia real.
      const prev = map.get(key);
      if (!prev || prev.fonte === "PENDENTE") map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => String(b.encontradoEm || "").localeCompare(String(a.encontradoEm || "")));
  }, [serverDivergences, pendingDivergences]);

  if (!salaEncontrada.trim()) return null;

  return (
    <details className="mt-5 overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm" open>
      <summary className="list-none cursor-pointer select-none p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Divergências no endereço (Art. 185)</h3>
              <DisclosureMetaBadge tone={all.length ? "danger" : "neutral"}>Pendentes {all.length}</DisclosureMetaBadge>
            </div>
            <p className="mt-1 text-sm text-slate-600">Registre divergências sem transferir carga durante o inventário.</p>
          </div>
          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">Art. 185</span>
        </div>
      </summary>
      <div className="border-t border-slate-200/80 px-4 pb-4 pt-4 md:px-5 md:pb-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-600">
          Regra legal: registrar divergência sem transferir carga durante inventário. Art. 185 (AN303_Art185).
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showItemPhoto}
              onChange={(e) => setShowItemPhoto(e.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            Foto do item
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCatalogPhoto}
              onChange={(e) => setShowCatalogPhoto(e.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            Foto do catalogo
          </label>
        </div>

        {all.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Nenhuma divergência pendente neste endereço.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 pb-2">
            <table className="w-full text-sm">
              <thead className="bg-white text-xs uppercase tracking-widest text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-left">Tombo</th>
                  <th className="px-3 py-3 text-left">Catálogo (SKU)</th>
                  <th className="px-3 py-3 text-left">Unid. dona</th>
                  <th className="px-3 py-3 text-left">Unid. encontrada</th>
                  <th className="px-3 py-3 text-left">Qual divergencia</th>
                  <th className="px-3 py-3 text-left">Fonte</th>
                  <th className="px-3 py-3 text-left">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-slate-50">
                {all.slice(0, 120).map((d) => {
                  const b = d.numeroTombamento ? bemByTomb.get(String(d.numeroTombamento)) : null;
                  const fotoItem = getFotoUrl(d.fotoUrl || b?.fotoUrl || "");
                  const fotoCatalogo = getFotoUrl(d.fotoReferenciaUrl || b?.fotoReferenciaUrl || "");
                  return (
                    <tr key={`${d.fonte}|${d.numeroTombamento || d.identificadorExterno}`}>
                      <td className="px-3 py-3 font-mono text-xs text-slate-900">{d.numeroTombamento || <span className="text-rose-700 font-bold">SEM PLACA<br /><span className="text-[10px] text-rose-600 font-normal">{d.identificadorExterno}</span></span>}</td>
                      <td className="px-3 py-3">
                        <div className="font-mono text-[11px] text-emerald-700">{d.codigoCatalogo || b?.codigoCatalogo || "-"}</div>
                        <div className="font-semibold text-slate-800">{d.catalogoDescricao || b?.catalogoDescricao || "-"}</div>
                        {d.descricaoComplementar && (
                          <div className="mt-1 text-xs text-amber-800/90 font-medium whitespace-pre-line">
                            {d.descricaoComplementar}
                          </div>
                        )}
                        {d.observacoes && (
                          <div className="mt-1 text-[11px] text-slate-500 italic">
                            {d.observacoes}
                          </div>
                        )}
                        {showItemPhoto && fotoItem && (
                          <div className="mt-2">
                            <a href={fotoItem} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-slate-100">
                              📸 Ver Foto
                            </a>
                          </div>
                        )}
                        {showCatalogPhoto && fotoCatalogo && (
                          <div className="mt-2">
                            <a href={fotoCatalogo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">
                              Foto catalogo
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-800">{formatUnidade(Number(d.unidadeDonaId))}</td>
                      <td className="px-3 py-3 text-amber-800">{formatUnidade(Number(d.unidadeEncontradaId))}</td>
                      {(() => {
                        const divergence = describeRowDivergence(d);
                        return (
                          <td className="px-3 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${divergence.badgeClass}`}>
                              {divergence.badge}
                            </span>
                            <div className="mt-1 text-xs text-slate-800">{divergence.title}</div>
                            {divergence.detail && (
                              <div className="mt-1 text-[11px] text-slate-500">{divergence.detail}</div>
                            )}
                          </td>
                        );
                      })()}
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${d.fonte === "SERVIDOR" ? "border-emerald-300/40 bg-emerald-200/10 text-emerald-700" : "border-amber-300/40 bg-amber-200/10 text-amber-800"}`}>
                          {d.fonte}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{d.encontradoEm ? new Date(d.encontradoEm).toLocaleString() : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}




