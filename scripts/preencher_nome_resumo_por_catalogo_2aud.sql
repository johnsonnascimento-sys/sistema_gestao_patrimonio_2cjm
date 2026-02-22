-- Modulo: scripts
-- Arquivo: scripts/preencher_nome_resumo_por_catalogo_2aud.sql
-- Funcao no sistema: preencher bens.nome_resumo faltantes com base na 2a Auditoria para o mesmo catalogo.
--
-- Regras operacionais:
-- - So atualiza bens com nome_resumo vazio (NULL ou string em branco).
-- - Nunca sobrescreve nome_resumo ja existente.
-- - Usa como fonte os bens da unidade_dona_id = 2 (2a Auditoria), escolhendo o registro mais recente por catalogo.
--
-- Execucao sugerida (VPS):
--   cd /opt/cjm-patrimonio/current
--   set -a; . ./.env; set +a
--   docker run --rm --network host -v "$PWD":/work -w /work postgres:16-alpine \
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/preencher_nome_resumo_por_catalogo_2aud.sql

BEGIN;

WITH fonte AS (
  SELECT DISTINCT ON (b.catalogo_bem_id)
    b.catalogo_bem_id,
    BTRIM(b.nome_resumo) AS nome_resumo
  FROM public.bens b
  WHERE b.unidade_dona_id = 2
    AND b.nome_resumo IS NOT NULL
    AND BTRIM(b.nome_resumo) <> ''
  ORDER BY b.catalogo_bem_id, b.updated_at DESC, b.id DESC
),
alvos AS (
  SELECT
    b.id,
    f.nome_resumo
  FROM public.bens b
  JOIN fonte f ON f.catalogo_bem_id = b.catalogo_bem_id
  WHERE b.nome_resumo IS NULL
     OR BTRIM(b.nome_resumo) = ''
),
upd AS (
  UPDATE public.bens b
  SET nome_resumo = a.nome_resumo
  FROM alvos a
  WHERE b.id = a.id
  RETURNING b.id
)
SELECT COUNT(*)::int AS bens_atualizados
FROM upd;

COMMIT;

-- Catalogos ainda sem fonte na 2a Auditoria (para tratamento manual posterior).
WITH fonte_catalogos AS (
  SELECT DISTINCT b.catalogo_bem_id
  FROM public.bens b
  WHERE b.unidade_dona_id = 2
    AND b.nome_resumo IS NOT NULL
    AND BTRIM(b.nome_resumo) <> ''
),
pendentes AS (
  SELECT
    b.catalogo_bem_id,
    COUNT(*)::int AS qtd_bens_sem_nome_resumo
  FROM public.bens b
  WHERE (b.nome_resumo IS NULL OR BTRIM(b.nome_resumo) = '')
    AND NOT EXISTS (
      SELECT 1
      FROM fonte_catalogos f
      WHERE f.catalogo_bem_id = b.catalogo_bem_id
    )
  GROUP BY b.catalogo_bem_id
)
SELECT
  cb.codigo_catalogo AS "codigoCatalogo",
  cb.descricao AS "catalogoDescricao",
  p.qtd_bens_sem_nome_resumo AS "qtdSemNomeResumo"
FROM pendentes p
JOIN public.catalogo_bens cb ON cb.id = p.catalogo_bem_id
ORDER BY p.qtd_bens_sem_nome_resumo DESC, cb.codigo_catalogo
LIMIT 50;
