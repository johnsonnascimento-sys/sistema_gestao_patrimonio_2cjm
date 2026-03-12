/**
 * Modulo: frontend/components
 * Arquivo: BaixaProcessDrawer.jsx
 * Funcao no sistema: editar, concluir e revisar processos de baixa patrimonial.
 */
import { useEffect, useState } from "react";

const MODALIDADES = ["VENDA", "CESSAO", "DOACAO", "PERMUTA", "INUTILIZACAO", "ABANDONO", "DESAPARECIMENTO"];
const DESTINATARIOS = [
  "",
  "ADMIN_PUBLICA_FEDERAL",
  "OUTROS_PODERES_UNIAO",
  "ESTADO",
  "MUNICIPIO",
  "DISTRITO_FEDERAL",
  "EMPRESA_PUBLICA",
  "SOCIEDADE_ECONOMIA_MISTA",
  "INSTITUICAO_FILANTROPICA",
  "OSCIP",
  "ADMINISTRACAO_PUBLICA",
  "ORGAO_ENTIDADE_PUBLICA",
];
const MOTIVOS = [
  "AMEACA_VITAL",
  "PREJUIZO_ECOLOGICO",
  "CONTAMINACAO",
  "INFESTACAO",
  "TOXICIDADE",
  "RISCO_FRAUDE",
  "OUTRO",
];

