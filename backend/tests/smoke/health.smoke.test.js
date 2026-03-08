/**
 * Modulo: backend/tests
 * Arquivo: health.smoke.test.js
 * Funcao no sistema: smoke test opcional do endpoint /health contra uma API em execucao.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const shouldRun = String(process.env.RUN_SMOKE_HTTP || "").trim() === "1";
const baseUrl = String(process.env.BACKEND_BASE_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");

test(
  "GET /health responde 200 com payload minimo",
  { skip: !shouldRun },
  async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.equal(payload.status, "ok");
    assert.ok(Object.prototype.hasOwnProperty.call(payload, "authEnabled"));
    assert.ok(Object.prototype.hasOwnProperty.call(payload, "git"));
    assert.ok(Object.prototype.hasOwnProperty.call(payload, "deploy"));
    assert.ok(Object.prototype.hasOwnProperty.call(payload, "build"));
  },
);
