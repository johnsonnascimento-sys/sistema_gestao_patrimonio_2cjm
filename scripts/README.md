# Scripts

## Cabecalho

- Modulo: `scripts`
- Funcao: armazenar scripts utilitarios de importacao, validacao e auditoria.

## Diretriz

- Evitar scripts destrutivos sem confirmacao explicita.

## Scripts de carga GEAFIN

- `scripts/geafin_to_sql_batches.js`:
  - Le `relatorio.csv` (Latin1), normaliza dados e gera lotes SQL em `scripts/.tmp/geafin_batches/`.
  - Valida tombamento no padrao GEAFIN (`10 digitos numericos`).
  - Mapeia unidade para `1..4` conforme padrao do projeto.

- `scripts/run_geafin_batches.js`:
  - Executa os lotes SQL gerados no banco alvo via `pg`.
  - Requer `DATABASE_URL` em arquivo `.env` local (nao versionado).
  - Ao final, imprime contagens de `catalogo_bens`, `bens` e `movimentacoes`.

## Script de verificacao (equivalencia CSV vs DB)

- `scripts/verify_geafin_vs_db.js`:
  - Compara `relatorio.csv` com o estado atual no banco (via SQL) por tombamento.
  - Reporta divergencias em campos mapeados (tombamento, codigo_catalogo, unidade, status, local_fisico, valor_aquisicao).
  - Observacao: por normalizacao (SKU vs Item), descricao pode ser consolidada no catalogo; o script mede e reporta isso.
