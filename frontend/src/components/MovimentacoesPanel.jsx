/**
 * Modulo: frontend/components
 * Arquivo: MovimentacoesPanel.jsx
 * Funcao no sistema: executar movimentacoes patrimoniais (transferencia/cautela) via API /movimentar.
 *
 * Regras legais:
 * - Transferencia muda carga (Arts. 124 e 127) - Art. 124 (AN303_Art124), Art. 127 (AN303_Art127).
 * - Bloqueio durante inventario ativo (Art. 183) - Art. 183 (AN303_Art183).
 *
 * Observacao operacional:
 * - O backend preenche autorizador/executor com o perfil autenticado quando nao forem enviados no payload.
 */
import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { movimentarBem } from "../services/apiClient.js";

const MOV_TYPES = ["TRANSFERENCIA", "CAUTELA_SAIDA", "CAUTELA_RETORNO"];

function normalizeTombamentoInput(raw) {
  if (raw == null) return "";
  return String(raw).trim().replace(/^\"+|\"+$/g, "").replace(/\D+/g, "").slice(0, 10);
}

function buildMovPayload(payload) {
  const clean = {
    tipoMovimentacao: payload.tipoMovimentacao,
    termoReferencia: payload.termoReferencia,
    justificativa: payload.justificativa || undefined,
    numeroTombamento: payload.numeroTombamento || undefined,
    bemId: payload.bemId || undefined,
    unidadeDestinoId: payload.unidadeDestinoId ? Number(payload.unidadeDestinoId) : undefined,
    detentorTemporarioPerfilId: payload.detentorTemporarioPerfilId || undefined,
    dataPrevistaDevolucao: payload.dataPrevistaDevolucao || undefined,
    dataEfetivaDevolucao: payload.dataEfetivaDevolucao ? new Date(payload.dataEfetivaDevolucao).toISOString() : undefined,
  };

  return Object.fromEntries(Object.entries(clean).filter(([, value]) => value !== undefined));
}

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

export default function MovimentacoesPanel() {
  const auth = useAuth();
  const canUse = Boolean(auth.perfil) || !auth.authEnabled;

  const [movState, setMovState] = useState({ loading: false, response: null, error: null });
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
  });

  const helperText = useMemo(() => {
    if (movPayload.tipoMovimentacao === "TRANSFERENCIA") {
      return "Transferencia muda carga (Arts. 124 e 127). Requer unidade destino e termo.";
    }
    if (movPayload.tipoMovimentacao === "CAUTELA_SAIDA") {
      return "Cautela nao muda carga. Requer detentor temporario e data prevista de devolucao.";
    }
    return "Retorno de cautela encerra a cautela (requer termo; data efetiva e opcional).";
  }, [movPayload.tipoMovimentacao]);

  const setField = (key, value) => setMovPayload((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canUse) {
      setMovState({ loading: false, response: null, error: "Voce precisa estar autenticado para movimentar bens." });
      return;
    }
    setMovState({ loading: true, response: null, error: null });
    try {
      const payload = buildMovPayload(movPayload);
      const data = await movimentarBem(payload);
      setMovState({ loading: false, response: data, error: null });
    } catch (error) {
      setMovState({ loading: false, response: null, error: formatApiError(error) });
    }
  };

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-white/15 bg-slate-900/55 p-6">
      <header>
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Movimentacoes</h2>
        <p className="mt-2 text-sm text-slate-300">{helperText}</p>
      </header>

      <article className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
        <h3 className="font-semibold">Movimentar bem</h3>
        <p className="mt-1 text-xs text-slate-300">
          Dica: informe <code className="px-1">numeroTombamento</code> (10 digitos) ou <code className="px-1">bemId</code>.
          Durante inventario ativo, transferencias continuam bloqueadas (Art. 183).
        </p>

        <form onSubmit={onSubmit} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-300">Tipo</span>
            <select
              value={movPayload.tipoMovimentacao}
              onChange={(event) => setField("tipoMovimentacao", event.target.value)}
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              disabled={movState.loading}
            >
              {MOV_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-300">Numero do tombamento</span>
            <input
              value={movPayload.numeroTombamento}
              onChange={(event) => setField("numeroTombamento", normalizeTombamentoInput(event.target.value))}
              placeholder="Ex.: 1290001788"
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              disabled={movState.loading}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-300">bemId (opcional)</span>
            <input
              value={movPayload.bemId}
              onChange={(event) => setField("bemId", event.target.value)}
              placeholder="UUID do bem (se preferir)"
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              disabled={movState.loading}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-300">Termo referencia</span>
            <input
              value={movPayload.termoReferencia}
              onChange={(event) => setField("termoReferencia", event.target.value)}
              placeholder="Ex.: TRF-2026-0001"
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              disabled={movState.loading}
            />
          </label>

          {movPayload.tipoMovimentacao === "TRANSFERENCIA" ? (
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Unidade destino (1-4)</span>
              <input
                type="number"
                min="1"
                max="4"
                value={movPayload.unidadeDestinoId}
                onChange={(event) => setField("unidadeDestinoId", event.target.value)}
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>
          ) : null}

          {movPayload.tipoMovimentacao === "CAUTELA_SAIDA" ? (
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Detentor temporario (perfilId UUID)</span>
              <input
                value={movPayload.detentorTemporarioPerfilId}
                onChange={(event) => setField("detentorTemporarioPerfilId", event.target.value)}
                placeholder="UUID do perfil (detentor)"
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>
          ) : null}

          {movPayload.tipoMovimentacao === "CAUTELA_SAIDA" ? (
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Data prevista devolucao</span>
              <input
                type="date"
                value={movPayload.dataPrevistaDevolucao}
                onChange={(event) => setField("dataPrevistaDevolucao", event.target.value)}
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>
          ) : null}

          {movPayload.tipoMovimentacao === "CAUTELA_RETORNO" ? (
            <label className="space-y-1">
              <span className="text-xs text-slate-300">Data efetiva devolucao (opcional)</span>
              <input
                type="datetime-local"
                value={movPayload.dataEfetivaDevolucao}
                onChange={(event) => setField("dataEfetivaDevolucao", event.target.value)}
                className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>
          ) : null}

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-300">Justificativa (opcional)</span>
            <textarea
              value={movPayload.justificativa}
              onChange={(event) => setField("justificativa", event.target.value)}
              className="min-h-20 w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
              disabled={movState.loading}
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
            {movState.error ? <p className="mt-2 text-sm text-rose-300">{movState.error}</p> : null}
            {movState.response ? (
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/10 bg-slate-900 p-3 text-xs">
                {JSON.stringify(movState.response, null, 2)}
              </pre>
            ) : null}
          </div>
        </form>
      </article>
    </section>
  );
}

