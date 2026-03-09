/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryExpectedAssetsPanel.jsx
 * Funcao no sistema: renderizar o painel de bens esperados do endereco na contagem.
 */
import { DisclosureCard, DisclosureMetaBadge, FilterChipButton } from "./InventoryRoomUi.jsx";

export default function InventoryExpectedAssetsPanel({
  expectedAssetsFilter,
  setExpectedAssetsFilter,
  totalEsperadosEndereco,
  totalConferidosEndereco,
  totalFaltantesEndereco,
  bensSalaItems,
  bensSalaLoading,
  bensSalaError,
  showItemPhotoList,
  setShowItemPhotoList,
  showCatalogPhotoList,
  setShowCatalogPhotoList,
  isOnline,
  salaEncontrada,
  filteredGrouped,
  foundSet,
  getConferenciaMeta,
  formatUnidade,
  getFotoUrl,
}) {
  const hasItems = bensSalaItems.length > 0;

  return (
    <DisclosureCard
      title="Bens esperados do endereço"
      subtitle="Lista agrupada para apoio à conferência."
      tone="support"
      meta={[
        <FilterChipButton
          key="esperados"
          tone="support"
          active={expectedAssetsFilter === "ALL"}
          onClick={() => setExpectedAssetsFilter("ALL")}
        >
          Esperados {totalEsperadosEndereco}
        </FilterChipButton>,
        <FilterChipButton
          key="conferidos"
          tone="success"
          active={expectedAssetsFilter === "FOUND"}
          onClick={() => setExpectedAssetsFilter("FOUND")}
        >
          Conferidos {totalConferidosEndereco}
        </FilterChipButton>,
        <FilterChipButton
          key="faltantes"
          tone={totalFaltantesEndereco ? "warning" : "neutral"}
          active={expectedAssetsFilter === "MISSING"}
          onClick={() => setExpectedAssetsFilter("MISSING")}
        >
          Faltantes {totalFaltantesEndereco}
        </FilterChipButton>,
        bensSalaLoading ? <DisclosureMetaBadge key="loading" tone="neutral">Carregando</DisclosureMetaBadge> : null,
      ].filter(Boolean)}
      className="mt-5"
    >
      <div className="rounded-xl border border-violet-200 bg-slate-50 p-4">
        <div>
          <p className="text-xs text-slate-600">
            Itens carregados: <span className="font-semibold text-slate-900">{bensSalaItems.length}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showItemPhotoList}
                onChange={(e) => setShowItemPhotoList(e.target.checked)}
                className="h-4 w-4 accent-violet-600"
              />
              Mostrar foto do item
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={showCatalogPhotoList}
                onChange={(e) => setShowCatalogPhotoList(e.target.checked)}
                className="h-4 w-4 accent-violet-600"
              />
              Mostrar foto do catálogo
            </label>
          </div>
        </div>

        {!isOnline ? (
          <p className="mt-2 text-[11px] text-slate-500">
            fonte: <span className="font-semibold text-slate-800">CACHE (offline)</span>
          </p>
        ) : null}

        {bensSalaError ? (
          <p className="mt-3 text-sm text-rose-700">Falha ao carregar bens para este local.</p>
        ) : null}

        {!bensSalaLoading && !hasItems ? (
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm text-slate-800">
              Nenhum bem vinculado ao local <span className="font-semibold text-slate-900">"{String(salaEncontrada || "").trim()}"</span>.
            </p>
            <p className="text-xs text-slate-500">
              Aqui o inventário usa <code className="px-1">bens.local_id</code> (local cadastrado pelo Admin), não o texto do GEAFIN.
              Para aparecerem itens, um Admin deve vincular os bens a este local.
            </p>
          </div>
        ) : null}

        {hasItems ? (
          <p className="mt-3 text-xs text-slate-600">
            Filtro ativo:{" "}
            <span className="font-semibold text-slate-900">
              {expectedAssetsFilter === "FOUND"
                ? "Conferidos"
                : expectedAssetsFilter === "MISSING"
                  ? "Faltantes"
                  : "Esperados"}
            </span>
          </p>
        ) : null}

        <div className="mt-3 space-y-2">
          {filteredGrouped.length === 0 && hasItems ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
              Nenhum item encontrado para o filtro selecionado neste endereço.
            </div>
          ) : null}

          {filteredGrouped.map((group) => (
            <details key={group.catalogoBemId} className="rounded-xl border border-slate-200 bg-white p-3">
              {(() => {
                const total = group.items.length;
                const encontrados = group.items.reduce((acc, item) => acc + (foundSet.has(item.numeroTombamento) ? 1 : 0), 0);
                const faltantes = Math.max(0, total - encontrados);
                const divergentes = group.items.reduce((acc, item) => {
                  const meta = getConferenciaMeta(item);
                  return acc + (meta.encontrado && meta.divergente ? 1 : 0);
                }, 0);

                return (
                  <summary className="cursor-pointer select-none">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-900">
                      <div className="flex flex-col">
                        <span>{group.items[0]?.nomeResumo || group.catalogoDescricao}</span>
                        {group.items[0]?.nomeResumo && group.items[0]?.nomeResumo !== group.catalogoDescricao ? (
                          <span className="text-[10px] font-normal italic text-slate-500">{group.catalogoDescricao}</span>
                        ) : null}
                      </div>
                      <span className="ml-auto text-xs font-normal text-slate-600">
                        Total: <span className="font-semibold text-slate-900">{total}</span>{" "}
                        | Encontrados: <span className="font-semibold text-emerald-700">{encontrados}</span>{" "}
                        | Divergentes: <span className="font-semibold text-rose-700">{divergentes}</span>{" "}
                        | Faltantes: <span className="font-semibold text-amber-800">{faltantes}</span>
                      </span>
                    </div>
                  </summary>
                );
              })()}

              <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
                <ul className="divide-y divide-slate-200 bg-slate-50">
                  {group.items.slice(0, 200).map((item) => {
                    const meta = getConferenciaMeta(item);
                    const badge = meta.encontrado
                      ? meta.divergente
                        ? { text: "LOCAL_DIVERGENTE", cls: "border-rose-300/40 text-rose-700 bg-rose-200/10" }
                        : { text: "ENCONTRADO", cls: "border-emerald-300/40 text-emerald-700 bg-emerald-200/10" }
                      : { text: "FALTANTE", cls: "border-amber-300/40 text-amber-800 bg-amber-200/10" };

                    return (
                      <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={meta.encontrado}
                            readOnly
                            className="h-4 w-4 accent-violet-600"
                            title={meta.encontrado ? `Conferido (${meta.fonte})` : "Não conferido"}
                          />
                          <div className="flex flex-col items-start gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-900">{item.numeroTombamento || "-"}</span>
                              {item.cod2Aud ? (
                                <span className="rounded border border-violet-300/40 bg-violet-100 px-1 py-0.5 text-[9px] font-bold text-violet-700" title={`Etiqueta Azul: ${item.cod2Aud}`}>
                                  {item.cod2Aud}
                                </span>
                              ) : null}
                            </div>
                            <span className="text-[10px] leading-tight text-slate-500">
                              {formatUnidade(Number(item.unidadeDonaId))} • {item.nomeResumo || "Sem resumo"}
                            </span>
                            {showItemPhotoList || showCatalogPhotoList ? (
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                {showItemPhotoList ? (
                                  item.fotoUrl ? (
                                    <a href={getFotoUrl(item.fotoUrl)} target="_blank" rel="noopener noreferrer">
                                      <img
                                        src={getFotoUrl(item.fotoUrl)}
                                        alt={`Foto item ${item.numeroTombamento || ""}`}
                                        className="h-10 w-10 rounded border border-slate-300 object-cover"
                                      />
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">Item sem foto</span>
                                  )
                                ) : null}
                                {showCatalogPhotoList ? (
                                  item.fotoReferenciaUrl ? (
                                    <a href={getFotoUrl(item.fotoReferenciaUrl)} target="_blank" rel="noopener noreferrer">
                                      <img
                                        src={getFotoUrl(item.fotoReferenciaUrl)}
                                        alt={`Foto catalogo ${item.codigoCatalogo || ""}`}
                                        className="h-10 w-10 rounded border border-slate-300 object-cover"
                                      />
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">Catálogo sem foto</span>
                                  )
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </label>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badge.cls}`}>
                          {badge.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          ))}
        </div>
      </div>
    </DisclosureCard>
  );
}
