/**
 * Modulo: scripts
 * Arquivo: geafin_to_sql_batches.js
 * Funcao no sistema: preparar lotes SQL de importacao GEAFIN para carga no Supabase.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

module.paths.unshift(path.resolve(__dirname, "../backend/node_modules"));
const iconv = require("iconv-lite");
const { parse } = require("csv-parse/sync");

const INPUT_CSV = path.resolve(__dirname, "../relatorio.csv");
const OUTPUT_DIR = path.resolve(__dirname, "./.tmp/geafin_batches");
const CHUNK_SIZE = 250;
const TOMBAMENTO_RE = /^\d{10}$/;

const UNIT_MAP = new Map([
  ["1", 1],
  ["1a aud", 1],
  ["1 aud", 1],
  ["1aud", 1],
  ["1aaud2acjm", 1],
  ["1a auditoria da 2a cjm", 1],
  ["2", 2],
  ["2a aud", 2],
  ["2 aud", 2],
  ["2aud", 2],
  ["2aaud2acjm", 2],
  ["2a auditoria da 2a cjm", 2],
  ["3", 3],
  ["foro", 3],
  ["dirf2acjm", 3],
  ["diretoria do foro da 2a cjm", 3],
  ["4", 4],
  ["almox", 4],
  ["almoxarifado", 4],
  ["almox2 sp", 4],
  ["almox2sp", 4],
  ["almoxarifado da 2a cjm", 4],
]);

/**
 * Normaliza string para comparacao resiliente.
 * @param {string|null|undefined} raw Valor bruto.
 * @returns {string} Valor normalizado.
 */
function normalizeKey(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Normaliza nome de coluna do CSV para chave ASCII em snake_case.
 * @param {string} raw Nome original de coluna.
 * @returns {string} Chave normalizada.
 */
function normalizeColumn(raw) {
  return normalizeKey(raw).replace(/\s+/g, "_");
}

/**
 * Resolve unidade dona com base em sigla/lotacao GEAFIN.
 * @param {object} row Linha bruta do CSV.
 * @returns {number|null} Unidade 1..4 ou null quando nao mapeada.
 */
function parseUnit(row) {
  const candidates = [row.siglalotacao, row.lotacao];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const key = normalizeKey(candidate);
    if (UNIT_MAP.has(key)) return UNIT_MAP.get(key);
  }
  return null;
}

/**
 * Converte texto monetario brasileiro para numerico.
 * @param {string|null|undefined} raw Valor monetario bruto.
 * @returns {number|null} Valor decimal ou null.
 */
function parseMoney(raw) {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Mapeia situacao de origem para enum status_bem.
 * @param {string|null|undefined} raw Situacao textual.
 * @returns {"OK"|"BAIXADO"|"EM_CAUTELA"} Status normalizado.
 */
function mapStatus(raw) {
  const status = normalizeKey(raw).toUpperCase();
  if (status.includes("BAIX")) return "BAIXADO";
  if (status.includes("CAUTELA")) return "EM_CAUTELA";
  return "OK";
}

/**
 * Quebra lista em lotes.
 * @template T
 * @param {T[]} items Itens.
 * @param {number} size Tamanho do lote.
 * @returns {T[][]} Matriz de lotes.
 */
function chunk(items, size) {
  const output = [];
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size));
  return output;
}

/**
 * Gera delimitador dollar-quoted sem colisao.
 * @param {string} payload Texto JSON.
 * @returns {string} Tag dollar-quoted.
 */
function dollarTag(payload) {
  let tag = "$geafin_payload$";
  let i = 1;
  while (payload.includes(tag)) {
    tag = `$geafin_payload_${i}$`;
    i += 1;
  }
  return tag;
}

/**
 * Monta SQL de upsert para um lote.
 * @param {object[]} rows Linhas normalizadas.
 * @returns {string} SQL pronto para execute_sql.
 */
