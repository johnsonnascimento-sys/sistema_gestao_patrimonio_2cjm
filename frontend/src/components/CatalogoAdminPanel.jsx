/**
 * Modulo: frontend/components
 * Arquivo: CatalogoAdminPanel.jsx
 * Funcao no sistema: administrar catalogo de bens (CRUD) e associar bens ao catalogo por tombamento.
 */
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  associarBensCatalogo,
  atualizarCatalogo,
  criarCatalogo,
  getFotoUrl,
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

  const loadCatalogos = async () => {
    if (!canAdmin) return;
    setListState({ loading: true, data: null, error: null });
    try {
      const data = await listarCatalogos({
        q: filtros.q.trim() || undefined,
        codigoCatalogo: filtros.codigoCatalogo.trim() || undefined,
        grupo: filtros.grupo.trim() || undefined,
        limit: 400,
        offset: 0,
      });
      setListState({ loading: false, data, error: null });
    } catch (error) {
      setListState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  useEffect(() => {
    if (!canAdmin) return;
    void loadCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

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
      setFormState({ loading: false, response: data, error: null });
      if (editId) {
        setEditId("");
      } else {
        setForm({ codigoCatalogo: "", descricao: "", grupo: "", materialPermanente: false });
      }
      await loadCatalogos();
    } catch (error) {
      setFormState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const onEditar = (catalogo) => {
    if (!catalogo?.id) return;
    setEditId(String(catalogo.id));
    setForm({
      codigoCatalogo: String(catalogo.codigoCatalogo || ""),
      descricao: String(catalogo.descricao || ""),
      grupo: String(catalogo.grupo || ""),
      materialPermanente: Boolean(catalogo.materialPermanente),
    });
    setFormState({ loading: false, response: null, error: null });
  };

  const onCancelarEdicao = () => {
    setEditId("");
    setForm({ codigoCatalogo: "", descricao: "", grupo: "", materialPermanente: false });
    setFormState({ loading: false, response: null, error: null });
  };

  const onUploadFoto = async (catalogo, file) => {
    if (!canAdmin || !catalogo?.id || !file) return;
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
      await loadCatalogos();
    } catch (error) {
      setUploadState({ loading: false, error: formatApiError(error) });
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

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Catalogo (SKU) cadastrado</h3>
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
          <h4 className="text-sm font-semibold text-slate-900">Criar/editar catalogo</h4>
          <div className="mt-3 grid gap-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Codigo catalogo</span>
              <input
                value={form.codigoCatalogo}
                onChange={(e) => setForm((p) => ({ ...p, codigoCatalogo: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex.: 101004470"
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
            <button
              type="submit"
              disabled={formState.loading || (!canAdmin && auth.authEnabled)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {formState.loading ? "Salvando..." : editId ? "Atualizar catalogo" : "Criar catalogo"}
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
        <h4 className="text-sm font-semibold text-slate-900">Lista de catalogo</h4>
        <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2">Codigo</th>
                <th className="px-3 py-2">Descricao</th>
                <th className="px-3 py-2">Grupo</th>
                <th className="px-3 py-2">Permanente</th>
                <th className="px-3 py-2">Bens</th>
                <th className="px-3 py-2">Foto</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(listState.data?.items || []).map((c) => (
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
              {(listState.data?.items || []).length === 0 && !listState.loading ? (
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
        <h4 className="text-sm font-semibold text-slate-900">Associar patrimonios ao catalogo</h4>
        <p className="mt-1 text-[11px] text-slate-500">
          Informe os tombamentos GEAFIN (10 digitos), separados por espaco, virgula ou quebra de linha.
        </p>
        <form onSubmit={onAssociar} className="mt-3 grid gap-3">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Catalogo destino</span>
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
