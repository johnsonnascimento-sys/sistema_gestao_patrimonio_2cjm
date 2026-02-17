/**
 * Modulo: frontend/components
 * Arquivo: OperationsPanel.jsx
 * Funcao no sistema: painel operacional para consumir endpoints backend de importacao e movimentacao.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  API_BASE_URL,
  criarPerfil,
  getHealth,
  getUltimaImportacaoGeafin,
  importarGeafin,
  movimentarBem,
} from "../services/apiClient.js";

const MOV_TYPES = ["TRANSFERENCIA", "CAUTELA_SAIDA", "CAUTELA_RETORNO"];

export default function OperationsPanel() {
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
  const [movState, setMovState] = useState({
    loading: false,
    response: null,
    error: null,
  });

  const [csvFile, setCsvFile] = useState(null);
  const [unidadePadraoId, setUnidadePadraoId] = useState("");
  const [perfilForm, setPerfilForm] = useState({
    matricula: "",
    nome: "",
    email: "",
    unidadeId: "",
    cargo: "",
  });
  const [movPayload, setMovPayload] = useState({
    tipoMovimentacao: "TRANSFERENCIA",
    numeroTombamento: "",
    bemId: "",
    unidadeDestinoId: "",
    detentorTemporarioPerfilId: "",
    dataPrevistaDevolucao: "",
    dataEfetivaDevolucao: "",
    termoReferencia: "",
    justificativa: "",
    autorizadaPorPerfilId: "",
    executadaPorPerfilId: "",
  });

  const helperText = useMemo(() => {
    if (movPayload.tipoMovimentacao === "TRANSFERENCIA") {
      return "Transferência muda carga; exige unidadeDestinoId e autorizadaPorPerfilId (Arts. 124 e 127).";
    }
    if (movPayload.tipoMovimentacao === "CAUTELA_SAIDA") {
      return "Cautela não muda carga; exige detentorTemporarioPerfilId e dataPrevistaDevolucao.";
    }
    return "Retorno de cautela exige bem atualmente EM_CAUTELA.";
  }, [movPayload.tipoMovimentacao]);

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
      setImportProgress((prev) => ({ ...prev, loading: true, error: error.message }));
    }
    importPollTimerRef.current = window.setInterval(async () => {
      try {
        await pollImportProgressOnce();
      } catch (error) {
        setImportProgress((prev) => ({ ...prev, loading: true, error: prev.data ? null : error.message }));
      }
    }, 1000);
  };

  useEffect(() => {
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
  }, []);

  const onHealth = async () => {
    setHealthState({ loading: true, data: null, error: null });
    try {
      const data = await getHealth();
      setHealthState({ loading: false, data, error: null });
    } catch (error) {
      setHealthState({
        loading: false,
        data: null,
        error: error.message,
      });
    }
  };

  const onImport = async (event) => {
    event.preventDefault();
    if (!csvFile) {
      setImportState({
        loading: false,
        response: null,
        error: "Selecione um arquivo CSV GEAFIN.",
      });
      return;
    }
    setImportState({ loading: true, response: null, error: null });
    setImportProgress({ loading: true, data: null, error: null });
    await startImportPolling();
    try {
      const data = await importarGeafin(
        csvFile,
        unidadePadraoId ? Number(unidadePadraoId) : null,
      );
      setImportState({ loading: false, response: data, error: null });
    } catch (error) {
      setImportState({
        loading: false,
        response: null,
        error: error.message,
      });
    } finally {
      stopImportPolling();
      // Faz uma ultima consulta para exibir status final.
      try {
        const { data, running } = await pollImportProgressOnce();
        if (!running) setImportProgress({ loading: false, data, error: null });
      } catch (error) {
        setImportProgress((prev) => ({ ...prev, loading: false, error: error.message }));
      }
    }
  };

  const onCreatePerfil = async (event) => {
    event.preventDefault();
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

      const perfilId = data?.perfil?.id;
      if (perfilId) {
        // Facilita testes: usa o perfil criado para autorizar/executar movimentacoes.
        setMovPayload((prev) => ({
          ...prev,
          autorizadaPorPerfilId: perfilId,
          executadaPorPerfilId: perfilId,
        }));
      }
    } catch (error) {
      setPerfilState({ loading: false, response: null, error: error.message });
    }
  };

  const onMov = async (event) => {
    event.preventDefault();
    const payload = buildMovPayload(movPayload);
    setMovState({ loading: true, response: null, error: null });
    try {
      const data = await movimentarBem(payload);
      setMovState({ loading: false, response: data, error: null });
    } catch (error) {
      setMovState({ loading: false, response: null, error: error.message });
    }
  };

  const setMovField = (key, value) =>
    setMovPayload((prev) => ({
      ...prev,
      [key]: value,
    }));

  const setPerfilField = (key, value) =>
    setPerfilForm((prev) => ({
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
        <h3 className="font-semibold">Importação GEAFIN (CSV Latin1)</h3>
        <form onSubmit={onImport} className="mt-3 grid gap-3 md:grid-cols-[1.2fr_auto_auto]">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
            className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="1"
            max="4"
            value={unidadePadraoId}
            onChange={(event) => setUnidadePadraoId(event.target.value)}
            placeholder="Unidade (1-4)"
            className="rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={importState.loading}
            className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            {importState.loading ? "Importando..." : "Importar"}
          </button>
        </form>
        <ImportProgressBar progressState={importProgress} />
        {importState.error && <p className="mt-2 text-sm text-rose-300">{importState.error}</p>}
        {importState.response && (
          <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10 bg-slate-900 p-3 text-xs">
            {JSON.stringify(importState.response, null, 2)}
          </pre>
        )}
      </article>

      <article className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
        <h3 className="font-semibold">Criar perfil (para testes locais)</h3>
        <p className="mt-1 text-xs text-slate-300">
          Movimentações exigem perfis reais (autorizador/executor). Crie um aqui e o sistema preenche automaticamente no formulário abaixo.
        </p>
        <form onSubmit={onCreatePerfil} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Matricula</span>
            <input
              value={perfilForm.matricula}
              onChange={(event) => setPerfilField("matricula", event.target.value)}
              placeholder="Ex.: 123456"
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Nome</span>
            <input
              value={perfilForm.nome}
              onChange={(event) => setPerfilField("nome", event.target.value)}
              placeholder="Ex.: Fulano de Tal"
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
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Email (opcional)</span>
            <input
              value={perfilForm.email}
              onChange={(event) => setPerfilField("email", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-300">Cargo (opcional)</span>
            <input
              value={perfilForm.cargo}
              onChange={(event) => setPerfilField("cargo", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={perfilState.loading}
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
        {perfilState.response?.perfil?.id && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMovField("detentorTemporarioPerfilId", perfilState.response.perfil.id)}
              className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
            >
              Usar como detentor temporario
            </button>
          </div>
        )}
      </article>

      <article className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
        <h3 className="font-semibold">Movimentar bem</h3>
        <p className="mt-1 text-xs text-slate-300">{helperText}</p>
        <form onSubmit={onMov} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Tipo</span>
            <select
              value={movPayload.tipoMovimentacao}
              onChange={(event) => setMovField("tipoMovimentacao", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            >
              {MOV_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Numero tombamento</span>
            <input
              value={movPayload.numeroTombamento}
              onChange={(event) => setMovField("numeroTombamento", event.target.value)}
              placeholder="Ex.: 1290001788"
              inputMode="numeric"
              pattern="\d{10}"
              maxLength={10}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
            <span className="text-[11px] text-slate-400">
              Padrao GEAFIN: 10 digitos numericos.
            </span>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Termo referencia</span>
            <input
              required
              value={movPayload.termoReferencia}
              onChange={(event) => setMovField("termoReferencia", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Unidade destino (1-4)</span>
            <input
              type="number"
              min="1"
              max="4"
              value={movPayload.unidadeDestinoId}
              onChange={(event) => setMovField("unidadeDestinoId", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Autorizada por (UUID)</span>
            <input
              value={movPayload.autorizadaPorPerfilId}
              onChange={(event) =>
                setMovField("autorizadaPorPerfilId", event.target.value)
              }
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Detentor temporario (UUID)</span>
            <input
              value={movPayload.detentorTemporarioPerfilId}
              onChange={(event) =>
                setMovField("detentorTemporarioPerfilId", event.target.value)
              }
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Data prevista devolucao</span>
            <input
              type="date"
              value={movPayload.dataPrevistaDevolucao}
              onChange={(event) =>
                setMovField("dataPrevistaDevolucao", event.target.value)
              }
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Data efetiva devolucao</span>
            <input
              type="datetime-local"
              value={movPayload.dataEfetivaDevolucao}
              onChange={(event) =>
                setMovField("dataEfetivaDevolucao", event.target.value)
              }
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-300">Justificativa</span>
            <textarea
              value={movPayload.justificativa}
              onChange={(event) => setMovField("justificativa", event.target.value)}
              className="min-h-20 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={movState.loading}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
            >
              {movState.loading ? "Enviando..." : "Executar /movimentar"}
            </button>
          </div>
        </form>
        {movState.error && <p className="mt-2 text-sm text-rose-300">{movState.error}</p>}
        {movState.response && (
          <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/10 bg-slate-900 p-3 text-xs">
            {JSON.stringify(movState.response, null, 2)}
          </pre>
        )}
      </article>
    </section>
  );
}

function buildMovPayload(payload) {
  const clean = {
    tipoMovimentacao: payload.tipoMovimentacao,
    termoReferencia: payload.termoReferencia,
    justificativa: payload.justificativa || undefined,
    numeroTombamento: payload.numeroTombamento || undefined,
    bemId: payload.bemId || undefined,
    unidadeDestinoId: payload.unidadeDestinoId
      ? Number(payload.unidadeDestinoId)
      : undefined,
    detentorTemporarioPerfilId: payload.detentorTemporarioPerfilId || undefined,
    dataPrevistaDevolucao: payload.dataPrevistaDevolucao || undefined,
    dataEfetivaDevolucao: payload.dataEfetivaDevolucao
      ? new Date(payload.dataEfetivaDevolucao).toISOString()
      : undefined,
    autorizadaPorPerfilId: payload.autorizadaPorPerfilId || undefined,
    executadaPorPerfilId: payload.executadaPorPerfilId || undefined,
  };

  return Object.fromEntries(
    Object.entries(clean).filter(([, value]) => value !== undefined),
  );
}

function ImportProgressBar({ progressState }) {
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

  const elapsed =
    imp?.importedEm && typeof imp.importedEm === "string"
      ? Math.max(0, Math.floor((Date.now() - Date.parse(imp.importedEm)) / 1000))
      : null;

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
          {elapsed != null ? (
            <p className="mt-1 text-[11px] text-slate-500">
              tempo decorrido: {elapsed}s
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
      {imp?.id ? (
        <p className="mt-1 text-[11px] text-slate-500">
          arquivoId={imp.id}
        </p>
      ) : null}
    </div>
  );
}
