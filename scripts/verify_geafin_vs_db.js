/**
 * Modulo: scripts
 * Arquivo: verify_geafin_vs_db.js
 * Funcao no sistema: validar, de forma auditavel, o quanto o banco (Supabase/Postgres) corresponde ao CSV original do GEAFIN.
 *
 * Importante (conceito SKU vs Item):
 * - O sistema normaliza catalogo (SKU) e, portanto, NAO promete que o texto de descricao por tombamento
 *   esteja 1:1 com o CSV (varias descricoes podem apontar para o mesmo catalogo).
 * - Este verificador mede equivalencia por chaves e campos operacionais criticos (tombamento, codigo_catalogo,
 *   unidade, status, local_fisico e valor), e reporta divergencias.
 *
 * Uso:
 *   - Defina DATABASE_URL e DB_SSL no ambiente (nao versionar segredos).
 *   - Rode: node scripts/verify_geafin_vs_db.js
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function requireFromBackend(specifier) {
  const backendDir = path.resolve(__dirname, "..", "backend");
  const resolved = require.resolve(specifier, { paths: [backendDir] });
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(resolved);
}

const iconv = requireFromBackend("iconv-lite");
const { parse } = requireFromBackend("csv-parse/sync");
const { Pool } = requireFromBackend("pg");

const DATABASE_URL = process.env.DATABASE_URL || "";
const DB_SSL = process.env.DB_SSL || "require";

if (!DATABASE_URL) {
  console.error("Variavel obrigatoria ausente: DATABASE_URL");
  process.exit(2);
}

const TOMBAMENTO_RE = /^\d{10}$/;
const VALID_UNIDADES = new Set([1, 2, 3, 4]);
const UNIT_MAP = new Map([
  ["1", 1], ["1a aud", 1], ["1 aud", 1], ["1aud", 1],
  ["2", 2], ["2a aud", 2], ["2 aud", 2], ["2aud", 2],
  ["3", 3], ["foro", 3], ["4", 4], ["almox", 4], ["almoxarifado", 4],
  ["1aaud2acjm", 1],
  ["2aaud2acjm", 2],
  ["dirf2acjm", 3],
  ["almox2 sp", 4],
  ["almox2sp", 4],
]);

function normalizeKey(k) {
  return String(k || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildRowKeyMap(row) {
  const map = new Map();
  for (const [k, v] of Object.entries(row || {})) {
    map.set(normalizeKey(k), v);
  }
  return map;
}

function pick(row, names) {
  const map = buildRowKeyMap(row);
  for (const n of names) {
    const v = map.get(normalizeKey(n));
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function parseUnit(raw, fallback) {
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  if (Number.isInteger(n) && VALID_UNIDADES.has(n)) return n;
  const key = String(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return UNIT_MAP.get(key) ?? fallback;
}

function mapStatus(raw) {
  const s = String(raw || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (s.includes("BAIX")) return "BAIXADO";
  if (s.includes("CAUTELA")) return "EM_CAUTELA";
  return "OK";
}

function parseMoney(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const txt = String(raw)
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  if (!txt) return null;
  const n = Number(txt);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function asText(v) {
  if (v == null) return null;
  return String(v).trim();
}

function approxEqual(a, b, eps = 0.005) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) <= eps;
}

async function main() {
  const csvPath = path.resolve(__dirname, "..", "relatorio.csv");
  const buf = fs.readFileSync(csvPath);
  const text = iconv.decode(buf, "latin1");

  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ";",
    trim: true,
    relax_column_count: true,
  });

  const csvByTombo = new Map();
  let csvInvalidTombo = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const tombo = pick(row, ["Tombamento"])?.replace(/^\"+|\"+$/g, "") || null;
    if (!tombo || !TOMBAMENTO_RE.test(tombo)) {
      csvInvalidTombo += 1;
      continue;
    }
    // Ultimo registro vence em caso de duplicidade (na pratica nao deveria ocorrer).
    csvByTombo.set(tombo, {
      codMaterial: pick(row, ["Cod Material", "CodMaterial"]),
      siglaLotacao: pick(row, ["SiglaLotacao", "Sigla Lotacao"]),
      lotacao: pick(row, ["Lotação", "Lotacao"]),
      descricao: pick(row, ["Descrição", "Descricao"]),
      situacao: pick(row, ["Situação", "Situacao"]),
      valorAquisicao: parseMoney(pick(row, ["Valor de aquisição", "Valor de aquisicao"])),
    });
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DB_SSL === "disable" ? false : { rejectUnauthorized: false },
  });

  try {
    const db = await pool.query(
      `SELECT
         b.numero_tombamento AS "numeroTombamento",
         b.unidade_dona_id AS "unidadeDonaId",
         b.local_fisico AS "localFisico",
         b.status::text AS "status",
         b.valor_aquisicao AS "valorAquisicao",
         cb.codigo_catalogo AS "codigoCatalogo",
         cb.descricao AS "catalogoDescricao"
       FROM bens b
       JOIN catalogo_bens cb ON cb.id = b.catalogo_bem_id
       WHERE b.eh_bem_terceiro = FALSE
         AND b.numero_tombamento IS NOT NULL;`,
    );

    const dbByTombo = new Map();
    for (const r of db.rows) {
      if (r.numeroTombamento) dbByTombo.set(String(r.numeroTombamento), r);
    }

    const missingInDb = [];
    const mismatches = {
      codigoCatalogo: 0,
      unidadeDona: 0,
      status: 0,
      localFisico: 0,
      valorAquisicao: 0,
      catalogoDescricao: 0,
    };
    let compared = 0;

    for (const [tombo, c] of csvByTombo.entries()) {
      const d = dbByTombo.get(tombo);
      if (!d) {
        missingInDb.push(tombo);
        continue;
      }
      compared += 1;

      // Equivalencias esperadas
      const expectedCodigoCatalogo = asText(c.codMaterial) || `GEAFIN_${tombo}`;
      if (asText(d.codigoCatalogo) !== expectedCodigoCatalogo) mismatches.codigoCatalogo += 1;

      const expectedUnit = parseUnit(c.siglaLotacao, null) ?? parseUnit(c.lotacao, null);
      if (expectedUnit != null && Number(d.unidadeDonaId) !== Number(expectedUnit)) mismatches.unidadeDona += 1;

      const expectedStatus = mapStatus(c.situacao);
      if (asText(d.status) !== expectedStatus) mismatches.status += 1;

      // local_fisico: no nosso projeto, a coluna mapeia o "ambiente/local" de forma operacional.
      // A importacao atual preenche com a "Lotacao" (texto descritivo) quando disponivel.
      const expectedLocal = asText(c.lotacao) || asText(c.siglaLotacao) || "NAO_INFORMADO";
      if (asText(d.localFisico) !== expectedLocal) mismatches.localFisico += 1;

      if (!approxEqual(d.valorAquisicao, c.valorAquisicao)) mismatches.valorAquisicao += 1;

      // Aviso: este campo pode divergir pela normalizacao do catalogo (SKU vs Item).
      if (c.descricao && asText(d.catalogoDescricao) !== asText(c.descricao)) mismatches.catalogoDescricao += 1;
    }

    const extraInDb = [];
    for (const tombo of dbByTombo.keys()) {
      if (!csvByTombo.has(tombo)) extraInDb.push(tombo);
    }

    const out = {
      csv: {
        totalRows: rows.length,
        validTombos: csvByTombo.size,
        invalidTombos: csvInvalidTombo,
      },
      db: {
        totalBensComTombo: dbByTombo.size,
      },
      equivalencia: {
        compared,
        missingInDb: missingInDb.length,
        extraInDb: extraInDb.length,
        mismatches,
      },
      notes: [
        "catalogoDescricao pode divergir por normalizacao (SKU vs Item).",
        "unidadeDona e localFisico dependem do mapeamento (SiglaLotacao/Lotacao) aplicado na importacao.",
      ],
      samples: {
        missingInDb: missingInDb.slice(0, 20),
        extraInDb: extraInDb.slice(0, 20),
      },
    };

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
