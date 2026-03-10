/**
 * Modulo: backend/tests
 * Arquivo: materialInservivelBaixa.test.js
 * Funcao no sistema: validar regras puras de material inservivel e baixa patrimonial.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeAvaliacaoInput,
  validateConclusaoBaixaRules,
} = require("../../src/services/materialInservivelBaixa");

test("normalizeAvaliacaoInput aceita RECUPERAVEL quando custo <= 50% do valor", () => {
  const input = normalizeAvaliacaoInput({
    descricaoInformada: "Notebook com placa principal defeituosa",
    justificativa: "Recuperacao economicamente viavel e remanejamento local desaconselhado.",
    destinacaoSugerida: "DOACAO",
    criterios: {
      condicaoUso: "SEM_CONDICOES",
      valorMercadoEstimado: 1000,
      custoRecuperacaoEstimado: 500,
      remanejamentoViavel: false,
      permanenciaDesaconselhavel: true,
    },
  });

  assert.equal(input.tipoInservivel, "RECUPERAVEL");
  assert.equal(input.statusFluxoPadrao, "AGUARDANDO_DESTINACAO");
});

test("normalizeAvaliacaoInput rejeita IRRECUPERAVEL sem perda ou inviabilidade", () => {
  assert.throws(
    () =>
      normalizeAvaliacaoInput({
        descricaoInformada: "Equipamento sem uso",
        justificativa: "Sem condicoes de uso.",
        criterios: {
          condicaoUso: "SEM_CONDICOES",
          remanejamentoViavel: false,
        },
      }),
    /Item irrecuperavel exige perdaCaracteristicas ou inviabilidadeEconomicaRecuperacao/i,
  );
});

test("validateConclusaoBaixaRules rejeita VENDA sem avaliacao previa ou licitacao", () => {
  assert.throws(
    () =>
      validateConclusaoBaixaRules({
        modalidadeBaixa: "VENDA",
        itens: [{ tipoInservivel: "ANTIECONOMICO", unidadeDonaId: 4 }],
        dadosModalidade: {},
        presidenciaCienteEm: null,
        manifestacaoSciReferencia: "SCI-1",
        atoDiretorGeralReferencia: "DG-1",
        notaLancamentoReferencia: null,
      }),
    /VENDA exige avaliacaoPreviaReferencia/i,
  );
});

test("validateConclusaoBaixaRules rejeita DOACAO para destinatario incompativel", () => {
  assert.throws(
    () =>
      validateConclusaoBaixaRules({
        modalidadeBaixa: "DOACAO",
        itens: [{ tipoInservivel: "IRRECUPERAVEL", unidadeDonaId: 4 }],
        dadosModalidade: { tipoDestinatario: "ESTADO" },
        presidenciaCienteEm: null,
        manifestacaoSciReferencia: "SCI-2",
        atoDiretorGeralReferencia: "DG-2",
        notaLancamentoReferencia: null,
      }),
    /DOACAO nao permitida/i,
  );
});

test("validateConclusaoBaixaRules exige motivo estruturado em INUTILIZACAO", () => {
  assert.throws(
    () =>
      validateConclusaoBaixaRules({
        modalidadeBaixa: "INUTILIZACAO",
        itens: [{ tipoInservivel: "IRRECUPERAVEL", unidadeDonaId: 4 }],
        dadosModalidade: {
          justificativaInviabilidadeAlienacaoDoacao: "Sem utilidade e sem interesse de terceiros.",
          partesAproveitaveisRetiradas: true,
          motivosInutilizacao: [],
        },
        presidenciaCienteEm: "2026-03-10T12:00:00Z",
        manifestacaoSciReferencia: "SCI-3",
        atoDiretorGeralReferencia: "DG-3",
        notaLancamentoReferencia: null,
      }),
    /INUTILIZACAO exige ao menos um motivo estruturado/i,
  );
});

test("validateConclusaoBaixaRules exige justificativa especifica em ABANDONO", () => {
  assert.throws(
    () =>
      validateConclusaoBaixaRules({
        modalidadeBaixa: "ABANDONO",
        itens: [{ tipoInservivel: "IRRECUPERAVEL", unidadeDonaId: 4 }],
        dadosModalidade: {
          partesAproveitaveisRetiradas: false,
        },
        presidenciaCienteEm: "2026-03-10T12:00:00Z",
        manifestacaoSciReferencia: "SCI-4",
        atoDiretorGeralReferencia: "DG-4",
        notaLancamentoReferencia: null,
      }),
    /ABANDONO exige justificativaInviabilidadeAlienacaoDoacao/i,
  );
});

test("validateConclusaoBaixaRules aceita DESAPARECIMENTO sem classificacao de inservivel", () => {
  const out = validateConclusaoBaixaRules({
    modalidadeBaixa: "DESAPARECIMENTO",
    itens: [{ tipoInservivel: null, unidadeDonaId: 2 }],
    dadosModalidade: {},
    presidenciaCienteEm: null,
    manifestacaoSciReferencia: "SCI-5",
    atoDiretorGeralReferencia: "DG-5",
    notaLancamentoReferencia: null,
  });

  assert.equal(out.modalidadeBaixa, "DESAPARECIMENTO");
  assert.ok(out.placeholderDocumentTypes.includes("PARECER_SCI"));
});
