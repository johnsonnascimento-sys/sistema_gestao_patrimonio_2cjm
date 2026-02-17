/**
 * Modulo: frontend/components
 * Arquivo: NormsPage.jsx
 * Funcao no sistema: pagina estatica de links normativos e manuais operacionais.
 */
const LINKS = [
  {
    titulo: "Ato Normativo STM 303/2008",
    descricao: "Base legal principal para inventario, movimentacao e inserviveis.",
    url: "#",
  },
  {
    titulo: "Manual Interno de Inventário da 2a CJM",
    descricao: "Procedimentos de contagem sala a sala e registro de divergencias.",
    url: "#",
  },
  {
    titulo: "Modelo de Termo de Transferência e Cautela",
    descricao: "Padroes de formalizacao exigidos para controle de carga e detencao temporaria.",
    url: "#",
  },
  {
    titulo: "Guia GEAFIN - Exportacao CSV Latin1",
    descricao: "Layout de campos e boas praticas para importacao no sistema.",
    url: "#",
  },
];

export default function NormsPage() {
  return (
    <section className="mt-6 rounded-2xl border border-white/15 bg-slate-900/55 p-6">
      <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Gestão de Normas e Referências</h2>
      <p className="mt-2 text-sm text-slate-300">
        Central de consulta rapida para atos normativos e documentos de apoio da operacao patrimonial.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {LINKS.map((item) => (
          <article key={item.titulo} className="rounded-xl border border-white/15 bg-slate-950/45 p-4">
            <h3 className="font-semibold text-cyan-100">{item.titulo}</h3>
            <p className="mt-2 text-sm text-slate-300">{item.descricao}</p>
            <a
              href={item.url}
              className="mt-3 inline-flex items-center rounded-md border border-cyan-200/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-100 hover:bg-cyan-300/15"
            >
              Abrir referencia
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
