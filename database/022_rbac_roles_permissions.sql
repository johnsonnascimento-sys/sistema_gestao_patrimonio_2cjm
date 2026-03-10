-- Modulo: database
-- Arquivo: 022_rbac_roles_permissions.sql
-- Funcao no sistema: implementar RBAC por roles/permissoes e fila de aprovacao administrativa.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'categoria_permissao_acesso'
  ) THEN
    CREATE TYPE public.categoria_permissao_acesso AS ENUM ('MENU', 'ACTION');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'status_solicitacao_aprovacao'
  ) THEN
    CREATE TYPE public.status_solicitacao_aprovacao AS ENUM (
      'PENDENTE',
      'APROVADA',
      'REPROVADA',
      'CANCELADA',
      'EXPIRADA',
      'ERRO_APLICACAO'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.roles_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  nivel SMALLINT NOT NULL CHECK (nivel BETWEEN 1 AND 100),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  sistema BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissoes_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  categoria public.categoria_permissao_acesso NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissoes_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles_acesso(id) ON DELETE CASCADE,
  permissao_id UUID NOT NULL REFERENCES public.permissoes_acesso(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_role_permissao UNIQUE (role_id, permissao_id)
);

CREATE TABLE IF NOT EXISTS public.perfil_roles_acesso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles_acesso(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  atribuido_por_perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_perfil_role UNIQUE (perfil_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.solicitacoes_aprovacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_acao TEXT NOT NULL,
  entidade_tipo TEXT NOT NULL,
  entidade_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.status_solicitacao_aprovacao NOT NULL DEFAULT 'PENDENTE',
  solicitante_perfil_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE RESTRICT,
  aprovado_por_perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  reprovado_por_perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  justificativa_solicitante TEXT,
  justificativa_admin TEXT,
  snapshot_before JSONB,
  resultado_execucao JSONB,
  expira_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.solicitacoes_aprovacao_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES public.solicitacoes_aprovacao(id) ON DELETE CASCADE,
  status public.status_solicitacao_aprovacao NOT NULL,
  perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  observacao TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_permissoes_role
  ON public.role_permissoes_acesso(role_id);

CREATE INDEX IF NOT EXISTS idx_perfil_roles_perfil
  ON public.perfil_roles_acesso(perfil_id, ativo);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_status_created
  ON public.solicitacoes_aprovacao(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_solicitante
  ON public.solicitacoes_aprovacao(solicitante_perfil_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_eventos_solicitacao
  ON public.solicitacoes_aprovacao_eventos(solicitacao_id, created_at ASC);

INSERT INTO public.roles_acesso (codigo, nome, nivel, ativo, sistema)
VALUES
  ('LEITURA', 'Leitura', 10, TRUE, TRUE),
  ('OPERADOR_BASICO', 'Operador Basico', 20, TRUE, TRUE),
  ('OPERADOR_AVANCADO', 'Operador Avancado', 30, TRUE, TRUE),
  ('SUPERVISOR', 'Supervisor', 40, TRUE, TRUE),
  ('ADMIN_COMPLETO', 'Administrador Completo', 90, TRUE, TRUE)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    nivel = EXCLUDED.nivel,
    ativo = EXCLUDED.ativo,
    sistema = EXCLUDED.sistema,
    updated_at = NOW();

INSERT INTO public.permissoes_acesso (codigo, descricao, categoria, ativo)
VALUES
  ('menu.dashboard.view', 'Visualizar dashboard', 'MENU', TRUE),
  ('menu.bens.view', 'Visualizar consulta de bens', 'MENU', TRUE),
  ('menu.movimentacoes.view', 'Visualizar movimentacoes', 'MENU', TRUE),
  ('menu.inventario_contagem.view', 'Visualizar inventario contagem', 'MENU', TRUE),
  ('menu.inventario_admin.view', 'Visualizar inventario administracao', 'MENU', TRUE),
  ('menu.classificacao.view', 'Visualizar wizard art. 141', 'MENU', TRUE),
  ('menu.catalogo_material.view', 'Visualizar material SKU', 'MENU', TRUE),
  ('menu.classificacoes_siafi.view', 'Visualizar classificacoes SIAFI', 'MENU', TRUE),
  ('menu.importacoes_geafin.view', 'Visualizar importacoes GEAFIN', 'MENU', TRUE),
  ('menu.auditoria.view', 'Visualizar auditoria e logs', 'MENU', TRUE),
  ('menu.admin_locais.view', 'Visualizar administracao de locais', 'MENU', TRUE),
  ('menu.admin_backup.view', 'Visualizar backup/restore', 'MENU', TRUE),
  ('menu.admin_health.view', 'Visualizar conectividade backend', 'MENU', TRUE),
  ('menu.admin_perfis.view', 'Visualizar perfis e acessos', 'MENU', TRUE),
  ('menu.admin_aprovacoes.view', 'Visualizar aprovacoes pendentes', 'MENU', TRUE),
  ('menu.wiki.view', 'Visualizar wiki/manual', 'MENU', TRUE),
  ('action.bem.editar_operacional.execute', 'Executar edicao operacional de bem', 'ACTION', TRUE),
  ('action.bem.editar_operacional.request', 'Solicitar edicao operacional de bem', 'ACTION', TRUE),
  ('action.bem.alterar_responsavel.execute', 'Executar alteracao de responsavel', 'ACTION', TRUE),
  ('action.bem.alterar_responsavel.request', 'Solicitar alteracao de responsavel', 'ACTION', TRUE),
  ('action.bem.alterar_status.execute', 'Executar alteracao de status', 'ACTION', TRUE),
  ('action.bem.alterar_status.request', 'Solicitar alteracao de status', 'ACTION', TRUE),
  ('action.bem.alterar_localizacao.execute', 'Executar alteracao de localizacao', 'ACTION', TRUE),
  ('action.bem.alterar_localizacao.request', 'Solicitar alteracao de localizacao', 'ACTION', TRUE),
  ('action.bem.vincular_local_lote.execute', 'Executar vinculacao de local em lote', 'ACTION', TRUE),
  ('action.bem.vincular_local_lote.request', 'Solicitar vinculacao de local em lote', 'ACTION', TRUE),
  ('action.inservivel.marcar.execute', 'Executar classificacao e marcacao de material inservivel', 'ACTION', TRUE),
  ('action.inservivel.marcar.request', 'Solicitar classificacao e marcacao de material inservivel', 'ACTION', TRUE),
  ('action.baixa.execute', 'Executar baixa patrimonial', 'ACTION', TRUE),
  ('action.baixa.request', 'Solicitar baixa patrimonial', 'ACTION', TRUE),
  ('action.aprovacao.listar', 'Listar solicitacoes de aprovacao', 'ACTION', TRUE),
  ('action.aprovacao.aprovar', 'Aprovar solicitacoes pendentes', 'ACTION', TRUE),
  ('action.aprovacao.reprovar', 'Reprovar solicitacoes pendentes', 'ACTION', TRUE)
ON CONFLICT (codigo) DO UPDATE
SET descricao = EXCLUDED.descricao,
    categoria = EXCLUDED.categoria,
    ativo = EXCLUDED.ativo,
    updated_at = NOW();

WITH matrix AS (
  SELECT * FROM (VALUES
    ('LEITURA', 'menu.dashboard.view'),
    ('LEITURA', 'menu.bens.view'),
    ('LEITURA', 'menu.wiki.view'),

    ('OPERADOR_BASICO', 'menu.dashboard.view'),
    ('OPERADOR_BASICO', 'menu.bens.view'),
    ('OPERADOR_BASICO', 'menu.movimentacoes.view'),
    ('OPERADOR_BASICO', 'menu.inventario_contagem.view'),
    ('OPERADOR_BASICO', 'menu.classificacao.view'),
    ('OPERADOR_BASICO', 'menu.wiki.view'),

    ('OPERADOR_AVANCADO', 'menu.dashboard.view'),
    ('OPERADOR_AVANCADO', 'menu.bens.view'),
    ('OPERADOR_AVANCADO', 'menu.movimentacoes.view'),
    ('OPERADOR_AVANCADO', 'menu.inventario_contagem.view'),
    ('OPERADOR_AVANCADO', 'menu.classificacao.view'),
    ('OPERADOR_AVANCADO', 'menu.wiki.view'),
    ('OPERADOR_AVANCADO', 'action.bem.editar_operacional.request'),
    ('OPERADOR_AVANCADO', 'action.bem.alterar_responsavel.request'),
    ('OPERADOR_AVANCADO', 'action.bem.alterar_status.request'),
    ('OPERADOR_AVANCADO', 'action.bem.alterar_localizacao.request'),
    ('OPERADOR_AVANCADO', 'action.bem.vincular_local_lote.request'),
    ('OPERADOR_AVANCADO', 'action.inservivel.marcar.request'),
    ('OPERADOR_AVANCADO', 'action.baixa.request'),

    ('SUPERVISOR', 'menu.dashboard.view'),
    ('SUPERVISOR', 'menu.bens.view'),
    ('SUPERVISOR', 'menu.movimentacoes.view'),
    ('SUPERVISOR', 'menu.inventario_contagem.view'),
    ('SUPERVISOR', 'menu.inventario_admin.view'),
    ('SUPERVISOR', 'menu.classificacao.view'),
    ('SUPERVISOR', 'menu.catalogo_material.view'),
    ('SUPERVISOR', 'menu.classificacoes_siafi.view'),
    ('SUPERVISOR', 'menu.auditoria.view'),
    ('SUPERVISOR', 'menu.wiki.view'),
    ('SUPERVISOR', 'action.bem.editar_operacional.execute'),
    ('SUPERVISOR', 'action.bem.alterar_responsavel.execute'),
    ('SUPERVISOR', 'action.bem.alterar_status.execute'),
    ('SUPERVISOR', 'action.bem.alterar_localizacao.execute'),
    ('SUPERVISOR', 'action.bem.vincular_local_lote.execute'),
    ('SUPERVISOR', 'action.inservivel.marcar.execute'),
    ('SUPERVISOR', 'action.baixa.request'),

    ('ADMIN_COMPLETO', 'menu.dashboard.view'),
    ('ADMIN_COMPLETO', 'menu.bens.view'),
    ('ADMIN_COMPLETO', 'menu.movimentacoes.view'),
    ('ADMIN_COMPLETO', 'menu.inventario_contagem.view'),
    ('ADMIN_COMPLETO', 'menu.inventario_admin.view'),
    ('ADMIN_COMPLETO', 'menu.classificacao.view'),
    ('ADMIN_COMPLETO', 'menu.catalogo_material.view'),
    ('ADMIN_COMPLETO', 'menu.classificacoes_siafi.view'),
    ('ADMIN_COMPLETO', 'menu.importacoes_geafin.view'),
    ('ADMIN_COMPLETO', 'menu.auditoria.view'),
    ('ADMIN_COMPLETO', 'menu.admin_locais.view'),
    ('ADMIN_COMPLETO', 'menu.admin_backup.view'),
    ('ADMIN_COMPLETO', 'menu.admin_health.view'),
    ('ADMIN_COMPLETO', 'menu.admin_perfis.view'),
    ('ADMIN_COMPLETO', 'menu.admin_aprovacoes.view'),
    ('ADMIN_COMPLETO', 'menu.wiki.view'),
    ('ADMIN_COMPLETO', 'action.bem.editar_operacional.execute'),
    ('ADMIN_COMPLETO', 'action.bem.editar_operacional.request'),
    ('ADMIN_COMPLETO', 'action.bem.alterar_responsavel.execute'),
    ('ADMIN_COMPLETO', 'action.bem.alterar_responsavel.request'),
    ('ADMIN_COMPLETO', 'action.bem.alterar_status.execute'),
    ('ADMIN_COMPLETO', 'action.bem.alterar_status.request'),
    ('ADMIN_COMPLETO', 'action.bem.alterar_localizacao.execute'),
    ('ADMIN_COMPLETO', 'action.bem.alterar_localizacao.request'),
    ('ADMIN_COMPLETO', 'action.bem.vincular_local_lote.execute'),
    ('ADMIN_COMPLETO', 'action.bem.vincular_local_lote.request'),
    ('ADMIN_COMPLETO', 'action.inservivel.marcar.execute'),
    ('ADMIN_COMPLETO', 'action.inservivel.marcar.request'),
    ('ADMIN_COMPLETO', 'action.baixa.execute'),
    ('ADMIN_COMPLETO', 'action.baixa.request'),
    ('ADMIN_COMPLETO', 'action.aprovacao.listar'),
    ('ADMIN_COMPLETO', 'action.aprovacao.aprovar'),
    ('ADMIN_COMPLETO', 'action.aprovacao.reprovar')
  ) AS t(role_codigo, permissao_codigo)
)
INSERT INTO public.role_permissoes_acesso (role_id, permissao_id)
SELECT r.id, p.id
FROM matrix m
JOIN public.roles_acesso r ON r.codigo = m.role_codigo
JOIN public.permissoes_acesso p ON p.codigo = m.permissao_codigo
ON CONFLICT (role_id, permissao_id) DO NOTHING;

INSERT INTO public.perfil_roles_acesso (perfil_id, role_id, ativo, atribuido_por_perfil_id)
SELECT
  pf.id,
  r.id,
  TRUE,
  NULL
FROM public.perfis pf
JOIN public.roles_acesso r
  ON r.codigo = CASE
    WHEN UPPER(COALESCE(pf.role, 'OPERADOR')) = 'ADMIN' THEN 'ADMIN_COMPLETO'
    ELSE 'OPERADOR_AVANCADO'
  END
LEFT JOIN public.perfil_roles_acesso pra
  ON pra.perfil_id = pf.id
 AND pra.role_id = r.id
WHERE pra.id IS NULL;

COMMIT;
