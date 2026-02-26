/**
 * Modulo: frontend/components
 * Arquivo: AuditoriaLogsPanel.jsx
 * Funcao no sistema: centralizar visualizacao de logs e auditoria em modulo proprio.
 */
import ChangeLogPanel from "./ChangeLogPanel.jsx";
import PatrimonioAuditPanel from "./PatrimonioAuditPanel.jsx";
import RuntimeErrorLogPanel from "./RuntimeErrorLogPanel.jsx";

const SECTION_META = {
  "auditoria-changelog": {
    title: "Log Geral de Alteracoes",
    description: "Trilha de alteracoes de projeto com comando de reversao.",
  },
  "auditoria-patrimonio": {
    title: "Auditoria Patrimonial (Global)",
    description: "Trilha operacional de alteracoes de bens/catalogo/movimentacoes.",
  },
  "auditoria-erros": {
    title: "Log de Erros Runtime",
    description: "Falhas recentes da API com requestId para correlacao.",
  },
};

export default function AuditoriaLogsPanel({ canAdmin, section = "auditoria-changelog" }) {
  const meta = SECTION_META[section] || SECTION_META["auditoria-changelog"];

  return (
    <section className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Auditoria e Logs</h2>
        <p className="mt-2 text-sm text-slate-600">
          {meta.title}: {meta.description}
        </p>
      </header>

      {section === "auditoria-patrimonio" ? (
        <PatrimonioAuditPanel canAdmin={canAdmin} />
      ) : null}
      {section === "auditoria-erros" ? (
        <RuntimeErrorLogPanel canAdmin={canAdmin} />
      ) : null}
      {section !== "auditoria-patrimonio" && section !== "auditoria-erros" ? (
        <ChangeLogPanel />
      ) : null}
    </section>
  );
}
