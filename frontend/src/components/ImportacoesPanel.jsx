/**
 * Modulo: frontend/components
 * Arquivo: ImportacoesPanel.jsx
 * Funcao no sistema: executar importacao GEAFIN por sessao (previa -> revisao -> aplicacao).
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  aplicarImportacaoGeafinSessao,
  cancelarImportacaoGeafinSessao,
  criarSessaoImportacaoGeafin,
  decidirAcaoImportacaoGeafin,
  decidirAcoesLoteImportacaoGeafin,
  getImportacaoGeafinSessao,
  getUltimaImportacaoGeafin,
  listarAcoesImportacaoGeafin,
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

function fmtDate(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("pt-BR");
  } catch {
    return String(v);
  }
}

export default function ImportacoesPanel({ canAdmin }) {
  const auth = useAuth();
  const [csvFile, setCsvFile] = useState(null);
  const [modoImportacao, setModoImportacao] = useState("INCREMENTAL");
  const [escopoTipo, setEscopoTipo] = useState("GERAL");
  const [unidadeEscopoId, setUnidadeEscopoId] = useState("");
  const [unidadePadraoId, setUnidadePadraoId] = useState("");

  const [sessionId, setSessionId] = useState("");
  const [sessionState, setSessionState] = useState({ loading: false, data: null, error: null });
  const [createState, setCreateState] = useState({ loading: false, ok: null, error: null });
  const [applyState, setApplyState] = useState({ loading: false, ok: null, error: null });
  const [cancelState, setCancelState] = useState({ loading: false, error: null });

  const [actionsState, setActionsState] = useState({ loading: false, data: null, error: null });
  const [filters, setFilters] = useState({ q: "", tipoAcao: "", decisao: "" });
  const [paging, setPaging] = useState({ limit: 50, offset: 0, total: 0 });

  const [bulkForm, setBulkForm] = useState({
    decisao: "APROVADA",
    tipoAcao: "",
    q: "",
    somentePendentes: true,
  });

  const [applyForm, setApplyForm] = useState({
    adminPassword: "",
    confirmText: "",
    acaoAusentes: "",
  });

  const hasSession = Boolean(sessionId);
  const session = sessionState.data?.importacao || null;
  const sessionMode = String(session?.modoImportacao || modoImportacao || "INCREMENTAL").toUpperCase();
  const isApplying = String(session?.status || "").toUpperCase() === "APLICANDO";
  const canDecide =
    hasSession &&
    String(session?.status || "").toUpperCase() === "AGUARDANDO_CONFIRMACAO" &&
    sessionMode === "INCREMENTAL";

  const loadSession = async (id) => {
    if (!id) return;
    setSessionState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getImportacaoGeafinSessao(id);
      setSessionState({ loading: false, data, error: null });
    } catch (error) {
      setSessionState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  const loadActions = async (id, nextPaging = paging, nextFilters = filters) => {
    if (!id) return;
    setActionsState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await listarAcoesImportacaoGeafin(id, {
        limit: nextPaging.limit,
        offset: nextPaging.offset,
        q: nextFilters.q || undefined,
        tipoAcao: nextFilters.tipoAcao || undefined,
        decisao: nextFilters.decisao || undefined,
      });
      setActionsState({ loading: false, data, error: null });
      setPaging({
        limit: Number(data?.paging?.limit || nextPaging.limit || 50),
        offset: Number(data?.paging?.offset || nextPaging.offset || 0),
        total: Number(data?.paging?.total || 0),
      });
    } catch (error) {
      setActionsState({ loading: false, data: null, error: formatApiError(error) });
    }
  };

  useEffect(() => {
    if (!canAdmin) return;
    let alive = true;
    (async () => {
      try {
        const data = await getUltimaImportacaoGeafin();
        const id = data?.importacao?.id ? String(data.importacao.id) : "";
        if (!alive || !id) return;
        setSessionId(id);
      } catch (_error) {
        // Sem sessao anterior.
      }
    })();
    return () => {
      alive = false;
    };
  }, [canAdmin]);

  useEffect(() => {
    if (!sessionId || !canAdmin) return;
    void loadSession(sessionId);
    void loadActions(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, canAdmin]);

  useEffect(() => {
    if (!sessionId || !isApplying) return undefined;
    const timer = window.setInterval(() => {
      void loadSession(sessionId);
      void loadActions(sessionId);
    }, 1500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isApplying]);

  const pendingText = useMemo(() => {
    const m = session?.metricas || {};
    if (!m.totalConfirmacao) return "Sem pendencias de confirmacao.";
    return `Pendentes: ${Number(m.pendentes || 0)} / ${Number(m.totalConfirmacao || 0)}`;
  }, [session]);

  const onCreateSession = async (event) => {
    event.preventDefault();
    if (!canAdmin) {
      setCreateState({ loading: false, ok: null, error: "Operacao restrita ao perfil ADMIN." });
      return;
    }
    if (!csvFile) {
      setCreateState({ loading: false, ok: null, error: "Selecione o arquivo CSV GEAFIN." });
      return;
    }
    if (escopoTipo === "UNIDADE" && !unidadeEscopoId) {
      setCreateState({ loading: false, ok: null, error: "Selecione a unidade para escopo UNIDADE." });
      return;
    }

    setCreateState({ loading: true, ok: null, error: null });
    try {
      const data = await criarSessaoImportacaoGeafin(csvFile, {
        modoImportacao,
        escopoTipo,
        unidadeEscopoId: escopoTipo === "UNIDADE" ? Number(unidadeEscopoId) : null,
        unidadePadraoId: unidadePadraoId ? Number(unidadePadraoId) : null,
      });
      const id = data?.importacao?.id ? String(data.importacao.id) : "";
      setCreateState({ loading: false, ok: "Sessao GEAFIN criada com sucesso.", error: null });
      if (id) {
        setSessionId(id);
        await loadSession(id);
        await loadActions(id, { ...paging, offset: 0 }, filters);
      }
    } catch (error) {
      setCreateState({ loading: false, ok: null, error: formatApiError(error) });
    }
  };

  const onDecidirItem = async (acaoId, decisao) => {
    if (!canDecide) return;
    try {
      await decidirAcaoImportacaoGeafin(sessionId, acaoId, decisao);
      await loadSession(sessionId);
      await loadActions(sessionId);
    } catch (error) {
      setActionsState((prev) => ({ ...prev, error: formatApiError(error) }));
    }
  };

  const onDecidirLote = async (event) => {
    event.preventDefault();
    if (!canDecide) return;
    try {
      await decidirAcoesLoteImportacaoGeafin(sessionId, {
        decisao: bulkForm.decisao,
        tipoAcao: bulkForm.tipoAcao || undefined,
        q: bulkForm.q || undefined,
        somentePendentes: Boolean(bulkForm.somentePendentes),
      });
      await loadSession(sessionId);
      await loadActions(sessionId);
    } catch (error) {
      setActionsState((prev) => ({ ...prev, error: formatApiError(error) }));
    }
  };

  const onApplySession = async (event) => {
    event.preventDefault();
    if (!hasSession) return;
    if (!applyForm.adminPassword) {
      setApplyState({ loading: false, ok: null, error: "Informe a senha ADMIN para aplicar." });
      return;
    }
    if (sessionMode === "TOTAL") {
      if (String(applyForm.confirmText || "").trim().toUpperCase() !== "IMPORTACAO_TOTAL") {
        setApplyState({ loading: false, ok: null, error: "Digite IMPORTACAO_TOTAL para confirmar o modo TOTAL." });
        return;
      }
      if (!applyForm.acaoAusentes) {
        setApplyState({ loading: false, ok: null, error: "Escolha a acao para bens ausentes no escopo (Manter ou Baixar)." });
        return;
      }
    }

    setApplyState({ loading: true, ok: null, error: null });
    try {
      const data = await aplicarImportacaoGeafinSessao(sessionId, {
        adminPassword: applyForm.adminPassword,
        confirmText: sessionMode === "TOTAL" ? applyForm.confirmText : undefined,
        acaoAusentes: sessionMode === "TOTAL" ? applyForm.acaoAusentes : undefined,
      });
      setApplyState({ loading: false, ok: data?.message || "Sessao aplicada.", error: null });
      await loadSession(sessionId);
      await loadActions(sessionId);
    } catch (error) {
      setApplyState({ loading: false, ok: null, error: formatApiError(error) });
      await loadSession(sessionId);
      await loadActions(sessionId);
    }
  };

  const onCancelSession = async () => {
    if (!hasSession) return;
    setCancelState({ loading: true, error: null });
    try {
      await cancelarImportacaoGeafinSessao(sessionId, "Cancelada via UI (ADMIN).");
      setCancelState({ loading: false, error: null });
      await loadSession(sessionId);
      await loadActions(sessionId);
    } catch (error) {
      setCancelState({ loading: false, error: formatApiError(error) });
    }
  };

  const onApplyFilters = async (event) => {
    event.preventDefault();
    const nextPaging = { ...paging, offset: 0 };
    setPaging(nextPaging);
    await loadActions(sessionId, nextPaging, filters);
  };

  const nextPage = async (delta) => {
    const nextOffset = Math.max(0, Number(paging.offset || 0) + delta);
    if (nextOffset >= Number(paging.total || 0) && delta > 0) return;
    const nextPaging = { ...paging, offset: nextOffset };
    setPaging(nextPaging);
    await loadActions(sessionId, nextPaging, filters);
  };

  return (
    <section className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Importacao GEAFIN (CSV Latin1)</h2>
        <p className="mt-2 text-sm text-slate-600">
          Fluxo por sessao: previa, revisao e aplicacao com backup automatico.
        </p>
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Seguranca: este fluxo <strong>nao realiza exclusao fisica</strong> de bens/catalogos.
        </p>
      </header>

      {!canAdmin && auth.authEnabled ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Operacao restrita ao perfil <strong>ADMIN</strong>.
        </p>
      ) : null}

      <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-900">1) Criar sessao (previa)</h3>
        <form onSubmit={onCreateSession} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Arquivo CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
              disabled={!canAdmin && auth.authEnabled}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Modo de importacao</span>
            <select
              value={modoImportacao}
              onChange={(e) => setModoImportacao(String(e.target.value || "INCREMENTAL").toUpperCase())}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="INCREMENTAL">INCREMENTAL (padrao)</option>
              <option value="TOTAL">TOTAL</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Escopo</span>
            <select
              value={escopoTipo}
              onChange={(e) => setEscopoTipo(String(e.target.value || "GERAL").toUpperCase())}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="GERAL">GERAL</option>
              <option value="UNIDADE">UNIDADE</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Unidade do escopo (1-4)</span>
            <input
              type="number"
              min="1"
              max="4"
              value={unidadeEscopoId}
              onChange={(e) => setUnidadeEscopoId(e.target.value)}
              disabled={escopoTipo !== "UNIDADE"}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder="Ex.: 2"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">Unidade padrao fallback (opcional)</span>
            <input
              type="number"
              min="1"
              max="4"
              value={unidadePadraoId}
              onChange={(e) => setUnidadePadraoId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Ex.: 2"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={createState.loading || (!canAdmin && auth.authEnabled)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {createState.loading ? "Gerando previa..." : "Criar sessao"}
            </button>
          </div>
        </form>
        {createState.error ? <p className="mt-2 text-sm text-rose-700">{createState.error}</p> : null}
        {createState.ok ? <p className="mt-2 text-sm text-emerald-700">{createState.ok}</p> : null}
      </article>

      <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-900">2) Revisao da sessao</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void (sessionId ? loadSession(sessionId) : undefined)}
              disabled={!sessionId || sessionState.loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
            >
              Atualizar sessao
            </button>
            <button
              type="button"
              onClick={onCancelSession}
              disabled={!sessionId || cancelState.loading}
              className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {cancelState.loading ? "Cancelando..." : "Cancelar sessao"}
            </button>
          </div>
        </div>

        {!sessionId ? <p className="mt-2 text-sm text-slate-600">Nenhuma sessao selecionada.</p> : null}
        {sessionState.error ? <p className="mt-2 text-sm text-rose-700">{sessionState.error}</p> : null}
        {cancelState.error ? <p className="mt-2 text-sm text-rose-700">{cancelState.error}</p> : null}

        {session ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Sessao</p>
              <p className="mt-1 text-xs font-mono text-slate-700 break-all">{session.id}</p>
              <p className="mt-1 text-xs text-slate-600">Status: <strong>{session.status}</strong></p>
              <p className="mt-1 text-xs text-slate-600">Modo: <strong>{session.modoImportacao}</strong></p>
              <p className="mt-1 text-xs text-slate-600">Escopo: <strong>{session.escopoTipo}</strong>{session.unidadeEscopoId ? ` (${session.unidadeEscopoId})` : ""}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Metricas</p>
              <p className="mt-1 text-xs text-slate-700">Acoes: <strong>{Number(session.metricas?.totalAcoes || 0)}</strong></p>
              <p className="mt-1 text-xs text-slate-700">Aplicaveis: <strong>{Number(session.metricas?.totalAplicaveis || 0)}</strong></p>
              <p className="mt-1 text-xs text-slate-700">{pendingText}</p>
              <p className="mt-1 text-xs text-slate-700">Aplicadas: <strong>{Number(session.metricas?.aplicadas || 0)}</strong></p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Tempo</p>
              <p className="mt-1 text-xs text-slate-700">Inicio: <strong>{fmtDate(session.importedEm)}</strong></p>
              <p className="mt-1 text-xs text-slate-700">Ultima atualizacao: <strong>{fmtDate(session.ultimaAtualizacaoEm)}</strong></p>
              <p className="mt-1 text-xs text-slate-700">Fim: <strong>{fmtDate(session.finalizadoEm)}</strong></p>
            </div>
          </div>
        ) : null}

        {session?.resumoPreview ? (
          <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs">
            {JSON.stringify(session.resumoPreview, null, 2)}
          </pre>
        ) : null}

        <form onSubmit={onApplyFilters} className="mt-4 grid gap-2 md:grid-cols-4">
          <input
            value={filters.q}
            onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Buscar tombamento/codigo/motivo"
          />
          <select
            value={filters.tipoAcao}
            onChange={(e) => setFilters((p) => ({ ...p, tipoAcao: e.target.value }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tipo de acao (todas)</option>
            <option value="CRIAR_BEM">CRIAR_BEM</option>
            <option value="ATUALIZAR_BEM">ATUALIZAR_BEM</option>
            <option value="SEM_MUDANCA">SEM_MUDANCA</option>
            <option value="ERRO_VALIDACAO">ERRO_VALIDACAO</option>
          </select>
          <select
            value={filters.decisao}
            onChange={(e) => setFilters((p) => ({ ...p, decisao: e.target.value }))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Decisao (todas)</option>
            <option value="PENDENTE">PENDENTE</option>
            <option value="APROVADA">APROVADA</option>
            <option value="REJEITADA">REJEITADA</option>
            <option value="AUTO">AUTO</option>
          </select>
          <button
            type="submit"
            disabled={!sessionId || actionsState.loading}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
          >
            Aplicar filtros
          </button>
        </form>

        {canDecide ? (
          <form onSubmit={onDecidirLote} className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-5">
            <select
              value={bulkForm.decisao}
              onChange={(e) => setBulkForm((p) => ({ ...p, decisao: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="APROVADA">Aprovar em lote</option>
              <option value="REJEITADA">Rejeitar em lote</option>
            </select>
            <select
              value={bulkForm.tipoAcao}
              onChange={(e) => setBulkForm((p) => ({ ...p, tipoAcao: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Tipo (todos)</option>
              <option value="CRIAR_BEM">CRIAR_BEM</option>
              <option value="ATUALIZAR_BEM">ATUALIZAR_BEM</option>
            </select>
            <input
              value={bulkForm.q}
              onChange={(e) => setBulkForm((p) => ({ ...p, q: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Filtro texto opcional"
            />
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(bulkForm.somentePendentes)}
                onChange={(e) => setBulkForm((p) => ({ ...p, somentePendentes: e.target.checked }))}
                className="h-4 w-4 accent-violet-600"
              />
              Somente pendentes
            </label>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100"
            >
              Executar lote
            </button>
          </form>
        ) : null}

        {actionsState.error ? <p className="mt-2 text-sm text-rose-700">{actionsState.error}</p> : null}
        <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Tombo</th>
                <th className="px-3 py-2">Catalogo</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Decisao</th>
                <th className="px-3 py-2">Aplicada</th>
                <th className="px-3 py-2">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(actionsState.data?.items || []).map((it) => (
                <tr key={it.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">{it.ordem}</td>
                  <td className="px-3 py-2 font-semibold text-slate-800">{it.tipoAcao}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{it.numeroTombamento || "-"}</td>
                  <td className="px-3 py-2">{it.codigoCatalogo || "-"}</td>
                  <td className="px-3 py-2 max-w-[360px] truncate" title={it.motivo || ""}>{it.motivo || "-"}</td>
                  <td className="px-3 py-2">{it.decisao || "-"}</td>
                  <td className="px-3 py-2">{it.aplicada ? "SIM" : "NAO"}</td>
                  <td className="px-3 py-2">
                    {canDecide && it.requerConfirmacao ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void onDecidirItem(it.id, "APROVADA")}
                          className="rounded border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDecidirItem(it.id, "REJEITADA")}
                          className="rounded border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Rejeitar
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {(actionsState.data?.items || []).length === 0 && !actionsState.loading ? (
                <tr>
                  <td className="px-3 py-3 text-slate-600" colSpan={8}>
                    Nenhuma acao encontrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-slate-600">
            {paging.total ? `${paging.offset + 1}-${Math.min(paging.offset + paging.limit, paging.total)}` : "0"} de {paging.total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void nextPage(-paging.limit)}
              disabled={paging.offset <= 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => void nextPage(paging.limit)}
              disabled={paging.offset + paging.limit >= paging.total}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              Proxima
            </button>
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-900">3) Aplicar sessao</h3>
        <form onSubmit={onApplySession} className="mt-3 grid gap-3">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Senha ADMIN (obrigatoria)</span>
            <input
              type="password"
              value={applyForm.adminPassword}
              onChange={(e) => setApplyForm((p) => ({ ...p, adminPassword: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Digite sua senha"
            />
          </label>

          {sessionMode === "TOTAL" ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">
                Modo TOTAL: confirme a acao para bens ausentes no escopo.
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="acao-ausentes"
                    value="MANTER"
                    checked={applyForm.acaoAusentes === "MANTER"}
                    onChange={(e) => setApplyForm((p) => ({ ...p, acaoAusentes: e.target.value }))}
                    className="h-4 w-4 accent-violet-600"
                  />
                  Manter ausentes
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="acao-ausentes"
                    value="BAIXAR"
                    checked={applyForm.acaoAusentes === "BAIXAR"}
                    onChange={(e) => setApplyForm((p) => ({ ...p, acaoAusentes: e.target.value }))}
                    className="h-4 w-4 accent-violet-600"
                  />
                  Baixar ausentes
                </label>
              </div>
              <label className="mt-3 block space-y-1">
                <span className="text-xs text-slate-700">Digite IMPORTACAO_TOTAL para confirmar</span>
                <input
                  value={applyForm.confirmText}
                  onChange={(e) => setApplyForm((p) => ({ ...p, confirmText: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="IMPORTACAO_TOTAL"
                />
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!sessionId || applyState.loading}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {applyState.loading ? "Aplicando..." : "Aplicar sessao"}
            </button>
            <button
              type="button"
              onClick={onCancelSession}
              disabled={!sessionId || cancelState.loading}
              className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {cancelState.loading ? "Cancelando..." : "Cancelar"}
            </button>
          </div>
        </form>
        {applyState.error ? <p className="mt-2 text-sm text-rose-700">{applyState.error}</p> : null}
        {applyState.ok ? <p className="mt-2 text-sm text-emerald-700">{applyState.ok}</p> : null}
      </article>
    </section>
  );
}

