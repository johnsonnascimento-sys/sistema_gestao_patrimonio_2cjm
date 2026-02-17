-- Modulo: database
-- Arquivo: 009_ocorrencia_bem_terceiro.sql
-- Funcao no sistema: permitir registrar "bem de terceiro" em contagens de inventario sem tombamento GEAFIN.
--
-- Regra legal:
-- - Controle segregado de bens de terceiros.
--   Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX).
--
-- Regra operacional:
-- - Bens de terceiros sao cadastrados em `bens` com `eh_bem_terceiro=true` e `identificador_externo` (sem tombamento).
-- - A ocorrencia no inventario usa `contagens.tipo_ocorrencia='BEM_DE_TERCEIRO'` (nao entra na fila de regularizacao Art. 185).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'tipo_ocorrencia_inventario'
      AND e.enumlabel = 'BEM_DE_TERCEIRO'
  ) THEN
    ALTER TYPE public.tipo_ocorrencia_inventario ADD VALUE 'BEM_DE_TERCEIRO';
  END IF;
END $$;

COMMIT;

