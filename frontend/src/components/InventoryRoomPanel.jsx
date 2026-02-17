/**
 * Modulo: frontend/components
 * Arquivo: InventoryRoomPanel.jsx
 * Funcao no sistema: modo inventario (offline-first) com contagens por sala e sincronizacao deterministica.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get as idbGet, set as idbSet } from "idb-keyval";
import useOfflineSync from "../hooks/useOfflineSync.js";
import { useAuth } from "../context/AuthContext.jsx";
import {
  atualizarStatusEventoInventario,
  criarEventoInventario,
  listarContagensInventario,
  listarBens,
  listarEventosInventario,
} from "../services/apiClient.js";

const TOMBAMENTO_RE = /^\d{10}$/;
const ROOM_CATALOG_CACHE_PREFIX = "cjm_room_catalog_v1|";

function normalizeRoomKey(raw) {
  if (raw == null) return "";
  return String(raw).trim().toLowerCase();
}

function roomCacheKey(roomName) {
  return `${ROOM_CATALOG_CACHE_PREFIX}${normalizeRoomKey(roomName)}`;
}

async function loadRoomCatalogFromCache(roomName) {
  const v = await idbGet(roomCacheKey(roomName));
  return Array.isArray(v) ? v : [];
}

async function saveRoomCatalogToCache(roomName, items) {
  await idbSet(roomCacheKey(roomName), items);
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

export default function InventoryRoomPanel() {
  const qc = useQueryClient();
  const auth = useAuth();
  const offline = useOfflineSync();

  const [perfilId, setPerfilId] = useState("");
  const [selectedEventoId, setSelectedEventoId] = useState("");
  const [codigoEvento, setCodigoEvento] = useState("");
  const [unidadeInventariadaId, setUnidadeInventariadaId] = useState("");
  const [encerramentoObs, setEncerramentoObs] = useState("");

  const [unidadeEncontradaId, setUnidadeEncontradaId] = useState("");
  const [salaEncontrada, setSalaEncontrada] = useState("");
  const [scannerValue, setScannerValue] = useState("");
  const [uiError, setUiError] = useState(null);
  const [lastScans, setLastScans] = useState([]);

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
    if (selectedEventoId) return items.find((e) => e.id === selectedEventoId) || items[0];
    return items[0];
  }, [eventosQuery.data, selectedEventoId]);

  const selectedEventoIdFinal = eventoAtivo?.id || "";

  const criarEventoMut = useMutation({
    mutationFn: (payload) => criarEventoInventario(payload),
    onSuccess: async () => {
      setCodigoEvento("");
      setUnidadeInventariadaId("");
      await qc.invalidateQueries({ queryKey: ["inventarioEventos", "EM_ANDAMENTO"] });
    },
  });

  const atualizarStatusMut = useMutation({
    mutationFn: ({ id, payload }) => atualizarStatusEventoInventario(id, payload),
    onSuccess: async () => {
      setEncerramentoObs("");
      await qc.invalidateQueries({ queryKey: ["inventarioEventos", "EM_ANDAMENTO"] });
    },
  });

  const bensSalaQuery = useQuery({
    queryKey: ["bensSala", salaEncontrada],
    enabled: false,
    queryFn: async () => {
      const local = salaEncontrada.trim();
      if (!local) return [];

      // Offline-first: se não houver conexao, tenta carregar o ultimo catalogo baixado para esta sala.
      if (!navigator.onLine) {
        const cached = await loadRoomCatalogFromCache(local);
        if (cached.length) return cached;
        throw new Error("SEM_CACHE_OFFLINE");
      }

      const data = await listarBens({ localFisico: local, limit: 200, offset: 0, incluirTerceiros: false });
      const items = data.items || [];
      await saveRoomCatalogToCache(local, items);
      return items;
    },
  });

  const contagensSalaQuery = useQuery({
    queryKey: ["inventarioContagens", selectedEventoIdFinal, salaEncontrada],
    enabled: Boolean(selectedEventoIdFinal && salaEncontrada.trim().length >= 2 && navigator.onLine),
    queryFn: async () => {
      const data = await listarContagensInventario({
        eventoInventarioId: selectedEventoIdFinal,
        salaEncontrada: salaEncontrada.trim(),
        limit: 2000,
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
      unidadeEncontradaId &&
      Number(unidadeEncontradaId) >= 1 &&
      Number(unidadeEncontradaId) <= 4,
  );

  const onLoadSala = async () => {
    setUiError(null);
    if (salaEncontrada.trim().length < 2) {
      setUiError("Informe a sala/local para baixar o catálogo da sala.");
      return;
    }
    try {
      await bensSalaQuery.refetch();
    } catch (error) {
      if (String(error?.message || "").includes("SEM_CACHE_OFFLINE")) {
        setUiError("Sem cache offline para esta sala. Conecte-se e baixe o catálogo da sala pelo menos uma vez.");
      }
    }
  };

  const onCreateEvento = async (event) => {
    event.preventDefault();
    setUiError(null);

    const perfilIdFinal = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
    if (!perfilIdFinal) {
      setUiError("Informe um perfilId (UUID) para abrir o evento.");
      return;
    }
    const codigo = codigoEvento.trim();
    if (!codigo) {
      setUiError("Informe um códigoEvento.");
      return;
    }

    const unidadeFinal = unidadeInventariadaId.trim() === "" ? null : Number(unidadeInventariadaId);
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
    if (divergente) playAlertBeep();

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
    <section className="rounded-2xl border border-white/15 bg-slate-900/55 p-5">
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
        <article className="rounded-2xl border border-white/15 bg-slate-950/35 p-4">
          <h3 className="font-semibold">Evento de inventario (EM_ANDAMENTO)</h3>
          <p className="mt-1 text-xs text-slate-300">
            Inventário ativo bloqueia mudança de carga (Art. 183 - AN303_Art183).
          </p>

          {auth.perfil ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/25 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-100">Executor</p>
              <p className="mt-1">
                {auth.perfil.nome} ({auth.perfil.matricula}) - perfilId {String(auth.perfil.id).slice(0, 8)}...
              </p>
            </div>
          ) : (
            <label className="mt-3 block space-y-1">
              <span className="text-xs text-slate-300">PerfilId (UUID) para abrir/encerrar</span>
              <input
                value={perfilId}
                onChange={(e) => setPerfilId(e.target.value)}
                placeholder="UUID do perfil (crie em Operações API)"
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
          )}

          {eventosQuery.isLoading && <p className="mt-3 text-sm text-slate-300">Carregando eventos...</p>}
          {eventosQuery.error && (
            <p className="mt-3 text-sm text-rose-300">Falha ao listar eventos ativos.</p>
          )}

          {(eventosQuery.data || []).length > 0 ? (
            <div className="mt-3 space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-slate-300">Selecionar evento</span>
                <select
                  value={selectedEventoIdFinal}
                  onChange={(e) => setSelectedEventoId(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                >
                  {(eventosQuery.data || []).map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.codigoEvento} (unidade={ev.unidadeInventariadaId ?? "geral"})
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => onUpdateStatus("ENCERRADO")}
                  disabled={atualizarStatusMut.isPending}
                  className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                  Encerrar
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateStatus("CANCELADO")}
                  disabled={atualizarStatusMut.isPending}
                  className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>

              <label className="block space-y-1">
                <span className="text-xs text-slate-300">Observacoes de encerramento (opcional)</span>
                <textarea
                  value={encerramentoObs}
                  onChange={(e) => setEncerramentoObs(e.target.value)}
                  className="min-h-20 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
            </div>
          ) : (
            <form onSubmit={onCreateEvento} className="mt-3 space-y-3">
              <p className="text-sm text-slate-300">
                Nenhum evento ativo. Abra um evento para iniciar o inventario.
              </p>
              <label className="block space-y-1">
                <span className="text-xs text-slate-300">códigoEvento</span>
                <input
                  value={codigoEvento}
                  onChange={(e) => setCodigoEvento(e.target.value)}
                  placeholder="Ex.: INV_2026_02_16_1AAUD"
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-300">unidadeInventariadaId (1..4) ou vazio (geral)</span>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={unidadeInventariadaId}
                  onChange={(e) => setUnidadeInventariadaId(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={criarEventoMut.isPending}
                className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                {criarEventoMut.isPending ? "Abrindo..." : "Abrir evento"}
              </button>
            </form>
          )}
        </article>

        <article className="rounded-2xl border border-white/15 bg-slate-950/35 p-4">
          <h3 className="font-semibold">Sala e scanner</h3>
          <p className="mt-1 text-xs text-slate-300">
            Baixe os bens da sala e registre tombamentos. Divergencias tocam alerta e viram ocorrencia (Art. 185).
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
              <span className="text-xs text-slate-300">Sala/local (usa local_fisico)</span>
              <input
                value={salaEncontrada}
                onChange={(e) => setSalaEncontrada(e.target.value)}
                placeholder="Ex.: Sala 101, 1a Aud, Almox..."
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2 md:col-span-2">
              <button
                type="button"
                onClick={onLoadSala}
                disabled={bensSalaQuery.isFetching}
                className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                {bensSalaQuery.isFetching ? "Carregando..." : "Baixar catálogo da sala"}
              </button>
              <button
                type="button"
                onClick={() => offline.syncNow()}
                disabled={offline.isSyncing || offline.pendingCount === 0}
                className="rounded-lg border border-white/25 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              >
                {offline.isSyncing ? "Sincronizando..." : "Sincronizar agora"}
              </button>
            </div>
          </div>

          <form onSubmit={registerScan} className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              value={scannerValue}
              onChange={(e) => setScannerValue(normalizeTombamentoInput(e.target.value))}
              placeholder="Bipar tombamento (10 dígitos) e pressionar Enter"
              inputMode="numeric"
              maxLength={10}
              className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!canRegister}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
            >
              Registrar
            </button>
          </form>

          {lastScans.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-widest text-slate-400">Ultimos registros</p>
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
      </div>

      <article className="mt-5 rounded-2xl border border-white/15 bg-slate-950/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Bens da sala (agrupado por catálogo)</h3>
          <p className="text-xs text-slate-300">
            Itens carregados: <span className="font-semibold text-slate-100">{(bensSalaQuery.data || []).length}</span>
          </p>
        </div>

        {bensSalaQuery.error && (
          <p className="mt-3 text-sm text-rose-300">Falha ao carregar bens para este local.</p>
        )}
        {!bensSalaQuery.isFetching && (bensSalaQuery.data || []).length === 0 && (
          <p className="mt-3 text-sm text-slate-300">
            Carregue uma sala para ver o catálogo agrupado (usa filtro por <code className="px-1">local_fisico</code>).
          </p>
        )}

        <div className="mt-3 space-y-2">
          {grouped.map((g) => (
            <details key={g.catalogoBemId} className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
              {(() => {
                const total = g.items.length;
                const encontrados = g.items.reduce((acc, b) => acc + (foundSet.has(b.numeroTombamento) ? 1 : 0), 0);
                const faltantes = Math.max(0, total - encontrados);
                return (
                  <summary className="cursor-pointer select-none">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-100">
                      <span>{g.catalogoDescricao}</span>
                      <span className="text-xs font-normal text-slate-300">
                        Total: <span className="font-semibold text-slate-100">{total}</span>{" "}
                        | Encontrados: <span className="font-semibold text-emerald-200">{encontrados}</span>{" "}
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
      </article>
    </section>
  );
}
