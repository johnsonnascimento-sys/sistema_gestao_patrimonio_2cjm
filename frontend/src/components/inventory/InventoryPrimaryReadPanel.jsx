/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryPrimaryReadPanel.jsx
 * Funcao no sistema: renderizar o painel principal de leitura da contagem por endereco.
 */
import BarcodeScanner from "../BarcodeScanner.jsx";

function QuickStatusCard({ title, value, tone = "slate" }) {
  const cls = tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-xl border px-3 py-2 text-xs ${cls}`}>
      <span className="block font-semibold">{title}</span>
      <span>{value}</span>
    </div>
  );
}

export default function InventoryPrimaryReadPanel({
  canRegister,
  canRegisterHint,
  roomPendingOfflineCount,
  selectedEventoId,
  setSelectedEventoId,
  eventos,
  selectedEventoIdFinal,
  eventoAtivo,
  formatModeLabel,
  modoContagemEvento,
  eventoSelecionadoIncompativel,
  sessaoContagemLoading,
  sessaoDesignado,
  rodadaSelecionada,
  setRodadaSelecionada,
  rodadasPermitidas,
  podeDesempate,
  unidadeEncontradaId,
  setUnidadeEncontradaId,
  formatUnidade,
  selectedLocalId,
  setSelectedLocalId,
  locaisOptions,
  locaisLoading,
  localIdsPermitidosEvento,
  setSalaEncontrada,
  registerScan,
  scannerInputRef,
  scannerValue,
  setScannerValue,
  normalizeTombamentoInput,
  handleScannerInputKeyDown,
  scannerMode,
  setScannerMode,
  setShowScanner,
  salaEncontrada,
  showScanner,
  cameraScanPreview,
  handleScanValue,
  lastScans,
}) {
  return (
    <article className="rounded-2xl border border-violet-200 bg-white p-3 shadow-sm md:p-4 lg:col-span-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Leitura principal</h3>
          <p className="mt-1 text-xs text-slate-600">
            Prepare o contexto e mantenha o foco na bipagem contínua do endereço atual.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${canRegister ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
            {canRegister ? "Pronto para bipagem" : "Aguardando contexto"}
          </span>
          <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${roomPendingOfflineCount ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}>
            Fila do endereço: {roomPendingOfflineCount}
          </span>
        </div>
      </div>
      <h3 className="font-semibold">Endereço e scanner</h3>
      <p className="mt-1 text-xs text-slate-600">
        Selecione o endereço e registre tombamentos. Divergências tocam alerta e viram ocorrência (Art. 185).
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-slate-600">Evento ativo</span>
          <select
            value={selectedEventoId}
            onChange={(e) => setSelectedEventoId(String(e.target.value || ""))}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">
              {eventos.length ? "Selecione um evento ativo" : "Nenhum evento ativo em andamento"}
            </option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {`${ev.codigoEvento || ev.id} - ${ev.modoContagem || "PADRAO"} - ${ev.escopoTipo || "UNIDADE"} - Unidade ${ev.unidadeInventariadaId ?? "GERAL"}`}
              </option>
            ))}
          </select>
          {selectedEventoIdFinal ? (
            <p className="text-[11px] text-slate-500">
              Evento aplicado: <strong>{eventoAtivo?.codigoEvento || selectedEventoIdFinal}</strong>{" "}
              ({eventoAtivo?.modoContagem || "PADRAO"} / {eventoAtivo?.escopoTipo || "UNIDADE"} / unidade {eventoAtivo?.unidadeInventariadaId ?? "GERAL"}).
            </p>
          ) : (
            <p className="text-[11px] text-amber-700">
              Abra um evento na aba de Administração do Inventário para iniciar a contagem.
            </p>
          )}
          {eventoSelecionadoIncompativel ? (
            <p className="text-[11px] text-rose-700">
              Evento incompatível com a unidade encontrada selecionada. Escolha o evento da mesma unidade ou um evento GERAL.
            </p>
          ) : null}
          {modoContagemEvento !== "PADRAO" && !sessaoContagemLoading && !sessaoDesignado ? (
            <p className="text-[11px] text-rose-700">
              Usuário não designado para este evento em modo {modoContagemEvento}. Solicite ao admin sua designação.
            </p>
          ) : null}
        </label>
        {modoContagemEvento !== "PADRAO" ? (
          <label className="space-y-1">
            <span className="text-xs text-slate-600">Rodada</span>
            <select
              value={rodadaSelecionada}
              onChange={(e) => setRodadaSelecionada(String(e.target.value || "A"))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {rodadasPermitidas.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              {podeDesempate ? <option value="DESEMPATE">DESEMPATE</option> : null}
            </select>
          </label>
        ) : null}
        <label className="space-y-1">
          <span className="text-xs text-slate-600">Unidade encontrada (1..4)</span>
          <select
            value={unidadeEncontradaId}
            onChange={(e) => setUnidadeEncontradaId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Selecione</option>
            <option value="1">{formatUnidade(1)}</option>
            <option value="2">{formatUnidade(2)}</option>
            <option value="3">{formatUnidade(3)}</option>
            <option value="4">{formatUnidade(4)}</option>
          </select>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs text-slate-600">Local cadastrado (Admin)</span>
          <select
            value={selectedLocalId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedLocalId(id);
              const local = locaisOptions.find((item) => String(item.id) === String(id));
              if (local?.nome) setSalaEncontrada(String(local.nome));
            }}
            disabled={!unidadeEncontradaId || locaisLoading || !!(localIdsPermitidosEvento && !locaisOptions.length)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">
              {!unidadeEncontradaId
                ? "Selecione a unidade encontrada primeiro"
                : locaisLoading
                  ? "Carregando locais..."
                  : "Selecione um local"}
            </option>
            {locaisOptions.map((local) => (
              <option key={local.id} value={local.id}>
                {local.nome}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Este campo não é texto livre. O Admin cadastra os locais em "Operações API" (seção Locais).
          </p>
          {localIdsPermitidosEvento ? (
            <p className="mt-1 text-[11px] text-amber-700">
              Este evento está em escopo LOCAIS: apenas os endereços selecionados no evento podem ser usados.
            </p>
          ) : null}
        </label>
      </div>

      <form onSubmit={registerScan} className="mt-4">
        <label className="mb-2 block space-y-1">
          <span className="text-xs text-slate-600">Bipar tombamento (10 dígitos)</span>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Leitura do tombamento</span>
          <span className="block text-xs text-slate-500">Leia 10 dígitos ou etiqueta de 4 dígitos para abrir a identificação.</span>
          <div className="grid grid-cols-[1fr_auto] gap-2 md:grid-cols-[1fr_auto_auto]">
            <input
              ref={scannerInputRef}
              value={scannerValue}
              onChange={(e) => setScannerValue(normalizeTombamentoInput(e.target.value))}
              onKeyDown={handleScannerInputKeyDown}
              placeholder="Ex.: 1290001788"
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
              className="col-span-1 w-full rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-base font-semibold tracking-[0.08em] text-slate-900 shadow-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setScannerMode("single"); setShowScanner(true); }}
                title="Câmera (Uma leitura)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-violet-500"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </button>
              <button
                type="button"
                onClick={() => { setScannerMode("continuous"); setShowScanner(true); }}
                title="Câmera (Contínuo)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800 shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-violet-500"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </button>
            </div>

            <button
              type="submit"
              disabled={!canRegister}
              className="col-span-2 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 md:col-span-1"
            >
              Registrar
            </button>
          </div>
        </label>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <QuickStatusCard
            title="Endereço ativo"
            value={salaEncontrada || "Selecione um local cadastrado."}
            tone="success"
          />
          <QuickStatusCard
            title="Status de registro"
            value={canRegister ? "Leitura liberada para este contexto." : canRegisterHint}
          />
          <QuickStatusCard
            title="Modo da câmera"
            value={scannerMode === "continuous" ? "Contínuo" : "Uma leitura por abertura"}
            tone="warning"
          />
        </div>
      </form>

      {showScanner ? (
        <BarcodeScanner
          continuous={scannerMode === "continuous"}
          scanPreview={cameraScanPreview}
          onClose={() => setShowScanner(false)}
          onScan={(decodedText) => {
            const cleaned = normalizeTombamentoInput(decodedText);
            if (cleaned.length === 10 || cleaned.length === 4) {
              setScannerValue(cleaned);
              if (!canRegister) return;
              if (scannerMode === "single") setShowScanner(false);
              setTimeout(() => {
                handleScanValue(cleaned, { fromCamera: true });
              }, 50);
            } else if (scannerMode === "single") {
              setScannerValue(cleaned || decodedText);
            }
          }}
        />
      ) : null}

      {lastScans.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-widest text-slate-500">Últimos registros</p>
            <span className="text-[11px] text-slate-500">Leituras recentes do operador</span>
          </div>
          {lastScans.map((scan) => (
            <div key={scan.id} className="mt-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-slate-900">{scan.numeroTombamento}</span>
                <span className="text-slate-600">{scan.when}</span>
              </div>
              <div className="mt-1 text-slate-600">
                {scan.divergente ? (
                  <span className="text-amber-800">
                    {scan.statusLabel || "Divergente"}: dono={formatUnidade(Number(scan.unidadeDonaId))} encontrado={formatUnidade(Number(scan.unidadeEncontradaId))}
                    {scan.divergenciaSala && scan.salaEsperada ? ` | endereço esperado=${scan.salaEsperada}` : ""}
                  </span>
                ) : (
                  <span className="text-emerald-700">{scan.statusLabel || "Conforme"}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
