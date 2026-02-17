-- Modulo: database
-- Arquivo: 001_initial_schema.sql
-- Funcao no sistema: definir o schema inicial do Sistema de Gestao Patrimonial 2a CJM
-- Escopo: Tarefa 1 (Supabase/PostgreSQL) com foco em compliance ATN 303/2008 e auditabilidade

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipos obrigatorios da especificacao da Tarefa 1.
-- Regra legal: classificacao de inserviveis.
-- Art. 141, Caput/I/II/III/IV (AN303_Art141_Cap, AN303_Art141_I, AN303_Art141_II, AN303_Art141_III, AN303_Art141_IV).
CREATE TYPE tipo_inservivel AS ENUM (
  'OCIOSO',
  'RECUPERAVEL',
  'ANTIECONOMICO',
  'IRRECUPERAVEL'
);

CREATE TYPE status_bem AS ENUM (
  'OK',
  'BAIXADO',
  'EM_CAUTELA'
);

CREATE TYPE status_apurado AS ENUM (
  'OK',
  'SOBRA_FISICA',
  'NAO_LOCALIZADO'
);

-- Tipos auxiliares para operacionalizar inventario, contagem e movimentacoes.
CREATE TYPE status_inventario AS ENUM (
  'PLANEJADO',
  'EM_ANDAMENTO',
  'ENCERRADO',
  'CANCELADO'
);

CREATE TYPE tipo_ocorrencia_inventario AS ENUM (
  'CONFORME',
  'ENCONTRADO_EM_LOCAL_DIVERGENTE'
);

CREATE TYPE tipo_movimentacao AS ENUM (
  'TRANSFERENCIA',
  'CAUTELA_SAIDA',
  'CAUTELA_RETORNO',
  'REGULARIZACAO_INVENTARIO'
);

CREATE TYPE status_movimentacao AS ENUM (
  'SOLICITADA',
  'AUTORIZADA',
  'EXECUTADA',
  'CANCELADA'
);

-- Tabela: perfis
-- Regra operacional: guarda dados do servidor/agente com matricula unica.
CREATE TABLE perfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula VARCHAR(30) NOT NULL UNIQUE,
  nome VARCHAR(160) NOT NULL,
  email VARCHAR(255) UNIQUE,
  unidade_id SMALLINT NOT NULL CHECK (unidade_id IN (1, 2, 3, 4)),
  cargo VARCHAR(120),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN perfis.unidade_id IS 'Mapa de unidades: 1=1a_AUD, 2=2a_AUD, 3=FORO, 4=ALMOX.';

-- Tabela: catalogo_bens
-- Regra operacional: define o cadastro mestre dos tipos de bens.
CREATE TABLE catalogo_bens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_catalogo VARCHAR(80) NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  grupo VARCHAR(120),
  material_permanente BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela: bens
-- Regra legal: controle segregado de bens proprios e de terceiros
-- Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX).
CREATE TABLE bens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_tombamento VARCHAR(80),
  identificador_externo VARCHAR(120),
  catalogo_bem_id UUID NOT NULL REFERENCES catalogo_bens(id) ON DELETE RESTRICT,
  descricao_complementar TEXT,
  unidade_dona_id SMALLINT NOT NULL CHECK (unidade_dona_id IN (1, 2, 3, 4)),
  responsavel_perfil_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  local_fisico VARCHAR(180) NOT NULL,
  status status_bem NOT NULL DEFAULT 'OK',
  tipo_inservivel tipo_inservivel,
  eh_bem_terceiro BOOLEAN NOT NULL DEFAULT FALSE,
  proprietario_externo VARCHAR(180),
  contrato_referencia VARCHAR(140),
  data_aquisicao DATE,
  valor_aquisicao NUMERIC(14, 2) CHECK (valor_aquisicao IS NULL OR valor_aquisicao >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_bens_identificacao CHECK (
    (
      eh_bem_terceiro = FALSE
      AND numero_tombamento IS NOT NULL
      AND numero_tombamento ~ '^\d{10}$'
      AND identificador_externo IS NULL
      AND proprietario_externo IS NULL
    )
    OR
    (
      eh_bem_terceiro = TRUE
      AND numero_tombamento IS NULL
      AND identificador_externo IS NOT NULL
      AND proprietario_externo IS NOT NULL
    )
  )
);

COMMENT ON COLUMN bens.unidade_dona_id IS 'Mapa de unidades: 1=1a_AUD, 2=2a_AUD, 3=FORO, 4=ALMOX.';

-- Tabela: eventos_inventario
-- Regra legal: inventario em andamento aciona bloqueio de movimentacao de bens.
-- Art. 183 (AN303_Art183).
CREATE TABLE eventos_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_evento VARCHAR(60) NOT NULL UNIQUE,
  unidade_inventariada_id SMALLINT CHECK (unidade_inventariada_id IN (1, 2, 3, 4)),
  status status_inventario NOT NULL DEFAULT 'PLANEJADO',
  iniciado_em TIMESTAMPTZ,
  encerrado_em TIMESTAMPTZ,
  aberto_por_perfil_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  encerrado_por_perfil_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_eventos_inventario_datas CHECK (
    iniciado_em IS NULL
    OR encerrado_em IS NULL
    OR encerrado_em >= iniciado_em
  )
);

