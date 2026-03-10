/**
 * Modulo: backend/services
 * Arquivo: materialInservivelBaixa.js
 * Funcao no sistema: centralizar regras validaveis de classificacao de inserviveis e baixa patrimonial.
 */
"use strict";

const TIPOS_INSERVIVEL = Object.freeze(["OCIOSO", "RECUPERAVEL", "ANTIECONOMICO", "IRRECUPERAVEL"]);
const DESTINACOES_INSERVIVEL = Object.freeze(["VENDA", "CESSAO", "DOACAO", "PERMUTA", "INUTILIZACAO", "ABANDONO"]);
const STATUS_FLUXO_INSERVIVEL = Object.freeze([
  "MARCADO_TRIAGEM",
  "AGUARDANDO_DESTINACAO",
  "EM_PROCESSO_BAIXA",
  "RETIRADO_FILA",
  "BAIXADO",
]);
const MODALIDADES_BAIXA = Object.freeze([
  "VENDA",
  "CESSAO",
  "DOACAO",
  "PERMUTA",
  "INUTILIZACAO",
  "ABANDONO",
  "DESAPARECIMENTO",
]);
const STATUS_PROCESSO_BAIXA = Object.freeze(["RASCUNHO", "CONCLUIDO", "CANCELADO"]);
const MOTIVOS_INUTILIZACAO = Object.freeze([
  "AMEACA_VITAL",
  "PREJUIZO_ECOLOGICO",
  "CONTAMINACAO",
  "INFESTACAO",
  "TOXICIDADE",
  "RISCO_FRAUDE",
  "OUTRO",
]);
const TIPO_DESTINATARIO = Object.freeze([
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
]);

function normalizeUpper(raw) {
  return String(raw || "").trim().toUpperCase();
}

function parseBooleanFlexible(raw) {
  if (typeof raw === "boolean") return raw;
  if (raw == null || String(raw).trim() === "") return null;
  const v = String(raw).trim().toLowerCase();
  if (["1", "true", "sim", "yes"].includes(v)) return true;
  if (["0", "false", "nao", "não", "no"].includes(v)) return false;
  return null;
}

function parseNullableNumber(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Valor numerico invalido.");
  }
  return n;
}

function deriveTipoInservivel(criterios) {
  const c = criterios && typeof criterios === "object" ? criterios : {};
  const condicaoUso = normalizeUpper(c.condicaoUso);
  const emAproveitamento = parseBooleanFlexible(c.emAproveitamento);
  const valorMercadoEstimado = parseNullableNumber(c.valorMercadoEstimado);
  const custoRecuperacaoEstimado = parseNullableNumber(c.custoRecuperacaoEstimado);
  const manutencaoOnerosa = parseBooleanFlexible(c.manutencaoOnerosa) === true;
  const rendimentoPrecario = parseBooleanFlexible(c.rendimentoPrecario) === true;
  const obsoleto = parseBooleanFlexible(c.obsoleto) === true;
  const perdaCaracteristicas = parseBooleanFlexible(c.perdaCaracteristicas) === true;
  const inviabilidadeEconomicaRecuperacao = parseBooleanFlexible(c.inviabilidadeEconomicaRecuperacao) === true;

  if (!["EM_CONDICOES", "SEM_CONDICOES"].includes(condicaoUso)) {
    throw new Error("condicaoUso deve ser EM_CONDICOES ou SEM_CONDICOES.");
  }
  if (condicaoUso === "EM_CONDICOES" && emAproveitamento === false) {
    return {
      tipoInservivel: "OCIOSO",
      valorMercadoEstimado,
      custoRecuperacaoEstimado,
    };
  }

  if (valorMercadoEstimado != null || custoRecuperacaoEstimado != null) {
    if (valorMercadoEstimado == null || valorMercadoEstimado <= 0) {
      throw new Error("valorMercadoEstimado deve ser informado e maior que zero.");
    }
    if (custoRecuperacaoEstimado == null) {
      throw new Error("custoRecuperacaoEstimado deve ser informado.");
    }
    if (custoRecuperacaoEstimado <= valorMercadoEstimado * 0.5) {
      return {
        tipoInservivel: "RECUPERAVEL",
        valorMercadoEstimado,
        custoRecuperacaoEstimado,
      };
    }
  }

  if (manutencaoOnerosa || rendimentoPrecario || obsoleto) {
    return {
      tipoInservivel: "ANTIECONOMICO",
      valorMercadoEstimado,
      custoRecuperacaoEstimado,
    };
  }

  if (perdaCaracteristicas || inviabilidadeEconomicaRecuperacao || condicaoUso === "SEM_CONDICOES") {
    if (!perdaCaracteristicas && !inviabilidadeEconomicaRecuperacao) {
      throw new Error("Item irrecuperavel exige perdaCaracteristicas ou inviabilidadeEconomicaRecuperacao.");
    }
    return {
      tipoInservivel: "IRRECUPERAVEL",
      valorMercadoEstimado,
      custoRecuperacaoEstimado,
    };
  }

  throw new Error("Os criterios informados nao caracterizam material inservivel conforme Art. 141.");
}

