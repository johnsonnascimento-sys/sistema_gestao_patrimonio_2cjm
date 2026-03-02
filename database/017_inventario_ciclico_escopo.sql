-- Modulo: database
-- Arquivo: 017_inventario_ciclico_escopo.sql
-- Funcao no sistema: habilitar inventario ciclico com escopo granular (geral/unidade/locais)
-- e atualizar bloqueio Art. 183 para respeitar escopo ativo.

BEGIN;

ALTER TABLE public.eventos_inventario
  ADD COLUMN IF NOT EXISTS tipo_ciclo VARCHAR(20) NOT NULL DEFAULT 'ADHOC',
  ADD COLUMN IF NOT EXISTS escopo_tipo VARCHAR(20) NOT NULL DEFAULT 'GERAL';

UPDATE public.eventos_inventario
SET escopo_tipo = CASE
  WHEN unidade_inventariada_id IS NULL THEN 'GERAL'
  ELSE 'UNIDADE'
END
WHERE escopo_tipo IS NULL
   OR escopo_tipo NOT IN ('GERAL', 'UNIDADE', 'LOCAIS');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_eventos_inventario_tipo_ciclo'
      AND conrelid = 'public.eventos_inventario'::regclass
  ) THEN
    ALTER TABLE public.eventos_inventario
      ADD CONSTRAINT ck_eventos_inventario_tipo_ciclo
      CHECK (tipo_ciclo IN ('SEMANAL', 'MENSAL', 'ANUAL', 'ADHOC'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_eventos_inventario_escopo_tipo'
      AND conrelid = 'public.eventos_inventario'::regclass
  ) THEN
    ALTER TABLE public.eventos_inventario
      ADD CONSTRAINT ck_eventos_inventario_escopo_tipo
      CHECK (escopo_tipo IN ('GERAL', 'UNIDADE', 'LOCAIS'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.eventos_inventario_locais (
  evento_inventario_id UUID NOT NULL REFERENCES public.eventos_inventario(id) ON DELETE CASCADE,
  local_id UUID NOT NULL REFERENCES public.locais(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (evento_inventario_id, local_id)
);

CREATE INDEX IF NOT EXISTS idx_eventos_inventario_locais_evento
  ON public.eventos_inventario_locais (evento_inventario_id);

CREATE INDEX IF NOT EXISTS idx_eventos_inventario_locais_local
  ON public.eventos_inventario_locais (local_id);

ALTER TABLE public.locais
  ADD COLUMN IF NOT EXISTS data_ultima_contagem TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_locais_data_ultima_contagem
  ON public.locais (data_ultima_contagem NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_locais_unidade_data_ultima_contagem
  ON public.locais (unidade_id, data_ultima_contagem NULLS FIRST);

/*
 * Funcao: fn_bloqueio_movimentacao_art183
 * Objetivo: impedir mudanca de carga somente quando o bem estiver no escopo de inventario ativo.
 * Escopos:
 * - GERAL: bloqueio global
 * - UNIDADE: bloqueio por unidade inventariada
 * - LOCAIS: bloqueio por conjunto de locais do evento
 */
CREATE OR REPLACE FUNCTION public.fn_bloqueio_movimentacao_art183()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_evento_ativo UUID;
BEGIN
  IF NEW.unidade_dona_id IS DISTINCT FROM OLD.unidade_dona_id THEN
    SELECT ei.id
    INTO v_evento_ativo
    FROM public.eventos_inventario ei
    WHERE ei.status = 'EM_ANDAMENTO'
      AND (
        ei.escopo_tipo = 'GERAL'
        OR (
          ei.escopo_tipo = 'UNIDADE'
          AND (
            ei.unidade_inventariada_id = OLD.unidade_dona_id
            OR ei.unidade_inventariada_id = NEW.unidade_dona_id
          )
        )
        OR (
          ei.escopo_tipo = 'LOCAIS'
          AND EXISTS (
            SELECT 1
            FROM public.eventos_inventario_locais eil
            WHERE eil.evento_inventario_id = ei.id
              AND (
                (OLD.local_id IS NOT NULL AND eil.local_id = OLD.local_id)
                OR (NEW.local_id IS NOT NULL AND eil.local_id = NEW.local_id)
              )
          )
        )
      )
    LIMIT 1;

    IF v_evento_ativo IS NOT NULL THEN
      RAISE EXCEPTION
        USING
          ERRCODE = 'P0001',
          MESSAGE = 'Movimentacao bloqueada por inventario em andamento no escopo ativo.',
          DETAIL = 'Regra legal: Art. 183 (AN303_Art183).',
          HINT = 'Encerrar o inventario do escopo antes de alterar unidade_dona_id do bem.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
