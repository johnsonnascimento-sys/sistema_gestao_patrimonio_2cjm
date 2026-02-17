/**
 * Modulo: frontend
 * Arquivo: App.jsx
 * Funcao no sistema: orquestrar as telas de compliance (wizard, inventario e normas).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AssetsExplorer from "./components/AssetsExplorer.jsx";
import AuthLogin from "./components/AuthLogin.jsx";
import ClassificationWizard from "./components/ClassificationWizard.jsx";
import InventoryRoomPanel from "./components/InventoryRoomPanel.jsx";
import NormsPage from "./components/NormsPage.jsx";
import OperationsPanel from "./components/OperationsPanel.jsx";
import RegularizationPanel from "./components/RegularizationPanel.jsx";
import WikiManual from "./components/WikiManual.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { listarEventosInventario } from "./services/apiClient.js";

function AppShell() {
  const auth = useAuth();
  const [tab, setTab] = useState("bens");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardHistory, setWizardHistory] = useState([]);

  const eventosQuery = useQuery({
    queryKey: ["inventarioEventos", "EM_ANDAMENTO"],
    queryFn: async () => {
      const data = await listarEventosInventario("EM_ANDAMENTO");
      return data.items || [];
    },
  });

  const inventoryStatus = eventosQuery.isLoading
    ? "CARREGANDO"
    : (eventosQuery.data || []).length
      ? "EM_ANDAMENTO"
      : "SEM_EVENTO";
  const activeEventCode = (eventosQuery.data || [])[0]?.codigoEvento || null;

  const bannerMessage = useMemo(() => {
    if (inventoryStatus === "EM_ANDAMENTO") {
      return "Inventário ativo: movimentações de transferência ficam bloqueadas pelo Art. 183 (AN303_Art183).";
    }
    if (inventoryStatus === "CARREGANDO") {
      return "Consultando status do inventário no banco...";
    }
    return "Sem evento ativo: transferências e regularizações podem ser executadas.";
  }, [inventoryStatus]);

  const handleWizardResult = (result) => {
    setWizardHistory((prev) => [{ ...result, id: crypto.randomUUID() }, ...prev].slice(0, 8));
  };

  return (
    <div className="min-h-screen bg-app text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <header className="rounded-3xl border border-white/15 bg-slate-900/60 p-6 shadow-2xl backdrop-blur">
          {auth.perfil && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-xs text-slate-200">
              <div>
                <p className="text-slate-300">Usuário autenticado</p>
                <p className="mt-1 font-semibold text-slate-100">
                  {auth.perfil.nome} ({auth.perfil.matricula})
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2 py-0.5 text-[11px] text-cyan-200">
                  {auth.role || "OPERADOR"}
                </span>
                <button
                  type="button"
                  onClick={auth.logout}
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide hover:bg-white/5"
                >
                  Sair
                </button>
              </div>
            </div>
          )}
          <p className="font-[Space_Grotesk] text-sm uppercase tracking-[0.28em] text-amber-300">
            2a Circunscrição Judiciária Militar
          </p>
          <h1 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-5xl">
            Painel de Patrimônio e Compliance
          </h1>
          <p className="mt-3 max-w-3xl text-slate-200/85">
            Execução determinística para inventário, cautela e transferência com rastreabilidade legal ATN 303/2008.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setTab("bens")}
              className={`pill ${tab === "bens" ? "pill-active" : ""}`}
            >
              Consulta de Bens
            </button>
            <button
              type="button"
              onClick={() => setTab("inventario")}
              className={`pill ${tab === "inventario" ? "pill-active" : ""}`}
            >
              Modo Inventário
            </button>
            <button
              type="button"
              onClick={() => setTab("regularizacao")}
              className={`pill ${tab === "regularizacao" ? "pill-active" : ""}`}
            >
              Regularização
            </button>
            <button
              type="button"
              onClick={() => setTab("classificacao")}
              className={`pill ${tab === "classificacao" ? "pill-active" : ""}`}
            >
              Wizard Art. 141
            </button>
            <button
              type="button"
              onClick={() => setTab("normas")}
              className={`pill ${tab === "normas" ? "pill-active" : ""}`}
            >
              Gestão de Normas
            </button>
            <button
              type="button"
              onClick={() => setTab("operacoes")}
              className={`pill ${tab === "operacoes" ? "pill-active" : ""}`}
            >
              Operações API
            </button>
            <button
              type="button"
              onClick={() => setTab("wiki")}
              className={`pill ${tab === "wiki" ? "pill-active" : ""}`}
            >
              Wiki / Manual
            </button>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-100/10 p-4 text-sm text-amber-100">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold uppercase tracking-wide">Status inventário:</span>
            <span className={`status-chip ${inventoryStatus === "EM_ANDAMENTO" ? "status-live" : "status-closed"}`}>
              {inventoryStatus}
            </span>
            {activeEventCode && (
              <span className="text-xs text-amber-100/80">
                Evento: <span className="font-semibold">{activeEventCode}</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => eventosQuery.refetch()}
              className="rounded-lg border border-amber-200/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-amber-200/20"
            >
              Atualizar
            </button>
          </div>
          <p className="mt-2 text-sm">{bannerMessage}</p>
        </section>

        {tab === "bens" && <AssetsExplorer />}

        {tab === "inventario" && (
          <div className="mt-6">
            <InventoryRoomPanel />
          </div>
        )}

        {tab === "regularizacao" && <RegularizationPanel />}

        {tab === "classificacao" && (
          <section className="mt-6 rounded-2xl border border-white/15 bg-slate-900/55 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Wizard de Classificacao de Danos</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Fluxo guiado para classificar bens inserviveis: Ocioso, Recuperavel, Antieconomico ou Irrecuperavel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="rounded-xl bg-cyan-300 px-4 py-2 font-semibold text-slate-900 hover:bg-cyan-200"
              >
                Iniciar wizard
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {wizardHistory.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/25 p-4 text-sm text-slate-300">
                  Nenhuma classificacao realizada nesta sessao.
                </p>
              )}
              {wizardHistory.map((item) => (
                <article key={item.id} className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
                  <p className="text-xs uppercase tracking-widest text-cyan-200">{item.classificacao}</p>
                  <p className="mt-2 font-medium">{item.descricaoBem}</p>
                  <p className="mt-1 text-xs text-slate-400">Justificativa: {item.justificativa}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "normas" && <NormsPage />}
        {tab === "operacoes" && <OperationsPanel />}
        {tab === "wiki" && <WikiManual />}
      </div>

      <ClassificationWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSave={(result) => {
          handleWizardResult(result);
          setWizardOpen(false);
        }}
      />
    </div>
  );
}

export default function App() {
  const auth = useAuth();

  if (!auth.ready) {
    return (
      <div className="min-h-screen bg-app text-slate-100">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-white/15 bg-slate-900/55 p-6">
            <p className="text-sm text-slate-300">Carregando configuração de acesso...</p>
          </div>
        </div>
      </div>
    );
  }

  if (auth.authEnabled && !auth.isAuthenticated) return <AuthLogin />;

  return <AppShell />;
}