function normalizeAvaliacaoInput(body) {
  const raw = body && typeof body === "object" ? body : {};
  const criterios = raw.criterios && typeof raw.criterios === "object" ? { ...raw.criterios } : {};
  const descricaoInformada = raw.descricaoInformada != null
    ? String(raw.descricaoInformada).trim().slice(0, 2000)
    : "";
  const justificativa = raw.justificativa != null
    ? String(raw.justificativa).trim().slice(0, 4000)
    : "";
  const remanejamentoViavel = parseBooleanFlexible(criterios.remanejamentoViavel);
  const permanenciaDesaconselhavel = parseBooleanFlexible(criterios.permanenciaDesaconselhavel);
  const destinacaoSugerida = raw.destinacaoSugerida != null
    ? normalizeUpper(raw.destinacaoSugerida)
    : (criterios.destinacaoSugerida != null ? normalizeUpper(criterios.destinacaoSugerida) : "");

  const derivado = deriveTipoInservivel(criterios);
  const tipoExplicito = raw.tipoInservivel != null ? normalizeUpper(raw.tipoInservivel) : "";
  if (tipoExplicito && tipoExplicito !== derivado.tipoInservivel) {
    throw new Error("tipoInservivel nao confere com os criterios informados.");
  }
  if (destinacaoSugerida && !DESTINACOES_INSERVIVEL.includes(destinacaoSugerida)) {
    throw new Error("destinacaoSugerida invalida.");
  }
  if (!descricaoInformada) {
    throw new Error("descricaoInformada e obrigatoria.");
  }
  if (!justificativa) {
    throw new Error("justificativa e obrigatoria.");
  }
  if (derivado.tipoInservivel === "IRRECUPERAVEL" && justificativa.length < 12) {
    throw new Error("IRRECUPERAVEL exige justificativa explicita.");
  }

  const prontoParaBaixa = permanenciaDesaconselhavel === true || remanejamentoViavel === false;
  return {
    descricaoInformada,
    justificativa,
    criterios: {
      ...criterios,
      valorMercadoEstimado: derivado.valorMercadoEstimado,
      custoRecuperacaoEstimado: derivado.custoRecuperacaoEstimado,
      remanejamentoViavel,
      permanenciaDesaconselhavel,
      destinacaoSugerida: destinacaoSugerida || null,
    },
    tipoInservivel: derivado.tipoInservivel,
    destinacaoSugerida: destinacaoSugerida || null,
    statusFluxoPadrao: prontoParaBaixa ? "AGUARDANDO_DESTINACAO" : "MARCADO_TRIAGEM",
  };
}

