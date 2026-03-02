-- Modulo: Catalogo / Classificacao SIAFI
-- Arquivo: 019_classificacoes_siafi.sql
-- Funcao no sistema: criar tabela de classificacoes SIAFI para cadastro/edicao dedicado e validacao no Material (SKU).

CREATE TABLE IF NOT EXISTS classificacoes_siafi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_classificacao TEXT NOT NULL UNIQUE,
  descricao_siafi TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classificacoes_siafi_codigo
  ON classificacoes_siafi (codigo_classificacao);

CREATE INDEX IF NOT EXISTS idx_classificacoes_siafi_ativo
  ON classificacoes_siafi (ativo);
