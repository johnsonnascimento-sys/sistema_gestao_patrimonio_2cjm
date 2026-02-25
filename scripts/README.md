# Scripts

## Cabecalho

- Modulo: `scripts`
- Funcao: armazenar scripts utilitarios de importacao, validacao e auditoria.

## Diretriz

- Evitar scripts destrutivos sem confirmacao explicita.

## Scripts de governanca (log + rollback)

- `scripts/log_alteracao.sh`:
  - Registra entrada no `docs/LOG_GERAL_ALTERACOES.md`.
  - Captura automaticamente: usuario, data/hora UTC, branch, commit e reversao sugerida.
  - Uso:
    - `./scripts/log_alteracao.sh "UX" "Ajuste da sidebar com icones SVG."`
  - Versao PowerShell (Windows):
    - `./scripts/log_alteracao.ps1 -Tipo "UX" -Detalhe "Ajuste da sidebar com icones SVG."`

- `scripts/reverter_alteracao.sh`:
  - Reverte alteracao por commit (`--commit`) ou por ID do log (`--log-id`).
  - Padrao seguro: cria branch `rollback/<commit>-<timestamp>` antes de executar `git revert`.
  - Uso:
    - `./scripts/reverter_alteracao.sh --commit 44d0017`
    - `./scripts/reverter_alteracao.sh --log-id 20260225-223802-sidebar-icons-svg`
    - `./scripts/reverter_alteracao.sh --commit 44d0017 --in-place`
  - Versao PowerShell (Windows):
    - `./scripts/reverter_alteracao.ps1 -Commit 44d0017`
    - `./scripts/reverter_alteracao.ps1 -LogId 20260225-223802-sidebar-icons-svg`
    - `./scripts/reverter_alteracao.ps1 -Commit 44d0017 -InPlace`

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

## Script de backfill Smart Inventory (Cod2Aud + Nome)

- `scripts/backfill_smart_inventory_cod2aud_nome.js`:
  - Le o CSV do Smart Inventory e atualiza `bens.cod_2_aud` (etiqueta azul) e `bens.nome_resumo`.
  - Remove sufixos antigos de catalogacao no nome (ex.: `1/10`, `(1-2)`, `17-21`).
  - Ignora `Cod2Aud` invalido (`0000`).
  - Uso:
    - `node scripts/backfill_smart_inventory_cod2aud_nome.js --dry-run`
    - `node scripts/backfill_smart_inventory_cod2aud_nome.js "Inventário Inteligente - Lista de Itens - 21.02.2026 14 18.csv"`
