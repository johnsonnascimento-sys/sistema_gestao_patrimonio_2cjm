/**
 * Modulo: backend/src/controllers
 * Arquivo: inventarioController.js
 * Funcao no sistema: endpoints de inventario (eventos + sincronizacao de contagens) com compliance ATN 303/2008.
 */
"use strict";

/**
 * Cria controladores de inventario com dependencias injetadas.
 * @param {object} deps Dependencias do controlador.
 * @param {import("pg").Pool} deps.pool Pool do Postgres.
 * @param {typeof Error} deps.HttpError Classe de erro HTTP do backend.
 * @param {Set<number>} deps.VALID_UNIDADES Unidades validas (1..4).
 * @param {RegExp} deps.UUID_RE Regex de UUID.
 * @param {RegExp} deps.TOMBAMENTO_GEAFIN_RE Regex de tombamento GEAFIN (10 digitos).
 * @param {(raw: any) => (string|null)} deps.normalizeTombamento Normalizador de tombamento.
 * @param {(client: import("pg").PoolClient, ctx: {changeOrigin?: string|null, currentUserId?: string|null}) => Promise<void>} deps.setDbContext Define contexto de DB para triggers (origem/ator).
 * @param {(client: import("pg").PoolClient) => Promise<void>} deps.safeRollback Rollback seguro.
 * @param {(error: any) => string} deps.dbError Normalizador de erro de banco para mensagem curta.
 * @returns {{getEventos: Function, getContagens: Function, getForasteiros: Function, postEvento: Function, patchEventoStatus: Function, postSync: Function, postBemTerceiro: Function, postRegularizacao: Function}} Handlers Express.
 */
