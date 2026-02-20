# Status Atual do Projeto (Fase 2)

## Cabecalho

| Campo | Valor |
|---|---|
| Modulo | `docs` |
| Arquivo | `docs/STATUS_ATUAL.md` |
| Funcao no sistema | Registro canonico do que ja foi implementado e do que falta para concluir a Fase 2 |
| Data | 2026-02-17 |
| Versao | v1.1 |
| Fonte de verdade (governanca) | `PROJECT_RULES.md` |

## 1. Escopo do Projeto (resumo)

- Sistema de Gestão Patrimonial da 2a CJM.
- Execução determinística (sem IA em runtime).
- Alta auditabilidade (auditoria + histórico de carga + rastreio de inventário).
- Compliance ATN 303/2008 com citacao legal obrigatoria no codigo no formato `Art. X (AN303_ArtX)`.

## 2. Infra (VPS) - o que esta rodando

Premissas operacionais (na VPS):
- Docker Compose com `network_mode: host`.
- Frontend servido por Nginx (container) na porta `8080`.
- Backend Node/Express na porta `3001`.
- Nginx do host (CloudPanel) faz proxy do dominio para `127.0.0.1:8080` e SSL/TLS esta ativo.
- No Nginx do frontend, `/api/*` e proxyado para `127.0.0.1:3001/*`.

Arquivos relevantes:
- `docker-compose.vps.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx/default.conf`
- `docs/deploy_hostinger_supabase.md`

Nota operacional (importacao / timeout):
- A importacao do `relatorio.csv` (GEAFIN) pode demorar mais que o timeout padrao do Nginx.
- Para evitar `504 Gateway Time-out` durante `POST /api/importar-geafin`, o proxy do Nginx do frontend deve ter timeouts aumentados em `frontend/nginx/default.conf` (secao `location /api/`).

## 3. Banco de Dados (Supabase/PostgreSQL)

### 3.1 Migracoes

- `database/001_initial_schema.sql`
  - Cria schema base: `perfis`, `catalogo_bens`, `bens`, `eventos_inventario`, `contagens`, `movimentacoes`.
  - Cria log de auditoria `auditoria_log` e triggers utilitarias.
  - Implementa congelamento de movimentacao no inventario.
    - Regra legal: Art. 183 (AN303_Art183).

- `database/002_history_and_rules.sql`
  - Adiciona rastreio fino de mudanca de carga (historico de transferencias).
    - Regra legal: Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
  - Suporta importacao GEAFIN com "novos itens" como estado operacional:
    - `status_bem` inclui `AGUARDANDO_RECEBIMENTO`
    - `bens.local_fisico` permite `NULL` para itens aguardando recebimento
  - Cria view para automacao/relatorio:
    - `public.vw_forasteiros` (base: `contagens` divergentes pendentes)
    - Regra legal: Art. 185 (AN303_Art185).

- `database/003_geafin_raw.sql`
  - Cria camada espelho do GEAFIN (auditoria/copia fiel):
    - `public.geafin_import_arquivos` (metadados do arquivo importado)
    - `public.geafin_import_linhas` (linhas raw em `row_raw` JSONB + flags de normalizacao/persistencia)
    - `public.vw_geafin_relatorio_csv` (VIEW com colunas iguais ao header do GEAFIN)

- `database/004_geafin_import_progress.sql`
  - Adiciona metadados de progresso/status em `public.geafin_import_arquivos` para observabilidade e UX:
    - `total_linhas`, `status`, `finalizado_em`, `erro_resumo`.

- `database/005_regularizacao_pos_inventario.sql`
  - Permite regularizacao pos-inventario de divergencias (intrusos/forasteiros) sem apagar o fato historico.
  - Adiciona metadados minimos na tabela `contagens`:
    - `regularizado_em`, `regularizado_por_perfil_id`, `regularizacao_acao`, `regularizacao_movimentacao_id`, `regularizacao_observacoes`.
  - Regra legal: Art. 185 (AN303_Art185).

- `database/006_auth_and_access.sql`
  - Adiciona colunas de autenticacao e papeis em `perfis` (controle de acesso real):
    - `role` (`ADMIN`|`OPERADOR`)
    - `senha_hash`, `senha_definida_em`, `ultimo_login_em`
  - Regra operacional: senhas apenas como hash (bcrypt).

### 3.2 Normalizacao (SKU vs Item)

Conceito operacional:
- `catalogo_bens` representa "O que e" (modelo/tipo): descricao canonica, grupo e metadados.
- `bens` representa "Qual e" (instancia fisica): tombamento (GEAFIN), unidade dona/carga, local fisico e status.

No importador:
- O `catalogo_bens.codigo_catalogo` e derivado do CSV (ex.: `Cod Material` do GEAFIN).
- O bem referencia o catalogo por `bens.catalogo_bem_id`.

Nota:
- `bens.descricao_complementar` existe para anotações locais (ex.: observação, info adicional), não para duplicar a descrição do catálogo.

## 4. Backend (Node.js/Express)

### 4.1 Entry point e estrutura

