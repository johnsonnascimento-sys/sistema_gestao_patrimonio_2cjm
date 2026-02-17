/**
 * Modulo: scripts
 * Arquivo: run_geafin_batches.js
 * Funcao no sistema: executar lotes SQL de carga GEAFIN no Supabase.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

module.paths.unshift(path.resolve(__dirname, "../backend/node_modules"));
const { Client } = require("pg");

const ROOT_DIR = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT_DIR, ".env");
const BATCH_DIR = path.join(__dirname, ".tmp", "geafin_batches");

/**
 * Carrega variaveis do arquivo .env simples (KEY=VALUE).
 * @param {string} filePath Caminho do arquivo.
 * @returns {Record<string, string>} Mapa de variaveis.
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

async function main() {
  if (!fs.existsSync(ENV_FILE)) throw new Error("Arquivo .env nao encontrado na raiz.");
  if (!fs.existsSync(BATCH_DIR)) throw new Error("Pasta de lotes nao encontrada. Execute geafin_to_sql_batches.js antes.");

  const env = loadEnv(ENV_FILE);
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL ausente no .env.");

  const files = fs
    .readdirSync(BATCH_DIR)
    .filter((name) => /^batch_\d+\.sql$/u.test(name))
    .sort((a, b) => a.localeCompare(b, "en"));

  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const startedAt = Date.now();
  try {
    for (const [index, name] of files.entries()) {
      const sql = fs.readFileSync(path.join(BATCH_DIR, name), "utf8");
      await client.query(sql);
      const pos = index + 1;
      console.log(`[${pos}/${files.length}] ${name} aplicado.`);
    }

    const counts = await client.query(
      `SELECT 'catalogo_bens' AS tabela, COUNT(*) AS total FROM public.catalogo_bens
       UNION ALL
       SELECT 'bens', COUNT(*) FROM public.bens
       UNION ALL
       SELECT 'movimentacoes', COUNT(*) FROM public.movimentacoes
       ORDER BY tabela;`,
    );

    const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log("Carga concluida.");
    console.log(`Tempo total: ${elapsedSec}s`);
    console.log(JSON.stringify(counts.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[ERRO]", error.message);
  process.exit(1);
});