COMMENT ON COLUMN eventos_inventario.unidade_inventariada_id IS 'NULL indica inventario geral (todas as unidades).';

-- Tabela: contagens
-- Regra legal: divergencias devem ser registradas para regularizacao posterior.
-- Art. 185 (AN303_Art185).
CREATE TABLE contagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_inventario_id UUID NOT NULL REFERENCES eventos_inventario(id) ON DELETE CASCADE,
  bem_id UUID NOT NULL REFERENCES bens(id) ON DELETE RESTRICT,
  unidade_encontrada_id SMALLINT NOT NULL CHECK (unidade_encontrada_id IN (1, 2, 3, 4)),
  sala_encontrada VARCHAR(180) NOT NULL,
  status_apurado status_apurado NOT NULL DEFAULT 'OK',
  tipo_ocorrencia tipo_ocorrencia_inventario NOT NULL DEFAULT 'CONFORME',
  regularizacao_pendente BOOLEAN NOT NULL DEFAULT FALSE,
  encontrado_por_perfil_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  encontrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_contagens_evento_bem UNIQUE (evento_inventario_id, bem_id),
  CONSTRAINT ck_contagens_regularizacao CHECK (
    tipo_ocorrencia <> 'ENCONTRADO_EM_LOCAL_DIVERGENTE'
    OR regularizacao_pendente = TRUE
  )
);

-- Tabela: movimentacoes
-- Regra legal: separar transferencia de cautela com formalizacao de termo.
-- Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
CREATE TABLE movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bem_id UUID NOT NULL REFERENCES bens(id) ON DELETE RESTRICT,
  tipo_movimentacao tipo_movimentacao NOT NULL,
  status status_movimentacao NOT NULL DEFAULT 'SOLICITADA',
  unidade_origem_id SMALLINT CHECK (unidade_origem_id IN (1, 2, 3, 4)),
  unidade_destino_id SMALLINT CHECK (unidade_destino_id IN (1, 2, 3, 4)),
  detentor_temporario_perfil_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  data_prevista_devolucao DATE,
  data_efetiva_devolucao TIMESTAMPTZ,
  termo_referencia VARCHAR(120) NOT NULL,
  justificativa TEXT,
  autorizada_por_perfil_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  autorizada_em TIMESTAMPTZ,
  executada_por_perfil_id UUID REFERENCES perfis(id) ON DELETE SET NULL,
  executada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_movimentacoes_transferencia CHECK (
    tipo_movimentacao <> 'TRANSFERENCIA'
    OR (
      unidade_origem_id IS NOT NULL
      AND unidade_destino_id IS NOT NULL
      AND unidade_origem_id <> unidade_destino_id
      AND detentor_temporario_perfil_id IS NULL
      AND data_prevista_devolucao IS NULL
    )
  ),
  CONSTRAINT ck_movimentacoes_cautela_saida CHECK (
    tipo_movimentacao <> 'CAUTELA_SAIDA'
    OR (
      unidade_origem_id IS NOT NULL
      AND detentor_temporario_perfil_id IS NOT NULL
      AND data_prevista_devolucao IS NOT NULL
    )
  ),
  CONSTRAINT ck_movimentacoes_cautela_retorno CHECK (
    tipo_movimentacao <> 'CAUTELA_RETORNO'
    OR data_efetiva_devolucao IS NOT NULL
  )
);

-- Tabela de suporte para rastreabilidade total.
CREATE TABLE auditoria_log (
  id BIGSERIAL PRIMARY KEY,
  tabela VARCHAR(80) NOT NULL,
  operacao VARCHAR(10) NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  registro_pk TEXT NOT NULL,
  dados_antes JSONB,
  dados_depois JSONB,
  executado_por TEXT NOT NULL,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transacao_id BIGINT NOT NULL DEFAULT txid_current()
);

/*
 * Funcao: fn_set_updated_at
 * Modulo: utilitario de metadados
 * Retorno: trigger (NEW)
 * Objetivo: atualizar o campo updated_at de forma padronizada.
 */
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

/*
 * Funcao: fn_bloqueio_movimentacao_art183
 * Modulo: compliance de inventario
 * Retorno: trigger (NEW)
 * Objetivo: impedir mudanca de unidade_dona_id durante inventario em andamento.
 * Regra legal: Art. 183 (AN303_Art183).
 */
