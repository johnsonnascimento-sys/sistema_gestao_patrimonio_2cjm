-- Modulo: database
-- Arquivo: 014_locais_crud_soft_delete.sql
-- Funcao no sistema: adicionar "soft delete" (ativo) para CRUD de locais/salas sem perder rastreabilidade operacional.
--
-- Regra operacional:
-- - Locais sao cadastros operacionais usados no Inventario (selecionaveis).
-- - Exclusao definitiva pode causar perda de contexto; por isso usamos `ativo=false` (desativado).
-- - Esta migration e aditiva e nao apaga dados.

BEGIN;

ALTER TABLE public.locais
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_locais_unidade_ativo_nome
  ON public.locais (unidade_id, ativo, nome);

COMMIT;

