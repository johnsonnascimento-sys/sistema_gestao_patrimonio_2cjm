/**
 * Modulo: frontend/components
 * Arquivo: LocaisAdminPanel.jsx
 * Funcao no sistema: administrar locais (CRUD + vinculo em lote de bens.local_id) no fluxo operacional.
 */
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  atualizarLocal,
  criarLocal,
  listarLocais,
  vincularBensAoLocal,
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

export default function LocaisAdminPanel({ canAdmin }) {
  const auth = useAuth();
  const [locaisState, setLocaisState] = useState({ loading: false, data: null, error: null });
  const [locaisFilterUnidadeId, setLocaisFilterUnidadeId] = useState("");
  const [locaisIncludeInativos, setLocaisIncludeInativos] = useState(false);
  const [localForm, setLocalForm] = useState({ nome: "", unidadeId: "", tipo: "", observacoes: "" });
  const [localEditId, setLocalEditId] = useState("");
  const [localFormState, setLocalFormState] = useState({ loading: false, response: null, error: null });
  const [mapLocalForm, setMapLocalForm] = useState({
    localId: "",
    termoLocalFisico: "",
    somenteSemLocalId: true,
    unidadeDonaId: "",
    dryRun: true,
  });
  const [mapLocalState, setMapLocalState] = useState({ loading: false, response: null, error: null });

  const setLocalField = (key, value) =>
    setLocalForm((prev) => ({
      ...prev,
      [key]: value,
    }));

  const setMapLocalField = (key, value) =>
    setMapLocalForm((prev) => ({
      ...prev,
      [key]: value,
    }));

  const loadLocais = async () => {
    if (!canAdmin) return;
    setLocaisState({ loading: true, data: null, error: null });
    try {
      const unidade = locaisFilterUnidadeId ? Number(locaisFilterUnidadeId) : null;
      const data = await listarLocais({
        ...(unidade ? { unidadeId: unidade } : {}),
        includeInativos: locaisIncludeInativos,
      });
      setLocaisState({ loading: false, data, error: null });
    } catch (error) {
      setLocaisState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  useEffect(() => {
    if (!canAdmin) return;
    void loadLocais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin, locaisFilterUnidadeId, locaisIncludeInativos]);

  const onCreateLocal = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setLocalFormState({ loading: false, response: null, error: "Operacao restrita ao perfil ADMIN." });
      return;
    }
    const nome = String(localForm.nome || "").trim();
    if (!nome) {
      setLocalFormState({ loading: false, response: null, error: "Informe o nome do local." });
      return;
    }
    const unidadeId = localForm.unidadeId ? Number(localForm.unidadeId) : null;
    setLocalFormState({ loading: true, response: null, error: null });
    try {
      const payload = {
        nome,
        unidadeId: unidadeId || null,
        tipo: localForm.tipo.trim() || null,
        observacoes: localForm.observacoes.trim() || null,
      };
      const data = localEditId
        ? await atualizarLocal(String(localEditId), payload)
        : await criarLocal(payload);
      setLocalFormState({ loading: false, response: data, error: null });
      setLocalForm({ nome: "", unidadeId: "", tipo: "", observacoes: "" });
      setLocalEditId("");
      await loadLocais();
    } catch (error) {
      setLocalFormState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const beginEditLocal = (local) => {
    if (!local?.id) return;
    setLocalEditId(String(local.id));
    setLocalForm({
      nome: String(local.nome || ""),
      unidadeId: local.unidadeId != null ? String(local.unidadeId) : "",
      tipo: String(local.tipo || ""),
      observacoes: String(local.observacoes || ""),
    });
    setLocalFormState({ loading: false, response: null, error: null });
  };

  const cancelEditLocal = () => {
    setLocalEditId("");
    setLocalForm({ nome: "", unidadeId: "", tipo: "", observacoes: "" });
    setLocalFormState({ loading: false, response: null, error: null });
  };

  const toggleLocalAtivo = async (local) => {
    if (!canAdmin || !local?.id) return;
    setLocalFormState({ loading: true, response: null, error: null });
    try {
      await atualizarLocal(String(local.id), { ativo: !local.ativo });
      setLocalFormState({ loading: false, response: null, error: null });
      await loadLocais();
    } catch (error) {
      setLocalFormState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const onMapBensLocal = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setMapLocalState({ loading: false, response: null, error: "Operacao restrita ao perfil ADMIN." });
      return;
    }
    const localId = String(mapLocalForm.localId || "").trim();
    const termo = String(mapLocalForm.termoLocalFisico || "").trim();
    if (!localId || !termo) {
      setMapLocalState({ loading: false, response: null, error: "Informe localId e termoLocalFisico." });
      return;
    }
    const unidade = mapLocalForm.unidadeDonaId ? Number(mapLocalForm.unidadeDonaId) : null;
    setMapLocalState({ loading: true, response: null, error: null });
    try {
      const data = await vincularBensAoLocal({
        localId,
        termoLocalFisico: termo,
        somenteSemLocalId: Boolean(mapLocalForm.somenteSemLocalId),
        unidadeDonaId: unidade || undefined,
        dryRun: Boolean(mapLocalForm.dryRun),
      });
      setMapLocalState({ loading: false, response: data, error: null });
    } catch (error) {
      setMapLocalState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Locais (salas) cadastrados</h3>
          <p className="mt-1 text-xs text-slate-600">
            Fonte de verdade para o campo "Local cadastrado" no inventario por sala.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <label className="space-y-1">
            <span className="block text-[11px] text-slate-600">Filtrar por unidade</span>
            <select
              value={locaisFilterUnidadeId}
              onChange={(e) => setLocaisFilterUnidadeId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={!canAdmin}
            >
              <option value="">Todas</option>
              <option value="1">1 (1a Aud)</option>
              <option value="2">2 (2a Aud)</option>
              <option value="3">3 (Foro)</option>
              <option value="4">4 (Almox)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={locaisIncludeInativos}
              onChange={(e) => setLocaisIncludeInativos(e.target.checked)}
              disabled={!canAdmin}
            />
            Mostrar inativos
          </label>
          <button
            type="button"
            onClick={loadLocais}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
            disabled={!canAdmin || locaisState.loading}
            title={!canAdmin ? "Somente ADMIN." : "Recarregar lista."}
          >
            {locaisState.loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {!canAdmin && auth.authEnabled ? (
        <p className="mt-3 text-xs text-rose-700">
          Operacao restrita ao perfil <strong>ADMIN</strong>.
        </p>
      ) : null}
      {locaisState.error ? <p className="mt-3 text-sm text-rose-700">{locaisState.error}</p> : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form onSubmit={onCreateLocal} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Criar/atualizar local</h4>
          <p className="mt-1 text-[11px] text-slate-500">
            Upsert por <code className="px-1">nome</code>. Use nomes padronizados.
          </p>
          <div className="mt-3 grid gap-2">
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Nome</span>
              <input
                value={localForm.nome}
                onChange={(e) => setLocalField("nome", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex.: Sala 101"
                disabled={!canAdmin && auth.authEnabled}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Unidade (opcional)</span>
              <select
                value={localForm.unidadeId}
                onChange={(e) => setLocalField("unidadeId", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={!canAdmin && auth.authEnabled}
              >
                <option value="">(geral)</option>
                <option value="1">1 (1a Aud)</option>
                <option value="2">2 (2a Aud)</option>
                <option value="3">3 (Foro)</option>
                <option value="4">4 (Almox)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Tipo (opcional)</span>
              <input
                value={localForm.tipo}
                onChange={(e) => setLocalField("tipo", e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex.: SALA, HALL, PLENARIO"
                disabled={!canAdmin && auth.authEnabled}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Observacoes (opcional)</span>
              <textarea
                value={localForm.observacoes}
                onChange={(e) => setLocalField("observacoes", e.target.value)}
                className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Ex.: Sala de reuniao principal."
                disabled={!canAdmin && auth.authEnabled}
              />
            </label>
            <button
              type="submit"
              disabled={localFormState.loading || (!canAdmin && auth.authEnabled)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {localFormState.loading ? "Salvando..." : localEditId ? "Atualizar local" : "Salvar local"}
            </button>
            {localEditId ? (
              <button
                type="button"
                onClick={cancelEditLocal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
                disabled={localFormState.loading}
              >
                Cancelar edicao
              </button>
            ) : null}
            {localFormState.error ? <p className="text-sm text-rose-700">{localFormState.error}</p> : null}
            {localFormState.response?.local?.id ? (
              <p className="text-xs text-emerald-700">
                Salvo: {localFormState.response.local.nome} (id={localFormState.response.local.id})
              </p>
            ) : null}
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Lista</h4>
          <p className="mt-1 text-[11px] text-slate-500">Mantenha nomes curtos e padronizados.</p>
          <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Unidade</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Ativo</th>
                  <th className="px-3 py-2">Acoes</th>
                  <th className="px-3 py-2">Id</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(locaisState.data?.items || []).slice(0, 500).map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-900">{l.nome}</td>
                    <td className="px-3 py-2 text-slate-600">{l.unidadeId ? String(l.unidadeId) : "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{l.tipo || "-"}</td>
                    <td className="px-3 py-2 text-slate-600">{l.ativo === false ? "NAO" : "SIM"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => beginEditLocal(l)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-100"
                          disabled={!canAdmin || localFormState.loading}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleLocalAtivo(l)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-100"
                          disabled={!canAdmin || localFormState.loading}
                          title="Desativar/ativar local (soft delete)."
                        >
                          {l.ativo === false ? "Ativar" : "Desativar"}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{l.id}</td>
                  </tr>
                ))}
                {(locaisState.data?.items || []).length === 0 && !locaisState.loading ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-600" colSpan={6}>
                      Nenhum local cadastrado ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-semibold text-slate-900">Vincular bens ao local (em lote)</h4>
        <p className="mt-1 text-[11px] text-slate-500">
          Operacao para popular <code className="px-1">bens.local_id</code> a partir do texto do GEAFIN.
        </p>
        <form onSubmit={onMapBensLocal} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">Local (destino)</span>
            <select
              value={mapLocalForm.localId}
              onChange={(e) => setMapLocalField("localId", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={!canAdmin && auth.authEnabled}
            >
              <option value="">Selecione um local</option>
              {(locaisState.data?.items || []).filter((l) => l.ativo !== false).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome} (id {String(l.id).slice(0, 8)}...)
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">termoLocalFisico (texto do GEAFIN)</span>
            <input
              value={mapLocalForm.termoLocalFisico}
              onChange={(e) => setMapLocalField("termoLocalFisico", e.target.value)}
              placeholder='Ex.: "Sala 101" ou "Hall 6"'
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={!canAdmin && auth.authEnabled}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Unidade dona (opcional)</span>
            <select
              value={mapLocalForm.unidadeDonaId}
              onChange={(e) => setMapLocalField("unidadeDonaId", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={!canAdmin && auth.authEnabled}
            >
              <option value="">(todas)</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={Boolean(mapLocalForm.somenteSemLocalId)}
                onChange={(e) => setMapLocalField("somenteSemLocalId", e.target.checked)}
                className="h-4 w-4 accent-violet-600"
              />
              Somente sem localId
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={Boolean(mapLocalForm.dryRun)}
                onChange={(e) => setMapLocalField("dryRun", e.target.checked)}
                className="h-4 w-4 accent-violet-600"
              />
              Dry-run (nao aplica)
            </label>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={mapLocalState.loading || (!canAdmin && auth.authEnabled)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {mapLocalState.loading ? "Executando..." : mapLocalForm.dryRun ? "Simular" : "Aplicar vinculacao"}
            </button>
            {mapLocalState.error ? <p className="mt-2 text-sm text-rose-700">{mapLocalState.error}</p> : null}
            {mapLocalState.response ? (
              <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                {JSON.stringify(mapLocalState.response, null, 2)}
              </pre>
            ) : null}
          </div>
        </form>
      </div>
    </article>
  );
}
