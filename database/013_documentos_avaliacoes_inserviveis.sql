-- Modulo: database
-- Arquivo: 013_documentos_avaliacoes_inserviveis.sql
-- Funcao no sistema: permitir anexar evidencias (Drive) a avaliacoes de inserviveis (Wizard Art. 141).
--
-- Regra legal:
-- - Classificacao obrigatoria de inserviveis via fluxo guiado.
--   Art. 141 (AN303_Art141_Cap / AN303_Art141_I / AN303_Art141_II / AN303_Art141_III / AN303_Art141_IV).
--
-- Regra operacional:
-- - O binario do arquivo nao fica no banco. Apenas metadados/links no Drive (tabela documentos).
-- - Esta migration e aditiva (nao apaga objetos existentes).

BEGIN;

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS avaliacao_inservivel_id UUID
    REFERENCES public.avaliacoes_inserviveis(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_avaliacao_inservivel_id
  ON public.documentos (avaliacao_inservivel_id, gerado_em DESC);

COMMIT;

