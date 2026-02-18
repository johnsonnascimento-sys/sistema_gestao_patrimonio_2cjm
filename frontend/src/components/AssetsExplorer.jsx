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
  getBemDetalhe,
  getStats,
  listarBens,
  listarLocais,
  uploadFoto,
  getFotoUrl,
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

export default function AssetsExplorer() {
  const auth = useAuth();
  const [stats, setStats] = useState({ loading: false, data: null, error: null });
  const [list, setList] = useState({ loading: false, data: null, error: null });
  const [formError, setFormError] = useState(null);
  const [detail, setDetail] = useState({ open: false, loading: false, data: null, error: null });
  const [filters, setFilters] = useState({
    numeroTombamento: "",
    q: "",
    localFisico: "",
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
        localFisico: filters.localFisico.trim() || undefined,
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
      setFormError("Tombamento inválido: informe exatamente 10 dígitos (ex.: 1290001788).");
      return;
    }
    loadList(0);
  };

  const onClear = () => {
    setFormError(null);
    setFilters({ numeroTombamento: "", q: "", localFisico: "", unidadeDonaId: "", status: "" });
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
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-300">Local (texto do GEAFIN / local_fisico)</span>
            <input
              value={filters.localFisico}
              onChange={(e) => setFilters((prev) => ({ ...prev, localFisico: e.target.value }))}
              placeholder="Ex.: Sala 101, Hall 6º Andar, Almox..."
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
          <div className="flex items-end gap-3 md:col-span-4">
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
                <th className="px-3 py-2">Descrição</th>
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
  const responsavel = state?.data?.responsavel || null;
  const movs = state?.data?.movimentacoes || [];
  const hist = state?.data?.historicoTransferencias || [];

  const [edit, setEdit] = useState({
    catalogoBemId: imp?.catalogoBemId || "",
    unidadeDonaId: imp?.unidadeDonaId ? String(imp.unidadeDonaId) : "",
    status: imp?.status || "",
    descricaoComplementar: imp?.descricaoComplementar || "",
    responsavelPerfilId: imp?.responsavelPerfilId || "",
    contratoReferencia: imp?.contratoReferencia || "",
    dataAquisicao: imp?.dataAquisicao ? String(imp.dataAquisicao).slice(0, 10) : "",
    valorAquisicao: imp?.valorAquisicao != null ? String(imp.valorAquisicao) : "",
    localFisico: imp?.localFisico || "",
    localId: imp?.localId || "",
    fotoUrl: imp?.fotoUrl || "",
    fotoReferenciaUrl: catalogo?.fotoReferenciaUrl || "",
  });
  const [editMsg, setEditMsg] = useState(null);
  const [editErr, setEditErr] = useState(null);
  const [uploadState, setUploadState] = useState({ loading: false, error: null });
  const itemFileRef = useRef(null);
  const itemCameraRef = useRef(null);
  const catalogFileRef = useRef(null);
  const catalogCameraRef = useRef(null);

  useEffect(() => {
    setEdit({
      catalogoBemId: imp?.catalogoBemId || "",
      unidadeDonaId: imp?.unidadeDonaId ? String(imp.unidadeDonaId) : "",
      status: imp?.status || "",
      descricaoComplementar: imp?.descricaoComplementar || "",
      responsavelPerfilId: imp?.responsavelPerfilId || "",
      contratoReferencia: imp?.contratoReferencia || "",
      dataAquisicao: imp?.dataAquisicao ? String(imp.dataAquisicao).slice(0, 10) : "",
      valorAquisicao: imp?.valorAquisicao != null ? String(imp.valorAquisicao) : "",
      localFisico: imp?.localFisico || "",
      localId: imp?.localId || "",
      fotoUrl: imp?.fotoUrl || "",
      fotoReferenciaUrl: catalogo?.fotoReferenciaUrl || "",
    });
    setEditMsg(null);
    setEditErr(null);
    setUploadState({ loading: false, error: null });
  }, [imp?.id, catalogo?.id]);

  const locaisQuery = useQuery({
    queryKey: ["locais", "todos"],
    enabled: Boolean(isAdmin && imp?.id),
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

  const salvarBemMut = useMutation({
    mutationFn: async () => {
      if (!imp?.id) throw new Error("BemId ausente.");
      return atualizarBem(imp.id, {
        catalogoBemId: edit.catalogoBemId ? String(edit.catalogoBemId).trim() : undefined,
        unidadeDonaId: edit.unidadeDonaId ? Number(edit.unidadeDonaId) : undefined,
        status: edit.status || undefined,
        descricaoComplementar: edit.descricaoComplementar || null,
        responsavelPerfilId: edit.responsavelPerfilId || null,
        contratoReferencia: edit.contratoReferencia || null,
        dataAquisicao: edit.dataAquisicao || null,
        valorAquisicao: edit.valorAquisicao !== "" ? Number(edit.valorAquisicao) : null,
        localFisico: edit.localFisico || null,
        localId: edit.localId ? String(edit.localId) : null,
        fotoUrl: edit.fotoUrl || null,
      });
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
                    <Row k="Local físico" v={imp.localFisico} />
                    <Row k="LocalId" v={imp.localId} mono />
                    <Row k="Status" v={imp.status} />
                    <Row k="Valor aquisição" v={imp.valorAquisicao} />
                    <Row k="Data aquisição" v={imp.dataAquisicao} />
                    <Row k="Contrato" v={imp.contratoReferencia} />
                    <Row k="Foto (item)" v={imp.fotoUrl} />
                    <Row k="Criado em" v={imp.createdAt} />
                    <Row k="Atualizado em" v={imp.updatedAt} />
                  </dl>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400">Catálogo (SKU)</p>
                  <dl className="mt-2 space-y-1 text-sm">
                    <Row k="CatalogoBemId" v={catalogo?.id || imp.catalogoBemId} mono />
                    <Row k="Código catálogo" v={catalogo?.codigoCatalogo} />
                    <Row k="Descrição" v={catalogo?.descricao} />
                    <Row k="Grupo" v={catalogo?.grupo} />
                    <Row k="Material permanente" v={String(Boolean(catalogo?.materialPermanente))} />
                    <Row k="Foto (referência)" v={catalogo?.fotoReferenciaUrl} />
                  </dl>
                </div>
              </section>

              {isAdmin ? (
                <section className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Editar (ADMIN)</p>
                    <p className="text-[11px] text-slate-400">
                      Edite campos operacionais (exceto chaves). Sala/Local vem do cadastro de locais.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs text-slate-300">Catálogo (SKU) id (UUID)</span>
                      <input
                        value={edit.catalogoBemId}
                        onChange={(e) => setEdit((p) => ({ ...p, catalogoBemId: e.target.value }))}
                        placeholder={catalogo?.id || imp.catalogoBemId || "UUID do catálogo"}
                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 font-mono text-xs"
                      />
                      <p className="text-[11px] text-slate-400">
                        Use apenas para correção manual. Idealmente o SKU vem da normalização do GEAFIN.
                      </p>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-300">Unidade (carga)</span>
                      <select
                        value={edit.unidadeDonaId}
                        onChange={(e) => setEdit((p) => ({ ...p, unidadeDonaId: e.target.value }))}
                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                      >
                        <option value="">(não alterar)</option>
                        {["1", "2", "3", "4"].map((u) => (
                          <option key={u} value={u}>
                            {formatUnidade(Number(u))}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-400">
                        Regra legal: transferências podem ser bloqueadas durante inventário (Art. 183 - AN303_Art183).
                      </p>
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-300">Status do bem</span>
                      <select
                        value={edit.status}
                        onChange={(e) => setEdit((p) => ({ ...p, status: e.target.value }))}
                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                      >
                        {STATUS_OPTIONS.filter(Boolean).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 md:col-span-2">
                      <span className="text-xs text-slate-300">Descrição complementar (item)</span>
                      <input
                        value={edit.descricaoComplementar}
                        onChange={(e) => setEdit((p) => ({ ...p, descricaoComplementar: e.target.value }))}
                        placeholder="Ex.: Cadeira com avaria no braço direito..."
                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-300">Responsável (perfilId UUID)</span>
                      <input
                        value={edit.responsavelPerfilId}
                        onChange={(e) => setEdit((p) => ({ ...p, responsavelPerfilId: e.target.value }))}
                        placeholder="UUID do perfil responsável"
                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 font-mono text-xs"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-300">Contrato referência</span>
                      <input
                        value={edit.contratoReferencia}
                        onChange={(e) => setEdit((p) => ({ ...p, contratoReferencia: e.target.value }))}
                        placeholder="Ex.: Contrato 12/2026"
                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-300">Data de aquisição</span>
                      <input
                        value={edit.dataAquisicao}
                        onChange={(e) => setEdit((p) => ({ ...p, dataAquisicao: e.target.value }))}
                        type="date"
                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-300">Valor de aquisição</span>
                      <input
                        value={edit.valorAquisicao}
                        onChange={(e) => setEdit((p) => ({ ...p, valorAquisicao: e.target.value }))}
                        inputMode="decimal"
                        placeholder="Ex.: 3500.00"
                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-xs text-slate-300">Local físico (texto do GEAFIN / legado)</span>
                      <input
                        value={edit.localFisico}
                        onChange={(e) => setEdit((p) => ({ ...p, localFisico: e.target.value }))}
                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                      />
                      <p className="text-[11px] text-slate-400">
                        Este campo é apenas texto e não equivale a “Sala/Local padronizado”.
                      </p>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-slate-300">Sala/Local (padronizado)</span>
                      <select
                        value={edit.localId || ""}
                        onChange={(e) => setEdit((p) => ({ ...p, localId: e.target.value }))}
                        className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                      >
                        <option value="">(nenhum)</option>
                        {locaisOptions.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.nome}
                            {l.unidadeId ? ` (${formatUnidade(Number(l.unidadeId))})` : " (geral)"}
                          </option>
                        ))}
                      </select>
                      {locaisQuery.isLoading ? (
                        <p className="text-[11px] text-slate-400">Carregando locais cadastrados...</p>
                      ) : null}
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-white/10 bg-slate-950/30 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-400">Foto do item</p>
                      {edit.fotoUrl ? (
                        <a href={getFotoUrl(edit.fotoUrl)} target="_blank" rel="noopener noreferrer" className="block mt-2">
                          <img
                            src={getFotoUrl(edit.fotoUrl)}
                            alt="Foto do item"
                            className="h-40 w-full object-contain rounded bg-black/20"
                          />
                        </a>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500 italic text-center py-4 border border-dashed border-white/10 rounded">Sem foto</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => itemCameraRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"
                        >
                          Tirar foto
                        </button>
                        <button
                          type="button"
                          onClick={() => itemFileRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"
                        >
                          Enviar arquivo
                        </button>
                      </div>
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

                    <div className="rounded-lg border border-white/10 bg-slate-950/30 p-3">
                      <p className="text-xs uppercase tracking-widest text-slate-400">Foto de referência (SKU)</p>
                      {edit.fotoReferenciaUrl ? (
                        <a href={getFotoUrl(edit.fotoReferenciaUrl)} target="_blank" rel="noopener noreferrer" className="block mt-2">
                          <img
                            src={getFotoUrl(edit.fotoReferenciaUrl)}
                            alt="Foto de referência"
                            className="h-40 w-full object-contain rounded bg-black/20"
                          />
                        </a>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500 italic text-center py-4 border border-dashed border-white/10 rounded">Sem foto</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => catalogCameraRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"
                        >
                          Tirar foto
                        </button>
                        <button
                          type="button"
                          onClick={() => catalogFileRef.current?.click()}
                          disabled={uploadFotoMut.isPending}
                          className="rounded-lg border border-white/20 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"
                        >
                          Enviar arquivo
                        </button>
                      </div>
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
                      className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
                    >
                      {salvarBemMut.isPending ? "Salvando..." : "Salvar alterações do bem"}
                    </button>
                    {uploadFotoMut.isPending ? <span className="text-xs text-slate-300">Enviando foto...</span> : null}
                    {editMsg ? <span className="text-xs text-emerald-200">{editMsg}</span> : null}
                    {editErr ? <span className="text-xs text-rose-200">{editErr}</span> : null}
                  </div>
                </section>
              ) : null}

              <section className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-400">Responsável</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <Row k="PerfilId" v={responsavel?.id || imp.responsavelPerfilId} mono />
                  <Row k="Matrícula" v={responsavel?.matricula} />
                  <Row k="Nome" v={responsavel?.nome} />
                </dl>
              </section>

              <section className="rounded-xl border border-white/10 bg-slate-900/30 p-3">
                <p className="text-xs uppercase tracking-widest text-slate-400">Histórico de transferências</p>
                {hist.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-300">Nenhuma transferência registrada.</p>
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
                <p className="text-xs uppercase tracking-widest text-slate-400">Movimentações</p>
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
