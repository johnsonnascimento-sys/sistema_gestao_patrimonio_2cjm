/**
 * Modulo: frontend
 * Arquivo: App.jsx
 * Funcao no sistema: orquestrar as telas de compliance (wizard, inventario e normas).
 */
import { Component, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import AssetsExplorer from "./components/AssetsExplorer.jsx";
import AuditoriaLogsPanel from "./components/AuditoriaLogsPanel.jsx";
import AuthLogin from "./components/AuthLogin.jsx";
import ClassificationWizard from "./components/ClassificationWizard.jsx";
import DashboardPanel from "./components/DashboardPanel.jsx";
import ImportacoesPanel from "./components/ImportacoesPanel.jsx";
import InventoryRoomPanel from "./components/InventoryRoomPanel.jsx";
import InventoryAdminPanel from "./components/InventoryAdminPanel.jsx";
import MovimentacoesPanel from "./components/MovimentacoesPanel.jsx";
import NormsPage from "./components/NormsPage.jsx";
import OperationsPanel from "./components/OperationsPanel.jsx";
import CatalogoAdminPanel from "./components/CatalogoAdminPanel.jsx";
import ClassificacaoSiafiPanel from "./components/ClassificacaoSiafiPanel.jsx";
import WikiManual from "./components/WikiManual.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import {
  criarAvaliacaoInservivel,
  criarDocumento,
  listarAvaliacoesInservivel,
  listarBens,
  listarEventosInventario,
} from "./services/apiClient.js";

const NAV_STRUCTURE = [
  { type: "item", item: { id: "dashboard", label: "Dashboard", short: "Dash" } },
  {
    type: "group",
    id: "operacoes",
    label: "Operações Patrimoniais",
    items: [
      { id: "bens", label: "Consulta de Bens", short: "Bens" },
      { id: "movimentacoes", label: "Movimentações", short: "Mov." },
      { id: "operacoes-cadastro-sala", label: "Cadastrar bens por Endereço", short: "Endereço" },
      { id: "inventario-contagem", label: "Inventário - Contagem", short: "Contagem" },
      { id: "inventario-admin", label: "Inventário - Administração", short: "Inv. Admin" },
      { id: "classificacao", label: "Wizard Art. 141", short: "Art. 141" },
      { id: "catalogo-material", label: "Material (SKU)", short: "Material" },
      { id: "classificacoes-siafi", label: "Classificação SIAFI", short: "SIAFI" },
      { id: "importacoes-geafin", label: "Importação GEAFIN (CSV Latin1)", short: "GEAFIN" },
    ],
  },
  {
    type: "group",
    id: "auditoria",
    label: "Auditoria e Logs",
    items: [
      { id: "auditoria-changelog", label: "Log Geral de Alterações", short: "Log Geral" },
      { id: "auditoria-patrimonio", label: "Auditoria Patrimonial (Global)", short: "Patrimônio" },
      { id: "auditoria-erros", label: "Log de Erros Runtime", short: "Erros" },
    ],
  },
  {
    type: "group",
    id: "admin",
    label: "Administração do Painel",
    items: [
      { id: "admin-locais", label: "Locais (endereços) cadastrados", short: "Locais" },
      { id: "admin-backup", label: "Backup e Restore", short: "Backup" },
      { id: "admin-health", label: "Conectividade Backend", short: "Health" },
      { id: "admin-perfis", label: "Perfis e Acessos", short: "Perfis" },
      { id: "admin-aprovacoes", label: "Aprovações Pendentes", short: "Aprov." },
    ],
  },
  { type: "item", item: { id: "wiki", label: "Wiki / Manual do Sistema", short: "Wiki" } },
  { type: "item", item: { id: "normas", label: "Normas", short: "Normas" } },
];

const TAB_PERMISSION_MAP = Object.freeze({
  dashboard: "menu.dashboard.view",
  bens: "menu.bens.view",
  movimentacoes: "menu.movimentacoes.view",
  "operacoes-cadastro-sala": "menu.movimentacoes.view",
  "inventario-contagem": "menu.inventario_contagem.view",
  "inventario-admin": "menu.inventario_admin.view",
  classificacao: "menu.classificacao.view",
  "catalogo-material": "menu.catalogo_material.view",
  "classificacoes-siafi": "menu.classificacoes_siafi.view",
  "importacoes-geafin": "menu.importacoes_geafin.view",
  "auditoria-changelog": "menu.auditoria.view",
  "auditoria-patrimonio": "menu.auditoria.view",
  "auditoria-erros": "menu.auditoria.view",
  "admin-locais": "menu.admin_locais.view",
  "admin-backup": "menu.admin_backup.view",
  "admin-health": "menu.admin_health.view",
  "admin-perfis": "menu.admin_perfis.view",
  "admin-aprovacoes": "menu.admin_aprovacoes.view",
  normas: "menu.classificacao.view",
  wiki: "menu.wiki.view",
});

