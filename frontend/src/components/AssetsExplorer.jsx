/**
 * Modulo: frontend/components
 * Arquivo: AssetsExplorer.jsx
 * Funcao no sistema: consulta paginada do cadastro de bens via API backend.
 */
import { useEffect, useMemo, useState } from "react";
import { getBemDetalhe, getStats, listarBens } from "../services/apiClient.js";

const STATUS_OPTIONS = ["", "OK", "EM_CAUTELA", "BAIXADO", "AGUARDANDO_RECEBIMENTO"];
const UNIT_OPTIONS = ["", "1", "2", "3", "4"];

function formatUnidade(id) {
  if (id === 1) return "1 (1a Aud)";
  if (id === 2) return "2 (2a Aud)";
  if (id === 3) return "3 (Foro)";
  if (id === 4) return "4 (Almox)";
  return String(id || "");
}

export default function AssetsExplorer() {
  const [stats, setStats] = useState({ loading: false, data: null, error: null });
  const [list, setList] = useState({ loading: false, data: null, error: null });
  const [formError, setFormError] = useState(null);
  const [detail, setDetail] = useState({ open: false, loading: false, data: null, error: null });
  const [filters, setFilters] = useState({
    numeroTombamento: "",
    q: "",
    unidadeDonaId: "",
    status: "",
  });
  const [paging, setPaging] = useState({ limit: 50, offset: 0, total: 0 });

  const canPrev = paging.offset > 0;
  const canNext = paging.offset + paging.limit < paging.total;

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

  const loadStats = async () => {
    setStats({ loading: true, data: null, error: null });
    try {
      const data = await getStats(false);
      setStats({ loading: false, data, error: null });
    } catch (error) {
      setStats({ loading: false, data: null, error: error.message });
    }
  };

  const loadList = async (newOffset) => {
    setList({ loading: true, data: null, error: null });
    try {
      const data = await listarBens({
        numeroTombamento: filters.numeroTombamento.trim() || undefined,
        q: filters.q.trim() || undefined,
        unidadeDonaId: filters.unidadeDonaId ? Number(filters.unidadeDonaId) : undefined,
        status: filters.status || undefined,
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

  const onSubmit = (event) => {
    event.preventDefault();
    setFormError(null);

    const tombo = String(filters.numeroTombamento || "").trim();
    if (tombo && !/^\d{10}$/.test(tombo)) {
      setFormError("Tombamento invalido: informe exatamente 10 digitos (ex.: 1290001788).");
      return;
    }
    loadList(0);
  };

  const onClear = () => {
    setFormError(null);
    setFilters({ numeroTombamento: "", q: "", unidadeDonaId: "", status: "" });
    setPaging((prev) => ({ ...prev, offset: 0 }));
    setTimeout(() => loadList(0), 0);
  };

  const items = list.data?.items || [];

  const copyTombamento = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (_error) {
      // Clipboard pode falhar em alguns navegadores; sem efeito colateral.
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
    <section className="mt-6 space-y-6 rounded-2xl border border-white/15 bg-slate-900/55 p-6">
      <header className="space-y-2">
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Consulta de Bens (dados reais)</h2>
        <p className="text-sm text-slate-300">
          Esta tela consulta o Supabase via backend. Use tombamento (10 digitos) ou texto da descricao.
        </p>
      </header>

      <article className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Total bens</p>
          {stats.loading && <p className="mt-2 text-sm text-slate-300">Carregando...</p>}
          {stats.error && <p className="mt-2 text-sm text-rose-300">{stats.error}</p>}
          {stats.data && (
            <p className="mt-2 font-[Space_Grotesk] text-3xl font-bold text-cyan-200">
              {stats.data.bens.total}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-white/15 bg-slate-950/45 p-4 md:col-span-2">
          <p className="text-xs uppercase tracking-widest text-slate-400">Bens por unidade</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {unitSummary.map((row) => (
              <div key={row.unidade} className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2">
                <p className="text-xs text-slate-300">{formatUnidade(row.unidade)}</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{row.total}</p>
              </div>
            ))}
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
        <h3 className="font-semibold">Filtros</h3>
        <form onSubmit={onSubmit} className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Tombamento (10 digitos)</span>
            <input
              value={filters.numeroTombamento}
              onChange={(e) => {
                // Normaliza entrada para evitar falhas por espacos/aspas ao colar.
                const raw = String(e.target.value || "");
                const normalized = raw.replace(/^\"+|\"+$/g, "").replace(/\D+/g, "").slice(0, 10);
                setFilters((prev) => ({ ...prev, numeroTombamento: normalized }));
                setFormError(null);
              }}
              placeholder="Ex.: 1290001788"
              inputMode="numeric"
              maxLength={10}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-300">Texto na descricao</span>
            <input
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              placeholder="Ex.: ARMARIO, PROJETOR, NOTEBOOK"
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Unidade</span>
            <select
              value={filters.unidadeDonaId}
              onChange={(e) => setFilters((prev) => ({ ...prev, unidadeDonaId: e.target.value }))}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u || "all"} value={u}>
                  {u ? formatUnidade(Number(u)) : "Todas"}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Status</span>
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s || "all"} value={s}>
                  {s || "Todos"}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-3 md:col-span-3">
            <button
              type="submit"
              disabled={list.loading}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
            >
              {list.loading ? "Consultando..." : "Consultar"}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg border border-white/25 px-4 py-2 text-sm hover:bg-white/10"
            >
              Limpar
            </button>
          </div>
        </form>
        {formError && <p className="mt-3 text-sm text-rose-300">{formError}</p>}
        {list.error && <p className="mt-3 text-sm text-rose-300">{list.error}</p>}
      </article>

      <article className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Resultados</h3>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>
              {paging.total ? `${paging.offset + 1}-${Math.min(paging.offset + paging.limit, paging.total)}` : "0"} de{" "}
              {paging.total}
            </span>
            <button
              type="button"
              disabled={!canPrev || list.loading}
              onClick={() => loadList(Math.max(0, paging.offset - paging.limit))}
              className="rounded-md border border-white/20 px-2 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!canNext || list.loading}
              onClick={() => loadList(paging.offset + paging.limit)}
              className="rounded-md border border-white/20 px-2 py-1 disabled:opacity-40"
            >
              Proxima
            </button>
          </div>
        </div>

        <div className="mt-3 overflow-auto rounded-lg border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/70 text-xs uppercase tracking-wider text-slate-300">
              <tr>
                <th className="px-3 py-2">Tombo</th>
                <th className="px-3 py-2">Descricao</th>
                <th className="px-3 py-2">Unidade</th>
                <th className="px-3 py-2">Local</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-950/30">
              {items.length === 0 && !list.loading && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-300">
                    Nenhum bem encontrado para os filtros informados.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-white/5">
                  <td className="px-3 py-2 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => copyTombamento(item.numeroTombamento)}
                      className="rounded-md border border-white/15 bg-slate-900/60 px-2 py-1 hover:bg-slate-900"
                      title="Clique para copiar o tombamento"
                    >
                      {item.numeroTombamento || "-"}
                    </button>
                  </td>
                  <td className="px-3 py-2">{item.descricao || "-"}</td>
                  <td className="px-3 py-2 text-xs text-slate-200">
                    {formatUnidade(Number(item.unidadeDonaId))}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{item.localFisico || "-"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openDetail(item.id)}
                      className="rounded-md border border-white/20 bg-slate-900/60 px-2 py-1 text-xs hover:bg-slate-900"
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      {detail.open && (
        <BemDetailModal state={detail} onClose={closeDetail} />
      )}
    </section>
  );
}

function BemDetailModal({ state, onClose }) {
  const imp = state?.data?.bem || null;
  const catalogo = state?.data?.catalogo || null;
  const responsavel = state?.data?.responsavel || null;
  const movs = state?.data?.movimentacoes || [];
  const hist = state?.data?.historicoTransferencias || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 p-4 backdrop-blur">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900/50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-slate-400">Detalhes do bem</p>
            <p className="mt-1 truncate font-[Space_Grotesk] text-lg font-semibold text-slate-100">
              {imp?.numeroTombamento ? `Tombo ${imp.numeroTombamento}` : "Bem"}
              {imp?.status ? <span className="text-slate-400"> {" "}({imp.status})</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            Fechar
          </button>
        </div>

        <div className="max-h-[75vh] overflow-auto p-4">
          {state.loading && <p className="text-sm text-slate-300">Carregando detalhes...</p>}
          {state.error && <p className="text-sm text-rose-300">{state.error}</p>}

          {!state.loading && !state.error && imp && (
            <div className="space-y-4">
              <section className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400">Operacional</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row k="BemId" v={imp.id} mono />
                    <Row k="Unidade (carga)" v={imp.unidadeDonaId} />
                    <Row k="Local fisico" v={imp.localFisico} />
                    <Row k="Status" v={imp.status} />
                    <Row k="Valor aquisicao" v={imp.valorAquisicao} />
                    <Row k="Data aquisicao" v={imp.dataAquisicao} />
                    <Row k="Contrato" v={imp.contratoReferencia} />
                    <Row k="Criado em" v={imp.createdAt} />
                    <Row k="Atualizado em" v={imp.updatedAt} />
                  </dl>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400">Catalogo (SKU)</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row k="CatalogoBemId" v={catalogo?.id || imp.catalogoBemId} mono />
                    <Row k="Codigo catalogo" v={catalogo?.codigoCatalogo} />
                    <Row k="Descricao" v={catalogo?.descricao} />
                    <Row k="Grupo" v={catalogo?.grupo} />
                    <Row k="Material permanente" v={String(Boolean(catalogo?.materialPermanente))} />
                  </dl>
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-400">Responsavel</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <Row k="PerfilId" v={responsavel?.id || imp.responsavelPerfilId} mono />
                  <Row k="Matricula" v={responsavel?.matricula} />
                  <Row k="Nome" v={responsavel?.nome} />
                </dl>
              </section>

              <section className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-400">Historico de transferencias</p>
                {hist.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-300">Nenhuma transferencia registrada.</p>
                ) : (
                  <div className="mt-2 overflow-auto rounded-lg border border-white/10">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-300">
                        <tr>
                          <th className="px-2 py-2">Data</th>
                          <th className="px-2 py-2">Origem</th>
                          <th className="px-2 py-2">De</th>
                          <th className="px-2 py-2">Para</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {hist.map((h) => (
                          <tr key={h.id}>
                            <td className="px-2 py-2 text-slate-200">{h.data || "-"}</td>
                            <td className="px-2 py-2 text-slate-300">{h.origem || "-"}</td>
                            <td className="px-2 py-2 text-slate-300">{h.unidadeAntigaId}</td>
                            <td className="px-2 py-2 text-slate-300">{h.unidadeNovaId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-400">Movimentacoes</p>
                {movs.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-300">Nenhuma movimentacao registrada.</p>
                ) : (
                  <div className="mt-2 overflow-auto rounded-lg border border-white/10">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-300">
                        <tr>
                          <th className="px-2 py-2">Quando</th>
                          <th className="px-2 py-2">Tipo</th>
                          <th className="px-2 py-2">Origem</th>
                          <th className="px-2 py-2">Destino</th>
                          <th className="px-2 py-2">Termo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {movs.map((m) => (
                          <tr key={m.id}>
                            <td className="px-2 py-2 text-slate-200">{m.executadaEm || m.createdAt || "-"}</td>
                            <td className="px-2 py-2 text-slate-300">{m.tipoMovimentacao}</td>
                            <td className="px-2 py-2 text-slate-300">{m.unidadeOrigemId ?? "-"}</td>
                            <td className="px-2 py-2 text-slate-300">{m.unidadeDestinoId ?? "-"}</td>
                            <td className="px-2 py-2 font-mono text-[11px] text-slate-300">{m.termoReferencia || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
      <dt className="text-xs text-slate-400">{k}</dt>
      <dd className={mono ? "break-all font-mono text-xs text-slate-200" : "text-sm text-slate-200"}>
        {value}
      </dd>
    </div>
  );
}
