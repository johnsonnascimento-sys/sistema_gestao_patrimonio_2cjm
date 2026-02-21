-- Modulo: database
-- Arquivo: 015_bens_cod2aud_nome_resumo.sql
-- Funcao no sistema: adicionar suporte a etiqueta azul (Cod2Aud) e nome resumo importado do Smart Inventory.
--
-- Regra operacional:
-- - numero_tombamento GEAFIN continua como chave de identificacao principal (10 digitos).
-- - cod_2_aud armazena a etiqueta azul legada (4 digitos) para consulta e contagem assistida.

BEGIN;

ALTER TABLE public.bens
  ADD COLUMN IF NOT EXISTS cod_2_aud VARCHAR(4);

ALTER TABLE public.bens
  ADD COLUMN IF NOT EXISTS nome_resumo VARCHAR(240);

-- Higienizacao defensiva para dados preexistentes.
UPDATE public.bens
SET cod_2_aud = NULL
WHERE cod_2_aud IS NOT NULL
  AND (cod_2_aud !~ '^[0-9]{4}$' OR cod_2_aud = '0000');

UPDATE public.bens
SET nome_resumo = NULLIF(BTRIM(nome_resumo), '')
WHERE nome_resumo IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.bens'::regclass
      AND conname = 'ck_bens_cod_2_aud_format'
  ) THEN
    ALTER TABLE public.bens
      ADD CONSTRAINT ck_bens_cod_2_aud_format
      CHECK (cod_2_aud IS NULL OR cod_2_aud ~ '^[0-9]{4}$');
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_bens_cod_2_aud
  ON public.bens (cod_2_aud)
  WHERE cod_2_aud IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bens_tombo_sufixo_4
  ON public.bens ((RIGHT(numero_tombamento, 4)))
  WHERE numero_tombamento IS NOT NULL;

COMMIT;
