# Status Atual do Projeto (Runtime Ativo)

## Cabecalho

| Campo | Valor |
|---|---|
| Modulo | `docs` |
| Arquivo | `docs/STATUS_ATUAL.md` |
| Funcao no sistema | Registro canonico do estado implementado do sistema, gaps e alinhamento de governanca |
| Data | 2026-02-25 |
| Versao | v1.3 |
| Fonte de verdade (governanca) | `PROJECT_RULES.md` (v1.3.0) |

## 1. Resumo Executivo

- Sistema de Gestao Patrimonial da 2a CJM com runtime ativo (backend + frontend + automacoes).
- Execucao deterministica (sem IA em regras de negocio em runtime).
- Compliance ATN 303/2008 com rastreabilidade em banco, API, UI e Wiki.
- Projeto operando em VPS (Docker + Nginx + Supabase) com fluxo offline-first no inventario.

## 2. Alinhamento de Governanca

Sincronizado com `PROJECT_RULES.md` v1.3.0:
- API de runtime oficialmente reconhecida na governanca.
- Gates historicos de "Tarefa 0/Tarefa 1" removidos.
- Regra Wiki-First mantida: mudanca de runtime/UX/compliance exige atualizacao de documentacao no mesmo ciclo.
- Regras de Ouro mantidas como inviolaveis (incluindo Regra 3.1).
- Trilha obrigatoria de alteracoes e rollback formalizada (log geral + scripts operacionais).

## 3. Infra (VPS)

Premissas em producao:
- Docker Compose com `network_mode: host` na VPS.
- Frontend via Nginx na porta `8080` (proxy do host/CloudPanel + SSL ativo).
- Backend Node/Express na porta `3001`.
- Proxy `/api/*` do frontend para backend.

Arquivos de referencia:
- `docker-compose.vps.yml`
- `frontend/nginx/default.conf`
- `docs/deploy_hostinger_supabase.md`

Observacao operacional:
- Importacao GEAFIN pode exigir timeout maior no Nginx para evitar `504` em processamentos longos.

## 4. Banco de Dados (Supabase/PostgreSQL)

### 4.1 Migracoes aplicadas no repositorio

- `001_initial_schema.sql`: schema base + auditoria + bloqueio Art. 183.
- `002_history_and_rules.sql`: historico de carga + status `AGUARDANDO_RECEBIMENTO` + `vw_forasteiros`.
- `003_geafin_raw.sql`: camada espelho/raw do GEAFIN.
- `004_geafin_import_progress.sql`: progresso/status da importacao.
- `005_regularizacao_pos_inventario.sql`: metadados de regularizacao pos-inventario.
- `006_auth_and_access.sql`: autenticacao/roles em `perfis`.
- `007_forasteiros_queue_apenas_encerrado.sql`: controle de fila de forasteiros por estado do evento.
- `008_documentos_anexos.sql`: tipo/tabela `documentos` para evidencias e anexos.
- `009_ocorrencia_bem_terceiro.sql`: ocorrencia `BEM_DE_TERCEIRO` no inventario.
- `010_inserviveis_wizard_persistencia.sql`: persistencia do fluxo Art. 141.
- `011_fotos_e_locais.sql`: `foto_url`, tabela `locais` e `bens.local_id`.
- `012_view_terceiros_inventario.sql`: view de consulta de terceiros no inventario.
- `013_documentos_avaliacoes_inserviveis.sql`: vinculo de documentos com avaliacoes de inserviveis.
- `014_locais_crud_soft_delete.sql`: soft delete (`ativo`) em `locais`.

### 4.2 Modelagem operacional consolidada

- `catalogo_bens`: representa o tipo/modelo (SKU).
- `bens`: representa a instancia fisica (item).
- `contagens`: fato de inventario e divergencia.
- `movimentacoes` + `historico_transferencias`: trilha de carga e cautela.
- `documentos`: evidencias e referencias de arquivos (Drive).

## 5. Backend (Node.js/Express)

### 5.1 Estrutura

- Entry point: `backend/server.js`
- Inventario: `backend/src/controllers/inventarioController.js`
- Contexto de auditoria DB: `backend/src/services/dbContext.js`
- PDF: `backend/src/services/pdfReports.js`

