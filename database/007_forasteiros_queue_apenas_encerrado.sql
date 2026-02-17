-- Modulo: database
-- Arquivo: 007_forasteiros_queue_apenas_encerrado.sql
-- Funcao no sistema: ajustar a "fila" de regularizacao (forasteiros) para existir apenas no pos-inventario.
--
-- Regra legal:
-- - Divergencias/intrusos devem ser regularizados apos o inventario (nao muda carga automaticamente).
--   Art. 185 (AN303_Art185).
--
-- Regra operacional:
-- - Durante EM_ANDAMENTO, divergencias podem ser registradas em `contagens`, mas nao entram na "fila" do pos-inventario.
-- - A fila (view `vw_forasteiros`) passa a filtrar apenas eventos `ENCERRADO`.
-- - Nao apaga dados; apenas altera a view.

BEGIN;

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
  AND c.regularizacao_pendente = TRUE
  AND ei.status = 'ENCERRADO';

COMMIT;

