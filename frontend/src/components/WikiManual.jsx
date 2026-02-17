/**
 * Modulo: frontend
 * Arquivo: components/WikiManual.jsx
 * Funcao no sistema: Wiki/manual self-hosted para uso de usuarios e administradores (sem depender do backend).
 *
 * Regra de governanca:
 * - Todo cambio de UX, endpoints, regras de negocio ou compliance deve atualizar o Wiki.
 * - Esta tela deve continuar deterministica (sem IA) e sem segredos.
 */
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import mdIndice from "../wiki/00_indice.md?raw";
import mdVisaoGeral from "../wiki/01_visao_geral.md?raw";
import mdPerfisAcesso from "../wiki/02_perfis_acesso.md?raw";
import mdConsultaBens from "../wiki/03_consulta_bens.md?raw";
import mdImportacaoGeafin from "../wiki/04_importacao_geafin.md?raw";
import mdMovimentacoes from "../wiki/05_movimentacoes.md?raw";
import mdInventario from "../wiki/06_inventario_sala_a_sala.md?raw";
import mdIntrusosTerceiros from "../wiki/07_intrusos_bens_de_terceiros.md?raw";
import mdWizard141 from "../wiki/08_wizard_art141.md?raw";
import mdRelatoriosAuditoria from "../wiki/09_relatorios_auditoria.md?raw";
import mdTroubleshooting from "../wiki/10_solucao_problemas.md?raw";
import mdGlossario from "../wiki/11_glossario.md?raw";
import mdSeguranca from "../wiki/12_politica_seguranca.md?raw";
import mdCompliance from "../wiki/13_compliance_atn303.md?raw";
import mdAdminVps from "../wiki/14_admin_operacao_vps.md?raw";
import mdApiRef from "../wiki/15_referencia_api.md?raw";
import mdMatrizCompliance from "../wiki/16_matriz_compliance.md?raw";
import mdRegularizacaoPosInventario from "../wiki/17_regularizacao_pos_inventario.md?raw";
import { wikiMeta } from "../wiki/wikiMeta.generated.js";

const WIKI_PAGES = [
  { id: "indice", title: "Índice", md: mdIndice },
  { id: "visao-geral", title: "Visão geral do sistema", md: mdVisaoGeral },
  { id: "perfis", title: "Perfis e acesso", md: mdPerfisAcesso },
  { id: "consulta-bens", title: "Consulta de bens", md: mdConsultaBens },
  { id: "importacao-geafin", title: "Importação GEAFIN (CSV)", md: mdImportacaoGeafin },
  { id: "movimentacoes", title: "Movimentações: cautela x transferência", md: mdMovimentacoes },
  { id: "inventario", title: "Inventário sala a sala", md: mdInventario },
  { id: "intrusos-terceiros", title: "Intrusos e bens de terceiros", md: mdIntrusosTerceiros },
  { id: "regularizacao", title: "Regularização pós-inventário", md: mdRegularizacaoPosInventario },
  { id: "wizard-art141", title: "Wizard Art. 141 (inserviveis)", md: mdWizard141 },
  { id: "relatorios-auditoria", title: "Relatórios e auditoria", md: mdRelatoriosAuditoria },
  { id: "troubleshooting", title: "Solução de problemas", md: mdTroubleshooting },
  { id: "glossario", title: "Glossário", md: mdGlossario },
  { id: "seguranca", title: "Segurança e sigilo operacional", md: mdSeguranca },
  { id: "compliance", title: "Compliance ATN 303/2008", md: mdCompliance },
  { id: "matriz-compliance", title: "Matriz de compliance (ATN 303)", md: mdMatrizCompliance },
  { id: "admin-vps", title: "Admin: operação na VPS", md: mdAdminVps },
  { id: "api-ref", title: "Referência rápida da API", md: mdApiRef },
];

function stripLeadingHtmlComments(md) {
  if (md == null) return "";
  let s = String(md);
  // Remove BOM if present.
  s = s.replace(/^\uFEFF/, "");

  // Remove one or more HTML comments at the very top (used for file metadata headers).
  // react-markdown escapes HTML by default, so comments would show as text otherwise.
  // We keep the header in the file (governance), but hide it in the UI.
  for (let n = 0; n < 3; n += 1) {
    const leadingWs = (s.match(/^\s*/) || [""])[0];
    const start = leadingWs.length;
    if (!s.slice(start).startsWith("<!--")) break;
    const end = s.indexOf("-->", start + 4);
    if (end === -1) break;
    s = s.slice(end + 3);
  }
  return s.replace(/^\s+/, "");
}

