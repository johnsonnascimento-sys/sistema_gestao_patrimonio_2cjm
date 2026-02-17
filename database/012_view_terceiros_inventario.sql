-- Modulo: database
-- Arquivo: 012_view_terceiros_inventario.sql
-- Funcao no sistema: view de ocorrencias de bens de terceiros no inventario (controle segregado).
--
-- Regra legal:
-- - Controle segregado de bens de terceiros.
--   Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX).
--
-- Regra operacional:
-- - Derivado de contagens (fato do inventario), sem alterar carga STM.

BEGIN;

CREATE OR REPLACE VIEW public.vw_bens_terceiros_inventario AS
SELECT
  c.id AS contagem_id,
  c.evento_inventario_id,
  ei.codigo_evento,
  ei.status AS status_inventario,
  c.unidade_encontrada_id,
  c.sala_encontrada,
  c.encontrado_em,
  c.encontrado_por_perfil_id,
  c.observacoes,
  b.id AS bem_id,
  b.identificador_externo,
  b.descricao_complementar AS descricao,
  b.proprietario_externo,
  b.contrato_referencia
FROM public.contagens c
JOIN public.eventos_inventario ei ON ei.id = c.evento_inventario_id
JOIN public.bens b ON b.id = c.bem_id
WHERE c.tipo_ocorrencia = 'BEM_DE_TERCEIRO'
  AND b.eh_bem_terceiro = TRUE;

COMMIT;

