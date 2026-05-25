/**
 * Modulo: backend/routes
 * Arquivo: healthRoute.js
 * Funcao no sistema: registrar a rota publica de healthcheck com metadados de build/deploy.
 */
"use strict";

const { buildHealthPayload } = require("../services/runtimeMetadata");

const DEEP_DATABASE_CHECKS = [
  "public.perfis",
  "public.locais",
  "public.catalogo_bens",
  "public.bens",
  "public.eventos_inventario",
  "public.movimentacoes",
  "public.solicitacoes_aprovacao",
];

async function runDeepDatabaseChecks(pool) {
  for (const tableName of DEEP_DATABASE_CHECKS) {
    await pool.query(`SELECT 1 FROM ${tableName} LIMIT 1;`);
  }
}

function registerHealthRoute(app, deps) {
  const pool = deps?.pool;
  const authEnabled = Boolean(deps?.authEnabled);
  const runtimeMetadata = deps?.runtimeMetadata || null;

  if (!app || typeof app.get !== "function") {
    throw new Error("registerHealthRoute requer uma instancia Express valida.");
  }
  if (!pool || typeof pool.query !== "function") {
    throw new Error("registerHealthRoute requer pool com query().");
  }

  app.get("/health", async (req, res, next) => {
    try {
      await pool.query("SELECT 1");
      await runDeepDatabaseChecks(pool);
      res.json(
        buildHealthPayload({
          requestId: req.requestId,
          authEnabled,
          runtimeMetadata,
          databaseStatus: "ok",
          deepDatabaseStatus: "ok",
        }),
      );
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerHealthRoute, runDeepDatabaseChecks, DEEP_DATABASE_CHECKS };
