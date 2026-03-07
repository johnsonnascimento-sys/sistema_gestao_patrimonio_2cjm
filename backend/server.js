/**
 * Modulo: backend
 * Arquivo: server.js
 * Funcao no sistema: API HTTP com Swagger, importacao GEAFIN e movimentacao patrimonial.
 */
"use strict";

const express = require("express");
const multer = require("multer");
const helmet = require("helmet");
const cors = require("cors");
const iconv = require("iconv-lite");
const { parse } = require("csv-parse/sync");
const swaggerUi = require("swagger-ui-express");
const { Pool } = require("pg");
const { randomUUID, createHash } = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("node:path");
const fs = require("node:fs");
const { spawn, execFileSync } = require("node:child_process");
const sharp = require("sharp");
const { generateTermoPdf, generateTablePdf } = require("./src/services/pdfReports");

const { setDbContext } = require("./src/services/dbContext");
const { createInventarioController } = require("./src/controllers/inventarioController");

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const DATABASE_URL = process.env.DATABASE_URL || "";
const DB_SSL = process.env.DB_SSL || "require";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
const AUTH_ENABLED = String(process.env.AUTH_ENABLED || "false").trim().toLowerCase() === "true";
const AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || "";
const AUTH_JWT_EXPIRES_IN = process.env.AUTH_JWT_EXPIRES_IN || "12h";
if (!DATABASE_URL) throw new Error("Variavel obrigatoria ausente: DATABASE_URL");
if (AUTH_ENABLED && !AUTH_JWT_SECRET) {
  throw new Error("Variavel obrigatoria ausente: AUTH_JWT_SECRET (AUTH_ENABLED=true)");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DB_SSL === "disable" ? false : { rejectUnauthorized: false },
});

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const VALID_UNIDADES = new Set([1, 2, 3, 4]);
const VALID_MOV = new Set(["TRANSFERENCIA", "CAUTELA_SAIDA", "CAUTELA_RETORNO"]);
const VALID_STATUS_BEM = new Set(["OK", "BAIXADO", "EM_CAUTELA", "AGUARDANDO_RECEBIMENTO"]);
const VALID_ROLES = new Set(["ADMIN", "OPERADOR"]);
const ROLE_CODES = Object.freeze([
  "LEITURA",
  "OPERADOR_BASICO",
  "OPERADOR_AVANCADO",
  "SUPERVISOR",
  "ADMIN_COMPLETO",
]);
const ACL_MENU_PERMISSIONS = Object.freeze([
  "menu.dashboard.view",
  "menu.bens.view",
  "menu.movimentacoes.view",
  "menu.inventario_contagem.view",
  "menu.inventario_admin.view",
  "menu.classificacao.view",
  "menu.catalogo_material.view",
  "menu.classificacoes_siafi.view",
  "menu.importacoes_geafin.view",
  "menu.auditoria.view",
  "menu.admin_locais.view",
  "menu.admin_backup.view",
  "menu.admin_health.view",
  "menu.admin_perfis.view",
  "menu.admin_aprovacoes.view",
  "menu.wiki.view",
]);
const ACL_ACTION_PERMISSIONS = Object.freeze([
  "action.bem.editar_operacional.execute",
  "action.bem.editar_operacional.request",
  "action.bem.alterar_responsavel.execute",
  "action.bem.alterar_responsavel.request",
  "action.bem.alterar_status.execute",
  "action.bem.alterar_status.request",
  "action.bem.alterar_localizacao.execute",
  "action.bem.alterar_localizacao.request",
  "action.bem.vincular_local_lote.execute",
  "action.bem.vincular_local_lote.request",
  "action.aprovacao.listar",
  "action.aprovacao.aprovar",
  "action.aprovacao.reprovar",
]);
const ACL_ALL_PERMISSIONS = Object.freeze([...ACL_MENU_PERMISSIONS, ...ACL_ACTION_PERMISSIONS]);
const SOLICITACAO_STATUS = Object.freeze({
  PENDENTE: "PENDENTE",
  APROVADA: "APROVADA",
  REPROVADA: "REPROVADA",
  CANCELADA: "CANCELADA",
  EXPIRADA: "EXPIRADA",
  ERRO_APLICACAO: "ERRO_APLICACAO",
});
const SOLICITACAO_TIPO_ACAO = Object.freeze({
  BEM_PATCH_OPERACIONAL: "BEM_PATCH_OPERACIONAL",
  BEM_PATCH: "BEM_PATCH",
  BEM_VINCULAR_LOCAL_LOTE: "BEM_VINCULAR_LOCAL_LOTE",
  MOVIMENTACAO: "MOVIMENTACAO",
});
const GEAFIN_MODES = new Set(["INCREMENTAL", "TOTAL"]);
const GEAFIN_SCOPE_TYPES = new Set(["GERAL", "UNIDADE"]);
const GEAFIN_SESSION_STATUS = new Set([
  "EM_ANDAMENTO",
  "AGUARDANDO_CONFIRMACAO",
  "APLICANDO",
  "CANCELADO",
  "CONCLUIDO",
  "ERRO",
]);
const GEAFIN_ACTION_TYPES = new Set([
  "CRIAR_BEM",
  "ATUALIZAR_BEM",
  "SEM_MUDANCA",
  "ERRO_VALIDACAO",
]);
const GEAFIN_DECISIONS = new Set(["PENDENTE", "APROVADA", "REJEITADA", "AUTO"]);
const GEAFIN_AUSENTES_ACTIONS = new Set(["MANTER", "BAIXAR"]);
const TOMBAMENTO_GEAFIN_RE = /^\d{10}$/;
const TOMBAMENTO_LEGADO_RE = /^\d{4}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

// Cache simples de compatibilidade de schema: evita derrubar a API quando o backend sobe antes das migrations.
let _documentosHasAvaliacaoInservivelId = null;
let _aclSchemaCaps = null;

async function documentosHasAvaliacaoInservivelIdColumn() {
  if (_documentosHasAvaliacaoInservivelId != null) return _documentosHasAvaliacaoInservivelId;
  try {
    const r = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'documentos'
         AND column_name = 'avaliacao_inservivel_id'
       LIMIT 1;`,
    );
    _documentosHasAvaliacaoInservivelId = Boolean(r.rowCount);
  } catch (_error) {
    _documentosHasAvaliacaoInservivelId = false;
  }
  return _documentosHasAvaliacaoInservivelId;
}

async function getAclSchemaCaps() {
  if (_aclSchemaCaps) return _aclSchemaCaps;
  try {
    const r = await pool.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema='public' AND table_name='roles_acesso'
         ) AS "hasRoles",
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema='public' AND table_name='permissoes_acesso'
         ) AS "hasPermissoes",
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema='public' AND table_name='role_permissoes_acesso'
         ) AS "hasRolePermissoes",
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema='public' AND table_name='perfil_roles_acesso'
         ) AS "hasPerfilRoles",
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema='public' AND table_name='solicitacoes_aprovacao'
         ) AS "hasSolicitacoesAprovacao",
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema='public' AND table_name='solicitacoes_aprovacao_eventos'
         ) AS "hasSolicitacoesEventos";`,
    );
    _aclSchemaCaps = r.rows?.[0] || null;
  } catch (_error) {
    _aclSchemaCaps = null;
  }
  return _aclSchemaCaps || {
    hasRoles: false,
    hasPermissoes: false,
    hasRolePermissoes: false,
    hasPerfilRoles: false,
    hasSolicitacoesAprovacao: false,
    hasSolicitacoesEventos: false,
  };
}

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"],
  }),
);
app.use(express.json({ limit: "12mb" }));

// --- Servir fotos salvas localmente (VPS) ---
const FOTOS_DIR = path.join(__dirname, "data", "fotos");
fs.mkdirSync(path.join(FOTOS_DIR, "bem"), { recursive: true });
fs.mkdirSync(path.join(FOTOS_DIR, "catalogo"), { recursive: true });
const RUNTIME_LOG_DIR = path.join(FOTOS_DIR, "logs");
const RUNTIME_ERROR_LOG_FILE = path.join(RUNTIME_LOG_DIR, "runtime_errors.ndjson");
const BACKUP_OPS_LOG_FILE = path.join(RUNTIME_LOG_DIR, "backup_ops.ndjson");
const BACKUP_LOCAL_ROOT = process.env.BACKUP_LOCAL_ROOT || path.join(__dirname, "data", "backups");
const BACKUP_LOCAL_DB_DIR = path.join(BACKUP_LOCAL_ROOT, "db");
const BACKUP_LOCAL_MEDIA_DIR = path.join(BACKUP_LOCAL_ROOT, "media");
const BACKUP_REMOTE_BASE = String(process.env.BACKUP_REMOTE_BASE || "cjm_gdrive:db-backups").trim();
const BACKUP_KEEP_DAYS_DEFAULT = Number(process.env.BACKUP_KEEP_DAYS_DEFAULT || 14);
const BACKUP_MEDIA_SOURCE = process.env.BACKUP_MEDIA_SOURCE || FOTOS_DIR;
const BACKUP_REMOTE_DB_DIR = `${BACKUP_REMOTE_BASE}/database`;
const BACKUP_REMOTE_MEDIA_DIR = `${BACKUP_REMOTE_BASE}/media`;
fs.mkdirSync(RUNTIME_LOG_DIR, { recursive: true });
fs.mkdirSync(BACKUP_LOCAL_DB_DIR, { recursive: true });
fs.mkdirSync(BACKUP_LOCAL_MEDIA_DIR, { recursive: true });
app.use("/fotos", express.static(FOTOS_DIR, { maxAge: "7d", immutable: true }));

function readGitMeta() {
  const envCommit = String(process.env.APP_GIT_COMMIT || process.env.GIT_COMMIT || "").trim();
  const envBranch = String(process.env.APP_GIT_BRANCH || process.env.GIT_BRANCH || "").trim();
  if (envCommit || envBranch) {
    return { commit: envCommit || null, branch: envBranch || null };
  }
  try {
    const commit = String(execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] }) || "").trim();
    const branch = String(execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] }) || "").trim();
    return { commit: commit || null, branch: branch || null };
  } catch (_error) {
    return { commit: null, branch: null };
  }
}
const APP_GIT_META = readGitMeta();
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    // Log de auditoria operacional (nao loga corpo/segredos).
    console.log(`[${req.requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

function normalizeHuman(v) {
  return String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function stableJson(value) {
  if (value === undefined) return "__undefined__";
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((x) => stableJson(x));
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = stableJson(value[key]);
  return out;
}

function areEqualForAudit(a, b) {
  return JSON.stringify(stableJson(a)) === JSON.stringify(stableJson(b));
}

function diffAuditObjects(beforeObj, afterObj) {
  const before = beforeObj && typeof beforeObj === "object" ? beforeObj : {};
  const after = afterObj && typeof afterObj === "object" ? afterObj : {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  const out = [];
  for (const key of keys) {
    if (key === "updated_at") continue;
    const oldVal = before[key];
    const newVal = after[key];
    if (!areEqualForAudit(oldVal, newVal)) {
      out.push({ field: key, before: oldVal ?? null, after: newVal ?? null });
    }
  }
  return out;
}

function appendRuntimeErrorLog(entry) {
  try {
    fs.appendFileSync(RUNTIME_ERROR_LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (_e) {
    // Falha de log nao deve interromper fluxo da API.
  }
}

function readRuntimeErrorLog(limit) {
  if (!fs.existsSync(RUNTIME_ERROR_LOG_FILE)) return [];
  const lines = fs.readFileSync(RUNTIME_ERROR_LOG_FILE, "utf8").split(/\r?\n/).filter(Boolean);
  const items = [];
  for (let i = lines.length - 1; i >= 0 && items.length < limit; i -= 1) {
    try {
      items.push(JSON.parse(lines[i]));
    } catch (_e) {
      // Ignora linha malformada.
    }
  }
  return items;
}

function appendBackupOpsLog(entry) {
  try {
    fs.appendFileSync(BACKUP_OPS_LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (_e) {
    // Falha de log nao deve interromper fluxo.
  }
}

function readBackupOpsLog(limit) {
  if (!fs.existsSync(BACKUP_OPS_LOG_FILE)) return [];
  const lines = fs.readFileSync(BACKUP_OPS_LOG_FILE, "utf8").split(/\r?\n/).filter(Boolean);
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i -= 1) {
    try {
      out.push(JSON.parse(lines[i]));
    } catch (_e) {
      // Ignora linha malformada.
    }
  }
  return out;
}

function toUtcStamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function toTimeZoneIso(date = new Date(), timeZone = "America/Sao_Paulo") {
  const d = date instanceof Date ? date : new Date(date);
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");

  const asUtcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  const offsetMinutes = Math.round((asUtcMs - d.getTime()) / 60000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offH = String(Math.floor(abs / 60)).padStart(2, "0");
  const offM = String(abs % 60).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offH}:${offM}`;
}

function toBrasiliaIso(date = new Date()) {
  return toTimeZoneIso(date, "America/Sao_Paulo");
}

function sanitizeBackupTag(raw, fallback) {
  const v = String(raw || "").trim().toLowerCase();
  const s = v.replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s || fallback;
}

function parseKeepDays(rawValue, fallbackValue) {
  if (rawValue == null || rawValue === "") return fallbackValue;
  const n = Number(rawValue);
  if (!Number.isFinite(n) || n < 0 || n > 180) throw new HttpError(422, "KEEP_DAYS_INVALIDO", "keepDays deve ser inteiro entre 0 e 180.");
  return Math.trunc(n);
}

function listLocalBackupFiles(dirAbs, prefix) {
  if (!fs.existsSync(dirAbs)) return [];
  const rows = [];
  for (const name of fs.readdirSync(dirAbs)) {
    if (!name.startsWith(prefix)) continue;
    const abs = path.join(dirAbs, name);
    let st;
    try {
      st = fs.statSync(abs);
    } catch (_e) {
      continue;
    }
    if (!st.isFile()) continue;
    rows.push({
      name,
      size: Number(st.size || 0),
      modifiedAt: st.mtime.toISOString(),
      source: "local",
    });
  }
  rows.sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
  return rows.slice(0, 50);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || undefined,
      env: options.env || process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk || "");
      if (stdout.length > 2_000_000) stdout = stdout.slice(-2_000_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
      if (stderr.length > 2_000_000) stderr = stderr.slice(-2_000_000);
    });

    child.on("error", (error) => {
      resolve({ code: -1, stdout, stderr: `${stderr}\n${error?.message || String(error)}`.trim() });
    });
    child.on("close", (code) => {
      resolve({ code: Number(code || 0), stdout, stderr });
    });

    if (options.input) child.stdin.write(options.input);
    child.stdin.end();
  });
}

async function ensureAdminPassword(req, senha) {
  const raw = String(senha || "");
  if (!raw) throw new HttpError(422, "SENHA_ADMIN_OBRIGATORIA", "Informe a senha do administrador para confirmar.");
  if (!req.user?.id) throw new HttpError(401, "NAO_AUTENTICADO", "Usuario autenticado nao encontrado.");

  const r = await pool.query(
    `SELECT senha_hash AS "senhaHash", ativo
     FROM perfis
     WHERE id = $1
     LIMIT 1;`,
    [String(req.user.id)],
  );
  const perfil = r.rows[0] || null;
  if (!perfil || !perfil.senhaHash) throw new HttpError(401, "NAO_AUTENTICADO", "Perfil sem senha configurada.");
  if (!perfil.ativo) throw new HttpError(403, "PERFIL_INATIVO", "Perfil inativo.");

  const ok = await bcrypt.compare(raw, String(perfil.senhaHash));
  if (!ok) throw new HttpError(401, "SENHA_ADMIN_INVALIDA", "Senha do administrador invalida.");
}

async function listRemoteBackupFiles(remoteDir) {
  const probe = await runCommand("rclone", ["lsjson", remoteDir, "--max-depth", "1"]);
  if (probe.code !== 0) return [];
  let rows = [];
  try {
    rows = JSON.parse(String(probe.stdout || "[]"));
  } catch (_e) {
    return [];
  }
  return rows
    .filter((x) => x && !x.IsDir && x.Name)
    .map((x) => ({
      name: String(x.Name),
      size: Number(x.Size || 0),
      modifiedAt: x.ModTime ? new Date(x.ModTime).toISOString() : null,
      source: "drive",
    }))
    .sort((a, b) => String(b.modifiedAt || "").localeCompare(String(a.modifiedAt || "")))
    .slice(0, 50);
}

function pruneLocalDir(dirAbs, prefix, keepDays) {
  const now = Date.now();
  const keepMs = keepDays * 24 * 60 * 60 * 1000;
  if (!fs.existsSync(dirAbs)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(dirAbs)) {
    if (!name.startsWith(prefix)) continue;
    const abs = path.join(dirAbs, name);
    let st;
    try {
      st = fs.statSync(abs);
    } catch (_e) {
      continue;
    }
    if (!st.isFile()) continue;
    if (keepDays > 0 && now - Number(st.mtimeMs || 0) <= keepMs) continue;
    try {
      fs.unlinkSync(abs);
      removed += 1;
    } catch (_e) {
      // Ignora falha pontual.
    }
  }
  return removed;
}

async function performBackupOperation(params) {
  const scope = params.scope;
  const keepDays = params.keepDays;
  const tag = params.tag;
  const ts = toUtcStamp();
  const created = { db: null, media: null };

  if (scope === "db" || scope === "all") {
    const dbFileName = `db_${ts}_${tag}.sql.gz`;
    const dbLocalAbs = path.join(BACKUP_LOCAL_DB_DIR, dbFileName);
    const dbDump = await runCommand("sh", ["-lc", "pg_dump \"$DATABASE_URL\" --no-owner --no-privileges --format=plain | gzip -9 > \"$OUT_FILE\""], {
      env: { ...process.env, DATABASE_URL, OUT_FILE: dbLocalAbs },
    });
    if (dbDump.code !== 0) {
      throw new HttpError(500, "BACKUP_DB_FALHA", `Falha no dump do banco: ${String(dbDump.stderr || dbDump.stdout || "").slice(-600)}`);
    }
    const dbUpload = await runCommand("rclone", ["copyto", dbLocalAbs, `${BACKUP_REMOTE_DB_DIR}/${dbFileName}`]);
    if (dbUpload.code !== 0) {
      throw new HttpError(500, "BACKUP_DB_UPLOAD_FALHA", `Falha no upload do dump: ${String(dbUpload.stderr || dbUpload.stdout || "").slice(-600)}`);
    }
    created.db = { name: dbFileName, localPath: dbLocalAbs, remotePath: `${BACKUP_REMOTE_DB_DIR}/${dbFileName}` };
  }

  if (scope === "media" || scope === "all") {
    if (!fs.existsSync(BACKUP_MEDIA_SOURCE)) {
      throw new HttpError(500, "BACKUP_MEDIA_ORIGEM_AUSENTE", `Origem de imagens nao encontrada: ${BACKUP_MEDIA_SOURCE}`);
    }
    const mediaFileName = `media_${ts}_${tag}.tar.gz`;
    const mediaLocalAbs = path.join(BACKUP_LOCAL_MEDIA_DIR, mediaFileName);
    const mediaTar = await runCommand("sh", ["-lc", "tar -C \"$SRC_PARENT\" -czf \"$OUT_FILE\" \"$SRC_BASE\""], {
      env: {
        ...process.env,
        SRC_PARENT: path.dirname(BACKUP_MEDIA_SOURCE),
        SRC_BASE: path.basename(BACKUP_MEDIA_SOURCE),
        OUT_FILE: mediaLocalAbs,
      },
    });
    if (mediaTar.code !== 0) {
      throw new HttpError(500, "BACKUP_MEDIA_FALHA", `Falha no backup de imagens: ${String(mediaTar.stderr || mediaTar.stdout || "").slice(-600)}`);
    }
    const mediaUpload = await runCommand("rclone", ["copyto", mediaLocalAbs, `${BACKUP_REMOTE_MEDIA_DIR}/${mediaFileName}`]);
    if (mediaUpload.code !== 0) {
      throw new HttpError(500, "BACKUP_MEDIA_UPLOAD_FALHA", `Falha no upload de imagens: ${String(mediaUpload.stderr || mediaUpload.stdout || "").slice(-600)}`);
    }
    created.media = { name: mediaFileName, localPath: mediaLocalAbs, remotePath: `${BACKUP_REMOTE_MEDIA_DIR}/${mediaFileName}` };
  }

  const localPrunedDb = pruneLocalDir(BACKUP_LOCAL_DB_DIR, "db_", keepDays);
  const localPrunedMedia = pruneLocalDir(BACKUP_LOCAL_MEDIA_DIR, "media_", keepDays);
  await runCommand("rclone", ["delete", BACKUP_REMOTE_DB_DIR, "--min-age", `${keepDays}d`, "--include", "db_*.sql.gz"]);
  await runCommand("rclone", ["delete", BACKUP_REMOTE_MEDIA_DIR, "--min-age", `${keepDays}d`, "--include", "media_*.tar.gz"]);

  return {
    ts,
    scope,
    keepDays,
    tag,
    created,
    retention: {
      localPrunedDb,
      localPrunedMedia,
    },
  };
}

async function performRestoreOperation(params) {
  const remoteFile = String(params.remoteFile || "").trim();
  if (!/^db_[a-zA-Z0-9_-]+\.sql\.gz$/.test(remoteFile)) {
    throw new HttpError(422, "ARQUIVO_RESTORE_INVALIDO", "remoteFile deve ser um dump valido (db_*.sql.gz).");
  }

  const tmpDir = "/tmp/cjm_restore";
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpAbs = path.join(tmpDir, remoteFile);
  const fetched = await runCommand("rclone", ["copyto", `${BACKUP_REMOTE_DB_DIR}/${remoteFile}`, tmpAbs]);
  if (fetched.code !== 0) {
    throw new HttpError(500, "RESTORE_DOWNLOAD_FALHA", `Falha ao baixar backup remoto: ${String(fetched.stderr || fetched.stdout || "").slice(-600)}`);
  }

  const restore = await runCommand("sh", ["-lc", "gunzip -c \"$IN_FILE\" | psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1"], {
    env: { ...process.env, DATABASE_URL, IN_FILE: tmpAbs },
  });
  if (restore.code !== 0) {
    throw new HttpError(500, "RESTORE_EXEC_FALHA", `Falha ao restaurar dump: ${String(restore.stderr || restore.stdout || "").slice(-600)}`);
  }
  try { fs.unlinkSync(tmpAbs); } catch (_e) { }
  return { remoteFile };
}

const PATRIMONIO_AUDIT_TABLES = Object.freeze([
  "bens",
  "catalogo_bens",
  "movimentacoes",
  "contagens",
  "historico_transferencias",
  "documentos",
]);

function isUuidLike(raw) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(raw || "").trim());
}

function extractBearerToken(req) {
  const raw = req.headers?.authorization ? String(req.headers.authorization) : "";
  if (!raw) return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return m[1].trim() || null;
}

function signAuthToken(perfil) {
  if (!AUTH_JWT_SECRET) {
    throw new HttpError(
      500,
      "AUTH_CONFIG_INVALIDA",
      "AUTH_JWT_SECRET nao configurado. Defina a variavel no .env antes de usar /auth/*.",
    );
  }
  return jwt.sign(
    {
      sub: perfil.id,
      matricula: perfil.matricula,
      role: perfil.role,
    },
    AUTH_JWT_SECRET,
    { expiresIn: AUTH_JWT_EXPIRES_IN },
  );
}

function buildDefaultAclByLegacyRole(legacyRole) {
  const role = String(legacyRole || "OPERADOR").trim().toUpperCase();
  if (role === "ADMIN") {
    return {
      roles: ["ADMIN_COMPLETO"],
      permissions: [...ACL_ALL_PERMISSIONS],
      menuPermissions: [...ACL_MENU_PERMISSIONS],
      source: "legacy-admin-fallback",
    };
  }
  return {
    roles: ["OPERADOR_AVANCADO"],
    permissions: [
      "menu.dashboard.view",
      "menu.bens.view",
      "menu.movimentacoes.view",
      "menu.inventario_contagem.view",
      "menu.classificacao.view",
      "menu.wiki.view",
      "action.bem.editar_operacional.request",
      "action.bem.alterar_responsavel.request",
      "action.bem.alterar_status.request",
      "action.bem.alterar_localizacao.request",
      "action.bem.vincular_local_lote.request",
    ],
    menuPermissions: [
      "menu.dashboard.view",
      "menu.bens.view",
      "menu.movimentacoes.view",
      "menu.inventario_contagem.view",
      "menu.classificacao.view",
      "menu.wiki.view",
    ],
    source: "legacy-operador-fallback",
  };
}

async function resolveAclForPerfil(perfilId, legacyRole) {
  const caps = await getAclSchemaCaps();
  if (!caps.hasRoles || !caps.hasPermissoes || !caps.hasRolePermissoes || !caps.hasPerfilRoles) {
    return buildDefaultAclByLegacyRole(legacyRole);
  }

  const roleQuery = await pool.query(
    `SELECT r.codigo
     FROM perfil_roles_acesso pr
     JOIN roles_acesso r ON r.id = pr.role_id
     WHERE pr.perfil_id = $1
       AND pr.ativo = TRUE
       AND r.ativo = TRUE
     ORDER BY r.nivel DESC, r.codigo ASC;`,
    [perfilId],
  );

  const roleCodes = roleQuery.rows.map((x) => String(x.codigo || "").trim()).filter(Boolean);
  if (!roleCodes.length) {
    return buildDefaultAclByLegacyRole(legacyRole);
  }

  const permQuery = await pool.query(
    `SELECT DISTINCT p.codigo, p.categoria::text AS categoria
     FROM perfil_roles_acesso pr
     JOIN roles_acesso r ON r.id = pr.role_id
     JOIN role_permissoes_acesso rp ON rp.role_id = r.id
     JOIN permissoes_acesso p ON p.id = rp.permissao_id
     WHERE pr.perfil_id = $1
       AND pr.ativo = TRUE
       AND r.ativo = TRUE
       AND p.ativo = TRUE
     ORDER BY p.codigo ASC;`,
    [perfilId],
  );

  const perms = permQuery.rows.map((x) => String(x.codigo || "").trim()).filter(Boolean);
  const menuPerms = permQuery.rows
    .filter((x) => String(x.categoria || "").toUpperCase() === "MENU")
    .map((x) => String(x.codigo || "").trim())
    .filter(Boolean);

  return {
    roles: roleCodes,
    permissions: perms,
    menuPermissions: menuPerms,
    source: "rbac",
  };
}

async function syncPerfilRoleAcesso(client, { perfilId, legacyRole, atribuidoPorPerfilId = null }) {
  const caps = await getAclSchemaCaps();
  if (!caps.hasRoles || !caps.hasPerfilRoles) return;
  const roleCode = String(legacyRole || "").toUpperCase() === "ADMIN" ? "ADMIN_COMPLETO" : "OPERADOR_AVANCADO";

  await setPerfilRoleAcessoByCode(client, {
    perfilId,
    roleCode,
    atribuidoPorPerfilId,
  });
}

async function setPerfilRoleAcessoByCode(client, { perfilId, roleCode, atribuidoPorPerfilId = null }) {
  const caps = await getAclSchemaCaps();
  if (!caps.hasRoles || !caps.hasPerfilRoles) return;
  const roleCodeFinal = String(roleCode || "").trim().toUpperCase();
  if (!ROLE_CODES.includes(roleCodeFinal)) {
    throw new HttpError(422, "ROLE_ACESSO_INVALIDA", "roleCodigo invalido para RBAC.");
  }

  const roleQ = await client.query(
    `SELECT id
     FROM roles_acesso
     WHERE codigo = $1
       AND ativo = TRUE
     LIMIT 1;`,
    [roleCodeFinal],
  );
  if (!roleQ.rowCount) {
    throw new HttpError(404, "ROLE_ACESSO_NAO_ENCONTRADA", "Role de acesso nao encontrada.");
  }
  const roleId = roleQ.rows[0].id;

  await client.query(
    `UPDATE perfil_roles_acesso
     SET ativo = FALSE, updated_at = NOW()
     WHERE perfil_id = $1
       AND role_id <> $2;`,
    [perfilId, roleId],
  );

  await client.query(
    `INSERT INTO perfil_roles_acesso (perfil_id, role_id, ativo, atribuido_por_perfil_id)
     VALUES ($1, $2, TRUE, $3)
     ON CONFLICT (perfil_id, role_id)
     DO UPDATE
       SET ativo = TRUE,
           atribuido_por_perfil_id = COALESCE(EXCLUDED.atribuido_por_perfil_id, perfil_roles_acesso.atribuido_por_perfil_id),
           updated_at = NOW();`,
    [perfilId, roleId, atribuidoPorPerfilId || null],
  );
}

function roleAcessoToLegacyRole(roleCodigo) {
  return String(roleCodigo || "").trim().toUpperCase() === "ADMIN_COMPLETO" ? "ADMIN" : "OPERADOR";
}

function userHasPermission(user, permissionCode) {
  const code = String(permissionCode || "").trim();
  if (!code) return false;
  if (!AUTH_ENABLED) return true;
  if (!user) return false;

  const aclPerms = Array.isArray(user?.acl?.permissions) ? user.acl.permissions : [];
  if (aclPerms.includes(code) || aclPerms.includes("*")) return true;

  // Fallback de compatibilidade para ambiente sem RBAC migrado.
  if (String(user.role || "").toUpperCase() === "ADMIN") return true;
  return false;
}

function requirePermission(permissionCode) {
  return (req, _res, next) => {
    try {
      if (userHasPermission(req.user, permissionCode)) return next();
      throw new HttpError(403, "SEM_PERMISSAO", "Voce nao tem permissao para executar esta acao.");
    } catch (error) {
      next(error);
    }
  };
}

function requireAnyPermission(permissionCodes) {
  const codes = Array.isArray(permissionCodes) ? permissionCodes.map((x) => String(x || "").trim()).filter(Boolean) : [];
  return (req, _res, next) => {
    try {
      if (!codes.length) throw new HttpError(500, "ACL_CONFIG_INVALIDA", "Nenhuma permissao foi configurada.");
      if (codes.some((code) => userHasPermission(req.user, code))) return next();
      throw new HttpError(403, "SEM_PERMISSAO", "Voce nao tem permissao para executar esta acao.");
    } catch (error) {
      next(error);
    }
  };
}

async function requireAuth(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) throw new HttpError(401, "NAO_AUTENTICADO", "Envie Authorization: Bearer <token>.");

    let payload;
    try {
      payload = jwt.verify(token, AUTH_JWT_SECRET);
    } catch (_e) {
      throw new HttpError(401, "TOKEN_INVALIDO", "Token invalido ou expirado.");
    }

    const perfilId = payload?.sub ? String(payload.sub).trim() : "";
    if (!UUID_RE.test(perfilId)) throw new HttpError(401, "TOKEN_INVALIDO", "Token invalido (sub).");

    const r = await pool.query(
      `SELECT id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo
       FROM perfis
       WHERE id = $1
       LIMIT 1;`,
      [perfilId],
    );

    const perfil = r.rows[0] || null;
    if (!perfil) throw new HttpError(401, "NAO_AUTENTICADO", "Perfil do token nao encontrado.");
    if (!perfil.ativo) throw new HttpError(403, "PERFIL_INATIVO", "Perfil inativo.");

    const acl = await resolveAclForPerfil(perfil.id, perfil.role);
    req.user = { ...perfil, acl };
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, _res, next) {
  try {
    if (!req.user) throw new HttpError(401, "NAO_AUTENTICADO", "Autenticacao obrigatoria.");
    if (String(req.user.role || "").toUpperCase() !== "ADMIN") {
      throw new HttpError(403, "SEM_PERMISSAO", "Operacao restrita ao perfil ADMIN.");
    }
    next();
  } catch (error) {
    next(error);
  }
}

const mustAuth = AUTH_ENABLED ? requireAuth : (_req, _res, next) => next();
const mustAdmin = AUTH_ENABLED ? [requireAuth, requireAdmin] : (_req, _res, next) => next();

app.post("/auth/login", async (req, res, next) => {
  try {
    const matricula = String(req.body?.matricula || "").trim();
    const senha = String(req.body?.senha || "");
    if (!matricula || !senha) throw new HttpError(422, "CREDENCIAIS_OBRIGATORIAS", "Informe matricula e senha.");

    const r = await pool.query(
      `SELECT id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo, senha_hash AS "senhaHash"
       FROM perfis
       WHERE matricula = $1
       LIMIT 1;`,
      [matricula],
    );

    const perfil = r.rows[0] || null;
    if (!perfil || !perfil.senhaHash) throw new HttpError(401, "CREDENCIAIS_INVALIDAS", "Matricula/senha invalidas.");
    if (!perfil.ativo) throw new HttpError(403, "PERFIL_INATIVO", "Perfil inativo.");

    const ok = await bcrypt.compare(senha, String(perfil.senhaHash));
    if (!ok) throw new HttpError(401, "CREDENCIAIS_INVALIDAS", "Matricula/senha invalidas.");

    await pool.query("UPDATE perfis SET ultimo_login_em = NOW(), updated_at = NOW() WHERE id = $1;", [perfil.id]);

    const token = signAuthToken(perfil);
    const { senhaHash: _ignore, ...perfilOut } = perfil;
    res.json({ requestId: req.requestId, token, perfil: perfilOut });
  } catch (error) {
    next(error);
  }
});

