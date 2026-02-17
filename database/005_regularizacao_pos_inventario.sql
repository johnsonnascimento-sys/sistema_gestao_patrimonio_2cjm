-- Modulo: database
-- Arquivo: 005_regularizacao_pos_inventario.sql
-- Funcao no sistema: permitir regularizacao pos-inventario de divergencias (Art. 185) sem apagar o fato historico.
--
-- Regra legal:
-- - Intrusos/divergencias devem ser registrados e regularizados apos o inventario.
--   Art. 185 (AN303_Art185).
--
-- Regra operacional:
-- - `tipo_ocorrencia='ENCONTRADO_EM_LOCAL_DIVERGENTE'` registra um fato.
-- - `regularizacao_pendente` indica pendencia. Ao regularizar, marcamos pendente=false,
--   mantendo o fato e registrando metadados de regularizacao (quem/quando/como).

BEGIN;

ALTER TABLE public.contagens
  ADD COLUMN IF NOT EXISTS regularizado_em TIMESTAMPTZ;

ALTER TABLE public.contagens
  ADD COLUMN IF NOT EXISTS regularizado_por_perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL;

ALTER TABLE public.contagens
  ADD COLUMN IF NOT EXISTS regularizacao_acao VARCHAR(40);

ALTER TABLE public.contagens
  ADD COLUMN IF NOT EXISTS regularizacao_movimentacao_id UUID REFERENCES public.movimentacoes(id) ON DELETE SET NULL;

ALTER TABLE public.contagens
  ADD COLUMN IF NOT EXISTS regularizacao_observacoes TEXT;

-- Mantem historico do fato (tipo_ocorrencia) e permite encerrar a pendencia com metadados minimos.
ALTER TABLE public.contagens
  DROP CONSTRAINT IF EXISTS ck_contagens_regularizacao;

ALTER TABLE public.contagens
  ADD CONSTRAINT ck_contagens_regularizacao CHECK (
    tipo_ocorrencia <> 'ENCONTRADO_EM_LOCAL_DIVERGENTE'
    OR regularizacao_pendente = TRUE
    OR (
      regularizacao_pendente = FALSE
      AND regularizado_em IS NOT NULL
      AND regularizado_por_perfil_id IS NOT NULL
    )
  );

-- Coerencia: se regularizado_em foi preenchido, a pendencia deve estar encerrada.
ALTER TABLE public.contagens
  DROP CONSTRAINT IF EXISTS ck_contagens_regularizado_coerencia;

ALTER TABLE public.contagens
  ADD CONSTRAINT ck_contagens_regularizado_coerencia CHECK (
    regularizado_em IS NULL
    OR regularizacao_pendente = FALSE
  );

COMMIT;