function normalizeMarcacaoInput(body) {
  const raw = body && typeof body === "object" ? body : {};
  const tipoInservivel = normalizeUpper(raw.tipoInservivel);
  const destinacaoSugerida = raw.destinacaoSugerida != null ? normalizeUpper(raw.destinacaoSugerida) : "";
  const statusFluxo = raw.statusFluxo != null ? normalizeUpper(raw.statusFluxo) : "";
  if (!TIPOS_INSERVIVEL.includes(tipoInservivel)) throw new Error("tipoInservivel invalido.");
  if (destinacaoSugerida && !DESTINACOES_INSERVIVEL.includes(destinacaoSugerida)) {
    throw new Error("destinacaoSugerida invalida.");
  }
  if (statusFluxo && !STATUS_FLUXO_INSERVIVEL.includes(statusFluxo)) {
    throw new Error("statusFluxo invalido.");
  }
  return {
    tipoInservivel,
    destinacaoSugerida: destinacaoSugerida || null,
    statusFluxo: statusFluxo || "MARCADO_TRIAGEM",
    observacoes: raw.observacoes != null ? String(raw.observacoes).trim().slice(0, 4000) : null,
  };
}

function validateDoacaoDestinatario(tipoInservivel, tipoDestinatario) {
  const allow = {
    OCIOSO: ["ADMIN_PUBLICA_FEDERAL", "OUTROS_PODERES_UNIAO"],
    RECUPERAVEL: ["ADMIN_PUBLICA_FEDERAL", "OUTROS_PODERES_UNIAO"],
    ANTIECONOMICO: ["ESTADO", "MUNICIPIO", "DISTRITO_FEDERAL", "EMPRESA_PUBLICA", "SOCIEDADE_ECONOMIA_MISTA", "INSTITUICAO_FILANTROPICA", "OSCIP"],
    IRRECUPERAVEL: ["INSTITUICAO_FILANTROPICA", "OSCIP"],
  };
  const list = allow[tipoInservivel] || [];
  return list.includes(tipoDestinatario);
}

function getBaixaPlaceholderDocumentTypes(modalidadeBaixa, hasNotaLancamento) {
  const docs = ["PARECER_SCI", "ATO_DIRETOR_GERAL"];
  if (modalidadeBaixa === "VENDA") docs.push("TERMO_ALIENACAO");
  if (modalidadeBaixa === "CESSAO") docs.push("TERMO_CESSAO");
  if (modalidadeBaixa === "DOACAO") docs.push("TERMO_DOACAO");
  if (modalidadeBaixa === "PERMUTA") docs.push("TERMO_PERMUTA");
  if (modalidadeBaixa === "INUTILIZACAO") docs.push("TERMO_INUTILIZACAO");
  if (modalidadeBaixa === "ABANDONO") docs.push("JUSTIFICATIVA_ABANDONO");
  if (hasNotaLancamento) docs.push("NOTA_LANCAMENTO_SIAFI");
  return docs;
}

