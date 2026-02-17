-- Modulo: database
-- Arquivo: 006_auth_and_access.sql
-- Funcao no sistema: adicionar autenticacao basica (login por matricula) e papeis (ADMIN/OPERADOR) para controle de acesso.
--
-- Regra operacional:
-- - Nao substitui o modelo patrimonial (catalogo_bens/bens). Apenas adiciona colunas em `perfis`.
-- - Senhas sao armazenadas apenas como hash (bcrypt), nunca em texto puro.
-- - Operacoes sensiveis passam a exigir usuario autenticado (ver backend).
--
-- Observacao:
-- - Este arquivo e um "ALTER/ADD". Nao apaga tabelas nem dados existentes.
-- - A governanca (Wiki-First) exige atualizar o manual ao ativar login em producao.

BEGIN;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'OPERADOR'
    CHECK (role IN ('ADMIN', 'OPERADOR'));

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS senha_hash TEXT;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS senha_definida_em TIMESTAMPTZ;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS ultimo_login_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_perfis_role_ativo
  ON public.perfis (role, ativo);

COMMIT;

