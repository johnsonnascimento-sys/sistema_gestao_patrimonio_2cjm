/**
 * Modulo: frontend/components
 * Arquivo: baixaProcessCsv.js
 * Funcao no sistema: gerar CSV operacional de rascunhos de baixa patrimonial para anexacao externa (ex.: SEI).
 */

function formatCsvValue(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toIsoOrEmpty(value) {
  if (!value) return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString();
}

function normalizeFilenamePart(value, fallback = "sem-referencia") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .toLowerCase();
  return normalized || fallback;
}

export function buildBaixaProcessCsv(processDetail) {
  const baixa = processDetail?.baixa || {};
  const itens = Array.isArray(processDetail?.itens) ? processDetail.itens : [];
  const dadosModalidade = baixa?.dadosModalidade || {};
  const rows = itens.length ? itens : [{}];
  const headers = [
    "processoReferencia",
    "modalidadeBaixa",
    "statusProcesso",
    "criadoEm",
    "atualizadoEm",
    "manifestacaoSciReferencia",
    "manifestacaoSciEm",
    "atoDiretorGeralReferencia",
    "atoDiretorGeralEm",
    "presidenciaCienteEm",
    "encaminhadoFinancasEm",
    "notaLancamentoReferencia",
    "observacoesProcesso",
    "tipoDestinatario",
    "avaliacaoPreviaReferencia",
    "licitacaoReferencia",
    "justificativaInviabilidadeAlienacaoDoacao",
    "partesAproveitaveisRetiradas",
    "setorAssistente",
    "setorAssistenteObrigatorio",
    "motivosInutilizacao",
    "itemId",
    "bemId",
    "marcacaoInservivelId",
    "avaliacaoInservivelId",
    "numeroTombamento",
    "catalogoDescricao",
    "tipoInservivel",
    "statusFluxo",
    "destinacaoSugerida",
    "unidadeDonaId",
    "statusBem",
  ];

  const lines = [
    headers.map(formatCsvValue).join(","),
    ...rows.map((item) => [
      baixa.processoReferencia,
      baixa.modalidadeBaixa,
      baixa.statusProcesso,
      toIsoOrEmpty(baixa.createdAt),
      toIsoOrEmpty(baixa.updatedAt),
      baixa.manifestacaoSciReferencia,
      toIsoOrEmpty(baixa.manifestacaoSciEm),
      baixa.atoDiretorGeralReferencia,
      toIsoOrEmpty(baixa.atoDiretorGeralEm),
      toIsoOrEmpty(baixa.presidenciaCienteEm),
      toIsoOrEmpty(baixa.encaminhadoFinancasEm),
      baixa.notaLancamentoReferencia,
      baixa.observacoes,
      dadosModalidade.tipoDestinatario,
      dadosModalidade.avaliacaoPreviaReferencia,
      dadosModalidade.licitacaoReferencia,
      dadosModalidade.justificativaInviabilidadeAlienacaoDoacao,
      dadosModalidade.partesAproveitaveisRetiradas === true ? "SIM" : dadosModalidade.partesAproveitaveisRetiradas === false ? "NAO" : "",
      dadosModalidade.setorAssistente,
      dadosModalidade.setorAssistenteObrigatorio === true ? "SIM" : dadosModalidade.setorAssistenteObrigatorio === false ? "NAO" : "",
      Array.isArray(dadosModalidade.motivosInutilizacao) ? dadosModalidade.motivosInutilizacao.join("; ") : "",
      item.id,
      item.bemId,
      item.marcacaoInservivelId,
      item.avaliacaoInservivelId,
      item.numeroTombamento,
      item.catalogoDescricao,
      item.tipoInservivel,
      item.statusFluxo,
      item.destinacaoSugerida,
      item.unidadeDonaId,
      item.status,
    ].map(formatCsvValue).join(",")),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

export function buildBaixaProcessCsvFilename(processDetail) {
  const baixa = processDetail?.baixa || {};
  const ref = normalizeFilenamePart(baixa.processoReferencia, "processo");
  const modalidade = normalizeFilenamePart(baixa.modalidadeBaixa, "modalidade");
  return `rascunho-baixa-${ref}-${modalidade}.csv`;
}

export function triggerCsvDownload(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
