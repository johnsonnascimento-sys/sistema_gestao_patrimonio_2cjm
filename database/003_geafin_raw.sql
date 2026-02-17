-- Modulo: database
-- Arquivo: 003_geafin_raw.sql
-- Funcao no sistema: criar camada "espelho" (raw/staging) do GEAFIN para auditoria e copia fiel do CSV.
--
-- Objetivo:
-- - Guardar todas as colunas do relatorio GEAFIN sem normalizacao (linha a linha) para fins de auditoria.
-- - Manter o modelo melhorado do sistema (catalogo_bens/bens/...) separado do raw.
--
-- Observacoes:
-- - A copia fiel e feita via `row_raw` (JSONB). Para facilitar consulta com "colunas iguais ao CSV",
--   existe uma VIEW com os nomes exatamente como aparecem no header do `relatorio.csv`.
-- - Este arquivo NAO apaga objetos existentes. Somente CREATE/ALTER.

BEGIN;

-- Tabela: geafin_import_arquivos
-- Funcao: registrar metadados do upload/importacao (uma importacao por arquivo).
CREATE TABLE IF NOT EXISTS public.geafin_import_arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID,
  original_filename TEXT,
  content_sha256 TEXT,
  bytes INTEGER CHECK (bytes IS NULL OR bytes >= 0),
  delimiter CHAR(1),
  imported_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geafin_import_arquivos_imported_em
  ON public.geafin_import_arquivos (imported_em DESC);

-- Tabela: geafin_import_linhas
-- Funcao: espelhar as linhas do CSV GEAFIN. Mantem o raw e o resultado da normalizacao/persistencia.
CREATE TABLE IF NOT EXISTS public.geafin_import_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id UUID NOT NULL REFERENCES public.geafin_import_arquivos(id) ON DELETE CASCADE,
  linha_numero INTEGER NOT NULL CHECK (linha_numero >= 1),
  row_raw JSONB NOT NULL,
  row_sha256 TEXT NOT NULL,
  normalizacao_ok BOOLEAN NOT NULL DEFAULT FALSE,
  normalizacao_erro TEXT,
  persistencia_ok BOOLEAN NOT NULL DEFAULT FALSE,
  persistencia_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_geafin_import_linhas_arquivo_linha UNIQUE (arquivo_id, linha_numero)
);

CREATE INDEX IF NOT EXISTS idx_geafin_import_linhas_arquivo
  ON public.geafin_import_linhas (arquivo_id);

CREATE INDEX IF NOT EXISTS idx_geafin_import_linhas_row_sha256
  ON public.geafin_import_linhas (row_sha256);

/*
 * View: vw_geafin_relatorio_csv
 * Funcao: expor as colunas com os nomes exatamente como no GEAFIN (header do relatorio.csv),
 *         a partir do JSONB raw. Ideal para auditoria e export.
 */
CREATE OR REPLACE VIEW public.vw_geafin_relatorio_csv AS
SELECT
  a.id AS arquivo_id,
  a.imported_em,
  l.linha_numero,
  l.normalizacao_ok,
  l.normalizacao_erro,
  l.persistencia_ok,
  l.persistencia_erro,
  (l.row_raw ->> 'Cod Material') AS "Cod Material",
  (l.row_raw ->> 'Tombamento') AS "Tombamento",
  (l.row_raw ->> 'SiglaLotacao') AS "SiglaLotacao",
  (l.row_raw ->> 'Lotação') AS "Lotação",
  (l.row_raw ->> 'Sigla de usuário com carga pessoal') AS "Sigla de usuário com carga pessoal",
  (l.row_raw ->> 'Nome de usuário com carga pessoal') AS "Nome de usuário com carga pessoal",
  (l.row_raw ->> 'Descrição') AS "Descrição",
  (l.row_raw ->> 'Núm. série') AS "Núm. série",
  (l.row_raw ->> 'Marca') AS "Marca",
  (l.row_raw ->> 'Modelo') AS "Modelo",
  (l.row_raw ->> 'Autor') AS "Autor",
  (l.row_raw ->> 'Editora') AS "Editora",
  (l.row_raw ->> 'Edicao') AS "Edicao",
  (l.row_raw ->> 'Forn Razao Social') AS "Forn Razao Social",
  (l.row_raw ->> 'Forn Nome Fantasia') AS "Forn Nome Fantasia",
  (l.row_raw ->> 'Orgao Ext. Entrada') AS "Orgao Ext. Entrada",
  (l.row_raw ->> 'Cód. estrutural') AS "Cód. estrutural",
  (l.row_raw ->> 'Tipo Entrada') AS "Tipo Entrada",
  (l.row_raw ->> 'NumDocumento') AS "NumDocumento",
  (l.row_raw ->> 'Valor de aquisição') AS "Valor de aquisição",
  (l.row_raw ->> 'Valor de reavaliação') AS "Valor de reavaliação",
  (l.row_raw ->> 'Valor Atualizado') AS "Valor Atualizado",
  (l.row_raw ->> 'Classificação SIAFI') AS "Classificação SIAFI",
  (l.row_raw ->> 'Descr Siafi') AS "Descr Siafi",
  (l.row_raw ->> 'Situação') AS "Situação",
  (l.row_raw ->> 'Observação') AS "Observação",
  (l.row_raw ->> 'Data de aquisição') AS "Data de aquisição",
  (l.row_raw ->> 'Data de reavaliação') AS "Data de reavaliação",
  (l.row_raw ->> 'Data de atualização') AS "Data de atualização",
  (l.row_raw ->> 'Dt Term Garantia') AS "Dt Term Garantia",
  (l.row_raw ->> 'Dta Ult. Movimentacao') AS "Dta Ult. Movimentacao",
  (l.row_raw ->> 'Dta Baixa') AS "Dta Baixa",
  (l.row_raw ->> 'Tipo Termo') AS "Tipo Termo",
  (l.row_raw ->> 'Num.Termo') AS "Num.Termo",
  (l.row_raw ->> 'Órgão Externo') AS "Órgão Externo",
  (l.row_raw ->> 'Processo Adm.') AS "Processo Adm.",
  (l.row_raw ->> 'Estado Conservação') AS "Estado Conservação",
  (l.row_raw ->> 'Ano/mês da última atualização') AS "Ano/mês da última atualização",
  (l.row_raw ->> 'Data estimada do término da licença') AS "Data estimada do término da licença"
FROM public.geafin_import_linhas l
JOIN public.geafin_import_arquivos a ON a.id = l.arquivo_id;

COMMIT;