function buildBatchSql(rows) {
  const payload = JSON.stringify(rows);
  const tag = dollarTag(payload);
  return [
    "-- Modulo: database",
    "-- Arquivo: geafin_batch.sql",
    "-- Funcao no sistema: carga GEAFIN em lote (catalogo_bens + bens).",
    "WITH payload AS (",
    `  SELECT * FROM jsonb_to_recordset(${tag}${payload}${tag}::jsonb)`,
    "    AS p(",
    "      numero_tombamento text,",
    "      codigo_catalogo text,",
    "      descricao text,",
    "      grupo text,",
    "      local_fisico text,",
    "      unidade_dona_id integer,",
    "      status text,",
    "      valor_aquisicao numeric",
    "    )",
    "),",
    "upsert_catalogo AS (",
    "  INSERT INTO public.catalogo_bens (codigo_catalogo, descricao, grupo)",
    "  SELECT DISTINCT p.codigo_catalogo, p.descricao, p.grupo",
    "  FROM payload p",
    "  ON CONFLICT (codigo_catalogo)",
    "  DO UPDATE SET",
    "    descricao = EXCLUDED.descricao,",
    "    grupo = COALESCE(EXCLUDED.grupo, public.catalogo_bens.grupo),",
    "    updated_at = NOW()",
    "  RETURNING id, codigo_catalogo",
    ")",
    "INSERT INTO public.bens (",
    "  numero_tombamento, catalogo_bem_id, descricao_complementar, unidade_dona_id,",
    "  local_fisico, status, valor_aquisicao, eh_bem_terceiro",
    ")",
    "SELECT",
    "  p.numero_tombamento,",
    "  c.id,",
    "  p.descricao,",
    "  p.unidade_dona_id,",
    "  COALESCE(NULLIF(p.local_fisico, ''), 'NAO_INFORMADO'),",
    "  p.status::public.status_bem,",
    "  p.valor_aquisicao,",
    "  FALSE",
    "FROM payload p",
    "JOIN public.catalogo_bens c ON c.codigo_catalogo = p.codigo_catalogo",
    "ON CONFLICT (numero_tombamento) WHERE (numero_tombamento IS NOT NULL)",
    "DO UPDATE SET",
    "  catalogo_bem_id = EXCLUDED.catalogo_bem_id,",
    "  descricao_complementar = EXCLUDED.descricao_complementar,",
    "  unidade_dona_id = EXCLUDED.unidade_dona_id,",
    "  local_fisico = EXCLUDED.local_fisico,",
    "  status = EXCLUDED.status,",
    "  valor_aquisicao = COALESCE(EXCLUDED.valor_aquisicao, public.bens.valor_aquisicao),",
    "  updated_at = NOW();",
  ].join("\n");
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const raw = fs.readFileSync(INPUT_CSV);
  const text = iconv.decode(raw, "latin1");
  const delimiter = ";";
  const rows = parse(text, {
    columns: (header) => header.map(normalizeColumn),
    skip_empty_lines: true,
    delimiter,
    trim: true,
    relax_column_count: true,
  });

  const valid = [];
  const invalid = [];

  rows.forEach((row, index) => {
    const line = index + 2;
    const tombamento = String(row.tombamento || "").replace(/^"+|"+$/g, "").trim();
    if (!TOMBAMENTO_RE.test(tombamento)) {
      invalid.push({ line, reason: "tombamento_invalido", value: row.tombamento || "" });
      return;
    }

    const descricao = String(row.descricao || "").replace(/^"+|"+$/g, "").trim();
    if (!descricao) {
      invalid.push({ line, reason: "descricao_ausente" });
      return;
    }

    const unidadeDonaId = parseUnit(row);
    if (!unidadeDonaId) {
      invalid.push({
        line,
        reason: "unidade_nao_mapeada",
        sigla: row.siglalotacao || "",
        lotacao: row.lotacao || "",
      });
      return;
    }

    const codigoMaterial = String(row.cod_material || "").replace(/^"+|"+$/g, "").trim();
    const codigoCatalogo = codigoMaterial || `GEAFIN_${tombamento}`;
    const grupo = String(row.descr_siafi || "").replace(/^"+|"+$/g, "").trim() || null;
    const localFisico =
      String(row.lotacao || "").replace(/^"+|"+$/g, "").trim()
      || String(row.siglalotacao || "").replace(/^"+|"+$/g, "").trim()
      || "NAO_INFORMADO";

    valid.push({
      numero_tombamento: tombamento,
      codigo_catalogo: codigoCatalogo,
      descricao,
      grupo,
      local_fisico: localFisico,
      unidade_dona_id: unidadeDonaId,
      status: mapStatus(row.situacao),
      valor_aquisicao: parseMoney(row.valor_de_aquisicao),
    });
  });

  const batches = chunk(valid, CHUNK_SIZE);
  const files = [];
  batches.forEach((batch, index) => {
    const name = `batch_${String(index + 1).padStart(3, "0")}.sql`;
    const filePath = path.join(OUTPUT_DIR, name);
    fs.writeFileSync(filePath, buildBatchSql(batch), "utf8");
    files.push(name);
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.relative(path.resolve(__dirname, ".."), INPUT_CSV).replace(/\\/g, "/"),
    outputDir: path.relative(path.resolve(__dirname, ".."), OUTPUT_DIR).replace(/\\/g, "/"),
    delimiter,
    totalRows: rows.length,
    validRows: valid.length,
    invalidRows: invalid.length,
    chunkSize: CHUNK_SIZE,
    batchCount: files.length,
    files,
    invalidPreview: invalid.slice(0, 20),
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(JSON.stringify(manifest, null, 2));
}

main();