function createInventarioController(deps) {
  const {
    pool,
    HttpError,
    VALID_UNIDADES,
    UUID_RE,
    TOMBAMENTO_GEAFIN_RE,
    normalizeTombamento,
    setDbContext,
    safeRollback,
    dbError,
  } = deps;

  /**
   * Lista eventos de inventario, com filtro opcional por status.
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getEventos(req, res, next) {
    try {
      const status = req.query?.status ? String(req.query.status).trim().toUpperCase() : null;
      const limit = req.query?.limit ? Number(req.query.limit) : 50;
      const limitFinal = Number.isInteger(limit) ? Math.max(1, Math.min(200, limit)) : 50;

      const where = [];
      const params = [];
      let i = 1;

      if (status) {
        where.push(`status = $${i}::public.status_inventario`);
        params.push(status);
        i += 1;
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const r = await pool.query(
        `SELECT
           id,
           codigo_evento AS "codigoEvento",
           unidade_inventariada_id AS "unidadeInventariadaId",
           status::text AS "status",
           iniciado_em AS "iniciadoEm",
           encerrado_em AS "encerradoEm",
           aberto_por_perfil_id AS "abertoPorPerfilId",
           encerrado_por_perfil_id AS "encerradoPorPerfilId",
           observacoes
         FROM eventos_inventario
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${i};`,
        [...params, limitFinal],
      );

      res.json({ requestId: req.requestId, items: r.rows });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista contagens de inventario para um evento, com filtro opcional por sala.
   *
   * Objetivo:
   * - Permitir que a UI calcule "Encontrados vs Faltantes" e apresente checklist por tombamento.
   * - Endpoint somente leitura (nao altera carga nem executa regularizacao).
   *
   * Regra legal: divergencias registradas em contagens nao mudam carga automaticamente.
   * Art. 185 (AN303_Art185).
   *
   * Query params:
   * - eventoInventarioId: UUID (obrigatorio)
   * - salaEncontrada: string (opcional; comparacao case-insensitive + trim)
   * - limit: number (opcional; default 500; max 2000)
   *
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getContagens(req, res, next) {
    try {
      const q = req.query || {};
      const eventoInventarioId = String(q.eventoInventarioId || q.eventoId || "").trim();
      if (!UUID_RE.test(eventoInventarioId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "eventoInventarioId deve ser UUID.");

      const salaRaw = q.salaEncontrada || q.sala || q.local || null;
      const salaEncontrada = salaRaw != null && String(salaRaw).trim() !== ""
        ? String(salaRaw).trim().slice(0, 180)
        : null;

      const limitRaw = q.limit != null ? Number(q.limit) : 500;
      const limit = Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 500;
      const limitFinal = Math.max(1, Math.min(2000, limit));

      const where = ["c.evento_inventario_id = $1"];
      const params = [eventoInventarioId];
      let i = 2;

      if (salaEncontrada) {
        // Comparacao tolerante: ignora maiusculas/minusculas e espacos laterais.
        where.push(`lower(trim(c.sala_encontrada)) = lower(trim($${i}))`);
        params.push(salaEncontrada);
        i += 1;
      }

      const sql = `
        SELECT
          c.id,
          c.evento_inventario_id AS "eventoInventarioId",
          c.sala_encontrada AS "salaEncontrada",
          c.unidade_encontrada_id AS "unidadeEncontradaId",
          c.tipo_ocorrencia::text AS "tipoOcorrencia",
          c.regularizacao_pendente AS "regularizacaoPendente",
          c.regularizado_em AS "regularizadoEm",
          c.regularizado_por_perfil_id AS "regularizadoPorPerfilId",
          c.regularizacao_acao AS "regularizacaoAcao",
          c.regularizacao_movimentacao_id AS "regularizacaoMovimentacaoId",
          c.regularizacao_observacoes AS "regularizacaoObservacoes",
          c.encontrado_em AS "encontradoEm",
          c.encontrado_por_perfil_id AS "encontradoPorPerfilId",
          c.observacoes,
          b.id AS "bemId",
          b.numero_tombamento AS "numeroTombamento",
          b.unidade_dona_id AS "unidadeDonaId"
        FROM contagens c
        JOIN bens b ON b.id = c.bem_id
        WHERE ${where.join(" AND ")}
        ORDER BY c.encontrado_em DESC
        LIMIT $${i};`;

      const r = await pool.query(sql, [...params, limitFinal]);
      res.json({ requestId: req.requestId, items: r.rows });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista "forasteiros" (divergencias pendentes) para regularizacao pos-inventario.
   *
   * Regra legal:
   * - Divergencias/intrusos nao mudam carga automaticamente.
   *   Art. 185 (AN303_Art185).
   *
   * Query params:
   * - eventoInventarioId: UUID (opcional)
   * - salaEncontrada: string (opcional)
   * - numeroTombamento: string (opcional; 10 digitos)
   * - limit: number (opcional; default 200; max 2000)
   *
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getForasteiros(req, res, next) {
    try {
      const q = req.query || {};
      const eventoInventarioId = q.eventoInventarioId != null && String(q.eventoInventarioId).trim() !== ""
        ? String(q.eventoInventarioId).trim()
        : null;
      if (eventoInventarioId && !UUID_RE.test(eventoInventarioId)) {
        throw new HttpError(422, "EVENTO_ID_INVALIDO", "eventoInventarioId deve ser UUID.");
      }

      const salaRaw = q.salaEncontrada || q.sala || q.local || null;
      const salaEncontrada = salaRaw != null && String(salaRaw).trim() !== ""
        ? String(salaRaw).trim().slice(0, 180)
        : null;

      const numeroTombamento = q.numeroTombamento != null && String(q.numeroTombamento).trim() !== ""
        ? normalizeTombamento(q.numeroTombamento)
        : null;
      if (numeroTombamento && !TOMBAMENTO_GEAFIN_RE.test(numeroTombamento)) {
        throw new HttpError(422, "TOMBAMENTO_INVALIDO", "numeroTombamento deve conter 10 digitos (GEAFIN).");
      }

      const limitRaw = q.limit != null ? Number(q.limit) : 200;
      const limit = Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 200;
      const limitFinal = Math.max(1, Math.min(2000, limit));

      const where = ["1=1"];
      const params = [];
      let i = 1;

      if (eventoInventarioId) {
        where.push(`f.evento_inventario_id = $${i}`);
        params.push(eventoInventarioId);
        i += 1;
      }
      if (salaEncontrada) {
        where.push(`lower(trim(f.sala_encontrada)) = lower(trim($${i}))`);
        params.push(salaEncontrada);
        i += 1;
      }
      if (numeroTombamento) {
        where.push(`f.numero_tombamento = $${i}`);
        params.push(numeroTombamento);
        i += 1;
      }

      const sql = `
        SELECT
          f.contagem_id AS "contagemId",
          f.evento_inventario_id AS "eventoInventarioId",
          f.codigo_evento AS "codigoEvento",
          f.status_inventario::text AS "statusInventario",
          f.unidade_inventariada_id AS "unidadeInventariadaId",
          f.bem_id AS "bemId",
          f.numero_tombamento AS "numeroTombamento",
          b.catalogo_bem_id AS "catalogoBemId",
          cb.codigo_catalogo AS "codigoCatalogo",
          cb.descricao AS "catalogoDescricao",
          f.unidade_dona_id AS "unidadeDonaId",
          f.unidade_encontrada_id AS "unidadeEncontradaId",
          f.sala_encontrada AS "salaEncontrada",
          f.encontrado_em AS "encontradoEm",
          f.encontrado_por_perfil_id AS "encontradoPorPerfilId",
          f.observacoes
        FROM public.vw_forasteiros f
        JOIN public.bens b ON b.id = f.bem_id
        JOIN public.catalogo_bens cb ON cb.id = b.catalogo_bem_id
        WHERE ${where.join(" AND ")}
        ORDER BY f.encontrado_em DESC
        LIMIT $${i};`;

      const r = await pool.query(sql, [...params, limitFinal]);
      res.json({ requestId: req.requestId, items: r.rows });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cria evento de inventario em status EM_ANDAMENTO.
   * Regra legal: evento EM_ANDAMENTO ativa congelamento via trigger (Art. 183 - AN303_Art183).
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function postEvento(req, res, next) {
    try {
      const body = req.body || {};
      const codigoEvento = String(body.codigoEvento || "").trim();
      if (!codigoEvento) throw new HttpError(422, "CODIGO_EVENTO_OBRIGATORIO", "codigoEvento e obrigatorio.");
      if (codigoEvento.length > 60) throw new HttpError(422, "CODIGO_EVENTO_TAMANHO", "codigoEvento excede 60 caracteres.");

      const unidadeInventariadaId = body.unidadeInventariadaId == null || String(body.unidadeInventariadaId).trim() === ""
        ? null
        : Number(body.unidadeInventariadaId);
      if (unidadeInventariadaId != null && (!Number.isInteger(unidadeInventariadaId) || !VALID_UNIDADES.has(unidadeInventariadaId))) {
        throw new HttpError(422, "UNIDADE_INVENTARIADA_INVALIDA", "unidadeInventariadaId deve ser 1..4 ou null (inventario geral).");
      }

      const abertoPorPerfilId = req.user?.id
        ? String(req.user.id).trim()
        : String(body.abertoPorPerfilId || "").trim();
      if (!abertoPorPerfilId || !UUID_RE.test(abertoPorPerfilId)) {
        throw new HttpError(422, "ABERTO_POR_INVALIDO", "abertoPorPerfilId (UUID) e obrigatorio.");
      }

      const observacoesRaw = body.observacoes != null ? String(body.observacoes).trim() : "";
      const observacoes = observacoesRaw ? observacoesRaw.slice(0, 2000) : null;

      const r = await pool.query(
        `INSERT INTO eventos_inventario (
           codigo_evento, unidade_inventariada_id, status, iniciado_em, aberto_por_perfil_id, observacoes
         ) VALUES ($1,$2,'EM_ANDAMENTO',NOW(),$3,$4)
         RETURNING
           id,
           codigo_evento AS "codigoEvento",
           unidade_inventariada_id AS "unidadeInventariadaId",
           status::text AS "status",
           iniciado_em AS "iniciadoEm",
           aberto_por_perfil_id AS "abertoPorPerfilId",
           observacoes;`,
        [codigoEvento, unidadeInventariadaId, abertoPorPerfilId, observacoes],
      );

      res.status(201).json({ requestId: req.requestId, evento: r.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualiza status do evento (ENCERRADO/CANCELADO) e seta encerrado_em.
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function patchEventoStatus(req, res, next) {
    try {
      const eventoId = String(req.params?.id || "").trim();
      if (!UUID_RE.test(eventoId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "id do evento deve ser UUID.");

      const body = req.body || {};
      const status = String(body.status || "").trim().toUpperCase();
      if (status !== "ENCERRADO" && status !== "CANCELADO") {
        throw new HttpError(422, "STATUS_INVALIDO", "status deve ser ENCERRADO ou CANCELADO.");
      }

      const encerradoPorPerfilId = req.user?.id
        ? String(req.user.id).trim()
        : String(body.encerradoPorPerfilId || "").trim();
      if (!encerradoPorPerfilId || !UUID_RE.test(encerradoPorPerfilId)) {
        throw new HttpError(422, "ENCERRADOR_INVALIDO", "encerradoPorPerfilId (UUID) e obrigatorio.");
      }

      const observacoesRaw = body.observacoes != null ? String(body.observacoes).trim() : "";
      const observacoes = observacoesRaw ? observacoesRaw.slice(0, 2000) : null;

      const r = await pool.query(
        `UPDATE eventos_inventario
         SET status = $1::public.status_inventario,
             encerrado_em = NOW(),
             encerrado_por_perfil_id = $2,
             observacoes = COALESCE($3, observacoes),
             updated_at = NOW()
         WHERE id = $4
         RETURNING
           id,
           codigo_evento AS "codigoEvento",
           unidade_inventariada_id AS "unidadeInventariadaId",
           status::text AS "status",
           iniciado_em AS "iniciadoEm",
           encerrado_em AS "encerradoEm",
           aberto_por_perfil_id AS "abertoPorPerfilId",
           encerrado_por_perfil_id AS "encerradoPorPerfilId",
           observacoes;`,
        [status, encerradoPorPerfilId, observacoes, eventoId],
      );
      if (!r.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.");

      res.json({ requestId: req.requestId, evento: r.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sincroniza contagens do inventario (offline-first).
   * Regra legal: divergencias nao mudam carga automaticamente durante inventario.
   * Art. 185 (AN303_Art185).
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function postSync(req, res, next) {
    const client = await pool.connect();
    try {
      const body = req.body || {};
      const eventoInventarioId = String(body.eventoInventarioId || "").trim();
      if (!UUID_RE.test(eventoInventarioId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "eventoInventarioId deve ser UUID.");

      const unidadeEncontradaId = Number(body.unidadeEncontradaId);
      if (!Number.isInteger(unidadeEncontradaId) || !VALID_UNIDADES.has(unidadeEncontradaId)) {
        throw new HttpError(422, "UNIDADE_ENCONTRADA_INVALIDA", "unidadeEncontradaId deve ser 1..4.");
      }

      const salaEncontrada = String(body.salaEncontrada || "").trim();
      if (!salaEncontrada) throw new HttpError(422, "SALA_OBRIGATORIA", "salaEncontrada e obrigatoria.");
      if (salaEncontrada.length > 180) throw new HttpError(422, "SALA_TAMANHO", "salaEncontrada excede 180 caracteres.");

      const encontradoPorPerfilId = body.encontradoPorPerfilId != null && String(body.encontradoPorPerfilId).trim() !== ""
        ? String(body.encontradoPorPerfilId).trim()
        : req.user?.id
          ? String(req.user.id).trim()
          : null;
      if (encontradoPorPerfilId && !UUID_RE.test(encontradoPorPerfilId)) {
        throw new HttpError(422, "ENCONTRADO_POR_INVALIDO", "encontradoPorPerfilId deve ser UUID.");
      }

      const itens = Array.isArray(body.itens) ? body.itens : [];
      if (!itens.length) throw new HttpError(422, "ITENS_OBRIGATORIOS", "itens[] e obrigatorio.");
      if (itens.length > 500) throw new HttpError(422, "ITENS_LIMITE", "Limite de 500 itens por sync.");

      await client.query("BEGIN");

      const ev = await client.query(
        "SELECT id, status::text AS status FROM eventos_inventario WHERE id = $1",
        [eventoInventarioId],
      );
      if (!ev.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento de inventario nao encontrado.");
      if (ev.rows[0].status !== "EM_ANDAMENTO") {
        throw new HttpError(409, "EVENTO_NAO_ATIVO", "Evento de inventario nao esta EM_ANDAMENTO.");
      }

      const summary = {
        totalItens: itens.length,
        inseridas: 0,
        atualizadas: 0,
        divergentes: 0,
        erros: [],
      };

      for (let i = 0; i < itens.length; i += 1) {
        const sp = `sp_sync_${i}`;
        const rowNo = i + 1;
        const numeroTombamento = normalizeTombamento(itens[i]?.numeroTombamento);

        if (!numeroTombamento || !TOMBAMENTO_GEAFIN_RE.test(numeroTombamento)) {
          summary.erros.push({ item: rowNo, erro: "Tombamento invalido (esperado 10 digitos numericos)." });
          continue;
        }

        const encontradoEm = itens[i]?.encontradoEm ? new Date(String(itens[i].encontradoEm)) : new Date();
        if (Number.isNaN(encontradoEm.getTime())) {
          summary.erros.push({ item: rowNo, tombamento: numeroTombamento, erro: "encontradoEm invalido." });
          continue;
        }

        const observacoesRaw = itens[i]?.observacoes != null ? String(itens[i].observacoes).trim() : "";
        const observacoes = observacoesRaw ? observacoesRaw.slice(0, 2000) : null;

        await client.query(`SAVEPOINT ${sp}`);
        try {
          const b = await client.query(
            `SELECT id, unidade_dona_id
             FROM bens
             WHERE numero_tombamento = $1
             LIMIT 1`,
            [numeroTombamento],
          );
          if (!b.rowCount) {
            summary.erros.push({ item: rowNo, tombamento: numeroTombamento, erro: "Bem nao encontrado para o tombamento informado." });
            await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
            continue;
          }

          const bemId = b.rows[0].id;
          const unidadeDonaId = Number(b.rows[0].unidade_dona_id);
          const divergente = unidadeDonaId !== unidadeEncontradaId;
          const tipoOcorrencia = divergente ? "ENCONTRADO_EM_LOCAL_DIVERGENTE" : "CONFORME";
          const regularizacaoPendente = divergente ? true : false;

          const up = await client.query(
            `INSERT INTO contagens (
               evento_inventario_id, bem_id, unidade_encontrada_id, sala_encontrada,
               status_apurado, tipo_ocorrencia, regularizacao_pendente,
               encontrado_por_perfil_id, encontrado_em, observacoes
             ) VALUES (
               $1,$2,$3,$4,
               'OK',$5::public.tipo_ocorrencia_inventario,$6,
               $7,$8,$9
             )
             ON CONFLICT (evento_inventario_id, bem_id)
             DO UPDATE SET
               unidade_encontrada_id = EXCLUDED.unidade_encontrada_id,
               sala_encontrada = EXCLUDED.sala_encontrada,
               tipo_ocorrencia = EXCLUDED.tipo_ocorrencia,
               regularizacao_pendente = EXCLUDED.regularizacao_pendente,
               encontrado_por_perfil_id = EXCLUDED.encontrado_por_perfil_id,
               encontrado_em = EXCLUDED.encontrado_em,
               observacoes = EXCLUDED.observacoes,
               updated_at = NOW()
             RETURNING (xmax = 0) AS inserted;`,
            [
              eventoInventarioId,
              bemId,
              unidadeEncontradaId,
              salaEncontrada,
              tipoOcorrencia,
              regularizacaoPendente,
              encontradoPorPerfilId,
              encontradoEm.toISOString(),
              observacoes,
            ],
          );

          if (up.rows[0]?.inserted) summary.inseridas += 1;
          else summary.atualizadas += 1;
          if (divergente) summary.divergentes += 1;
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
          summary.erros.push({ item: rowNo, tombamento: numeroTombamento, erro: dbError(error) });
        }
      }

      await client.query("COMMIT");
      res.json({ requestId: req.requestId, summary });
    } catch (error) {
      await safeRollback(client);
      next(error);
    } finally {
      client.release();
    }
  }

  /**
   * Regulariza uma divergencia (forasteiro) apos o encerramento do inventario.
   *
   * Regras:
   * - So permite regularizar quando o evento estiver ENCERRADO.
   * - A regularizacao encerra `regularizacao_pendente` e registra metadados (quem/quando/como).
   * - Opcionalmente executa transferencia de carga, gerando `movimentacoes` + historico (Art. 124/127).
   *
   * Regras legais:
   * - Divergencia/intruso deve ser regularizada apos o inventario (nao muda carga automaticamente).
   *   Art. 185 (AN303_Art185).
   * - Transferencia muda carga e exige formalizacao.
   *   Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
   *
   * Body:
   * - contagemId: UUID (obrigatorio)
   * - acao: "TRANSFERIR_CARGA" | "MANTER_CARGA"
   * - regularizadoPorPerfilId: UUID (obrigatorio)
   * - termoReferencia: string (obrigatorio quando acao=TRANSFERIR_CARGA)
   * - observacoes: string (opcional)
   *
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function postRegularizacao(req, res, next) {
    const client = await pool.connect();
    try {
      const body = req.body || {};
      const contagemId = String(body.contagemId || body.id || "").trim();
      if (!contagemId || !UUID_RE.test(contagemId)) {
        throw new HttpError(422, "CONTAGEM_ID_INVALIDO", "contagemId (UUID) e obrigatorio.");
      }

      const regularizadoPorPerfilId = req.user?.id
        ? String(req.user.id).trim()
        : String(body.regularizadoPorPerfilId || body.perfilId || "").trim();
      if (!regularizadoPorPerfilId || !UUID_RE.test(regularizadoPorPerfilId)) {
        throw new HttpError(422, "REGULARIZADOR_INVALIDO", "regularizadoPorPerfilId (UUID) e obrigatorio.");
      }

      const acaoRaw = String(body.acao || body.tipo || "").trim().toUpperCase();
      const acao = acaoRaw === "TRANSFERENCIA" || acaoRaw === "TRANSFERIR" || acaoRaw === "TRANSFERIR_CARGA"
        ? "TRANSFERIR_CARGA"
        : acaoRaw === "MANTER" || acaoRaw === "MANTER_CARGA" || acaoRaw === "SEM_TRANSFERENCIA"
          ? "MANTER_CARGA"
          : null;
      if (!acao) {
        throw new HttpError(422, "ACAO_INVALIDA", "acao deve ser TRANSFERIR_CARGA ou MANTER_CARGA.");
      }

      const termoReferenciaRaw = body.termoReferencia != null ? String(body.termoReferencia).trim() : "";
      const termoReferencia = termoReferenciaRaw ? termoReferenciaRaw.slice(0, 120) : "";
      if (acao === "TRANSFERIR_CARGA" && !termoReferencia) {
        throw new HttpError(422, "TERMO_OBRIGATORIO", "termoReferencia e obrigatorio para TRANSFERIR_CARGA.");
      }

      const obsRaw = body.observacoes != null ? String(body.observacoes).trim() : "";
      const observacoes = obsRaw ? obsRaw.slice(0, 2000) : null;

      await client.query("BEGIN");

      // Em modo autenticado, req.user ja veio do banco. Ainda assim, mantemos o UUID validado acima.

      const r = await client.query(
        `SELECT
           c.id AS contagem_id,
           c.evento_inventario_id,
           c.tipo_ocorrencia::text AS tipo_ocorrencia,
           c.regularizacao_pendente,
           c.unidade_encontrada_id,
           c.sala_encontrada,
           ei.status::text AS status_inventario,
           ei.codigo_evento,
           b.id AS bem_id,
           b.numero_tombamento,
           b.unidade_dona_id,
           b.eh_bem_terceiro
         FROM contagens c
         JOIN eventos_inventario ei ON ei.id = c.evento_inventario_id
         JOIN bens b ON b.id = c.bem_id
         WHERE c.id = $1
         FOR UPDATE OF c, b;`,
        [contagemId],
      );
      if (!r.rowCount) throw new HttpError(404, "CONTAGEM_NAO_ENCONTRADA", "Contagem nao encontrada.");

      const row = r.rows[0];
      if (row.tipo_ocorrencia !== "ENCONTRADO_EM_LOCAL_DIVERGENTE") {
        throw new HttpError(422, "CONTAGEM_NAO_DIVERGENTE", "Contagem informada nao e divergente (forasteiro).");
      }
      if (!row.regularizacao_pendente) {
        throw new HttpError(409, "REGULARIZACAO_JA_FEITA", "Esta divergencia ja foi regularizada.");
      }
      if (row.status_inventario !== "ENCERRADO") {
        throw new HttpError(
          409,
          "EVENTO_NAO_ENCERRADO",
          "Regularizacao so pode ocorrer apos ENCERRAR o inventario.",
          { baseLegal: "Art. 185 (AN303_Art185)" },
        );
      }

      await setDbContext(client, { changeOrigin: "APP", currentUserId: regularizadoPorPerfilId });

      let movimentacao = null;
      let bem = null;

      if (acao === "TRANSFERIR_CARGA") {
        if (row.eh_bem_terceiro) {
          throw new HttpError(422, "TRANSFERENCIA_PROIBIDA_BEM_TERCEIRO", "Bens de terceiros nao podem ter carga transferida.");
        }

        const unidadeDestinoId = Number(row.unidade_encontrada_id);
        if (!Number.isInteger(unidadeDestinoId) || !VALID_UNIDADES.has(unidadeDestinoId)) {
          throw new HttpError(422, "UNIDADE_DESTINO_INVALIDA", "unidadeEncontradaId invalida na contagem.");
        }
        if (Number(row.unidade_dona_id) === unidadeDestinoId) {
          throw new HttpError(409, "BEM_JA_CONFORME", "O bem ja esta com carga na unidade encontrada. Use MANTER_CARGA para encerrar a pendencia.");
        }

        // Regra legal: Transferencia muda carga e exige formalizacao.
        // Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
        const upBem = await client.query(
          `UPDATE bens
           SET unidade_dona_id = $1,
               status = 'OK',
               updated_at = NOW()
           WHERE id = $2
           RETURNING id, numero_tombamento AS "numeroTombamento", unidade_dona_id AS "unidadeDonaId", status::text AS status;`,
          [unidadeDestinoId, row.bem_id],
        );
        bem = upBem.rows[0];

        const just = `Regularizacao pos-inventario (contagem=${contagemId}, evento=${row.codigo_evento}).`;
        const mov = await client.query(
          `INSERT INTO movimentacoes (
             bem_id, tipo_movimentacao, status,
             unidade_origem_id, unidade_destino_id,
             termo_referencia, justificativa,
             autorizada_por_perfil_id, autorizada_em,
             executada_por_perfil_id, executada_em
           ) VALUES (
             $1,'REGULARIZACAO_INVENTARIO','EXECUTADA',
             $2,$3,
             $4,$5,
             $6,NOW(),
             $7,NOW()
           )
           RETURNING id, bem_id AS "bemId", tipo_movimentacao::text AS "tipoMovimentacao", status::text AS status, termo_referencia AS "termoReferencia";`,
          [
            row.bem_id,
            Number(row.unidade_dona_id),
            unidadeDestinoId,
            termoReferencia,
            just,
            regularizadoPorPerfilId,
            regularizadoPorPerfilId,
          ],
        );
        movimentacao = mov.rows[0];

        await client.query(
          `UPDATE contagens
           SET regularizacao_pendente = FALSE,
               regularizado_em = NOW(),
               regularizado_por_perfil_id = $2,
               regularizacao_acao = $3,
               regularizacao_movimentacao_id = $4,
               regularizacao_observacoes = $5,
               updated_at = NOW()
           WHERE id = $1;`,
          [contagemId, regularizadoPorPerfilId, acao, movimentacao.id, observacoes],
        );
      } else {
        await client.query(
          `UPDATE contagens
           SET regularizacao_pendente = FALSE,
               regularizado_em = NOW(),
               regularizado_por_perfil_id = $2,
               regularizacao_acao = $3,
               regularizacao_movimentacao_id = NULL,
               regularizacao_observacoes = $4,
               updated_at = NOW()
           WHERE id = $1;`,
          [contagemId, regularizadoPorPerfilId, acao, observacoes],
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ requestId: req.requestId, contagemId, acao, movimentacao, bem });
    } catch (error) {
      await safeRollback(client);
      if (error?.code === "P0001") {
        next(new HttpError(409, "MOVIMENTACAO_BLOQUEADA_INVENTARIO", "Movimentacao bloqueada por inventario em andamento.", { baseLegal: "Art. 183 (AN303_Art183)" }));
        return;
      }
      next(error);
    } finally {
      client.release();
    }
  }

  /**
   * Registra "bem de terceiro" (sem tombamento GEAFIN) durante inventario.
   *
   * Regras:
   * - Exige evento EM_ANDAMENTO (inventario aberto).
   * - Cria um bem com `eh_bem_terceiro=true` e `identificador_externo` + `proprietario_externo`.
   * - Cria contagem com `tipo_ocorrencia='BEM_DE_TERCEIRO'` (controle segregado).
   *
   * Regras legais:
   * - Controle segregado de bens de terceiros: Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX).
   *
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function postBemTerceiro(req, res, next) {
    const client = await pool.connect();
    try {
      const body = req.body || {};
      const eventoInventarioId = String(body.eventoInventarioId || body.eventoId || "").trim();
      if (!UUID_RE.test(eventoInventarioId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "eventoInventarioId deve ser UUID.");

      const unidadeEncontradaId = Number(body.unidadeEncontradaId || body.unidadeId || 0);
      if (!Number.isInteger(unidadeEncontradaId) || !VALID_UNIDADES.has(unidadeEncontradaId)) {
        throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeEncontradaId deve ser 1..4.");
      }

      const salaEncontrada = String(body.salaEncontrada || body.sala || "").trim().slice(0, 180);
      if (!salaEncontrada) throw new HttpError(422, "SALA_OBRIGATORIA", "salaEncontrada e obrigatoria.");

      const descricao = String(body.descricao || body.descricaoBem || "").trim().slice(0, 2000);
      if (!descricao) throw new HttpError(422, "DESCRICAO_OBRIGATORIA", "descricao e obrigatoria.");

      const proprietarioExterno = String(body.proprietarioExterno || body.detentorExterno || body.proprietario || "").trim().slice(0, 180);
      if (!proprietarioExterno) throw new HttpError(422, "PROPRIETARIO_OBRIGATORIO", "proprietarioExterno e obrigatorio.");

      const identificadorRaw = body.identificadorExterno != null ? String(body.identificadorExterno).trim() : "";
      const identificadorExterno = (identificadorRaw || `TERC-${String(Date.now())}`).slice(0, 120);

      const contratoReferencia = body.contratoReferencia != null ? String(body.contratoReferencia).trim().slice(0, 140) : null;
      const observacoes = body.observacoes != null ? String(body.observacoes).trim().slice(0, 2000) : null;

      const encontradoPorPerfilId = req.user?.id ? String(req.user.id).trim() : String(body.encontradoPorPerfilId || "").trim();
      if (!encontradoPorPerfilId || !UUID_RE.test(encontradoPorPerfilId)) {
        throw new HttpError(422, "PERFIL_INVALIDO", "encontradoPorPerfilId (UUID) e obrigatorio.");
      }

      await client.query("BEGIN");

      const ev = await client.query(
        `SELECT id, status::text AS status, codigo_evento AS "codigoEvento"
         FROM eventos_inventario
         WHERE id = $1
         LIMIT 1;`,
        [eventoInventarioId],
      );
      if (!ev.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento de inventario nao encontrado.");
      if (String(ev.rows[0].status) !== "EM_ANDAMENTO") {
        throw new HttpError(409, "EVENTO_NAO_ATIVO", "Registro de bem de terceiro exige evento EM_ANDAMENTO.");
      }

      await setDbContext(client, { changeOrigin: "APP", currentUserId: encontradoPorPerfilId });

      // Catalogo "generico" para bens de terceiros (nao explode o catalogo com descricoes unicas).
      const cat = await client.query(
        `INSERT INTO catalogo_bens (codigo_catalogo, descricao, grupo, material_permanente)
         VALUES ('TERCEIRO_GENERICO', 'Bem de terceiro (genérico)', 'TERCEIROS', FALSE)
         ON CONFLICT (codigo_catalogo)
         DO UPDATE SET updated_at = NOW()
         RETURNING id;`,
      );
      const catalogoBemId = cat.rows[0].id;

      const bemIns = await client.query(
        `INSERT INTO bens (
           numero_tombamento,
           identificador_externo,
           catalogo_bem_id,
           descricao_complementar,
           unidade_dona_id,
           local_fisico,
           status,
           eh_bem_terceiro,
           proprietario_externo,
           contrato_referencia
         ) VALUES (
           NULL,
           $1,
           $2,
           $3,
           $4,
           $5,
           'OK',
           TRUE,
           $6,
           $7
         )
         RETURNING
           id,
           identificador_externo AS "identificadorExterno",
           descricao_complementar AS "descricao",
           proprietario_externo AS "proprietarioExterno",
           unidade_dona_id AS "unidadeDonaId",
           local_fisico AS "localFisico";`,
        [identificadorExterno, catalogoBemId, descricao, unidadeEncontradaId, salaEncontrada, proprietarioExterno, contratoReferencia],
      );
      const bem = bemIns.rows[0];

      const cont = await client.query(
        `INSERT INTO contagens (
           evento_inventario_id, bem_id, unidade_encontrada_id, sala_encontrada,
           status_apurado, tipo_ocorrencia, regularizacao_pendente,
           encontrado_por_perfil_id, encontrado_em, observacoes
         ) VALUES (
           $1,$2,$3,$4,
           'OK','BEM_DE_TERCEIRO',FALSE,
           $5,NOW(),$6
         )
         RETURNING
           id,
           evento_inventario_id AS "eventoInventarioId",
           bem_id AS "bemId",
           unidade_encontrada_id AS "unidadeEncontradaId",
           sala_encontrada AS "salaEncontrada",
           tipo_ocorrencia::text AS "tipoOcorrencia",
           encontrado_em AS "encontradoEm";`,
        [eventoInventarioId, bem.id, unidadeEncontradaId, salaEncontrada, encontradoPorPerfilId, observacoes],
      );
      const contagem = cont.rows[0];

      await client.query("COMMIT");
      res.status(201).json({ requestId: req.requestId, bem, contagem });
    } catch (error) {
      await safeRollback(client);
      next(error);
    } finally {
      client.release();
    }
  }

  return {
    getEventos,
    getContagens,
    getForasteiros,
    postEvento,
    patchEventoStatus,
    postSync,
    postBemTerceiro,
    postRegularizacao,
  };
}

module.exports = { createInventarioController };
