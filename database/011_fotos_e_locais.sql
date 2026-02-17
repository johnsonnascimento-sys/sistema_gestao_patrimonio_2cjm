-- Modulo: database
-- Arquivo: 011_fotos_e_locais.sql
-- Funcao no sistema: adicionar suporte a fotos (SKU e item) e localizacao por sala (estrutura opcional) para camada operacional melhorada.
--
-- Regra operacional:
-- - Mantemos `bens.local_fisico` (texto) por compatibilidade e rapidez operacional.
-- - Adicionamos `locais` + `bens.local_id` para padronizar quando fizer sentido.
-- - Fotos: armazenamos apenas URLs/IDs (o binario fica em storage externo).

BEGIN;

-- Fotos (URLs)
ALTER TABLE public.catalogo_bens
  ADD COLUMN IF NOT EXISTS foto_referencia_url TEXT;

ALTER TABLE public.bens
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Locais (estrutura opcional)
CREATE TABLE IF NOT EXISTS public.locais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(180) NOT NULL UNIQUE,
  unidade_id SMALLINT CHECK (unidade_id IN (1, 2, 3, 4)),
  tipo VARCHAR(40),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bens
  ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES public.locais(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bens_local_id
  ON public.bens (local_id);

-- updated_at triggers (fn_set_updated_at em 001_initial_schema.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_set_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_locais_updated_at ON public.locais;
    CREATE TRIGGER trg_locais_updated_at
    BEFORE UPDATE ON public.locais
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  END IF;
END $$;

COMMIT;

