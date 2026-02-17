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
- Importação GEAFIN determinística, auditável e robusta a variações de CSV.
- Observabilidade e UX: barra de progresso real na UI.
- Consulta de bens com detalhe completo (sem poluir a tabela).

## 2. Mudancas Principais

### 2.1 Banco (Supabase)

- Migracao aplicada: `database/004_geafin_import_progress.sql`
  - Adiciona metadados em `public.geafin_import_arquivos`:
    - `total_linhas`, `status`, `finalizado_em`, `erro_resumo`
  - Objetivo: permitir acompanhamento de progresso e status na UI.

- Migracao aplicada: `database/005_regularizacao_pos_inventario.sql`
  - Permite encerrar pendencias de divergencia (forasteiros) apos o inventario, registrando metadados:
    - `regularizado_em`, `regularizado_por_perfil_id`, `regularizacao_acao`, `regularizacao_movimentacao_id`, `regularizacao_observacoes`.
  - Regra legal: Art. 185 (AN303_Art185).

### 2.2 Backend (Node/Express)

- Importação GEAFIN (`POST /importar-geafin`):
  - Registra espelho raw e commit em lotes (batch) para permitir acompanhamento durante execucao.
  - Corrige casos comuns de encoding (mojibake) e normaliza tombamento para apenas digitos.
  - Corrige `ON CONFLICT` para bater com indice UNIQUE parcial do Postgres.

- Progresso da importacao:
  - `GET /importacoes/geafin/ultimo`
  - Retorna `totalLinhas`, `linhasInseridas`, `percent`, contadores de falhas e `status`.

- Detalhe do bem:
  - `GET /bens/{id}`
  - Retorna dados do bem + catalogo (SKU) + ultimas movimentacoes + historico de transferencias.

- Regularizacao pos-inventario:
  - `GET /inventario/forasteiros`: lista divergencias pendentes (intrusos/forasteiros).
  - `POST /inventario/regularizacoes`: encerra pendencia; opcionalmente executa transferencia de carga com `termoReferencia`.

### 2.2.1 Autenticacao (controle de acesso real)

- Migracao (banco): `database/006_auth_and_access.sql`
  - Adiciona `role` e colunas de senha (hash) em `perfis`.
- Backend:
  - Adiciona rotas:
    - `POST /auth/login`
    - `POST /auth/primeiro-acesso`
    - `GET /auth/me`
  - Quando `AUTH_ENABLED=true`:
    - Rotas protegidas exigem `Authorization: Bearer <JWT>`.
    - Operacoes administrativas exigem `role=ADMIN` (ex.: importar GEAFIN, criar perfis, regularizacao).
  - `GET /health` passa a retornar `authEnabled` para orientar a UI.

### 2.3 Frontend (React/Vite)

- Operações API:
  - Barra de progresso real do GEAFIN com polling em `GET /importacoes/geafin/ultimo`.
  - Persistência do estado: ao dar refresh/trocar de aba, consulta a última importação e retoma polling se estiver `EM_ANDAMENTO`.
  - Quando estiver em 0% no início, exibe estado indeterminado ("Preparando importação...") + tempo decorrido.

- Consulta de Bens:
  - Tabela continua enxuta.
  - Botao "Detalhes" abre modal com campos completos e historicos.

- Wiki / Manual (self-hosted):
  - Nova aba "Wiki / Manual" com manual extremamente detalhado para usuarios e administradores.
  - Conteudo em Markdown versionado junto do frontend (`frontend/src/wiki/*.md`).
  - Persistência de página no `#hash` para não sumir no refresh.
  - Estilo de Markdown padronizado no CSS global.

- Regularizacao pos-inventario:
  - Nova aba "Regularizacao" para encerrar pendencias do Art. 185.
  - Documentacao no Wiki: "Regularizacao pos-inventario (forasteiros)".

- Autenticacao (quando ativa na VPS):
  - App exibe tela de Login/Primeiro acesso quando `authEnabled=true`.
  - Token JWT e armazenado no navegador e enviado automaticamente em chamadas `fetch`.
  - Papeis refletidos na UI (ADMIN/OPERADOR), com desabilitacao de operacoes administrativas para nao-admin.

## 3. Como Validar (checklist rapido)

1. Health:
   - `GET /api/health` retorna 200.
2. Progresso:
   - `GET /api/importacoes/geafin/ultimo` retorna JSON com `status`, `percent` e contadores.
3. Detalhe:
   - Na UI "Consulta de Bens", abrir um item e validar carregamento do modal.
4. Wiki:
   - Na UI, abrir a aba "Wiki / Manual" e navegar entre paginas.
   - Dar refresh e confirmar que a pagina do wiki permanece selecionada.

## 4. Observacao de Cache (Service Worker)

Se a UI não atualizar após deploy:
- Hard refresh (`Ctrl+F5`).
- Se necessario: DevTools -> Application -> Service Workers -> Unregister e "Clear site data".
