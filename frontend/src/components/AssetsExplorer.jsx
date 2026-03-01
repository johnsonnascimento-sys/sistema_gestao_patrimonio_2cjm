/**
 * Modulo: frontend/components
 * Arquivo: AssetsExplorer.jsx
 * Funcao no sistema: consulta paginada do cadastro de bens via API backend.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
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

export default function AssetsExplorer({ initialUnidadeDonaId = null }) {
  const auth = useAuth();
  const [stats, setStats] = useState({ loading: false, data: null, error: null });
  const [list, setList] = useState({ loading: false, data: null, error: null });
  const [formError, setFormError] = useState(null);
  const [tipoBusca4Digitos, setTipoBusca4Digitos] = useState(null);
  const [tagIdModal, setTagIdModal] = useState({ isOpen: false, value: "" });
  const [detail, setDetail] = useState({ open: false, loading: false, data: null, error: null });
  const [filters, setFilters] = useState({
    numeroTombamento: "",
    codigoCatalogo: "",
    q: "",
    localId: "",
    unidadeDonaId: "",
    status: "",
  });
  const [paging, setPaging] = useState({ limit: 50, offset: 0, total: 0 });
  const [listView, setListView] = useState({
    showItemPhoto: false,
    showCatalogPhoto: false,
  });
  const [copyFeedback, setCopyFeedback] = useState("");

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
      setTagIdModal({ isOpen: true, value: tombo });
      return;
    }
    if (/^\d{10}$/.test(tombo) && tipoBusca4Digitos) {
      setTipoBusca4Digitos(null);
    }
    loadList(0);
  };

  const onClear = () => {
    setFormError(null);
    setTipoBusca4Digitos(null);
    setTagIdModal({ isOpen: false, value: "" });
    const clearedFilters = { numeroTombamento: "", codigoCatalogo: "", q: "", localId: "", unidadeDonaId: "", status: "" };
    setFilters(clearedFilters);
    setPaging((prev) => ({ ...prev, offset: 0 }));
    setTimeout(() => loadList(0, undefined, clearedFilters), 0);
  };

  const onSelectTipoBusca = async (tipoBusca) => {
    setFormError(null);
    setTipoBusca4Digitos(tipoBusca);
    setTagIdModal({ isOpen: false, value: "" });
    await loadList(0, tipoBusca);
  };

  const items = list.data?.items || [];

  const aplicarMesmoCatalogo = (codigoCatalogo) => {
    const codigo = String(codigoCatalogo || "").trim();
    if (!codigo) return;
    setFormError(null);
    setTipoBusca4Digitos(null);
    setTagIdModal({ isOpen: false, value: "" });
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

  return (
    <section className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="space-y-2">
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Consulta de Bens</h2>
        <p className="text-sm text-slate-600">
          Esta tela consulta o Supabase via backend. Use tombamento (10 digitos), etiqueta de 4 digitos (azul/sufixo), codigo do material (SKU) ou texto da descricao.
        </p>
      </header>

      <article className="grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => applyUnidadeFilter(null)}
          className={`rounded-xl border p-4 text-left transition ${
            !filters.unidadeDonaId
              ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
          title="Clique para listar bens de todas as unidades"
        >
          <p className="text-xs uppercase tracking-widest text-slate-500">Total bens</p>
          {stats.loading && <p className="mt-2 text-sm text-slate-600">Carregando...</p>}
          {stats.error && <p className="mt-2 text-sm text-rose-700">{stats.error}</p>}
          {stats.data && (
            <p className="mt-2 font-[Space_Grotesk] text-3xl font-bold text-violet-700">
              {stats.data.bens.total}
            </p>
          )}
        </button>
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
          <p className="text-xs uppercase tracking-widest text-slate-500">Bens por unidade</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {unitSummary.map((row) => (
              <button
                key={row.unidade}
                type="button"
                onClick={() => applyUnidadeFilter(row.unidade)}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  String(filters.unidadeDonaId) === String(row.unidade)
                    ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
                    : "border-slate-200 bg-slate-100 hover:bg-slate-200"
                }`}
                title={`Clique para listar apenas a unidade ${formatUnidade(row.unidade)}`}
              >
                <p className="text-xs text-slate-600">{formatUnidade(row.unidade)}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{row.total}</p>
              </button>
            ))}
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Filtros</h3>
        <form onSubmit={onSubmit} className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Tombamento (10) ou Etiqueta (4)</span>
            <input
              value={filters.numeroTombamento}
              onChange={(e) => {
                // Normaliza entrada para evitar falhas por espacos/aspas ao colar.
                const raw = String(e.target.value || "");
                const normalized = raw.replace(/^\"+|\"+$/g, "").replace(/\D+/g, "").slice(0, 10);
                setFilters((prev) => ({ ...prev, numeroTombamento: normalized }));
                if (normalized.length !== 4 || normalized !== String(filters.numeroTombamento || "")) {
                  setTipoBusca4Digitos(null);
                }
                setFormError(null);
              }}
              placeholder="Ex.: 1290001788 ou 2657"
              inputMode="numeric"
              maxLength={10}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            {filters.numeroTombamento.length === 4 && (
              <p className="text-[11px] text-slate-500">
                {tipoBusca4Digitos
                  ? `Busca de 4 digitos selecionada: ${tipoBusca4Digitos === "antigo" ? "Etiqueta azul antiga" : "Etiqueta nova impressa errada"}.`
                  : "Ao consultar, o sistema vai perguntar se este codigo e etiqueta azul antiga ou etiqueta nova impressa errada."}
              </p>
            )}
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">Texto na descricao</span>
            <input
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              placeholder="Ex.: ARMARIO, PROJETOR, NOTEBOOK"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Numero do material (SKU)</span>
            <input
              value={filters.codigoCatalogo}
              onChange={(e) => setFilters((prev) => ({ ...prev, codigoCatalogo: e.target.value }))}
              placeholder="Ex.: 101004470"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Unidade</span>
            <select
              value={filters.unidadeDonaId}
              onChange={(e) => setFilters((prev) => ({ ...prev, unidadeDonaId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u || "all"} value={u}>
                  {u ? formatUnidade(Number(u)) : "Todas"}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">Sala (local cadastrado)</span>
            <select
              value={filters.localId}
              onChange={(e) => setFilters((prev) => ({ ...prev, localId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todas as salas</option>
              {locaisFiltroOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {`${l.nome}${l.unidadeId ? ` (${formatUnidade(Number(l.unidadeId))})` : ""}`}
                </option>
              ))}
            </select>
            {locaisFiltroQuery.isLoading ? (
              <p className="text-[11px] text-slate-500">Carregando salas...</p>
            ) : null}
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Status</span>
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s || "all"} value={s}>
                  {s || "Todos"}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-3 md:col-span-4">
            <button
              type="submit"
              disabled={list.loading}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {list.loading ? "Consultando..." : "Consultar"}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            >
              Limpar
            </button>
          </div>
        </form>
        {formError && <p className="mt-3 text-sm text-rose-700">{formError}</p>}
        {list.error && <p className="mt-3 text-sm text-rose-700">{list.error}</p>}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Resultados</h3>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={listView.showItemPhoto}
                onChange={(e) => setListView((prev) => ({ ...prev, showItemPhoto: e.target.checked }))}
                className="h-4 w-4 accent-violet-600"
              />
              Foto do item
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={listView.showCatalogPhoto}
                onChange={(e) => setListView((prev) => ({ ...prev, showCatalogPhoto: e.target.checked }))}
                className="h-4 w-4 accent-violet-600"
              />
              Foto do catálogo
            </label>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            {copyFeedback ? (
              <span className={`rounded-md px-2 py-1 font-semibold ${copyFeedback === "Número copiado" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {copyFeedback}
              </span>
            ) : null}
            <span>
              {paging.total ? `${paging.offset + 1}-${Math.min(paging.offset + paging.limit, paging.total)}` : "0"} de{" "}
              {paging.total}
            </span>
            <button
              type="button"
              disabled={!canPrev || list.loading}
              onClick={() => loadList(Math.max(0, paging.offset - paging.limit))}
              className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!canNext || list.loading}
              onClick={() => loadList(paging.offset + paging.limit)}
              className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40"
            >
              Proxima
            </button>
          </div>
        </div>

        <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2">Tombo</th>
                <th className="px-3 py-2">Antigo (Azul)</th>
                <th className="px-3 py-2">Material (SKU)</th>
                <th className="px-3 py-2">Descrição / Resumo</th>
                {listView.showItemPhoto && <th className="px-3 py-2">Foto Item</th>}
                {listView.showCatalogPhoto && <th className="px-3 py-2">Foto Catálogo</th>}
                <th className="px-3 py-2">Unidade</th>
                <th className="px-3 py-2">Local</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-center">Obs</th>
                <th className="px-3 py-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-slate-50">
              {items.length === 0 && !list.loading && (
                <tr>
                  <td colSpan={9 + (listView.showItemPhoto ? 1 : 0) + (listView.showCatalogPhoto ? 1 : 0)} className="px-3 py-8 text-center text-sm text-slate-600">
                    Nenhum bem encontrado para os filtros informados.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => copyTombamento(item.numeroTombamento)}
                      className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 hover:bg-slate-200"
                      title="Clique para copiar o tombamento"
                    >
                      {item.numeroTombamento || "-"}
                    </button>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-violet-700">
                    {item.cod2Aud || "-"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {item.codigoCatalogo ? (
                      <button
                        type="button"
                        onClick={() => aplicarMesmoCatalogo(item.codigoCatalogo)}
                        className="text-emerald-700 hover:underline"
                        title="Filtrar por este material (SKU)"
                      >
                        {item.codigoCatalogo}
                      </button>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">
                      {item.nomeResumo || item.descricao}
                    </div>
                    {item.nomeResumo && item.nomeResumo !== item.catalogoDescricao && (
                      <div className="text-[10px] text-slate-500 italic">
                        {item.catalogoDescricao}
                      </div>
                    )}
                  </td>
                  {listView.showItemPhoto && (
                    <td className="px-3 py-2">
                      {item.fotoUrl ? (
                        <a href={getFotoUrl(item.fotoUrl)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={getFotoUrl(item.fotoUrl)}
                            alt={`Foto item ${item.numeroTombamento || ""}`}
                            className="h-10 w-10 rounded border border-slate-300 object-cover"
                          />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500">-</span>
                      )}
                    </td>
                  )}
                  {listView.showCatalogPhoto && (
                    <td className="px-3 py-2">
                      {item.fotoReferenciaUrl ? (
                        <a href={getFotoUrl(item.fotoReferenciaUrl)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={getFotoUrl(item.fotoReferenciaUrl)}
                            alt={`Foto catálogo ${item.codigoCatalogo || ""}`}
                            className="h-10 w-10 rounded border border-slate-300 object-cover"
                          />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500">-</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-xs text-slate-800">
                    {formatUnidade(Number(item.unidadeDonaId))}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{item.localNome || item.localFisico || "-"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {item.temDivergenciaPendente && (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white" title="Divergência Pendente!">
                        !
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => openDetail(item.id)}
                        className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                      >
                        Detalhes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

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
                onClick={() => onSelectTipoBusca("antigo")}
                className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left transition-colors hover:bg-violet-100"
              >
                <div className="font-bold text-violet-700">Etiqueta Antiga (Azul)</div>
                <div className="text-xs text-slate-500">Busca por Cod2Aud da 2ª Auditoria</div>
              </button>
              <button
                type="button"
                onClick={() => onSelectTipoBusca("novo")}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100"
              >
                <div className="font-bold text-emerald-700">Etiqueta Nova (Erro)</div>
                <div className="text-xs text-slate-500">Busca pelo sufixo de 4 digitos no tombamento GEAFIN</div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTagIdModal({ isOpen: false, value: "" })}
              className="mt-6 w-full rounded-xl py-2 text-sm text-slate-500 hover:text-slate-900"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {detail.open && (
        <BemDetailModal
          state={detail}
          onClose={closeDetail}
          onReload={() => openDetail(detail?.data?.bem?.id)}
          isAdmin={String(auth?.role || "").toUpperCase() === "ADMIN"}
        />
      )}
    </section>
  );
}

function BemDetailModal({ state, onClose, onReload, isAdmin }) {
  const imp = state?.data?.bem || null;
  const catalogo = state?.data?.catalogo || null;
  const movs = state?.data?.movimentacoes || [];
  const divergenciaPendente = imp?.divergenciaPendente || state?.data?.divergenciaPendente || null;
  const cautelaAtual = useMemo(() => {
    if (String(imp?.status || "").toUpperCase() !== "EM_CAUTELA") return null;
    return movs.find((m) => String(m?.tipoMovimentacao || "").toUpperCase() === "CAUTELA_SAIDA") || null;
  }, [imp?.status, movs]);

  const formatDateTime = (raw) => {
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return String(raw);
    return d.toLocaleString();
  };
  const extractSalaChange = (justificativa) => {
    const s = String(justificativa || "");
    const m = s.match(/Antes:\s*(.+?)\.\s*Depois:\s*(.+?)(?:\.|$)/i);
    if (!m) return null;
    return { antes: String(m[1] || "").trim(), depois: String(m[2] || "").trim() };
  };
  const movementChangeSummary = (m) => {
    const out = [];
    const origem = Number(m?.unidadeOrigemId);
    const destino = Number(m?.unidadeDestinoId);
    if (Number.isInteger(origem) && Number.isInteger(destino) && origem !== destino) {
      out.push(`Unidade: ${formatUnidade(origem)} -> ${formatUnidade(destino)}`);
    }
    const sala = extractSalaChange(m?.justificativa);
    if (sala) {
      out.push(`Sala: ${sala.antes || "-"} -> ${sala.depois || "-"}`);
    } else if (String(m?.tipoMovimentacao || "").toUpperCase() === "REGULARIZACAO_INVENTARIO" && m?.regularizacaoSalaEncontrada) {
      out.push(`Sala regularizada: ${m.regularizacaoSalaEncontrada}`);
    }
    return out.length ? out.join(" | ") : "Sem detalhe de alteracao";
  };
  const profileLabel = (nome, matricula, id) => {
    if (nome && matricula) return `${nome} (${matricula})`;
    if (nome) return nome;
    if (matricula) return `Matricula ${matricula}`;
    return id || "-";
  };
  const extractCautelaDestino = (justificativa) => {
    const s = String(justificativa || "");
    const m = s.match(/\[CAUTELA_DESTINO=(EXTERNO|SALA:([^\]]+))\]/i);
    if (!m) return null;
    if (String(m[1] || "").toUpperCase() === "EXTERNO") return { tipo: "EXTERNO", label: "Externo" };
    return { tipo: "SALA", label: String(m[2] || "").trim() || "-" };
  };

  const editBaseState = useMemo(() => ({
    catalogoBemId: imp?.catalogoBemId || "",
    unidadeDonaId: imp?.unidadeDonaId ? String(imp.unidadeDonaId) : "",
    nomeResumo: imp?.nomeResumo || "",
    status: imp?.status || "",
    descricaoComplementar: imp?.descricaoComplementar || "",
    responsavelPerfilId: imp?.responsavelPerfilId || "",
    contratoReferencia: imp?.contratoReferencia || "",
    dataAquisicao: imp?.dataAquisicao ? String(imp.dataAquisicao).slice(0, 10) : "",
    valorAquisicao: imp?.valorAquisicao != null ? String(imp.valorAquisicao) : "",
    localId: imp?.localId || "",
    fotoUrl: imp?.fotoUrl || "",
    fotoReferenciaUrl: catalogo?.fotoReferenciaUrl || "",
  }), [
    catalogo?.fotoReferenciaUrl,
    imp?.catalogoBemId,
    imp?.contratoReferencia,
    imp?.dataAquisicao,
    imp?.descricaoComplementar,
    imp?.fotoUrl,
    imp?.localId,
    imp?.nomeResumo,
    imp?.responsavelPerfilId,
    imp?.status,
    imp?.unidadeDonaId,
    imp?.valorAquisicao,
  ]);
  const [edit, setEdit] = useState(editBaseState);
  const [editMsg, setEditMsg] = useState(null);
  const [editErr, setEditErr] = useState(null);
  const [uploadState, setUploadState] = useState({ loading: false, error: null });
  const itemFileRef = useRef(null);
  const itemCameraRef = useRef(null);
  const catalogFileRef = useRef(null);
  const catalogCameraRef = useRef(null);

  useEffect(() => {
    setEdit(editBaseState);
    setEditMsg(null);
    setEditErr(null);
    setUploadState({ loading: false, error: null });
  }, [editBaseState, imp?.id, catalogo?.id]);

  const locaisQuery = useQuery({
    queryKey: ["locais", "todos"],
    enabled: Boolean(imp?.id),
    queryFn: async () => {
      const data = await listarLocais({});
      return data.items || [];
    },
  });

  const locaisOptions = useMemo(() => {
    const unidade = imp?.unidadeDonaId != null ? Number(imp.unidadeDonaId) : null;
    return (locaisQuery.data || []).filter((l) => {
      if (l.ativo === false) return false;
      if (unidade == null) return true;
      return l.unidadeId == null || Number(l.unidadeId) === unidade;
    });
  }, [locaisQuery.data, imp?.unidadeDonaId]);
  const cautelaDestinoAtual = useMemo(
    () => extractCautelaDestino(cautelaAtual?.justificativa),
    [cautelaAtual?.justificativa],
  );
  const salaPadronizadaAtual = useMemo(() => {
    const localId = String(imp?.localId || "").trim();
    if (localId) {
      const found = (locaisQuery.data || []).find((l) => String(l.id) === localId);
      if (found?.nome) return found.nome;
      return localId;
    }
    if (String(imp?.status || "").toUpperCase() === "EM_CAUTELA" && cautelaDestinoAtual?.tipo === "EXTERNO") {
      return "Externo";
    }
    if (String(imp?.localFisico || "").trim().toUpperCase() === "EXTERNO") return "Externo";
    return "-";
  }, [imp?.localId, imp?.status, imp?.localFisico, locaisQuery.data, cautelaDestinoAtual?.tipo]);
  const [expandedMovId, setExpandedMovId] = useState(null);
  const [materialCodigoBusca, setMaterialCodigoBusca] = useState("");
  const [materialBuscaState, setMaterialBuscaState] = useState({
    loading: false,
    error: null,
    candidato: null,
  });

  useEffect(() => {
    setMaterialCodigoBusca(String(catalogo?.codigoCatalogo || ""));
    setMaterialBuscaState({ loading: false, error: null, candidato: null });
  }, [catalogo?.codigoCatalogo, imp?.id]);

  const hasUnsavedChanges = useMemo(() => {
    if (!isAdmin || !imp) return false;
    const normalize = (v) => (v == null ? "" : String(v));
    const serialize = (obj) =>
      JSON.stringify({
        catalogoBemId: normalize(obj.catalogoBemId),
        unidadeDonaId: normalize(obj.unidadeDonaId),
        nomeResumo: normalize(obj.nomeResumo),
        status: normalize(obj.status),
        descricaoComplementar: normalize(obj.descricaoComplementar),
        responsavelPerfilId: normalize(obj.responsavelPerfilId),
        contratoReferencia: normalize(obj.contratoReferencia),
        dataAquisicao: normalize(obj.dataAquisicao),
        valorAquisicao: normalize(obj.valorAquisicao),
        localId: normalize(obj.localId),
        fotoUrl: normalize(obj.fotoUrl),
        fotoReferenciaUrl: normalize(obj.fotoReferenciaUrl),
      });
    return serialize(edit) !== serialize(editBaseState);
  }, [edit, editBaseState, imp, isAdmin]);

  const requestClose = () => {
    if (hasUnsavedChanges) {
      const ok = window.confirm("Existem alteracoes nao salvas. Deseja fechar o modal sem salvar?");
      if (!ok) return;
    }
    onClose?.();
  };

  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
      reader.onload = () => {
        const result = String(reader.result || "");
        const idx = result.indexOf("base64,");
        resolve(idx >= 0 ? result.slice(idx + 7) : result);
      };
      reader.readAsDataURL(file);
    });

  const doUploadFoto = async ({ target, file }) => {
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) throw new Error("Foto grande demais (max 5MB).");
    const base64Data = await readFileAsBase64(file);
    const entityId = target === "BEM" ? String(imp?.id || "") : String(catalogo?.id || imp?.catalogoBemId || "");
    if (!entityId) throw new Error("Id ausente para upload.");
    return uploadFoto({
      target,
      id: entityId,
      filename: String(file.name || "foto.jpg"),
      mimeType: String(file.type || "image/jpeg"),
      base64Data,
    });
  };

  const buscarMaterialPorCodigo = async () => {
    const codigo = String(materialCodigoBusca || "").trim();
    if (!codigo) {
      setMaterialBuscaState({ loading: false, error: "Informe o numero do material (SKU).", candidato: null });
      return;
    }
    setMaterialBuscaState({ loading: true, error: null, candidato: null });
    try {
      const data = await listarCatalogos({ codigoCatalogo: codigo, limit: 30, offset: 0 });
      const items = data?.items || [];
      const exact = items.find((m) => String(m?.codigoCatalogo || "").trim() === codigo) || null;
      const candidato = exact || items[0] || null;
      if (!candidato) {
        setMaterialBuscaState({
          loading: false,
          error: `Nenhum material cadastrado encontrado para o codigo ${codigo}.`,
          candidato: null,
        });
        return;
      }
      setMaterialBuscaState({ loading: false, error: null, candidato });
    } catch (e) {
      setMaterialBuscaState({
        loading: false,
        error: String(e?.message || "Falha ao buscar material por codigo."),
        candidato: null,
      });
    }
  };

  const salvarBemMut = useMutation({
    mutationFn: async () => {
      if (!imp?.id) throw new Error("BemId ausente.");

      const bemUpdated = await atualizarBem(imp.id, {
        catalogoBemId: edit.catalogoBemId ? String(edit.catalogoBemId).trim() : undefined,
        nomeResumo: edit.nomeResumo || null,
        descricaoComplementar: edit.descricaoComplementar || null,
        responsavelPerfilId: edit.responsavelPerfilId || null,
        contratoReferencia: edit.contratoReferencia || null,
        dataAquisicao: edit.dataAquisicao || null,
        valorAquisicao: edit.valorAquisicao !== "" ? Number(edit.valorAquisicao) : null,
        localFisico: null,
        localId: edit.localId ? String(edit.localId) : null,
        fotoUrl: edit.fotoUrl || null,
      });

      // Atualiza foto do catálogo se houve alteração
      const targetCatalogoId = edit.catalogoBemId || catalogo?.id;
      const currentRefUrl = catalogo?.fotoReferenciaUrl || "";
      const newRefUrl = edit.fotoReferenciaUrl || "";

      // Compara ignorando nulos/vazios iguais
      if (targetCatalogoId && (newRefUrl !== currentRefUrl)) {
        await atualizarFotoCatalogo(targetCatalogoId, newRefUrl || null);
      }

      return bemUpdated;
    },
    onSuccess: async () => {
      setEditMsg("Bem atualizado.");
      setEditErr(null);
      await onReload?.();
    },
    onError: (e) => {
      setEditErr(String(e?.message || "Falha ao atualizar bem."));
      setEditMsg(null);
    },
  });

  const uploadFotoMut = useMutation({
    mutationFn: async ({ target, file }) => doUploadFoto({ target, file }),
    onSuccess: async (data, vars) => {
      const url = data?.fotoUrl || data?.driveUrl || data?.url || "";
      if (!url) throw new Error("Upload retornou sem URL.");

      if (vars?.target === "BEM") {
        setEdit((p) => ({ ...p, fotoUrl: url }));
        setEditMsg("Foto do item salva e vinculada ao bem.");
      } else {
        setEdit((p) => ({ ...p, fotoReferenciaUrl: url }));
        setEditMsg("Foto de referência salva e vinculada ao catálogo.");
      }
      setEditErr(null);
      await onReload?.();
    },
    onError: (e) => {
      setEditErr(String(e?.message || "Falha ao enviar foto."));
      setEditMsg(null);
    },
  });

  const auditoriaQuery = useQuery({
    queryKey: ["bemAuditoria", imp?.id],
    enabled: Boolean(imp?.id),
    queryFn: async () => {
      const data = await getBemAuditoria(imp.id, { limit: 120 });
      return data.items || [];
    },
  });

  const reverterMut = useMutation({
    mutationFn: async ({ auditId }) => {
      if (!imp?.id) throw new Error("BemId ausente.");
      return reverterBemAuditoria(imp.id, auditId);
    },
    onSuccess: async () => {
      setEditMsg("Alteracao revertida com sucesso.");
      setEditErr(null);
      await auditoriaQuery.refetch();
      await onReload?.();
    },
    onError: (e) => {
      setEditErr(String(e?.message || "Falha ao reverter alteracao."));
      setEditMsg(null);
    },
  });

  const formatFieldValue = (v) => {
    if (v == null) return "-";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch (_e) {
        return String(v);
      }
    }
    const s = String(v);
    return s.trim() ? s : "-";
  };
  const renderAuditValue = (rawValue, resolvedLabel, resolvedId) => {
    const display = resolvedLabel || formatFieldValue(rawValue);
    if (!resolvedId) return <span>{display}</span>;
    return (
      <span
        className="inline-flex max-w-full cursor-help items-center"
        title={`ID: ${resolvedId}`}
        tabIndex={0}
      >
        <span className="truncate border-b border-dotted border-slate-500/80">{display}</span>
      </span>
    );
  };
  const fieldLabel = (field) => {
    const map = {
      __operacao: "Operacao",
      local_fisico: "Sala / Local",
      local_id: "Local",
      unidade_dona_id: "Unidade dona",
      nome_resumo: "Nome resumo",
      descricao_complementar: "Descricao complementar",
      foto_url: "Foto do item",
      foto_referencia_url: "Foto do catalogo",
      catalogo_bem_id: "Catalogo",
      responsavel_perfil_id: "Responsavel",
      encontrado_por_perfil_id: "Encontrado por",
      regularizado_por_perfil_id: "Regularizado por",
      executada_por_perfil_id: "Executado por",
      autorizada_por_perfil_id: "Autorizado por",
      aberto_por_perfil_id: "Aberto por",
      encerrado_por_perfil_id: "Encerrado por",
      bem_id: "Bem",
      status: "Status",
      contrato_referencia: "Contrato",
      data_aquisicao: "Data aquisicao",
      valor_aquisicao: "Valor aquisicao",
      descricao: "Descricao catalogo",
      grupo: "Grupo catalogo",
      material_permanente: "Material permanente",
    };
    return map[field] || field;
  };
  const actorLabel = (item) => {
    if (item?.actorNome && item?.actorMatricula) return `${item.actorNome} (${item.actorMatricula})`;
    if (item?.actorNome) return item.actorNome;
    if (item?.executorNome && item?.executorMatricula) return `${item.executorNome} (${item.executorMatricula})`;
    if (item?.executorNome) return item.executorNome;
    return item?.executadoPor || "-";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-100 p-4 backdrop-blur">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-slate-500">Detalhes do bem</p>
            <p className="mt-1 truncate font-[Space_Grotesk] text-lg font-semibold text-slate-900">
              {imp?.numeroTombamento ? `Tombo ${imp.numeroTombamento}` : "Bem"}
              {imp?.status ? <span className="text-slate-500"> {" "}({imp.status})</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>

        <div className="max-h-[75vh] overflow-auto p-4">
          {state.loading && <p className="text-sm text-slate-600">Carregando detalhes...</p>}
          {state.error && <p className="text-sm text-rose-700">{state.error}</p>}

          {!state.loading && !state.error && imp && (
            <div className="space-y-4">
              {divergenciaPendente && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-4">
                  <div className="flex items-center gap-3 text-rose-700">
                    <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <h3 className="font-bold uppercase tracking-wide">Divergência Pendente Detectada!</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">
                    Este bem foi encontrado em local divergente em <strong>{new Date(divergenciaPendente.encontradoEm).toLocaleString()}</strong>.
                    Local encontrado: <strong>{divergenciaPendente.salaEncontrada}</strong> ({formatUnidade(divergenciaPendente.unidadeEncontradaId)}).
                  </p>
                  <p className="mt-1 text-xs text-rose-700 font-medium">
                    Art. 185 (ATN 303): Regularização pendente.
                  </p>
                </div>
              )}

              <section className="grid gap-3 md:grid-cols-2">

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Operacional</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row k="BemId" v={imp.id} mono />
                    <Row k="Unidade (carga)" v={formatUnidade(Number(imp.unidadeDonaId))} />
                    <Row k="Tomb. Antigo (Azul)" v={imp.cod2Aud} />
                    <Row k="Nome Resumo" v={imp.nomeResumo} />
                    <Row k="Sala/Local (padronizado)" v={salaPadronizadaAtual} />
                    <Row k="Status" v={imp.status} />
                    <Row k="Valor aquisição" v={imp.valorAquisicao} />
                    <Row k="Data aquisição" v={imp.dataAquisicao} />
                    <Row k="Contrato" v={imp.contratoReferencia} />
                    <Row k="Foto (item)" v={imp.fotoUrl} />
                    <Row k="Criado em" v={imp.createdAt} />
                    <Row k="Atualizado em" v={imp.updatedAt} />
                  </dl>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Material (SKU)</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row k="Material (SKU) id" v={catalogo?.id || imp.catalogoBemId} mono />
                    <Row k="Codigo material (SKU)" v={catalogo?.codigoCatalogo} />
                    <Row k="Descrição" v={catalogo?.descricao} />
                    <Row k="Grupo" v={catalogo?.grupo} />
                    <Row k="Material permanente" v={String(Boolean(catalogo?.materialPermanente))} />
                    <Row k="Foto (referência)" v={catalogo?.fotoReferenciaUrl} />
                  </dl>
                </div>
              </section>

              {isAdmin ? (
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Editar (ADMIN)</p>
                    <p className="text-[11px] text-slate-500">
                      Edite campos operacionais (exceto chaves). Sala/Local vem do cadastro de locais.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Material (SKU)</span>
                      <p className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        Atual: <strong>{catalogo?.codigoCatalogo || "-"}</strong>
                      </p>
                      <p className="text-[11px] font-semibold text-amber-700">
                        Atenção: o Material (SKU) deve ser o mesmo cadastrado no GEAFIN para evitar divergências.
                      </p>
                      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                        <input
                          value={materialCodigoBusca}
                          onChange={(e) => setMaterialCodigoBusca(e.target.value)}
                          placeholder="Digite o numero do material (SKU)"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={buscarMaterialPorCodigo}
                          disabled={materialBuscaState.loading}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                          {materialBuscaState.loading ? "Buscando..." : "Buscar codigo"}
                        </button>
                      </div>
                      {materialBuscaState.error ? (
                        <p className="text-[11px] text-rose-700">{materialBuscaState.error}</p>
                      ) : null}
                      {materialBuscaState.candidato ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900">
                          <p>
                            Codigo: <strong>{materialBuscaState.candidato.codigoCatalogo || "-"}</strong>
                          </p>
                          <p>
                            Descrição: <strong>{materialBuscaState.candidato.descricao || "-"}</strong>
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const c = materialBuscaState.candidato;
                              if (!c?.id) return;
                              const ok = window.confirm(
                                `Confirmar uso do material ${c.codigoCatalogo || "-"}?\n\n${c.descricao || "Sem descricao"}`
                              );
                              if (!ok) return;
                              setEdit((p) => ({ ...p, catalogoBemId: c.id }));
                              setEditMsg(`Material (SKU) ${c.codigoCatalogo || ""} selecionado.`);
                              setEditErr(null);
                            }}
                            className="mt-2 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                          >
                            Confirmar este material
                          </button>
                        </div>
                      ) : null}
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Unidade (carga)</span>
                      <p className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        {formatUnidade(Number(imp?.unidadeDonaId))}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Alteracao de unidade nao e permitida aqui. Use Movimentacoes / TRANSFERENCIA.
                      </p>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Status do bem</span>
                      <p className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                        {String(imp?.status || "-")}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Alteracao de status nao e permitida aqui. Use o procedimento proprio em Movimentacoes (ex.: Cautela).
                      </p>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Sala/Local (padronizado)</span>
                      <select
                        value={edit.localId || ""}
                        onChange={(e) => setEdit((p) => ({ ...p, localId: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">(nenhum)</option>
                        {locaisOptions.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.nome}
                          </option>
                        ))}
                      </select>
                      {locaisQuery.isLoading ? (
                        <p className="text-[11px] text-slate-500">Carregando locais cadastrados...</p>
                      ) : null}
                    </label>

                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Nome Resumo</span>
                      <input
                        value={edit.nomeResumo}
                        onChange={(e) => setEdit((p) => ({ ...p, nomeResumo: e.target.value }))}
                        placeholder="Resumo curto para exibição em listas"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs text-slate-600">Descrição complementar (item)</span>
                      <input
                        value={edit.descricaoComplementar}
                        onChange={(e) => setEdit((p) => ({ ...p, descricaoComplementar: e.target.value }))}
                        placeholder="Ex.: Cadeira com avaria no braço direito..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Responsável (perfilId UUID)</span>
                      <input
                        value={edit.responsavelPerfilId}
                        onChange={(e) => setEdit((p) => ({ ...p, responsavelPerfilId: e.target.value }))}
                        placeholder="UUID do perfil responsável"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Contrato referência</span>
                      <input
                        value={edit.contratoReferencia}
                        onChange={(e) => setEdit((p) => ({ ...p, contratoReferencia: e.target.value }))}
                        placeholder="Ex.: Contrato 12/2026"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Data de aquisição</span>
                      <input
                        value={edit.dataAquisicao}
                        onChange={(e) => setEdit((p) => ({ ...p, dataAquisicao: e.target.value }))}
                        type="date"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-600">Valor de aquisição</span>
                      <input
                        value={edit.valorAquisicao}
                        onChange={(e) => setEdit((p) => ({ ...p, valorAquisicao: e.target.value }))}
                        inputMode="decimal"
                        placeholder="Ex.: 3500.00"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>

                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Foto do item</p>
                      {edit.fotoUrl ? (
                        <a href={getFotoUrl(edit.fotoUrl)} target="_blank" rel="noopener noreferrer" className="block mt-2">
                          <img
                            src={getFotoUrl(edit.fotoUrl)}
                            alt="Foto do item"
                            className="h-40 w-full object-contain rounded bg-black/20"
                          />
                        </a>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500 italic text-center py-4 border border-dashed border-slate-200 rounded">Sem foto</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => itemCameraRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-50"
                        >
                          Tirar foto
                        </button>
                        <button
                          type="button"
                          onClick={() => itemFileRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-50"
                        >
                          Enviar arquivo
                        </button>
                      </div>
                      {edit.fotoUrl && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Remover foto do item?")) {
                                setEdit((p) => ({ ...p, fotoUrl: null }));
                                setEditMsg("Foto removida. Clique em 'Salvar alterações do bem' para confirmar.");
                              }
                            }}
                            disabled={uploadFotoMut.isPending}
                            className="rounded-lg border border-rose-300 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            Remover foto
                          </button>
                        </div>
                      )}
                      <input
                        ref={itemCameraRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setUploadState({ loading: true, error: null });
                          try {
                            await uploadFotoMut.mutateAsync({ target: "BEM", file });
                          } finally {
                            setUploadState({ loading: false, error: null });
                          }
                        }}
                      />
                      <input
                        ref={itemFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setUploadState({ loading: true, error: null });
                          try {
                            await uploadFotoMut.mutateAsync({ target: "BEM", file });
                          } finally {
                            setUploadState({ loading: false, error: null });
                          }
                        }}
                      />
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Foto de referência (SKU)</p>
                      {edit.fotoReferenciaUrl ? (
                        <a href={getFotoUrl(edit.fotoReferenciaUrl)} target="_blank" rel="noopener noreferrer" className="block mt-2">
                          <img
                            src={getFotoUrl(edit.fotoReferenciaUrl)}
                            alt="Foto de referência"
                            className="h-40 w-full object-contain rounded bg-black/20"
                          />
                        </a>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500 italic text-center py-4 border border-dashed border-slate-200 rounded">Sem foto</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => catalogCameraRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-50"
                        >
                          Tirar foto
                        </button>
                        <button
                          type="button"
                          onClick={() => catalogFileRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-50"
                        >
                          Enviar arquivo
                        </button>
                      </div>
                      {edit.fotoReferenciaUrl && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Remover foto de referência?")) {
                                setEdit((p) => ({ ...p, fotoReferenciaUrl: null }));
                                setEditMsg("Foto removida. Clique em 'Salvar alterações do bem' para confirmar.");
                              }
                            }}
                            disabled={uploadFotoMut.isPending}
                            className="rounded-lg border border-rose-300 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            Remover foto
                          </button>
                        </div>
                      )}
                      <input
                        ref={catalogCameraRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setUploadState({ loading: true, error: null });
                          try {
                            await uploadFotoMut.mutateAsync({ target: "CATALOGO", file });
                          } finally {
                            setUploadState({ loading: false, error: null });
                          }
                        }}
                      />
                      <input
                        ref={catalogFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          setUploadState({ loading: true, error: null });
                          try {
                            await uploadFotoMut.mutateAsync({ target: "CATALOGO", file });
                          } finally {
                            setUploadState({ loading: false, error: null });
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => salvarBemMut.mutate()}
                      disabled={salvarBemMut.isPending}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {salvarBemMut.isPending ? "Salvando..." : "Salvar alterações do bem"}
                    </button>
                    {uploadFotoMut.isPending ? <span className="text-xs text-slate-600">Enviando foto...</span> : null}
                    {editMsg ? <span className="text-xs text-emerald-700">{editMsg}</span> : null}
                    {editErr ? <span className="text-xs text-rose-700">{editErr}</span> : null}
                  </div>
                </section>
              ) : null}

              {String(imp?.status || "").toUpperCase() === "EM_CAUTELA" ? (
                <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-widest text-amber-700">Cautela atual</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row k="Detentor Matrícula" v={cautelaAtual?.detentorTemporarioMatricula} />
                    <Row k="Detentor Nome" v={cautelaAtual?.detentorTemporarioNome} />
                    <Row k="Local da cautela" v={cautelaDestinoAtual?.label || salaPadronizadaAtual} />
                    <Row k="Data da cautela" v={formatDateTime(cautelaAtual?.executadaEm || cautelaAtual?.createdAt)} />
                    <Row k="Data prevista devolução" v={cautelaAtual?.dataPrevistaDevolucao || "Sem data prevista"} />
                  </dl>
                </section>
              ) : null}

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">Movimentações</p>
                {movs.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">Nenhuma movimentacao registrada.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {movs.map((m) => {
                      const expanded = expandedMovId === m.id;
                      return (
                        <article key={m.id} className="rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setExpandedMovId((prev) => (prev === m.id ? null : m.id))}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900">
                                {m.tipoMovimentacao} - {formatDateTime(m.executadaEm || m.createdAt)}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-600">{movementChangeSummary(m)}</p>
                            </div>
                            <span className="text-xs text-slate-500">{expanded ? "Ocultar" : "Detalhes"}</span>
                          </button>
                          {expanded ? (
                            <div className="grid gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-700 md:grid-cols-2">
                              <p><span className="text-slate-500">Executado por:</span> {profileLabel(m.executadaPorNome, m.executadaPorMatricula, m.executadaPorPerfilId)}</p>
                              <p><span className="text-slate-500">Termo:</span> <span className="font-mono">{m.termoReferencia || "-"}</span></p>
                              <p><span className="text-slate-500">Origem:</span> {m.unidadeOrigemId != null ? formatUnidade(Number(m.unidadeOrigemId)) : "-"}</p>
                              <p><span className="text-slate-500">Destino:</span> {m.unidadeDestinoId != null ? formatUnidade(Number(m.unidadeDestinoId)) : "-"}</p>
                              <p><span className="text-slate-500">Detentor:</span> {m.detentorTemporarioNome || "-"}</p>
                              <p><span className="text-slate-500">Data prevista devolução:</span> {m.dataPrevistaDevolucao || "-"}</p>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-500">Linha do tempo de alterações</p>
                {auditoriaQuery.isLoading ? (
                  <p className="mt-2 text-sm text-slate-600">Carregando auditoria...</p>
                ) : auditoriaQuery.error ? (
                  <p className="mt-2 text-sm text-rose-700">Falha ao carregar auditoria.</p>
                ) : !(auditoriaQuery.data || []).length ? (
                  <p className="mt-2 text-sm text-slate-600">Nenhuma alteração auditada encontrada.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {(auditoriaQuery.data || []).map((a) => (
                      <details key={a.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {a.tabela} / {a.operacao}
                              </p>
                              <p className="text-xs text-slate-600">
                                {new Date(a.executadoEm).toLocaleString()} -{" "}
                                {a.actorPerfilId ? (
                                  <span
                                    className="cursor-help border-b border-dotted border-slate-500/80"
                                    title={`ID do responsavel: ${a.actorPerfilId}`}
                                    tabIndex={0}
                                  >
                                    {actorLabel(a)}
                                  </span>
                                ) : (
                                  actorLabel(a)
                                )}
                              </p>
                              <p className="mt-1 text-xs text-violet-700">
                                {(a.changes || []).slice(0, 4).map((c) => fieldLabel(c.field)).join(", ") || "Sem mudanças estruturadas"}
                              </p>
                            </div>
                            {isAdmin && a.canRevert ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const ok = window.confirm(`Reverter a alteracao ${a.id} em ${a.tabela}?`);
                                  if (!ok) return;
                                  reverterMut.mutate({ auditId: a.id });
                                }}
                                disabled={reverterMut.isPending}
                                className="rounded-lg border border-amber-300/40 bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200/20 disabled:opacity-50"
                              >
                                {reverterMut.isPending ? "Revertendo..." : "Reverter esta alteração"}
                              </button>
                            ) : null}
                          </div>
                        </summary>
                        <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                          <table className="min-w-full text-left text-xs">
                            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                              <tr>
                                <th className="px-2 py-2">Campo</th>
                                <th className="px-2 py-2">Antes</th>
                                <th className="px-2 py-2">Depois</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {(a.changes || []).map((c) => (
                                <tr key={`${a.id}-${c.field}`}>
                                  <td className="px-2 py-2 text-slate-800">{fieldLabel(c.field)}</td>
                                  <td className="px-2 py-2 text-slate-600">{renderAuditValue(c.before, c.beforeLabel, c.beforeId)}</td>
                                  <td className="px-2 py-2 text-slate-600">{renderAuditValue(c.after, c.afterLabel, c.afterId)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }) {
  const value = v == null || String(v).trim() === "" ? "-" : String(v);
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="text-xs text-slate-500">{k}</dt>
      <dd className={mono ? "break-all font-mono text-xs text-slate-800" : "text-sm text-slate-800"}>
        {value}
      </dd>
    </div>
  );
}

