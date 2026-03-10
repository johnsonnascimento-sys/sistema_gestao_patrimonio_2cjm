/**
 * Modulo: frontend/tests
 * Arquivo: InservivelAssessmentWizard.test.jsx
 * Funcao no sistema: validar a derivacao deterministica da classificacao de material inservivel no frontend.
 */
import { describe, expect, it } from "vitest";

import { deriveClassificationPreview } from "../components/InservivelAssessmentWizard.jsx";

describe("deriveClassificationPreview", () => {
  it("classifica como OCIOSO quando o bem esta em condicoes, mas sem aproveitamento", () => {
    const result = deriveClassificationPreview({
      condicaoUso: "EM_CONDICOES",
      emAproveitamento: "nao",
    });

    expect(result.tipoInservivel).toBe("OCIOSO");
    expect(result.error).toBe("");
  });

  it("classifica como RECUPERAVEL quando o custo de recuperacao nao passa de 50%", () => {
    const result = deriveClassificationPreview({
      condicaoUso: "EM_CONDICOES",
      emAproveitamento: "sim",
      valorMercadoEstimado: "1000",
      custoRecuperacaoEstimado: "500",
    });

    expect(result.tipoInservivel).toBe("RECUPERAVEL");
    expect(result.error).toBe("");
  });

  it("classifica como ANTIECONOMICO quando manutencao onerosa, rendimento precario ou obsolescencia forem marcados", () => {
    const result = deriveClassificationPreview({
      condicaoUso: "EM_CONDICOES",
      emAproveitamento: "sim",
      manutencaoOnerosa: "sim",
      rendimentoPrecario: "nao",
      obsoleto: "nao",
    });

    expect(result.tipoInservivel).toBe("ANTIECONOMICO");
    expect(result.error).toBe("");
  });

  it("classifica como IRRECUPERAVEL quando ha perda de caracteristicas ou inviabilidade economica", () => {
    const result = deriveClassificationPreview({
      condicaoUso: "SEM_CONDICOES",
      emAproveitamento: "nao",
      perdaCaracteristicas: "sim",
      inviabilidadeEconomicaRecuperacao: "nao",
    });

    expect(result.tipoInservivel).toBe("IRRECUPERAVEL");
    expect(result.error).toBe("");
  });
});