function formatUpdatedAt(iso) {
  if (!iso) return null;
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString("pt-BR");
  } catch {
    return d.toISOString();
  }
}

function readWikiHash() {
  const raw = (window.location.hash || "").replace(/^#/, "");
  if (!raw) return null;
  const match = raw.match(/(?:^|&)wiki=([^&]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function writeWikiHash(pageId) {
  const current = (window.location.hash || "").replace(/^#/, "");
  const pairs = current
    ? current.split("&").filter(Boolean).map((item) => item.split("=").slice(0, 2))
    : [];

  const nextPairs = pairs.filter(([k]) => String(k).toLowerCase() !== "wiki");
  nextPairs.push(["wiki", encodeURIComponent(pageId)]);
  window.location.hash = `#${nextPairs.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

export default function WikiManual() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(() => readWikiHash() || "indice");

  useEffect(() => {
    const onHashChange = () => {
      const next = readWikiHash();
      if (next) setActiveId(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    // Mantem selecao da pagina ao trocar de aba/refresh.
    writeWikiHash(activeId);
  }, [activeId]);

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WIKI_PAGES;
    return WIKI_PAGES.filter((p) => p.title.toLowerCase().includes(q) || p.id.includes(q));
  }, [query]);

  const activePage = useMemo(() => {
    return WIKI_PAGES.find((p) => p.id === activeId) || WIKI_PAGES[0];
  }, [activeId]);

  const updated = wikiMeta?.[activePage.id] || null;
  const updatedText = formatUpdatedAt(updated?.updatedAt);
  const mdClean = useMemo(() => stripLeadingHtmlComments(activePage.md), [activePage.md]);

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-2xl border border-white/15 bg-slate-900/55 p-4 backdrop-blur">
        <h2 className="font-[Space_Grotesk] text-xl font-semibold">Wiki do Sistema</h2>
        <p className="mt-2 text-sm text-slate-300">
          Manual completo (usuários e admin). Conteúdo versionado e publicado junto do site.
        </p>

        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300" htmlFor="wikiSearch">
            Buscar página
          </label>
          <input
            id="wikiSearch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/40 px-3 py-2 text-sm outline-none focus:border-cyan-300/80"
            placeholder="Ex.: inventário, GEAFIN, cautela..."
          />
        </div>

        <nav className="mt-4 max-h-[55vh] overflow-auto pr-1">
          <ul className="space-y-1">
            {filteredPages.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/5 ${
                    p.id === activePage.id ? "border border-cyan-300/60 bg-cyan-300/10" : "border border-transparent"
                  }`}
                >
                  <span className="block font-medium">{p.title}</span>
                  <span className="block text-xs text-slate-400">#{p.id}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/35 p-3 text-xs text-slate-300">
          <p className="font-semibold">Regra de operação</p>
          <p className="mt-1">
            Se este Wiki estiver desatualizado, considere o sistema em{" "}
            <span className="font-semibold">não-conformidade</span> e pare a implantação até corrigir.
          </p>
        </div>
      </aside>

      <article className="rounded-2xl border border-white/15 bg-slate-900/55 p-6 backdrop-blur">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-200">Wiki</p>
            <h2 className="mt-2 font-[Space_Grotesk] text-2xl font-semibold">{activePage.title}</h2>
            {updatedText && (
              <p className="mt-2 text-xs text-slate-400">
                Atualizado em:{" "}
                <span className="font-semibold text-slate-200">{updatedText}</span>
                {updated?.source ? (
                  <span className="text-slate-500"> (fonte: {updated.source})</span>
                ) : null}
              </p>
            )}
          </div>
          <a
            className="rounded-lg border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-white/5"
            href={`#wiki=${encodeURIComponent(activePage.id)}`}
          >
            Link desta página
          </a>
        </div>

        <div className="wiki-content mt-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{mdClean}</ReactMarkdown>
        </div>
      </article>
    </section>
  );
}
