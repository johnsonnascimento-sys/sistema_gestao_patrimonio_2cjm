/**
 * Modulo: frontend/components
 * Arquivo: ChangeLogPanel.jsx
 * Funcao no sistema: exibir visualmente o log geral de alteracoes e o modo de reversao no sistema.
 */
import { useMemo, useState } from "react";
import { changeLogEntries, changeLogGeneratedAt } from "../wiki/changeLog.generated.js";

function normalizeText(raw) {
  return String(raw || "").trim();
}

function formatUtcLabel(raw) {
  const text = normalizeText(raw);
  if (!text) return "-";

  // Aceita "YYYY-MM-DD HH:mm:ss UTC" sem depender do locale do navegador.
  const normalized = text.endsWith(" UTC")
    ? `${text.slice(0, -4).replace(" ", "T")}Z`
    : text;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return text;
  return `${date.toLocaleString("pt-BR", { timeZone: "UTC" })} UTC`;
}

async function copyToClipboard(value) {
  try {
    if (!value) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function ChangeLogPanel() {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState("");

  const entries = Array.isArray(changeLogEntries) ? changeLogEntries : [];
  const filtered = useMemo(() => {
    const q = normalizeText(query).toLowerCase();
    if (!q) return entries;
    return entries.filter((row) =>
      [row.id, row.dataHoraUTC, row.usuario, row.tipo, row.branch, row.commit, row.detalhe, row.reversaoSugerida]
        .map((v) => normalizeText(v).toLowerCase())
        .join(" ")
        .includes(q)
    );
  }, [entries, query]);

  const lastUpdate = formatUtcLabel(changeLogGeneratedAt);
  const total = entries.length;
  const totalFiltered = filtered.length;
  const rollbackReady = entries.filter((row) => normalizeText(row.reversaoSugerida) !== "").length;

  const onCopy = async (label, value) => {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Log Geral de Alteracoes</h3>
          <p className="mt-1 text-xs text-slate-600">
            Registro visual das alteracoes com autor, data/hora UTC, detalhe e comando de reversao.
          </p>
        </div>
        <div className="text-right text-[11px] text-slate-500">
          <p>Total: <span className="font-semibold text-slate-700">{total}</span></p>
          <p>Filtrado: <span className="font-semibold text-slate-700">{totalFiltered}</span></p>
          <p>Rollback: <span className="font-semibold text-slate-700">{rollbackReady}</span></p>
          <p className="mt-1">Atualizado em {lastUpdate}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por usuario, commit, tipo, detalhe..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
        />
        {copied ? (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            Copiado: {copied}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Dica: copie commit/reversao com um clique.
          </div>
        )}
      </div>

      <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-3 py-2">Data/Hora (UTC)</th>
              <th className="px-3 py-2">Usuario</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Commit</th>
              <th className="px-3 py-2">Detalhe</th>
              <th className="px-3 py-2">Reversao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filtered.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">{formatUtcLabel(row.dataHoraUTC)}</td>
                <td className="px-3 py-2 text-slate-700">{normalizeText(row.usuario) || "-"}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
                    {normalizeText(row.tipo) || "-"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-700">
                      {normalizeText(row.commit) || "-"}
                    </code>
                    {normalizeText(row.commit) ? (
                      <button
                        type="button"
                        onClick={() => onCopy("commit", normalizeText(row.commit))}
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Copiar
                      </button>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-700">{normalizeText(row.detalhe) || "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-700">
                      {normalizeText(row.reversaoSugerida) || "-"}
                    </code>
                    {normalizeText(row.reversaoSugerida) ? (
                      <button
                        type="button"
                        onClick={() => onCopy("reversao", normalizeText(row.reversaoSugerida))}
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Copiar
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-600" colSpan={6}>
                  Nenhuma entrada encontrada para o filtro informado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}
