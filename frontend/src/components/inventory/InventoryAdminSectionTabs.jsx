/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryAdminSectionTabs.jsx
 * Funcao no sistema: renderizar a navegacao local entre os submenus de Inventario - Administracao.
 */
import { INVENTORY_ADMIN_SECTIONS } from "./InventoryAdminSections.js";

export default function InventoryAdminSectionTabs({ currentSectionKey, onSelectSection = null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Submenus do inventário</p>
          <p className="mt-1 text-sm text-slate-600">
            Separe a operação entre administração do ciclo, monitoramento, acuracidade e regularização.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {INVENTORY_ADMIN_SECTIONS.map((section) => {
          const active = section.key === currentSectionKey;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onSelectSection?.(section)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "border-violet-300 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {section.localLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
