/**
 * Modulo: frontend/components/assets
 * Arquivo: AssetsExplorerSearchPanel.jsx
 * Funcao no sistema: renderizar consulta rapida e filtros avancados da Consulta de Bens.
 */
export default function AssetsExplorerSearchPanel({
  filters,
  formError,
  listError,
  listLoading,
  scannerMode,
  setScannerMode,
  setShowScanner,
  showAdvancedFilters,
  setShowAdvancedFilters,
  tipoBusca4Digitos,
  tombamentoInputRef,
  onFiltersChange,
  onTombamentoChange,
  onSubmit,
  onClear,
  onTombamentoInputKeyDown,
  formatUnidade,
  unitOptions,
  statusOptions,
  locaisFiltroOptions,
  locaisFiltroLoading,
  responsavelLookup,
  responsavelInputFocused,
  setResponsavelInputFocused,
  onSelectResponsavelPerfil,
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Consulta rápida</h3>
          <p className="mt-1 text-xs text-slate-600">
            Priorize tombamento, etiqueta de 4 dígitos e câmera. Abra os filtros avançados apenas
            quando precisar refinar a busca.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvancedFilters((prev) => !prev)}
          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
        >
          {showAdvancedFilters ? "Ocultar filtros avançados" : "Mostrar filtros avançados"}
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Tombamento (10) ou Etiqueta (4)</span>
              <input
                ref={tombamentoInputRef}
                value={filters.numeroTombamento}
                onChange={onTombamentoChange}
                onKeyDown={onTombamentoInputKeyDown}
                placeholder="Ex.: 1290001788 ou 2657"
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              {filters.numeroTombamento.length === 4 && (
                <p className="text-[11px] text-slate-500">
                  {tipoBusca4Digitos
                    ? `Busca de 4 dígitos selecionada: ${
                        tipoBusca4Digitos === "antigo"
                          ? "Etiqueta azul antiga"
                          : "Etiqueta nova impressa errada"
                      }.`
                    : "Ao consultar, o sistema vai perguntar se este código é etiqueta azul antiga ou etiqueta nova impressa errada."}
                </p>
              )}
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={scannerMode}
                onChange={(e) => setScannerMode(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="single">Câmera simples</option>
                <option value="continuous">Câmera contínua</option>
              </select>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-200"
              >
                Ler por câmera
              </button>
              <span className="text-[11px] text-slate-500">Enter, Tab ou Ctrl+J executam a consulta.</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Número do material (SKU)</span>
              <input
                value={filters.codigoCatalogo}
                onChange={(e) => onFiltersChange("codigoCatalogo", e.target.value)}
                placeholder="Ex.: 101004470"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>Consulta rápida para tombamento e etiqueta.</p>
              <p>Material (SKU) e demais filtros ficam disponíveis sem perder o contexto atual.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={listLoading}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {listLoading ? "Consultando..." : "Consultar"}
              </button>
              <button
                type="button"
                onClick={onClear}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        {showAdvancedFilters ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-slate-900">Filtros avançados</h4>
              <p className="mt-1 text-xs text-slate-600">
                Texto livre, unidade, endereço, responsável e status para refinar a busca operacional.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-slate-600">Texto na descrição</span>
                <input
                  value={filters.q}
                  onChange={(e) => onFiltersChange("q", e.target.value)}
                  placeholder="Ex.: ARMÁRIO, PROJETOR, NOTEBOOK"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-600">Unidade</span>
                <select
                  value={filters.unidadeDonaId}
                  onChange={(e) => onFiltersChange("unidadeDonaId", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {unitOptions.map((u) => (
                    <option key={u || "all"} value={u}>
                      {u ? formatUnidade(Number(u)) : "Todas"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs text-slate-600">Status</span>
                <select
                  value={filters.status}
                  onChange={(e) => onFiltersChange("status", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {statusOptions.map((s) => (
                    <option key={s || "all"} value={s}>
                      {s || "Todos"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-slate-600">Endereço (local cadastrado)</span>
                <select
                  value={filters.localId}
                  onChange={(e) => onFiltersChange("localId", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Todos os endereços</option>
                  {locaisFiltroOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {`${l.nome}${l.unidadeId ? ` (${formatUnidade(Number(l.unidadeId))})` : ""}`}
                    </option>
                  ))}
                </select>
                {locaisFiltroLoading ? (
                  <p className="text-[11px] text-slate-500">Carregando endereços...</p>
                ) : null}
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-slate-600">Responsável (matrícula)</span>
                <div className="relative">
                  <input
                    value={filters.responsavel}
                    onFocus={() => setResponsavelInputFocused(true)}
                    onBlur={() => window.setTimeout(() => setResponsavelInputFocused(false), 120)}
                    onChange={(e) => onFiltersChange("responsavel", e.target.value, { clearPerfil: true })}
                    placeholder="Digite matrícula ou nome do responsável"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                  {responsavelInputFocused ? (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {responsavelLookup.loading ? (
                        <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p>
                      ) : null}
                      {!responsavelLookup.loading && responsavelLookup.error ? (
                        <p className="px-3 py-2 text-xs text-rose-700">{responsavelLookup.error}</p>
                      ) : null}
                      {!responsavelLookup.loading &&
                      !responsavelLookup.error &&
                      responsavelLookup.data.length === 0 &&
                      String(filters.responsavel || "").trim().length >= 2 ? (
                        <p className="px-3 py-2 text-xs text-slate-500">Nenhum responsável encontrado.</p>
                      ) : null}
                      {!responsavelLookup.loading &&
                        !responsavelLookup.error &&
                        responsavelLookup.data.map((perfil) => (
                          <button
                            key={perfil.id}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              onSelectResponsavelPerfil(perfil);
                            }}
                            className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-violet-50"
                          >
                            <p className="font-semibold text-slate-900">{perfil.nome || "-"}</p>
                            <p className="mt-0.5 text-slate-600">
                              Matrícula: <span className="font-mono">{perfil.matricula || "-"}</span>
                            </p>
                          </button>
                        ))}
                    </div>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500">Filtro por responsável patrimonial (matrícula/nome).</p>
              </label>
            </div>
          </div>
        ) : null}
      </form>

      {formError && <p className="mt-3 text-sm text-rose-700">{formError}</p>}
      {listError && <p className="mt-3 text-sm text-rose-700">{listError}</p>}
    </article>
  );
}
