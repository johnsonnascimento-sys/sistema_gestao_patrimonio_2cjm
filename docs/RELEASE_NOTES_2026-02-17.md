# Release Notes - 2026-02-17

## Cabecalho

| Campo | Valor |
|---|---|
| Modulo | `docs` |
| Arquivo | `docs/RELEASE_NOTES_2026-02-17.md` |
| Funcao no sistema | Registro das mudancas aplicadas na VPS e no Supabase para estabilizar importacao GEAFIN e UX |
| Data | 2026-02-17 |
| Fonte de verdade (governanca) | `PROJECT_RULES.md` |

## 1. Objetivo

Concluir a Fase 2 com foco em:
- Importacao GEAFIN deterministica, auditavel e robusta a variacoes de CSV.
- Observabilidade e UX: barra de progresso real na UI.
- Consulta de bens com detalhe completo (sem poluir a tabela).

## 2. Mudancas Principais

### 2.1 Banco (Supabase)

- Migracao aplicada: `database/004_geafin_import_progress.sql`
  - Adiciona metadados em `public.geafin_import_arquivos`:
    - `total_linhas`, `status`, `finalizado_em`, `erro_resumo`
  - Objetivo: permitir acompanhamento de progresso e status na UI.

### 2.2 Backend (Node/Express)

- Importacao GEAFIN (`POST /importar-geafin`):
  - Registra espelho raw e commit em lotes (batch) para permitir acompanhamento durante execucao.
  - Corrige casos comuns de encoding (mojibake) e normaliza tombamento para apenas digitos.
  - Corrige `ON CONFLICT` para bater com indice UNIQUE parcial do Postgres.

- Progresso da importacao:
  - `GET /importacoes/geafin/ultimo`
  - Retorna `totalLinhas`, `linhasInseridas`, `percent`, contadores de falhas e `status`.

- Detalhe do bem:
  - `GET /bens/{id}`
  - Retorna dados do bem + catalogo (SKU) + ultimas movimentacoes + historico de transferencias.

### 2.3 Frontend (React/Vite)

- Operacoes API:
  - Barra de progresso real do GEAFIN com polling em `GET /importacoes/geafin/ultimo`.
  - Persistencia do estado: ao dar refresh/trocar de aba, consulta a ultima importacao e retoma polling se estiver `EM_ANDAMENTO`.
  - Quando estiver em 0% no inicio, exibe estado indeterminado ("Preparando importacao...") + tempo decorrido.

- Consulta de Bens:
  - Tabela continua enxuta.
  - Botao "Detalhes" abre modal com campos completos e historicos.

## 3. Como Validar (checklist rapido)

1. Health:
   - `GET /api/health` retorna 200.
2. Progresso:
   - `GET /api/importacoes/geafin/ultimo` retorna JSON com `status`, `percent` e contadores.
3. Detalhe:
   - Na UI "Consulta de Bens", abrir um item e validar carregamento do modal.

## 4. Observacao de Cache (Service Worker)

Se a UI nao atualizar apos deploy:
- Hard refresh (`Ctrl+F5`).
- Se necessario: DevTools -> Application -> Service Workers -> Unregister e "Clear site data".

