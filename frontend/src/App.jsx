/**
 * Modulo: frontend
 * Arquivo: App.jsx
 * Funcao no sistema: orquestrar as telas de compliance (wizard, inventario e normas).
 */
import { Component, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import AssetsExplorer from "./components/AssetsExplorer.jsx";
import AuthLogin from "./components/AuthLogin.jsx";
import ClassificationWizard from "./components/ClassificationWizard.jsx";
import InventoryRoomPanel from "./components/InventoryRoomPanel.jsx";
import InventoryAdminPanel from "./components/InventoryAdminPanel.jsx";
import MovimentacoesPanel from "./components/MovimentacoesPanel.jsx";
import NormsPage from "./components/NormsPage.jsx";
import OperationsPanel from "./components/OperationsPanel.jsx";
import WikiManual from "./components/WikiManual.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import {
  criarAvaliacaoInservivel,
  criarDocumento,
  listarAvaliacoesInservivel,
  listarBens,
  listarEventosInventario,
} from "./services/apiClient.js";

const NAV_ITEMS = [
  { id: "bens", label: "Consulta de Bens", short: "Bens" },
  { id: "inventario-contagem", label: "Inventario - Contagem", short: "Contagem" },
  { id: "inventario-admin", label: "Inventario - Administracao", short: "Admin" },
  { id: "movimentacoes", label: "Movimentacoes", short: "Mov." },
  { id: "classificacao", label: "Wizard Art. 141", short: "Art. 141" },
  { id: "normas", label: "Gestao de Normas", short: "Normas" },
  { id: "operacoes", label: "Administracao do Painel", short: "Painel" },
  { id: "wiki", label: "Wiki / Manual", short: "Wiki" },
];

function NavIcon({ id }) {
  const cls = "h-4 w-4";

  if (id === "bens") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }

  if (id === "inventario-contagem") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 6h10" />
        <path d="M4 12h10" />
        <path d="M4 18h10" />
        <path d="M17 12l2 2 3-4" />
      </svg>
    );
  }

  if (id === "inventario-admin") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    );
  }

  if (id === "movimentacoes") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h12" />
        <path d="m13 4 3 3-3 3" />
        <path d="M20 17H8" />
        <path d="m11 14-3 3 3 3" />
      </svg>
    );
  }

  if (id === "classificacao") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 6h16" />
        <path d="M8 12h8" />
        <path d="M10 18h4" />
      </svg>
    );
  }

  if (id === "normas") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 4h9a3 3 0 0 1 3 3v13H9a3 3 0 0 0-3 3V4z" />
        <path d="M6 4v16" />
      </svg>
    );
  }

  if (id === "operacoes") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    );
  }

  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 5h14v14H5z" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
    </svg>
  );
}