function toDatetimeLocalInput(value) {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function buildInitialForm({ process, selectedItems, mode }) {
  const baixa = process?.baixa || null;
  const dados = baixa?.dadosModalidade || {};
  return {
    processoReferencia: baixa?.processoReferencia || "",
    modalidadeBaixa: baixa?.modalidadeBaixa || mode || "DOACAO",
    manifestacaoSciReferencia: baixa?.manifestacaoSciReferencia || "",
    manifestacaoSciEm: toDatetimeLocalInput(baixa?.manifestacaoSciEm),
    atoDiretorGeralReferencia: baixa?.atoDiretorGeralReferencia || "",
    atoDiretorGeralEm: toDatetimeLocalInput(baixa?.atoDiretorGeralEm),
    presidenciaCienteEm: toDatetimeLocalInput(baixa?.presidenciaCienteEm),
    encaminhadoFinancasEm: toDatetimeLocalInput(baixa?.encaminhadoFinancasEm),
    notaLancamentoReferencia: baixa?.notaLancamentoReferencia || "",
    observacoes: baixa?.observacoes || "",
    justificativaSolicitante: "",
    dadosModalidade: {
      tipoDestinatario: dados.tipoDestinatario || "",
      avaliacaoPreviaReferencia: dados.avaliacaoPreviaReferencia || "",
      licitacaoReferencia: dados.licitacaoReferencia || "",
      justificativaInviabilidadeAlienacaoDoacao: dados.justificativaInviabilidadeAlienacaoDoacao || "",
      partesAproveitaveisRetiradas:
        typeof dados.partesAproveitaveisRetiradas === "boolean" ? dados.partesAproveitaveisRetiradas : false,
      setorAssistente: dados.setorAssistente || "",
      setorAssistenteObrigatorio:
        typeof dados.setorAssistenteObrigatorio === "boolean" ? dados.setorAssistenteObrigatorio : false,
      motivosInutilizacao: Array.isArray(dados.motivosInutilizacao) ? dados.motivosInutilizacao : [],
    },
    itemIds: Array.isArray(selectedItems) ? selectedItems.map((item) => item.id) : [],
  };
}

function collectPayload(form, selectedItems, mode) {
  const base = {
    processoReferencia: form.processoReferencia.trim(),
    modalidadeBaixa: form.modalidadeBaixa,
    manifestacaoSciReferencia: form.manifestacaoSciReferencia.trim(),
    manifestacaoSciEm: form.manifestacaoSciEm || null,
    atoDiretorGeralReferencia: form.atoDiretorGeralReferencia.trim(),
    atoDiretorGeralEm: form.atoDiretorGeralEm || null,
    presidenciaCienteEm: form.presidenciaCienteEm || null,
    encaminhadoFinancasEm: form.encaminhadoFinancasEm || null,
    notaLancamentoReferencia: form.notaLancamentoReferencia.trim() || null,
    observacoes: form.observacoes.trim() || null,
    dadosModalidade: {
      ...form.dadosModalidade,
      tipoDestinatario: form.dadosModalidade.tipoDestinatario || null,
      avaliacaoPreviaReferencia: form.dadosModalidade.avaliacaoPreviaReferencia || null,
      licitacaoReferencia: form.dadosModalidade.licitacaoReferencia || null,
      justificativaInviabilidadeAlienacaoDoacao: form.dadosModalidade.justificativaInviabilidadeAlienacaoDoacao || null,
      setorAssistente: form.dadosModalidade.setorAssistente || null,
    },
  };

  if ((mode || form.modalidadeBaixa) === "DESAPARECIMENTO") {
    base.bemIds = selectedItems.map((item) => item.bemId || item.id).filter(Boolean);
    return base;
  }

  base.marcacaoIds = selectedItems.map((item) => item.id || item.marcacaoInservivelId).filter(Boolean);
  return base;
}

function DetailField({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm text-slate-800">{value || "-"}</p>
    </div>
  );
}

export default function BaixaProcessDrawer({
  isOpen,
  mode,
  process,
  selectedItems,
  onClose,
  onExport,
  exportBusy = false,
  onCreateDraft,
  onUpdateDraft,
  onConclude,
  onCancel,
  canWrite,
  canExecute,
  busy = false,
}) {
  const [form, setForm] = useState(() => buildInitialForm({ process, selectedItems, mode }));

  useEffect(() => {
    setForm(buildInitialForm({ process, selectedItems, mode }));
  }, [mode, process?.baixa?.id, selectedItems]);

  if (!isOpen) return null;

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const updateModalidade = (key, value) => {
    setForm((current) => ({
      ...current,
      dadosModalidade: {
        ...current.dadosModalidade,
        [key]: value,
      },
    }));
  };

  const payload = collectPayload(form, selectedItems, mode);
  const isDraft = process?.baixa?.statusProcesso === "RASCUNHO";
  const hasProcess = Boolean(process?.baixa?.id);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Arts. 153 a 157 (AN303_Art153 a AN303_Art157)
            </p>
            <h3 className="mt-2 font-[Space_Grotesk] text-2xl font-semibold text-slate-900">
              {hasProcess ? "Processo de baixa patrimonial" : "Novo processo de baixa"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Fechar
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Processo / referência</span>
            <input
              value={form.processoReferencia}
              onChange={(event) => updateForm("processoReferencia", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Modalidade</span>
            <select
              value={form.modalidadeBaixa}
              onChange={(event) => updateForm("modalidadeBaixa", event.target.value)}
              disabled={hasProcess}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            >
              {MODALIDADES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Manifestação SCI</span>
            <input
              value={form.manifestacaoSciReferencia}
              onChange={(event) => updateForm("manifestacaoSciReferencia", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Data da manifestação SCI</span>
            <input
              type="datetime-local"
              value={form.manifestacaoSciEm}
              onChange={(event) => updateForm("manifestacaoSciEm", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Ato do Diretor-Geral</span>
            <input
              value={form.atoDiretorGeralReferencia}
              onChange={(event) => updateForm("atoDiretorGeralReferencia", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Data do ato</span>
            <input
              type="datetime-local"
              value={form.atoDiretorGeralEm}
              onChange={(event) => updateForm("atoDiretorGeralEm", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Ciência da Presidência</span>
            <input
              type="datetime-local"
              value={form.presidenciaCienteEm}
              onChange={(event) => updateForm("presidenciaCienteEm", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Encaminhado à Diretoria de Finanças</span>
            <input
              type="datetime-local"
              value={form.encaminhadoFinancasEm}
              onChange={(event) => updateForm("encaminhadoFinancasEm", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Nota de lançamento / NL</span>
            <input
              value={form.notaLancamentoReferencia}
              onChange={(event) => updateForm("notaLancamentoReferencia", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-800">Tipo de destinatário</span>
            <select
              value={form.dadosModalidade.tipoDestinatario}
              onChange={(event) => updateModalidade("tipoDestinatario", event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {DESTINATARIOS.map((item) => (
                <option key={item || "nenhum"} value={item}>
                  {item || "Não se aplica / selecionar depois"}
                </option>
              ))}
            </select>
          </label>
        </div>

        {form.modalidadeBaixa === "VENDA" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Avaliação prévia</span>
              <input
                value={form.dadosModalidade.avaliacaoPreviaReferencia}
                onChange={(event) => updateModalidade("avaliacaoPreviaReferencia", event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Licitação</span>
              <input
                value={form.dadosModalidade.licitacaoReferencia}
                onChange={(event) => updateModalidade("licitacaoReferencia", event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}

        {["INUTILIZACAO", "ABANDONO"].includes(form.modalidadeBaixa) && (
          <div className="mt-5 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Justificativa de inviabilidade da alienação/doação</span>
              <textarea
                value={form.dadosModalidade.justificativaInviabilidadeAlienacaoDoacao}
                onChange={(event) => updateModalidade("justificativaInviabilidadeAlienacaoDoacao", event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={Boolean(form.dadosModalidade.partesAproveitaveisRetiradas)}
                onChange={(event) => updateModalidade("partesAproveitaveisRetiradas", event.target.checked)}
              />
              Partes economicamente aproveitáveis já foram retiradas
            </label>
            {form.modalidadeBaixa === "INUTILIZACAO" && (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {MOTIVOS.map((item) => {
                    const checked = form.dadosModalidade.motivosInutilizacao.includes(item);
                    return (
                      <label key={item} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const next = event.target.checked
                              ? [...form.dadosModalidade.motivosInutilizacao, item]
                              : form.dadosModalidade.motivosInutilizacao.filter((current) => current !== item);
                            updateModalidade("motivosInutilizacao", next);
                          }}
                        />
                        {item}
                      </label>
                    );
                  })}
                </div>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-800">Setor assistente (quando necessário)</span>
                  <input
                    value={form.dadosModalidade.setorAssistente}
                    onChange={(event) => updateModalidade("setorAssistente", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </>
            )}
          </div>
        )}

        <label className="mt-5 block space-y-2">
          <span className="text-sm font-medium text-slate-800">Observações</span>
          <textarea
            value={form.observacoes}
            onChange={(event) => updateForm("observacoes", event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        {!canExecute && canWrite && hasProcess && isDraft && (
          <label className="mt-5 block space-y-2">
            <span className="text-sm font-medium text-slate-800">Justificativa do solicitante</span>
            <textarea
              value={form.justificativaSolicitante}
              onChange={(event) => updateForm("justificativaSolicitante", event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Itens do processo</p>
          <div className="mt-3 grid gap-3">
            {selectedItems.map((item) => (
              <DetailField
                key={item.id || item.bemId}
                label={item.numeroTombamento || item.bemId}
                value={`${item.catalogoDescricao || item.descricao || "Bem selecionado"}${item.tipoInservivel ? ` • ${item.tipoInservivel}` : ""}`}
              />
            ))}
            {selectedItems.length === 0 && <p className="text-sm text-slate-500">Nenhum item associado.</p>}
          </div>
        </div>

        {Array.isArray(process?.documentos) && process.documentos.length > 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Documentos vinculados</p>
            <div className="mt-3 space-y-2">
              {process.documentos.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                  <p className="font-semibold text-slate-900">{doc.tipo}</p>
                  <p className="mt-1 text-slate-600">{doc.titulo || "-"}</p>
                  <p className="mt-1 text-xs text-slate-500">{doc.driveUrl || "Placeholder aguardando anexo"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {hasProcess && (
            <button
              type="button"
              onClick={() => onExport(process.baixa.id)}
              disabled={exportBusy}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              {exportBusy ? "Exportando CSV..." : "Exportar CSV"}
            </button>
          )}
          {!hasProcess && (
            <button
              type="button"
              onClick={() => onCreateDraft(payload)}
              disabled={!canWrite || busy}
              className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Criar rascunho
            </button>
          )}
          {hasProcess && isDraft && (
            <>
              <button
                type="button"
                onClick={() => onUpdateDraft(process.baixa.id, payload)}
                disabled={!canWrite || busy}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                Salvar rascunho
              </button>
              <button
                type="button"
                onClick={() => onConclude(process.baixa.id, canExecute ? {} : { justificativaSolicitante: form.justificativaSolicitante })}
                disabled={!canWrite || busy}
                className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {canExecute ? "Concluir baixa" : "Solicitar conclusão"}
              </button>
              {canExecute && (
                <button
                  type="button"
                  onClick={() => onCancel(process.baixa.id)}
                  disabled={busy}
                  className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40"
                >
                  Cancelar processo
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