- Entry point: `backend/server.js`
- Controladores auxiliares (inventario): `backend/src/controllers/inventarioController.js`
- Contexto para triggers (origem/ator): `backend/src/services/dbContext.js`

### 4.2 Endpoints implementados

- `GET /health`: healthcheck.
  - Retorna `authEnabled` para a UI saber se login esta ativo.
- `GET /stats`: estatisticas de bens (total, por unidade, por status).
- `GET /bens`: consulta paginada com filtros:
  - `numeroTombamento`, `q`, `localFisico`, `unidadeDonaId`, `status`, `incluirTerceiros`.
  - A busca `q` consulta `catalogo_bens.descricao` e `bens.descricao_complementar` (normalizacao SKU vs Item).
- `GET /bens/{id}`: detalhe de um bem (join com `catalogo_bens` + ultimas `movimentacoes` + `historico_transferencias`).
- `GET /perfis` e `POST /perfis`: cadastro de perfis (matricula, nome, unidade, cargo).
- Autenticacao (quando ativa na VPS):
  - `POST /auth/login`: login por matricula/senha -> JWT.
  - `POST /auth/primeiro-acesso`: definir senha do perfil cadastrado (bootstrap controlado).
  - `GET /auth/me`: retorna perfil do token.
- `POST /importar-geafin`: importacao CSV (Latin1) com upsert seguro e resumo:
  - Cria/atualiza `catalogo_bens` antes de inserir/atualizar `bens`.
  - Novo tombamento: `status='AGUARDANDO_RECEBIMENTO'` + `local_fisico=NULL`.
  - Mudanca de `unidade_dona_id` e registrada automaticamente em `historico_transferencias` via trigger.
  - Regra legal aplicada via banco:
    - Inventário em andamento bloqueia mudança de carga (Art. 183 - AN303_Art183).
  - Observabilidade e execucao longa:
    - O endpoint registra logs por requestId e imprime progresso por lote no stdout do container (`docker logs cjm_backend`).
    - O processamento e commitado em lotes (batch) para permitir acompanhamento no Supabase durante a execucao, evitando "transacao invisivel" ate o final.
  - Robustez de encoding (GEAFIN):
    - Alguns CSVs chegam com header/valores em UTF-8 interpretado como Latin1 (mojibake: `DescriÃ§Ã£o`, `LotaÃ§Ã£o`).
    - O backend aplica heuristica de correcao para chaves e valores criticos antes de normalizar (sem alterar a regra de que o arquivo e tratado como "Latin1" no upload).
- `POST /movimentar`: transferencia/cautela com trilha completa:
  - Transferencia altera `unidade_dona_id` (gera historico via trigger).
  - Quando autenticacao esta ativa, o executor e vinculado ao usuario autenticado (evita forjar perfilId).
    - Regra legal: Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).
  - Cautela altera `status` para `EM_CAUTELA` sem mudar carga.
- Inventário (offline-first):
  - `GET /inventario/eventos?status=...`
  - `POST /inventario/eventos`
  - `PATCH /inventario/eventos/:id/status`
  - `GET /inventario/contagens` (leituras por evento/sala para UI de checklist)
  - `GET /inventario/forasteiros` (divergências pendentes para regularização pós-inventário)
  - `POST /inventario/sync` (upsert em `contagens`)
    - Divergente (intruso): `tipo_ocorrencia='ENCONTRADO_EM_LOCAL_DIVERGENTE'` + `regularizacao_pendente=TRUE`.
    - Regra legal: Art. 185 (AN303_Art185).
  - `POST /inventario/regularizacoes` (encerra pendência; opcionalmente transfere carga com termo).
- `GET /docs`: Swagger/OpenAPI (basico).
- `GET /importacoes/geafin/ultimo`: progresso da ultima importacao GEAFIN (para barra de progresso na UI).

## 5. Frontend (React/Vite)

### 5.1 Telas existentes

- Consulta de bens (dados reais via `/stats` e `/bens`).
  - Detalhe do bem via drawer/modal (botao "Detalhes"), consumindo `GET /bens/{id}`.
- Operações API (health, importação, movimentação, criação de perfil).
  - Importação GEAFIN com barra de progresso (polling no endpoint `GET /importacoes/geafin/ultimo`).
- Modo inventario:
  - Baixa bens por sala via filtro `localFisico`.
  - Agrupa por catalogo (accordion com `details/summary`).
  - Scanner registra tombamento (10 digitos) e enfileira offline.
- Regularização pós-inventário:
  - Lista divergências pendentes (forasteiros) e permite encerrar pendência.
  - Para transferência de carga, exige `termoReferencia` e gera trilha (`movimentacoes` + `historico_transferencias`).
- Wizard Art. 141: UI de fluxo guiado (mock) para classificacao de inserviveis.
- Wiki / Manual (self-hosted):
  - Manual completo para usuarios e administradores.
  - Persistência de página via `#hash` (não some no refresh).
  - Conteudo versionado em `frontend/src/wiki/*.md` e renderizado na aba "Wiki / Manual".

