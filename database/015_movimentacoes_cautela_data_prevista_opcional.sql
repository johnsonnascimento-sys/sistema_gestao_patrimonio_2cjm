-- Modulo: database
-- Arquivo: 015_movimentacoes_cautela_data_prevista_opcional.sql
-- Funcao no sistema: permitir cautela de saida sem data prevista de devolucao.
--
-- Regra operacional:
-- - Mantem obrigatoriedade de detentor temporario em CAUTELA_SAIDA.
-- - Permite que data_prevista_devolucao fique nula quando ainda nao houver previsao.

BEGIN;

ALTER TABLE public.movimentacoes
  DROP CONSTRAINT IF EXISTS ck_movimentacoes_cautela_saida;

ALTER TABLE public.movimentacoes
  ADD CONSTRAINT ck_movimentacoes_cautela_saida CHECK (
    tipo_movimentacao <> 'CAUTELA_SAIDA'
    OR (
      unidade_origem_id IS NOT NULL
      AND detentor_temporario_perfil_id IS NOT NULL
    )
  );

COMMIT;

