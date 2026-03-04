/**
 * Modulo: frontend/components
 * Arquivo: RegularizationPanel.jsx
 * Funcao no sistema: painel de regularizacao pos-inventario (divergencias) com fluxo formal de transferencia.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext.jsx";
import {
  encaminharTransferenciaRegularizacao,
  getFotoUrl,
  listarEventosInventario,
  listarForasteirosInventario,
  regularizarForasteiroLote,
} from "../services/apiClient.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeLabel(raw) {
  return String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function compactText(raw, maxLen = 320) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(1, maxLen - 3)).trimEnd()}...`;
}

function resolveDescricaoResumo(item) {
  const nomeResumoRaw = String(item?.nomeResumo || "").trim();
  const descricaoComplementarRaw = String(item?.descricaoComplementar || "").trim();
  const catalogoDescricaoRaw = String(item?.catalogoDescricao || "").trim();

  const nomeResumo = compactText(nomeResumoRaw, 160);
  const descricaoComplementar = compactText(descricaoComplementarRaw, 360);
  const catalogoDescricao = compactText(catalogoDescricaoRaw, 360);

  const titulo = nomeResumo || descricaoComplementar || catalogoDescricao || "-";
  let detalhe = "";
  if (nomeResumoRaw) {
    if (descricaoComplementarRaw && normalizeLabel(descricaoComplementarRaw) !== normalizeLabel(nomeResumoRaw)) {
      detalhe = descricaoComplementar;
    } else if (catalogoDescricaoRaw && normalizeLabel(catalogoDescricaoRaw) !== normalizeLabel(nomeResumoRaw)) {
      detalhe = catalogoDescricao;
    }
  } else if (descricaoComplementarRaw && catalogoDescricaoRaw && normalizeLabel(descricaoComplementarRaw) !== normalizeLabel(catalogoDescricaoRaw)) {
    detalhe = catalogoDescricao;
  }
  return { titulo, detalhe };
}

function describeDivergence(item) {
  const unidadeDona = Number(item?.unidadeDonaId);
  const unidadeEncontrada = Number(item?.unidadeEncontradaId);
  const hasUnits = Number.isInteger(unidadeDona) && Number.isInteger(unidadeEncontrada);
  const unidadeDivergente = hasUnits ? unidadeDona !== unidadeEncontrada : false;
  const salaEsperada = String(item?.localEsperadoNome || item?.localEsperadoTexto || "").trim();
  const salaEncontrada = String(item?.salaEncontrada || "").trim();
  const salaDivergente = salaEsperada && salaEncontrada ? normalizeLabel(salaEsperada) !== normalizeLabel(salaEncontrada) : false;

  if (unidadeDivergente && salaDivergente) {
    return { badge: "UNIDADE + ENDEREÇO", badgeClass: "border-rose-300/40 bg-rose-200/10 text-rose-700", title: "Carga em unidade diferente e endereço divergente.", detail: `Esperado: ${salaEsperada}. Encontrado: ${salaEncontrada}.` };
  }
  if (unidadeDivergente) {
    return { badge: "UNIDADE", badgeClass: "border-amber-300/40 bg-amber-200/10 text-amber-800", title: "Carga em unidade diferente.", detail: "" };
  }
  if (salaDivergente) {
    return { badge: "ENDEREÇO", badgeClass: "border-violet-300 bg-violet-100/10 text-violet-700", title: "Mesma unidade, mas endereço divergente.", detail: `Esperado: ${salaEsperada}. Encontrado: ${salaEncontrada}.` };
  }
  return { badge: "REGISTRO", badgeClass: "border-slate-300 bg-slate-100 text-slate-800", title: "Divergencia registrada (sem detalhe de local esperado).", detail: salaEsperada ? `Endereço de referência: ${salaEsperada}.` : "" };
}

function formatUnidade(id) {
  if (id === 1) return "1 (1Âª Aud)";
  if (id === 2) return "2 (2Âª Aud)";
  if (id === 3) return "3 (Foro)";
  if (id === 4) return "4 (Almox)";
  return String(id || "");
}

function fluxoBadge(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ENCAMINHADA") return { label: "ENCAMINHADA", cls: "border-amber-300/40 bg-amber-100 text-amber-800" };
  if (s === "AGUARDANDO_APROVACAO") return { label: "AGUARDANDO APROVAÃ‡ÃƒO", cls: "border-sky-300/40 bg-sky-100 text-sky-800" };
  if (s === "ERRO") return { label: "ERRO", cls: "border-rose-300/40 bg-rose-100 text-rose-800" };
  if (s === "CONCLUIDA") return { label: "CONCLUÃDA", cls: "border-emerald-300/40 bg-emerald-100 text-emerald-800" };
  return { label: "NÃƒO ENCAMINHADA", cls: "border-slate-300 bg-slate-100 text-slate-700" };
}

export default function RegularizationPanel() {
  const qc = useQueryClient();
  const auth = useAuth();
  const [perfilId, setPerfilId] = useState("");
  const [filterEvento, setFilterEvento] = useState("");
  const [filterSala, setFilterSala] = useState("");
  const [filterFluxo, setFilterFluxo] = useState("TODOS");
  const [showItemPhoto, setShowItemPhoto] = useState(false);
  const [showCatalogPhoto, setShowCatalogPhoto] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

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

  const perfilIdEffective = auth.perfil?.id ? String(auth.perfil.id).trim() : perfilId.trim();
  const canUsePerfil = Boolean(perfilIdEffective && UUID_RE.test(perfilIdEffective));
  const canAdmin = !auth.authEnabled || String(auth.role || "").toUpperCase() === "ADMIN";

  const filteredItems = useMemo(() => {
    const items = forasteirosQuery.data || [];
    const ev = filterEvento.trim().toLowerCase();
    const sala = filterSala.trim().toLowerCase();
    return items.filter((it) => {
      const okEv = !ev || String(it.codigoEvento || "").toLowerCase().includes(ev);
      const okSala = !sala || String(it.salaEncontrada || "").toLowerCase().includes(sala);
      const fluxo = String(it.fluxoTransferenciaStatus || "").toUpperCase();
      const okFluxo = filterFluxo === "TODOS"
        || (filterFluxo === "NAO_ENCAMINHADA" ? !fluxo : fluxo === filterFluxo);
      return okEv && okSala && okFluxo;
    });
  }, [filterEvento, filterSala, filterFluxo, forasteirosQuery.data]);

  const enrichedItems = useMemo(
    () => filteredItems.map((it) => ({ ...it, divergence: describeDivergence(it), descricaoResumo: resolveDescricaoResumo(it) })),
    [filteredItems],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedItems = useMemo(() => enrichedItems.filter((it) => selectedSet.has(String(it.contagemId))), [enrichedItems, selectedSet]);

  const actionMut = useMutation({
    mutationFn: async ({ kind, contagemIds }) => {
      if (kind === "ENCAMINHAR_TRANSFERENCIA") {
        return encaminharTransferenciaRegularizacao({
          contagemIds,
          encaminhadoPorPerfilId: perfilIdEffective,
          observacoes: "UI: encaminhamento para transferencia formal (regularizacao).",
        });
      }
      return regularizarForasteiroLote({
        contagemIds,
        acao: kind,
        regularizadoPorPerfilId: perfilIdEffective,
        observacoes: `UI: regularizacao em lote (${kind}).`,
      });
    },
    onSuccess: async () => {
      setSelectedIds([]);
      await qc.invalidateQueries({ queryKey: ["inventarioForasteiros"] });
      await qc.invalidateQueries({ queryKey: ["bens"] }).catch(() => undefined);
    },
  });

  const toggleSelectAll = (checked) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(enrichedItems.map((it) => String(it.contagemId)));
  };
  const toggleSelectOne = (contagemId, checked) => {
    const id = String(contagemId || "");
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  };

  const runBatchAction = async (kind) => {
    actionMut.reset();
    if (!canUsePerfil) {
      actionMut.setError(new Error("Informe um perfilId (UUID) valido para executar a regularizacao."));
      return;
    }
    if (!canAdmin) {
      actionMut.setError(new Error("Regularizacao restrita ao perfil ADMIN."));
      return;
    }
    if (!selectedItems.length) {
      actionMut.setError(new Error("Selecione ao menos um bem para executar a acao."));
      return;
    }
    if (kind === "ATUALIZAR_LOCAL") {
      const invalid = selectedItems.filter((it) => Number(it.unidadeDonaId) !== Number(it.unidadeEncontradaId));
      if (invalid.length) {
        actionMut.setError(new Error("Endereço: trocar para endereço encontrado só pode ser aplicada quando unidade dona e unidade encontrada forem iguais."));
        return;
      }
    }
    const labels = {
      MANTER_CARGA: "manter carga (encerrar pendÃªncia sem transferir unidade)",
      ATUALIZAR_LOCAL: "trocar para endereço encontrado (sem transferir unidade)",
      ENCAMINHAR_TRANSFERENCIA: "encaminhar transferÃªncia formal (sem mudar carga aqui)",
    };
    const ok = window.confirm(`Confirmar aÃ§Ã£o em lote para ${selectedItems.length} item(ns): ${labels[kind]}?`);
    if (!ok) return;
    actionMut.mutate({
      kind,
      contagemIds: selectedItems.map((it) => String(it.contagemId)),
    });
  };

  const allSelected = enrichedItems.length > 0 && selectedItems.length === enrichedItems.length;
  const eventosAtivos = eventosAtivosQuery.data || [];

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[Space_Grotesk] text-2xl font-semibold">RegularizaÃ§Ã£o pÃ³s-inventÃ¡rio (DivergÃªncias)</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            TransferÃªncia sÃ³ no menu MovimentaÃ§Ãµes (procedimento formal). Enquanto nÃ£o concluir o procedimento de transferÃªncia,
            o bem permanece pendente em RegularizaÃ§Ã£o.
          </p>
          <p className="mt-1 text-xs text-slate-500">Regra legal: Art. 185 (AN303_Art185). TransferÃªncia formal: Arts. 124 e 127.</p>
        </div>
        <div className="text-right text-xs text-slate-600">
          PendÃªncias filtradas: <span className="font-semibold text-amber-800">{enrichedItems.length}</span>
        </div>
      </header>

      {eventosAtivos.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-100/10 p-3 text-sm text-amber-800">
          HÃ¡ inventÃ¡rio em andamento no sistema. RegularizaÃ§Ãµes sÃ³ sÃ£o aceitas para eventos jÃ¡ ENCERRADOS (Art. 185).
        </div>
      )}

      {!canAdmin && auth.authEnabled && (
        <div className="mt-4 rounded-xl border border-rose-300/30 bg-rose-200/10 p-3 text-sm text-rose-700">
          RegularizaÃ§Ã£o Ã© uma operaÃ§Ã£o administrativa. FaÃ§a login com um perfil <strong>ADMIN</strong>.
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr]">
        {auth.perfil ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">Executor</p>
            <p className="mt-1">{auth.perfil.nome} ({auth.perfil.matricula})</p>
          </div>
        ) : (
          <label className="block space-y-1">
            <span className="text-xs text-slate-600">perfilId (UUID)</span>
            <input value={perfilId} onChange={(e) => setPerfilId(e.target.value)} placeholder="UUID do perfil" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-xs text-slate-600">Filtro: evento</span>
          <input value={filterEvento} onChange={(e) => setFilterEvento(e.target.value)} placeholder="Ex.: INV_2026..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-slate-600">Filtro: endereço</span>
          <input value={filterSala} onChange={(e) => setFilterSala(e.target.value)} placeholder="Ex.: Endereço 605" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-slate-600">Filtro: fluxo de transferÃªncia</span>
          <select value={filterFluxo} onChange={(e) => setFilterFluxo(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="TODOS">Todos</option>
            <option value="NAO_ENCAMINHADA">NÃ£o encaminhada</option>
            <option value="ENCAMINHADA">Encaminhada</option>
            <option value="AGUARDANDO_APROVACAO">Aguardando aprovaÃ§Ã£o</option>
            <option value="ERRO">Erro</option>
            <option value="CONCLUIDA">ConcluÃ­da</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={showItemPhoto} onChange={(e) => setShowItemPhoto(e.target.checked)} className="h-4 w-4 accent-violet-600" />
          Foto do item
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={showCatalogPhoto} onChange={(e) => setShowCatalogPhoto(e.target.checked)} className="h-4 w-4 accent-violet-600" />
          Foto do catÃ¡logo
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => runBatchAction("MANTER_CARGA")} disabled={actionMut.isPending || !selectedItems.length || !canAdmin || !canUsePerfil} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50">Manter carga (selecionados)</button>
          <button type="button" onClick={() => runBatchAction("MANTER_CARGA")} disabled={actionMut.isPending || !selectedItems.length || !canAdmin || !canUsePerfil} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">Endereço: manter cadastrada</button>
          <button type="button" onClick={() => runBatchAction("ATUALIZAR_LOCAL")} disabled={actionMut.isPending || !selectedItems.length || !canAdmin || !canUsePerfil} className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-50">Endereço: trocar para endereço encontrado</button>
          <button type="button" onClick={() => runBatchAction("ENCAMINHAR_TRANSFERENCIA")} disabled={actionMut.isPending || !selectedItems.length || !canAdmin || !canUsePerfil} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">Encaminhar transferÃªncia formal</button>
          <button type="button" onClick={() => setSelectedIds([])} disabled={actionMut.isPending || !selectedItems.length} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50">Limpar seleÃ§Ã£o</button>
        </div>
        <p className="mt-2 text-xs text-slate-600">Selecionados: <strong>{selectedItems.length}</strong></p>
      </div>

      {actionMut.error ? <p className="mt-3 text-sm text-rose-700">{String(actionMut.error.message || "Falha na aÃ§Ã£o em lote.")}</p> : null}
      {actionMut.data?.summary ? (
        <p className="mt-3 text-sm text-emerald-700">
          Processado. Total: {actionMut.data.summary.total || 0}, sucesso: {actionMut.data.summary.regularizados ?? actionMut.data.summary.encaminhadas ?? 0}, erros: {actionMut.data.summary.erros || 0}.
        </p>
      ) : null}

      {(forasteirosQuery.isLoading || eventosAtivosQuery.isLoading) && <p className="mt-4 text-sm text-slate-600">Carregando dados...</p>}
      {!forasteirosQuery.isLoading && enrichedItems.length === 0 && (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Nenhuma divergÃªncia pendente de regularizaÃ§Ã£o encontrada.</p>
      )}

      {enrichedItems.length > 0 && (
        <div className="mt-4 overflow-x-hidden rounded-2xl border border-slate-200">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-white text-xs uppercase tracking-widest text-slate-600">
              <tr>
                <th className="w-[3rem] px-2 py-3 text-left">
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} className="h-4 w-4 accent-violet-600" />
                </th>
                <th className="w-[11rem] px-3 py-3 text-left">Evento</th>
                <th className="w-[8rem] px-3 py-3 text-left">Tombo</th>
                <th className="px-3 py-3 text-left">DescriÃ§Ã£o / Resumo</th>
                <th className="px-3 py-3 text-left">Unid. dona</th>
                <th className="px-3 py-3 text-left">Unid. encontrada</th>
                <th className="px-3 py-3 text-left">Endereço</th>
                <th className="px-3 py-3 text-left">DivergÃªncia</th>
                <th className="px-3 py-3 text-left">Fluxo transferÃªncia</th>
                <th className="px-3 py-3 text-left">Encontrado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-slate-50">
              {enrichedItems.map((it) => {
                const flow = fluxoBadge(it.fluxoTransferenciaStatus);
                const checked = selectedSet.has(String(it.contagemId));
                return (
                  <tr key={it.contagemId} className="align-top hover:bg-slate-50 transition-colors">
                    <td className="px-2 py-3">
                      <input type="checkbox" checked={checked} onChange={(e) => toggleSelectOne(it.contagemId, e.target.checked)} className="h-4 w-4 accent-violet-600" />
                    </td>
                    <td className="w-[11rem] px-3 py-3">
                      <div className="break-all font-semibold leading-tight text-slate-900">{it.codigoEvento || "-"}</div>
                      <div className="mt-1 text-[10px] text-slate-500 uppercase tracking-tighter">{String(it.statusInventario || "-")}</div>
                    </td>
                    <td className="w-[8rem] px-3 py-3 font-mono text-xs">{it.numeroTombamento || <span className="text-rose-700 font-bold bg-rose-100 px-1 rounded">SEM PLACA</span>}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900 break-words">{it.descricaoResumo.titulo}</div>
                      {it.descricaoResumo.detalhe && <div className="mt-1 text-[11px] italic text-slate-600 break-words">{it.descricaoResumo.detalhe}</div>}
                      {showItemPhoto && getFotoUrl(it.fotoUrl || "") && <div className="mt-2"><a href={getFotoUrl(it.fotoUrl || "")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-slate-100">Ver foto</a></div>}
                      {showCatalogPhoto && getFotoUrl(it.fotoReferenciaUrl || "") && <div className="mt-2"><a href={getFotoUrl(it.fotoReferenciaUrl || "")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">Foto catÃ¡logo</a></div>}
                    </td>
                    <td className="px-3 py-3 text-slate-800">{formatUnidade(Number(it.unidadeDonaId))}</td>
                    <td className="px-3 py-3 text-amber-800 font-medium">{formatUnidade(Number(it.unidadeEncontradaId))}</td>
                    <td className="px-3 py-3 text-slate-800">
                      <div>{it.salaEncontrada || "-"}</div>
                      {(it.localEsperadoNome || it.localEsperadoTexto) && <div className="mt-1 text-[11px] text-slate-500">Endereço esperado: <span className="font-medium text-slate-600">{it.localEsperadoNome || it.localEsperadoTexto}</span></div>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${it.divergence.badgeClass}`}>{it.divergence.badge}</span>
                      <div className="mt-1 text-xs text-slate-800">{it.divergence.title}</div>
                      {it.divergence.detail && <div className="mt-1 text-[11px] text-slate-500">{it.divergence.detail}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${flow.cls}`}>{flow.label}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 text-xs">{it.encontradoEm ? new Date(it.encontradoEm).toLocaleString() : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}




