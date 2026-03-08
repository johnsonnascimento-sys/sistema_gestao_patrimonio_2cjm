/**
 * Modulo: backend/services
 * Arquivo: runtimeMetadata.js
 * Funcao no sistema: normalizar metadados de build/deploy para exposicao segura em /health.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PACKAGE_JSON_PATH = path.resolve(__dirname, "..", "..", "package.json");

let cachedVersion = null;

function readPackageVersion() {
  if (cachedVersion) return cachedVersion;
  try {
    const raw = fs.readFileSync(PACKAGE_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw);
    cachedVersion = String(parsed?.version || "").trim() || "unknown";
  } catch (_error) {
    cachedVersion = "unknown";
  }
  return cachedVersion;
}

function normalizeText(raw, fallback = "unknown") {
  const value = String(raw || "").trim();
  return value || fallback;
}

function normalizeOptionalText(raw) {
  const value = String(raw || "").trim();
  return value || null;
}

function readRuntimeMetadata(env = process.env) {
  const nodeEnv = normalizeText(env.NODE_ENV, "development");
  const deployMethod = normalizeText(
    env.APP_DEPLOY_METHOD,
    nodeEnv === "production" ? "unknown" : "local_dev",
  );
  const buildSource = normalizeText(
    env.APP_BUILD_SOURCE,
    deployMethod === "local_dev" ? "local_process" : deployMethod,
  );

  return {
    git: {
      commit: normalizeText(env.APP_GIT_COMMIT || env.GIT_COMMIT),
      branch: normalizeText(env.APP_GIT_BRANCH || env.GIT_BRANCH),
    },
    deploy: {
      method: deployMethod,
      source: buildSource,
    },
    build: {
      timestamp: normalizeOptionalText(env.APP_BUILD_TIMESTAMP),
      source: buildSource,
      version: readPackageVersion(),
    },
  };
}

function buildHealthPayload({ requestId, authEnabled, runtimeMetadata, databaseStatus = "ok" }) {
  const metadata = runtimeMetadata || readRuntimeMetadata();
  return {
    status: "ok",
    requestId: requestId || null,
    authEnabled: Boolean(authEnabled),
    git: metadata.git,
    deploy: metadata.deploy,
    build: metadata.build,
    checks: {
      database: databaseStatus,
    },
  };
}

module.exports = {
  buildHealthPayload,
  readPackageVersion,
  readRuntimeMetadata,
};
