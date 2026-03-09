/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryDivergencesPanel.jsx
 * Funcao no sistema: renderizar divergencias pendentes do endereco sem alterar o fluxo de regularizacao.
 */
import { useMemo, useState } from "react";
import { DisclosureMetaBadge } from "./InventoryRoomUi.jsx";

function normalizeRoomKey(raw) {
  if (raw == null) return "";
  return String(raw).trim().toLowerCase();
}

function normalizeRoomLabel(raw) {
  if (raw == null) return "";
  return String(raw).trim().toLowerCase().replace(/\s+/g, " ");
}

function describeRowDivergence(row) {
  const unidadeDona = Number(row?.unidadeDonaId);
  const unidadeEncontrada = Number(row?.unidadeEncontradaId);
  const hasUnits = Number.isInteger(unidadeDona) && Number.isInteger(unidadeEncontrada);
  const unidadeDivergente = hasUnits ? unidadeDona !== unidadeEncontrada : false;

  const salaEsperada = String(row?.localEsperadoNome || row?.localEsperadoTexto || "").trim();
  const salaEncontrada = String(row?.salaEncontrada || "").trim();
  const salaDivergente = salaEsperada && salaEncontrada
    ? normalizeRoomLabel(salaEsperada) !== normalizeRoomLabel(salaEncontrada)
    : false;

  if (unidadeDivergente && salaDivergente) {
    return {
      badge: "UNIDADE + ENDEREÇO",
      badgeClass: "border-rose-300/40 bg-rose-200/10 text-rose-700",
      title: "Carga em unidade diferente e endereço divergente.",
      detail: `Esperado: ${salaEsperada}. Encontrado: ${salaEncontrada}.`,
    };
  }
  if (unidadeDivergente) {
    return {
      badge: "UNIDADE",
      badgeClass: "border-amber-300/40 bg-amber-200/10 text-amber-800",
      title: "Carga em unidade diferente.",
      detail: "",
    };
  }
  if (salaDivergente) {
    return {
      badge: "ENDEREÇO",
      badgeClass: "border-violet-300 bg-violet-100/10 text-violet-700",
      title: "Mesma unidade, mas endereço divergente.",
      detail: `Esperado: ${salaEsperada}. Encontrado: ${salaEncontrada}.`,
    };
  }
  return {
    badge: "REGISTRO",
    badgeClass: "border-slate-300 bg-slate-100 text-slate-800",
    title: "Divergência registrada (sem detalhe de local esperado).",
    detail: salaEsperada ? `Endereço de referência: ${salaEsperada}.` : "",
  };
}

