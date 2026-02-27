-- Modulo: database
-- Arquivo: 016_geafin_import_sessions_v2.sql
-- Funcao no sistema: evoluir a importacao GEAFIN para sessao (previa/confirmacao/aplicacao)
--                    com decisoes por item, acao de ausentes no modo TOTAL e cancelamento seguro.
--
-- Regras operacionais:
-- - Sem delete fisico de bens/catalogos no pipeline de importacao.
-- - Backup automatico pre-aplicacao deve ser registrado em metadados da sessao.

BEGIN;

ALTER TABLE public.geafin_import_arquivos
  ADD COLUMN IF NOT EXISTS modo_importacao TEXT,
  ADD COLUMN IF NOT EXISTS escopo_tipo TEXT,
  ADD COLUMN IF NOT EXISTS unidade_escopo_id SMALLINT,
  ADD COLUMN IF NOT EXISTS etapa TEXT,
  ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS backup_status TEXT,
  ADD COLUMN IF NOT EXISTS backup_result_json JSONB,
  ADD COLUMN IF NOT EXISTS resumo_preview_json JSONB,
  ADD COLUMN IF NOT EXISTS resumo_aplicacao_json JSONB,
  ADD COLUMN IF NOT EXISTS acao_ausentes TEXT,
  ADD COLUMN IF NOT EXISTS aplicado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aplicado_por UUID;

UPDATE public.geafin_import_arquivos
SET
  modo_importacao = COALESCE(modo_importacao, 'INCREMENTAL'),
  escopo_tipo = COALESCE(escopo_tipo, 'GERAL'),
  etapa = COALESCE(etapa, 'LEGADO'),
  backup_status = COALESCE(backup_status, 'PENDENTE')
WHERE modo_importacao IS NULL
   OR escopo_tipo IS NULL
   OR etapa IS NULL
   OR backup_status IS NULL;

-- Remove constraint antiga de status (quando existir) para aceitar novos estados.
DO $$
DECLARE c_name TEXT;
BEGIN
  FOR c_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'geafin_import_arquivos'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.geafin_import_arquivos DROP CONSTRAINT %I', c_name);
  END LOOP;
END $$;

ALTER TABLE public.geafin_import_arquivos
  DROP CONSTRAINT IF EXISTS geafin_import_arquivos_modo_importacao_check,
  DROP CONSTRAINT IF EXISTS geafin_import_arquivos_escopo_tipo_check,
  DROP CONSTRAINT IF EXISTS geafin_import_arquivos_unidade_escopo_id_check,
  DROP CONSTRAINT IF EXISTS geafin_import_arquivos_backup_status_check,
  DROP CONSTRAINT IF EXISTS geafin_import_arquivos_acao_ausentes_check;

ALTER TABLE public.geafin_import_arquivos
  ADD CONSTRAINT geafin_import_arquivos_status_check
    CHECK (status IN ('EM_ANDAMENTO', 'AGUARDANDO_CONFIRMACAO', 'APLICANDO', 'CANCELADO', 'CONCLUIDO', 'ERRO')),
  ADD CONSTRAINT geafin_import_arquivos_modo_importacao_check
    CHECK (modo_importacao IN ('INCREMENTAL', 'TOTAL')),
  ADD CONSTRAINT geafin_import_arquivos_escopo_tipo_check
    CHECK (escopo_tipo IN ('GERAL', 'UNIDADE')),
  ADD CONSTRAINT geafin_import_arquivos_unidade_escopo_id_check
    CHECK (
      (escopo_tipo = 'GERAL' AND unidade_escopo_id IS NULL)
      OR
      (escopo_tipo = 'UNIDADE' AND unidade_escopo_id IN (1, 2, 3, 4))
    ),
  ADD CONSTRAINT geafin_import_arquivos_backup_status_check
    CHECK (backup_status IN ('PENDENTE', 'OK', 'ERRO')),
  ADD CONSTRAINT geafin_import_arquivos_acao_ausentes_check
    CHECK (acao_ausentes IS NULL OR acao_ausentes IN ('MANTER', 'BAIXAR'));

CREATE TABLE IF NOT EXISTS public.geafin_import_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id UUID NOT NULL REFERENCES public.geafin_import_arquivos(id) ON DELETE CASCADE,
  linha_id UUID REFERENCES public.geafin_import_linhas(id) ON DELETE SET NULL,
  ordem INTEGER NOT NULL CHECK (ordem >= 1),
  tipo_acao TEXT NOT NULL CHECK (tipo_acao IN ('CRIAR_BEM', 'ATUALIZAR_BEM', 'SEM_MUDANCA', 'ERRO_VALIDACAO')),
  requer_confirmacao BOOLEAN NOT NULL DEFAULT FALSE,
  decisao TEXT NOT NULL DEFAULT 'AUTO' CHECK (decisao IN ('PENDENTE', 'APROVADA', 'REJEITADA', 'AUTO')),
  decidido_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  decidido_em TIMESTAMPTZ,
  aplicada BOOLEAN NOT NULL DEFAULT FALSE,
  erro_aplicacao TEXT,
  numero_tombamento VARCHAR(80),
  codigo_catalogo VARCHAR(80),
  unidade_dona_id SMALLINT CHECK (unidade_dona_id IN (1, 2, 3, 4)),
  descricao_resumo TEXT,
  dados_antes_json JSONB,
  dados_depois_json JSONB,
  motivo TEXT,
  em_escopo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geafin_import_acoes_arquivo_ordem
  ON public.geafin_import_acoes (arquivo_id, ordem);

CREATE INDEX IF NOT EXISTS idx_geafin_import_acoes_arquivo_decisao
  ON public.geafin_import_acoes (arquivo_id, decisao);

CREATE INDEX IF NOT EXISTS idx_geafin_import_acoes_arquivo_tipo
  ON public.geafin_import_acoes (arquivo_id, tipo_acao);

CREATE INDEX IF NOT EXISTS idx_geafin_import_acoes_tombamento
  ON public.geafin_import_acoes (numero_tombamento);

COMMIT;
