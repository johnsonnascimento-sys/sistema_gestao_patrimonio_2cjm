/**
 * Modulo: scripts
 * Arquivo: validate_governance.js
 * Funcao no sistema: validar gates minimos de governanca antes de commit/deploy.
 */
"use strict";

const { spawnSync } = require("node:child_process");

const allowPendingCommit = process.argv.includes("--allow-pending-commit");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    code: Number(result.status ?? 1),
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}

function getChangedFiles() {
  const diff = run("git", ["diff", "--name-only", "HEAD"]);
  if (diff.code !== 0) return [];
  return diff.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasRelevantRuntimeChange(files) {
  return files.some((file) =>
    file.startsWith("backend/")
    || file.startsWith("database/")
    || file === "docker-compose.vps.yml"
    || file === "scripts/vps_deploy.sh"
    || file.startsWith("frontend/src/components/")
    || file.startsWith("frontend/src/services/")
    || file.startsWith("frontend/src/context/")
    || file.startsWith("frontend/src/hooks/"),
  );
}

function hasDocsCoverage(files) {
  return files.some((file) =>
    file.startsWith("docs/")
    || file.startsWith("frontend/src/wiki/"),
  );
}

function hasLogCoverage(files) {
  return files.includes("docs/LOG_GERAL_ALTERACOES.md");
}

function hasPendingCommitInAddedLogLines() {
  const diff = run("git", ["diff", "--unified=0", "--", "docs/LOG_GERAL_ALTERACOES.md"]);
  if (diff.code !== 0 || !diff.stdout.trim()) return false;
  return diff.stdout
    .split(/\r?\n/)
    .some((line) => line.startsWith("+") && !line.startsWith("+++") && line.includes("PENDENTE_COMMIT"));
}

function main() {
  const errors = [];
  const changedFiles = getChangedFiles();

  if (hasRelevantRuntimeChange(changedFiles) && !hasDocsCoverage(changedFiles)) {
    errors.push("Mudanca relevante de runtime/UX detectada sem atualizacao em docs/ ou frontend/src/wiki/.");
  }
  if (hasRelevantRuntimeChange(changedFiles) && !hasLogCoverage(changedFiles)) {
    errors.push("Mudanca relevante detectada sem atualizar docs/LOG_GERAL_ALTERACOES.md.");
  }
  if (!allowPendingCommit && hasPendingCommitInAddedLogLines()) {
    errors.push("Foram adicionadas linhas com PENDENTE_COMMIT no log geral. Use commit real ou rode com --allow-pending-commit apenas em rascunho local.");
  }

  const wikiCheck = run("python", ["scripts/check_wiki_encoding.py"]);
  if (wikiCheck.code !== 0) {
    errors.push(`Falha em scripts/check_wiki_encoding.py:\n${wikiCheck.stdout}${wikiCheck.stderr}`.trim());
  }

  if (errors.length) {
    console.error("[governance] validacao falhou:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log("[governance] validacao ok.");
}

main();
