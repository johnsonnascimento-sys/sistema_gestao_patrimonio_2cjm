/**
 * Modulo: backend/tests
 * Arquivo: runtimeMetadata.test.js
 * Funcao no sistema: validar normalizacao de metadados de runtime para healthcheck.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildHealthPayload,
  readPackageVersion,
  readRuntimeMetadata,
} = require("../../src/services/runtimeMetadata");

test("readRuntimeMetadata usa metadados do deploy oficial quando presentes", () => {
  const metadata = readRuntimeMetadata({
    NODE_ENV: "production",
    APP_GIT_COMMIT: "abc123def456",
    APP_GIT_BRANCH: "main",
    APP_DEPLOY_METHOD: "git_pull",
    APP_BUILD_SOURCE: "scripts/vps_deploy.sh",
    APP_BUILD_TIMESTAMP: "2026-03-07T23:59:59Z",
  });

  assert.equal(metadata.git.commit, "abc123def456");
  assert.equal(metadata.git.branch, "main");
  assert.equal(metadata.deploy.method, "git_pull");
  assert.equal(metadata.deploy.source, "scripts/vps_deploy.sh");
  assert.equal(metadata.build.timestamp, "2026-03-07T23:59:59Z");
  assert.equal(metadata.build.version, readPackageVersion());
});

test("readRuntimeMetadata usa fallback explicito sem depender de .git local", () => {
  const metadata = readRuntimeMetadata({ NODE_ENV: "production" });

  assert.equal(metadata.git.commit, "unknown");
  assert.equal(metadata.git.branch, "unknown");
  assert.equal(metadata.deploy.method, "unknown");
  assert.equal(metadata.deploy.source, "unknown");
  assert.equal(metadata.build.timestamp, null);
});

test("buildHealthPayload preserva authEnabled, requestId e checks", () => {
  const payload = buildHealthPayload({
    requestId: "req-123",
    authEnabled: true,
    runtimeMetadata: readRuntimeMetadata({
      NODE_ENV: "production",
      APP_GIT_COMMIT: "abc123def456",
      APP_GIT_BRANCH: "main",
      APP_DEPLOY_METHOD: "git_pull",
      APP_BUILD_SOURCE: "scripts/vps_deploy.sh",
    }),
    databaseStatus: "ok",
  });

  assert.equal(payload.status, "ok");
  assert.equal(payload.requestId, "req-123");
  assert.equal(payload.authEnabled, true);
  assert.equal(payload.git.commit, "abc123def456");
  assert.equal(payload.deploy.method, "git_pull");
  assert.deepEqual(payload.checks, { database: "ok" });
});
