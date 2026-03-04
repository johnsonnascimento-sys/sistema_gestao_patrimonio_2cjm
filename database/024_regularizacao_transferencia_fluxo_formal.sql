-- Modulo: database
-- Arquivo: 024_regularizacao_transferencia_fluxo_formal.sql
-- Funcao no sistema: persistir fluxo formal de transferencia da regularizacao pos-inventario.
--
-- Regras legais:
-- - Divergencias devem ser regularizadas em fluxo proprio, sem troca automatica no inventario.
--   Art. 185 (AN303_Art185).
-- - Transferencia de carga exige formalizacao e rastreabilidade.
--   Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).

BEGIN;

CREATE TABLE IF NOT EXISTS public.inventario_regularizacao_transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contagem_id UUID NOT NULL UNIQUE REFERENCES public.contagens(id) ON DELETE CASCADE,
  bem_id UUID NOT NULL REFERENCES public.bens(id) ON DELETE RESTRICT,
  status_fluxo VARCHAR(30) NOT NULL,
  solicitacao_aprovacao_id UUID NULL REFERENCES public.solicitacoes_aprovacao(id) ON DELETE SET NULL,
  movimentacao_id UUID NULL REFERENCES public.movimentacoes(id) ON DELETE SET NULL,
  encaminhado_por_perfil_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE RESTRICT,
  encaminhado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacoes TEXT NULL,
  ultimo_erro TEXT NULL,
  CONSTRAINT ck_inventario_regularizacao_transferencias_status
    CHECK (status_fluxo IN ('ENCAMINHADA', 'AGUARDANDO_APROVACAO', 'CONCLUIDA', 'ERRO', 'CANCELADA'))
);

CREATE INDEX IF NOT EXISTS idx_inv_reg_transferencias_status
  ON public.inventario_regularizacao_transferencias (status_fluxo, atualizado_em DESC);

CREATE INDEX IF NOT EXISTS idx_inv_reg_transferencias_solicitacao
  ON public.inventario_regularizacao_transferencias (solicitacao_aprovacao_id)
  WHERE solicitacao_aprovacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inv_reg_transferencias_movimentacao
  ON public.inventario_regularizacao_transferencias (movimentacao_id)
  WHERE movimentacao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_set_atualizado_em_inv_reg_transferencias()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_atualizado_em_inv_reg_transferencias
  ON public.inventario_regularizacao_transferencias;

CREATE TRIGGER trg_set_atualizado_em_inv_reg_transferencias
BEFORE UPDATE ON public.inventario_regularizacao_transferencias
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_atualizado_em_inv_reg_transferencias();

COMMIT;

