/**
 * Modulo: frontend/components
 * Arquivo: MovimentacoesPanel.jsx
 * Funcao no sistema: executar movimentacoes patrimoniais (transferencia/cautela) e regularizacao em lote por sala.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import BarcodeScanner from "./BarcodeScanner.jsx";
import LocaisAdminPanel from "./LocaisAdminPanel.jsx";
import {
  atualizarBemOperacional,
  listarBens,
  listarLocais,
  movimentarBem,
} from "../services/apiClient.js";

const MOV_TYPES = ["TRANSFERENCIA", "CAUTELA_SAIDA", "CAUTELA_RETORNO"];

function normalizeTombamentoInput(raw) {
  if (raw == null) return "";
  return String(raw).trim().replace(/^\"+|\"+$/g, "").replace(/\D+/g, "").slice(0, 10);
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

export default function MovimentacoesPanel() {
  const auth = useAuth();
  const canUse = Boolean(auth.perfil) || !auth.authEnabled;
  const canAdmin = !auth.authEnabled || String(auth.role || "").toUpperCase() === "ADMIN";

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

  const [locaisState, setLocaisState] = useState({ loading: false, data: [], error: null });
  const [unidadeSalaId, setUnidadeSalaId] = useState("");
  const [localSalaId, setLocalSalaId] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [scannerMode, setScannerMode] = useState("continuous");
  const [showScanner, setShowScanner] = useState(false);
  const [loteItens, setLoteItens] = useState([]);
  const [loteState, setLoteState] = useState({ loading: false, response: null, error: null, info: null });

  const selectedLocal = useMemo(
    () => (locaisState.data || []).find((l) => String(l.id) === String(localSalaId)) || null,
    [locaisState.data, localSalaId],
  );

  const helperText = useMemo(() => {
    if (movPayload.tipoMovimentacao === "TRANSFERENCIA") {
      return "Transferencia muda carga (Arts. 124 e 127). Requer unidade destino e termo.";
    }
    if (movPayload.tipoMovimentacao === "CAUTELA_SAIDA") {
      return "Cautela nao muda carga. Requer detentor temporario e data prevista de devolucao.";
    }
    return "Retorno de cautela encerra a cautela (requer termo; data efetiva e opcional).";
  }, [movPayload.tipoMovimentacao]);

  useEffect(() => {
    let cancelled = false;
    const loadLocais = async () => {
      setLocaisState({ loading: true, data: [], error: null });
      try {
        const data = await listarLocais({
          unidadeId: unidadeSalaId ? Number(unidadeSalaId) : undefined,
        });
        if (cancelled) return;
        setLocaisState({ loading: false, data: data?.items || [], error: null });
      } catch (error) {
        if (cancelled) return;
        setLocaisState({ loading: false, data: [], error: formatApiError(error) });
      }
    };
    if (!canUse) return undefined;
    loadLocais();
    return () => {
      cancelled = true;
    };
  }, [canUse, unidadeSalaId]);

  const setMovField = (key, value) => setMovPayload((prev) => ({ ...prev, [key]: value }));

  const onMovSubmit = async (event) => {
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

  const upsertLoteItem = (item) => {
    setLoteItens((prev) => {
      const idx = prev.findIndex((x) => String(x.bemId) === String(item.bemId));
      if (idx < 0) return [item, ...prev];
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...item, repeticoes: Number(updated[idx].repeticoes || 1) + 1 };
      return updated;
    });
  };

  const buscarEAdicionarTombo = async (rawTombo) => {
    const tombo = normalizeTombamentoInput(rawTombo);
    if (!/^\d{10}$/.test(tombo)) {
      setLoteState({ loading: false, response: null, error: "Informe tombamento GEAFIN com 10 digitos.", info: null });
      return;
    }
    if (!selectedLocal) {
      setLoteState({ loading: false, response: null, error: "Selecione primeiro a sala/local de destino.", info: null });
      return;
    }
    setLoteState((prev) => ({ ...prev, loading: true, error: null, info: null }));
    try {
      const data = await listarBens({ numeroTombamento: tombo, limit: 20, offset: 0 });
      const item = (data?.items || []).find((x) => String(x.numeroTombamento || "") === tombo);
      if (!item) {
        setLoteState({ loading: false, response: null, error: `Tombo ${tombo} nao encontrado.`, info: null });
        return;
      }

      const unidadeBem = Number(item.unidadeDonaId || 0) || null;
      const unidadeSala = Number(selectedLocal.unidadeId || 0) || null;
      const divergenciaUnidade = Boolean(unidadeBem && unidadeSala && unidadeBem !== unidadeSala);

      let manterOutraUnidade = !divergenciaUnidade;
      if (divergenciaUnidade) {
        manterOutraUnidade = window.confirm(
          `Divergencia de unidade detectada para o tombo ${tombo}.\n` +
          `Unidade de carga do bem: ${unidadeBem}\n` +
          `Unidade da sala escolhida: ${unidadeSala}\n\n` +
          "Deseja manter este item de outra unidade na sala escolhida?",
        );
      }

      upsertLoteItem({
        bemId: item.id,
        numeroTombamento: item.numeroTombamento,
        descricao: item.descricao || item.descricaoComplementar || "-",
        unidadeDonaId: unidadeBem,
        localAtual: item.localFisico || "-",
        localAtualId: item.localId || null,
        divergenciaUnidade,
        manterOutraUnidade,
        repeticoes: 1,
        salvo: false,
        erro: null,
      });
      setLoteState({
        loading: false,
        response: null,
        error: null,
        info: divergenciaUnidade && !manterOutraUnidade
          ? `Tombo ${tombo} adicionado como divergente (nao sera salvo ate marcar manter).`
          : `Tombo ${tombo} adicionado na fila.`,
      });
      setScanInput("");
    } catch (error) {
      setLoteState({ loading: false, response: null, error: formatApiError(error), info: null });
    }
  };

  const onAdicionarTombo = async (event) => {
    event.preventDefault();
    await buscarEAdicionarTombo(scanInput);
  };

  const onSalvarLote = async () => {
    if (!canAdmin) {
      setLoteState({ loading: false, response: null, error: "Regularizacao por sala restrita ao perfil ADMIN.", info: null });
      return;
    }
    if (!selectedLocal) {
      setLoteState({ loading: false, response: null, error: "Selecione a sala/local de destino.", info: null });
      return;
    }
    if (!loteItens.length) {
      setLoteState({ loading: false, response: null, error: "Nenhum item na fila para salvar.", info: null });
      return;
    }

    const elegiveis = loteItens.filter((x) => !x.divergenciaUnidade || x.manterOutraUnidade);
    if (!elegiveis.length) {
      setLoteState({ loading: false, response: null, error: "Nao ha itens elegiveis para salvar (divergencias nao confirmadas).", info: null });
      return;
    }

    const divergentes = elegiveis.filter((x) => x.divergenciaUnidade);
    if (divergentes.length) {
      const ok = window.confirm(
        `Voce esta prestes a manter ${divergentes.length} item(ns) de outra unidade na sala selecionada.\n` +
        "Deseja continuar?",
      );
      if (!ok) return;
    }

    setLoteState({ loading: true, response: null, error: null, info: null });

    let okCount = 0;
    let failCount = 0;
    const updated = [...loteItens];

    for (let i = 0; i < updated.length; i += 1) {
      const row = updated[i];
      if (row.divergenciaUnidade && !row.manterOutraUnidade) continue;
      try {
        await atualizarBemOperacional(row.bemId, {
          localId: selectedLocal.id,
          localFisico: selectedLocal.nome,
        });
        updated[i] = { ...row, salvo: true, erro: null };
        okCount += 1;
      } catch (error) {
        updated[i] = { ...row, salvo: false, erro: formatApiError(error) };
        failCount += 1;
      }
    }

    setLoteItens(updated);
    setLoteState({
      loading: false,
      response: { ok: okCount, falhas: failCount },
      error: null,
      info: `Regularizacao concluida: ${okCount} salvo(s), ${failCount} falha(s).`,
    });
  };

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Movimentacoes</h2>
        <p className="mt-2 text-sm text-slate-600">{helperText}</p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Movimentar bem</h3>
        <p className="mt-1 text-xs text-slate-600">
          Dica: informe <code className="px-1">numeroTombamento</code> (10 digitos) ou <code className="px-1">bemId</code>.
          Durante inventario ativo, transferencias continuam bloqueadas (Art. 183).
        </p>

        <form onSubmit={onMovSubmit} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Tipo</span>
            <select
              value={movPayload.tipoMovimentacao}
              onChange={(event) => setMovField("tipoMovimentacao", event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
            <span className="text-xs text-slate-600">Numero do tombamento</span>
            <input
              value={movPayload.numeroTombamento}
              onChange={(event) => setMovField("numeroTombamento", normalizeTombamentoInput(event.target.value))}
              placeholder="Ex.: 1290001788"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={movState.loading}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-600">bemId (opcional)</span>
            <input
              value={movPayload.bemId}
              onChange={(event) => setMovField("bemId", event.target.value)}
              placeholder="UUID do bem (se preferir)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={movState.loading}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs text-slate-600">Termo referencia</span>
            <input
              value={movPayload.termoReferencia}
              onChange={(event) => setMovField("termoReferencia", event.target.value)}
              placeholder="Ex.: TRF-2026-0001"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={movState.loading}
            />
          </label>

          {movPayload.tipoMovimentacao === "TRANSFERENCIA" ? (
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Unidade destino (1-4)</span>
              <input
                type="number"
                min="1"
                max="4"
                value={movPayload.unidadeDestinoId}
                onChange={(event) => setMovField("unidadeDestinoId", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>
          ) : null}

          {movPayload.tipoMovimentacao === "CAUTELA_SAIDA" ? (
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Detentor temporario (perfilId UUID)</span>
              <input
                value={movPayload.detentorTemporarioPerfilId}
                onChange={(event) => setMovField("detentorTemporarioPerfilId", event.target.value)}
                placeholder="UUID do perfil (detentor)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>
          ) : null}

          {movPayload.tipoMovimentacao === "CAUTELA_SAIDA" ? (
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Data prevista devolucao</span>
              <input
                type="date"
                value={movPayload.dataPrevistaDevolucao}
                onChange={(event) => setMovField("dataPrevistaDevolucao", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>
          ) : null}

          {movPayload.tipoMovimentacao === "CAUTELA_RETORNO" ? (
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Data efetiva devolucao (opcional)</span>
              <input
                type="datetime-local"
                value={movPayload.dataEfetivaDevolucao}
                onChange={(event) => setMovField("dataEfetivaDevolucao", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={movState.loading}
              />
            </label>
          ) : null}

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-slate-600">Justificativa (opcional)</span>
            <textarea
              value={movPayload.justificativa}
              onChange={(event) => setMovField("justificativa", event.target.value)}
              className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={movState.loading}
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={movState.loading}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {movState.loading ? "Enviando..." : "Executar /movimentar"}
            </button>
            {movState.error ? <p className="mt-2 text-sm text-rose-700">{movState.error}</p> : null}
            {movState.response ? (
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                {JSON.stringify(movState.response, null, 2)}
              </pre>
            ) : null}
          </div>
        </form>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Cadastrar bens por sala (regularizacao em lote)</h3>
        <p className="mt-1 text-xs text-slate-600">
          Selecione unidade e sala de destino, bipa os itens encontrados (teclado/scanner/camera) e salve em lote.
          Em divergencia de unidade, o sistema pergunta se deseja manter o item na sala escolhida.
        </p>

        {!canAdmin ? (
          <p className="mt-3 text-sm text-amber-800">Funcionalidade restrita ao perfil ADMIN.</p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <label className="space-y-1">
                <span className="text-xs text-slate-600">Unidade da sala</span>
                <select
                  value={unidadeSalaId}
                  onChange={(e) => {
                    setUnidadeSalaId(e.target.value);
                    setLocalSalaId("");
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={loteState.loading}
                >
                  <option value="">Todas</option>
                  <option value="1">1 (1a Aud)</option>
                  <option value="2">2 (2a Aud)</option>
                  <option value="3">3 (Foro)</option>
                  <option value="4">4 (Almox)</option>
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-slate-600">Sala/Local de destino</span>
                <select
                  value={localSalaId}
                  onChange={(e) => setLocalSalaId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={loteState.loading || locaisState.loading}
                >
                  <option value="">Selecione...</option>
                  {(locaisState.data || []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome} (unidade {l.unidadeId || "-"})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-slate-600">Modo camera</span>
                <select
                  value={scannerMode}
                  onChange={(e) => setScannerMode(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={loteState.loading}
                >
                  <option value="single">Leitura simples</option>
                  <option value="continuous">Leitura continua</option>
                </select>
              </label>
            </div>

            <form onSubmit={onAdicionarTombo} className="mt-3 flex flex-wrap gap-2">
              <input
                value={scanInput}
                onChange={(e) => setScanInput(normalizeTombamentoInput(e.target.value))}
                className="min-w-[260px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Bipe ou digite tombamento (10 digitos)"
                disabled={loteState.loading}
              />
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                disabled={loteState.loading}
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                disabled={loteState.loading}
              >
                Abrir camera
              </button>
              <button
                type="button"
                onClick={onSalvarLote}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={loteState.loading || !loteItens.length || !selectedLocal}
              >
                {loteState.loading ? "Salvando..." : "Salvar lote na sala"}
              </button>
            </form>

            {locaisState.error ? <p className="mt-2 text-sm text-rose-700">{locaisState.error}</p> : null}
            {loteState.error ? <p className="mt-2 text-sm text-rose-700">{loteState.error}</p> : null}
            {loteState.info ? <p className="mt-2 text-sm text-slate-700">{loteState.info}</p> : null}

            <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Tombo</th>
                    <th className="px-3 py-2">Descricao</th>
                    <th className="px-3 py-2">Unid.</th>
                    <th className="px-3 py-2">Local atual</th>
                    <th className="px-3 py-2">Divergencia</th>
                    <th className="px-3 py-2">Manter?</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loteItens.map((row) => (
                    <tr key={row.bemId} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-[11px]">{row.numeroTombamento}</td>
                      <td className="px-3 py-2 text-slate-800">{row.descricao}</td>
                      <td className="px-3 py-2 text-slate-700">{row.unidadeDonaId || "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{row.localAtual || "-"}</td>
                      <td className="px-3 py-2">
                        {row.divergenciaUnidade ? (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">Outra unidade</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.divergenciaUnidade ? (
                          <label className="inline-flex items-center gap-2 text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(row.manterOutraUnidade)}
                              onChange={(e) =>
                                setLoteItens((prev) =>
                                  prev.map((x) =>
                                    x.bemId === row.bemId ? { ...x, manterOutraUnidade: e.target.checked } : x,
                                  ),
                                )
                              }
                              disabled={loteState.loading}
                              className="h-4 w-4 accent-violet-600"
                            />
                            Sim
                          </label>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.erro ? (
                          <span className="text-rose-700">{row.erro}</span>
                        ) : row.salvo ? (
                          <span className="text-emerald-700">Salvo</span>
                        ) : (
                          <span className="text-slate-500">Pendente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loteItens.length ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-600" colSpan={7}>
                        Nenhum item na fila.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </article>

      <LocaisAdminPanel canAdmin={canAdmin} />

      {showScanner ? (
        <BarcodeScanner
          continuous={scannerMode === "continuous"}
          onClose={() => setShowScanner(false)}
          onScan={(value) => {
            const normalized = normalizeTombamentoInput(value);
            if (normalized) {
              void buscarEAdicionarTombo(normalized);
            }
            if (scannerMode === "single") {
              setShowScanner(false);
            }
          }}
        />
      ) : null}
    </section>
  );
}
