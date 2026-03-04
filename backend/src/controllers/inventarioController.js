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
 * @returns {{getEventos: Function, getContagens: Function, getDivergenciasInterunidades: Function, getForasteiros: Function, getBensTerceiros: Function, getProgresso: Function, getRelatorioEncerramento: Function, exportRelatorioEncerramentoCsv: Function, getSugestoesCiclo: Function, getIndicadoresAcuracidade: Function, getMinhaSessaoContagem: Function, getMonitoramentoContagem: Function, postEvento: Function, patchEventoStatus: Function, postSync: Function, postBemTerceiro: Function, postRegularizacao: Function}} Handlers Express.
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

  const normalizeRoomLabel = (raw) => String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  const csvEsc = (raw) => `"${String(raw == null ? "" : raw).replace(/"/g, "\"\"")}"`;
  const unitLabel = (unitId) => (unitId == null ? "GERAL" : String(unitId));
  const VALID_CICLOS = new Set(["SEMANAL", "MENSAL", "ANUAL", "ADHOC"]);
  const VALID_ESCOPO = new Set(["GERAL", "UNIDADE", "LOCAIS"]);
  const VALID_MODO_CONTAGEM = new Set(["PADRAO", "CEGO", "DUPLO_CEGO"]);
  const VALID_PAPEL_CONTAGEM = new Set(["OPERADOR_UNICO", "OPERADOR_A", "OPERADOR_B"]);
  const VALID_RODADA = new Set(["A", "B", "DESEMPATE"]);
  const VALID_STATUS_EVENTO = new Set(["EM_ANDAMENTO", "ENCERRADO", "CANCELADO"]);
  let _invSchemaCaps = null;

  async function getInvSchemaCaps() {
    if (_invSchemaCaps) return _invSchemaCaps;
    const q = await pool.query(
      `SELECT
         EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema='public' AND table_name='eventos_inventario' AND column_name='tipo_ciclo'
         ) AS "hasTipoCiclo",
         EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema='public' AND table_name='eventos_inventario' AND column_name='escopo_tipo'
         ) AS "hasEscopoTipo",
         EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema='public' AND table_name='locais' AND column_name='data_ultima_contagem'
         ) AS "hasDataUltimaContagem",
         EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_schema='public' AND table_name='eventos_inventario_locais'
         ) AS "hasEventosLocais",
         EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema='public' AND table_name='eventos_inventario' AND column_name='modo_contagem'
         ) AS "hasModoContagem",
         EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_schema='public' AND table_name='eventos_inventario_operadores'
         ) AS "hasOperadoresEvento",
         EXISTS (
           SELECT 1
           FROM information_schema.tables
           WHERE table_schema='public' AND table_name='contagens_rodadas'
         ) AS "hasContagensRodadas";`,
    );
    _invSchemaCaps = q.rows[0] || {
      hasTipoCiclo: false,
      hasEscopoTipo: false,
      hasDataUltimaContagem: false,
      hasEventosLocais: false,
      hasModoContagem: false,
      hasOperadoresEvento: false,
      hasContagensRodadas: false,
    };
    return _invSchemaCaps;
  }

  async function listOperadoresEvento(client, eventoId) {
    const r = await client.query(
      `SELECT
         eo.id,
         eo.evento_inventario_id AS "eventoInventarioId",
         eo.perfil_id AS "perfilId",
         p.nome AS "perfilNome",
         p.matricula AS "perfilMatricula",
         eo.papel_contagem::text AS "papelContagem",
         eo.ativo,
         eo.permite_desempate AS "permiteDesempate",
         eo.created_at AS "createdAt"
       FROM eventos_inventario_operadores eo
       JOIN perfis p ON p.id = eo.perfil_id
       WHERE eo.evento_inventario_id = $1
       ORDER BY eo.created_at ASC;`,
      [eventoId],
    );
    return r.rows;
  }

  function normalizeOperadoresDesignados(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const row of raw) {
      const perfilId = String(row?.perfilId || "").trim();
      const papelContagem = String(row?.papelContagem || "").trim().toUpperCase();
      if (!perfilId || !UUID_RE.test(perfilId)) continue;
      if (!VALID_PAPEL_CONTAGEM.has(papelContagem)) continue;
      out.push({
        perfilId,
        papelContagem,
        permiteDesempate: Boolean(row?.permiteDesempate),
      });
    }
    return out;
  }

  function validateOperadoresByMode(modoContagem, operadoresDesignados) {
    const ativos = Array.isArray(operadoresDesignados) ? operadoresDesignados : [];
    if (modoContagem === "PADRAO") return;
    if (modoContagem === "CEGO") {
      if (ativos.length !== 1 || ativos[0].papelContagem !== "OPERADOR_UNICO") {
        throw new HttpError(422, "OPERADORES_INVALIDOS_CEGO", "Modo CEGO exige exatamente 1 operador com papel OPERADOR_UNICO.");
      }
      return;
    }
    if (modoContagem === "DUPLO_CEGO") {
      if (ativos.length !== 2) {
        throw new HttpError(422, "OPERADORES_INVALIDOS_DUPLO_CEGO", "Modo DUPLO_CEGO exige exatamente 2 operadores (A/B).");
      }
      const hasA = ativos.some((x) => x.papelContagem === "OPERADOR_A");
      const hasB = ativos.some((x) => x.papelContagem === "OPERADOR_B");
      if (!hasA || !hasB) {
        throw new HttpError(422, "OPERADORES_INVALIDOS_DUPLO_CEGO", "Modo DUPLO_CEGO exige OPERADOR_A e OPERADOR_B.");
      }
    }
  }

  async function resolveSessaoContagem(client, eventoId, perfilId, reqUserRole) {
    const caps = await getInvSchemaCaps();
    const ev = await client.query(
      `SELECT
         id,
         status::text AS status,
         unidade_inventariada_id AS "unidadeInventariadaId",
         COALESCE((to_jsonb(eventos_inventario)->>'escopo_tipo'), CASE WHEN unidade_inventariada_id IS NULL THEN 'GERAL' ELSE 'UNIDADE' END) AS "escopoTipo",
         ${caps.hasModoContagem ? "modo_contagem::text" : "'PADRAO'"} AS "modoContagem"
       FROM eventos_inventario
       WHERE id = $1
       LIMIT 1;`,
      [eventoId],
    );
    if (!ev.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento de inventario nao encontrado.");
    const evento = ev.rows[0];
    const modoContagem = String(evento.modoContagem || "PADRAO").toUpperCase();

    if (!caps.hasOperadoresEvento || modoContagem === "PADRAO") {
      return {
        evento,
        perfilDesignado: null,
        papel: null,
        podeDesempate: String(reqUserRole || "").toUpperCase() === "ADMIN",
        rodadasPermitidas: ["A"],
        uiReduzida: false,
      };
    }

    const op = await client.query(
      `SELECT
         papel_contagem::text AS "papelContagem",
         permite_desempate AS "permiteDesempate",
         ativo
       FROM eventos_inventario_operadores
       WHERE evento_inventario_id = $1
         AND perfil_id = $2
       LIMIT 1;`,
      [eventoId, perfilId],
    );
    const designado = op.rows[0] || null;
    const isAdmin = String(reqUserRole || "").toUpperCase() === "ADMIN";
    if (!designado || !designado.ativo) {
      return {
        evento,
        perfilDesignado: null,
        papel: null,
        podeDesempate: isAdmin,
        rodadasPermitidas: [],
        uiReduzida: modoContagem === "CEGO" || modoContagem === "DUPLO_CEGO",
      };
    }

    let rodadasPermitidas = [];
    if (modoContagem === "CEGO") rodadasPermitidas = ["A"];
    else if (modoContagem === "DUPLO_CEGO") {
      if (designado.papelContagem === "OPERADOR_A") rodadasPermitidas = ["A"];
      if (designado.papelContagem === "OPERADOR_B") rodadasPermitidas = ["B"];
      if (designado.papelContagem === "OPERADOR_UNICO") rodadasPermitidas = ["A"];
    }

    return {
      evento,
      perfilDesignado: designado,
      papel: designado.papelContagem,
      podeDesempate: isAdmin || Boolean(designado.permiteDesempate),
      rodadasPermitidas,
      uiReduzida: modoContagem === "CEGO" || modoContagem === "DUPLO_CEGO",
    };
  }

  /**
   * Lista eventos de inventario, com filtro opcional por status.
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getEventos(req, res, next) {
    try {
      const caps = await getInvSchemaCaps();
      const status = req.query?.status ? String(req.query.status).trim().toUpperCase() : null;
      const limit = req.query?.limit ? Number(req.query.limit) : 50;
      const limitFinal = Number.isInteger(limit) ? Math.max(1, Math.min(200, limit)) : 50;

      const where = [];
      const params = [];
      let i = 1;

      if (status) {
        where.push(`e.status = $${i}::public.status_inventario`);
        params.push(status);
        i += 1;
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const escopoLocaisSql = caps.hasEventosLocais
        ? `(
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'localId', l.id,
                  'nome', l.nome,
                  'unidadeId', l.unidade_id
                )
                ORDER BY l.nome
              ),
              '[]'::json
            )
            FROM eventos_inventario_locais eil
            JOIN locais l ON l.id = eil.local_id
            WHERE eil.evento_inventario_id = e.id
          )`
        : `'[]'::json`;
      const operadoresSql = caps.hasOperadoresEvento
        ? `(
            SELECT COALESCE(
              json_agg(
                json_build_object(
                  'perfilId', eo.perfil_id,
                  'perfilNome', p.nome,
                  'perfilMatricula', p.matricula,
                  'papelContagem', eo.papel_contagem::text,
                  'ativo', eo.ativo,
                  'permiteDesempate', eo.permite_desempate
                )
                ORDER BY eo.created_at
              ),
              '[]'::json
            )
            FROM eventos_inventario_operadores eo
            JOIN perfis p ON p.id = eo.perfil_id
            WHERE eo.evento_inventario_id = e.id
          )`
        : `'[]'::json`;
      const r = await pool.query(
        `SELECT
           e.id,
           e.codigo_evento AS "codigoEvento",
           e.unidade_inventariada_id AS "unidadeInventariadaId",
           COALESCE((to_jsonb(e)->>'tipo_ciclo'), 'ADHOC') AS "tipoCiclo",
           COALESCE((to_jsonb(e)->>'escopo_tipo'), CASE WHEN e.unidade_inventariada_id IS NULL THEN 'GERAL' ELSE 'UNIDADE' END) AS "escopoTipo",
           ${caps.hasModoContagem ? "COALESCE((to_jsonb(e)->>'modo_contagem'), 'PADRAO')" : "'PADRAO'"} AS "modoContagem",
           ${escopoLocaisSql} AS "escopoLocais",
           ${operadoresSql} AS "operadoresDesignados",
           e.status::text AS "status",
           e.iniciado_em AS "iniciadoEm",
           e.encerrado_em AS "encerradoEm",
           e.aberto_por_perfil_id AS "abertoPorPerfilId",
           pa.nome AS "abertoPorNome",
           e.encerrado_por_perfil_id AS "encerradoPorPerfilId",
           pe.nome AS "encerradoPorNome",
           e.observacoes
         FROM eventos_inventario e
         LEFT JOIN perfis pa ON pa.id = e.aberto_por_perfil_id
         LEFT JOIN perfis pe ON pe.id = e.encerrado_por_perfil_id
         ${whereSql}
         ORDER BY e.created_at DESC
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
   * - limit: number (opcional; default 500; max 10000)
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
      const limitFinal = Math.max(1, Math.min(10000, limit));

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
          b.identificador_externo AS "identificadorExterno",
          b.descricao_complementar AS "descricaoComplementar",
          b.foto_url AS "fotoUrl",
          b.unidade_dona_id AS "unidadeDonaId",
          b.local_id AS "localEsperadoId",
          b.local_fisico AS "localEsperadoTexto",
          l.nome AS "localEsperadoNome",
          cb.codigo_catalogo AS "codigoCatalogo",
          cb.descricao AS "catalogoDescricao",
          cb.foto_referencia_url AS "fotoReferenciaUrl"
        FROM contagens c
        JOIN bens b ON b.id = c.bem_id
        JOIN catalogo_bens cb ON cb.id = b.catalogo_bem_id
        LEFT JOIN locais l ON l.id = b.local_id
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
   * Obtem o progresso do inventario agrupado por salas.
   * Utiliza a base de bens (esperados) vs contagens (inventariados).
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getProgresso(req, res, next) {
    try {
      const eventoInventarioId = String(req.params.id || "").trim();
      if (!UUID_RE.test(eventoInventarioId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "id deve ser UUID.");

      const sql = `
        WITH evt AS (
          SELECT unidade_inventariada_id 
          FROM eventos_inventario 
          WHERE id = $1
        ),
        inventariados AS (
          SELECT
            c.sala_encontrada AS local_nome,
            COUNT(c.id) AS qtd_inventariados
          FROM contagens c
          WHERE c.evento_inventario_id = $1
          GROUP BY c.sala_encontrada
        ),
        esperados AS (
          SELECT
            l.nome AS local_nome,
            COUNT(b.id) AS qtd_esperados
          FROM bens b
          JOIN locais l ON l.id = b.local_id
          CROSS JOIN evt
          WHERE (evt.unidade_inventariada_id IS NULL OR b.unidade_dona_id = evt.unidade_inventariada_id)
            AND b.status != 'BAIXADO' AND b.eh_bem_terceiro = FALSE
          GROUP BY l.nome
        ),
        todas_salas AS (
          SELECT local_nome FROM inventariados
          UNION
          SELECT local_nome FROM esperados
        )
        SELECT
          t.local_nome AS "salaEncontrada",
          COALESCE(e.qtd_esperados, 0)::int AS "qtdEsperados",
          COALESCE(i.qtd_inventariados, 0)::int AS "qtdInventariados"
        FROM todas_salas t
        LEFT JOIN esperados e ON e.local_nome = t.local_nome
        LEFT JOIN inventariados i ON i.local_nome = t.local_nome
        ORDER BY t.local_nome;
      `;

      const r = await pool.query(sql, [eventoInventarioId]);
      res.json({ requestId: req.requestId, items: r.rows });
    } catch (error) {
      next(error);
    }
  }

  async function buildRelatorioInventario(eventoId) {
    const ev = await pool.query(
      `SELECT
         e.id,
         e.codigo_evento AS "codigoEvento",
         e.status::text AS "status",
         e.unidade_inventariada_id AS "unidadeInventariadaId",
         e.iniciado_em AS "iniciadoEm",
         e.encerrado_em AS "encerradoEm",
         e.aberto_por_perfil_id AS "abertoPorPerfilId",
         pa.nome AS "abertoPorNome",
         e.encerrado_por_perfil_id AS "encerradoPorPerfilId",
         pe.nome AS "encerradoPorNome",
         e.observacoes
       FROM eventos_inventario e
       LEFT JOIN perfis pa ON pa.id = e.aberto_por_perfil_id
       LEFT JOIN perfis pe ON pe.id = e.encerrado_por_perfil_id
       WHERE e.id = $1
       LIMIT 1;`,
      [eventoId],
    );
    if (!ev.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.");
    const evento = ev.rows[0];
    const c = await pool.query(
      `SELECT
         c.id AS "contagemId",
         c.sala_encontrada AS "salaEncontrada",
         c.unidade_encontrada_id AS "unidadeEncontradaId",
         c.tipo_ocorrencia::text AS "tipoOcorrencia",
         c.regularizacao_pendente AS "regularizacaoPendente",
         c.regularizacao_acao AS "regularizacaoAcao",
         c.encontrado_em AS "encontradoEm",
         c.regularizado_em AS "regularizadoEm",
         b.id AS "bemId",
         b.numero_tombamento AS "numeroTombamento",
         b.identificador_externo AS "identificadorExterno",
         b.unidade_dona_id AS "unidadeDonaId",
         b.local_fisico AS "localEsperadoTexto",
         b.local_id AS "localEsperadoId",
         b.nome_resumo AS "nomeResumo",
          b.descricao_complementar AS "descricaoComplementar",
          b.foto_url AS "fotoUrl",
          l.nome AS "localEsperadoNome",
          cb.codigo_catalogo AS "codigoCatalogo",
          cb.descricao AS "catalogoDescricao",
          cb.foto_referencia_url AS "fotoReferenciaUrl"
       FROM contagens c
       JOIN bens b ON b.id = c.bem_id
       JOIN catalogo_bens cb ON cb.id = b.catalogo_bem_id
       LEFT JOIN locais l ON l.id = b.local_id
       WHERE c.evento_inventario_id = $1
       ORDER BY c.encontrado_em ASC;`,
      [eventoId],
    );

    const contagens = c.rows;
    let divergenciasUnidade = 0;
    let divergenciasSala = 0;
    let divergenciasUnidadeESala = 0;
    let conformes = 0;
    const porSala = new Map();
    const divergenciasDetalhe = [];

    for (const row of contagens) {
      const sala = String(row.salaEncontrada || "").trim() || "(sem sala)";
      const salaMeta = porSala.get(sala) || { salaEncontrada: sala, totalLidos: 0, divergencias: 0, conformes: 0 };
      salaMeta.totalLidos += 1;

      const unidadeDivergente = Number(row.unidadeDonaId) !== Number(row.unidadeEncontradaId);
      const esperado = String(row.localEsperadoNome || row.localEsperadoTexto || "").trim();
      const encontrada = String(row.salaEncontrada || "").trim();
      const salaDivergente = esperado && encontrada ? normalizeRoomLabel(esperado) !== normalizeRoomLabel(encontrada) : false;

      if (unidadeDivergente || salaDivergente) {
        salaMeta.divergencias += 1;
        if (unidadeDivergente && salaDivergente) divergenciasUnidadeESala += 1;
        else if (unidadeDivergente) divergenciasUnidade += 1;
        else if (salaDivergente) divergenciasSala += 1;

        divergenciasDetalhe.push({
          contagemId: row.contagemId,
          bemId: row.bemId,
          numeroTombamento: row.numeroTombamento,
          identificadorExterno: row.identificadorExterno,
          codigoCatalogo: row.codigoCatalogo,
          catalogoDescricao: row.catalogoDescricao,
          nomeResumo: row.nomeResumo || null,
          descricaoComplementar: row.descricaoComplementar || null,
          fotoUrl: row.fotoUrl || null,
          fotoReferenciaUrl: row.fotoReferenciaUrl || null,
          unidadeDonaId: row.unidadeDonaId,
          unidadeEncontradaId: row.unidadeEncontradaId,
          localEsperado: esperado || null,
          salaEncontrada: encontrada || null,
          tipoDivergencia: unidadeDivergente && salaDivergente ? "UNIDADE_E_SALA" : unidadeDivergente ? "UNIDADE" : "SALA",
          regularizacaoPendente: Boolean(row.regularizacaoPendente),
          regularizacaoAcao: row.regularizacaoAcao || null,
          encontradoEm: row.encontradoEm,
          regularizadoEm: row.regularizadoEm || null,
        });
      } else {
        conformes += 1;
        salaMeta.conformes += 1;
      }

      porSala.set(sala, salaMeta);
    }

    const terceiros = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM contagens c
       JOIN bens b ON b.id = c.bem_id
       WHERE c.evento_inventario_id = $1
         AND b.eh_bem_terceiro = TRUE;`,
      [eventoId],
    );

    const regularizacoesPendentes = divergenciasDetalhe.filter((d) => d.regularizacaoPendente).length;
    const totalContagens = contagens.length;
    const totalDivergencias = divergenciasUnidade + divergenciasSala + divergenciasUnidadeESala;

    const resumo = {
      totalContagens,
      conformes,
      totalDivergencias,
      divergenciasUnidade,
      divergenciasSala,
      divergenciasUnidadeESala,
      regularizacoesPendentes,
      totalBensTerceiros: Number(terceiros.rows[0]?.total || 0),
    };

    const compliance = [
      {
        artigo: "Art. 183 (AN303_Art183)",
        regra: "Bloqueio de mudanca de carga durante inventario em andamento.",
        evidencias: [
          "Evento encerrado e com trilha de contagens consolidada.",
          "Transferencias nao sao automaticas no ato da leitura.",
        ],
      },
      {
        artigo: "Art. 185 (AN303_Art185)",
        regra: "Divergencias registradas e tratadas por fluxo de regularizacao pos-inventario.",
        evidencias: [
          `Status do evento: ${evento.status}.`,
          `Divergencias totais: ${totalDivergencias}.`,
          `Pendencias de regularizacao: ${regularizacoesPendentes}.`,
        ],
      },
      {
        artigo: "Art. 124/127 (AN303_Art124/AN303_Art127)",
        regra: "Transferencias formais com termo e rastreabilidade.",
        evidencias: [
          "Regularizacoes com transferencia ficam em movimentacoes e historico.",
          "Correcoes de sala/local sao auditadas sem trocar dono automaticamente.",
        ],
      },
    ];

    return {
      evento,
      resumo,
      porSala: Array.from(porSala.values()).sort((a, b) => a.salaEncontrada.localeCompare(b.salaEncontrada)),
      divergencias: divergenciasDetalhe,
      compliance,
    };
  }

  /**
   * Relatorio detalhado do inventario (em andamento ou encerrado).
   * Foco operacional:
   * - consolidar tudo o que foi registrado no evento encerrado;
   * - destacar divergencias de unidade/sala (Art. 185);
   * - manter rastreabilidade de regularizacao sem transferencias automaticas de carga.
   *
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getRelatorioEncerramento(req, res, next) {
    try {
      const eventoId = String(req.params?.id || "").trim();
      if (!UUID_RE.test(eventoId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "id do evento deve ser UUID.");
      const report = await buildRelatorioInventario(eventoId);
      res.json({ requestId: req.requestId, ...report });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista sugestoes de ciclo por sala/local.
   * Prioridade: mais tempo sem contagem (data_ultima_contagem antiga) e maior volume de bens ativos.
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getSugestoesCiclo(req, res, next) {
    try {
      const caps = await getInvSchemaCaps();
      if (!caps.hasDataUltimaContagem) {
        throw new HttpError(
          422,
          "MIGRACAO_INVENTARIO_CICLICO_OBRIGATORIA",
          "Banco ainda nao possui locais.data_ultima_contagem. Aplique a migration 017_inventario_ciclico_escopo.sql."
        );
      }

      const unidadeRaw = req.query?.unidadeId != null && String(req.query.unidadeId).trim() !== ""
        ? Number(req.query.unidadeId)
        : null;
      if (unidadeRaw != null && (!Number.isInteger(unidadeRaw) || !VALID_UNIDADES.has(unidadeRaw))) {
        throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeId deve ser 1..4.");
      }

      const somenteAtivos = String(req.query?.somenteAtivos || "true").trim().toLowerCase() !== "false";
      const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 20));
      const offset = Math.max(0, Number(req.query?.offset) || 0);

      const where = [];
      const params = [];
      let i = 1;

      if (unidadeRaw != null) {
        where.push(`l.unidade_id = $${i}`);
        params.push(unidadeRaw);
        i += 1;
      }
      if (somenteAtivos) where.push(`COALESCE(l.ativo, TRUE) = TRUE`);
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const totalR = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM locais l
         ${whereSql};`,
        params,
      );

      const r = await pool.query(
        `SELECT
           l.id AS "localId",
           l.nome,
           l.unidade_id AS "unidadeId",
           l.data_ultima_contagem AS "dataUltimaContagem",
           CASE
             WHEN l.data_ultima_contagem IS NULL THEN NULL
             ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - l.data_ultima_contagem))/86400))::int
           END AS "diasSemContagem",
           COALESCE(bx.qtd_bens_ativos, 0)::int AS "qtdBensAtivos",
           COALESCE(dx.qtd_divergencias_pendentes, 0)::int AS "qtdDivergenciasPendentes",
           (
             CASE
               WHEN l.data_ultima_contagem IS NULL THEN 1000000
               ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - l.data_ultima_contagem))/86400))::int
             END * 1000
           ) + COALESCE(bx.qtd_bens_ativos, 0)::int AS "scorePrioridade"
         FROM locais l
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS qtd_bens_ativos
           FROM bens b
           WHERE b.local_id = l.id
             AND b.eh_bem_terceiro = FALSE
             AND b.status <> 'BAIXADO'::public.status_bem
         ) bx ON TRUE
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS qtd_divergencias_pendentes
           FROM contagens c
           JOIN bens b ON b.id = c.bem_id
           WHERE c.regularizacao_pendente = TRUE
             AND b.local_id = l.id
         ) dx ON TRUE
         ${whereSql}
         ORDER BY
           l.data_ultima_contagem ASC NULLS FIRST,
           COALESCE(bx.qtd_bens_ativos, 0) DESC,
           l.nome ASC
         LIMIT $${i} OFFSET $${i + 1};`,
        [...params, limit, offset],
      );

      res.json({
        requestId: req.requestId,
        paging: { limit, offset, total: totalR.rows[0]?.total || 0 },
        items: r.rows,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Consolida indicadores operacionais de acuracidade de inventario por periodo.
   *
   * Query obrigatoria:
   * - dataInicio: YYYY-MM-DD
   * - dataFim: YYYY-MM-DD
   *
   * Query opcional:
   * - unidadeId: 1..4
   * - statusEvento: EM_ANDAMENTO | ENCERRADO | CANCELADO (default: ENCERRADO)
   * - toleranciaPct: 0..10 (default: 2)
   *
   * Regras operacionais:
   * - Exclui bens de terceiros e bens baixados da base de KPI.
   * - Mantem separacao de divergencias e regularizacao (Art. 185 - AN303_Art185).
   *
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getIndicadoresAcuracidade(req, res, next) {
    try {
      const q = req.query || {};

      const parseDateOnly = (raw, fieldName) => {
        const value = String(raw || "").trim();
        if (!value) throw new HttpError(422, `${fieldName.toUpperCase()}_OBRIGATORIA`, `${fieldName} e obrigatorio no formato YYYY-MM-DD.`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          throw new HttpError(422, `${fieldName.toUpperCase()}_INVALIDA`, `${fieldName} deve usar o formato YYYY-MM-DD.`);
        }
        const dt = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(dt.getTime())) {
          throw new HttpError(422, `${fieldName.toUpperCase()}_INVALIDA`, `${fieldName} e invalida.`);
        }
        return { value, date: dt };
      };

      const round2 = (n) => Number(Number(n || 0).toFixed(2));
      const calcPct = (num, den) => (den > 0 ? round2((num / den) * 100) : 0);
      const calcCoberturaPct = (qtdInventariados, qtdEsperados) => round2((Number(qtdInventariados || 0) / Math.max(Number(qtdEsperados || 0), 1)) * 100);

      const semaforoHigh = (value, greenMin, yellowMin) => {
        if (value >= greenMin) return "VERDE";
        if (value >= yellowMin) return "AMARELO";
        return "VERMELHO";
      };
      const semaforoLow = (value, greenMax, yellowMax) => {
        if (value <= greenMax) return "VERDE";
        if (value <= yellowMax) return "AMARELO";
        return "VERMELHO";
      };

      const buildSemaforo = (kpis) => ({
        acuracidadeExata: {
          valorPct: kpis.acuracidadeExataPct,
          status: semaforoHigh(kpis.acuracidadeExataPct, 98, 95),
          meta: "Verde >= 98; Amarelo 95-97.99; Vermelho < 95",
        },
        acuracidadeTolerancia: {
          valorPct: kpis.acuracidadeToleranciaPct,
          status: semaforoHigh(kpis.acuracidadeToleranciaPct, 95, 90),
          meta: "Verde >= 95; Amarelo 90-94.99; Vermelho < 90",
        },
        pendenciaRegularizacao: {
          valorPct: kpis.taxaPendenciaRegularizacaoPct,
          status: semaforoLow(kpis.taxaPendenciaRegularizacaoPct, 5, 10),
          meta: "Verde <= 5; Amarelo 5.01-10; Vermelho > 10",
        },
        mttrRegularizacao: {
          valorDias: kpis.mttrRegularizacaoDias,
          status: semaforoLow(kpis.mttrRegularizacaoDias, 5, 10),
          meta: "Verde <= 5 dias; Amarelo 6-10; Vermelho > 10",
        },
        coberturaContagem: {
          valorPct: kpis.coberturaContagemPct,
          status: semaforoHigh(kpis.coberturaContagemPct, 99, 95),
          meta: "Verde >= 99; Amarelo 95-98.99; Vermelho < 95",
        },
      });

      const inicio = parseDateOnly(q.dataInicio, "dataInicio");
      const fim = parseDateOnly(q.dataFim, "dataFim");
      if (inicio.date.getTime() > fim.date.getTime()) {
        throw new HttpError(422, "PERIODO_INVALIDO", "dataInicio deve ser menor ou igual a dataFim.");
      }

      const endExclusive = new Date(fim.date.getTime() + 24 * 60 * 60 * 1000);
      const dataInicioIso = `${inicio.value}T00:00:00.000Z`;
      const dataFimExclusivaIso = endExclusive.toISOString();

      const statusEvento = q.statusEvento != null && String(q.statusEvento).trim() !== ""
        ? String(q.statusEvento).trim().toUpperCase()
        : "ENCERRADO";
      if (!VALID_STATUS_EVENTO.has(statusEvento)) {
        throw new HttpError(422, "STATUS_EVENTO_INVALIDO", "statusEvento deve ser EM_ANDAMENTO, ENCERRADO ou CANCELADO.");
      }

      const unidadeId = q.unidadeId != null && String(q.unidadeId).trim() !== ""
        ? Number(q.unidadeId)
        : null;
      if (unidadeId != null && (!Number.isInteger(unidadeId) || !VALID_UNIDADES.has(unidadeId))) {
        throw new HttpError(422, "UNIDADE_INVALIDA", "unidadeId deve ser 1..4.");
      }

      const toleranciaPctRaw = q.toleranciaPct != null && String(q.toleranciaPct).trim() !== ""
        ? Number(q.toleranciaPct)
        : 2;
      if (!Number.isFinite(toleranciaPctRaw) || toleranciaPctRaw < 0 || toleranciaPctRaw > 10) {
        throw new HttpError(422, "TOLERANCIA_INVALIDA", "toleranciaPct deve ser numero entre 0 e 10.");
      }
      const toleranciaPct = round2(toleranciaPctRaw);
      const toleranciaFracao = toleranciaPct / 100;

      const whereEventos = [
        `COALESCE(e.encerrado_em, e.iniciado_em) >= $1::timestamptz`,
        `COALESCE(e.encerrado_em, e.iniciado_em) < $2::timestamptz`,
        `e.status = $3::public.status_inventario`,
      ];
      const eventosParams = [dataInicioIso, dataFimExclusivaIso, statusEvento];
      let paramIndex = 4;

      if (unidadeId != null) {
        whereEventos.push(`e.unidade_inventariada_id = $${paramIndex}`);
        eventosParams.push(unidadeId);
        paramIndex += 1;
      }

      const eventosR = await pool.query(
        `SELECT
           e.id,
           e.codigo_evento AS "codigoEvento",
           e.status::text AS status,
           e.unidade_inventariada_id AS "unidadeInventariadaId",
           e.iniciado_em AS "iniciadoEm",
           e.encerrado_em AS "encerradoEm",
           COALESCE(e.encerrado_em, e.iniciado_em) AS "dataReferencia"
         FROM eventos_inventario e
         WHERE ${whereEventos.join(" AND ")}
         ORDER BY "dataReferencia" ASC, e.created_at ASC;`,
        eventosParams,
      );

      const emptyResumo = {
        totalEventos: 0,
        totalContagens: 0,
        conformes: 0,
        totalDivergencias: 0,
        divergenciasUnidade: 0,
        divergenciasSala: 0,
        divergenciasUnidadeESala: 0,
        regularizacoesPendentes: 0,
        salasAvaliadas: 0,
        salasHit: 0,
        acuracidadeExataPct: 0,
        acuracidadeToleranciaPct: 0,
        erroRelativoMedioSalaPct: 0,
        taxaDivergenciaPct: 0,
        taxaPendenciaRegularizacaoPct: 0,
        mttrRegularizacaoDias: 0,
        coberturaContagemPct: 0,
      };

      if (!eventosR.rowCount) {
        const resumoVazio = { ...emptyResumo, semaforo: buildSemaforo(emptyResumo) };
        res.json({
          requestId: req.requestId,
          periodo: {
            dataInicio: inicio.value,
            dataFim: fim.value,
            dataInicioIso,
            dataFimExclusivaIso,
            referenciaTemporal: "COALESCE(encerrado_em, iniciado_em)",
          },
          configuracao: {
            statusEvento,
            unidadeId,
            toleranciaPct,
            frequenciaConsolidacao: "SEMANAL_MENSAL",
            exclusoes: ["bens.eh_bem_terceiro = FALSE", "bens.status != BAIXADO"],
          },
          resumo: resumoVazio,
          porEvento: [],
          porSala: [],
          serieSemanal: [],
          serieMensal: [],
        });
        return;
      }

      const eventos = eventosR.rows;
      const eventoIds = eventos.map((e) => e.id);
      const eventoMap = new Map();

      for (const ev of eventos) {
        const dataRef = ev.dataReferencia ? new Date(ev.dataReferencia) : new Date(ev.iniciadoEm);
        eventoMap.set(ev.id, {
          eventoId: ev.id,
          codigoEvento: ev.codigoEvento,
          status: ev.status,
          unidadeInventariadaId: ev.unidadeInventariadaId,
          iniciadoEm: ev.iniciadoEm,
          encerradoEm: ev.encerradoEm,
          dataReferencia: Number.isNaN(dataRef.getTime()) ? null : dataRef,
          totalContagens: 0,
          conformes: 0,
          totalDivergencias: 0,
          divergenciasUnidade: 0,
          divergenciasSala: 0,
          divergenciasUnidadeESala: 0,
          regularizacoesPendentes: 0,
          mttrDiasSoma: 0,
          mttrQtd: 0,
          salasAvaliadas: 0,
          salasHit: 0,
          erroRelSalaSoma: 0,
          qtdEsperadosTotal: 0,
          qtdInventariadosTotal: 0,
        });
      }

      const [contagensR, esperadosR, inventariadosR] = await Promise.all([
        pool.query(
          `SELECT
             c.evento_inventario_id AS "eventoId",
             c.unidade_encontrada_id AS "unidadeEncontradaId",
             c.sala_encontrada AS "salaEncontrada",
             c.encontrado_em AS "encontradoEm",
             c.regularizado_em AS "regularizadoEm",
             c.regularizacao_pendente AS "regularizacaoPendente",
             b.unidade_dona_id AS "unidadeDonaId",
             b.local_fisico AS "localEsperadoTexto",
             l.nome AS "localEsperadoNome"
           FROM contagens c
           JOIN bens b ON b.id = c.bem_id
           LEFT JOIN locais l ON l.id = b.local_id
           WHERE c.evento_inventario_id = ANY($1::uuid[])
             AND b.eh_bem_terceiro = FALSE
             AND b.status <> 'BAIXADO'::public.status_bem;`,
          [eventoIds],
        ),
        pool.query(
          `SELECT
             e.id AS "eventoId",
             l.nome AS sala,
             COUNT(b.id)::int AS "qtdEsperados"
           FROM eventos_inventario e
           JOIN bens b
             ON (e.unidade_inventariada_id IS NULL OR b.unidade_dona_id = e.unidade_inventariada_id)
           JOIN locais l ON l.id = b.local_id
           WHERE e.id = ANY($1::uuid[])
             AND b.eh_bem_terceiro = FALSE
             AND b.status <> 'BAIXADO'::public.status_bem
           GROUP BY e.id, l.nome;`,
          [eventoIds],
        ),
        pool.query(
          `SELECT
             c.evento_inventario_id AS "eventoId",
             COALESCE(NULLIF(trim(c.sala_encontrada), ''), '(sem sala)') AS sala,
             COUNT(c.id)::int AS "qtdInventariados"
           FROM contagens c
           JOIN bens b ON b.id = c.bem_id
           WHERE c.evento_inventario_id = ANY($1::uuid[])
             AND b.eh_bem_terceiro = FALSE
             AND b.status <> 'BAIXADO'::public.status_bem
           GROUP BY c.evento_inventario_id, COALESCE(NULLIF(trim(c.sala_encontrada), ''), '(sem sala)');`,
          [eventoIds],
        ),
      ]);

      for (const row of contagensR.rows) {
        const ev = eventoMap.get(row.eventoId);
        if (!ev) continue;

        ev.totalContagens += 1;
        const unidadeDivergente = Number(row.unidadeDonaId) !== Number(row.unidadeEncontradaId);
        const localEsperado = String(row.localEsperadoNome || row.localEsperadoTexto || "").trim();
        const salaEncontrada = String(row.salaEncontrada || "").trim();
        const salaDivergente = localEsperado && salaEncontrada
          ? normalizeRoomLabel(localEsperado) !== normalizeRoomLabel(salaEncontrada)
          : false;

        if (unidadeDivergente || salaDivergente) {
          ev.totalDivergencias += 1;
          if (unidadeDivergente && salaDivergente) ev.divergenciasUnidadeESala += 1;
          else if (unidadeDivergente) ev.divergenciasUnidade += 1;
          else if (salaDivergente) ev.divergenciasSala += 1;

          if (row.regularizacaoPendente) ev.regularizacoesPendentes += 1;
          if (!row.regularizacaoPendente && row.regularizadoEm && row.encontradoEm) {
            const inicioTs = new Date(row.encontradoEm).getTime();
            const fimTs = new Date(row.regularizadoEm).getTime();
            if (!Number.isNaN(inicioTs) && !Number.isNaN(fimTs) && fimTs >= inicioTs) {
              ev.mttrDiasSoma += (fimTs - inicioTs) / (24 * 60 * 60 * 1000);
              ev.mttrQtd += 1;
            }
          }
        } else {
          ev.conformes += 1;
        }
      }

      const salaEventoMap = new Map();
      const toSalaKey = (eventoId, salaRaw) => {
        const sala = String(salaRaw || "").trim() || "(sem sala)";
        return `${eventoId}::${normalizeRoomLabel(sala)}`;
      };
      const ensureSalaEvento = (eventoId, salaRaw) => {
        const sala = String(salaRaw || "").trim() || "(sem sala)";
        const key = toSalaKey(eventoId, sala);
        if (!salaEventoMap.has(key)) {
          salaEventoMap.set(key, {
            eventoId,
            sala,
            qtdEsperados: 0,
            qtdInventariados: 0,
          });
        }
        return salaEventoMap.get(key);
      };

      for (const row of esperadosR.rows) {
        const slot = ensureSalaEvento(row.eventoId, row.sala);
        slot.qtdEsperados += Number(row.qtdEsperados || 0);
      }
      for (const row of inventariadosR.rows) {
        const slot = ensureSalaEvento(row.eventoId, row.sala);
        slot.qtdInventariados += Number(row.qtdInventariados || 0);
      }

      const porSalaAgg = new Map();
      for (const slot of salaEventoMap.values()) {
        const ev = eventoMap.get(slot.eventoId);
        if (!ev) continue;
        const qtdEsperados = Number(slot.qtdEsperados || 0);
        const qtdInventariados = Number(slot.qtdInventariados || 0);
        const erroRel = Math.abs(qtdInventariados - qtdEsperados) / Math.max(qtdEsperados, 1);
        const hit = erroRel <= toleranciaFracao;

        ev.salasAvaliadas += 1;
        ev.salasHit += hit ? 1 : 0;
        ev.erroRelSalaSoma += erroRel;
        ev.qtdEsperadosTotal += qtdEsperados;
        ev.qtdInventariadosTotal += qtdInventariados;

        const salaKey = normalizeRoomLabel(slot.sala);
        if (!porSalaAgg.has(salaKey)) {
          porSalaAgg.set(salaKey, {
            sala: slot.sala,
            eventos: new Set(),
            avaliacoes: 0,
            hits: 0,
            erroRelSoma: 0,
            qtdEsperados: 0,
            qtdInventariados: 0,
          });
        }
        const salaAgg = porSalaAgg.get(salaKey);
        salaAgg.eventos.add(slot.eventoId);
        salaAgg.avaliacoes += 1;
        salaAgg.hits += hit ? 1 : 0;
        salaAgg.erroRelSoma += erroRel;
        salaAgg.qtdEsperados += qtdEsperados;
        salaAgg.qtdInventariados += qtdInventariados;
      }

      const rawEventos = Array.from(eventoMap.values());
      const totals = rawEventos.reduce((acc, ev) => {
        acc.totalEventos += 1;
        acc.totalContagens += ev.totalContagens;
        acc.conformes += ev.conformes;
        acc.totalDivergencias += ev.totalDivergencias;
        acc.divergenciasUnidade += ev.divergenciasUnidade;
        acc.divergenciasSala += ev.divergenciasSala;
        acc.divergenciasUnidadeESala += ev.divergenciasUnidadeESala;
        acc.regularizacoesPendentes += ev.regularizacoesPendentes;
        acc.salasAvaliadas += ev.salasAvaliadas;
        acc.salasHit += ev.salasHit;
        acc.erroRelSalaSoma += ev.erroRelSalaSoma;
        acc.mttrDiasSoma += ev.mttrDiasSoma;
        acc.mttrQtd += ev.mttrQtd;
        acc.qtdEsperadosTotal += ev.qtdEsperadosTotal;
        acc.qtdInventariadosTotal += ev.qtdInventariadosTotal;
        return acc;
      }, {
        totalEventos: 0,
        totalContagens: 0,
        conformes: 0,
        totalDivergencias: 0,
        divergenciasUnidade: 0,
        divergenciasSala: 0,
        divergenciasUnidadeESala: 0,
        regularizacoesPendentes: 0,
        salasAvaliadas: 0,
        salasHit: 0,
        erroRelSalaSoma: 0,
        mttrDiasSoma: 0,
        mttrQtd: 0,
        qtdEsperadosTotal: 0,
        qtdInventariadosTotal: 0,
      });

      const resumoBase = {
        totalEventos: totals.totalEventos,
        totalContagens: totals.totalContagens,
        conformes: totals.conformes,
        totalDivergencias: totals.totalDivergencias,
        divergenciasUnidade: totals.divergenciasUnidade,
        divergenciasSala: totals.divergenciasSala,
        divergenciasUnidadeESala: totals.divergenciasUnidadeESala,
        regularizacoesPendentes: totals.regularizacoesPendentes,
        salasAvaliadas: totals.salasAvaliadas,
        salasHit: totals.salasHit,
        acuracidadeExataPct: calcPct(totals.conformes, totals.totalContagens),
        acuracidadeToleranciaPct: calcPct(totals.salasHit, totals.salasAvaliadas),
        erroRelativoMedioSalaPct: totals.salasAvaliadas > 0 ? round2((totals.erroRelSalaSoma / totals.salasAvaliadas) * 100) : 0,
        taxaDivergenciaPct: calcPct(totals.totalDivergencias, totals.totalContagens),
        taxaPendenciaRegularizacaoPct: calcPct(totals.regularizacoesPendentes, totals.totalDivergencias),
        mttrRegularizacaoDias: totals.mttrQtd > 0 ? round2(totals.mttrDiasSoma / totals.mttrQtd) : 0,
        coberturaContagemPct: calcCoberturaPct(totals.qtdInventariadosTotal, totals.qtdEsperadosTotal),
      };
      const resumo = { ...resumoBase, semaforo: buildSemaforo(resumoBase) };

      const porEvento = rawEventos
        .map((ev) => {
          const acuracidadeExataPct = calcPct(ev.conformes, ev.totalContagens);
          const acuracidadeToleranciaPct = calcPct(ev.salasHit, ev.salasAvaliadas);
          const erroRelativoMedioSalaPct = ev.salasAvaliadas > 0 ? round2((ev.erroRelSalaSoma / ev.salasAvaliadas) * 100) : 0;
          const taxaDivergenciaPct = calcPct(ev.totalDivergencias, ev.totalContagens);
          const taxaPendenciaRegularizacaoPct = calcPct(ev.regularizacoesPendentes, ev.totalDivergencias);
          const mttrRegularizacaoDias = ev.mttrQtd > 0 ? round2(ev.mttrDiasSoma / ev.mttrQtd) : 0;
          const coberturaContagemPct = calcCoberturaPct(ev.qtdInventariadosTotal, ev.qtdEsperadosTotal);
          const kpisEvento = {
            acuracidadeExataPct,
            acuracidadeToleranciaPct,
            taxaPendenciaRegularizacaoPct,
            mttrRegularizacaoDias,
            coberturaContagemPct,
          };
          return {
            eventoId: ev.eventoId,
            codigoEvento: ev.codigoEvento,
            status: ev.status,
            unidadeInventariadaId: ev.unidadeInventariadaId,
            iniciadoEm: ev.iniciadoEm,
            encerradoEm: ev.encerradoEm,
            dataReferencia: ev.dataReferencia ? ev.dataReferencia.toISOString() : null,
            totalContagens: ev.totalContagens,
            conformes: ev.conformes,
            totalDivergencias: ev.totalDivergencias,
            divergenciasUnidade: ev.divergenciasUnidade,
            divergenciasSala: ev.divergenciasSala,
            divergenciasUnidadeESala: ev.divergenciasUnidadeESala,
            regularizacoesPendentes: ev.regularizacoesPendentes,
            salasAvaliadas: ev.salasAvaliadas,
            salasHit: ev.salasHit,
            acuracidadeExataPct,
            acuracidadeToleranciaPct,
            erroRelativoMedioSalaPct,
            taxaDivergenciaPct,
            taxaPendenciaRegularizacaoPct,
            mttrRegularizacaoDias,
            coberturaContagemPct,
            semaforo: buildSemaforo(kpisEvento),
            _raw: {
              mttrQtd: ev.mttrQtd,
              qtdEsperadosTotal: ev.qtdEsperadosTotal,
              qtdInventariadosTotal: ev.qtdInventariadosTotal,
              erroRelSalaSoma: ev.erroRelSalaSoma,
            },
          };
        })
        .sort((a, b) => String(b.dataReferencia || "").localeCompare(String(a.dataReferencia || "")));

      const porSala = Array.from(porSalaAgg.values())
        .map((s) => {
          const acuracidadeToleranciaPct = calcPct(s.hits, s.avaliacoes);
          const erroRelativoMedioSalaPct = s.avaliacoes > 0 ? round2((s.erroRelSoma / s.avaliacoes) * 100) : 0;
          return {
            sala: s.sala,
            eventos: s.eventos.size,
            avaliacoes: s.avaliacoes,
            hits: s.hits,
            misses: Math.max(0, s.avaliacoes - s.hits),
            qtdEsperados: s.qtdEsperados,
            qtdInventariados: s.qtdInventariados,
            coberturaContagemPct: calcCoberturaPct(s.qtdInventariados, s.qtdEsperados),
            acuracidadeToleranciaPct,
            erroRelativoMedioSalaPct,
            statusTolerancia: semaforoHigh(acuracidadeToleranciaPct, 95, 90),
          };
        })
        .sort((a, b) =>
          Number(b.erroRelativoMedioSalaPct) - Number(a.erroRelativoMedioSalaPct)
            || Number(b.misses) - Number(a.misses)
            || a.sala.localeCompare(b.sala)
        );

      const getWeekStartIso = (date) => {
        const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const offset = (d.getUTCDay() + 6) % 7; // segunda = inicio da semana
        d.setUTCDate(d.getUTCDate() - offset);
        return d.toISOString().slice(0, 10);
      };

      const buildSeries = (modo) => {
        const buckets = new Map();
        for (const row of porEvento) {
          if (!row.dataReferencia) continue;
          const ref = new Date(row.dataReferencia);
          if (Number.isNaN(ref.getTime())) continue;

          let key = "";
          let rotulo = "";
          let periodoInicio = "";
          let periodoFim = "";
          if (modo === "SEMANAL") {
            periodoInicio = getWeekStartIso(ref);
            const fimSemana = new Date(`${periodoInicio}T00:00:00.000Z`);
            fimSemana.setUTCDate(fimSemana.getUTCDate() + 6);
            periodoFim = fimSemana.toISOString().slice(0, 10);
            key = periodoInicio;
            rotulo = `${periodoInicio} a ${periodoFim}`;
          } else {
            const ano = ref.getUTCFullYear();
            const mes = String(ref.getUTCMonth() + 1).padStart(2, "0");
            key = `${ano}-${mes}`;
            periodoInicio = `${key}-01`;
            const fimMes = new Date(Date.UTC(ano, ref.getUTCMonth() + 1, 0));
            periodoFim = fimMes.toISOString().slice(0, 10);
            rotulo = key;
          }

          if (!buckets.has(key)) {
            buckets.set(key, {
              key,
              modo,
              rotulo,
              periodoInicio,
              periodoFim,
              totalEventos: 0,
              totalContagens: 0,
              conformes: 0,
              totalDivergencias: 0,
              regularizacoesPendentes: 0,
              salasAvaliadas: 0,
              salasHit: 0,
              erroRelSalaSoma: 0,
              mttrDiasSoma: 0,
              mttrQtd: 0,
              qtdEsperadosTotal: 0,
              qtdInventariadosTotal: 0,
            });
          }
          const b = buckets.get(key);
          b.totalEventos += 1;
          b.totalContagens += Number(row.totalContagens || 0);
          b.conformes += Number(row.conformes || 0);
          b.totalDivergencias += Number(row.totalDivergencias || 0);
          b.regularizacoesPendentes += Number(row.regularizacoesPendentes || 0);
          b.salasAvaliadas += Number(row.salasAvaliadas || 0);
          b.salasHit += Number(row.salasHit || 0);
          b.erroRelSalaSoma += Number(row._raw?.erroRelSalaSoma || 0);
          b.mttrDiasSoma += Number(row.mttrRegularizacaoDias || 0) * Number(row._raw?.mttrQtd || 0);
          b.mttrQtd += Number(row._raw?.mttrQtd || 0);
          b.qtdEsperadosTotal += Number(row._raw?.qtdEsperadosTotal || 0);
          b.qtdInventariadosTotal += Number(row._raw?.qtdInventariadosTotal || 0);
        }

        return Array.from(buckets.values())
          .sort((a, b) => a.key.localeCompare(b.key))
          .map((b) => {
            const mttrRegularizacaoDias = b.mttrQtd > 0 ? round2(b.mttrDiasSoma / b.mttrQtd) : 0;
            const acuracidadeExataPct = calcPct(b.conformes, b.totalContagens);
            const acuracidadeToleranciaPct = calcPct(b.salasHit, b.salasAvaliadas);
            const taxaPendenciaRegularizacaoPct = calcPct(b.regularizacoesPendentes, b.totalDivergencias);
            const coberturaContagemPct = calcCoberturaPct(b.qtdInventariadosTotal, b.qtdEsperadosTotal);
            return {
              chave: b.key,
              periodo: {
                modo: b.modo,
                rotulo: b.rotulo,
                inicio: b.periodoInicio,
                fim: b.periodoFim,
              },
              totalEventos: b.totalEventos,
              totalContagens: b.totalContagens,
              totalDivergencias: b.totalDivergencias,
              acuracidadeExataPct,
              acuracidadeToleranciaPct,
              erroRelativoMedioSalaPct: b.salasAvaliadas > 0 ? round2((b.erroRelSalaSoma / b.salasAvaliadas) * 100) : 0,
              taxaDivergenciaPct: calcPct(b.totalDivergencias, b.totalContagens),
              taxaPendenciaRegularizacaoPct,
              mttrRegularizacaoDias,
              coberturaContagemPct,
              semaforo: buildSemaforo({
                acuracidadeExataPct,
                acuracidadeToleranciaPct,
                taxaPendenciaRegularizacaoPct,
                mttrRegularizacaoDias,
                coberturaContagemPct,
              }),
            };
          });
      };

      const serieSemanal = buildSeries("SEMANAL");
      const serieMensal = buildSeries("MENSAL");

      const porEventoSanitizado = porEvento.map((row) => {
        const { _raw, ...rest } = row;
        return rest;
      });

      res.json({
        requestId: req.requestId,
        periodo: {
          dataInicio: inicio.value,
          dataFim: fim.value,
          dataInicioIso,
          dataFimExclusivaIso,
          referenciaTemporal: "COALESCE(encerrado_em, iniciado_em)",
        },
        configuracao: {
          statusEvento,
          unidadeId,
          toleranciaPct,
          frequenciaConsolidacao: "SEMANAL_MENSAL",
          exclusoes: ["bens.eh_bem_terceiro = FALSE", "bens.status != BAIXADO"],
        },
        resumo,
        porEvento: porEventoSanitizado,
        porSala,
        serieSemanal,
        serieMensal,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exporta o relatorio de encerramento em CSV editavel.
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function exportRelatorioEncerramentoCsv(req, res, next) {
    try {
      const eventoId = String(req.params?.id || "").trim();
      if (!UUID_RE.test(eventoId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "id do evento deve ser UUID.");
      const report = await buildRelatorioInventario(eventoId);

      const lines = [];
      lines.push(["secao", "chave", "valor"].map(csvEsc).join(","));
      lines.push(["RESUMO", "codigoEvento", report.evento?.codigoEvento || ""].map(csvEsc).join(","));
      lines.push(["RESUMO", "status", report.evento?.status || ""].map(csvEsc).join(","));
      lines.push(["RESUMO", "iniciadoEm", report.evento?.iniciadoEm || ""].map(csvEsc).join(","));
      lines.push(["RESUMO", "encerradoEm", report.evento?.encerradoEm || ""].map(csvEsc).join(","));
      for (const [k, v] of Object.entries(report.resumo || {})) {
        lines.push(["RESUMO", k, v].map(csvEsc).join(","));
      }
      lines.push("");
      lines.push(
        [
          "secao",
          "contagemId",
          "tombamento",
          "catalogo",
          "nomeResumo",
          "descricao",
          "descricaoComplementar",
          "tipoDivergencia",
          "unidadeDona",
          "unidadeEncontrada",
          "localEsperado",
          "salaEncontrada",
          "regularizacaoPendente",
          "regularizacaoAcao",
          "encontradoEm",
          "regularizadoEm",
        ].map(csvEsc).join(","),
      );
      for (const d of report.divergencias || []) {
        lines.push(
          [
            "DIVERGENCIA",
            d.contagemId,
            d.numeroTombamento || d.identificadorExterno || "",
            d.codigoCatalogo || "",
            d.nomeResumo || "",
            d.catalogoDescricao || "",
            d.descricaoComplementar || "",
            d.tipoDivergencia || "",
            d.unidadeDonaId,
            d.unidadeEncontradaId,
            d.localEsperado || "",
            d.salaEncontrada || "",
            d.regularizacaoPendente ? "SIM" : "NAO",
            d.regularizacaoAcao || "",
            d.encontradoEm || "",
            d.regularizadoEm || "",
          ].map(csvEsc).join(","),
        );
      }
      lines.push("");
      lines.push(["secao", "sala", "totalLidos", "conformes", "divergencias"].map(csvEsc).join(","));
      for (const s of report.porSala || []) {
        lines.push(["POR_SALA", s.salaEncontrada, s.totalLidos, s.conformes, s.divergencias].map(csvEsc).join(","));
      }
      lines.push("");
      lines.push(["secao", "artigo", "regra", "evidencias"].map(csvEsc).join(","));
      for (const c of report.compliance || []) {
        lines.push(["COMPLIANCE", c.artigo || "", c.regra || "", (c.evidencias || []).join(" | ")].map(csvEsc).join(","));
      }

      const filename = `relatorio_encerramento_${String(report.evento?.codigoEvento || "evento").replace(/[^a-z0-9_-]/gi, "_")}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.status(200).send(`\uFEFF${lines.join("\n")}`);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retorna contexto do usuario logado para contagem no evento informado.
   * Usado para controlar UI reduzida em modos CEGO/DUPLO_CEGO.
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getMinhaSessaoContagem(req, res, next) {
    const client = await pool.connect();
    try {
      const eventoId = String(req.params?.id || "").trim();
      if (!UUID_RE.test(eventoId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "id do evento deve ser UUID.");
      const perfilId = req.user?.id ? String(req.user.id).trim() : "";
      if (!perfilId || !UUID_RE.test(perfilId)) throw new HttpError(401, "NAO_AUTENTICADO", "Usuario nao autenticado.");

      const sessao = await resolveSessaoContagem(client, eventoId, perfilId, req.user?.role);
      res.json({
        requestId: req.requestId,
        eventoId,
        modoContagem: String(sessao?.evento?.modoContagem || "PADRAO").toUpperCase(),
        papel: sessao.papel || null,
        rodadasPermitidas: sessao.rodadasPermitidas || [],
        podeDesempate: Boolean(sessao.podeDesempate),
        uiReduzida: Boolean(sessao.uiReduzida),
        designado: Boolean(sessao.perfilDesignado),
      });
    } catch (error) {
      next(error);
    } finally {
      client.release();
    }
  }

  /**
   * Painel admin de monitoramento de contagem por sala/rodada.
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getMonitoramentoContagem(req, res, next) {
    try {
      const caps = await getInvSchemaCaps();
      const eventoId = String(req.params?.id || "").trim();
      if (!UUID_RE.test(eventoId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "id do evento deve ser UUID.");
      if (!caps.hasContagensRodadas) throw new HttpError(422, "MIGRACAO_RODADAS_OBRIGATORIA", "Aplique a migration 021.");

      const eventoR = await pool.query(
        `SELECT
           id,
           codigo_evento AS "codigoEvento",
           status::text AS "status",
           unidade_inventariada_id AS "unidadeInventariadaId",
           ${caps.hasModoContagem ? "modo_contagem::text" : "'PADRAO'"} AS "modoContagem"
         FROM eventos_inventario
         WHERE id = $1
         LIMIT 1;`,
        [eventoId],
      );
      if (!eventoR.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.");

      const salasR = await pool.query(
        `WITH esperado AS (
           SELECT
             COALESCE(l.nome, b.local_fisico) AS sala,
             COUNT(*)::int AS qtd_esperados
           FROM bens b
           LEFT JOIN locais l ON l.id = b.local_id
           JOIN eventos_inventario e ON e.id = $1
           WHERE b.eh_bem_terceiro = FALSE
             AND b.status <> 'BAIXADO'::public.status_bem
             AND (e.unidade_inventariada_id IS NULL OR b.unidade_dona_id = e.unidade_inventariada_id)
           GROUP BY COALESCE(l.nome, b.local_fisico)
         ),
         lidos AS (
           SELECT
             cr.sala_encontrada AS sala,
             COUNT(*) FILTER (WHERE cr.rodada = 'A')::int AS qtd_a,
             COUNT(*) FILTER (WHERE cr.rodada = 'B')::int AS qtd_b,
             COUNT(*) FILTER (WHERE cr.rodada = 'DESEMPATE')::int AS qtd_desempate,
             COUNT(DISTINCT cr.bem_id)::int AS qtd_unicos_lidos
           FROM contagens_rodadas cr
           WHERE cr.evento_inventario_id = $1
           GROUP BY cr.sala_encontrada
         )
         SELECT
           COALESCE(e.sala, l.sala) AS "salaEncontrada",
           COALESCE(e.qtd_esperados, 0)::int AS "qtdEsperados",
           COALESCE(l.qtd_a, 0)::int AS "qtdA",
           COALESCE(l.qtd_b, 0)::int AS "qtdB",
           COALESCE(l.qtd_desempate, 0)::int AS "qtdDesempate",
           COALESCE(l.qtd_unicos_lidos, 0)::int AS "qtdUnicosLidos"
         FROM esperado e
         FULL OUTER JOIN lidos l ON l.sala = e.sala
         ORDER BY 1;`,
        [eventoId],
      );

      const pendenciasR = await pool.query(
        `SELECT COUNT(*)::int AS total
         FROM (
           SELECT
             cr.evento_inventario_id,
             cr.bem_id,
             MAX(CASE WHEN cr.rodada='A' THEN concat_ws('|', cr.unidade_encontrada_id::text, lower(trim(cr.sala_encontrada)), COALESCE(cr.local_encontrado_id::text,'')) END) AS p_a,
             MAX(CASE WHEN cr.rodada='B' THEN concat_ws('|', cr.unidade_encontrada_id::text, lower(trim(cr.sala_encontrada)), COALESCE(cr.local_encontrado_id::text,'')) END) AS p_b,
             MAX(CASE WHEN cr.rodada='DESEMPATE' THEN 1 ELSE 0 END) AS tem_desempate
           FROM contagens_rodadas cr
           WHERE cr.evento_inventario_id = $1
           GROUP BY cr.evento_inventario_id, cr.bem_id
         ) x
         WHERE x.p_a IS NOT NULL
           AND x.p_b IS NOT NULL
           AND x.p_a <> x.p_b
           AND x.tem_desempate = 0;`,
        [eventoId],
      );

      const operadores = caps.hasOperadoresEvento ? await listOperadoresEvento(pool, eventoId) : [];
      res.json({
        requestId: req.requestId,
        evento: eventoR.rows[0],
        operadores,
        porSala: salasR.rows,
        pendentesDesempate: Number(pendenciasR.rows[0]?.total || 0),
      });
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
          f.identificador_externo AS "identificadorExterno",
          COALESCE(f.foto_url, b.foto_url) AS "fotoUrl",
          b.nome_resumo AS "nomeResumo",
          f.descricao AS "descricaoComplementar",
          b.catalogo_bem_id AS "catalogoBemId",
          cb.codigo_catalogo AS "codigoCatalogo",
          cb.descricao AS "catalogoDescricao",
          cb.foto_referencia_url AS "fotoReferenciaUrl",
          f.unidade_dona_id AS "unidadeDonaId",
          f.unidade_encontrada_id AS "unidadeEncontradaId",
          f.sala_encontrada AS "salaEncontrada",
          b.local_id AS "localEsperadoId",
          b.local_fisico AS "localEsperadoTexto",
          l.nome AS "localEsperadoNome",
          f.encontrado_em AS "encontradoEm",
          f.encontrado_por_perfil_id AS "encontradoPorPerfilId",
          f.observacoes
        FROM public.vw_forasteiros f
        JOIN public.bens b ON b.id = f.bem_id
        JOIN public.catalogo_bens cb ON cb.id = b.catalogo_bem_id
        LEFT JOIN public.locais l ON l.id = b.local_id
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
   * Lista ocorrencias de "bens de terceiros" registradas no inventario.
   *
   * Regra legal:
   * - Controle segregado de bens de terceiros.
   *   Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX).
   *
   * Query params:
   * - eventoInventarioId: UUID (opcional)
   * - salaEncontrada: string (opcional)
   * - limit: number (opcional; default 200; max 2000)
   *
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getBensTerceiros(req, res, next) {
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

      const limitRaw = q.limit != null ? Number(q.limit) : 200;
      const limit = Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 200;
      const limitFinal = Math.max(1, Math.min(2000, limit));

      const where = ["1=1"];
      const params = [];
      let i = 1;

      if (eventoInventarioId) {
        where.push(`t.evento_inventario_id = $${i}`);
        params.push(eventoInventarioId);
        i += 1;
      }
      if (salaEncontrada) {
        where.push(`lower(trim(t.sala_encontrada)) = lower(trim($${i}))`);
        params.push(salaEncontrada);
        i += 1;
      }

      const r = await pool.query(
        `SELECT
           t.contagem_id AS "contagemId",
           t.evento_inventario_id AS "eventoInventarioId",
           t.codigo_evento AS "codigoEvento",
           t.status_inventario AS "statusInventario",
           t.unidade_encontrada_id AS "unidadeEncontradaId",
           t.sala_encontrada AS "salaEncontrada",
           t.encontrado_em AS "encontradoEm",
           t.encontrado_por_perfil_id AS "encontradoPorPerfilId",
           t.observacoes,
           t.bem_id AS "bemId",
           t.identificador_externo AS "identificadorExterno",
           t.descricao,
           t.proprietario_externo AS "proprietarioExterno",
           t.contrato_referencia AS "contratoReferencia"
         FROM public.vw_bens_terceiros_inventario t
         WHERE ${where.join(" AND ")}
         ORDER BY t.encontrado_em DESC
         LIMIT $${i};`,
        [...params, limitFinal],
      );

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
      const caps = await getInvSchemaCaps();
      const body = req.body || {};
      const codigoEvento = String(body.codigoEvento || "").trim();
      if (!codigoEvento) throw new HttpError(422, "CODIGO_EVENTO_OBRIGATORIO", "codigoEvento e obrigatorio.");
      if (codigoEvento.length > 60) throw new HttpError(422, "CODIGO_EVENTO_TAMANHO", "codigoEvento excede 60 caracteres.");

      let unidadeInventariadaId = body.unidadeInventariadaId == null || String(body.unidadeInventariadaId).trim() === ""
        ? null
        : Number(body.unidadeInventariadaId);
      if (unidadeInventariadaId != null && (!Number.isInteger(unidadeInventariadaId) || !VALID_UNIDADES.has(unidadeInventariadaId))) {
        throw new HttpError(422, "UNIDADE_INVENTARIADA_INVALIDA", "unidadeInventariadaId deve ser 1..4 ou null (inventario geral).");
      }

      const tipoCiclo = String(body.tipoCiclo || body.periodicidade || "ADHOC").trim().toUpperCase();
      if (!VALID_CICLOS.has(tipoCiclo)) {
        throw new HttpError(422, "TIPO_CICLO_INVALIDO", "tipoCiclo deve ser: SEMANAL, MENSAL, ANUAL ou ADHOC.");
      }

      let escopoTipo = String(body.escopoTipo || "").trim().toUpperCase();
      if (!escopoTipo) escopoTipo = unidadeInventariadaId == null ? "GERAL" : "UNIDADE";
      if (!VALID_ESCOPO.has(escopoTipo)) {
        throw new HttpError(422, "ESCOPO_TIPO_INVALIDO", "escopoTipo deve ser: GERAL, UNIDADE ou LOCAIS.");
      }
      const modoContagem = String(body.modoContagem || "PADRAO").trim().toUpperCase();
      if (!VALID_MODO_CONTAGEM.has(modoContagem)) {
        throw new HttpError(422, "MODO_CONTAGEM_INVALIDO", "modoContagem deve ser PADRAO, CEGO ou DUPLO_CEGO.");
      }
      const operadoresDesignados = normalizeOperadoresDesignados(body.operadoresDesignados);
      validateOperadoresByMode(modoContagem, operadoresDesignados);

      const escopoLocalIds = Array.isArray(body.escopoLocalIds)
        ? Array.from(new Set(body.escopoLocalIds.map((x) => String(x || "").trim()).filter(Boolean)))
        : [];
      if (escopoTipo === "LOCAIS") {
        if (!caps.hasEventosLocais || !caps.hasEscopoTipo || !caps.hasTipoCiclo) {
          throw new HttpError(
            422,
            "MIGRACAO_INVENTARIO_CICLICO_OBRIGATORIA",
            "Banco ainda nao possui suporte a escopo LOCAIS. Aplique a migration 017_inventario_ciclico_escopo.sql."
          );
        }
        if (!escopoLocalIds.length) {
          throw new HttpError(422, "ESCOPO_LOCAIS_OBRIGATORIO", "escopoLocalIds e obrigatorio quando escopoTipo=LOCAIS.");
        }
        if (!escopoLocalIds.every((id) => UUID_RE.test(id))) {
          throw new HttpError(422, "ESCOPO_LOCAL_ID_INVALIDO", "Todos escopoLocalIds devem ser UUID.");
        }
        const locaisR = await pool.query(
          `SELECT id, unidade_id AS "unidadeId"
           FROM locais
           WHERE id = ANY($1::uuid[]);`,
          [escopoLocalIds],
        );
        if (locaisR.rowCount !== escopoLocalIds.length) {
          throw new HttpError(422, "ESCOPO_LOCAL_NAO_ENCONTRADO", "Um ou mais locais informados nao existem.");
        }
        const unidades = Array.from(new Set(locaisR.rows.map((x) => Number(x.unidadeId || 0)).filter((u) => VALID_UNIDADES.has(u))));
        if (unidades.length !== 1) {
          throw new HttpError(422, "ESCOPO_LOCAIS_UNIDADE_MISTA", "escopoLocalIds deve conter locais de uma unica unidade.");
        }
        const unidadeDosLocais = unidades[0];
        if (unidadeInventariadaId != null && unidadeInventariadaId !== unidadeDosLocais) {
          throw new HttpError(422, "UNIDADE_DIVERGENTE_ESCOPO", "unidadeInventariadaId diverge da unidade dos locais informados.");
        }
        unidadeInventariadaId = unidadeDosLocais;
      }
      if (escopoTipo === "UNIDADE" && unidadeInventariadaId == null) {
        throw new HttpError(422, "UNIDADE_INVENTARIADA_OBRIGATORIA", "unidadeInventariadaId e obrigatoria para escopo UNIDADE.");
      }
      if (escopoTipo === "GERAL") {
        unidadeInventariadaId = null;
      }

      const conflito = await pool.query(
        `SELECT id, codigo_evento AS "codigoEvento", unidade_inventariada_id AS "unidadeInventariadaId",
                COALESCE((to_jsonb(eventos_inventario)->>'escopo_tipo'), CASE WHEN unidade_inventariada_id IS NULL THEN 'GERAL' ELSE 'UNIDADE' END) AS "escopoTipo"
         FROM eventos_inventario
         WHERE status = 'EM_ANDAMENTO'
           AND (
             $1 = 'GERAL'
             OR COALESCE((to_jsonb(eventos_inventario)->>'escopo_tipo'), CASE WHEN unidade_inventariada_id IS NULL THEN 'GERAL' ELSE 'UNIDADE' END) = 'GERAL'
             OR ($1 IN ('UNIDADE', 'LOCAIS') AND unidade_inventariada_id = $2)
           )
         LIMIT 1;`,
        [escopoTipo, unidadeInventariadaId],
      );
      if (conflito.rowCount) {
        const c = conflito.rows[0];
        throw new HttpError(
          409,
          "EVENTO_ATIVO_EXISTENTE",
          `Ja existe inventario EM_ANDAMENTO em escopo conflitante (evento=${c.codigoEvento || c.id}, escopo=${c.escopoTipo || "UNIDADE"}, unidade=${unitLabel(c.unidadeInventariadaId)}).`
        );
      }

      const abertoPorPerfilId = req.user?.id
        ? String(req.user.id).trim()
        : String(body.abertoPorPerfilId || "").trim();
      if (!abertoPorPerfilId || !UUID_RE.test(abertoPorPerfilId)) {
        throw new HttpError(422, "ABERTO_POR_INVALIDO", "abertoPorPerfilId (UUID) e obrigatorio.");
      }

      const observacoesRaw = body.observacoes != null ? String(body.observacoes).trim() : "";
      const observacoes = observacoesRaw ? observacoesRaw.slice(0, 2000) : null;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let r;
        if (caps.hasTipoCiclo && caps.hasEscopoTipo) {
          const hasModo = caps.hasModoContagem;
          const valuesSql = hasModo
            ? "($1,$2,$3,$4,$5::public.modo_contagem_inventario,'EM_ANDAMENTO',NOW(),$6,$7)"
            : "($1,$2,$3,$4,'EM_ANDAMENTO',NOW(),$5,$6)";
          r = await client.query(
            `INSERT INTO eventos_inventario (
               codigo_evento, unidade_inventariada_id, tipo_ciclo, escopo_tipo, ${hasModo ? "modo_contagem," : ""}
               status, iniciado_em, aberto_por_perfil_id, observacoes
             ) VALUES ${valuesSql}
             RETURNING
               id,
               codigo_evento AS "codigoEvento",
               unidade_inventariada_id AS "unidadeInventariadaId",
               COALESCE((to_jsonb(eventos_inventario)->>'tipo_ciclo'), 'ADHOC') AS "tipoCiclo",
               COALESCE((to_jsonb(eventos_inventario)->>'escopo_tipo'), CASE WHEN unidade_inventariada_id IS NULL THEN 'GERAL' ELSE 'UNIDADE' END) AS "escopoTipo",
               ${hasModo ? "COALESCE((to_jsonb(eventos_inventario)->>'modo_contagem'), 'PADRAO')" : "'PADRAO'"} AS "modoContagem",
               status::text AS "status",
               iniciado_em AS "iniciadoEm",
               aberto_por_perfil_id AS "abertoPorPerfilId",
               observacoes;`,
            hasModo
              ? [codigoEvento, unidadeInventariadaId, tipoCiclo, escopoTipo, modoContagem, abertoPorPerfilId, observacoes]
              : [codigoEvento, unidadeInventariadaId, tipoCiclo, escopoTipo, abertoPorPerfilId, observacoes],
          );
        } else {
          const valuesSql = caps.hasModoContagem
            ? "($1,$2,$3::public.modo_contagem_inventario,'EM_ANDAMENTO',NOW(),$4,$5)"
            : "($1,$2,'EM_ANDAMENTO',NOW(),$3,$4)";
          r = await client.query(
            `INSERT INTO eventos_inventario (
               codigo_evento, unidade_inventariada_id, ${caps.hasModoContagem ? "modo_contagem," : ""}
               status, iniciado_em, aberto_por_perfil_id, observacoes
             ) VALUES ${valuesSql}
             RETURNING
               id,
               codigo_evento AS "codigoEvento",
               unidade_inventariada_id AS "unidadeInventariadaId",
               'ADHOC' AS "tipoCiclo",
               CASE WHEN unidade_inventariada_id IS NULL THEN 'GERAL' ELSE 'UNIDADE' END AS "escopoTipo",
               ${caps.hasModoContagem ? "COALESCE((to_jsonb(eventos_inventario)->>'modo_contagem'), 'PADRAO')" : "'PADRAO'"} AS "modoContagem",
               status::text AS "status",
               iniciado_em AS "iniciadoEm",
               aberto_por_perfil_id AS "abertoPorPerfilId",
               observacoes;`,
            caps.hasModoContagem
              ? [codigoEvento, unidadeInventariadaId, modoContagem, abertoPorPerfilId, observacoes]
              : [codigoEvento, unidadeInventariadaId, abertoPorPerfilId, observacoes],
          );
        }

        const created = r.rows[0];
        if (caps.hasEventosLocais && escopoTipo === "LOCAIS" && escopoLocalIds.length) {
          await client.query(
            `INSERT INTO eventos_inventario_locais (evento_inventario_id, local_id)
             SELECT $1, x::uuid
             FROM unnest($2::text[]) AS x
             ON CONFLICT DO NOTHING;`,
            [created.id, escopoLocalIds],
          );
          const escopoLocaisR = await client.query(
            `SELECT l.id AS "localId", l.nome, l.unidade_id AS "unidadeId"
             FROM eventos_inventario_locais eil
             JOIN locais l ON l.id = eil.local_id
             WHERE eil.evento_inventario_id = $1
             ORDER BY l.nome;`,
            [created.id],
          );
          created.escopoLocais = escopoLocaisR.rows;
        } else {
          created.escopoLocais = [];
        }
        if ((modoContagem === "CEGO" || modoContagem === "DUPLO_CEGO") && !caps.hasOperadoresEvento) {
          throw new HttpError(
            422,
            "MIGRACAO_MODO_CONTAGEM_OBRIGATORIA",
            "Banco ainda nao possui suporte a operadores por evento. Aplique a migration 021_inventario_modos_contagem_cego_duplo_cego.sql.",
          );
        }
        if (caps.hasOperadoresEvento && operadoresDesignados.length) {
          for (const op of operadoresDesignados) {
            await client.query(
              `INSERT INTO eventos_inventario_operadores (
                 evento_inventario_id, perfil_id, papel_contagem, ativo, permite_desempate
               ) VALUES ($1,$2,$3::public.papel_contagem_inventario,TRUE,$4)
               ON CONFLICT (evento_inventario_id, perfil_id)
               DO UPDATE SET
                 papel_contagem = EXCLUDED.papel_contagem,
                 ativo = TRUE,
                 permite_desempate = EXCLUDED.permite_desempate;`,
              [created.id, op.perfilId, op.papelContagem, Boolean(op.permiteDesempate)],
            );
          }
          created.operadoresDesignados = await listOperadoresEvento(client, created.id);
        } else {
          created.operadoresDesignados = [];
        }
        await client.query("COMMIT");
        res.status(201).json({ requestId: req.requestId, evento: created });
      } catch (error) {
        await safeRollback(client);
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Lista divergencias interunidades com visibilidade cruzada entre unidade dona e unidade encontrada.
   *
   * Regras legais:
   * - Divergencias permanecem registradas sem transferencia automatica de carga durante inventario.
   *   Art. 185 (AN303_Art185).
   * - Movimentacao/regularizacao continua em fluxo proprio pos-encerramento.
   *
   * Query params:
   * - statusInventario: EM_ANDAMENTO | ENCERRADO | TODOS (default TODOS)
   * - eventoInventarioId: UUID (opcional)
   * - unidadeDonaId: 1..4 (opcional)
   * - unidadeEncontradaId: 1..4 (opcional)
   * - unidadeRelacionadaId: 1..4 (opcional; unidade dona OU encontrada)
   * - limit: number (opcional; default 200; max 1000)
   * - offset: number (opcional; default 0)
   *
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function getDivergenciasInterunidades(req, res, next) {
    try {
      const q = req.query || {};
      const statusInventario = String(q.statusInventario || "TODOS").trim().toUpperCase();
      if (!new Set(["EM_ANDAMENTO", "ENCERRADO", "TODOS"]).has(statusInventario)) {
        throw new HttpError(422, "STATUS_INVENTARIO_INVALIDO", "statusInventario deve ser EM_ANDAMENTO, ENCERRADO ou TODOS.");
      }

      const eventoInventarioId = q.eventoInventarioId != null && String(q.eventoInventarioId).trim() !== ""
        ? String(q.eventoInventarioId).trim()
        : null;
      if (eventoInventarioId && !UUID_RE.test(eventoInventarioId)) {
        throw new HttpError(422, "EVENTO_ID_INVALIDO", "eventoInventarioId deve ser UUID.");
      }

      const parseUnit = (raw, code) => {
        if (raw == null || String(raw).trim() === "") return null;
        const n = Number(raw);
        if (!Number.isInteger(n) || !VALID_UNIDADES.has(n)) {
          throw new HttpError(422, code, "Unidade deve ser 1..4.");
        }
        return n;
      };

      const unidadeDonaId = parseUnit(q.unidadeDonaId, "UNIDADE_DONA_INVALIDA");
      const unidadeEncontradaId = parseUnit(q.unidadeEncontradaId, "UNIDADE_ENCONTRADA_INVALIDA");
      const unidadeRelacionadaId = parseUnit(q.unidadeRelacionadaId, "UNIDADE_RELACIONADA_INVALIDA");

      const limitRaw = q.limit != null ? Number(q.limit) : 200;
      const offsetRaw = q.offset != null ? Number(q.offset) : 0;
      const limit = Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 200;
      const offset = Number.isFinite(offsetRaw) ? Math.trunc(offsetRaw) : 0;
      const limitFinal = Math.max(1, Math.min(1000, limit));
      const offsetFinal = Math.max(0, offset);

      const isAdmin = String(req.user?.role || "").toUpperCase() === "ADMIN";
      const userUnidadeId = Number(req.user?.unidadeId || 0);
      const userHasValidUnit = VALID_UNIDADES.has(userUnidadeId);

      const where = [
        `c.tipo_ocorrencia = 'ENCONTRADO_EM_LOCAL_DIVERGENTE'::public.tipo_ocorrencia_inventario`,
        `(e.status = 'EM_ANDAMENTO'::public.status_inventario OR (e.status = 'ENCERRADO'::public.status_inventario AND c.regularizacao_pendente = TRUE))`,
      ];
      const params = [];
      let i = 1;

      if (statusInventario !== "TODOS") {
        where.push(`e.status = $${i}::public.status_inventario`);
        params.push(statusInventario);
        i += 1;
      }
      if (eventoInventarioId) {
        where.push(`c.evento_inventario_id = $${i}`);
        params.push(eventoInventarioId);
        i += 1;
      }
      if (unidadeDonaId != null) {
        where.push(`b.unidade_dona_id = $${i}`);
        params.push(unidadeDonaId);
        i += 1;
      }
      if (unidadeEncontradaId != null) {
        where.push(`c.unidade_encontrada_id = $${i}`);
        params.push(unidadeEncontradaId);
        i += 1;
      }

      if (isAdmin) {
        if (unidadeRelacionadaId != null) {
          where.push(`(b.unidade_dona_id = $${i} OR c.unidade_encontrada_id = $${i})`);
          params.push(unidadeRelacionadaId);
          i += 1;
        }
      } else if (userHasValidUnit) {
        where.push(`(b.unidade_dona_id = $${i} OR c.unidade_encontrada_id = $${i})`);
        params.push(userUnidadeId);
        i += 1;
      } else {
        // Usuario autenticado sem unidade valida nao recebe dados de outras unidades.
        where.push("1=0");
      }

      const sql = `
        SELECT
          c.id AS "contagemId",
          c.evento_inventario_id AS "eventoInventarioId",
          e.codigo_evento AS "codigoEvento",
          e.status::text AS "statusInventario",
          e.unidade_inventariada_id AS "unidadeInventariadaId",
          b.id AS "bemId",
          b.numero_tombamento AS "numeroTombamento",
          b.nome_resumo AS "nomeResumo",
          cb.codigo_catalogo AS "codigoCatalogo",
          b.unidade_dona_id AS "unidadeDonaId",
          c.unidade_encontrada_id AS "unidadeEncontradaId",
          c.sala_encontrada AS "salaEncontrada",
          COALESCE(l.nome, b.local_fisico) AS "localEsperado",
          CASE
            WHEN b.unidade_dona_id <> c.unidade_encontrada_id
                 AND lower(trim(COALESCE(c.sala_encontrada, ''))) <> lower(trim(COALESCE(l.nome, b.local_fisico, '')))
              THEN 'UNIDADE_E_SALA'
            WHEN b.unidade_dona_id <> c.unidade_encontrada_id
              THEN 'UNIDADE'
            WHEN lower(trim(COALESCE(c.sala_encontrada, ''))) <> lower(trim(COALESCE(l.nome, b.local_fisico, '')))
              THEN 'SALA'
            ELSE 'DIVERGENTE'
          END AS "tipoDivergencia",
          c.regularizacao_pendente AS "regularizacaoPendente",
          c.regularizado_em AS "regularizadoEm",
          c.regularizacao_acao AS "regularizacaoAcao",
          c.encontrado_em AS "encontradoEm",
          COUNT(*) OVER()::int AS "totalCount"
        FROM contagens c
        JOIN eventos_inventario e ON e.id = c.evento_inventario_id
        JOIN bens b ON b.id = c.bem_id
        JOIN catalogo_bens cb ON cb.id = b.catalogo_bem_id
        LEFT JOIN locais l ON l.id = b.local_id
        WHERE ${where.join(" AND ")}
        ORDER BY c.encontrado_em DESC
        LIMIT $${i}
        OFFSET $${i + 1};`;

      const r = await pool.query(sql, [...params, limitFinal, offsetFinal]);
      const total = Number(r.rows[0]?.totalCount || 0);
      const items = r.rows.map(({ totalCount, ...row }) => row);

      res.json({
        requestId: req.requestId,
        statusInventario,
        limit: limitFinal,
        offset: offsetFinal,
        total,
        items,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Atualiza status do evento (EM_ANDAMENTO/ENCERRADO/CANCELADO).
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
      if (status !== "EM_ANDAMENTO" && status !== "ENCERRADO" && status !== "CANCELADO") {
        throw new HttpError(422, "STATUS_INVALIDO", "status deve ser EM_ANDAMENTO, ENCERRADO ou CANCELADO.");
      }

      const encerradoPorPerfilId = req.user?.id
        ? String(req.user.id).trim()
        : String(body.encerradoPorPerfilId || "").trim();
      if (!encerradoPorPerfilId || !UUID_RE.test(encerradoPorPerfilId)) {
        throw new HttpError(422, "ENCERRADOR_INVALIDO", "encerradoPorPerfilId (UUID) e obrigatorio.");
      }
      const perfilR = await pool.query(
        `SELECT id
         FROM perfis
         WHERE id = $1
         LIMIT 1;`,
        [encerradoPorPerfilId],
      );
      if (!perfilR.rowCount) {
        throw new HttpError(422, "ENCERRADOR_NAO_ENCONTRADO", "Perfil informado para encerramento nao foi encontrado.");
      }

      const observacoesRaw = body.observacoes != null ? String(body.observacoes).trim() : "";
      const observacoes = observacoesRaw ? observacoesRaw.slice(0, 2000) : null;

      if (status === "EM_ANDAMENTO") {
        const conflito = await pool.query(
          `SELECT e.id, e.codigo_evento AS "codigoEvento", e.unidade_inventariada_id AS "unidadeInventariadaId"
           FROM eventos_inventario e
           JOIN eventos_inventario alvo ON alvo.id = $1
           WHERE e.status = 'EM_ANDAMENTO'
             AND e.id <> $1
             AND (
               alvo.unidade_inventariada_id IS NULL
               OR e.unidade_inventariada_id IS NULL
               OR e.unidade_inventariada_id = alvo.unidade_inventariada_id
             )
           LIMIT 1;`,
           [eventoId],
         );
        if (conflito.rowCount) {
          const c = conflito.rows[0];
          throw new HttpError(
            409,
            "EVENTO_ATIVO_EXISTENTE",
            `Ja existe inventario EM_ANDAMENTO em escopo conflitante (evento=${c.codigoEvento || c.id}, unidade=${unitLabel(c.unidadeInventariadaId)}).`
          );
        }
      }

      const r = await pool.query(
        `UPDATE eventos_inventario
         SET status = $1::public.status_inventario,
              encerrado_em = CASE WHEN $1 = 'EM_ANDAMENTO' THEN NULL ELSE NOW() END,
              encerrado_por_perfil_id = CASE WHEN $1 = 'EM_ANDAMENTO' THEN NULL ELSE $2::uuid END,
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
   * Atualiza dados gerais do evento de inventario (codigo, unidade, observacoes).
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function patchEvento(req, res, next) {
    try {
      const eventoId = String(req.params?.id || "").trim();
      if (!UUID_RE.test(eventoId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "id do evento deve ser UUID.");

      const currentEvento = await pool.query(
        `SELECT id, status::text AS status, unidade_inventariada_id AS "unidadeInventariadaId"
         FROM eventos_inventario
         WHERE id = $1
         LIMIT 1;`,
        [eventoId],
      );
      if (!currentEvento.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.");
      const eventoAtual = currentEvento.rows[0];

      const body = req.body || {};
      const fields = [];
      const params = [];
      let i = 1;

      if (body.codigoEvento !== undefined) {
        const codigo = String(body.codigoEvento || "").trim();
        if (!codigo) throw new HttpError(422, "CODIGO_EVENTO_OBRIGATORIO", "codigoEvento nao pode ser vazio.");
        fields.push(`codigo_evento = $${i}`);
        params.push(codigo);
        i += 1;
      }
      if (body.unidadeInventariadaId !== undefined) {
        const uId = body.unidadeInventariadaId ? Number(body.unidadeInventariadaId) : null;
        if (uId != null && (!Number.isInteger(uId) || !VALID_UNIDADES.has(uId))) {
          throw new HttpError(422, "UNIDADE_INVENTARIADA_INVALIDA", "unidadeInventariadaId deve ser 1..4 ou null.");
        }
        if (eventoAtual.status === "EM_ANDAMENTO" && Number(uId || 0) !== Number(eventoAtual.unidadeInventariadaId || 0)) {
          const conflito = uId == null
            ? await pool.query(
              `SELECT id, codigo_evento AS "codigoEvento", unidade_inventariada_id AS "unidadeInventariadaId"
               FROM eventos_inventario
               WHERE status = 'EM_ANDAMENTO'
                 AND id <> $1
               LIMIT 1;`,
              [eventoId],
            )
            : await pool.query(
              `SELECT id, codigo_evento AS "codigoEvento", unidade_inventariada_id AS "unidadeInventariadaId"
               FROM eventos_inventario
               WHERE status = 'EM_ANDAMENTO'
                 AND id <> $1
                 AND (unidade_inventariada_id IS NULL OR unidade_inventariada_id = $2)
               LIMIT 1;`,
              [eventoId, uId],
            );
          if (conflito.rowCount) {
            const c = conflito.rows[0];
            throw new HttpError(
              409,
              "EVENTO_ATIVO_EXISTENTE",
              `Nao e possivel alterar escopo deste evento ativo: conflito com evento=${c.codigoEvento || c.id} (unidade=${unitLabel(c.unidadeInventariadaId)}).`
            );
          }
        }
        fields.push(`unidade_inventariada_id = $${i}`);
        params.push(uId);
        i += 1;
      }
      if (body.observacoes !== undefined) {
        fields.push(`observacoes = $${i}`);
        params.push(body.observacoes ? String(body.observacoes).trim().slice(0, 2000) : null);
        i += 1;
      }

      if (!fields.length) throw new HttpError(422, "PATCH_VAZIO", "Envie ao menos um campo para atualizar.");

      fields.push("updated_at = NOW()");
      const r = await pool.query(
        `UPDATE eventos_inventario
         SET ${fields.join(", ")}
         WHERE id = $${i}
         RETURNING
           id,
           codigo_evento AS "codigoEvento",
           unidade_inventariada_id AS "unidadeInventariadaId",
           status::text AS "status",
           observacoes;`,
        [...params, eventoId],
      );
      if (!r.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.");

      res.json({ requestId: req.requestId, evento: r.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exclui um evento de inventario e em cascata suas contagens (forasteiros).
   * @param {import("express").Request} req Request.
   * @param {import("express").Response} res Response.
   * @param {Function} next Next.
   */
  async function deleteEvento(req, res, next) {
    try {
      const eventoId = String(req.params?.id || "").trim();
      if (!UUID_RE.test(eventoId)) throw new HttpError(422, "EVENTO_ID_INVALIDO", "id do evento deve ser UUID.");

      const r = await pool.query(
        `DELETE FROM eventos_inventario
         WHERE id = $1
         RETURNING id;`,
        [eventoId],
      );
      if (!r.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento nao encontrado.");

      res.json({ requestId: req.requestId, deletedId: r.rows[0].id });
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

      const localEncontradoId = body.localEncontradoId != null && String(body.localEncontradoId).trim() !== ""
        ? String(body.localEncontradoId).trim()
        : null;
      if (localEncontradoId && !UUID_RE.test(localEncontradoId)) {
        throw new HttpError(422, "LOCAL_ENCONTRADO_INVALIDO", "localEncontradoId deve ser UUID.");
      }

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

      const caps = await getInvSchemaCaps();
      const ev = await client.query(
        `SELECT
           id,
           status::text AS status,
           unidade_inventariada_id AS "unidadeInventariadaId",
           COALESCE((to_jsonb(eventos_inventario)->>'escopo_tipo'), CASE WHEN unidade_inventariada_id IS NULL THEN 'GERAL' ELSE 'UNIDADE' END) AS "escopoTipo",
           ${caps.hasModoContagem ? "modo_contagem::text" : "'PADRAO'"} AS "modoContagem"
         FROM eventos_inventario
         WHERE id = $1`,
        [eventoInventarioId],
      );
      if (!ev.rowCount) throw new HttpError(404, "EVENTO_NAO_ENCONTRADO", "Evento de inventario nao encontrado.");
      if (ev.rows[0].status !== "EM_ANDAMENTO") {
        throw new HttpError(409, "EVENTO_NAO_ATIVO", "Evento de inventario nao esta EM_ANDAMENTO.");
      }
      const escopoTipoEvento = String(ev.rows[0].escopoTipo || "GERAL").toUpperCase();
      const eventoUnidade = ev.rows[0].unidadeInventariadaId != null ? Number(ev.rows[0].unidadeInventariadaId) : null;
      if (eventoUnidade != null && eventoUnidade !== unidadeEncontradaId) {
        throw new HttpError(
          409,
          "UNIDADE_FORA_ESCOPO_EVENTO",
          `Este evento esta em escopo da unidade ${unitLabel(eventoUnidade)}. Selecione unidade encontrada ${unitLabel(eventoUnidade)} ou use o evento correto.`
        );
      }
      if (escopoTipoEvento === "LOCAIS") {
        if (!caps.hasEventosLocais) {
          throw new HttpError(
            422,
            "MIGRACAO_INVENTARIO_CICLICO_OBRIGATORIA",
            "Banco ainda nao possui eventos_inventario_locais. Aplique a migration 017_inventario_ciclico_escopo.sql."
          );
        }
        if (!localEncontradoId) {
          throw new HttpError(422, "LOCAL_ENCONTRADO_OBRIGATORIO", "localEncontradoId e obrigatorio para evento com escopo LOCAIS.");
        }
        const evLocal = await client.query(
          `SELECT 1
           FROM eventos_inventario_locais
           WHERE evento_inventario_id = $1
             AND local_id = $2
           LIMIT 1;`,
          [eventoInventarioId, localEncontradoId],
        );
        if (!evLocal.rowCount) {
          throw new HttpError(
            409,
            "LOCAL_FORA_ESCOPO_EVENTO",
            "localEncontradoId nao pertence ao escopo de salas deste evento."
          );
        }
      }
      const modoContagem = String(ev.rows[0].modoContagem || "PADRAO").toUpperCase();
      let rodada = String(body.rodada || "").trim().toUpperCase();
      if (!rodada) rodada = modoContagem === "PADRAO" ? "A" : "";
      if (!VALID_RODADA.has(rodada)) {
        throw new HttpError(422, "RODADA_INVALIDA", "rodada deve ser A, B ou DESEMPATE.");
      }

      const perfilExec = req.user?.id ? String(req.user.id).trim() : null;
      if (!perfilExec || !UUID_RE.test(perfilExec)) throw new HttpError(401, "NAO_AUTENTICADO", "Usuario nao autenticado.");
      const sessao = await resolveSessaoContagem(client, eventoInventarioId, perfilExec, req.user?.role);
      if (modoContagem !== "PADRAO") {
        if (!sessao.perfilDesignado && !(rodada === "DESEMPATE" && sessao.podeDesempate)) {
          throw new HttpError(403, "NAO_DESIGNADO", "Usuario nao designado para contagem neste evento.");
        }
        if (rodada === "DESEMPATE") {
          if (!sessao.podeDesempate) throw new HttpError(403, "DESEMPATE_SEM_PERMISSAO", "Usuario sem permissao para desempate.");
        } else if (!(sessao.rodadasPermitidas || []).includes(rodada)) {
          throw new HttpError(403, "RODADA_NAO_PERMITIDA", `Rodada ${rodada} nao permitida para este usuario neste evento.`);
        }
      }

      const summary = {
        totalItens: itens.length,
        inseridas: 0,
        atualizadas: 0,
        divergentes: 0,
        pendentesDesempate: 0,
        erros: [],
      };
      const normalizeRoomLabel = (raw) => String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
      async function upsertConsolidada(params) {
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
          params,
        );
        return Boolean(up.rows[0]?.inserted);
      }

      async function reconcileRodadas(bemId, defaults) {
        const rr = await client.query(
          `SELECT
             rodada::text AS rodada,
             unidade_encontrada_id AS "unidadeEncontradaId",
             sala_encontrada AS "salaEncontrada",
             local_encontrado_id AS "localEncontradoId",
             encontrado_por_perfil_id AS "encontradoPorPerfilId",
             encontrado_em AS "encontradoEm",
             observacoes
           FROM contagens_rodadas
           WHERE evento_inventario_id = $1
             AND bem_id = $2;`,
          [eventoInventarioId, bemId],
        );
        const byRodada = new Map(rr.rows.map((x) => [String(x.rodada || "").toUpperCase(), x]));
        const a = byRodada.get("A") || null;
        const b = byRodada.get("B") || null;
        const d = byRodada.get("DESEMPATE") || null;
        const pick = d || a || b;
        if (!pick) return { divergente: false, pendenteDesempate: false, inserted: false };

        const signature = (x) => {
          if (!x) return "";
          return [
            String(x.unidadeEncontradaId || ""),
            normalizeRoomLabel(x.salaEncontrada || ""),
            x.localEncontradoId ? String(x.localEncontradoId) : "",
          ].join("|");
        };
        const pendenteDesempate = Boolean(a && b && signature(a) !== signature(b) && !d);
        const unidadeDivergente = Number(defaults.unidadeDonaId) !== Number(pick.unidadeEncontradaId);
        const salaDivergente = defaults.localDonoId && pick.localEncontradoId
          ? String(defaults.localDonoId) !== String(pick.localEncontradoId)
          : defaults.localDonoNome
            ? normalizeRoomLabel(defaults.localDonoNome) !== normalizeRoomLabel(pick.salaEncontrada)
            : false;
        const divergente = pendenteDesempate || unidadeDivergente || salaDivergente;
        const tipoOcorrencia = divergente ? "ENCONTRADO_EM_LOCAL_DIVERGENTE" : "CONFORME";
        const regularizacaoPendente = divergente;
        const obs = [
          pick.observacoes || null,
          `[MODO_CONTAGEM=${modoContagem}]`,
          `[RODADA_BASE=${d ? "DESEMPATE" : a && b ? "A_B_CONCORDANTE" : a ? "A" : "B"}]`,
          pendenteDesempate ? "[PENDENTE_DESEMPATE=TRUE]" : null,
        ].filter(Boolean).join(" ");
        const inserted = await upsertConsolidada([
          eventoInventarioId,
          bemId,
          pick.unidadeEncontradaId,
          pick.salaEncontrada,
          tipoOcorrencia,
          regularizacaoPendente,
          pick.encontradoPorPerfilId || perfilExec,
          pick.encontradoEm || new Date().toISOString(),
          obs || null,
        ]);
        return { divergente, pendenteDesempate, inserted };
      }

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
            `SELECT b.id, b.unidade_dona_id, b.local_id, l.nome AS local_nome
             FROM bens b
             LEFT JOIN locais l ON l.id = b.local_id
             WHERE b.numero_tombamento = $1
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
          const localDonoId = b.rows[0].local_id != null ? String(b.rows[0].local_id) : null;
          const localDonoNome = b.rows[0].local_nome != null ? String(b.rows[0].local_nome) : null;
          const divergenciaUnidade = unidadeDonaId !== unidadeEncontradaId;
          let divergenciaSala = false;
          if (localDonoId && localEncontradoId) {
            divergenciaSala = localDonoId !== localEncontradoId;
          } else if (localDonoNome) {
            divergenciaSala = normalizeRoomLabel(localDonoNome) !== normalizeRoomLabel(salaEncontrada);
          }
          const divergente = divergenciaUnidade || divergenciaSala;
          const tipoOcorrencia = divergente ? "ENCONTRADO_EM_LOCAL_DIVERGENTE" : "CONFORME";
          const regularizacaoPendente = divergente ? true : false;
          let inserted = false;
          let divergenteFinal = divergente;
          let pendenteDesempate = false;
          if (modoContagem === "PADRAO") {
            inserted = await upsertConsolidada([
              eventoInventarioId,
              bemId,
              unidadeEncontradaId,
              salaEncontrada,
              tipoOcorrencia,
              regularizacaoPendente,
              encontradoPorPerfilId || perfilExec,
              encontradoEm.toISOString(),
              observacoes,
            ]);
          } else {
            if (!caps.hasContagensRodadas) {
              throw new HttpError(
                422,
                "MIGRACAO_CONTAGENS_RODADAS_OBRIGATORIA",
                "Banco ainda nao possui contagens_rodadas. Aplique a migration 021_inventario_modos_contagem_cego_duplo_cego.sql."
              );
            }
            await client.query(
              `INSERT INTO contagens_rodadas (
                 evento_inventario_id, bem_id, rodada, encontrado_por_perfil_id,
                 unidade_encontrada_id, sala_encontrada, local_encontrado_id,
                 status_apurado, tipo_ocorrencia, regularizacao_pendente,
                 observacoes, encontrado_em
               ) VALUES (
                 $1,$2,$3::public.rodada_contagem_inventario,$4,
                 $5,$6,$7,
                 'OK',$8::public.tipo_ocorrencia_inventario,$9,
                 $10,$11
               )
               ON CONFLICT (evento_inventario_id, bem_id, rodada)
               DO UPDATE SET
                 encontrado_por_perfil_id = EXCLUDED.encontrado_por_perfil_id,
                 unidade_encontrada_id = EXCLUDED.unidade_encontrada_id,
                 sala_encontrada = EXCLUDED.sala_encontrada,
                 local_encontrado_id = EXCLUDED.local_encontrado_id,
                 tipo_ocorrencia = EXCLUDED.tipo_ocorrencia,
                 regularizacao_pendente = EXCLUDED.regularizacao_pendente,
                 observacoes = EXCLUDED.observacoes,
                 encontrado_em = EXCLUDED.encontrado_em,
                 updated_at = NOW();`,
              [
                eventoInventarioId,
                bemId,
                rodada,
                encontradoPorPerfilId || perfilExec,
                unidadeEncontradaId,
                salaEncontrada,
                localEncontradoId,
                tipoOcorrencia,
                regularizacaoPendente,
                observacoes,
                encontradoEm.toISOString(),
              ],
            );
            const recon = await reconcileRodadas(bemId, { unidadeDonaId, localDonoId, localDonoNome });
            inserted = recon.inserted;
            divergenteFinal = recon.divergente;
            pendenteDesempate = recon.pendenteDesempate;
          }

          if (inserted) summary.inseridas += 1;
          else summary.atualizadas += 1;
          if (divergenteFinal) summary.divergentes += 1;
          if (pendenteDesempate) summary.pendentesDesempate += 1;

          if (caps.hasDataUltimaContagem && localEncontradoId) {
            await client.query(
              `UPDATE locais
               SET data_ultima_contagem = GREATEST(COALESCE(data_ultima_contagem, $2::timestamptz), $2::timestamptz)
               WHERE id = $1;`,
              [localEncontradoId, encontradoEm.toISOString()],
            );
          }
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
          summary.erros.push({ item: rowNo, tombamento: numeroTombamento, erro: dbError(error) });
        }
      }

      await client.query("COMMIT");
      res.json({ requestId: req.requestId, rodada, modoContagem, summary });
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
   * - acao: "TRANSFERIR_CARGA" | "MANTER_CARGA" | "ATUALIZAR_LOCAL"
   * - regularizadoPorPerfilId: UUID (obrigatorio)
   * - termoReferencia: string (obrigatorio quando acao=TRANSFERIR_CARGA)
   * - localDestinoId: UUID (opcional; usado quando acao=ATUALIZAR_LOCAL)
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
          : acaoRaw === "ATUALIZAR_LOCAL" || acaoRaw === "ATUALIZAR_LOCALIZACAO" || acaoRaw === "CORRIGIR_SALA"
            ? "ATUALIZAR_LOCAL"
          : null;
      if (!acao) {
        throw new HttpError(422, "ACAO_INVALIDA", "acao deve ser TRANSFERIR_CARGA, MANTER_CARGA ou ATUALIZAR_LOCAL.");
      }

      const termoReferenciaRaw = body.termoReferencia != null ? String(body.termoReferencia).trim() : "";
      const termoReferencia = termoReferenciaRaw ? termoReferenciaRaw.slice(0, 120) : "";
      if (acao === "TRANSFERIR_CARGA" && !termoReferencia) {
        throw new HttpError(422, "TERMO_OBRIGATORIO", "termoReferencia e obrigatorio para TRANSFERIR_CARGA.");
      }

      const obsRaw = body.observacoes != null ? String(body.observacoes).trim() : "";
      const observacoes = obsRaw ? obsRaw.slice(0, 2000) : null;
      const localDestinoIdRaw = body.localDestinoId != null ? String(body.localDestinoId).trim() : "";
      const localDestinoId = localDestinoIdRaw
        ? (UUID_RE.test(localDestinoIdRaw) ? localDestinoIdRaw : null)
        : null;
      if (localDestinoIdRaw && !localDestinoId) {
        throw new HttpError(422, "LOCAL_DESTINO_INVALIDO", "localDestinoId deve ser UUID quando informado.");
      }

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
           b.local_fisico,
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
      let local = null;

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
      } else if (acao === "ATUALIZAR_LOCAL") {
        const unidadeDonaId = Number(row.unidade_dona_id);
        const unidadeEncontradaId = Number(row.unidade_encontrada_id);
        if (unidadeDonaId !== unidadeEncontradaId) {
          throw new HttpError(
            409,
            "ATUALIZACAO_LOCAL_EXIGE_MESMA_UNIDADE",
            "Atualizacao de sala/local so e permitida quando unidade dona e unidade encontrada sao iguais. Use TRANSFERIR_CARGA quando houver unidade divergente.",
          );
        }

        const salaEncontrada = String(row.sala_encontrada || "").trim();
        if (!salaEncontrada) {
          throw new HttpError(422, "SALA_ENCONTRADA_INVALIDA", "salaEncontrada da contagem esta vazia.");
        }

        const normalizeRoomLabel = (raw) => String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
        const salaNorm = normalizeRoomLabel(salaEncontrada);
        const unidadeLocal = unidadeEncontradaId;
        let localDestino = null;

        if (localDestinoId) {
          const l = await client.query(
            `SELECT id, nome, unidade_id
             FROM locais
             WHERE id = $1
               AND ativo = TRUE
             LIMIT 1;`,
            [localDestinoId],
          );
          if (!l.rowCount) {
            throw new HttpError(404, "LOCAL_DESTINO_NAO_ENCONTRADO", "localDestinoId nao encontrado ou inativo.");
          }
          const rowLocal = l.rows[0];
          if (Number(rowLocal.unidade_id) !== unidadeLocal) {
            throw new HttpError(422, "LOCAL_DESTINO_UNIDADE_INVALIDA", "localDestinoId informado pertence a outra unidade.");
          }
          localDestino = rowLocal;
        } else {
          const l = await client.query(
            `SELECT id, nome, unidade_id
             FROM locais
             WHERE unidade_id = $1
               AND ativo = TRUE
               AND lower(regexp_replace(trim(nome), '\\s+', ' ', 'g')) = $2
             ORDER BY updated_at DESC, created_at DESC
             LIMIT 2;`,
            [unidadeLocal, salaNorm],
          );
          if (l.rowCount > 1) {
            throw new HttpError(
              409,
              "LOCAL_DESTINO_AMBIGUO",
              "Foi encontrado mais de um local ativo para a sala informada. Informe localDestinoId para concluir a regularizacao.",
            );
          }
          if (l.rowCount === 1) {
            localDestino = l.rows[0];
          }
        }

        const upBem = await client.query(
          `UPDATE bens
           SET local_id = $1,
               local_fisico = $2,
               status = 'OK',
               updated_at = NOW()
           WHERE id = $3
           RETURNING
             id,
             numero_tombamento AS "numeroTombamento",
             unidade_dona_id AS "unidadeDonaId",
             local_id AS "localId",
             local_fisico AS "localFisico",
             status::text AS status;`,
          [localDestino ? localDestino.id : null, salaEncontrada, row.bem_id],
        );
        bem = upBem.rows[0];
        local = localDestino
          ? {
              id: localDestino.id,
              nome: localDestino.nome,
              unidadeId: Number(localDestino.unidade_id),
              vinculado: true,
            }
          : {
              id: null,
              nome: salaEncontrada,
              unidadeId: unidadeLocal,
              vinculado: false,
            };

        const termoLocal = `REG_LOCAL_${String(row.codigo_evento || "INVENTARIO").slice(0, 60)}`;
        const justLocal = `Regularizacao pos-inventario (correcao de sala/local). Antes: ${String(row.local_fisico || "-")}. Depois: ${salaEncontrada}. Contagem=${contagemId}, evento=${row.codigo_evento}.`;
        const movLocal = await client.query(
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
            unidadeDonaId,
            unidadeDonaId,
            termoLocal,
            justLocal,
            regularizadoPorPerfilId,
            regularizadoPorPerfilId,
          ],
        );
        movimentacao = movLocal.rows[0];

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
      res.status(201).json({ requestId: req.requestId, contagemId, acao, movimentacao, bem, local });
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
    getDivergenciasInterunidades,
    getProgresso,
    getRelatorioEncerramento,
    exportRelatorioEncerramentoCsv,
    getSugestoesCiclo,
    getMinhaSessaoContagem,
    getMonitoramentoContagem,
    getIndicadoresAcuracidade,
    getMinhaSessaoContagem,
    getMonitoramentoContagem,
    getForasteiros,
    getBensTerceiros,
    postEvento,
    patchEventoStatus,
    patchEvento,
    deleteEvento,
    postSync,
    postBemTerceiro,
    postRegularizacao,
  };
}

module.exports = { createInventarioController };