CREATE OR REPLACE FUNCTION fn_bloqueio_movimentacao_art183()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_evento_ativo UUID;
BEGIN
  IF NEW.unidade_dona_id IS DISTINCT FROM OLD.unidade_dona_id THEN
    SELECT ei.id
    INTO v_evento_ativo
    FROM eventos_inventario ei
    WHERE ei.status = 'EM_ANDAMENTO'
      AND (
        ei.unidade_inventariada_id IS NULL
        OR ei.unidade_inventariada_id = OLD.unidade_dona_id
        OR ei.unidade_inventariada_id = NEW.unidade_dona_id
      )
    LIMIT 1;

    IF v_evento_ativo IS NOT NULL THEN
      RAISE EXCEPTION
        USING
          ERRCODE = 'P0001',
          MESSAGE = 'Movimentacao bloqueada por inventario em andamento.',
          DETAIL = 'Regra legal: Art. 183 (AN303_Art183).',
          HINT = 'Encerrar o inventario antes de alterar unidade_dona_id do bem.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

/*
 * Funcao: fn_log_auditoria
 * Modulo: rastreabilidade
 * Retorno: trigger (NEW/OLD)
 * Objetivo: registrar INSERT/UPDATE/DELETE com antes/depois em JSONB.
 */
CREATE OR REPLACE FUNCTION fn_log_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_actor TEXT;
  v_old JSONB;
  v_new JSONB;
  v_pk TEXT;
BEGIN
  v_actor := COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', TRUE), ''),
    NULLIF(current_setting('request.jwt.claim.sub', TRUE), ''),
    NULLIF(current_setting('app.current_user', TRUE), ''),
    session_user
  );

  IF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_pk := COALESCE(v_new ->> 'id', '[sem-id]');
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_pk := COALESCE(v_new ->> 'id', v_old ->> 'id', '[sem-id]');
  ELSE
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_pk := COALESCE(v_old ->> 'id', '[sem-id]');
  END IF;

  INSERT INTO auditoria_log (
    tabela,
    operacao,
    registro_pk,
    dados_antes,
    dados_depois,
    executado_por
  )
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_pk,
    v_old,
    v_new,
    v_actor
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger exigida pela Tarefa 1.
DROP TRIGGER IF EXISTS trg_bloqueio_art183 ON bens;
CREATE TRIGGER trg_bloqueio_art183
BEFORE UPDATE OF unidade_dona_id ON bens
FOR EACH ROW
EXECUTE FUNCTION fn_bloqueio_movimentacao_art183();

-- Trigger exigida pela Tarefa 1 (rastreabilidade total).
CREATE TRIGGER trg_log_auditoria
AFTER INSERT OR UPDATE OR DELETE ON perfis
FOR EACH ROW
EXECUTE FUNCTION fn_log_auditoria();

CREATE TRIGGER trg_log_auditoria
AFTER INSERT OR UPDATE OR DELETE ON catalogo_bens
FOR EACH ROW
EXECUTE FUNCTION fn_log_auditoria();

CREATE TRIGGER trg_log_auditoria
AFTER INSERT OR UPDATE OR DELETE ON bens
FOR EACH ROW
EXECUTE FUNCTION fn_log_auditoria();

CREATE TRIGGER trg_log_auditoria
AFTER INSERT OR UPDATE OR DELETE ON eventos_inventario
FOR EACH ROW
EXECUTE FUNCTION fn_log_auditoria();

CREATE TRIGGER trg_log_auditoria
AFTER INSERT OR UPDATE OR DELETE ON contagens
FOR EACH ROW
EXECUTE FUNCTION fn_log_auditoria();

CREATE TRIGGER trg_log_auditoria
AFTER INSERT OR UPDATE OR DELETE ON movimentacoes
FOR EACH ROW
EXECUTE FUNCTION fn_log_auditoria();

-- Trigger utilitaria para metadados de atualizacao.
CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON perfis
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON catalogo_bens
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON bens
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON eventos_inventario
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON contagens
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_set_updated_at
BEFORE UPDATE ON movimentacoes
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

-- Indices para consultas operacionais e filtros de auditoria.
CREATE UNIQUE INDEX uq_bens_numero_tombamento
  ON bens (numero_tombamento)
  WHERE numero_tombamento IS NOT NULL;

CREATE UNIQUE INDEX uq_bens_identificador_externo
  ON bens (identificador_externo)
  WHERE identificador_externo IS NOT NULL;

CREATE INDEX idx_perfis_unidade_ativo
  ON perfis (unidade_id, ativo);

CREATE INDEX idx_bens_catalogo
  ON bens (catalogo_bem_id);

CREATE INDEX idx_bens_unidade_status
  ON bens (unidade_dona_id, status);

CREATE INDEX idx_eventos_inventario_status_unidade
  ON eventos_inventario (status, unidade_inventariada_id);

CREATE INDEX idx_contagens_evento_status
  ON contagens (evento_inventario_id, status_apurado);

CREATE INDEX idx_contagens_ocorrencia
  ON contagens (tipo_ocorrencia, regularizacao_pendente);

CREATE INDEX idx_movimentacoes_bem_tipo
  ON movimentacoes (bem_id, tipo_movimentacao, status);

CREATE INDEX idx_movimentacoes_detentor
  ON movimentacoes (detentor_temporario_perfil_id, data_prevista_devolucao);

CREATE INDEX idx_auditoria_log_tabela_data
  ON auditoria_log (tabela, executado_em DESC);

COMMIT;