function validateConclusaoBaixaRules({
  modalidadeBaixa,
  itens,
  dadosModalidade,
  presidenciaCienteEm,
  manifestacaoSciReferencia,
  atoDiretorGeralReferencia,
  notaLancamentoReferencia,
}) {
  const modalidade = normalizeUpper(modalidadeBaixa);
  const dados = dadosModalidade && typeof dadosModalidade === "object" ? dadosModalidade : {};
  const itensNorm = Array.isArray(itens) ? itens : [];
  if (!MODALIDADES_BAIXA.includes(modalidade)) {
    throw new Error("modalidadeBaixa invalida.");
  }
  if (!manifestacaoSciReferencia) throw new Error("manifestacaoSciReferencia e obrigatoria.");
  if (!atoDiretorGeralReferencia) throw new Error("atoDiretorGeralReferencia e obrigatoria.");
  if (!itensNorm.length) throw new Error("Selecione ao menos um bem para o processo.");

  const tipos = itensNorm.map((item) => normalizeUpper(item?.tipoInservivel)).filter(Boolean);
  const unidades = itensNorm.map((item) => Number(item?.unidadeDonaId)).filter((n) => Number.isInteger(n));
  const tipoDestinatario = dados.tipoDestinatario ? normalizeUpper(dados.tipoDestinatario) : "";
  if (tipoDestinatario && !TIPO_DESTINATARIO.includes(tipoDestinatario)) {
    throw new Error("tipoDestinatario invalido.");
  }

  if (modalidade === "VENDA") {
    if (!dados.avaliacaoPreviaReferencia) throw new Error("VENDA exige avaliacaoPreviaReferencia.");
    if (!dados.licitacaoReferencia) throw new Error("VENDA exige licitacaoReferencia.");
  }

  if (modalidade === "DOACAO") {
    if (!tipoDestinatario) throw new Error("DOACAO exige tipoDestinatario.");
    const invalid = tipos.find((tipo) => !validateDoacaoDestinatario(tipo, tipoDestinatario));
    if (invalid) {
      throw new Error(`DOACAO nao permitida para ${invalid} com destinatario ${tipoDestinatario}.`);
    }
  }

  if (modalidade === "PERMUTA") {
    if (tipoDestinatario !== "ADMINISTRACAO_PUBLICA") {
      throw new Error("PERMUTA exige tipoDestinatario=ADMINISTRACAO_PUBLICA.");
    }
  }

  if (modalidade === "CESSAO") {
    if (!tipoDestinatario || !["ADMINISTRACAO_PUBLICA", "ORGAO_ENTIDADE_PUBLICA"].includes(tipoDestinatario)) {
      throw new Error("CESSAO exige destinatario publico.");
    }
  }

  if (modalidade === "INUTILIZACAO" || modalidade === "ABANDONO") {
    if (tipos.some((tipo) => tipo !== "IRRECUPERAVEL")) {
      throw new Error(`${modalidade} exige itens classificados como IRRECUPERAVEL.`);
    }
    if (!dados.justificativaInviabilidadeAlienacaoDoacao) {
      throw new Error(`${modalidade} exige justificativaInviabilidadeAlienacaoDoacao.`);
    }
    if (!presidenciaCienteEm) {
      throw new Error(`${modalidade} exige presidenciaCienteEm.`);
    }
    if (typeof dados.partesAproveitaveisRetiradas !== "boolean") {
      throw new Error(`${modalidade} exige informar partesAproveitaveisRetiradas.`);
    }
  }

  if (modalidade === "INUTILIZACAO") {
    const motivos = Array.isArray(dados.motivosInutilizacao)
      ? dados.motivosInutilizacao.map((item) => normalizeUpper(item)).filter(Boolean)
      : [];
    if (!motivos.length) throw new Error("INUTILIZACAO exige ao menos um motivo estruturado.");
    const invalid = motivos.find((item) => !MOTIVOS_INUTILIZACAO.includes(item));
    if (invalid) throw new Error(`Motivo de inutilizacao invalido: ${invalid}.`);
    if (dados.setorAssistenteObrigatorio && !dados.setorAssistente) {
      throw new Error("setorAssistente e obrigatorio quando setorAssistenteObrigatorio=true.");
    }
  }

  if (["DOACAO", "PERMUTA"].includes(modalidade) && unidades.some((item) => [1, 2, 3].includes(item))) {
    if (!notaLancamentoReferencia) {
      throw new Error(`${modalidade} exige notaLancamentoReferencia para unidades 1, 2 ou 3.`);
    }
  }

  return {
    modalidadeBaixa: modalidade,
    tipoDestinatario: tipoDestinatario || null,
    placeholderDocumentTypes: getBaixaPlaceholderDocumentTypes(modalidade, Boolean(notaLancamentoReferencia)),
  };
}

module.exports = {
  DESTINACOES_INSERVIVEL,
  MODALIDADES_BAIXA,
  MOTIVOS_INUTILIZACAO,
  STATUS_FLUXO_INSERVIVEL,
  STATUS_PROCESSO_BAIXA,
  TIPO_DESTINATARIO,
  TIPOS_INSERVIVEL,
  deriveTipoInservivel,
  getBaixaPlaceholderDocumentTypes,
  normalizeAvaliacaoInput,
  normalizeMarcacaoInput,
  validateConclusaoBaixaRules,
};
