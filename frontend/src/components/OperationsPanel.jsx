/**
 * Modulo: frontend/components
 * Arquivo: OperationsPanel.jsx
 * Funcao no sistema: concentrar operacoes de infraestrutura e seguranca do painel administrativo.
 */
import { useAuth } from "../context/AuthContext.jsx";
import AdminHealthPanel from "./AdminHealthPanel.jsx";
import AdminPerfisPanel from "./AdminPerfisPanel.jsx";
import BackupOpsPanel from "./BackupOpsPanel.jsx";
import ImportacoesPanel from "./ImportacoesPanel.jsx";
import LocaisAdminPanel from "./LocaisAdminPanel.jsx";

const SECTION_META = {
  "admin-backup": {
    title: "Backup e Restore",
    description: "Operacoes de snapshot, backup manual e restore com confirmacao por senha ADMIN.",
  },
  "admin-health": {
    title: "Conectividade Backend",
    description: "Validacao operacional de disponibilidade da API e requestId.",
  },
  "admin-perfis": {
    title: "Perfis e Acessos",
    description: "Gestao de perfis, papeis e reset de senha de primeiro acesso.",
  },
  "admin-importacoes-geafin": {
    title: "Importacao GEAFIN (CSV Latin1)",
    description: "Carga operacional e auditavel do GEAFIN com barra de progresso e cancelamento.",
  },
  "admin-locais": {
    title: "Locais (salas) cadastrados",
    description: "CRUD de locais e vinculacao em lote de bens.local_id para governanca de sala.",
  },
};

export default function OperationsPanel({ section = "admin-backup" }) {
  const auth = useAuth();
  const canAdmin = !auth.authEnabled || String(auth.role || "").toUpperCase() === "ADMIN";
  const normalizedSection = SECTION_META[section] ? section : "admin-backup";
  const meta = SECTION_META[normalizedSection];

  return (
    <section className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header>
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Administracao do Painel</h2>
        <p className="mt-2 text-sm text-slate-600">{meta.description}</p>
      </header>

      {normalizedSection === "admin-health" ? <AdminHealthPanel canAdmin={canAdmin} /> : null}
      {normalizedSection === "admin-perfis" ? <AdminPerfisPanel canAdmin={canAdmin} /> : null}
      {normalizedSection === "admin-backup" ? <BackupOpsPanel canAdmin={canAdmin} /> : null}
      {normalizedSection === "admin-importacoes-geafin" ? <ImportacoesPanel canAdmin={canAdmin} /> : null}
      {normalizedSection === "admin-locais" ? <LocaisAdminPanel canAdmin={canAdmin} /> : null}
    </section>
  );
}
