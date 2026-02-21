/**
 * Modulo: scripts
 * Arquivo: backfill_smart_inventory_cod2aud_nome.js
 * Funcao no sistema: preencher cod_2_aud e nome_resumo em bens a partir do CSV do Smart Inventory.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

module.paths.unshift(path.resolve(__dirname, "../backend/node_modules"));
const { parse } = require("csv-parse/sync");
const { Client } = require("pg");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_CSV = path.join(ROOT_DIR, "Inventário Inteligente - Lista de Itens - 21.02.2026 14 18.csv");
const ENV_CANDIDATES = [path.join(ROOT_DIR, ".env"), path.join(ROOT_DIR, "backend", ".env")];

/**
 * Carrega variaveis de ambiente no formato KEY=VALUE.
 * @param {string} filePath Caminho do arquivo .env.
 * @returns {Record<string, string>}
 */
function loadEnv(filePath) {
  const out = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

/**
 * Corrige texto com acentos quando vier mojibake.
 * @param {string} text Texto bruto.
 * @returns {string}
 */
function fixMojibakeUtf8FromLatin1(text) {
  if (!text) return text;
  try {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    if (repaired.includes("\uFFFD")) return text;

    const suspicious = text.match(/[ÃÂÕÓÍÊÚÇãâõóíêúç]/g) || [];
    if (suspicious.length === 0) return text;
    return repaired;
  } catch {
    return text;
  }
}

/**
 * Normaliza chave para busca tolerante.
 * @param {string} key Chave original.
 * @returns {string}
 */
function normalizeKey(key) {
  return fixMojibakeUtf8FromLatin1(String(key || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Escolhe o primeiro valor valido das chaves candidatas.
 * @param {Record<string,string>} row Registro normalizado.
 * @param {string[]} keys Chaves candidatas.
 * @returns {string|null}
 */
function pick(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

/**
 * Detecta delimitador principal do CSV.
 * @param {string} text Conteudo do CSV.
 * @returns {","|";"}
 */
function detectDelimiter(text) {
  const header = text.split(/\r?\n/u).find((line) => line.trim().length > 0) || "";
  const semicolons = (header.match(/;/g) || []).length;
  const commas = (header.match(/,/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

/**
 * Normaliza numero de tombamento para o padrao de 10 digitos.
 * @param {string|null} raw Valor bruto.
 * @returns {string|null}
 */
function normalizeTombamento(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^0-9]/g, "");
  return /^\d{10}$/u.test(digits) ? digits : null;
}

/**
 * Extrai cod2aud (4 digitos) do registro.
 * @param {Record<string,string>} row Registro normalizado.
 * @returns {string|null}
 */
function extractCod2Aud(row) {
  const direct = pick(row, ["cod2aud", "cod_2_aud", "cod2_aud", "codigo_2_auditoria"]);
  if (direct) {
    const m = direct.match(/(\d{4})/u);
    if (m && m[1] !== "0000") return m[1];
  }

  for (const value of Object.values(row)) {
    if (typeof value !== "string") continue;
    const m = value.match(/cod2aud\s*:\s*([0-9]{4})/iu);
    if (m && m[1] !== "0000") return m[1];
  }

  return null;
}

/**
 * Remove sufixos antigos de catalogacao no nome resumo.
 * @param {string|null} raw Nome bruto.
 * @returns {string|null}
 */
function sanitizeNomeResumo(raw) {
  if (!raw) return null;
  let txt = fixMojibakeUtf8FromLatin1(String(raw)).trim();
  if (!txt) return null;

  txt = txt.replace(/\s*(?:[-(])?\s*\d{1,3}\s*[-/]\s*\d{1,3}\s*\)?\s*$/u, "");
  txt = txt.replace(/\s{2,}/g, " ").trim();

  if (!txt) return null;
  if (/^\d{1,3}\s*[-/]\s*\d{1,3}$/u.test(txt)) return null;

  return txt.slice(0, 240);
}

/**
 * Converte linha do CSV em update candidatavel.
 * @param {Record<string,unknown>} raw Registro bruto.
 * @returns {{numeroTombamento: string, cod2Aud: string|null, nomeResumo: string|null}|null}
 */
function parseRow(raw) {
  const row = {};
  for (const [key, value] of Object.entries(raw || {})) {
    row[normalizeKey(key)] = value == null ? "" : String(value).trim();
  }

  const keys = Object.keys(row);
  const numeroTombamento = normalizeTombamento(
    pick(row, [
      "numero_tombamento",
      "tombamento",
      "nr_tombamento",
      "num_tombamento",
      "tombo",
      "chapa",
      "codigo_qr_valor_do_codigo_de_barras",
      "codigo_qr",
      "codigo_de_barras",
      "codigo_barras",
      "valor_do_codigo_de_barras",
    ]) || (keys.length > 1 ? row[keys[1]] : null),
  );

  if (!numeroTombamento) return null;

  const nomeBruto = pick(row, ["nome", "nome_resumo", "item", "nome_do_item", "resumo"]) || (keys.length > 0 ? row[keys[0]] : null);
  const nomeResumo = sanitizeNomeResumo(nomeBruto);
  const cod2Aud = extractCod2Aud(row);

  if (!nomeResumo && !cod2Aud) return null;
  return { numeroTombamento, cod2Aud, nomeResumo };
}

/**
 * Resolve caminho do arquivo CSV.
 * @param {string|undefined} userPath Caminho informado no CLI.
 * @returns {string}
 */
function resolveCsvPath(userPath) {
  if (userPath) return path.resolve(process.cwd(), userPath);
  return DEFAULT_CSV;
}

/**
 * Resolve e carrega DATABASE_URL.
 * @returns {{databaseUrl: string, envFile: string}}
 */
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return { databaseUrl: process.env.DATABASE_URL, envFile: "<env>" };

  for (const envFile of ENV_CANDIDATES) {
    if (!fs.existsSync(envFile)) continue;
    const env = loadEnv(envFile);
    if (env.DATABASE_URL) return { databaseUrl: env.DATABASE_URL, envFile };
  }

  throw new Error("DATABASE_URL nao encontrado (nem no ambiente, nem em .env/backend/.env).");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvArg = args.find((arg) => !arg.startsWith("--"));
  const csvPath = resolveCsvPath(csvArg);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV nao encontrado: ${csvPath}`);
  }

  const csvRaw = fs.readFileSync(csvPath, "utf8");
  const delimiter = detectDelimiter(csvRaw);
  const records = parse(csvRaw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    delimiter,
    relax_column_count: true,
    trim: true,
  });

  const byTombamento = new Map();
  let rowsWithTombo = 0;
  let rowsWithCod2Aud = 0;
  let rowsWithNome = 0;

  for (const record of records) {
    const parsed = parseRow(record);
    if (!parsed) continue;

    rowsWithTombo += 1;
    if (parsed.cod2Aud) rowsWithCod2Aud += 1;
    if (parsed.nomeResumo) rowsWithNome += 1;

    const current = byTombamento.get(parsed.numeroTombamento) || {
      numeroTombamento: parsed.numeroTombamento,
      cod2Aud: null,
      nomeResumo: null,
    };
    if (parsed.cod2Aud) current.cod2Aud = parsed.cod2Aud;
    if (parsed.nomeResumo) current.nomeResumo = parsed.nomeResumo;
    byTombamento.set(parsed.numeroTombamento, current);
  }

  const { databaseUrl, envFile } = resolveDatabaseUrl();
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const summary = {
      dryRun,
      envFile,
      csvPath,
      csvRows: records.length,
      csvRowsValidasComTombo: rowsWithTombo,
      csvRowsComCod2Aud: rowsWithCod2Aud,
      csvRowsComNomeResumo: rowsWithNome,
      tombamentosUnicosParaBackfill: byTombamento.size,
      bensEncontrados: 0,
      bensAtualizados: 0,
      bensSemMudanca: 0,
      bensNaoEncontrados: 0,
      cod2AudAtualizados: 0,
      nomeResumoAtualizados: 0,
      exemplosNaoEncontrados: [],
    };

    for (const data of byTombamento.values()) {
      const currentResult = await client.query(
        `SELECT cod_2_aud AS "cod2Aud", nome_resumo AS "nomeResumo"
         FROM public.bens
         WHERE numero_tombamento = $1`,
        [data.numeroTombamento],
      );

      if (currentResult.rowCount === 0) {
        summary.bensNaoEncontrados += 1;
        if (summary.exemplosNaoEncontrados.length < 20) summary.exemplosNaoEncontrados.push(data.numeroTombamento);
        continue;
      }

      summary.bensEncontrados += 1;
      const current = currentResult.rows[0];
      const nextCod2Aud = data.cod2Aud || current.cod2Aud || null;
      const nextNomeResumo = data.nomeResumo || current.nomeResumo || null;

      const codChanged = nextCod2Aud !== current.cod2Aud;
      const nomeChanged = nextNomeResumo !== current.nomeResumo;

      if (!codChanged && !nomeChanged) {
        summary.bensSemMudanca += 1;
        continue;
      }

      summary.bensAtualizados += 1;
      if (codChanged) summary.cod2AudAtualizados += 1;
      if (nomeChanged) summary.nomeResumoAtualizados += 1;

      if (!dryRun) {
        await client.query(
          `UPDATE public.bens
           SET cod_2_aud = $2,
               nome_resumo = $3,
               updated_at = NOW()
           WHERE numero_tombamento = $1`,
          [data.numeroTombamento, nextCod2Aud, nextNomeResumo],
        );
      }
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[ERRO]", error.message);
  process.exit(1);
});

