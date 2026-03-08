/**
 * Modulo: frontend/components/assets
 * Arquivo: AssetsExplorerHeader.jsx
 * Funcao no sistema: renderizar cabecalho e contexto de origem da Consulta de Bens.
 */
export default function AssetsExplorerHeader({ originLabel = "", originContext = "" }) {
  return (
    <>
      <header className="space-y-2">
        <h2 className="font-[Space_Grotesk] text-2xl font-semibold">Consulta de Bens</h2>
        <p className="text-sm text-slate-600">
          Esta tela consulta o Supabase via backend. Use tombamento (10 dígitos), etiqueta de 4 dígitos
          (azul/sufixo), código do material (SKU) ou texto da descrição.
        </p>
      </header>

      {originLabel ? (
        <article className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
            Contexto aplicado de {originLabel}
          </p>
          <p className="mt-1 text-sm text-violet-900">
            {originContext || "Os filtros desta consulta foram carregados por um atalho operacional."}
          </p>
        </article>
      ) : null}
    </>
  );
}
