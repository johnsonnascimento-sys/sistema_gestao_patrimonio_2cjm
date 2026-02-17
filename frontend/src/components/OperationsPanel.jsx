/**
 * Modulo: frontend/components
 * Arquivo: OperationsPanel.jsx
 * Funcao no sistema: painel operacional para consumir endpoints backend de importacao e movimentacao.
 */
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  API_BASE_URL,
  criarLocal,
  criarPerfil,
  listarPerfis,
  atualizarPerfil,
  resetSenhaPerfil,
  cancelarImportacaoGeafin,
  getHealth,
  getUltimaImportacaoGeafin,
  importarGeafin,
  listarLocais,
  vincularBensAoLocal,
} from "../services/apiClient.js";

export default function OperationsPanel() {
  const auth = useAuth();
  const canAdmin = !auth.authEnabled || String(auth.role || "").toUpperCase() === "ADMIN";

  const [healthState, setHealthState] = useState({
    loading: false,
    data: null,
    error: null,
  });
  const [perfilState, setPerfilState] = useState({
    loading: false,
    response: null,
    error: null,
  });
  const [importState, setImportState] = useState({
    loading: false,
    response: null,
    error: null,
  });
  const [importProgress, setImportProgress] = useState({
    loading: false,
    data: null,
    error: null,
  });
  const importPollTimerRef = useRef(null);
  const importAbortRef = useRef(null);

  const [locaisState, setLocaisState] = useState({ loading: false, data: null, error: null });
  const [locaisFilterUnidadeId, setLocaisFilterUnidadeId] = useState("");
  const [localForm, setLocalForm] = useState({ nome: "", unidadeId: "", tipo: "", observacoes: "" });
  const [localFormState, setLocalFormState] = useState({ loading: false, response: null, error: null });
  const [mapLocalForm, setMapLocalForm] = useState({
    localId: "",
    termoLocalFisico: "",
    somenteSemLocalId: true,
    unidadeDonaId: "",
    dryRun: true,
  });
  const [mapLocalState, setMapLocalState] = useState({ loading: false, response: null, error: null });

  const [csvFile, setCsvFile] = useState(null);
  const [unidadePadraoId, setUnidadePadraoId] = useState("");
  const [perfilForm, setPerfilForm] = useState({
    matricula: "",
    nome: "",
    email: "",
    unidadeId: "",
    cargo: "",
  });
  const [perfisState, setPerfisState] = useState({ loading: false, data: null, error: null });
  const [perfilEditId, setPerfilEditId] = useState("");
  const [perfilEditForm, setPerfilEditForm] = useState({
    nome: "",
    email: "",
    unidadeId: "",
    cargo: "",
    role: "OPERADOR",
    ativo: true,
  });
  const [perfilEditState, setPerfilEditState] = useState({ loading: false, response: null, error: null });

  const formatApiError = (error) => {
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
  };

  const stopImportPolling = () => {
    if (importPollTimerRef.current) {
      window.clearInterval(importPollTimerRef.current);
      importPollTimerRef.current = null;
    }
  };

  const pollImportProgressOnce = async () => {
    const data = await getUltimaImportacaoGeafin();
    const imp = data?.importacao || null;
    const running = imp?.status === "EM_ANDAMENTO";
    setImportProgress({ loading: running, data, error: null });
    if (!running) stopImportPolling();
    return { data, running };
  };

  const startImportPolling = async () => {
    stopImportPolling();
    try {
      await pollImportProgressOnce();
    } catch (error) {
      // Erro transitorio: mantem a UI viva e tenta novamente no proximo tick.
      setImportProgress((prev) => ({ ...prev, loading: true, error: formatApiError(error) }));
    }
    importPollTimerRef.current = window.setInterval(async () => {
      try {
        await pollImportProgressOnce();
      } catch (error) {
        setImportProgress((prev) => ({ ...prev, loading: true, error: prev.data ? null : formatApiError(error) }));
      }
    }, 1000);
  };

  useEffect(() => {
    if (!canAdmin) return () => stopImportPolling();
    let alive = true;
    (async () => {
      try {
        const data = await getUltimaImportacaoGeafin();
        if (!alive) return;
        const imp = data?.importacao || null;
        if (!imp) return;
        const running = imp.status === "EM_ANDAMENTO";
        setImportProgress({ loading: running, data, error: null });
        if (running) await startImportPolling();
      } catch (_error) {
        // Sem fatal: a tela continua operando mesmo se o endpoint de progresso estiver indisponivel.
      }
    })();
    return () => {
      alive = false;
      stopImportPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  const onHealth = async () => {
    setHealthState({ loading: true, data: null, error: null });
    try {
      const data = await getHealth();
      setHealthState({ loading: false, data, error: null });
    } catch (error) {
      setHealthState({
        loading: false,
        data: null,
        error: formatApiError(error),
      });
    }
  };

  const onImport = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setImportState({ loading: false, response: null, error: "Operação restrita ao perfil ADMIN." });
      return;
    }
    if (!csvFile) {
      setImportState({
        loading: false,
        response: null,
        error: "Selecione um arquivo CSV GEAFIN.",
      });
      return;
    }
    const abortController = new AbortController();
    importAbortRef.current = abortController;
    setImportState({ loading: true, response: null, error: null });
    setImportProgress({ loading: true, data: null, error: null });
    await startImportPolling();
    try {
      const data = await importarGeafin(
        csvFile,
        unidadePadraoId ? Number(unidadePadraoId) : null,
        { signal: abortController.signal },
      );
      setImportState({ loading: false, response: data, error: null });
    } catch (error) {
      if (abortController.signal.aborted) {
        setImportState({ loading: false, response: null, error: "Importação cancelada." });
      } else {
      setImportState({
        loading: false,
        response: null,
          error: formatApiError(error),
      });
      }
    } finally {
      importAbortRef.current = null;
      stopImportPolling();
      // Faz uma ultima consulta para exibir status final.
      try {
        const { data, running } = await pollImportProgressOnce();
        if (!running) setImportProgress({ loading: false, data, error: null });
      } catch (error) {
        setImportProgress((prev) => ({ ...prev, loading: false, error: formatApiError(error) }));
      }
    }
  };

  const onCancelImport = async () => {
    if (!canAdmin) return;
    const impId = importProgress.data?.importacao?.id ? String(importProgress.data.importacao.id) : "";
    if (!impId) return;

    // Cancela fetch em curso (se houver) para a UI reagir imediatamente.
    if (importAbortRef.current) {
      try {
        importAbortRef.current.abort();
      } catch (_e) {
        // noop
      }
      importAbortRef.current = null;
    }

    stopImportPolling();
    setImportProgress((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await cancelarImportacaoGeafin(impId, "Cancelada via UI (ADMIN).");
      await pollImportProgressOnce();
    } catch (error) {
      setImportProgress((prev) => ({ ...prev, loading: false, error: formatApiError(error) }));
    } finally {
      setImportState((prev) => ({ ...prev, loading: false }));
    }
  };

  const onCreatePerfil = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setPerfilState({ loading: false, response: null, error: "Operação restrita ao perfil ADMIN." });
      return;
    }
    const payload = {
      matricula: perfilForm.matricula.trim(),
      nome: perfilForm.nome.trim(),
      unidadeId: perfilForm.unidadeId ? Number(perfilForm.unidadeId) : null,
      email: perfilForm.email.trim() || undefined,
      cargo: perfilForm.cargo.trim() || undefined,
    };

    if (!payload.matricula || !payload.nome || !payload.unidadeId) {
      setPerfilState({
        loading: false,
        response: null,
        error: "Preencha matricula, nome e unidadeId.",
      });
      return;
    }

    setPerfilState({ loading: true, response: null, error: null });
    try {
      const data = await criarPerfil(payload);
      setPerfilState({ loading: false, response: data, error: null });
      setPerfilForm({ matricula: "", nome: "", email: "", unidadeId: "", cargo: "" });
      await loadPerfis();
    } catch (error) {
      setPerfilState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const loadPerfis = async () => {
    if (!canAdmin) return;
    setPerfisState({ loading: true, data: null, error: null });
    try {
      const data = await listarPerfis({ limit: 200 });
      setPerfisState({ loading: false, data, error: null });
    } catch (error) {
      setPerfisState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  const beginEditPerfil = (perfil) => {
    if (!perfil?.id) return;
    setPerfilEditId(String(perfil.id));
    setPerfilEditForm({
      nome: String(perfil.nome || ""),
      email: String(perfil.email || ""),
      unidadeId: perfil.unidadeId != null ? String(perfil.unidadeId) : "",
      cargo: String(perfil.cargo || ""),
      role: String(perfil.role || "OPERADOR"),
      ativo: Boolean(perfil.ativo),
    });
    setPerfilEditState({ loading: false, response: null, error: null });
  };

  const cancelEditPerfil = () => {
    setPerfilEditId("");
    setPerfilEditState({ loading: false, response: null, error: null });
  };

  const savePerfilEdit = async () => {
    if (!canAdmin) return;
    const id = String(perfilEditId || "").trim();
    if (!id) return;
    const patch = {
      nome: String(perfilEditForm.nome || "").trim(),
      email: String(perfilEditForm.email || "").trim() || null,
      unidadeId: perfilEditForm.unidadeId ? Number(perfilEditForm.unidadeId) : null,
      cargo: String(perfilEditForm.cargo || "").trim() || null,
      role: String(perfilEditForm.role || "OPERADOR").trim(),
      ativo: Boolean(perfilEditForm.ativo),
    };
    if (!patch.nome || !patch.unidadeId) {
      setPerfilEditState({ loading: false, response: null, error: "Preencha nome e unidadeId." });
      return;
    }
    setPerfilEditState({ loading: true, response: null, error: null });
    try {
      const data = await atualizarPerfil(id, patch);
      setPerfilEditState({ loading: false, response: data, error: null });
      await loadPerfis();
      cancelEditPerfil();
    } catch (error) {
      setPerfilEditState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const togglePerfilAtivo = async (perfil) => {
    if (!canAdmin || !perfil?.id) return;
    setPerfilEditState({ loading: true, response: null, error: null });
    try {
      await atualizarPerfil(String(perfil.id), { ativo: !perfil.ativo });
      await loadPerfis();
      setPerfilEditState({ loading: false, response: null, error: null });
    } catch (error) {
      setPerfilEditState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const onResetSenhaPerfil = async (perfil) => {
    if (!canAdmin || !perfil?.id) return;
    setPerfilEditState({ loading: true, response: null, error: null });
    try {
      await resetSenhaPerfil(String(perfil.id));
      await loadPerfis();
      setPerfilEditState({ loading: false, response: null, error: null });
    } catch (error) {
      setPerfilEditState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const loadLocais = async () => {
    if (!canAdmin) return;
    setLocaisState({ loading: true, data: null, error: null });
    try {
      const unidade = locaisFilterUnidadeId ? Number(locaisFilterUnidadeId) : null;
      const data = await listarLocais(unidade ? { unidadeId: unidade } : {});
      setLocaisState({ loading: false, data, error: null });
    } catch (error) {
      setLocaisState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  useEffect(() => {
    if (!canAdmin) return;
    void loadLocais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin, locaisFilterUnidadeId]);

  useEffect(() => {
    if (!canAdmin) return;
    void loadPerfis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdmin]);

  const onCreateLocal = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setLocalFormState({ loading: false, response: null, error: "Operação restrita ao perfil ADMIN." });
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
      const data = await criarLocal({
        nome,
        unidadeId: unidadeId || null,
        tipo: localForm.tipo.trim() || null,
        observacoes: localForm.observacoes.trim() || null,
      });
      setLocalFormState({ loading: false, response: data, error: null });
      setLocalForm({ nome: "", unidadeId: "", tipo: "", observacoes: "" });
      await loadLocais();
    } catch (error) {
      setLocalFormState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  const onMapBensLocal = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setMapLocalState({ loading: false, response: null, error: "Operação restrita ao perfil ADMIN." });
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

  const setPerfilField = (key, value) =>
    setPerfilForm((prev) => ({
      ...prev,
      [key]: value,
    }));

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

  return (
    <section className="mt-6 space-y-6 rounded-2xl border border-white/15 bg-slate-900/55 p-6">
      <header>
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Operações API</h2>
        <p className="mt-2 text-sm text-slate-300">
          Integracao direta com backend em{" "}
          <code className="rounded bg-slate-950/70 px-1 py-0.5 text-cyan-200">
            {API_BASE_URL}
          </code>
          .
        </p>
      </header>

      <article className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
        <h3 className="font-semibold">Conectividade backend</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onHealth}
            className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-cyan-200"
          >
            Testar /health
          </button>
          {healthState.loading && <span className="text-sm text-slate-300">Consultando...</span>}
          {healthState.error && (
            <span className="text-sm text-rose-300">{healthState.error}</span>
          )}
          {healthState.data && (
            <span className="text-sm text-emerald-300">
              OK ({healthState.data.status}) requestId={healthState.data.requestId}
            </span>
          )}
        </div>
      </article>

      <article className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Locais (salas) cadastrados</h3>
            <p className="mt-1 text-xs text-slate-300">
              Fonte de verdade para o campo "Local cadastrado" no Modo Inventário. O Admin gerencia aqui.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <label className="space-y-1">
              <span className="block text-[11px] text-slate-300">Filtrar por unidade</span>
              <select
                value={locaisFilterUnidadeId}
                onChange={(e) => setLocaisFilterUnidadeId(e.target.value)}
                className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                disabled={!canAdmin}
              >
                <option value="">Todas</option>
                <option value="1">1 (1a Aud)</option>
                <option value="2">2 (2a Aud)</option>
                <option value="3">3 (Foro)</option>
                <option value="4">4 (Almox)</option>
              </select>
            </label>
            <button
              type="button"
              onClick={loadLocais}
              className="rounded-lg border border-white/25 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              disabled={!canAdmin || locaisState.loading}
              title={!canAdmin ? "Somente ADMIN." : "Recarregar lista."}
            >
              {locaisState.loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        {!canAdmin && auth.authEnabled ? (
          <p className="mt-3 text-xs text-rose-200">
            Operação restrita ao perfil <strong>ADMIN</strong>.
          </p>
        ) : null}
        {locaisState.error ? <p className="mt-3 text-sm text-rose-300">{locaisState.error}</p> : null}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <form onSubmit={onCreateLocal} className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <h4 className="text-sm font-semibold text-slate-100">Criar/atualizar local</h4>
            <p className="mt-1 text-[11px] text-slate-400">
              Upsert por <code className="px-1">nome</code>. Use nomes padronizados: "Sala 101", "Hall 6º Andar", "Plenário 2ª Auditoria".
            </p>
            <div className="mt-3 grid gap-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Nome</span>
                <input
                  value={localForm.nome}
                  onChange={(e) => setLocalField("nome", e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  placeholder="Ex.: Sala 101"
                  disabled={!canAdmin && auth.authEnabled}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Unidade (opcional)</span>
                <select
                  value={localForm.unidadeId}
                  onChange={(e) => setLocalField("unidadeId", e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
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
                <span className="text-xs text-slate-300">Tipo (opcional)</span>
                <input
                  value={localForm.tipo}
                  onChange={(e) => setLocalField("tipo", e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  placeholder="Ex.: SALA, HALL, PLENARIO"
                  disabled={!canAdmin && auth.authEnabled}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Observações (opcional)</span>
                <textarea
                  value={localForm.observacoes}
                  onChange={(e) => setLocalField("observacoes", e.target.value)}
                  className="min-h-20 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  placeholder="Ex.: Sala de reunião principal do 6º andar."
                  disabled={!canAdmin && auth.authEnabled}
                />
              </label>
              <button
                type="submit"
                disabled={localFormState.loading || (!canAdmin && auth.authEnabled)}
                className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                {localFormState.loading ? "Salvando..." : "Salvar local"}
              </button>
              {localFormState.error ? <p className="text-sm text-rose-300">{localFormState.error}</p> : null}
              {localFormState.response?.local?.id ? (
                <p className="text-xs text-emerald-200">
                  Salvo: {localFormState.response.local.nome} (id={localFormState.response.local.id})
                </p>
              ) : null}
            </div>
          </form>

          <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <h4 className="text-sm font-semibold text-slate-100">Lista</h4>
            <p className="mt-1 text-[11px] text-slate-400">Dica: mantenha nomes curtos e padronizados para facilitar a seleção.</p>
            <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-white/10">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-300">
                  <tr>
                    <th className="px-3 py-2">Nome</th>
                    <th className="px-3 py-2">Unidade</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Id</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {(locaisState.data?.items || []).slice(0, 500).map((l) => (
                    <tr key={l.id} className="hover:bg-white/5">
                      <td className="px-3 py-2 text-slate-100">{l.nome}</td>
                      <td className="px-3 py-2 text-slate-300">{l.unidadeId ? String(l.unidadeId) : "-"}</td>
                      <td className="px-3 py-2 text-slate-300">{l.tipo || "-"}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-300">{l.id}</td>
                    </tr>
                  ))}
                  {(locaisState.data?.items || []).length === 0 && !locaisState.loading ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-300" colSpan={4}>
                        Nenhum local cadastrado ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <h4 className="text-sm font-semibold text-slate-100">Vincular bens ao local (em lote)</h4>
          <p className="mt-1 text-[11px] text-slate-400">
            Operação operacional para popular <code className="px-1">bens.local_id</code> a partir do texto do GEAFIN
            (<code className="px-1">local_fisico</code>). Isso é o que faz o inventário por sala funcionar.
          </p>
          <form onSubmit={onMapBensLocal} className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-300">Local (destino)</span>
              <select
                value={mapLocalForm.localId}
                onChange={(e) => setMapLocalField("localId", e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                disabled={!canAdmin && auth.authEnabled}
              >
                <option value="">Selecione um local</option>
                {(locaisState.data?.items || []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nome} (id {String(l.id).slice(0, 8)}...)
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-300">termoLocalFisico (texto do GEAFIN)</span>
              <input
                value={mapLocalForm.termoLocalFisico}
                onChange={(e) => setMapLocalField("termoLocalFisico", e.target.value)}
                placeholder='Ex.: "Sala 101" ou "Hall 6"'
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                disabled={!canAdmin && auth.authEnabled}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Unidade dona (opcional)</span>
              <select
                value={mapLocalForm.unidadeDonaId}
                onChange={(e) => setMapLocalField("unidadeDonaId", e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
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
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(mapLocalForm.somenteSemLocalId)}
                  onChange={(e) => setMapLocalField("somenteSemLocalId", e.target.checked)}
                  className="h-4 w-4 accent-cyan-300"
                />
                Somente sem localId
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(mapLocalForm.dryRun)}
                  onChange={(e) => setMapLocalField("dryRun", e.target.checked)}
                  className="h-4 w-4 accent-cyan-300"
                />
                Dry-run (não aplica)
              </label>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={mapLocalState.loading || (!canAdmin && auth.authEnabled)}
                className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                {mapLocalState.loading ? "Executando..." : mapLocalForm.dryRun ? "Simular" : "Aplicar vinculação"}
              </button>
              {mapLocalState.error ? <p className="mt-2 text-sm text-rose-300">{mapLocalState.error}</p> : null}
              {mapLocalState.response ? (
                <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10 bg-slate-900 p-3 text-xs">
                  {JSON.stringify(mapLocalState.response, null, 2)}
                </pre>
              ) : null}
            </div>
          </form>
        </div>
      </article>

      <article className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
        <h3 className="font-semibold">Importação GEAFIN (CSV Latin1)</h3>
        {!canAdmin && auth.authEnabled && (
          <p className="mt-2 text-xs text-rose-200">
            Operação restrita ao perfil <strong>ADMIN</strong>.
          </p>
        )}
        <form onSubmit={onImport} className="mt-3 grid gap-3 md:grid-cols-[1.2fr_auto_auto]">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
            disabled={!canAdmin && auth.authEnabled}
            className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="1"
            max="4"
            value={unidadePadraoId}
            onChange={(event) => setUnidadePadraoId(event.target.value)}
            placeholder="Unidade (1-4)"
            disabled={!canAdmin && auth.authEnabled}
            className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={importState.loading || (!canAdmin && auth.authEnabled)}
            className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            {importState.loading ? "Importando..." : "Importar"}
          </button>
        </form>
        <ImportProgressBar progressState={importProgress} onCancel={onCancelImport} />
        {importState.error && <p className="mt-2 text-sm text-rose-300">{importState.error}</p>}
        {importState.response && (
          <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10 bg-slate-900 p-3 text-xs">
            {JSON.stringify(importState.response, null, 2)}
          </pre>
        )}
      </article>

      <article className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Perfis (usuários)</h3>
            <p className="mt-1 text-xs text-slate-300">
              Admin cadastra perfis aqui. O usuário define a própria senha em <strong>Primeiro acesso</strong> na tela de login.
            </p>
          </div>
          <button
            type="button"
            onClick={loadPerfis}
            className="rounded-lg border border-white/25 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
            disabled={!canAdmin || perfisState.loading}
            title={!canAdmin ? "Somente ADMIN." : "Recarregar lista de perfis."}
          >
            {perfisState.loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
        {!canAdmin && auth.authEnabled && (
          <p className="mt-2 text-xs text-rose-200">
            Operação restrita ao perfil <strong>ADMIN</strong>.
          </p>
        )}

        {perfisState.error ? <p className="mt-3 text-sm text-rose-300">{perfisState.error}</p> : null}

        <form onSubmit={onCreatePerfil} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Matricula</span>
            <input
              value={perfilForm.matricula}
              onChange={(event) => setPerfilField("matricula", event.target.value)}
              placeholder="Ex.: 123456"
              disabled={!canAdmin && auth.authEnabled}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Nome</span>
            <input
              value={perfilForm.nome}
              onChange={(event) => setPerfilField("nome", event.target.value)}
              placeholder="Ex.: Fulano de Tal"
              disabled={!canAdmin && auth.authEnabled}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Unidade (1-4)</span>
            <input
              type="number"
              min="1"
              max="4"
              value={perfilForm.unidadeId}
              onChange={(event) => setPerfilField("unidadeId", event.target.value)}
              disabled={!canAdmin && auth.authEnabled}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Email (opcional)</span>
            <input
              value={perfilForm.email}
              onChange={(event) => setPerfilField("email", event.target.value)}
              disabled={!canAdmin && auth.authEnabled}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-300">Cargo (opcional)</span>
            <input
              value={perfilForm.cargo}
              onChange={(event) => setPerfilField("cargo", event.target.value)}
              disabled={!canAdmin && auth.authEnabled}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={perfilState.loading || (!canAdmin && auth.authEnabled)}
              className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
            >
              {perfilState.loading ? "Criando..." : "Criar perfil"}
            </button>
          </div>
        </form>
        {perfilState.error && <p className="mt-2 text-sm text-rose-300">{perfilState.error}</p>}
        {perfilState.response && (
          <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10 bg-slate-900 p-3 text-xs">
            {JSON.stringify(perfilState.response, null, 2)}
          </pre>
        )}

        {perfilEditId ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Editar perfil</p>
                <p className="mt-1 text-[11px] text-slate-400">perfilId: <span className="font-mono">{perfilEditId}</span></p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={cancelEditPerfil}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                  disabled={perfilEditState.loading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={savePerfilEdit}
                  className="rounded-md bg-cyan-300 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-cyan-200 disabled:opacity-50"
                  disabled={perfilEditState.loading}
                >
                  {perfilEditState.loading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>

            {perfilEditState.error ? <p className="mt-2 text-sm text-rose-300">{perfilEditState.error}</p> : null}

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Nome</span>
                <input
                  value={perfilEditForm.nome}
                  onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, nome: e.target.value }))}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  disabled={perfilEditState.loading}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Email</span>
                <input
                  value={perfilEditForm.email}
                  onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  disabled={perfilEditState.loading}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Unidade (1-4)</span>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={perfilEditForm.unidadeId}
                  onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, unidadeId: e.target.value }))}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  disabled={perfilEditState.loading}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Cargo</span>
                <input
                  value={perfilEditForm.cargo}
                  onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, cargo: e.target.value }))}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  disabled={perfilEditState.loading}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-300">Role</span>
                <select
                  value={perfilEditForm.role}
                  onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                  disabled={perfilEditState.loading}
                >
                  <option value="OPERADOR">OPERADOR</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/30 px-3 py-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={Boolean(perfilEditForm.ativo)}
                  onChange={(e) => setPerfilEditForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                  className="h-4 w-4 accent-cyan-300"
                  disabled={perfilEditState.loading}
                />
                Ativo
              </label>
            </div>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/40 p-4">
          <h4 className="text-sm font-semibold text-slate-100">Lista de perfis</h4>
          <p className="mt-1 text-[11px] text-slate-400">Ações: editar, ativar/desativar, resetar senha.</p>

          {perfilEditState.error ? <p className="mt-2 text-sm text-rose-300">{perfilEditState.error}</p> : null}

          <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-white/10">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-300">
                <tr>
                  <th className="px-3 py-2">Matrícula</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Unid.</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Ativo</th>
                  <th className="px-3 py-2">Senha</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {(perfisState.data?.items || []).map((p) => (
                  <tr key={p.id} className="hover:bg-white/5">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-200">{p.matricula}</td>
                    <td className="px-3 py-2 text-slate-100">{p.nome}</td>
                    <td className="px-3 py-2 text-slate-300">{p.unidadeId}</td>
                    <td className="px-3 py-2 text-slate-300">{p.role}</td>
                    <td className="px-3 py-2 text-slate-300">{p.ativo ? "SIM" : "NÃO"}</td>
                    <td className="px-3 py-2 text-slate-300">{p.senhaDefinidaEm ? "DEFINIDA" : "NÃO"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => beginEditPerfil(p)}
                          className="rounded-md border border-white/20 px-3 py-1.5 text-[11px] font-semibold hover:bg-white/10"
                          disabled={!canAdmin || perfilEditState.loading}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePerfilAtivo(p)}
                          className="rounded-md border border-white/20 px-3 py-1.5 text-[11px] font-semibold hover:bg-white/10"
                          disabled={!canAdmin || perfilEditState.loading}
                          title="Ativa/desativa o perfil (soft-disable)."
                        >
                          {p.ativo ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onResetSenhaPerfil(p)}
                          className="rounded-md border border-amber-300/30 bg-amber-200/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-200/20"
                          disabled={!canAdmin || perfilEditState.loading}
                          title="Remove hash de senha para permitir 'Primeiro acesso' novamente."
                        >
                          Resetar senha
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(perfisState.data?.items || []).length === 0 && !perfisState.loading ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-300" colSpan={7}>
                      Nenhum perfil cadastrado ainda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </section>
  );
}

function ImportProgressBar({ progressState, onCancel }) {
  const imp = progressState?.data?.importacao || null;
  const isActive = Boolean(progressState?.loading);

  if (!isActive && !imp && !progressState?.error) return null;

  const total = imp?.totalLinhas ? Number(imp.totalLinhas) : null;
  const done = imp?.linhasInseridas != null ? Number(imp.linhasInseridas) : null;
  const percent = imp?.percent != null ? Number(imp.percent) : null;

  const indeterminate = Boolean(
    isActive &&
      imp &&
      imp.status === "EM_ANDAMENTO" &&
      (done == null || done <= 0) &&
      (percent == null || percent <= 0),
  );

  const label = indeterminate
    ? "Preparando importacao..."
    : percent != null && Number.isFinite(percent)
      ? `${percent}%`
      : total && done != null
        ? `${done}/${total}`
        : done != null
          ? `${done} linhas`
          : "Aguardando progresso...";

  const startedEm = imp?.importedEm && typeof imp.importedEm === "string" ? imp.importedEm : null;
  const lastUpdateEm =
    imp?.ultimaAtualizacaoEm && typeof imp.ultimaAtualizacaoEm === "string"
      ? imp.ultimaAtualizacaoEm
      : startedEm;
  const finishedEm = imp?.finalizadoEm && typeof imp.finalizadoEm === "string" ? imp.finalizadoEm : null;

  const elapsedTotal =
    startedEm ? Math.max(0, Math.floor((Date.now() - Date.parse(startedEm)) / 1000)) : null;
  const idle =
    lastUpdateEm ? Math.max(0, Math.floor((Date.now() - Date.parse(lastUpdateEm)) / 1000)) : null;

  const fmt = (s) => {
    try {
      return new Date(s).toLocaleString("pt-BR");
    } catch {
      return String(s || "");
    }
  };

  const showCancel = Boolean(typeof onCancel === "function" && imp?.status === "EM_ANDAMENTO");

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-slate-400">
            Progresso da importação (GEAFIN)
          </p>
          <p className="mt-1 text-sm text-slate-200">
            {imp?.originalFilename ? (
              <span className="font-medium">{imp.originalFilename}</span>
            ) : (
              <span className="font-medium">Arquivo</span>
            )}
            {imp?.status ? <span className="text-slate-400"> {" "}({imp.status})</span> : null}
          </p>
          {startedEm ? (
            <p className="mt-1 text-[11px] text-slate-500">início: {fmt(startedEm)}</p>
          ) : null}
          {lastUpdateEm ? (
            <p className="mt-1 text-[11px] text-slate-500">última atualização: {fmt(lastUpdateEm)}</p>
          ) : null}
          {finishedEm ? (
            <p className="mt-1 text-[11px] text-slate-500">finalizada em: {fmt(finishedEm)}</p>
          ) : null}
          {elapsedTotal != null ? (
            <p className="mt-1 text-[11px] text-slate-500">tempo decorrido: {elapsedTotal}s</p>
          ) : null}
          {idle != null && imp?.status === "EM_ANDAMENTO" ? (
            <p className={`mt-1 text-[11px] ${idle > 60 ? "text-amber-200" : "text-slate-500"}`}>
              sem atualização: {idle}s
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-cyan-200">{label}</p>
          {imp ? (
            <p className="text-[11px] text-slate-400">
              ok={imp.persistenciaOk} falha_persist={imp.falhaPersistencia} falha_norm={imp.falhaNormalizacao}
            </p>
          ) : null}
          {showCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="mt-2 rounded-md border border-rose-300/30 bg-rose-200/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-200/20"
              title="Cancelar importação (marca como ERRO para destravar a UI)."
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={[
            "h-full rounded-full bg-cyan-300 transition-[width] duration-300",
            indeterminate || percent == null ? "w-2/3 animate-pulse" : "",
          ].join(" ").trim()}
          style={!indeterminate && percent != null ? { width: `${Math.max(0, Math.min(100, percent))}%` } : undefined}
        />
      </div>

      {progressState?.error ? (
        <p className="mt-2 text-xs text-rose-300">{progressState.error}</p>
      ) : null}
      {imp?.erroResumo ? (
        <p className="mt-2 text-xs text-rose-200">erro: {imp.erroResumo}</p>
      ) : null}
      {imp?.id ? (
        <p className="mt-1 text-[11px] text-slate-500">
          arquivoId={imp.id}
        </p>
      ) : null}
    </div>
  );
}
