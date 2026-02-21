/**
 * Modulo: frontend/components
 * Arquivo: InventoryRoomPanel.jsx
 * Funcao no sistema: modo inventario (offline-first) com contagens por sala e sincronizacao deterministica.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get as idbGet, set as idbSet } from "idb-keyval";
import useOfflineSync from "../hooks/useOfflineSync.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  listarContagensInventario,
  listarBens,
  listarBensTerceirosInventario,
  listarEventosInventario,
  listarLocais,
  registrarBemTerceiroInventario,
  registrarBemNaoIdentificadoInventario,
} from "../services/apiClient.js";
import BarcodeScanner from "./BarcodeScanner.jsx";
import InventoryProgress from "./InventoryProgress.jsx";
const TOMBAMENTO_RE = /^\d{10}$/;
const ROOM_CATALOG_CACHE_PREFIX = "cjm_room_catalog_v2|";
const INVENTORY_UI_KEY = "cjm_inventory_ui_v1";

function normalizeRoomKey(raw) {
  if (raw == null) return "";
  return String(raw).trim().toLowerCase();
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

function normalizeTombamentoInput(raw) {
  if (raw == null) return "";
  // Normaliza qualquer entrada (teclado, colar, scanner) para o tombamento GEAFIN:
  // - remove aspas comuns de CSV
  // - remove qualquer caractere nao numerico
  // - limita a 10 digitos
  //
  // Observacao UX: evitamos depender de validacao nativa de <input pattern>,
  // pois scanners/pastes podem incluir caracteres invisiveis e causar erro
  // "formato corresponde ao exigido" mesmo com 10 digitos visiveis.
  const cleaned = String(raw).trim().replace(/^\"+|\"+$/g, "").replace(/\D+/g, "");
  return cleaned.slice(0, 10);
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

function loadInventoryUiState() {
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
  try {
    const prev = loadInventoryUiState() || {};
    const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(INVENTORY_UI_KEY, JSON.stringify(next));
  } catch {
    // sem fatal
  }
}

export default function InventoryRoomPanel() {
  const qc = useQueryClient();
  const auth = useAuth();
  const offline = useOfflineSync();

  const initialUi = loadInventoryUiState();

  const [unidadeEncontradaId, setUnidadeEncontradaId] = useState(initialUi?.unidadeEncontradaId || "");
  const [selectedLocalId, setSelectedLocalId] = useState(initialUi?.selectedLocalId || "");
  const [salaEncontrada, setSalaEncontrada] = useState(initialUi?.salaEncontrada || "");
  const [scannerValue, setScannerValue] = useState("");
  const [uiError, setUiError] = useState(null);
  const [lastScans, setLastScans] = useState([]);
  const [unitEffectReady, setUnitEffectReady] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerMode, setScannerMode] = useState("single"); // 'single' ou 'continuous'

  // Registro segregado: bem de terceiro (sem tombamento GEAFIN).
  const [terceiroDescricao, setTerceiroDescricao] = useState("");
  const [terceiroProprietario, setTerceiroProprietario] = useState("");
  const [terceiroIdentificador, setTerceiroIdentificador] = useState("");
  const [terceiroStatus, setTerceiroStatus] = useState(null);

  // Registro segregado: bem nao identificado (Art. 175)
  const [naoIdDescricao, setNaoIdDescricao] = useState("");
  const [naoIdLocalizacao, setNaoIdLocalizacao] = useState("");
  const [naoIdFotoBase64, setNaoIdFotoBase64] = useState("");
  const [naoIdStatus, setNaoIdStatus] = useState(null);

  const [divergenteAlertItem, setDivergenteAlertItem] = useState(null);


  useEffect(() => {
    // Se o usuario mudar a unidade encontrada, o local deve ser re-selecionado (lista de locais e por unidade).
    if (!unitEffectReady) {
      setUnitEffectReady(true);
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
    return items[0];
  }, [eventosQuery.data]);

  const selectedEventoIdFinal = eventoAtivo?.id || "";

  const registrarBemTerceiroMut = useMutation({
    mutationFn: (payload) => registrarBemTerceiroInventario(payload),
    onSuccess: async () => {
      setTerceiroDescricao("");
      setTerceiroProprietario("");
      setTerceiroIdentificador("");
      setTerceiroStatus({ kind: "ok", at: new Date().toISOString() });

      // Atualiza contagens da sala (se online) para refletir o registro.
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
    enabled: Boolean(selectedLocalId && String(selectedLocalId).trim() !== ""),
    queryFn: async () => {
      const localId = selectedLocalId.trim();
      if (!localId) return [];

      // Offline-first: se não houver conexao, tenta carregar o ultimo catalogo baixado para esta sala.
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

  useEffect(() => {
    // Mantem salaEncontrada coerente com o local selecionado (evita texto "solto" no estado).
    if (!selectedLocalId) {
      if (salaEncontrada) setSalaEncontrada("");
      return;
    }
    const local = (locaisQuery.data || []).find((l) => String(l.id) === String(selectedLocalId));
    if (local?.nome && String(local.nome) !== String(salaEncontrada || "")) {
      setSalaEncontrada(String(local.nome));
    }
  }, [locaisQuery.data, salaEncontrada, selectedLocalId]);

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

  const foundSet = useMemo(() => {
    const s = new Set();
    for (const t of contagemByTombamento.keys()) s.add(t);
    for (const t of pendingByTombamento.keys()) s.add(t);
    return s;
  }, [contagemByTombamento, pendingByTombamento]);

  function getConferenciaMeta(bem) {
    const t = bem?.numeroTombamento || null;
    if (!t) return { encontrado: false, divergente: false, fonte: null };

    const c = contagemByTombamento.get(t);
    if (c) {
      return {
        encontrado: true,
        divergente: c.tipoOcorrencia === "ENCONTRADO_EM_LOCAL_DIVERGENTE",
        fonte: "SERVIDOR",
      };
    }

    const p = pendingByTombamento.get(t);
    if (p) {
      const unidadeEncontrada = Number(p.unidadeEncontradaId);
      const unidadeDona = Number(bem.unidadeDonaId);
      return {
        encontrado: true,
        divergente: Number.isInteger(unidadeEncontrada) && Number.isInteger(unidadeDona) ? unidadeEncontrada !== unidadeDona : false,
        fonte: "PENDENTE",
      };
    }

    return { encontrado: false, divergente: false, fonte: null };
  }

  const canRegister = Boolean(
    selectedEventoIdFinal &&
    salaEncontrada.trim().length >= 2 &&
    selectedLocalId &&
    String(selectedLocalId).trim() !== "" &&
    unidadeEncontradaId &&
    Number(unidadeEncontradaId) >= 1 &&
    Number(unidadeEncontradaId) <= 4,
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

    const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
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

    const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
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

    if (offline.pendingCount > 0) {
      const msgBase = `Há ${offline.pendingCount} item(ns) pendente(s) de sincronização offline.`;
      if (navigator.onLine) {
        const sync = window.confirm(`${msgBase}\n\nDeseja sincronizar agora antes de ${status.toLowerCase()} o evento?`);
        if (sync) {
          try {
            await offline.syncNow();
            await contagensSalaQuery.refetch().catch(() => undefined);
          } catch (_e) {
            // sem fatal; a tela vai mostrar erro do hook se falhar
          }
        }
      }

      if (status === "ENCERRADO" && offline.pendingCount > 0) {
        const proceed = window.confirm(
          `${msgBase}\n\nEncerrar com pendências pode fazer você "perder" registros no servidor até sincronizar.\n\nDeseja encerrar mesmo assim?`,
        );
        if (!proceed) return;
      }
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

  const registerScan = async (event) => {
    event.preventDefault();
    setUiError(null);

    if (!canRegister) {
      setUiError("Selecione evento ativo, unidade encontrada e sala antes de registrar.");
      return;
    }

    const numeroTombamento = normalizeTombamentoInput(scannerValue);
    if (!TOMBAMENTO_RE.test(numeroTombamento)) {
      setUiError("Tombamento inválido. Use 10 dígitos (ex.: 1290001788).");
      return;
    }

    const unidadeEncontrada = Number(unidadeEncontradaId);
    let bem = bemByTombamento.get(numeroTombamento) || null;

    // Scanner hibrido: se o tombo não estiver no catálogo da sala carregado, tenta lookup rapido no backend (quando online).
    if (!bem && navigator.onLine) {
      try {
        const lookup = await listarBens({ numeroTombamento, limit: 1, offset: 0, incluirTerceiros: false });
        bem = (lookup.items || [])[0] || null;
      } catch (_error) {
        // Falha de lookup não impede enfileirar o scan.
      }
    }

    const divergente = bem ? Number(bem.unidadeDonaId) !== unidadeEncontrada : false;

    // Regra legal: divergencia de local deve gerar ocorrencia sem trocar carga no inventario.
    // Art. 185 (AN303_Art185).
    if (divergente) {
      playAlertBeep();
      setDivergenteAlertItem({
        numeroTombamento,
        salaEncontrada: salaEncontrada.trim(),
        unidadeDonaId: bem.unidadeDonaId,
        unidadeEncontradaId: unidadeEncontrada
      });
    }

    const payload = {
      id: crypto.randomUUID(),
      eventoInventarioId: selectedEventoIdFinal,
      unidadeEncontradaId: unidadeEncontrada,
      salaEncontrada: salaEncontrada.trim(),
      encontradoPorPerfilId: auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim() || null,
      numeroTombamento,
      encontradoEm: new Date().toISOString(),
      observacoes: divergente ? "Detectado como local divergente na UI (alerta)." : null,
    };

    await offline.enqueue(payload);
    setScannerValue("");
    saveInventoryUiState({
      salaEncontrada,
      unidadeEncontradaId,
      selectedLocalId,
      selectedEventoId: selectedEventoIdFinal,
    });
    setLastScans((prev) => [
      {
        id: payload.id,
        numeroTombamento,
        divergente,
        unidadeDonaId: bem?.unidadeDonaId || null,
        unidadeEncontradaId: unidadeEncontrada,
        when: new Date().toLocaleString(),
      },
      ...prev,
    ].slice(0, 8));

    if (navigator.onLine) {
      await offline.syncNow();
      await contagensSalaQuery.refetch();
    }
  };

  return (
    <section className="rounded-2xl border border-white/15 bg-slate-900/55 p-3 md:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Modo Inventário (offline-first)</h2>
          <p className="mt-2 text-sm text-slate-300">
            Contagens sao persistidas no navegador e sincronizadas com a API quando houver conexao.
          </p>
        </div>
        <div className="text-xs text-slate-300">
          <p>
            Pendentes offline:{" "}
            <span className="font-semibold text-cyan-200">{offline.pendingCount}</span>
          </p>
          <p className="mt-1">
            Conexao:{" "}
            <span className={navigator.onLine ? "text-emerald-300" : "text-amber-300"}>
              {navigator.onLine ? "ONLINE" : "OFFLINE"}
            </span>
          </p>
        </div>
      </header>

      {(uiError || offline.lastError) && (
        <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-200/10 p-3 text-sm text-rose-200">
          {uiError || offline.lastError}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-white/15 bg-slate-950/35 p-3 md:p-4 lg:col-span-1">
          <h3 className="font-semibold">Sala e scanner</h3>
          <p className="mt-1 text-xs text-slate-300">
            Selecione a sala e registre tombamentos. Divergencias tocam alerta e viram ocorrencia (Art. 185).
          </p>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Unidade encontrada (1..4)</span>
              <select
                value={unidadeEncontradaId}
                onChange={(e) => setUnidadeEncontradaId(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                <option value="1">{formatUnidade(1)}</option>
                <option value="2">{formatUnidade(2)}</option>
                <option value="3">{formatUnidade(3)}</option>
                <option value="4">{formatUnidade(4)}</option>
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-300">Local cadastrado (Admin)</span>
              <select
                value={selectedLocalId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedLocalId(id);
                  const local = (locaisQuery.data || []).find((l) => String(l.id) === String(id));
                  if (local?.nome) setSalaEncontrada(String(local.nome));
                }}
                disabled={!unidadeEncontradaId || locaisQuery.isFetching}
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">
                  {!unidadeEncontradaId
                    ? "Selecione a unidade encontrada primeiro"
                    : locaisQuery.isFetching
                      ? "Carregando locais..."
                      : "Selecione um local"}
                </option>
                {(locaisQuery.data || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Este campo nao e texto livre. O Admin cadastra os locais em "Operacoes API" (secao Locais).
              </p>
            </label>
          </div>

          <form onSubmit={registerScan} className="mt-4">
            <label className="block space-y-1 mb-2">
              <span className="text-xs text-slate-300">Bipar tombamento (10 dígitos)</span>
              <div className="grid gap-2 grid-cols-[1fr_auto] md:grid-cols-[1fr_auto_auto]">
                <input
                  value={scannerValue}
                  onChange={(e) => setScannerValue(normalizeTombamentoInput(e.target.value))}
                  placeholder="Ex: 1290001788"
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm col-span-1"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setScannerMode("single"); setShowScanner(true); }}
                    title="Câmera (Uma leitura)"
                    className="rounded-lg bg-slate-700 px-3 py-2 text-slate-200 hover:bg-slate-600 focus:ring-2 focus:ring-cyan-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScannerMode("continuous"); setShowScanner(true); }}
                    title="Câmera (Contínuo)"
                    className="rounded-lg bg-slate-700 px-3 py-2 text-slate-200 hover:bg-slate-600 focus:ring-2 focus:ring-cyan-500"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!canRegister}
                  className="col-span-2 md:col-span-1 w-full rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                  Registrar
                </button>
              </div>
            </label>
          </form>

          {showScanner && (
            <BarcodeScanner
              continuous={scannerMode === "continuous"}
              onClose={() => setShowScanner(false)}
              onScan={(decodedText) => {
                const cleaned = normalizeTombamentoInput(decodedText);
                if (cleaned.length === 10) {
                  setScannerValue(cleaned);
                  // Simula o envio do formulário programaticamente (para engatilhar a mesma lógica de registerScan)
                  if (!canRegister) return;
                  if (scannerMode === "single") setShowScanner(false);

                  // Wrap in a setTimeout so the state update resolves before we submit the scan
                  setTimeout(() => {
                    const fakeEvent = { preventDefault: () => { } };
                    registerScan(fakeEvent);
                  }, 50);
                } else if (!continuous) {
                  // Manteve a varredura se estiver contínuo
                  setScannerValue(decodedText);
                }
              }}
            />
          )}

          {lastScans.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-widest text-slate-400">Últimos registros</p>
              {lastScans.map((s) => (
                <div key={s.id} className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-slate-100">{s.numeroTombamento}</span>
                    <span className="text-slate-300">{s.when}</span>
                  </div>
                  <div className="mt-1 text-slate-300">
                    {s.divergente ? (
                      <span className="text-amber-200">
                        Divergente: dono={formatUnidade(Number(s.unidadeDonaId))} encontrado={formatUnidade(Number(s.unidadeEncontradaId))}
                      </span>
                    ) : (
                      <span className="text-emerald-200">Conforme</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
        <div className="flex flex-col gap-4">
          <InventoryProgress eventoInventarioId={selectedEventoIdFinal} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <details className="rounded-2xl border border-white/15 bg-slate-950/35 p-3 md:p-4 lg:col-span-1 group">
          <summary className="font-semibold cursor-pointer select-none">Registrar Bem de Terceiro (Segregado)</summary>
          <div className="mt-3 group-open:block">
            <form onSubmit={onRegistrarBemTerceiro} className="mt-4 rounded-xl border border-white/10 bg-slate-950/25 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[11px] text-slate-400">
                  Sem tombamento GEAFIN. Regra: Art. 99/110 VI/175 IX (AN303_Art99 / AN303_Art110_VI / AN303_Art175_IX).
                </p>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs text-slate-300">Descrição</span>
                  <input
                    value={terceiroDescricao}
                    onChange={(e) => setTerceiroDescricao(e.target.value)}
                    placeholder="Ex.: Notebook do prestador de TI, impressora da empresa X..."
                    className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-300">Proprietário externo</span>
                  <input
                    value={terceiroProprietario}
                    onChange={(e) => setTerceiroProprietario(e.target.value)}
                    placeholder="Ex.: Empresa Contratada XYZ"
                    className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-300">Identificador externo (opcional)</span>
                  <input
                    value={terceiroIdentificador}
                    onChange={(e) => setTerceiroIdentificador(e.target.value)}
                    placeholder="Ex.: ETIQ-000123 (ou deixe em branco)"
                    className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="submit"
                  disabled={!canRegisterTerceiro || registrarBemTerceiroMut.isPending}
                  className="rounded-lg border border-white/25 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-50"
                >
                  {registrarBemTerceiroMut.isPending ? "Registrando..." : "Registrar bem de terceiro"}
                </button>

                {terceiroStatus?.kind === "ok" ? (
                  <span className="text-xs text-emerald-200">Registrado.</span>
                ) : null}
              </div>

              {registrarBemTerceiroMut.error ? (
                <p className="mt-2 text-sm text-rose-200">
                  Falha ao registrar bem de terceiro: {String(registrarBemTerceiroMut.error?.message || "erro")}
                </p>
              ) : null}
            </form>
          </div>
        </details>

        <details className="rounded-2xl border border-white/15 bg-slate-950/35 p-3 md:p-4 lg:col-span-1 group">
          <summary className="font-semibold cursor-pointer select-none text-rose-300">Registrar bem sem identificação (Divergência)</summary>
          <div className="mt-3 group-open:block">
            <form onSubmit={onRegistrarNaoIdentificado} className="mt-4 rounded-xl border border-white/10 border-l-rose-500 bg-slate-950/25 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[11px] text-slate-400">
                  Obrigatório foto e descrição. Fica onde está. Art. 175.
                </p>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs text-slate-300">Descrição detalhada do bem</span>
                  <input
                    value={naoIdDescricao}
                    onChange={(e) => setNaoIdDescricao(e.target.value)}
                    placeholder="Ex.: Cadeira giratória azul, marca Frisokar, sem braços..."
                    className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-300">Localização exata</span>
                  <input
                    value={naoIdLocalizacao}
                    onChange={(e) => setNaoIdLocalizacao(e.target.value)}
                    placeholder="Ex.: Perto da janela, mesa 3..."
                    className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-slate-300">Fotografia (Obrigatória)</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFotoNaoId}
                    className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-1.5 text-xs file:mr-3 file:rounded-lg file:bg-slate-700 file:border-0 file:px-3 file:py-1 file:text-slate-200"
                  />
                </label>
                {naoIdFotoBase64 && (
                  <div className="md:col-span-2 mt-2">
                    <p className="text-xs text-emerald-300 mb-1 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      Foto anexada
                    </p>
                    <img src={naoIdFotoBase64} alt="Previa" className="h-16 w-16 object-cover rounded-md border border-white/20" />
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="submit"
                  disabled={!canRegisterNaoIdentificado || registrarNaoIdentificadoMut.isPending}
                  className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
                >
                  {registrarNaoIdentificadoMut.isPending ? "Registrando..." : "Registrar Bem"}
                </button>

                {naoIdStatus?.kind === "ok" ? (
                  <span className="text-xs text-emerald-200">Adicionado às disparidades da sala.</span>
                ) : null}
              </div>

              {registrarNaoIdentificadoMut.error ? (
                <p className="mt-2 text-sm text-rose-200">
                  Falha: {String(registrarNaoIdentificadoMut.error?.message || "erro interno")}
                </p>
              ) : null}
            </form>
          </div>
        </details>

        <details className="rounded-2xl border border-white/15 bg-slate-950/35 p-3 md:p-4 lg:col-span-1 group">
          <summary className="font-semibold cursor-pointer select-none">Bens de terceiros registrados (esta sala)</summary>
          <div className="mt-3 group-open:block">
            <section className="mt-4 rounded-xl border border-white/10 bg-slate-950/25 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[11px] text-slate-400">
                  Fonte: `vw_bens_terceiros_inventario` (derivado de contagens). Controle segregado.
                </p>
              </div>

              {!selectedEventoIdFinal || !salaEncontrada.trim() ? (
                <p className="mt-2 text-sm text-slate-300">Selecione evento e sala para listar os registros.</p>
              ) : !navigator.onLine ? (
                <p className="mt-2 text-sm text-slate-300">
                  Offline: a lista de bens de terceiros depende da API (os registros feitos offline ainda ficam na fila de sincronização).
                </p>
              ) : terceirosSalaQuery.isFetching ? (
                <p className="mt-2 text-sm text-slate-300">Carregando...</p>
              ) : (terceirosSalaQuery.data || []).length === 0 ? (
                <p className="mt-2 text-sm text-slate-300">Nenhum bem de terceiro registrado para esta sala.</p>
              ) : (
                <div className="mt-3 overflow-auto rounded-lg border border-white/10">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-300">
                      <tr>
                        <th className="px-3 py-2">Identificador</th>
                        <th className="px-3 py-2">Descrição</th>
                        <th className="px-3 py-2">Proprietário</th>
                        <th className="px-3 py-2">Quando</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {(terceirosSalaQuery.data || []).slice(0, 30).map((t) => (
                        <tr key={t.contagemId} className="hover:bg-white/5">
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-200">
                            {t.identificadorExterno || "-"}
                          </td>
                          <td className="px-3 py-2 text-slate-200">{t.descricao || "-"}</td>
                          <td className="px-3 py-2 text-slate-300">{t.proprietarioExterno || "-"}</td>
                          <td className="px-3 py-2 text-slate-300">
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
        </details>
      </div>

      <DivergencesPanel
        salaEncontrada={salaEncontrada}
        contagens={contagensSalaQuery.data || []}
        offlineItems={offline.items || []}
        bensSala={bensSalaQuery.data || []}
        eventoInventarioId={selectedEventoIdFinal}
      />

      <details className="mt-5 rounded-2xl border border-white/15 bg-slate-950/35 p-3 md:p-4 group">
        <summary className="font-semibold cursor-pointer select-none flex flex-wrap items-center justify-between gap-2">
          <span>Bens da sala (agrupado por catálogo)</span>
          {bensSalaQuery.isFetching && <span className="text-xs text-slate-400">Carregando...</span>}
        </summary>
        <div className="mt-3 group-open:block">
          <div className="mt-2">
            <p className="text-xs text-slate-300">
              Itens carregados: <span className="font-semibold text-slate-100">{(bensSalaQuery.data || []).length}</span>
            </p>
          </div>

          {!navigator.onLine && (
            <p className="mt-2 text-[11px] text-slate-400">
              fonte: <span className="font-semibold text-slate-200">CACHE (offline)</span>
            </p>
          )}

          {bensSalaQuery.error && (
            <p className="mt-3 text-sm text-rose-300">Falha ao carregar bens para este local.</p>
          )}

          {!bensSalaQuery.isFetching && (bensSalaQuery.data || []).length === 0 && (
            <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-slate-950/20 p-3">
              <p className="text-sm text-slate-200">
                Nenhum bem vinculado ao local <span className="font-semibold text-slate-100">"{salaEncontrada.trim()}"</span>.
              </p>
              <p className="text-xs text-slate-400">
                Aqui o inventário usa <code className="px-1">bens.local_id</code> (local cadastrado pelo Admin), não o texto do GEAFIN.
                Para aparecerem itens, um Admin deve vincular os bens a este local.
              </p>
            </div>
          )}

          <div className="mt-3 space-y-2">
            {grouped.map((g) => (
              <details key={g.catalogoBemId} className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
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
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-100">
                        <span>{g.catalogoDescricao}</span>
                        <span className="text-xs font-normal text-slate-300">
                          Total: <span className="font-semibold text-slate-100">{total}</span>{" "}
                          | Encontrados: <span className="font-semibold text-emerald-200">{encontrados}</span>{" "}
                          | Divergentes: <span className="font-semibold text-rose-200">{divergentes}</span>{" "}
                          | Faltantes: <span className="font-semibold text-amber-200">{faltantes}</span>
                        </span>
                      </div>
                    </summary>
                  );
                })()}
                <div className="mt-3 overflow-auto rounded-lg border border-white/10">
                  <ul className="divide-y divide-white/10 bg-slate-950/20">
                    {g.items.slice(0, 200).map((b) => {
                      const meta = getConferenciaMeta(b);
                      const badge = meta.encontrado
                        ? meta.divergente
                          ? { text: "LOCAL_DIVERGENTE", cls: "border-rose-300/40 text-rose-200 bg-rose-200/10" }
                          : { text: "ENCONTRADO", cls: "border-emerald-300/40 text-emerald-200 bg-emerald-200/10" }
                        : { text: "FALTANTE", cls: "border-amber-300/40 text-amber-200 bg-amber-200/10" };

                      return (
                        <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={meta.encontrado}
                              readOnly
                              className="h-4 w-4 accent-cyan-300"
                              title={meta.encontrado ? `Conferido (${meta.fonte})` : "Nao conferido"}
                            />
                            <span className="font-mono text-xs text-slate-100">{b.numeroTombamento || "-"}</span>
                            <span className="text-[11px] text-slate-300">{formatUnidade(Number(b.unidadeDonaId))}</span>
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
      </details>

      {/* MODAL ALERTA DIVERGÊNCIA */}
      {
        divergenteAlertItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-rose-500/50 bg-slate-900 p-6 shadow-2xl shadow-rose-900/20">
              <div className="mb-4 flex items-center gap-3 text-rose-400">
                <svg className="h-10 w-10 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-xl font-bold uppercase tracking-wide">Atenção: Bem Divergente!</h2>
              </div>

              <p className="mb-4 text-base text-slate-200">
                O item <strong className="font-mono text-white">{divergenteAlertItem.numeroTombamento}</strong> pertence à unidade local <strong>{formatUnidade(divergenteAlertItem.unidadeDonaId)}</strong>, mas acaba de ser registrado na unidade <strong>{formatUnidade(divergenteAlertItem.unidadeEncontradaId)}</strong> ({divergenteAlertItem.salaEncontrada}).
              </p>

              <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="font-bold text-amber-300 uppercase">Não leve este item para outro local!</p>
                <p className="mt-2 text-sm text-amber-200/80 leading-relaxed">
                  Segundo o <strong>Art. 185 (ATN 303)</strong>, divergências constatadas in-loco de fato compõem o rol de Ocorrências (Disparidades).
                  O bem deverá permanecer obrigatoriamente neste local até o fim dos trabalhos, momento em que a fila de forasteiros possibilitará sua regularização por transferência.
                </p>
              </div>

              <button
                onClick={() => setDivergenteAlertItem(null)}
                className="w-full rounded-xl bg-rose-600 py-3 font-semibold text-white transition-colors hover:bg-rose-500 active:bg-rose-700 hover:shadow-lg hover:shadow-rose-900/50"
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

function DivergencesPanel({ salaEncontrada, contagens, offlineItems, bensSala, eventoInventarioId }) {
  const salaKey = normalizeRoomKey(salaEncontrada);

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
        catalogoDescricao: c.catalogoDescricao,
        descricaoComplementar: c.descricaoComplementar,
        fotoUrl: c.fotoUrl,
        observacoes: c.observacoes,
        unidadeDonaId: c.unidadeDonaId,
        unidadeEncontradaId: c.unidadeEncontradaId,
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
      const divergente =
        Number.isInteger(unidadeDonaId) && Number.isInteger(unidadeEncontradaId) ? unidadeDonaId !== unidadeEncontradaId : false;
      if (!divergente) continue;
      out.push({
        fonte: "PENDENTE",
        numeroTombamento: it.numeroTombamento,
        unidadeDonaId,
        unidadeEncontradaId,
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
    <details className="mt-5 rounded-2xl border border-white/15 bg-slate-950/35 p-3 md:p-4 group">
      <summary className="font-semibold cursor-pointer select-none flex flex-wrap items-center justify-between gap-2">
        <span>Divergências na sala (Art. 185)</span>
        <span className="text-xs font-normal text-slate-300">
          Pendentes: <span className="font-semibold text-rose-200">{all.length}</span>
        </span>
      </summary>
      <div className="mt-3 group-open:block">
        <p className="mt-2 text-xs text-slate-400">
          Regra legal: registrar divergência sem transferir carga durante inventário. Art. 185 (AN303_Art185).
        </p>

        {all.length === 0 ? (
          <p className="mt-3 text-sm text-slate-300">Nenhuma divergência pendente nesta sala.</p>
        ) : (
          <div className="mt-3 overflow-auto rounded-xl border border-white/10 pb-2">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-slate-950/40 text-xs uppercase tracking-widest text-slate-300">
                <tr>
                  <th className="px-3 py-3 text-left">Tombo</th>
                  <th className="px-3 py-3 text-left">Catálogo (SKU)</th>
                  <th className="px-3 py-3 text-left">Unid. dona</th>
                  <th className="px-3 py-3 text-left">Unid. encontrada</th>
                  <th className="px-3 py-3 text-left">Fonte</th>
                  <th className="px-3 py-3 text-left">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-900/40">
                {all.slice(0, 120).map((d) => {
                  const b = d.numeroTombamento ? bemByTomb.get(String(d.numeroTombamento)) : null;
                  return (
                    <tr key={`${d.fonte}|${d.numeroTombamento || d.identificadorExterno}`}>
                      <td className="px-3 py-3 font-mono text-xs text-slate-100">{d.numeroTombamento || <span className="text-rose-400 font-bold">SEM PLACA<br /><span className="text-[10px] text-rose-300 font-normal">{d.identificadorExterno}</span></span>}</td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-200">{d.catalogoDescricao || b?.catalogoDescricao || "-"}</div>
                        {d.descricaoComplementar && (
                          <div className="mt-1 text-xs text-amber-100/90 font-medium whitespace-pre-line">
                            {d.descricaoComplementar}
                          </div>
                        )}
                        {d.observacoes && (
                          <div className="mt-1 text-[11px] text-slate-400 italic">
                            {d.observacoes}
                          </div>
                        )}
                        {d.fotoUrl && (
                          <div className="mt-2">
                            <a href={d.fotoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-slate-700">
                              📸 Ver Foto
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-200">{formatUnidade(Number(d.unidadeDonaId))}</td>
                      <td className="px-3 py-3 text-amber-100">{formatUnidade(Number(d.unidadeEncontradaId))}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${d.fonte === "SERVIDOR" ? "border-emerald-300/40 bg-emerald-200/10 text-emerald-200" : "border-amber-300/40 bg-amber-200/10 text-amber-200"}`}>
                          {d.fonte}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{d.encontradoEm ? new Date(d.encontradoEm).toLocaleString() : "-"}</td>
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
