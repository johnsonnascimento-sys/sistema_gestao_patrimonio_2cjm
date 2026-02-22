-- Modulo: scripts
-- Arquivo: scripts/preencher_nome_resumo_fallback_catalogo.sql
-- Funcao no sistema: preencher bens.nome_resumo faltantes por heuristica deterministica da descricao do catalogo.
--
-- Regras operacionais:
-- - So atualiza bens com nome_resumo vazio (NULL ou branco).
-- - Nunca sobrescreve nome_resumo existente.
-- - Usa tokens operacionais da descricao (bloco inicial, processador, cor, marca, modelo).
-- - Mantem resultado em caixa alta e com tamanho maximo de 120 caracteres.
--
-- Execucao sugerida (VPS):
--   cd /opt/cjm-patrimonio/current
--   set -a; . ./.env; set +a
--   docker run --rm --network host -v "$PWD":/work -w /work postgres:16-alpine \
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/preencher_nome_resumo_fallback_catalogo.sql

BEGIN;

WITH catalogo_base AS (
  SELECT
    cb.id AS catalogo_bem_id,
    BTRIM(REGEXP_REPLACE(cb.descricao, '\s+', ' ', 'g')) AS descricao
  FROM public.catalogo_bens cb
),
tokens AS (
  SELECT
    c.catalogo_bem_id,
    c.descricao,
    NULLIF(BTRIM(SPLIT_PART(c.descricao, ',', 1)), '') AS primeiro_bloco,
    NULLIF(BTRIM((REGEXP_MATCH(c.descricao, '(?i)PROCESSADOR\s*:?\s*([A-Z0-9 ./\-]{3,80})'))[1]), '') AS processador_raw,
    NULLIF(BTRIM((REGEXP_MATCH(c.descricao, '(?i)MODELO\s*:?\s*"?([A-Z0-9 ./\-]{2,80})"?'))[1]), '') AS modelo_raw,
    NULLIF(BTRIM((REGEXP_MATCH(c.descricao, '(?i)MARCA\s*:?\s*"?([A-Z0-9 ./\-]{2,80})"?'))[1]), '') AS marca_raw,
    NULLIF(BTRIM((REGEXP_MATCH(c.descricao, '(?i)COR\s*:?\s*([A-ZÀ-Ú0-9\-]{3,30})'))[1]), '') AS cor_raw
  FROM catalogo_base c
),
normalizado AS (
  SELECT
    t.catalogo_bem_id,
    REGEXP_REPLACE(UPPER(COALESCE(t.primeiro_bloco, '')), '\s+', ' ', 'g') AS head,
    REGEXP_REPLACE(UPPER(COALESCE(t.processador_raw, '')), '\s+', ' ', 'g') AS processador,
    REGEXP_REPLACE(UPPER(COALESCE(t.modelo_raw, '')), '\s+', ' ', 'g') AS modelo,
    REGEXP_REPLACE(UPPER(COALESCE(t.marca_raw, '')), '\s+', ' ', 'g') AS marca,
    REGEXP_REPLACE(UPPER(COALESCE(t.cor_raw, '')), '\s+', ' ', 'g') AS cor
  FROM tokens t
),
sugestao_catalogo AS (
  SELECT
    n.catalogo_bem_id,
    NULLIF(
      BTRIM(
        REGEXP_REPLACE(
          CONCAT_WS(
            ' ',
            CASE
              WHEN n.head LIKE 'MICROCOMPUTADOR%' THEN 'MICROCOMPUTADOR'
              WHEN n.head LIKE 'NOTEBOOK%' THEN 'NOTEBOOK'
              WHEN n.head LIKE 'SCANNER%' THEN 'SCANNER DE MESA'
              ELSE NULLIF(n.head, '')
            END,
            CASE
              WHEN n.head LIKE 'MICROCOMPUTADOR%' AND n.processador <> '' THEN
                REGEXP_REPLACE(
                  REGEXP_REPLACE(n.processador, '^INTEL\s+', '', 'i'),
                  '^((?:[A-Z0-9\-]+\s*){1,4}).*$',
                  '\1'
                )
              ELSE NULL
            END,
            CASE
              WHEN n.cor IN ('PRETA', 'PRETO', 'AZUL', 'VERMELHA', 'VERMELHO', 'CINZA', 'BRANCA', 'BRANCO')
                   AND (n.head LIKE 'BASTAO%' OR n.head LIKE 'CADEIRA%')
              THEN n.cor
              ELSE NULL
            END,
            NULLIF(n.marca, ''),
            NULLIF(n.modelo, '')
          ),
          '\s+',
          ' ',
          'g'
        )
      ),
      ''
    ) AS nome_resumo_sugerido
  FROM normalizado n
),
validada AS (
  SELECT
    sc.catalogo_bem_id,
    CASE
      WHEN sc.nome_resumo_sugerido IS NULL THEN NULL
      WHEN LENGTH(sc.nome_resumo_sugerido) < 8 THEN NULL
      ELSE LEFT(sc.nome_resumo_sugerido, 120)
    END AS nome_resumo_sugerido
  FROM sugestao_catalogo sc
),
alvos AS (
  SELECT
    b.id,
    v.nome_resumo_sugerido
  FROM public.bens b
  JOIN validada v ON v.catalogo_bem_id = b.catalogo_bem_id
  WHERE (b.nome_resumo IS NULL OR BTRIM(b.nome_resumo) = '')
    AND v.nome_resumo_sugerido IS NOT NULL
),
upd AS (
  UPDATE public.bens b
  SET nome_resumo = a.nome_resumo_sugerido
  FROM alvos a
  WHERE b.id = a.id
  RETURNING b.id
)
SELECT COUNT(*)::int AS bens_atualizados_fallback
FROM upd;

COMMIT;

-- Pendencias restantes para tratamento manual.
WITH pendentes AS (
  SELECT
    b.catalogo_bem_id,
    COUNT(*)::int AS qtd_bens_sem_nome_resumo
  FROM public.bens b
  WHERE b.nome_resumo IS NULL OR BTRIM(b.nome_resumo) = ''
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