Arquivos principais:
- `frontend/src/components/AssetsExplorer.jsx` (consulta)
- `frontend/src/components/InventoryRoomPanel.jsx` (inventario)
- `frontend/src/components/RegularizationPanel.jsx` (regularizacao)
- `frontend/src/hooks/useOfflineSync.js` (fila offline)
- `frontend/src/services/apiClient.js` (cliente HTTP)
- `frontend/src/components/WikiManual.jsx` (wiki/manual)
- `frontend/src/wiki/*.md` (conteudo do manual)

### 5.2 Offline-first (implementado)

O inventario usa fila persistida em IndexedDB (`idb-keyval`):
- Enfileira scans (tombamento + metadados do evento/sala/unidade encontrada).
- Ao voltar online, sincroniza em lote para `POST /inventario/sync`.

Importante:
- A regra de divergencia (intruso) e aplicada de forma deterministica no backend (Art. 185 - AN303_Art185).
- A aplicacao possui Service Worker (`frontend/public/sw.js`). Em caso de UI "antiga" aparecendo apos deploy, force atualizacao:
  - Hard refresh (Ctrl+F5) e, se necessario, limpar dados do site ou desregistrar o Service Worker no navegador.

### 5.3 Limites atuais (gap para completar a UX do inventario)

O modo agrupado por catalogo ja existe e ja apresenta:
- Contagem por grupo (Total vs Encontrados vs Faltantes).
- Checklist por tombamento (checkbox read-only).
- Offline-first: fila de scans + cache local do catalogo da sala (para funcionar sem internet apos baixar uma vez).

### 5.4 Equivalência com a TAREFA 3 (UX de Inventário) do prompt do Gemini

Requisitos do Gemini vs implementacao atual:

| Requisito | Status | Onde esta |
|---|---|---|
| Agrupar itens por Catalogo (SKU) | Implementado | `frontend/src/components/InventoryRoomPanel.jsx` (agrupamento + `details/summary`) |
| Accordion com expandir para listar tombamentos | Implementado (lista simples) | `frontend/src/components/InventoryRoomPanel.jsx` |
| Mostrar "Total: N" por grupo | Implementado | `frontend/src/components/InventoryRoomPanel.jsx` (contador `g.items.length`) |
| Mostrar "Encontrados vs Faltantes" por grupo | Implementado | `frontend/src/components/InventoryRoomPanel.jsx` + `GET /inventario/contagens` |
| Checklist por tombamento (check encontrado) | Implementado | `frontend/src/components/InventoryRoomPanel.jsx` (checkbox read-only) |
| Persistencia offline (IndexedDB) para contagem | Implementado | `frontend/src/hooks/useOfflineSync.js` (fila de scans) + cache do catalogo da sala em IndexedDB |
| Scanner nativo por câmera de celular (Barcode/QR Code) com foco | Implementado | `frontend/src/components/BarcodeScanner.jsx` + `InventoryRoomPanel.jsx` |
| Scanner: bipar bem da lista marca encontrado | Implementado | Scan entra na fila e ja marca check (via pending queue) |
| Scanner: bem de outra unidade toca alerta ("Intruso") | Implementado (quando online) | Lookup rápido via `GET /bens?numeroTombamento=...` se não estiver no catálogo carregado |
| Intruso vira LOCAL_DIVERGENTE sem mudar dono | Implementado | Backend `POST /inventario/sync` + DB (`contagens.tipo_ocorrencia`) |

## 6. Automacoes (n8n)

Entregaveis no repo:
- `automations/n8n_relatorio_forasteiros.json`
  - Relatorio de divergencias ("forasteiros") baseado na view `public.vw_forasteiros`.
  - Regra legal: Art. 185 (AN303_Art185).

Observacao:
- O workflow é importável, mas depende de credenciais/configurações no n8n (não versionadas).

## 7. Conformidade (onde cada regra esta aplicada)

- Art. 183 (AN303_Art183)
  - Banco: trigger/fn de bloqueio de mudanca de carga durante inventario em andamento.
- Art. 185 (AN303_Art185)
  - Banco: `contagens.tipo_ocorrencia` + constraint `regularizacao_pendente=TRUE` quando divergente.
  - Banco: regularizacao pos-inventario com metadados (mig. 005) sem apagar o fato historico.
  - Backend: `POST /inventario/sync` seta divergente de forma deterministica.
  - Backend: `POST /inventario/regularizacoes` encerra pendencia (e opcionalmente transfere carga com termo).
  - Automacao: view `vw_forasteiros` para relatorio.
- Arts. 124 e 127 (AN303_Art124 / AN303_Art127)
  - Banco: historico de mudanca de carga via trigger.
  - Backend: `/movimentar` diferencia transferencia x cautela.
- Art. 141 (AN303_Art141_*)
  - Frontend: wizard (UI) para classificacao (a logica completa pode ser incrementada depois).

## 8. Proximos passos recomendados (incrementos opcionais)

1. Cachear contagens por sala em IndexedDB para consultas/relatorios offline apos reload.
2. Criar um painel "Divergências da sala" para listar contagens divergentes que não estão no catálogo carregado da sala (Implementado na UI via `DivergencesPanel`).
3. (Opcional) Exportar Wiki para PDF interno (somente leitura) para distribuicao offline controlada.