const DEFAULT_OPEN_GROUPS = NAV_STRUCTURE.reduce((acc, entry) => {
  if (entry.type === "group") acc[entry.id] = true;
  return acc;
}, {});
const INVENTARIO_REDUCED_MODE_KEY = "cjm_inventario_reduced_mode_v1";

function NavIcon({ id }) {
  const cls = "h-4 w-4";

  if (id === "dashboard") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
      </svg>
    );
  }

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

  if (id === "movimentacoes" || id === "operacoes-cadastro-sala") {
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

  if (id === "catalogo-material" || id === "classificacoes-siafi") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
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

  if (id === "importacoes-geafin") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v11" />
        <path d="m8 10 4 4 4-4" />
        <rect x="4" y="15" width="16" height="6" rx="2" />
      </svg>
    );
  }

  if (id === "auditoria-changelog" || id === "auditoria-patrimonio" || id === "auditoria-erros") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M7 4h10l3 3v13H7z" />
        <path d="M17 4v3h3" />
        <path d="M10 10h7" />
        <path d="M10 14h7" />
      </svg>
    );
  }

  if (
    id === "admin-backup" ||
    id === "admin-health" ||
    id === "admin-perfis" ||
    id === "admin-aprovacoes" ||
    id === "admin-locais" ||
    id === "operacoes"
  ) {
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
      errorMessage: String(error?.message || "Erro interno na renderizacao desta seção."),
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
          <p>Falha ao renderizar esta seção.</p>
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
  const canAdmin = !auth.authEnabled || auth.can("menu.admin_health.view") || String(auth.role || "").toUpperCase() === "ADMIN";
  const [tab, setTab] = useState("dashboard");
  const [bensNavPreset, setBensNavPreset] = useState({ unidadeDonaId: null, nonce: 0 });
  const [openNavGroups, setOpenNavGroups] = useState(DEFAULT_OPEN_GROUPS);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardBemTombo, setWizardBemTombo] = useState("");
  const [wizardBem, setWizardBem] = useState(null);
  const [wizardPersistMsg, setWizardPersistMsg] = useState(null);
  const [wizardPersistErr, setWizardPersistErr] = useState(null);
  const [wizardLastAvaliacao, setWizardLastAvaliacao] = useState(null);
  const [wizardDocUrl, setWizardDocUrl] = useState("");
  const [wizardDocMsg, setWizardDocMsg] = useState(null);
  const [wizardDocErr, setWizardDocErr] = useState(null);
  const [navReducedMode, setNavReducedMode] = useState(false);

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
  const activeEvents = eventosQuery.data || [];
  const activeEventCode = activeEvents[0]?.codigoEvento || null;

  const isTabAllowed = useMemo(
    () => (tabId) => {
      if (!auth.authEnabled) return true;
      const perm = TAB_PERMISSION_MAP[tabId];
      if (!perm) return true;
      return auth.can(perm);
    },
    [auth],
  );

  const filteredNavStructure = useMemo(() => {
    const out = [];
    for (const entry of NAV_STRUCTURE) {
      if (entry.type === "item") {
        if (isTabAllowed(entry.item.id)) out.push(entry);
        continue;
      }
      const items = entry.items.filter((item) => isTabAllowed(item.id));
      if (!items.length) continue;
      out.push({ ...entry, items });
    }
    return out;
  }, [isTabAllowed]);

  const bannerMessage = useMemo(() => {
    if (inventoryStatus === "EM_ANDAMENTO") {
      const n = activeEvents.length;
      if (n > 1) {
        return `Inventário ativo em ${n} eventos (por unidade): transferências ficam bloqueadas no escopo do Art. 183 (AN303_Art183).`;
      }
      return "Inventário ativo: movimentações de transferência ficam bloqueadas pelo Art. 183 (AN303_Art183).";
    }
    if (inventoryStatus === "CARREGANDO") {
      return "Consultando status do inventario no banco...";
    }
    return "Sem evento ativo: transferências e regularizações podem ser executadas.";
  }, [inventoryStatus, activeEvents.length]);

  const toggleNavGroup = (groupId) =>
    setOpenNavGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  const selectTab = (nextTab) => {
    setTab(nextTab);
    setMobileMenuOpen(false);
  };
  const handleDashboardNavigate = (target) => {
    if (typeof target === "string") {
      setTab(target);
      return;
    }
    if (target && typeof target === "object") {
      const nextTab = target.id ? String(target.id) : "dashboard";
      if (nextTab === "bens") {
        const unidade = target.filters?.unidadeDonaId ?? null;
        setBensNavPreset((prev) => ({
          unidadeDonaId: unidade,
          nonce: prev.nonce + 1,
        }));
      }
      setTab(nextTab);
    }
  };
  const activeTabLabel = useMemo(() => {
    for (const entry of filteredNavStructure) {
      if (entry.type === "item" && entry.item.id === tab) return entry.item.label;
      if (entry.type === "group") {
        const found = entry.items.find((it) => it.id === tab);
        if (found) return found.label;
      }
    }
    return "Menu";
  }, [tab, filteredNavStructure]);

  useEffect(() => {
    const readReduced = () => {
      try {
        const raw = window.localStorage.getItem(INVENTARIO_REDUCED_MODE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        return Boolean(data?.active);
      } catch {
        return false;
      }
    };
    const sync = () => setNavReducedMode(readReduced());
    sync();
    window.addEventListener("storage", sync);
    const t = window.setInterval(sync, 1500);
    return () => {
      window.removeEventListener("storage", sync);
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (navReducedMode && tab !== "inventario-contagem") {
      setTab("inventario-contagem");
    }
  }, [navReducedMode, tab]);

  useEffect(() => {
    if (isTabAllowed(tab)) return;
    let fallback = "dashboard";
    for (const entry of filteredNavStructure) {
      if (entry.type === "item") {
        fallback = entry.item.id;
        break;
      }
      if (entry.type === "group" && entry.items.length) {
        fallback = entry.items[0].id;
        break;
      }
    }
    if (tab !== fallback) setTab(fallback);
  }, [tab, isTabAllowed, filteredNavStructure]);

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
        setWizardPersistErr("Bem não encontrado para este tombamento.");
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
            <h1 className="mt-2 font-[Space_Grotesk] text-2xl font-semibold text-slate-900">Patrimônio</h1>
          </div>

          <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {filteredNavStructure.map((entry) => {
              if (entry.type === "item") {
                const item = entry.item;
                const active = tab === item.id;
                const navLocked = navReducedMode && item.id !== "inventario-contagem";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (navLocked) return;
                      setTab(item.id);
                    }}
                    disabled={navLocked}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                      active
                        ? "bg-violet-50 text-violet-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    } ${navLocked ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[12px]">
                      <NavIcon id={item.id} />
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              }

              const isOpen = Boolean(openNavGroups[entry.id]);
              const hasActiveChild = entry.items.some((item) => item.id === tab);
              return (
                <div key={entry.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleNavGroup(entry.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider transition ${
                      hasActiveChild ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <span>{entry.label}</span>
                    <span className={`transition ${isOpen ? "rotate-180" : ""}`}>v</span>
                  </button>
                  {isOpen ? (
                    <div className="space-y-1 pl-2">
                      {entry.items.map((item) => {
                        const active = tab === item.id;
                        const navLocked = navReducedMode && item.id !== "inventario-contagem";
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (navLocked) return;
                              setTab(item.id);
                            }}
                            disabled={navLocked}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                              active
                                ? "bg-violet-50 text-violet-700"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            } ${navLocked ? "cursor-not-allowed opacity-45" : ""}`}
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[12px]">
                              <NavIcon id={item.id} />
                            </span>
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 md:px-8">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Status Inventário</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`status-chip ${inventoryStatus === "EM_ANDAMENTO" ? "status-live" : "status-closed"}`}>
                    {inventoryStatus}
                  </span>
                  {activeEvents.length > 1 ? (
                    <span className="truncate text-xs text-slate-600">
                      Eventos ativos: <span className="font-semibold">{activeEvents.length}</span>
                    </span>
                  ) : activeEventCode ? (
                    <span className="truncate text-xs text-slate-600">
                      Evento: <span className="font-semibold">{activeEventCode}</span>
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 hidden max-w-[620px] truncate text-xs text-slate-600 md:block">{bannerMessage}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 md:hidden"
                >
                  Menu
                </button>
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

          {mobileMenuOpen ? (
            <div className="fixed inset-0 z-40 md:hidden">
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMobileMenuOpen(false)}
                className="absolute inset-0 bg-slate-900/40"
              />
              <aside className="absolute right-0 top-0 h-full w-[88%] max-w-sm overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Navegacao</p>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                  >
                    Fechar
                  </button>
                </div>
                <div className="space-y-2">
                  {filteredNavStructure.map((entry) => {
                    if (entry.type === "item") {
                      const item = entry.item;
                      const active = tab === item.id;
                      const navLocked = navReducedMode && item.id !== "inventario-contagem";
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (navLocked) return;
                            selectTab(item.id);
                          }}
                          disabled={navLocked}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${
                            active
                              ? "bg-violet-50 text-violet-700"
                              : "text-slate-700 hover:bg-slate-100"
                          } ${navLocked ? "cursor-not-allowed opacity-45" : ""}`}
                        >
                          <span>{item.label}</span>
                          <span>{item.short}</span>
                        </button>
                      );
                    }

                    const isOpen = Boolean(openNavGroups[entry.id]);
                    const hasActiveChild = entry.items.some((item) => item.id === tab);
                    return (
                      <div key={entry.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleNavGroup(entry.id)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wider ${
                            hasActiveChild ? "bg-violet-50 text-violet-700" : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          <span>{entry.label}</span>
                          <span className={`transition ${isOpen ? "rotate-180" : ""}`}>v</span>
                        </button>
                        {isOpen ? (
                          <div className="space-y-1 pl-2">
                            {entry.items.map((item) => {
                              const active = tab === item.id;
                              const navLocked = navReducedMode && item.id !== "inventario-contagem";
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    if (navLocked) return;
                                    selectTab(item.id);
                                  }}
                                  disabled={navLocked}
                                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${
                                    active
                                      ? "bg-violet-50 text-violet-700"
                                      : "text-slate-700 hover:bg-slate-100"
                                  } ${navLocked ? "cursor-not-allowed opacity-45" : ""}`}
                                >
                                  <span>{item.label}</span>
                                  <span>{item.short}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </aside>
            </div>
          ) : null}

          <main className="flex-1 bg-slate-50">
            <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
              <section className="mb-4 md:hidden">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Tela atual</p>
                    <p className="text-sm font-semibold text-slate-900">{activeTabLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Abrir menu
                  </button>
                </div>
              </section>

              {tab === "dashboard" && <DashboardPanel onNavigate={handleDashboardNavigate} />}

              {tab === "bens" && (
                <AssetsExplorer
                  initialUnidadeDonaId={bensNavPreset.unidadeDonaId}
                  key={`assets-explorer-${bensNavPreset.nonce}`}
                />
              )}

              {tab === "inventario-contagem" && (
                <SectionErrorBoundary>
                  <InventoryRoomPanel />
                </SectionErrorBoundary>
              )}

              {tab === "inventario-admin" && <InventoryAdminPanel />}

              {tab === "movimentacoes" && <MovimentacoesPanel />}
              {tab === "operacoes-cadastro-sala" && <MovimentacoesPanel section="cadastro-sala" />}
              {tab === "catalogo-material" && <CatalogoAdminPanel canAdmin={canAdmin} />}
              {tab === "classificacoes-siafi" && <ClassificacaoSiafiPanel canAdmin={canAdmin} />}
              {tab === "importacoes-geafin" && <ImportacoesPanel canAdmin={canAdmin} />}

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
                      <p className="text-xs uppercase tracking-widest text-slate-500">Histórico (Art. 141)</p>
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

              {tab === "auditoria-changelog" && (
                <AuditoriaLogsPanel canAdmin={canAdmin} section="auditoria-changelog" />
              )}
              {tab === "auditoria-patrimonio" && (
                <AuditoriaLogsPanel canAdmin={canAdmin} section="auditoria-patrimonio" />
              )}
              {tab === "auditoria-erros" && (
                <AuditoriaLogsPanel canAdmin={canAdmin} section="auditoria-erros" />
              )}

              {tab === "admin-locais" && <OperationsPanel section="admin-locais" />}
              {tab === "admin-backup" && <OperationsPanel section="admin-backup" />}
              {tab === "admin-health" && <OperationsPanel section="admin-health" />}
              {tab === "admin-perfis" && <OperationsPanel section="admin-perfis" />}
              {tab === "admin-aprovacoes" && <OperationsPanel section="admin-aprovacoes" />}
              {tab === "normas" && <NormsPage />}
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


