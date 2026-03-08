/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryRoomUi.jsx
 * Funcao no sistema: componentes visuais compartilhados da tela Inventário - Contagem.
 */
import { useState } from "react";

export function formatModeLabel(mode) {
  const normalized = String(mode || "PADRAO").toUpperCase();
  if (normalized === "DUPLO_CEGO") return "Duplo cego";
  if (normalized === "CEGO") return "Cego";
  return "Padrão";
}

export function ModeBadge({ mode }) {
  const normalized = String(mode || "PADRAO").toUpperCase();
  const cls = normalized === "DUPLO_CEGO"
    ? "border-amber-300 bg-amber-50 text-amber-800"
    : normalized === "CEGO"
      ? "border-orange-300 bg-orange-50 text-orange-800"
      : "border-violet-300 bg-violet-50 text-violet-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {formatModeLabel(normalized)}
    </span>
  );
}

export function StatusBadge({ tone = "slate", children }) {
  const cls = tone === "success"
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : tone === "danger"
        ? "border-rose-300 bg-rose-50 text-rose-700"
        : "border-slate-300 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

export function DisclosureMetaBadge({ tone = "slate", children }) {
  const cls = tone === "danger"
    ? "border-rose-300 bg-rose-50 text-rose-700"
    : tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : tone === "support"
        ? "border-violet-300 bg-violet-50 text-violet-700"
        : tone === "success"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-300 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

export function FilterChipButton({ tone = "slate", active = false, children, onClick }) {
  const activeCls = tone === "danger"
    ? "border-rose-300 bg-rose-100 text-rose-800 shadow-sm"
    : tone === "warning"
      ? "border-amber-300 bg-amber-100 text-amber-900 shadow-sm"
      : tone === "support"
        ? "border-violet-300 bg-violet-100 text-violet-800 shadow-sm"
        : tone === "success"
          ? "border-emerald-300 bg-emerald-100 text-emerald-800 shadow-sm"
          : "border-slate-300 bg-slate-100 text-slate-800 shadow-sm";
  const idleCls = tone === "danger"
    ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
    : tone === "warning"
      ? "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
      : tone === "support"
        ? "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
        : tone === "success"
          ? "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${active ? activeCls : idleCls}`}
    >
      {children}
    </button>
  );
}

export function DisclosureCard({
  title,
  subtitle,
  tone = "neutral",
  defaultOpen = false,
  meta = null,
  children,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const shellCls = tone === "danger"
    ? "border-rose-200 bg-rose-50/40"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50/40"
      : tone === "support"
        ? "border-violet-200 bg-violet-50/30"
        : "border-slate-200 bg-white";
  const iconCls = tone === "danger"
    ? "bg-rose-100 text-rose-700"
    : tone === "warning"
      ? "bg-amber-100 text-amber-800"
      : tone === "support"
        ? "bg-violet-100 text-violet-700"
        : "bg-slate-100 text-slate-600";
  const chevronCls = isOpen ? "rotate-180" : "";

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className={`group rounded-2xl border shadow-sm ${shellCls} ${className}`.trim()}
    >
      <summary className="list-none cursor-pointer select-none p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconCls}`}>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm-.75 4.75a.75.75 0 011.5 0v3.19l2.28 2.28a.75.75 0 11-1.06 1.06L9.47 10.53a.75.75 0 01-.22-.53V6.75z" clipRule="evenodd" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              </div>
              {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {meta ? <div className="flex flex-wrap justify-end gap-2">{meta}</div> : null}
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
              <svg className={`h-4 w-4 transition-transform ${chevronCls}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.514a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        </div>
      </summary>
      <div className="border-t border-slate-200/80 px-4 pb-4 pt-4 md:px-5 md:pb-5">{children}</div>
    </details>
  );
}

export function SectionCard({ title, subtitle = "", accent = "slate", actions = null, children, className = "" }) {
  const accentCls = accent === "violet"
    ? "border-violet-200"
    : accent === "amber"
      ? "border-amber-200"
      : accent === "rose"
        ? "border-rose-200"
        : "border-slate-200";
  return (
    <section className={`rounded-2xl border bg-white p-4 shadow-sm ${accentCls} ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-600">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function InfoLine({ label, value, helper = null, tone = "default" }) {
  const valueCls = tone === "danger"
    ? "text-rose-700"
    : tone === "warn"
      ? "text-amber-800"
      : tone === "success"
        ? "text-emerald-700"
        : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${valueCls}`}>{value}</p>
      {helper ? <p className="mt-1 text-[11px] text-slate-500">{helper}</p> : null}
    </div>
  );
}

export function BlindModeBanner({ mode, roleLabel, rodada }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">Contagem cega em andamento</p>
          <p className="mt-1 text-sm text-amber-900">
            Parte dos painéis foi ocultada para preservar a regra operacional do modo {formatModeLabel(mode)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {roleLabel ? <StatusBadge tone="warn">{roleLabel}</StatusBadge> : null}
          {rodada ? <StatusBadge tone="warn">Rodada {rodada}</StatusBadge> : null}
        </div>
      </div>
    </div>
  );
}
