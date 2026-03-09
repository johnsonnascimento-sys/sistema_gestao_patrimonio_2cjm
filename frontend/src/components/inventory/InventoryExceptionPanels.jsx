/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryExceptionPanels.jsx
 * Funcao no sistema: renderizar os painéis de excecao e consulta auxiliar da contagem por endereco.
 */
import { DisclosureCard, DisclosureMetaBadge } from "./InventoryRoomUi.jsx";

export default function InventoryExceptionPanels({
  canRegisterTerceiro,
  onRegistrarBemTerceiro,
  terceiroDescricao,
  setTerceiroDescricao,
  terceiroProprietario,
  setTerceiroProprietario,
  terceiroIdentificador,
  setTerceiroIdentificador,
  registrarBemTerceiroMut,
  terceiroStatus,
  canRegisterNaoIdentificado,
  onRegistrarNaoIdentificado,
  naoIdDescricao,
  setNaoIdDescricao,
  naoIdLocalizacao,
  setNaoIdLocalizacao,
  handleFotoNaoId,
  naoIdFotoBase64,
  registrarNaoIdentificadoMut,
  naoIdStatus,
  selectedEventoIdFinal,
  salaEncontrada,
  isOnline,
  terceirosSalaLoading,
  terceirosSalaItems,
}) {
  const roomLabel = String(salaEncontrada || "").trim();

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <DisclosureCard
        title="Bem de terceiro"
        subtitle="Controle segregado, sem tombamento GEAFIN."
        tone="warning"
        meta={<DisclosureMetaBadge tone="warning">Exceção</DisclosureMetaBadge>}
        className="order-2"
      >
        <form onSubmit={onRegistrarBemTerceiro} className="rounded-xl border border-amber-200 bg-white p-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            <p>
              Sem tombamento GEAFIN. Regra: Art. 99/110 VI/175 IX (AN303_Art99 / AN303_Art110_VI / AN303_Art175_IX).
            </p>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-600">Descrição</span>
              <input
                value={terceiroDescricao}
                onChange={(e) => setTerceiroDescricao(e.target.value)}
                placeholder="Ex.: Notebook do prestador de TI, impressora da empresa X..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Proprietário externo</span>
              <input
                value={terceiroProprietario}
                onChange={(e) => setTerceiroProprietario(e.target.value)}
                placeholder="Ex.: Empresa Contratada XYZ"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Identificador externo (opcional)</span>
              <input
                value={terceiroIdentificador}
                onChange={(e) => setTerceiroIdentificador(e.target.value)}
                placeholder="Ex.: ETIQ-000123 (ou deixe em branco)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="submit"
              disabled={!canRegisterTerceiro || registrarBemTerceiroMut.isPending}
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {registrarBemTerceiroMut.isPending ? "Registrando..." : "Registrar bem de terceiro"}
            </button>

            {terceiroStatus?.kind === "ok" ? (
              <span className="text-xs text-emerald-700">Registrado.</span>
            ) : null}
          </div>

          {registrarBemTerceiroMut.error ? (
            <p className="mt-2 text-sm text-rose-700">
              Falha ao registrar bem de terceiro: {String(registrarBemTerceiroMut.error?.message || "erro")}
            </p>
          ) : null}
        </form>
      </DisclosureCard>

      <DisclosureCard
        title="Bem sem identificação"
        subtitle="Obrigatório foto e descrição detalhada."
        tone="danger"
        defaultOpen
        meta={[
          <DisclosureMetaBadge key="tipo" tone="danger">Divergência</DisclosureMetaBadge>,
          <DisclosureMetaBadge key="foto" tone={naoIdFotoBase64 ? "success" : "warning"}>
            {naoIdFotoBase64 ? "Foto anexada" : "Foto pendente"}
          </DisclosureMetaBadge>,
        ]}
        className="order-1"
      >
        <form onSubmit={onRegistrarNaoIdentificado} className="rounded-xl border border-rose-200 bg-white p-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
            Obrigatório foto e descrição. Fica onde está. Art. 175 (AN303_Art175).
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-slate-600">Descrição detalhada do bem</span>
              <input
                value={naoIdDescricao}
                onChange={(e) => setNaoIdDescricao(e.target.value)}
                placeholder="Ex.: Cadeira giratória azul, marca Frisokar, sem braços..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Localização exata</span>
              <input
                value={naoIdLocalizacao}
                onChange={(e) => setNaoIdLocalizacao(e.target.value)}
                placeholder="Ex.: Perto da janela, mesa 3..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-slate-600">Fotografia (Obrigatória)</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFotoNaoId}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-slate-800"
              />
            </label>
            {naoIdFotoBase64 ? (
              <div className="mt-2 md:col-span-2">
                <p className="mb-1 flex items-center gap-1 text-xs text-emerald-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  Foto anexada
                </p>
                <img src={naoIdFotoBase64} alt="Prévia" className="h-16 w-16 rounded-md border border-slate-300 object-cover" />
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="submit"
              disabled={!canRegisterNaoIdentificado || registrarNaoIdentificadoMut.isPending}
              className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              {registrarNaoIdentificadoMut.isPending ? "Registrando..." : "Registrar bem sem identificação"}
            </button>

            {naoIdStatus?.kind === "ok" ? (
              <span className="text-xs text-emerald-700">Adicionado às disparidades do endereço.</span>
            ) : null}
          </div>

          {registrarNaoIdentificadoMut.error ? (
            <p className="mt-2 text-sm text-rose-700">
              Falha: {String(registrarNaoIdentificadoMut.error?.message || "erro interno")}
            </p>
          ) : null}
        </form>
      </DisclosureCard>

      <DisclosureCard
        title="Terceiros registrados"
        subtitle="Lista já registrada neste endereço."
        tone="neutral"
        meta={[
          <DisclosureMetaBadge key="tipo" tone="neutral">Consulta</DisclosureMetaBadge>,
          !selectedEventoIdFinal || !roomLabel
            ? <DisclosureMetaBadge key="status" tone="neutral">Sem contexto</DisclosureMetaBadge>
            : !isOnline
              ? <DisclosureMetaBadge key="status" tone="warning">Offline</DisclosureMetaBadge>
              : terceirosSalaLoading
                ? <DisclosureMetaBadge key="status" tone="support">Carregando</DisclosureMetaBadge>
                : <DisclosureMetaBadge key="status" tone="neutral">Itens {terceirosSalaItems.length}</DisclosureMetaBadge>,
        ]}
        className="order-3 lg:col-span-2"
      >
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
            <p>
              Fonte: `vw_bens_terceiros_inventario` (derivado de contagens). Controle segregado.
            </p>
          </div>

          {!selectedEventoIdFinal || !roomLabel ? (
            <p className="mt-3 text-sm text-slate-600">Selecione evento e endereço para listar os registros.</p>
          ) : !isOnline ? (
            <p className="mt-3 text-sm text-slate-600">
              Offline: a lista de bens de terceiros depende da API (os registros feitos offline ainda ficam na fila de sincronização).
            </p>
          ) : terceirosSalaLoading ? (
            <p className="mt-3 text-sm text-slate-600">Carregando...</p>
          ) : terceirosSalaItems.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Nenhum bem de terceiro registrado para este endereço.</p>
          ) : (
            <div className="mt-3 overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Identificador</th>
                    <th className="px-3 py-2">Descrição</th>
                    <th className="px-3 py-2">Proprietário</th>
                    <th className="px-3 py-2">Quando</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {terceirosSalaItems.slice(0, 30).map((item) => (
                    <tr key={item.contagemId} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-800">
                        {item.identificadorExterno || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-800">{item.descricao || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{item.proprietarioExterno || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {item.encontradoEm ? new Date(item.encontradoEm).toLocaleString("pt-BR") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </DisclosureCard>
    </div>
  );
}
