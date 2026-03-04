-- Modulo: database
-- Arquivo: 023_fix_trigger_validar_operadores_evento.sql
-- Funcao no sistema: corrigir trigger de validacao de operadores para aceitar contexto
-- de eventos_inventario (NEW.id/OLD.id) e eventos_inventario_operadores (evento_inventario_id).

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_validar_operadores_evento_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_evento_id UUID;
  v_modo public.modo_contagem_inventario;
  v_qtd_ativos INTEGER;
  v_qtd_unico INTEGER;
  v_qtd_a INTEGER;
  v_qtd_b INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'eventos_inventario_operadores' THEN
    v_evento_id := COALESCE(NEW.evento_inventario_id, OLD.evento_inventario_id);
  ELSIF TG_TABLE_NAME = 'eventos_inventario' THEN
    v_evento_id := COALESCE(NEW.id, OLD.id);
  ELSE
    RETURN NULL;
  END IF;

  IF v_evento_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT modo_contagem INTO v_modo
  FROM public.eventos_inventario
  WHERE id = v_evento_id
  LIMIT 1;

  IF v_modo IS NULL OR v_modo = 'PADRAO' THEN
    RETURN NULL;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE ativo = TRUE),
    COUNT(*) FILTER (WHERE ativo = TRUE AND papel_contagem = 'OPERADOR_UNICO'),
    COUNT(*) FILTER (WHERE ativo = TRUE AND papel_contagem = 'OPERADOR_A'),
    COUNT(*) FILTER (WHERE ativo = TRUE AND papel_contagem = 'OPERADOR_B')
  INTO v_qtd_ativos, v_qtd_unico, v_qtd_a, v_qtd_b
  FROM public.eventos_inventario_operadores
  WHERE evento_inventario_id = v_evento_id;

  IF v_modo = 'CEGO' THEN
    IF v_qtd_ativos <> 1 OR v_qtd_unico <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Modo CEGO exige exatamente 1 operador ativo com papel OPERADOR_UNICO.';
    END IF;
  ELSIF v_modo = 'DUPLO_CEGO' THEN
    IF v_qtd_ativos <> 2 OR v_qtd_a <> 1 OR v_qtd_b <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'Modo DUPLO_CEGO exige 2 operadores ativos: OPERADOR_A e OPERADOR_B.';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

COMMIT;

