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
          Esta tela consulta o Supabase via backend. Use tombamento (10 digitos), etiqueta de 4 digitos
          (azul/sufixo), codigo do material (SKU) ou texto da descricao.
        </p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Operacao mais comum
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
            Tombo 10 digitos
          </span>
          <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
            Etiqueta 4 digitos
          </span>
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            Material (SKU)
          </span>
          <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
            Texto + filtros
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Regra pratica: tente primeiro um identificador direto. Abra filtros avancados so quando a
          consulta exigir investigacao por endereco, responsavel, status ou descricao.
        </p>
      </article>

      {originLabel ? (
        <article className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
            Contexto aplicado de {originLabel}
          </p>
          <p className="mt-1 text-sm text-violet-900">
            {originContext || "Os filtros desta consulta foram carregados por um atalho operacional."}
          </p>
          <p className="mt-2 text-xs text-violet-800/80">
            Confira o resultado, abra <strong>Detalhes</strong> se precisar validar historico e depois
            retome o fluxo anterior.
          </p>
        </article>
      ) : null}
    </>
  );
}