class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: String(error?.message || "Erro interno na renderizacao desta secao."),
    };
  }

  componentDidCatch(error, info) {
    console.error("SectionErrorBoundary:", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-800">
          <p>Falha ao renderizar esta secao.</p>
          {this.state.errorMessage ? (
            <p className="break-words text-xs text-rose-700">Detalhe tecnico: {this.state.errorMessage}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold hover:bg-rose-100"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold hover:bg-rose-100"
            >
              Recarregar pagina
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppShell() {
  const auth = useAuth();
  const [tab, setTab] = useState("bens");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardBemTombo, setWizardBemTombo] = useState("");
  const [wizardBem, setWizardBem] = useState(null);
  const [wizardPersistMsg, setWizardPersistMsg] = useState(null);
  const [wizardPersistErr, setWizardPersistErr] = useState(null);
  const [wizardLastAvaliacao, setWizardLastAvaliacao] = useState(null);
  const [wizardDocUrl, setWizardDocUrl] = useState("");
  const [wizardDocMsg, setWizardDocMsg] = useState(null);
  const [wizardDocErr, setWizardDocErr] = useState(null);

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

  

  const bannerTone = useMemo(() => {
    if (inventoryStatus === "EM_ANDAMENTO") {
      return {
        wrapper: "border-amber-300 bg-amber-50 text-amber-900",
        meta: "text-amber-900/80",
      };
    }
    if (inventoryStatus === "CARREGANDO") {
      return {
        wrapper: "border-slate-300 bg-slate-100 text-slate-700",
        meta: "text-slate-600",
      };
    }
    return {
      wrapper: "border-emerald-300 bg-emerald-50 text-emerald-900",
      meta: "text-emerald-900/80",
    };
  }, [inventoryStatus]);

  const activeTabMeta = useMemo(
    () => NAV_ITEMS.find((item) => item.id === tab) || NAV_ITEMS[0],
    [tab],
  );

  const wizardAvaliacoesQuery = useQuery({
    queryKey: ["inserviveisAvaliacoes", wizardBem?.id || null],
    enabled: Boolean(wizardBem?.id),
    queryFn: async () => {
      const data = await listarAvaliacoesInservivel(wizardBem.id);
      return data.items || [];
    },
  });

  const wizardDocumentoMut = useMutation({
    mutationFn: async () => {
      const avaliacaoId = wizardLastAvaliacao?.id ? String(wizardLastAvaliacao.id) : "";
      if (!avaliacaoId) throw new Error("Nenhuma avaliacao selecionada para anexar evidencia.");
      const driveUrl = String(wizardDocUrl || "").trim();
      if (!driveUrl) throw new Error("Informe a URL do Drive.");

      // Regra legal: evidencias do processo de inserviveis devem ser auditaveis.
      // Art. 141 (AN303_Art141_Cap / AN303_Art141_I / AN303_Art141_II / AN303_Art141_III / AN303_Art141_IV).
      return criarDocumento({
        tipo: "OUTRO",
        titulo: "Evidencia - Avaliacao de inservivel (Art. 141)",
        avaliacaoInservivelId: avaliacaoId,
        driveUrl,
        observacoes: `Wizard Art. 141: tipo=${wizardLastAvaliacao?.tipoInservivel || "?"}`,
      });
    },
    onSuccess: () => {
      setWizardDocMsg("Evidencia anexada (Drive).");
      setWizardDocErr(null);
      setWizardDocUrl("");
    },
    onError: (e) => {
      setWizardDocErr(String(e?.message || "Falha ao anexar evidencia."));
      setWizardDocMsg(null);
    },
  });

  const loadBemByTombo = async () => {
    setWizardPersistMsg(null);
    setWizardPersistErr(null);
    setWizardBem(null);
    setWizardLastAvaliacao(null);
    setWizardDocUrl("");
    setWizardDocMsg(null);
    setWizardDocErr(null);

    const tombo = String(wizardBemTombo || "").trim();
    if (!/^\d{10}$/.test(tombo)) {
      setWizardPersistErr("Informe um tombamento GEAFIN com 10 digitos.");
      return;
    }

    try {
      const data = await listarBens({ numeroTombamento: tombo, limit: 1, offset: 0 });
      const it = (data.items || [])[0] || null;
      if (!it) {
        setWizardPersistErr("Bem nao encontrado para este tombamento.");
        return;
      }
      setWizardBem(it);
    } catch (e) {
      setWizardPersistErr(String(e?.message || "Falha ao buscar bem."));
    }
  };

  return (
    <div className="min-h-screen bg-app text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="border-b border-slate-200 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">2a CJM</p>
            <h1 className="mt-2 font-[Space_Grotesk] text-2xl font-semibold text-slate-900">Patrimonio</h1>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                    active
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[12px]">
                    <NavIcon id={item.id} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 md:px-8">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Painel Institucional</p>
                <h2 className="truncate font-[Space_Grotesk] text-xl font-semibold text-slate-900">{activeTabMeta.label}</h2>
              </div>
              <div className="flex items-center gap-2">
                {auth.perfil ? (
                  <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 md:flex">
                    <div className="min-w-0 text-right">
                      <p className="max-w-[220px] truncate text-xs font-semibold text-slate-900">{auth.perfil.nome}</p>
                      <p className="text-[11px] text-slate-500">{auth.perfil.matricula}</p>
                    </div>
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                      {auth.role || "OPERADOR"}
                    </span>
                    <button
                      type="button"
                      onClick={auth.logout}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Sair
                    </button>
                  </div>
                ) : null}
                {auth.perfil ? (
                  <button
                    type="button"
                    onClick={auth.logout}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 md:hidden"
                  >
                    Sair
                  </button>
                ) : null}
                <span className={`status-chip ${inventoryStatus === "EM_ANDAMENTO" ? "status-live" : "status-closed"}`}>
                  {inventoryStatus}
                </span>
                <button
                  type="button"
                  onClick={() => eventosQuery.refetch()}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 bg-slate-50">
            <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
              <section className={`mb-6 rounded-2xl border p-4 text-sm ${bannerTone.wrapper}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold uppercase tracking-wide">Status inventario:</span>
                  <span className={`status-chip ${inventoryStatus === "EM_ANDAMENTO" ? "status-live" : "status-closed"}`}>
                    {inventoryStatus}
                  </span>
                  {activeEventCode && (
                    <span className={`text-xs ${bannerTone.meta}`}>
                      Evento: <span className="font-semibold">{activeEventCode}</span>
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm">{bannerMessage}</p>
              </section>

              <section className="mb-6 md:hidden">
                <div className="overflow-x-auto">
                  <div className="flex min-w-max gap-2 rounded-2xl border border-slate-200 bg-white p-2">
                    {NAV_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                          tab === item.id
                            ? "bg-violet-50 text-violet-700"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {item.short}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {tab === "bens" && <AssetsExplorer />}

              {tab === "inventario-contagem" && (
                <SectionErrorBoundary>
                  <InventoryRoomPanel />
                </SectionErrorBoundary>
              )}

              {tab === "inventario-admin" && <InventoryAdminPanel />}

              {tab === "movimentacoes" && <MovimentacoesPanel />}

              {tab === "classificacao" && (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-[Space_Grotesk] text-2xl font-semibold text-slate-900">Wizard de Classificacao de Danos</h2>
                      <p className="mt-2 text-sm text-slate-600">
                        Fluxo guiado para classificar bens inserviveis: Ocioso, Recuperavel, Antieconomico ou Irrecuperavel.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Selecao do bem (obrigatorio)</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input
                          value={wizardBemTombo}
                          onChange={(e) => setWizardBemTombo(e.target.value.replace(/\D+/g, "").slice(0, 10))}
                          placeholder="Tombamento (10 digitos)"
                          inputMode="numeric"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={loadBemByTombo}
                          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Carregar bem
                        </button>
                      </div>

                      {wizardBem ? (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                          <p className="font-semibold text-slate-900">{wizardBem.catalogoDescricao}</p>
                          <p className="mt-1 text-xs text-slate-600">
                            Tombo: <span className="font-mono">{wizardBem.numeroTombamento}</span> | Unidade: {wizardBem.unidadeDonaId} | Local: {wizardBem.localFisico}
                          </p>
                          <button
                            type="button"
                            onClick={() => setWizardOpen(true)}
                            className="mt-3 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                          >
                            Iniciar wizard para este bem
                          </button>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-600">Carregue um bem pelo tombamento para persistir a classificacao no banco.</p>
                      )}

                      {wizardPersistErr && (
                        <p className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
                          {wizardPersistErr}
                        </p>
                      )}
                      {wizardPersistMsg && (
                        <p className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
                          {wizardPersistMsg}
                        </p>
                      )}

                      {wizardLastAvaliacao?.id ? (
                        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs uppercase tracking-widest text-slate-500">Evidencia (opcional)</p>
                          <p className="mt-2 text-xs text-slate-600">
                            Se existir laudo/foto/arquivo no Drive para esta avaliacao, registre o link para auditoria.
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                            <input
                              value={wizardDocUrl}
                              onChange={(e) => {
                                setWizardDocUrl(e.target.value);
                                setWizardDocMsg(null);
                                setWizardDocErr(null);
                              }}
                              placeholder="URL do Google Drive"
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => wizardDocumentoMut.mutate()}
                              disabled={wizardDocumentoMut.isPending}
                              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {wizardDocumentoMut.isPending ? "Anexando..." : "Anexar"}
                            </button>
                          </div>
                          {wizardDocErr ? <p className="mt-2 text-sm text-rose-700">{wizardDocErr}</p> : null}
                          {wizardDocMsg ? <p className="mt-2 text-sm text-emerald-700">{wizardDocMsg}</p> : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-widest text-slate-500">Historico (Art. 141)</p>
                      {wizardAvaliacoesQuery.isLoading && <p className="mt-3 text-sm text-slate-600">Carregando...</p>}
                      {!wizardBem && <p className="mt-3 text-sm text-slate-600">Selecione um bem para ver historico.</p>}
                      {wizardBem && !wizardAvaliacoesQuery.isLoading && (wizardAvaliacoesQuery.data || []).length === 0 && (
                        <p className="mt-3 text-sm text-slate-600">Nenhuma avaliacao registrada para este bem.</p>
                      )}
                      {(wizardAvaliacoesQuery.data || []).slice(0, 8).map((it) => (
                        <article key={it.id} className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                          <p className="text-xs uppercase tracking-widest text-violet-700">{it.tipoInservivel}</p>
                          <p className="mt-1 text-xs text-slate-600">{new Date(it.avaliadoEm).toLocaleString()}</p>
                          {it.justificativa ? <p className="mt-2 text-xs text-slate-700">Justificativa: {it.justificativa}</p> : null}
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {tab === "normas" && <NormsPage />}
              {tab === "operacoes" && <OperationsPanel />}
              {tab === "wiki" && <WikiManual />}
            </div>
          </main>
        </div>
      </div>

      <ClassificationWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSave={async (result) => {
          setWizardPersistMsg(null);
          setWizardPersistErr(null);

          if (!wizardBem?.id) {
            setWizardPersistErr("Selecione um bem antes de salvar a classificacao.");
            return;
          }

          try {
            const saved = await criarAvaliacaoInservivel({
              bemId: wizardBem.id,
              tipoInservivel: result.classificacao,
              descricaoInformada: result.descricaoBem,
              justificativa: result.justificativa,
              criterios: result.criterios || null,
            });
            setWizardLastAvaliacao(saved?.avaliacao || null);
            setWizardDocMsg(null);
            setWizardDocErr(null);
            setWizardDocUrl("");
            await wizardAvaliacoesQuery.refetch().catch(() => undefined);
            setWizardPersistMsg(`Classificacao salva: ${result.classificacao}.`);
            setWizardOpen(false);
          } catch (e) {
            setWizardPersistErr(String(e?.message || "Falha ao salvar classificacao."));
          }
        }}
      />
    </div>
  );
}

export default function App() {
  const auth = useAuth();

  if (!auth.ready) {
    return (
      <div className="min-h-screen bg-app">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-700">Carregando configuracao de acesso...</p>
          </div>
        </div>
      </div>
    );
  }

  if (auth.authEnabled && !auth.isAuthenticated) return <AuthLogin />;

  return <AppShell />;
}

