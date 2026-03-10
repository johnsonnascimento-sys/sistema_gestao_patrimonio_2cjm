/**
 * Modulo: frontend/components
 * Arquivo: InservivelAssessmentWizard.jsx
 * Funcao no sistema: conduzir avaliacao guiada de material inservivel e preparar marcacao auditavel.
 */
import { useEffect, useMemo, useState } from "react";

const STEPS = [
  { id: "identificacao", title: "Identificação do bem" },
  { id: "uso", title: "Condição de uso" },
  { id: "economia", title: "Análise econômica" },
  { id: "remanejamento", title: "Remanejamento e destinação" },
  { id: "fechamento", title: "Justificativa e evidências" },
];

const BOOLEAN_CHOICES = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

const DESTINACOES = [
  "",
  "VENDA",
  "CESSAO",
  "DOACAO",
  "PERMUTA",
  "INUTILIZACAO",
  "ABANDONO",
];

function choiceToBoolean(value) {
  if (value === "sim") return true;
  if (value === "nao") return false;
  return null;
}

function toNumberOrNull(value) {
  if (value == null || String(value).trim() === "") return null;
  const num = Number(String(value).replace(",", "."));
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function deriveClassificationPreview(form) {
  const condicaoUso = form.condicaoUso;
  const emAproveitamento = choiceToBoolean(form.emAproveitamento);
  const valorMercadoEstimado = toNumberOrNull(form.valorMercadoEstimado);
  const custoRecuperacaoEstimado = toNumberOrNull(form.custoRecuperacaoEstimado);
  const manutencaoOnerosa = choiceToBoolean(form.manutencaoOnerosa) === true;
  const rendimentoPrecario = choiceToBoolean(form.rendimentoPrecario) === true;
  const obsoleto = choiceToBoolean(form.obsoleto) === true;
  const perdaCaracteristicas = choiceToBoolean(form.perdaCaracteristicas) === true;
  const inviabilidadeEconomicaRecuperacao = choiceToBoolean(form.inviabilidadeEconomicaRecuperacao) === true;

  if (condicaoUso === "EM_CONDICOES" && emAproveitamento === false) {
    return { tipoInservivel: "OCIOSO", error: "" };
  }

  if (valorMercadoEstimado != null || custoRecuperacaoEstimado != null) {
    if (valorMercadoEstimado == null || valorMercadoEstimado <= 0) {
      return { tipoInservivel: "", error: "Informe valor de mercado válido para avaliar recuperação." };
    }
    if (custoRecuperacaoEstimado == null) {
      return { tipoInservivel: "", error: "Informe o custo de recuperação." };
    }
    if (custoRecuperacaoEstimado <= valorMercadoEstimado * 0.5) {
      return { tipoInservivel: "RECUPERAVEL", error: "" };
    }
  }

  if (manutencaoOnerosa || rendimentoPrecario || obsoleto) {
    return { tipoInservivel: "ANTIECONOMICO", error: "" };
  }

  if (perdaCaracteristicas || inviabilidadeEconomicaRecuperacao || condicaoUso === "SEM_CONDICOES") {
    if (!perdaCaracteristicas && !inviabilidadeEconomicaRecuperacao) {
      return {
        tipoInservivel: "",
        error: "Marque perda de características ou inviabilidade econômica para classificar como irrecuperável.",
      };
    }
    return { tipoInservivel: "IRRECUPERAVEL", error: "" };
  }

  return {
    tipoInservivel: "",
    error: "Os critérios ainda não permitem classificar o bem como material inservível.",
  };
}

function buildInitialState(bem) {
  return {
    descricaoInformada: bem?.catalogo?.descricao || bem?.catalogoDescricao || "",
    condicaoUso: "EM_CONDICOES",
    emAproveitamento: "",
    valorMercadoEstimado: "",
    custoRecuperacaoEstimado: "",
    manutencaoOnerosa: "",
    rendimentoPrecario: "",
    obsoleto: "",
    remanejamentoViavel: "",
    permanenciaDesaconselhavel: "",
    perdaCaracteristicas: "",
    inviabilidadeEconomicaRecuperacao: "",
    destinacaoSugerida: "",
    justificativa: "",
    observacoes: "",
    driveUrlEvidencia: "",
  };
}

function BooleanChoice({ label, value, onChange }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {BOOLEAN_CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            onClick={() => onChange(choice.value)}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
              value === choice.value
                ? "border-violet-300 bg-violet-50 text-slate-900"
                : "border-slate-200 bg-white text-slate-700 hover:border-violet-200"
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </label>
  );
}

export default function InservivelAssessmentWizard({
  bem,
  onSubmit,
  busy = false,
  disabled = false,
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => buildInitialState(bem));

  useEffect(() => {
    setForm(buildInitialState(bem));
    setStep(0);
  }, [bem?.bem?.id, bem?.id]);

  const preview = useMemo(() => deriveClassificationPreview(form), [form]);
  const canAdvance = useMemo(() => {
    if (step === 0) return form.descricaoInformada.trim().length >= 4;
    if (step === 1) return Boolean(form.condicaoUso) && Boolean(form.emAproveitamento || form.condicaoUso === "SEM_CONDICOES");
    if (step === 2) {
      if (form.valorMercadoEstimado || form.custoRecuperacaoEstimado) {
        return toNumberOrNull(form.valorMercadoEstimado) != null && toNumberOrNull(form.custoRecuperacaoEstimado) != null;
      }
      return true;
    }
    if (step === 3) return Boolean(form.remanejamentoViavel) && Boolean(form.permanenciaDesaconselhavel || form.remanejamentoViavel === "nao");
    if (step === 4) return Boolean(preview.tipoInservivel) && form.justificativa.trim().length >= 12;
    return false;
  }, [form, preview.tipoInservivel, step]);

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = () => {
    if (!canAdvance || busy || disabled || !bem?.bem?.id) return;
    onSubmit({
      bemId: bem.bem.id,
      descricaoInformada: form.descricaoInformada.trim(),
      justificativa: form.justificativa.trim(),
      observacoes: form.observacoes.trim() || null,
      driveUrlEvidencia: form.driveUrlEvidencia.trim() || null,
      destinacaoSugerida: form.destinacaoSugerida || null,
      criterios: {
        condicaoUso: form.condicaoUso,
        emAproveitamento: choiceToBoolean(form.emAproveitamento),
        valorMercadoEstimado: toNumberOrNull(form.valorMercadoEstimado),
        custoRecuperacaoEstimado: toNumberOrNull(form.custoRecuperacaoEstimado),
        manutencaoOnerosa: choiceToBoolean(form.manutencaoOnerosa),
        rendimentoPrecario: choiceToBoolean(form.rendimentoPrecario),
        obsoleto: choiceToBoolean(form.obsoleto),
        remanejamentoViavel: choiceToBoolean(form.remanejamentoViavel),
        permanenciaDesaconselhavel: choiceToBoolean(form.permanenciaDesaconselhavel),
        perdaCaracteristicas: choiceToBoolean(form.perdaCaracteristicas),
        inviabilidadeEconomicaRecuperacao: choiceToBoolean(form.inviabilidadeEconomicaRecuperacao),
        destinacaoSugerida: form.destinacaoSugerida || null,
      },
      tipoInservivelPreview: preview.tipoInservivel,
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
            Arts. 141 a 152 (AN303_Art141_* a AN303_Art152)
          </p>
          <h3 className="mt-2 font-[Space_Grotesk] text-2xl font-semibold text-slate-900">
            Triagem guiada de material inservível
          </h3>
        </div>
        <div className="rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm">
          <span className="block text-xs uppercase tracking-[0.18em] text-slate-500">Prévia da classe</span>
          <strong className="mt-1 block text-violet-700">{preview.tipoInservivel || "Aguardando critérios"}</strong>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => index <= step && setStep(index)}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
              index === step
                ? "bg-violet-700 text-white"
                : index < step
                  ? "bg-violet-100 text-violet-800"
                  : "bg-white text-slate-500"
            }`}
          >
            {index + 1}. {item.title}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        {step === 0 && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Descrição utilizada na avaliação</span>
              <textarea
                value={form.descricaoInformada}
                onChange={(event) => updateField("descricaoInformada", event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-300"
              />
            </label>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Bem selecionado</p>
              <p className="mt-2"><span className="font-medium">Tombo:</span> {bem?.bem?.numeroTombamento || "-"}</p>
              <p className="mt-1"><span className="font-medium">Descrição:</span> {bem?.catalogo?.descricao || "-"}</p>
              <p className="mt-1"><span className="font-medium">Local:</span> {bem?.bem?.localFisico || "-"}</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Condição geral de uso</span>
              <select
                value={form.condicaoUso}
                onChange={(event) => updateField("condicaoUso", event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="EM_CONDICOES">Em condições de uso</option>
                <option value="SEM_CONDICOES">Sem condições de uso</option>
              </select>
            </label>
            <BooleanChoice
              label="O bem está sendo aproveitado atualmente?"
              value={form.emAproveitamento}
              onChange={(value) => updateField("emAproveitamento", value)}
            />
            <BooleanChoice
              label="Há perda de características essenciais?"
              value={form.perdaCaracteristicas}
              onChange={(value) => updateField("perdaCaracteristicas", value)}
            />
            <BooleanChoice
              label="Há inviabilidade econômica da recuperação?"
              value={form.inviabilidadeEconomicaRecuperacao}
              onChange={(value) => updateField("inviabilidadeEconomicaRecuperacao", value)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Valor de mercado estimado (R$)</span>
              <input
                value={form.valorMercadoEstimado}
                onChange={(event) => updateField("valorMercadoEstimado", event.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 1200,00"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Custo de recuperação estimado (R$)</span>
              <input
                value={form.custoRecuperacaoEstimado}
                onChange={(event) => updateField("custoRecuperacaoEstimado", event.target.value)}
                inputMode="decimal"
                placeholder="Ex.: 400,00"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <BooleanChoice
              label="A manutenção está onerosa?"
              value={form.manutencaoOnerosa}
              onChange={(value) => updateField("manutencaoOnerosa", value)}
            />
            <BooleanChoice
              label="O rendimento está precário?"
              value={form.rendimentoPrecario}
              onChange={(value) => updateField("rendimentoPrecario", value)}
            />
            <BooleanChoice
              label="Há obsolescência relevante?"
              value={form.obsoleto}
              onChange={(value) => updateField("obsoleto", value)}
            />
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-5 lg:grid-cols-2">
            <BooleanChoice
              label="O remanejamento no âmbito do Tribunal é viável?"
              value={form.remanejamentoViavel}
              onChange={(value) => updateField("remanejamentoViavel", value)}
            />
            <BooleanChoice
              label="A permanência do bem é desaconselhável?"
              value={form.permanenciaDesaconselhavel}
              onChange={(value) => updateField("permanenciaDesaconselhavel", value)}
            />
            <label className="space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-slate-800">Destinação sugerida</span>
              <select
                value={form.destinacaoSugerida}
                onChange={(event) => updateField("destinacaoSugerida", event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {DESTINACOES.map((item) => (
                  <option key={item || "vazio"} value={item}>
                    {item || "Selecione uma destinação"}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5">
            <div className={`rounded-2xl border px-4 py-3 text-sm ${preview.error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
              {preview.error || `Classificação sugerida pelo wizard: ${preview.tipoInservivel}.`}
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Justificativa formal</span>
              <textarea
                value={form.justificativa}
                onChange={(event) => updateField("justificativa", event.target.value)}
                rows={5}
                placeholder="Descreva os fatos e a motivação conforme os arts. 141 a 152."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">Observações internas</span>
              <textarea
                value={form.observacoes}
                onChange={(event) => updateField("observacoes", event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-800">URL de evidência (opcional)</span>
              <input
                value={form.driveUrlEvidencia}
                onChange={(event) => updateField("driveUrlEvidencia", event.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(current - 1, 0))}
          disabled={step === 0 || busy}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
        >
          Voltar
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setForm(buildInitialState(bem))}
            disabled={busy}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Limpar formulário
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => canAdvance && setStep((current) => Math.min(current + 1, STEPS.length - 1))}
              disabled={!canAdvance || busy}
              className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Avançar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canAdvance || busy || disabled}
              className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Salvando..." : "Salvar avaliação e marcar"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export { deriveClassificationPreview };
