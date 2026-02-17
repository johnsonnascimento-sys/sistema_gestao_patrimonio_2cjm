-- Modulo: database
-- Arquivo: 002_history_and_rules.sql
-- Funcao no sistema: adicionar rastreio fino de mudanca de carga (historico_transferencias),
--                    suportar itens novos do GEAFIN (AGUARDANDO_RECEBIMENTO) e preparar view de relatorio.
-- Observacao: esta migracao NAO apaga objetos existentes. Somente ADD/ALTER/CREATE.

BEGIN;

/*
 * 1) Novos itens GEAFIN
 * Regra operacional: itens importados que ainda nao existem no banco entram como AGUARDANDO_RECEBIMENTO
 * e sem local_fisico definido (local_fisico = NULL). Isso nao e uma regra legal; e um estado operacional.
 */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'status_bem'
      AND e.enumlabel = 'AGUARDANDO_RECEBIMENTO'
  ) THEN
    ALTER TYPE public.status_bem ADD VALUE 'AGUARDANDO_RECEBIMENTO';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bens'
      AND column_name = 'local_fisico'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.bens
      ALTER COLUMN local_fisico DROP NOT NULL;
  END IF;
END;
$$;

/*
 * 2) Origem da alteracao de carga (auditoria de processo)
 */
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'origem_alteracao_carga'
  ) THEN
    CREATE TYPE public.origem_alteracao_carga AS ENUM ('IMPORTACAO', 'APP', 'SISTEMA');
  END IF;
END;
$$;

/*
 * 3) Historico de transferencias (rastreio fino)
 * Regra legal: transferencia muda carga e deve ser auditavel.
 * Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
 */
CREATE TABLE IF NOT EXISTS public.historico_transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bem_id UUID NOT NULL REFERENCES public.bens(id) ON DELETE RESTRICT,
  bem_tombamento VARCHAR(80),
  unidade_antiga_id SMALLINT NOT NULL CHECK (unidade_antiga_id IN (1, 2, 3, 4)),
  unidade_nova_id SMALLINT NOT NULL CHECK (unidade_nova_id IN (1, 2, 3, 4)),
  usuario_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origem public.origem_alteracao_carga NOT NULL DEFAULT 'SISTEMA'
);

CREATE INDEX IF NOT EXISTS idx_historico_transferencias_bem_data
  ON public.historico_transferencias (bem_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_historico_transferencias_tombo_data
  ON public.historico_transferencias (bem_tombamento, data DESC);

/*
 * 4) Trigger de rastreio de mudanca de unidade_dona_id (carga)
 *
 * Como o backend e deterministico e sem "login" nesta fase, o ator/origem sao informados via set_config:
 * - app.current_user_id: UUID do perfil (ou vazio)
 * - app.change_origin: IMPORTACAO|APP|SISTEMA (ou vazio)
 *
 * Regra legal: Transferencia muda carga - Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
 */
CREATE OR REPLACE FUNCTION public.fn_track_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_raw TEXT;
  v_user_id UUID;
  v_origin_raw TEXT;
  v_origin public.origem_alteracao_carga;
BEGIN
  v_user_raw := NULLIF(current_setting('app.current_user_id', TRUE), '');
  v_origin_raw := upper(NULLIF(current_setting('app.change_origin', TRUE), ''));

  -- Parse defensivo: se nao for UUID valido, assume NULL.
  BEGIN
    v_user_id := NULL;
    IF v_user_raw IS NOT NULL THEN
      v_user_id := v_user_raw::uuid;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    v_user_id := NULL;
  END;

  v_origin := CASE v_origin_raw
    WHEN 'IMPORTACAO' THEN 'IMPORTACAO'::public.origem_alteracao_carga
    WHEN 'APP' THEN 'APP'::public.origem_alteracao_carga
    WHEN 'SISTEMA' THEN 'SISTEMA'::public.origem_alteracao_carga
    ELSE 'SISTEMA'::public.origem_alteracao_carga
  END;

  INSERT INTO public.historico_transferencias (
    bem_id,
    bem_tombamento,
    unidade_antiga_id,
    unidade_nova_id,
    usuario_id,
    origem
  ) VALUES (
    NEW.id,
    NEW.numero_tombamento,
    OLD.unidade_dona_id,
    NEW.unidade_dona_id,
    v_user_id,
    v_origin
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_owner_change ON public.bens;
CREATE TRIGGER trg_track_owner_change
AFTER UPDATE OF unidade_dona_id ON public.bens
FOR EACH ROW
WHEN (OLD.unidade_dona_id IS DISTINCT FROM NEW.unidade_dona_id)
EXECUTE FUNCTION public.fn_track_owner_change();

/*
 * 5) Auditoria total (reaproveita fn_log_auditoria do schema inicial)
 */
DROP TRIGGER IF EXISTS trg_log_auditoria ON public.historico_transferencias;
CREATE TRIGGER trg_log_auditoria
AFTER INSERT OR UPDATE OR DELETE ON public.historico_transferencias
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_auditoria();

/*
 * View utilitaria para relatorios e automacoes (n8n).
 * Regra legal: intrusos/divergencias nao mudam carga automaticamente.
 * Art. 185 (AN303_Art185).
 */
CREATE OR REPLACE VIEW public.vw_forasteiros AS
SELECT
  c.id AS contagem_id,
  c.evento_inventario_id,
  ei.codigo_evento,
  ei.status AS status_inventario,
  ei.unidade_inventariada_id,
  b.id AS bem_id,
  b.numero_tombamento,
  b.descricao_complementar AS descricao,
  b.unidade_dona_id,
  c.unidade_encontrada_id,
  c.sala_encontrada,
  c.encontrado_em,
  c.encontrado_por_perfil_id,
  c.observacoes
FROM public.contagens c
JOIN public.eventos_inventario ei ON ei.id = c.evento_inventario_id
JOIN public.bens b ON b.id = c.bem_id
WHERE c.tipo_ocorrencia = 'ENCONTRADO_EM_LOCAL_DIVERGENTE'
  AND c.regularizacao_pendente = TRUE;

COMMIT;

