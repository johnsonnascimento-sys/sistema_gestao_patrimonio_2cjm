/**
 * Modulo: backend/routes
 * Arquivo: healthRoute.js
 * Funcao no sistema: registrar a rota publica de healthcheck com metadados de build/deploy.
 */
"use strict";

const { buildHealthPayload } = require("../services/runtimeMetadata");

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
      res.json(
        buildHealthPayload({
          requestId: req.requestId,
          authEnabled,
          runtimeMetadata,
          databaseStatus: "ok",
        }),
      );
    } catch (error) {
      next(error);
    }
  });
}

module.exports = { registerHealthRoute };
