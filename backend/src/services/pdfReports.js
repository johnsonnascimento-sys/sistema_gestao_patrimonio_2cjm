/**
 * Modulo: backend/src/services
 * Arquivo: pdfReports.js
 * Funcao no sistema: gerar PDFs deterministicas (sem IA) para saidas oficiais (termos/relatorios) a serem salvas no Drive via n8n.
 *
 * Observacao:
 * - Evita depender de conversores HTML->PDF externos.
 * - Nao embute segredos.
 */
"use strict";

const PDFDocument = require("pdfkit");

function sanitizeText(v) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim();
}

function writeHeader(doc, title, subtitle) {
  doc.fontSize(14).font("Helvetica-Bold").text(sanitizeText(title), { align: "left" });
  if (subtitle) {
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#555").text(sanitizeText(subtitle));
    doc.fillColor("#000");
  }
  doc.moveDown(0.8);
}

function writeSection(doc, label, lines) {
  doc.fontSize(9).font("Helvetica-Bold").text(sanitizeText(label).toUpperCase());
  doc.moveDown(0.2);
  doc.fontSize(10).font("Helvetica");
  for (const l of lines) doc.text(sanitizeText(l));
  doc.moveDown(0.7);
}

function asPdfBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, compress: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

/**
 * Gera PDF de termo patrimonial (transferencia/cautela/regularizacao).
 * @param {object} payload Payload do termo.
 * @returns {Promise<Buffer>} PDF.
 */
async function generateTermoPdf(payload) {
  const tipo = sanitizeText(payload?.tipo_termo || payload?.tipoTermo || "PATRIMONIAL").toUpperCase();
  const bem = payload?.bem || {};
  const responsavel = payload?.responsavel || {};
  const detentor = payload?.detentor_temporario || payload?.detentorTemporario || null;
  const baseLegal = Array.isArray(payload?.base_legal) ? payload.base_legal : [];

  return asPdfBuffer((doc) => {
    writeHeader(doc, `TERMO PATRIMONIAL - ${tipo}`, "Sistema Patrimonio 2a CJM | ATN 303/2008");

    writeSection(doc, "Bem", [
      `Tombamento: ${sanitizeText(bem.tombamento || bem.numeroTombamento || "-")}`,
      `Descricao: ${sanitizeText(bem.descricao || "-")}`,
      bem.status ? `Status: ${sanitizeText(bem.status)}` : "",
    ].filter(Boolean));

    writeSection(doc, "Responsavel", [
      `Nome: ${sanitizeText(responsavel.nome || "-")}`,
      `Matricula: ${sanitizeText(responsavel.matricula || "-")}`,
      responsavel.cargo ? `Cargo: ${sanitizeText(responsavel.cargo)}` : "",
    ].filter(Boolean));

    if (detentor) {
      writeSection(doc, "Detentor temporario (cautela)", [
        `Nome: ${sanitizeText(detentor.nome || "-")}`,
        `Matricula: ${sanitizeText(detentor.matricula || "-")}`,
        detentor.data_prevista_devolucao || detentor.dataPrevistaDevolucao
          ? `Previsao devolucao: ${sanitizeText(detentor.data_prevista_devolucao || detentor.dataPrevistaDevolucao)}`
          : "",
      ].filter(Boolean));
    }

    writeSection(doc, "Base legal", baseLegal.length ? baseLegal : ["(nao informado)"]);

    doc.moveDown(1.3);
    doc.fontSize(10).font("Helvetica");
    doc.text("Assinatura do responsavel: ________________________________", { align: "left" });
    doc.moveDown(0.6);
    doc.text("Assinatura da autoridade: ________________________________", { align: "left" });
  });
}

/**
 * Gera PDF simples de tabela.
 * @param {string} title Titulo.
 * @param {string[]} cols Cabecalhos.
 * @param {string[][]} rows Linhas.
 * @returns {Promise<Buffer>} PDF.
 */
async function generateTablePdf(title, cols, rows) {
  return asPdfBuffer((doc) => {
    writeHeader(doc, title, `Gerado em ${new Date().toLocaleString("pt-BR")}`);

    doc.fontSize(8).font("Helvetica-Bold");
    doc.text(cols.map((c) => sanitizeText(c)).join(" | "));
    doc.moveDown(0.4);
    doc.fontSize(8).font("Helvetica");

    for (const r of rows) {
      doc.text(r.map((c) => sanitizeText(c)).join(" | "));
      if (doc.y > doc.page.height - 72) doc.addPage();
    }
  });
}

module.exports = { generateTermoPdf, generateTablePdf };

