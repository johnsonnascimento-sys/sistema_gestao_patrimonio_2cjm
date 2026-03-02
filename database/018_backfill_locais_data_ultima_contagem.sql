-- Modulo: database
-- Arquivo: database/018_backfill_locais_data_ultima_contagem.sql
-- Funcao no sistema: retropreencher locais.data_ultima_contagem com base no historico de contagens ja registradas.
--
-- Regra:
-- - Usa a maior data de contagem encontrada por local (MAX(c.encontrado_em)).
-- - Nao altera nada quando nao existe historico para o local.
-- - Mantem o maior valor entre o existente e o calculado, evitando regressao de data.

BEGIN;

WITH ultima_contagem_por_local AS (
  SELECT
    b.local_id,
    MAX(c.encontrado_em) AS ultima_contagem_em
  FROM public.contagens c
  JOIN public.bens b ON b.id = c.bem_id
  WHERE b.local_id IS NOT NULL
  GROUP BY b.local_id
)
UPDATE public.locais l
SET data_ultima_contagem = GREATEST(
  COALESCE(l.data_ultima_contagem, '-infinity'::timestamptz),
  u.ultima_contagem_em
)
FROM ultima_contagem_por_local u
WHERE u.local_id = l.id;

COMMIT;
