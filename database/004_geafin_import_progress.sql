-- Modulo: database
-- Arquivo: 004_geafin_import_progress.sql
-- Funcao no sistema: adicionar metadados minimos para acompanhar progresso de importacao GEAFIN (UI/observabilidade).
--
-- Regra operacional:
-- - Nao altera o modelo operacional (catalogo_bens/bens). Apenas melhora rastreabilidade do processo de importacao.
-- - Nao apaga objetos existentes. Somente ALTER.

BEGIN;

ALTER TABLE public.geafin_import_arquivos
  ADD COLUMN IF NOT EXISTS total_linhas INTEGER CHECK (total_linhas IS NULL OR total_linhas >= 0);

ALTER TABLE public.geafin_import_arquivos
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO'
    CHECK (status IN ('EM_ANDAMENTO', 'CONCLUIDO', 'ERRO'));

ALTER TABLE public.geafin_import_arquivos
  ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ;

ALTER TABLE public.geafin_import_arquivos
  ADD COLUMN IF NOT EXISTS erro_resumo TEXT;

CREATE INDEX IF NOT EXISTS idx_geafin_import_arquivos_status_imported_em
  ON public.geafin_import_arquivos (status, imported_em DESC);

COMMIT;

