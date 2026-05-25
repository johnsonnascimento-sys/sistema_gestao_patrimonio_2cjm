/**
 * Modulo: backend/tests
 * Arquivo: healthRoute.test.js
 * Funcao no sistema: validar o healthcheck HTTP com leitura basica e leitura profunda das tabelas criticas.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEEP_DATABASE_CHECKS,
  registerHealthRoute,
} = require("../../src/routes/healthRoute");

test("GET /health executa check basico e leitura profunda das tabelas criticas", async () => {
  const queries = [];
  const pool = {
    async query(sql) {
      queries.push(sql);
      return { rows: [], rowCount: 0 };
    },
  };

  let handler = null;
  const app = {
    get(path, fn) {
      assert.equal(path, "/health");
      handler = fn;
    },
  };

  registerHealthRoute(app, {
    pool,
    authEnabled: true,
    runtimeMetadata: {
      git: { commit: "abc123", branch: "main" },
      deploy: { method: "git_pull", source: "scripts/vps_deploy.sh" },
      build: { timestamp: "2026-05-25T21:00:00Z", source: "scripts/vps_deploy.sh", version: "1.0.0" },
    },
  });

  assert.ok(handler, "handler da rota /health deveria ser registrado");

  const payloads = [];
  const res = {
    json(payload) {
      payloads.push(payload);
    },
  };
  const next = () => {
    throw new Error("next() nao deveria ser chamado");
  };

  await handler({ requestId: "req-1" }, res, next);

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].checks.database, "ok");
  assert.equal(payloads[0].checks.deepDatabase, "ok");
  assert.equal(queries[0], "SELECT 1");
  assert.deepEqual(
    queries.slice(1),
    DEEP_DATABASE_CHECKS.map((tableName) => `SELECT 1 FROM ${tableName} LIMIT 1;`),
  );
});
