/**
 * Modulo: backend/src/services
 * Arquivo: dbContext.js
 * Funcao no sistema: propagar contexto (origem e usuario) para triggers de rastreio/auditoria no Postgres.
 *
 * Observacao:
 * - Este projeto e deterministico e nao usa IA em runtime.
 * - O backend informa o contexto para o banco via set_config, para que triggers registrem origem/usuario.
 */
"use strict";

/**
 * Define variaveis de contexto para a sessao/transacao do Postgres.
 * @param {import("pg").PoolClient} client Cliente transacional.
 * @param {{changeOrigin?: string|null, currentUserId?: string|null}} ctx Contexto da mudanca.
 * @returns {Promise<void>} Sem retorno.
 */
async function setDbContext(client, ctx) {
  const origin = ctx?.changeOrigin ? String(ctx.changeOrigin).trim().toUpperCase() : "";
  const userId = ctx?.currentUserId ? String(ctx.currentUserId).trim() : "";

  // Essas chaves sao lidas em triggers (ex.: fn_track_owner_change).
  await client.query("SELECT set_config('app.change_origin', $1, TRUE)", [origin]);
  await client.query("SELECT set_config('app.current_user_id', $1, TRUE)", [userId]);
}

module.exports = { setDbContext };