### 5.2 Endpoints implementados (macro)

- Saude e auth: `/health`, `/auth/*`, `/auth/me`.
- Bens/perfis: `/bens`, `/bens/:id`, `/perfis*`.
- Inventario: `/inventario/eventos*`, `/inventario/sync`, `/inventario/forasteiros`, `/inventario/bens-terceiros`, `/inventario/regularizacoes`, `/inventario/bens-nao-identificados`.
- Operacao GEAFIN: `/importar-geafin`, `/importacoes/geafin/ultimo`, `/importacoes/geafin/:id/cancelar`.
- Governanca de cadastro: `/locais*`, `/bens/vincular-local`, `/bens/:id/operacional`, `/catalogo-bens/:id/foto`.
- Evidencias e relatorios: `/documentos*`, `/pdf/termos`, `/pdf/forasteiros`, `/fotos/upload`, `/drive/fotos/upload`.

## 6. Frontend (React/Vite)

Telas e fluxos ativos:
- Consulta de bens e detalhes.
- Inventario sala-a-sala com scanner e fila offline (IndexedDB).
- Regularizacao pos-inventario.
- Movimentacoes (transferencia/cautela).
- Wizard Art. 141 com persistencia e evidencias.
- Wiki/Manual self-hosted com conteudo versionado em `frontend/src/wiki/*.md`.

Arquivos principais:
- `frontend/src/components/AssetsExplorer.jsx`
- `frontend/src/components/InventoryRoomPanel.jsx`
- `frontend/src/components/RegularizationPanel.jsx`
- `frontend/src/components/MovimentacoesPanel.jsx`
- `frontend/src/components/ClassificationWizard.jsx`
- `frontend/src/components/WikiManual.jsx`
- `frontend/src/hooks/useOfflineSync.js`
- `frontend/src/services/apiClient.js`

## 7. Automacoes (n8n)

Artefatos principais no repositorio:
- `automations/n8n_relatorio_forasteiros.json`
- `automations/n8n_relatorio_forasteiros_pdf.json`
- `automations/n8n_gerador_termos.json`
- `automations/n8n_gerador_termos_pdf.json`
- `automations/n8n_drive_upload_fotos_webhook.json`

Observacao:
- Workflows sao importaveis, mas dependem de credenciais e variaveis no ambiente n8n (nao versionadas).

## 8. Mapa de Conformidade (ATN 303/2008)

- Art. 183 (AN303_Art183): bloqueio de mudanca de carga durante inventario em andamento (trigger/regra de banco + validacoes no fluxo).
- Art. 185 (AN303_Art185): divergencia registrada sem troca automatica de titularidade; regularizacao posterior controlada.
- Art. 124 e Art. 127 (AN303_Art124/AN303_Art127): separacao transferencia x cautela com trilha formal.
- Art. 141 (AN303_Art141_*): classificacao de inserviveis com fluxo guiado e persistencia.
- Art. 99, Art. 110 VI, Art. 175 IX: controle segregado de bens de terceiros.
- Art. 175 (AN303_Art175): evidencia para itens sem identificacao via foto/descricao/localizacao.

## 9. Proximos Passos Recomendados

1. Publicar um changelog tecnico incremental por release, ligado ao Wiki/Manual.
2. Expandir testes automatizados para fluxos de regularizacao, documentos e upload de fotos.
3. Consolidar dashboard de monitoramento operacional (importacoes, filas e erros por endpoint).

## 10. Atualizacao 2026-02-26 (Frontend IA + Dashboard)

Principais entregas:

- Nova arquitetura de navegacao com grupos e submenu.
- Abertura padrao no Dashboard Executivo Operacional.
- Aba propria de Importacoes para GEAFIN.
- Menu proprio de Auditoria e Logs.
- Administracao do Painel reduzida para Infra + Seguranca.
- Gestao de Locais incorporada na aba Movimentacoes.

Impacto em runtime/API:

- Nenhuma mudanca de endpoint, metodo ou contrato.
- Reorganizacao estritamente de frontend e documentacao.
