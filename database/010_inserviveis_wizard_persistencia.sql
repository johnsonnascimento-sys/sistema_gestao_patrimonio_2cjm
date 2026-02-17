-- Modulo: database
-- Arquivo: 010_inserviveis_wizard_persistencia.sql
-- Funcao no sistema: persistir resultado do Wizard do Art. 141 (classificacao de inserviveis) com trilha auditavel.
--
-- Regra legal:
-- - Classificacao obrigatoria de inserviveis via fluxo guiado.
--   Art. 141 (AN303_Art141_Cap / AN303_Art141_I / AN303_Art141_II / AN303_Art141_III / AN303_Art141_IV).
--
-- Regra operacional:
-- - Mantemos historico de avaliacoes (nao sobrescreve).
-- - Atualizamos `bens.tipo_inservivel` como "estado atual" (sem efetivar baixa automaticamente).

BEGIN;

CREATE TABLE IF NOT EXISTS public.avaliacoes_inserviveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bem_id UUID NOT NULL REFERENCES public.bens(id) ON DELETE RESTRICT,
  tipo_inservivel public.tipo_inservivel NOT NULL,
  descricao_informada TEXT,
  justificativa TEXT,
  criterios JSONB,
  avaliado_por_perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  avaliado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_inserviveis_bem_data
  ON public.avaliacoes_inserviveis (bem_id, avaliado_em DESC);

-- Mantem updated_at padronizado (funcao criada em 001_initial_schema.sql).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_avaliacoes_inserviveis_updated_at ON public.avaliacoes_inserviveis;
    CREATE TRIGGER trg_avaliacoes_inserviveis_updated_at
    BEFORE UPDATE ON public.avaliacoes_inserviveis
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;

COMMIT;

