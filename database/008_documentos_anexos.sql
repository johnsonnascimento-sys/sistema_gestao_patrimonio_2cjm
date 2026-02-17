-- Modulo: database
-- Arquivo: 008_documentos_anexos.sql
-- Funcao no sistema: registrar evidencias (PDF/Drive) associadas a movimentacoes e regularizacoes, sem armazenar binario.
--
-- Regras legais:
-- - Transferencia/cautela exigem formalizacao e rastreabilidade (Arts. 124 e 127 - AN303_Art124 / AN303_Art127).
-- - Regularizacao de divergencias deve ocorrer apos inventario, com trilha auditavel (Art. 185 - AN303_Art185).
--
-- Regra operacional:
-- - O PDF e gerado fora do banco (n8n) e salvo no Drive.
-- - O sistema armazena apenas metadados (URL/ID/hash), para auditoria.
-- - Nao apaga objetos existentes; apenas CREATE.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento') THEN
    CREATE TYPE public.tipo_documento AS ENUM (
      'TERMO_TRANSFERENCIA',
      'TERMO_CAUTELA',
      'TERMO_REGULARIZACAO',
      'RELATORIO_FORASTEIROS',
      'OUTRO'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_documento NOT NULL,
  titulo VARCHAR(180),
  -- Vinculos (opcionais): um documento pode ser evidÃªncia de uma movimentacao e/ou regularizacao.
  movimentacao_id UUID REFERENCES public.movimentacoes(id) ON DELETE SET NULL,
  contagem_id UUID REFERENCES public.contagens(id) ON DELETE SET NULL,
  termo_referencia VARCHAR(120),
  arquivo_nome VARCHAR(200),
  mime VARCHAR(120),
  bytes INTEGER CHECK (bytes IS NULL OR bytes >= 0),
  sha256 CHAR(64),
  drive_file_id VARCHAR(200),
  drive_url TEXT,
  gerado_por_perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_documentos_vinculo CHECK (
    movimentacao_id IS NOT NULL
    OR contagem_id IS NOT NULL
    OR drive_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_documentos_movimentacao
  ON public.documentos (movimentacao_id, gerado_em DESC);

CREATE INDEX IF NOT EXISTS idx_documentos_contagem
  ON public.documentos (contagem_id, gerado_em DESC);

CREATE INDEX IF NOT EXISTS idx_documentos_tipo_data
  ON public.documentos (tipo, gerado_em DESC);

-- Mantem updated_at padronizado (funcao criada em 001_initial_schema.sql).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_documentos_updated_at ON public.documentos;
    CREATE TRIGGER trg_documentos_updated_at
    BEFORE UPDATE ON public.documentos
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;

COMMIT;

