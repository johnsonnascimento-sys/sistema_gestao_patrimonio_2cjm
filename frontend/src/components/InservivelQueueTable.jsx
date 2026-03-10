/**
 * Modulo: frontend/components
 * Arquivo: InservivelQueueTable.jsx
 * Funcao no sistema: listar a fila de bens potencialmente inserviveis e permitir acoes operacionais.
 */
const TIPOS = ["", "OCIOSO", "RECUPERAVEL", "ANTIECONOMICO", "IRRECUPERAVEL"];
const DESTINACOES = ["", "VENDA", "CESSAO", "DOACAO", "PERMUTA", "INUTILIZACAO", "ABANDONO"];
const STATUS = ["", "MARCADO_TRIAGEM", "AGUARDANDO_DESTINACAO", "EM_PROCESSO_BAIXA", "RETIRADO_FILA", "BAIXADO"];
const UNIDADES = ["", "1", "2", "3", "4"];

function formatDateTime(value) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("pt-BR");
}

export default function InservivelQueueTable({
  filters,
  onFilterChange,
  items,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onReevaluate,
  onAttachEvidence,
  onRemove,
  canEdit,
}) {
  const allChecked = items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fila de candidatos</p>
          <h3 className="mt-2 font-[Space_Grotesk] text-2xl font-semibold text-slate-900">
            Marcados para triagem e baixa
          </h3>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{selectedIds.length}</span> selecionado(s)
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-6">
        <input
          value={filters.q}
          onChange={(event) => onFilterChange("q", event.target.value)}
          placeholder="Buscar por tombo, descrição ou local"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
        />
        <select
          value={filters.unidadeDonaId}
          onChange={(event) => onFilterChange("unidadeDonaId", event.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          {UNIDADES.map((item) => (
            <option key={item || "unidade"} value={item}>
              {item ? `Unidade ${item}` : "Todas as unidades"}
            </option>
          ))}
        </select>
        <select
          value={filters.tipoInservivel}
          onChange={(event) => onFilterChange("tipoInservivel", event.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          {TIPOS.map((item) => (
            <option key={item || "todos"} value={item}>
              {item || "Todas as classes"}
            </option>
          ))}
        </select>
        <select
          value={filters.destinacaoSugerida}
          onChange={(event) => onFilterChange("destinacaoSugerida", event.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          {DESTINACOES.map((item) => (
            <option key={item || "dest"} value={item}>
              {item || "Todas as destinações"}
            </option>
          ))}
        </select>
        <select
          value={filters.statusFluxo}
          onChange={(event) => onFilterChange("statusFluxo", event.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          {STATUS.map((item) => (
            <option key={item || "status"} value={item}>
              {item || "Todos os status"}
            </option>
          ))}
        </select>
        <input
          value={filters.localFisico}
          onChange={(event) => onFilterChange("localFisico", event.target.value)}
          placeholder="Filtrar local"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
              <th className="px-2 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(event) => onToggleSelectAll(event.target.checked)}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="px-2 py-3">Bem</th>
              <th className="px-2 py-3">Classe</th>
              <th className="px-2 py-3">Destinação</th>
              <th className="px-2 py-3">Status</th>
              <th className="px-2 py-3">Última avaliação</th>
              <th className="px-2 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-2 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => onToggleSelect(item, event.target.checked)}
                    aria-label={`Selecionar ${item.numeroTombamento}`}
                  />
                </td>
                <td className="px-2 py-3">
                  <p className="font-semibold text-slate-900">{item.numeroTombamento}</p>
                  <p className="mt-1 text-slate-700">{item.catalogoDescricao}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Unidade {item.unidadeDonaId} • {item.localFisico || "Local não informado"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                      Art. 141
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                      Art. 154
                    </span>
                  </div>
                </td>
                <td className="px-2 py-3">
                  <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
                    {item.tipoInservivel}
                  </span>
                </td>
                <td className="px-2 py-3">{item.destinacaoSugerida || "-"}</td>
                <td className="px-2 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {item.statusFluxo}
                  </span>
                </td>
                <td className="px-2 py-3">
                  <p>{formatDateTime(item.avaliadoEm || item.marcadoEm)}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.totalEvidencias || 0} evidência(s)</p>
                </td>
                <td className="px-2 py-3">
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => onReevaluate(item)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Reavaliar / histórico
                    </button>
                    <button
                      type="button"
                      onClick={() => onAttachEvidence(item)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Anexar evidência
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(item)}
                      disabled={!canEdit}
                      className="rounded-xl border border-rose-200 px-3 py-2 text-left text-xs font-semibold text-rose-700 disabled:opacity-40"
                    >
                      Retirar da fila
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-8 text-center text-sm text-slate-500">
                  Nenhum bem marcado com os filtros informados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
