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
const TOMBAMENTO_GEAFIN_RE = /^\d{10}$/;
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
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
  }),
);
app.use(express.json({ limit: "12mb" }));

// --- Servir fotos salvas localmente (VPS) ---
const FOTOS_DIR = path.join(__dirname, "data", "fotos");
fs.mkdirSync(path.join(FOTOS_DIR, "bem"), { recursive: true });
fs.mkdirSync(path.join(FOTOS_DIR, "catalogo"), { recursive: true });
app.use("/fotos", express.static(FOTOS_DIR, { maxAge: "7d", immutable: true }));
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

    req.user = perfil;
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

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi()));
app.get("/", (_req, res) => res.json({ status: "ok", docs: "/docs" }));

app.get("/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", requestId: req.requestId, authEnabled: AUTH_ENABLED });
  } catch (error) {
    next(error);
  }
});

app.get("/importacoes/geafin/ultimo", mustAdmin, async (req, res, next) => {
  try {
    const r = await pool.query(
      `WITH ultimo AS (
         SELECT id, request_id, original_filename, content_sha256, bytes, delimiter,
                imported_em, total_linhas, status, finalizado_em, erro_resumo
         FROM public.geafin_import_arquivos
         ORDER BY imported_em DESC
         LIMIT 1
       ),
       cont AS (
         SELECT arquivo_id,
                COUNT(*)::int AS linhas_inseridas,
                 COUNT(*) FILTER (WHERE persistencia_ok)::int AS persistencia_ok,
                 COUNT(*) FILTER (WHERE persistencia_ok = FALSE AND normalizacao_ok)::int AS falha_persistencia,
                 COUNT(*) FILTER (WHERE normalizacao_ok = FALSE)::int AS falha_normalizacao,
                 MAX(created_at) AS ultima_atualizacao_em
         FROM public.geafin_import_linhas
         WHERE arquivo_id = (SELECT id FROM ultimo)
         GROUP BY arquivo_id
       )
        SELECT
          u.id,
          u.request_id AS "requestId",
          u.original_filename AS "originalFilename",
          u.content_sha256 AS "contentSha256",
          u.bytes,
          u.delimiter,
          u.imported_em AS "importedEm",
          u.total_linhas AS "totalLinhas",
          u.status,
          u.finalizado_em AS "finalizadoEm",
          u.erro_resumo AS "erroResumo",
          COALESCE(c.linhas_inseridas, 0) AS "linhasInseridas",
          COALESCE(c.persistencia_ok, 0) AS "persistenciaOk",
          COALESCE(c.falha_persistencia, 0) AS "falhaPersistencia",
          COALESCE(c.falha_normalizacao, 0) AS "falhaNormalizacao",
          c.ultima_atualizacao_em AS "ultimaAtualizacaoEm"
        FROM ultimo u
        LEFT JOIN cont c ON c.arquivo_id = u.id;`,
    );

    const row = r.rows[0];
    if (!row?.id) {
      res.status(404).json({ requestId: req.requestId, error: { code: "SEM_IMPORTACAO", message: "Nenhuma importacao GEAFIN registrada." } });
      return;
    }

    const total = row.totalLinhas ? Number(row.totalLinhas) : null;
    const done = Number(row.linhasInseridas || 0);
    const percent = total && total > 0 ? Math.min(100, Math.round((done / total) * 1000) / 10) : null;

    res.json({
      requestId: req.requestId,
      importacao: {
        ...row,
        percent,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Cancela a ultima importacao GEAFIN (marcando como ERRO) para destravar UI.
 * Restrito a ADMIN.
 *
 * Regra operacional:
 * - Nao remove dados ja importados (raw/staging e operacional). Apenas encerra o processo.
 * - A importacao em execucao deve checar o status a cada lote (ver /importar-geafin) e parar.
 */
app.post("/importacoes/geafin/:id/cancelar", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "IMPORTACAO_ID_INVALIDO", "id deve ser UUID.");

    const r = await pool.query(
      `UPDATE public.geafin_import_arquivos
       SET status = 'ERRO', finalizado_em = NOW(),
           erro_resumo = COALESCE(NULLIF($2, ''), 'Cancelada pelo usuario.')
       WHERE id = $1
       RETURNING id, status, finalizado_em AS "finalizadoEm", erro_resumo AS "erroResumo";`,
      [id, String(req.body?.motivo || "").trim().slice(0, 2000)],
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
      where.push(`b.numero_tombamento = $${i}`);
      params.push(filters.numeroTombamento);
      i += 1;
    }
    if (filters.texto) {
      // Normalizacao (SKU vs Item): a descricao canonica pertence ao catalogo_bens.
      // Mantemos descricao_complementar como campo opcional para anotacoes locais.
      where.push(`(cb.descricao ILIKE $${i} OR b.descricao_complementar ILIKE $${i})`);
      params.push(`%${filters.texto}%`);
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

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countSql = `SELECT COUNT(*)::int AS total FROM bens b JOIN catalogo_bens cb ON cb.id = b.catalogo_bem_id ${whereSql};`;
    const count = await pool.query(countSql, params);
    const total = count.rows[0]?.total ?? 0;

    const listSql = `
      SELECT
        b.id,
        b.numero_tombamento AS "numeroTombamento",
        COALESCE(NULLIF(b.descricao_complementar, ''), cb.descricao) AS "descricao",
        b.catalogo_bem_id AS "catalogoBemId",
        cb.descricao AS "catalogoDescricao",
        b.unidade_dona_id AS "unidadeDonaId",
        b.local_fisico AS "localFisico",
        b.status::text AS "status",
        b.eh_bem_terceiro AS "ehBemTerceiro"
      FROM bens b
      JOIN catalogo_bens cb ON cb.id = b.catalogo_bem_id
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

app.get("/bens/:id", mustAuth, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(400, "BEM_ID_INVALIDO", "id deve ser UUID valido.");

    const bem = await pool.query(
      `SELECT
         b.id,
         b.numero_tombamento AS "numeroTombamento",
         b.identificador_externo AS "identificadorExterno",
         b.descricao_complementar AS "descricaoComplementar",
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
         p.nome AS "responsavelNome"
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
         id,
         tipo_movimentacao AS "tipoMovimentacao",
         status::text AS "status",
         unidade_origem_id AS "unidadeOrigemId",
         unidade_destino_id AS "unidadeDestinoId",
         detentor_temporario_perfil_id AS "detentorTemporarioPerfilId",
         data_prevista_devolucao AS "dataPrevistaDevolucao",
         data_efetiva_devolucao AS "dataEfetivaDevolucao",
         termo_referencia AS "termoReferencia",
         justificativa,
         autorizada_por_perfil_id AS "autorizadaPorPerfilId",
         autorizada_em AS "autorizadaEm",
         executada_por_perfil_id AS "executadaPorPerfilId",
         executada_em AS "executadaEm",
         created_at AS "createdAt"
       FROM movimentacoes
       WHERE bem_id = $1
       ORDER BY created_at DESC
       LIMIT 20;`,
      [id],
    );

    const historicoTransferencias = await pool.query(
      `SELECT
         id,
         unidade_antiga_id AS "unidadeAntigaId",
         unidade_nova_id AS "unidadeNovaId",
         usuario_id AS "usuarioId",
         data,
         origem::text AS "origem"
       FROM historico_transferencias
       WHERE bem_id = $1
       ORDER BY data DESC
       LIMIT 20;`,
      [id],
    );

    res.json({
      requestId: req.requestId,
      bem: {
        id: row.id,
        numeroTombamento: row.numeroTombamento,
        identificadorExterno: row.identificadorExterno,
        descricaoComplementar: row.descricaoComplementar,
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
      movimentacoes: movimentacoes.rows,
      historicoTransferencias: historicoTransferencias.rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/perfis", mustAdmin, async (req, res, next) => {
  try {
    const limit = parseIntOrDefault(req.query?.limit, 50);
    const limitFinal = Math.max(1, Math.min(200, limit));

    const r = await pool.query(
      `SELECT id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo,
              senha_definida_em AS "senhaDefinidaEm", ultimo_login_em AS "ultimoLoginEm",
              created_at AS "createdAt"
       FROM perfis
       ORDER BY created_at DESC
       LIMIT $1;`,
      [limitFinal],
    );

    res.json({ requestId: req.requestId, items: r.rows });
  } catch (error) {
    next(error);
  }
});

app.post("/perfis", mustAdmin, async (req, res, next) => {
  try {
    const p = validatePerfil(req.body || {});
    const senhaHash = p.senha ? await bcrypt.hash(p.senha, 10) : null;
    const r = await pool.query(
      `INSERT INTO perfis (matricula, nome, email, unidade_id, cargo, ativo, role, senha_hash, senha_definida_em)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6,$7,CASE WHEN $7 IS NULL THEN NULL ELSE NOW() END)
       RETURNING id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo, created_at AS "createdAt";`,
      [p.matricula, p.nome, p.email, p.unidadeId, p.cargo, p.role, senhaHash],
    );
    res.status(201).json({ requestId: req.requestId, perfil: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * Atualiza perfil (ADMIN).
 * Regra operacional: usado para corrigir cadastro/role, desativar usuarios e resetar senha via endpoint dedicado.
 */
app.patch("/perfis/:id", mustAdmin, async (req, res, next) => {
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
    const r = await pool.query(
      `UPDATE perfis
       SET ${fields.join(", ")}
       WHERE id = $${i}
       RETURNING id, matricula, nome, email, unidade_id AS "unidadeId", cargo, role, ativo,
                 senha_definida_em AS "senhaDefinidaEm", ultimo_login_em AS "ultimoLoginEm",
                 created_at AS "createdAt";`,
      [...params, id],
    );
    if (!r.rowCount) throw new HttpError(404, "PERFIL_NAO_ENCONTRADO", "Perfil nao encontrado.");

    res.json({ requestId: req.requestId, perfil: r.rows[0] });
  } catch (error) {
    next(error);
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
  try {
    const p = validateMov(req.body || {}, { defaultPerfilId: req.user?.id || "" });

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
    await client.query("COMMIT");
    res.status(201).json({
      message: "Movimentacao registrada com sucesso.",
      requestId: req.requestId,
      movimentacao: out.mov,
      bem: out.bem,
    });
  } catch (error) {
    await safeRollback(client);
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
app.get("/inventario/contagens", mustAuth, inventario.getContagens);
app.get("/inventario/forasteiros", mustAuth, inventario.getForasteiros);
app.get("/inventario/bens-terceiros", mustAuth, inventario.getBensTerceiros);
app.get("/inventario/eventos/:id/progresso", mustAuth, inventario.getProgresso);
app.post("/inventario/eventos", mustAuth, inventario.postEvento);
app.patch("/inventario/eventos/:id/status", mustAuth, inventario.patchEventoStatus);
app.post("/inventario/sync", mustAuth, inventario.postSync);
app.post("/inventario/bens-terceiros", mustAuth, inventario.postBemTerceiro);
app.post("/inventario/regularizacoes", mustAdmin, inventario.postRegularizacao);

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
      where.push(`movimentacao_id = $${i}`);
      params.push(movimentacaoId);
      i += 1;
    }
    if (contagemId) {
      where.push(`contagem_id = $${i}`);
      params.push(contagemId);
      i += 1;
    }

    const supportsAvaliacao = await documentosHasAvaliacaoInservivelIdColumn();
    if (supportsAvaliacao && avaliacaoInservivelId) {
      where.push(`avaliacao_inservivel_id = $${i}`);
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
       LIMIT 500;`,
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
      `INSERT INTO documentos (
         tipo, titulo, movimentacao_id, contagem_id, ${supportsAvaliacao ? "avaliacao_inservivel_id," : ""} termo_referencia,
         arquivo_nome, mime, bytes, sha256, drive_file_id, drive_url,
         gerado_por_perfil_id, observacoes
       ) VALUES (
         $1::public.tipo_documento, $2, $3, $4, ${supportsAvaliacao ? "$5," : ""} $${supportsAvaliacao ? 6 : 5},
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
         gerado_em AS "geradoEm";`,
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
         updated_at AS "updatedAt";`,
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

    const bemR = await client.query(`SELECT id, numero_tombamento, status::text AS status FROM bens WHERE id = $1 FOR UPDATE;`, [bemId]);
    if (!bemR.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");

    const ins = await client.query(
      `INSERT INTO avaliacoes_inserviveis (
         bem_id, tipo_inservivel, descricao_informada, justificativa, criterios, avaliado_por_perfil_id
       ) VALUES (
         $1,$2::public.tipo_inservivel,$3,$4,$5,$6
       )
       RETURNING id, bem_id AS "bemId", tipo_inservivel::text AS "tipoInservivel", avaliado_em AS "avaliadoEm";`,
      [bemId, tipo, descricaoInformada, justificativa, criterios ? JSON.stringify(criterios) : null, req.user?.id || null],
    );

    await client.query(
      `UPDATE bens SET tipo_inservivel = $2::public.tipo_inservivel, updated_at = NOW() WHERE id = $1;`,
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
       LIMIT 50;`,
      [bemId],
    );

    res.json({ requestId: req.requestId, items: r.rows });
  } catch (error) {
    next(error);
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
      where.push(`unidade_id = $${i}`);
      params.push(unidadeId);
      i += 1;
    }
    // Quando a coluna `ativo` existe (014), por padrao listamos apenas ativos.
    // Mantemos compatibilidade: se a coluna ainda nao existir, a query vai falhar e o handler devolve erro explicativo.
    if (!includeInativos) {
      where.push(`ativo = TRUE`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const r = await pool.query(
      `SELECT id, nome, unidade_id AS "unidadeId", tipo, observacoes, ativo
       FROM locais
       ${whereSql}
       ORDER BY nome ASC
       LIMIT 2000;`,
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
           RETURNING id, nome, unidade_id AS "unidadeId", tipo, observacoes, ativo;`,
        [existing.rows[0].id, unidadeId, tipo, observacoes, ativo],
      )
      : await client.query(
        `INSERT INTO locais (nome, unidade_id, tipo, observacoes)
           VALUES ($1,$2,$3,$4)
           RETURNING id, nome, unidade_id AS "unidadeId", tipo, observacoes, ativo;`,
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
      fields.push(`nome = $${i}`);
      params.push(patch.nome);
      i += 1;
    }
    if (patch.unidadeId !== undefined) {
      fields.push(`unidade_id = $${i}`);
      params.push(patch.unidadeId);
      i += 1;
    }
    if (patch.tipo !== undefined) {
      fields.push(`tipo = $${i}`);
      params.push(patch.tipo);
      i += 1;
    }
    if (patch.observacoes !== undefined) {
      fields.push(`observacoes = $${i}`);
      params.push(patch.observacoes);
      i += 1;
    }
    if (patch.ativo !== undefined) {
      fields.push(`ativo = $${i}`);
      params.push(patch.ativo);
      i += 1;
    }

    if (!fields.length) throw new HttpError(422, "PATCH_VAZIO", "Envie ao menos um campo para atualizar.");

    const r = await pool.query(
      `UPDATE locais
       SET ${fields.join(", ")}
       WHERE id = $${i}
       RETURNING id, nome, unidade_id AS "unidadeId", tipo, observacoes, ativo;`,
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
       LIMIT $1;`,
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

/**
 * Atualiza localizacao e fotos de um bem (camada operacional melhorada).
 * Restrito a ADMIN (quando auth ativa).
 */
app.patch("/bens/:id/operacional", mustAdmin, async (req, res, next) => {
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "BEM_ID_INVALIDO", "id deve ser UUID.");

    const body = req.body || {};
    const localFisico = body.localFisico != null ? String(body.localFisico).trim().slice(0, 180) : null;
    const localId = body.localId != null && String(body.localId).trim() !== "" ? String(body.localId).trim() : null;
    if (localId && !UUID_RE.test(localId)) throw new HttpError(422, "LOCAL_ID_INVALIDO", "localId deve ser UUID.");

    const fotoUrl = body.fotoUrl != null ? String(body.fotoUrl).trim().slice(0, 2000) : null;

    const r = await pool.query(
      `UPDATE bens
       SET
         local_fisico = COALESCE($2, local_fisico),
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

    res.json({ requestId: req.requestId, bem: r.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Helper para deletar foto local
function deleteLocalFoto(relUrl) {
  if (!relUrl || !relUrl.startsWith("/fotos/")) return;
  try {
    const filePath = path.join(__dirname, "data", relUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[DELETE] Foto removida: ${filePath}`);
    }
  } catch (err) {
    console.error(`[DELETE ERROR] Falha ao remover ${relUrl}:`, err);
  }
}

/**
 * Atualiza dados do bem (admin) exceto chaves de identificacao.
 *
 * Regras:
 * - Nao permite alterar: id, numero_tombamento, identificador_externo, eh_bem_terceiro.
 * - Mudanca de carga (unidade_dona_id) segue regras legais: Art. 183 bloqueia durante EM_ANDAMENTO.
 */
app.patch("/bens/:id", mustAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = String(req.params?.id || "").trim();
    if (!UUID_RE.test(id)) throw new HttpError(422, "BEM_ID_INVALIDO", "id deve ser UUID.");

    const body = req.body || {};
    if (Object.prototype.hasOwnProperty.call(body, "numeroTombamento") || Object.prototype.hasOwnProperty.call(body, "numero_tombamento")) {
      throw new HttpError(422, "CHAVE_IMUTAVEL", "numeroTombamento e imutavel.");
    }
    if (Object.prototype.hasOwnProperty.call(body, "identificadorExterno") || Object.prototype.hasOwnProperty.call(body, "identificador_externo")) {
      throw new HttpError(422, "CHAVE_IMUTAVEL", "identificadorExterno e imutavel.");
    }
    if (Object.prototype.hasOwnProperty.call(body, "ehBemTerceiro") || Object.prototype.hasOwnProperty.call(body, "eh_bem_terceiro")) {
      throw new HttpError(422, "CHAVE_IMUTAVEL", "ehBemTerceiro e imutavel.");
    }

    const patch = {};

    if (Object.prototype.hasOwnProperty.call(body, "catalogoBemId")) {
      const catalogoBemId = body.catalogoBemId != null ? String(body.catalogoBemId).trim() : "";
      if (!UUID_RE.test(catalogoBemId)) throw new HttpError(422, "CATALOGO_ID_INVALIDO", "catalogoBemId deve ser UUID.");
      patch.catalogoBemId = catalogoBemId;
    }

    if (Object.prototype.hasOwnProperty.call(body, "descricaoComplementar")) {
      patch.descricaoComplementar = body.descricaoComplementar != null ? String(body.descricaoComplementar).trim().slice(0, 2000) : null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "unidadeDonaId")) {
      const unidadeDonaId = body.unidadeDonaId != null && String(body.unidadeDonaId).trim() !== "" ? Number(body.unidadeDonaId) : null;
      if (unidadeDonaId == null || !Number.isInteger(unidadeDonaId) || !VALID_UNIDADES.has(unidadeDonaId)) {
        throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeDonaId deve ser 1..4.");
      }
      patch.unidadeDonaId = unidadeDonaId;
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
      patch.status = status;
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

    const fields = [];
    const params = [];
    let i = 1;

    if (patch.catalogoBemId != null) {
      fields.push(`catalogo_bem_id = $${i}`);
      params.push(patch.catalogoBemId);
      i += 1;
    }
    if (patch.descricaoComplementar !== undefined) {
      fields.push(`descricao_complementar = $${i}`);
      params.push(patch.descricaoComplementar);
      i += 1;
    }
    if (patch.unidadeDonaId != null) {
      fields.push(`unidade_dona_id = $${i}`);
      params.push(patch.unidadeDonaId);
      i += 1;
    }
    if (patch.responsavelPerfilId !== undefined) {
      fields.push(`responsavel_perfil_id = $${i}`);
      params.push(patch.responsavelPerfilId);
      i += 1;
    }
    if (patch.localFisico !== undefined) {
      fields.push(`local_fisico = $${i}`);
      params.push(patch.localFisico);
      i += 1;
    }
    if (patch.localId !== undefined) {
      fields.push(`local_id = $${i}`);
      params.push(patch.localId);
      i += 1;
    }
    if (patch.status != null) {
      fields.push(`status = $${i}::public.status_bem`);
      params.push(patch.status);
      i += 1;
    }
    if (patch.tipoInservivel !== undefined) {
      fields.push(`tipo_inservivel = $${i}::public.tipo_inservivel`);
      params.push(patch.tipoInservivel);
      i += 1;
    }
    if (patch.contratoReferencia !== undefined) {
      fields.push(`contrato_referencia = $${i}`);
      params.push(patch.contratoReferencia);
      i += 1;
    }
    if (patch.dataAquisicao !== undefined) {
      fields.push(`data_aquisicao = $${i}`);
      params.push(patch.dataAquisicao);
      i += 1;
    }
    if (patch.valorAquisicao !== undefined) {
      fields.push(`valor_aquisicao = $${i}`);
      params.push(patch.valorAquisicao);
      i += 1;
    }
    if (patch.fotoUrl !== undefined) {
      fields.push(`foto_url = $${i}`);
      params.push(patch.fotoUrl);
      i += 1;

      // Se a foto mudou, deletar a antiga
      const currentFoto = await client.query("SELECT foto_url FROM bens WHERE id = $1", [id]);
      if (currentFoto.rows[0]?.foto_url && currentFoto.rows[0].foto_url !== patch.fotoUrl) {
        deleteLocalFoto(currentFoto.rows[0].foto_url);
      }
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
         foto_url AS "fotoUrl",
         updated_at AS "updatedAt";`,
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
      const r = await pool.query(
        `UPDATE bens SET foto_url = $2, updated_at = NOW() WHERE id = $1
         RETURNING id, foto_url AS "fotoUrl", updated_at AS "updatedAt";`,
        [id, fotoUrl],
      );
      if (!r.rowCount) throw new HttpError(404, "BEM_NAO_ENCONTRADO", "Bem nao encontrado.");
      res.json({ requestId: req.requestId, fotoUrl, sizeKb, bem: r.rows[0] });
      return;
    }

    const r = await pool.query(
      `UPDATE catalogo_bens SET foto_referencia_url = $2, updated_at = NOW() WHERE id = $1
       RETURNING id, foto_referencia_url AS "fotoReferenciaUrl", updated_at AS "updatedAt";`,
      [id, fotoUrl],
    );
    if (!r.rowCount) throw new HttpError(404, "CATALOGO_NAO_ENCONTRADO", "Catalogo nao encontrado.");
    res.json({ requestId: req.requestId, fotoUrl, sizeKb, catalogo: r.rows[0] });
  } catch (error) {
    next(error);
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
app.post("/bens/vincular-local", mustAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const localId = body.localId != null ? String(body.localId).trim() : "";
    if (!UUID_RE.test(localId)) throw new HttpError(422, "LOCAL_ID_INVALIDO", "localId deve ser UUID.");

    const termo = body.termoLocalFisico != null ? String(body.termoLocalFisico).trim().slice(0, 180) : "";
    if (termo.length < 2) throw new HttpError(422, "TERMO_OBRIGATORIO", "termoLocalFisico deve ter pelo menos 2 caracteres.");

    const somenteSemLocalId = parseBool(body.somenteSemLocalId, true);
    const dryRun = parseBool(body.dryRun, false);

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

    if (somenteSemLocalId) {
      where.push("local_id IS NULL");
    }
    if (unidadeRaw != null) {
      where.push(`unidade_dona_id = $${i}`);
      params.push(unidadeRaw);
      i += 1;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const preview = await pool.query(
      `SELECT id, numero_tombamento AS "numeroTombamento", local_fisico AS "localFisico", local_id AS "localId"
       FROM bens
       ${whereSql}
       ORDER BY numero_tombamento NULLS LAST
       LIMIT 10;`,
      params,
    );

    const total = await pool.query(`SELECT COUNT(*)::int AS total FROM bens ${whereSql};`, params);
    const totalAlvo = total.rows[0]?.total ?? 0;

    if (dryRun) {
      res.json({
        requestId: req.requestId,
        dryRun: true,
        totalAlvo,
        exemplo: preview.rows,
      });
      return;
    }

    const upd = await pool.query(
      `UPDATE bens
       SET local_id = $${i}, updated_at = NOW()
       ${whereSql}
       RETURNING id;`,
      [...params, localId],
    );

    res.json({
      requestId: req.requestId,
      dryRun: false,
      totalAlvo,
      atualizados: upd.rowCount || 0,
      exemplo: preview.rows,
    });
  } catch (error) {
    next(error);
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

app.use((error, req, res, _next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({ error: { code: "UPLOAD_INVALIDO", message: "Falha no upload do arquivo." }, requestId: req.requestId });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details }, requestId: req.requestId });
    return;
  }
  // Erros comuns de "migracao pendente": ajudam o operador a corrigir sem precisar ler logs.
  if (error?.code === "42P01") {
    const msg = String(error?.message || "");
    if (msg.includes("relation \"locais\"") || msg.includes("relation \"public.locais\"")) {
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
    res.status(422).json({ error: { code: "VIOLACAO_REGRA_NEGOCIO", message: "Violacao de regra de negocio." }, requestId: req.requestId });
    return;
  }
  if (error?.code === "22P02") {
    res.status(400).json({ error: { code: "FORMATO_INVALIDO", message: "Formato invalido em campo enviado." }, requestId: req.requestId });
    return;
  }
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
  let autorizadaPorPerfilId = body.autorizadaPorPerfilId ? String(body.autorizadaPorPerfilId).trim() : null;
  let executadaPorPerfilId = body.executadaPorPerfilId ? String(body.executadaPorPerfilId).trim() : null;
  const dataPrevistaDevolucao = parseDateOnly(body.dataPrevistaDevolucao);
  const dataEfetivaDevolucao = parseDateTime(body.dataEfetivaDevolucao) || new Date();
  const justificativa = body.justificativa ? String(body.justificativa).trim() : null;

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
    if (!dataPrevistaDevolucao) throw new HttpError(422, "DATA_DEVOLUCAO_OBRIGATORIA", "dataPrevistaDevolucao e obrigatoria para CAUTELA_SAIDA.");
  }

  return {
    tipoMovimentacao,
    bemId,
    numeroTombamento,
    termoReferencia,
    unidadeDestinoId,
    detentorTemporarioPerfilId,
    dataPrevistaDevolucao,
    dataEfetivaDevolucao,
    autorizadaPorPerfilId,
    executadaPorPerfilId,
    justificativa,
  };
}

/**
 * Valida query de listagem/consulta de bens.
 * @param {object} query Query string bruta do Express.
 * @returns {{numeroTombamento: string|null, texto: string|null, localFisico: string|null, localId: string|null, unidadeDonaId: number|null, status: string|null, limit: number, offset: number, incluirTerceiros: boolean}} Filtros validados.
 */
function validateBensQuery(query) {
  const numeroTombamento = normalizeTombamento(query.numeroTombamento || query.tombamento);
  if (numeroTombamento && !TOMBAMENTO_GEAFIN_RE.test(numeroTombamento)) {
    throw new HttpError(422, "TOMBAMENTO_INVALIDO", "numeroTombamento deve ter 10 digitos numericos (ex.: 1290001788).");
  }

  const texto = query.q ? String(query.q).trim() : null;
  const textoFinal = texto && texto.length ? texto.slice(0, 120) : null;

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

  const limit = parseIntOrDefault(query.limit, 50);
  if (limit < 1 || limit > 5000) throw new HttpError(422, "LIMIT_INVALIDO", "limit deve estar entre 1 e 5000.");
  const offset = parseIntOrDefault(query.offset, 0);
  if (offset < 0) throw new HttpError(422, "OFFSET_INVALIDO", "offset deve ser >= 0.");

  const incluirTerceiros = parseBool(query.incluirTerceiros, false);

  return { numeroTombamento, texto: textoFinal, localFisico, localId, unidadeDonaId, status, limit, offset, incluirTerceiros };
}

/**
 * Valida payload de criacao de perfil.
 * @param {object} body Body JSON da requisicao.
 * @returns {{matricula: string, nome: string, email: string|null, unidadeId: number, cargo: string|null, role: string, senha: (string|null)}} Perfil validado.
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

  const senhaRaw = body.senha != null ? String(body.senha) : "";
  const senha = senhaRaw ? senhaRaw : null;
  if (senha && senha.length < 8) throw new HttpError(422, "SENHA_FRACA", "Senha deve ter pelo menos 8 caracteres.");

  return { matricula, nome, email, unidadeId, cargo, role, senha };
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
      `UPDATE bens SET status = 'EM_CAUTELA', updated_at = NOW()
       WHERE id = $1
       RETURNING id, numero_tombamento, unidade_dona_id, status`,
      [bem.id],
    );
    bemAtualizado = q.rows[0];
  } else {
    if (bem.status !== "EM_CAUTELA") throw new HttpError(422, "RETORNO_INVALIDO", "CAUTELA_RETORNO exige bem em EM_CAUTELA.");
    const q = await client.query(
      `UPDATE bens SET status = 'OK', updated_at = NOW()
       WHERE id = $1
       RETURNING id, numero_tombamento, unidade_dona_id, status`,
      [bem.id],
    );
    bemAtualizado = q.rows[0];
  }

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
      p.justificativa,
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

function normalizeGeafin(raw, rowNo, fallbackUnit) {
  const row = {};
  for (const [k, v] of Object.entries(raw || {})) row[normalizeKey(k)] = v == null ? "" : String(v).trim();

  const numeroTombamento = normalizeTombamento(
    pick(row, ["numero_tombamento", "tombamento", "nr_tombamento", "num_tombamento", "tombo", "chapa"]),
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
        local_fisico, status, valor_aquisicao, eh_bem_terceiro
      ) VALUES ($1,$2,$3,NULL,'AGUARDANDO_RECEBIMENTO',$6,FALSE)
      ON CONFLICT (numero_tombamento) WHERE numero_tombamento IS NOT NULL
      DO UPDATE SET
        catalogo_bem_id = EXCLUDED.catalogo_bem_id,
        unidade_dona_id = EXCLUDED.unidade_dona_id,
        local_fisico = $4,
        status = $5::public.status_bem,
        valor_aquisicao = COALESCE($6, bens.valor_aquisicao),
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS inserted, unidade_dona_id AS unidade_nova_id
    )
    SELECT
      upsert.id,
      upsert.inserted,
      (NOT upsert.inserted) AND (existing.unidade_antiga_id IS DISTINCT FROM upsert.unidade_nova_id) AS "unidadeChanged"
    FROM upsert
    LEFT JOIN existing ON existing.id = upsert.id;`,
    [d.numeroTombamento, catId, d.unidadeDonaId, d.localFisico, d.status, d.valorAquisicao],
  );
  return r.rows[0];
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
      "/locais": {
        get: { summary: "Listar locais/salas padronizados (query: unidadeId, includeInativos)", responses: { 200: { description: "OK" } } },
        post: { summary: "Criar/atualizar local (ADMIN)", responses: { 201: { description: "Criado/atualizado" } } },
      },
      "/locais/{id}": { patch: { summary: "Atualizar local por id (ADMIN)", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } } },
      "/perfis": { get: { summary: "Listagem basica de perfis", responses: { 200: { description: "OK" } } }, post: { summary: "Criacao de perfil", responses: { 201: { description: "Criado" } } } },
      "/perfis/{id}": { patch: { summary: "Atualizar perfil (ADMIN)", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } } },
      "/perfis/{id}/reset-senha": { post: { summary: "Resetar senha (ADMIN) para permitir primeiro acesso novamente", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } } },
      "/importar-geafin": { post: { summary: "Importacao CSV GEAFIN", responses: { 200: { description: "Sucesso" }, 207: { description: "Parcial" } } } },
      "/importacoes/geafin/ultimo": { get: { summary: "Progresso da ultima importacao GEAFIN (para barra de progresso na UI)", responses: { 200: { description: "OK" }, 404: { description: "Sem importacao" } } } },
      "/importacoes/geafin/{id}/cancelar": { post: { summary: "Cancelar importacao GEAFIN (marca como ERRO)", responses: { 200: { description: "OK" }, 404: { description: "Nao encontrado" } } } },
      "/movimentar": { post: { summary: "Movimenta bem por transferencia/cautela (tombamento GEAFIN: 10 digitos)", responses: { 201: { description: "Criado" }, 409: { description: "Bloqueado por inventario" } } } },
      "/inventario/eventos": {
        get: { summary: "Listar eventos de inventario", responses: { 200: { description: "OK" } } },
        post: { summary: "Criar evento de inventario (EM_ANDAMENTO)", responses: { 201: { description: "Criado" } } },
      },
      "/inventario/eventos/{id}/status": {
        patch: { summary: "Encerrar/cancelar evento de inventario", responses: { 200: { description: "OK" } } },
      },
      "/inventario/contagens": {
        get: { summary: "Listar contagens de inventario (por evento/sala)", responses: { 200: { description: "OK" } } },
      },
      "/inventario/forasteiros": {
        get: { summary: "Listar divergencias pendentes (forasteiros) para regularizacao", responses: { 200: { description: "OK" } } },
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
