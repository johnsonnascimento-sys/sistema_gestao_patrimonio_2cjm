/**
 * Modulo: frontend/components
 * Arquivo: CatalogoAdminPanel.jsx
 * Funcao no sistema: administrar catalogo de bens (CRUD) e associar bens ao catalogo por tombamento.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  aplicarNomeResumoCatalogo,
  associarBensCatalogo,
  atualizarCatalogo,
  criarCatalogo,
  getFotoUrl,
  listarBens,
  listarCatalogos,
  uploadFoto,
} from "../services/apiClient.js";

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

function parseTombamentos(texto) {
  return Array.from(
    new Set(
      String(texto || "")
        .split(/[\s,;]+/g)
        .map((t) => t.replace(/\D+/g, "").slice(0, 10))
        .filter((t) => /^\d{10}$/.test(t)),
    ),
  );
}

export default function CatalogoAdminPanel({ canAdmin }) {
  const auth = useAuth();
  const fileRef = useRef(null);
  const [listState, setListState] = useState({ loading: false, data: null, error: null });
  const [filtros, setFiltros] = useState({ q: "", codigoCatalogo: "", grupo: "" });
  const [formState, setFormState] = useState({ loading: false, response: null, error: null });
  const [form, setForm] = useState({
    codigoCatalogo: "",
    descricao: "",
    grupo: "",
    materialPermanente: false,
  });
  const [editId, setEditId] = useState("");
  const [assocForm, setAssocForm] = useState({
    catalogoId: "",
    tombamentosTexto: "",
    dryRun: true,
  });
  const [assocState, setAssocState] = useState({ loading: false, response: null, error: null });
  const [uploadState, setUploadState] = useState({ loading: false, error: null });
  const [formFotoFile, setFormFotoFile] = useState(null);
  const [formFotoPreviewUrl, setFormFotoPreviewUrl] = useState("");
  const [formFotoAtualUrl, setFormFotoAtualUrl] = useState("");
  const [formFotoInputKey, setFormFotoInputKey] = useState(0);
  const [selectedCatalogo, setSelectedCatalogo] = useState(null);
  const [editLookupCodigo, setEditLookupCodigo] = useState("");
  const [editLookupMsg, setEditLookupMsg] = useState(null);
  const [bensState, setBensState] = useState({ loading: false, items: [], error: null });
  const [nomeResumoPadrao, setNomeResumoPadrao] = useState("");
  const [nomeResumoState, setNomeResumoState] = useState({ loading: false, error: null, info: null });
  const [columnFilters, setColumnFilters] = useState({
    codigoCatalogo: "",
    descricao: "",
    grupo: "",
    permanente: "",
    totalBens: "",
  });
  const [sortState, setSortState] = useState({ key: "", dir: "asc" });
  const totalServerItems = Array.isArray(listState.data?.items) ? listState.data.items.length : 0;
  const catalogosOptions = Array.isArray(listState.data?.items) ? listState.data.items : [];

  const loadCatalogos = async () => {
    if (!canAdmin) return;
    setListState({ loading: true, data: null, error: null });
    try {
      const pageSize = 500;
      const maxPages = 20;
      const baseParams = {
        q: filtros.q.trim() || undefined,
        codigoCatalogo: filtros.codigoCatalogo.trim() || undefined,
        grupo: filtros.grupo.trim() || undefined,
        limit: pageSize,
      };

      let offset = 0;
      let total = 0;
      let pages = 0;
      const allItems = [];

      while (pages < maxPages) {
        const data = await listarCatalogos({ ...baseParams, offset });
        const items = Array.isArray(data?.items) ? data.items : [];
        total = Number(data?.paging?.total || 0);
        allItems.push(...items);
        pages += 1;

        if (!items.length || allItems.length >= total) break;
        offset += items.length;
      }

      setListState({
        loading: false,
        data: {
          requestId: null,
          paging: { limit: pageSize, offset: 0, total },
          items: allItems,
        },
        error: null,
      });
    } catch (error) {
      setListState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  useEffect(() => {
    if (!canAdmin) return;
    void loadCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  useEffect(() => {
    if (!formFotoFile) {
      setFormFotoPreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(formFotoFile);
    setFormFotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [formFotoFile]);

  const toggleSort = (key) => {
    setSortState((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: "", dir: "asc" };
    });
  };

  const itemsFiltradosOrdenados = useMemo(() => {
    const items = Array.isArray(listState.data?.items) ? [...listState.data.items] : [];
    const codigo = String(columnFilters.codigoCatalogo || "").trim().toLowerCase();
    const descricao = String(columnFilters.descricao || "").trim().toLowerCase();
    const grupo = String(columnFilters.grupo || "").trim().toLowerCase();
    const permanente = String(columnFilters.permanente || "").trim().toUpperCase();
    const totalBens = String(columnFilters.totalBens || "").trim().toLowerCase();

    const filtrados = items.filter((c) => {
      const codigoOk = !codigo || String(c.codigoCatalogo || "").toLowerCase().includes(codigo);
      const descricaoOk = !descricao || String(c.descricao || "").toLowerCase().includes(descricao);
      const grupoOk = !grupo || String(c.grupo || "").toLowerCase().includes(grupo);
      const permanenteVal = c.materialPermanente ? "SIM" : "NAO";
      const permanenteOk = !permanente || permanenteVal === permanente;
      const bensOk = !totalBens || String(Number(c.totalBens ?? 0)).toLowerCase().includes(totalBens);
      return codigoOk && descricaoOk && grupoOk && permanenteOk && bensOk;
    });

    if (!sortState.key) return filtrados;
    const direction = sortState.dir === "desc" ? -1 : 1;
    filtrados.sort((a, b) => {
      if (sortState.key === "totalBens") {
        return (Number(a.totalBens ?? 0) - Number(b.totalBens ?? 0)) * direction;
      }
      if (sortState.key === "permanente") {
        const aVal = a.materialPermanente ? "SIM" : "NAO";
        const bVal = b.materialPermanente ? "SIM" : "NAO";
        return aVal.localeCompare(bVal, "pt-BR") * direction;
      }
      const aVal = String(a[sortState.key] || "");
      const bVal = String(b[sortState.key] || "");
      return aVal.localeCompare(bVal, "pt-BR", { numeric: true, sensitivity: "base" }) * direction;
    });
    return filtrados;
  }, [columnFilters, listState.data?.items, sortState.dir, sortState.key]);

  const hasColumnFilterActive = Boolean(
    String(columnFilters.codigoCatalogo || "").trim()
    || String(columnFilters.descricao || "").trim()
    || String(columnFilters.grupo || "").trim()
    || String(columnFilters.permanente || "").trim()
    || String(columnFilters.totalBens || "").trim(),
  );

  const clearTableFilters = () => {
    setColumnFilters({
      codigoCatalogo: "",
      descricao: "",
      grupo: "",
      permanente: "",
      totalBens: "",
    });
    setSortState({ key: "", dir: "asc" });
  };

  const onSalvarCatalogo = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setFormState({ loading: false, response: null, error: "Operacao restrita ao perfil ADMIN." });
      return;
    }
    const payload = {
      codigoCatalogo: String(form.codigoCatalogo || "").trim(),
      descricao: String(form.descricao || "").trim(),
      grupo: String(form.grupo || "").trim() || null,
      materialPermanente: Boolean(form.materialPermanente),
    };
    if (!payload.codigoCatalogo || !payload.descricao) {
      setFormState({ loading: false, response: null, error: "Preencha codigoCatalogo e descricao." });
      return;
    }

    setFormState({ loading: true, response: null, error: null });
    try {
      const data = editId
        ? await atualizarCatalogo(String(editId), payload)
        : await criarCatalogo(payload);
      const savedCatalogoId = data?.catalogo?.id ? String(data.catalogo.id) : "";
      if (formFotoFile && savedCatalogoId) {
        await onUploadFoto({ id: savedCatalogoId }, formFotoFile, { skipReload: true });
        setFormFotoFile(null);
      }
      if (nomeResumoPadrao.trim() && savedCatalogoId) {
        const batch = await aplicarNomeResumoCatalogo(savedCatalogoId, { nomeResumo: nomeResumoPadrao.trim() });
        setNomeResumoState({
          loading: false,
          error: null,
          info: `Nome resumo aplicado em ${Number(batch?.atualizados || 0)} bem(ns).`,
        });
      } else {
        setNomeResumoState({ loading: false, error: null, info: null });
      }

      setFormState({ loading: false, response: data, error: null });
      if (editId) {
        setEditId("");
      } else {
        setForm({ codigoCatalogo: "", descricao: "", grupo: "", materialPermanente: false });
      }
      setFormFotoAtualUrl("");
      await loadCatalogos();
    } catch (error) {
      setFormState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const onEditar = (catalogo) => {
    if (!catalogo?.id) return;
    setEditId(String(catalogo.id));
    setEditLookupCodigo(String(catalogo.codigoCatalogo || ""));
    setEditLookupMsg(`Material (SKU) ${String(catalogo.codigoCatalogo || "")} carregado para edicao.`);
    setForm({
      codigoCatalogo: String(catalogo.codigoCatalogo || ""),
      descricao: String(catalogo.descricao || ""),
      grupo: String(catalogo.grupo || ""),
      materialPermanente: Boolean(catalogo.materialPermanente),
    });
    setNomeResumoPadrao(String(catalogo.descricao || ""));
    setFormFotoFile(null);
    setFormFotoInputKey((v) => v + 1);
    setFormFotoAtualUrl(catalogo?.fotoReferenciaUrl ? getFotoUrl(catalogo.fotoReferenciaUrl) : "");
    setFormState({ loading: false, response: null, error: null });
    setNomeResumoState({ loading: false, error: null, info: null });
  };

  const onCancelarEdicao = () => {
    setEditId("");
    setEditLookupMsg(null);
    setForm({ codigoCatalogo: "", descricao: "", grupo: "", materialPermanente: false });
    setNomeResumoPadrao("");
    setFormFotoFile(null);
    setFormFotoInputKey((v) => v + 1);
    setFormFotoAtualUrl("");
    setFormState({ loading: false, response: null, error: null });
    setNomeResumoState({ loading: false, error: null, info: null });
  };

  const onUploadFoto = async (catalogo, file, opts = {}) => {
    if (!canAdmin || !catalogo?.id || !file) return false;
    setUploadState({ loading: true, error: null });
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
        reader.onload = () => {
          const result = String(reader.result || "");
          const idx = result.indexOf("base64,");
          resolve(idx >= 0 ? result.slice(idx + 7) : result);
        };
        reader.readAsDataURL(file);
      });
      await uploadFoto({
        target: "CATALOGO",
        id: String(catalogo.id),
        filename: String(file.name || "foto.jpg"),
        mimeType: String(file.type || "image/jpeg"),
        base64Data: String(base64),
      });
      setUploadState({ loading: false, error: null });
      if (!opts.skipReload) await loadCatalogos();
      return true;
    } catch (error) {
      setUploadState({ loading: false, error: formatApiError(error) });
      return false;
    }
  };

  const onAssociar = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setAssocState({ loading: false, response: null, error: "Operacao restrita ao perfil ADMIN." });
      return;
    }
    const catalogoId = String(assocForm.catalogoId || "").trim();
    const tombamentos = parseTombamentos(assocForm.tombamentosTexto);
    if (!catalogoId || !tombamentos.length) {
      setAssocState({ loading: false, response: null, error: "Informe o catalogo e ao menos 1 tombamento valido (10 digitos)." });
      return;
    }
    setAssocState({ loading: true, response: null, error: null });
    try {
      const data = await associarBensCatalogo(catalogoId, {
        tombamentos,
        dryRun: Boolean(assocForm.dryRun),
      });
      setAssocState({ loading: false, response: data, error: null });
      await loadCatalogos();
    } catch (error) {
      setAssocState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const onVerBensAssociados = async (catalogo) => {
    if (!catalogo?.codigoCatalogo) return;
    setSelectedCatalogo(catalogo);
    setBensState({ loading: true, items: [], error: null });
    try {
      const data = await listarBens({
        codigoCatalogo: String(catalogo.codigoCatalogo),
        limit: 200,
        offset: 0,
      });
      setBensState({ loading: false, items: data?.items || [], error: null });
    } catch (error) {
      setBensState({ loading: false, items: [], error: formatApiError(error) });
    }
  };

  const onCarregarMaterialParaEdicao = () => {
    const codigo = String(editLookupCodigo || "").trim();
    if (!codigo) {
      setEditLookupMsg("Informe o codigo do Material (SKU).");
      return;
    }
    const exact = catalogosOptions.find((c) => String(c?.codigoCatalogo || "").trim() === codigo);
    if (exact) {
      onEditar(exact);
      return;
    }
    const similar = catalogosOptions.find((c) => String(c?.codigoCatalogo || "").toLowerCase().includes(codigo.toLowerCase()));
    if (similar) {
      onEditar(similar);
      setEditLookupMsg(`Codigo exato nao encontrado. Material ${similar.codigoCatalogo} carregado por similaridade.`);
      return;
    }
    setEditLookupMsg("Material (SKU) nao encontrado na lista atual. Clique em Atualizar e tente novamente.");
  };

  const onAplicarNomeResumoNoMaterialAtual = async () => {
    if (!canAdmin) {
      setNomeResumoState({ loading: false, error: "Operacao restrita ao perfil ADMIN.", info: null });
      return;
    }
    const catalogoId = String(editId || formState.response?.catalogo?.id || "").trim();
    if (!catalogoId) {
      setNomeResumoState({
        loading: false,
        error: "Salve ou carregue um Material (SKU) para editar antes de aplicar o nome resumo.",
        info: null,
      });
      return;
    }
    const nomeResumo = String(nomeResumoPadrao || "").trim();
    setNomeResumoState({ loading: true, error: null, info: null });
    try {
      const data = await aplicarNomeResumoCatalogo(catalogoId, { nomeResumo });
      setNomeResumoState({
        loading: false,
        error: null,
        info: `Nome resumo aplicado em ${Number(data?.atualizados || 0)} bem(ns).`,
      });
      if (selectedCatalogo && String(selectedCatalogo.id) === String(catalogoId)) {
        await onVerBensAssociados(selectedCatalogo);
      }
    } catch (error) {
      setNomeResumoState({ loading: false, error: formatApiError(error), info: null });
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Material (SKU)</h3>
          <p className="mt-1 text-xs text-slate-600">
            Cadastro central de catalogo com foto de referencia e associacao de bens por tombamento.
          </p>
        </div>
        <button
          type="button"
          onClick={loadCatalogos}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
          disabled={!canAdmin || listState.loading}
        >
          {listState.loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {!canAdmin && auth.authEnabled ? (
        <p className="mt-3 text-xs text-rose-700">
          Operacao restrita ao perfil <strong>ADMIN</strong>.
        </p>
      ) : null}
      {listState.error ? <p className="mt-3 text-sm text-rose-700">{listState.error}</p> : null}
      {uploadState.error ? <p className="mt-3 text-sm text-rose-700">{uploadState.error}</p> : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form onSubmit={onSalvarCatalogo} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Criar/editar Material (SKU)</h4>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-800">Edicao rapida por codigo</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={editLookupCodigo}
                onChange={(e) => setEditLookupCodigo(e.target.value)}
                className="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex.: 49581"
              />
              <button
                type="button"
                onClick={onCarregarMaterialParaEdicao}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Carregar para edicao
              </button>
            </div>
            {editLookupMsg ? <p className="mt-2 text-[11px] text-slate-600">{editLookupMsg}</p> : null}
          </div>
          <div className="mt-3 grid gap-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Codigo do Material (SKU)</span>
              <input
                value={form.codigoCatalogo}
                onChange={(e) => setForm((p) => ({ ...p, codigoCatalogo: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex.: 49581"
                disabled={!canAdmin && auth.authEnabled}
              />
              <p className="text-[11px] text-amber-700">
                Importante: o numero do catalogo deve ser o mesmo do GEAFIN (codigo do material) para evitar divergencias na importacao.
                Exemplo: MESA DE SOM MIXER, MODELO: XENYX 2222 UDB, MARCA: BEHRINGER -&gt; codigo GEAFIN <strong>49581</strong>.
              </p>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Descricao</span>
              <input
                value={form.descricao}
                onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Descricao canonica do item"
                disabled={!canAdmin && auth.authEnabled}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Grupo (opcional)</span>
              <input
                value={form.grupo}
                onChange={(e) => setForm((p) => ({ ...p, grupo: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex.: INFORMATICA"
                disabled={!canAdmin && auth.authEnabled}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Nome resumo (aplicar em lote no SKU)</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={nomeResumoPadrao}
                  onChange={(e) => setNomeResumoPadrao(e.target.value)}
                  className="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="Ex.: Notebook Dell Latitude 5420"
                  disabled={!canAdmin && auth.authEnabled}
                />
                <button
                  type="button"
                  onClick={() => void onAplicarNomeResumoNoMaterialAtual()}
                  className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
                  disabled={nomeResumoState.loading || (!canAdmin && auth.authEnabled)}
                >
                  {nomeResumoState.loading ? "Aplicando..." : "Aplicar agora"}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Ao salvar o Material (SKU), este nome resumo tambem pode ser aplicado automaticamente nos bens associados.
              </p>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(form.materialPermanente)}
                onChange={(e) => setForm((p) => ({ ...p, materialPermanente: e.target.checked }))}
                className="h-4 w-4 accent-violet-600"
                disabled={!canAdmin && auth.authEnabled}
              />
              Material permanente
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Imagem do material (opcional)</span>
              <input
                key={`form-foto-${formFotoInputKey}`}
                type="file"
                accept="image/*"
                onChange={(e) => setFormFotoFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={formState.loading || (!canAdmin && auth.authEnabled)}
              />
              <p className="text-[11px] text-slate-500">
                {formFotoFile
                  ? `Selecionado: ${formFotoFile.name}`
                  : "Se informar imagem, ela sera enviada ao salvar o material."}
              </p>
              {(formFotoPreviewUrl || formFotoAtualUrl) ? (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={formFotoPreviewUrl || formFotoAtualUrl}
                    alt="Preview da imagem do material"
                    className="h-16 w-16 rounded border border-slate-300 object-cover"
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-slate-600">
                      {formFotoPreviewUrl ? "Preview da nova imagem" : "Imagem atual do material"}
                    </span>
                    {formFotoFile ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFormFotoFile(null);
                          setFormFotoInputKey((v) => v + 1);
                        }}
                        className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Remover selecao
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </label>
            <button
              type="submit"
              disabled={formState.loading || (!canAdmin && auth.authEnabled)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {formState.loading ? "Salvando..." : editId ? "Atualizar Material (SKU)" : "Criar Material (SKU)"}
            </button>
            {editId ? (
              <button
                type="button"
                onClick={onCancelarEdicao}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
                disabled={formState.loading}
              >
                Cancelar edicao
              </button>
            ) : null}
            {formState.error ? <p className="text-sm text-rose-700">{formState.error}</p> : null}
            {formState.response?.catalogo?.id ? (
              <p className="text-xs text-emerald-700">
                Salvo: {formState.response.catalogo.codigoCatalogo} (id={formState.response.catalogo.id})
              </p>
            ) : null}
            {nomeResumoState.error ? <p className="text-sm text-rose-700">{nomeResumoState.error}</p> : null}
            {nomeResumoState.info ? <p className="text-sm text-emerald-700">{nomeResumoState.info}</p> : null}
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Filtros</h4>
          <div className="mt-3 grid gap-2">
            <input
              value={filtros.q}
              onChange={(e) => setFiltros((p) => ({ ...p, q: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Buscar por codigo, descricao ou grupo"
            />
            <input
              value={filtros.codigoCatalogo}
              onChange={(e) => setFiltros((p) => ({ ...p, codigoCatalogo: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Filtrar por codigo"
            />
            <input
              value={filtros.grupo}
              onChange={(e) => setFiltros((p) => ({ ...p, grupo: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Filtrar por grupo"
            />
            <button
              type="button"
              onClick={loadCatalogos}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-900">Lista de Material (SKU)</h4>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-600">
              Mostrando {itemsFiltradosOrdenados.length} de {totalServerItems} materiais
            </span>
            <button
              type="button"
              onClick={clearTableFilters}
              className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              disabled={!hasColumnFilterActive && !sortState.key}
            >
              Limpar filtros da tabela
            </button>
          </div>
        </div>
        <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("codigoCatalogo")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Codigo {sortState.key === "codigoCatalogo" ? (sortState.dir === "asc" ? "▲" : "▼") : ""}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("descricao")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Descricao {sortState.key === "descricao" ? (sortState.dir === "asc" ? "▲" : "▼") : ""}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("grupo")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Grupo {sortState.key === "grupo" ? (sortState.dir === "asc" ? "▲" : "▼") : ""}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("permanente")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Permanente {sortState.key === "permanente" ? (sortState.dir === "asc" ? "▲" : "▼") : ""}
                  </button>
                </th>
                <th className="px-3 py-2">
                  <button type="button" onClick={() => toggleSort("totalBens")} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Bens {sortState.key === "totalBens" ? (sortState.dir === "asc" ? "▲" : "▼") : ""}
                  </button>
                </th>
                <th className="px-3 py-2">Foto</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
              <tr className="bg-slate-50">
                <th className="px-2 py-1">
                  <input
                    value={columnFilters.codigoCatalogo}
                    onChange={(e) => setColumnFilters((p) => ({ ...p, codigoCatalogo: e.target.value }))}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                    placeholder="Filtrar"
                  />
                </th>
                <th className="px-2 py-1">
                  <input
                    value={columnFilters.descricao}
                    onChange={(e) => setColumnFilters((p) => ({ ...p, descricao: e.target.value }))}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                    placeholder="Filtrar"
                  />
                </th>
                <th className="px-2 py-1">
                  <input
                    value={columnFilters.grupo}
                    onChange={(e) => setColumnFilters((p) => ({ ...p, grupo: e.target.value }))}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                    placeholder="Filtrar"
                  />
                </th>
                <th className="px-2 py-1">
                  <select
                    value={columnFilters.permanente}
                    onChange={(e) => setColumnFilters((p) => ({ ...p, permanente: e.target.value }))}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                  >
                    <option value="">Todos</option>
                    <option value="SIM">SIM</option>
                    <option value="NAO">NAO</option>
                  </select>
                </th>
                <th className="px-2 py-1">
                  <input
                    value={columnFilters.totalBens}
                    onChange={(e) => setColumnFilters((p) => ({ ...p, totalBens: e.target.value }))}
                    className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px]"
                    placeholder="Qtd"
                  />
                </th>
                <th className="px-2 py-1 text-[11px] text-slate-500">-</th>
                <th className="px-2 py-1 text-[11px] text-slate-500">-</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {itemsFiltradosOrdenados.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{c.codigoCatalogo}</td>
                  <td className="px-3 py-2 text-slate-900">{c.descricao}</td>
                  <td className="px-3 py-2 text-slate-600">{c.grupo || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{c.materialPermanente ? "SIM" : "NAO"}</td>
                  <td className="px-3 py-2 text-slate-600">{c.totalBens ?? 0}</td>
                  <td className="px-3 py-2">
                    {c.fotoReferenciaUrl ? (
                      <a href={getFotoUrl(c.fotoReferenciaUrl)} target="_blank" rel="noopener noreferrer">
                        <img
                          src={getFotoUrl(c.fotoReferenciaUrl)}
                          alt={`Foto ${c.codigoCatalogo}`}
                          className="h-8 w-8 rounded border border-slate-300 object-cover"
                        />
                      </a>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onEditar(c)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void onVerBensAssociados(c)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-100"
                      >
                        Ver bens
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAssocForm((p) => ({ ...p, catalogoId: String(c.id) }));
                          fileRef.current = c;
                        }}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-100"
                      >
                        Selecionar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          fileRef.current = c;
                          document.getElementById("catalogo-foto-upload-input")?.click();
                        }}
                        disabled={uploadState.loading}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-100 disabled:opacity-50"
                      >
                        {uploadState.loading ? "Enviando..." : "Foto"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {itemsFiltradosOrdenados.length === 0 && !listState.loading ? (
                <tr>
                  <td className="px-3 py-3 text-slate-600" colSpan={7}>
                    Nenhum catalogo encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <input
          id="catalogo-foto-upload-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file || !fileRef.current) return;
            await onUploadFoto(fileRef.current, file);
          }}
        />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-900">Bens e fotos associados ao Material (SKU)</h4>
          {selectedCatalogo?.codigoCatalogo ? (
            <span className="text-xs text-slate-600">
              Material (SKU): <strong>{selectedCatalogo.codigoCatalogo}</strong>
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Use o botao <strong>Ver bens</strong> na lista para carregar os itens associados e suas fotos.
        </p>
        {bensState.error ? <p className="mt-3 text-sm text-rose-700">{bensState.error}</p> : null}
        {bensState.loading ? <p className="mt-3 text-sm text-slate-600">Carregando bens associados...</p> : null}
        {!bensState.loading && selectedCatalogo && bensState.items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Nenhum bem associado encontrado para este catalogo.</p>
        ) : null}

        {bensState.items.length > 0 ? (
          <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-3 py-2">Tombo</th>
                  <th className="px-3 py-2">Descricao</th>
                  <th className="px-3 py-2">Unidade</th>
                  <th className="px-3 py-2">Local</th>
                  <th className="px-3 py-2">Foto item</th>
                  <th className="px-3 py-2">Foto catalogo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bensState.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{item.numeroTombamento || "-"}</td>
                    <td className="px-3 py-2 text-slate-900">{item.nomeResumo || item.catalogoDescricao || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{item.unidadeDonaId ? `${item.unidadeDonaId}` : "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{item.localNome || item.localFisico || "-"}</td>
                    <td className="px-3 py-2">
                      {item.fotoUrl ? (
                        <a
                          href={getFotoUrl(item.fotoUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex"
                        >
                          <img
                            src={getFotoUrl(item.fotoUrl)}
                            alt={`Foto item ${item.numeroTombamento || ""}`}
                            className="h-8 w-8 rounded border border-slate-300 object-cover"
                          />
                        </a>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {item.fotoReferenciaUrl ? (
                        <a
                          href={getFotoUrl(item.fotoReferenciaUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex"
                        >
                          <img
                            src={getFotoUrl(item.fotoReferenciaUrl)}
                            alt={`Foto catalogo ${item.codigoCatalogo || ""}`}
                            className="h-8 w-8 rounded border border-slate-300 object-cover"
                          />
                        </a>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-semibold text-slate-900">Associar patrimonios ao Material (SKU)</h4>
        <p className="mt-1 text-[11px] text-slate-500">
          Informe os tombamentos GEAFIN (10 digitos), separados por espaco, virgula ou quebra de linha.
        </p>
        <form onSubmit={onAssociar} className="mt-3 grid gap-3">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Material (SKU) destino</span>
            <select
              value={assocForm.catalogoId}
              onChange={(e) => setAssocForm((p) => ({ ...p, catalogoId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {(listState.data?.items || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigoCatalogo} - {c.descricao}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Tombamentos</span>
            <textarea
              value={assocForm.tombamentosTexto}
              onChange={(e) => setAssocForm((p) => ({ ...p, tombamentosTexto: e.target.value }))}
              className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Ex.: 1290001788, 1290001789..."
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(assocForm.dryRun)}
              onChange={(e) => setAssocForm((p) => ({ ...p, dryRun: e.target.checked }))}
              className="h-4 w-4 accent-violet-600"
            />
            Dry-run (simular sem aplicar)
          </label>
          <button
            type="submit"
            disabled={assocState.loading || (!canAdmin && auth.authEnabled)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {assocState.loading ? "Processando..." : assocForm.dryRun ? "Simular associacao" : "Associar patrimonios"}
          </button>
          {assocState.error ? <p className="text-sm text-rose-700">{assocState.error}</p> : null}
          {assocState.response ? (
            <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs">
              {JSON.stringify(assocState.response, null, 2)}
            </pre>
          ) : null}
        </form>
      </div>
    </article>
  );
}