app.post("/auth/primeiro-acesso", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const matricula = String(req.body?.matricula || "").trim();
    const nome = String(req.body?.nome || "").trim();
    const senha = String(req.body?.senha || "");

    if (!matricula || !nome || !senha) {
      throw new HttpError(422, "DADOS_OBRIGATORIOS", "Informe matricula, nome e senha.");
    }
    if (senha.length < 8) throw new HttpError(422, "SENHA_FRACA", "Senha deve ter pelo menos 8 caracteres.");

    await client.query("BEGIN");

    const r = await client.query(
      `SELECT id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo, senha_hash AS "senhaHash"
       FROM perfis
       WHERE matricula = $1
       FOR UPDATE;`,
      [matricula],
    );

    const perfil = r.rows[0] || null;
    if (!perfil) throw new HttpError(404, "PERFIL_NAO_ENCONTRADO", "Perfil nao encontrado para esta matricula.");
    if (!perfil.ativo) throw new HttpError(403, "PERFIL_INATIVO", "Perfil inativo.");
    if (perfil.senhaHash) throw new HttpError(409, "SENHA_JA_DEFINIDA", "Senha ja definida para este perfil.");

    if (normalizeHuman(perfil.nome) !== normalizeHuman(nome)) {
      throw new HttpError(403, "NOME_NAO_CONFERE", "Nome nao confere com o cadastro do perfil.");
    }

    const hash = await bcrypt.hash(senha, 10);

    // Bootstrap controlado: se nao existe nenhum ADMIN no sistema, o primeiro "primeiro acesso" vira ADMIN.
    const admin = await client.query("SELECT 1 FROM perfis WHERE role = 'ADMIN' LIMIT 1;");
    const roleFinal = admin.rowCount ? String(perfil.role || "OPERADOR") : "ADMIN";

    const upd = await client.query(
      `UPDATE perfis
       SET senha_hash = $2, senha_definida_em = NOW(), role = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo;`,
      [perfil.id, hash, roleFinal],
    );

    await client.query("COMMIT");

    const perfilOut = upd.rows[0];
    const token = signAuthToken(perfilOut);
    res.status(201).json({ requestId: req.requestId, token, perfil: perfilOut });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

app.get("/auth/me", mustAuth, async (req, res) => {
  res.json({ requestId: req.requestId, authEnabled: AUTH_ENABLED, perfil: req.user || null });
});

app.get("/auth/acl", mustAuth, async (req, res, next) => {
  try {
    const acl = req.user?.acl || buildDefaultAclByLegacyRole(req.user?.role);
    res.json({
      requestId: req.requestId,
      authEnabled: AUTH_ENABLED,
      perfilId: req.user?.id || null,
      roles: acl.roles || [],
      permissions: acl.permissions || [],
      menuPermissions: acl.menuPermissions || [],
      source: acl.source || "unknown",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/aprovacoes/solicitacoes", mustAuth, requirePermission("action.aprovacao.listar"), async (req, res, next) => {
  try {
    const caps = await getAclSchemaCaps();
    if (!caps.hasSolicitacoesAprovacao) {
      throw new HttpError(503, "APROVACAO_INDISPONIVEL", "Estrutura de aprovacao ainda nao foi migrada no banco.");
    }

    const limit = Math.max(1, Math.min(200, parseIntOrDefault(req.query?.limit, 50)));
    const offset = Math.max(0, parseIntOrDefault(req.query?.offset, 0));
    const status = req.query?.status ? String(req.query.status).trim().toUpperCase() : "";
    const tipoAcao = req.query?.tipoAcao ? String(req.query.tipoAcao).trim().toUpperCase() : "";
    const solicitantePerfilId = req.query?.solicitantePerfilId ? String(req.query.solicitantePerfilId).trim() : "";
    if (solicitantePerfilId && !UUID_RE.test(solicitantePerfilId)) {
      throw new HttpError(422, "PERFIL_ID_INVALIDO", "solicitantePerfilId deve ser UUID.");
    }

    const where = [];
    const params = [];
    let i = 1;
    if (status) {
      where.push(`s.status = $${i}::public.status_solicitacao_aprovacao`);
      params.push(status);
      i += 1;
    }
    if (tipoAcao) {
      where.push(`s.tipo_acao = $${i}`);
      params.push(tipoAcao);
      i += 1;
    }
    if (solicitantePerfilId) {
      where.push(`s.solicitante_perfil_id = $${i}`);
      params.push(solicitantePerfilId);
      i += 1;
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const itemsQ = await pool.query(
      `SELECT
         s.id,
         s.tipo_acao AS "tipoAcao",
         s.entidade_tipo AS "entidadeTipo",
         s.entidade_id AS "entidadeId",
         s.status::text AS status,
         s.payload,
         s.snapshot_before AS "snapshotBefore",
         s.resultado_execucao AS "resultadoExecucao",
         s.justificativa_solicitante AS "justificativaSolicitante",
         s.justificativa_admin AS "justificativaAdmin",
         s.expira_em AS "expiraEm",
         s.created_at AS "createdAt",
         s.updated_at AS "updatedAt",
         s.solicitante_perfil_id AS "solicitantePerfilId",
         ps.nome AS "solicitanteNome",
         ps.matricula AS "solicitanteMatricula",
         s.aprovado_por_perfil_id AS "aprovadoPorPerfilId",
         pa.nome AS "aprovadoPorNome",
         s.reprovado_por_perfil_id AS "reprovadoPorPerfilId",
         pr.nome AS "reprovadoPorNome"
       FROM solicitacoes_aprovacao s
       LEFT JOIN perfis ps ON ps.id = s.solicitante_perfil_id
       LEFT JOIN perfis pa ON pa.id = s.aprovado_por_perfil_id
       LEFT JOIN perfis pr ON pr.id = s.reprovado_por_perfil_id
       ${whereSql}
       ORDER BY s.created_at DESC
       LIMIT $${i} OFFSET $${i + 1};`,
      [...params, limit, offset],
    );

    const totalQ = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM solicitacoes_aprovacao s
       ${whereSql};`,
      params,
    );

    res.json({
      requestId: req.requestId,
      paging: {
        limit,
        offset,
        total: Number(totalQ.rows?.[0]?.total || 0),
      },
      items: itemsQ.rows,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/aprovacoes/solicitacoes/:id/aprovar", mustAuth, requirePermission("action.aprovacao.aprovar"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    if (!AUTH_ENABLED) throw new HttpError(409, "AUTH_DESABILITADA", "Aprovacoes administrativas exigem autenticacao ativa.");
    const caps = await getAclSchemaCaps();
    if (!caps.hasSolicitacoesAprovacao || !caps.hasSolicitacoesEventos) {
      throw new HttpError(503, "APROVACAO_INDISPONIVEL", "Estrutura de aprovacao ainda nao foi migrada no banco.");
    }
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "SOLICITACAO_ID_INVALIDO", "id deve ser UUID.");

    await ensureAdminPassword(req, req.body?.adminPassword);
    const justificativaAdmin = req.body?.justificativaAdmin != null
      ? String(req.body.justificativaAdmin).trim().slice(0, 2000)
      : "";

    await client.query("BEGIN");
    const q = await client.query(
      `SELECT
         id,
         tipo_acao AS "tipoAcao",
         entidade_tipo AS "entidadeTipo",
         entidade_id AS "entidadeId",
         status::text AS status,
         payload,
         solicitante_perfil_id AS "solicitantePerfilId"
       FROM solicitacoes_aprovacao
       WHERE id = $1
       FOR UPDATE;`,
      [id],
    );
    if (!q.rowCount) throw new HttpError(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitacao nao encontrada.");
    const solicitacao = q.rows[0];
    if (String(solicitacao.status || "") !== SOLICITACAO_STATUS.PENDENTE) {
      throw new HttpError(409, "SOLICITACAO_STATUS_INVALIDO", "Somente solicitacoes pendentes podem ser aprovadas.");
    }

    let resultadoExecucao = null;
    const origemRegularizacaoContagemId = extractOrigemFromSolicitacaoPayload(solicitacao.payload);
    try {
      resultadoExecucao = await applySolicitacaoByType(client, {
        solicitacao,
        aprovadorPerfilId: req.user?.id ? String(req.user.id) : null,
      });
    } catch (applyError) {
      await client.query(
        `UPDATE solicitacoes_aprovacao
         SET status = 'ERRO_APLICACAO',
             aprovado_por_perfil_id = $2,
             justificativa_admin = $3,
             resultado_execucao = $4::jsonb,
             updated_at = NOW()
         WHERE id = $1;`,
        [
          id,
          req.user?.id ? String(req.user.id) : null,
          justificativaAdmin || null,
          JSON.stringify({ erro: dbError(applyError), tipo: applyError?.code || "ERRO_APLICACAO" }),
        ],
      );
      await addSolicitacaoEvento(client, {
        solicitacaoId: id,
        status: SOLICITACAO_STATUS.ERRO_APLICACAO,
        perfilId: req.user?.id ? String(req.user.id) : null,
        observacao: String(applyError?.message || "Falha ao aplicar solicitacao."),
        payload: { code: applyError?.code || null },
      });
      if (origemRegularizacaoContagemId) {
        await upsertRegularizacaoTransferenciaFluxo(client, {
          contagemId: origemRegularizacaoContagemId,
          statusFluxo: "ERRO",
          perfilId: req.user?.id ? String(req.user.id) : (solicitacao?.solicitantePerfilId || null),
          solicitacaoAprovacaoId: id,
          movimentacaoId: null,
          observacoes: "Falha ao aplicar solicitacao de transferencia aprovada.",
          ultimoErro: String(applyError?.message || "Falha ao aplicar solicitacao."),
        });
      }
      throw applyError;
    }

    await client.query(
      `UPDATE solicitacoes_aprovacao
       SET status = 'APROVADA',
           aprovado_por_perfil_id = $2,
           justificativa_admin = $3,
           resultado_execucao = $4::jsonb,
           updated_at = NOW()
       WHERE id = $1;`,
      [
        id,
        req.user?.id ? String(req.user.id) : null,
        justificativaAdmin || null,
        JSON.stringify(toSafeJson(resultadoExecucao) || {}),
      ],
    );

    await addSolicitacaoEvento(client, {
      solicitacaoId: id,
      status: SOLICITACAO_STATUS.APROVADA,
      perfilId: req.user?.id ? String(req.user.id) : null,
      observacao: "Solicitacao aprovada e aplicada.",
      payload: resultadoExecucao || {},
    });

    await client.query("COMMIT");
    res.json({
      requestId: req.requestId,
      status: SOLICITACAO_STATUS.APROVADA,
      solicitacaoId: id,
      resultado: resultadoExecucao || {},
      message: "Acao aprovada e aplicada com sucesso.",
    });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

app.post("/aprovacoes/solicitacoes/:id/reprovar", mustAuth, requirePermission("action.aprovacao.reprovar"), async (req, res, next) => {
  const client = await pool.connect();
  try {
    if (!AUTH_ENABLED) throw new HttpError(409, "AUTH_DESABILITADA", "Aprovacoes administrativas exigem autenticacao ativa.");
    const caps = await getAclSchemaCaps();
    if (!caps.hasSolicitacoesAprovacao || !caps.hasSolicitacoesEventos) {
      throw new HttpError(503, "APROVACAO_INDISPONIVEL", "Estrutura de aprovacao ainda nao foi migrada no banco.");
    }
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "SOLICITACAO_ID_INVALIDO", "id deve ser UUID.");

    await ensureAdminPassword(req, req.body?.adminPassword);
    const justificativaAdmin = req.body?.justificativaAdmin != null
      ? String(req.body.justificativaAdmin).trim().slice(0, 2000)
      : "";
    if (!justificativaAdmin) throw new HttpError(422, "JUSTIFICATIVA_ADMIN_OBRIGATORIA", "Informe justificativa da reprovacao.");

    await client.query("BEGIN");
    const q = await client.query(
      `SELECT
         id,
         status::text AS status,
         payload,
         solicitante_perfil_id AS "solicitantePerfilId"
       FROM solicitacoes_aprovacao
       WHERE id = $1
       FOR UPDATE;`,
      [id],
    );
    if (!q.rowCount) throw new HttpError(404, "SOLICITACAO_NAO_ENCONTRADA", "Solicitacao nao encontrada.");
    if (String(q.rows[0].status || "") !== SOLICITACAO_STATUS.PENDENTE) {
      throw new HttpError(409, "SOLICITACAO_STATUS_INVALIDO", "Somente solicitacoes pendentes podem ser reprovadas.");
    }

    await client.query(
      `UPDATE solicitacoes_aprovacao
       SET status = 'REPROVADA',
           reprovado_por_perfil_id = $2,
           justificativa_admin = $3,
           updated_at = NOW()
       WHERE id = $1;`,
      [id, req.user?.id ? String(req.user.id) : null, justificativaAdmin],
    );

    await addSolicitacaoEvento(client, {
      solicitacaoId: id,
      status: SOLICITACAO_STATUS.REPROVADA,
      perfilId: req.user?.id ? String(req.user.id) : null,
      observacao: "Solicitacao reprovada.",
      payload: { justificativaAdmin },
    });
    const origemRegularizacaoContagemId = extractOrigemFromSolicitacaoPayload(q.rows[0]?.payload || {});
    if (origemRegularizacaoContagemId) {
      await upsertRegularizacaoTransferenciaFluxo(client, {
        contagemId: origemRegularizacaoContagemId,
        statusFluxo: "ENCAMINHADA",
        perfilId: req.user?.id ? String(req.user.id) : (q.rows[0]?.solicitantePerfilId || null),
        solicitacaoAprovacaoId: null,
        movimentacaoId: null,
        observacoes: "Solicitacao de transferencia reprovada; item retornou para fila de encaminhamento.",
        ultimoErro: null,
      });
    }

    await client.query("COMMIT");
    res.json({
      requestId: req.requestId,
      status: SOLICITACAO_STATUS.REPROVADA,
      solicitacaoId: id,
      message: "Acao reprovada.",
    });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi()));
app.get("/", (_req, res) => res.json({ status: "ok", docs: "/docs" }));

app.get("/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      requestId: req.requestId,
      authEnabled: AUTH_ENABLED,
      git: APP_GIT_META,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/importacoes/geafin/sessoes", mustAdmin, upload.single("arquivo"), async (req, res, next) => {
  try {
    const created = await buildGeafinPreviewSession(req);
    const overview = await getGeafinSessionOverview(created.id);
    res.status(201).json({
      requestId: req.requestId,
      message: "Sessao GEAFIN criada em modo de previa.",
      importacao: overview,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/importacoes/geafin/:id", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "IMPORTACAO_ID_INVALIDO", "id deve ser UUID.");
    const overview = await getGeafinSessionOverview(id);
    if (!overview) throw new HttpError(404, "IMPORTACAO_NAO_ENCONTRADA", "Sessao GEAFIN nao encontrada.");
    res.json({ requestId: req.requestId, importacao: overview });
  } catch (error) {
    next(error);
  }
});

app.get("/importacoes/geafin/:id/acoes", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "IMPORTACAO_ID_INVALIDO", "id deve ser UUID.");
    const limit = Math.max(1, Math.min(500, parseIntOrDefault(req.query?.limit, 100)));
    const offset = Math.max(0, parseIntOrDefault(req.query?.offset, 0));
    const tipoAcao = req.query?.tipoAcao ? String(req.query.tipoAcao).trim().toUpperCase() : "";
    const decisao = req.query?.decisao ? String(req.query.decisao).trim().toUpperCase() : "";
    const q = req.query?.q ? String(req.query.q).trim() : "";

    const where = ["arquivo_id = $1"];
    const params = [id];
    let i = 2;
    if (tipoAcao) {
      where.push(`tipo_acao = $${i}`);
      params.push(tipoAcao);
      i += 1;
    }
    if (decisao) {
      where.push(`decisao = $${i}`);
      params.push(decisao);
      i += 1;
    }
    if (q) {
      where.push(`(
        numero_tombamento ILIKE $${i}
        OR codigo_catalogo ILIKE $${i}
        OR motivo ILIKE $${i}
      )`);
      params.push(`%${q}%`);
      i += 1;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM public.geafin_import_acoes ${whereSql};`, params);
    const rows = await pool.query(
      `SELECT
         id,
         linha_id AS "linhaId",
         ordem,
         tipo_acao AS "tipoAcao",
         requer_confirmacao AS "requerConfirmacao",
         decisao,
         decidido_por AS "decididoPor",
         decidido_em AS "decididoEm",
         aplicada,
         erro_aplicacao AS "erroAplicacao",
         numero_tombamento AS "numeroTombamento",
         codigo_catalogo AS "codigoCatalogo",
         unidade_dona_id AS "unidadeDonaId",
         descricao_resumo AS "descricaoResumo",
         dados_antes_json AS "dadosAntes",
         dados_depois_json AS "dadosDepois",
         motivo,
         em_escopo AS "emEscopo",
         created_at AS "createdAt"
       FROM public.geafin_import_acoes
       ${whereSql}
       ORDER BY ordem ASC
       LIMIT $${i} OFFSET $${i + 1};`,
      [...params, limit, offset],
    );

    res.json({
      requestId: req.requestId,
      paging: { limit, offset, total: Number(count.rows[0]?.total || 0) },
      items: rows.rows,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/importacoes/geafin/:id/acoes/:acaoId/decisao", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    const acaoId = String(req.params?.acaoId || "").trim();
    if (!UUID_RE.test(id) || !UUID_RE.test(acaoId)) throw new HttpError(422, "ID_INVALIDO", "id e acaoId devem ser UUID.");
    const decision = parseGeafinDecisionApply(req.body?.decisao);

    const session = await getGeafinSessionById(id);
    if (!session) throw new HttpError(404, "IMPORTACAO_NAO_ENCONTRADA", "Sessao GEAFIN nao encontrada.");
    if (String(session.modoImportacao || "").toUpperCase() !== "INCREMENTAL") {
      throw new HttpError(409, "DECISAO_APENAS_INCREMENTAL", "Decisao item a item disponivel apenas no modo INCREMENTAL.");
    }
    if (session.status !== "AGUARDANDO_CONFIRMACAO") {
      throw new HttpError(409, "STATUS_IMPORTACAO_INVALIDO", `Sessao nao aceita decisao no status ${session.status}.`);
    }

    const r = await pool.query(
      `UPDATE public.geafin_import_acoes
       SET decisao = $3, decidido_por = $4, decidido_em = NOW()
       WHERE arquivo_id = $1
         AND id = $2
         AND requer_confirmacao = TRUE
       RETURNING id, decisao, decidido_por AS "decididoPor", decidido_em AS "decididoEm";`,
      [id, acaoId, decision, req.user?.id || null],
    );
    if (!r.rowCount) throw new HttpError(404, "ACAO_NAO_ENCONTRADA", "Acao nao encontrada para decisao.");

    res.json({ requestId: req.requestId, acao: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.post("/importacoes/geafin/:id/acoes/decisao-lote", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "IMPORTACAO_ID_INVALIDO", "id deve ser UUID.");
    const decision = parseGeafinDecisionApply(req.body?.decisao);
    const tipoAcao = req.body?.tipoAcao ? String(req.body.tipoAcao).trim().toUpperCase() : "";
    const q = req.body?.q ? String(req.body.q).trim() : "";
    const somentePendentes = parseBool(req.body?.somentePendentes, true);

    const session = await getGeafinSessionById(id);
    if (!session) throw new HttpError(404, "IMPORTACAO_NAO_ENCONTRADA", "Sessao GEAFIN nao encontrada.");
    if (String(session.modoImportacao || "").toUpperCase() !== "INCREMENTAL") {
      throw new HttpError(409, "DECISAO_APENAS_INCREMENTAL", "Decisao em lote disponivel apenas no modo INCREMENTAL.");
    }
    if (session.status !== "AGUARDANDO_CONFIRMACAO") {
      throw new HttpError(409, "STATUS_IMPORTACAO_INVALIDO", `Sessao nao aceita decisao no status ${session.status}.`);
    }

    const where = ["arquivo_id = $1", "requer_confirmacao = TRUE"];
    const params = [id];
    let i = 2;
    if (somentePendentes) {
      where.push("decisao = 'PENDENTE'");
    }
    if (tipoAcao) {
      where.push(`tipo_acao = $${i}`);
      params.push(tipoAcao);
      i += 1;
    }
    if (q) {
      where.push(`(
        numero_tombamento ILIKE $${i}
        OR codigo_catalogo ILIKE $${i}
        OR motivo ILIKE $${i}
      )`);
      params.push(`%${q}%`);
      i += 1;
    }
    const whereSql = where.join(" AND ");
    const upd = await pool.query(
      `UPDATE public.geafin_import_acoes
       SET decisao = $${i}, decidido_por = $${i + 1}, decidido_em = NOW()
       WHERE ${whereSql}
       RETURNING id;`,
      [...params, decision, req.user?.id || null],
    );

    res.json({
      requestId: req.requestId,
      atualizados: Number(upd.rowCount || 0),
      decisao: decision,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/importacoes/geafin/:id/aplicar", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "IMPORTACAO_ID_INVALIDO", "id deve ser UUID.");
    const result = await applyGeafinSession(req, id, req.body || {});
    const overview = await getGeafinSessionOverview(id);
    res.json({
      requestId: req.requestId,
      message: "Sessao GEAFIN aplicada com sucesso.",
      resumo: result,
      importacao: overview,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/importacoes/geafin/ultimo", mustAdmin, async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT id
       FROM public.geafin_import_arquivos
       ORDER BY imported_em DESC
       LIMIT 1;`,
    );
    const id = r.rows[0]?.id || null;
    if (!id) {
      res.status(404).json({
        requestId: req.requestId,
        error: { code: "SEM_IMPORTACAO", message: "Nenhuma importacao GEAFIN registrada." },
      });
      return;
    }
    const overview = await getGeafinSessionOverview(id);
    res.json({ requestId: req.requestId, importacao: overview });
  } catch (error) {
    next(error);
  }
});

/**
 * Cancela importacao/sessao GEAFIN.
 * - Em AGUARDANDO_CONFIRMACAO: finaliza como CANCELADO sem efeitos operacionais.
 * - Em APLICANDO/EM_ANDAMENTO: marca cancel_requested e o processo faz rollback total da aplicacao.
 */
app.post("/importacoes/geafin/:id/cancelar", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "IMPORTACAO_ID_INVALIDO", "id deve ser UUID.");

    const motivo = String(req.body?.motivo || "").trim().slice(0, 2000);
    const r = await pool.query(
      `UPDATE public.geafin_import_arquivos
       SET
         cancel_requested = TRUE,
         status = CASE
           WHEN status IN ('AGUARDANDO_CONFIRMACAO', 'EM_ANDAMENTO') THEN 'CANCELADO'
           ELSE status
         END,
         etapa = CASE
           WHEN status IN ('AGUARDANDO_CONFIRMACAO', 'EM_ANDAMENTO') THEN 'CANCELADA'
           ELSE etapa
         END,
         finalizado_em = CASE
           WHEN status IN ('AGUARDANDO_CONFIRMACAO', 'EM_ANDAMENTO') THEN NOW()
           ELSE finalizado_em
         END,
         erro_resumo = COALESCE(NULLIF($2, ''), 'Cancelamento solicitado pelo usuario.')
       WHERE id = $1
       RETURNING id, status, cancel_requested AS "cancelRequested", finalizado_em AS "finalizadoEm", erro_resumo AS "erroResumo";`,
      [id, motivo],
    );
    if (!r.rowCount) throw new HttpError(404, "IMPORTACAO_NAO_ENCONTRADA", "Importacao GEAFIN nao encontrada.");

    res.json({ requestId: req.requestId, importacao: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/stats", mustAuth, async (req, res, next) => {
  try {
    const incluirTerceiros = parseBool(req.query?.incluirTerceiros, false);
    const where = incluirTerceiros ? "" : "WHERE eh_bem_terceiro = FALSE";

    const total = await pool.query(`SELECT COUNT(*)::int AS total FROM bens ${where};`);
    const porUnidade = await pool.query(
      `SELECT unidade_dona_id AS unidade, COUNT(*)::int AS total
       FROM bens
       ${where}
       GROUP BY 1
       ORDER BY 1;`,
    );
    const porStatus = await pool.query(
      `SELECT status::text AS status, COUNT(*)::int AS total
       FROM bens
       ${where}
       GROUP BY 1
       ORDER BY 1;`,
    );

    res.json({
      requestId: req.requestId,
      bens: {
        total: total.rows[0]?.total ?? 0,
        porUnidade: porUnidade.rows,
        porStatus: porStatus.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/bens", mustAuth, async (req, res, next) => {
  try {
    const q = req.query || {};
    const filters = validateBensQuery(q);

    const where = [];
    const params = [];
    let i = 1;

    if (!filters.incluirTerceiros) {
      where.push("b.eh_bem_terceiro = FALSE");
    }
    if (filters.numeroTombamento) {
      if (filters.numeroTombamento.length === 4 && filters.tipoBusca) {
        if (filters.tipoBusca === "antigo") {
          where.push(`b.cod_2_aud = $${i}`);
          params.push(filters.numeroTombamento);
        } else {
          // Busca por sufixo da etiqueta nova impressa com 4 digitos (ex.: 1260 -> ...1260).
          where.push(`RIGHT(b.numero_tombamento, 4) = $${i}`);
          params.push(filters.numeroTombamento);
        }
      } else {
        where.push(`b.numero_tombamento = $${i}`);
        params.push(filters.numeroTombamento);
      }
      i += 1;
    }
    if (filters.texto) {
      const textoBusca = normalizeLatinForSearch(filters.texto);
      // Normalizacao (SKU vs Item): a descricao canonica pertence ao catalogo_bens.
      // Mantemos descricao_complementar como campo opcional para anotacoes locais.
      where.push(`(
        translate(lower(coalesce(cb.descricao, '')), 'áàãâäéèẽêëíìĩîïóòõôöúùũûüçñ', 'aaaaaeeeeeiiiiiooooouuuuucn') LIKE $${i}
        OR translate(lower(coalesce(b.descricao_complementar, '')), 'áàãâäéèẽêëíìĩîïóòõôöúùũûüçñ', 'aaaaaeeeeeiiiiiooooouuuuucn') LIKE $${i}
      )`);
      params.push(`%${textoBusca}%`);
      i += 1;
    }
    if (filters.codigoCatalogo) {
      where.push(`cb.codigo_catalogo ILIKE $${i}`);
      params.push(`%${filters.codigoCatalogo}%`);
      i += 1;
    }
    if (filters.localFisico) {
      where.push(`b.local_fisico ILIKE $${i}`);
      params.push(`%${filters.localFisico}%`);
      i += 1;
    }
    if (filters.localId) {
      where.push(`b.local_id = $${i}`);
      params.push(filters.localId);
      i += 1;
    }
    if (filters.unidadeDonaId) {
      where.push(`b.unidade_dona_id = $${i}`);
      params.push(filters.unidadeDonaId);
      i += 1;
    }
    if (filters.status) {
      where.push(`b.status = $${i}::public.status_bem`);
      params.push(filters.status);
      i += 1;
    }
    if (filters.responsavelPerfilId) {
      where.push(`b.responsavel_perfil_id = $${i}`);
      params.push(filters.responsavelPerfilId);
      i += 1;
    }
    if (filters.responsavelTexto) {
      where.push(`(
        rp.matricula ILIKE $${i}
        OR rp.nome ILIKE $${i}
      )`);
      params.push(`%${filters.responsavelTexto}%`);
      i += 1;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countSql = `SELECT COUNT(*)::int AS total
      FROM bens b
      JOIN catalogo_bens cb ON cb.id = b.catalogo_bem_id
      LEFT JOIN perfis rp ON rp.id = b.responsavel_perfil_id
      ${whereSql};`;
    const count = await pool.query(countSql, params);
    const total = count.rows[0]?.total ?? 0;

    const listSql = `
      SELECT
        b.id,
        b.numero_tombamento AS "numeroTombamento",
        b.cod_2_aud AS "cod2Aud",
        b.nome_resumo AS "nomeResumo",
        COALESCE(NULLIF(b.nome_resumo, ''), NULLIF(b.descricao_complementar, ''), cb.descricao) AS "descricao",
        b.catalogo_bem_id AS "catalogoBemId",
        cb.codigo_catalogo AS "codigoCatalogo",
        cb.descricao AS "catalogoDescricao",
        cb.foto_referencia_url AS "fotoReferenciaUrl",
        b.unidade_dona_id AS "unidadeDonaId",
        b.responsavel_perfil_id AS "responsavelPerfilId",
        rp.matricula AS "responsavelMatricula",
        rp.nome AS "responsavelNome",
        b.local_id AS "localId",
        l.nome AS "localNome",
        b.local_fisico AS "localFisico",
        b.foto_url AS "fotoUrl",
        b.status::text AS "status",
        b.eh_bem_terceiro AS "ehBemTerceiro",
        EXISTS (
          SELECT 1 FROM contagens c 
          WHERE c.bem_id = b.id AND c.regularizacao_pendente = TRUE
        ) AS "temDivergenciaPendente"
      FROM bens b
      JOIN catalogo_bens cb ON cb.id = b.catalogo_bem_id
      LEFT JOIN locais l ON l.id = b.local_id
      LEFT JOIN perfis rp ON rp.id = b.responsavel_perfil_id
      ${whereSql}
      ORDER BY b.numero_tombamento NULLS LAST, b.created_at DESC
      LIMIT $${i} OFFSET $${i + 1};`;

    const list = await pool.query(listSql, [...params, filters.limit, filters.offset]);

    res.json({
      requestId: req.requestId,
      paging: {
        limit: filters.limit,
        offset: filters.offset,
        total,
      },
      items: list.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Sugestoes de "local_fisico" a partir dos dados reais de bens.
 * Uso: UX de inventario ("Baixar catalogo da sala") quando o filtro retorna 0 itens.
 *
 * Regra operacional:
 * - Nao altera o modelo. Apenas ajuda o usuario a encontrar o texto correto do local.
 */
app.get("/bens/locais-sugestoes", mustAuth, async (req, res, next) => {
  try {
    const q = req.query || {};
    const termo = q.termo != null ? String(q.termo).trim() : "";
    const termo2 = q.q != null ? String(q.q).trim() : "";
    const busca = (termo || termo2).slice(0, 180);
    if (busca.length < 2) {
      res.json({ requestId: req.requestId, items: [] });
      return;
    }

    const unidadeDonaId = q.unidadeDonaId != null && String(q.unidadeDonaId).trim() !== ""
      ? Number(q.unidadeDonaId)
      : null;
    if (unidadeDonaId != null && (!Number.isInteger(unidadeDonaId) || !VALID_UNIDADES.has(unidadeDonaId))) {
      throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeDonaId deve ser 1..4.");
    }

    const where = ["eh_bem_terceiro = FALSE", "local_fisico IS NOT NULL", "local_fisico <> ''", "local_fisico ILIKE $1"];
    const params = [`%${busca}%`];
    let i = 2;
    if (unidadeDonaId != null) {
      where.push(`unidade_dona_id = $${i}`);
      params.push(unidadeDonaId);
      i += 1;
    }

    const r = await pool.query(
      `SELECT local_fisico AS "localFisico", COUNT(*)::int AS total
       FROM bens
       WHERE ${where.join(" AND ")}
       GROUP BY local_fisico
       ORDER BY total DESC, local_fisico ASC
       LIMIT 25;`,
      params,
    );

    res.json({ requestId: req.requestId, items: r.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * Lista bens por status de localizacao fisica (com sala / sem sala).
 * IMPORTANTE: deve estar antes de /bens/:id para nao ser capturada pelo parametro.
 *
 * Query params:
 *   statusLocal  "com_local" | "sem_local" (obrigatorio)
 *   unidadeId    1..4 (opcional)
 *   limit        1..200 (padrao 50)
 *   offset       >= 0 (padrao 0)
 */
app.get("/bens/localizacao", mustAuth, async (req, res, next) => {
  try {
    const q = req.query || {};
    const statusLocal = q.statusLocal ? String(q.statusLocal).trim() : "";
    const unidadeId = q.unidadeId != null && String(q.unidadeId).trim() !== ""
      ? Number(q.unidadeId)
      : null;
    const limit = Math.min(200, Math.max(1, parseInt(q.limit || "50", 10) || 50));
    const offset = Math.max(0, parseInt(q.offset || "0", 10) || 0);

    if (!["com_local", "sem_local"].includes(statusLocal)) {
      throw new HttpError(422, "STATUS_LOCAL_INVALIDO", "statusLocal deve ser 'com_local' ou 'sem_local'.");
    }
    if (unidadeId != null && (!Number.isInteger(unidadeId) || !VALID_UNIDADES.has(unidadeId))) {
      throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeId deve ser 1..4.");
    }

    const where = [
      "b.eh_bem_terceiro = FALSE",
      "b.status != 'BAIXADO'",
      statusLocal === "com_local" ? "b.local_id IS NOT NULL" : "b.local_id IS NULL",
    ];
    const params = [];
    let i = 1;

    if (unidadeId != null) {
      where.push(`b.unidade_dona_id = $${i}`);
      params.push(unidadeId);
      i += 1;
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM bens b ${whereSql}`,
      params
    );

    const dataRes = await pool.query(
      `SELECT
         b.numero_tombamento AS "numeroTombamento",
         COALESCE(b.nome_resumo, cb.descricao, b.descricao_complementar, '') AS "nomeResumo",
         b.unidade_dona_id AS "unidade",
         b.local_id AS "localId",
         l.nome AS "localNome"
       FROM bens b
       LEFT JOIN locais l ON l.id = b.local_id
       LEFT JOIN catalogo_bens cb ON cb.id = b.catalogo_bem_id
       ${whereSql}
       ORDER BY b.unidade_dona_id ASC, b.numero_tombamento ASC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    res.json({
      requestId: req.requestId,
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
      items: dataRes.rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/bens/:id", mustAuth, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(400, "BEM_ID_INVALIDO", "id deve ser UUID valido.");

    const bem = await pool.query(
      `SELECT
         b.id,
         b.numero_tombamento AS "numeroTombamento",
         b.cod_2_aud AS "cod2Aud",
         b.nome_resumo AS "nomeResumo",
         b.identificador_externo AS "identificadorExterno",
         b.descricao_complementar AS "descricaoComplementar",
         b.observacoes AS "observacoes",
         b.unidade_dona_id AS "unidadeDonaId",
         b.responsavel_perfil_id AS "responsavelPerfilId",
         b.local_fisico AS "localFisico",
         b.local_id AS "localId",
         b.status::text AS "status",
         b.tipo_inservivel::text AS "tipoInservivel",
         b.eh_bem_terceiro AS "ehBemTerceiro",
         b.proprietario_externo AS "proprietarioExterno",
         b.contrato_referencia AS "contratoReferencia",
         b.data_aquisicao AS "dataAquisicao",
         b.valor_aquisicao AS "valorAquisicao",
         b.foto_url AS "fotoUrl",
         b.created_at AS "createdAt",
         b.updated_at AS "updatedAt",
         cb.id AS "catalogoBemId",
         cb.codigo_catalogo AS "codigoCatalogo",
         cb.descricao AS "catalogoDescricao",
         cb.grupo AS "catalogoGrupo",
         cb.material_permanente AS "materialPermanente",
         cb.foto_referencia_url AS "fotoReferenciaUrl",
         cb.created_at AS "catalogoCreatedAt",
         cb.updated_at AS "catalogoUpdatedAt",
         p.id AS "responsavelId",
         p.matricula AS "responsavelMatricula",
         p.nome AS "responsavelNome",
         (
           SELECT json_build_object(
             'id', c.id,
             'salaEncontrada', c.sala_encontrada,
             'unidadeEncontradaId', c.unidade_encontrada_id,
             'encontradoEm', c.encontrado_em,
             'tipoOcorrencia', c.tipo_ocorrencia
           )
           FROM contagens c
           WHERE c.bem_id = b.id AND c.regularizacao_pendente = TRUE
           LIMIT 1
         ) AS "divergenciaPendente"
       FROM bens b
       JOIN catalogo_bens cb ON cb.id = b.catalogo_bem_id
       LEFT JOIN perfis p ON p.id = b.responsavel_perfil_id
       WHERE b.id = $1
       LIMIT 1;`,
      [id],
    );

    const row = bem.rows[0];
    if (!row) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");

    const movimentacoes = await pool.query(
      `SELECT
         m.id,
         m.tipo_movimentacao AS "tipoMovimentacao",
         m.status::text AS "status",
         m.unidade_origem_id AS "unidadeOrigemId",
         m.unidade_destino_id AS "unidadeDestinoId",
         m.detentor_temporario_perfil_id AS "detentorTemporarioPerfilId",
         m.data_prevista_devolucao AS "dataPrevistaDevolucao",
         m.data_efetiva_devolucao AS "dataEfetivaDevolucao",
         m.termo_referencia AS "termoReferencia",
         m.justificativa,
         m.autorizada_por_perfil_id AS "autorizadaPorPerfilId",
         m.autorizada_em AS "autorizadaEm",
         m.executada_por_perfil_id AS "executadaPorPerfilId",
         m.executada_em AS "executadaEm",
         m.created_at AS "createdAt",
         pd.nome AS "detentorTemporarioNome",
         pd.matricula AS "detentorTemporarioMatricula",
         pa.nome AS "autorizadaPorNome",
         pa.matricula AS "autorizadaPorMatricula",
         pe.nome AS "executadaPorNome",
         pe.matricula AS "executadaPorMatricula",
         c.id AS "regularizacaoContagemId",
         c.unidade_encontrada_id AS "regularizacaoUnidadeEncontradaId",
         c.sala_encontrada AS "regularizacaoSalaEncontrada"
       FROM movimentacoes m
       LEFT JOIN perfis pd ON pd.id = m.detentor_temporario_perfil_id
       LEFT JOIN perfis pa ON pa.id = m.autorizada_por_perfil_id
       LEFT JOIN perfis pe ON pe.id = m.executada_por_perfil_id
       LEFT JOIN contagens c ON c.regularizacao_movimentacao_id = m.id
       WHERE m.bem_id = $1
       ORDER BY m.created_at DESC
       LIMIT 20;`,
      [id],
    );

    const historicoTransferencias = await pool.query(
      `SELECT
         h.id,
         h.unidade_antiga_id AS "unidadeAntigaId",
         h.unidade_nova_id AS "unidadeNovaId",
         h.usuario_id AS "usuarioId",
         h.data,
         h.origem::text AS "origem",
         p.nome AS "usuarioNome",
         p.matricula AS "usuarioMatricula"
       FROM historico_transferencias h
       LEFT JOIN perfis p ON p.id = h.usuario_id
       WHERE h.bem_id = $1
       ORDER BY h.data DESC
       LIMIT 20;`,
      [id],
    );

    res.json({
      requestId: req.requestId,
      bem: {
        id: row.id,
        numeroTombamento: row.numeroTombamento,
        cod2Aud: row.cod2Aud,
        nomeResumo: row.nomeResumo,
        identificadorExterno: row.identificadorExterno,
        descricaoComplementar: row.descricaoComplementar,
        observacoes: row.observacoes,
        unidadeDonaId: row.unidadeDonaId,
        responsavelPerfilId: row.responsavelPerfilId,
        localFisico: row.localFisico,
        localId: row.localId,
        status: row.status,
        tipoInservivel: row.tipoInservivel,
        ehBemTerceiro: row.ehBemTerceiro,
        proprietarioExterno: row.proprietarioExterno,
        contratoReferencia: row.contratoReferencia,
        dataAquisicao: row.dataAquisicao,
        valorAquisicao: row.valorAquisicao,
        fotoUrl: row.fotoUrl,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        catalogoBemId: row.catalogoBemId,
        divergenciaPendente: row.divergenciaPendente || null,
      },
      catalogo: {
        id: row.catalogoBemId,
        codigoCatalogo: row.codigoCatalogo,
        descricao: row.catalogoDescricao,
        grupo: row.catalogoGrupo,
        materialPermanente: row.materialPermanente,
        fotoReferenciaUrl: row.fotoReferenciaUrl,
        createdAt: row.catalogoCreatedAt,
        updatedAt: row.catalogoUpdatedAt,
      },
      responsavel: row.responsavelId
        ? { id: row.responsavelId, matricula: row.responsavelMatricula, nome: row.responsavelNome }
        : null,
      divergenciaPendente: row.divergenciaPendente || null,
      movimentacoes: movimentacoes.rows,
      historicoTransferencias: historicoTransferencias.rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/bens/:id/auditoria", mustAuth, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(400, "BEM_ID_INVALIDO", "id deve ser UUID valido.");
    const limit = Math.max(1, Math.min(300, parseIntOrDefault(req.query?.limit, 120)));

    const rBem = await pool.query(
      `SELECT id, catalogo_bem_id AS "catalogoBemId"
       FROM bens
       WHERE id = $1
       LIMIT 1;`,
      [id],
    );
    const bem = rBem.rows[0] || null;
    if (!bem) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");

    const rAudit = await pool.query(
      `SELECT
         a.id,
         a.tabela,
         a.operacao,
         a.registro_pk AS "registroPk",
         a.dados_antes AS "dadosAntes",
         a.dados_depois AS "dadosDepois",
         a.executado_por AS "executadoPor",
         a.executado_em AS "executadoEm",
         p.id AS "executorPerfilId",
         p.nome AS "executorNome",
         p.matricula AS "executorMatricula"
       FROM auditoria_log a
      LEFT JOIN perfis p
        ON (
          p.id = (
            CASE
              WHEN a.executado_por ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              THEN a.executado_por::uuid
              ELSE NULL
            END
          )
        )
       WHERE
         (a.tabela = 'bens' AND a.registro_pk = $1)
         OR
         (a.tabela = 'catalogo_bens' AND a.registro_pk = $2)
         OR
         (a.tabela IN ('movimentacoes', 'contagens', 'historico_transferencias', 'documentos')
          AND COALESCE(a.dados_depois ->> 'bem_id', a.dados_antes ->> 'bem_id') = $1)
       ORDER BY a.executado_em DESC, a.id DESC
       LIMIT $3;`,
      [id, String(bem.catalogoBemId), limit],
    );

    const PROFILE_ID_FIELDS = new Set([
      "responsavel_perfil_id",
      "encontrado_por_perfil_id",
      "regularizado_por_perfil_id",
      "executada_por_perfil_id",
      "autorizada_por_perfil_id",
      "aberto_por_perfil_id",
      "encerrado_por_perfil_id",
    ]);
    const ID_FIELD_KIND = {
      local_id: "local",
      catalogo_bem_id: "catalogo",
      bem_id: "bem",
    };
    const pushUuid = (set, v) => {
      if (isUuidLike(v)) set.add(String(v).trim());
    };
    const resolveFallbackActorPerfilId = (dadosAntes, dadosDepois) => {
      for (const k of PROFILE_ID_FIELDS) {
        const v = dadosDepois?.[k] ?? dadosAntes?.[k] ?? null;
        if (isUuidLike(v)) return String(v).trim();
      }
      return null;
    };

    const preItems = rAudit.rows.map((row) => {
      const baseChanges = diffAuditObjects(row.dadosAntes, row.dadosDepois);
      const changes = baseChanges.length
        ? baseChanges
        : row.operacao === "INSERT"
          ? [{ field: "__operacao", before: null, after: "Registro criado" }]
          : row.operacao === "DELETE"
            ? [{ field: "__operacao", before: "Registro removido", after: null }]
            : [];
      return {
        ...row,
        changes,
        actorFallbackPerfilId: resolveFallbackActorPerfilId(row.dadosAntes, row.dadosDepois),
      };
    });

    const profileIds = new Set();
    const localIds = new Set();
    const catalogoIds = new Set();
    const bemIds = new Set();

    for (const row of preItems) {
      pushUuid(profileIds, row.executorPerfilId);
      pushUuid(profileIds, row.executadoPor);
      pushUuid(profileIds, row.actorFallbackPerfilId);
      for (const ch of row.changes || []) {
        if (PROFILE_ID_FIELDS.has(ch.field)) {
          pushUuid(profileIds, ch.before);
          pushUuid(profileIds, ch.after);
        } else if (ID_FIELD_KIND[ch.field] === "local") {
          pushUuid(localIds, ch.before);
          pushUuid(localIds, ch.after);
        } else if (ID_FIELD_KIND[ch.field] === "catalogo") {
          pushUuid(catalogoIds, ch.before);
          pushUuid(catalogoIds, ch.after);
        } else if (ID_FIELD_KIND[ch.field] === "bem") {
          pushUuid(bemIds, ch.before);
          pushUuid(bemIds, ch.after);
        }
      }
    }

    const perfisById = new Map();
    if (profileIds.size) {
      const rPerfis = await pool.query(
        `SELECT id, nome, matricula
         FROM perfis
         WHERE id = ANY($1::uuid[]);`,
        [Array.from(profileIds)],
      );
      for (const p of rPerfis.rows) perfisById.set(String(p.id), p);
    }

    const locaisById = new Map();
    if (localIds.size) {
      const rLocais = await pool.query(
        `SELECT id, nome
         FROM locais
         WHERE id = ANY($1::uuid[]);`,
        [Array.from(localIds)],
      );
      for (const l of rLocais.rows) locaisById.set(String(l.id), l);
    }

    const catalogosById = new Map();
    if (catalogoIds.size) {
      const rCatalogos = await pool.query(
        `SELECT id, codigo_catalogo AS "codigoCatalogo", descricao
         FROM catalogo_bens
         WHERE id = ANY($1::uuid[]);`,
        [Array.from(catalogoIds)],
      );
      for (const c of rCatalogos.rows) catalogosById.set(String(c.id), c);
    }

    const bensById = new Map();
    if (bemIds.size) {
      const rBens = await pool.query(
        `SELECT id, numero_tombamento AS "numeroTombamento", nome_resumo AS "nomeResumo", descricao_complementar AS "descricaoComplementar"
         FROM bens
         WHERE id = ANY($1::uuid[]);`,
        [Array.from(bemIds)],
      );
      for (const b of rBens.rows) bensById.set(String(b.id), b);
    }

    const decorateValue = (field, value) => {
      if (!isUuidLike(value)) return { id: null, label: null };
      const idValue = String(value).trim();

      if (PROFILE_ID_FIELDS.has(field)) {
        const p = perfisById.get(idValue);
        if (!p) return { id: idValue, label: "Perfil (não encontrado)" };
        return {
          id: idValue,
          label: p.matricula ? `${p.nome} (${p.matricula})` : p.nome,
        };
      }
      if (ID_FIELD_KIND[field] === "local") {
        const l = locaisById.get(idValue);
        return { id: idValue, label: l?.nome || "Local (não encontrado)" };
      }
      if (ID_FIELD_KIND[field] === "catalogo") {
        const c = catalogosById.get(idValue);
        return { id: idValue, label: c ? `${c.codigoCatalogo || "-"} - ${c.descricao || ""}`.trim() : "Catálogo (não encontrado)" };
      }
      if (ID_FIELD_KIND[field] === "bem") {
        const b = bensById.get(idValue);
        const resumo = b?.nomeResumo || b?.descricaoComplementar || "";
        return {
          id: idValue,
          label: b ? `${b.numeroTombamento || "-"}${resumo ? ` - ${resumo}` : ""}` : "Bem (não encontrado)",
        };
      }

      return { id: idValue, label: null };
    };

    const revertableByTable = new Set(["bens", "catalogo_bens"]);
    const items = preItems.map((row) => {
      const actorResolved = (
        (row.executorPerfilId ? perfisById.get(String(row.executorPerfilId)) : null)
        || (isUuidLike(row.executadoPor) ? perfisById.get(String(row.executadoPor).trim()) : null)
        || (row.actorFallbackPerfilId ? perfisById.get(String(row.actorFallbackPerfilId)) : null)
        || null
      );
      const changes = (row.changes || []).map((ch) => {
        const beforeRef = decorateValue(ch.field, ch.before);
        const afterRef = decorateValue(ch.field, ch.after);
        return {
          ...ch,
          beforeId: beforeRef.id || null,
          beforeLabel: beforeRef.label || null,
          afterId: afterRef.id || null,
          afterLabel: afterRef.label || null,
        };
      });
      return {
        id: row.id,
        tabela: row.tabela,
        operacao: row.operacao,
        registroPk: row.registroPk,
        executadoEm: row.executadoEm,
        executadoPor: row.executadoPor,
        executorPerfilId: row.executorPerfilId || null,
        executorNome: row.executorNome || null,
        executorMatricula: row.executorMatricula || null,
        actorPerfilId: actorResolved?.id || null,
        actorNome: actorResolved?.nome || row.executorNome || null,
        actorMatricula: actorResolved?.matricula || row.executorMatricula || null,
        changes,
        dadosAntes: row.dadosAntes || null,
        dadosDepois: row.dadosDepois || null,
        canRevert: row.operacao === "UPDATE" && revertableByTable.has(String(row.tabela || "")),
      };
    });

    res.json({ requestId: req.requestId, bemId: id, total: items.length, items });
  } catch (error) {
    next(error);
  }
});

app.get("/auditoria/patrimonio", mustAdmin, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(200, parseIntOrDefault(req.query?.limit, 50)));
    const offset = Math.max(0, parseIntOrDefault(req.query?.offset, 0));
    const q = String(req.query?.q || "").trim().slice(0, 120);
    const numeroTombamento = String(req.query?.numeroTombamento || "").trim().slice(0, 20);
    const tabela = String(req.query?.tabela || "").trim();
    const operacaoRaw = String(req.query?.operacao || "").trim().toUpperCase();
    const operacao = operacaoRaw && ["INSERT", "UPDATE", "DELETE"].includes(operacaoRaw) ? operacaoRaw : "";

    const where = ["a.tabela = ANY($1::text[])"];
    const params = [PATRIMONIO_AUDIT_TABLES];
    let idx = 2;

    if (tabela) {
      if (!PATRIMONIO_AUDIT_TABLES.includes(tabela)) {
        throw new HttpError(422, "TABELA_AUDITORIA_INVALIDA", "Filtro de tabela invalido.");
      }
      where.push(`a.tabela = $${idx}`);
      params.push(tabela);
      idx += 1;
    }

    if (operacao) {
      where.push(`a.operacao = $${idx}`);
      params.push(operacao);
      idx += 1;
    }

    if (numeroTombamento) {
      where.push(`COALESCE(b_pk.numero_tombamento::text, b_ref.numero_tombamento::text, '') ILIKE $${idx}`);
      params.push(`%${numeroTombamento}%`);
      idx += 1;
    }

    if (q) {
      where.push(`(
        a.executado_por ILIKE $${idx}
        OR a.tabela ILIKE $${idx}
        OR a.operacao ILIKE $${idx}
        OR COALESCE(b_pk.numero_tombamento::text, b_ref.numero_tombamento::text, '') ILIKE $${idx}
        OR COALESCE(cb_pk.codigo_catalogo, cb_ref.codigo_catalogo, '') ILIKE $${idx}
        OR COALESCE(b_pk.nome_resumo, b_ref.nome_resumo, '') ILIKE $${idx}
        OR COALESCE(b_pk.descricao_complementar, b_ref.descricao_complementar, '') ILIKE $${idx}
      )`);
      params.push(`%${q}%`);
      idx += 1;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM auditoria_log a
      LEFT JOIN bens b_pk
        ON (a.tabela = 'bens' AND a.registro_pk = b_pk.id::text)
      LEFT JOIN bens b_ref
        ON (
          a.tabela IN ('movimentacoes', 'contagens', 'historico_transferencias', 'documentos')
          AND COALESCE(a.dados_depois ->> 'bem_id', a.dados_antes ->> 'bem_id') = b_ref.id::text
        )
      LEFT JOIN catalogo_bens cb_pk
        ON (a.tabela = 'catalogo_bens' AND a.registro_pk = cb_pk.id::text)
      LEFT JOIN catalogo_bens cb_ref
        ON cb_ref.id = COALESCE(b_pk.catalogo_bem_id, b_ref.catalogo_bem_id)
      ${whereSql};`;

    const dataSql = `
      SELECT
        a.id,
        a.tabela,
        a.operacao,
        a.registro_pk AS "registroPk",
        a.dados_antes AS "dadosAntes",
        a.dados_depois AS "dadosDepois",
        a.executado_por AS "executadoPor",
        a.executado_em AS "executadoEm",
        p.id AS "executorPerfilId",
        p.nome AS "executorNome",
        p.matricula AS "executorMatricula",
        COALESCE(b_pk.id, b_ref.id) AS "bemId",
        COALESCE(b_pk.numero_tombamento, b_ref.numero_tombamento) AS "numeroTombamento",
        COALESCE(b_pk.nome_resumo, b_ref.nome_resumo) AS "nomeResumo",
        COALESCE(b_pk.descricao_complementar, b_ref.descricao_complementar) AS "descricaoComplementar",
        COALESCE(cb_pk.id, cb_ref.id) AS "catalogoBemId",
        COALESCE(cb_pk.codigo_catalogo, cb_ref.codigo_catalogo) AS "codigoCatalogo"
      FROM auditoria_log a
      LEFT JOIN perfis p
        ON (
          p.id = (
            CASE
              WHEN a.executado_por ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              THEN a.executado_por::uuid
              ELSE NULL
            END
          )
        )
      LEFT JOIN bens b_pk
        ON (a.tabela = 'bens' AND a.registro_pk = b_pk.id::text)
      LEFT JOIN bens b_ref
        ON (
          a.tabela IN ('movimentacoes', 'contagens', 'historico_transferencias', 'documentos')
          AND COALESCE(a.dados_depois ->> 'bem_id', a.dados_antes ->> 'bem_id') = b_ref.id::text
        )
      LEFT JOIN catalogo_bens cb_pk
        ON (a.tabela = 'catalogo_bens' AND a.registro_pk = cb_pk.id::text)
      LEFT JOIN catalogo_bens cb_ref
        ON cb_ref.id = COALESCE(b_pk.catalogo_bem_id, b_ref.catalogo_bem_id)
      ${whereSql}
      ORDER BY a.executado_em DESC, a.id DESC
      LIMIT $${idx} OFFSET $${idx + 1};`;

    const countRes = await pool.query(countSql, params);
    const total = countRes.rows[0]?.total != null ? Number(countRes.rows[0].total) : 0;
    const dataRes = await pool.query(dataSql, [...params, limit, offset]);

    const items = (dataRes.rows || []).map((row) => {
      const baseChanges = diffAuditObjects(row.dadosAntes, row.dadosDepois);
      const changes = baseChanges.length
        ? baseChanges
        : row.operacao === "INSERT"
          ? [{ field: "__operacao", before: null, after: "Registro criado" }]
          : row.operacao === "DELETE"
            ? [{ field: "__operacao", before: "Registro removido", after: null }]
            : [];
      const camposAlterados = changes.map((c) => c.field);

      return {
        id: row.id,
        tabela: row.tabela,
        operacao: row.operacao,
        registroPk: row.registroPk,
        executadoEm: row.executadoEm,
        executadoPor: row.executadoPor,
        executorPerfilId: row.executorPerfilId || null,
        executorNome: row.executorNome || null,
        executorMatricula: row.executorMatricula || null,
        bemId: row.bemId || null,
        numeroTombamento: row.numeroTombamento || null,
        nomeResumo: row.nomeResumo || null,
        descricaoComplementar: row.descricaoComplementar || null,
        catalogoBemId: row.catalogoBemId || null,
        codigoCatalogo: row.codigoCatalogo || null,
        camposAlterados,
        totalCamposAlterados: camposAlterados.length,
      };
    });

    res.json({
      requestId: req.requestId,
      paging: { limit, offset, total },
      filters: {
        q: q || null,
        numeroTombamento: numeroTombamento || null,
        tabela: tabela || null,
        operacao: operacao || null,
      },
      items,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/bens/:id/auditoria/:auditId/reverter", mustAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(400, "BEM_ID_INVALIDO", "id deve ser UUID valido.");
    const auditId = Number(req.params?.auditId || 0);
    if (!Number.isInteger(auditId) || auditId <= 0) throw new HttpError(422, "AUDITORIA_ID_INVALIDO", "auditId invalido.");

    await client.query("BEGIN");
    await setDbContext(client, { changeOrigin: "APP", currentUserId: req.user?.id ? String(req.user.id).trim() : null });

    const rBem = await client.query(
      `SELECT id, catalogo_bem_id AS "catalogoBemId"
       FROM bens
       WHERE id = $1
       LIMIT 1
       FOR UPDATE;`,
      [id],
    );
    const bem = rBem.rows[0] || null;
    if (!bem) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");

    const rAudit = await client.query(
      `SELECT id, tabela, operacao, registro_pk AS "registroPk", dados_antes AS "dadosAntes", dados_depois AS "dadosDepois"
       FROM auditoria_log
       WHERE id = $1
       LIMIT 1;`,
      [auditId],
    );
    const audit = rAudit.rows[0] || null;
    if (!audit) throw new HttpError(404, "AUDITORIA_NAO_ENCONTRADA", "Registro de auditoria nao encontrado.");

    const tabela = String(audit.tabela || "");
    const registroPk = String(audit.registroPk || "");
    if (audit.operacao !== "UPDATE") {
      throw new HttpError(422, "REVERSAO_APENAS_UPDATE", "So e possivel reverter alteracoes do tipo UPDATE.");
    }
    if (!audit.dadosAntes || !audit.dadosDepois) {
      throw new HttpError(422, "AUDITORIA_SEM_DADOS", "Registro de auditoria sem dados suficientes para reversao.");
    }

    const belongsToBem = (tabela === "bens" && registroPk === id)
      || (tabela === "catalogo_bens" && registroPk === String(bem.catalogoBemId));
    if (!belongsToBem) {
      throw new HttpError(409, "AUDITORIA_NAO_PERTENCE_AO_BEM", "Registro de auditoria nao pertence ao bem informado.");
    }

    const allowedByTable = {
      bens: new Set([
        "nome_resumo",
        "descricao_complementar",
        "unidade_dona_id",
        "responsavel_perfil_id",
        "local_fisico",
        "local_id",
        "status",
        "contrato_referencia",
        "data_aquisicao",
        "valor_aquisicao",
        "foto_url",
        "catalogo_bem_id",
      ]),
      catalogo_bens: new Set([
        "descricao",
        "grupo",
        "material_permanente",
        "foto_referencia_url",
      ]),
    };
    const allowed = allowedByTable[tabela];
    if (!allowed) {
      throw new HttpError(422, "TABELA_NAO_REVERSIVEL", "Reversao nao suportada para esta tabela.");
    }

    const changes = diffAuditObjects(audit.dadosAntes, audit.dadosDepois);
    const revertFields = changes
      .map((c) => c.field)
      .filter((f) => allowed.has(String(f)));
    if (!revertFields.length) {
      throw new HttpError(422, "SEM_CAMPOS_REVERSIVEIS", "Nao ha campos revertiveis nesta alteracao.");
    }

    const setParts = [];
    const params = [];
    for (const field of revertFields) {
      params.push(Object.prototype.hasOwnProperty.call(audit.dadosAntes, field) ? audit.dadosAntes[field] : null);
      setParts.push(`${field} = $${params.length}`);
    }
    setParts.push("updated_at = NOW()");
    params.push(registroPk);
    const sql = `UPDATE ${tabela} SET ${setParts.join(", ")} WHERE id = $${params.length} RETURNING id;`;
    const upd = await client.query(sql, params);
    if (!upd.rowCount) throw new HttpError(404, "REGISTRO_NAO_ENCONTRADO", "Registro alvo da reversao nao encontrado.");

    await client.query("COMMIT");
    res.json({
      requestId: req.requestId,
      ok: true,
      bemId: id,
      auditId,
      tabela,
      registroPk,
      revertedFields: revertFields,
    });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

app.get("/perfis", mustAdmin, async (req, res, next) => {
  try {
    const limit = parseIntOrDefault(req.query?.limit, 50);
    const limitFinal = Math.max(1, Math.min(200, limit));

    const caps = await getAclSchemaCaps();
    const hasAcl = Boolean(caps.hasRoles && caps.hasPerfilRoles);
    const r = await pool.query(
      `SELECT
         p.id,
         p.matricula,
         p.nome,
         p.email,
         p.unidade_id AS "unidadeId",
         p.cargo,
         p.role,
         p.ativo,
         p.senha_definida_em AS "senhaDefinidaEm",
         p.ultimo_login_em AS "ultimoLoginEm",
         p.created_at AS "createdAt",
         ${hasAcl ? "acl.codigo" : "NULL::text"} AS "roleAcessoCodigo"
       FROM perfis p
       ${hasAcl ? `LEFT JOIN LATERAL (
         SELECT r.codigo
         FROM perfil_roles_acesso pr
         JOIN roles_acesso r ON r.id = pr.role_id
         WHERE pr.perfil_id = p.id
           AND pr.ativo = TRUE
           AND r.ativo = TRUE
         ORDER BY r.nivel DESC, r.codigo ASC
         LIMIT 1
       ) acl ON TRUE` : ""}
       ORDER BY p.created_at DESC
       LIMIT $1;`,
      [limitFinal],
    );

    res.json({ requestId: req.requestId, items: r.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * Busca rapida de perfis para selecao operacional (detentor de cautela).
 * Permite localizar por matricula, nome ou prefixo de UUID.
 */
app.get("/perfis/busca", mustAuth, async (req, res, next) => {
  try {
    const qRaw = req.query?.q != null ? String(req.query.q).trim() : "";
    const q = qRaw.slice(0, 80);
    const limit = parseIntOrDefault(req.query?.limit, 10);
    const limitFinal = Math.max(1, Math.min(30, limit));

    if (!q) {
      res.json({ requestId: req.requestId, items: [] });
      return;
    }

    const likeContains = `%${q}%`;
    const likePrefix = `${q}%`;
    const r = await pool.query(
      `SELECT id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo
       FROM perfis
       WHERE matricula ILIKE $1
          OR nome ILIKE $1
          OR CAST(id AS TEXT) ILIKE $1
       ORDER BY
         CASE
           WHEN matricula ILIKE $2 THEN 0
           WHEN CAST(id AS TEXT) ILIKE $2 THEN 1
           WHEN nome ILIKE $2 THEN 2
           ELSE 3
         END,
         nome ASC
       LIMIT $3;`,
      [likeContains, likePrefix, limitFinal],
    );

    res.json({ requestId: req.requestId, items: r.rows });
  } catch (error) {
    next(error);
  }
});

app.post("/perfis", mustAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const p = validatePerfil(req.body || {});
    const senhaHash = p.senha ? await bcrypt.hash(p.senha, 10) : null;
    const senhaDefinidaEm = senhaHash ? new Date() : null;
    await client.query("BEGIN");
    const r = await client.query(
      `INSERT INTO perfis (matricula, nome, email, unidade_id, cargo, ativo, role, senha_hash, senha_definida_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo, created_at AS "createdAt";`,
      [p.matricula, p.nome, p.email, p.unidadeId, p.cargo, p.ativo, p.role, senhaHash, senhaDefinidaEm],
    );
    await syncPerfilRoleAcesso(client, {
      perfilId: r.rows[0].id,
      legacyRole: r.rows[0].role,
      atribuidoPorPerfilId: req.user?.id ? String(req.user.id) : null,
    });
    await client.query("COMMIT");
    res.status(201).json({ requestId: req.requestId, perfil: r.rows[0] });
  } catch (error) {
    await safeRollback(client);
    if (error?.code === "23505") {
      if (String(error?.constraint || "") === "perfis_matricula_key") {
        next(new HttpError(409, "MATRICULA_DUPLICADA", "Ja existe perfil com esta matricula."));
        return;
      }
      if (String(error?.constraint || "") === "perfis_email_key") {
        next(new HttpError(409, "EMAIL_DUPLICADO", "Ja existe perfil com este e-mail."));
        return;
      }
      next(new HttpError(409, "PERFIL_DUPLICADO", "Ja existe perfil com os dados informados."));
      return;
    }
    next(error);
  } finally {
    client.release();
  }
});

app.get("/roles-acesso", mustAdmin, async (req, res, next) => {
  try {
    const caps = await getAclSchemaCaps();
    if (!caps.hasRoles) {
      throw new HttpError(503, "RBAC_INDISPONIVEL", "Estrutura RBAC ainda nao foi migrada no banco.");
    }

    const r = await pool.query(
      `SELECT id, codigo, nome, nivel, ativo
       FROM roles_acesso
       ORDER BY nivel ASC, codigo ASC;`,
    );

    res.json({ requestId: req.requestId, items: r.rows });
  } catch (error) {
    next(error);
  }
});

app.get("/acl/matriz", mustAdmin, async (req, res, next) => {
  try {
    const caps = await getAclSchemaCaps();
    if (!caps.hasRoles || !caps.hasPermissoes || !caps.hasRolePermissoes) {
      throw new HttpError(503, "RBAC_INDISPONIVEL", "Estrutura RBAC ainda nao foi migrada no banco.");
    }

    const rolesQ = await pool.query(
      `SELECT id, codigo, nome, nivel, ativo, sistema
       FROM roles_acesso
       WHERE ativo = TRUE
       ORDER BY nivel ASC, codigo ASC;`,
    );
    const permsQ = await pool.query(
      `SELECT id, codigo, descricao, categoria::text AS categoria, ativo
       FROM permissoes_acesso
       WHERE ativo = TRUE
       ORDER BY categoria ASC, codigo ASC;`,
    );
    const linksQ = await pool.query(
      `SELECT r.codigo AS "roleCodigo", p.codigo AS "permissaoCodigo"
       FROM role_permissoes_acesso rp
       JOIN roles_acesso r ON r.id = rp.role_id
       JOIN permissoes_acesso p ON p.id = rp.permissao_id
       WHERE r.ativo = TRUE
         AND p.ativo = TRUE;`,
    );

    const rolePermissions = {};
    for (const role of rolesQ.rows) rolePermissions[String(role.codigo)] = [];
    for (const row of linksQ.rows) {
      const roleCode = String(row.roleCodigo || "");
      const permCode = String(row.permissaoCodigo || "");
      if (!roleCode || !permCode) continue;
      if (!Array.isArray(rolePermissions[roleCode])) rolePermissions[roleCode] = [];
      rolePermissions[roleCode].push(permCode);
    }

    res.json({
      requestId: req.requestId,
      roles: rolesQ.rows,
      permissions: permsQ.rows,
      rolePermissions,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/roles-acesso/:codigo/permissoes", mustAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const caps = await getAclSchemaCaps();
    if (!caps.hasRoles || !caps.hasPermissoes || !caps.hasRolePermissoes) {
      throw new HttpError(503, "RBAC_INDISPONIVEL", "Estrutura RBAC ainda nao foi migrada no banco.");
    }

    const roleCodigo = String(req.params?.codigo || "").trim().toUpperCase();
    if (!roleCodigo) throw new HttpError(422, "ROLE_ACESSO_OBRIGATORIA", "codigo da role e obrigatorio.");

    const permissions = Array.isArray(req.body?.permissions)
      ? req.body.permissions.map((x) => String(x || "").trim()).filter(Boolean)
      : null;
    if (!permissions) throw new HttpError(422, "PERMISSOES_INVALIDAS", "permissions deve ser um array de codigos.");

    await ensureAdminPassword(req, req.body?.adminPassword);

    await client.query("BEGIN");

    const roleQ = await client.query(
      `SELECT id, codigo
       FROM roles_acesso
       WHERE codigo = $1
         AND ativo = TRUE
       LIMIT 1
       FOR UPDATE;`,
      [roleCodigo],
    );
    if (!roleQ.rowCount) throw new HttpError(404, "ROLE_ACESSO_NAO_ENCONTRADA", "Role de acesso nao encontrada.");
    const roleId = roleQ.rows[0].id;

    const uniqPermissions = Array.from(new Set(permissions));
    let allowedPermCodes = [];
    if (uniqPermissions.length) {
      const permQ = await client.query(
        `SELECT id, codigo
         FROM permissoes_acesso
         WHERE ativo = TRUE
           AND codigo = ANY($1::text[]);`,
        [uniqPermissions],
      );
      if (permQ.rowCount !== uniqPermissions.length) {
        const got = new Set(permQ.rows.map((x) => String(x.codigo)));
        const missing = uniqPermissions.filter((x) => !got.has(x));
        throw new HttpError(422, "PERMISSOES_INVALIDAS", "Uma ou mais permissoes sao invalidas/inativas.", { missing });
      }
      allowedPermCodes = permQ.rows.map((x) => String(x.codigo));
    }

    await client.query(`DELETE FROM role_permissoes_acesso WHERE role_id = $1;`, [roleId]);
    if (uniqPermissions.length) {
      await client.query(
        `INSERT INTO role_permissoes_acesso (role_id, permissao_id)
         SELECT $1, p.id
         FROM permissoes_acesso p
         WHERE p.codigo = ANY($2::text[])
           AND p.ativo = TRUE;`,
        [roleId, uniqPermissions],
      );
    }

    await client.query("COMMIT");
    res.json({
      requestId: req.requestId,
      roleCodigo,
      permissions: allowedPermCodes.sort(),
      message: "Permissoes da role atualizadas com sucesso.",
    });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

app.put("/perfis/:id/role-acesso", mustAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const caps = await getAclSchemaCaps();
    if (!caps.hasRoles || !caps.hasPerfilRoles) {
      throw new HttpError(503, "RBAC_INDISPONIVEL", "Estrutura RBAC ainda nao foi migrada no banco.");
    }

    const perfilId = String(req.params?.id || "").trim();
    if (!UUID_RE.test(perfilId)) throw new HttpError(422, "PERFIL_ID_INVALIDO", "id deve ser UUID.");
    const roleCodigo = String(req.body?.roleCodigo || "").trim().toUpperCase();
    if (!roleCodigo) throw new HttpError(422, "ROLE_ACESSO_OBRIGATORIA", "Informe roleCodigo.");
    if (!ROLE_CODES.includes(roleCodigo)) {
      throw new HttpError(422, "ROLE_ACESSO_INVALIDA", "roleCodigo invalido.");
    }

    await client.query("BEGIN");

    const perfilQ = await client.query(
      `SELECT id
       FROM perfis
       WHERE id = $1
       FOR UPDATE;`,
      [perfilId],
    );
    if (!perfilQ.rowCount) throw new HttpError(404, "PERFIL_NAO_ENCONTRADO", "Perfil nao encontrado.");

    await setPerfilRoleAcessoByCode(client, {
      perfilId,
      roleCode: roleCodigo,
      atribuidoPorPerfilId: req.user?.id ? String(req.user.id) : null,
    });

    const legacyRole = roleAcessoToLegacyRole(roleCodigo);
    await client.query(
      `UPDATE perfis
       SET role = $2,
           updated_at = NOW()
       WHERE id = $1;`,
      [perfilId, legacyRole],
    );

    const out = await client.query(
      `SELECT
         p.id,
         p.matricula,
         p.nome,
         p.email,
         p.unidade_id AS "unidadeId",
         p.cargo,
         p.role,
         p.ativo,
         p.senha_definida_em AS "senhaDefinidaEm",
         p.ultimo_login_em AS "ultimoLoginEm",
         p.created_at AS "createdAt",
         acl.codigo AS "roleAcessoCodigo"
       FROM perfis p
       LEFT JOIN LATERAL (
         SELECT r.codigo
         FROM perfil_roles_acesso pr
         JOIN roles_acesso r ON r.id = pr.role_id
         WHERE pr.perfil_id = p.id
           AND pr.ativo = TRUE
           AND r.ativo = TRUE
         ORDER BY r.nivel DESC, r.codigo ASC
         LIMIT 1
       ) acl ON TRUE
       WHERE p.id = $1
       LIMIT 1;`,
      [perfilId],
    );

    await client.query("COMMIT");
    res.json({ requestId: req.requestId, perfil: out.rows[0] || null });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

/**
 * Atualiza perfil (ADMIN).
 * Regra operacional: usado para corrigir cadastro/role, desativar usuarios e resetar senha via endpoint dedicado.
 */
app.patch("/perfis/:id", mustAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "PERFIL_ID_INVALIDO", "id deve ser UUID.");

    const patch = validatePerfilPatch(req.body || {});
    const fields = [];
    const params = [];
    let i = 1;

    if (patch.nome != null) {
      fields.push(`nome = $${i}`);
      params.push(patch.nome);
      i += 1;
    }
    if (patch.email !== undefined) {
      fields.push(`email = $${i}`);
      params.push(patch.email);
      i += 1;
    }
    if (patch.unidadeId != null) {
      fields.push(`unidade_id = $${i}`);
      params.push(patch.unidadeId);
      i += 1;
    }
    if (patch.cargo !== undefined) {
      fields.push(`cargo = $${i}`);
      params.push(patch.cargo);
      i += 1;
    }
    if (patch.role != null) {
      fields.push(`role = $${i}`);
      params.push(patch.role);
      i += 1;
    }
    if (patch.ativo != null) {
      fields.push(`ativo = $${i}`);
      params.push(patch.ativo);
      i += 1;
    }

    if (!fields.length) throw new HttpError(422, "PATCH_VAZIO", "Envie ao menos um campo para atualizar.");

    fields.push("updated_at = NOW()");
    await client.query("BEGIN");
    const r = await client.query(
      `UPDATE perfis
       SET ${fields.join(", ")}
       WHERE id = $${i}
       RETURNING id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo,
                 senha_definida_em AS "senhaDefinidaEm", ultimo_login_em AS "ultimoLoginEm",
                 created_at AS "createdAt";`,
      [...params, id],
    );
    if (!r.rowCount) throw new HttpError(404, "PERFIL_NAO_ENCONTRADO", "Perfil nao encontrado.");

    if (patch.role != null) {
      await syncPerfilRoleAcesso(client, {
        perfilId: id,
        legacyRole: patch.role,
        atribuidoPorPerfilId: req.user?.id ? String(req.user.id) : null,
      });
    }
    await client.query("COMMIT");

    res.json({ requestId: req.requestId, perfil: r.rows[0] });
  } catch (error) {
    await safeRollback(client);
    if (error?.code === "23505" && String(error?.constraint || "") === "perfis_email_key") {
      next(new HttpError(409, "EMAIL_DUPLICADO", "Ja existe perfil com este e-mail."));
      return;
    }
    next(error);
  } finally {
    client.release();
  }
});

/**
 * Reseta senha de perfil (ADMIN) para permitir "Primeiro acesso" novamente.
 * Regra operacional: nao expor senhas; apenas remove hash.
 */
app.post("/perfis/:id/reset-senha", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "PERFIL_ID_INVALIDO", "id deve ser UUID.");

    const r = await pool.query(
      `UPDATE perfis
       SET senha_hash = NULL,
           senha_definida_em = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo,
                 senha_definida_em AS "senhaDefinidaEm", ultimo_login_em AS "ultimoLoginEm",
                 created_at AS "createdAt";`,
      [id],
    );
    if (!r.rowCount) throw new HttpError(404, "PERFIL_NAO_ENCONTRADO", "Perfil nao encontrado.");

    res.json({ requestId: req.requestId, perfil: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.post("/importar-geafin", mustAdmin, upload.single("arquivo"), async (req, res, next) => {
  const client = await pool.connect();
  let arquivoId = null;
  try {
    if (!req.file?.buffer?.length) {
      throw new HttpError(400, "ARQUIVO_OBRIGATORIO", "Envie o CSV no campo 'arquivo'.");
    }

    const unidadePadraoId = parseUnit(req.body?.unidadePadraoId, null);
    const csvText = iconv.decode(req.file.buffer, "latin1");
    const delimiter = detectDelimiter(csvText);
    const fileSha256 = createHash("sha256").update(req.file.buffer).digest("hex");
    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      delimiter,
      trim: true,
      relax_column_count: true,
    });

    const summary = {
      delimiter,
      totalLinhas: rows.length,
      processadas: 0,
      inseridas: 0,
      atualizadas: 0,
      ignoradas: 0,
      novos: 0,
      transferidos: 0,
      falhas: [],
    };

    console.log(`[${req.requestId}] importar-geafin: recebido arquivo=${req.file.originalname || "sem_nome"} bytes=${req.file.size || req.file.buffer.length} linhas=${rows.length}`);

    // Camada raw/staging (auditoria): registra o arquivo e todas as linhas como espelho GEAFIN.
    // Observacao: isso nao altera o modelo melhorado do sistema; apenas garante copia fiel.
    // Importante: este insert e commitado antes do processamento para permitir acompanhamento em tempo real.
    await client.query("BEGIN");
    await setDbContext(client, { changeOrigin: "IMPORTACAO", currentUserId: req.user?.id || "" });
    const fileMeta = await client.query(
      `INSERT INTO public.geafin_import_arquivos (request_id, original_filename, content_sha256, bytes, delimiter, total_linhas, status)
       VALUES ($1,$2,$3,$4,$5,$6,'EM_ANDAMENTO')
       RETURNING id;`,
      [
        req.requestId,
        req.file.originalname || null,
        fileSha256,
        req.file.size || req.file.buffer.length,
        delimiter,
        rows.length,
      ],
    );
    arquivoId = fileMeta.rows[0].id;
    await client.query("COMMIT");

    // Regra operacional: commit em lotes pequenos para permitir acompanhamento de progresso (UI)
    // e reduzir chance de uma transacao longa ficar "invisivel" no Supabase.
    const BATCH_SIZE = 25;
    let cancelled = false;
    let cancelledStatus = null;
    const getImportStatus = async () => {
      const s = await client.query("SELECT status FROM public.geafin_import_arquivos WHERE id = $1;", [arquivoId]);
      return s.rows[0]?.status || null;
    };
    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(rows.length, batchStart + BATCH_SIZE);

      const statusBefore = await getImportStatus();
      if (statusBefore && statusBefore !== "EM_ANDAMENTO") {
        cancelled = true;
        cancelledStatus = statusBefore;
        break;
      }

      await client.query("BEGIN");
      await setDbContext(client, { changeOrigin: "IMPORTACAO", currentUserId: req.user?.id || "" });

      for (let i = batchStart; i < batchEnd; i += 1) {
        const rowNo = i + 2;
        const n = normalizeGeafin(rows[i], rowNo, unidadePadraoId);

        // Hash deterministico da linha (ordena chaves antes de serializar).
        const rowRaw = rows[i] || {};
        const ordered = {};
        for (const k of Object.keys(rowRaw).sort((a, b) => String(a).localeCompare(String(b)))) ordered[k] = rowRaw[k];
        const rowSha256 = createHash("sha256").update(JSON.stringify(ordered)).digest("hex");

        // Insere raw sempre, mesmo quando a normalizacao falhar (auditoria).
        const rawInsert = await client.query(
          `INSERT INTO public.geafin_import_linhas (
             arquivo_id, linha_numero, row_raw, row_sha256,
             normalizacao_ok, normalizacao_erro, persistencia_ok, persistencia_erro
           ) VALUES (
             $1,$2,$3::jsonb,$4,
             $5,$6,FALSE,NULL
           )
           RETURNING id;`,
          [arquivoId, rowNo, JSON.stringify(rowRaw), rowSha256, n.ok, n.ok ? null : n.error],
        );
        const rawId = rawInsert.rows[0].id;

        if (!n.ok) {
          summary.ignoradas += 1;
          summary.falhas.push({ linha: rowNo, erro: n.error });
          if (summary.falhas.length <= 5) {
            console.log(`[${req.requestId}] importar-geafin: falha_normalizacao exemplo: ${n.error}`);
          }
          continue;
        }

        const sp = `sp_geafin_${i}`;
        await client.query(`SAVEPOINT ${sp}`);
        try {
          const cat = await upsertCatalogo(client, n.data);
          const b = await upsertBem(client, n.data, cat);
          summary.processadas += 1;
          if (b.inserted) {
            summary.inseridas += 1;
            summary.novos += 1;
          } else {
            summary.atualizadas += 1;
            if (b.unidadeChanged) summary.transferidos += 1;
          }

          await client.query(
            "UPDATE public.geafin_import_linhas SET persistencia_ok = TRUE, persistencia_erro = NULL WHERE id = $1;",
            [rawId],
          );
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
          const msg = dbError(error);
          summary.falhas.push({ linha: rowNo, erro: msg });
          if (summary.falhas.length <= 5) {
            console.log(`[${req.requestId}] importar-geafin: falha_persistencia exemplo: ${msg}`);
          }
          await client.query(
            "UPDATE public.geafin_import_linhas SET persistencia_ok = FALSE, persistencia_erro = $2 WHERE id = $1;",
            [rawId, msg],
          );
        }
      }

      await client.query("COMMIT");
      console.log(`[${req.requestId}] importar-geafin: progresso ${batchEnd}/${rows.length} (processadas=${summary.processadas} falhas=${summary.falhas.length})`);

      const statusAfter = await getImportStatus();
      if (statusAfter && statusAfter !== "EM_ANDAMENTO") {
        cancelled = true;
        cancelledStatus = statusAfter;
        break;
      }
    }

    if (cancelled) {
      console.log(`[${req.requestId}] importar-geafin: cancelada status=${cancelledStatus || "?"} processadas=${summary.processadas} falhas=${summary.falhas.length}`);
      res.status(200).json({
        message: "Importacao cancelada.",
        requestId: req.requestId,
        cancelada: true,
        status: cancelledStatus,
        total: summary.totalLinhas,
        novos: summary.novos,
        transferidos: summary.transferidos,
        erros: summary.falhas.length,
        summary,
      });
      return;
    }

    const code = summary.falhas.length ? 207 : 200;
    console.log(`[${req.requestId}] importar-geafin: concluido code=${code} processadas=${summary.processadas} falhas=${summary.falhas.length}`);

    // Atualiza status/finalizacao da importacao (metadados, nao afeta operacional).
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE public.geafin_import_arquivos
         SET status = 'CONCLUIDO', finalizado_em = NOW(), erro_resumo = NULL
         WHERE id = $1;`,
        [arquivoId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await safeRollback(client);
      console.error(`[${req.requestId}] importar-geafin: falha ao atualizar metadados de finalizacao`, error);
    }

    res.status(code).json({
      message: summary.falhas.length
        ? "Importacao concluida com inconsistencias."
        : "Importacao concluida com sucesso.",
      requestId: req.requestId,
      total: summary.totalLinhas,
      novos: summary.novos,
      transferidos: summary.transferidos,
      erros: summary.falhas.length,
      summary,
    });
  } catch (error) {
    await safeRollback(client);
    if (arquivoId) {
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE public.geafin_import_arquivos
           SET status = 'ERRO', finalizado_em = NOW(), erro_resumo = $2
           WHERE id = $1;`,
          [arquivoId, String(dbError(error) || error?.message || "Falha")],
        );
        await client.query("COMMIT");
      } catch (_e) {
        await safeRollback(client);
      }
    }
    next(error);
  } finally {
    client.release();
  }
});

app.post("/movimentar", mustAuth, async (req, res, next) => {
  const client = await pool.connect();
  let p = null;
  try {
    p = validateMov(req.body || {}, { defaultPerfilId: req.user?.id || "" });
    const movAcl = classifyMovPermissions(p);
    const canExecuteMov = movAcl.executePermissions.length
      ? movAcl.executePermissions.every((perm) => userHasPermission(req.user, perm))
      : false;
    const canRequestMov = movAcl.requestPermissions.length
      ? movAcl.requestPermissions.every((perm) => userHasPermission(req.user, perm))
      : false;
    if (!canExecuteMov && !canRequestMov) {
      throw new HttpError(403, "SEM_PERMISSAO", "Voce nao tem permissao para executar esta movimentacao.");
    }
    if (!canExecuteMov && canRequestMov) {
      const caps = await getAclSchemaCaps();
      if (!caps.hasSolicitacoesAprovacao || !caps.hasSolicitacoesEventos) {
        throw new HttpError(503, "APROVACAO_INDISPONIVEL", "Estrutura de aprovacao ainda nao foi migrada no banco.");
      }
      const justificativaSolicitante = p.justificativa != null
        ? String(p.justificativa).trim().slice(0, 2000)
        : "";
      if (!justificativaSolicitante) {
        throw new HttpError(422, "JUSTIFICATIVA_SOLICITANTE_OBRIGATORIA", "Informe justificativa para solicitar aprovacao.");
      }
      await client.query("BEGIN");
      const bem = await lockBem(client, p);
      if (!bem) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");
      const snapshotBefore = {
        id: bem.id,
        numeroTombamento: bem.numeroTombamento,
        unidadeDonaId: bem.unidadeDonaId,
        status: bem.status,
        responsavelPerfilId: bem.responsavelPerfilId,
        localFisico: bem.localFisico,
        localId: bem.localId,
      };
      const solicitacao = await createSolicitacaoAprovacao(client, {
        tipoAcao: SOLICITACAO_TIPO_ACAO.MOVIMENTACAO,
        entidadeTipo: "BEM",
        entidadeId: bem.id,
        payload: {
          bemId: bem.id,
          numeroTombamento: bem.numeroTombamento,
          movimentacao: p,
        },
        solicitantePerfilId: req.user?.id ? String(req.user.id) : null,
        justificativaSolicitante,
        snapshotBefore,
        expiraEm: nowPlusDays(15),
      });
      if (p.origemRegularizacaoContagemId) {
        await upsertRegularizacaoTransferenciaFluxo(client, {
          contagemId: p.origemRegularizacaoContagemId,
          statusFluxo: "AGUARDANDO_APROVACAO",
          perfilId: req.user?.id ? String(req.user.id) : null,
          solicitacaoAprovacaoId: solicitacao.id,
          movimentacaoId: null,
          observacoes: "Solicitacao de transferencia enviada para aprovacao administrativa.",
          ultimoErro: null,
        });
      }
      await client.query("COMMIT");
      res.status(202).json({
        requestId: req.requestId,
        status: "PENDENTE_APROVACAO",
        solicitacaoId: solicitacao.id,
        message: "Acao enviada para aprovacao administrativa.",
      });
      return;
    }

    // Regra operacional (controle de acesso real):
    // - Quando autenticacao estiver ativa, o executor deve ser SEMPRE o usuario autenticado (evita forjar perfilId).
    // - A autorizacao pode ser informada (2 pessoas) ou, se ausente, cai no proprio executor.
    if (AUTH_ENABLED && req.user?.id) {
      p.executadaPorPerfilId = String(req.user.id).trim();
      if (!p.autorizadaPorPerfilId) p.autorizadaPorPerfilId = p.executadaPorPerfilId;
    }
    await client.query("BEGIN");
    await setDbContext(client, {
      changeOrigin: "APP",
      currentUserId: req.user?.id || p.executadaPorPerfilId || p.autorizadaPorPerfilId || "",
    });

    const bem = await lockBem(client, p);
    if (!bem) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");

    const out = await executeMov(client, bem, p);
    if (p.origemRegularizacaoContagemId && out?.mov?.id) {
      await concluirRegularizacaoTransferencia(client, {
        contagemId: p.origemRegularizacaoContagemId,
        movimentacaoId: out.mov.id,
        perfilId: req.user?.id ? String(req.user.id) : (p.executadaPorPerfilId || p.autorizadaPorPerfilId || null),
        observacoes: "Regularizacao concluida apos transferencia formal em Movimentacoes.",
      });
    }
    await client.query("COMMIT");
    res.status(201).json({
      message: "Movimentacao registrada com sucesso.",
      requestId: req.requestId,
      movimentacao: out.mov,
      bem: out.bem,
    });
  } catch (error) {
    await safeRollback(client);
    if (p?.origemRegularizacaoContagemId) {
      try {
        await client.query("BEGIN");
        await upsertRegularizacaoTransferenciaFluxo(client, {
          contagemId: p.origemRegularizacaoContagemId,
          statusFluxo: "ERRO",
          perfilId: req.user?.id ? String(req.user.id) : (p.executadaPorPerfilId || p.autorizadaPorPerfilId || null),
          solicitacaoAprovacaoId: null,
          movimentacaoId: null,
          observacoes: "Falha ao processar transferencia formal em Movimentacoes.",
          ultimoErro: String(error?.message || "Falha ao movimentar bem."),
        });
        await client.query("COMMIT");
      } catch (_flowErr) {
        await safeRollback(client);
      }
    }
    // Regra legal: bloqueio de movimentacao durante inventario - Art. 183 (AN303_Art183)
    if (error?.code === "P0001") {
      next(new HttpError(409, "MOVIMENTACAO_BLOQUEADA_INVENTARIO", "Movimentacao bloqueada por inventario em andamento.", { baseLegal: "Art. 183 (AN303_Art183)" }));
      return;
    }
    next(error);
  } finally {
    client.release();
  }
});

app.post("/movimentar/lote", mustAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const base = req.body && typeof req.body === "object" ? req.body : {};
    const itensRaw = Array.isArray(base.itens) ? base.itens : [];
    if (!itensRaw.length) {
      throw new HttpError(422, "ITENS_LOTE_OBRIGATORIOS", "Envie ao menos um item em itens.");
    }
    if (itensRaw.length > 300) {
      throw new HttpError(422, "LIMITE_ITENS_EXCEDIDO", "Limite de 300 itens por lote.");
    }

    const basePayload = { ...base };
    delete basePayload.itens;
    delete basePayload.numeroTombamento;
    delete basePayload.bemId;
    const tipoMovimentacaoRaw = String(basePayload.tipoMovimentacao || basePayload.tipo || "")
      .trim()
      .toUpperCase();
    const tipoMovimentacao = tipoMovimentacaoRaw === "CAUTELA" ? "CAUTELA_SAIDA" : tipoMovimentacaoRaw;
    if (!VALID_MOV.has(tipoMovimentacao)) {
      throw new HttpError(422, "TIPO_MOVIMENTACAO_INVALIDO", "tipoMovimentacao deve ser TRANSFERENCIA, CAUTELA_SAIDA ou CAUTELA_RETORNO.");
    }
    const movAcl = classifyMovPermissions({ tipoMovimentacao });
    const canExecuteMov = movAcl.executePermissions.length
      ? movAcl.executePermissions.every((perm) => userHasPermission(req.user, perm))
      : false;
    const canRequestMov = movAcl.requestPermissions.length
      ? movAcl.requestPermissions.every((perm) => userHasPermission(req.user, perm))
      : false;
    if (!canExecuteMov && !canRequestMov) {
      throw new HttpError(403, "SEM_PERMISSAO", "Voce nao tem permissao para executar esta movimentacao.");
    }
    if (!canExecuteMov) {
      const justificativaSolicitante = basePayload.justificativa != null
        ? String(basePayload.justificativa).trim().slice(0, 2000)
        : "";
      if (!justificativaSolicitante) {
        throw new HttpError(422, "JUSTIFICATIVA_SOLICITANTE_OBRIGATORIA", "Informe justificativa para solicitar aprovacao.");
      }
    }

    const results = [];
    let sucessos = 0;
    let pendentes = 0;
    let falhas = 0;

    for (let idx = 0; idx < itensRaw.length; idx += 1) {
      const itemRaw = itensRaw[idx] && typeof itensRaw[idx] === "object"
        ? itensRaw[idx]
        : { numeroTombamento: itensRaw[idx] };
      const numeroTombamento = itemRaw?.numeroTombamento != null ? String(itemRaw.numeroTombamento) : "";
      const bemId = itemRaw?.bemId != null ? String(itemRaw.bemId) : "";
      const origemRegularizacaoContagemId = normalizeOrigemRegularizacaoContagemId(itemRaw?.origemRegularizacaoContagemId);
      const pItem = validateMov(
        {
          ...basePayload,
          numeroTombamento: numeroTombamento || undefined,
          bemId: bemId || undefined,
          origemRegularizacaoContagemId: origemRegularizacaoContagemId || undefined,
        },
        { defaultPerfilId: req.user?.id || "" },
      );

      try {
        await client.query("BEGIN");
        await setDbContext(client, {
          changeOrigin: "APP",
          currentUserId: req.user?.id || pItem.executadaPorPerfilId || pItem.autorizadaPorPerfilId || "",
        });

        const bem = await lockBem(client, pItem);
        if (!bem) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");

        if (canExecuteMov) {
          if (AUTH_ENABLED && req.user?.id) {
            pItem.executadaPorPerfilId = String(req.user.id).trim();
            if (!pItem.autorizadaPorPerfilId) pItem.autorizadaPorPerfilId = pItem.executadaPorPerfilId;
          }
          const out = await executeMov(client, bem, pItem);
          if (pItem.origemRegularizacaoContagemId && out?.mov?.id) {
            await concluirRegularizacaoTransferencia(client, {
              contagemId: pItem.origemRegularizacaoContagemId,
              movimentacaoId: out.mov.id,
              perfilId: req.user?.id ? String(req.user.id) : (pItem.executadaPorPerfilId || pItem.autorizadaPorPerfilId || null),
              observacoes: "Regularizacao concluida apos transferencia formal em Movimentacoes (lote).",
            });
          }
          await client.query("COMMIT");
          sucessos += 1;
          results.push({
            index: idx,
            status: "EXECUTADO",
            bemId: out?.bem?.id || bem.id,
            numeroTombamento: out?.bem?.numeroTombamento || bem.numeroTombamento || null,
            movimentacaoId: out?.mov?.id || null,
          });
        } else {
          const solicitacao = await createSolicitacaoAprovacao(client, {
            tipoAcao: SOLICITACAO_TIPO_ACAO.MOVIMENTACAO,
            entidadeTipo: "BEM",
            entidadeId: bem.id,
            payload: {
              bemId: bem.id,
              numeroTombamento: bem.numeroTombamento,
              movimentacao: pItem,
            },
            solicitantePerfilId: req.user?.id ? String(req.user.id) : null,
            justificativaSolicitante: String(pItem.justificativa || "").trim().slice(0, 2000),
            snapshotBefore: {
              id: bem.id,
              numeroTombamento: bem.numeroTombamento,
              unidadeDonaId: bem.unidadeDonaId,
              status: bem.status,
              responsavelPerfilId: bem.responsavelPerfilId,
              localFisico: bem.localFisico,
              localId: bem.localId,
            },
            expiraEm: nowPlusDays(15),
          });
          if (pItem.origemRegularizacaoContagemId) {
            await upsertRegularizacaoTransferenciaFluxo(client, {
              contagemId: pItem.origemRegularizacaoContagemId,
              statusFluxo: "AGUARDANDO_APROVACAO",
              perfilId: req.user?.id ? String(req.user.id) : null,
              solicitacaoAprovacaoId: solicitacao.id,
              movimentacaoId: null,
              observacoes: "Solicitacao de transferencia (lote) enviada para aprovacao administrativa.",
              ultimoErro: null,
            });
          }
          await client.query("COMMIT");
          pendentes += 1;
          results.push({
            index: idx,
            status: "PENDENTE_APROVACAO",
            bemId: bem.id,
            numeroTombamento: bem.numeroTombamento || null,
            solicitacaoId: solicitacao.id,
          });
        }
      } catch (itemError) {
        await safeRollback(client);
        if (pItem?.origemRegularizacaoContagemId) {
          try {
            await client.query("BEGIN");
            await upsertRegularizacaoTransferenciaFluxo(client, {
              contagemId: pItem.origemRegularizacaoContagemId,
              statusFluxo: "ERRO",
              perfilId: req.user?.id ? String(req.user.id) : (pItem.executadaPorPerfilId || pItem.autorizadaPorPerfilId || null),
              solicitacaoAprovacaoId: null,
              movimentacaoId: null,
              observacoes: "Falha ao processar transferencia formal em lote.",
              ultimoErro: String(itemError?.message || "Falha ao processar item."),
            });
            await client.query("COMMIT");
          } catch (_flowErr) {
            await safeRollback(client);
          }
        }
        falhas += 1;
        const isInventario = itemError?.code === "P0001";
        results.push({
          index: idx,
          status: "ERRO",
          bemId: null,
          numeroTombamento: numeroTombamento || null,
          errorCode: isInventario ? "MOVIMENTACAO_BLOQUEADA_INVENTARIO" : (itemError?.code || "ERRO"),
          message: isInventario
            ? "Movimentacao bloqueada por inventario em andamento."
            : String(itemError?.message || "Falha ao processar item."),
        });
      }
    }

    const hasPendentes = pendentes > 0;
    const statusCode = hasPendentes ? 202 : 200;
    res.status(statusCode).json({
      requestId: req.requestId,
      status: hasPendentes ? "PENDENTE_APROVACAO" : "PROCESSADO",
      summary: {
        total: itensRaw.length,
        executados: sucessos,
        pendentesAprovacao: pendentes,
        falhas,
      },
      items: results,
      message: hasPendentes
        ? "Lote enviado para aprovacao administrativa (itens pendentes)."
        : "Lote processado.",
    });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

const inventario = createInventarioController({
  pool,
  HttpError,
  VALID_UNIDADES,
  UUID_RE,
  TOMBAMENTO_GEAFIN_RE,
  normalizeTombamento,
  setDbContext,
  safeRollback,
  dbError,
});

app.get("/inventario/eventos", mustAuth, inventario.getEventos);
app.get("/inventario/divergencias-interunidades", mustAuth, inventario.getDivergenciasInterunidades);
app.get("/inventario/contagens", mustAuth, inventario.getContagens);
app.get("/inventario/forasteiros", mustAuth, inventario.getForasteiros);
app.get("/inventario/bens-terceiros", mustAuth, inventario.getBensTerceiros);
app.get("/inventario/sugestoes-ciclo", mustAuth, inventario.getSugestoesCiclo);
app.get("/inventario/indicadores-acuracidade", mustAuth, inventario.getIndicadoresAcuracidade);
app.get("/inventario/eventos/:id/progresso", mustAuth, inventario.getProgresso);
app.get("/inventario/eventos/:id/nao-localizados", mustAuth, inventario.getNaoLocalizados);
app.get("/inventario/eventos/:id/minha-sessao-contagem", mustAuth, inventario.getMinhaSessaoContagem);
app.get("/inventario/eventos/:id/monitoramento-contagem", mustAdmin, inventario.getMonitoramentoContagem);
app.get("/inventario/eventos/:id/relatorio-encerramento", mustAuth, inventario.getRelatorioEncerramento);
app.get("/inventario/eventos/:id/relatorio-encerramento.csv", mustAuth, inventario.exportRelatorioEncerramentoCsv);
app.post("/inventario/eventos", mustAuth, inventario.postEvento);
app.patch("/inventario/eventos/:id", mustAdmin, inventario.patchEvento);
app.delete("/inventario/eventos/:id", mustAdmin, inventario.deleteEvento);
app.patch("/inventario/eventos/:id/status", mustAuth, inventario.patchEventoStatus);
app.post("/inventario/sync", mustAuth, inventario.postSync);
app.post("/inventario/bens-terceiros", mustAuth, inventario.postBemTerceiro);
app.post("/inventario/regularizacoes", mustAdmin, inventario.postRegularizacao);
app.post("/inventario/regularizacoes/lote", mustAdmin, inventario.postRegularizacaoLote);
app.post("/inventario/regularizacoes/encaminhar-transferencia", mustAdmin, inventario.postEncaminharTransferencia);
app.get("/inventario/regularizacoes/transferencias-pendentes", mustAuth, inventario.getTransferenciasPendentesRegularizacao);
app.post("/inventario/regularizacoes/concluir-transferencias", mustAdmin, inventario.postConcluirTransferencias);

/**
 * Registra bem "sem placa/não identificado" (Art. 175)
 * - Exige foto e descrição.
 * - Registra localmente como BEM_NAO_IDENTIFICADO na contagem.
 */
app.post("/inventario/bens-nao-identificados", mustAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const eventoInventarioId = body.eventoInventarioId != null ? String(body.eventoInventarioId).trim() : "";
    if (!UUID_RE.test(eventoInventarioId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "eventoInventarioId deve ser UUID.");

    const salaEncontrada = body.salaEncontrada != null ? String(body.salaEncontrada).trim().slice(0, 180) : "";
    if (!salaEncontrada) throw new HttpError(422, "SALA_OBRIGATORIA", "salaEncontrada e obrigatoria.");

    const unidadeEncontradaId = body.unidadeEncontradaId != null ? Number(body.unidadeEncontradaId) : null;
    if (!VALID_UNIDADES.has(unidadeEncontradaId)) throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeEncontradaId deve ser 1..4.");

    const descricaoDetalhada = body.descricao != null ? String(body.descricao).trim().slice(0, 500) : "";
    if (!descricaoDetalhada) throw new HttpError(422, "DESCRICAO_OBRIGATORIA", "A descrição é obrigatória.");

    const localizacaoExata = body.localizacaoExata != null ? String(body.localizacaoExata).trim().slice(0, 140) : "";
    if (!localizacaoExata) throw new HttpError(422, "LOCALIZACAO_OBRIGATORIA", "A localização exata é obrigatória.");
    const observacoes = `Localização Exata: ${localizacaoExata}`;

    const base64Data = String(body.base64Data || "").trim();
    if (!base64Data) throw new HttpError(422, "FOTO_OBRIGATORIA", "A fotografia é obrigatória (Art. 175).");
    if (base64Data.length > 16_000_000) throw new HttpError(413, "FOTO_GRANDE", "Foto grande demais (max ~12 MB).");

    const encontradoPorPerfilId = req.user?.id ? String(req.user.id).trim() : null;
    if (!encontradoPorPerfilId) throw new HttpError(401, "NAO_AUTENTICADO", "Usuario nao autenticado (perfilId ausente).");

    // Processamento da Foto Otimizada
    const rawBuffer = Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const optimized = await sharp(rawBuffer)
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const ts = Date.now();
    const slug = eventoInventarioId.slice(0, 8);
    const fileName = `${slug}_nai_${ts}.webp`;
    const relPath = `bem/${fileName}`;
    const absPath = path.join(FOTOS_DIR, "bem", fileName);
    fs.writeFileSync(absPath, optimized);
    const fotoUrl = `/fotos/${relPath}`;

    await client.query("BEGIN");

    const ev = await client.query(
      `SELECT id, status::text AS status, codigo_evento AS "codigoEvento"
       FROM eventos_inventario WHERE id = $1 LIMIT 1;`,
      [eventoInventarioId],
    );
    if (!ev.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.");
    if (String(ev.rows[0].status) !== "EM_ANDAMENTO") {
      throw new HttpError(409, "EVENTO_NAO_ATIVO", "Registro exige evento EM_ANDAMENTO.");
    }

    await setDbContext(client, { changeOrigin: "APP", currentUserId: encontradoPorPerfilId });

    // Catalogo "generico" para itens nao identificados
    const cat = await client.query(
      `INSERT INTO catalogo_bens (codigo_catalogo, descricao, grupo, material_permanente)
       VALUES ('NAO_IDENTIFICADO_GENERICO', 'Bem sem placa/identificação', 'NAO_IDENTIFICADOS', FALSE)
       ON CONFLICT (codigo_catalogo) DO UPDATE SET updated_at = NOW() RETURNING id;`,
    );
    const catalogoBemId = cat.rows[0].id;

    // Identificador para by-pass na check constraint do GEAFIN
    const identificadorExterno = `NAI-${String(Date.now())}`;

    const bemIns = await client.query(
      `INSERT INTO bens(
      numero_tombamento, identificador_externo, catalogo_bem_id,
      descricao_complementar, unidade_dona_id, local_fisico, status,
      eh_bem_terceiro, proprietario_externo, foto_url
    ) VALUES(
      NULL, $1, $2, $3, $4, $5, 'OK', TRUE, 'SEM_IDENTIFICACAO', $6
    ) RETURNING id; `,
      [identificadorExterno, catalogoBemId, descricaoDetalhada, unidadeEncontradaId, salaEncontrada, fotoUrl],
    );
    const bemId = bemIns.rows[0].id;

    const cont = await client.query(
      `INSERT INTO contagens(
      evento_inventario_id, bem_id, unidade_encontrada_id, sala_encontrada,
      status_apurado, tipo_ocorrencia, regularizacao_pendente,
      encontrado_por_perfil_id, encontrado_em, observacoes
    ) VALUES($1, $2, $3, $4, 'OK', 'BEM_NAO_IDENTIFICADO', TRUE, $5, NOW(), $6)
       RETURNING id, tipo_ocorrencia::text AS "tipoOcorrencia", encontrado_em AS "encontradoEm", observacoes; `,
      [eventoInventarioId, bemId, unidadeEncontradaId, salaEncontrada, encontradoPorPerfilId, observacoes],
    );

    await client.query("COMMIT");
    res.status(201).json({ requestId: req.requestId, fotoUrl, contagem: cont.rows[0] });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

/**
 * Lista documentos/evidencias vinculados a movimentacoes/contagens.
 *
 * Regra operacional:
 * - Nao retorna conteudo binario. Apenas metadados (Drive URL/ID/hash).
 * - Util para auditoria e para a UI exibir links dos termos.
 *
 * Query params:
 * - movimentacaoId: UUID (opcional)
 * - contagemId: UUID (opcional)
 * - avaliacaoInservivelId: UUID (opcional; exige migration 013)
 */
app.get("/documentos", mustAuth, async (req, res, next) => {
  try {
    const q = req.query || {};
    const movimentacaoId = q.movimentacaoId != null ? String(q.movimentacaoId).trim() : "";
    const contagemId = q.contagemId != null ? String(q.contagemId).trim() : "";
    const avaliacaoInservivelId = q.avaliacaoInservivelId != null ? String(q.avaliacaoInservivelId).trim() : "";

    if (movimentacaoId && !UUID_RE.test(movimentacaoId)) {
      throw new HttpError(422, "MOVIMENTACAO_ID_INVALIDO", "movimentacaoId deve ser UUID.");
    }
    if (contagemId && !UUID_RE.test(contagemId)) {
      throw new HttpError(422, "CONTAGEM_ID_INVALIDO", "contagemId deve ser UUID.");
    }
    if (avaliacaoInservivelId && !UUID_RE.test(avaliacaoInservivelId)) {
      throw new HttpError(422, "AVALIACAO_ID_INVALIDO", "avaliacaoInservivelId deve ser UUID.");
    }

    const where = ["1=1"];
    const params = [];
    let i = 1;

    if (movimentacaoId) {
      where.push(`movimentacao_id = $${i} `);
      params.push(movimentacaoId);
      i += 1;
    }
    if (contagemId) {
      where.push(`contagem_id = $${i} `);
      params.push(contagemId);
      i += 1;
    }

    const supportsAvaliacao = await documentosHasAvaliacaoInservivelIdColumn();
    if (supportsAvaliacao && avaliacaoInservivelId) {
      where.push(`avaliacao_inservivel_id = $${i} `);
      params.push(avaliacaoInservivelId);
      i += 1;
    }

    const r = await pool.query(
      `SELECT
    id,
      tipo::text AS "tipo",
        titulo,
        movimentacao_id AS "movimentacaoId",
          contagem_id AS "contagemId",
            ${supportsAvaliacao ? 'avaliacao_inservivel_id AS "avaliacaoInservivelId",' : ""}
         termo_referencia AS "termoReferencia",
      arquivo_nome AS "arquivoNome",
        mime,
        bytes,
        sha256,
        drive_file_id AS "driveFileId",
          drive_url AS "driveUrl",
            gerado_por_perfil_id AS "geradoPorPerfilId",
              gerado_em AS "geradoEm",
                observacoes
       FROM documentos
       WHERE ${where.join(" AND ")}
       ORDER BY gerado_em DESC
       LIMIT 500; `,
      params,
    );

    res.json({ requestId: req.requestId, items: r.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * Registra metadados de documento (evidencia) gerado no n8n/Drive.
 *
 * Regra legal:
 * - Evidencia documental e obrigatoria para transferencia/cautela (Arts. 124/127 - AN303_Art124/AN303_Art127).
 *
 * Observacao:
 * - Endpoint ADMIN: evita spam e garante consistencia de auditoria.
 */
app.post("/documentos", mustAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const tipo = String(body.tipo || "").trim().toUpperCase();
    const allowed = new Set([
      "TERMO_TRANSFERENCIA",
      "TERMO_CAUTELA",
      "TERMO_REGULARIZACAO",
      "RELATORIO_FORASTEIROS",
      "OUTRO",
    ]);
    if (!allowed.has(tipo)) throw new HttpError(422, "TIPO_INVALIDO", "tipo de documento invalido.");

    const movimentacaoId = body.movimentacaoId != null ? String(body.movimentacaoId).trim() : "";
    const contagemId = body.contagemId != null ? String(body.contagemId).trim() : "";
    const avaliacaoInservivelId = body.avaliacaoInservivelId != null ? String(body.avaliacaoInservivelId).trim() : "";
    if (movimentacaoId && !UUID_RE.test(movimentacaoId)) throw new HttpError(422, "MOVIMENTACAO_ID_INVALIDO", "movimentacaoId deve ser UUID.");
    if (contagemId && !UUID_RE.test(contagemId)) throw new HttpError(422, "CONTAGEM_ID_INVALIDO", "contagemId deve ser UUID.");
    if (avaliacaoInservivelId && !UUID_RE.test(avaliacaoInservivelId)) throw new HttpError(422, "AVALIACAO_ID_INVALIDO", "avaliacaoInservivelId deve ser UUID.");

    const termoReferencia = body.termoReferencia != null ? String(body.termoReferencia).trim().slice(0, 120) : null;
    const titulo = body.titulo != null ? String(body.titulo).trim().slice(0, 180) : null;
    const arquivoNome = body.arquivoNome != null ? String(body.arquivoNome).trim().slice(0, 200) : null;
    const mime = body.mime != null ? String(body.mime).trim().slice(0, 120) : null;
    const bytes = body.bytes != null && body.bytes !== "" ? Number(body.bytes) : null;
    if (bytes != null && (!Number.isFinite(bytes) || bytes < 0)) throw new HttpError(422, "BYTES_INVALIDO", "bytes deve ser >= 0.");

    const sha256 = body.sha256 != null ? String(body.sha256).trim() : null;
    if (sha256 && !/^[0-9a-f]{64}$/i.test(sha256)) throw new HttpError(422, "SHA256_INVALIDO", "sha256 deve ter 64 hex chars.");

    const driveFileId = body.driveFileId != null ? String(body.driveFileId).trim().slice(0, 200) : null;
    const driveUrl = body.driveUrl != null ? String(body.driveUrl).trim() : null;
    if (!driveUrl) throw new HttpError(422, "DRIVE_URL_OBRIGATORIA", "driveUrl e obrigatorio.");

    const observacoes = body.observacoes != null ? String(body.observacoes).trim().slice(0, 2000) : null;

    const supportsAvaliacao = await documentosHasAvaliacaoInservivelIdColumn();
    if (!supportsAvaliacao && avaliacaoInservivelId) {
      throw new HttpError(
        409,
        "SCHEMA_DESATUALIZADO",
        "Banco de dados ainda nao tem avaliacaoInservivelId em documentos. Aplique a migration 013.",
      );
    }

    const r = await pool.query(
      `INSERT INTO documentos(
                  tipo, titulo, movimentacao_id, contagem_id, ${supportsAvaliacao ? "avaliacao_inservivel_id," : ""} termo_referencia,
                  arquivo_nome, mime, bytes, sha256, drive_file_id, drive_url,
                  gerado_por_perfil_id, observacoes
                ) VALUES(
                  $1:: public.tipo_documento, $2, $3, $4, ${supportsAvaliacao ? "$5," : ""} $${supportsAvaliacao ? 6 : 5},
                  $${supportsAvaliacao ? 7 : 6}, $${supportsAvaliacao ? 8 : 7}, $${supportsAvaliacao ? 9 : 8}, $${supportsAvaliacao ? 10 : 9}, $${supportsAvaliacao ? 11 : 10}, $${supportsAvaliacao ? 12 : 11},
                  $${supportsAvaliacao ? 13 : 12}, $${supportsAvaliacao ? 14 : 13}
                )
    RETURNING
    id,
      tipo::text AS "tipo",
        titulo,
        movimentacao_id AS "movimentacaoId",
          contagem_id AS "contagemId",
            ${supportsAvaliacao ? 'avaliacao_inservivel_id AS "avaliacaoInservivelId",' : ""}
         termo_referencia AS "termoReferencia",
      drive_file_id AS "driveFileId",
        drive_url AS "driveUrl",
          gerado_em AS "geradoEm"; `,
      supportsAvaliacao
        ? [
          tipo,
          titulo,
          movimentacaoId || null,
          contagemId || null,
          avaliacaoInservivelId || null,
          termoReferencia,
          arquivoNome,
          mime,
          bytes,
          sha256,
          driveFileId,
          driveUrl,
          req.user?.id || null,
          observacoes,
        ]
        : [
          tipo,
          titulo,
          movimentacaoId || null,
          contagemId || null,
          termoReferencia,
          arquivoNome,
          mime,
          bytes,
          sha256,
          driveFileId,
          driveUrl,
          req.user?.id || null,
          observacoes,
        ],
    );

    res.status(201).json({ requestId: req.requestId, documento: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * Atualiza um documento existente (preenche evidência do Drive).
 *
 * Regra legal:
 * - Evidência documental é obrigatória para transferência/cautela (Arts. 124/127 - AN303_Art124/AN303_Art127).
 *
 * Observação:
 * - Útil para completar o placeholder criado automaticamente na movimentação.
 */
app.patch("/documentos/:id", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "DOCUMENTO_ID_INVALIDO", "id deve ser UUID.");

    const body = req.body || {};
    const driveUrl = body.driveUrl != null ? String(body.driveUrl).trim() : "";
    if (!driveUrl) throw new HttpError(422, "DRIVE_URL_OBRIGATORIA", "driveUrl e obrigatorio.");

    const driveFileId = body.driveFileId != null ? String(body.driveFileId).trim().slice(0, 200) : null;
    const arquivoNome = body.arquivoNome != null ? String(body.arquivoNome).trim().slice(0, 200) : null;
    const mime = body.mime != null ? String(body.mime).trim().slice(0, 120) : null;
    const bytes = body.bytes != null && body.bytes !== "" ? Number(body.bytes) : null;
    if (bytes != null && (!Number.isFinite(bytes) || bytes < 0)) throw new HttpError(422, "BYTES_INVALIDO", "bytes deve ser >= 0.");

    const sha256 = body.sha256 != null ? String(body.sha256).trim() : null;
    if (sha256 && !/^[0-9a-f]{64}$/i.test(sha256)) throw new HttpError(422, "SHA256_INVALIDO", "sha256 deve ter 64 hex chars.");

    const observacoes = body.observacoes != null ? String(body.observacoes).trim().slice(0, 2000) : null;

    const r = await pool.query(
      `UPDATE documentos
    SET
    drive_url = $2,
      drive_file_id = COALESCE($3, drive_file_id),
      arquivo_nome = COALESCE($4, arquivo_nome),
      mime = COALESCE($5, mime),
      bytes = COALESCE($6, bytes),
      sha256 = COALESCE($7, sha256),
      observacoes = COALESCE($8, observacoes),
      updated_at = NOW()
       WHERE id = $1
    RETURNING
    id,
      tipo::text AS "tipo",
        titulo,
        movimentacao_id AS "movimentacaoId",
          contagem_id AS "contagemId",
            termo_referencia AS "termoReferencia",
              drive_file_id AS "driveFileId",
                drive_url AS "driveUrl",
                  updated_at AS "updatedAt"; `,
      [id, driveUrl, driveFileId, arquivoNome, mime, bytes, sha256, observacoes],
    );
    if (!r.rowCount) throw new HttpError(404, "DOCUMENTO_NAO_ENCONTRADO", "Documento nao encontrado.");

    res.json({ requestId: req.requestId, documento: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * Registra avaliacao de inservivel via Wizard (Art. 141) e atualiza o estado atual do bem.
 *
 * Regra legal: classificacao obrigatoria de inserviveis.
 * Art. 141 (AN303_Art141_Cap / AN303_Art141_I / AN303_Art141_II / AN303_Art141_III / AN303_Art141_IV).
 */
app.post("/inserviveis/avaliacoes", mustAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const bemId = String(body.bemId || "").trim();
    if (!UUID_RE.test(bemId)) throw new HttpError(422, "BEM_ID_INVALIDO", "bemId deve ser UUID.");

    const tipo = String(body.tipoInservivel || body.classificacao || "").trim().toUpperCase();
    const allowed = new Set(["OCIOSO", "RECUPERAVEL", "ANTIECONOMICO", "IRRECUPERAVEL"]);
    if (!allowed.has(tipo)) throw new HttpError(422, "TIPO_INVALIDO", "tipoInservivel invalido.");

    const descricaoInformada = body.descricaoInformada != null ? String(body.descricaoInformada).trim().slice(0, 2000) : null;
    const justificativa = body.justificativa != null ? String(body.justificativa).trim().slice(0, 4000) : null;
    const criterios = body.criterios != null && typeof body.criterios === "object" ? body.criterios : null;

    await client.query("BEGIN");
    await setDbContext(client, { changeOrigin: "APP", currentUserId: req.user?.id ? String(req.user.id).trim() : null });

    const bemR = await client.query(`SELECT id, numero_tombamento, status::text AS status FROM bens WHERE id = $1 FOR UPDATE; `, [bemId]);
    if (!bemR.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");

    const ins = await client.query(
      `INSERT INTO avaliacoes_inserviveis(
                    bem_id, tipo_inservivel, descricao_informada, justificativa, criterios, avaliado_por_perfil_id
                  ) VALUES(
                    $1, $2:: public.tipo_inservivel, $3, $4, $5, $6
                  )
       RETURNING id, bem_id AS "bemId", tipo_inservivel::text AS "tipoInservivel", avaliado_em AS "avaliadoEm"; `,
      [bemId, tipo, descricaoInformada, justificativa, criterios ? JSON.stringify(criterios) : null, req.user?.id || null],
    );

    await client.query(
      `UPDATE bens SET tipo_inservivel = $2:: public.tipo_inservivel, updated_at = NOW() WHERE id = $1; `,
      [bemId, tipo],
    );

    await client.query("COMMIT");
    res.status(201).json({ requestId: req.requestId, avaliacao: ins.rows[0] });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

/**
 * Lista avaliacoes do Wizard (Art. 141) por bem.
 */
app.get("/inserviveis/avaliacoes", mustAuth, async (req, res, next) => {
  try {
    const bemId = req.query?.bemId != null ? String(req.query.bemId).trim() : "";
    if (!UUID_RE.test(bemId)) throw new HttpError(422, "BEM_ID_INVALIDO", "bemId deve ser UUID.");

    const r = await pool.query(
      `SELECT
    id,
      bem_id AS "bemId",
        tipo_inservivel::text AS "tipoInservivel",
          descricao_informada AS "descricaoInformada",
            justificativa,
            criterios,
            avaliado_por_perfil_id AS "avaliadoPorPerfilId",
              avaliado_em AS "avaliadoEm"
       FROM avaliacoes_inserviveis
       WHERE bem_id = $1
       ORDER BY avaliado_em DESC
       LIMIT 50; `,
      [bemId],
    );

    res.json({ requestId: req.requestId, items: r.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * Lista classificacoes SIAFI.
 */
app.get("/classificacoes-siafi", mustAuth, async (req, res, next) => {
  try {
    const q = req.query?.q != null ? String(req.query.q).trim().slice(0, 120) : "";
    const ativoRaw = req.query?.ativo != null ? String(req.query.ativo).trim().toLowerCase() : "";
    const onlyAtivos = ativoRaw === "true" || ativoRaw === "1" || ativoRaw === "sim";
    const limit = Math.max(1, Math.min(500, parseIntOrDefault(req.query?.limit, 200)));
    const offset = Math.max(0, parseIntOrDefault(req.query?.offset, 0));

    const where = [];
    const params = [];
    let i = 1;
    if (q) {
      where.push(`(cs.codigo_classificacao ILIKE $${i} OR cs.descricao_siafi ILIKE $${i})`);
      params.push(`%${q}%`);
      i += 1;
    }
    if (onlyAtivos) {
      where.push(`cs.ativo = TRUE`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total FROM classificacoes_siafi cs ${whereSql};`,
      params,
    );

    const list = await pool.query(
      `SELECT
         cs.id,
         cs.codigo_classificacao AS "codigoClassificacao",
         cs.descricao_siafi AS "descricaoSiafi",
         cs.ativo,
         cs.created_at AS "createdAt",
         cs.updated_at AS "updatedAt"
       FROM classificacoes_siafi cs
       ${whereSql}
       ORDER BY cs.codigo_classificacao ASC
       LIMIT $${i} OFFSET $${i + 1};`,
      [...params, limit, offset],
    );

    res.json({
      requestId: req.requestId,
      paging: { limit, offset, total: count.rows[0]?.total ?? 0 },
      items: list.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cria classificacao SIAFI.
 */
app.post("/classificacoes-siafi", mustAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const codigoClassificacao = String(body.codigoClassificacao || "").trim().slice(0, 30);
    const descricaoSiafi = String(body.descricaoSiafi || "").trim().slice(0, 220);
    if (!codigoClassificacao) {
      throw new HttpError(422, "CODIGO_CLASSIFICACAO_OBRIGATORIO", "codigoClassificacao e obrigatorio.");
    }
    if (!descricaoSiafi) {
      throw new HttpError(422, "DESCRICAO_SIAFI_OBRIGATORIA", "descricaoSiafi e obrigatoria.");
    }
    const r = await pool.query(
      `INSERT INTO classificacoes_siafi (codigo_classificacao, descricao_siafi, ativo)
       VALUES ($1, $2, TRUE)
       RETURNING
         id,
         codigo_classificacao AS "codigoClassificacao",
         descricao_siafi AS "descricaoSiafi",
         ativo,
         created_at AS "createdAt",
         updated_at AS "updatedAt";`,
      [codigoClassificacao, descricaoSiafi],
    );
    res.status(201).json({ requestId: req.requestId, classificacao: r.rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      next(new HttpError(409, "CLASSIFICACAO_SIAFI_DUPLICADA", "Ja existe classificacao SIAFI com este codigo."));
      return;
    }
    next(error);
  }
});

/**
 * Atualiza classificacao SIAFI.
 */
app.patch("/classificacoes-siafi/:id", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "CLASSIFICACAO_ID_INVALIDO", "id deve ser UUID.");
    const body = req.body || {};
    const fields = [];
    const params = [];
    let i = 1;

    if (Object.prototype.hasOwnProperty.call(body, "codigoClassificacao")) {
      const codigo = String(body.codigoClassificacao || "").trim().slice(0, 30);
      if (!codigo) throw new HttpError(422, "CODIGO_CLASSIFICACAO_OBRIGATORIO", "codigoClassificacao e obrigatorio.");
      fields.push(`codigo_classificacao = $${i}`);
      params.push(codigo);
      i += 1;
    }
    if (Object.prototype.hasOwnProperty.call(body, "descricaoSiafi")) {
      const descricao = String(body.descricaoSiafi || "").trim().slice(0, 220);
      if (!descricao) throw new HttpError(422, "DESCRICAO_SIAFI_OBRIGATORIA", "descricaoSiafi e obrigatoria.");
      fields.push(`descricao_siafi = $${i}`);
      params.push(descricao);
      i += 1;
    }
    if (Object.prototype.hasOwnProperty.call(body, "ativo")) {
      fields.push(`ativo = $${i}`);
      params.push(parseBool(body.ativo, true));
      i += 1;
    }
    if (!fields.length) throw new HttpError(422, "PATCH_VAZIO", "Envie ao menos um campo para atualizar.");

    const r = await pool.query(
      `UPDATE classificacoes_siafi
       SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING
         id,
         codigo_classificacao AS "codigoClassificacao",
         descricao_siafi AS "descricaoSiafi",
         ativo,
         created_at AS "createdAt",
         updated_at AS "updatedAt";`,
      [...params, id],
    );
    if (!r.rowCount) throw new HttpError(404, "CLASSIFICACAO_NAO_ENCONTRADA", "Classificacao SIAFI nao encontrada.");
    res.json({ requestId: req.requestId, classificacao: r.rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      next(new HttpError(409, "CLASSIFICACAO_SIAFI_DUPLICADA", "Ja existe classificacao SIAFI com este codigo."));
      return;
    }
    next(error);
  }
});

/**
 * Lista catalogos (SKU) com filtros e paginacao.
 */
app.get("/catalogo-bens", mustAuth, async (req, res, next) => {
  try {
    const q = req.query?.q != null ? String(req.query.q).trim().slice(0, 120) : "";
    const codigoCatalogo = req.query?.codigoCatalogo != null ? String(req.query.codigoCatalogo).trim().slice(0, 120) : "";
    const grupo = req.query?.grupo != null ? String(req.query.grupo).trim().slice(0, 120) : "";
    const limit = Math.max(1, Math.min(500, parseIntOrDefault(req.query?.limit, 100)));
    const offset = Math.max(0, parseIntOrDefault(req.query?.offset, 0));

    const where = [];
    const params = [];
    let i = 1;
    if (q) {
      where.push(`(cb.codigo_catalogo ILIKE $${i} OR cb.descricao ILIKE $${i} OR COALESCE(cb.grupo, '') ILIKE $${i})`);
      params.push(`%${q}%`);
      i += 1;
    }
    if (codigoCatalogo) {
      where.push(`cb.codigo_catalogo ILIKE $${i}`);
      params.push(`%${codigoCatalogo}%`);
      i += 1;
    }
    if (grupo) {
      where.push(`COALESCE(cb.grupo, '') ILIKE $${i}`);
      params.push(`%${grupo}%`);
      i += 1;
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM catalogo_bens cb
       ${whereSql};`,
      params,
    );

    const list = await pool.query(
      `SELECT
         cb.id,
         cb.codigo_catalogo AS "codigoCatalogo",
         cb.descricao,
         cb.grupo,
         cb.material_permanente AS "materialPermanente",
         cb.foto_referencia_url AS "fotoReferenciaUrl",
         cb.created_at AS "createdAt",
         cb.updated_at AS "updatedAt",
         COALESCE(cnt.total, 0) AS "totalBens"
       FROM catalogo_bens cb
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total
         FROM bens b
         WHERE b.catalogo_bem_id = cb.id
       ) cnt ON TRUE
       ${whereSql}
       ORDER BY cb.updated_at DESC, cb.codigo_catalogo ASC
       LIMIT $${i} OFFSET $${i + 1};`,
      [...params, limit, offset],
    );

    res.json({
      requestId: req.requestId,
      paging: { limit, offset, total: count.rows[0]?.total ?? 0 },
      items: list.rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cria catalogo (SKU) manualmente.
 * Restrito a ADMIN (quando auth ativa).
 */
app.post("/catalogo-bens", mustAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const codigoCatalogo = String(body.codigoCatalogo || "").trim().slice(0, 120);
    const descricao = String(body.descricao || "").trim().slice(0, 500);
    const grupo = body.grupo != null ? String(body.grupo).trim().slice(0, 120) : "";
    const materialPermanente = Object.prototype.hasOwnProperty.call(body, "materialPermanente")
      ? parseBool(body.materialPermanente, false)
      : false;

    if (!codigoCatalogo) throw new HttpError(422, "CODIGO_CATALOGO_OBRIGATORIO", "codigoCatalogo e obrigatorio.");
    if (!descricao) throw new HttpError(422, "DESCRICAO_OBRIGATORIA", "descricao e obrigatoria.");
    if (!grupo) throw new HttpError(422, "CLASSIFICACAO_SIAFI_OBRIGATORIA", "Classificacao SIAFI e obrigatoria.");

    const classificacao = await pool.query(
      `SELECT id
       FROM classificacoes_siafi
       WHERE codigo_classificacao = $1
         AND ativo = TRUE
       LIMIT 1;`,
      [grupo],
    );
    if (!classificacao.rowCount) {
      throw new HttpError(422, "CLASSIFICACAO_SIAFI_INVALIDA", "Classificacao SIAFI nao encontrada/ativa.");
    }

    const r = await pool.query(
      `INSERT INTO catalogo_bens (codigo_catalogo, descricao, grupo, material_permanente)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         codigo_catalogo AS "codigoCatalogo",
         descricao,
         grupo,
         material_permanente AS "materialPermanente",
         foto_referencia_url AS "fotoReferenciaUrl",
         created_at AS "createdAt",
         updated_at AS "updatedAt";`,
      [codigoCatalogo, descricao, grupo, materialPermanente],
    );

    res.status(201).json({ requestId: req.requestId, catalogo: r.rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      next(new HttpError(409, "CODIGO_CATALOGO_DUPLICADO", "Ja existe catalogo com este codigoCatalogo."));
      return;
    }
    next(error);
  }
});

/**
 * Atualiza catalogo (SKU) por id.
 * Restrito a ADMIN (quando auth ativa).
 */
app.patch("/catalogo-bens/:id", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "CATALOGO_ID_INVALIDO", "id deve ser UUID.");

    const body = req.body || {};
    // Gate adicional para reduzir risco operacional em edicao de Material (SKU).
    // Exige dupla confirmacao textual + senha administrativa quando auth estiver ativa.
    if (AUTH_ENABLED) {
      const confirmText = String(body.confirmText || "").trim();
      if (confirmText !== "CONFIRMAR_EDICAO_MATERIAL") {
        throw new HttpError(
          422,
          "CONFIRMACAO_EDICAO_INVALIDA",
          "confirmText deve ser CONFIRMAR_EDICAO_MATERIAL para editar Material (SKU).",
        );
      }
      await ensureAdminPassword(req, body.adminPassword);
    }
    const fields = [];
    const params = [];
    let i = 1;

    if (Object.prototype.hasOwnProperty.call(body, "codigoCatalogo")) {
      const codigo = String(body.codigoCatalogo || "").trim().slice(0, 120);
      if (!codigo) throw new HttpError(422, "CODIGO_CATALOGO_OBRIGATORIO", "codigoCatalogo e obrigatorio.");
      fields.push(`codigo_catalogo = $${i}`);
      params.push(codigo);
      i += 1;
    }
    if (Object.prototype.hasOwnProperty.call(body, "descricao")) {
      const descricao = String(body.descricao || "").trim().slice(0, 500);
      if (!descricao) throw new HttpError(422, "DESCRICAO_OBRIGATORIA", "descricao e obrigatoria.");
      fields.push(`descricao = $${i}`);
      params.push(descricao);
      i += 1;
    }
    if (Object.prototype.hasOwnProperty.call(body, "grupo")) {
      const codigoClassificacao = body.grupo != null ? String(body.grupo).trim().slice(0, 120) : "";
      if (!codigoClassificacao) {
        throw new HttpError(422, "CLASSIFICACAO_SIAFI_OBRIGATORIA", "Classificacao SIAFI e obrigatoria.");
      }
      const classificacao = await pool.query(
        `SELECT id
         FROM classificacoes_siafi
         WHERE codigo_classificacao = $1
           AND ativo = TRUE
         LIMIT 1;`,
        [codigoClassificacao],
      );
      if (!classificacao.rowCount) {
        throw new HttpError(422, "CLASSIFICACAO_SIAFI_INVALIDA", "Classificacao SIAFI nao encontrada/ativa.");
      }
      fields.push(`grupo = $${i}`);
      params.push(codigoClassificacao);
      i += 1;
    }
    if (Object.prototype.hasOwnProperty.call(body, "materialPermanente")) {
      fields.push(`material_permanente = $${i}`);
      params.push(parseBool(body.materialPermanente, false));
      i += 1;
    }

    if (!fields.length) throw new HttpError(422, "PATCH_VAZIO", "Envie ao menos um campo para atualizar.");

    const r = await pool.query(
      `UPDATE catalogo_bens
       SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING
         id,
         codigo_catalogo AS "codigoCatalogo",
         descricao,
         grupo,
         material_permanente AS "materialPermanente",
         foto_referencia_url AS "fotoReferenciaUrl",
         created_at AS "createdAt",
         updated_at AS "updatedAt";`,
      [...params, id],
    );
    if (!r.rowCount) throw new HttpError(404, "CATALOGO_NAO_ENCONTRADO", "Catalogo nao encontrado.");

    res.json({ requestId: req.requestId, catalogo: r.rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      next(new HttpError(409, "CODIGO_CATALOGO_DUPLICADO", "Ja existe catalogo com este codigoCatalogo."));
      return;
    }
    next(error);
  }
});

/**
 * Associa bens existentes a um catalogo (SKU) por tombamento.
 * Restrito a ADMIN (quando auth ativa).
 */
app.post("/catalogo-bens/:id/associar-bens", mustAdmin, async (req, res, next) => {
  try {
    const catalogoId = String(req.params?.id || "").trim();
    if (!UUID_RE.test(catalogoId)) throw new HttpError(422, "CATALOGO_ID_INVALIDO", "id deve ser UUID.");

    const body = req.body || {};
    const dryRun = parseBool(body.dryRun, false);
    const tombamentosRaw = Array.isArray(body.tombamentos) ? body.tombamentos : [];
    const tombamentos = Array.from(new Set(
      tombamentosRaw
        .map((t) => normalizeTombamento(t))
        .filter((t) => Boolean(t) && TOMBAMENTO_GEAFIN_RE.test(t)),
    ));
    if (!tombamentos.length) {
      throw new HttpError(422, "TOMBAMENTOS_OBRIGATORIOS", "Envie ao menos um numero de tombamento GEAFIN valido.");
    }
    if (tombamentos.length > 5000) {
      throw new HttpError(422, "TOMBAMENTOS_LIMITE", "Limite de 5000 tombamentos por operacao.");
    }

    const found = await pool.query(
      `SELECT id, numero_tombamento AS "numeroTombamento", catalogo_bem_id AS "catalogoBemId"
       FROM bens
       WHERE numero_tombamento = ANY($1::text[]);`,
      [tombamentos],
    );
    const foundByTombo = new Map(found.rows.map((r) => [String(r.numeroTombamento), r]));
    const naoEncontrados = tombamentos.filter((t) => !foundByTombo.has(t));
    const elegiveis = found.rows.filter((r) => String(r.catalogoBemId || "") !== catalogoId);

    if (dryRun) {
      res.json({
        requestId: req.requestId,
        dryRun: true,
        catalogoId,
        totalRecebidos: tombamentos.length,
        encontrados: found.rows.length,
        elegiveis: elegiveis.length,
        naoEncontrados,
      });
      return;
    }

    const upd = await pool.query(
      `UPDATE bens
       SET catalogo_bem_id = $2, updated_at = NOW()
       WHERE numero_tombamento = ANY($1::text[])
         AND catalogo_bem_id <> $2
       RETURNING id;`,
      [tombamentos, catalogoId],
    );

    res.json({
      requestId: req.requestId,
      dryRun: false,
      catalogoId,
      totalRecebidos: tombamentos.length,
      encontrados: found.rows.length,
      associados: upd.rowCount || 0,
      naoEncontrados,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Aplica nome_resumo em todos os bens de um SKU (catalogo).
 * Restrito a ADMIN (quando auth ativa).
 */
app.patch("/catalogo-bens/:id/aplicar-nome-resumo", mustAdmin, async (req, res, next) => {
  try {
    const catalogoId = String(req.params?.id || "").trim();
    if (!UUID_RE.test(catalogoId)) throw new HttpError(422, "CATALOGO_ID_INVALIDO", "id deve ser UUID.");

    const body = req.body || {};
    const nomeResumoBody = Object.prototype.hasOwnProperty.call(body, "nomeResumo")
      ? String(body.nomeResumo || "").trim()
      : "";

    const cat = await pool.query(
      `SELECT id, descricao
       FROM catalogo_bens
       WHERE id = $1
       LIMIT 1;`,
      [catalogoId],
    );
    if (!cat.rowCount) throw new HttpError(404, "CATALOGO_NAO_ENCONTRADO", "Catalogo nao encontrado.");

    const nomeResumo = (nomeResumoBody || String(cat.rows[0].descricao || "").trim()).slice(0, 220);
    if (!nomeResumo) {
      throw new HttpError(422, "NOME_RESUMO_OBRIGATORIO", "Informe nomeResumo ou mantenha descricao valida no catalogo.");
    }

    const upd = await pool.query(
      `UPDATE bens
       SET nome_resumo = $2,
           updated_at = NOW()
       WHERE catalogo_bem_id = $1
         AND eh_bem_terceiro = FALSE
       RETURNING id;`,
      [catalogoId, nomeResumo],
    );

    res.json({
      requestId: req.requestId,
      catalogoId,
      nomeResumoAplicado: nomeResumo,
      atualizados: upd.rowCount || 0,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Estatisticas de locais (progresso de cadastro por sala).
 */
app.get("/locais/estatisticas", mustAuth, async (req, res, next) => {
  try {
    const unidadeId = req.query?.unidadeId != null && String(req.query.unidadeId).trim() !== ""
      ? Number(req.query.unidadeId)
      : null;

    let whereSql = "WHERE eh_bem_terceiro = FALSE AND status != 'BAIXADO'";
    const params = [];

    if (unidadeId != null) {
      whereSql += " AND unidade_dona_id = $1";
      params.push(unidadeId);
    }

    const { rows } = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COUNT(local_id) AS com_local,
         COUNT(*) - COUNT(local_id) AS sem_local
       FROM bens
       ${whereSql}`,
      params
    );

    const stats = rows[0] || { total: 0, com_local: 0, sem_local: 0 };

    res.json({
      requestId: req.requestId,
      total: Number(stats.total),
      comLocal: Number(stats.com_local),
      semLocal: Number(stats.sem_local)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reset de localizacao fisica dos bens (modo pre-inventario livre).
 * Limpa local_id de todos os bens (ou de uma unidade) sem apagar locais cadastrados.
 * Restrito a ADMIN.
 *
 * Query params:
 *   unidadeId  1..4 (opcional) — se informado, limpa apenas essa unidade
 */
app.delete("/locais/reset", mustAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const unidadeId = req.query?.unidadeId != null && String(req.query.unidadeId).trim() !== ""
      ? Number(req.query.unidadeId)
      : null;
    const localIdsRaw = Array.isArray(req.body?.localIds) ? req.body.localIds : [];
    const localIds = Array.from(new Set(localIdsRaw.map((v) => String(v || "").trim()).filter(Boolean)));

    if (unidadeId != null && (!Number.isInteger(unidadeId) || !VALID_UNIDADES.has(unidadeId))) {
      throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeId deve ser 1..4.");
    }
    if (localIds.length > 500) {
      throw new HttpError(422, "LIMITE_LOCAIS_EXCEDIDO", "Selecione no maximo 500 salas por reset.");
    }
    if (localIds.some((id) => !UUID_RE.test(id))) {
      throw new HttpError(422, "LOCAL_ID_INVALIDO", "localIds deve conter apenas UUIDs validos de salas.");
    }

    // Exige senha de administrador para confirmar operacao destrutiva
    await ensureAdminPassword(req, req.body?.adminPassword);

    await client.query("BEGIN");

    let updateSql = "UPDATE bens SET local_id = NULL WHERE local_id IS NOT NULL AND eh_bem_terceiro = FALSE AND status != 'BAIXADO'";
    const params = [];
    if (localIds.length) {
      params.push(localIds);
      updateSql += ` AND local_id = ANY($${params.length}::uuid[])`;
    } else if (unidadeId != null) {
      updateSql += " AND unidade_dona_id = $1";
      params.push(unidadeId);
    }

    const result = await client.query(updateSql, params);
    await client.query("COMMIT");

    res.json({
      requestId: req.requestId,
      afetados: result.rowCount ?? 0,
      escopo: localIds.length ? "SALAS" : (unidadeId != null ? "UNIDADE" : "TODAS"),
      unidadeId: localIds.length ? null : unidadeId,
      totalLocaisSelecionados: localIds.length || 0,
    });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});



/**
 * Lista locais (salas) padronizados.
 */
app.get("/locais", mustAuth, async (req, res, next) => {
  try {
    const unidadeId = req.query?.unidadeId != null && String(req.query.unidadeId).trim() !== ""
      ? Number(req.query.unidadeId)
      : null;
    const includeInativos = parseBool(req.query?.includeInativos, false);
    if (unidadeId != null && (!Number.isInteger(unidadeId) || !VALID_UNIDADES.has(unidadeId))) {
      throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeId deve ser 1..4.");
    }

    const where = [];
    const params = [];
    let i = 1;
    if (unidadeId != null) {
      where.push(`unidade_id = $${i} `);
      params.push(unidadeId);
      i += 1;
    }
    // Quando a coluna `ativo` existe (014), por padrao listamos apenas ativos.
    // Mantemos compatibilidade: se a coluna ainda nao existir, a query vai falhar e o handler devolve erro explicativo.
    if (!includeInativos) {
      where.push(`ativo = TRUE`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")} ` : "";

    const r = await pool.query(
      `SELECT id, nome, unidade_id AS "unidadeId", tipo, observacoes, ativo
       FROM locais
       ${whereSql}
       ORDER BY nome ASC
       LIMIT 2000; `,
      params,
    );
    res.json({ requestId: req.requestId, items: r.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * Cria/atualiza local padronizado.
 * Restrito a ADMIN (quando auth ativa) por ser cadastro operacional.
 */
app.post("/locais", mustAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const nome = String(body.nome || "").trim().slice(0, 180);
    if (!nome) throw new HttpError(422, "NOME_OBRIGATORIO", "nome e obrigatorio.");

    const unidadeId = body.unidadeId != null && String(body.unidadeId).trim() !== "" ? Number(body.unidadeId) : null;
    if (unidadeId != null && (!Number.isInteger(unidadeId) || !VALID_UNIDADES.has(unidadeId))) {
      throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeId deve ser 1..4.");
    }

    const tipo = body.tipo != null ? String(body.tipo).trim().slice(0, 40) : null;
    const observacoes = body.observacoes != null ? String(body.observacoes).trim().slice(0, 2000) : null;
    const ativo = Object.prototype.hasOwnProperty.call(body, "ativo") ? parseBool(body.ativo, true) : true;

    await client.query("BEGIN");
    const existing = await client.query("SELECT id FROM locais WHERE nome = $1 LIMIT 1;", [nome]);

    const r = existing.rowCount
      ? await client.query(
        `UPDATE locais
           SET unidade_id = $2,
      tipo = $3,
      observacoes = $4,
      ativo = $5
           WHERE id = $1
           RETURNING id, nome, unidade_id AS "unidadeId", tipo, observacoes, ativo; `,
        [existing.rows[0].id, unidadeId, tipo, observacoes, ativo],
      )
      : await client.query(
        `INSERT INTO locais(nome, unidade_id, tipo, observacoes)
    VALUES($1, $2, $3, $4)
           RETURNING id, nome, unidade_id AS "unidadeId", tipo, observacoes, ativo; `,
        [nome, unidadeId, tipo, observacoes],
      );

    await client.query("COMMIT");
    res.status(201).json({ requestId: req.requestId, local: r.rows[0] });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

/**
 * Atualiza local (ADMIN) por id.
 * Regra operacional: permite renomear e desativar/ativar sem apagar dados.
 */
app.patch("/locais/:id", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "LOCAL_ID_INVALIDO", "id deve ser UUID.");

    const body = req.body || {};
    const patch = {};

    if (Object.prototype.hasOwnProperty.call(body, "nome")) {
      const nome = String(body.nome || "").trim().slice(0, 180);
      if (!nome) throw new HttpError(422, "NOME_OBRIGATORIO", "nome e obrigatorio.");
      patch.nome = nome;
    }

    if (Object.prototype.hasOwnProperty.call(body, "unidadeId")) {
      const unidadeId = body.unidadeId != null && String(body.unidadeId).trim() !== "" ? Number(body.unidadeId) : null;
      if (unidadeId != null && (!Number.isInteger(unidadeId) || !VALID_UNIDADES.has(unidadeId))) {
        throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeId deve ser 1..4.");
      }
      patch.unidadeId = unidadeId;
    }

    if (Object.prototype.hasOwnProperty.call(body, "tipo")) {
      patch.tipo = body.tipo != null ? String(body.tipo).trim().slice(0, 40) : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "observacoes")) {
      patch.observacoes = body.observacoes != null ? String(body.observacoes).trim().slice(0, 2000) : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "ativo")) {
      patch.ativo = parseBool(body.ativo, true);
    }

    const fields = [];
    const params = [];
    let i = 1;
    if (patch.nome != null) {
      fields.push(`nome = $${i} `);
      params.push(patch.nome);
      i += 1;
    }
    if (patch.unidadeId !== undefined) {
      fields.push(`unidade_id = $${i} `);
      params.push(patch.unidadeId);
      i += 1;
    }
    if (patch.tipo !== undefined) {
      fields.push(`tipo = $${i} `);
      params.push(patch.tipo);
      i += 1;
    }
    if (patch.observacoes !== undefined) {
      fields.push(`observacoes = $${i} `);
      params.push(patch.observacoes);
      i += 1;
    }
    if (patch.ativo !== undefined) {
      fields.push(`ativo = $${i} `);
      params.push(patch.ativo);
      i += 1;
    }

    if (!fields.length) throw new HttpError(422, "PATCH_VAZIO", "Envie ao menos um campo para atualizar.");

    const r = await pool.query(
      `UPDATE locais
       SET ${fields.join(", ")}
       WHERE id = $${i}
       RETURNING id, nome, unidade_id AS "unidadeId", tipo, observacoes, ativo; `,
      [...params, id],
    );
    if (!r.rowCount) throw new HttpError(404, "LOCAL_NAO_ENCONTRADO", "Local nao encontrado.");

    res.json({ requestId: req.requestId, local: r.rows[0] });
  } catch (error) {
    if (error?.code === "23505") {
      next(new HttpError(409, "LOCAL_NOME_DUPLICADO", "Ja existe um local com este nome."));
      return;
    }
    next(error);
  }
});

/**
 * PDF: termo patrimonial (para n8n -> Drive).
 * Regra legal: Arts. 124/127 (AN303_Art124 / AN303_Art127) e Art. 185 (AN303_Art185) quando regularizacao.
 */
app.post("/pdf/termos", mustAdmin, async (req, res, next) => {
  try {
    const buf = await generateTermoPdf(req.body || {});
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"termo.pdf\"");
    res.send(buf);
  } catch (error) {
    next(error);
  }
});

/**
 * PDF: relatorio de forasteiros (Art. 185) derivado de vw_forasteiros.
 */
app.get("/pdf/forasteiros", mustAdmin, async (req, res, next) => {
  try {
    const limitRaw = req.query?.limit != null ? Number(req.query.limit) : 500;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(2000, Math.trunc(limitRaw))) : 500;

    const r = await pool.query(
      `SELECT contagem_id, codigo_evento, numero_tombamento, descricao, unidade_dona_id, unidade_encontrada_id, sala_encontrada, encontrado_em
       FROM public.vw_forasteiros
       ORDER BY encontrado_em DESC
       LIMIT $1; `,
      [limit],
    );

    const cols = ["Tombo", "Descricao", "Unid. carga", "Unid. encontrada", "Sala", "Evento", "Encontrado em"];
    const rows = r.rows.map((x) => [
      x.numero_tombamento || "",
      x.descricao || "",
      String(x.unidade_dona_id || ""),
      String(x.unidade_encontrada_id || ""),
      x.sala_encontrada || "",
      x.codigo_evento || "",
      x.encontrado_em ? new Date(x.encontrado_em).toLocaleString("pt-BR") : "",
    ]);

    const buf = await generateTablePdf("RELATORIO DE FORASTEIROS (Art. 185 - AN303_Art185)", cols, rows);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"relatorio_forasteiros.pdf\"");
    res.send(buf);
  } catch (error) {
    next(error);
  }
});

async function applyBemOperacionalPatch(client, { bemId, payload, actorPerfilId }) {
  const id = String(bemId || "").trim();
  if (!UUID_RE.test(id)) throw new HttpError(422, "BEM_ID_INVALIDO", "id deve ser UUID.");
  const body = payload && typeof payload === "object" ? payload : {};
  const localFisico = body.localFisico != null ? String(body.localFisico).trim().slice(0, 180) : null;
  const localId = body.localId != null && String(body.localId).trim() !== "" ? String(body.localId).trim() : null;
  if (localId && !UUID_RE.test(localId)) throw new HttpError(422, "LOCAL_ID_INVALIDO", "localId deve ser UUID.");
  const fotoUrl = body.fotoUrl != null ? String(body.fotoUrl).trim().slice(0, 2000) : null;

  await setDbContext(client, { changeOrigin: "APP", currentUserId: actorPerfilId || null });
  const r = await client.query(
    `UPDATE bens
     SET local_fisico = COALESCE($2, local_fisico),
         local_id = $3,
         foto_url = COALESCE($4, foto_url),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id,
       numero_tombamento AS "numeroTombamento",
       local_fisico AS "localFisico",
       local_id AS "localId",
       foto_url AS "fotoUrl";`,
    [id, localFisico, localId, fotoUrl],
  );
  if (!r.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");
  return r.rows[0];
}

async function applyBemPatchSensivel(client, { bemId, patch, actorPerfilId }) {
  const id = String(bemId || "").trim();
  if (!UUID_RE.test(id)) throw new HttpError(422, "BEM_ID_INVALIDO", "id deve ser UUID.");
  const body = patch && typeof patch === "object" ? patch : {};

  const currentBem = await client.query(
    `SELECT unidade_dona_id AS "unidadeDonaId", status::text AS "status"
     FROM bens
     WHERE id = $1`,
    [id],
  );
  if (!currentBem.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");
  const currentRow = currentBem.rows[0];

  const fields = [];
  const params = [];
  let i = 1;

  if (Object.prototype.hasOwnProperty.call(body, "responsavelPerfilId")) {
    const raw = body.responsavelPerfilId != null ? String(body.responsavelPerfilId).trim() : "";
    const value = raw ? raw : null;
    if (value && !UUID_RE.test(value)) throw new HttpError(422, "RESPONSAVEL_INVALIDO", "responsavelPerfilId deve ser UUID ou null.");
    fields.push(`responsavel_perfil_id = $${i}`);
    params.push(value);
    i += 1;
  }

  if (Object.prototype.hasOwnProperty.call(body, "localFisico")) {
    fields.push(`local_fisico = $${i}`);
    params.push(body.localFisico != null ? String(body.localFisico).trim().slice(0, 180) : null);
    i += 1;
  }

  if (Object.prototype.hasOwnProperty.call(body, "localId")) {
    const raw = body.localId != null ? String(body.localId).trim() : "";
    const value = raw ? raw : null;
    if (value && !UUID_RE.test(value)) throw new HttpError(422, "LOCAL_ID_INVALIDO", "localId deve ser UUID ou null.");
    fields.push(`local_id = $${i}`);
    params.push(value);
    i += 1;
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    const status = String(body.status || "").trim().toUpperCase();
    const allowed = new Set(["OK", "EM_CAUTELA", "BAIXADO", "AGUARDANDO_RECEBIMENTO"]);
    if (!allowed.has(status)) throw new HttpError(422, "STATUS_INVALIDO", "status invalido.");
    if (status !== String(currentRow.status || "").trim().toUpperCase()) {
      throw new HttpError(
        422,
        "PROCEDIMENTO_OBRIGATORIO_STATUS",
        "Alteracao de status deve seguir o procedimento proprio (ex.: CAUTELA_SAIDA/CAUTELA_RETORNO em Movimentacoes).",
      );
    }
  }

  if (!fields.length) throw new HttpError(422, "PATCH_VAZIO", "Envie ao menos um campo sensivel para atualizar.");

  await setDbContext(client, { changeOrigin: "APP", currentUserId: actorPerfilId || null });
  const r = await client.query(
    `UPDATE bens
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${i}
     RETURNING id,
       numero_tombamento AS "numeroTombamento",
       unidade_dona_id AS "unidadeDonaId",
       responsavel_perfil_id AS "responsavelPerfilId",
       local_fisico AS "localFisico",
       local_id AS "localId",
       status::text AS "status",
       updated_at AS "updatedAt";`,
    [...params, id],
  );
  if (!r.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");
  return r.rows[0];
}

async function applyVincularLocalLote(client, { payload, actorPerfilId }) {
  const body = payload && typeof payload === "object" ? payload : {};
  const localId = body.localId != null ? String(body.localId).trim() : "";
  if (!UUID_RE.test(localId)) throw new HttpError(422, "LOCAL_ID_INVALIDO", "localId deve ser UUID.");

  const termo = body.termoLocalFisico != null ? String(body.termoLocalFisico).trim().slice(0, 180) : "";
  if (termo.length < 2) throw new HttpError(422, "TERMO_OBRIGATORIO", "termoLocalFisico deve ter pelo menos 2 caracteres.");

  const somenteSemLocalId = parseBool(body.somenteSemLocalId, true);
  const unidadeRaw = body.unidadeDonaId != null && String(body.unidadeDonaId).trim() !== ""
    ? Number(body.unidadeDonaId)
    : null;
  if (unidadeRaw != null && (!Number.isInteger(unidadeRaw) || !VALID_UNIDADES.has(unidadeRaw))) {
    throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeDonaId deve ser 1..4.");
  }

  const where = [
    "eh_bem_terceiro = FALSE",
    "local_fisico IS NOT NULL",
    "local_fisico <> ''",
    "local_fisico ILIKE $1",
  ];
  const params = [`%${termo}%`];
  let i = 2;

  if (somenteSemLocalId) where.push("local_id IS NULL");
  if (unidadeRaw != null) {
    where.push(`unidade_dona_id = $${i}`);
    params.push(unidadeRaw);
    i += 1;
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const preview = await client.query(
    `SELECT id, numero_tombamento AS "numeroTombamento", local_fisico AS "localFisico", local_id AS "localId"
     FROM bens
     ${whereSql}
     ORDER BY numero_tombamento NULLS LAST
     LIMIT 10;`,
    params,
  );
  const total = await client.query(`SELECT COUNT(*)::int AS total FROM bens ${whereSql};`, params);
  const totalAlvo = total.rows[0]?.total ?? 0;

  await setDbContext(client, { changeOrigin: "APP", currentUserId: actorPerfilId || null });
  const upd = await client.query(
    `UPDATE bens
     SET local_id = $${i}, updated_at = NOW()
     ${whereSql}
     RETURNING id;`,
    [...params, localId],
  );
  return {
    totalAlvo,
    atualizados: upd.rowCount,
    exemplo: preview.rows,
  };
}

async function applyMovimentacaoSolicitada(client, { payload, solicitantePerfilId, aprovadorPerfilId }) {
  const rawMov = payload?.movimentacao && typeof payload.movimentacao === "object"
    ? payload.movimentacao
    : payload;
  const mov = validateMov(rawMov || {}, {
    defaultPerfilId: solicitantePerfilId ? String(solicitantePerfilId).trim() : "",
  });
  if (solicitantePerfilId && UUID_RE.test(String(solicitantePerfilId))) {
    mov.executadaPorPerfilId = String(solicitantePerfilId);
  }
  if (aprovadorPerfilId && UUID_RE.test(String(aprovadorPerfilId))) {
    mov.autorizadaPorPerfilId = String(aprovadorPerfilId);
  } else if (!mov.autorizadaPorPerfilId && mov.executadaPorPerfilId) {
    mov.autorizadaPorPerfilId = mov.executadaPorPerfilId;
  }
  const bem = await lockBem(client, mov);
  if (!bem) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");
  const out = await executeMov(client, bem, mov);
  if (mov.origemRegularizacaoContagemId && out?.mov?.id) {
    await concluirRegularizacaoTransferencia(client, {
      contagemId: mov.origemRegularizacaoContagemId,
      movimentacaoId: out.mov.id,
      perfilId: aprovadorPerfilId || solicitantePerfilId || mov.executadaPorPerfilId || mov.autorizadaPorPerfilId || null,
      observacoes: "Regularizacao concluida apos aprovacao administrativa da transferencia formal.",
    });
  }
  return out;
}

async function applySolicitacaoByType(client, { solicitacao, aprovadorPerfilId }) {
  const payload = solicitacao?.payload && typeof solicitacao.payload === "object" ? solicitacao.payload : {};
  const tipoAcao = String(solicitacao?.tipoAcao || "").trim();

  if (tipoAcao === SOLICITACAO_TIPO_ACAO.BEM_PATCH_OPERACIONAL) {
    const bem = await applyBemOperacionalPatch(client, {
      bemId: payload.bemId || solicitacao.entidadeId,
      payload: payload.patch || {},
      actorPerfilId: aprovadorPerfilId,
    });
    return { tipoAcao, bem };
  }

  if (tipoAcao === SOLICITACAO_TIPO_ACAO.BEM_PATCH) {
    const bem = await applyBemPatchSensivel(client, {
      bemId: payload.bemId || solicitacao.entidadeId,
      patch: payload.patch || {},
      actorPerfilId: aprovadorPerfilId,
    });
    return { tipoAcao, bem };
  }

  if (tipoAcao === SOLICITACAO_TIPO_ACAO.BEM_VINCULAR_LOCAL_LOTE) {
    const lote = await applyVincularLocalLote(client, {
      payload: payload.patch || {},
      actorPerfilId: aprovadorPerfilId,
    });
    return { tipoAcao, lote };
  }

  if (tipoAcao === SOLICITACAO_TIPO_ACAO.MOVIMENTACAO) {
    const out = await applyMovimentacaoSolicitada(client, {
      payload,
      solicitantePerfilId: solicitacao?.solicitantePerfilId || null,
      aprovadorPerfilId,
    });
    return { tipoAcao, movimentacao: out.mov, bem: out.bem };
  }

  throw new HttpError(422, "SOLICITACAO_TIPO_INVALIDO", "Tipo de solicitacao nao suportado.");
}

/**
 * Atualiza localizacao e fotos de um bem (camada operacional melhorada).
 * Restrito a ADMIN (quando auth ativa).
 */
app.patch("/bens/:id/operacional", mustAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = String(req.params?.id || "").trim();
    const body = req.body || {};
    const payloadKeys = ["localFisico", "localId", "fotoUrl"].filter((k) => Object.prototype.hasOwnProperty.call(body, k));
    if (!payloadKeys.length) {
      throw new HttpError(422, "PATCH_VAZIO", "Envie ao menos um campo (localFisico/localId/fotoUrl).");
    }
    const canExecute = userHasPermission(req.user, "action.bem.editar_operacional.execute");
    const canRequest = userHasPermission(req.user, "action.bem.editar_operacional.request");
    if (!canExecute && !canRequest) {
      throw new HttpError(403, "SEM_PERMISSAO", "Voce nao tem permissao para alterar operacional do bem.");
    }
    if (canExecute) {
      await client.query("BEGIN");
      const bem = await applyBemOperacionalPatch(client, {
        bemId: id,
        payload: body,
        actorPerfilId: req.user?.id ? String(req.user.id).trim() : null,
      });
      await client.query("COMMIT");
      res.json({ requestId: req.requestId, bem });
      return;
    }

    const justificativaSolicitante = body?.justificativaSolicitante != null
      ? String(body.justificativaSolicitante).trim().slice(0, 2000)
      : "";
    if (!justificativaSolicitante) {
      throw new HttpError(422, "JUSTIFICATIVA_SOLICITANTE_OBRIGATORIA", "Informe justificativa para solicitar aprovacao.");
    }

    await client.query("BEGIN");
    const snap = await client.query(
      `SELECT id, numero_tombamento AS "numeroTombamento", local_fisico AS "localFisico", local_id AS "localId", foto_url AS "fotoUrl"
       FROM bens
       WHERE id = $1
       LIMIT 1;`,
      [id],
    );
    if (!snap.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");
    const solicitacao = await createSolicitacaoAprovacao(client, {
      tipoAcao: SOLICITACAO_TIPO_ACAO.BEM_PATCH_OPERACIONAL,
      entidadeTipo: "BEM",
      entidadeId: id,
      payload: {
        bemId: id,
        patch: body,
      },
      solicitantePerfilId: req.user?.id ? String(req.user.id) : null,
      justificativaSolicitante,
      snapshotBefore: snap.rows[0],
      expiraEm: nowPlusDays(15),
    });
    await client.query("COMMIT");
    res.status(202).json({
      requestId: req.requestId,
      status: "PENDENTE_APROVACAO",
      solicitacaoId: solicitacao.id,
      message: "Acao enviada para aprovacao administrativa.",
    });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

// Helper para deletar foto local
function deleteLocalFoto(relUrl) {
  if (!relUrl || !relUrl.startsWith("/fotos/")) return;
  try {
    const filePath = path.join(__dirname, "data", relUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[DELETE] Foto removida: ${filePath} `);
    }
  } catch (err) {
    console.error(`[DELETE ERROR] Falha ao remover ${relUrl}: `, err);
  }
}

/**
 * Atualiza dados do bem (admin) exceto chaves de identificacao.
 *
 * Regras:
 * - Nao permite alterar: id, numero_tombamento, identificador_externo, eh_bem_terceiro.
 * - Mudanca de carga (unidade_dona_id) segue regras legais: Art. 183 bloqueia durante EM_ANDAMENTO.
 */
app.patch("/bens/:id", mustAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "BEM_ID_INVALIDO", "id deve ser UUID.");

    const body = req.body || {};
    const bodyKeys = Object.keys(body).filter((k) => String(k) !== "justificativaSolicitante");
    if (!bodyKeys.length) throw new HttpError(422, "PATCH_VAZIO", "Envie ao menos um campo para atualizar.");
    if (Object.prototype.hasOwnProperty.call(body, "numeroTombamento") || Object.prototype.hasOwnProperty.call(body, "numero_tombamento")) {
      throw new HttpError(422, "CHAVE_IMUTAVEL", "numeroTombamento e imutavel.");
    }
    if (Object.prototype.hasOwnProperty.call(body, "identificadorExterno") || Object.prototype.hasOwnProperty.call(body, "identificador_externo")) {
      throw new HttpError(422, "CHAVE_IMUTAVEL", "identificadorExterno e imutavel.");
    }
    if (Object.prototype.hasOwnProperty.call(body, "ehBemTerceiro") || Object.prototype.hasOwnProperty.call(body, "eh_bem_terceiro")) {
      throw new HttpError(422, "CHAVE_IMUTAVEL", "ehBemTerceiro e imutavel.");
    }

    const aclNeeds = classifyBemPatchPermissions(body);
    const canExecute = aclNeeds.executePermissions.length
      ? aclNeeds.executePermissions.every((perm) => userHasPermission(req.user, perm))
      : userHasPermission(req.user, "action.bem.editar_operacional.execute");
    const canRequest = aclNeeds.requestPermissions.length
      ? aclNeeds.requestPermissions.every((perm) => userHasPermission(req.user, perm))
      : userHasPermission(req.user, "action.bem.editar_operacional.request");
    if (!canExecute && !canRequest) {
      throw new HttpError(403, "SEM_PERMISSAO", "Voce nao tem permissao para alterar este bem.");
    }

    if (!canExecute && canRequest) {
      if (aclNeeds.executePermissions.includes("action.bem.editar_operacional.execute")) {
        throw new HttpError(
          422,
          "SOLICITACAO_CAMPOS_NAO_SUPORTADOS",
          "Solicitacao de aprovacao para este conjunto de campos nao e suportada nesta versao.",
        );
      }
      const justificativaSolicitante = body?.justificativaSolicitante != null
        ? String(body.justificativaSolicitante).trim().slice(0, 2000)
        : "";
      if (!justificativaSolicitante) {
        throw new HttpError(422, "JUSTIFICATIVA_SOLICITANTE_OBRIGATORIA", "Informe justificativa para solicitar aprovacao.");
      }

      await client.query("BEGIN");
      const snap = await client.query(
        `SELECT id, numero_tombamento AS "numeroTombamento", status::text AS "status",
                responsavel_perfil_id AS "responsavelPerfilId", local_fisico AS "localFisico", local_id AS "localId"
         FROM bens
         WHERE id = $1
         LIMIT 1;`,
        [id],
      );
      if (!snap.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");

      const solicitacao = await createSolicitacaoAprovacao(client, {
        tipoAcao: SOLICITACAO_TIPO_ACAO.BEM_PATCH,
        entidadeTipo: "BEM",
        entidadeId: id,
        payload: { bemId: id, patch: body },
        solicitantePerfilId: req.user?.id ? String(req.user.id) : null,
        justificativaSolicitante,
        snapshotBefore: snap.rows[0],
        expiraEm: nowPlusDays(15),
      });
      await client.query("COMMIT");
      res.status(202).json({
        requestId: req.requestId,
        status: "PENDENTE_APROVACAO",
        solicitacaoId: solicitacao.id,
        message: "Acao enviada para aprovacao administrativa.",
      });
      return;
    }

    const currentBem = await client.query(
      `SELECT unidade_dona_id AS "unidadeDonaId", status::text AS "status"
       FROM bens
       WHERE id = $1`,
      [id],
    );
    if (!currentBem.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");
    const currentRow = currentBem.rows[0];

    const patch = {};

    if (Object.prototype.hasOwnProperty.call(body, "catalogoBemId")) {
      const catalogoBemId = body.catalogoBemId != null ? String(body.catalogoBemId).trim() : "";
      if (!UUID_RE.test(catalogoBemId)) throw new HttpError(422, "CATALOGO_ID_INVALIDO", "catalogoBemId deve ser UUID.");
      patch.catalogoBemId = catalogoBemId;
    }

    if (Object.prototype.hasOwnProperty.call(body, "descricaoComplementar")) {
      patch.descricaoComplementar = body.descricaoComplementar != null ? String(body.descricaoComplementar).trim().slice(0, 2000) : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "nomeResumo")) {
      patch.nomeResumo = sanitizeNomeResumo(body.nomeResumo);
    }

    if (Object.prototype.hasOwnProperty.call(body, "unidadeDonaId")) {
      const unidadeDonaId = body.unidadeDonaId != null && String(body.unidadeDonaId).trim() !== ""
        ? Number(body.unidadeDonaId)
        : null;
      if (unidadeDonaId == null || !Number.isInteger(unidadeDonaId) || !VALID_UNIDADES.has(unidadeDonaId)) {
        throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeDonaId deve ser 1..4.");
      }
      if (Number(unidadeDonaId) !== Number(currentRow.unidadeDonaId)) {
        throw new HttpError(
          422,
          "PROCEDIMENTO_OBRIGATORIO_TRANSFERENCIA",
          "Alteracao de unidade (carga) deve ser feita pelo procedimento de TRANSFERENCIA em Movimentacoes."
        );
      }
    }


    if (Object.prototype.hasOwnProperty.call(body, "responsavelPerfilId")) {
      const raw = body.responsavelPerfilId != null ? String(body.responsavelPerfilId).trim() : "";
      if (!raw) patch.responsavelPerfilId = null;
      else {
        if (!UUID_RE.test(raw)) throw new HttpError(422, "RESPONSAVEL_INVALIDO", "responsavelPerfilId deve ser UUID ou null.");
        patch.responsavelPerfilId = raw;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "localFisico")) {
      patch.localFisico = body.localFisico != null ? String(body.localFisico).trim().slice(0, 180) : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "localId")) {
      const raw = body.localId != null ? String(body.localId).trim() : "";
      if (!raw) patch.localId = null;
      else {
        if (!UUID_RE.test(raw)) throw new HttpError(422, "LOCAL_ID_INVALIDO", "localId deve ser UUID ou null.");
        patch.localId = raw;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      const status = String(body.status || "").trim().toUpperCase();
      const allowed = new Set(["OK", "EM_CAUTELA", "BAIXADO", "AGUARDANDO_RECEBIMENTO"]);
      if (!allowed.has(status)) throw new HttpError(422, "STATUS_INVALIDO", "status invalido.");
      if (status !== String(currentRow.status || "").trim().toUpperCase()) {
        throw new HttpError(
          422,
          "PROCEDIMENTO_OBRIGATORIO_STATUS",
          "Alteracao de status deve seguir o procedimento proprio (ex.: CAUTELA_SAIDA/CAUTELA_RETORNO em Movimentacoes)."
        );
      }
    }


    if (Object.prototype.hasOwnProperty.call(body, "tipoInservivel")) {
      const raw = body.tipoInservivel != null ? String(body.tipoInservivel).trim().toUpperCase() : "";
      if (!raw) patch.tipoInservivel = null;
      else {
        const allowed = new Set(["OCIOSO", "RECUPERAVEL", "ANTIECONOMICO", "IRRECUPERAVEL"]);
        if (!allowed.has(raw)) throw new HttpError(422, "TIPO_INVALIDO", "tipoInservivel invalido.");
        patch.tipoInservivel = raw;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "contratoReferencia")) {
      patch.contratoReferencia = body.contratoReferencia != null ? String(body.contratoReferencia).trim().slice(0, 140) : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "dataAquisicao")) {
      patch.dataAquisicao = parseDateOnly(body.dataAquisicao);
    }

    if (Object.prototype.hasOwnProperty.call(body, "valorAquisicao")) {
      const raw = body.valorAquisicao;
      if (raw == null || String(raw).trim() === "") patch.valorAquisicao = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) throw new HttpError(422, "VALOR_INVALIDO", "valorAquisicao deve ser >= 0.");
        patch.valorAquisicao = n;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "fotoUrl")) {
      patch.fotoUrl = body.fotoUrl != null ? String(body.fotoUrl).trim().slice(0, 2000) : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "observacoes")) {
      patch.observacoes = body.observacoes != null ? String(body.observacoes).trim().slice(0, 2000) : null;
    }

    const fields = [];
    const params = [];
    let i = 1;

    if (patch.catalogoBemId != null) {
      fields.push(`catalogo_bem_id = $${i} `);
      params.push(patch.catalogoBemId);
      i += 1;
    }
    if (patch.descricaoComplementar !== undefined) {
      fields.push(`descricao_complementar = $${i} `);
      params.push(patch.descricaoComplementar);
      i += 1;
    }
    if (patch.nomeResumo !== undefined) {
      fields.push(`nome_resumo = $${i} `);
      params.push(patch.nomeResumo);
      i += 1;
    }
    if (patch.responsavelPerfilId !== undefined) {
      fields.push(`responsavel_perfil_id = $${i} `);
      params.push(patch.responsavelPerfilId);
      i += 1;
    }
    if (patch.localFisico !== undefined) {
      fields.push(`local_fisico = $${i} `);
      params.push(patch.localFisico);
      i += 1;
    }
    if (patch.localId !== undefined) {
      fields.push(`local_id = $${i} `);
      params.push(patch.localId);
      i += 1;
    }
    if (patch.tipoInservivel !== undefined) {
      fields.push(`tipo_inservivel = $${i}:: public.tipo_inservivel`);
      params.push(patch.tipoInservivel);
      i += 1;
    }
    if (patch.contratoReferencia !== undefined) {
      fields.push(`contrato_referencia = $${i} `);
      params.push(patch.contratoReferencia);
      i += 1;
    }
    if (patch.dataAquisicao !== undefined) {
      fields.push(`data_aquisicao = $${i} `);
      params.push(patch.dataAquisicao);
      i += 1;
    }
    if (patch.valorAquisicao !== undefined) {
      fields.push(`valor_aquisicao = $${i} `);
      params.push(patch.valorAquisicao);
      i += 1;
    }
    if (patch.fotoUrl !== undefined) {
      fields.push(`foto_url = $${i} `);
      params.push(patch.fotoUrl);
      i += 1;

      // Se a foto mudou, deletar a antiga
      const currentFoto = await client.query("SELECT foto_url FROM bens WHERE id = $1", [id]);
      if (currentFoto.rows[0]?.foto_url && currentFoto.rows[0].foto_url !== patch.fotoUrl) {
        deleteLocalFoto(currentFoto.rows[0].foto_url);
      }
    }
    if (patch.observacoes !== undefined) {
      fields.push(`observacoes = $${i} `);
      params.push(patch.observacoes);
      i += 1;
    }

    if (!fields.length) throw new HttpError(422, "PATCH_VAZIO", "Envie ao menos um campo para atualizar.");

    await client.query("BEGIN");
    await setDbContext(client, { changeOrigin: "APP", currentUserId: req.user?.id ? String(req.user.id).trim() : null });

    const r = await client.query(
      `UPDATE bens
       SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING id,
      numero_tombamento AS "numeroTombamento",
        catalogo_bem_id AS "catalogoBemId",
          descricao_complementar AS "descricaoComplementar",
            unidade_dona_id AS "unidadeDonaId",
              responsavel_perfil_id AS "responsavelPerfilId",
                local_fisico AS "localFisico",
                  local_id AS "localId",
                    status::text AS "status",
                      tipo_inservivel::text AS "tipoInservivel",
                        contrato_referencia AS "contratoReferencia",
                          data_aquisicao AS "dataAquisicao",
                          valor_aquisicao AS "valorAquisicao",
                            observacoes AS "observacoes",
                              foto_url AS "fotoUrl",
                                updated_at AS "updatedAt"; `,
      [...params, id],
    );
    if (!r.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");

    await client.query("COMMIT");
    res.json({ requestId: req.requestId, bem: r.rows[0] });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

/**
 * Upload de foto para a VPS com otimizacao automatica (WebP, max 1200px).
 * Restrito a ADMIN.
 *
 * Regra operacional:
 * - O binario e salvo em ./data/fotos/{target}/{uuid}_{ts}.webp
 * - Apenas a URL relativa (/fotos/...) fica no banco.
 * - Otimiza automaticamente: converte para WebP, redimensiona para max 1200px.
 */
app.post("/fotos/upload", mustAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const target = String(body.target || "").trim().toUpperCase();
    const id = String(body.id || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(422, "ID_INVALIDO", "id deve ser UUID.");
    if (!["BEM", "CATALOGO"].includes(target)) throw new HttpError(422, "TARGET_INVALIDO", "target deve ser BEM ou CATALOGO.");

    const base64Data = String(body.base64Data || "").trim();
    if (!base64Data) throw new HttpError(422, "FOTO_OBRIGATORIA", "base64Data e obrigatorio.");
    if (base64Data.length > 16_000_000) throw new HttpError(413, "FOTO_GRANDE", "Foto grande demais (max ~12 MB).");

    // Decodifica base64 para Buffer
    const rawBuffer = Buffer.from(base64Data, "base64");

    // Otimiza com sharp: redimensiona para max 1200px no lado maior, converte para WebP
    const optimized = await sharp(rawBuffer)
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // Gera nome de arquivo unico
    const subdir = target.toLowerCase(); // "bem" ou "catalogo"
    const ts = Date.now();
    const slug = id.slice(0, 8);
    const fileName = `${slug}_${ts}.webp`;
    const relPath = `${subdir}/${fileName}`;
    const absPath = path.join(FOTOS_DIR, subdir, fileName);

    // Salva no disco
    fs.writeFileSync(absPath, optimized);

    const fotoUrl = `/fotos/${relPath}`;
    const sizeKb = Math.round(optimized.length / 1024);
    console.log(`[${req.requestId}] Foto salva: ${absPath} (${sizeKb} KB, original ${Math.round(rawBuffer.length / 1024)} KB)`);

    // Atualiza banco
    if (target === "BEM") {
      await client.query("BEGIN");
      await setDbContext(client, { changeOrigin: "APP", currentUserId: req.user?.id ? String(req.user.id).trim() : null });
      const r = await client.query(
        `UPDATE bens SET foto_url = $2, updated_at = NOW() WHERE id = $1
         RETURNING id, foto_url AS "fotoUrl", updated_at AS "updatedAt";`,
        [id, fotoUrl],
      );
      if (!r.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");
      await client.query("COMMIT");
      res.json({ requestId: req.requestId, fotoUrl, sizeKb, bem: r.rows[0] });
      return;
    }

    await client.query("BEGIN");
    await setDbContext(client, { changeOrigin: "APP", currentUserId: req.user?.id ? String(req.user.id).trim() : null });
    const r = await client.query(
      `UPDATE catalogo_bens SET foto_referencia_url = $2, updated_at = NOW() WHERE id = $1
       RETURNING id, foto_referencia_url AS "fotoReferenciaUrl", updated_at AS "updatedAt";`,
      [id, fotoUrl],
    );
    if (!r.rowCount) throw new HttpError(404, "CATALOGO_NAO_ENCONTRADO", "Catalogo nao encontrado.");
    await client.query("COMMIT");
    res.json({ requestId: req.requestId, fotoUrl, sizeKb, catalogo: r.rows[0] });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

// Compatibilidade: mantém rota antiga redirecionando para a nova
app.post("/drive/fotos/upload", mustAdmin, (req, res, next) => {
  req.url = "/fotos/upload";
  app.handle(req, res, next);
});

/**
 * Vincula (em lote) bens a um local cadastrado (bens.local_id) com base em filtro de local_fisico (texto do GEAFIN).
 * Restrito a ADMIN (quando auth ativa).
 *
 * Regra operacional:
 * - Ajuda a migrar do "texto livre do GEAFIN" (local_fisico) para "local padronizado" (local_id).
 * - Nao e regra legal; e melhoria operacional para inventario por sala.
 */
app.post("/bens/vincular-local", mustAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const dryRun = parseBool(body.dryRun, false);
    const canExecute = userHasPermission(req.user, "action.bem.vincular_local_lote.execute");
    const canRequest = userHasPermission(req.user, "action.bem.vincular_local_lote.request");
    if (!canExecute && !canRequest) {
      throw new HttpError(403, "SEM_PERMISSAO", "Voce nao tem permissao para vincular locais em lote.");
    }

    if (dryRun || canExecute) {
      await client.query("BEGIN");
      const result = await applyVincularLocalLote(client, {
        payload: body,
        actorPerfilId: req.user?.id ? String(req.user.id).trim() : null,
      });
      if (dryRun) {
        await safeRollback(client);
        res.json({
          requestId: req.requestId,
          dryRun: true,
          totalAlvo: result.totalAlvo,
          exemplo: result.exemplo,
        });
        return;
      }
      await client.query("COMMIT");
      res.json({
        requestId: req.requestId,
        dryRun: false,
        totalAlvo: result.totalAlvo,
        atualizados: result.atualizados || 0,
        exemplo: result.exemplo,
      });
      return;
    }

    const justificativaSolicitante = body?.justificativaSolicitante != null
      ? String(body.justificativaSolicitante).trim().slice(0, 2000)
      : "";
    if (!justificativaSolicitante) {
      throw new HttpError(422, "JUSTIFICATIVA_SOLICITANTE_OBRIGATORIA", "Informe justificativa para solicitar aprovacao.");
    }

    await client.query("BEGIN");
    const solicitacao = await createSolicitacaoAprovacao(client, {
      tipoAcao: SOLICITACAO_TIPO_ACAO.BEM_VINCULAR_LOCAL_LOTE,
      entidadeTipo: "BENS_LOTE",
      entidadeId: null,
      payload: { patch: body },
      solicitantePerfilId: req.user?.id ? String(req.user.id) : null,
      justificativaSolicitante,
      snapshotBefore: null,
      expiraEm: nowPlusDays(15),
    });
    await client.query("COMMIT");
    res.status(202).json({
      requestId: req.requestId,
      status: "PENDENTE_APROVACAO",
      solicitacaoId: solicitacao.id,
      message: "Acao enviada para aprovacao administrativa.",
    });
  } catch (error) {
    await safeRollback(client);
    next(error);
  } finally {
    client.release();
  }
});

/**
 * Atualiza foto de referencia do catalogo (SKU).
 * Restrito a ADMIN (quando auth ativa).
 */
app.patch("/catalogo-bens/:id/foto", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "CATALOGO_ID_INVALIDO", "id deve ser UUID.");

    const url = req.body?.fotoReferenciaUrl !== undefined ? req.body.fotoReferenciaUrl : req.body?.url;
    // Permite null/string vazia
    const finalUrl = url ? String(url).trim().slice(0, 2000) : null;

    // Se a foto mudou, deletar a antiga
    const currentFoto = await pool.query("SELECT foto_referencia_url FROM catalogo_bens WHERE id = $1", [id]);
    if (currentFoto.rows[0]?.foto_referencia_url && currentFoto.rows[0].foto_referencia_url !== finalUrl) {
      deleteLocalFoto(currentFoto.rows[0].foto_referencia_url);
    }

    const r = await pool.query(
      `UPDATE catalogo_bens
       SET foto_referencia_url = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, codigo_catalogo AS "codigoCatalogo", foto_referencia_url AS "fotoReferenciaUrl";`,
      [id, finalUrl],
    );
    if (!r.rowCount) throw new HttpError(404, "CATALOGO_NAO_ENCONTRADO", "Catalogo nao encontrado.");

    res.json({ requestId: req.requestId, catalogo: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get("/logs/erros-runtime", mustAdmin, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(300, parseIntOrDefault(req.query?.limit, 100)));
    const items = readRuntimeErrorLog(limit);
    res.json({ requestId: req.requestId, total: items.length, items });
  } catch (error) {
    next(error);
  }
});

app.get("/admin/backup/status", mustAdmin, async (req, res, next) => {
  try {
    const localDb = listLocalBackupFiles(BACKUP_LOCAL_DB_DIR, "db_");
    const localMedia = listLocalBackupFiles(BACKUP_LOCAL_MEDIA_DIR, "media_");
    const remoteDb = await listRemoteBackupFiles(BACKUP_REMOTE_DB_DIR);
    const remoteMedia = await listRemoteBackupFiles(BACKUP_REMOTE_MEDIA_DIR);
    const lastOps = readBackupOpsLog(Math.max(1, Math.min(50, parseIntOrDefault(req.query?.limitOps, 20))));

    const tools = {};
    for (const cmd of ["rclone", "pg_dump", "psql", "tar", "gzip"]) {
      const r = await runCommand("sh", ["-lc", `command -v ${cmd}`]);
      tools[cmd] = r.code === 0;
    }

    res.json({
      requestId: req.requestId,
      config: {
        remoteBase: BACKUP_REMOTE_BASE,
        keepDaysDefault: BACKUP_KEEP_DAYS_DEFAULT,
        mediaSource: BACKUP_MEDIA_SOURCE,
      },
      tools,
      local: { db: localDb, media: localMedia },
      remote: { db: remoteDb, media: remoteMedia },
      ops: lastOps,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/admin/backup/snapshot", mustAdmin, async (req, res, next) => {
  try {
    await ensureAdminPassword(req, req.body?.adminPassword);
    const keepDays = parseKeepDays(req.body?.keepDays, BACKUP_KEEP_DAYS_DEFAULT);
    const tag = sanitizeBackupTag(req.body?.tag, "pre-geafin");
    const startedAt = toBrasiliaIso();
    const result = await performBackupOperation({ scope: "all", keepDays, tag });
    const payload = {
      tsUtc: toBrasiliaIso(),
      requestId: req.requestId,
      userId: req.user?.id || null,
      action: "SNAPSHOT_PRE_GEAFIN",
      status: "OK",
      startedAt,
      finishedAt: toBrasiliaIso(),
      result,
    };
    appendBackupOpsLog(payload);
    res.json({ requestId: req.requestId, ok: true, action: "SNAPSHOT_PRE_GEAFIN", result });
  } catch (error) {
    appendBackupOpsLog({
      tsUtc: toBrasiliaIso(),
      requestId: req.requestId,
      userId: req.user?.id || null,
      action: "SNAPSHOT_PRE_GEAFIN",
      status: "ERRO",
      error: { code: error?.code || "FALHA", message: error?.message || "Falha ao executar snapshot." },
    });
    next(error);
  }
});

app.post("/admin/backup/manual", mustAdmin, async (req, res, next) => {
  try {
    await ensureAdminPassword(req, req.body?.adminPassword);
    const scopeRaw = String(req.body?.scope || "all").trim().toLowerCase();
    const scope = scopeRaw === "db" || scopeRaw === "media" || scopeRaw === "all" ? scopeRaw : null;
    if (!scope) throw new HttpError(422, "SCOPE_INVALIDO", "scope deve ser db, media ou all.");
    const keepDays = parseKeepDays(req.body?.keepDays, BACKUP_KEEP_DAYS_DEFAULT);
    const tag = sanitizeBackupTag(req.body?.tag, "manual");
    const startedAt = toBrasiliaIso();
    const result = await performBackupOperation({ scope, keepDays, tag });
    appendBackupOpsLog({
      tsUtc: toBrasiliaIso(),
      requestId: req.requestId,
      userId: req.user?.id || null,
      action: "BACKUP_MANUAL",
      status: "OK",
      startedAt,
      finishedAt: toBrasiliaIso(),
      result,
    });
    res.json({ requestId: req.requestId, ok: true, action: "BACKUP_MANUAL", result });
  } catch (error) {
    appendBackupOpsLog({
      tsUtc: toBrasiliaIso(),
      requestId: req.requestId,
      userId: req.user?.id || null,
      action: "BACKUP_MANUAL",
      status: "ERRO",
      error: { code: error?.code || "FALHA", message: error?.message || "Falha ao executar backup." },
    });
    next(error);
  }
});

app.post("/admin/backup/restore", mustAdmin, async (req, res, next) => {
  try {
    await ensureAdminPassword(req, req.body?.adminPassword);
    const confirmText = String(req.body?.confirmText || "").trim().toUpperCase();
    if (confirmText !== "RESTORE") {
      throw new HttpError(422, "CONFIRMACAO_RESTORE_INVALIDA", "Digite RESTORE para confirmar a operacao.");
    }
    const remoteFile = String(req.body?.remoteFile || "").trim();
    if (!remoteFile) throw new HttpError(422, "ARQUIVO_RESTORE_OBRIGATORIO", "Informe remoteFile para restore.");

    const keepDays = parseKeepDays(req.body?.keepDays, BACKUP_KEEP_DAYS_DEFAULT);
    const preRestore = await performBackupOperation({
      scope: "db",
      keepDays,
      tag: sanitizeBackupTag("pre-restore", "pre-restore"),
    });
    const restore = await performRestoreOperation({ remoteFile });
    const result = { preRestore, restore };
    appendBackupOpsLog({
      tsUtc: toBrasiliaIso(),
      requestId: req.requestId,
      userId: req.user?.id || null,
      action: "RESTORE_DB",
      status: "OK",
      result,
    });
    res.json({ requestId: req.requestId, ok: true, action: "RESTORE_DB", result });
  } catch (error) {
    appendBackupOpsLog({
      tsUtc: toBrasiliaIso(),
      requestId: req.requestId,
      userId: req.user?.id || null,
      action: "RESTORE_DB",
      status: "ERRO",
      error: { code: error?.code || "FALHA", message: error?.message || "Falha ao executar restore." },
    });
    next(error);
  }
});

app.use((error, req, res, _next) => {
  const logHandledError = (status, code, message) => {
    appendRuntimeErrorLog({
      tsUtc: toBrasiliaIso(),
      requestId: req.requestId || null,
      method: req.method || null,
      path: req.originalUrl || req.url || null,
      status,
      code,
      message,
    });
  };

  if (error instanceof multer.MulterError) {
    logHandledError(400, "UPLOAD_INVALIDO", "Falha no upload do arquivo.");
    res.status(400).json({ error: { code: "UPLOAD_INVALIDO", message: "Falha no upload do arquivo." }, requestId: req.requestId });
    return;
  }
  if (error instanceof HttpError) {
    logHandledError(error.status, error.code, error.message);
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details }, requestId: req.requestId });
    return;
  }
  // Erros comuns de "migracao pendente": ajudam o operador a corrigir sem precisar ler logs.
  if (error?.code === "42P01") {
    const msg = String(error?.message || "");
    if (msg.includes("relation \"locais\"") || msg.includes("relation \"public.locais\"")) {
      logHandledError(500, "MIGRACAO_PENDENTE_LOCAIS", "Tabela locais nao existe no banco.");
      res.status(500).json({
        error: {
          code: "MIGRACAO_PENDENTE_LOCAIS",
          message: "Tabela 'locais' nao existe no banco. Aplique a migration database/011_fotos_e_locais.sql no Supabase.",
        },
        requestId: req.requestId,
      });
      return;
    }
    if (msg.includes("relation \"geafin_import_arquivos\"") || msg.includes("relation \"public.geafin_import_arquivos\"")) {
      logHandledError(500, "MIGRACAO_PENDENTE_GEAFIN", "Tabelas de importacao GEAFIN nao existem no banco.");
      res.status(500).json({
        error: {
          code: "MIGRACAO_PENDENTE_GEAFIN",
          message: "Tabelas de importacao GEAFIN nao existem no banco. Aplique as migrations database/003_geafin_raw.sql e database/004_geafin_import_progress.sql no Supabase.",
        },
        requestId: req.requestId,
      });
      return;
    }
  }
  if (error?.code === "42703") {
    const msg = String(error?.message || "");
    if (msg.includes("column \"ativo\"") && msg.includes("locais")) {
      logHandledError(500, "MIGRACAO_PENDENTE_LOCAIS_ATIVO", "Coluna locais.ativo nao existe no banco.");
      res.status(500).json({
        error: {
          code: "MIGRACAO_PENDENTE_LOCAIS_ATIVO",
          message: "Coluna 'locais.ativo' nao existe no banco. Aplique a migration database/014_locais_crud_soft_delete.sql no Supabase.",
        },
        requestId: req.requestId,
      });
      return;
    }
  }
  if (error?.code === "23514") {
    logHandledError(422, "VIOLACAO_REGRA_NEGOCIO", "Violacao de regra de negocio.");
    res.status(422).json({ error: { code: "VIOLACAO_REGRA_NEGOCIO", message: "Violacao de regra de negocio." }, requestId: req.requestId });
    return;
  }
  if (error?.code === "23503") {
    logHandledError(422, "REFERENCIA_INVALIDA", "Violacao de referencia (FK).");
    res.status(422).json({
      error: {
        code: "REFERENCIA_INVALIDA",
        message: "Referencia invalida em campo relacionado (FK).",
      },
      requestId: req.requestId,
    });
    return;
  }
  if (error?.code === "22P02") {
    logHandledError(400, "FORMATO_INVALIDO", "Formato invalido em campo enviado.");
    res.status(400).json({ error: { code: "FORMATO_INVALIDO", message: "Formato invalido em campo enviado." }, requestId: req.requestId });
    return;
  }
  logHandledError(500, "ERRO_INTERNO", "Erro interno no servidor.");
  console.error(`[${req.requestId}]`, error);
  res.status(500).json({ error: { code: "ERRO_INTERNO", message: "Erro interno no servidor." }, requestId: req.requestId });
});

/**
 * Valida e normaliza payload de movimentacao.
 * @param {object} body Body JSON da requisicao.
 * @returns {object} Payload validado.
 */
function validateMov(body, opts) {
  const defaultPerfilId = opts?.defaultPerfilId ? String(opts.defaultPerfilId).trim() : "";
  const defaultPerfilIdFinal = defaultPerfilId && UUID_RE.test(defaultPerfilId) ? defaultPerfilId : "";
  const tipoRaw = body.tipoMovimentacao ?? body.tipo;
  const tipoMovimentacaoRaw = String(tipoRaw || "").trim().toUpperCase();
  const tipoMovimentacao = tipoMovimentacaoRaw === "CAUTELA" ? "CAUTELA_SAIDA" : tipoMovimentacaoRaw;
  if (!VALID_MOV.has(tipoMovimentacao)) {
    throw new HttpError(422, "TIPO_MOVIMENTACAO_INVALIDO", "tipoMovimentacao deve ser TRANSFERENCIA, CAUTELA_SAIDA ou CAUTELA_RETORNO.");
  }

  const bemId = body.bemId ? String(body.bemId).trim() : null;
  const numeroTombamento = normalizeTombamento(body.numeroTombamento);
  if (!bemId && !numeroTombamento) {
    throw new HttpError(422, "IDENTIFICADOR_BEM_OBRIGATORIO", "Informe bemId ou numeroTombamento.");
  }
  if (bemId && !UUID_RE.test(bemId)) throw new HttpError(422, "BEM_ID_INVALIDO", "bemId deve ser UUID valido.");
  if (numeroTombamento && !TOMBAMENTO_GEAFIN_RE.test(numeroTombamento)) {
    throw new HttpError(
      422,
      "TOMBAMENTO_INVALIDO",
      "numeroTombamento deve seguir o padrao GEAFIN com 10 digitos numericos (ex.: 1290001788).",
    );
  }

  const termoReferencia = String(body.termoReferencia || "").trim();
  if (!termoReferencia) throw new HttpError(422, "TERMO_OBRIGATORIO", "termoReferencia e obrigatorio.");

  const unidadeDestinoId = parseUnit(body.unidadeDestinoId, null);
  const detentorTemporarioPerfilId = body.detentorTemporarioPerfilId ? String(body.detentorTemporarioPerfilId).trim() : null;
  const cautelaSalaDestino = body.cautelaSalaDestino ? String(body.cautelaSalaDestino).trim().slice(0, 180) : null;
  const cautelaExterno = parseBool(body.cautelaExterno, false);
  let autorizadaPorPerfilId = body.autorizadaPorPerfilId ? String(body.autorizadaPorPerfilId).trim() : null;
  let executadaPorPerfilId = body.executadaPorPerfilId ? String(body.executadaPorPerfilId).trim() : null;
  const dataPrevistaDevolucao = parseDateOnly(body.dataPrevistaDevolucao);
  const dataEfetivaDevolucao = parseDateTime(body.dataEfetivaDevolucao) || new Date();
  const manterResponsavelNoRetorno = parseBool(body.manterResponsavelNoRetorno, true);
  const justificativa = body.justificativa ? String(body.justificativa).trim() : null;
  const origemRegularizacaoContagemId = normalizeOrigemRegularizacaoContagemId(body.origemRegularizacaoContagemId);

  if (!executadaPorPerfilId && defaultPerfilIdFinal) executadaPorPerfilId = defaultPerfilIdFinal;
  if (!autorizadaPorPerfilId && defaultPerfilIdFinal) autorizadaPorPerfilId = defaultPerfilIdFinal;

  if (detentorTemporarioPerfilId && !UUID_RE.test(detentorTemporarioPerfilId)) throw new HttpError(422, "DETENTOR_INVALIDO", "detentorTemporarioPerfilId deve ser UUID.");
  if (autorizadaPorPerfilId && !UUID_RE.test(autorizadaPorPerfilId)) throw new HttpError(422, "AUTORIZADOR_INVALIDO", "autorizadaPorPerfilId deve ser UUID.");
  if (executadaPorPerfilId && !UUID_RE.test(executadaPorPerfilId)) throw new HttpError(422, "EXECUTOR_INVALIDO", "executadaPorPerfilId deve ser UUID.");

  if (tipoMovimentacao === "TRANSFERENCIA") {
    if (!autorizadaPorPerfilId) throw new HttpError(422, "AUTORIZACAO_OBRIGATORIA", "autorizadaPorPerfilId e obrigatorio para TRANSFERENCIA.");
    if (!unidadeDestinoId || !VALID_UNIDADES.has(unidadeDestinoId)) throw new HttpError(422, "UNIDADE_DESTINO_INVALIDA", "unidadeDestinoId valido (1..4) e obrigatorio.");
  }
  if (tipoMovimentacao === "CAUTELA_SAIDA") {
    if (!autorizadaPorPerfilId) throw new HttpError(422, "AUTORIZACAO_OBRIGATORIA", "autorizadaPorPerfilId e obrigatorio para CAUTELA_SAIDA.");
    if (!detentorTemporarioPerfilId) throw new HttpError(422, "DETENTOR_OBRIGATORIO", "detentorTemporarioPerfilId e obrigatorio para CAUTELA_SAIDA.");
    if (!cautelaSalaDestino && !cautelaExterno) {
      throw new HttpError(422, "LOCAL_CAUTELA_OBRIGATORIO", "Informe cautelaSalaDestino ou marque cautelaExterno para CAUTELA_SAIDA.");
    }
  }

  return {
    tipoMovimentacao,
    bemId,
    numeroTombamento,
    termoReferencia,
    unidadeDestinoId,
    detentorTemporarioPerfilId,
    cautelaSalaDestino,
    cautelaExterno,
    dataPrevistaDevolucao,
    dataEfetivaDevolucao,
    manterResponsavelNoRetorno,
    autorizadaPorPerfilId,
    executadaPorPerfilId,
    justificativa,
    origemRegularizacaoContagemId,
  };
}

/**
 * Valida query de listagem/consulta de bens.
 * @param {object} query Query string bruta do Express.
 * @returns {{numeroTombamento: string|null, tipoBusca: ("antigo"|"novo"|null), texto: string|null, codigoCatalogo: string|null, localFisico: string|null, localId: string|null, unidadeDonaId: number|null, status: string|null, responsavelPerfilId: string|null, responsavelTexto: string|null, limit: number, offset: number, incluirTerceiros: boolean}} Filtros validados.
 */
function validateBensQuery(query) {
  const numeroTombamento = normalizeTombamento(query.numeroTombamento || query.tombamento);

  const tipoBuscaRaw = query.tipoBusca != null ? String(query.tipoBusca).trim().toLowerCase() : "";
  const tipoBusca = tipoBuscaRaw
    ? (tipoBuscaRaw === "antigo" || tipoBuscaRaw === "novo" ? tipoBuscaRaw : null)
    : null;

  if (tipoBuscaRaw && !tipoBusca) {
    throw new HttpError(422, "TIPO_BUSCA_INVALIDO", "tipoBusca deve ser 'antigo' ou 'novo'.");
  }
  if (tipoBusca && !numeroTombamento) {
    throw new HttpError(422, "TOMBAMENTO_OBRIGATORIO", "Informe numeroTombamento ao usar tipoBusca.");
  }

  if (numeroTombamento) {
    const isGeafin = TOMBAMENTO_GEAFIN_RE.test(numeroTombamento);
    const isLegacy = TOMBAMENTO_LEGADO_RE.test(numeroTombamento);
    if (!isGeafin && !isLegacy) {
      throw new HttpError(
        422,
        "TOMBAMENTO_INVALIDO",
        "numeroTombamento deve ter 10 digitos (GEAFIN) ou 4 digitos para busca assistida.",
      );
    }
    if (isLegacy && !tipoBusca) {
      throw new HttpError(
        422,
        "TIPO_BUSCA_OBRIGATORIO",
        "Para codigo de 4 digitos, informe tipoBusca='antigo' (etiqueta azul) ou tipoBusca='novo' (sufixo da etiqueta nova).",
      );
    }
    if (isGeafin && tipoBusca) {
      throw new HttpError(422, "TIPO_BUSCA_DESNECESSARIO", "tipoBusca so pode ser usado com codigo de 4 digitos.");
    }
  }

  const texto = query.q ? String(query.q).trim() : null;
  const textoFinal = texto && texto.length ? texto.slice(0, 120) : null;

  const codigoCatalogoRaw = query.codigoCatalogo || query.codigo_catalogo || query.catalogo || null;
  const codigoCatalogo = codigoCatalogoRaw != null && String(codigoCatalogoRaw).trim() !== ""
    ? String(codigoCatalogoRaw).trim().slice(0, 120)
    : null;

  const localFisicoRaw = query.localFisico || query.local_fisico || query.sala || null;
  const localFisico = localFisicoRaw != null && String(localFisicoRaw).trim() !== ""
    ? String(localFisicoRaw).trim().slice(0, 180)
    : null;

  const localIdRaw = query.localId || query.local_id || null;
  const localId = localIdRaw != null && String(localIdRaw).trim() !== "" ? String(localIdRaw).trim() : null;
  if (localId && !UUID_RE.test(localId)) {
    throw new HttpError(422, "LOCAL_ID_INVALIDO", "localId deve ser UUID.");
  }

  const unidadeRaw = query.unidadeDonaId || query.unidadeId || null;
  const unidadeDonaId = unidadeRaw != null && String(unidadeRaw).trim() !== "" ? parseUnit(unidadeRaw, null) : null;
  if (unidadeRaw != null && String(unidadeRaw).trim() !== "" && (!unidadeDonaId || !VALID_UNIDADES.has(unidadeDonaId))) {
    throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeDonaId deve ser 1..4.");
  }

  const status = query.status ? String(query.status).trim().toUpperCase() : null;
  if (status && !VALID_STATUS_BEM.has(status)) {
    throw new HttpError(422, "STATUS_INVALIDO", `status deve ser: ${Array.from(VALID_STATUS_BEM).join(", ")}.`);
  }
  const responsavelPerfilIdRaw = query.responsavelPerfilId || query.responsavel_perfil_id || null;
  const responsavelPerfilId =
    responsavelPerfilIdRaw != null && String(responsavelPerfilIdRaw).trim() !== ""
      ? String(responsavelPerfilIdRaw).trim()
      : null;
  if (responsavelPerfilId && !UUID_RE.test(responsavelPerfilId)) {
    throw new HttpError(422, "RESPONSAVEL_ID_INVALIDO", "responsavelPerfilId deve ser UUID.");
  }
  const responsavelTextoRaw = query.responsavel || query.responsavelTexto || null;
  const responsavelTexto =
    responsavelTextoRaw != null && String(responsavelTextoRaw).trim() !== ""
      ? String(responsavelTextoRaw).trim().slice(0, 120)
      : null;

  const limit = parseIntOrDefault(query.limit, 50);
  if (limit < 1 || limit > 5000) throw new HttpError(422, "LIMIT_INVALIDO", "limit deve estar entre 1 e 5000.");
  const offset = parseIntOrDefault(query.offset, 0);
  if (offset < 0) throw new HttpError(422, "OFFSET_INVALIDO", "offset deve ser >= 0.");

  const incluirTerceiros = parseBool(query.incluirTerceiros, false);

  return {
    numeroTombamento,
    tipoBusca,
    texto: textoFinal,
    codigoCatalogo,
    localFisico,
    localId,
    unidadeDonaId,
    status,
    responsavelPerfilId,
    responsavelTexto,
    limit,
    offset,
    incluirTerceiros,
  };
}

/**
 * Valida payload de criacao de perfil.
 * @param {object} body Body JSON da requisicao.
 * @returns {{matricula: string, nome: string, email: string|null, unidadeId: number, cargo: string|null, role: string, ativo: boolean, senha: (string|null)}} Perfil validado.
 */
function validatePerfil(body) {
  const matricula = String(body.matricula || "").trim();
  if (!matricula) throw new HttpError(422, "MATRICULA_OBRIGATORIA", "matricula e obrigatoria.");
  if (matricula.length > 30) throw new HttpError(422, "MATRICULA_TAMANHO", "matricula excede 30 caracteres.");

  const nome = String(body.nome || "").trim();
  if (!nome) throw new HttpError(422, "NOME_OBRIGATORIO", "nome e obrigatorio.");
  if (nome.length > 160) throw new HttpError(422, "NOME_TAMANHO", "nome excede 160 caracteres.");

  const emailRaw = body.email != null ? String(body.email).trim() : "";
  const email = emailRaw ? emailRaw.slice(0, 255) : null;

  const unidadeId = parseUnit(body.unidadeId, null);
  if (!unidadeId || !VALID_UNIDADES.has(unidadeId)) {
    throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeId deve ser 1..4.");
  }

  const cargoRaw = body.cargo != null ? String(body.cargo).trim() : "";
  const cargo = cargoRaw ? cargoRaw.slice(0, 120) : null;

  const roleRaw = body.role != null ? String(body.role).trim().toUpperCase() : "OPERADOR";
  const role = VALID_ROLES.has(roleRaw) ? roleRaw : null;
  if (!role) throw new HttpError(422, "ROLE_INVALIDO", "role deve ser ADMIN ou OPERADOR.");

  let ativo = true;
  if (Object.prototype.hasOwnProperty.call(body, "ativo")) {
    const rawAtivo = body.ativo;
    ativo = typeof rawAtivo === "boolean" ? rawAtivo : parseBool(rawAtivo, true);
  }

  const senhaRaw = body.senha != null ? String(body.senha) : "";
  const senha = senhaRaw ? senhaRaw : null;
  if (senha && senha.length < 8) throw new HttpError(422, "SENHA_FRACA", "Senha deve ter pelo menos 8 caracteres.");

  return { matricula, nome, email, unidadeId, cargo, role, ativo, senha };
}

/**
 * Valida payload de atualizacao parcial de perfil.
 * @param {object} body Body JSON (PATCH).
 * @returns {{nome?: string, email?: (string|null), unidadeId?: number, cargo?: (string|null), role?: string, ativo?: boolean}} Campos validados.
 */
function validatePerfilPatch(body) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(body, "nome")) {
    const nome = String(body.nome || "").trim();
    if (!nome) throw new HttpError(422, "NOME_OBRIGATORIO", "nome e obrigatorio.");
    if (nome.length > 160) throw new HttpError(422, "NOME_TAMANHO", "nome excede 160 caracteres.");
    patch.nome = nome;
  }

  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    const emailRaw = body.email != null ? String(body.email).trim() : "";
    patch.email = emailRaw ? emailRaw.slice(0, 255) : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "unidadeId")) {
    const unidadeId = parseUnit(body.unidadeId, null);
    if (!unidadeId || !VALID_UNIDADES.has(unidadeId)) {
      throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeId deve ser 1..4.");
    }
    patch.unidadeId = unidadeId;
  }

  if (Object.prototype.hasOwnProperty.call(body, "cargo")) {
    const cargoRaw = body.cargo != null ? String(body.cargo).trim() : "";
    patch.cargo = cargoRaw ? cargoRaw.slice(0, 120) : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "role")) {
    const roleRaw = body.role != null ? String(body.role).trim().toUpperCase() : "";
    const role = VALID_ROLES.has(roleRaw) ? roleRaw : null;
    if (!role) throw new HttpError(422, "ROLE_INVALIDO", "role deve ser ADMIN ou OPERADOR.");
    patch.role = role;
  }

  if (Object.prototype.hasOwnProperty.call(body, "ativo")) {
    const raw = body.ativo;
    if (typeof raw === "boolean") {
      patch.ativo = raw;
    } else {
      patch.ativo = parseBool(raw, false);
    }
  }

  return patch;
}

function parseIntOrDefault(raw, fallback) {
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  return n;
}

function parseBool(raw, fallback) {
  if (raw == null) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (v === "1" || v === "true" || v === "sim" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "nao" || v === "no") return false;
  return fallback;
}

function normalizeLatinForSearch(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function uniqStrings(input) {
  return Array.from(new Set((Array.isArray(input) ? input : []).map((x) => String(x || "").trim()).filter(Boolean)));
}

function nowPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString();
}

function toSafeJson(value) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return null;
  }
}

function normalizeOrigemRegularizacaoContagemId(raw) {
  const id = raw != null ? String(raw).trim() : "";
  return id && UUID_RE.test(id) ? id : null;
}

function extractOrigemFromSolicitacaoPayload(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  return normalizeOrigemRegularizacaoContagemId(
    p?.movimentacao?.origemRegularizacaoContagemId
    || p?.origemRegularizacaoContagemId
    || null,
  );
}

async function upsertRegularizacaoTransferenciaFluxo(client, {
  contagemId,
  statusFluxo,
  perfilId,
  solicitacaoAprovacaoId = null,
  movimentacaoId = null,
  observacoes = null,
  ultimoErro = null,
}) {
  const contagemQ = await client.query(
    `SELECT id, bem_id
     FROM contagens
     WHERE id = $1
     LIMIT 1;`,
    [contagemId],
  );
  if (!contagemQ.rowCount) return false;
  const contagem = contagemQ.rows[0];
  const perfilFinal = perfilId && UUID_RE.test(String(perfilId)) ? String(perfilId) : null;
  if (!perfilFinal) return false;

  await client.query(
    `INSERT INTO inventario_regularizacao_transferencias (
       contagem_id, bem_id, status_fluxo, solicitacao_aprovacao_id, movimentacao_id,
       encaminhado_por_perfil_id, encaminhado_em, atualizado_em, observacoes, ultimo_erro
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, $8)
     ON CONFLICT (contagem_id) DO UPDATE
     SET status_fluxo = EXCLUDED.status_fluxo,
         solicitacao_aprovacao_id = EXCLUDED.solicitacao_aprovacao_id,
         movimentacao_id = EXCLUDED.movimentacao_id,
         observacoes = EXCLUDED.observacoes,
         ultimo_erro = EXCLUDED.ultimo_erro,
         atualizado_em = NOW();`,
    [
      contagemId,
      contagem.bem_id,
      statusFluxo,
      solicitacaoAprovacaoId,
      movimentacaoId,
      perfilFinal,
      observacoes,
      ultimoErro,
    ],
  );
  return true;
}

async function concluirRegularizacaoTransferencia(client, {
  contagemId,
  movimentacaoId,
  perfilId,
  observacoes = null,
}) {
  const c = await client.query(
    `SELECT
       c.id,
       c.bem_id,
       c.regularizacao_pendente,
       c.tipo_ocorrencia::text AS tipo_ocorrencia,
       ei.status::text AS status_evento
     FROM contagens c
     JOIN eventos_inventario ei ON ei.id = c.evento_inventario_id
     WHERE c.id = $1
     FOR UPDATE OF c;`,
    [contagemId],
  );
  if (!c.rowCount) return false;
  const row = c.rows[0];
  if (row.tipo_ocorrencia !== "ENCONTRADO_EM_LOCAL_DIVERGENTE") return false;
  if (row.status_evento !== "ENCERRADO") return false;

  const m = await client.query(
    `SELECT id, bem_id
     FROM movimentacoes
     WHERE id = $1
     LIMIT 1;`,
    [movimentacaoId],
  );
  if (!m.rowCount) return false;
  if (String(m.rows[0].bem_id) !== String(row.bem_id)) return false;

  const perfilFinal = perfilId && UUID_RE.test(String(perfilId)) ? String(perfilId) : null;
  if (!perfilFinal) return false;

  await client.query(
    `UPDATE contagens
     SET regularizacao_pendente = FALSE,
         regularizado_em = NOW(),
         regularizado_por_perfil_id = $2,
         regularizacao_acao = 'TRANSFERIR_CARGA',
         regularizacao_movimentacao_id = $3,
         regularizacao_observacoes = $4,
         updated_at = NOW()
     WHERE id = $1
       AND regularizacao_pendente = TRUE;`,
    [contagemId, perfilFinal, movimentacaoId, observacoes],
  );

  await upsertRegularizacaoTransferenciaFluxo(client, {
    contagemId,
    statusFluxo: "CONCLUIDA",
    perfilId: perfilFinal,
    solicitacaoAprovacaoId: null,
    movimentacaoId,
    observacoes,
    ultimoErro: null,
  });
  return true;
}

async function addSolicitacaoEvento(client, { solicitacaoId, status, perfilId, observacao, payload }) {
  await client.query(
    `INSERT INTO solicitacoes_aprovacao_eventos
     (solicitacao_id, status, perfil_id, observacao, payload)
     VALUES ($1, $2::public.status_solicitacao_aprovacao, $3, $4, $5::jsonb);`,
    [
      solicitacaoId,
      status,
      perfilId || null,
      observacao || null,
      JSON.stringify(toSafeJson(payload) || {}),
    ],
  );
}

async function createSolicitacaoAprovacao(client, {
  tipoAcao,
  entidadeTipo,
  entidadeId,
  payload,
  solicitantePerfilId,
  justificativaSolicitante,
  snapshotBefore,
  expiraEm,
}) {
  const r = await client.query(
    `INSERT INTO solicitacoes_aprovacao
     (tipo_acao, entidade_tipo, entidade_id, payload, status, solicitante_perfil_id, justificativa_solicitante, snapshot_before, expira_em)
     VALUES ($1, $2, $3, $4::jsonb, 'PENDENTE', $5, $6, $7::jsonb, $8)
     RETURNING
       id,
       tipo_acao AS "tipoAcao",
       entidade_tipo AS "entidadeTipo",
       entidade_id AS "entidadeId",
       status::text AS status,
       solicitante_perfil_id AS "solicitantePerfilId",
       created_at AS "createdAt";`,
    [
      String(tipoAcao || "").trim(),
      String(entidadeTipo || "").trim(),
      entidadeId || null,
      JSON.stringify(toSafeJson(payload) || {}),
      solicitantePerfilId,
      justificativaSolicitante || null,
      JSON.stringify(toSafeJson(snapshotBefore) || {}),
      expiraEm || null,
    ],
  );

  const solicitacao = r.rows[0];
  await addSolicitacaoEvento(client, {
    solicitacaoId: solicitacao.id,
    status: SOLICITACAO_STATUS.PENDENTE,
    perfilId: solicitantePerfilId,
    observacao: "Solicitacao criada.",
    payload: payload || {},
  });
  return solicitacao;
}

function classifyBemPatchPermissions(body) {
  const b = body && typeof body === "object" ? body : {};
  const exec = [];
  const req = [];

  const hasLocalizacao = Object.prototype.hasOwnProperty.call(b, "localFisico")
    || Object.prototype.hasOwnProperty.call(b, "localId");
  const hasResponsavel = Object.prototype.hasOwnProperty.call(b, "responsavelPerfilId");
  const hasStatus = Object.prototype.hasOwnProperty.call(b, "status");

  if (hasLocalizacao) {
    exec.push("action.bem.alterar_localizacao.execute");
    req.push("action.bem.alterar_localizacao.request");
  }
  if (hasResponsavel) {
    exec.push("action.bem.alterar_responsavel.execute");
    req.push("action.bem.alterar_responsavel.request");
  }
  if (hasStatus) {
    exec.push("action.bem.alterar_status.execute");
    req.push("action.bem.alterar_status.request");
  }

  const hasGenericEdit = Object.keys(b).some((k) =>
    !["localFisico", "localId", "responsavelPerfilId", "status", "justificativaSolicitante"].includes(String(k)),
  );
  if (hasGenericEdit) {
    exec.push("action.bem.editar_operacional.execute");
    req.push("action.bem.editar_operacional.request");
  }

  return { executePermissions: uniqStrings(exec), requestPermissions: uniqStrings(req) };
}

function classifyMovPermissions(payload) {
  const tipo = String(payload?.tipoMovimentacao || "").trim().toUpperCase();
  const exec = [];
  const req = [];

  if (tipo === "TRANSFERENCIA") {
    exec.push("action.bem.alterar_responsavel.execute");
    req.push("action.bem.alterar_responsavel.request");
    return { executePermissions: uniqStrings(exec), requestPermissions: uniqStrings(req) };
  }

  if (tipo === "CAUTELA_SAIDA") {
    exec.push("action.bem.alterar_status.execute", "action.bem.alterar_responsavel.execute");
    req.push("action.bem.alterar_status.request", "action.bem.alterar_responsavel.request");
    return { executePermissions: uniqStrings(exec), requestPermissions: uniqStrings(req) };
  }

  if (tipo === "CAUTELA_RETORNO") {
    exec.push("action.bem.alterar_status.execute");
    req.push("action.bem.alterar_status.request");
    if (!payload?.manterResponsavelNoRetorno) {
      exec.push("action.bem.alterar_responsavel.execute");
      req.push("action.bem.alterar_responsavel.request");
    }
    return { executePermissions: uniqStrings(exec), requestPermissions: uniqStrings(req) };
  }

  return { executePermissions: [], requestPermissions: [] };
}

function ensureAnyPermissionOrThrow(user, permissions, modeLabel) {
  const list = uniqStrings(permissions);
  if (!list.length) throw new HttpError(403, "SEM_PERMISSAO", "Permissoes nao configuradas para a acao.");
  if (list.every((perm) => !userHasPermission(user, perm))) {
    throw new HttpError(403, "SEM_PERMISSAO", `Voce nao tem permissao (${modeLabel}) para executar esta acao.`);
  }
}

/**
 * Executa a movimentacao de forma transacional e distinguindo cautela de transferencia.
 * @param {import('pg').PoolClient} client Cliente transacional.
 * @param {object} bem Bem atual bloqueado com FOR UPDATE.
 * @param {object} p Payload validado.
 * @returns {Promise<{mov: object, bem: object}>} Registro de movimentacao e estado final do bem.
 */
async function executeMov(client, bem, p) {
  let bemAtualizado;
  const createdAt = new Date();
  if (p.tipoMovimentacao === "TRANSFERENCIA") {
    if (bem.eh_bem_terceiro) throw new HttpError(422, "TRANSFERENCIA_PROIBIDA_BEM_TERCEIRO", "Bens de terceiros nao podem sofrer transferencia de titularidade.");
    if (p.unidadeDestinoId === bem.unidade_dona_id) throw new HttpError(422, "UNIDADE_DESTINO_IGUAL_ORIGEM", "unidadeDestinoId deve ser diferente da unidade atual.");

    // Regra legal: Transferencia muda carga e exige formalizacao.
    // Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
    const q = await client.query(
      `UPDATE bens SET unidade_dona_id = $1, status = 'OK', updated_at = NOW()
       WHERE id = $2
       RETURNING id, numero_tombamento, unidade_dona_id, status`,
      [p.unidadeDestinoId, bem.id],
    );
    bemAtualizado = q.rows[0];
  } else if (p.tipoMovimentacao === "CAUTELA_SAIDA") {
    // Regra legal: Cautela nao altera carga, apenas detencao temporaria.
    // Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
    const q = await client.query(
      `UPDATE bens
       SET status = 'EM_CAUTELA',
           responsavel_perfil_id = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, numero_tombamento, unidade_dona_id, status`,
      [bem.id, p.detentorTemporarioPerfilId || null],
    );
    bemAtualizado = q.rows[0];
  } else {
    if (bem.status !== "EM_CAUTELA") throw new HttpError(422, "RETORNO_INVALIDO", "CAUTELA_RETORNO exige bem em EM_CAUTELA.");
    const q = p.manterResponsavelNoRetorno
      ? await client.query(
        `UPDATE bens
         SET status = 'OK', updated_at = NOW()
         WHERE id = $1
         RETURNING id, numero_tombamento, unidade_dona_id, status`,
        [bem.id],
      )
      : await client.query(
        `UPDATE bens
         SET status = 'OK',
             responsavel_perfil_id = NULL,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, numero_tombamento, unidade_dona_id, status`,
        [bem.id],
      );
    bemAtualizado = q.rows[0];
  }

  const justificativaFinal = buildMovJustificativa(p);
  const r = await client.query(
    `INSERT INTO movimentacoes (
      bem_id, tipo_movimentacao, status, unidade_origem_id, unidade_destino_id,
      detentor_temporario_perfil_id, data_prevista_devolucao, data_efetiva_devolucao,
      termo_referencia, justificativa, autorizada_por_perfil_id, autorizada_em,
      executada_por_perfil_id, executada_em
    ) VALUES (
      $1,$2,'EXECUTADA',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
    )
    RETURNING *`,
    [
      bem.id,
      p.tipoMovimentacao,
      bem.unidade_dona_id,
      p.tipoMovimentacao === "TRANSFERENCIA" ? p.unidadeDestinoId : null,
      p.tipoMovimentacao === "CAUTELA_SAIDA" ? p.detentorTemporarioPerfilId : null,
      p.tipoMovimentacao === "CAUTELA_SAIDA" ? p.dataPrevistaDevolucao : null,
      p.tipoMovimentacao === "CAUTELA_RETORNO" ? p.dataEfetivaDevolucao : null,
      p.termoReferencia,
      justificativaFinal,
      p.autorizadaPorPerfilId,
      p.autorizadaPorPerfilId ? createdAt : null,
      p.executadaPorPerfilId,
      createdAt,
    ],
  );

  // Evidencia documental (metadados) - cria placeholder sem drive_url.
  // Regra legal: transferencia/cautela exigem formalizacao e rastreabilidade.
  // Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
  const mov = r.rows[0];
  try {
    const tipoDoc =
      p.tipoMovimentacao === "TRANSFERENCIA"
        ? "TERMO_TRANSFERENCIA"
        : p.tipoMovimentacao === "CAUTELA_SAIDA" || p.tipoMovimentacao === "CAUTELA_RETORNO"
          ? "TERMO_CAUTELA"
          : "OUTRO";

    const titulo = `Evidencia (pendente): ${tipoDoc} - termo=${p.termoReferencia}`;
    await client.query(
      `INSERT INTO documentos (
         tipo, titulo, movimentacao_id, termo_referencia,
         gerado_por_perfil_id, observacoes
       ) VALUES (
         $1::public.tipo_documento, $2, $3, $4,
         $5, $6
       );`,
      [
        tipoDoc,
        titulo.slice(0, 180),
        mov.id,
        p.termoReferencia,
        p.executadaPorPerfilId || null,
        "PENDENTE: gerar PDF no n8n e atualizar drive_url via PATCH /documentos/:id.",
      ],
    );
  } catch (_e) {
    // Placeholder e best-effort: nao bloqueia movimentacao se tabela ainda nao foi migrada.
  }

  return { mov: r.rows[0], bem: bemAtualizado };
}

function buildMovJustificativa(p) {
  const base = p.justificativa ? String(p.justificativa).trim() : "";
  if (p.tipoMovimentacao !== "CAUTELA_SAIDA") return base || null;
  const origem = p.cautelaExterno
    ? "EXTERNO"
    : `SALA:${String(p.cautelaSalaDestino || "").trim()}`;
  const meta = `[CAUTELA_DESTINO=${origem}]`;
  return base ? `${meta} ${base}` : meta;
}

async function lockBem(client, p) {
  const byId = p.bemId != null;
  const q = byId
    ? await client.query("SELECT id, numero_tombamento, unidade_dona_id, status, eh_bem_terceiro FROM bens WHERE id = $1 FOR UPDATE", [p.bemId])
    : await client.query("SELECT id, numero_tombamento, unidade_dona_id, status, eh_bem_terceiro FROM bens WHERE numero_tombamento = $1 FOR UPDATE", [p.numeroTombamento]);
  return q.rows[0] || null;
}

function parseDateOnly(input) {
  if (input == null || String(input).trim() === "") return null;
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) throw new HttpError(422, "DATA_INVALIDA", "Data invalida.");
  return d.toISOString().slice(0, 10);
}

function parseDateTime(input) {
  if (input == null || String(input).trim() === "") return null;
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) throw new HttpError(422, "DATA_HORA_INVALIDA", "Data/hora invalida.");
  return d;
}

/**
 * Corrige texto com "mojibake" comum quando UTF-8 e interpretado como Latin1.
 * Ex.: "DescriÃ§Ã£o" -> "Descrição".
 *
 * Regra operacional: aplicar apenas quando houver forte indicio de mojibake e a conversao nao gerar U+FFFD.
 * @param {string} raw Texto bruto.
 * @returns {string} Texto possivelmente corrigido.
 */
function fixMojibakeUtf8FromLatin1(raw) {
  const s = String(raw || "");
  if (!/[ÃÂ]/.test(s)) return s;
  try {
    const fixed = Buffer.from(s, "latin1").toString("utf8");
    if (!fixed || fixed.includes("\uFFFD")) return s;
    const score = (txt) => (txt.match(/[ÃÂ]/g) || []).length + (txt.match(/\uFFFD/g) || []).length;
    return score(fixed) < score(s) ? fixed : s;
  } catch (_e) {
    return s;
  }
}

function normalizeKey(k) {
  const txt = fixMojibakeUtf8FromLatin1(k);
  return String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function pick(o, names) {
  for (const n of names) {
    const v = o[n];
    if (v != null && String(v).trim() !== "") return fixMojibakeUtf8FromLatin1(String(v).trim());
  }
  return null;
}

function parseUnit(raw, fallback) {
  if (raw == null || String(raw).trim() === "") return fallback;
  const rawFixed = fixMojibakeUtf8FromLatin1(raw);
  const n = Number(rawFixed);
  if (Number.isInteger(n) && VALID_UNIDADES.has(n)) return n;
  const key = String(rawFixed)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const direct = UNIT_MAP.get(key);
  if (direct) return direct;

  // Heuristica para lotacoes longas (ex.: "Almoxarifado de Material Permanente - 2a CJM - Sao Paulo").
  // Regra operacional: aceitar substring match para garantir importacao GEAFIN quando a sigla estiver ausente.
  if (/\b1\b/.test(key) && key.includes("aud")) return 1;
  if (/\b2\b/.test(key) && key.includes("aud")) return 2;
  if (key.includes("foro") || key.includes("dirf")) return 3;
  if (key.includes("almox")) return 4;

  return fallback;
}

function detectDelimiter(text) {
  const h = text.split(/\r?\n/u).find((line) => line.trim().length > 0) || "";
  const semis = (h.match(/;/g) || []).length;
  const commas = (h.match(/,/g) || []).length;
  return semis >= commas ? ";" : ",";
}

function mapStatus(raw) {
  const s = String(raw || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  if (s.includes("BAIX")) return "BAIXADO";
  if (s.includes("CAUTELA")) return "EM_CAUTELA";
  return "OK";
}

function parseMoney(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const txt = String(raw).replace(/[R$\s]/g, "").replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.-]/g, "");
  if (!txt) return null;
  const n = Number(txt);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function extractCod2Aud(row) {
  const direct = pick(row, ["cod2aud", "cod_2_aud", "cod2_aud", "codigo_2_auditoria"]);
  if (direct) {
    const m = direct.match(/(\d{4})/);
    if (m && m[1] !== "0000") return m[1];
  }

  for (const v of Object.values(row)) {
    if (typeof v !== "string") continue;
    const m = v.match(/cod2aud\s*:\s*([0-9]{4})/i);
    if (m && m[1] !== "0000") return m[1];
  }

  return null;
}

function sanitizeNomeResumo(raw) {
  if (raw == null) return null;
  let txt = fixMojibakeUtf8FromLatin1(String(raw)).trim();
  if (!txt) return null;

  // Remove marcadores antigos de catalogo no sufixo (ex.: 1/10, (1-2), 17-21).
  txt = txt.replace(/\s*(?:[-(])?\s*\d{1,3}\s*[-/]\s*\d{1,3}\s*\)?\s*$/u, "");
  txt = txt.replace(/\s{2,}/g, " ").trim();

  return txt ? txt.slice(0, 240) : null;
}

/**
 * Normaliza tombamento para comparacao e validacao no padrao GEAFIN.
 * @param {string|number|undefined|null} raw Valor bruto informado.
 * @returns {string|null} Tombamento normalizado.
 */
function normalizeTombamento(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim().replace(/^"+|"+$/g, "");
  // Regra operacional: tombamento GEAFIN e numerico (10 digitos). Removemos separadores comuns para tolerar CSVs "sujos".
  const digits = s.replace(/[^0-9]/g, "");
  return digits || null;
}

function parseGeafinMode(raw) {
  const mode = String(raw || "INCREMENTAL").trim().toUpperCase();
  if (!GEAFIN_MODES.has(mode)) throw new HttpError(422, "MODO_IMPORTACAO_INVALIDO", "modoImportacao deve ser INCREMENTAL ou TOTAL.");
  return mode;
}

function parseGeafinScopeType(raw) {
  const scope = String(raw || "GERAL").trim().toUpperCase();
  if (!GEAFIN_SCOPE_TYPES.has(scope)) throw new HttpError(422, "ESCOPO_IMPORTACAO_INVALIDO", "escopoTipo deve ser GERAL ou UNIDADE.");
  return scope;
}

function parseGeafinAusentesAction(raw) {
  const action = String(raw || "").trim().toUpperCase();
  if (!GEAFIN_AUSENTES_ACTIONS.has(action)) {
    throw new HttpError(422, "ACAO_AUSENTES_INVALIDA", "acaoAusentes deve ser MANTER ou BAIXAR.");
  }
  return action;
}

function parseGeafinDecision(raw) {
  const decision = String(raw || "").trim().toUpperCase();
  if (!GEAFIN_DECISIONS.has(decision)) throw new HttpError(422, "DECISAO_INVALIDA", "decisao invalida.");
  return decision;
}

function parseGeafinDecisionApply(raw) {
  const decision = parseGeafinDecision(raw);
  if (decision !== "APROVADA" && decision !== "REJEITADA") {
    throw new HttpError(422, "DECISAO_INVALIDA", "decisao deve ser APROVADA ou REJEITADA.");
  }
  return decision;
}

function isInScopeGeafin(unidadeDonaId, escopoTipo, unidadeEscopoId) {
  if (escopoTipo === "GERAL") return true;
  return Number(unidadeDonaId || 0) === Number(unidadeEscopoId || 0);
}

function summarizeNormalizedForSession(data) {
  if (!data || typeof data !== "object") return {};
  return {
    numeroTombamento: data.numeroTombamento || null,
    codigoCatalogo: data.codigoCatalogo || null,
    descricao: data.descricao || null,
    grupo: data.grupo || null,
    nomeResumo: data.nomeResumo || null,
    unidadeDonaId: data.unidadeDonaId || null,
    localFisico: data.localFisico || null,
    status: data.status || null,
    valorAquisicao: data.valorAquisicao == null ? null : Number(data.valorAquisicao),
    cod2Aud: data.cod2Aud || null,
  };
}

function normalizeGeafin(raw, rowNo, fallbackUnit) {
  const row = {};
  for (const [k, v] of Object.entries(raw || {})) row[normalizeKey(k)] = v == null ? "" : String(v).trim();

  const numeroTombamento = normalizeTombamento(
    pick(
      row,
      [
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
      ],
    ),
  );
  if (!numeroTombamento) return { ok: false, error: `Linha ${rowNo}: tombamento nao informado.` };
  if (!TOMBAMENTO_GEAFIN_RE.test(numeroTombamento)) {
    return {
      ok: false,
      error: `Linha ${rowNo}: tombamento fora do padrao GEAFIN (10 digitos numericos).`,
    };
  }

  const descricao = pick(row, ["descricao", "descricao_bem", "descricao_material", "material_descricao", "nome_bem"]);
  if (!descricao) return { ok: false, error: `Linha ${rowNo}: descricao nao informada.` };

  const unidadeDonaId = parseUnit(pick(row, ["unidade_dona_id", "unidade", "setor", "orgao", "unidade_responsavel"]), fallbackUnit);
  const unidadeDonaIdFinal = unidadeDonaId ?? parseUnit(
    pick(row, ["siglalotacao", "sigla_lotacao", "lotacao", "lotacao_descricao"]),
    fallbackUnit,
  );
  if (!unidadeDonaIdFinal || !VALID_UNIDADES.has(unidadeDonaIdFinal)) return { ok: false, error: `Linha ${rowNo}: unidade invalida e sem unidadePadraoId.` };

  return {
    ok: true,
    data: {
      numeroTombamento,
      codigoCatalogo: pick(row, ["codigo_catalogo", "codigo_material", "codigo_item", "grupo_material_codigo", "codigo", "cod_material", "codmaterial"]) || `GEAFIN_${numeroTombamento}`,
      descricao,
      nomeResumo: sanitizeNomeResumo(
        pick(row, ["nome", "nome_resumo", "item", "nome_do_item", "resumo"]) || (() => {
          // Fallback: usa a primeira coluna quando o CSV vier com headers customizados.
          const keys = Object.keys(row);
          return keys.length > 0 ? row[keys[0]] : null;
        })(),
      ),
      cod2Aud: extractCod2Aud(row),
      grupo: pick(row, ["grupo", "grupo_material", "classe", "categoria"]),
      localFisico: pick(row, ["local_fisico", "localizacao", "sala", "local", "ambiente", "siglalotacao"]) || "NAO_INFORMADO",
      unidadeDonaId: unidadeDonaIdFinal,
      status: mapStatus(pick(row, ["status", "situacao", "status_bem"])),
      valorAquisicao: parseMoney(pick(row, ["valor_aquisicao", "valor_de_aquisicao", "valor", "valor_compra"])),
    },
  };
}

/**
 * Executa upsert seguro em catalogo_bens.
 * @param {import('pg').PoolClient} client Cliente transacional.
 * @param {object} d Dados normalizados do CSV.
 * @returns {Promise<string>} Id do catalogo.
 */
async function upsertCatalogo(client, d) {
  const r = await client.query(
    `INSERT INTO catalogo_bens (codigo_catalogo, descricao, grupo)
     VALUES ($1,$2,$3)
     ON CONFLICT (codigo_catalogo)
     DO UPDATE SET descricao = EXCLUDED.descricao, grupo = COALESCE(EXCLUDED.grupo, catalogo_bens.grupo), updated_at = NOW()
     RETURNING id`,
    [d.codigoCatalogo, d.descricao, d.grupo],
  );
  return r.rows[0].id;
}

/**
 * Executa upsert seguro em bens.
 * @param {import('pg').PoolClient} client Cliente transacional.
 * @param {object} d Dados normalizados do CSV.
 * @param {string} catId FK de catalogo_bens.
 * @returns {Promise<{id: string, inserted: boolean, unidadeChanged: boolean}>} Resultado da operacao.
 */
async function upsertBem(client, d, catId) {
  const r = await client.query(
    `WITH existing AS (
      SELECT id, unidade_dona_id AS unidade_antiga_id
      FROM bens
      WHERE numero_tombamento = $1
    ),
    upsert AS (
      INSERT INTO bens (
        numero_tombamento, catalogo_bem_id, unidade_dona_id,
        local_fisico, status, valor_aquisicao, eh_bem_terceiro,
        cod_2_aud, nome_resumo
      ) VALUES ($1,$2,$3,NULL,'AGUARDANDO_RECEBIMENTO',$6,FALSE,$7,$8)
      ON CONFLICT (numero_tombamento) WHERE numero_tombamento IS NOT NULL
      DO UPDATE SET
        catalogo_bem_id = EXCLUDED.catalogo_bem_id,
        unidade_dona_id = EXCLUDED.unidade_dona_id,
        local_fisico = $4,
        status = $5::public.status_bem,
        valor_aquisicao = COALESCE($6, bens.valor_aquisicao),
        cod_2_aud = COALESCE(EXCLUDED.cod_2_aud, bens.cod_2_aud),
        nome_resumo = COALESCE(EXCLUDED.nome_resumo, bens.nome_resumo),
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS inserted, unidade_dona_id AS unidade_nova_id
    )
    SELECT
      upsert.id,
      upsert.inserted,
      (NOT upsert.inserted) AND (existing.unidade_antiga_id IS DISTINCT FROM upsert.unidade_nova_id) AS "unidadeChanged"
    FROM upsert
    LEFT JOIN existing ON existing.id = upsert.id;`,
    [d.numeroTombamento, catId, d.unidadeDonaId, d.localFisico, d.status, d.valorAquisicao, d.cod2Aud, d.nomeResumo],
  );
  return r.rows[0];
}

async function getGeafinSessionById(sessionId) {
  const r = await pool.query(
    `SELECT
       id,
       request_id AS "requestId",
       original_filename AS "originalFilename",
       content_sha256 AS "contentSha256",
       bytes,
       delimiter,
       imported_em AS "importedEm",
       total_linhas AS "totalLinhas",
       status,
       finalizado_em AS "finalizadoEm",
       erro_resumo AS "erroResumo",
       modo_importacao AS "modoImportacao",
       escopo_tipo AS "escopoTipo",
       unidade_escopo_id AS "unidadeEscopoId",
       etapa,
       cancel_requested AS "cancelRequested",
       backup_status AS "backupStatus",
       backup_result_json AS "backupResult",
       resumo_preview_json AS "resumoPreview",
       resumo_aplicacao_json AS "resumoAplicacao",
       acao_ausentes AS "acaoAusentes",
       aplicado_em AS "aplicadoEm",
       aplicado_por AS "aplicadoPor"
     FROM public.geafin_import_arquivos
     WHERE id = $1
     LIMIT 1;`,
    [sessionId],
  );
  return r.rows[0] || null;
}

async function countAusentesNoEscopo(client, escopoTipo, unidadeEscopoId, tombamentos) {
  const ids = Array.isArray(tombamentos) ? tombamentos.filter(Boolean) : [];
  if (escopoTipo === "UNIDADE") {
    if (!VALID_UNIDADES.has(Number(unidadeEscopoId || 0))) return 0;
    if (!ids.length) {
      const c = await client.query(
        `SELECT COUNT(*)::int AS total
         FROM public.bens
         WHERE eh_bem_terceiro = FALSE
           AND numero_tombamento IS NOT NULL
           AND unidade_dona_id = $1;`,
        [Number(unidadeEscopoId)],
      );
      return Number(c.rows[0]?.total || 0);
    }
    const c = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM public.bens
       WHERE eh_bem_terceiro = FALSE
         AND numero_tombamento IS NOT NULL
         AND unidade_dona_id = $1
         AND NOT (numero_tombamento = ANY($2::text[]));`,
      [Number(unidadeEscopoId), ids],
    );
    return Number(c.rows[0]?.total || 0);
  }

  if (!ids.length) {
    const c = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM public.bens
       WHERE eh_bem_terceiro = FALSE
         AND numero_tombamento IS NOT NULL;`,
    );
    return Number(c.rows[0]?.total || 0);
  }
  const c = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM public.bens
     WHERE eh_bem_terceiro = FALSE
       AND numero_tombamento IS NOT NULL
       AND NOT (numero_tombamento = ANY($1::text[]));`,
    [ids],
  );
  return Number(c.rows[0]?.total || 0);
}

async function applyBaixaAusentesNoEscopo(client, escopoTipo, unidadeEscopoId, tombamentos) {
  const ids = Array.isArray(tombamentos) ? tombamentos.filter(Boolean) : [];
  if (escopoTipo === "UNIDADE") {
    if (!VALID_UNIDADES.has(Number(unidadeEscopoId || 0))) return 0;
    if (!ids.length) {
      const r = await client.query(
        `UPDATE public.bens
         SET status = 'BAIXADO'::public.status_bem,
             updated_at = NOW()
         WHERE eh_bem_terceiro = FALSE
           AND numero_tombamento IS NOT NULL
           AND unidade_dona_id = $1
           AND status <> 'BAIXADO'::public.status_bem;`,
        [Number(unidadeEscopoId)],
      );
      return Number(r.rowCount || 0);
    }
    const r = await client.query(
      `UPDATE public.bens
       SET status = 'BAIXADO'::public.status_bem,
           updated_at = NOW()
       WHERE eh_bem_terceiro = FALSE
         AND numero_tombamento IS NOT NULL
         AND unidade_dona_id = $1
         AND NOT (numero_tombamento = ANY($2::text[]))
         AND status <> 'BAIXADO'::public.status_bem;`,
      [Number(unidadeEscopoId), ids],
    );
    return Number(r.rowCount || 0);
  }

  if (!ids.length) {
    const r = await client.query(
      `UPDATE public.bens
       SET status = 'BAIXADO'::public.status_bem,
           updated_at = NOW()
       WHERE eh_bem_terceiro = FALSE
         AND numero_tombamento IS NOT NULL
         AND status <> 'BAIXADO'::public.status_bem;`,
    );
    return Number(r.rowCount || 0);
  }
  const r = await client.query(
    `UPDATE public.bens
     SET status = 'BAIXADO'::public.status_bem,
         updated_at = NOW()
     WHERE eh_bem_terceiro = FALSE
       AND numero_tombamento IS NOT NULL
       AND NOT (numero_tombamento = ANY($1::text[]))
       AND status <> 'BAIXADO'::public.status_bem;`,
    [ids],
  );
  return Number(r.rowCount || 0);
}

function buildBeforeSnapshotFromBem(row) {
  if (!row) return null;
  return {
    bemId: row.id || null,
    numeroTombamento: row.numero_tombamento || null,
    codigoCatalogo: row.codigo_catalogo_atual || null,
    catalogoDescricao: row.catalogo_descricao_atual || null,
    catalogoGrupo: row.catalogo_grupo_atual || null,
    unidadeDonaId: row.unidade_dona_id || null,
    localFisico: row.local_fisico || null,
    status: row.status || null,
    valorAquisicao: row.valor_aquisicao == null ? null : Number(row.valor_aquisicao),
    cod2Aud: row.cod_2_aud || null,
    nomeResumo: row.nome_resumo || null,
  };
}

async function buildGeafinPreviewSession(req) {
  if (!req.file?.buffer?.length) {
    throw new HttpError(400, "ARQUIVO_OBRIGATORIO", "Envie o CSV no campo 'arquivo'.");
  }

  const modoImportacao = parseGeafinMode(req.body?.modoImportacao || "INCREMENTAL");
  const escopoTipo = parseGeafinScopeType(req.body?.escopoTipo || "GERAL");
  const unidadePadraoId = parseUnit(req.body?.unidadePadraoId, null);
  const unidadeEscopoRaw = req.body?.unidadeEscopoId ?? req.body?.unidadeId ?? null;
  const unidadeEscopoId = escopoTipo === "UNIDADE" ? parseUnit(unidadeEscopoRaw, null) : null;
  if (escopoTipo === "UNIDADE" && !VALID_UNIDADES.has(Number(unidadeEscopoId || 0))) {
    throw new HttpError(422, "UNIDADE_ESCOPO_INVALIDA", "Para escopo UNIDADE, informe unidadeEscopoId entre 1 e 4.");
  }

  const csvText = iconv.decode(req.file.buffer, "latin1");
  const delimiter = detectDelimiter(csvText);
  const fileSha256 = createHash("sha256").update(req.file.buffer).digest("hex");
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    delimiter,
    trim: true,
    relax_column_count: true,
  });

  const normalized = [];
  const tombamentosEscopo = [];
  const catalogosEscopo = [];
  for (let i = 0; i < rows.length; i += 1) {
    const rowNo = i + 2;
    const rowRaw = rows[i] || {};
    const ordered = {};
    for (const k of Object.keys(rowRaw).sort((a, b) => String(a).localeCompare(String(b)))) {
      ordered[k] = rowRaw[k];
    }
    const rowSha256 = createHash("sha256").update(JSON.stringify(ordered)).digest("hex");
    const n = normalizeGeafin(rowRaw, rowNo, unidadePadraoId);
    const inScope = n.ok ? isInScopeGeafin(n.data.unidadeDonaId, escopoTipo, unidadeEscopoId) : false;
    normalized.push({ rowNo, rowRaw, rowSha256, normalized: n, inScope });
    if (n.ok && inScope) {
      tombamentosEscopo.push(String(n.data.numeroTombamento));
      catalogosEscopo.push(String(n.data.codigoCatalogo));
    }
  }

  const uniqueTombos = Array.from(new Set(tombamentosEscopo));
  const uniqueCatalogos = Array.from(new Set(catalogosEscopo));

  const bensByTombo = new Map();
  if (uniqueTombos.length) {
    const rBens = await pool.query(
      `SELECT
         b.id,
         b.numero_tombamento,
         b.catalogo_bem_id,
         b.unidade_dona_id,
         b.local_fisico,
         b.status::text,
         b.valor_aquisicao,
         b.cod_2_aud,
         b.nome_resumo,
         cb.codigo_catalogo AS codigo_catalogo_atual,
         cb.descricao AS catalogo_descricao_atual,
         cb.grupo AS catalogo_grupo_atual
       FROM public.bens b
       JOIN public.catalogo_bens cb ON cb.id = b.catalogo_bem_id
       WHERE b.numero_tombamento = ANY($1::text[]);`,
      [uniqueTombos],
    );
    for (const row of rBens.rows) bensByTombo.set(String(row.numero_tombamento), row);
  }

  const catalogByCode = new Map();
  if (uniqueCatalogos.length) {
    const rCat = await pool.query(
      `SELECT id, codigo_catalogo, descricao, grupo
       FROM public.catalogo_bens
       WHERE codigo_catalogo = ANY($1::text[]);`,
      [uniqueCatalogos],
    );
    for (const row of rCat.rows) catalogByCode.set(String(row.codigo_catalogo), row);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setDbContext(client, {
      changeOrigin: "IMPORTACAO",
      currentUserId: req.user?.id || "",
    });

    const fileMeta = await client.query(
      `INSERT INTO public.geafin_import_arquivos (
         request_id, original_filename, content_sha256, bytes, delimiter, total_linhas,
         status, modo_importacao, escopo_tipo, unidade_escopo_id, etapa
       ) VALUES (
         $1,$2,$3,$4,$5,$6,
         'AGUARDANDO_CONFIRMACAO',$7,$8,$9,'PREVIA'
       )
       RETURNING id;`,
      [
        req.requestId,
        req.file.originalname || null,
        fileSha256,
        req.file.size || req.file.buffer.length,
        delimiter,
        rows.length,
        modoImportacao,
        escopoTipo,
        unidadeEscopoId,
      ],
    );
    const arquivoId = fileMeta.rows[0].id;

    const summary = {
      delimiter,
      modoImportacao,
      escopoTipo,
      unidadeEscopoId: unidadeEscopoId || null,
      totalLinhas: rows.length,
      validas: 0,
      invalidas: 0,
      emEscopo: 0,
      foraEscopo: 0,
      totalAcoes: 0,
      pendentesConfirmacao: 0,
      criarBem: 0,
      atualizarBem: 0,
      semMudanca: 0,
      erroValidacao: 0,
      potencialAusentesEscopo: 0,
    };

    const tombosParaAusentes = new Set();

    for (let i = 0; i < normalized.length; i += 1) {
      const row = normalized[i];
      const n = row.normalized;
      const rawInsert = await client.query(
        `INSERT INTO public.geafin_import_linhas (
           arquivo_id, linha_numero, row_raw, row_sha256,
           normalizacao_ok, normalizacao_erro, persistencia_ok, persistencia_erro
         ) VALUES (
           $1,$2,$3::jsonb,$4,$5,$6,FALSE,NULL
         )
         RETURNING id;`,
        [
          arquivoId,
          row.rowNo,
          JSON.stringify(row.rowRaw),
          row.rowSha256,
          n.ok,
          n.ok ? null : n.error,
        ],
      );
      const linhaId = rawInsert.rows[0].id;

      let tipoAcao = "SEM_MUDANCA";
      let requerConfirmacao = false;
      let decisao = "AUTO";
      let motivo = "";
      let dadosAntes = null;
      let dadosDepois = null;
      let numeroTombamento = null;
      let codigoCatalogo = null;
      let unidadeDonaId = null;

      if (!n.ok) {
        summary.invalidas += 1;
        tipoAcao = "ERRO_VALIDACAO";
        motivo = String(n.error || "Falha de validacao.");
        summary.erroValidacao += 1;
      } else {
        summary.validas += 1;
        numeroTombamento = String(n.data.numeroTombamento || "");
        codigoCatalogo = String(n.data.codigoCatalogo || "");
        unidadeDonaId = Number(n.data.unidadeDonaId || 0) || null;
        dadosDepois = summarizeNormalizedForSession(n.data);

        if (row.inScope) {
          summary.emEscopo += 1;
          if (numeroTombamento) tombosParaAusentes.add(numeroTombamento);
        } else {
          summary.foraEscopo += 1;
          motivo = "Fora do escopo selecionado.";
        }

        if (row.inScope) {
          const bemAtual = bensByTombo.get(numeroTombamento) || null;
          const catAtual = catalogByCode.get(codigoCatalogo) || null;
          const motivos = [];
          if (!catAtual) motivos.push("Catalogo inexistente no banco.");

          if (!bemAtual) {
            tipoAcao = "CRIAR_BEM";
            motivos.push("Bem inexistente no banco.");
          } else {
            dadosAntes = buildBeforeSnapshotFromBem(bemAtual);
            const changed = [];
            if (String(dadosAntes.codigoCatalogo || "") !== String(dadosDepois.codigoCatalogo || "")) changed.push("catalogo");
            if (Number(dadosAntes.unidadeDonaId || 0) !== Number(dadosDepois.unidadeDonaId || 0)) changed.push("unidade");
            if (String(dadosAntes.localFisico || "") !== String(dadosDepois.localFisico || "")) changed.push("localFisico");
            if (String(dadosAntes.status || "") !== String(dadosDepois.status || "")) changed.push("status");
            if (Number(dadosAntes.valorAquisicao || 0) !== Number(dadosDepois.valorAquisicao || 0)) changed.push("valorAquisicao");
            if (String(dadosAntes.cod2Aud || "") !== String(dadosDepois.cod2Aud || "")) changed.push("cod2Aud");
            if (String(dadosAntes.nomeResumo || "") !== String(dadosDepois.nomeResumo || "")) changed.push("nomeResumo");
            if (changed.length) {
              tipoAcao = "ATUALIZAR_BEM";
              motivos.push(`Campos alterados: ${changed.join(", ")}`);
            } else {
              tipoAcao = "SEM_MUDANCA";
              motivos.push("Sem alteracoes operacionais.");
            }
          }

          motivo = motivos.join(" ");
          if (tipoAcao === "CRIAR_BEM") summary.criarBem += 1;
          if (tipoAcao === "ATUALIZAR_BEM") summary.atualizarBem += 1;
          if (tipoAcao === "SEM_MUDANCA") summary.semMudanca += 1;
        } else if (tipoAcao === "SEM_MUDANCA") {
          summary.semMudanca += 1;
        }

        if (modoImportacao === "INCREMENTAL" && (tipoAcao === "CRIAR_BEM" || tipoAcao === "ATUALIZAR_BEM")) {
          requerConfirmacao = true;
          decisao = "PENDENTE";
          summary.pendentesConfirmacao += 1;
        }
      }

      summary.totalAcoes += 1;
      await client.query(
        `INSERT INTO public.geafin_import_acoes (
           arquivo_id, linha_id, ordem,
           tipo_acao, requer_confirmacao, decisao,
           numero_tombamento, codigo_catalogo, unidade_dona_id,
           descricao_resumo, dados_antes_json, dados_depois_json,
           motivo, em_escopo
         ) VALUES (
           $1,$2,$3,
           $4,$5,$6,
           $7,$8,$9,
           $10,$11::jsonb,$12::jsonb,
           $13,$14
         );`,
        [
          arquivoId,
          linhaId,
          i + 1,
          tipoAcao,
          requerConfirmacao,
          decisao,
          numeroTombamento || null,
          codigoCatalogo || null,
          unidadeDonaId,
          n.ok ? String(n.data?.descricao || "").slice(0, 300) : null,
          dadosAntes ? JSON.stringify(dadosAntes) : null,
          dadosDepois ? JSON.stringify(dadosDepois) : null,
          motivo || null,
          Boolean(row.inScope),
        ],
      );
    }

    if (modoImportacao === "TOTAL") {
      summary.potencialAusentesEscopo = await countAusentesNoEscopo(
        client,
        escopoTipo,
        unidadeEscopoId,
        Array.from(tombosParaAusentes),
      );
    }

    await client.query(
      `UPDATE public.geafin_import_arquivos
       SET resumo_preview_json = $2::jsonb,
           backup_status = 'PENDENTE'
       WHERE id = $1;`,
      [arquivoId, JSON.stringify(summary)],
    );
    await client.query("COMMIT");

    return {
      id: arquivoId,
      modoImportacao,
      escopoTipo,
      unidadeEscopoId: unidadeEscopoId || null,
      summary,
    };
  } catch (error) {
    await safeRollback(client);
    throw error;
  } finally {
    client.release();
  }
}

async function getGeafinSessionOverview(sessionId) {
  const session = await getGeafinSessionById(sessionId);
  if (!session) return null;

  const agg = await pool.query(
    `SELECT
       COUNT(*)::int AS total_acoes,
       COUNT(*) FILTER (WHERE tipo_acao IN ('CRIAR_BEM','ATUALIZAR_BEM'))::int AS total_aplicaveis,
       COUNT(*) FILTER (WHERE requer_confirmacao)::int AS total_confirmacao,
       COUNT(*) FILTER (WHERE decisao = 'PENDENTE')::int AS pendentes,
       COUNT(*) FILTER (WHERE decisao = 'APROVADA')::int AS aprovadas,
       COUNT(*) FILTER (WHERE decisao = 'REJEITADA')::int AS rejeitadas,
       COUNT(*) FILTER (WHERE aplicada)::int AS aplicadas,
       COUNT(*) FILTER (WHERE erro_aplicacao IS NOT NULL)::int AS erros_aplicacao
     FROM public.geafin_import_acoes
     WHERE arquivo_id = $1;`,
    [sessionId],
  );
  const rawAgg = await pool.query(
    `SELECT
       COUNT(*)::int AS linhas_inseridas,
       COUNT(*) FILTER (WHERE normalizacao_ok = FALSE)::int AS falha_normalizacao,
       COUNT(*) FILTER (WHERE persistencia_ok = FALSE AND normalizacao_ok)::int AS falha_persistencia,
       MAX(created_at) AS ultima_atualizacao_em
     FROM public.geafin_import_linhas
     WHERE arquivo_id = $1;`,
    [sessionId],
  );

  const a = agg.rows[0] || {};
  const r = rawAgg.rows[0] || {};
  const totalAplicaveis = Number(a.total_aplicaveis || 0);
  const aplicadas = Number(a.aplicadas || 0);
  const percent = totalAplicaveis > 0 ? Math.min(100, Math.round((aplicadas / totalAplicaveis) * 1000) / 10) : null;

  return {
    ...session,
    linhasInseridas: Number(r.linhas_inseridas || 0),
    falhaNormalizacao: Number(r.falha_normalizacao || 0),
    falhaPersistencia: Number(r.falha_persistencia || 0),
    ultimaAtualizacaoEm: r.ultima_atualizacao_em || null,
    metricas: {
      totalAcoes: Number(a.total_acoes || 0),
      totalAplicaveis,
      totalConfirmacao: Number(a.total_confirmacao || 0),
      pendentes: Number(a.pendentes || 0),
      aprovadas: Number(a.aprovadas || 0),
      rejeitadas: Number(a.rejeitadas || 0),
      aplicadas,
      errosAplicacao: Number(a.erros_aplicacao || 0),
      percent,
    },
    percent,
  };
}

async function applyGeafinSession(req, sessionId, payload) {
  const session = await getGeafinSessionById(sessionId);
  if (!session) throw new HttpError(404, "IMPORTACAO_NAO_ENCONTRADA", "Sessao de importacao GEAFIN nao encontrada.");
  if (session.status !== "AGUARDANDO_CONFIRMACAO") {
    throw new HttpError(409, "STATUS_IMPORTACAO_INVALIDO", `Sessao nao pode ser aplicada no status atual: ${session.status}.`);
  }
  if (!GEAFIN_MODES.has(String(session.modoImportacao || "").toUpperCase())) {
    throw new HttpError(500, "SESSAO_MODO_INVALIDO", "Sessao GEAFIN sem modo valido.");
  }

  const modoImportacao = String(session.modoImportacao || "").toUpperCase();
  const escopoTipo = String(session.escopoTipo || "GERAL").toUpperCase();
  const unidadeEscopoId = session.unidadeEscopoId == null ? null : Number(session.unidadeEscopoId);

  let acaoAusentes = null;
  if (modoImportacao === "TOTAL") {
    const confirmText = String(payload?.confirmText || "").trim().toUpperCase();
    if (confirmText !== "IMPORTACAO_TOTAL") {
      throw new HttpError(422, "CONFIRMACAO_TOTAL_INVALIDA", "Digite IMPORTACAO_TOTAL para confirmar a importacao TOTAL.");
    }
    acaoAusentes = parseGeafinAusentesAction(payload?.acaoAusentes);
  }

  await ensureAdminPassword(req, payload?.adminPassword);

  if (modoImportacao === "INCREMENTAL") {
    const pend = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM public.geafin_import_acoes
       WHERE arquivo_id = $1
         AND requer_confirmacao = TRUE
         AND decisao = 'PENDENTE'
         AND tipo_acao IN ('CRIAR_BEM','ATUALIZAR_BEM');`,
      [sessionId],
    );
    if (Number(pend.rows[0]?.total || 0) > 0) {
      throw new HttpError(422, "DECISOES_PENDENTES", "Existem acoes pendentes de confirmacao no modo INCREMENTAL.");
    }
  }

  let backupResult = null;
  try {
    backupResult = await performBackupOperation({
      scope: "all",
      keepDays: parseKeepDays(payload?.keepDays, BACKUP_KEEP_DAYS_DEFAULT),
      tag: sanitizeBackupTag(`pre-geafin-${String(sessionId).slice(0, 8)}`, "pre-geafin"),
    });
  } catch (error) {
    await pool.query(
      `UPDATE public.geafin_import_arquivos
       SET status = 'ERRO',
           etapa = 'FALHA_BACKUP',
           backup_status = 'ERRO',
           erro_resumo = $2,
           finalizado_em = NOW()
       WHERE id = $1;`,
      [sessionId, String(error?.message || "Falha ao executar backup automatico pre-importacao.")],
    );
    throw error;
  }

  await pool.query(
    `UPDATE public.geafin_import_arquivos
     SET status = 'APLICANDO',
         etapa = 'APLICACAO',
         backup_status = 'OK',
         backup_result_json = $2::jsonb,
         erro_resumo = NULL,
         cancel_requested = FALSE
     WHERE id = $1;`,
    [sessionId, JSON.stringify(backupResult || {})],
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setDbContext(client, {
      changeOrigin: "IMPORTACAO",
      currentUserId: req.user?.id || "",
    });

    const actions = await client.query(
      `SELECT
         id, tipo_acao, requer_confirmacao, decisao, dados_depois_json,
         numero_tombamento, em_escopo
       FROM public.geafin_import_acoes
       WHERE arquivo_id = $1
       ORDER BY ordem ASC;`,
      [sessionId],
    );

    const importedTombos = new Set();
    let aplicadas = 0;
    let ignoradas = 0;
    let baixadosAusentes = 0;

    for (let i = 0; i < actions.rows.length; i += 1) {
      const acao = actions.rows[i];
      if (acao.numero_tombamento && acao.em_escopo) importedTombos.add(String(acao.numero_tombamento));

      if (i % 20 === 0) {
        const cancel = await client.query(
          `SELECT cancel_requested
           FROM public.geafin_import_arquivos
           WHERE id = $1
           LIMIT 1;`,
          [sessionId],
        );
        if (Boolean(cancel.rows[0]?.cancel_requested)) {
          throw new HttpError(409, "IMPORTACAO_CANCELADA_SOLICITADA", "Cancelamento solicitado pelo usuario.");
        }
      }

      const actionable = acao.tipo_acao === "CRIAR_BEM" || acao.tipo_acao === "ATUALIZAR_BEM";
      if (!actionable) {
        ignoradas += 1;
        continue;
      }
      if (!acao.em_escopo) {
        ignoradas += 1;
        continue;
      }
      if (acao.requer_confirmacao && acao.decisao !== "APROVADA") {
        ignoradas += 1;
        continue;
      }
      if (!acao.requer_confirmacao && acao.decisao === "REJEITADA") {
        ignoradas += 1;
        continue;
      }

      const d = acao.dados_depois_json || {};
      const payloadNorm = {
        numeroTombamento: String(d.numeroTombamento || ""),
        codigoCatalogo: String(d.codigoCatalogo || ""),
        descricao: String(d.descricao || ""),
        grupo: d.grupo == null ? null : String(d.grupo),
        nomeResumo: d.nomeResumo == null ? null : String(d.nomeResumo),
        cod2Aud: d.cod2Aud == null ? null : String(d.cod2Aud),
        unidadeDonaId: Number(d.unidadeDonaId || 0),
        localFisico: d.localFisico == null ? "NAO_INFORMADO" : String(d.localFisico),
        status: String(d.status || "OK"),
        valorAquisicao: d.valorAquisicao == null ? null : Number(d.valorAquisicao),
      };
      if (!TOMBAMENTO_GEAFIN_RE.test(payloadNorm.numeroTombamento)) {
        throw new HttpError(422, "ACAO_TOMBAMENTO_INVALIDO", `Tombamento invalido na acao ${acao.id}.`);
      }
      if (!payloadNorm.codigoCatalogo || !payloadNorm.descricao) {
        throw new HttpError(422, "ACAO_CATALOGO_INVALIDO", `Catalogo invalido na acao ${acao.id}.`);
      }
      if (!VALID_UNIDADES.has(payloadNorm.unidadeDonaId)) {
        throw new HttpError(422, "ACAO_UNIDADE_INVALIDA", `Unidade invalida na acao ${acao.id}.`);
      }
      if (!VALID_STATUS_BEM.has(payloadNorm.status)) payloadNorm.status = "OK";

      const catId = await upsertCatalogo(client, payloadNorm);
      await upsertBem(client, payloadNorm, catId);
      await client.query(
        `UPDATE public.geafin_import_acoes
         SET aplicada = TRUE, erro_aplicacao = NULL
         WHERE id = $1;`,
        [acao.id],
      );
      aplicadas += 1;
    }

    if (modoImportacao === "TOTAL" && acaoAusentes === "BAIXAR") {
      baixadosAusentes = await applyBaixaAusentesNoEscopo(
        client,
        escopoTipo,
        unidadeEscopoId,
        Array.from(importedTombos),
      );
    }

    await client.query("COMMIT");

    const resumoAplicacao = {
      aplicadas,
      ignoradas,
      totalAcoes: actions.rows.length,
      modoImportacao,
      escopoTipo,
      unidadeEscopoId: unidadeEscopoId || null,
      acaoAusentes: acaoAusentes || null,
      baixadosAusentes,
      backup: backupResult,
      concluidoEm: new Date().toISOString(),
    };
    await pool.query(
      `UPDATE public.geafin_import_arquivos
       SET status = 'CONCLUIDO',
           etapa = 'FINALIZADA',
           cancel_requested = FALSE,
           finalizado_em = NOW(),
           aplicado_em = NOW(),
           aplicado_por = $2,
           acao_ausentes = $3,
           resumo_aplicacao_json = $4::jsonb,
           erro_resumo = NULL
       WHERE id = $1;`,
      [sessionId, req.user?.id || null, acaoAusentes, JSON.stringify(resumoAplicacao)],
    );

    return resumoAplicacao;
  } catch (error) {
    await safeRollback(client);
    const isCancel = error?.code === "IMPORTACAO_CANCELADA_SOLICITADA";
    await pool.query(
      `UPDATE public.geafin_import_arquivos
       SET status = $2,
           etapa = $3,
           finalizado_em = NOW(),
           erro_resumo = $4
       WHERE id = $1;`,
      [
        sessionId,
        isCancel ? "CANCELADO" : "ERRO",
        isCancel ? "CANCELADA" : "FALHA_APLICACAO",
        String(error?.message || "Falha na aplicacao da sessao GEAFIN."),
      ],
    );
    throw error;
  } finally {
    client.release();
  }
}

function dbError(error) {
  if (error?.code === "P0001") return "Bloqueado por inventario em andamento (Art. 183 - AN303_Art183).";
  if (error?.code === "23505") return `Conflito de unicidade.${error?.constraint ? ` constraint=${error.constraint}` : ""}`;
  if (error?.code === "23514") return `Violacao de regra de negocio.${error?.constraint ? ` constraint=${error.constraint}` : ""}`;
  if (error?.code === "23503") return `Violacao de FK.${error?.constraint ? ` constraint=${error.constraint}` : ""}`;
  if (error?.code === "22P02") return "Formato invalido em campo (cast/conversao).";

  const parts = [];
  if (error?.code) parts.push(`code=${error.code}`);
  if (error?.constraint) parts.push(`constraint=${error.constraint}`);
  if (error?.detail) parts.push(`detail=${String(error.detail).slice(0, 220)}`);
  if (error?.message) parts.push(`message=${String(error.message).slice(0, 220)}`);
  return parts.length ? `Falha ao gravar no banco (${parts.join(" ")})` : "Falha ao gravar no banco.";
}

async function safeRollback(client) {
  try {
    await client.query("ROLLBACK");
  } catch (_error) {
    // noop
  }
}

function openapi() {
  return {
    openapi: "3.0.3",
    info: {
      title: "API Patrimonio 2a CJM",
      version: "1.0.0",
      description: "Swagger basico para importacao GEAFIN, movimentacao patrimonial e inventario (sync offline).",
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: AUTH_ENABLED ? [{ bearerAuth: [] }] : [],
    paths: {
      "/health": { get: { summary: "Healthcheck", responses: { 200: { description: "OK" } } } },
      "/auth/login": { post: { summary: "Login (matricula/senha) -> JWT", responses: { 200: { description: "OK" }, 401: { description: "Credenciais invalidas" } } } },
      "/auth/primeiro-acesso": { post: { summary: "Definir senha no primeiro acesso (bootstrap controlado)", responses: { 201: { description: "Criado" }, 409: { description: "Senha ja definida" } } } },
      "/auth/me": { get: { summary: "Retorna o perfil autenticado", responses: { 200: { description: "OK" }, 401: { description: "Nao autenticado" } } } },
      "/stats": { get: { summary: "Estatisticas basicas de bens", responses: { 200: { description: "OK" } } } },
      "/bens": { get: { summary: "Listagem/consulta de bens (paginado)", responses: { 200: { description: "OK" } } } },
      "/bens/{id}": {
        get: { summary: "Detalhes de um bem (join com catalogo + historicos)", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } },
        patch: { summary: "Atualizar bem (ADMIN) exceto chaves", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } },
      },
      "/auditoria/patrimonio": {
        get: { summary: "Listagem global da auditoria patrimonial (ADMIN)", responses: { 200: { description: "OK" } } },
      },
      "/logs/erros-runtime": {
        get: { summary: "Listagem de erros runtime da API (ADMIN)", responses: { 200: { description: "OK" } } },
      },
      "/admin/backup/status": {
        get: { summary: "Status operacional de backup (ADMIN)", responses: { 200: { description: "OK" } } },
      },
      "/admin/backup/snapshot": {
        post: { summary: "Executar snapshot pre-GEAFIN (ADMIN + senha)", responses: { 200: { description: "OK" } } },
      },
      "/admin/backup/manual": {
        post: { summary: "Executar backup manual (ADMIN + senha)", responses: { 200: { description: "OK" } } },
      },
      "/admin/backup/restore": {
        post: { summary: "Executar restore de dump (ADMIN + senha + RESTORE)", responses: { 200: { description: "OK" } } },
      },
      "/locais": {
        get: { summary: "Listar locais/salas padronizados (query: unidadeId, includeInativos)", responses: { 200: { description: "OK" } } },
        post: { summary: "Criar/atualizar local (ADMIN)", responses: { 201: { description: "Criado/atualizado" } } },
      },
      "/locais/{id}": { patch: { summary: "Atualizar local por id (ADMIN)", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } } },
      "/perfis": { get: { summary: "Listagem basica de perfis", responses: { 200: { description: "OK" } } }, post: { summary: "Criacao de perfil", responses: { 201: { description: "Criado" } } } },
      "/perfis/{id}": { patch: { summary: "Atualizar perfil (ADMIN)", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } } },
      "/perfis/{id}/reset-senha": { post: { summary: "Resetar senha (ADMIN) para permitir primeiro acesso novamente", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } } },
      "/importar-geafin": { post: { summary: "Importacao CSV GEAFIN (legado)", responses: { 200: { description: "Sucesso" }, 207: { description: "Parcial" } } } },
      "/importacoes/geafin/sessoes": { post: { summary: "Criar sessao GEAFIN em modo previa", responses: { 201: { description: "Criado" } } } },
      "/importacoes/geafin/{id}": { get: { summary: "Detalhar sessao GEAFIN", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } } },
      "/importacoes/geafin/{id}/acoes": { get: { summary: "Listar acoes planejadas da sessao GEAFIN", responses: { 200: { description: "OK" } } } },
      "/importacoes/geafin/{id}/acoes/{acaoId}/decisao": { post: { summary: "Aprovar/rejeitar acao individual (modo incremental)", responses: { 200: { description: "OK" } } } },
      "/importacoes/geafin/{id}/acoes/decisao-lote": { post: { summary: "Aplicar decisao em lote (modo incremental)", responses: { 200: { description: "OK" } } } },
      "/importacoes/geafin/{id}/aplicar": { post: { summary: "Aplicar sessao GEAFIN (com backup automatico)", responses: { 200: { description: "OK" } } } },
      "/importacoes/geafin/ultimo": { get: { summary: "Progresso da ultima sessao/importacao GEAFIN", responses: { 200: { description: "OK" }, 404: { description: "Sem importacao" } } } },
      "/importacoes/geafin/{id}/cancelar": { post: { summary: "Cancelar sessao/importacao GEAFIN", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } } },
      "/movimentar": { post: { summary: "Movimenta bem por transferencia/cautela (tombamento GEAFIN: 10 digitos)", responses: { 201: { description: "Criado" }, 409: { description: "Bloqueado por inventario" } } } },
      "/movimentar/lote": { post: { summary: "Movimenta bens em lote por transferencia/cautela", responses: { 200: { description: "Processado" }, 202: { description: "Pendente de aprovacao" } } } },
      "/inventario/eventos": {
        get: { summary: "Listar eventos de inventario", responses: { 200: { description: "OK" } } },
        post: { summary: "Criar evento de inventario (EM_ANDAMENTO)", responses: { 201: { description: "Criado" } } },
      },
      "/inventario/eventos/{id}/status": {
        patch: { summary: "Atualizar status do evento de inventario (reabrir/encerrar/cancelar)", responses: { 200: { description: "OK" } } },
      },
      "/inventario/contagens": {
        get: { summary: "Listar contagens de inventario (por evento/sala)", responses: { 200: { description: "OK" } } },
      },
      "/inventario/divergencias-interunidades": {
        get: { summary: "Listar divergencias interunidades com visibilidade cruzada", responses: { 200: { description: "OK" } } },
      },
      "/inventario/forasteiros": {
        get: { summary: "Listar divergencias pendentes (forasteiros) para regularizacao", responses: { 200: { description: "OK" } } },
      },
      "/inventario/indicadores-acuracidade": {
        get: { summary: "Consolidar KPIs de acuracidade por periodo (semanal/mensal)", responses: { 200: { description: "OK" } } },
      },
      "/inventario/sync": {
        post: { summary: "Sincronizar contagens (offline-first)", responses: { 200: { description: "OK" }, 409: { description: "Evento nao ativo" } } },
      },
      "/inventario/regularizacoes": {
        post: { summary: "Regularizar divergencia pos-inventario (Art. 185)", responses: { 201: { description: "Criado" }, 409: { description: "Bloqueado/nao encerrado" } } },
      },
      "/fotos/upload": { post: { summary: "Upload foto otimizada para VPS (ADMIN) e persistir URL", responses: { 200: { description: "OK" }, 413: { description: "Foto grande demais" } } } },
    },
  };
}

const server = app.listen(PORT, HOST, () => {
  console.log(`API Patrimonio 2a CJM ouvindo em ${HOST}:${PORT}.`);
});

process.on("SIGINT", async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});

process.on("SIGTERM", async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});
