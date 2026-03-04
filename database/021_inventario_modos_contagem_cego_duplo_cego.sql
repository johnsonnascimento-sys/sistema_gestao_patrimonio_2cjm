-- Modulo: database
-- Arquivo: 021_inventario_modos_contagem_cego_duplo_cego.sql
-- Funcao no sistema: habilitar modos de contagem CEGO/DUPLO_CEGO com operadores designados
-- e trilha por rodadas para reconsolidacao deterministica.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'modo_contagem_inventario'
  ) THEN
    CREATE TYPE public.modo_contagem_inventario AS ENUM ('PADRAO', 'CEGO', 'DUPLO_CEGO');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'papel_contagem_inventario'
  ) THEN
    CREATE TYPE public.papel_contagem_inventario AS ENUM ('OPERADOR_UNICO', 'OPERADOR_A', 'OPERADOR_B');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'rodada_contagem_inventario'
  ) THEN
    CREATE TYPE public.rodada_contagem_inventario AS ENUM ('A', 'B', 'DESEMPATE');
  END IF;
END $$;

ALTER TABLE public.eventos_inventario
  ADD COLUMN IF NOT EXISTS modo_contagem public.modo_contagem_inventario NOT NULL DEFAULT 'PADRAO';

CREATE TABLE IF NOT EXISTS public.eventos_inventario_operadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_inventario_id UUID NOT NULL REFERENCES public.eventos_inventario(id) ON DELETE CASCADE,
  perfil_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  papel_contagem public.papel_contagem_inventario NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  permite_desempate BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_evento_operador_papel UNIQUE (evento_inventario_id, papel_contagem),
  CONSTRAINT uk_evento_operador_perfil UNIQUE (evento_inventario_id, perfil_id)
);

CREATE INDEX IF NOT EXISTS idx_eventos_inventario_operadores_evento
  ON public.eventos_inventario_operadores (evento_inventario_id, ativo);

CREATE TABLE IF NOT EXISTS public.contagens_rodadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_inventario_id UUID NOT NULL REFERENCES public.eventos_inventario(id) ON DELETE CASCADE,
  bem_id UUID NOT NULL REFERENCES public.bens(id) ON DELETE RESTRICT,
  rodada public.rodada_contagem_inventario NOT NULL,
  encontrado_por_perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  unidade_encontrada_id SMALLINT NOT NULL CHECK (unidade_encontrada_id IN (1,2,3,4)),
  sala_encontrada VARCHAR(180) NOT NULL,
  local_encontrado_id UUID REFERENCES public.locais(id) ON DELETE SET NULL,
  status_apurado public.status_apurado NOT NULL DEFAULT 'OK',
  tipo_ocorrencia public.tipo_ocorrencia_inventario NOT NULL DEFAULT 'CONFORME',
  regularizacao_pendente BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes TEXT,
  foto_url TEXT,
  encontrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_contagens_rodadas_evento_bem_rodada UNIQUE (evento_inventario_id, bem_id, rodada)
);

CREATE INDEX IF NOT EXISTS idx_contagens_rodadas_evento_bem
  ON public.contagens_rodadas (evento_inventario_id, bem_id);

CREATE INDEX IF NOT EXISTS idx_contagens_rodadas_evento_rodada
  ON public.contagens_rodadas (evento_inventario_id, rodada);

CREATE OR REPLACE FUNCTION public.fn_set_updated_at_contagens_rodadas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_contagens_rodadas ON public.contagens_rodadas;
CREATE TRIGGER trg_set_updated_at_contagens_rodadas
BEFORE UPDATE ON public.contagens_rodadas
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_updated_at_contagens_rodadas();

CREATE OR REPLACE FUNCTION public.fn_validar_operadores_evento_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_evento_id UUID;
  v_modo public.modo_contagem_inventario;
  v_qtd_ativos INTEGER;
  v_qtd_unico INTEGER;
  v_qtd_a INTEGER;
  v_qtd_b INTEGER;
BEGIN
  v_evento_id := COALESCE(NEW.evento_inventario_id, OLD.evento_inventario_id);
  IF v_evento_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT modo_contagem INTO v_modo
  FROM public.eventos_inventario
  WHERE id = v_evento_id
  LIMIT 1;

  IF v_modo IS NULL OR v_modo = 'PADRAO' THEN
    RETURN NULL;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE ativo = TRUE),
    COUNT(*) FILTER (WHERE ativo = TRUE AND papel_contagem = 'OPERADOR_UNICO'),
    COUNT(*) FILTER (WHERE ativo = TRUE AND papel_contagem = 'OPERADOR_A'),
    COUNT(*) FILTER (WHERE ativo = TRUE AND papel_contagem = 'OPERADOR_B')
  INTO v_qtd_ativos, v_qtd_unico, v_qtd_a, v_qtd_b
  FROM public.eventos_inventario_operadores
  WHERE evento_inventario_id = v_evento_id;

  IF v_modo = 'CEGO' THEN
    IF v_qtd_ativos <> 1 OR v_qtd_unico <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Modo CEGO exige exatamente 1 operador ativo com papel OPERADOR_UNICO.';
    END IF;
  ELSIF v_modo = 'DUPLO_CEGO' THEN
    IF v_qtd_ativos <> 2 OR v_qtd_a <> 1 OR v_qtd_b <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Modo DUPLO_CEGO exige 2 operadores ativos: OPERADOR_A e OPERADOR_B.';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_operadores_evento_on_operadores ON public.eventos_inventario_operadores;
CREATE CONSTRAINT TRIGGER trg_validar_operadores_evento_on_operadores
AFTER INSERT OR UPDATE OR DELETE ON public.eventos_inventario_operadores
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_operadores_evento_inventario();

DROP TRIGGER IF EXISTS trg_validar_operadores_evento_on_evento ON public.eventos_inventario;
CREATE CONSTRAINT TRIGGER trg_validar_operadores_evento_on_evento
AFTER INSERT OR UPDATE OF modo_contagem ON public.eventos_inventario
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.fn_validar_operadores_evento_inventario();

COMMIT;

