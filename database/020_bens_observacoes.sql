-- Modulo: bens
-- Arquivo: database/020_bens_observacoes.sql
-- Funcao no sistema: adicionar campo de observacoes livres no cadastro operacional do bem.

ALTER TABLE bens
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