export default function InventoryDivergencesPanel({
  salaEncontrada,
  contagens,
  offlineItems,
  bensSala,
  eventoInventarioId,
  formatUnidade,
  getFotoUrl,
}) {
  const salaKey = normalizeRoomKey(salaEncontrada);
  const [showItemPhoto, setShowItemPhoto] = useState(false);
  const [showCatalogPhoto, setShowCatalogPhoto] = useState(false);

  const bemByTomb = useMemo(() => {
    const map = new Map();
    for (const item of bensSala || []) {
      if (item?.numeroTombamento) {
        map.set(String(item.numeroTombamento), item);
      }
    }
    return map;
  }, [bensSala]);

  const serverDivergences = useMemo(() => {
    const items = [];
    for (const contagem of contagens || []) {
      const isDivergente = contagem?.tipoOcorrencia === "ENCONTRADO_EM_LOCAL_DIVERGENTE"
        || contagem?.tipoOcorrencia === "BEM_NAO_IDENTIFICADO";
      if (!isDivergente) continue;
      if (normalizeRoomKey(contagem.salaEncontrada) !== salaKey) continue;
      if (contagem?.regularizacaoPendente === false) continue;
      items.push({
        fonte: "SERVIDOR",
        numeroTombamento: contagem.numeroTombamento,
        identificadorExterno: contagem.identificadorExterno,
        codigoCatalogo: contagem.codigoCatalogo,
        catalogoDescricao: contagem.catalogoDescricao,
        descricaoComplementar: contagem.descricaoComplementar,
        fotoUrl: contagem.fotoUrl,
        fotoReferenciaUrl: contagem.fotoReferenciaUrl,
        observacoes: contagem.observacoes,
        unidadeDonaId: contagem.unidadeDonaId,
        unidadeEncontradaId: contagem.unidadeEncontradaId,
        salaEncontrada: contagem.salaEncontrada,
        localEsperadoId: contagem.localEsperadoId,
        localEsperadoTexto: contagem.localEsperadoTexto,
        localEsperadoNome: contagem.localEsperadoNome,
        encontradoEm: contagem.encontradoEm,
      });
    }
    return items;
  }, [contagens, salaKey]);

  const pendingDivergences = useMemo(() => {
    const items = [];
    for (const offlineItem of offlineItems || []) {
      if (!eventoInventarioId || offlineItem.eventoInventarioId !== eventoInventarioId) continue;
      if (normalizeRoomKey(offlineItem.salaEncontrada) !== salaKey) continue;
      const bem = offlineItem.numeroTombamento ? bemByTomb.get(String(offlineItem.numeroTombamento)) : null;
      const unidadeDonaId = bem?.unidadeDonaId != null ? Number(bem.unidadeDonaId) : null;
      const unidadeEncontradaId = offlineItem.unidadeEncontradaId != null ? Number(offlineItem.unidadeEncontradaId) : null;
      const localDonoId = bem?.localId != null ? String(bem.localId) : null;
      const localEncontradoId = offlineItem?.localEncontradoId != null ? String(offlineItem.localEncontradoId) : null;
      const divergenciaUnidade = Number.isInteger(unidadeDonaId) && Number.isInteger(unidadeEncontradaId)
        ? unidadeDonaId !== unidadeEncontradaId
        : false;
      const divergenciaSala = localDonoId && localEncontradoId ? localDonoId !== localEncontradoId : false;
      if (!divergenciaUnidade && !divergenciaSala) continue;
      items.push({
        fonte: "PENDENTE",
        numeroTombamento: offlineItem.numeroTombamento,
        codigoCatalogo: bem?.codigoCatalogo || null,
        catalogoDescricao: bem?.catalogoDescricao || null,
        fotoUrl: bem?.fotoUrl || null,
        fotoReferenciaUrl: bem?.fotoReferenciaUrl || null,
        unidadeDonaId,
        unidadeEncontradaId,
        salaEncontrada: offlineItem.salaEncontrada,
        localEsperadoId: bem?.localId != null ? String(bem.localId) : null,
        localEsperadoNome: bem?.localFisico || null,
        observacoes: divergenciaSala && bem?.localFisico ? `Endereço esperado: ${bem.localFisico}` : undefined,
        encontradoEm: offlineItem.encontradoEm,
      });
    }
    return items;
  }, [offlineItems, eventoInventarioId, salaKey, bemByTomb]);

  const all = useMemo(() => {
    const map = new Map();
    for (const row of [...serverDivergences, ...pendingDivergences]) {
      const key = row.numeroTombamento ? String(row.numeroTombamento) : row.identificadorExterno;
      if (!key) continue;
      const previous = map.get(key);
      if (!previous || previous.fonte === "PENDENTE") {
        map.set(key, row);
      }
    }
    return Array.from(map.values()).sort((a, b) => String(b.encontradoEm || "").localeCompare(String(a.encontradoEm || "")));
  }, [serverDivergences, pendingDivergences]);

  if (!String(salaEncontrada || "").trim()) return null;

  return (
    <details className="mt-5 overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm" open>
      <summary className="list-none cursor-pointer select-none p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Divergências no endereço (Art. 185)</h3>
              <DisclosureMetaBadge tone={all.length ? "danger" : "neutral"}>Pendentes {all.length}</DisclosureMetaBadge>
            </div>
            <p className="mt-1 text-sm text-slate-600">Registre divergências sem transferir carga durante o inventário.</p>
          </div>
          <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">Art. 185</span>
        </div>
      </summary>
      <div className="border-t border-slate-200/80 px-4 pb-4 pt-4 md:px-5 md:pb-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-600">
          Regra legal: registrar divergência sem transferir carga durante inventário. Art. 185 (AN303_Art185).
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showItemPhoto}
              onChange={(event) => setShowItemPhoto(event.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            Foto do item
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCatalogPhoto}
              onChange={(event) => setShowCatalogPhoto(event.target.checked)}
              className="h-4 w-4 accent-violet-600"
            />
            Foto do catálogo
          </label>
        </div>

        {all.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Nenhuma divergência pendente neste endereço.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 pb-2">
            <table className="w-full text-sm">
              <thead className="bg-white text-xs uppercase tracking-widest text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-left">Tombo</th>
                  <th className="px-3 py-3 text-left">Catálogo (SKU)</th>
                  <th className="px-3 py-3 text-left">Unid. dona</th>
                  <th className="px-3 py-3 text-left">Unid. encontrada</th>
                  <th className="px-3 py-3 text-left">Qual divergência</th>
                  <th className="px-3 py-3 text-left">Fonte</th>
                  <th className="px-3 py-3 text-left">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-slate-50">
                {all.slice(0, 120).map((row) => {
                  const bem = row.numeroTombamento ? bemByTomb.get(String(row.numeroTombamento)) : null;
                  const fotoItem = getFotoUrl(row.fotoUrl || bem?.fotoUrl || "");
                  const fotoCatalogo = getFotoUrl(row.fotoReferenciaUrl || bem?.fotoReferenciaUrl || "");
                  const divergence = describeRowDivergence(row);

                  return (
                    <tr key={`${row.fonte}|${row.numeroTombamento || row.identificadorExterno}`}>
                      <td className="px-3 py-3 font-mono text-xs text-slate-900">
                        {row.numeroTombamento || (
                          <span className="font-bold text-rose-700">
                            SEM PLACA
                            <br />
                            <span className="text-[10px] font-normal text-rose-600">{row.identificadorExterno}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-mono text-[11px] text-emerald-700">{row.codigoCatalogo || bem?.codigoCatalogo || "-"}</div>
                        <div className="font-semibold text-slate-800">{row.catalogoDescricao || bem?.catalogoDescricao || "-"}</div>
                        {row.descricaoComplementar ? (
                          <div className="mt-1 whitespace-pre-line text-xs font-medium text-amber-800/90">
                            {row.descricaoComplementar}
                          </div>
                        ) : null}
                        {row.observacoes ? (
                          <div className="mt-1 text-[11px] italic text-slate-500">
                            {row.observacoes}
                          </div>
                        ) : null}
                        {showItemPhoto && fotoItem ? (
                          <div className="mt-2">
                            <a href={fotoItem} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-white px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-slate-100">
                              Ver foto
                            </a>
                          </div>
                        ) : null}
                        {showCatalogPhoto && fotoCatalogo ? (
                          <div className="mt-2">
                            <a href={fotoCatalogo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">
                              Foto catálogo
                            </a>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-slate-800">{formatUnidade(Number(row.unidadeDonaId))}</td>
                      <td className="px-3 py-3 text-amber-800">{formatUnidade(Number(row.unidadeEncontradaId))}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${divergence.badgeClass}`}>
                          {divergence.badge}
                        </span>
                        <div className="mt-1 text-xs text-slate-800">{divergence.title}</div>
                        {divergence.detail ? (
                          <div className="mt-1 text-[11px] text-slate-500">{divergence.detail}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${row.fonte === "SERVIDOR" ? "border-emerald-300/40 bg-emerald-200/10 text-emerald-700" : "border-amber-300/40 bg-amber-200/10 text-amber-800"}`}>
                          {row.fonte}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{row.encontradoEm ? new Date(row.encontradoEm).toLocaleString() : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
