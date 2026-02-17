/**
 * Modulo: frontend
 * Arquivo: App.jsx
 * Funcao no sistema: orquestrar as telas de compliance (wizard, inventario e normas).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AssetsExplorer from "./components/AssetsExplorer.jsx";
import ClassificationWizard from "./components/ClassificationWizard.jsx";
import InventoryRoomPanel from "./components/InventoryRoomPanel.jsx";
import NormsPage from "./components/NormsPage.jsx";
import OperationsPanel from "./components/OperationsPanel.jsx";
import { listarEventosInventario } from "./services/apiClient.js";

export default function App() {
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
      return "Inventario ativo: movimentacoes de transferencia ficam bloqueadas pelo Art. 183 (AN303_Art183).";
    }
    if (inventoryStatus === "CARREGANDO") {
      return "Consultando status do inventario no banco...";
    }
    return "Sem evento ativo: transferencias e regularizacoes podem ser executadas.";
  }, [inventoryStatus]);

  const handleWizardResult = (result) => {
    setWizardHistory((prev) => [{ ...result, id: crypto.randomUUID() }, ...prev].slice(0, 8));
  };

  return (
    <div className="min-h-screen bg-app text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <header className="rounded-3xl border border-white/15 bg-slate-900/60 p-6 shadow-2xl backdrop-blur">
          <p className="font-[Space_Grotesk] text-sm uppercase tracking-[0.28em] text-amber-300">
            2a Circunscricao Judiciaria Militar
          </p>
          <h1 className="mt-3 font-[Space_Grotesk] text-3xl font-bold md:text-5xl">
            Painel de Patrimonio e Compliance
          </h1>
          <p className="mt-3 max-w-3xl text-slate-200/85">
            Execucao deterministica para inventario, cautela e transferencia com rastreabilidade legal ATN 303/2008.
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
              Modo Inventario
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
              Gestao de Normas
            </button>
            <button
              type="button"
              onClick={() => setTab("operacoes")}
              className={`pill ${tab === "operacoes" ? "pill-active" : ""}`}
            >
              Operacoes API
            </button>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-100/10 p-4 text-sm text-amber-100">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold uppercase tracking-wide">Status inventario:</span>
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
