/**
 * Modulo: frontend/components
 * Arquivo: ClassificationWizard.jsx
 * Funcao no sistema: wizard de classificacao de inserviveis conforme Art. 141.
 */
import { useMemo, useState } from "react";

const STEPS = [
  {
    id: "descricao",
    titulo: "Identificacao do bem",
    hint: "Descreva o item que sera classificado.",
  },
  {
    id: "ocioso",
    titulo: "O bem esta em condicao de uso, mas sem aproveitamento?",
    hint: "Resposta positiva gera classificacao OCIOSO.",
  },
  {
    id: "recuperavel",
    titulo: "A recuperacao custa ate 50% do valor de mercado?",
    hint: "Resposta positiva gera classificacao RECUPERAVEL.",
  },
  {
    id: "antieconomico",
    titulo: "A manutencao e onerosa ou o item esta obsoleto?",
    hint: "Resposta positiva gera classificacao ANTIECONOMICO.",
  },
];

function deriveClassification(answers) {
  if (answers.ocioso === "sim") return "OCIOSO";
  if (answers.recuperavel === "sim") return "RECUPERAVEL";
  if (answers.antieconomico === "sim") return "ANTIECONOMICO";
  return "IRRECUPERAVEL";
}

export default function ClassificationWizard({ isOpen, onClose, onSave }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    descricao: "",
    ocioso: "",
    recuperavel: "",
    antieconomico: "",
  });

  const current = STEPS[step];
  const canAdvance = useMemo(() => {
    if (current.id === "descricao") return answers.descricao.trim().length >= 4;
    return answers[current.id] === "sim" || answers[current.id] === "nao";
  }, [answers, current]);

  if (!isOpen) return null;

  const next = () => {
    if (!canAdvance) return;
    if (step === STEPS.length - 1) {
      const classificacao = deriveClassification(answers);
      const justificativa =
        classificacao === "IRRECUPERAVEL"
          ? "Não atende critérios de uso, recuperação econômica ou manutenção viável."
          : `Classificado como ${classificacao} pelos criterios informados no wizard.`;
      onSave({
        descricaoBem: answers.descricao,
        classificacao,
        justificativa,
      });
      setStep(0);
      setAnswers({
        descricao: "",
        ocioso: "",
        recuperavel: "",
        antieconomico: "",
      });
      return;
    }
    setStep((v) => v + 1);
  };

  const back = () => setStep((v) => Math.max(v - 1, 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur">
      <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-slate-900 p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-widest text-cyan-200">
          Art. 141 (AN303_Art141_Cap, I, II, III, IV)
        </p>
        <h3 className="mt-2 font-[Space_Grotesk] text-2xl font-bold">{current.titulo}</h3>
        <p className="mt-1 text-sm text-slate-300">{current.hint}</p>

        <div className="mt-5 rounded-2xl border border-white/15 bg-slate-950/40 p-4">
          {current.id === "descricao" ? (
            <label className="space-y-2">
              <span className="text-sm text-slate-200">Descrição do bem</span>
              <input
                value={answers.descricao}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, descricao: e.target.value }))
                }
                placeholder="Ex.: Monitor LCD 24 polegadas"
                className="w-full rounded-xl border border-white/25 bg-slate-800 px-3 py-2 text-sm outline-none ring-cyan-200/40 focus:ring"
              />
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: "sim" }))}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  answers[current.id] === "sim"
                    ? "border-cyan-200 bg-cyan-200 text-slate-900"
                    : "border-white/20 bg-slate-800 hover:border-cyan-300/70"
                }`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setAnswers((prev) => ({ ...prev, [current.id]: "nao" }))}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  answers[current.id] === "nao"
                    ? "border-amber-200 bg-amber-200 text-slate-900"
                    : "border-white/20 bg-slate-800 hover:border-amber-300/70"
                }`}
              >
                Não
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/25 px-3 py-2 text-sm hover:bg-white/10"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={step === 0}
              onClick={back}
              className="rounded-lg border border-white/25 px-3 py-2 text-sm disabled:opacity-40"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={!canAdvance}
              onClick={next}
              className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-45"
            >
              {step === STEPS.length - 1 ? "Salvar classificacao" : "Avancar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
