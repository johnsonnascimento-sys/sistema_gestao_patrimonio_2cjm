/**
 * Modulo: frontend/components
 * Arquivo: RegularizationPanel.jsx
 * Funcao no sistema: painel de regularizacao pos-inventario (intrusos/forasteiros) sem violar Art. 183/185.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
import { listarForasteirosInventario, listarEventosInventario, regularizarForasteiro } from "../services/apiClient.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatUnidade(id) {
  if (id === 1) return "1 (1ª Aud)";
  if (id === 2) return "2 (2ª Aud)";
  if (id === 3) return "3 (Foro)";
  if (id === 4) return "4 (Almox)";
  return String(id || "");
}

export default function RegularizationPanel() {
  const qc = useQueryClient();
  const auth = useAuth();
  const [perfilId, setPerfilId] = useState("");
  const [termoReferencia, setTermoReferencia] = useState("");
  const [filterEvento, setFilterEvento] = useState("");
  const [filterSala, setFilterSala] = useState("");

  const eventosAtivosQuery = useQuery({
    queryKey: ["inventarioEventos", "EM_ANDAMENTO"],
    queryFn: async () => {
      const data = await listarEventosInventario("EM_ANDAMENTO");
      return data.items || [];
    },
  });

  const forasteirosQuery = useQuery({
    queryKey: ["inventarioForasteiros"],
    queryFn: async () => {
      const data = await listarForasteirosInventario({ limit: 2000 });
      return data.items || [];
    },
  });

  const filteredItems = useMemo(() => {
    const items = forasteirosQuery.data || [];
    const ev = filterEvento.trim().toLowerCase();
    const sala = filterSala.trim().toLowerCase();
    if (!ev && !sala) return items;
    return items.filter((it) => {
      const okEv = !ev || String(it.codigoEvento || "").toLowerCase().includes(ev);
      const okSala = !sala || String(it.salaEncontrada || "").toLowerCase().includes(sala);
      return okEv && okSala;
    });
  }, [forasteirosQuery.data, filterEvento, filterSala]);

  const perfilIdEffective = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
  const canUsePerfil = Boolean(perfilIdEffective && UUID_RE.test(perfilIdEffective));
  const canAdmin = !auth.authEnabled || String(auth.role || "").toUpperCase() === "ADMIN";

  const regularizarMut = useMutation({
    mutationFn: (payload) => regularizarForasteiro(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["inventarioForasteiros"] });
      // A regularizacao pode gerar historico/movimentacao; atualiza caches de bens.
      await qc.invalidateQueries({ queryKey: ["bens"] }).catch(() => undefined);
    },
  });

  const onRegularizar = async (it, acao) => {
    regularizarMut.reset();

    const perfilIdFinal = perfilIdEffective;
    if (!canUsePerfil) {
      regularizarMut.setError(new Error("Informe um perfilId (UUID) valido para executar a regularizacao."));
      return;
    }
    if (!canAdmin) {
      regularizarMut.setError(new Error("Regularizacao restrita ao perfil ADMIN."));
      return;
    }

    const termo = termoReferencia.trim();
    if (acao === "TRANSFERIR_CARGA" && !termo) {
      regularizarMut.setError(new Error("termoReferencia e obrigatorio para TRANSFERIR_CARGA."));
      return;
    }

    const msg = acao === "TRANSFERIR_CARGA"
      ? `Confirmar TRANSFERIR carga do bem ${it.numeroTombamento} para unidade ${formatUnidade(Number(it.unidadeEncontradaId))}?\n\nRegra legal: Art. 185 (AN303_Art185) e Arts. 124/127 (AN303_Art124/AN303_Art127).`
      : `Confirmar encerrar pendencia (MANTER_CARGA) do bem ${it.numeroTombamento} sem alterar a carga?\n\nRegra legal: Art. 185 (AN303_Art185).`;

    // Guardrail simples para evitar clique acidental.
    if (!window.confirm(msg)) return;

    regularizarMut.mutate({
      contagemId: it.contagemId,
      acao,
      regularizadoPorPerfilId: perfilIdFinal,
      termoReferencia: acao === "TRANSFERIR_CARGA" ? termo : undefined,
      observacoes: `UI: regularizacao pos-inventario (${acao}).`,
    });
  };

  const eventosAtivos = eventosAtivosQuery.data || [];

  return (
    <section className="mt-6 rounded-2xl border border-white/15 bg-slate-900/55 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Regularização pós-inventário (Forasteiros)</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Divergências registradas no inventário não mudam a carga automaticamente. Esta tela serve para encerrar a pendência
            e, quando necessário, efetuar a transferência formal (com termo).
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Regra legal: Art. 185 (AN303_Art185). Transferência: Arts. 124 e 127 (AN303_Art124 / AN303_Art127).
          </p>
        </div>
        <div className="text-right text-xs text-slate-300">
          <p>
            Pendências:{" "}
            <span className="font-semibold text-amber-200">{filteredItems.length}</span>
          </p>
          <p className="mt-1">
            Inventário ativo:{" "}
            <span className={eventosAtivos.length ? "text-amber-200" : "text-emerald-300"}>
              {eventosAtivos.length ? "SIM" : "NÃO"}
            </span>
          </p>
        </div>
      </header>

      {eventosAtivos.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-100/10 p-3 text-sm text-amber-100">
          Há inventário em andamento no sistema. Regularizações só são aceitas para eventos já ENCERRADOS (Art. 185).
        </div>
      )}

      {!canAdmin && auth.authEnabled && (
        <div className="mt-4 rounded-xl border border-rose-300/30 bg-rose-200/10 p-3 text-sm text-rose-200">
          Regularização é uma operação administrativa. Faça login com um perfil <strong>ADMIN</strong> para executar ações.
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        {auth.perfil ? (
          <div className="rounded-xl border border-white/10 bg-slate-950/25 p-3 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">Executor</p>
            <p className="mt-1">
              {auth.perfil.nome} ({auth.perfil.matricula}) - perfilId {String(auth.perfil.id).slice(0, 8)}...
            </p>
          </div>
        ) : (
          <label className="block space-y-1">
            <span className="text-xs text-slate-300">perfilId (UUID) do executor</span>
            <input
              value={perfilId}
              onChange={(e) => setPerfilId(e.target.value)}
              placeholder="UUID do perfil (ex.: criado em Operações API)"
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
            {!perfilId.trim() ? null : (
              <span className={`text-[11px] ${canUsePerfil ? "text-emerald-200" : "text-rose-200"}`}>
                {canUsePerfil ? "UUID válido" : "UUID inválido"}
              </span>
            )}
          </label>
        )}

        <label className="block space-y-1">
          <span className="text-xs text-slate-300">termoReferencia (obrigatório para Transferir)</span>
          <input
            value={termoReferencia}
            onChange={(e) => setTermoReferencia(e.target.value)}
            placeholder="Ex.: TT_2026_0001"
            className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
          />
          <span className="text-[11px] text-slate-400">
            Dica: use o mesmo código que será usado no PDF gerado (n8n) para rastreabilidade.
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <label className="block space-y-1">
            <span className="text-xs text-slate-300">Filtro: evento</span>
            <input
              value={filterEvento}
              onChange={(e) => setFilterEvento(e.target.value)}
              placeholder="Ex.: INV_2026..."
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-300">Filtro: sala</span>
            <input
              value={filterSala}
              onChange={(e) => setFilterSala(e.target.value)}
              placeholder="Ex.: Sala 101"
              className="w-full rounded-lg border border-white/20 bg-slate-800 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      {(forasteirosQuery.isLoading || eventosAtivosQuery.isLoading) && (
        <p className="mt-4 text-sm text-slate-300">Carregando dados...</p>
      )}

      {forasteirosQuery.error && (
        <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-200/10 p-3 text-sm text-rose-200">
          Falha ao listar pendências de regularização.
        </p>
      )}

      {regularizarMut.error && (
        <p className="mt-4 rounded-xl border border-rose-300/30 bg-rose-200/10 p-3 text-sm text-rose-200">
          {String(regularizarMut.error?.message || "Falha na regularização.")}
        </p>
      )}

      {!forasteirosQuery.isLoading && filteredItems.length === 0 && (
        <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/30 p-4 text-sm text-slate-300">
          Nenhum forasteiro pendente de regularização.
        </p>
      )}

      {filteredItems.length > 0 && (
        <div className="mt-4 overflow-auto rounded-2xl border border-white/10">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-950/40 text-xs uppercase tracking-widest text-slate-300">
              <tr>
                <th className="px-3 py-3 text-left">Evento</th>
                <th className="px-3 py-3 text-left">Tombo</th>
                <th className="px-3 py-3 text-left">Catálogo (SKU)</th>
                <th className="px-3 py-3 text-left">Unid. dona</th>
                <th className="px-3 py-3 text-left">Unid. encontrada</th>
                <th className="px-3 py-3 text-left">Sala</th>
                <th className="px-3 py-3 text-left">Encontrado em</th>
                <th className="px-3 py-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-slate-900/40">
              {filteredItems.map((it) => (
                <tr key={it.contagemId} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-100">{it.codigoEvento || "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      status: {String(it.statusInventario || "-")}
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-100">{it.numeroTombamento}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-100">{it.catalogoDescricao}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      codigo: <span className="font-mono">{it.codigoCatalogo}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-200">{formatUnidade(Number(it.unidadeDonaId))}</td>
                  <td className="px-3 py-3 text-amber-100">{formatUnidade(Number(it.unidadeEncontradaId))}</td>
                  <td className="px-3 py-3 text-slate-200">{it.salaEncontrada}</td>
                  <td className="px-3 py-3 text-slate-300">
                    {it.encontradoEm ? new Date(it.encontradoEm).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onRegularizar(it, "MANTER_CARGA")}
                        disabled={!canAdmin || !canUsePerfil || regularizarMut.isPending}
                        className="rounded-lg border border-white/20 bg-slate-950/40 px-3 py-2 text-xs font-semibold hover:bg-white/5 disabled:opacity-50"
                        title="Encerra a pendência sem alterar a carga do bem."
                      >
                        Manter carga
                      </button>
                      <button
                        type="button"
                        onClick={() => onRegularizar(it, "TRANSFERIR_CARGA")}
                        disabled={!canAdmin || !canUsePerfil || !termoReferencia.trim() || regularizarMut.isPending}
                        className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-cyan-200 disabled:opacity-50"
                        title="Executa a transferência de carga para a unidade encontrada e encerra a pendência."
                      >
                        Transferir carga
                      </button>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      contagemId: <span className="font-mono">{it.contagemId}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
