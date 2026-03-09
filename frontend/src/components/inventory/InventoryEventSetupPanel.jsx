/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryEventSetupPanel.jsx
 * Funcao no sistema: renderizar a abertura de novo inventario e as sugestoes de ciclo.
 */
function formatUnidade(id) {
    if (id === 1) return "1 (1a Aud)";
    if (id === 2) return "2 (2a Aud)";
    if (id === 3) return "3 (Foro)";
    if (id === 4) return "4 (Almox)";
    return String(id || "");
}

function formatDiasSemContagemLabel(diasSemContagem) {
    const dias = Number(diasSemContagem);
    if (!Number.isFinite(dias) || dias < 0) return "Sem contagem";
    return `${dias} dias`;
}

export default function InventoryEventSetupPanel({
    onCreateEvento,
    presets,
    applyPreset,
    escopoTipo,
    setEscopoTipo,
    tipoCiclo,
    setTipoCiclo,
    modoContagem,
    setModoContagem,
    operadorUnicoQuery,
    onOperadorUnicoInputChange,
    setOperadorUnicoFocused,
    operadorUnicoFocused,
    operadorUnicoLookup,
    onSelectOperadorUnico,
    operadorUnicoId,
    operadorAQuery,
    onOperadorAInputChange,
    setOperadorAFocused,
    operadorAFocused,
    operadorALookup,
    onSelectOperadorA,
    operadorAId,
    permiteDesempateA,
    setPermiteDesempateA,
    operadorBQuery,
    onOperadorBInputChange,
    setOperadorBFocused,
    operadorBFocused,
    operadorBLookup,
    onSelectOperadorB,
    operadorBId,
    permiteDesempateB,
    setPermiteDesempateB,
    unidadeInventariadaId,
    setUnidadeInventariadaId,
    locaisEscopo,
    escopoLocalIds,
    toggleEscopoLocal,
    isCreating,
    createButtonLabel,
    sugestoesCicloQuery,
    onApplySuggestion,
}) {
    return (
<div className="space-y-4">
            <form onSubmit={onCreateEvento} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div>
                    <p className="text-sm font-semibold text-slate-900">Novo inventário</p>
                    <p className="mt-1 text-xs text-slate-600">Defina o próximo ciclo sem disputar atenção com a operação atual.</p>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {presets.map((preset) => (
                        <button
                            key={preset.key}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>

                <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-xs text-indigo-700">
                    Inventários por UNIDADE e LOCAIS podem rodar em paralelo entre unidades. Inventário GERAL é exclusivo.
                </p>

                <div className="grid gap-4 xl:grid-cols-3">
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Preset e tipo</p>
                            <p className="mt-1 text-xs text-slate-500">Escolha escopo e recorrência.</p>
                        </div>
                        <label className="block space-y-1">
                            <span className="text-xs text-slate-600">Escopo</span>
                            <select value={escopoTipo} onChange={(e) => setEscopoTipo(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                <option value="GERAL">GERAL</option>
                                <option value="UNIDADE">UNIDADE</option>
                                <option value="LOCAIS">LOCAIS</option>
                            </select>
                        </label>
                        {escopoTipo !== "GERAL" ? (
                            <label className="block space-y-1">
                                <span className="text-xs text-slate-600">Tipo de ciclo</span>
                                <select value={tipoCiclo} onChange={(e) => setTipoCiclo(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                    <option value="ADHOC">ADHOC</option>
                                    <option value="SEMANAL">SEMANAL</option>
                                    <option value="MENSAL">MENSAL</option>
                                    <option value="ANUAL">ANUAL</option>
                                </select>
                            </label>
                        ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                                O inventário geral ignora seleção de unidade e de endereços.
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Modo e designação</p>
                            <p className="mt-1 text-xs text-slate-500">Controle os operadores conforme a regra de contagem.</p>
                        </div>
                        <label className="block space-y-1">
                            <span className="text-xs text-slate-600">Modo de contagem</span>
                            <select value={modoContagem} onChange={(e) => setModoContagem(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                <option value="PADRAO">PADRAO</option>
                                <option value="CEGO">CEGO</option>
                                <option value="DUPLO_CEGO">DUPLO_CEGO</option>
                            </select>
                        </label>

                        {modoContagem === "CEGO" ? (
                            <div className="space-y-1">
                                <label className="block space-y-1">
                                    <span className="text-xs text-slate-600">Operador único (buscar por matrícula ou nome)</span>
                                    <div className="relative">
                                        <input
                                            value={operadorUnicoQuery}
                                            onChange={(e) => onOperadorUnicoInputChange(e.target.value)}
                                            onFocus={() => setOperadorUnicoFocused(true)}
                                            onBlur={() => setTimeout(() => setOperadorUnicoFocused(false), 120)}
                                            placeholder="Digite matrícula ou nome do operador"
                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                        />
                                        {operadorUnicoFocused ? (
                                            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                                                {operadorUnicoLookup.loading ? <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p> : null}
                                                {!operadorUnicoLookup.loading && operadorUnicoLookup.error ? (
                                                    <p className="px-3 py-2 text-xs text-rose-700">{operadorUnicoLookup.error}</p>
                                                ) : null}
                                                {!operadorUnicoLookup.loading && !operadorUnicoLookup.error && (operadorUnicoLookup.data || []).length === 0 && String(operadorUnicoQuery || "").trim().length >= 2 ? (
                                                    <p className="px-3 py-2 text-xs text-slate-500">Nenhum perfil encontrado.</p>
                                                ) : null}
                                                {!operadorUnicoLookup.loading && !operadorUnicoLookup.error && (operadorUnicoLookup.data || []).map((perfil) => (
                                                    <button
                                                        key={perfil.id}
                                                        type="button"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => onSelectOperadorUnico(perfil)}
                                                        className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-violet-50"
                                                    >
                                                        <div className="font-semibold text-slate-900">{perfil.nome || "-"}</div>
                                                        <div className="text-slate-600">Matrícula: <span className="font-mono">{perfil.matricula || "-"}</span></div>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </label>
                                <p className="text-[11px] text-slate-500">Digite ao menos 2 caracteres para sugerir. UUID direto também é aceito.</p>
                                {operadorUnicoId ? (
                                    <p className="text-[11px] text-emerald-700">
                                        Operador selecionado: <span className="font-mono">{operadorUnicoId}</span>
                                        {operadorUnicoLookup?.selected?.nome ? ` (${operadorUnicoLookup.selected.nome})` : ""}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}

                        {modoContagem === "DUPLO_CEGO" ? (
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Operador A (matrícula ou nome)</span>
                                        <div className="relative">
                                            <input
                                                value={operadorAQuery}
                                                onChange={(e) => onOperadorAInputChange(e.target.value)}
                                                onFocus={() => setOperadorAFocused(true)}
                                                onBlur={() => setTimeout(() => setOperadorAFocused(false), 120)}
                                                placeholder="Digite matrícula ou nome"
                                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                            />
                                            {operadorAFocused ? (
                                                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                                                    {operadorALookup.loading ? <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p> : null}
                                                    {!operadorALookup.loading && operadorALookup.error ? <p className="px-3 py-2 text-xs text-rose-700">{operadorALookup.error}</p> : null}
                                                    {!operadorALookup.loading && !operadorALookup.error && (operadorALookup.data || []).length === 0 && String(operadorAQuery || "").trim().length >= 2 ? (
                                                        <p className="px-3 py-2 text-xs text-slate-500">Nenhum perfil encontrado.</p>
                                                    ) : null}
                                                    {!operadorALookup.loading && !operadorALookup.error && (operadorALookup.data || []).map((perfil) => (
                                                        <button
                                                            key={perfil.id}
                                                            type="button"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => onSelectOperadorA(perfil)}
                                                            className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-violet-50"
                                                        >
                                                            <div className="font-semibold text-slate-900">{perfil.nome || "-"}</div>
                                                            <div className="text-slate-600">Matrícula: <span className="font-mono">{perfil.matricula || "-"}</span></div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    </label>
                                    {operadorAId ? (
                                        <p className="text-[11px] text-emerald-700">A: <span className="font-mono">{operadorAId}</span>{operadorALookup?.selected?.nome ? ` (${operadorALookup.selected.nome})` : ""}</p>
                                    ) : null}
                                    <label className="flex items-center gap-2 text-xs text-slate-700">
                                        <input type="checkbox" checked={permiteDesempateA} onChange={(e) => setPermiteDesempateA(e.target.checked)} className="h-4 w-4 accent-violet-600" />
                                        Permitir desempate para A
                                    </label>
                                </div>
                                <div className="space-y-2">
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Operador B (matrícula ou nome)</span>
                                        <div className="relative">
                                            <input
                                                value={operadorBQuery}
                                                onChange={(e) => onOperadorBInputChange(e.target.value)}
                                                onFocus={() => setOperadorBFocused(true)}
                                                onBlur={() => setTimeout(() => setOperadorBFocused(false), 120)}
                                                placeholder="Digite matrícula ou nome"
                                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                            />
                                            {operadorBFocused ? (
                                                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                                                    {operadorBLookup.loading ? <p className="px-3 py-2 text-xs text-slate-500">Buscando...</p> : null}
                                                    {!operadorBLookup.loading && operadorBLookup.error ? <p className="px-3 py-2 text-xs text-rose-700">{operadorBLookup.error}</p> : null}
                                                    {!operadorBLookup.loading && !operadorBLookup.error && (operadorBLookup.data || []).length === 0 && String(operadorBQuery || "").trim().length >= 2 ? (
                                                        <p className="px-3 py-2 text-xs text-slate-500">Nenhum perfil encontrado.</p>
                                                    ) : null}
                                                    {!operadorBLookup.loading && !operadorBLookup.error && (operadorBLookup.data || []).map((perfil) => (
                                                        <button
                                                            key={perfil.id}
                                                            type="button"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => onSelectOperadorB(perfil)}
                                                            className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs hover:bg-violet-50"
                                                        >
                                                            <div className="font-semibold text-slate-900">{perfil.nome || "-"}</div>
                                                            <div className="text-slate-600">Matrícula: <span className="font-mono">{perfil.matricula || "-"}</span></div>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                    </label>
                                    {operadorBId ? (
                                        <p className="text-[11px] text-emerald-700">B: <span className="font-mono">{operadorBId}</span>{operadorBLookup?.selected?.nome ? ` (${operadorBLookup.selected.nome})` : ""}</p>
                                    ) : null}
                                    <label className="flex items-center gap-2 text-xs text-slate-700">
                                        <input type="checkbox" checked={permiteDesempateB} onChange={(e) => setPermiteDesempateB(e.target.checked)} className="h-4 w-4 accent-violet-600" />
                                        Permitir desempate para B
                                    </label>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Escopo operacional</p>
                            <p className="mt-1 text-xs text-slate-500">Selecione unidade e, se necessário, endereços-alvo.</p>
                        </div>
                        {escopoTipo !== "GERAL" ? (
                            <label className="block space-y-1">
                                <span className="text-xs text-slate-600">Unidade inventariada</span>
                                <select
                                    value={unidadeInventariadaId}
                                    onChange={(e) => setUnidadeInventariadaId(e.target.value)}
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                >
                                    <option value="">Selecione</option>
                                    <option value="1">{formatUnidade(1)}</option>
                                    <option value="2">{formatUnidade(2)}</option>
                                    <option value="3">{formatUnidade(3)}</option>
                                    <option value="4">{formatUnidade(4)}</option>
                                </select>
                            </label>
                        ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                                O escopo geral cobre a organização inteira e não exige unidade.
                            </div>
                        )}

                        {escopoTipo === "LOCAIS" ? (
                            <div className="space-y-2">
                                <p className="text-xs text-slate-600">Endereços do escopo</p>
                                <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                                    {(locaisEscopo || []).map((l) => (
                                        <label key={l.id} className="flex items-center gap-2 py-1 text-xs text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={escopoLocalIds.includes(String(l.id))}
                                                onChange={() => toggleEscopoLocal(l.id)}
                                                className="h-4 w-4 accent-violet-600"
                                            />
                                            <span>{l.nome}</span>
                                        </label>
                                    ))}
                                    {!(locaisEscopo || []).length ? <p className="text-xs text-slate-500">Nenhum endereço encontrado para a unidade selecionada.</p> : null}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <p className="text-xs text-violet-900">Abra o evento com o escopo correto e mantenha a trilha operacional auditável.</p>
                    <button
                        type="submit"
                        disabled={isCreating}
                        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                        {isCreating ? "Abrindo..." : createButtonLabel}
                    </button>
                </div>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div>
                    <p className="text-sm font-semibold text-slate-900">Sugestões de ciclo</p>
                    <p className="mt-1 text-[11px] text-slate-600">Prioridade por mais tempo sem contagem.</p>
                </div>
                {sugestoesCicloQuery.isLoading ? (
                    <p className="mt-3 text-xs text-slate-500">Carregando sugestões...</p>
                ) : sugestoesCicloQuery.error ? (
                    <p className="mt-3 text-xs text-rose-700">Falha ao carregar sugestões de ciclo.</p>
                ) : (
                    <div className="mt-3 max-h-52 overflow-auto space-y-2">
                        {(sugestoesCicloQuery.data || []).map((s) => (
                            <button
                                key={s.localId}
                                type="button"
                                onClick={() => onApplySuggestion(s)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs hover:bg-slate-100"
                            >
                                <div className="font-semibold text-slate-900">{s.nome}</div>
                                <div className="mt-1 text-slate-600">Unid {s.unidadeId} | {formatDiasSemContagemLabel(s.diasSemContagem)} | bens {s.qtdBensAtivos}</div>
                            </button>
                        ))}
                        {!(sugestoesCicloQuery.data || []).length ? <p className="text-xs text-slate-500">Sem sugestões no momento.</p> : null}
                    </div>
                )}
            </div>
        </div>
    );
}
