-- Modulo: database
-- Arquivo: 023_material_inservivel_baixa.sql
-- Funcao no sistema: formalizar marcacao de inserviveis, processos de baixa patrimonial e vinculos documentais.
--
-- Regras legais:
-- - Material inservivel e destinacao: Arts. 141 a 152 (AN303_Art141_* a AN303_Art152).
-- - Baixa patrimonial: Arts. 153 a 157 (AN303_Art153 a AN303_Art157).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_fluxo_inservivel') THEN
    CREATE TYPE public.status_fluxo_inservivel AS ENUM (
      'MARCADO_TRIAGEM',
      'AGUARDANDO_DESTINACAO',
      'EM_PROCESSO_BAIXA',
      'RETIRADO_FILA',
      'BAIXADO'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'destinacao_inservivel') THEN
    CREATE TYPE public.destinacao_inservivel AS ENUM (
      'VENDA',
      'CESSAO',
      'DOACAO',
      'PERMUTA',
      'INUTILIZACAO',
      'ABANDONO'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modalidade_baixa_patrimonial') THEN
    CREATE TYPE public.modalidade_baixa_patrimonial AS ENUM (
      'VENDA',
      'CESSAO',
      'DOACAO',
      'PERMUTA',
      'INUTILIZACAO',
      'ABANDONO',
      'DESAPARECIMENTO'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_baixa_patrimonial') THEN
    CREATE TYPE public.status_baixa_patrimonial AS ENUM (
      'RASCUNHO',
      'CONCLUIDO',
      'CANCELADO'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.marcacoes_inserviveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bem_id UUID NOT NULL UNIQUE REFERENCES public.bens(id) ON DELETE RESTRICT,
  avaliacao_inservivel_id UUID REFERENCES public.avaliacoes_inserviveis(id) ON DELETE SET NULL,
  tipo_inservivel public.tipo_inservivel NOT NULL,
  destinacao_sugerida public.destinacao_inservivel,
  status_fluxo public.status_fluxo_inservivel NOT NULL DEFAULT 'MARCADO_TRIAGEM',
  observacoes TEXT,
  marcado_por_perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  marcado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marcacoes_inserviveis_fluxo
  ON public.marcacoes_inserviveis (status_fluxo, tipo_inservivel, marcado_em DESC);

CREATE TABLE IF NOT EXISTS public.baixas_patrimoniais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_referencia VARCHAR(120) NOT NULL,
  modalidade_baixa public.modalidade_baixa_patrimonial NOT NULL,
  status_processo public.status_baixa_patrimonial NOT NULL DEFAULT 'RASCUNHO',
  manifestacao_sci_referencia VARCHAR(120),
  manifestacao_sci_em TIMESTAMPTZ,
  ato_diretor_geral_referencia VARCHAR(120),
  ato_diretor_geral_em TIMESTAMPTZ,
  presidencia_ciente_em TIMESTAMPTZ,
  encaminhado_financas_em TIMESTAMPTZ,
  nota_lancamento_referencia VARCHAR(120),
  dados_modalidade JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT,
  executado_por_perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  executado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baixas_patrimoniais_status
  ON public.baixas_patrimoniais (status_processo, modalidade_baixa, created_at DESC);

CREATE TABLE IF NOT EXISTS public.baixas_patrimoniais_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baixa_patrimonial_id UUID NOT NULL REFERENCES public.baixas_patrimoniais(id) ON DELETE CASCADE,
  bem_id UUID NOT NULL REFERENCES public.bens(id) ON DELETE RESTRICT,
  marcacao_inservivel_id UUID REFERENCES public.marcacoes_inserviveis(id) ON DELETE SET NULL,
  avaliacao_inservivel_id UUID REFERENCES public.avaliacoes_inserviveis(id) ON DELETE SET NULL,
  tipo_inservivel public.tipo_inservivel,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_baixa_patrimonial_item UNIQUE (baixa_patrimonial_id, bem_id)
);

CREATE INDEX IF NOT EXISTS idx_baixas_patrimoniais_itens_bem
  ON public.baixas_patrimoniais_itens (bem_id, created_at DESC);

ALTER TABLE public.bens
  ADD COLUMN IF NOT EXISTS motivo_baixa_patrimonial public.modalidade_baixa_patrimonial,
  ADD COLUMN IF NOT EXISTS baixado_em TIMESTAMPTZ;

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS baixa_patrimonial_id UUID
  REFERENCES public.baixas_patrimoniais(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_baixa_patrimonial_id
  ON public.documentos (baixa_patrimonial_id, gerado_em DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.tipo_documento'::regtype AND enumlabel = 'PARECER_SCI'
    ) THEN
      ALTER TYPE public.tipo_documento ADD VALUE 'PARECER_SCI';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.tipo_documento'::regtype AND enumlabel = 'ATO_DIRETOR_GERAL'
    ) THEN
      ALTER TYPE public.tipo_documento ADD VALUE 'ATO_DIRETOR_GERAL';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.tipo_documento'::regtype AND enumlabel = 'TERMO_ALIENACAO'
    ) THEN
      ALTER TYPE public.tipo_documento ADD VALUE 'TERMO_ALIENACAO';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.tipo_documento'::regtype AND enumlabel = 'TERMO_CESSAO'
    ) THEN
      ALTER TYPE public.tipo_documento ADD VALUE 'TERMO_CESSAO';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.tipo_documento'::regtype AND enumlabel = 'TERMO_DOACAO'
    ) THEN
      ALTER TYPE public.tipo_documento ADD VALUE 'TERMO_DOACAO';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.tipo_documento'::regtype AND enumlabel = 'TERMO_PERMUTA'
    ) THEN
      ALTER TYPE public.tipo_documento ADD VALUE 'TERMO_PERMUTA';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.tipo_documento'::regtype AND enumlabel = 'TERMO_INUTILIZACAO'
    ) THEN
      ALTER TYPE public.tipo_documento ADD VALUE 'TERMO_INUTILIZACAO';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.tipo_documento'::regtype AND enumlabel = 'JUSTIFICATIVA_ABANDONO'
    ) THEN
      ALTER TYPE public.tipo_documento ADD VALUE 'JUSTIFICATIVA_ABANDONO';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'public.tipo_documento'::regtype AND enumlabel = 'NOTA_LANCAMENTO_SIAFI'
    ) THEN
      ALTER TYPE public.tipo_documento ADD VALUE 'NOTA_LANCAMENTO_SIAFI';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_marcacoes_inserviveis_updated_at ON public.marcacoes_inserviveis;
    CREATE TRIGGER trg_marcacoes_inserviveis_updated_at
    BEFORE UPDATE ON public.marcacoes_inserviveis
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

    DROP TRIGGER IF EXISTS trg_baixas_patrimoniais_updated_at ON public.baixas_patrimoniais;
    CREATE TRIGGER trg_baixas_patrimoniais_updated_at
    BEFORE UPDATE ON public.baixas_patrimoniais
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;

COMMIT;
