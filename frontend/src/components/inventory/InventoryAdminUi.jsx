/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryAdminUi.jsx
 * Funcao no sistema: agrupar componentes visuais puros usados pelo cockpit de administracao do inventario.
 */
function semaforoClass(status) {
  if (status === "VERDE") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (status === "AMARELO") return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-rose-300 bg-rose-50 text-rose-700";
}

export function KpiMini({ label, value, tone = "slate" }) {
  const displayValue = typeof value === "number" ? value : String(value ?? "0");
  const toneClass = tone === "amber"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : tone === "orange"
      ? "border-orange-200 bg-orange-50 text-orange-800"
      : tone === "sky"
        ? "border-cyan-200 bg-cyan-50 text-cyan-800"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : tone === "violet"
            ? "border-violet-200 bg-violet-50 text-violet-800"
            : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[11px] font-medium">{label}</p>
      <p className="mt-1 text-lg font-semibold">{displayValue}</p>
    </div>
  );
}

export function StatusBadge({ label, tone = "slate", mono = false }) {
  const toneClass = tone === "amber"
    ? "border-amber-200 bg-amber-50 text-amber-800"
    : tone === "violet"
      ? "border-violet-200 bg-violet-50 text-violet-800"
      : tone === "sky"
        ? "border-cyan-200 bg-cyan-50 text-cyan-800"
        : tone === "emerald"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-full border px-3 py-2 text-xs font-semibold ${toneClass} ${mono ? "font-mono" : ""}`}>
      {label}
    </div>
  );
}

export function InfoLine({ label, value, mono = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-slate-900 ${mono ? "font-mono" : ""}`}>{value || "-"}</p>
    </div>
  );
}

export function CardKpi({ k, v }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] uppercase tracking-widest text-slate-500">{k}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{Number(v || 0)}</p>
    </div>
  );
}

export function KpiSemaforoCard({ titulo, valor, status, tendencia }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-widest text-slate-500">{titulo}</p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${semaforoClass(status)}`}>
          {status || "SEM_DADO"}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{valor}</p>
      {Number.isFinite(tendencia) && (
        <p className={`mt-1 text-[11px] ${tendencia > 0 ? "text-emerald-700" : tendencia < 0 ? "text-rose-700" : "text-slate-500"}`}>
          Semana anterior: {tendencia > 0 ? "+" : ""}{Number(tendencia).toFixed(2)} p.p.
        </p>
      )}
    </div>
  );
}

export function TrendListCard({ title, rows, metricKey, metricLabel }) {
  const list = Array.isArray(rows) ? rows : [];
  const visible = list.slice(-8);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-widest text-slate-500">{title}</p>
      {!visible.length ? (
        <p className="mt-3 text-sm text-slate-600">Sem pontos para o período.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {visible.map((row) => {
            const value = Number(row?.[metricKey] || 0);
            const rotulo = row?.periodo?.rotulo || row?.chave || "-";
            return (
              <div key={`${title}-${row?.chave}`} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                <span className="truncate pr-3 text-slate-600">{rotulo}</span>
                <span className="font-semibold text-slate-900">{metricLabel}: {value.toFixed(2)}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DonutCard({ title, subtitle, total, items }) {
  const safeTotal = Math.max(0, Number(total || 0));
  const safeItems = (items || []).map((item) => ({ ...item, v: Math.max(0, Number(item.v || 0)) }));
  const stops = [];
  let acc = 0;
  for (const item of safeItems) {
    const frac = safeTotal > 0 ? (item.v / safeTotal) * 100 : 0;
    const from = acc;
    const to = acc + frac;
    stops.push(`${item.color} ${from}% ${to}%`);
    acc = to;
  }
  if (acc < 100) stops.push(`#1f2937 ${acc}% 100%`);
  const background = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-widest text-slate-500">{title}</p>
      <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 rounded-full" style={{ background }}>
          <div className="absolute inset-4 grid place-items-center rounded-full border border-slate-200 bg-slate-50 text-center">
            <span className="text-sm font-semibold text-slate-700">{safeTotal}</span>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          {safeItems.map((item) => (
            <div key={item.k} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600">{item.k}</span>
              <span className="font-semibold text-slate-900">{item.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StackedBarCard({ title, subtitle, total, items }) {
  const safeTotal = Math.max(0, Number(total || 0));
  const safeItems = (items || []).map((item) => ({ ...item, v: Math.max(0, Number(item.v || 0)) }));

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-widest text-slate-500">{title}</p>
      <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
      <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-white">
        <div className="flex h-full w-full">
          {safeItems.map((item) => {
            const pct = safeTotal > 0 ? (item.v / safeTotal) * 100 : 0;
            return <div key={item.k} style={{ width: `${pct}%`, backgroundColor: item.color }} />;
          })}
        </div>
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {safeItems.map((item) => (
          <div key={item.k} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600">{item.k}</span>
            </div>
            <span className="font-semibold text-slate-900">{item.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopRoomsCard({ rows }) {
  const list = rows || [];
  const maxDiv = Math.max(1, ...list.map((row) => Number(row?.divergencias || 0)));

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-widest text-slate-500">Top endereços com divergências</p>
      {!list.length ? (
        <p className="mt-3 text-sm text-slate-500">Sem divergências por endereço.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {list.map((row) => {
            const divergencias = Number(row.divergencias || 0);
            const pct = Math.max(3, Math.round((divergencias / maxDiv) * 100));
            return (
              <div key={row.salaEncontrada}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="truncate pr-2 text-slate-600">{row.salaEncontrada}</span>
                  <span className="font-semibold text-slate-900">{divergencias}</span>
                </div>
                <div className="h-2 rounded bg-white">
                  <div className="h-2 rounded bg-violet-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
